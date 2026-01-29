# 세션 유틸리티 상세

**작성일**: 2026-01-28  
**모듈**: `src/gateway/session-utils.ts`, `src/gateway/session-utils.fs.ts`, `src/gateway/session-utils.types.ts`

## 1. 개요

세션 유틸리티는 세션 관리에 필요한 다양한 기능을 제공합니다. 세션 목록 조회, 미리보기, 메시지 읽기, 아바타 해결 등을 지원합니다.

## 2. 세션 목록 조회

### 2.1 listSessionsFromStore

```typescript
export function listSessionsFromStore(params: {
  cfg: MoltbotConfig;
  storePath: string;
  store: Record<string, SessionEntry>;
  opts: SessionsListOptions;
}): SessionsListResult
```

세션 스토어에서 세션 목록을 조회합니다.

**옵션:**
- `includeGlobal`: 전역 세션 포함 여부
- `includeUnknown`: 알 수 없는 세션 포함 여부
- `spawnedBy`: 생성자 필터
- `agentId`: 에이전트 ID 필터
- `search`: 검색어 (세션 키, 레이블, 제목)
- `limit`: 최대 개수

**반환값:**
```typescript
{
  ts: number;
  path: string;
  count: number;
  defaults: GatewaySessionsDefaults;
  sessions: GatewaySessionRow[];
}
```

### 2.2 GatewaySessionRow 구조

```typescript
export type GatewaySessionRow = {
  key: string;
  kind: "direct" | "group" | "global" | "unknown";
  label?: string;
  displayName?: string;
  derivedTitle?: string;
  lastMessagePreview?: string;
  channel?: string;
  subject?: string;
  groupChannel?: string;
  space?: string;
  chatType?: NormalizedChatType;
  origin?: SessionEntry["origin"];
  updatedAt: number | null;
  sessionId?: string;
  systemSent?: boolean;
  abortedLastRun?: boolean;
  thinkingLevel?: string;
  verboseLevel?: string;
  reasoningLevel?: string;
  elevatedLevel?: string;
  sendPolicy?: "allow" | "deny";
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  responseUsage?: "on" | "off" | "tokens" | "full";
  modelProvider?: string;
  model?: string;
  contextTokens?: number;
  deliveryContext?: DeliveryContext;
  lastChannel?: SessionEntry["lastChannel"];
  lastTo?: string;
  lastAccountId?: string;
};
```

## 3. 세션 미리보기

### 3.1 readSessionPreviewItemsFromTranscript

```typescript
export function readSessionPreviewItemsFromTranscript(
  sessionId: string,
  storePath: string,
  sessionFile: string | undefined,
  agentId: string,
  limit: number,
  maxChars: number,
): SessionsPreviewEntry[]
```

세션 트랜스크립트에서 미리보기 항목을 읽습니다.

**프로세스:**
1. 트랜스크립트 파일 후보 해결
2. 파일 읽기 (최대 1MB)
3. 라인 파싱 (최대 200줄)
4. 메시지 추출 및 텍스트 변환
5. 크기 제한 적용

**반환값:**
```typescript
{
  role: "user" | "assistant" | "tool" | "system" | "other";
  text: string;
}[]
```

### 3.2 readFirstUserMessageFromTranscript

```typescript
export function readFirstUserMessageFromTranscript(
  sessionId: string,
  storePath: string | undefined,
  sessionFile?: string,
  agentId?: string,
): string | null
```

트랜스크립트에서 첫 사용자 메시지를 읽습니다.

**최적화:**
- 파일의 처음 8KB만 읽음
- 최대 10줄만 스캔

### 3.3 readLastMessagePreviewFromTranscript

```typescript
export function readLastMessagePreviewFromTranscript(
  sessionId: string,
  storePath: string | undefined,
  sessionFile?: string,
  agentId?: string,
  maxChars?: number,
): string | null
```

트랜스크립트에서 마지막 메시지 미리보기를 읽습니다.

**최적화:**
- 파일의 마지막 16KB만 읽음
- 최대 20줄만 스캔

## 4. 세션 메시지 읽기

### 4.1 readSessionMessages

```typescript
export function readSessionMessages(
  sessionId: string,
  storePath: string | undefined,
  sessionFile?: string,
): unknown[]
```

세션 메시지를 읽습니다.

**프로세스:**
1. 트랜스크립트 파일 후보 해결
2. 파일 읽기
3. 라인별 파싱
4. 메시지 추출

## 5. 트랜스크립트 파일 해결

### 5.1 resolveSessionTranscriptCandidates

```typescript
export function resolveSessionTranscriptCandidates(
  sessionId: string,
  storePath: string | undefined,
  sessionFile?: string,
  agentId?: string,
): string[]
```

세션 트랜스크립트 파일 후보를 해결합니다.

**우선순위:**
1. `sessionFile` (명시적 경로)
2. `{storePath 디렉토리}/{sessionId}.jsonl`
3. `{에이전트 워크스페이스}/sessions/{sessionId}.jsonl` (agentId가 있는 경우)
4. `~/.clawdbot/sessions/{sessionId}.jsonl`

## 6. 세션 제목 파생

### 6.1 deriveSessionTitle

```typescript
export function deriveSessionTitle(
  entry: SessionEntry | undefined,
  firstUserMessage?: string | null,
): string | undefined
```

세션 제목을 파생합니다.

**우선순위:**
1. `displayName`
2. `subject`
3. 첫 사용자 메시지 (최대 60자)
4. 세션 ID 접두사 (8자 + 날짜)

**제목 단축:**
```typescript
function truncateTitle(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.6) return cut.slice(0, lastSpace) + "…";
  return cut + "…";
}
```

## 7. 아바타 해결

### 7.1 resolveIdentityAvatarUrl

```typescript
function resolveIdentityAvatarUrl(
  cfg: MoltbotConfig,
  agentId: string,
  avatar: string | undefined,
): string | undefined
```

에이전트 아바타 URL을 해결합니다.

**타입:**
- Data URL: `data:image/...`
- HTTP URL: `https://...` 또는 `http://...`
- 워크스페이스 상대 경로: 파일 읽기 및 Data URL 변환

**제한:**
- 최대 크기: 2MB
- 지원 형식: PNG, JPEG, WebP, GIF, SVG, BMP, TIFF

## 8. 세션 스토어 타겟 해결

### 8.1 resolveGatewaySessionStoreTarget

```typescript
export function resolveGatewaySessionStoreTarget(params: {
  cfg: MoltbotConfig;
  key: string;
}): GatewaySessionStoreTarget
```

세션 키에 대한 스토어 타겟을 해결합니다.

**반환값:**
```typescript
{
  storePath: string;
  canonicalKey: string;
  storeKeys: string[];
  agentId?: string;
}
```

## 9. 배열 크기 제한

### 9.1 capArrayByJsonBytes

```typescript
export function capArrayByJsonBytes<T>(
  items: T[],
  maxBytes: number,
): { items: T[]; bytes: number }
```

JSON 바이트 크기에 따라 배열을 제한합니다.

**프로세스:**
1. 각 항목의 JSON 바이트 크기 계산
2. 총 크기 계산 (배열 구문 포함)
3. 최대 크기를 초과하면 앞에서부터 제거
4. 제한된 배열과 실제 바이트 크기 반환

## 10. 파일 아카이빙

### 10.1 archiveFileOnDisk

```typescript
export function archiveFileOnDisk(filePath: string, reason: string): string
```

파일을 아카이브합니다 (이름 변경).

**형식:**
`{원본경로}.{reason}.{ISO타임스탬프}`

예: `session.jsonl.deleted.2026-01-28T12-34-56-789Z`

## 11. 세션 엔트리 로드

### 11.1 loadSessionEntry

```typescript
export function loadSessionEntry(sessionKey: string): {
  cfg: MoltbotConfig;
  storePath: string;
  entry: SessionEntry | undefined;
}
```

세션 키에 대한 엔트리를 로드합니다.

## 12. 에이전트 목록

### 12.1 listAgentsForGateway

```typescript
export function listAgentsForGateway(cfg: MoltbotConfig): {
  agents: GatewayAgentRow[];
}
```

Gateway용 에이전트 목록을 조회합니다.

**GatewayAgentRow 구조:**
```typescript
export type GatewayAgentRow = {
  id: string;
  name?: string;
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
    avatar?: string;
    avatarUrl?: string;
  };
};
```

## 13. 모델 참조 해결

### 13.1 resolveSessionModelRef

```typescript
export function resolveSessionModelRef(params: {
  cfg: MoltbotConfig;
  entry: SessionEntry | undefined;
  explicitModel?: string;
}): { provider: string; model: string }
```

세션에 대한 모델 참조를 해결합니다.

**우선순위:**
1. `explicitModel` 파라미터
2. 세션 엔트리의 `modelOverride`
3. 에이전트 기본 모델
4. 전역 기본 모델

## 14. 사용 예시

### 14.1 세션 목록 조회

```typescript
const result = listSessionsFromStore({
  cfg,
  storePath,
  store,
  opts: {
    limit: 100,
    search: "keyword",
    agentId: "main",
  },
});
```

### 14.2 세션 미리보기

```typescript
const previews = readSessionPreviewItemsFromTranscript(
  sessionId,
  storePath,
  sessionFile,
  agentId,
  10, // limit
  240, // maxChars
);
```

### 14.3 첫 메시지 읽기

```typescript
const firstMessage = readFirstUserMessageFromTranscript(
  sessionId,
  storePath,
  sessionFile,
  agentId,
);
```

## 15. 성능 고려사항

### 15.1 파일 읽기 최적화

- 첫/마지막 메시지는 파일의 일부만 읽음
- 큰 파일도 효율적으로 처리

### 15.2 크기 제한

- JSON 바이트 크기로 제한하여 응답 크기 제어
- 메모리 사용 최소화

### 15.3 캐싱

세션 스토어는 파일 시스템에서 로드되며, 필요시 캐싱할 수 있습니다.

## 16. 보안 고려사항

### 16.1 경로 검증

워크스페이스 상대 경로는 검증되어 워크스페이스 외부 접근을 방지합니다.

### 16.2 파일 크기 제한

아바타 파일은 최대 2MB로 제한됩니다.

### 16.3 세션 격리

각 세션은 독립적으로 관리되며, 다른 세션의 데이터에 접근할 수 없습니다.
