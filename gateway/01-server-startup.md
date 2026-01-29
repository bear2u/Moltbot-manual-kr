# Gateway 서버 시작 및 초기화

**작성일**: 2026-01-28  
**모듈**: `src/gateway/server.impl.ts`, `src/gateway/server-runtime-config.ts`, `src/gateway/server-startup.ts`

## 1. 개요

Gateway 서버는 `startGatewayServer()` 함수를 통해 시작됩니다. 이 함수는 복잡한 초기화 프로세스를 거쳐 HTTP 서버, WebSocket 서버, 채널 관리자, 크론 서비스 등을 설정하고 시작합니다.

## 2. 시작 프로세스

### 2.1 초기화 단계

```typescript
export async function startGatewayServer(
  port = 18789,
  opts: GatewayServerOptions = {},
): Promise<GatewayServer>
```

#### 단계 1: 환경 설정
- `CLAWDBOT_GATEWAY_PORT` 환경변수 설정
- 환경변수 옵션 로깅 (`CLAWDBOT_RAW_STREAM`, `CLAWDBOT_RAW_STREAM_PATH`)

#### 단계 2: 설정 파일 로드 및 검증
```typescript
let configSnapshot = await readConfigFileSnapshot();
```

- 설정 파일 읽기
- 레거시 설정 마이그레이션
- 설정 스키마 검증
- 플러그인 자동 활성화

#### 단계 3: 기본 설정 준비
- 진단 모드 확인 및 시작
- SIGUSR1 재시작 정책 설정
- 서브에이전트 레지스트리 초기화
- 기본 에이전트 ID 확인
- 에이전트 워크스페이스 디렉토리 확인

#### 단계 4: 플러그인 로딩
```typescript
const { pluginRegistry, gatewayMethods: baseGatewayMethods } = loadGatewayPlugins({
  cfg: cfgAtStart,
  workspaceDir: defaultWorkspaceDir,
  log,
  coreGatewayHandlers,
  baseMethods,
});
```

- Gateway 플러그인 로드
- 채널 플러그인 로드
- Gateway 메서드 목록 생성

#### 단계 5: 런타임 설정 해결
```typescript
const runtimeConfig = await resolveGatewayRuntimeConfig({
  cfg: cfgAtStart,
  port,
  bind: opts.bind,
  host: opts.host,
  controlUiEnabled: opts.controlUiEnabled,
  openAiChatCompletionsEnabled: opts.openAiChatCompletionsEnabled,
  openResponsesEnabled: opts.openResponsesEnabled,
  auth: opts.auth,
  tailscale: opts.tailscale,
});
```

**해결되는 설정들:**
- 바인딩 호스트 (`bindHost`)
- Control UI 활성화 여부
- OpenAI 호환 API 활성화 여부
- OpenResponses API 활성화 여부
- 인증 설정 (`resolvedAuth`)
- Tailscale 설정 (`tailscaleConfig`, `tailscaleMode`)
- Hooks 설정 (`hooksConfig`)
- Canvas Host 활성화 여부

#### 단계 6: 런타임 상태 생성
```typescript
const {
  canvasHost,
  httpServer,
  httpServers,
  httpBindHosts,
  wss,
  clients,
  broadcast,
  agentRunSeq,
  dedupe,
  chatRunState,
  chatRunBuffers,
  chatDeltaSentAt,
  addChatRun,
  removeChatRun,
  chatAbortControllers,
} = await createGatewayRuntimeState({...});
```

**생성되는 리소스들:**
- Canvas Host 핸들러 (선택적)
- HTTP 서버 인스턴스들
- WebSocket 서버 (`wss`)
- 클라이언트 세트 (`clients`)
- 브로드캐스터 함수 (`broadcast`)
- 에이전트 실행 시퀀스 맵
- 중복 제거 맵 (`dedupe`)
- 채팅 실행 상태 (`chatRunState`)

#### 단계 7: 서비스 초기화

**노드 레지스트리**
```typescript
const nodeRegistry = new NodeRegistry();
const nodeSubscriptions = createNodeSubscriptionManager();
```

**크론 서비스**
```typescript
let cronState = buildGatewayCronService({
  cfg: cfgAtStart,
  deps,
  broadcast,
});
```

**채널 관리자**
```typescript
const channelManager = createChannelManager({
  loadConfig,
  channelLogs,
  channelRuntimeEnvs,
});
```

**디스커버리 서비스**
```typescript
const discovery = await startGatewayDiscovery({
  machineDisplayName,
  port,
  gatewayTls,
  wideAreaDiscoveryEnabled,
  tailscaleMode,
  mdnsMode,
  logDiscovery,
});
```

#### 단계 8: 유지보수 타이머 시작
```typescript
const { tickInterval, healthInterval, dedupeCleanup } = startGatewayMaintenanceTimers({
  broadcast,
  nodeSendToAllSubscribed,
  getPresenceVersion,
  getHealthVersion,
  refreshGatewayHealthSnapshot,
  logHealth,
  dedupe,
  chatAbortControllers,
  chatRunState,
  chatRunBuffers,
  chatDeltaSentAt,
  removeChatRun,
  agentRunSeq,
  nodeSendToSession,
});
```

**타이머들:**
- **Tick 이벤트**: 30초마다 keepalive 이벤트 브로드캐스트
- **Health 갱신**: 60초마다 Health 스냅샷 갱신
- **Dedupe 정리**: 60초마다 중복 제거 캐시 정리 및 만료된 채팅 중단 컨트롤러 제거

#### 단계 9: 이벤트 핸들러 등록
```typescript
const agentUnsub = onAgentEvent(
  createAgentEventHandler({
    broadcast,
    nodeSendToSession,
    agentRunSeq,
    chatRunState,
    resolveSessionKeyForRun,
    clearAgentRunContext,
  }),
);

const heartbeatUnsub = onHeartbeatEvent((evt) => {
  broadcast("heartbeat", evt, { dropIfSlow: true });
});
```

#### 단계 10: WebSocket 핸들러 연결
```typescript
attachGatewayWsHandlers({
  wss,
  clients,
  port,
  gatewayHost: bindHost ?? undefined,
  canvasHostEnabled: Boolean(canvasHost),
  canvasHostServerPort,
  resolvedAuth,
  gatewayMethods,
  events: GATEWAY_EVENTS,
  logGateway: log,
  logHealth,
  logWsControl,
  extraHandlers: {
    ...pluginRegistry.gatewayHandlers,
    ...execApprovalHandlers,
  },
  broadcast,
  context: {...},
});
```

#### 단계 11: 사이드카 서비스 시작
```typescript
({ browserControl, pluginServices } = await startGatewaySidecars({
  cfg: cfgAtStart,
  pluginRegistry,
  defaultWorkspaceDir,
  deps,
  startChannels,
  log,
  logHooks,
  logChannels,
  logBrowser,
}));
```

**사이드카 서비스들:**
- 브라우저 제어 서버
- Gmail 워처
- 내부 Hooks 로더
- 플러그인 서비스
- 채널 시작

#### 단계 12: 설정 리로더 시작
```typescript
const configReloader = startGatewayConfigReloader({
  initialConfig: cfgAtStart,
  readSnapshot: readConfigFileSnapshot,
  onHotReload: applyHotReload,
  onRestart: requestGatewayRestart,
  log: {...},
  watchPath: CONFIG_PATH,
});
```

## 3. 런타임 설정 해결

`resolveGatewayRuntimeConfig()` 함수는 설정 파일과 CLI 옵션을 결합하여 최종 런타임 설정을 생성합니다.

### 3.1 바인딩 호스트 해결

```typescript
const bindMode = params.bind ?? params.cfg.gateway?.bind ?? "loopback";
const bindHost = params.host ?? (await resolveGatewayBindHost(bindMode, customBindHost));
```

**바인딩 모드:**
- `loopback`: `127.0.0.1`
- `lan`: `0.0.0.0`
- `tailnet`: Tailscale IPv4 주소
- `auto`: loopback 우선, 실패 시 LAN

### 3.2 인증 설정 해결

```typescript
const resolvedAuth = resolveGatewayAuth({
  authConfig,
  env: process.env,
  tailscaleMode,
});
```

**인증 모드:**
- `token`: 토큰 기반 인증
- `password`: 비밀번호 기반 인증

**인증 소스 우선순위:**
1. CLI 옵션 (`opts.auth`)
2. 설정 파일 (`gateway.auth`)
3. 환경변수 (`CLAWDBOT_GATEWAY_TOKEN`, `CLAWDBOT_GATEWAY_PASSWORD`)

### 3.3 보안 검증

```typescript
assertGatewayAuthConfigured(resolvedAuth);
if (tailscaleMode === "funnel" && authMode !== "password") {
  throw new Error("tailscale funnel requires gateway auth mode=password");
}
if (tailscaleMode !== "off" && !isLoopbackHost(bindHost)) {
  throw new Error("tailscale serve/funnel requires gateway bind=loopback");
}
if (!isLoopbackHost(bindHost) && !hasSharedSecret) {
  throw new Error("refusing to bind gateway without auth");
}
```

## 4. 런타임 상태 생성

`createGatewayRuntimeState()` 함수는 Gateway의 핵심 리소스들을 생성합니다.

### 4.1 Canvas Host 생성

```typescript
if (params.canvasHostEnabled) {
  const handler = await createCanvasHostHandler({
    runtime: params.canvasRuntime,
    rootDir: params.cfg.canvasHost?.root,
    basePath: CANVAS_HOST_PATH,
    allowInTests: params.allowCanvasHostInTests,
    liveReload: params.cfg.canvasHost?.liveReload,
  });
  if (handler.rootDir) {
    canvasHost = handler;
  }
}
```

### 4.2 HTTP 서버 생성

```typescript
const bindHosts = await resolveGatewayListenHosts(params.bindHost);
const httpServers: HttpServer[] = [];
for (const host of bindHosts) {
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
  await listenGatewayHttpServer({
    httpServer,
    bindHost: host,
    port: params.port,
  });
  httpServers.push(httpServer);
}
```

**HTTP 서버 기능:**
- Control UI 서빙
- Canvas Host 서빙
- OpenAI 호환 API (`/v1/chat/completions`)
- OpenResponses API (`/v1/responses`)
- Hooks 엔드포인트 (`/hooks/*`)
- Plugin HTTP 핸들러

### 4.3 WebSocket 서버 생성

```typescript
const wss = new WebSocketServer({
  noServer: true,
  maxPayload: MAX_PAYLOAD_BYTES,
});
for (const server of httpServers) {
  attachGatewayUpgradeHandler({ httpServer: server, wss, canvasHost });
}
```

### 4.4 브로드캐스터 생성

```typescript
const clients = new Set<GatewayWsClient>();
const { broadcast } = createGatewayBroadcaster({ clients });
```

### 4.5 채팅 실행 상태 생성

```typescript
const chatRunState = createChatRunState();
const chatRunRegistry = chatRunState.registry;
const chatRunBuffers = chatRunState.buffers;
const chatDeltaSentAt = chatRunState.deltaSentAt;
const addChatRun = chatRunRegistry.add;
const removeChatRun = chatRunRegistry.remove;
const chatAbortControllers = new Map<string, ChatAbortControllerEntry>();
```

## 5. 사이드카 서비스 시작

`startGatewaySidecars()` 함수는 Gateway와 함께 실행되는 추가 서비스들을 시작합니다.

### 5.1 브라우저 제어 서버

```typescript
let browserControl: Awaited<ReturnType<typeof startBrowserControlServerIfEnabled>> = null;
try {
  browserControl = await startBrowserControlServerIfEnabled();
} catch (err) {
  params.logBrowser.error(`server failed to start: ${String(err)}`);
}
```

### 5.2 Gmail 워처

```typescript
if (!isTruthyEnvValue(process.env.CLAWDBOT_SKIP_GMAIL_WATCHER)) {
  const gmailResult = await startGmailWatcher(params.cfg);
  if (gmailResult.started) {
    params.logHooks.info("gmail watcher started");
  }
}
```

### 5.3 내부 Hooks 로더

```typescript
clearInternalHooks();
const loadedCount = await loadInternalHooks(params.cfg, params.defaultWorkspaceDir);
if (loadedCount > 0) {
  params.logHooks.info(`loaded ${loadedCount} internal hook handler${loadedCount > 1 ? "s" : ""}`);
}
```

### 5.4 채널 시작

```typescript
const skipChannels =
  isTruthyEnvValue(process.env.CLAWDBOT_SKIP_CHANNELS) ||
  isTruthyEnvValue(process.env.CLAWDBOT_SKIP_PROVIDERS);
if (!skipChannels) {
  await params.startChannels();
}
```

### 5.5 플러그인 서비스

```typescript
let pluginServices: PluginServicesHandle | null = null;
try {
  pluginServices = await startPluginServices({
    registry: params.pluginRegistry,
    config: params.cfg,
    workspaceDir: params.defaultWorkspaceDir,
  });
} catch (err) {
  params.log.warn(`plugin services failed to start: ${String(err)}`);
}
```

## 6. 시작 로깅

`logGatewayStartup()` 함수는 Gateway 시작 정보를 로깅합니다:

- 바인딩 호스트 및 포트
- TLS 활성화 여부
- Nix 모드 여부
- 접근 URL

## 7. 종료 처리

`createGatewayCloseHandler()` 함수는 Gateway 종료 시 정리 작업을 수행합니다:

1. Bonjour 서비스 중지
2. Tailscale 노출 해제
3. Canvas Host 종료
4. 채널 중지
5. 플러그인 서비스 중지
6. Gmail 워처 중지
7. 크론 서비스 중지
8. Heartbeat 러너 중지
9. 노드 프레즌스 타이머 정리
10. Shutdown 이벤트 브로드캐스트
11. 유지보수 타이머 정리
12. 이벤트 구독 해제
13. 채팅 실행 상태 정리
14. 클라이언트 연결 종료
15. 설정 리로더 중지
16. 브라우저 제어 서버 중지
17. WebSocket 서버 종료
18. HTTP 서버 종료

## 8. 에러 처리

시작 과정에서 발생할 수 있는 주요 에러들:

1. **레거시 설정 감지**: 자동 마이그레이션 시도, 실패 시 에러
2. **설정 검증 실패**: 스키마 검증 실패 시 에러
3. **인증 설정 누락**: 필수 인증 설정이 없을 때 에러
4. **Tailscale 설정 오류**: Funnel 모드에서 비밀번호 인증이 없을 때 에러
5. **바인딩 실패**: 포트가 이미 사용 중이거나 권한이 없을 때 에러
6. **TLS 설정 오류**: TLS 활성화 실패 시 에러

모든 에러는 적절한 로그 메시지와 함께 처리되며, 사용자에게 명확한 오류 메시지를 제공합니다.
