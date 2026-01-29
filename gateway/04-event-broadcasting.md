# 이벤트 브로드캐스팅 시스템

**작성일**: 2026-01-28  
**모듈**: `src/gateway/server-broadcast.ts`, `src/gateway/server-chat.ts`

## 1. 개요

Gateway는 실시간 이벤트 브로드캐스팅 시스템을 통해 모든 연결된 클라이언트에 이벤트를 전송합니다. 이벤트는 순차 번호를 가지며, 상태 버전 정보를 포함하여 클라이언트가 상태 동기화를 최적화할 수 있도록 합니다.

## 2. 브로드캐스터 생성

### 2.1 브로드캐스터 함수 생성

```typescript
const { broadcast } = createGatewayBroadcaster({ clients });
```

`createGatewayBroadcaster()` 함수는 클라이언트 세트를 받아 브로드캐스터 함수를 생성합니다.

### 2.2 브로드캐스터 함수 시그니처

```typescript
broadcast(
  event: string,
  payload: unknown,
  opts?: {
    dropIfSlow?: boolean;
    stateVersion?: { presence?: number; health?: number };
  },
): void
```

**파라미터:**
- `event`: 이벤트 이름
- `payload`: 이벤트 페이로드
- `opts.dropIfSlow`: 느린 클라이언트에게 이벤트를 건너뛸지 여부
- `opts.stateVersion`: 상태 버전 정보 (presence, health)

## 3. 이벤트 전송 프로세스

### 3.1 이벤트 프레임 생성

```typescript
const eventSeq = ++seq;
const frame = JSON.stringify({
  type: "event",
  event,
  payload,
  seq: eventSeq,
  stateVersion: opts?.stateVersion,
});
```

각 이벤트는 순차 번호(`seq`)를 가지며, 상태 버전 정보를 포함할 수 있습니다.

### 3.2 클라이언트 필터링

```typescript
for (const c of params.clients) {
  if (!hasEventScope(c, event)) continue;
  // ...
}
```

클라이언트의 스코프에 따라 이벤트를 필터링합니다.

### 3.3 느린 클라이언트 처리

```typescript
const slow = c.socket.bufferedAmount > MAX_BUFFERED_BYTES;
if (slow && opts?.dropIfSlow) continue;
if (slow) {
  try {
    c.socket.close(1008, "slow consumer");
  } catch {
    /* ignore */
  }
  continue;
}
```

버퍼 크기가 `MAX_BUFFERED_BYTES` (1.5MB)를 초과하면:
- `dropIfSlow` 옵션이 있으면 이벤트 건너뛰기
- 그렇지 않으면 연결 종료

### 3.4 이벤트 전송

```typescript
try {
  c.socket.send(frame);
} catch {
  /* ignore */
}
```

각 클라이언트의 WebSocket 소켓에 이벤트를 전송합니다.

## 4. 이벤트 스코프 필터링

### 4.1 스코프 가드

특정 이벤트는 특정 스코프가 있는 클라이언트에게만 전송됩니다:

```typescript
const EVENT_SCOPE_GUARDS: Record<string, string[]> = {
  "exec.approval.requested": [APPROVALS_SCOPE],
  "exec.approval.resolved": [APPROVALS_SCOPE],
  "device.pair.requested": [PAIRING_SCOPE],
  "device.pair.resolved": [PAIRING_SCOPE],
  "node.pair.requested": [PAIRING_SCOPE],
  "node.pair.resolved": [PAIRING_SCOPE],
};
```

### 4.2 스코프 확인

```typescript
function hasEventScope(client: GatewayWsClient, event: string): boolean {
  const required = EVENT_SCOPE_GUARDS[event];
  if (!required) return true;
  const role = client.connect.role ?? "operator";
  if (role !== "operator") return false;
  const scopes = Array.isArray(client.connect.scopes) ? client.connect.scopes : [];
  if (scopes.includes(ADMIN_SCOPE)) return true;
  return required.some((scope) => scopes.includes(scope));
}
```

- 관리자 스코프(`operator.admin`)가 있으면 모든 이벤트 수신
- 그렇지 않으면 필요한 스코프 중 하나가 있어야 함

## 5. 이벤트 타입

### 5.1 시스템 이벤트

**connect.challenge**
- 연결 핸드셰이크 시작
- 페이로드: `{ nonce: string, ts: number }`

**presence**
- 프레즌스 변경
- 페이로드: `{ presence: PresenceEntry[] }`
- 상태 버전 포함

**tick**
- Keepalive 이벤트 (30초마다)
- 페이로드: `{ ts: number }`
- `dropIfSlow: true`

**shutdown**
- 서버 종료
- 페이로드: `{ reason: string, restartExpectedMs?: number | null }`

**health**
- Health 스냅샷 업데이트
- 페이로드: `HealthSummary`
- 상태 버전 포함

**heartbeat**
- Heartbeat 이벤트
- 페이로드: `HeartbeatEvent`
- `dropIfSlow: true`

### 5.2 에이전트 이벤트

**agent**
- 에이전트 실행 이벤트
- 페이로드: `AgentEventPayload`
- 상태: `started`, `delta`, `finished`, `error`, `aborted`

**chat**
- 채팅 이벤트
- 페이로드: `ChatEventPayload`
- 상태: `delta`, `finished`, `error`, `aborted`

### 5.3 크론 이벤트

**cron**
- 크론 작업 이벤트
- 페이로드: `CronEvent`
- 액션: `started`, `finished`, `error`
- `dropIfSlow: true`

### 5.4 페어링 이벤트

**node.pair.requested**
- 노드 페어링 요청
- 스코프: `operator.pairing`

**node.pair.resolved**
- 노드 페어링 해결
- 스코프: `operator.pairing`

**device.pair.requested**
- 디바이스 페어링 요청
- 스코프: `operator.pairing`

**device.pair.resolved**
- 디바이스 페어링 해결
- 스코프: `operator.pairing`

### 5.5 승인 이벤트

**exec.approval.requested**
- Exec 승인 요청
- 스코프: `operator.approvals`

**exec.approval.resolved**
- Exec 승인 해결
- 스코프: `operator.approvals`

### 5.6 기타 이벤트

**talk.mode**
- Talk 모드 변경
- 페이로드: `{ mode: string }`

**voicewake.changed**
- Voice wake 트리거 변경
- 페이로드: `{ triggers: string[] }`
- `dropIfSlow: true`

## 6. 에이전트 이벤트 처리

### 6.1 에이전트 이벤트 핸들러

`createAgentEventHandler()` 함수는 에이전트 이벤트를 처리하여 채팅 이벤트로 변환합니다.

```typescript
export function createAgentEventHandler({
  broadcast,
  nodeSendToSession,
  agentRunSeq,
  chatRunState,
  resolveSessionKeyForRun,
  clearAgentRunContext,
}: AgentEventHandlerOptions) {
  // ...
}
```

### 6.2 채팅 델타 전송

```typescript
const emitChatDelta = (sessionKey: string, clientRunId: string, seq: number, text: string) => {
  chatRunState.buffers.set(clientRunId, text);
  const now = Date.now();
  const last = chatRunState.deltaSentAt.get(clientRunId) ?? 0;
  if (now - last < 150) return; // 150ms 디바운스
  chatRunState.deltaSentAt.set(clientRunId, now);
  
  const payload = {
    runId: clientRunId,
    sessionKey,
    seq,
    state: "delta" as const,
    message: {
      role: "assistant",
      content: [{ type: "text", text }],
      timestamp: now,
    },
  };
  
  broadcast("chat", payload, { dropIfSlow: true });
  nodeSendToSession(sessionKey, "chat", payload);
};
```

델타 이벤트는 150ms 디바운스를 사용하여 너무 빈번한 전송을 방지합니다.

### 6.3 채팅 완료 전송

```typescript
const emitChatFinished = (sessionKey: string, clientRunId: string, seq: number, text: string) => {
  chatRunState.buffers.set(clientRunId, text);
  chatRunState.deltaSentAt.delete(clientRunId);
  
  const payload = {
    runId: clientRunId,
    sessionKey,
    seq,
    state: "finished" as const,
    message: {
      role: "assistant",
      content: [{ type: "text", text }],
      timestamp: Date.now(),
    },
  };
  
  broadcast("chat", payload, { dropIfSlow: true });
  nodeSendToSession(sessionKey, "chat", payload);
  removeChatRun(sessionKey, clientRunId, sessionKey);
};
```

### 6.4 Heartbeat 브로드캐스트 억제

```typescript
function shouldSuppressHeartbeatBroadcast(runId: string): boolean {
  const runContext = getAgentRunContext(runId);
  if (!runContext?.isHeartbeat) return false;
  
  try {
    const cfg = loadConfig();
    const visibility = resolveHeartbeatVisibility({ cfg, channel: "webchat" });
    return !visibility.showOk;
  } catch {
    return true;
  }
}
```

설정에 따라 Heartbeat 실행의 브로드캐스트를 억제할 수 있습니다.

## 7. 상태 버전 관리

### 7.1 상태 버전

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

### 7.2 상태 버전 증가

- **Presence 버전**: 연결/해제 시 증가 (`incrementPresenceVersion()`)
- **Health 버전**: Health 스냅샷 갱신 시 증가 (`getHealthVersion()`)

## 8. 성능 최적화

### 8.1 느린 클라이언트 감지

버퍼 크기를 모니터링하여 느린 클라이언트를 감지합니다:

```typescript
const slow = c.socket.bufferedAmount > MAX_BUFFERED_BYTES;
```

### 8.2 이벤트 건너뛰기

`dropIfSlow` 옵션을 사용하여 중요하지 않은 이벤트를 느린 클라이언트에게 건너뛸 수 있습니다:

```typescript
broadcast("tick", payload, { dropIfSlow: true });
```

### 8.3 디바운싱

채팅 델타 이벤트는 150ms 디바운스를 사용하여 너무 빈번한 전송을 방지합니다.

## 9. 로깅

이벤트 브로드캐스팅은 `logWs()` 함수를 통해 로깅됩니다:

```typescript
logWs("out", "event", {
  event,
  seq: eventSeq,
  clients: params.clients.size,
  dropIfSlow: opts?.dropIfSlow,
  presenceVersion: opts?.stateVersion?.presence,
  healthVersion: opts?.stateVersion?.health,
});
```

에이전트 이벤트의 경우 추가 메타데이터가 포함됩니다:

```typescript
if (event === "agent") {
  Object.assign(logMeta, summarizeAgentEventForWsLog(payload));
}
```

## 10. 노드 이벤트 전송

노드에 이벤트를 전송하는 별도의 메커니즘이 있습니다:

```typescript
nodeSendToSession(sessionKey: string, event: string, payload: unknown): void
nodeSendToAllSubscribed(event: string, payload: unknown): void
```

이 함수들은 노드 구독 시스템을 통해 특정 세션 또는 모든 구독 노드에 이벤트를 전송합니다.
