---
layout: default
title: Config Management
---

# 설정 관리 및 핫 리로드

**작성일**: 2026-01-28  
**모듈**: `src/gateway/config-reload.ts`, `src/gateway/server-reload-handlers.ts`, `src/gateway/server-methods/config.ts`

## 1. 개요

Gateway는 설정 파일을 감시하고 변경 사항을 자동으로 감지하여 핫 리로드하거나 재시작을 요청할 수 있습니다. 설정은 JSON 형식이며, 스키마 검증을 통해 유효성을 보장합니다.

## 2. 설정 리로더

### 2.1 리로더 시작

```typescript
const configReloader = startGatewayConfigReloader({
  initialConfig: cfgAtStart,
  readSnapshot: readConfigFileSnapshot,
  onHotReload: applyHotReload,
  onRestart: requestGatewayRestart,
  log: {
    info: (msg) => logReload.info(msg),
    warn: (msg) => logReload.warn(msg),
    error: (msg) => logReload.error(msg),
  },
  watchPath: CONFIG_PATH,
});
```

**파라미터:**
- `initialConfig`: 초기 설정
- `readSnapshot`: 설정 스냅샷 읽기 함수
- `onHotReload`: 핫 리로드 핸들러
- `onRestart`: 재시작 요청 핸들러
- `log`: 로거
- `watchPath`: 감시할 설정 파일 경로

### 2.2 설정 파일 감시

리로더는 파일 시스템 이벤트를 감시하여 설정 파일 변경을 감지합니다.

## 3. 리로드 계획

### 3.1 리로드 계획 구조

```typescript
export type GatewayReloadPlan = {
  reloadHooks: boolean;
  restartHeartbeat: boolean;
  restartCron: boolean;
  restartBrowserControl: boolean;
  restartGmailWatcher: boolean;
  restartChannels: Set<ChannelKind>;
  hotReasons: string[];
  restartReasons: string[];
  changedPaths: string[];
  noopPaths: string[];
};
```

**필드 설명:**
- `reloadHooks`: Hooks 설정 리로드 여부
- `restartHeartbeat`: Heartbeat 러너 재시작 여부
- `restartCron`: 크론 서비스 재시작 여부
- `restartBrowserControl`: 브라우저 제어 서버 재시작 여부
- `restartGmailWatcher`: Gmail 워처 재시작 여부
- `restartChannels`: 재시작할 채널 목록
- `hotReasons`: 핫 리로드 이유 목록
- `restartReasons`: 재시작 이유 목록
- `changedPaths`: 변경된 경로 목록
- `noopPaths`: 동적 읽기 경로 목록

### 3.2 리로드 계획 생성

설정 변경 감지 시 변경된 경로를 분석하여 리로드 계획을 생성합니다:

- `gateway.hooks.*`: Hooks 설정 리로드
- `gateway.heartbeat.*`: Heartbeat 재시작
- `cron.*`: 크론 서비스 재시작
- `gateway.browser.*`: 브라우저 제어 서버 재시작
- `hooks.gmail.*`: Gmail 워처 재시작
- `channels.{channelId}.*`: 특정 채널 재시작
- `agents.*`, `commands.*`, `process.*`: 재시작 필요

## 4. 핫 리로드

### 4.1 핫 리로드 처리

```typescript
const applyHotReload = async (
  plan: GatewayReloadPlan,
  nextConfig: ReturnType<typeof loadConfig>,
) => {
  setGatewaySigusr1RestartPolicy({ allowExternal: nextConfig.commands?.restart === true });
  const state = params.getState();
  const nextState = { ...state };
  
  // Hooks 설정 리로드
  if (plan.reloadHooks) {
    try {
      nextState.hooksConfig = resolveHooksConfig(nextConfig);
    } catch (err) {
      params.logHooks.warn(`hooks config reload failed: ${String(err)}`);
    }
  }
  
  // Heartbeat 재시작
  if (plan.restartHeartbeat) {
    nextState.heartbeatRunner.updateConfig(nextConfig);
  }
  
  // 디렉토리 캐시 리셋
  resetDirectoryCache();
  
  // 크론 서비스 재시작
  if (plan.restartCron) {
    state.cronState.cron.stop();
    nextState.cronState = buildGatewayCronService({
      cfg: nextConfig,
      deps: params.deps,
      broadcast: params.broadcast,
    });
    void nextState.cronState.cron
      .start()
      .catch((err) => params.logCron.error(`failed to start: ${String(err)}`));
  }
  
  // 브라우저 제어 서버 재시작
  if (plan.restartBrowserControl) {
    if (state.browserControl) {
      await state.browserControl.stop().catch(() => {});
    }
    try {
      nextState.browserControl = await startBrowserControlServerIfEnabled();
    } catch (err) {
      params.logBrowser.error(`server failed to start: ${String(err)}`);
    }
  }
  
  // Gmail 워처 재시작
  if (plan.restartGmailWatcher) {
    await stopGmailWatcher().catch(() => {});
    if (!isTruthyEnvValue(process.env.CLAWDBOT_SKIP_GMAIL_WATCHER)) {
      try {
        const gmailResult = await startGmailWatcher(nextConfig);
        if (gmailResult.started) {
          params.logHooks.info("gmail watcher started");
        }
      } catch (err) {
        params.logHooks.error(`gmail watcher failed to start: ${String(err)}`);
      }
    }
  }
  
  // 채널 재시작
  if (plan.restartChannels.size > 0) {
    if (
      isTruthyEnvValue(process.env.CLAWDBOT_SKIP_CHANNELS) ||
      isTruthyEnvValue(process.env.CLAWDBOT_SKIP_PROVIDERS)
    ) {
      params.logChannels.info("skipping channel reload");
    } else {
      const restartChannel = async (name: ChannelKind) => {
        params.logChannels.info(`restarting ${name} channel`);
        await params.stopChannel(name);
        await params.startChannel(name);
      };
      for (const channel of plan.restartChannels) {
        await restartChannel(channel);
      }
    }
  }
  
  // 레인 동시성 설정 업데이트
  setCommandLaneConcurrency(CommandLane.Cron, nextConfig.cron?.maxConcurrentRuns ?? 1);
  setCommandLaneConcurrency(CommandLane.Main, resolveAgentMaxConcurrent(nextConfig));
  setCommandLaneConcurrency(CommandLane.Subagent, resolveSubagentMaxConcurrent(nextConfig));
  
  // 상태 업데이트
  params.setState(nextState);
  
  // 로그
  if (plan.hotReasons.length > 0) {
    params.logReload.info(`config hot reload applied (${plan.hotReasons.join(", ")})`);
  } else if (plan.noopPaths.length > 0) {
    params.logReload.info(`config change applied (dynamic reads: ${plan.noopPaths.join(", ")})`);
  }
};
```

### 4.2 핫 리로드 가능한 설정

다음 설정은 핫 리로드가 가능합니다:
- `gateway.hooks.*`: Hooks 설정
- `gateway.heartbeat.*`: Heartbeat 설정
- `cron.*`: 크론 설정 (재시작 필요)
- `gateway.browser.*`: 브라우저 제어 설정 (재시작 필요)
- `hooks.gmail.*`: Gmail 워처 설정 (재시작 필요)
- `channels.{channelId}.*`: 채널 설정 (재시작 필요)
- `commands.*`: 명령 설정 (동적 읽기)

## 5. 재시작 요청

### 5.1 재시작 요청 처리

```typescript
const requestGatewayRestart = (
  plan: GatewayReloadPlan,
  nextConfig: ReturnType<typeof loadConfig>,
) => {
  setGatewaySigusr1RestartPolicy({ allowExternal: nextConfig.commands?.restart === true });
  const reasons = plan.restartReasons.length
    ? plan.restartReasons.join(", ")
    : plan.changedPaths.join(", ");
  
  // SIGUSR1 신호 전송 또는 종료 처리
  if (authorizeGatewaySigusr1Restart()) {
    process.kill(process.pid, "SIGUSR1");
  } else {
    // 종료 처리
    void close({ reason: `config change requires restart: ${reasons}` });
  }
};
```

### 5.2 재시작이 필요한 설정

다음 설정 변경 시 재시작이 필요합니다:
- `agents.*`: 에이전트 설정
- `process.*`: 프로세스 설정
- `gateway.bind`: 바인딩 모드
- `gateway.port`: 포트
- `gateway.tls.*`: TLS 설정
- `gateway.auth.*`: 인증 설정 (일부)

## 6. 설정 메서드 핸들러

### 6.1 config.get

설정을 조회합니다:

```typescript
"config.get": async ({ params, respond }) => {
  const path = typeof params.path === "string" ? params.path : undefined;
  const cfg = loadConfig();
  const value = path ? getConfigValue(cfg, path) : cfg;
  respond(true, { config: value });
}
```

### 6.2 config.set

설정을 설정합니다:

```typescript
"config.set": async ({ params, respond }) => {
  const path = typeof params.path === "string" ? params.path : undefined;
  const value = params.value;
  
  if (!path) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing path"));
    return;
  }
  
  const cfg = loadConfig();
  const updated = setConfigValue(cfg, path, value);
  await writeConfigFile(updated);
  respond(true);
}
```

### 6.3 config.apply

설정을 적용합니다 (전체 교체):

```typescript
"config.apply": async ({ params, respond }) => {
  const config = params.config;
  if (!config || typeof config !== "object") {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid config"));
    return;
  }
  
  const validated = validateConfig(config);
  if (!validated.ok) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, validated.error));
    return;
  }
  
  await writeConfigFile(validated.config);
  respond(true);
}
```

### 6.4 config.patch

설정을 패치합니다 (부분 업데이트):

```typescript
"config.patch": async ({ params, respond }) => {
  const patch = params.patch;
  if (!patch || typeof patch !== "object") {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid patch"));
    return;
  }
  
  const cfg = loadConfig();
  const updated = applyConfigPatch(cfg, patch);
  const validated = validateConfig(updated);
  if (!validated.ok) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, validated.error));
    return;
  }
  
  await writeConfigFile(validated.config);
  respond(true);
}
```

### 6.5 config.schema

설정 스키마를 조회합니다:

```typescript
"config.schema": async ({ respond }) => {
  const schema = getConfigSchema();
  respond(true, { schema });
}
```

## 7. 설정 스키마 검증

### 7.1 검증 프로세스

설정 파일 변경 시:
1. JSON 파싱
2. 스키마 검증
3. 유효성 확인

### 7.2 검증 에러

검증 실패 시:
- 에러 로그 기록
- 설정 변경 무시
- 이전 설정 유지

## 8. 동시 편집 보호

### 8.1 파일 잠금

설정 파일 쓰기 시 파일 잠금을 사용하여 동시 편집을 방지합니다.

### 8.2 충돌 처리

동시 편집 충돌 시:
- 마지막 쓰기 승리
- 충돌 로그 기록

## 9. 설정 마이그레이션

### 9.1 레거시 설정 감지

시작 시 레거시 설정을 감지하고 자동으로 마이그레이션합니다:

```typescript
if (configSnapshot.legacyIssues.length > 0) {
  const { config: migrated, changes } = migrateLegacyConfig(configSnapshot.parsed);
  if (migrated) {
    await writeConfigFile(migrated);
    log.info(`gateway: migrated legacy config entries:\n${changes.map((entry) => `- ${entry}`).join("\n")}`);
  }
}
```

### 9.2 마이그레이션 변경사항

마이그레이션 변경사항은 로그에 기록됩니다.

## 10. 설정 파일 경로

설정 파일은 다음 경로에 저장됩니다:

- 기본 경로: `~/.clawdbot/config.json`
- 환경변수: `CLAWDBOT_CONFIG_PATH`

## 11. 설정 리로더 중지

Gateway 종료 시 설정 리로더도 자동으로 중지됩니다:

```typescript
await params.configReloader.stop().catch(() => {});
```
