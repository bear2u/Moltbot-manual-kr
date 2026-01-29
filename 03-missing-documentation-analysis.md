---
layout: default
title: Missing Documentation Analysis
---

# 빠진 문서 분석

**작성일**: 2026-01-28  
**분석 대상**: docs.molt.bot 문서 vs reviews 폴더

## 개요

docs.molt.bot의 공식 문서와 reviews 폴더의 기술 문서를 비교하여 빠진 중요한 내용을 분석합니다.

## 현재 reviews 폴더 구조

```
reviews/
├── 01-project-overview.md          # 프로젝트 전체 개요
├── 02-browser-automation.md         # 브라우저 자동화 시스템
├── dashboard/                       # Gateway Dashboard (Control UI)
└── gateway/                         # Gateway 서버 상세 기술 문서
```

## 빠진 중요한 문서 영역

### 1. CLI 명령어 시스템 (높은 우선순위)

**docs.molt.bot에 있음**: `/cli/*` 섹션 (40+ CLI 명령어 문서)  
**reviews에 없음**: CLI 명령어 구현 및 아키텍처에 대한 상세 기술 문서

**빠진 내용**:
- CLI 명령어 레지스트리 시스템 (`src/cli/program/command-registry.ts`)
- 각 주요 CLI 명령어의 구현 상세:
  - `moltbot onboard` - 온보딩 위저드
  - `moltbot configure` - 설정 관리
  - `moltbot agent` - 에이전트 실행
  - `moltbot message` - 메시지 전송
  - `moltbot gateway` - Gateway 제어
  - `moltbot channels` - 채널 관리
  - `moltbot nodes` - 노드 관리
  - `moltbot memory` - 메모리 관리
  - `moltbot logs` - 로그 관리
  - 기타 서브 CLI들 (gateway, daemon, system, models, approvals, devices, node, pairing, security, update, sandbox, cron, dns, docs, hooks, tui, voicecall)
- CLI 옵션 파싱 및 검증
- Gateway 클라이언트 연결 및 RPC 호출
- CLI 출력 포맷팅 및 테이블 렌더링

**권장 문서 구조**:
```
reviews/cli/
├── 00-cli-overview.md              # CLI 시스템 개요
├── 01-command-registry.md          # 명령어 레지스트리 시스템
├── 02-onboard-command.md           # 온보딩 위저드
├── 03-agent-command.md            # 에이전트 실행 명령어
├── 04-message-command.md          # 메시지 전송 명령어
├── 05-gateway-cli.md               # Gateway 제어 CLI
├── 06-channels-cli.md              # 채널 관리 CLI
├── 07-nodes-cli.md                 # 노드 관리 CLI
├── 08-memory-cli.md                # 메모리 관리 CLI
└── 09-sub-clis.md                  # 서브 CLI들 (gateway, daemon, system 등)
```

### 2. Core Concepts - Agent Loop (높은 우선순위)

**docs.molt.bot에 있음**: `/concepts/agent-loop.md` (사용자 가이드)  
**reviews에 없음**: Agent Loop 구현 상세 기술 문서

**빠진 내용**:
- Agent Loop 라이프사이클 (`src/auto-reply/reply/agent-runner.ts`)
- `runEmbeddedPiAgent` 구현 (`src/agents/pi-embedded-runner/run.ts`)
- 이벤트 구독 및 스트리밍 (`src/agents/pi-embedded-subscribe.handlers.ts`)
- 도구 실행 및 결과 처리
- 스트리밍 및 부분 응답 처리
- 큐 관리 및 동시성 제어
- 세션 준비 및 워크스페이스 설정
- 프롬프트 어셈블리 및 시스템 프롬프트 빌드
- 훅 포인트 및 인터셉터

**권장 문서 구조**:
```
reviews/agents/
├── 00-agent-overview.md            # Agent 시스템 개요
├── 01-agent-loop.md               # Agent Loop 라이프사이클
├── 02-embedded-pi-runner.md       # Embedded Pi Runner 구현
├── 03-event-subscription.md       # 이벤트 구독 및 스트리밍
├── 04-tool-execution.md           # 도구 실행 및 결과 처리
├── 05-prompt-assembly.md          # 프롬프트 어셈블리
└── 06-session-preparation.md      # 세션 준비 및 워크스페이스 설정
```

### 3. Core Concepts - Memory System (높은 우선순위)

**docs.molt.bot에 있음**: `/concepts/memory.md` (사용자 가이드)  
**reviews에 없음**: Memory 시스템 구현 상세 기술 문서

**빠진 내용**:
- Memory Index Manager (`src/memory/manager.ts`)
- 벡터 임베딩 시스템 (`src/memory/embeddings.ts`)
- 하이브리드 검색 (BM25 + 벡터) (`src/memory/hybrid.ts`)
- SQLite 벡터 확장 통합 (`src/memory/sqlite-vec.ts`)
- 메모리 파일 동기화 (`src/memory/sync-memory-files.ts`)
- 임베딩 배치 처리 (`src/memory/batch-openai.ts`, `src/memory/batch-gemini.ts`)
- 메모리 청킹 및 인덱싱 (`src/memory/internal.ts`)
- 세션 트랜스크립트 인덱싱
- 자동 메모리 플러시 (pre-compaction)

**권장 문서 구조**:
```
reviews/memory/
├── 00-memory-overview.md          # Memory 시스템 개요
├── 01-memory-index-manager.md     # Memory Index Manager
├── 02-embeddings.md               # 임베딩 시스템
├── 03-hybrid-search.md           # 하이브리드 검색 (BM25 + 벡터)
├── 04-sqlite-vec.md               # SQLite 벡터 확장
├── 05-memory-sync.md              # 메모리 파일 동기화
├── 06-batch-processing.md         # 배치 처리
└── 07-memory-flush.md             # 자동 메모리 플러시
```

### 4. Core Concepts - Session Management (높은 우선순위)

**docs.molt.bot에 있음**: `/concepts/session.md` (사용자 가이드)  
**reviews에 없음**: Session Management 구현 상세 기술 문서

**빠진 내용**:
- 세션 스토어 관리 (`src/config/sessions.ts`)
- 세션 키 해석 및 정규화 (`src/sessions/session-key-utils.ts`)
- 세션 라이프사이클 관리
- 세션 리셋 정책 및 트리거
- 세션 프루닝 (tool results 제거)
- 세션 압축 (compaction) 시스템
- 세션 전송 정책 (send policy)
- 세션 트랜스크립트 관리 (`src/sessions/transcript-events.ts`)
- 모델 오버라이드 (`src/sessions/model-overrides.ts`)
- Verbose 레벨 오버라이드 (`src/sessions/level-overrides.ts`)

**권장 문서 구조**:
```
reviews/sessions/
├── 00-session-overview.md         # Session Management 개요
├── 01-session-store.md            # 세션 스토어 관리
├── 02-session-keys.md             # 세션 키 해석 및 정규화
├── 03-session-lifecycle.md        # 세션 라이프사이클
├── 04-session-reset.md            # 세션 리셋 정책
├── 05-session-pruning.md          # 세션 프루닝
├── 06-session-compaction.md       # 세션 압축
├── 07-send-policy.md              # 세션 전송 정책
└── 08-transcript-management.md    # 트랜스크립트 관리
```

### 5. Channels 시스템 (중간 우선순위)

**docs.molt.bot에 있음**: `/channels/*` 섹션 (각 채널별 사용자 가이드)  
**reviews에 없음**: Channels 시스템 구현 상세 기술 문서

**빠진 내용**:
- 채널 플러그인 시스템 (`src/channels/registry.ts`)
- 채널 정규화 및 라우팅 (`src/channels/normalize/`)
- 인바운드 메시지 처리 (`src/channels/plugins/inbound/`)
- 아웃바운드 메시지 전송 (`src/channels/plugins/outbound/`)
- 페어링 시스템 (`src/channels/plugins/pairing.ts`)
- 명령어 게이팅 (`src/channels/command-gating.ts`)
- 멘션 게이팅 (`src/channels/mention-gating.ts`)
- 그룹 메시지 라우팅 (`src/channels/plugins/group-mentions.ts`)
- 채널별 액션 핸들러 (`src/channels/plugins/actions/`)
- 채널 상태 이슈 (`src/channels/plugins/status-issues/`)

**권장 문서 구조**:
```
reviews/channels/
├── 00-channels-overview.md        # Channels 시스템 개요
├── 01-channel-registry.md         # 채널 레지스트리
├── 02-normalization.md            # 메시지 정규화
├── 03-inbound-processing.md       # 인바운드 처리
├── 04-outbound-delivery.md        # 아웃바운드 전송
├── 05-pairing.md                  # 페어링 시스템
├── 06-command-gating.md           # 명령어 게이팅
├── 07-group-routing.md             # 그룹 메시지 라우팅
└── 08-channel-actions.md          # 채널 액션 핸들러
```

### 6. Providers 시스템 (중간 우선순위)

**docs.molt.bot에 있음**: `/providers/*` 섹션 (각 프로바이더별 사용자 가이드)  
**reviews에 없음**: Providers 시스템 구현 상세 기술 문서

**빠진 내용**:
- 프로바이더 레지스트리 (`src/providers/`)
- 모델 해석 및 폴백 (`src/config/models.ts`)
- OAuth 인증 (`src/config/auth.ts`)
- API 키 관리
- 모델 카탈로그 로딩 (`src/gateway/server-model-catalog.ts`)
- 모델 선택 및 오버라이드
- 사용량 추적 (`src/gateway/server-methods/usage.ts`)

**권장 문서 구조**:
```
reviews/providers/
├── 00-providers-overview.md       # Providers 시스템 개요
├── 01-provider-registry.md        # 프로바이더 레지스트리
├── 02-model-resolution.md         # 모델 해석 및 폴백
├── 03-auth-management.md          # 인증 관리
├── 04-model-catalog.md            # 모델 카탈로그
└── 05-usage-tracking.md            # 사용량 추적
```

### 7. Tools & Skills 시스템 (중간 우선순위)

**docs.molt.bot에 있음**: `/tools/*` 섹션 (각 도구별 사용자 가이드)  
**reviews에 없음**: Tools & Skills 시스템 구현 상세 기술 문서

**빠진 내용**:
- Skills 로딩 및 관리 (`src/agents/skills.ts`)
- 도구 등록 및 실행 (`src/agents/tools/`)
- 브라우저 도구 (`src/agents/tools/browser.ts`)
- Exec 도구 (`src/agents/tools/exec.ts`)
- Web 도구 (`src/agents/tools/web.ts`)
- 도구 정책 및 샌드박싱
- 도구 결과 처리 및 스트리밍

**권장 문서 구조**:
```
reviews/tools/
├── 00-tools-overview.md           # Tools & Skills 시스템 개요
├── 01-skills-management.md        # Skills 관리
├── 02-tool-registry.md            # 도구 등록 시스템
├── 03-browser-tool.md             # 브라우저 도구
├── 04-exec-tool.md                # Exec 도구
├── 05-web-tool.md                 # Web 도구
└── 06-tool-policy.md              # 도구 정책 및 샌드박싱
```

### 8. Nodes 시스템 (중간 우선순위)

**docs.molt.bot에 있음**: `/nodes/*` 섹션 (각 노드 기능별 사용자 가이드)  
**reviews에 없음**: Nodes 시스템 구현 상세 기술 문서

**빠진 내용**:
- 노드 등록 및 관리 (`src/gateway/server-methods/nodes.ts`)
- 노드 명령어 정책 (`src/gateway/node-command-policy.ts`)
- 디바이스 인증 (`src/gateway/device-auth.ts`)
- 노드 이벤트 구독 (`src/gateway/server-node-subscriptions.ts`)
- 노드 명령어 실행
- Canvas, Camera, Screen, Location 등 노드 기능

**권장 문서 구조**:
```
reviews/nodes/
├── 00-nodes-overview.md           # Nodes 시스템 개요
├── 01-node-registration.md        # 노드 등록 및 관리
├── 02-node-commands.md            # 노드 명령어 시스템
├── 03-device-auth.md              # 디바이스 인증
├── 04-node-subscriptions.md       # 노드 이벤트 구독
└── 05-node-features.md            # 노드 기능 (Canvas, Camera 등)
```

### 9. Automation & Hooks (낮은 우선순위)

**docs.molt.bot에 있음**: `/automation/*`, `/hooks.md` (사용자 가이드)  
**reviews에 있음**: `gateway/specialized/03-hooks.md` (일부)

**빠진 내용**:
- Cron 작업 시스템 (`src/cron/`)
- Webhook 시스템 (`src/gateway/server/hooks.ts`)
- Hooks 매핑 및 변환 (`src/gateway/hooks-mapping.ts`)
- Gmail Pub/Sub 통합
- Auth 모니터링

**권장 문서 구조**:
```
reviews/automation/
├── 00-automation-overview.md     # Automation 시스템 개요
├── 01-cron-system.md             # Cron 작업 시스템
├── 02-webhooks.md                # Webhook 시스템
└── 03-gmail-pubsub.md            # Gmail Pub/Sub 통합
```

### 10. Web & Interfaces (낮은 우선순위)

**docs.molt.bot에 있음**: `/web/*` 섹션 (사용자 가이드)  
**reviews에 있음**: `dashboard/` (일부), `gateway/specialized/07-control-ui.md`

**빠진 내용**:
- WebChat 구현 (`src/web/`)
- Control UI 구현 상세 (`src/gateway/control-ui.ts`)
- TUI 구현 (`src/tui/`)

**권장 문서 구조**:
```
reviews/web/
├── 00-web-overview.md            # Web & Interfaces 개요
├── 01-webchat.md                 # WebChat 구현
└── 02-tui.md                     # TUI 구현
```

## 우선순위별 권장 사항

### 높은 우선순위 (즉시 작성 권장)
1. **CLI 명령어 시스템** - 사용자가 가장 많이 접하는 인터페이스
2. **Agent Loop** - 핵심 기능의 구현 상세
3. **Memory System** - 중요한 기능이지만 구현이 복잡함
4. **Session Management** - 핵심 기능의 구현 상세

### 중간 우선순위 (추후 작성 권장)
5. **Channels 시스템** - 확장 가능한 플러그인 시스템
6. **Providers 시스템** - 모델 통합의 핵심
7. **Tools & Skills** - 에이전트 기능 확장의 핵심
8. **Nodes 시스템** - 멀티 디바이스 지원의 핵심

### 낮은 우선순위 (선택적 작성)
9. **Automation & Hooks** - 일부 문서가 이미 존재
10. **Web & Interfaces** - 일부 문서가 이미 존재

## 결론

현재 reviews 폴더는 Gateway와 Dashboard에 대한 상세한 기술 문서를 잘 갖추고 있지만, 다음 영역들이 빠져있습니다:

1. **CLI 시스템** - 가장 중요한 사용자 인터페이스
2. **Core Concepts 구현** - Agent Loop, Memory, Session Management
3. **확장 시스템** - Channels, Providers, Tools, Nodes

이러한 문서들을 추가하면 Moltbot의 전체 아키텍처와 구현 상세를 완전히 문서화할 수 있습니다.
