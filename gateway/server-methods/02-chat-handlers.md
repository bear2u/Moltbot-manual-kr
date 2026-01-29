# Chat 메서드 핸들러

**작성일**: 2026-01-28  
**모듈**: `src/gateway/server-methods/chat.ts`

## 1. 개요

Chat 메서드 핸들러는 WebChat을 위한 채팅 기능을 제공합니다. 히스토리 조회, 메시지 전송, 실행 중단 등을 지원합니다.

## 2. 메서드 목록

### 2.1 chat.history

채팅 히스토리를 조회합니다.

**파라미터:**
```typescript
{
  sessionKey: string;
  limit?: number;
}
```

**처리:**
1. 세션 엔트리 로드
2. 트랜스크립트 파일 경로 해결
3. 메시지 읽기
4. JSON 바이트 크기 제한 적용
5. 응답 반환

**응답:**
```typescript
{
  sessionKey: string;
  messages: HistoryEntry[];
  truncated: boolean;
}
```

### 2.2 chat.send

채팅 메시지를 전송하고 에이전트를 실행합니다.

**파라미터:**
```typescript
{
  sessionKey: string;
  message: string;
  attachments?: ChatAttachment[];
  model?: string;
  thinking?: string;
  timeoutSeconds?: number;
  deliver?: boolean;
  idempotencyKey: string;
}
```

**처리:**

1. **파라미터 검증**
```typescript
if (!validateChatSendParams(params)) {
  respond(false, undefined, errorShape(...));
  return;
}
```

2. **중복 제거**
```typescript
const cached = context.dedupe.get(`chat.send:${idempotencyKey}`);
if (cached) {
  respond(cached.ok, cached.payload, cached.error, { cached: true });
  return;
}
```

3. **첨부파일 파싱**
```typescript
let message = request.message.trim();
let images: ChatImageContent[] = [];
if (normalizedAttachments.length > 0) {
  const parsed = await parseMessageWithAttachments(message, normalizedAttachments, {
    maxBytes: 5_000_000,
    log: context.logGateway,
  });
  message = parsed.message.trim();
  images = parsed.images;
}
```

4. **세션 엔트리 로드**
```typescript
const { cfg, storePath, entry } = loadSessionEntry(sessionKey);
```

5. **모델 해결**
```typescript
const modelRef = resolveSessionModelRef({
  cfg,
  entry,
  explicitModel: request.model,
});
```

6. **타임아웃 해결**
```typescript
const timeoutMs = resolveAgentTimeoutMs({
  cfg,
  agentId: entry?.agentId ?? resolveDefaultAgentId(cfg),
  explicitTimeoutSeconds: request.timeoutSeconds,
});
```

7. **실행 만료 시간 계산**
```typescript
const expiresAtMs = resolveChatRunExpiresAtMs({
  now: Date.now(),
  timeoutMs,
});
```

8. **AbortController 생성**
```typescript
const controller = new AbortController();
const runId = randomUUID();
context.chatAbortControllers.set(runId, {
  controller,
  sessionId: entry?.sessionId ?? runId,
  sessionKey,
  startedAtMs: Date.now(),
  expiresAtMs,
});
```

9. **에이전트 실행**
```typescript
const result = await agentCommand({
  message,
  images,
  agentId: entry?.agentId,
  sessionKey,
  model: modelRef.model,
  provider: modelRef.provider,
  thinking: request.thinking,
  timeoutMs,
  deliver: request.deliver ?? false,
  abortSignal: controller.signal,
  deps: context.deps,
});
```

10. **트랜스크립트에 메시지 추가**
```typescript
const transcriptResult = appendAssistantTranscriptMessage({
  message: result.summary ?? result.error ?? "completed",
  sessionId: entry?.sessionId ?? runId,
  storePath,
  sessionFile: entry?.sessionFile,
  createIfMissing: true,
});
```

11. **최종 이벤트 브로드캐스트**
```typescript
broadcastChatFinal({
  context,
  runId,
  sessionKey,
  message: transcriptResult.message,
});
```

12. **정리**
```typescript
context.chatAbortControllers.delete(runId);
context.chatRunBuffers.delete(runId);
context.chatDeltaSentAt.delete(runId);
context.removeChatRun(runId, runId, sessionKey);
```

### 2.3 chat.abort

실행 중인 채팅을 중단합니다.

**파라미터:**
```typescript
{
  runId: string;
  sessionKey: string;
}
```

**처리:**
```typescript
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
```

## 3. 트랜스크립트 관리

### 3.1 트랜스크립트 경로 해결

```typescript
function resolveTranscriptPath(params: {
  sessionId: string;
  storePath: string | undefined;
  sessionFile?: string;
}): string | null {
  const { sessionId, storePath, sessionFile } = params;
  if (sessionFile) return sessionFile;
  if (!storePath) return null;
  return path.join(path.dirname(storePath), `${sessionId}.jsonl`);
}
```

### 3.2 트랜스크립트 파일 생성

```typescript
function ensureTranscriptFile(params: { transcriptPath: string; sessionId: string }): {
  ok: boolean;
  error?: string;
} {
  if (fs.existsSync(params.transcriptPath)) return { ok: true };
  try {
    fs.mkdirSync(path.dirname(params.transcriptPath), { recursive: true });
    const header = {
      type: "session",
      version: CURRENT_SESSION_VERSION,
      id: params.sessionId,
      timestamp: new Date().toISOString(),
      cwd: process.cwd(),
    };
    fs.writeFileSync(params.transcriptPath, `${JSON.stringify(header)}\n`, "utf-8");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

### 3.3 어시스턴트 메시지 추가

```typescript
function appendAssistantTranscriptMessage(params: {
  message: string;
  label?: string;
  sessionId: string;
  storePath: string | undefined;
  sessionFile?: string;
  createIfMissing?: boolean;
}): TranscriptAppendResult {
  const transcriptPath = resolveTranscriptPath({...});
  if (!transcriptPath) {
    return { ok: false, error: "transcript path not resolved" };
  }
  
  if (!fs.existsSync(transcriptPath)) {
    if (!params.createIfMissing) {
      return { ok: false, error: "transcript file not found" };
    }
    const ensured = ensureTranscriptFile({ transcriptPath, sessionId: params.sessionId });
    if (!ensured.ok) {
      return { ok: false, error: ensured.error ?? "failed to create transcript file" };
    }
  }
  
  const now = Date.now();
  const messageId = randomUUID().slice(0, 8);
  const labelPrefix = params.label ? `[${params.label}]\n\n` : "";
  const messageBody: Record<string, unknown> = {
    role: "assistant",
    content: [{ type: "text", text: `${labelPrefix}${params.message}` }],
    timestamp: now,
    stopReason: "injected",
    usage: { input: 0, output: 0, totalTokens: 0 },
  };
  const transcriptEntry = {
    type: "message",
    id: messageId,
    timestamp: new Date(now).toISOString(),
    message: messageBody,
  };
  
  try {
    fs.appendFileSync(transcriptPath, `${JSON.stringify(transcriptEntry)}\n`, "utf-8");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  
  return { ok: true, messageId, message: transcriptEntry.message };
}
```

## 4. 이벤트 브로드캐스트

### 4.1 최종 이벤트

```typescript
function broadcastChatFinal(params: {
  context: Pick<GatewayRequestContext, "broadcast" | "nodeSendToSession" | "agentRunSeq">;
  runId: string;
  sessionKey: string;
  message?: Record<string, unknown>;
}) {
  const seq = nextChatSeq({ agentRunSeq: params.context.agentRunSeq }, params.runId);
  const payload = {
    runId: params.runId,
    sessionKey: params.sessionKey,
    seq,
    state: "final" as const,
    message: params.message,
  };
  params.context.broadcast("chat", payload);
  params.context.nodeSendToSession(params.sessionKey, "chat", payload);
}
```

### 4.2 에러 이벤트

```typescript
function broadcastChatError(params: {
  context: Pick<GatewayRequestContext, "broadcast" | "nodeSendToSession" | "agentRunSeq">;
  runId: string;
  sessionKey: string;
  errorMessage?: string;
}) {
  const seq = nextChatSeq({ agentRunSeq: params.context.agentRunSeq }, params.runId);
  const payload = {
    runId: params.runId,
    sessionKey: params.sessionKey,
    seq,
    state: "error" as const,
    errorMessage: params.errorMessage,
  };
  params.context.broadcast("chat", payload);
  params.context.nodeSendToSession(params.sessionKey, "chat", payload);
}
```

## 5. 순차 번호 관리

### 5.1 다음 순차 번호

```typescript
function nextChatSeq(context: { agentRunSeq: Map<string, number> }, runId: string) {
  const next = (context.agentRunSeq.get(runId) ?? 0) + 1;
  context.agentRunSeq.set(runId, next);
  return next;
}
```

## 6. 히스토리 크기 제한

### 6.1 JSON 바이트 크기 제한

```typescript
const maxBytes = getMaxChatHistoryMessagesBytes();
const capped = capArrayByJsonBytes(messages, maxBytes);
```

기본 최대 크기는 6MB입니다.

## 7. 사용 예시

### 7.1 히스토리 조회

```typescript
const result = await gateway.request("chat.history", {
  sessionKey: "agent:main:user-123",
  limit: 50,
});
```

### 7.2 메시지 전송

```typescript
const result = await gateway.request("chat.send", {
  sessionKey: "agent:main:user-123",
  message: "안녕하세요!",
  idempotencyKey: "unique-key-123",
  deliver: true,
});
```

### 7.3 실행 중단

```typescript
await gateway.request("chat.abort", {
  runId: "run-123",
  sessionKey: "agent:main:user-123",
});
```

## 8. 성능 고려사항

### 8.1 히스토리 크기 제한

히스토리는 JSON 바이트 크기로 제한되어 응답 크기를 제어합니다.

### 8.2 중복 제거

`chat.send`는 중복 제거를 지원하여 동일한 요청의 중복 처리를 방지합니다.

### 8.3 비동기 처리

에이전트 실행은 비동기로 처리되어 Gateway가 블로킹되지 않습니다.

## 9. 보안 고려사항

### 9.1 권한 검사

Chat 메서드는 `operator.write` 스코프가 필요합니다.

### 9.2 세션 격리

각 세션은 독립적으로 관리되며, 다른 세션의 데이터에 접근할 수 없습니다.

### 9.3 타임아웃

실행은 타임아웃으로 제한되어 무한 실행을 방지합니다.
