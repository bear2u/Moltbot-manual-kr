# 메서드 핸들러 시스템

**작성일**: 2026-01-28  
**모듈**: `src/gateway/server-methods.ts`, `src/gateway/server-methods/*.ts`

## 1. 개요

Gateway는 RPC 스타일의 메서드 호출 시스템을 제공합니다. 클라이언트는 `request` 프레임을 통해 메서드를 호출하고, 서버는 `response` 프레임으로 결과를 반환합니다.

## 2. 메서드 핸들러 구조

### 2.1 핸들러 타입

```typescript
export type GatewayRequestHandler = (opts: GatewayRequestHandlerOptions) => Promise<void> | void;

export type GatewayRequestHandlers = Record<string, GatewayRequestHandler>;
```

각 핸들러는 메서드 이름을 키로 하는 객체에 등록됩니다.

### 2.2 핸들러 옵션

```typescript
export type GatewayRequestHandlerOptions = {
  req: RequestFrame;
  params: Record<string, unknown>;
  client: GatewayClient | null;
  isWebchatConnect: (params: ConnectParams | null | undefined) => boolean;
  respond: RespondFn;
  context: GatewayRequestContext;
};
```

**파라미터:**
- `req`: 요청 프레임
- `params`: 요청 파라미터 (파싱된 `req.params`)
- `client`: 클라이언트 객체 (인증된 경우)
- `isWebchatConnect`: WebChat 연결 여부 확인 함수
- `respond`: 응답 전송 함수
- `context`: Gateway 요청 컨텍스트

### 2.3 응답 함수

```typescript
export type RespondFn = (
  ok: boolean,
  payload?: unknown,
  error?: ErrorShape,
  meta?: Record<string, unknown>,
) => void;
```

**파라미터:**
- `ok`: 성공 여부
- `payload`: 성공 시 페이로드
- `error`: 실패 시 에러 정보
- `meta`: 추가 메타데이터

## 3. 메서드 라우팅

### 3.1 핸들러 찾기

```typescript
const handler = opts.extraHandlers?.[req.method] ?? coreGatewayHandlers[req.method];
if (!handler) {
  respond(
    false,
    undefined,
    errorShape(ErrorCodes.INVALID_REQUEST, `unknown method: ${req.method}`),
  );
  return;
}
```

핸들러는 다음 순서로 찾습니다:
1. `extraHandlers` (플러그인 핸들러)
2. `coreGatewayHandlers` (코어 핸들러)

### 3.2 권한 검사

```typescript
const authError = authorizeGatewayMethod(req.method, client);
if (authError) {
  respond(false, undefined, authError);
  return;
}
```

메서드 호출 전 권한을 검사합니다.

### 3.3 핸들러 실행

```typescript
await handler({
  req,
  params: (req.params ?? {}) as Record<string, unknown>,
  client,
  isWebchatConnect,
  respond,
  context,
});
```

## 4. 코어 핸들러

### 4.1 핸들러 그룹

코어 핸들러는 기능별로 그룹화되어 있습니다:

```typescript
export const coreGatewayHandlers: GatewayRequestHandlers = {
  ...connectHandlers,
  ...logsHandlers,
  ...voicewakeHandlers,
  ...healthHandlers,
  ...channelsHandlers,
  ...chatHandlers,
  ...cronHandlers,
  ...deviceHandlers,
  ...execApprovalsHandlers,
  ...webHandlers,
  ...modelsHandlers,
  ...configHandlers,
  ...wizardHandlers,
  ...talkHandlers,
  ...ttsHandlers,
  ...skillsHandlers,
  ...sessionsHandlers,
  ...systemHandlers,
  ...updateHandlers,
  ...nodeHandlers,
  ...sendHandlers,
  ...usageHandlers,
  ...agentHandlers,
  ...agentsHandlers,
  ...browserHandlers,
};
```

### 4.2 주요 핸들러 그룹

**connectHandlers** (`server-methods/connect.ts`)
- `connect`: 연결 핸들러 (실제로는 사용되지 않음, 연결은 WebSocket 핸드셰이크에서 처리)

**healthHandlers** (`server-methods/health.ts`)
- `health`: Health 스냅샷 조회

**channelsHandlers** (`server-methods/channels.ts`)
- `channels.status`: 채널 상태 조회
- `channels.logout`: 채널 로그아웃

**chatHandlers** (`server-methods/chat.ts`)
- `chat.history`: 채팅 히스토리 조회
- `chat.send`: 채팅 메시지 전송
- `chat.abort`: 채팅 중단

**cronHandlers** (`server-methods/cron.ts`)
- `cron.list`: 크론 작업 목록 조회
- `cron.status`: 크론 서비스 상태 조회
- `cron.add`: 크론 작업 추가
- `cron.update`: 크론 작업 업데이트
- `cron.remove`: 크론 작업 제거
- `cron.run`: 크론 작업 즉시 실행
- `cron.runs`: 크론 실행 로그 조회

**configHandlers** (`server-methods/config.ts`)
- `config.get`: 설정 조회
- `config.set`: 설정 설정
- `config.apply`: 설정 적용
- `config.patch`: 설정 패치
- `config.schema`: 설정 스키마 조회

**sessionsHandlers** (`server-methods/sessions.ts`)
- `sessions.list`: 세션 목록 조회
- `sessions.preview`: 세션 미리보기
- `sessions.patch`: 세션 패치
- `sessions.reset`: 세션 리셋
- `sessions.delete`: 세션 삭제
- `sessions.compact`: 세션 압축

**nodeHandlers** (`server-methods/nodes.ts`)
- `node.list`: 노드 목록 조회
- `node.describe`: 노드 상세 정보 조회
- `node.invoke`: 노드 명령 실행
- `node.pair.request`: 노드 페어링 요청
- `node.pair.list`: 노드 페어링 목록 조회
- `node.pair.approve`: 노드 페어링 승인
- `node.pair.reject`: 노드 페어링 거부
- `node.pair.verify`: 노드 페어링 검증
- `node.rename`: 노드 이름 변경

**agentHandlers** (`server-methods/agent.ts`)
- `agent`: 에이전트 실행
- `agent.wait`: 에이전트 실행 대기
- `agent.identity.get`: 에이전트 신원 조회

**agentsHandlers** (`server-methods/agents.ts`)
- `agents.list`: 에이전트 목록 조회

**sendHandlers** (`server-methods/send.ts`)
- `send`: 메시지 전송

**browserHandlers** (`server-methods/browser.ts`)
- `browser.request`: 브라우저 요청

## 5. 메서드 목록

### 5.1 기본 메서드

`listGatewayMethods()` 함수는 사용 가능한 모든 메서드를 반환합니다:

```typescript
export function listGatewayMethods(): string[] {
  const channelMethods = listChannelPlugins().flatMap((plugin) => plugin.gatewayMethods ?? []);
  return Array.from(new Set([...BASE_METHODS, ...channelMethods]));
}
```

### 5.2 기본 메서드 목록

- `health`
- `logs.tail`
- `channels.status`
- `channels.logout`
- `status`
- `usage.status`
- `usage.cost`
- `tts.status`
- `tts.providers`
- `tts.enable`
- `tts.disable`
- `tts.convert`
- `tts.setProvider`
- `config.get`
- `config.set`
- `config.apply`
- `config.patch`
- `config.schema`
- `exec.approvals.get`
- `exec.approvals.set`
- `exec.approvals.node.get`
- `exec.approvals.node.set`
- `exec.approval.request`
- `exec.approval.resolve`
- `wizard.start`
- `wizard.next`
- `wizard.cancel`
- `wizard.status`
- `talk.mode`
- `models.list`
- `agents.list`
- `skills.status`
- `skills.bins`
- `skills.install`
- `skills.update`
- `update.run`
- `voicewake.get`
- `voicewake.set`
- `sessions.list`
- `sessions.preview`
- `sessions.patch`
- `sessions.reset`
- `sessions.delete`
- `sessions.compact`
- `last-heartbeat`
- `set-heartbeats`
- `wake`
- `node.pair.request`
- `node.pair.list`
- `node.pair.approve`
- `node.pair.reject`
- `node.pair.verify`
- `device.pair.list`
- `device.pair.approve`
- `device.pair.reject`
- `device.token.rotate`
- `device.token.revoke`
- `node.rename`
- `node.list`
- `node.describe`
- `node.invoke`
- `node.invoke.result`
- `node.event`
- `cron.list`
- `cron.status`
- `cron.add`
- `cron.update`
- `cron.remove`
- `cron.run`
- `cron.runs`
- `system-presence`
- `system-event`
- `send`
- `agent`
- `agent.identity.get`
- `agent.wait`
- `browser.request`
- `chat.history`
- `chat.abort`
- `chat.send`

## 6. 요청 컨텍스트

### 6.1 컨텍스트 구조

```typescript
export type GatewayRequestContext = {
  deps: ReturnType<typeof createDefaultDeps>;
  cron: CronService;
  cronStorePath: string;
  loadGatewayModelCatalog: () => Promise<ModelCatalogEntry[]>;
  getHealthCache: () => HealthSummary | null;
  refreshHealthSnapshot: (opts?: { probe?: boolean }) => Promise<HealthSummary>;
  logHealth: { error: (message: string) => void };
  logGateway: SubsystemLogger;
  incrementPresenceVersion: () => number;
  getHealthVersion: () => number;
  broadcast: (event: string, payload: unknown, opts?: {...}) => void;
  nodeSendToSession: (sessionKey: string, event: string, payload: unknown) => void;
  nodeSendToAllSubscribed: (event: string, payload: unknown) => void;
  nodeSubscribe: (nodeId: string, sessionKey: string) => void;
  nodeUnsubscribe: (nodeId: string, sessionKey: string) => void;
  nodeUnsubscribeAll: (nodeId: string) => void;
  hasConnectedMobileNode: () => boolean;
  nodeRegistry: NodeRegistry;
  agentRunSeq: Map<string, number>;
  chatAbortControllers: Map<string, ChatAbortControllerEntry>;
  chatAbortedRuns: Map<string, number>;
  chatRunBuffers: Map<string, string>;
  chatDeltaSentAt: Map<string, number>;
  addChatRun: (sessionId: string, entry: {...}) => void;
  removeChatRun: (sessionId: string, clientRunId: string, sessionKey?: string) => {...} | undefined;
  dedupe: Map<string, DedupeEntry>;
  wizardSessions: Map<string, WizardSession>;
  findRunningWizard: () => string | null;
  purgeWizardSession: (id: string) => void;
  getRuntimeSnapshot: () => ChannelRuntimeSnapshot;
  startChannel: (channel: ChannelId, accountId?: string) => Promise<void>;
  stopChannel: (channel: ChannelId, accountId?: string) => Promise<void>;
  markChannelLoggedOut: (channelId: ChannelId, cleared: boolean, accountId?: string) => void;
  wizardRunner: (opts: OnboardOptions, runtime: RuntimeEnv, prompter: WizardPrompter) => Promise<void>;
  broadcastVoiceWakeChanged: (triggers: string[]) => void;
};
```

### 6.2 컨텍스트 사용

핸들러는 컨텍스트를 통해 Gateway의 다양한 기능에 접근할 수 있습니다:

```typescript
async function handler({ context, respond }: GatewayRequestHandlerOptions) {
  const snapshot = await context.refreshHealthSnapshot({ probe: true });
  respond(true, snapshot);
}
```

## 7. 에러 처리

### 7.1 에러 코드

`ErrorCodes` 열거형은 표준 에러 코드를 정의합니다:

- `INVALID_REQUEST`: 잘못된 요청
- `UNAUTHORIZED`: 인증 실패
- `NOT_FOUND`: 리소스를 찾을 수 없음
- `INTERNAL_ERROR`: 내부 에러

### 7.2 에러 응답 생성

```typescript
respond(
  false,
  undefined,
  errorShape(ErrorCodes.INVALID_REQUEST, "missing required parameter: id"),
);
```

`errorShape()` 함수는 표준 에러 형식을 생성합니다.

## 8. 중복 제거

### 8.1 중복 요청 감지

```typescript
const dedupeKey = `${client.connId}:${req.id}`;
const existing = dedupe.get(dedupeKey);
if (existing) {
  respond(existing.ok, existing.payload, existing.error);
  return;
}
```

동일한 연결에서 동일한 요청 ID로 중복 요청이 오면 캐시된 응답을 반환합니다.

### 8.2 중복 응답 캐싱

```typescript
dedupe.set(dedupeKey, {
  ts: Date.now(),
  ok: true,
  payload: result,
});
```

성공한 응답은 중복 제거 캐시에 저장됩니다.

## 9. 플러그인 확장

### 9.1 플러그인 핸들러 등록

플러그인은 `gatewayHandlers`를 통해 메서드를 추가할 수 있습니다:

```typescript
const { pluginRegistry, gatewayMethods: baseGatewayMethods } = loadGatewayPlugins({
  cfg: cfgAtStart,
  workspaceDir: defaultWorkspaceDir,
  log,
  coreGatewayHandlers,
  baseMethods,
});
```

### 9.2 채널 메서드

채널 플러그인은 `gatewayMethods`를 통해 메서드를 추가할 수 있습니다:

```typescript
const channelMethods = listChannelPlugins().flatMap((plugin) => plugin.gatewayMethods ?? []);
const gatewayMethods = Array.from(new Set([...baseGatewayMethods, ...channelMethods]));
```

## 10. 예시

### 10.1 간단한 핸들러

```typescript
export const healthHandlers: GatewayRequestHandlers = {
  health: async ({ respond, context }) => {
    const snapshot = await context.refreshHealthSnapshot({ probe: true });
    respond(true, snapshot);
  },
};
```

### 10.2 파라미터 검증이 있는 핸들러

```typescript
export const sessionsHandlers: GatewayRequestHandlers = {
  "sessions.list": async ({ params, respond, context }) => {
    const limit = typeof params.limit === "number" ? params.limit : 100;
    const sessions = await listSessions({ limit });
    respond(true, { sessions });
  },
};
```

### 10.3 권한 검사가 있는 핸들러

권한 검사는 `authorizeGatewayMethod()`에서 자동으로 수행되므로, 핸들러는 권한이 있는 요청만 받습니다.
