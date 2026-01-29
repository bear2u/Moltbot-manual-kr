# Gateway 개요 및 아키텍처

**작성일**: 2026-01-28  
**모듈**: `src/gateway/`

## 1. 개요

Gateway는 Moltbot의 핵심 제어 평면(Control Plane)으로, 모든 클라이언트, 노드, 채널을 연결하고 조율하는 중앙 서버입니다. WebSocket과 HTTP를 통해 통신하며, 실시간 이벤트 브로드캐스팅, RPC 스타일 메서드 호출, 세션 관리, 노드 페어링 등 다양한 기능을 제공합니다.

## 2. 핵심 역할

### 2.1 통신 허브
- **WebSocket 서버**: 클라이언트, 노드, 웹 UI와의 실시간 양방향 통신
- **HTTP 서버**: REST API, Control UI, OpenAI 호환 엔드포인트 제공
- **이벤트 브로드캐스팅**: 모든 연결된 클라이언트에 실시간 이벤트 전송

### 2.2 리소스 관리
- **채널 관리**: WhatsApp, Telegram, Slack 등 메시징 채널의 생명주기 관리
- **노드 관리**: 모바일 앱, 브라우저 확장 등 외부 노드의 등록 및 통신
- **세션 관리**: AI 에이전트 세션의 추적 및 제어
- **크론 서비스**: 스케줄된 작업 실행

### 2.3 보안 및 인증
- **토큰 기반 인증**: `gateway.auth.token` 또는 환경변수 `CLAWDBOT_GATEWAY_TOKEN`
- **비밀번호 기반 인증**: `gateway.auth.password` 또는 환경변수 `CLAWDBOT_GATEWAY_PASSWORD`
- **Tailscale 통합**: Tailscale Serve/Funnel을 통한 자동 인증
- **디바이스 페어링**: 공개키 기반 디바이스 인증
- **스코프 기반 권한**: `operator.read`, `operator.write`, `operator.admin`, `operator.approvals`, `operator.pairing`

## 3. 아키텍처

### 3.1 서버 구조

```
Gateway Server
├── HTTP Server (Node.js http/https)
│   ├── Control UI (Lit 웹 컴포넌트)
│   ├── Canvas Host (A2UI)
│   ├── OpenAI 호환 API (/v1/chat/completions)
│   ├── OpenResponses API (/v1/responses)
│   ├── Hooks 엔드포인트 (/hooks/*)
│   └── Plugin HTTP 핸들러
├── WebSocket Server (ws)
│   ├── 클라이언트 연결 관리
│   ├── 프로토콜 핸들러 (connect, request/response)
│   └── 이벤트 브로드캐스팅
├── 채널 관리자
│   ├── 채널 플러그인 로딩
│   ├── 채널 시작/중지
│   └── 채널 상태 추적
├── 노드 레지스트리
│   ├── 노드 등록/해제
│   ├── 노드 페어링
│   └── 노드 명령 실행
├── 크론 서비스
│   ├── 작업 스케줄링
│   ├── 실행 로그
│   └── 이벤트 브로드캐스팅
└── 설정 관리
    ├── 설정 파일 감시
    ├── 핫 리로드
    └── 스키마 검증
```

### 3.2 주요 컴포넌트

#### 3.2.1 서버 시작 (`server.impl.ts`)
- `startGatewayServer()`: Gateway 서버 초기화 및 시작
- 설정 로드 및 마이그레이션
- 플러그인 로딩
- HTTP/WebSocket 서버 생성
- 사이드카 서비스 시작 (브라우저 제어, Gmail 워처 등)

#### 3.2.2 런타임 상태 (`server-runtime-state.ts`)
- HTTP 서버 인스턴스
- WebSocket 서버 인스턴스
- 클라이언트 세트 관리
- 브로드캐스터 생성
- 채팅 실행 상태 관리

#### 3.2.3 WebSocket 연결 처리 (`server/ws-connection.ts`)
- 연결 핸드셰이크
- 인증 처리
- 메시지 라우팅
- 연결 종료 처리

#### 3.2.4 메서드 핸들러 (`server-methods.ts`)
- RPC 스타일 메서드 호출 처리
- 권한 검사
- 핸들러 라우팅
- 응답 생성

#### 3.2.5 이벤트 브로드캐스팅 (`server-broadcast.ts`)
- 모든 클라이언트에 이벤트 전송
- 스코프 기반 필터링
- 느린 클라이언트 감지 및 처리

## 4. 프로토콜

### 4.1 WebSocket 프로토콜

Gateway는 JSON 기반 WebSocket 프로토콜을 사용합니다.

#### 4.1.1 프레임 타입

**Connect Frame** (클라이언트 → 서버)
```typescript
{
  type: "connect",
  params: {
    token?: string;
    password?: string;
    client: {
      id: string;
      displayName?: string;
      version?: string;
      platform?: string;
    };
    role?: "operator" | "node";
    scopes?: string[];
    // ...
  }
}
```

**Request Frame** (클라이언트 → 서버)
```typescript
{
  type: "request",
  method: string;
  params?: Record<string, unknown>;
  id: string;
}
```

**Response Frame** (서버 → 클라이언트)
```typescript
{
  type: "response",
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code: string;
    message: string;
  };
}
```

**Event Frame** (서버 → 클라이언트)
```typescript
{
  type: "event",
  event: string;
  payload: unknown;
  seq: number;
  stateVersion?: {
    presence?: number;
    health?: number;
  };
}
```

### 4.2 프로토콜 버전

현재 프로토콜 버전: `PROTOCOL_VERSION` (정의됨)

클라이언트는 `minProtocol`과 `maxProtocol`을 지정하여 호환성 범위를 제시할 수 있습니다.

## 5. 바인딩 모드

Gateway는 다양한 바인딩 모드를 지원합니다:

- **loopback** (`127.0.0.1`): 로컬 전용, 기본값
- **lan** (`0.0.0.0`): LAN 전체에 바인딩
- **tailnet**: Tailscale IPv4 주소에만 바인딩
- **auto**: loopback 우선, 실패 시 LAN

바인딩 모드는 `gateway.bind` 설정 또는 `--bind` CLI 옵션으로 제어됩니다.

## 6. 보안 고려사항

### 6.1 인증 요구사항

- **loopback 바인딩**: 인증 선택적 (로컬 요청은 신뢰)
- **LAN 바인딩**: 인증 필수 (토큰 또는 비밀번호)
- **Tailscale Serve/Funnel**: 비밀번호 인증 필수 (Funnel의 경우)

### 6.2 신뢰할 수 있는 프록시

`gateway.trustedProxies` 설정을 통해 역방향 프록시의 IP 주소를 지정할 수 있습니다. 이를 통해 `X-Forwarded-For` 헤더를 신뢰할 수 있습니다.

### 6.3 TLS 지원

`gateway.tls.enabled` 설정을 통해 TLS를 활성화할 수 있습니다. TLS 활성화 시:
- WebSocket은 `wss://`로 접근
- 인증서 지문 검증 지원
- 자체 서명 인증서 지원

## 7. 주요 기능

### 7.1 실시간 통신
- WebSocket을 통한 양방향 통신
- 이벤트 브로드캐스팅
- 스트리밍 응답 지원

### 7.2 세션 관리
- AI 에이전트 세션 추적
- 세션별 설정 오버라이드
- 세션 히스토리 관리

### 7.3 채널 통합
- 다중 메시징 채널 지원
- 채널별 계정 관리
- 채널 상태 모니터링

### 7.4 노드 통합
- 모바일 앱 연결
- 브라우저 확장 연결
- 노드 페어링 및 인증
- 노드 명령 실행

### 7.5 크론 작업
- 스케줄된 작업 실행
- 실행 로그 관리
- 작업 상태 추적

### 7.6 설정 관리
- JSON 설정 파일 관리
- 스키마 검증
- 핫 리로드 지원
- 동시 편집 보호

## 8. 성능 고려사항

### 8.1 페이로드 제한
- 최대 페이로드 크기: `MAX_PAYLOAD_BYTES` (512KB)
- 최대 버퍼 크기: `MAX_BUFFERED_BYTES` (1.5MB)
- 느린 클라이언트 자동 차단

### 8.2 중복 제거
- 요청 중복 제거 (Dedupe)
- TTL: 5분
- 최대 엔트리: 1000개

### 8.3 정기 작업
- Tick 이벤트: 30초마다
- Health 갱신: 60초마다
- Dedupe 정리: 60초마다

## 9. 확장성

### 9.1 플러그인 시스템
- Gateway 메서드 확장
- HTTP 핸들러 확장
- 이벤트 핸들러 확장

### 9.2 채널 플러그인
- 채널별 Gateway 메서드 추가
- 채널별 HTTP 엔드포인트 추가
- 채널별 상태 관리

### 9.3 노드 확장
- 노드별 기능 추가
- 노드별 명령 추가
- 노드별 이벤트 구독

## 10. 로깅

Gateway는 서브시스템별 로깅을 지원합니다:
- `gateway`: 메인 Gateway 로그
- `gateway.ws`: WebSocket 연결 로그
- `gateway.health`: Health 체크 로그
- `gateway.channels`: 채널 관련 로그
- `gateway.cron`: 크론 작업 로그
- `gateway.hooks`: Hooks 관련 로그
- `gateway.plugins`: 플러그인 관련 로그

각 서브시스템은 독립적인 로거를 가지며, 로그 레벨과 출력 형식을 개별적으로 제어할 수 있습니다.
