---
layout: default
title: Chat Abort
---

# 채팅 중단 시스템

**작성일**: 2026-01-28  
**모듈**: `src/gateway/chat-abort.ts`

## 1. 개요

채팅 중단 시스템은 실행 중인 채팅을 중단할 수 있는 기능을 제공합니다. 사용자 요청, 타임아웃, 또는 명령을 통해 중단할 수 있습니다.

## 2. 중단 컨트롤러 엔트리

### 2.1 ChatAbortControllerEntry 구조

```typescript
export type ChatAbortControllerEntry = {
  controller: AbortController;
  sessionId: string;
  sessionKey: string;
  startedAtMs: number;
  expiresAtMs: number;
};
```

**필드:**
- `controller`: AbortController 인스턴스
- `sessionId`: 세션 ID
- `sessionKey`: 세션 키
- `startedAtMs`: 시작 시각
- `expiresAtMs`: 만료 시각

## 3. 중단 함수

### 3.1 특정 실행 중단

```typescript
export function abortChatRunById(
  ops: ChatAbortOps,
  params: {
    runId: string;
    sessionKey: string;
    stopReason?: string;
  },
): { aborted: boolean }
```

**프로세스:**
1. 활성 컨트롤러 확인
2. 세션 키 일치 확인
3. 중단된 실행 기록
4. AbortController 중단
5. 관련 상태 정리
6. 중단 이벤트 브로드캐스트

**코드:**
```typescript
const active = ops.chatAbortControllers.get(runId);
if (!active) return { aborted: false };
if (active.sessionKey !== sessionKey) return { aborted: false };

ops.chatAbortedRuns.set(runId, Date.now());
active.controller.abort();
ops.chatAbortControllers.delete(runId);
ops.chatRunBuffers.delete(runId);
ops.chatDeltaSentAt.delete(runId);
ops.removeChatRun(runId, runId, sessionKey);
broadcastChatAborted(ops, { runId, sessionKey, stopReason });
return { aborted: true };
```

### 3.2 세션의 모든 실행 중단

```typescript
export function abortChatRunsForSessionKey(
  ops: ChatAbortOps,
  params: {
    sessionKey: string;
    stopReason?: string;
  },
): { aborted: boolean; runIds: string[] }
```

세션의 모든 실행을 중단합니다.

**프로세스:**
1. 세션 키로 필터링
2. 각 실행에 대해 `abortChatRunById` 호출
3. 중단된 실행 ID 목록 반환

## 4. 중단 명령 감지

### 4.1 중단 명령 확인

```typescript
export function isChatStopCommandText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return trimmed.toLowerCase() === "/stop" || isAbortTrigger(trimmed);
}
```

`/stop` 명령 또는 중단 트리거를 감지합니다.

## 5. 실행 만료 시간 해결

### 5.1 만료 시간 계산

```typescript
export function resolveChatRunExpiresAtMs(params: {
  now: number;
  timeoutMs: number;
  graceMs?: number;
  minMs?: number;
  maxMs?: number;
}): number {
  const { now, timeoutMs, graceMs = 60_000, minMs = 2 * 60_000, maxMs = 24 * 60 * 60_000 } = params;
  const boundedTimeoutMs = Math.max(0, timeoutMs);
  const target = now + boundedTimeoutMs + graceMs;
  const min = now + minMs;
  const max = now + maxMs;
  return Math.min(max, Math.max(min, target));
}
```

**파라미터:**
- `now`: 현재 시각
- `timeoutMs`: 타임아웃 (밀리초)
- `graceMs`: 여유 시간 (기본값: 60초)
- `minMs`: 최소 시간 (기본값: 2분)
- `maxMs`: 최대 시간 (기본값: 24시간)

**계산:**
- 목표 시간 = 현재 + 타임아웃 + 여유 시간
- 최소/최대 범위 내로 제한

## 6. 중단 이벤트 브로드캐스트

### 6.1 브로드캐스트 함수

```typescript
function broadcastChatAborted(
  ops: ChatAbortOps,
  params: {
    runId: string;
    sessionKey: string;
    stopReason?: string;
  },
) {
  const { runId, sessionKey, stopReason } = params;
  const payload = {
    runId,
    sessionKey,
    seq: (ops.agentRunSeq.get(runId) ?? 0) + 1,
    state: "aborted" as const,
    stopReason,
  };
  ops.broadcast("chat", payload);
  ops.nodeSendToSession(sessionKey, "chat", payload);
}
```

중단 이벤트를 모든 클라이언트와 구독 노드에 브로드캐스트합니다.

## 7. ChatAbortOps

### 7.1 구조

```typescript
export type ChatAbortOps = {
  chatAbortControllers: Map<string, ChatAbortControllerEntry>;
  chatRunBuffers: Map<string, string>;
  chatDeltaSentAt: Map<string, number>;
  chatAbortedRuns: Map<string, number>;
  removeChatRun: (
    sessionId: string,
    clientRunId: string,
    sessionKey?: string,
  ) => { sessionKey: string; clientRunId: string } | undefined;
  agentRunSeq: Map<string, number>;
  broadcast: (event: string, payload: unknown, opts?: { dropIfSlow?: boolean }) => void;
  nodeSendToSession: (sessionKey: string, event: string, payload: unknown) => void;
};
```

## 8. 중단 이벤트

### 8.1 이벤트 페이로드

```typescript
{
  runId: string;
  sessionKey: string;
  seq: number;
  state: "aborted";
  stopReason?: string;
}
```

**stopReason 값:**
- `"user"`: 사용자 요청
- `"timeout"`: 타임아웃
- `"command"`: 명령 (`/stop`)
- 기타 사용자 정의 이유

## 9. 정리 작업

### 9.1 만료된 컨트롤러 정리

유지보수 타이머에서 만료된 컨트롤러를 정리합니다:

```typescript
for (const [runId, entry] of params.chatAbortControllers) {
  if (now <= entry.expiresAtMs) continue;
  abortChatRunById(
    ops,
    { runId, sessionKey: entry.sessionKey, stopReason: "timeout" },
  );
}
```

### 9.2 중단된 실행 기록 정리

중단된 실행 기록은 1시간 후 정리됩니다:

```typescript
const ABORTED_RUN_TTL_MS = 60 * 60_000;
for (const [runId, abortedAt] of params.chatRunState.abortedRuns) {
  if (now - abortedAt <= ABORTED_RUN_TTL_MS) continue;
  params.chatRunState.abortedRuns.delete(runId);
  params.chatRunBuffers.delete(runId);
  params.chatDeltaSentAt.delete(runId);
}
```

## 10. 사용 예시

### 10.1 특정 실행 중단

```typescript
const result = abortChatRunById(ops, {
  runId: "run-123",
  sessionKey: "agent:main:user-456",
  stopReason: "user",
});

if (result.aborted) {
  console.log("실행이 중단되었습니다");
}
```

### 10.2 세션의 모든 실행 중단

```typescript
const result = abortChatRunsForSessionKey(ops, {
  sessionKey: "agent:main:user-456",
  stopReason: "user",
});

console.log(`중단된 실행: ${result.runIds.join(", ")}`);
```

## 11. 통합

### 11.1 chat.abort 메서드

`chat.abort` 메서드는 이 시스템을 사용합니다:

```typescript
"chat.abort": async ({ params, respond, context }) => {
  const runId = typeof params.runId === "string" ? params.runId : null;
  const sessionKey = typeof params.sessionKey === "string" ? params.sessionKey : null;
  
  if (!runId || !sessionKey) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing runId or sessionKey"));
    return;
  }
  
  const result = abortChatRunById({
    chatAbortControllers: context.chatAbortControllers,
    chatRunBuffers: context.chatRunBuffers,
    chatDeltaSentAt: context.chatDeltaSentAt,
    chatAbortedRuns: context.chatAbortedRuns,
    removeChatRun: context.removeChatRun,
    agentRunSeq: context.agentRunSeq,
    broadcast: context.broadcast,
    nodeSendToSession: context.nodeSendToSession,
  }, {
    runId,
    sessionKey,
    stopReason: "user",
  });
  
  respond(result.aborted, { aborted: result.aborted });
}
```

## 12. 보안 고려사항

### 12.1 세션 키 검증

중단 요청은 세션 키를 검증하여 다른 세션의 실행을 중단할 수 없도록 합니다.

### 12.2 권한 검사

`chat.abort` 메서드는 `operator.write` 스코프가 필요합니다.

## 13. 성능 고려사항

### 13.1 정기 정리

만료된 컨트롤러와 기록은 정기적으로 정리되어 메모리 사용을 제한합니다.

### 13.2 이벤트 브로드캐스트

중단 이벤트는 `dropIfSlow: true` 옵션으로 브로드캐스트되어 느린 클라이언트에 영향을 주지 않습니다.
