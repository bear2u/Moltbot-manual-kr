# 노드 관리 및 페어링

**작성일**: 2026-01-28  
**모듈**: `src/gateway/node-registry.ts`, `src/gateway/server-methods/nodes.ts`, `src/gateway/server-node-subscriptions.ts`

## 1. 개요

Gateway는 외부 노드(모바일 앱, 브라우저 확장 등)를 등록하고 관리하는 시스템을 제공합니다. 노드는 페어링을 통해 인증되며, Gateway에 명령을 실행하거나 이벤트를 구독할 수 있습니다.

## 2. 노드 레지스트리

### 2.1 노드 세션 구조

```typescript
export type NodeSession = {
  nodeId: string;
  connId: string;
  client: GatewayWsClient;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  remoteIp?: string;
  caps: string[];
  commands: string[];
  permissions?: Record<string, boolean>;
  pathEnv?: string;
  connectedAtMs: number;
};
```

**필드 설명:**
- `nodeId`: 노드 고유 ID (디바이스 ID 또는 클라이언트 ID)
- `connId`: WebSocket 연결 ID
- `client`: WebSocket 클라이언트 객체
- `displayName`: 노드 표시 이름
- `platform`: 플랫폼 정보 (iOS, Android, macOS 등)
- `version`: 노드 버전
- `caps`: 노드 기능 목록
- `commands`: 노드 명령 목록
- `permissions`: 노드 권한 맵
- `pathEnv`: PATH 환경변수
- `connectedAtMs`: 연결 시각

### 2.2 노드 등록

```typescript
register(client: GatewayWsClient, opts: { remoteIp?: string | undefined }) {
  const connect = client.connect;
  const nodeId = connect.device?.id ?? connect.client.id;
  const caps = Array.isArray(connect.caps) ? connect.caps : [];
  const commands = Array.isArray(connect.commands) ? connect.commands : [];
  const permissions = typeof connect.permissions === "object" ? connect.permissions : undefined;
  const pathEnv = typeof connect.pathEnv === "string" ? connect.pathEnv : undefined;
  
  const session: NodeSession = {
    nodeId,
    connId: client.connId,
    client,
    displayName: connect.client.displayName,
    platform: connect.client.platform,
    version: connect.client.version,
    coreVersion: connect.coreVersion,
    uiVersion: connect.uiVersion,
    deviceFamily: connect.client.deviceFamily,
    modelIdentifier: connect.client.modelIdentifier,
    remoteIp: opts.remoteIp,
    caps,
    commands,
    permissions,
    pathEnv,
    connectedAtMs: Date.now(),
  };
  
  this.nodesById.set(nodeId, session);
  this.nodesByConn.set(client.connId, nodeId);
  return session;
}
```

### 2.3 노드 해제

```typescript
unregister(connId: string): string | null {
  const nodeId = this.nodesByConn.get(connId);
  if (!nodeId) return null;
  
  this.nodesByConn.delete(connId);
  this.nodesById.delete(nodeId);
  
  // 보류 중인 invoke 요청 취소
  for (const [id, pending] of this.pendingInvokes.entries()) {
    if (pending.nodeId !== nodeId) continue;
    clearTimeout(pending.timer);
    pending.reject(new Error(`node disconnected (${pending.command})`));
    this.pendingInvokes.delete(id);
  }
  
  return nodeId;
}
```

## 3. 노드 명령 실행

### 3.1 Invoke 요청

```typescript
async invoke(params: {
  nodeId: string;
  command: string;
  params?: unknown;
  timeoutMs?: number;
  idempotencyKey?: string;
}): Promise<NodeInvokeResult>
```

**파라미터:**
- `nodeId`: 대상 노드 ID
- `command`: 실행할 명령 이름
- `params`: 명령 파라미터
- `timeoutMs`: 타임아웃 (기본값: 30초)
- `idempotencyKey`: 멱등성 키

**반환값:**
```typescript
export type NodeInvokeResult = {
  ok: boolean;
  payload?: unknown;
  payloadJSON?: string | null;
  error?: { code?: string; message?: string } | null;
};
```

### 3.2 Invoke 프로세스

1. **노드 확인**
```typescript
const node = this.nodesById.get(params.nodeId);
if (!node) {
  return {
    ok: false,
    error: { code: "NOT_CONNECTED", message: "node not connected" },
  };
}
```

2. **요청 전송**
```typescript
const requestId = randomUUID();
const payload = {
  id: requestId,
  nodeId: params.nodeId,
  command: params.command,
  paramsJSON: params.params !== undefined ? JSON.stringify(params.params) : null,
  timeoutMs: params.timeoutMs,
  idempotencyKey: params.idempotencyKey,
};

const ok = this.sendEventToSession(node, "node.invoke.request", payload);
if (!ok) {
  return {
    ok: false,
    error: { code: "UNAVAILABLE", message: "failed to send invoke to node" },
  };
}
```

3. **응답 대기**
```typescript
const timeoutMs = typeof params.timeoutMs === "number" ? params.timeoutMs : 30_000;
return await new Promise<NodeInvokeResult>((resolve, reject) => {
  const timer = setTimeout(() => {
    this.pendingInvokes.delete(requestId);
    resolve({
      ok: false,
      error: { code: "TIMEOUT", message: "node invoke timed out" },
    });
  }, timeoutMs);
  
  this.pendingInvokes.set(requestId, {
    nodeId: params.nodeId,
    command: params.command,
    resolve,
    reject,
    timer,
  });
});
```

### 3.3 Invoke 결과 처리

노드가 `node.invoke.result` 이벤트를 전송하면:

```typescript
handleInvokeResult(params: NodeInvokeResultParams) {
  const pending = this.pendingInvokes.get(params.id);
  if (!pending) return;
  
  clearTimeout(pending.timer);
  this.pendingInvokes.delete(params.id);
  
  pending.resolve({
    ok: params.ok,
    payload: params.payload,
    payloadJSON: params.payloadJSON,
    error: params.error,
  });
}
```

## 4. 노드 이벤트

### 4.1 노드 이벤트 전송

노드는 `node.event` 메서드를 통해 Gateway에 이벤트를 전송할 수 있습니다:

```typescript
{
  type: "request",
  method: "node.event",
  params: {
    event: string;
    payloadJSON?: string | null;
  },
  id: string
}
```

### 4.2 노드 이벤트 처리

```typescript
const nodeSendEvent = (opts: { nodeId: string; event: string; payloadJSON?: string | null }) => {
  const payload = safeParseJson(opts.payloadJSON ?? null);
  nodeRegistry.sendEvent(opts.nodeId, opts.event, payload);
};
```

## 5. 노드 구독 시스템

### 5.1 구독 관리

노드는 특정 세션의 이벤트를 구독할 수 있습니다:

```typescript
nodeSubscribe(nodeId: string, sessionKey: string): void
nodeUnsubscribe(nodeId: string, sessionKey: string): void
nodeUnsubscribeAll(nodeId: string): void
```

### 5.2 세션별 이벤트 전송

```typescript
nodeSendToSession(sessionKey: string, event: string, payload: unknown): void
```

이 함수는 특정 세션을 구독하는 모든 노드에 이벤트를 전송합니다.

### 5.3 전체 구독자에게 이벤트 전송

```typescript
nodeSendToAllSubscribed(event: string, payload: unknown): void
```

이 함수는 해당 이벤트를 구독하는 모든 노드에 이벤트를 전송합니다.

## 6. 노드 페어링

### 6.1 페어링 요청

노드는 `node.pair.request` 메서드를 통해 페어링을 요청할 수 있습니다:

```typescript
{
  type: "request",
  method: "node.pair.request",
  params: {
    displayName?: string;
    platform?: string;
    version?: string;
  },
  id: string
}
```

### 6.2 페어링 승인

관리자는 `node.pair.approve` 메서드를 통해 페어링을 승인할 수 있습니다:

```typescript
{
  type: "request",
  method: "node.pair.approve",
  params: {
    nodeId: string;
  },
  id: string
}
```

### 6.3 페어링 거부

관리자는 `node.pair.reject` 메서드를 통해 페어링을 거부할 수 있습니다:

```typescript
{
  type: "request",
  method: "node.pair.reject",
  params: {
    nodeId: string;
  },
  id: string
}
```

### 6.4 페어링 목록 조회

`node.pair.list` 메서드로 페어링 요청 목록을 조회할 수 있습니다:

```typescript
{
  type: "request",
  method: "node.pair.list",
  params: {},
  id: string
}
```

### 6.5 페어링 검증

`node.pair.verify` 메서드로 페어링 상태를 검증할 수 있습니다:

```typescript
{
  type: "request",
  method: "node.pair.verify",
  params: {
    nodeId: string;
  },
  id: string
}
```

## 7. 노드 메서드 핸들러

### 7.1 node.list

연결된 노드 목록을 조회합니다:

```typescript
"node.list": async ({ respond, context }) => {
  const nodes = context.nodeRegistry.listConnected();
  respond(true, {
    nodes: nodes.map((node) => ({
      nodeId: node.nodeId,
      displayName: node.displayName,
      platform: node.platform,
      version: node.version,
      connectedAtMs: node.connectedAtMs,
      caps: node.caps,
      commands: node.commands,
    })),
  });
}
```

### 7.2 node.describe

특정 노드의 상세 정보를 조회합니다:

```typescript
"node.describe": async ({ params, respond, context }) => {
  const nodeId = typeof params.nodeId === "string" ? params.nodeId : null;
  if (!nodeId) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing nodeId"));
    return;
  }
  
  const node = context.nodeRegistry.get(nodeId);
  if (!node) {
    respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, "node not found"));
    return;
  }
  
  respond(true, {
    nodeId: node.nodeId,
    displayName: node.displayName,
    platform: node.platform,
    version: node.version,
    coreVersion: node.coreVersion,
    uiVersion: node.uiVersion,
    deviceFamily: node.deviceFamily,
    modelIdentifier: node.modelIdentifier,
    remoteIp: node.remoteIp,
    caps: node.caps,
    commands: node.commands,
    permissions: node.permissions,
    pathEnv: node.pathEnv,
    connectedAtMs: node.connectedAtMs,
  });
}
```

### 7.3 node.invoke

노드 명령을 실행합니다:

```typescript
"node.invoke": async ({ params, respond, context }) => {
  const nodeId = typeof params.nodeId === "string" ? params.nodeId : null;
  const command = typeof params.command === "string" ? params.command : null;
  
  if (!nodeId || !command) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing nodeId or command"));
    return;
  }
  
  const result = await context.nodeRegistry.invoke({
    nodeId,
    command,
    params: params.params,
    timeoutMs: typeof params.timeoutMs === "number" ? params.timeoutMs : undefined,
    idempotencyKey: typeof params.idempotencyKey === "string" ? params.idempotencyKey : undefined,
  });
  
  respond(result.ok, result.payload, result.error);
}
```

### 7.4 node.invoke.result

노드가 invoke 결과를 전송합니다:

```typescript
"node.invoke.result": async ({ params, context }) => {
  const id = typeof params.id === "string" ? params.id : null;
  if (!id) return;
  
  context.nodeRegistry.handleInvokeResult({
    id,
    ok: typeof params.ok === "boolean" ? params.ok : false,
    payload: params.payload,
    payloadJSON: typeof params.payloadJSON === "string" ? params.payloadJSON : null,
    error: params.error,
  });
}
```

### 7.5 node.event

노드가 이벤트를 전송합니다:

```typescript
"node.event": async ({ params, client, context }) => {
  if (client?.connect?.role !== "node") {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unauthorized role"));
    return;
  }
  
  const nodeId = client.connect.device?.id ?? client.connect.client.id;
  const event = typeof params.event === "string" ? params.event : null;
  const payloadJSON = typeof params.payloadJSON === "string" ? params.payloadJSON : null;
  
  if (!event) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing event"));
    return;
  }
  
  context.nodeRegistry.sendEvent(nodeId, event, safeParseJson(payloadJSON));
  respond(true);
}
```

## 8. 노드 이벤트 브로드캐스팅

### 8.1 페어링 이벤트

노드 페어링 요청/해결 시 이벤트가 브로드캐스트됩니다:

```typescript
broadcast("node.pair.requested", {
  nodeId: request.nodeId,
  displayName: request.displayName,
  platform: request.platform,
  version: request.version,
  requestedAtMs: Date.now(),
}, {
  dropIfSlow: true,
});
```

### 8.2 Invoke 요청 이벤트

노드 invoke 요청 시 이벤트가 브로드캐스트됩니다:

```typescript
broadcast("node.invoke.request", {
  id: requestId,
  nodeId: params.nodeId,
  command: params.command,
  paramsJSON: params.paramsJSON,
}, {
  dropIfSlow: true,
});
```

## 9. 노드 권한 및 보안

### 9.1 노드 역할

노드는 `role: "node"`로 연결되며, 특정 메서드만 호출할 수 있습니다:

- `node.invoke.result`: Invoke 결과 전송
- `node.event`: 이벤트 전송
- `skills.bins`: Skills 바이너리 정보 전송

### 9.2 노드 페어링

노드는 페어링을 통해 인증되며, 페어링되지 않은 노드는 제한된 기능만 사용할 수 있습니다.

### 9.3 노드 명령 정책

`resolveNodeCommandAllowlist()` 함수를 통해 노드가 실행할 수 있는 명령을 제한할 수 있습니다.

## 10. 모바일 노드 감지

### 10.1 모바일 노드 확인

```typescript
function hasConnectedMobileNode(nodeRegistry: NodeRegistry): boolean {
  const nodes = nodeRegistry.listConnected();
  return nodes.some(
    (node) =>
      node.platform === "ios" ||
      node.platform === "android" ||
      node.deviceFamily === "iPhone" ||
      node.deviceFamily === "iPad" ||
      node.deviceFamily === "Android",
  );
}
```

### 10.2 모바일 노드 활용

모바일 노드가 연결되어 있으면 특정 기능을 활성화하거나 UI를 조정할 수 있습니다.
