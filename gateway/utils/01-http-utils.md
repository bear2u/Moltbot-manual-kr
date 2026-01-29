---
layout: default
title: Http Utils
---

# HTTP 유틸리티

**작성일**: 2026-01-28  
**모듈**: `src/gateway/http-utils.ts`, `src/gateway/http-common.ts`

## 1. 개요

HTTP 유틸리티는 HTTP 요청 처리에 필요한 공통 기능을 제공합니다. 헤더 추출, 에이전트 ID 해결, 세션 키 해결 등을 지원합니다.

## 2. 헤더 유틸리티 (`http-utils.ts`)

### 2.1 getHeader

```typescript
export function getHeader(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0];
  return undefined;
}
```

HTTP 헤더를 안전하게 추출합니다. 배열인 경우 첫 번째 값을 반환합니다.

### 2.2 getBearerToken

```typescript
export function getBearerToken(req: IncomingMessage): string | undefined {
  const raw = getHeader(req, "authorization")?.trim() ?? "";
  if (!raw.toLowerCase().startsWith("bearer ")) return undefined;
  const token = raw.slice(7).trim();
  return token || undefined;
}
```

`Authorization: Bearer <token>` 헤더에서 토큰을 추출합니다.

### 2.3 resolveAgentIdFromHeader

```typescript
export function resolveAgentIdFromHeader(req: IncomingMessage): string | undefined {
  const raw =
    getHeader(req, "x-moltbot-agent-id")?.trim() ||
    getHeader(req, "x-moltbot-agent")?.trim() ||
    "";
  if (!raw) return undefined;
  return normalizeAgentId(raw);
}
```

다음 헤더에서 에이전트 ID를 추출합니다:
- `X-Moltbot-Agent-ID`
- `X-Moltbot-Agent`

### 2.4 resolveAgentIdFromModel

```typescript
export function resolveAgentIdFromModel(model: string | undefined): string | undefined {
  const raw = model?.trim();
  if (!raw) return undefined;

  const m =
    raw.match(/^moltbot[:/](?<agentId>[a-z0-9][a-z0-9_-]{0,63})$/i) ??
    raw.match(/^agent:(?<agentId>[a-z0-9][a-z0-9_-]{0,63})$/i);
  const agentId = m?.groups?.agentId;
  if (!agentId) return undefined;
  return normalizeAgentId(agentId);
}
```

모델 이름에서 에이전트 ID를 추출합니다:
- `moltbot:agent-id`
- `moltbot/agent-id`
- `agent:agent-id`

### 2.5 resolveAgentIdForRequest

```typescript
export function resolveAgentIdForRequest(params: {
  req: IncomingMessage;
  model: string | undefined;
}): string {
  const fromHeader = resolveAgentIdFromHeader(params.req);
  if (fromHeader) return fromHeader;

  const fromModel = resolveAgentIdFromModel(params.model);
  return fromModel ?? "main";
}
```

요청에서 에이전트 ID를 해결합니다:
1. 헤더에서 추출
2. 모델 이름에서 추출
3. 기본값: `"main"`

### 2.6 resolveSessionKey

```typescript
export function resolveSessionKey(params: {
  req: IncomingMessage;
  agentId: string;
  user?: string | undefined;
  prefix: string;
}): string {
  const explicit = getHeader(params.req, "x-moltbot-session-key")?.trim();
  if (explicit) return explicit;

  const user = params.user?.trim();
  const mainKey = user ? `${params.prefix}-user:${user}` : `${params.prefix}:${randomUUID()}`;
  return buildAgentMainSessionKey({ agentId: params.agentId, mainKey });
}
```

요청에서 세션 키를 해결합니다:
1. `X-Moltbot-Session-Key` 헤더 사용
2. `user` 파라미터가 있으면 `{prefix}-user:{user}` 형식
3. 없으면 `{prefix}:{uuid}` 형식

## 3. HTTP 공통 함수 (`http-common.ts`)

### 3.1 sendJson

```typescript
export function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
```

JSON 응답을 전송합니다.

### 3.2 sendText

```typescript
export function sendText(res: ServerResponse, status: number, body: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(body);
}
```

텍스트 응답을 전송합니다.

### 3.3 sendMethodNotAllowed

```typescript
export function sendMethodNotAllowed(res: ServerResponse, allow = "POST") {
  res.setHeader("Allow", allow);
  sendText(res, 405, "Method Not Allowed");
}
```

405 Method Not Allowed 응답을 전송합니다.

### 3.4 sendUnauthorized

```typescript
export function sendUnauthorized(res: ServerResponse) {
  sendJson(res, 401, {
    error: { message: "Unauthorized", type: "unauthorized" },
  });
}
```

401 Unauthorized 응답을 전송합니다.

### 3.5 sendInvalidRequest

```typescript
export function sendInvalidRequest(res: ServerResponse, message: string) {
  sendJson(res, 400, {
    error: { message, type: "invalid_request_error" },
  });
}
```

400 Bad Request 응답을 전송합니다.

### 3.6 readJsonBodyOrError

```typescript
export async function readJsonBodyOrError(
  req: IncomingMessage,
  res: ServerResponse,
  maxBytes: number,
): Promise<unknown> {
  const body = await readJsonBody(req, maxBytes);
  if (!body.ok) {
    sendInvalidRequest(res, body.error);
    return undefined;
  }
  return body.value;
}
```

JSON 본문을 읽고 에러 시 응답을 전송합니다.

### 3.7 writeDone

```typescript
export function writeDone(res: ServerResponse) {
  res.write("data: [DONE]\n\n");
}
```

Server-Sent Events 종료 마커를 작성합니다.

### 3.8 setSseHeaders

```typescript
export function setSseHeaders(res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
}
```

Server-Sent Events 헤더를 설정합니다.

## 4. 사용 예시

### 4.1 Bearer 토큰 추출

```typescript
const token = getBearerToken(req);
if (!token) {
  sendUnauthorized(res);
  return;
}
```

### 4.2 에이전트 ID 해결

```typescript
const agentId = resolveAgentIdForRequest({
  req,
  model: payload.model,
});
```

### 4.3 세션 키 해결

```typescript
const sessionKey = resolveSessionKey({
  req,
  agentId,
  user: payload.user,
  prefix: "openai",
});
```

### 4.4 JSON 응답 전송

```typescript
sendJson(res, 200, {
  ok: true,
  data: result,
});
```

### 4.5 에러 응답 전송

```typescript
if (!authorized) {
  sendUnauthorized(res);
  return;
}

if (!valid) {
  sendInvalidRequest(res, "Invalid request parameters");
  return;
}
```

## 5. 에러 형식

### 5.1 표준 에러 형식

```typescript
{
  error: {
    message: string;
    type: "unauthorized" | "invalid_request_error" | "server_error";
    code?: string;
  }
}
```

## 6. 보안 고려사항

### 6.1 헤더 대소문자 무시

헤더 이름은 대소문자를 구분하지 않습니다.

### 6.2 토큰 정규화

토큰은 앞뒤 공백을 제거합니다.

### 6.3 에이전트 ID 검증

에이전트 ID는 정규식으로 검증됩니다.

## 7. 성능 고려사항

### 7.1 헤더 캐싱

헤더는 Node.js가 자동으로 캐싱하므로 반복 접근이 효율적입니다.

### 7.2 JSON 직렬화

JSON 직렬화는 동기적으로 수행되므로 큰 객체는 주의가 필요합니다.
