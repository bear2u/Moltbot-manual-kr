# Moltbot 프로젝트 전체 분석

**작성일**: 2026-01-28  
**프로젝트**: moltbot  
**버전**: 2026.1.27-beta.1

## 1. 프로젝트 개요

### 1.1 목적
Moltbot은 **개인 AI 어시스턴트 플랫폼**으로, 사용자가 자신의 디바이스에서 실행하는 로컬 퍼스트(local-first) AI 어시스턴트입니다. 다양한 메시징 채널을 통합하고, AI 에이전트가 사용자의 일상적인 작업을 자동화할 수 있도록 합니다.

### 1.2 핵심 가치 제안
- **멀티 채널 통합**: WhatsApp, Telegram, Slack, Discord, Signal, iMessage 등 다양한 메시징 플랫폼 지원
- **로컬 실행**: Gateway를 사용자 디바이스에서 직접 실행하여 프라이버시 보장
- **확장 가능**: 플러그인 시스템을 통한 채널 및 기능 확장
- **크로스 플랫폼**: macOS, iOS, Android, Linux, Windows 지원

## 2. 아키텍처 개요

### 2.1 Gateway 중심 아키텍처

```
┌─────────────────────────────────────────┐
│         Messaging Channels              │
│  WhatsApp / Telegram / Slack / Discord │
│  Signal / iMessage / Google Chat / ...  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│            Gateway                      │
│       (Control Plane)                   │
│     ws://127.0.0.1:18789                │
│                                         │
│  - WebSocket Server                     │
│  - HTTP Server                          │
│  - Event Broadcasting                   │
│  - Session Management                   │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴───────┬───────────┬──────────┐
       │               │           │          │
       ▼               ▼           ▼          ▼
┌──────────┐   ┌──────────┐  ┌─────────┐ ┌────────┐
│ Pi Agent │   │ CLI      │  │ Web UI  │ │ Nodes  │
│ (RPC)    │   │          │  │         │ │        │
└──────────┘   └──────────┘  └─────────┘ └────────┘
```

### 2.2 주요 컴포넌트

#### Gateway Server (`src/gateway/`)
- **역할**: 모든 메시징 채널과 클라이언트를 관리하는 중앙 제어 평면
- **통신**: WebSocket 기반 (기본 포트 18789)
- **기능**:
  - WebSocket 서버로 클라이언트 연결 관리
  - HTTP 서버로 Control UI 및 WebChat 제공
  - 이벤트 브로드캐스팅 (presence, health, agent, chat 등)
  - 세션 관리 및 라우팅
  - 설정 관리 및 동적 업데이트

#### Agents (`src/agents/`)
- **역할**: AI 에이전트 런타임 (436개 파일)
- **통합**: `@mariozechner/pi-agent-core` 기반
- **기능**:
  - 세션별 에이전트 실행
  - 도구 호출 및 스트리밍
  - 컨텍스트 관리 및 압축
  - 메모리 및 히스토리 관리

#### Channels (`src/channels/`)
- **역할**: 메시징 채널 플러그인 시스템
- **Core 채널**: WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Google Chat
- **Extension 채널**: Matrix, Microsoft Teams, Zalo, BlueBubbles, LINE, Twitch, Nostr 등
- **기능**:
  - 인바운드 메시지 수신 및 정규화
  - 아웃바운드 메시지 전송
  - 그룹 메시지 라우팅
  - 페어링 및 액세스 제어

#### Browser Control (`src/browser/`)
- **역할**: 브라우저 자동화 시스템
- **특징**: Chrome 확장 프로그램을 통한 Relay 방식 (자세한 내용은 별도 문서 참조)
- **기능**:
  - 전용 Chrome 프로필 실행
  - 확장 프로그램을 통한 기존 탭 제어
  - Playwright 기반 자동화
  - 스크린샷, 스냅샷, 상호작용

## 3. 기술 스택

### 3.1 언어 및 런타임
- **언어**: TypeScript (ESM)
- **런타임**: Node.js 22+ (Bun 지원)
- **패키지 관리**: pnpm (기본), npm, bun 지원
- **빌드**: TypeScript 컴파일러, Rolldown (UI 번들링)

### 3.2 주요 의존성

#### AI & Agent
- `@mariozechner/pi-agent-core`: AI 에이전트 코어
- `@mariozechner/pi-ai`: AI 통합
- `@mariozechner/pi-coding-agent`: 코딩 에이전트

#### 메시징
- `@whiskeysockets/baileys`: WhatsApp (Baileys)
- `grammy`: Telegram
- `@slack/bolt`: Slack
- `discord.js`: Discord
- `@line/bot-sdk`: LINE

#### 인프라
- `ws`: WebSocket 서버
- `express`: HTTP 서버 (레거시)
- `hono`: 현대적인 HTTP 프레임워크
- `@sinclair/typebox`: 스키마 정의 및 검증

#### 브라우저 자동화
- `playwright-core`: 브라우저 자동화
- `chromium-bidi`: Chrome DevTools Protocol

#### 미디어 처리
- `sharp`: 이미지 처리
- `file-type`: 파일 타입 감지

### 3.3 개발 도구
- **테스트**: Vitest (70% 커버리지 기준)
- **린트**: Oxlint
- **포맷**: Oxfmt
- **타입 체크**: TypeScript strict mode

## 4. 프로젝트 구조

### 4.1 디렉토리 구조

```
moltbot/
├── src/                    # 소스 코드
│   ├── gateway/           # Gateway 서버 구현
│   ├── agents/            # AI 에이전트 런타임
│   ├── channels/          # 채널 플러그인 시스템
│   ├── browser/           # 브라우저 자동화
│   ├── cli/               # CLI 명령어
│   ├── commands/          # 명령어 핸들러
│   ├── config/            # 설정 관리
│   ├── web/               # 웹 UI
│   └── ...
├── extensions/            # 확장 플러그인
│   ├── matrix/            # Matrix 채널
│   ├── msteams/           # Microsoft Teams
│   ├── voice-call/        # 음성 통화
│   └── ...
├── apps/                  # 네이티브 앱
│   ├── macos/             # macOS 메뉴바 앱
│   ├── ios/               # iOS 앱
│   └── android/           # Android 앱
├── assets/                # 정적 자산
│   └── chrome-extension/  # Chrome 확장 프로그램
├── docs/                  # 문서 (Mintlify)
└── skills/                # Skills 플랫폼
```

### 4.2 핵심 모듈

#### Gateway 모듈 (`src/gateway/`)
- `server.impl.ts`: Gateway 서버 시작 및 관리
- `server-runtime-state.ts`: 런타임 상태 관리
- `server-methods.ts`: WebSocket 요청 핸들러
- `server-ws-runtime.ts`: WebSocket 연결 관리
- `auth.ts`: 인증 및 권한 관리

#### Channels 모듈 (`src/channels/`)
- `registry.ts`: 채널 레지스트리
- `session.ts`: 세션 관리
- `targets.ts`: 타겟 해석
- `plugins/`: 채널별 플러그인 로직

#### Browser 모듈 (`src/browser/`)
- `server.ts`: 브라우저 제어 서버
- `extension-relay.ts`: 확장 프로그램 Relay 서버
- `server-context.ts`: 프로필 컨텍스트 관리
- `client.ts`: 브라우저 클라이언트
- `routes/`: API 라우트 핸들러

## 5. 주요 기능

### 5.1 멀티 채널 지원
- **Core 채널**: WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Google Chat
- **Extension 채널**: Matrix, Microsoft Teams, Zalo, BlueBubbles, LINE, Twitch, Nostr 등
- 각 채널은 플러그인 시스템을 통해 독립적으로 구현됨

### 5.2 AI 에이전트 시스템
- **세션 관리**: 메인 세션, 그룹 세션, 활성화 모드
- **도구 시스템**: 브라우저, 캔버스, 노드, cron, 세션 간 통신
- **컨텍스트 관리**: 자동 압축, 히스토리 관리, 메모리 통합

### 5.3 보안 모델
- **기본**: 메인 세션은 호스트에서 실행 (전체 접근)
- **샌드박스**: 비메인 세션은 Docker 샌드박스에서 실행 가능
- **페어링**: 디바이스 기반 인증 및 승인
- **DM 정책**: 기본적으로 페어링 모드 (알 수 없는 발신자 차단)

### 5.4 플러그인 시스템
- **확장 가능한 채널**: `extensions/` 디렉토리에 플러그인으로 구현
- **Skills 플랫폼**: 번들/관리/워크스페이스 스킬 지원
- **플러그인 SDK**: `src/plugin-sdk/` 제공

## 6. 개발 워크플로우

### 6.1 빌드 및 실행
```bash
pnpm install          # 의존성 설치
pnpm build            # TypeScript 컴파일
pnpm ui:build         # UI 빌드
pnpm gateway:watch    # 개발 모드 (자동 리로드)
```

### 6.2 테스트
```bash
pnpm test             # 단위 테스트
pnpm test:coverage    # 커버리지
pnpm test:live        # 라이브 테스트 (실제 키 필요)
pnpm test:docker:all  # Docker E2E 테스트
```

### 6.3 린트/포맷
```bash
pnpm lint             # Oxlint
pnpm format           # Oxfmt
pnpm lint:swift       # Swift 린트
```

## 7. 아키텍처 패턴

### 7.1 의존성 주입
- `createDefaultDeps()` 패턴 사용
- 테스트 가능한 구조

### 7.2 이벤트 기반 아키텍처
- WebSocket 이벤트 브로드캐스팅
- 클라이언트는 이벤트 구독으로 상태 동기화

### 7.3 플러그인 아키텍처
- 채널별 독립적인 플러그인 구현
- 공통 인터페이스를 통한 통합

### 7.4 세션 관리
- 세션별 상태 격리
- 세션별 도구 접근 제어

## 8. 버전 및 릴리스

### 8.1 현재 버전
- **버전**: `2026.1.27-beta.1`
- **상태**: beta

### 8.2 릴리스 채널
- **stable**: 태그된 릴리스 (`vYYYY.M.D`)
- **beta**: 프리릴리스 (`vYYYY.M.D-beta.N`)
- **dev**: main 브랜치

## 9. 프로젝트 특징

### 9.1 장점
1. **모듈화된 구조**: 채널별 플러그인, 확장 가능
2. **타입 안정성**: TypeScript, TypeBox 스키마
3. **테스트 커버리지**: 70% 기준, 다양한 테스트 유형
4. **크로스 플랫폼**: macOS/iOS/Android 지원
5. **문서화**: Mintlify 기반 문서

### 9.2 특이사항
- **브라우저 자동화**: Chrome 확장 프로그램을 통한 Relay 방식 (자세한 내용은 별도 문서 참조)
- **로컬 퍼스트**: Gateway를 사용자 디바이스에서 실행
- **멀티 에이전트**: 여러 세션을 통한 에이전트 간 통신 지원

## 10. 다음 단계

### 10.1 추가 분석 가능 영역
1. **Gateway 프로토콜**: WebSocket 프로토콜 상세 분석
2. **채널 구현**: 특정 채널의 구현 방식 분석
3. **에이전트 루프**: AI 에이전트 실행 흐름 분석
4. **보안 모델**: 샌드박스 및 페어링 메커니즘 분석

### 10.2 참고 문서
- [공식 문서](https://docs.molt.bot)
- [아키텍처 문서](https://docs.molt.bot/concepts/architecture)
- [브라우저 자동화 문서](./02-browser-automation.md)
