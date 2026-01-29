---
layout: default
title: Http Server
---

# HTTP 서버 및 엔드포인트

**작성일**: 2026-01-28  
**모듈**: `src/gateway/server-http.ts`, `src/gateway/openai-http.ts`, `src/gateway/openresponses-http.ts`, `src/gateway/hooks.ts`

## 1. 개요

Gateway는 HTTP 서버를 통해 다양한 엔드포인트를 제공합니다. Control UI, Canvas Host, OpenAI 호환 API, OpenResponses API, Hooks 엔드포인트 등을 서빙합니다.

## 2. HTTP 서버 생성

### 2.1 서버 생성

```typescript
const httpServer = createGatewayHttpServer({
  canvasHost,
  controlUiEnabled: params.controlUiEnabled,
  controlUiBasePath: params.controlUiBasePath,
  openAiChatCompletionsEnabled: params.openAiChatCompletionsEnabled,
  openResponsesEnabled: params.openResponsesEnabled,
  openResponsesConfig: params.openResponsesConfig,
  handleHooksRequest,
  handlePluginRequest,
  resolvedAuth: params.resolvedAuth,
  tlsOptions: params.gatewayTls?.enabled ? params.gatewayTls.tlsOptions : undefined,
});
```

### 2.2 서버 리스닝

```typescript
const bindHosts = await resolveGatewayListenHosts(params.bindHost);
const httpServers: HttpServer[] = [];
for (const host of bindHosts) {
  const httpServer = createGatewayHttpServer({...});
  await listenGatewayHttpServer({
    httpServer,
    bindHost: host,
    port: params.port,
  });
  httpServers.push(httpServer);
}
```

여러 호스트에 바인딩할 수 있습니다 (예: IPv4와 IPv6).

## 3. 라우팅

### 3.1 라우트 우선순위

1. **Canvas Host** (`/canvas/*`)
2. **Control UI** (`/` 또는 `{basePath}/`)
3. **OpenAI 호환 API** (`/v1/chat/completions`)
4. **OpenResponses API** (`/v1/responses`)
5. **Tools Invoke** (`/v1/tools/invoke`)
6. **Hooks** (`/hooks/*`)
7. **Plugin HTTP 핸들러**
8. **Slack HTTP 핸들러** (`/slack/*`)
9. **404 Not Found**

### 3.2 라우트 핸들러

```typescript
httpServer.on("request", async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  
  // Canvas Host
  if (canvasHost && url.pathname.startsWith(CANVAS_HOST_PATH)) {
    const handled = await canvasHost.handleRequest(req, res);
    if (handled) return;
  }
  
  // Control UI
  if (controlUiEnabled && url.pathname.startsWith(controlUiBasePath)) {
    const handled = await handleControlUiHttpRequest(req, res, controlUiBasePath);
    if (handled) return;
  }
  
  // OpenAI 호환 API
  if (openAiChatCompletionsEnabled && url.pathname === "/v1/chat/completions" && req.method === "POST") {
    await handleOpenAiHttpRequest(req, res, resolvedAuth);
    return;
  }
  
  // OpenResponses API
  if (openResponsesEnabled && url.pathname === "/v1/responses" && req.method === "POST") {
    await handleOpenResponsesHttpRequest(req, res, openResponsesConfig, resolvedAuth);
    return;
  }
  
  // Tools Invoke
  if (url.pathname === "/v1/tools/invoke" && req.method === "POST") {
    await handleToolsInvokeHttpRequest(req, res, resolvedAuth);
    return;
  }
  
  // Hooks
  const hooksHandled = await handleHooksRequest(req, res);
  if (hooksHandled) return;
  
  // Plugin HTTP 핸들러
  const pluginHandled = await handlePluginRequest(req, res);
  if (pluginHandled) return;
  
  // Slack HTTP
  const slackHandled = await handleSlackHttpRequest(req, res);
  if (slackHandled) return;
  
  // 404
  res.statusCode = 404;
  res.end("Not Found");
});
```

## 4. Control UI

### 4.1 서빙

Control UI는 정적 파일로 서빙됩니다:

```typescript
export async function handleControlUiHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  basePath: string,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  if (!url.pathname.startsWith(basePath)) return false;
  
  const path = url.pathname.slice(basePath.length).replace(/^\/+/, "") || "index.html";
  const filePath = path.join(CONTROL_UI_DIR, path);
  
  // 파일 서빙
  // ...
}
```

### 4.2 Base Path

Control UI는 `gateway.controlUi.basePath` 설정으로 기본 경로를 변경할 수 있습니다. 기본값은 `/`입니다.

## 5. Canvas Host

### 5.1 서빙

Canvas Host는 A2UI 애플리케이션을 서빙합니다:

```typescript
if (canvasHost && url.pathname.startsWith(CANVAS_HOST_PATH)) {
  const handled = await canvasHost.handleRequest(req, res);
  if (handled) return;
}
```

### 5.2 경로

Canvas Host는 `/canvas/` 경로에 마운트됩니다.

## 6. OpenAI 호환 API

### 6.1 엔드포인트

`POST /v1/chat/completions`

### 6.2 인증

- Bearer 토큰 (`Authorization: Bearer <token>`)
- Gateway 인증 토큰/비밀번호

### 6.3 요청 형식

```typescript
{
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  stream?: boolean;
  // OpenAI 호환 필드들
}
```

### 6.4 응답 형식

**비스트리밍:**
```typescript
{
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: "stop";
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

**스트리밍:**
Server-Sent Events (SSE) 형식으로 스트리밍 응답을 전송합니다.

### 6.5 활성화

`gateway.http.endpoints.chatCompletions.enabled` 설정으로 활성화할 수 있습니다. 기본값은 `false`입니다.

## 7. OpenResponses API

### 7.1 엔드포인트

`POST /v1/responses`

### 7.2 인증

- Bearer 토큰 (`Authorization: Bearer <token>`)
- Gateway 인증 토큰/비밀번호

### 7.3 요청 형식

```typescript
{
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  // OpenResponses 특화 필드들
}
```

### 7.4 응답 형식

OpenResponses 프로토콜에 따른 응답을 반환합니다.

### 7.5 활성화

`gateway.http.endpoints.responses.enabled` 설정으로 활성화할 수 있습니다. 기본값은 `false`입니다.

## 8. Tools Invoke API

### 8.1 엔드포인트

`POST /v1/tools/invoke`

### 8.2 인증

- Bearer 토큰 (`Authorization: Bearer <token>`)
- Gateway 인증 토큰/비밀번호

### 8.3 요청 형식

```typescript
{
  tool: string;
  arguments: Record<string, unknown>;
}
```

### 8.4 응답 형식

```typescript
{
  result: unknown;
}
```

## 9. Hooks 엔드포인트

### 9.1 엔드포인트

`POST /hooks/*`

### 9.2 인증

- 토큰: `Authorization: Bearer <token>` 또는 `X-Moltbot-Token: <token>` 또는 쿼리 파라미터 `?token=<token>` (비권장)

### 9.3 서브 경로

**wake**
```typescript
POST /hooks/wake
{
  text: string;
  mode?: "now" | "next-heartbeat";
}
```

**agent**
```typescript
POST /hooks/agent
{
  message: string;
  name?: string;
  wakeMode?: "now" | "next-heartbeat";
  sessionKey?: string;
  deliver?: boolean;
  channel?: string;
  to?: string;
  model?: string;
  thinking?: string;
  timeoutSeconds?: number;
  allowUnsafeExternalContent?: boolean;
}
```

**매핑된 경로**
설정의 `hooks.mappings`를 통해 커스텀 경로를 매핑할 수 있습니다.

### 9.4 응답 형식

**wake**
```typescript
{
  ok: true;
  mode: "now" | "next-heartbeat";
}
```

**agent**
```typescript
{
  ok: true;
  runId: string;
}
```

### 9.5 활성화

`gateway.hooks.enabled` 설정으로 활성화할 수 있습니다.

## 10. Plugin HTTP 핸들러

플러그인은 HTTP 핸들러를 등록할 수 있습니다:

```typescript
export type PluginHttpHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<boolean>;
```

핸들러는 요청을 처리하면 `true`를 반환하고, 처리하지 않으면 `false`를 반환합니다.

## 11. Slack HTTP 핸들러

Slack 웹훅 요청을 처리합니다:

```typescript
POST /slack/*
```

## 12. 인증

### 12.1 Gateway 인증

대부분의 엔드포인트는 Gateway 인증을 사용합니다:

- Bearer 토큰: `Authorization: Bearer <token>`
- 비밀번호: 요청 본문에 포함 (일부 엔드포인트)

### 12.2 로컬 요청

로컬 요청 (loopback 주소)은 인증이 선택적일 수 있습니다.

## 13. CORS

Control UI와 Canvas Host는 CORS 헤더를 설정합니다.

## 14. 에러 처리

### 14.1 404 Not Found

요청된 경로가 없으면 404 응답을 반환합니다.

### 14.2 401 Unauthorized

인증 실패 시 401 응답을 반환합니다.

### 14.3 400 Bad Request

잘못된 요청 시 400 응답을 반환합니다.

### 14.4 500 Internal Server Error

서버 에러 시 500 응답을 반환합니다.

## 15. TLS 지원

TLS가 활성화되면 HTTPS 서버가 생성됩니다:

```typescript
const httpServer = gatewayTls?.enabled
  ? createHttpsServer(gatewayTls.tlsOptions)
  : createHttpServer();
```

## 16. WebSocket 업그레이드

HTTP 서버는 WebSocket 업그레이드를 처리합니다:

```typescript
httpServer.on("upgrade", (req, socket, head) => {
  // WebSocket 업그레이드 처리
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});
```

## 17. 성능 고려사항

### 17.1 연결 풀링

HTTP 서버는 연결 풀링을 사용하여 성능을 최적화합니다.

### 17.2 스트리밍

OpenAI 호환 API는 스트리밍 응답을 지원하여 대기 시간을 줄입니다.

### 17.3 정적 파일 캐싱

Control UI와 Canvas Host의 정적 파일은 적절한 캐시 헤더를 설정합니다.
