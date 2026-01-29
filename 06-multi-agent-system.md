# 멀티 에이전트 시스템 가이드

**작성일**: 2026-01-28  
**관련 문서**: `docs/gateway/configuration`, `docs/concepts/session-tool`

## 개요

Moltbot은 하나의 Gateway에서 여러 개의 독립적인 에이전트를 실행할 수 있는 멀티 에이전트 시스템을 지원합니다. 각 에이전트는 고유한 워크스페이스, 세션, 모델 설정, 도구 정책을 가질 수 있으며, 인바운드 메시지를 라우팅하는 바인딩 시스템과 에이전트 간 통신 메커니즘을 제공합니다.

## 주요 개념

### 1. 에이전트 정의 (`agents.list[]`)

각 에이전트는 `agents.list` 배열에 정의됩니다:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        default: true,
        name: "Primary Agent",
        workspace: "~/clawd",
        model: "anthropic/claude-opus-4-5",
        identity: {
          name: "Samantha",
          emoji: "🦥"
        }
      },
      {
        id: "work",
        workspace: "~/clawd-work",
        model: "openai/gpt-5.2",
        identity: {
          name: "WorkBot",
          emoji: "💼"
        }
      }
    ]
  }
}
```

**에이전트 설정 필드**:

- `id` (필수): 고유한 에이전트 식별자 (소문자, 숫자, 하이픈, 언더스코어만 허용, 최대 64자)
- `default` (선택): 기본 에이전트로 지정 (여러 개 지정 시 첫 번째 사용, 경고 로그)
- `name` (선택): 표시용 이름
- `workspace` (선택): 에이전트 워크스페이스 경로 (기본값: `~/clawd-<agentId>`)
- `agentDir` (선택): 에이전트 디렉토리 경로 (기본값: `~/.clawdbot/agents/<agentId>/agent`)
- `model` (선택): 에이전트 기본 모델 (`provider/model` 또는 `{primary, fallbacks}`)
- `identity` (선택): 에이전트 아이덴티티 (이름, 테마, 이모지, 아바타)
- `groupChat` (선택): 그룹 채팅 멘션 패턴 설정
- `subagents` (선택): 서브 에이전트 설정
- `sandbox` (선택): 샌드박스 설정
- `tools` (선택): 에이전트별 도구 정책

**소스 코드 위치**: `src/config/types.agents.ts`, `src/config/zod-schema.agent-runtime.ts`

### 2. 라우팅 바인딩 (`bindings[]`)

인바운드 메시지를 특정 에이전트로 라우팅하기 위해 `bindings` 배열을 사용합니다:

```json5
{
  bindings: [
    {
      agentId: "work",
      match: {
        channel: "whatsapp",
        accountId: "biz"
      }
    },
    {
      agentId: "main",
      match: {
        channel: "telegram",
        peer: { kind: "group", id: "-1001234567890" }
      }
    },
    {
      agentId: "work",
      match: {
        channel: "discord",
        guildId: "123456789012345678"
      }
    }
  ]
}
```

**바인딩 매칭 우선순위** (높은 순서부터):

1. `match.peer` - 특정 DM/그룹/채널 매칭
2. `match.guildId` - Discord Guild ID 매칭
3. `match.teamId` - Slack Team ID 매칭
4. `match.accountId` (정확한 값) - 특정 계정 매칭
5. `match.accountId: "*"` - 채널 전체 매칭
6. 기본 에이전트 (`agents.list[].default` 또는 첫 번째 항목)

**소스 코드 위치**: `src/routing/resolve-route.ts`, `src/routing/bindings.ts`

### 3. 세션 키 구조

각 세션은 에이전트 ID를 포함한 고유한 세션 키를 가집니다:

```
agent:<agentId>:<mainKey>                    # DM 세션 (mainKey는 보통 "main")
agent:<agentId>:<channel>:dm:<peerId>        # 채널별 DM 세션 (dmScope: "per-channel-peer")
agent:<agentId>:dm:<peerId>                  # 피어별 DM 세션 (dmScope: "per-peer")
agent:<agentId>:<channel>:group:<groupId>     # 그룹 채팅 세션
agent:<agentId>:<channel>:channel:<channelId> # 채널 세션 (Discord/Slack)
agent:<agentId>:subagent:<uuid>              # 서브 에이전트 세션
```

**세션 키 해석**:

- `agent:` 접두사는 멀티 에이전트 세션임을 나타냅니다
- `<agentId>`는 에이전트 식별자입니다
- DM 세션은 `session.dmScope` 설정에 따라 다른 키 구조를 가집니다:
  - `"main"`: 모든 DM이 `agent:<agentId>:main`으로 통합
  - `"per-peer"`: 각 피어별로 분리 (`agent:<agentId>:dm:<peerId>`)
  - `"per-channel-peer"`: 채널+피어별로 분리 (`agent:<agentId>:<channel>:dm:<peerId>`)

**소스 코드 위치**: `src/routing/session-key.ts`, `src/config/sessions/main-session.ts`

## 에이전트 간 통신

### 1. `sessions_send` 도구

한 에이전트가 다른 에이전트의 세션으로 메시지를 보낼 수 있습니다:

```typescript
// 도구 호출 예시
sessions_send({
  sessionKey: "agent:work:main",
  message: "이 작업을 검토해주세요",
  timeoutSeconds: 30
})
```

**동작 흐름**:

1. **요청 단계**: 요청 에이전트가 `sessions_send`를 호출하여 타겟 세션으로 메시지 전송
2. **실행 단계**: 타겟 에이전트가 메시지를 받아 처리 (기본 에이전트 턴 실행)
3. **Ping-Pong 루프** (선택적): `maxPingPongTurns > 0`일 때, 요청자와 타겟이 번갈아가며 대화
4. **Announce 단계**: 최종 결과를 타겟 채널로 전송 (선택적)

**Ping-Pong 루프**:

- 기본 최대 턴 수: 5 (`session.agentToAgent.maxPingPongTurns`)
- 각 턴에서 에이전트는 `REPLY_SKIP`을 응답하면 루프 종료
- 루프는 요청자 → 타겟 → 요청자 → 타겟 순서로 진행
- 각 턴의 컨텍스트는 `buildAgentToAgentReplyContext`로 생성

**Announce 단계**:

- Ping-Pong 루프 종료 후, 타겟 에이전트가 최종 응답을 생성
- `ANNOUNCE_SKIP`을 응답하면 채널로 전송하지 않음
- 그 외의 응답은 타겟 세션의 채널로 자동 전송

**소스 코드 위치**: 
- `src/agents/tools/sessions-send-tool.ts` (메인 로직)
- `src/agents/tools/sessions-send-tool.a2a.ts` (에이전트 간 통신 플로우)
- `src/agents/tools/sessions-send-helpers.ts` (헬퍼 함수)

### 2. `sessions_spawn` 도구

백그라운드 서브 에이전트를 생성하여 작업을 수행합니다:

```typescript
// 도구 호출 예시
sessions_spawn({
  task: "이 코드를 리뷰해주세요",
  label: "code-review",
  agentId: "work",  // 선택적: 다른 에이전트로 스폰 가능
  model: "openai/gpt-5.2-mini",  // 선택적: 모델 오버라이드
  cleanup: "keep"  // "keep" 또는 "delete"
})
```

**동작 흐름**:

1. **스폰 단계**: 새로운 `agent:<agentId>:subagent:<uuid>` 세션 생성
2. **실행 단계**: 서브 에이전트가 작업 수행 (비동기, 즉시 반환)
3. **Announce 단계**: 작업 완료 후 결과를 요청자 채널로 전송

**서브 에이전트 특징**:

- 서브 에이전트는 세션 도구(`sessions_*`)를 사용할 수 없음 (재귀 방지)
- 서브 에이전트는 기본적으로 전체 도구 세트를 사용하지만, `tools.subagents.tools`로 제한 가능
- 서브 에이전트 세션은 `agents.defaults.subagents.archiveAfterMinutes` (기본 60분) 후 자동 아카이브
- 서브 에이전트는 다른 에이전트로 스폰 가능 (`agentId` 파라미터), 단 `subagents.allowAgents` 설정 필요

**Allowlist 제어**:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        subagents: {
          allowAgents: ["work", "personal"]  // 또는 ["*"]로 모든 에이전트 허용
        }
      }
    ]
  }
}
```

**소스 코드 위치**: `src/agents/tools/sessions-spawn-tool.ts`

### 3. 에이전트 간 통신 정책

에이전트 간 통신은 `tools.agentToAgent` 설정으로 제어됩니다:

```json5
{
  tools: {
    agentToAgent: {
      enabled: true,  // 기본값: false
      allow: ["main", "work", "personal"]  // 또는 ["*"]로 모든 에이전트 허용
    }
  }
}
```

**정책 검사**:

- `enabled: false`일 때: 모든 에이전트 간 통신 차단
- `enabled: true`일 때: `allow` 배열에 있는 에이전트만 통신 가능
- `allow: ["*"]`일 때: 모든 에이전트 간 통신 허용
- 와일드카드 패턴 지원: `"work-*"`로 `work-*`로 시작하는 모든 에이전트 허용

**적용되는 도구**:

- `sessions_send`: 에이전트 간 메시지 전송
- `sessions_list`: 다른 에이전트 세션 목록 조회
- `sessions_history`: 다른 에이전트 세션 히스토리 조회
- `session_status`: 다른 에이전트 세션 상태 조회

**소스 코드 위치**: `src/agents/tools/sessions-helpers.ts` (`createAgentToAgentPolicy`)

### 4. Ping-Pong 루프 설정

에이전트 간 대화의 최대 턴 수를 제어합니다:

```json5
{
  session: {
    agentToAgent: {
      maxPingPongTurns: 5  // 0-5, 기본값: 5
    }
  }
}
```

**동작**:

- `maxPingPongTurns: 0`: Ping-Pong 루프 비활성화 (1회 응답만)
- `maxPingPongTurns: 1-5`: 지정된 턴 수만큼 대화 진행
- 각 턴에서 `REPLY_SKIP`을 응답하면 즉시 종료
- 최대 턴 수에 도달하면 자동으로 Announce 단계로 진행

**소스 코드 위치**: `src/agents/tools/sessions-send-helpers.ts` (`resolvePingPongTurns`)

## 에이전트 격리 및 보안

### 1. 워크스페이스 격리

각 에이전트는 독립적인 워크스페이스를 가집니다:

- 기본 워크스페이스: `~/clawd-<agentId>` (기본 에이전트는 `agents.defaults.workspace` 사용)
- 각 에이전트의 파일 작업은 자신의 워크스페이스에서만 수행
- 메모리 파일(`memory/*.md`)도 에이전트별로 분리

**소스 코드 위치**: `src/agents/agent-scope.ts` (`resolveAgentWorkspaceDir`)

### 2. 세션 격리

각 에이전트는 독립적인 세션 스토어를 가집니다:

- 세션 스토어 경로: `~/.clawdbot/agents/<agentId>/sessions/sessions.json`
- 각 에이전트의 세션은 완전히 분리되어 있음
- 세션 키에 에이전트 ID가 포함되어 자동으로 격리됨

**소스 코드 위치**: `src/config/sessions/main-session.ts`

### 3. 샌드박스 격리

에이전트별 샌드박스 설정으로 추가 격리 가능:

```json5
{
  agents: {
    list: [
      {
        id: "public",
        sandbox: {
          mode: "all",  // 모든 세션 샌드박스
          scope: "agent",  // 에이전트별 컨테이너 격리
          workspaceAccess: "none"  // 워크스페이스 접근 불가
        },
        tools: {
          allow: ["sessions_list", "sessions_send"],  // 제한된 도구만 허용
          deny: ["exec", "write", "read"]
        }
      }
    ]
  }
}
```

**샌드박스 세션 도구 가시성**:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        sessionToolsVisibility: "spawned"  // 또는 "all"
      }
    }
  }
}
```

- `"spawned"`: 자신이 생성한 서브 에이전트 세션만 볼 수 있음 (기본값)
- `"all"`: 모든 세션에 접근 가능

**소스 코드 위치**: `src/agents/tools/sessions-send-tool.ts` (라인 64-68)

### 4. 도구 정책 격리

에이전트별로 다른 도구 정책을 적용할 수 있습니다:

```json5
{
  agents: {
    list: [
      {
        id: "readonly",
        tools: {
          profile: "messaging",  // 기본 프로필
          allow: ["sessions_list", "sessions_history"],
          deny: ["exec", "write", "read", "browser"]
        }
      }
    ]
  }
}
```

**소스 코드 위치**: `src/agents/tool-policy.ts`, `src/config/types.tools.ts`

## 실전 예제

### 예제 1: 개인/업무 에이전트 분리

```json5
{
  agents: {
    list: [
      {
        id: "personal",
        default: true,
        workspace: "~/clawd-personal",
        model: "anthropic/claude-opus-4-5",
        identity: { name: "Personal Assistant", emoji: "🏠" }
      },
      {
        id: "work",
        workspace: "~/clawd-work",
        model: "openai/gpt-5.2",
        identity: { name: "Work Assistant", emoji: "💼" }
      }
    ]
  },
  bindings: [
    {
      agentId: "work",
      match: {
        channel: "whatsapp",
        accountId: "work"
      }
    },
    {
      agentId: "personal",
      match: {
        channel: "whatsapp",
        accountId: "personal"
      }
    }
  ],
  channels: {
    whatsapp: {
      accounts: {
        personal: {},
        work: {}
      }
    }
  },
  tools: {
    agentToAgent: {
      enabled: true,
      allow: ["personal", "work"]
    }
  }
}
```

### 예제 2: 에이전트 간 협업

```json5
{
  agents: {
    list: [
      {
        id: "coordinator",
        default: true,
        subagents: {
          allowAgents: ["*"]  // 모든 에이전트로 스폰 가능
        }
      },
      {
        id: "coder",
        model: "anthropic/claude-opus-4-5",
        tools: {
          profile: "coding"
        }
      },
      {
        id: "reviewer",
        model: "openai/gpt-5.2",
        tools: {
          profile: "coding",
          allow: ["read", "sessions_send"]  // 읽기와 통신만
        }
      }
    ]
  },
  tools: {
    agentToAgent: {
      enabled: true,
      allow: ["*"]
    }
  },
  session: {
    agentToAgent: {
      maxPingPongTurns: 3  // 협업 대화는 3턴으로 제한
    }
  }
}
```

**사용 시나리오**:

1. Coordinator가 Coder에게 코드 작성 요청 (`sessions_spawn`)
2. Coder가 코드 작성 완료 후 Coordinator에게 알림
3. Coordinator가 Reviewer에게 코드 리뷰 요청 (`sessions_send`)
4. Reviewer가 리뷰 후 Coordinator에게 피드백 전송

### 예제 3: 제한된 공개 에이전트

```json5
{
  agents: {
    list: [
      {
        id: "public",
        workspace: "~/clawd-public",
        sandbox: {
          mode: "all",
          scope: "agent",
          workspaceAccess: "none",
          sessionToolsVisibility: "spawned"
        },
        tools: {
          profile: "messaging",
          allow: [
            "sessions_list",
            "sessions_history",
            "sessions_send",
            "sessions_spawn",
            "session_status"
          ],
          deny: ["*"]  // 나머지 모두 차단
        },
        subagents: {
          allowAgents: []  // 다른 에이전트로 스폰 불가
        }
      }
    ]
  },
  tools: {
    agentToAgent: {
      enabled: false  // 다른 에이전트와 통신 불가
    }
  }
}
```

### 예제 4: 3중 멀티 에이전트 시스템 (기획 → 개발 → 리뷰)

기획 에이전트(Gemini), 개발 에이전트(Claude Opus/Sonnet), 리뷰 에이전트(Codex CLI)로 구성된 순차적 협업 시스템입니다.

```json5
{
  agents: {
    defaults: {
      models: {
        "anthropic/claude-opus-4-5": { alias: "Opus" },
        "anthropic/claude-sonnet-4-5": { alias: "Sonnet" },
        "google/gemini-3-pro-preview": { alias: "Gemini" }
      },
      cliBackends: {
        "codex-cli": {
          command: "codex",
          args: ["exec", "--json", "--color", "never", "--sandbox", "read-only", "--skip-git-repo-check"],
          output: "jsonl",
          resumeOutput: "text",
          input: "arg",
          modelArg: "--model",
          sessionIdFields: ["thread_id"],
          sessionMode: "existing",
          imageArg: "--image",
          imageMode: "repeat",
          serialize: true
        }
      }
    },
    list: [
      {
        id: "gemini-planner",
        default: true,
        name: "Gemini Planner",
        workspace: "~/clawd-dev",
        model: "google/gemini-3-pro-preview",
        identity: {
          name: "Gemini Planner",
          emoji: "📋",
          theme: "expert analyst and planner"
        },
        tools: {
          profile: "coding",
          allow: [
            "read",
            "write",
            "sessions_send",
            "sessions_list",
            "sessions_history",
            "session_status"
          ],
          deny: ["exec", "process"]  // 분석 및 기획 문서 작성만
        },
        subagents: {
          allowAgents: ["claude-developer"]
        }
      },
      {
        id: "claude-developer",
        name: "Claude Developer",
        workspace: "~/clawd-dev",  // 같은 워크스페이스 공유
        model: "anthropic/claude-opus-4-5",  // 또는 "anthropic/claude-sonnet-4-5"
        identity: {
          name: "Claude Developer",
          emoji: "👨‍💻",
          theme: "expert software developer"
        },
        tools: {
          profile: "coding"  // 전체 코딩 도구 사용 가능
        },
        subagents: {
          allowAgents: ["codex-reviewer"]
        }
      },
      {
        id: "codex-reviewer",
        name: "Codex Reviewer",
        workspace: "~/clawd-dev",  // 같은 워크스페이스 공유
        model: "codex-cli/default",  // Codex CLI 백엔드 사용
        identity: {
          name: "Codex Reviewer",
          emoji: "🔍",
          theme: "code reviewer focused on code quality and best practices"
        },
        tools: {
          profile: "coding",
          allow: [
            "read",
            "sessions_send",
            "sessions_list",
            "sessions_history",
            "session_status"
          ],
          deny: ["write", "edit", "apply_patch", "exec", "process"]  // 읽기 전용
        }
      }
    ]
  },
  tools: {
    agentToAgent: {
      enabled: true,
      allow: ["gemini-planner", "claude-developer", "codex-reviewer"]
    }
  },
  session: {
    agentToAgent: {
      maxPingPongTurns: 2  // 협업 대화는 2턴으로 제한
    }
  },
  env: {
    GEMINI_API_KEY: "your-gemini-api-key",
    // Codex CLI는 별도 인증 필요 (codex CLI 로그인)
  }
}
```

**작업 흐름**:

1. **분석 및 기획 단계**: Gemini Planner가 요구사항 분석 및 기획
   ```
   사용자: "사용자 인증 시스템을 만들어줘"
   → Gemini Planner가 요구사항 분석
   → 기획 문서 작성 (plan.md, architecture.md 등)
   → 기술 스택, 아키텍처, 구현 계획 수립
   ```

2. **개발 단계**: Claude Developer가 Gemini의 기획을 받아서 개발
   ```typescript
   // Gemini Planner가 sessions_send 호출
   sessions_send({
     sessionKey: "agent:claude-developer:main",
     message: "plan.md와 architecture.md를 확인하고, 기획된 내용을 기반으로 코드를 작성해주세요.",
     timeoutSeconds: 300
   })
   ```
   → Claude Developer가 기획 문서 읽기
   → 기획된 내용을 기반으로 코드 작성 및 파일 저장
   → Gemini Planner에게 개발 완료 알림

3. **리뷰 단계**: Codex Reviewer가 Claude가 개발한 코드 리뷰
   ```typescript
   // Claude Developer가 sessions_send 호출
   sessions_send({
     sessionKey: "agent:codex-reviewer:main",
     message: "방금 작성한 코드를 코드 품질과 베스트 프랙티스 관점에서 리뷰해주세요.",
     timeoutSeconds: 120
   })
   ```
   → Codex Reviewer (CLI 백엔드)가 코드를 읽고 리뷰
   → Claude Developer에게 피드백 전송

4. **수정 및 반복**: Claude Developer가 피드백을 반영하여 코드 수정

**자동화된 파이프라인**:

Gemini Planner가 `sessions_spawn`을 사용하여 전체 파이프라인을 자동화할 수 있습니다:

```typescript
// Gemini Planner가 자동 파이프라인 실행
sessions_spawn({
  task: `
    1. 요구사항을 분석하고 기획 문서(plan.md)를 작성하세요.
    2. Claude Developer에게 기획 문서를 전달하고 개발을 요청하세요.
    3. 개발이 완료되면 Codex Reviewer에게 리뷰를 요청하세요.
    4. 최종 결과를 요약해서 알려주세요.
  `,
  label: "full-pipeline",
  agentId: "gemini-planner",
  timeoutSeconds: 600
})
```

**각 에이전트의 역할**:

- **Gemini Planner (Google Gemini 3 Pro)**:
  - 요구사항 분석 및 기획
  - 기술 스택 선정, 아키텍처 설계
  - 기획 문서 작성 (`plan.md`, `architecture.md` 등)
  - Claude Developer에게 개발 요청
  - 읽기/쓰기 도구 사용 가능 (문서 작성)

- **Claude Developer (Claude Opus/Sonnet)**:
  - Gemini Planner의 기획을 기반으로 코드 개발
  - 전체 코딩 도구 세트 사용 가능 (`profile: "coding"`)
  - 코드 작성, 수정, 테스트
  - Codex Reviewer에게 리뷰 요청

- **Codex Reviewer (Codex CLI)**:
  - Claude Developer가 작성한 코드 리뷰
  - 코드 품질 및 베스트 프랙티스 검토
  - 읽기 전용 도구만 사용 (`read`, `sessions_*`)
  - Codex CLI 백엔드 사용 (OpenAI Codex)

**워크스페이스 공유**:

모든 에이전트가 같은 워크스페이스(`~/clawd-dev`)를 공유하므로:
- Developer가 작성한 코드를 리뷰어들이 즉시 읽을 수 있음
- 리뷰 피드백이 같은 워크스페이스에 저장됨
- 파일 시스템 접근이 자연스럽게 공유됨

**Codex CLI 설정 참고**:

Codex CLI 백엔드는 기본적으로 다음 설정을 사용합니다:
- 명령어: `codex`
- 출력 형식: `jsonl` (일반 실행), `text` (재개)
- 세션 모드: `existing` (기존 세션 재사용)
- 샌드박스: `read-only` (읽기 전용)

Codex CLI를 사용하려면:
1. `codex` CLI가 설치되어 있어야 함
2. `codex auth login`으로 인증 필요
3. 환경 변수나 키체인에 인증 정보 저장

**Gemini API 키 설정**:

Gemini 모델을 사용하려면:
1. `GEMINI_API_KEY` 환경 변수 설정
2. 또는 `moltbot onboard --auth-choice gemini-api-key` 실행

**소스 코드 위치**:
- CLI 백엔드 설정: `src/agents/cli-backends.ts` (`DEFAULT_CODEX_BACKEND`)
- 모델 설정: `src/config/types.agent-defaults.ts` (`CliBackendConfig`)
- 에이전트 간 통신: `src/agents/tools/sessions-send-tool.ts`

## 세션 도구 상세

### `sessions_list`

에이전트가 접근 가능한 세션 목록을 조회합니다:

```typescript
sessions_list({
  kinds: ["main", "group"],  // 선택적: 세션 종류 필터
  limit: 50,  // 선택적: 최대 결과 수
  activeMinutes: 60,  // 선택적: 최근 N분 내 활성 세션만
  messageLimit: 5  // 선택적: 각 세션의 마지막 N개 메시지 포함
})
```

**반환 형식**:

```json
{
  count: 10,
  sessions: [
    {
      key: "agent:main:main",
      kind: "main",
      channel: "whatsapp",
      displayName: "Main Session",
      updatedAt: 1706457600000,
      sessionId: "abc-123-def",
      model: "anthropic/claude-opus-4-5",
      thinkingLevel: "low",
      lastChannel: "whatsapp",
      lastTo: "+15555550123"
    }
  ]
}
```

**에이전트 간 필터링**:

- `tools.agentToAgent.enabled: false`일 때: 자신의 에이전트 세션만 반환
- `tools.agentToAgent.enabled: true`일 때: `allow` 목록에 있는 에이전트 세션도 반환

**소스 코드 위치**: `src/agents/tools/sessions-list-tool.ts`

### `sessions_history`

특정 세션의 히스토리를 조회합니다:

```typescript
sessions_history({
  sessionKey: "agent:work:main",
  limit: 50,  // 선택적: 최대 메시지 수
  includeTools: false  // 선택적: 도구 결과 포함 여부
})
```

**에이전트 간 접근**:

- 다른 에이전트 세션 접근 시 `tools.agentToAgent` 정책 검사
- 정책 위반 시 `forbidden` 에러 반환

**소스 코드 위치**: `src/agents/tools/sessions-history-tool.ts`

### `session_status`

세션 상태를 조회합니다:

```typescript
session_status({
  sessionKey: "agent:work:main"  // 선택적: 없으면 현재 세션
})
```

**소스 코드 위치**: `src/agents/tools/session-status-tool.ts`

### `agents_list`

스폰 가능한 에이전트 목록을 조회합니다:

```typescript
agents_list({})
```

**반환 형식**:

```json
{
  requester: "main",
  allowAny: false,
  agents: [
    {
      id: "main",
      name: "Primary Agent",
      configured: true
    },
    {
      id: "work",
      name: "Work Agent",
      configured: true
    }
  ]
}
```

**소스 코드 위치**: `src/agents/tools/agents-list-tool.ts`

## 구현 세부사항

### 라우팅 해결 로직

`resolveAgentRoute` 함수가 인바운드 메시지를 적절한 에이전트로 라우팅합니다:

```typescript
// src/routing/resolve-route.ts
export function resolveAgentRoute(input: ResolveAgentRouteInput): ResolvedAgentRoute {
  // 1. 채널 및 계정 정규화
  const channel = normalizeToken(input.channel);
  const accountId = normalizeAccountId(input.accountId);
  
  // 2. 바인딩 필터링 (채널 및 계정 매칭)
  const bindings = listBindings(input.cfg).filter(...);
  
  // 3. 우선순위에 따라 매칭
  // - peer → guildId → teamId → accountId (정확) → accountId ("*") → default
  ...
}
```

**매칭 순서**:

1. `match.peer`가 있으면 피어 매칭 시도
2. `match.guildId`가 있으면 Guild ID 매칭 시도
3. `match.teamId`가 있으면 Team ID 매칭 시도
4. `match.accountId`가 정확한 값이면 계정 매칭 시도
5. `match.accountId: "*"`이면 채널 전체 매칭 시도
6. 모두 실패하면 기본 에이전트 반환

### 세션 키 생성

`buildAgentPeerSessionKey` 함수가 세션 키를 생성합니다:

```typescript
// src/routing/session-key.ts
export function buildAgentPeerSessionKey(params: {
  agentId: string;
  channel: string;
  peerKind?: "dm" | "group" | "channel";
  peerId?: string | null;
  dmScope?: "main" | "per-peer" | "per-channel-peer";
  identityLinks?: Record<string, string[]>;
}): string {
  // DM 세션 처리
  if (peerKind === "dm") {
    const dmScope = params.dmScope ?? "main";
    if (dmScope === "main") {
      return buildAgentMainSessionKey({ agentId, mainKey });
    }
    // per-peer 또는 per-channel-peer 처리
    ...
  }
  // 그룹/채널 세션 처리
  ...
}
```

### 에이전트 간 통신 플로우

`runSessionsSendA2AFlow` 함수가 에이전트 간 통신을 처리합니다:

```typescript
// src/agents/tools/sessions-send-tool.a2a.ts
export async function runSessionsSendA2AFlow(params: {
  targetSessionKey: string;
  message: string;
  maxPingPongTurns: number;
  ...
}) {
  // 1. 초기 응답 읽기
  let primaryReply = await readLatestAssistantReply(...);
  
  // 2. Ping-Pong 루프 실행
  if (maxPingPongTurns > 0) {
    for (let turn = 1; turn <= maxPingPongTurns; turn++) {
      const replyText = await runAgentStep(...);
      if (isReplySkip(replyText)) break;
      // 세션 키 교체 (요청자 ↔ 타겟)
      ...
    }
  }
  
  // 3. Announce 단계 실행
  const announceReply = await runAgentStep(...);
  if (!isAnnounceSkip(announceReply)) {
    await callGateway({ method: "send", ... });
  }
}
```

## 주의사항 및 제한사항

### 1. 세션 키 정규화

- 모든 세션 키는 소문자로 정규화됩니다
- 에이전트 ID는 `normalizeAgentId`로 정규화됩니다 (유효하지 않은 문자는 하이픈으로 변환)

### 2. 기본 에이전트 결정

- `agents.list`에 `default: true`가 여러 개 있으면 첫 번째 사용 (경고 로그)
- `default: true`가 없으면 첫 번째 항목이 기본 에이전트
- `agents.list`가 비어있으면 `"main"`이 기본 에이전트

### 3. 에이전트 간 통신 제한

- `tools.agentToAgent.enabled: false`일 때는 모든 에이전트 간 통신 차단
- 샌드박스된 세션은 기본적으로 자신이 생성한 서브 에이전트만 볼 수 있음
- 서브 에이전트는 다른 서브 에이전트를 생성할 수 없음

### 4. 세션 격리

- 각 에이전트의 세션은 완전히 분리되어 있음
- 세션 키에 에이전트 ID가 포함되어 자동으로 격리됨
- `session.dmScope` 설정에 따라 DM 세션 구조가 달라짐

### 5. 워크스페이스 격리

- 각 에이전트는 독립적인 워크스페이스를 가짐
- 파일 작업은 자신의 워크스페이스에서만 수행
- 샌드박스 모드에서 `workspaceAccess: "none"`일 때는 워크스페이스 접근 불가

## 참고 자료

- **설정 문서**: `docs/gateway/configuration` - 멀티 에이전트 라우팅 및 바인딩 설정
- **세션 도구 문서**: `docs/concepts/session-tool` - 세션 도구 사용법
- **소스 코드**:
  - 라우팅: `src/routing/resolve-route.ts`, `src/routing/bindings.ts`
  - 세션 키: `src/routing/session-key.ts`
  - 에이전트 스코프: `src/agents/agent-scope.ts`
  - 세션 도구: `src/agents/tools/sessions-*.ts`
  - 에이전트 간 통신: `src/agents/tools/sessions-send-tool.a2a.ts`
