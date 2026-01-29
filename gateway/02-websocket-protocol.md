---
layout: default
title: Websocket Protocol
---

# WebSocket 프로토콜 및 연결 처리

**작성일**: 2026-01-28  
**모듈**: `src/gateway/server/ws-connection.ts`, `src/gateway/server/ws-connection/message-handler.ts`, `src/gateway/protocol/`

## 1. 개요

Gateway는 JSON 기반 WebSocket 프로토콜을 사용하여 클라이언트와 통신합니다. 프로토콜은 연결 핸드셰이크, 요청/응답, 이벤트 브로드캐스팅을 지원합니다.

## 2. 프로토콜 버전

현재 프로토콜 버전은 `PROTOCOL_VERSION` 상수로 정의되어 있습니다. 클라이언트는 `minProtocol`과 `maxProtocol`을 지정하여 호환성 범위를 제시할 수 있습니다.

## 3. 연결 프로세스

### 3.1 연결 시작

클라이언트가 WebSocket 연결을 시작하면:

1. **서버가 `connect.challenge` 이벤트 전송**
```typescript
const connectNonce = randomUUID();
send({
  type: "event",
  event: "connect.challenge",
  payload: { nonce: connectNonce, ts: Date.now() },
});
```

2. **핸드셰이크 타임아웃 설정**
- 기본 타임아웃: 10초 (`DEFAULT_HANDSHAKE_TIMEOUT_MS`)
- 타임아웃 내에 `connect` 요청이 없으면 연결 종료

3. **클라이언트가 `connect` 요청 전송**
```typescript
{
  type: "request",
  method: "connect",
  params: {
    token?: string;
    password?: string;
    client: {
      id: string;
      displayName?: string;
      version?: string;
      platform?: string;
    };
    role?: "operator" | "node";
    scopes?: string[];
    // ...
  },
  id: string
}
```

### 3.2 인증 처리

`connect` 요청을 받으면:

1. **요청 파라미터 검증**
```typescript
const validation = validateConnectParams(params);
if (!validation) {
  const errors = formatValidationErrors(validateConnectParams.errors ?? []);
  respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, errors));
  return;
}
```

2. **인증 수행**
```typescript
const authResult = await authorizeGatewayConnect({
  auth: resolvedAuth,
  connectAuth: {
    token: params.token,
    password: params.password,
  },
  req: upgradeReq,
  trustedProxies,
  tailscaleWhois,
});
```

3. **디바이스 인증 (노드 역할인 경우)**
```typescript
if (params.role === "node") {
  const deviceAuth = await verifyDeviceAuth({
    params,
    connectNonce,
    deviceIdentity: clientDeviceIdentity,
  });
  if (!deviceAuth.ok) {
    respond(false, undefined, errorShape(ErrorCodes.UNAUTHORIZED, deviceAuth.reason));
    return;
  }
}
```

### 3.3 연결 완료

인증이 성공하면:

1. **클라이언트 객체 생성**
```typescript
const client: GatewayWsClient = {
  socket,
  connId,
  connect: params,
  presenceKey: params.client?.id,
  openedAt,
  remoteAddr: clientIp,
};
```

2. **클라이언트 세트에 추가**
```typescript
clients.add(client);
```

3. **Hello 응답 전송**
```typescript
const helloOk: HelloOk = {
  protocol: PROTOCOL_VERSION,
  methods: gatewayMethods,
  events: events,
  canvasHostUrl: canvasHostUrl ?? null,
  snapshot: await buildGatewaySnapshot({...}),
};
respond(true, helloOk);
```

4. **노드 등록 (노드 역할인 경우)**
```typescript
if (client.connect.role === "node") {
  const nodeSession = nodeRegistry.register(client, { remoteIp: clientIp });
  // ...
}
```

5. **프레즌스 업데이트**
```typescript
if (client.presenceKey) {
  upsertPresence(client.presenceKey, {
    reason: "connect",
    client: client.connect.client,
    role: client.connect.role,
  });
  incrementPresenceVersion();
  broadcast("presence", { presence: listSystemPresence() }, {...});
}
```

## 4. 메시지 처리

### 4.1 메시지 수신

WebSocket 메시지를 받으면:

```typescript
socket.on("message", (data) => {
  const text = rawDataToString(data);
  handleMessage(text);
});
```

### 4.2 메시지 파싱 및 검증

```typescript
function handleMessage(text: string) {
  let frame: GatewayFrame;
  try {
    frame = JSON.parse(text);
  } catch {
    close(1008, "invalid json");
    return;
  }
  
  const validation = validateGatewayFrame(frame);
  if (!validation) {
    close(1008, "invalid frame");
    return;
  }
  
  if (frame.type === "request") {
    handleRequest(frame);
  } else if (frame.type === "connect") {
    handleConnect(frame);
  }
}
```

### 4.3 요청 처리

```typescript
async function handleRequest(req: RequestFrame) {
  setLastFrameMeta({ type: "request", method: req.method, id: req.id });
  
  await handleGatewayRequest({
    req,
    respond: (ok, payload, error, meta) => {
      send({
        type: "response",
        id: req.id,
        ok,
        payload,
        error,
        ...meta,
      });
    },
    client: getClient(),
    isWebchatConnect,
    context: buildRequestContext(),
    extraHandlers,
  });
}
```

## 5. 프레임 타입

### 5.1 Connect Frame

**클라이언트 → 서버**
```typescript
{
  type: "connect",
  params: ConnectParams;
  id: string;
}
```

**ConnectParams 구조:**
```typescript
{
  token?: string;
  password?: string;
  client: {
    id: string;
    displayName?: string;
    version?: string;
    platform?: string;
    deviceFamily?: string;
    modelIdentifier?: string;
  };
  role?: "operator" | "node";
  scopes?: string[];
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  device?: {
    id: string;
    publicKey: string;
    signature: string;
  };
  minProtocol?: number;
  maxProtocol?: number;
  pathEnv?: string;
}
```

### 5.2 Request Frame

**클라이언트 → 서버**
```typescript
{
  type: "request",
  method: string;
  params?: Record<string, unknown>;
  id: string;
}
```

**예시:**
```typescript
{
  type: "request",
  method: "channels.status",
  params: {},
  id: "req-123"
}
```

### 5.3 Response Frame

**서버 → 클라이언트**
```typescript
{
  type: "response",
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code: string;
    message: string;
  };
  meta?: Record<string, unknown>;
}
```

**성공 응답 예시:**
```typescript
{
  type: "response",
  id: "req-123",
  ok: true,
  payload: {
    channels: {...}
  }
}
```

**에러 응답 예시:**
```typescript
{
  type: "response",
  id: "req-123",
  ok: false,
  error: {
    code: "INVALID_REQUEST",
    message: "missing scope: operator.read"
  }
}
```

### 5.4 Event Frame

**서버 → 클라이언트**
```typescript
{
  type: "event",
  event: string;
  payload: unknown;
  seq: number;
  stateVersion?: {
    presence?: number;
    health?: number;
  };
}
```

**이벤트 타입들:**
- `connect.challenge`: 연결 챌린지
- `agent`: 에이전트 실행 이벤트
- `chat`: 채팅 이벤트
- `presence`: 프레즌스 변경
- `tick`: Keepalive
- `shutdown`: 서버 종료
- `health`: Health 업데이트
- `heartbeat`: Heartbeat 이벤트
- `cron`: 크론 작업 이벤트
- `node.pair.requested`: 노드 페어링 요청
- `node.pair.resolved`: 노드 페어링 해결
- `device.pair.requested`: 디바이스 페어링 요청
- `device.pair.resolved`: 디바이스 페어링 해결
- `exec.approval.requested`: Exec 승인 요청
- `exec.approval.resolved`: Exec 승인 해결
- `voicewake.changed`: Voice wake 트리거 변경

## 6. 연결 종료

### 6.1 종료 코드

Gateway는 표준 WebSocket 종료 코드를 사용합니다:

- `1000`: 정상 종료
- `1006`: 비정상 종료 (close frame 없음)
- `1008`: 정책 위반
- `1012`: 서비스 재시작

### 6.2 종료 처리

```typescript
socket.once("close", (code, reason) => {
  const durationMs = Date.now() - openedAt;
  
  if (client?.presenceKey) {
    upsertPresence(client.presenceKey, { reason: "disconnect" });
    incrementPresenceVersion();
    broadcast("presence", { presence: listSystemPresence() }, {...});
  }
  
  if (client?.connect?.role === "node") {
    const nodeId = nodeRegistry.unregister(connId);
    if (nodeId) {
      nodeUnsubscribeAll(nodeId);
    }
  }
  
  clients.delete(client);
});
```

## 7. 보안 고려사항

### 7.1 인증

- **토큰 인증**: `timingSafeEqual`을 사용한 안전한 토큰 비교
- **비밀번호 인증**: `timingSafeEqual`을 사용한 안전한 비밀번호 비교
- **Tailscale 인증**: Tailscale Serve/Funnel을 통한 자동 인증
- **디바이스 인증**: 공개키 기반 서명 검증

### 7.2 페이로드 제한

- 최대 페이로드 크기: `MAX_PAYLOAD_BYTES` (512KB)
- 최대 버퍼 크기: `MAX_BUFFERED_BYTES` (1.5MB)
- 느린 클라이언트 자동 차단

### 7.3 핸드셰이크 타임아웃

- 기본 타임아웃: 10초
- 타임아웃 내에 `connect` 요청이 없으면 연결 종료

### 7.4 중복 제거

요청 ID를 기반으로 중복 요청을 제거합니다:

```typescript
const dedupeKey = `${client.connId}:${req.id}`;
const existing = dedupe.get(dedupeKey);
if (existing) {
  respond(existing.ok, existing.payload, existing.error);
  return;
}
```

## 8. 에러 처리

### 8.1 검증 에러

프레임 검증 실패 시:
```typescript
close(1008, "invalid frame");
```

### 8.2 인증 에러

인증 실패 시:
```typescript
respond(false, undefined, errorShape(ErrorCodes.UNAUTHORIZED, "unauthorized"));
close(1008, "unauthorized");
```

### 8.3 메서드 에러

알 수 없는 메서드 호출 시:
```typescript
respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown method: ..."));
```

### 8.4 권한 에러

권한 부족 시:
```typescript
respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing scope: ..."));
```

## 9. 성능 최적화

### 9.1 느린 클라이언트 감지

버퍼 크기가 `MAX_BUFFERED_BYTES`를 초과하면:
- `dropIfSlow` 옵션이 있으면 이벤트 건너뛰기
- 그렇지 않으면 연결 종료

### 9.2 이벤트 스코프 필터링

클라이언트의 스코프에 따라 이벤트를 필터링합니다:

```typescript
function hasEventScope(client: GatewayWsClient, event: string): boolean {
  const required = EVENT_SCOPE_GUARDS[event];
  if (!required) return true;
  const scopes = client.connect.scopes ?? [];
  if (scopes.includes(ADMIN_SCOPE)) return true;
  return required.some((scope) => scopes.includes(scope));
}
```

### 9.3 상태 버전 관리

이벤트에 상태 버전을 포함하여 클라이언트가 상태 동기화를 최적화할 수 있도록 합니다:

```typescript
{
  type: "event",
  event: "presence",
  payload: {...},
  stateVersion: {
    presence: getPresenceVersion(),
    health: getHealthVersion(),
  },
}
```

## 10. 로깅

WebSocket 연결 및 메시지는 `logWs()` 함수를 통해 로깅됩니다:

- 연결 시작/종료
- 요청/응답
- 이벤트 전송
- 에러 발생

로그는 연결 ID, 원격 주소, 메서드, 이벤트 타입 등을 포함합니다.
