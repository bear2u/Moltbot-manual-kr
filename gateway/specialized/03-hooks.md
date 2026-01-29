---
layout: default
title: Hooks
---

# Gateway Hooks 시스템

**작성일**: 2026-01-28  
**모듈**: `src/gateway/hooks.ts`, `src/gateway/hooks-mapping.ts`, `src/gateway/server/hooks.ts`

## 1. 개요

Gateway Hooks는 외부 시스템과 통합하기 위한 HTTP 엔드포인트입니다. 웹훅을 통해 에이전트를 실행하거나 시스템 이벤트를 큐에 추가할 수 있습니다.

## 2. Hooks 설정

### 2.1 설정 구조

```json
{
  "hooks": {
    "enabled": true,
    "token": "your-secret-token",
    "path": "/hooks",
    "maxBodyBytes": 256000,
    "mappings": [
      {
        "id": "custom-hook",
        "match": {
          "path": "custom"
        },
        "action": "agent",
        "messageTemplate": "New event: {{payload.message}}"
      }
    ],
    "presets": ["gmail"],
    "transformsDir": "./hooks-transforms"
  }
}
```

### 2.2 설정 해결

```typescript
export function resolveHooksConfig(cfg: MoltbotConfig): HooksConfigResolved | null {
  if (cfg.hooks?.enabled !== true) return null;
  const token = cfg.hooks?.token?.trim();
  if (!token) {
    throw new Error("hooks.enabled requires hooks.token");
  }
  const rawPath = cfg.hooks?.path?.trim() || DEFAULT_HOOKS_PATH;
  const withSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const trimmed = withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
  if (trimmed === "/") {
    throw new Error("hooks.path may not be '/'");
  }
  const maxBodyBytes = cfg.hooks?.maxBodyBytes && cfg.hooks.maxBodyBytes > 0
    ? cfg.hooks.maxBodyBytes
    : DEFAULT_HOOKS_MAX_BODY_BYTES;
  const mappings = resolveHookMappings(cfg.hooks);
  return {
    basePath: trimmed,
    token,
    maxBodyBytes,
    mappings,
  };
}
```

## 3. Hooks 엔드포인트

### 3.1 기본 경로

기본 경로는 `/hooks`입니다. `hooks.path` 설정으로 변경할 수 있습니다.

### 3.2 인증

Hooks는 토큰 기반 인증을 사용합니다:
- `Authorization: Bearer <token>`
- `X-Moltbot-Token: <token>`
- 쿼리 파라미터 `?token=<token>` (비권장, 보안상 위험)

### 3.3 토큰 추출

```typescript
export function extractHookToken(req: IncomingMessage, url: URL): HookTokenResult {
  const auth = typeof req.headers.authorization === "string" ? req.headers.authorization.trim() : "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return { token, fromQuery: false };
  }
  const headerToken = typeof req.headers["x-moltbot-token"] === "string" ? req.headers["x-moltbot-token"].trim() : "";
  if (headerToken) return { token: headerToken, fromQuery: false };
  const queryToken = url.searchParams.get("token");
  if (queryToken) return { token: queryToken.trim(), fromQuery: true };
  return { token: undefined, fromQuery: false };
}
```

## 4. 기본 Hooks

### 4.1 Wake Hook

**엔드포인트:** `POST /hooks/wake`

**요청:**
```json
{
  "text": "시스템 이벤트 메시지",
  "mode": "now" | "next-heartbeat"
}
```

**응답:**
```json
{
  "ok": true,
  "mode": "now" | "next-heartbeat"
}
```

**처리:**
```typescript
const dispatchWakeHook = (value: { text: string; mode: "now" | "next-heartbeat" }) => {
  const sessionKey = resolveMainSessionKeyFromConfig();
  enqueueSystemEvent(value.text, { sessionKey });
  if (value.mode === "now") {
    requestHeartbeatNow({ reason: "hook:wake" });
  }
};
```

### 4.2 Agent Hook

**엔드포인트:** `POST /hooks/agent`

**요청:**
```json
{
  "message": "에이전트에 전달할 메시지",
  "name": "Hook 이름",
  "wakeMode": "now" | "next-heartbeat",
  "sessionKey": "세션 키",
  "deliver": true,
  "channel": "telegram",
  "to": "사용자 ID",
  "model": "claude-3-5-sonnet-20241022",
  "thinking": "low",
  "timeoutSeconds": 300,
  "allowUnsafeExternalContent": false
}
```

**응답:**
```json
{
  "ok": true,
  "runId": "실행 ID"
}
```

**처리:**
```typescript
const dispatchAgentHook = (value: {
  message: string;
  name: string;
  wakeMode: "now" | "next-heartbeat";
  sessionKey: string;
  deliver: boolean;
  channel: HookMessageChannel;
  // ...
}) => {
  const sessionKey = value.sessionKey.trim() ? value.sessionKey.trim() : `hook:${randomUUID()}`;
  const mainSessionKey = resolveMainSessionKeyFromConfig();
  const jobId = randomUUID();
  const now = Date.now();
  
  // 크론 작업 생성
  const job: CronJob = {
    id: jobId,
    name: value.name,
    enabled: true,
    createdAtMs: now,
    updatedAtMs: now,
    schedule: { kind: "at", atMs: now },
    sessionTarget: "isolated",
    wakeMode: value.wakeMode,
    payload: {
      kind: "agentTurn",
      message: value.message,
      model: value.model,
      thinking: value.thinking,
      timeoutSeconds: value.timeoutSeconds,
      deliver: value.deliver,
      channel: value.channel,
      to: value.to,
      allowUnsafeExternalContent: value.allowUnsafeExternalContent,
    },
    state: { nextRunAtMs: now },
  };
  
  // 격리된 에이전트 실행
  void runCronIsolatedAgentTurn({
    cfg,
    deps,
    job,
    message: value.message,
    sessionKey,
    lane: "cron",
  });
  
  return runId;
};
```

## 5. Hook 매핑

### 5.1 매핑 구조

```typescript
export type HookMappingResolved = {
  id: string;
  matchPath?: string;
  matchSource?: string;
  action: "wake" | "agent";
  wakeMode?: "now" | "next-heartbeat";
  name?: string;
  sessionKey?: string;
  messageTemplate?: string;
  textTemplate?: string;
  deliver?: boolean;
  allowUnsafeExternalContent?: boolean;
  channel?: HookMessageChannel;
  to?: string;
  model?: string;
  thinking?: string;
  timeoutSeconds?: number;
  transform?: HookMappingTransformResolved;
};
```

### 5.2 매칭 조건

**경로 매칭:**
```typescript
if (mapping.matchPath) {
  if (mapping.matchPath !== normalizeMatchPath(ctx.path)) return false;
}
```

**소스 매칭:**
```typescript
if (mapping.matchSource) {
  const source = typeof ctx.payload.source === "string" ? ctx.payload.source : undefined;
  if (!source || source !== mapping.matchSource) return false;
}
```

### 5.3 템플릿 렌더링

템플릿은 `{{...}}` 구문을 사용합니다:

```typescript
function renderTemplate(template: string, ctx: HookMappingContext) {
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expr: string) => {
    const value = resolveTemplateExpr(expr.trim(), ctx);
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value);
  });
}
```

**지원되는 표현식:**
- `path`: 요청 경로
- `now`: 현재 시간 (ISO 8601)
- `headers.*`: HTTP 헤더
- `query.*`: 쿼리 파라미터
- `payload.*`: 요청 페이로드

### 5.4 변환 함수

매핑은 변환 함수를 사용할 수 있습니다:

```typescript
export type HookMappingTransformResolved = {
  modulePath: string;
  exportName?: string;
};
```

변환 함수는 요청을 변환하거나 건너뛸 수 있습니다:

```typescript
type HookTransformFn = (
  ctx: HookMappingContext,
) => HookTransformResult | Promise<HookTransformResult>;
```

**변환 결과:**
- `null`: 요청 건너뛰기
- 객체: 액션 오버라이드

## 6. Hook 프리셋

### 6.1 Gmail 프리셋

```typescript
const hookPresetMappings: Record<string, HookMappingConfig[]> = {
  gmail: [
    {
      id: "gmail",
      match: { path: "gmail" },
      action: "agent",
      wakeMode: "now",
      name: "Gmail",
      sessionKey: "hook:gmail:{{messages[0].id}}",
      messageTemplate: "New email from {{messages[0].from}}\nSubject: {{messages[0].subject}}\n{{messages[0].snippet}}\n{{messages[0].body}}",
    },
  ],
};
```

`hooks.presets: ["gmail"]`을 설정하면 Gmail 프리셋이 활성화됩니다.

## 7. Hook 채널

### 7.1 지원 채널

```typescript
const listHookChannelValues = () => ["last", ...listChannelPlugins().map((plugin) => plugin.id)];
```

- `last`: 마지막 사용 채널
- 채널 ID: 특정 채널 (telegram, whatsapp 등)

### 7.2 채널 해결

```typescript
export function resolveHookChannel(raw: unknown): HookMessageChannel | null {
  if (raw === undefined) return "last";
  if (typeof raw !== "string") return null;
  const normalized = normalizeMessageChannel(raw);
  if (!normalized || !getHookChannelSet().has(normalized)) return null;
  return normalized as HookMessageChannel;
}
```

## 8. JSON 본문 읽기

### 8.1 본문 읽기

```typescript
export async function readJsonBody(
  req: IncomingMessage,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  return await new Promise((resolve) => {
    let done = false;
    let total = 0;
    const chunks: Buffer[] = [];
    
    req.on("data", (chunk: Buffer) => {
      if (done) return;
      total += chunk.length;
      if (total > maxBytes) {
        done = true;
        resolve({ ok: false, error: "payload too large" });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    
    req.on("end", () => {
      if (done) return;
      done = true;
      const raw = Buffer.concat(chunks).toString("utf-8").trim();
      if (!raw) {
        resolve({ ok: true, value: {} });
        return;
      }
      try {
        const parsed = JSON.parse(raw) as unknown;
        resolve({ ok: true, value: parsed });
      } catch (err) {
        resolve({ ok: false, error: String(err) });
      }
    });
    
    req.on("error", (err) => {
      if (done) return;
      done = true;
      resolve({ ok: false, error: String(err) });
    });
  });
}
```

## 9. Hook 헤더 정규화

### 9.1 헤더 정규화

```typescript
export function normalizeHookHeaders(req: IncomingMessage) {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") {
      headers[key.toLowerCase()] = value;
    } else if (Array.isArray(value) && value.length > 0) {
      headers[key.toLowerCase()] = value.join(", ");
    }
  }
  return headers;
}
```

## 10. 페이로드 정규화

### 10.1 Wake 페이로드 정규화

```typescript
export function normalizeWakePayload(
  payload: Record<string, unknown>,
): { ok: true; value: { text: string; mode: "now" | "next-heartbeat" } } | { ok: false; error: string } {
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) return { ok: false, error: "text required" };
  const mode = payload.mode === "next-heartbeat" ? "next-heartbeat" : "now";
  return { ok: true, value: { text, mode } };
}
```

### 10.2 Agent 페이로드 정규화

```typescript
export function normalizeAgentPayload(
  payload: Record<string, unknown>,
  opts?: { idFactory?: () => string },
): { ok: true; value: HookAgentPayload } | { ok: false; error: string } {
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!message) return { ok: false, error: "message required" };
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : "Hook";
  const wakeMode = payload.wakeMode === "next-heartbeat" ? "next-heartbeat" : "now";
  const sessionKey = payload.sessionKey?.trim() ? payload.sessionKey.trim() : `hook:${idFactory()}`;
  const channel = resolveHookChannel(payload.channel);
  if (!channel) return { ok: false, error: getHookChannelError() };
  // ...
  return { ok: true, value: {...} };
}
```

## 11. 매핑 적용

### 11.1 매핑 적용 프로세스

```typescript
export async function applyHookMappings(
  mappings: HookMappingResolved[],
  ctx: HookMappingContext,
): Promise<HookMappingResult | null> {
  if (mappings.length === 0) return null;
  
  for (const mapping of mappings) {
    if (!mappingMatches(mapping, ctx)) continue;
    
    const base = buildActionFromMapping(mapping, ctx);
    if (!base.ok) return base;
    
    let override: HookTransformResult = null;
    if (mapping.transform) {
      const transform = await loadTransform(mapping.transform);
      override = await transform(ctx);
      if (override === null) {
        return { ok: true, action: null, skipped: true };
      }
    }
    
    if (!base.action) return { ok: true, action: null, skipped: true };
    const merged = mergeAction(base.action, override, mapping.action);
    if (!merged.ok) return merged;
    return merged;
  }
  
  return null;
}
```

## 12. 사용 예시

### 12.1 Wake Hook 호출

```bash
curl -X POST http://localhost:18789/hooks/wake \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"text": "시스템 이벤트", "mode": "now"}'
```

### 12.2 Agent Hook 호출

```bash
curl -X POST http://localhost:18789/hooks/agent \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "안녕하세요",
    "name": "Webhook",
    "wakeMode": "now",
    "channel": "telegram",
    "deliver": true
  }'
```

### 12.3 커스텀 매핑 사용

```bash
curl -X POST http://localhost:18789/hooks/custom \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"message": "커스텀 이벤트"}'
```

## 13. 보안 고려사항

### 13.1 토큰 보안

- 토큰은 강력한 랜덤 문자열이어야 합니다
- 쿼리 파라미터 사용은 비권장 (로그에 남음)
- Bearer 토큰 또는 헤더 사용 권장

### 13.2 페이로드 크기 제한

기본 최대 본문 크기는 256KB입니다. `hooks.maxBodyBytes` 설정으로 변경할 수 있습니다.

### 13.3 변환 함수 보안

변환 함수는 신뢰할 수 있는 소스에서만 로드해야 합니다.

## 14. 에러 처리

### 14.1 인증 실패

401 Unauthorized 응답을 반환합니다.

### 14.2 페이로드 너무 큼

413 Payload Too Large 응답을 반환합니다.

### 14.3 잘못된 요청

400 Bad Request 응답을 반환합니다.

### 14.4 매핑 실패

500 Internal Server Error 응답을 반환합니다.
