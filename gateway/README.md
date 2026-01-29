# Gateway 문서 인덱스

**최종 업데이트**: 2026-01-28

Gateway는 Moltbot의 핵심 제어 평면으로, 모든 클라이언트, 노드, 채널을 연결하고 조율하는 중앙 서버입니다.

## 📁 문서 구조

Gateway 문서는 다음 구조로 구성되어 있습니다:

```
gateway/
├── README.md                    # 이 파일
├── 00-gateway-overview.md       # Gateway 전체 개요
├── 01-server-startup.md         # 서버 시작 프로세스
├── 02-websocket-protocol.md     # WebSocket 프로토콜
├── 03-authentication.md         # 인증 시스템
├── 04-event-broadcasting.md    # 이벤트 브로드캐스팅
├── 05-method-handlers.md        # 메서드 핸들러 개요
├── 06-node-management.md        # 노드 관리
├── 07-channel-management.md     # 채널 관리
├── 08-cron-service.md           # 크론 서비스
├── 09-config-management.md      # 설정 관리
├── 10-http-server.md            # HTTP 서버
├── protocol/                    # 프로토콜 관련
│   ├── 00-protocol-overview.md  # 프로토콜 개요
│   └── 01-protocol-schemas.md   # 프로토콜 스키마
├── server/                      # 서버 내부 컴포넌트
│   └── 00-server-components-overview.md
├── server-methods/              # 메서드 핸들러 상세
│   ├── 00-methods-overview.md   # 메서드 개요
│   ├── 01-send-handler.md       # Send 메서드
│   └── 02-chat-handlers.md      # Chat 메서드
├── specialized/                 # 특수 기능
│   ├── 00-specialized-features-overview.md
│   ├── 01-discovery.md          # Discovery 시스템
│   ├── 02-exec-approval.md      # Exec Approval
│   ├── 03-hooks.md              # Hooks 시스템
│   ├── 04-chat-abort.md         # 채팅 중단
│   ├── 05-chat-attachments.md   # 채팅 첨부파일
│   ├── 06-openai-http.md        # OpenAI HTTP API
│   └── 07-control-ui.md         # Control UI 서빙
└── utils/                       # 유틸리티 함수
    ├── 00-utils-overview.md      # 유틸리티 개요
    ├── 01-http-utils.md          # HTTP 유틸리티
    ├── 02-session-utils-detail.md # 세션 유틸리티
    ├── 03-node-helpers.md        # 노드 헬퍼
    ├── 04-device-auth.md         # 디바이스 인증
    ├── 05-node-command-policy.md # 노드 명령 정책
    ├── 06-control-ui-shared.md   # Control UI 공유
    ├── 07-protocol-client-info.md # 프로토콜 클라이언트 정보
    └── 08-config-reload.md       # 설정 리로드
```

## 📚 문서 가이드

### 시작하기

1. **[Gateway 개요](00-gateway-overview.md)** - Gateway의 역할과 아키텍처를 이해합니다.
2. **[서버 시작](01-server-startup.md)** - Gateway가 어떻게 시작되는지 확인합니다.
3. **[WebSocket 프로토콜](02-websocket-protocol.md)** - 클라이언트와의 통신 프로토콜을 학습합니다.

### 핵심 기능

#### 통신
- **[WebSocket 프로토콜](02-websocket-protocol.md)** - 실시간 양방향 통신
- **[프로토콜 개요](protocol/00-protocol-overview.md)** - 프로토콜 구조 및 프레임 타입
- **[프로토콜 스키마](protocol/01-protocol-schemas.md)** - 타입 정의 및 검증

#### 인증 및 보안
- **[인증 시스템](03-authentication.md)** - 토큰, 비밀번호, Tailscale, 디바이스 인증
- **[디바이스 인증](utils/04-device-auth.md)** - 디바이스 페어링 페이로드

#### 이벤트 및 메시징
- **[이벤트 브로드캐스팅](04-event-broadcasting.md)** - 실시간 이벤트 전송
- **[메서드 핸들러](05-method-handlers.md)** - RPC 스타일 메서드 호출
- **[메서드 개요](server-methods/00-methods-overview.md)** - 모든 메서드 목록

#### 리소스 관리
- **[노드 관리](06-node-management.md)** - 외부 노드 등록 및 통신
- **[채널 관리](07-channel-management.md)** - 메시징 채널 생명주기
- **[크론 서비스](08-cron-service.md)** - 스케줄된 작업 실행
- **[설정 관리](09-config-management.md)** - 설정 파일 관리 및 리로드

#### HTTP 서버
- **[HTTP 서버](10-http-server.md)** - HTTP 엔드포인트 및 라우팅
- **[OpenAI HTTP API](specialized/06-openai-http.md)** - OpenAI 호환 API
- **[Control UI 서빙](specialized/07-control-ui.md)** - 웹 UI 서빙
- **[Hooks 시스템](specialized/03-hooks.md)** - 외부 시스템 통합

### 특수 기능

- **[Discovery](specialized/01-discovery.md)** - 네트워크에서 Gateway 발견
- **[Exec Approval](specialized/02-exec-approval.md)** - 명령 실행 승인 시스템
- **[채팅 중단](specialized/04-chat-abort.md)** - 실행 중인 채팅 중단
- **[채팅 첨부파일](specialized/05-chat-attachments.md)** - 이미지 첨부파일 처리

### 내부 구현

#### 서버 컴포넌트
- **[서버 컴포넌트 개요](server/00-server-components-overview.md)** - Health, Hooks, TLS 등

#### 메서드 핸들러 상세
- **[Send 핸들러](server-methods/01-send-handler.md)** - 메시지 전송
- **[Chat 핸들러](server-methods/02-chat-handlers.md)** - WebChat 기능

#### 유틸리티
- **[HTTP 유틸리티](utils/01-http-utils.md)** - HTTP 요청 처리
- **[세션 유틸리티](utils/02-session-utils-detail.md)** - 세션 관리
- **[노드 헬퍼](utils/03-node-helpers.md)** - 노드 관련 유틸리티
- **[노드 명령 정책](utils/05-node-command-policy.md)** - 명령 허용/거부 정책
- **[설정 리로드](utils/08-config-reload.md)** - 설정 변경 감지 및 리로드

## 🔍 빠른 참조

### 주요 개념
- **WebSocket 프로토콜**: JSON 기반 실시간 통신
- **인증**: 토큰/비밀번호/Tailscale/디바이스 기반
- **이벤트 브로드캐스팅**: 모든 클라이언트에 실시간 이벤트 전송
- **메서드 핸들러**: RPC 스타일 메서드 호출 시스템
- **노드**: 모바일 앱, 브라우저 확장 등 외부 클라이언트
- **채널**: WhatsApp, Telegram 등 메시징 채널

### 주요 메서드 카테고리
- **Agent**: `agent`, `agent.wait`, `agent.identity.get`
- **Chat**: `chat.history`, `chat.send`, `chat.abort`
- **Sessions**: `sessions.list`, `sessions.preview`, `sessions.patch`
- **Channels**: `channels.status`, `channels.logout`
- **Cron**: `cron.list`, `cron.add`, `cron.run`
- **Config**: `config.get`, `config.set`, `config.apply`
- **Nodes**: `node.list`, `node.invoke`, `node.pair.*`

### 주요 이벤트
- `connect.challenge`: 연결 챌린지
- `agent`: 에이전트 실행 이벤트
- `chat`: 채팅 이벤트
- `presence`: 프레즌스 변경
- `health`: Health 업데이트
- `cron`: 크론 작업 이벤트

## 📖 읽기 순서 추천

### 초급
1. [Gateway 개요](00-gateway-overview.md)
2. [WebSocket 프로토콜](02-websocket-protocol.md)
3. [인증 시스템](03-authentication.md)
4. [메서드 핸들러](05-method-handlers.md)

### 중급
1. [이벤트 브로드캐스팅](04-event-broadcasting.md)
2. [노드 관리](06-node-management.md)
3. [채널 관리](07-channel-management.md)
4. [HTTP 서버](10-http-server.md)

### 고급
1. [프로토콜 스키마](protocol/01-protocol-schemas.md)
2. [서버 컴포넌트](server/00-server-components-overview.md)
3. [메서드 핸들러 상세](server-methods/)
4. [특수 기능](specialized/)
5. [유틸리티](utils/)

## 🔗 관련 문서

- [프로젝트 개요](../01-project-overview.md)
- [브라우저 자동화](../02-browser-automation.md)
- [Dashboard 문서](../dashboard/00-dashboard-overview.md)

## 📝 문서 업데이트

문서는 소스 코드 변경 시 함께 업데이트됩니다. 각 문서는 해당 모듈의 구현을 반영합니다.
