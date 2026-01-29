---
layout: default
title: Config Reload
---

# 설정 리로드 시스템

**작성일**: 2026-01-28  
**모듈**: `src/gateway/config-reload.ts`

## 1. 개요

설정 리로드 시스템은 설정 파일 변경을 감지하고 적절한 리로드 계획을 생성합니다. 핫 리로드와 전체 재시작을 지원합니다.

## 2. 리로드 모드

### 2.1 GatewayReloadMode

```typescript
export type GatewayReloadMode = "off" | "restart" | "hot" | "hybrid";
```

**모드:**
- `off`: 리로드 비활성화
- `restart`: 항상 전체 재시작
- `hot`: 핫 리로드만 사용
- `hybrid`: 핫 리로드 가능하면 핫 리로드, 아니면 재시작

### 2.2 기본 설정

```typescript
const DEFAULT_RELOAD_SETTINGS: GatewayReloadSettings = {
  mode: "hybrid",
  debounceMs: 300,
};
```

## 3. 리로드 계획

### 3.1 GatewayReloadPlan 구조

```typescript
export type GatewayReloadPlan = {
  changedPaths: string[];
  restartGateway: boolean;
  restartReasons: string[];
  hotReasons: string[];
  reloadHooks: boolean;
  restartGmailWatcher: boolean;
  restartBrowserControl: boolean;
  restartCron: boolean;
  restartHeartbeat: boolean;
  restartChannels: Set<ChannelKind>;
  noopPaths: string[];
};
```

## 4. 리로드 규칙

### 4.1 기본 규칙

```typescript
const BASE_RELOAD_RULES: ReloadRule[] = [
  { prefix: "gateway.remote", kind: "none" },
  { prefix: "gateway.reload", kind: "none" },
  { prefix: "hooks.gmail", kind: "hot", actions: ["restart-gmail-watcher"] },
  { prefix: "hooks", kind: "hot", actions: ["reload-hooks"] },
  { prefix: "agents.defaults.heartbeat", kind: "hot", actions: ["restart-heartbeat"] },
  { prefix: "agent.heartbeat", kind: "hot", actions: ["restart-heartbeat"] },
  { prefix: "cron", kind: "hot", actions: ["restart-cron"] },
  { prefix: "browser", kind: "hot", actions: ["restart-browser-control"] },
];
```

### 4.2 Tail 규칙

```typescript
const BASE_RELOAD_RULES_TAIL: ReloadRule[] = [
  { prefix: "identity", kind: "none" },
  { prefix: "wizard", kind: "none" },
  { prefix: "logging", kind: "none" },
  { prefix: "models", kind: "none" },
  { prefix: "agents", kind: "none" },
  { prefix: "tools", kind: "none" },
  { prefix: "bindings", kind: "none" },
  { prefix: "audio", kind: "none" },
  { prefix: "agent", kind: "none" },
  { prefix: "routing", kind: "none" },
  { prefix: "messages", kind: "none" },
  { prefix: "session", kind: "none" },
  { prefix: "talk", kind: "none" },
  { prefix: "skills", kind: "none" },
  { prefix: "plugins", kind: "restart" },
  { prefix: "ui", kind: "none" },
  { prefix: "gateway", kind: "restart" },
  { prefix: "discovery", kind: "restart" },
  { prefix: "canvasHost", kind: "restart" },
];
```

### 4.3 채널 규칙

채널 플러그인은 자체 리로드 규칙을 제공할 수 있습니다:

```typescript
const channelReloadRules: ReloadRule[] = listChannelPlugins().flatMap((plugin) => [
  ...(plugin.reload?.configPrefixes ?? []).map(
    (prefix): ReloadRule => ({
      prefix,
      kind: "hot",
      actions: [`restart-channel:${plugin.id}` as ReloadAction],
    }),
  ),
  ...(plugin.reload?.noopPrefixes ?? []).map(
    (prefix): ReloadRule => ({
      prefix,
      kind: "none",
    }),
  ),
]);
```

## 5. 설정 차이 계산

### 5.1 diffConfigPaths

```typescript
export function diffConfigPaths(prev: unknown, next: unknown, prefix = ""): string[]
```

두 설정 객체의 차이를 계산합니다.

**프로세스:**

1. **같은 객체 확인**
```typescript
if (prev === next) return [];
```

2. **객체 비교**
```typescript
if (isPlainObject(prev) && isPlainObject(next)) {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const paths: string[] = [];
  for (const key of keys) {
    const prevValue = prev[key];
    const nextValue = next[key];
    if (prevValue === undefined && nextValue === undefined) continue;
    const childPrefix = prefix ? `${prefix}.${key}` : key;
    const childPaths = diffConfigPaths(prevValue, nextValue, childPrefix);
    if (childPaths.length > 0) {
      paths.push(...childPaths);
    }
  }
  return paths;
}
```

3. **배열 비교**
```typescript
if (Array.isArray(prev) && Array.isArray(next)) {
  if (prev.length === next.length && prev.every((val, idx) => val === next[idx])) {
    return [];
  }
}
```

4. **리프 노드**
```typescript
return [prefix || "<root>"];
```

## 6. 리로드 계획 빌드

### 6.1 buildGatewayReloadPlan

```typescript
export function buildGatewayReloadPlan(changedPaths: string[]): GatewayReloadPlan
```

변경된 경로 목록에서 리로드 계획을 빌드합니다.

**프로세스:**

1. **초기 계획 생성**
```typescript
const plan: GatewayReloadPlan = {
  changedPaths,
  restartGateway: false,
  restartReasons: [],
  hotReasons: [],
  reloadHooks: false,
  restartGmailWatcher: false,
  restartBrowserControl: false,
  restartCron: false,
  restartHeartbeat: false,
  restartChannels: new Set(),
  noopPaths: [],
};
```

2. **각 경로에 대해 규칙 매칭**
```typescript
for (const path of changedPaths) {
  const rule = matchRule(path);
  if (!rule) {
    plan.restartGateway = true;
    plan.restartReasons.push(`unknown path: ${path}`);
    continue;
  }
  
  if (rule.kind === "none") {
    plan.noopPaths.push(path);
    continue;
  }
  
  if (rule.kind === "restart") {
    plan.restartGateway = true;
    plan.restartReasons.push(path);
    continue;
  }
  
  if (rule.kind === "hot") {
    plan.hotReasons.push(path);
    if (rule.actions) {
      for (const action of rule.actions) {
        applyAction(action);
      }
    }
  }
}
```

3. **액션 적용**
```typescript
const applyAction = (action: ReloadAction) => {
  if (action.startsWith("restart-channel:")) {
    const channel = action.slice("restart-channel:".length) as ChannelId;
    plan.restartChannels.add(channel);
    return;
  }
  switch (action) {
    case "reload-hooks":
      plan.reloadHooks = true;
      break;
    case "restart-gmail-watcher":
      plan.restartGmailWatcher = true;
      break;
    case "restart-browser-control":
      plan.restartBrowserControl = true;
      break;
    case "restart-cron":
      plan.restartCron = true;
      break;
    case "restart-heartbeat":
      plan.restartHeartbeat = true;
      break;
  }
};
```

## 7. 리로드 설정 해결

### 7.1 resolveGatewayReloadSettings

```typescript
export function resolveGatewayReloadSettings(cfg: MoltbotConfig): GatewayReloadSettings
```

설정에서 리로드 설정을 해결합니다.

**프로세스:**

1. **모드 해결**
```typescript
const rawMode = cfg.gateway?.reload?.mode;
const mode =
  rawMode === "off" || rawMode === "restart" || rawMode === "hot" || rawMode === "hybrid"
    ? rawMode
    : DEFAULT_RELOAD_SETTINGS.mode;
```

2. **디바운스 해결**
```typescript
const debounceRaw = cfg.gateway?.reload?.debounceMs;
const debounceMs =
  typeof debounceRaw === "number" && Number.isFinite(debounceRaw)
    ? Math.max(0, Math.floor(debounceRaw))
    : DEFAULT_RELOAD_SETTINGS.debounceMs;
```

3. **반환**
```typescript
return { mode, debounceMs };
```

## 8. 리로드 액션

### 8.1 ReloadAction 타입

```typescript
type ReloadAction =
  | "reload-hooks"
  | "restart-gmail-watcher"
  | "restart-browser-control"
  | "restart-cron"
  | "restart-heartbeat"
  | `restart-channel:${ChannelId}`;
```

## 9. 사용 예시

### 9.1 설정 변경 감지

```typescript
const watcher = chokidar.watch(configPath);
watcher.on("change", async () => {
  const prev = loadConfig();
  await new Promise((resolve) => setTimeout(resolve, debounceMs));
  const next = loadConfig();
  const changedPaths = diffConfigPaths(prev, next);
  const plan = buildGatewayReloadPlan(changedPaths);
  await applyReloadPlan(plan);
});
```

### 9.2 리로드 계획 적용

```typescript
if (plan.restartGateway) {
  await requestGatewayRestart({ reason: plan.restartReasons.join(", ") });
} else {
  await applyHotReload(plan);
}
```

## 10. 성능 고려사항

### 10.1 디바운싱

설정 변경은 디바운싱되어 연속된 변경을 하나로 처리합니다.

### 10.2 규칙 캐싱

리로드 규칙은 캐싱되어 반복 계산을 방지합니다.

### 10.3 핫 리로드

가능한 경우 핫 리로드를 사용하여 전체 재시작을 방지합니다.

## 11. 보안 고려사항

### 11.1 설정 검증

리로드 전에 설정이 검증됩니다.

### 11.2 안전한 리로드

핫 리로드는 안전하게 수행되며, 실패 시 전체 재시작으로 폴백합니다.
