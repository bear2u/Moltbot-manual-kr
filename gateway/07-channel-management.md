# 채널 관리

**작성일**: 2026-01-28  
**모듈**: `src/gateway/server-channels.ts`, `src/gateway/server-methods/channels.ts`

## 1. 개요

Gateway는 다양한 메시징 채널(WhatsApp, Telegram, Slack, Discord 등)을 관리하는 시스템을 제공합니다. 채널 관리자는 채널의 생명주기를 제어하고, 상태를 추적하며, 채널별 계정을 관리합니다.

## 2. 채널 관리자

### 2.1 채널 관리자 생성

```typescript
const channelManager = createChannelManager({
  loadConfig,
  channelLogs,
  channelRuntimeEnvs,
});
```

**파라미터:**
- `loadConfig`: 설정 로드 함수
- `channelLogs`: 채널별 로거 맵
- `channelRuntimeEnvs`: 채널별 런타임 환경 맵

### 2.2 채널 관리자 인터페이스

```typescript
export type ChannelManager = {
  getRuntimeSnapshot: () => ChannelRuntimeSnapshot;
  startChannels: () => Promise<void>;
  startChannel: (channel: ChannelId, accountId?: string) => Promise<void>;
  stopChannel: (channel: ChannelId, accountId?: string) => Promise<void>;
  markChannelLoggedOut: (channelId: ChannelId, cleared: boolean, accountId?: string) => void;
};
```

## 3. 채널 런타임 상태

### 3.1 런타임 스냅샷 구조

```typescript
export type ChannelRuntimeSnapshot = {
  channels: Partial<Record<ChannelId, ChannelAccountSnapshot>>;
  channelAccounts: Partial<Record<ChannelId, Record<string, ChannelAccountSnapshot>>>;
};
```

**필드 설명:**
- `channels`: 채널별 기본 계정 스냅샷
- `channelAccounts`: 채널별 모든 계정 스냅샷

### 3.2 계정 스냅샷 구조

```typescript
export type ChannelAccountSnapshot = {
  accountId: string;
  running: boolean;
  lastStartAt?: number;
  lastError?: string | null;
  loggedIn?: boolean;
  loggedOutAt?: number;
  // 채널별 추가 필드
};
```

## 4. 채널 시작

### 4.1 모든 채널 시작

```typescript
startChannels: async () => {
  const cfg = loadConfig();
  const plugins = listChannelPlugins();
  
  for (const plugin of plugins) {
    await startChannel(plugin.id);
  }
}
```

### 4.2 특정 채널 시작

```typescript
startChannel: async (channelId: ChannelId, accountId?: string) => {
  const plugin = getChannelPlugin(channelId);
  const startAccount = plugin?.gateway?.startAccount;
  if (!startAccount) return;
  
  const cfg = loadConfig();
  resetDirectoryCache({ channel: channelId, accountId });
  const store = getStore(channelId);
  const accountIds = accountId ? [accountId] : plugin.config.listAccountIds(cfg);
  if (accountIds.length === 0) return;
  
  await Promise.all(
    accountIds.map(async (id) => {
      if (store.tasks.has(id)) return;
      
      const account = plugin.config.resolveAccount(cfg, id);
      const enabled = plugin.config.isEnabled
        ? plugin.config.isEnabled(account, cfg)
        : isAccountEnabled(account);
      if (!enabled) {
        setRuntime(channelId, id, {
          accountId: id,
          running: false,
          lastError: plugin.config.disabledReason?.(account, cfg) ?? "disabled",
        });
        return;
      }
      
      let configured = true;
      if (plugin.config.isConfigured) {
        configured = await plugin.config.isConfigured(account, cfg);
      }
      if (!configured) {
        setRuntime(channelId, id, {
          accountId: id,
          running: false,
          lastError: plugin.config.unconfiguredReason?.(account, cfg) ?? "not configured",
        });
        return;
      }
      
      const abort = new AbortController();
      store.aborts.set(id, abort);
      setRuntime(channelId, id, {
        accountId: id,
        running: true,
        lastStartAt: Date.now(),
        lastError: null,
      });
      
      const log = channelLogs[channelId];
      const task = startAccount({
        cfg,
        accountId: id,
        account,
        runtime: channelRuntimeEnvs[channelId],
        abortSignal: abort.signal,
        log,
        getStatus: () => getRuntime(channelId, id),
        setStatus: (next) => setRuntime(channelId, id, next),
      });
      
      store.tasks.set(id, task);
      
      task
        .then(() => {
          store.tasks.delete(id);
          store.aborts.delete(id);
        })
        .catch((err) => {
          store.tasks.delete(id);
          store.aborts.delete(id);
          setRuntime(channelId, id, {
            accountId: id,
            running: false,
            lastError: formatErrorMessage(err),
          });
        });
    }),
  );
}
```

**프로세스:**
1. 채널 플러그인 확인
2. 계정 목록 확인
3. 각 계정에 대해:
   - 활성화 여부 확인
   - 설정 여부 확인
   - AbortController 생성
   - 런타임 상태 업데이트
   - 채널 시작 작업 실행
   - 완료/에러 처리

## 5. 채널 중지

### 5.1 채널 중지

```typescript
stopChannel: async (channelId: ChannelId, accountId?: string) => {
  const plugin = getChannelPlugin(channelId);
  const stopAccount = plugin?.gateway?.stopAccount;
  const store = getStore(channelId);
  
  const accountIds = accountId ? [accountId] : plugin.config.listAccountIds(loadConfig());
  
  await Promise.all(
    accountIds.map(async (id) => {
      const abort = store.aborts.get(id);
      if (abort) {
        abort.abort();
        store.aborts.delete(id);
      }
      
      if (stopAccount) {
        try {
          await stopAccount({ accountId: id });
        } catch (err) {
          // 에러 무시
        }
      }
      
      const task = store.tasks.get(id);
      if (task) {
        try {
          await task;
        } catch {
          // 에러 무시
        }
        store.tasks.delete(id);
      }
      
      const current = getRuntime(channelId, id);
      setRuntime(channelId, id, {
        ...current,
        running: false,
      });
    }),
  );
}
```

**프로세스:**
1. 계정 목록 확인
2. 각 계정에 대해:
   - AbortController 중지
   - 채널 중지 함수 호출
   - 실행 중인 작업 대기
   - 런타임 상태 업데이트

## 6. 채널 상태 조회

### 6.1 런타임 스냅샷 조회

```typescript
getRuntimeSnapshot: () => {
  const snapshot: ChannelRuntimeSnapshot = {
    channels: {},
    channelAccounts: {},
  };
  
  for (const [channelId, store] of channelStores) {
    const plugin = getChannelPlugin(channelId);
    const accountIds = plugin.config.listAccountIds(loadConfig());
    
    const accounts: Record<string, ChannelAccountSnapshot> = {};
    for (const accountId of accountIds) {
      accounts[accountId] = getRuntime(channelId, accountId);
    }
    
    snapshot.channelAccounts[channelId] = accounts;
    snapshot.channels[channelId] = accounts[DEFAULT_ACCOUNT_ID] ?? resolveDefaultRuntime(channelId);
  }
  
  return snapshot;
}
```

### 6.2 채널 상태 메서드

`channels.status` 메서드는 채널 상태를 조회합니다:

```typescript
"channels.status": async ({ respond, context }) => {
  const snapshot = context.getRuntimeSnapshot();
  respond(true, snapshot);
}
```

## 7. 채널 로그아웃

### 7.1 로그아웃 처리

```typescript
markChannelLoggedOut: (channelId: ChannelId, cleared: boolean, accountId?: string) => {
  const plugin = getChannelPlugin(channelId);
  const accountIds = accountId ? [accountId] : plugin.config.listAccountIds(loadConfig());
  
  for (const id of accountIds) {
    const current = getRuntime(channelId, id);
    setRuntime(channelId, id, {
      ...current,
      loggedIn: false,
      loggedOutAt: cleared ? Date.now() : current.loggedOutAt,
    });
  }
}
```

### 7.2 로그아웃 메서드

`channels.logout` 메서드는 채널을 로그아웃합니다:

```typescript
"channels.logout": async ({ params, respond, context }) => {
  const channelId = typeof params.channel === "string" ? params.channel : null;
  const accountId = typeof params.accountId === "string" ? params.accountId : undefined;
  
  if (!channelId) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing channel"));
    return;
  }
  
  const plugin = getChannelPlugin(channelId);
  const logoutAccount = plugin?.gateway?.logoutAccount;
  
  if (logoutAccount) {
    try {
      await logoutAccount({ accountId });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
      return;
    }
  }
  
  context.markChannelLoggedOut(channelId, true, accountId);
  respond(true);
}
```

## 8. 채널별 기능

### 8.1 WhatsApp

- QR 코드 로그인
- 웹 기반 연결
- 메시지 전송/수신

### 8.2 Telegram

- Bot 토큰 인증
- 사용자 인증
- 메시지 전송/수신

### 8.3 Slack

- OAuth 인증
- 웹훅 수신
- 메시지 전송/수신

### 8.4 Discord

- Bot 토큰 인증
- 웹소켓 연결
- 메시지 전송/수신

## 9. 채널 플러그인 인터페이스

### 9.1 Gateway 메서드

채널 플러그인은 `gatewayMethods`를 통해 Gateway 메서드를 추가할 수 있습니다:

```typescript
export type ChannelPlugin = {
  id: ChannelId;
  gatewayMethods?: string[];
  gateway?: {
    startAccount?: (opts: {...}) => Promise<void>;
    stopAccount?: (opts: {...}) => Promise<void>;
    logoutAccount?: (opts: {...}) => Promise<void>;
  };
  // ...
};
```

### 9.2 시작 옵션

```typescript
type StartAccountOptions = {
  cfg: MoltbotConfig;
  accountId: string;
  account: unknown;
  runtime: RuntimeEnv;
  abortSignal: AbortSignal;
  log: SubsystemLogger;
  getStatus: () => ChannelAccountSnapshot;
  setStatus: (next: ChannelAccountSnapshot) => void;
};
```

### 9.3 상태 업데이트

채널은 `setStatus` 함수를 통해 상태를 업데이트할 수 있습니다:

```typescript
setStatus({
  accountId: id,
  running: true,
  loggedIn: true,
  lastStartAt: Date.now(),
  lastError: null,
});
```

## 10. 채널 상태 이벤트

채널 상태 변경 시 이벤트가 브로드캐스트될 수 있습니다 (채널 플러그인 구현에 따라 다름).

## 11. 에러 처리

### 11.1 시작 실패

채널 시작 실패 시:
- 런타임 상태에 `lastError` 설정
- `running: false`로 설정
- 로그에 에러 기록

### 11.2 중지 실패

채널 중지 실패 시:
- 에러는 무시되고 로그에만 기록
- 런타임 상태는 `running: false`로 업데이트

## 12. 디렉토리 캐시 리셋

채널 시작 시 `resetDirectoryCache()` 함수를 호출하여 디렉토리 캐시를 리셋합니다. 이는 채널별 계정의 대상 디렉토리 캐시를 초기화합니다.
