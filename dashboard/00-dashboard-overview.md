---
layout: default
title: Dashboard Overview
---

# Gateway Dashboard 개요

**작성일**: 2026-01-28  
**프로젝트**: moltbot  
**모듈**: `ui/src/ui/`

## 1. 개요

Gateway Dashboard는 Moltbot Gateway를 브라우저에서 제어할 수 있는 웹 기반 Control UI입니다. Vite + Lit으로 구현된 단일 페이지 애플리케이션(SPA)이며, Gateway WebSocket을 통해 실시간으로 통신합니다.

## 2. 기술 스택

- **프레임워크**: Lit (Web Components)
- **빌드 도구**: Vite
- **통신**: WebSocket (Gateway Protocol)
- **스타일링**: CSS (커스텀 디자인 시스템)
- **타입**: TypeScript

## 3. 아키텍처

### 3.1 구조

```
┌─────────────────────────────────────────┐
│         Browser (Dashboard)             │
│                                         │
│  ┌─────────────────────────────────┐  │
│  │  MoltbotApp (Lit Element)        │  │
│  │  - State Management              │  │
│  │  - WebSocket Connection          │  │
│  │  - Event Handling                │  │
│  └─────────────────────────────────┘  │
│              │                         │
│              │ WebSocket                │
│              ▼                         │
└─────────────────────────────────────────┘
              │
              │ ws://127.0.0.1:18789
              │
┌─────────────▼─────────────────────────┐
│         Gateway Server                │
│  - WebSocket Handler                  │
│  - HTTP Server (Static Files)         │
│  - Event Broadcasting                 │
└───────────────────────────────────────┘
```

### 3.2 주요 컴포넌트

#### MoltbotApp (`ui/src/ui/app.ts`)
- **역할**: 메인 애플리케이션 컴포넌트
- **기능**:
  - WebSocket 연결 관리
  - 전역 상태 관리
  - 라우팅 및 네비게이션
  - 테마 관리 (다크/라이트/시스템)

#### Views (`ui/src/ui/views/`)
- 각 기능별 뷰 컴포넌트
- Chat, Overview, Channels, Sessions 등

#### Controllers (`ui/src/ui/controllers/`)
- 비즈니스 로직 및 Gateway API 호출
- 상태 관리 및 이벤트 처리

#### Gateway Client (`ui/src/ui/gateway.ts`)
- WebSocket 클라이언트 래퍼
- 요청/응답 처리
- 이벤트 구독

## 4. 접근 방법

### 4.1 로컬 접근
```
http://127.0.0.1:18789/
또는
http://localhost:18789/
```

### 4.2 원격 접근

#### Tailscale Serve (권장)
```bash
moltbot gateway --tailscale serve
```
- HTTPS 자동 제공
- Tailscale identity 기반 인증 가능

#### SSH 터널
```bash
ssh -N -L 18789:127.0.0.1:18789 user@gateway-host
```
그 다음 로컬에서:
```
http://127.0.0.1:18789/
```

### 4.3 CLI 명령어
```bash
moltbot dashboard
```
- 토큰이 포함된 URL 생성
- 브라우저 자동 열기 (가능한 경우)
- SSH 힌트 표시 (headless 환경)

## 5. 인증

### 5.1 인증 방식

#### Token 인증 (권장)
- `gateway.auth.token` 설정
- 또는 `CLAWDBOT_GATEWAY_TOKEN` 환경 변수
- Dashboard 설정에서 저장 (localStorage)

#### Password 인증
- `gateway.auth.password` 설정
- 메모리에만 저장 (localStorage에 저장되지 않음)

#### Tailscale Identity 인증
- `gateway.auth.allowTailscale: true` 설정 시
- Tailscale Serve를 통한 접근 시 자동 인증

### 5.2 WebSocket Handshake
```typescript
{
  type: "req",
  id: 1,
  method: "connect",
  params: {
    auth: {
      token: "...",  // 또는
      password: "..."
    },
    clientName: "control-ui",
    clientVersion: "...",
    deviceIdentity: { ... }
  }
}
```

## 6. 메뉴 구조

### 6.1 Chat
- **경로**: `/chat` (기본)
- **기능**: Gateway와 직접 채팅
- **설명**: "Direct gateway chat session for quick interventions."

### 6.2 Control

#### Overview
- **경로**: `/overview`
- **기능**: Gateway 상태, 접근 설정, 스냅샷
- **설명**: "Gateway status, entry points, and a fast health read."

#### Channels
- **경로**: `/channels`
- **기능**: 채널 관리 및 설정
- **설명**: "Manage channels and settings."

#### Instances
- **경로**: `/instances`
- **기능**: 연결된 클라이언트 및 노드 목록
- **설명**: "Presence beacons from connected clients and nodes."

#### Sessions
- **경로**: `/sessions`
- **기능**: 활성 세션 관리 및 설정
- **설명**: "Inspect active sessions and adjust per-session defaults."

#### Cron Jobs
- **경로**: `/cron`
- **기능**: 스케줄된 작업 관리
- **설명**: "Schedule wakeups and recurring agent runs."

### 6.3 Agent

#### Skills
- **경로**: `/skills`
- **기능**: Skills 관리 및 API 키 설정
- **설명**: "Manage skill availability and API key injection."

#### Nodes
- **경로**: `/nodes`
- **기능**: 페어링된 디바이스 및 기능 관리
- **설명**: "Paired devices, capabilities, and command exposure."

### 6.4 Settings

#### Config
- **경로**: `/config`
- **기능**: 설정 파일 편집 (`~/.clawdbot/moltbot.json`)
- **설명**: "Edit ~/.clawdbot/moltbot.json safely."

#### Debug
- **경로**: `/debug`
- **기능**: Gateway 스냅샷, 이벤트 로그, 수동 RPC 호출
- **설명**: "Gateway snapshots, events, and manual RPC calls."

#### Logs
- **경로**: `/logs`
- **기능**: Gateway 파일 로그 실시간 조회
- **설명**: "Live tail of the gateway file logs."

## 7. 주요 기능

### 7.1 실시간 통신
- WebSocket을 통한 양방향 통신
- 이벤트 기반 업데이트 (presence, health, chat 등)
- 스트리밍 응답 지원

### 7.2 상태 관리
- Lit의 `@state` 데코레이터 사용
- 로컬 상태와 Gateway 상태 동기화
- localStorage를 통한 설정 영구 저장

### 7.3 테마 지원
- 다크 모드 / 라이트 모드
- 시스템 설정 자동 감지
- 부드러운 전환 애니메이션

### 7.4 반응형 디자인
- 모바일 지원
- 사이드바 토글
- 리사이저블 패널

## 8. 보안 고려사항

### 8.1 HTTPS 권장
- HTTP는 비보안 컨텍스트로 WebCrypto 차단 가능
- Tailscale Serve 사용 권장
- 또는 로컬 접근 (`127.0.0.1`)

### 8.2 인증 필수
- Gateway는 기본적으로 인증 필요
- Token 또는 Password 설정 필수
- Tailscale Identity 인증 (선택)

### 8.3 토큰 저장
- Token은 localStorage에 저장
- Password는 메모리에만 저장
- 브라우저 개발자 도구에서 확인 가능

## 9. 개발

### 9.1 빌드
```bash
pnpm ui:build
```

### 9.2 개발 서버
```bash
pnpm ui:dev
```

### 9.3 원격 Gateway 연결
개발 서버에서 원격 Gateway 연결:
```
http://localhost:5173/?gatewayUrl=ws://gateway-host:18789&token=...
```

## 10. 파일 구조

```
ui/src/ui/
├── app.ts                    # 메인 앱 컴포넌트
├── app-render.ts            # 렌더링 헬퍼
├── app-gateway.ts           # Gateway 연결
├── app-chat.ts              # Chat 로직
├── app-channels.ts          # Channels 로직
├── navigation.ts            # 라우팅
├── gateway.ts               # WebSocket 클라이언트
├── views/                   # 뷰 컴포넌트
│   ├── chat.ts
│   ├── overview.ts
│   ├── channels.ts
│   ├── sessions.ts
│   ├── cron.ts
│   ├── skills.ts
│   ├── nodes.ts
│   ├── config.ts
│   ├── debug.ts
│   └── logs.ts
├── controllers/             # 컨트롤러
│   ├── chat.ts
│   ├── channels.ts
│   ├── sessions.ts
│   ├── cron.ts
│   ├── skills.ts
│   ├── nodes.ts
│   ├── config.ts
│   └── ...
└── types.ts                 # 타입 정의
```

## 11. 참고 문서

- [Control UI 문서](https://docs.molt.bot/web/control-ui)
- [Dashboard 접근](https://docs.molt.bot/web/dashboard)
- [Tailscale 설정](https://docs.molt.bot/gateway/tailscale)
- [원격 접근](https://docs.molt.bot/gateway/remote)
