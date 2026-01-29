# OpenAI 호환 HTTP API

**작성일**: 2026-01-28  
**모듈**: `src/gateway/openai-http.ts`

## 1. 개요

Gateway는 OpenAI Chat Completions API와 호환되는 HTTP 엔드포인트를 제공합니다. 이를 통해 기존 OpenAI 클라이언트 라이브러리를 사용하여 Gateway와 통신할 수 있습니다.

## 2. 엔드포인트

### 2.1 Chat Completions

**엔드포인트:** `POST /v1/chat/completions`

**인증:**
- Bearer 토큰 (`Authorization: Bearer <token>`)
- Gateway 인증 토큰/비밀번호

**활성화:**
`gateway.http.endpoints.chatCompletions.enabled` 설정으로 활성화할 수 있습니다. 기본값은 `false`입니다.

## 3. 요청 형식

### 3.1 요청 구조

```typescript
type OpenAiChatCompletionRequest = {
  model?: unknown;
  stream?: unknown;
  messages?: unknown;
  user?: unknown;
};
```

**필드:**
- `model`: 모델 이름 (기본값: "moltbot")
- `stream`: 스트리밍 여부 (기본값: false)
- `messages`: 메시지 배열
- `user`: 사용자 식별자 (세션 키 생성에 사용)

### 3.2 메시지 형식

```typescript
type OpenAiChatMessage = {
  role?: unknown;
  content?: unknown;
  name?: unknown;
};
```

**역할:**
- `system`: 시스템 프롬프트
- `user`: 사용자 메시지
- `assistant`: 어시스턴트 메시지
- `function`: 함수 호출 결과 (tool로 변환)

**콘텐츠:**
- 문자열: 직접 텍스트
- 배열: 멀티모달 콘텐츠 블록

## 4. 요청 처리

### 4.1 처리 프로세스

1. **인증 확인**
```typescript
const token = getBearerToken(req);
const authResult = await authorizeGatewayConnect({
  auth: opts.auth,
  connectAuth: { token, password: token },
  req,
  trustedProxies: opts.trustedProxies,
});
if (!authResult.ok) {
  sendUnauthorized(res);
  return true;
}
```

2. **본문 읽기**
```typescript
const body = await readJsonBodyOrError(req, res, opts.maxBodyBytes ?? 1024 * 1024);
if (body === undefined) return true;
```

3. **요청 파라미터 추출**
```typescript
const payload = coerceRequest(body);
const stream = Boolean(payload.stream);
const model = typeof payload.model === "string" ? payload.model : "moltbot";
const user = typeof payload.user === "string" ? payload.user : undefined;
```

4. **에이전트 ID 및 세션 키 해결**
```typescript
const agentId = resolveAgentIdForRequest({ req, model });
const sessionKey = resolveOpenAiSessionKey({ req, agentId, user });
```

5. **에이전트 프롬프트 빌드**
```typescript
const prompt = buildAgentPrompt(payload.messages);
if (!prompt.message) {
  sendJson(res, 400, {
    error: {
      message: "Missing user message in `messages`.",
      type: "invalid_request_error",
    },
  });
  return true;
}
```

6. **에이전트 실행**
```typescript
const runId = `chatcmpl_${randomUUID()}`;
// 에이전트 실행 및 응답 처리
```

## 5. 프롬프트 빌드

### 5.1 buildAgentPrompt

```typescript
function buildAgentPrompt(messagesUnknown: unknown): {
  message: string;
  extraSystemPrompt?: string;
}
```

OpenAI 메시지 배열을 에이전트 프롬프트로 변환합니다.

**프로세스:**

1. **시스템 메시지 추출**
```typescript
const systemParts: string[] = [];
for (const msg of messages) {
  if (msg.role === "system" || msg.role === "developer") {
    systemParts.push(content);
    continue;
  }
}
```

2. **대화 엔트리 생성**
```typescript
const conversationEntries: Array<{ role: "user" | "assistant" | "tool"; entry: HistoryEntry }> = [];
for (const msg of messages) {
  const normalizedRole = role === "function" ? "tool" : role;
  if (normalizedRole === "user" || normalizedRole === "assistant" || normalizedRole === "tool") {
    conversationEntries.push({
      role: normalizedRole,
      entry: { sender: "...", body: content },
    });
  }
}
```

3. **현재 메시지 찾기**
```typescript
let currentIndex = -1;
for (let i = conversationEntries.length - 1; i >= 0; i -= 1) {
  const entryRole = conversationEntries[i]?.role;
  if (entryRole === "user" || entryRole === "tool") {
    currentIndex = i;
    break;
  }
}
if (currentIndex < 0) currentIndex = conversationEntries.length - 1;
```

4. **히스토리 컨텍스트 빌드**
```typescript
const currentEntry = conversationEntries[currentIndex]?.entry;
const historyEntries = conversationEntries.slice(0, currentIndex).map((entry) => entry.entry);
if (historyEntries.length === 0) {
  message = currentEntry.body;
} else {
  message = buildHistoryContextFromEntries({
    entries: [...historyEntries, currentEntry],
    currentMessage: formatEntry(currentEntry),
    formatEntry,
  });
}
```

### 5.2 텍스트 콘텐츠 추출

```typescript
function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const type = part.type;
        const text = part.text;
        const inputText = part.input_text;
        if (type === "text" && typeof text === "string") return text;
        if (type === "input_text" && typeof text === "string") return text;
        if (typeof inputText === "string") return inputText;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}
```

## 6. 응답 형식

### 6.1 비스트리밍 응답

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

### 6.2 스트리밍 응답

Server-Sent Events (SSE) 형식으로 스트리밍합니다:

```typescript
// 헤더 설정
setSseHeaders(res);

// 초기 이벤트
writeSse(res, {
  id: runId,
  object: "chat.completion.chunk",
  created: Math.floor(Date.now() / 1000),
  model: model,
  choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
});

// 델타 이벤트
writeSse(res, {
  id: runId,
  object: "chat.completion.chunk",
  choices: [{ index: 0, delta: { content: textChunk }, finish_reason: null }],
});

// 완료 이벤트
writeSse(res, {
  id: runId,
  object: "chat.completion.chunk",
  choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
});

// 종료
writeDone(res);
```

## 7. 세션 키 해결

### 7.1 resolveOpenAiSessionKey

```typescript
function resolveOpenAiSessionKey(params: {
  req: IncomingMessage;
  agentId: string;
  user?: string | undefined;
}): string {
  return resolveSessionKey({ ...params, prefix: "openai" });
}
```

OpenAI 요청에 대한 세션 키를 생성합니다:
- `user` 파라미터가 있으면 사용
- 없으면 요청 정보에서 생성
- 접두사: `openai`

## 8. 에이전트 실행

### 8.1 실행 프로세스

1. **이벤트 리스너 등록**
```typescript
const unsub = onAgentEvent((evt) => {
  if (evt.runId !== runId) return;
  // 이벤트 처리
});
```

2. **에이전트 실행**
```typescript
const result = await agentCommand({
  message: prompt.message,
  extraSystemPrompt: prompt.extraSystemPrompt,
  agentId,
  sessionKey,
  deliver: false,
  deps: createDefaultDeps(),
});
```

3. **응답 생성**
- 비스트리밍: 완료 후 응답
- 스트리밍: 실시간 스트리밍

## 9. 에러 처리

### 9.1 에러 형식

```typescript
{
  error: {
    message: string;
    type: "invalid_request_error" | "server_error";
    code?: string;
  }
}
```

### 9.2 주요 에러

- **401 Unauthorized**: 인증 실패
- **400 Bad Request**: 잘못된 요청 (메시지 누락 등)
- **500 Internal Server Error**: 서버 에러

## 10. 사용 예시

### 10.1 비스트리밍 요청

```bash
curl -X POST http://localhost:18789/v1/chat/completions \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "moltbot",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### 10.2 스트리밍 요청

```bash
curl -X POST http://localhost:18789/v1/chat/completions \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "moltbot",
    "stream": true,
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### 10.3 Python 클라이언트

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:18789/v1",
    api_key="your-token"
)

response = client.chat.completions.create(
    model="moltbot",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

## 11. 호환성

### 11.1 OpenAI API 호환성

대부분의 OpenAI API 기능을 지원합니다:
- 메시지 배열
- 시스템 프롬프트
- 스트리밍
- 사용자 식별자

### 11.2 제한사항

- 함수 호출은 tool 호출로 변환됩니다
- 일부 고급 기능은 지원되지 않을 수 있습니다

## 12. 성능 고려사항

### 12.1 스트리밍

스트리밍은 실시간 응답을 제공하여 사용자 경험을 개선합니다.

### 12.2 세션 관리

세션 키는 요청 정보에서 생성되므로 동일한 사용자는 동일한 세션을 사용합니다.

## 13. 보안 고려사항

### 13.1 인증

모든 요청은 Gateway 인증을 통과해야 합니다.

### 13.2 본문 크기 제한

기본 최대 본문 크기는 1MB입니다.

### 13.3 세션 격리

각 사용자는 독립적인 세션을 가지며, 다른 사용자의 데이터에 접근할 수 없습니다.
