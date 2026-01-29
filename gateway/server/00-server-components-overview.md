---
layout: default
title: Server Components Overview
---

# 서버 내부 컴포넌트 개요

**작성일**: 2026-01-28  
**모듈**: `src/gateway/server/`

## 1. 개요

Gateway 서버는 여러 내부 컴포넌트로 구성되어 있습니다. 각 컴포넌트는 특정 기능을 담당하며, 서버의 안정성과 성능을 보장합니다.

## 2. 주요 컴포넌트

### 2.1 WebSocket 연결 처리 (`ws-connection.ts`)

WebSocket 연결의 전체 생명주기를 관리합니다:
- 연결 핸드셰이크
- 인증 처리
- 메시지 라우팅
- 연결 종료 처리

### 2.2 메시지 핸들러 (`ws-connection/message-handler.ts`)

WebSocket 메시지를 처리합니다:
- 프레임 파싱 및 검증
- Connect 요청 처리
- 일반 요청 처리
- 에러 처리

### 2.3 Health 상태 관리 (`health-state.ts`)

Gateway의 Health 상태를 관리합니다:
- Health 스냅샷 캐싱
- Health 버전 관리
- Health 갱신
- 브로드캐스트 통합

### 2.4 Hooks 요청 처리 (`hooks.ts`)

Gateway Hooks HTTP 요청을 처리합니다:
- Wake Hook 처리
- Agent Hook 처리
- 매핑된 Hook 처리

### 2.5 Plugin HTTP 핸들러 (`plugins-http.ts`)

플러그인의 HTTP 요청을 처리합니다:
- 플러그인 라우트 매칭
- 플러그인 핸들러 실행
- 에러 처리

### 2.6 TLS 런타임 (`tls.ts`)

Gateway TLS 설정을 관리합니다:
- TLS 설정 로드
- TLS 옵션 생성
- 인증서 지문 관리

### 2.7 HTTP 서버 리스닝 (`http-listen.ts`)

HTTP 서버를 특정 호스트와 포트에 바인딩합니다:
- IPv4/IPv6 바인딩
- 에러 처리
- 리스닝 상태 확인

### 2.8 연결 종료 이유 (`close-reason.ts`)

WebSocket 연결 종료 이유를 처리합니다:
- 종료 이유 트런케이션
- 최대 바이트 제한

## 3. WebSocket 타입

### 3.1 GatewayWsClient

```typescript
export type GatewayWsClient = {
  socket: WebSocket;
  connect: ConnectParams;
  connId: string;
  presenceKey?: string;
};
```

**필드:**
- `socket`: WebSocket 소켓 객체
- `connect`: 연결 파라미터
- `connId`: 연결 고유 ID
- `presenceKey`: 프레즌스 키 (선택적)

## 4. Health 상태 관리

### 4.1 Health 캐시

Health 스냅샷은 캐시되어 빠른 조회가 가능합니다:

```typescript
let healthCache: HealthSummary | null = null;
let healthRefresh: Promise<HealthSummary> | null = null;
```

### 4.2 Health 버전

Health 스냅샷이 갱신될 때마다 버전이 증가합니다:

```typescript
let healthVersion = 1;
```

### 4.3 Health 갱신

```typescript
export async function refreshGatewayHealthSnapshot(opts?: { probe?: boolean }) {
  if (!healthRefresh) {
    healthRefresh = (async () => {
      const snap = await getHealthSnapshot({ probe: opts?.probe });
      healthCache = snap;
      healthVersion += 1;
      if (broadcastHealthUpdate) {
        broadcastHealthUpdate(snap);
      }
      return snap;
    })().finally(() => {
      healthRefresh = null;
    });
  }
  return healthRefresh;
}
```

## 5. Gateway 스냅샷

### 5.1 스냅샷 생성

```typescript
export function buildGatewaySnapshot(): Snapshot {
  const cfg = loadConfig();
  const defaultAgentId = resolveDefaultAgentId(cfg);
  const mainKey = normalizeMainKey(cfg.session?.mainKey);
  const mainSessionKey = resolveMainSessionKey(cfg);
  const scope = cfg.session?.scope ?? "per-sender";
  const presence = listSystemPresence();
  const uptimeMs = Math.round(process.uptime() * 1000);
  
  return {
    presence,
    health: emptyHealth,
    stateVersion: { presence: presenceVersion, health: healthVersion },
    uptimeMs,
    configPath: CONFIG_PATH,
    stateDir: STATE_DIR,
    sessionDefaults: {
      defaultAgentId,
      mainKey,
      mainSessionKey,
      scope,
    },
  };
}
```

## 6. Hooks 요청 처리

### 6.1 Hooks 핸들러 생성

```typescript
export function createGatewayHooksRequestHandler(params: {
  deps: CliDeps;
  getHooksConfig: () => HooksConfigResolved | null;
  bindHost: string;
  port: number;
  logHooks: SubsystemLogger;
})
```

### 6.2 Wake Hook 처리

```typescript
const dispatchWakeHook = (value: { text: string; mode: "now" | "next-heartbeat" }) => {
  const sessionKey = resolveMainSessionKeyFromConfig();
  enqueueSystemEvent(value.text, { sessionKey });
  if (value.mode === "now") {
    requestHeartbeatNow({ reason: "hook:wake" });
  }
};
```

### 6.3 Agent Hook 처리

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
  // 크론 작업 생성 및 실행
  // ...
};
```

## 7. Plugin HTTP 핸들러

### 7.1 핸들러 생성

```typescript
export function createGatewayPluginRequestHandler(params: {
  registry: PluginRegistry;
  log: SubsystemLogger;
}): PluginHttpRequestHandler
```

### 7.2 라우트 매칭

```typescript
const routes = registry.httpRoutes ?? [];
if (routes.length > 0) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const route = routes.find((entry) => entry.path === url.pathname);
  if (route) {
    await route.handler(req, res);
    return true;
  }
}
```

### 7.3 핸들러 실행

```typescript
for (const entry of handlers) {
  const handled = await entry.handler(req, res);
  if (handled) return true;
}
```

## 8. TLS 런타임

### 8.1 TLS 로드

```typescript
export async function loadGatewayTlsRuntime(
  cfg: GatewayTlsConfig | undefined,
  log?: { info?: (msg: string) => void; warn?: (msg: string) => void },
): Promise<GatewayTlsRuntime>
```

### 8.2 TLS 런타임 타입

```typescript
export type GatewayTlsRuntime = {
  enabled: boolean;
  fingerprintSha256?: string;
  tlsOptions?: TlsOptions;
  error?: string;
};
```

## 9. 연결 종료 이유

### 9.1 종료 이유 트런케이션

```typescript
export function truncateCloseReason(reason: string, maxBytes = CLOSE_REASON_MAX_BYTES): string {
  if (!reason) return "invalid handshake";
  const buf = Buffer.from(reason);
  if (buf.length <= maxBytes) return reason;
  return buf.subarray(0, maxBytes).toString();
}
```

WebSocket 종료 이유는 최대 120바이트로 제한됩니다.

## 10. 컴포넌트 간 통신

컴포넌트들은 다음을 통해 통신합니다:
- 공유 상태 (Health 캐시, Presence 버전 등)
- 콜백 함수 (브로드캐스트 업데이트 등)
- 이벤트 시스템

## 11. 에러 처리

각 컴포넌트는 자체 에러 처리를 수행합니다:
- 로깅
- 클라이언트에 에러 전송
- 연결 종료 (필요시)

## 12. 성능 최적화

### 12.1 Health 캐싱

Health 스냅샷은 캐시되어 중복 계산을 방지합니다.

### 12.2 비동기 처리

Health 갱신은 비동기로 처리되어 블로킹을 방지합니다.

### 12.3 동시 요청 처리

동일한 Health 갱신 요청은 단일 Promise로 공유됩니다.
