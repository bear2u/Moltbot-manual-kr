# 크론 서비스

**작성일**: 2026-01-28  
**모듈**: `src/gateway/server-cron.ts`, `src/gateway/server-methods/cron.ts`

## 1. 개요

Gateway는 스케줄된 작업을 실행하는 크론 서비스를 제공합니다. 크론 작업은 주기적으로 실행되며, 에이전트를 호출하거나 시스템 이벤트를 큐에 추가할 수 있습니다.

## 2. 크론 서비스 생성

### 2.1 서비스 빌드

```typescript
export function buildGatewayCronService(params: {
  cfg: ReturnType<typeof loadConfig>;
  deps: CliDeps;
  broadcast: (event: string, payload: unknown, opts?: { dropIfSlow?: boolean }) => void;
}): GatewayCronState
```

**파라미터:**
- `cfg`: 설정 객체
- `deps`: CLI 의존성
- `broadcast`: 이벤트 브로드캐스트 함수

**반환값:**
```typescript
export type GatewayCronState = {
  cron: CronService;
  storePath: string;
  cronEnabled: boolean;
};
```

### 2.2 크론 에이전트 해결

```typescript
const resolveCronAgent = (requested?: string | null) => {
  const runtimeConfig = loadConfig();
  const normalized =
    typeof requested === "string" && requested.trim() ? normalizeAgentId(requested) : undefined;
  const hasAgent =
    normalized !== undefined &&
    Array.isArray(runtimeConfig.agents?.list) &&
    runtimeConfig.agents.list.some(
      (entry) =>
        entry && typeof entry.id === "string" && normalizeAgentId(entry.id) === normalized,
    );
  const agentId = hasAgent ? normalized : resolveDefaultAgentId(runtimeConfig);
  return { agentId, cfg: runtimeConfig };
};
```

요청된 에이전트가 있으면 해당 에이전트를 사용하고, 없으면 기본 에이전트를 사용합니다.

### 2.3 크론 서비스 구성

```typescript
const cron = new CronService({
  storePath,
  cronEnabled,
  enqueueSystemEvent: (text, opts) => {
    const { agentId, cfg: runtimeConfig } = resolveCronAgent(opts?.agentId);
    const sessionKey = resolveAgentMainSessionKey({
      cfg: runtimeConfig,
      agentId,
    });
    enqueueSystemEvent(text, { sessionKey });
  },
  requestHeartbeatNow,
  runHeartbeatOnce: async (opts) => {
    const runtimeConfig = loadConfig();
    return await runHeartbeatOnce({
      cfg: runtimeConfig,
      reason: opts?.reason,
      deps: { ...params.deps, runtime: defaultRuntime },
    });
  },
  runIsolatedAgentJob: async ({ job, message }) => {
    const { agentId, cfg: runtimeConfig } = resolveCronAgent(job.agentId);
    return await runCronIsolatedAgentTurn({
      cfg: runtimeConfig,
      deps: params.deps,
      job,
      message,
      agentId,
      sessionKey: `cron:${job.id}`,
      lane: "cron",
    });
  },
  log: getChildLogger({ module: "cron", storePath }),
  onEvent: (evt) => {
    params.broadcast("cron", evt, { dropIfSlow: true });
    if (evt.action === "finished") {
      const logPath = resolveCronRunLogPath({
        storePath,
        jobId: evt.jobId,
      });
      void appendCronRunLog(logPath, {
        ts: Date.now(),
        jobId: evt.jobId,
        action: "finished",
        status: evt.status,
        error: evt.error,
        summary: evt.summary,
        runAtMs: evt.runAtMs,
        durationMs: evt.durationMs,
        nextRunAtMs: evt.nextRunAtMs,
      }).catch((err) => {
        cronLogger.warn({ err: String(err), logPath }, "cron: run log append failed");
      });
    }
  },
});
```

## 3. 크론 작업 실행

### 3.1 작업 타입

크론 작업은 다음 타입을 지원합니다:

- **isolated**: 격리된 에이전트 실행
- **system-event**: 시스템 이벤트 큐에 추가
- **heartbeat**: Heartbeat 실행

### 3.2 격리된 에이전트 실행

```typescript
runIsolatedAgentJob: async ({ job, message }) => {
  const { agentId, cfg: runtimeConfig } = resolveCronAgent(job.agentId);
  return await runCronIsolatedAgentTurn({
    cfg: runtimeConfig,
    deps: params.deps,
    job,
    message,
    agentId,
    sessionKey: `cron:${job.id}`,
    lane: "cron",
  });
}
```

각 크론 작업은 고유한 세션 키(`cron:${job.id}`)를 가지며, `cron` 레인에서 실행됩니다.

### 3.3 시스템 이벤트 큐에 추가

```typescript
enqueueSystemEvent: (text, opts) => {
  const { agentId, cfg: runtimeConfig } = resolveCronAgent(opts?.agentId);
  const sessionKey = resolveAgentMainSessionKey({
    cfg: runtimeConfig,
    agentId,
  });
  enqueueSystemEvent(text, { sessionKey });
}
```

시스템 이벤트는 에이전트의 메인 세션에 추가됩니다.

### 3.4 Heartbeat 실행

```typescript
runHeartbeatOnce: async (opts) => {
  const runtimeConfig = loadConfig();
  return await runHeartbeatOnce({
    cfg: runtimeConfig,
    reason: opts?.reason,
    deps: { ...params.deps, runtime: defaultRuntime },
  });
}
```

## 4. 크론 이벤트

### 4.1 이벤트 타입

크론 서비스는 다음 이벤트를 브로드캐스트합니다:

**started**
```typescript
{
  action: "started",
  jobId: string;
  runAtMs: number;
}
```

**finished**
```typescript
{
  action: "finished",
  jobId: string;
  status: "ok" | "error";
  error?: string;
  summary?: string;
  runAtMs: number;
  durationMs: number;
  nextRunAtMs?: number;
}
```

**error**
```typescript
{
  action: "error",
  jobId: string;
  error: string;
  runAtMs: number;
}
```

### 4.2 이벤트 브로드캐스팅

```typescript
onEvent: (evt) => {
  params.broadcast("cron", evt, { dropIfSlow: true });
  // ...
}
```

모든 크론 이벤트는 `dropIfSlow: true` 옵션으로 브로드캐스트됩니다.

## 5. 크론 메서드 핸들러

### 5.1 cron.list

크론 작업 목록을 조회합니다:

```typescript
"cron.list": async ({ params, respond, context }) => {
  const jobs = await context.cron.list();
  respond(true, { jobs });
}
```

### 5.2 cron.status

크론 서비스 상태를 조회합니다:

```typescript
"cron.status": async ({ respond, context }) => {
  const status = await context.cron.getStatus();
  respond(true, status);
}
```

**반환값:**
```typescript
{
  enabled: boolean;
  running: boolean;
  jobs: number;
  nextRunAtMs?: number;
}
```

### 5.3 cron.add

크론 작업을 추가합니다:

```typescript
"cron.add": async ({ params, respond, context }) => {
  const job = validateCronJob(params.job);
  if (!job) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid job"));
    return;
  }
  
  await context.cron.add(job);
  respond(true);
}
```

### 5.4 cron.update

크론 작업을 업데이트합니다:

```typescript
"cron.update": async ({ params, respond, context }) => {
  const jobId = typeof params.jobId === "string" ? params.jobId : null;
  const job = validateCronJob(params.job);
  
  if (!jobId || !job) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing jobId or invalid job"));
    return;
  }
  
  await context.cron.update(jobId, job);
  respond(true);
}
```

### 5.5 cron.remove

크론 작업을 제거합니다:

```typescript
"cron.remove": async ({ params, respond, context }) => {
  const jobId = typeof params.jobId === "string" ? params.jobId : null;
  if (!jobId) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing jobId"));
    return;
  }
  
  await context.cron.remove(jobId);
  respond(true);
}
```

### 5.6 cron.run

크론 작업을 즉시 실행합니다:

```typescript
"cron.run": async ({ params, respond, context }) => {
  const jobId = typeof params.jobId === "string" ? params.jobId : null;
  if (!jobId) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing jobId"));
    return;
  }
  
  const result = await context.cron.run(jobId);
  respond(result.ok, result.error ? undefined : { runId: result.runId }, result.error);
}
```

### 5.7 cron.runs

크론 실행 로그를 조회합니다:

```typescript
"cron.runs": async ({ params, respond, context }) => {
  const jobId = typeof params.jobId === "string" ? params.jobId : null;
  const limit = typeof params.limit === "number" ? params.limit : 100;
  
  const runs = await readCronRunLogs({
    storePath: context.cronStorePath,
    jobId,
    limit,
  });
  
  respond(true, { runs });
}
```

## 6. 크론 작업 스키마

### 6.1 작업 구조

```typescript
export type CronJob = {
  id: string;
  schedule: string; // Cron 표현식
  type: "isolated" | "system-event" | "heartbeat";
  enabled: boolean;
  agentId?: string;
  message?: string;
  timeoutSeconds?: number;
};
```

### 6.2 작업 타입별 필드

**isolated**
- `agentId`: 실행할 에이전트 ID (선택적)
- `message`: 에이전트에 전달할 메시지
- `timeoutSeconds`: 타임아웃 (초)

**system-event**
- `message`: 시스템 이벤트 메시지
- `agentId`: 대상 에이전트 ID (선택적)

**heartbeat**
- 추가 필드 없음

## 7. 실행 로그

### 7.1 로그 저장

크론 작업 실행 완료 시 로그가 저장됩니다:

```typescript
if (evt.action === "finished") {
  const logPath = resolveCronRunLogPath({
    storePath,
    jobId: evt.jobId,
  });
  void appendCronRunLog(logPath, {
    ts: Date.now(),
    jobId: evt.jobId,
    action: "finished",
    status: evt.status,
    error: evt.error,
    summary: evt.summary,
    runAtMs: evt.runAtMs,
    durationMs: evt.durationMs,
    nextRunAtMs: evt.nextRunAtMs,
  });
}
```

### 7.2 로그 경로

로그는 다음 경로에 저장됩니다:

```
{cronStorePath}/runs/{jobId}.jsonl
```

### 7.3 로그 형식

로그는 JSONL 형식으로 저장되며, 각 줄은 하나의 실행 기록을 나타냅니다:

```json
{"ts":1234567890,"jobId":"job-1","action":"finished","status":"ok","runAtMs":1234567890,"durationMs":5000,"nextRunAtMs":1234571490}
```

## 8. 크론 서비스 설정

### 8.1 설정 구조

```json
{
  "cron": {
    "enabled": true,
    "store": "/path/to/cron/store",
    "maxConcurrentRuns": 1,
    "jobs": [
      {
        "id": "job-1",
        "schedule": "0 * * * *",
        "type": "isolated",
        "enabled": true,
        "message": "Check status"
      }
    ]
  }
}
```

### 8.2 환경변수

- `CLAWDBOT_SKIP_CRON=1`: 크론 서비스 비활성화

### 8.3 동시 실행 제한

`maxConcurrentRuns` 설정을 통해 동시에 실행할 수 있는 크론 작업 수를 제한할 수 있습니다. 기본값은 1입니다.

## 9. 크론 서비스 시작/중지

### 9.1 시작

```typescript
void cron.start().catch((err) => logCron.error(`failed to start: ${String(err)}`));
```

### 9.2 중지

```typescript
cron.stop();
```

Gateway 종료 시 크론 서비스도 자동으로 중지됩니다.

## 10. 에러 처리

### 10.1 작업 실행 에러

작업 실행 중 에러가 발생하면:
- `error` 이벤트 브로드캐스트
- 로그에 에러 기록
- 다음 실행 스케줄은 유지

### 10.2 서비스 시작 에러

서비스 시작 실패 시:
- 로그에 에러 기록
- Gateway는 계속 실행 (크론 없이)

## 11. 성능 고려사항

### 11.1 동시 실행 제한

동시 실행 제한을 통해 리소스 사용을 제어할 수 있습니다.

### 11.2 실행 로그

실행 로그는 비동기적으로 저장되며, 실패해도 크론 서비스 실행에는 영향을 주지 않습니다.

### 11.3 이벤트 브로드캐스팅

크론 이벤트는 `dropIfSlow: true` 옵션으로 브로드캐스트되어 느린 클라이언트에 영향을 주지 않습니다.
