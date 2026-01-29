---
layout: default
title: Utils Overview
---

# Gateway 유틸리티 함수 개요

**작성일**: 2026-01-28  
**모듈**: `src/gateway/net.ts`, `src/gateway/server-utils.ts`, `src/gateway/session-utils.ts` 등

## 1. 개요

Gateway는 다양한 유틸리티 함수를 제공하여 네트워크 처리, 세션 관리, 에러 포맷팅 등의 공통 작업을 수행합니다.

## 2. 네트워크 유틸리티 (`net.ts`)

### 2.1 IP 주소 처리

**isLoopbackAddress**
```typescript
export function isLoopbackAddress(ip: string | undefined): boolean
```

Loopback 주소인지 확인합니다 (`127.0.0.1`, `::1` 등).

**isLocalGatewayAddress**
```typescript
export function isLocalGatewayAddress(ip: string | undefined): boolean
```

로컬 Gateway 주소인지 확인합니다 (loopback 또는 Tailscale 주소).

**normalizeIPv4MappedAddress**
```typescript
function normalizeIPv4MappedAddress(ip: string): string
```

IPv4 매핑 주소를 정규화합니다 (`::ffff:127.0.0.1` → `127.0.0.1`).

**normalizeIp**
```typescript
function normalizeIp(ip: string | undefined): string | undefined
```

IP 주소를 정규화합니다 (소문자 변환, IPv4 매핑 처리).

### 2.2 프록시 헤더 처리

**parseForwardedForClientIp**
```typescript
export function parseForwardedForClientIp(forwardedFor?: string): string | undefined
```

`X-Forwarded-For` 헤더에서 클라이언트 IP를 추출합니다.

**isTrustedProxyAddress**
```typescript
export function isTrustedProxyAddress(ip: string | undefined, trustedProxies?: string[]): boolean
```

IP 주소가 신뢰할 수 있는 프록시인지 확인합니다.

**resolveGatewayClientIp**
```typescript
export function resolveGatewayClientIp(params: {
  remoteAddr?: string;
  forwardedFor?: string;
  realIp?: string;
  trustedProxies?: string[];
}): string | undefined
```

최종 클라이언트 IP를 해결합니다 (프록시 헤더 고려).

### 2.3 바인딩 호스트 해결

**resolveGatewayBindHost**
```typescript
export async function resolveGatewayBindHost(
  bind: GatewayBindMode | undefined,
  customHost?: string,
): Promise<string>
```

바인딩 모드에 따라 호스트를 해결합니다:
- `loopback`: `127.0.0.1`
- `lan`: `0.0.0.0`
- `tailnet`: Tailscale IPv4 또는 loopback
- `auto`: loopback 우선, 실패 시 LAN
- `custom`: 사용자 지정 IP 또는 LAN

**canBindToHost**
```typescript
export async function canBindToHost(host: string): Promise<boolean>
```

특정 호스트에 바인딩할 수 있는지 테스트합니다.

**resolveGatewayListenHosts**
```typescript
export async function resolveGatewayListenHosts(
  bindHost: string,
  opts?: { canBindToHost?: (host: string) => Promise<boolean> },
): Promise<string[]>
```

리스닝할 호스트 목록을 해결합니다 (IPv4/IPv6).

**isLoopbackHost**
```typescript
export function isLoopbackHost(host: string): boolean
```

호스트가 loopback인지 확인합니다.

## 3. 서버 유틸리티 (`server-utils.ts`)

### 3.1 Voice Wake 트리거 정규화

**normalizeVoiceWakeTriggers**
```typescript
export function normalizeVoiceWakeTriggers(input: unknown): string[]
```

Voice wake 트리거를 정규화합니다:
- 배열로 변환
- 빈 문자열 제거
- 최대 32개로 제한
- 각 트리거 최대 64자로 제한
- 기본값 사용 (비어있을 경우)

### 3.2 에러 포맷팅

**formatError**
```typescript
export function formatError(err: unknown): string
```

에러를 문자열로 포맷팅합니다:
- Error 객체: `name: message code=code`
- 문자열: 그대로 반환
- 객체: `status=... code=...` 또는 JSON

## 4. 세션 유틸리티 (`session-utils.ts`)

### 4.1 세션 목록 조회

**listSessionsFromStore**
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
- `search`: 검색어
- `limit`: 최대 개수

### 4.2 세션 미리보기

**readSessionPreviewItemsFromTranscript**
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

### 4.3 세션 메시지 읽기

**readSessionMessages**
```typescript
export function readSessionMessages(params: {
  sessionId: string;
  storePath: string;
  sessionFile: string | undefined;
  agentId: string;
  limit?: number;
  maxBytes?: number;
}): HistoryEntry[]
```

세션 메시지를 읽습니다.

### 4.4 세션 제목 파생

**deriveSessionTitle**
```typescript
export function deriveSessionTitle(
  entry: SessionEntry | undefined,
  firstUserMessage?: string | null,
): string | undefined
```

세션 제목을 파생합니다:
1. `displayName` 사용
2. `subject` 사용
3. 첫 사용자 메시지 사용 (최대 60자)
4. 세션 ID 접두사 사용

### 4.5 세션 아바타 해결

**resolveIdentityAvatarUrl**
```typescript
function resolveIdentityAvatarUrl(
  cfg: MoltbotConfig,
  agentId: string,
  avatar: string | undefined,
): string | undefined
```

에이전트 아바타 URL을 해결합니다:
- Data URL: 그대로 반환
- HTTP URL: 그대로 반환
- 워크스페이스 상대 경로: 파일 읽기 및 Data URL 변환

### 4.6 세션 스토어 타겟 해결

**resolveGatewaySessionStoreTarget**
```typescript
export function resolveGatewaySessionStoreTarget(params: {
  cfg: MoltbotConfig;
  key: string;
}): GatewaySessionStoreTarget
```

세션 키에 대한 스토어 타겟을 해결합니다.

## 5. 세션 파일 유틸리티 (`session-utils.fs.ts`)

### 5.1 트랜스크립트 후보 해결

**resolveSessionTranscriptCandidates**
```typescript
export function resolveSessionTranscriptCandidates(
  sessionId: string,
  storePath: string,
  sessionFile: string | undefined,
): string[]
```

세션 트랜스크립트 파일 후보를 해결합니다.

### 5.2 첫 사용자 메시지 읽기

**readFirstUserMessageFromTranscript**
```typescript
export function readFirstUserMessageFromTranscript(
  sessionId: string,
  storePath: string,
  sessionFile: string | undefined,
): string | null
```

트랜스크립트에서 첫 사용자 메시지를 읽습니다.

### 5.3 마지막 메시지 미리보기 읽기

**readLastMessagePreviewFromTranscript**
```typescript
export function readLastMessagePreviewFromTranscript(
  sessionId: string,
  storePath: string,
  sessionFile: string | undefined,
  maxChars: number,
): string | null
```

트랜스크립트에서 마지막 메시지 미리보기를 읽습니다.

### 5.4 파일 아카이빙

**archiveFileOnDisk**
```typescript
export function archiveFileOnDisk(filePath: string): Promise<string | null>
```

파일을 아카이브합니다 (이름 변경).

### 5.5 배열 크기 제한

**capArrayByJsonBytes**
```typescript
export function capArrayByJsonBytes<T>(
  items: T[],
  maxBytes: number,
): { items: T[]; truncated: boolean }
```

JSON 바이트 크기에 따라 배열을 제한합니다.

## 6. 세션 해결 (`sessions-resolve.ts`)

### 6.1 세션 키 해결

**resolveSessionKeyFromResolveParams**
```typescript
export function resolveSessionKeyFromResolveParams(params: {
  cfg: MoltbotConfig;
  p: SessionsResolveParams;
}): SessionsResolveResult
```

파라미터에서 세션 키를 해결합니다:
- `key`: 직접 키 사용
- `sessionId`: 세션 ID로 검색
- `label`: 레이블로 검색

## 7. HTTP 유틸리티 (`http-utils.ts`)

### 7.1 Bearer 토큰 추출

**getBearerToken**
```typescript
function getBearerToken(req: IncomingMessage): string | undefined
```

`Authorization: Bearer <token>` 헤더에서 토큰을 추출합니다.

### 7.2 에이전트 ID 해결

**resolveAgentIdForRequest**
```typescript
function resolveAgentIdForRequest(params: {
  req: IncomingMessage;
  model?: string;
}): string
```

요청에서 에이전트 ID를 해결합니다.

### 7.3 세션 키 해결

**resolveSessionKey**
```typescript
function resolveSessionKey(params: {
  req: IncomingMessage;
  agentId: string;
  user?: string;
  prefix: string;
}): string
```

요청에서 세션 키를 해결합니다.

## 8. WebSocket 로깅 (`ws-log.ts`)

### 8.1 로그 함수

**logWs**
```typescript
export function logWs(direction: "in" | "out", kind: string, meta?: Record<string, unknown>)
```

WebSocket 메시지를 로깅합니다.

**로깅 모드:**
- `verbose`: 상세 로깅
- `optimized`: 느린 요청/에러만 로깅
- `compact`: 컴팩트 형식 로깅

### 8.2 에러 포맷팅

**formatForLog**
```typescript
export function formatForLog(value: unknown): string
```

값을 로그 형식으로 포맷팅합니다:
- Error 객체 처리
- 민감 정보 리덕션
- 길이 제한

### 8.3 에이전트 이벤트 요약

**summarizeAgentEventForWsLog**
```typescript
export function summarizeAgentEventForWsLog(payload: unknown): Record<string, unknown>
```

에이전트 이벤트를 로그용으로 요약합니다.

### 8.4 ID 단축

**shortId**
```typescript
export function shortId(value: string): string
```

ID를 짧게 표시합니다 (UUID의 경우 `12345678…abcd`).

## 9. 공유 타입 (`server-shared.ts`)

### 9.1 DedupeEntry

```typescript
export type DedupeEntry = {
  ts: number;
  ok: boolean;
  payload?: unknown;
  error?: ErrorShape;
};
```

중복 제거 캐시 엔트리입니다.

## 10. 상수 (`server-constants.ts`)

### 10.1 페이로드 제한

- `MAX_PAYLOAD_BYTES`: 512KB
- `MAX_BUFFERED_BYTES`: 1.5MB

### 10.2 타임아웃

- `DEFAULT_HANDSHAKE_TIMEOUT_MS`: 10초
- `TICK_INTERVAL_MS`: 30초
- `HEALTH_REFRESH_INTERVAL_MS`: 60초

### 10.3 중복 제거

- `DEDUPE_TTL_MS`: 5분
- `DEDUPE_MAX`: 1000개

### 10.4 채팅 히스토리

- `DEFAULT_MAX_CHAT_HISTORY_MESSAGES_BYTES`: 6MB

## 11. 사용 예시

### 11.1 IP 주소 확인

```typescript
const clientIp = resolveGatewayClientIp({
  remoteAddr: req.socket?.remoteAddress,
  forwardedFor: req.headers["x-forwarded-for"],
  realIp: req.headers["x-real-ip"],
  trustedProxies: config.gateway?.trustedProxies,
});

if (isLoopbackAddress(clientIp)) {
  // 로컬 요청 처리
}
```

### 11.2 세션 목록 조회

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

### 11.3 에러 로깅

```typescript
try {
  await performOperation();
} catch (err) {
  log.error(`operation failed: ${formatError(err)}`);
}
```
