---
layout: default
title: Send Handler
---

# Send 메서드 핸들러

**작성일**: 2026-01-28  
**모듈**: `src/gateway/server-methods/send.ts`

## 1. 개요

`send` 메서드는 메시지를 특정 채널의 사용자에게 전송합니다. 중복 제거와 동시 실행 방지를 지원합니다.

## 2. 메서드 시그니처

```typescript
send: async ({ params, respond, context }) => Promise<void>
```

## 3. 파라미터

### 3.1 SendParams 구조

```typescript
{
  to: string;
  message: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  gifPlayback?: boolean;
  channel?: string;
  accountId?: string;
  sessionKey?: string;
  idempotencyKey: string;
}
```

**필수 필드:**
- `to`: 수신자 식별자
- `message`: 메시지 텍스트
- `idempotencyKey`: 중복 제거 키

**선택 필드:**
- `mediaUrl`: 단일 미디어 URL
- `mediaUrls`: 여러 미디어 URL
- `gifPlayback`: GIF 재생 여부
- `channel`: 채널 ID (기본값: 기본 채팅 채널)
- `accountId`: 계정 ID
- `sessionKey`: 세션 키

## 4. 처리 프로세스

### 4.1 파라미터 검증

```typescript
if (!validateSendParams(p)) {
  respond(
    false,
    undefined,
    errorShape(
      ErrorCodes.INVALID_REQUEST,
      `invalid send params: ${formatValidationErrors(validateSendParams.errors)}`,
    ),
  );
  return;
}
```

### 4.2 중복 제거

```typescript
const idem = request.idempotencyKey;
const dedupeKey = `send:${idem}`;
const cached = context.dedupe.get(dedupeKey);
if (cached) {
  respond(cached.ok, cached.payload, cached.error, { cached: true });
  return;
}
```

### 4.3 동시 실행 방지

```typescript
const inflightMap = getInflightMap(context);
const inflight = inflightMap.get(dedupeKey);
if (inflight) {
  const result = await inflight;
  const meta = result.meta ? { ...result.meta, cached: true } : { cached: true };
  respond(result.ok, result.payload, result.error, meta);
  return;
}
```

동일한 `idempotencyKey`로 실행 중인 요청이 있으면 그 결과를 기다립니다.

### 4.4 채널 해결

```typescript
const channelInput = typeof request.channel === "string" ? request.channel : undefined;
const normalizedChannel = channelInput ? normalizeChannelId(channelInput) : null;
if (channelInput && !normalizedChannel) {
  respond(
    false,
    undefined,
    errorShape(ErrorCodes.INVALID_REQUEST, `unsupported channel: ${channelInput}`),
  );
  return;
}
const channel = normalizedChannel ?? DEFAULT_CHAT_CHANNEL;
```

### 4.5 Outbound 타겟 해결

```typescript
const resolved = resolveOutboundTarget({
  channel: outboundChannel,
  to,
  cfg,
  accountId,
  mode: "explicit",
});
if (!resolved.ok) {
  return {
    ok: false,
    error: errorShape(ErrorCodes.INVALID_REQUEST, String(resolved.error)),
    meta: { channel },
  };
}
```

### 4.6 미러 페이로드 정규화

```typescript
const mirrorPayloads = normalizeReplyPayloadsForDelivery([
  { text: message, mediaUrl: request.mediaUrl, mediaUrls },
]);
const mirrorText = mirrorPayloads
  .map((payload) => payload.text)
  .filter(Boolean)
  .join("\n");
const mirrorMediaUrls = mirrorPayloads.flatMap(
  (payload) => payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : []),
);
```

### 4.7 세션 키 해결

```typescript
const providedSessionKey =
  typeof request.sessionKey === "string" && request.sessionKey.trim()
    ? request.sessionKey.trim().toLowerCase()
    : undefined;
const derivedAgentId = resolveSessionAgentId({ config: cfg });
const resolvedSessionKey = providedSessionKey ?? buildAgentMainSessionKey({
  agentId: derivedAgentId,
  mainKey: `send:${channel}:${resolved.to}`,
});
```

### 4.8 Outbound 세션 엔트리 보장

```typescript
await ensureOutboundSessionEntry({
  sessionKey: resolvedSessionKey,
  channel: outboundChannel,
  to: resolved.to,
  accountId: resolved.accountId,
  cfg,
});
```

### 4.9 전송

```typescript
const result = await deliverOutboundPayloads({
  channel: outboundChannel,
  to: resolved.to,
  accountId: resolved.accountId,
  payloads: mirrorPayloads,
  gifPlayback: request.gifPlayback,
  deps: outboundDeps,
  cfg,
  sessionKey: resolvedSessionKey,
});
```

### 4.10 응답

```typescript
const inflightResult: InflightResult = {
  ok: result.ok,
  payload: {
    ok: result.ok,
    channel,
    to: resolved.to,
    accountId: resolved.accountId,
    sessionKey: resolvedSessionKey,
    delivered: result.delivered,
    error: result.error,
  },
  error: result.ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, result.error ?? "delivery failed"),
  meta: { channel },
};

inflightMap.set(dedupeKey, Promise.resolve(inflightResult));
context.dedupe.set(dedupeKey, {
  ts: Date.now(),
  ok: inflightResult.ok,
  payload: inflightResult.payload,
  error: inflightResult.error,
});

respond(inflightResult.ok, inflightResult.payload, inflightResult.error, inflightResult.meta);
```

## 5. 중복 제거

### 5.1 중복 제거 키

중복 제거 키는 `send:${idempotencyKey}` 형식입니다.

### 5.2 캐시 TTL

중복 제거 캐시는 `DEDUPE_TTL_MS` (5분) 동안 유지됩니다.

## 6. 동시 실행 방지

### 6.1 WeakMap 사용

동시 실행은 컨텍스트별 WeakMap을 사용하여 추적합니다:

```typescript
const inflightByContext = new WeakMap<
  GatewayRequestContext,
  Map<string, Promise<InflightResult>>
>();
```

### 6.2 동일 키 대기

동일한 `idempotencyKey`로 실행 중인 요청이 있으면 그 Promise를 기다립니다.

## 7. 에러 처리

### 7.1 주요 에러

- **INVALID_REQUEST**: 잘못된 파라미터 또는 지원되지 않는 채널
- **UNAVAILABLE**: 전송 실패

### 7.2 에러 응답

```typescript
{
  ok: false,
  error: {
    code: ErrorCode;
    message: string;
  }
}
```

## 8. 응답 형식

### 8.1 성공 응답

```typescript
{
  ok: true,
  channel: string;
  to: string;
  accountId?: string;
  sessionKey: string;
  delivered: boolean;
  error?: string;
}
```

### 8.2 실패 응답

```typescript
{
  ok: false,
  error: {
    code: ErrorCode;
    message: string;
  }
}
```

## 9. 사용 예시

### 9.1 기본 전송

```typescript
await gateway.request("send", {
  to: "user-123",
  message: "안녕하세요!",
  channel: "telegram",
  idempotencyKey: "unique-key-123",
});
```

### 9.2 미디어 전송

```typescript
await gateway.request("send", {
  to: "user-123",
  message: "이미지를 확인해주세요",
  mediaUrls: ["https://example.com/image.jpg"],
  channel: "telegram",
  idempotencyKey: "unique-key-456",
});
```

### 9.3 중복 제거 활용

동일한 `idempotencyKey`로 여러 번 호출해도 한 번만 전송됩니다:

```typescript
// 첫 번째 호출
await gateway.request("send", {
  to: "user-123",
  message: "메시지",
  idempotencyKey: "key-123",
});

// 두 번째 호출 (즉시 캐시된 응답 반환)
await gateway.request("send", {
  to: "user-123",
  message: "메시지",
  idempotencyKey: "key-123",
});
```

## 10. 성능 고려사항

### 10.1 중복 제거

중복 제거를 통해 불필요한 전송을 방지합니다.

### 10.2 동시 실행 방지

동시 실행 방지를 통해 동일한 요청의 중복 처리를 방지합니다.

### 10.3 비동기 처리

전송은 비동기로 처리되어 Gateway가 블로킹되지 않습니다.

## 11. 보안 고려사항

### 11.1 권한 검사

`send` 메서드는 `operator.write` 스코프가 필요합니다.

### 11.2 채널 검증

지원되지 않는 채널은 거부됩니다.

### 11.3 세션 격리

각 세션은 독립적으로 관리됩니다.
