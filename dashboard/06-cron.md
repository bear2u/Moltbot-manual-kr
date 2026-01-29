# Cron Jobs 기능 상세 분석

**작성일**: 2026-01-28  
**모듈**: `ui/src/ui/views/cron.ts`, `ui/src/ui/controllers/cron.ts`

## 1. 개요

Cron Jobs 페이지는 Gateway에서 스케줄된 작업을 관리하는 인터페이스입니다. 주기적인 에이전트 실행, 웨이크업, 알림 등을 설정하고 관리할 수 있습니다.

## 2. 주요 기능

### 2.1 스케줄러 상태
- 크론 스케줄러 활성화 상태
- 작업 개수
- 다음 실행 시간

### 2.2 작업 관리
- 새 작업 추가
- 작업 활성화/비활성화
- 작업 즉시 실행
- 작업 삭제
- 실행 히스토리 조회

## 3. UI 구조

### 3.1 스케줄러 카드
```typescript
// ui/src/ui/views/cron.ts
<div class="card">
  <div class="card-title">Scheduler</div>
  <div class="card-sub">
    Gateway-owned cron scheduler status.
  </div>
  
  <div class="stat-grid">
    <div class="stat">
      <div class="stat-label">Enabled</div>
      <div class="stat-value">
        {status?.enabled ? "Yes" : "No"}
      </div>
    </div>
    <div class="stat">
      <div class="stat-label">Jobs</div>
      <div class="stat-value">{status?.jobs ?? "n/a"}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Next wake</div>
      <div class="stat-value">
        {formatNextRun(status?.nextWakeAtMs ?? null)}
      </div>
    </div>
  </div>
  
  <button @click={onRefresh}>
    {loading ? "Refreshing…" : "Refresh"}
  </button>
</div>
```

### 3.2 새 작업 폼
```typescript
<div class="card">
  <div class="card-title">New Job</div>
  <div class="card-sub">
    Create a scheduled wakeup or agent run.
  </div>
  
  <div class="form-grid">
    {/* 이름 */}
    <label>
      <span>Name</span>
      <input value={form.name} />
    </label>
    
    {/* 스케줄 */}
    <label>
      <span>Schedule</span>
      <input 
        value={form.schedule}
        placeholder="0 9 * * *"
      />
    </label>
    
    {/* 채널 */}
    <label>
      <span>Channel</span>
      <select value={form.channel}>
        <option value="last">last</option>
        {channels.map(ch => (
          <option value={ch}>{resolveChannelLabel(ch)}</option>
        ))}
      </select>
    </label>
    
    {/* 메시지 */}
    <label>
      <span>Message</span>
      <textarea value={form.message}></textarea>
    </label>
    
    {/* 활성화 */}
    <label class="checkbox">
      <span>Enabled</span>
      <input type="checkbox" checked={form.enabled} />
    </label>
  </div>
  
  <button @click={onAdd}>Add Job</button>
</div>
```

### 3.3 작업 목록
```typescript
<div class="card">
  <div class="card-title">Jobs</div>
  
  <div class="list">
    {jobs.map(job => renderJob(job))}
  </div>
</div>
```

## 4. 작업 렌더링

### 4.1 작업 행 구조
```typescript
function renderJob(job: CronJob) {
  return html`
    <div class="list-item">
      <div class="list-main">
        {/* 작업 이름 */}
        <div class="list-title">
          {job.name}
        </div>
        
        {/* 스케줄 */}
        <div class="list-sub">
          {formatCronSchedule(job.schedule)}
        </div>
        
        {/* 칩 (상태, 채널 등) */}
        <div class="chip-row">
          <span class="chip ${job.enabled ? "chip-ok" : "chip-warn"}">
            {formatCronState(job)}
          </span>
          {job.channel && (
            <span class="chip">{resolveChannelLabel(job.channel)}</span>
          )}
          {job.nextRunAtMs && (
            <span class="chip">
              Next: {formatNextRun(job.nextRunAtMs)}
            </span>
          )}
        </div>
      </div>
      
      {/* 액션 버튼 */}
      <div class="list-actions">
        <button @click={() => onToggle(job, !job.enabled)}>
          {job.enabled ? "Disable" : "Enable"}
        </button>
        <button @click={() => onRun(job)}>Run Now</button>
        <button @click={() => onLoadRuns(job.id)}>History</button>
        <button @click={() => onRemove(job)}>Remove</button>
      </div>
    </div>
  `;
}
```

## 5. Gateway API 호출

### 5.1 크론 상태 조회
```typescript
// ui/src/ui/controllers/cron.ts
export async function loadCron(state: CronState) {
  const res = await state.client.request("cron.status", {});
  
  state.cronStatus = res.status ?? null;
  state.cronJobs = Array.isArray(res.jobs) ? res.jobs : [];
}
```

### 5.2 작업 추가
```typescript
export async function addCronJob(
  state: CronState,
  job: {
    name: string;
    schedule: string;
    channel?: string;
    message?: string;
    enabled?: boolean;
  }
) {
  await state.client.request("cron.add", {
    name: job.name,
    schedule: job.schedule,
    channel: job.channel,
    message: job.message,
    enabled: job.enabled ?? true,
  });
}
```

### 5.3 작업 토글
```typescript
export async function toggleCronJob(
  state: CronState,
  jobId: string,
  enabled: boolean
) {
  await state.client.request("cron.toggle", {
    jobId,
    enabled,
  });
}
```

### 5.4 작업 즉시 실행
```typescript
export async function runCronJob(
  state: CronState,
  jobId: string
) {
  await state.client.request("cron.run", {
    jobId,
  });
}
```

### 5.5 작업 삭제
```typescript
export async function removeCronJob(
  state: CronState,
  jobId: string
) {
  await state.client.request("cron.remove", {
    jobId,
  });
}
```

### 5.6 실행 히스토리 조회
```typescript
export async function loadCronRuns(
  state: CronState,
  jobId: string
) {
  const res = await state.client.request("cron.runs", {
    jobId,
    limit: 50,
  });
  
  state.cronRuns = Array.isArray(res.runs) ? res.runs : [];
}
```

## 6. Cron 타입

### 6.1 CronJob
```typescript
// ui/src/ui/types.ts
type CronJob = {
  id: string;
  name: string;
  schedule: string;  // Cron 표현식 (예: "0 9 * * *")
  channel?: string;  // 채널 (예: "whatsapp", "telegram", "last")
  message?: string;  // 전송할 메시지
  enabled: boolean;
  nextRunAtMs?: number | null;  // 다음 실행 시간
  lastRunAtMs?: number | null;  // 마지막 실행 시간
};
```

### 6.2 CronStatus
```typescript
type CronStatus = {
  enabled: boolean;
  jobs: number;
  nextWakeAtMs?: number | null;
};
```

### 6.3 CronRunLogEntry
```typescript
type CronRunLogEntry = {
  runId: string;
  jobId: string;
  startedAt: number;
  completedAt?: number | null;
  status: "success" | "error" | "timeout";
  error?: string | null;
  sessionKey?: string | null;
};
```

## 7. Cron 표현식

### 7.1 형식
```
분 시 일 월 요일
* * * * *
```

### 7.2 예시
- `0 9 * * *`: 매일 오전 9시
- `0 */6 * * *`: 6시간마다
- `0 0 * * 1`: 매주 월요일 자정
- `30 14 * * *`: 매일 오후 2시 30분

## 8. 포맷팅 함수

### 8.1 스케줄 포맷
```typescript
// ui/src/ui/presenter.ts
export function formatCronSchedule(schedule: string): string {
  // Cron 표현식을 읽기 쉬운 형식으로 변환
  // 예: "0 9 * * *" → "Daily at 09:00"
  return humanizeCronExpression(schedule);
}
```

### 8.2 상태 포맷
```typescript
export function formatCronState(job: CronJob): string {
  if (!job.enabled) return "disabled";
  if (job.nextRunAtMs) {
    const now = Date.now();
    if (job.nextRunAtMs <= now) return "overdue";
    return "scheduled";
  }
  return "unknown";
}
```

### 8.3 다음 실행 시간 포맷
```typescript
export function formatNextRun(nextWakeAtMs: number | null): string {
  if (!nextWakeAtMs) return "n/a";
  const now = Date.now();
  if (nextWakeAtMs <= now) return "overdue";
  
  const ms = nextWakeAtMs - now;
  return formatDurationMs(ms);
}
```

### 8.4 페이로드 포맷
```typescript
export function formatCronPayload(job: CronJob): string {
  const parts: string[] = [];
  if (job.channel) parts.push(`channel: ${job.channel}`);
  if (job.message) parts.push(`message: ${job.message}`);
  return parts.join(", ") || "none";
}
```

## 9. 채널 옵션

### 9.1 채널 목록
```typescript
function buildChannelOptions(props: CronProps): string[] {
  const options = ["last", ...props.channels.filter(Boolean)];
  const current = props.form.channel?.trim();
  if (current && !options.includes(current)) {
    options.push(current);
  }
  return [...new Set(options)];
}
```

### 9.2 채널 라벨
```typescript
function resolveChannelLabel(props: CronProps, channel: string): string {
  if (channel === "last") return "last";
  const meta = props.channelMeta?.find(entry => entry.id === channel);
  if (meta?.label) return meta.label;
  return props.channelLabels?.[channel] ?? channel;
}
```

## 10. 실행 히스토리

### 10.1 히스토리 표시
```typescript
function renderRunHistory(runs: CronRunLogEntry[]) {
  return html`
    <div class="card">
      <div class="card-title">Run History</div>
      
      <div class="list">
        {runs.map(run => (
          <div class="list-item">
            <div class="list-title">
              {formatTime(run.startedAt)}
            </div>
            <div class="list-sub">
              Status: {run.status}
              {run.error && ` - ${run.error}`}
            </div>
            {run.sessionKey && (
              <div class="muted">
                Session: {run.sessionKey}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  `;
}
```

## 11. 사용 시나리오

### 11.1 새 작업 추가
1. Cron Jobs 페이지 열기
2. "New Job" 카드에서 작업 정보 입력
   - 이름: "Daily Report"
   - 스케줄: "0 9 * * *"
   - 채널: "whatsapp"
   - 메시지: "Good morning! Here's your daily report."
3. "Add Job" 버튼 클릭
4. 작업이 목록에 추가됨

### 11.2 작업 즉시 실행
1. Cron Jobs 페이지 열기
2. 작업 행에서 "Run Now" 버튼 클릭
3. 작업이 즉시 실행됨
4. 실행 결과 확인

### 11.3 작업 활성화/비활성화
1. Cron Jobs 페이지 열기
2. 작업 행에서 "Enable"/"Disable" 버튼 클릭
3. 작업 상태 변경 확인

### 11.4 실행 히스토리 확인
1. Cron Jobs 페이지 열기
2. 작업 행에서 "History" 버튼 클릭
3. 실행 히스토리 모달 표시
4. 각 실행의 상태 및 에러 확인

## 12. 코드 구조

### 12.1 주요 파일
- `ui/src/ui/views/cron.ts`: Cron Jobs 뷰 렌더링
- `ui/src/ui/controllers/cron.ts`: Cron API 호출
- `ui/src/ui/presenter.ts`: 포맷팅 함수
- `ui/src/ui/types.ts`: 타입 정의

### 12.2 Props 타입
```typescript
export type CronProps = {
  loading: boolean;
  status: CronStatus | null;
  jobs: CronJob[];
  error: string | null;
  busy: boolean;
  form: CronFormState;
  channels: string[];
  channelLabels?: Record<string, string>;
  channelMeta?: ChannelUiMetaEntry[];
  runsJobId: string | null;
  runs: CronRunLogEntry[];
  onFormChange: (patch: Partial<CronFormState>) => void;
  onRefresh: () => void;
  onAdd: () => void;
  onToggle: (job: CronJob, enabled: boolean) => void;
  onRun: (job: CronJob) => void;
  onRemove: (job: CronJob) => void;
  onLoadRuns: (jobId: string) => void;
};
```

## 13. 향후 개선 사항

- Cron 표현식 빌더 UI
- 작업 템플릿
- 작업 그룹 관리
- 실행 통계 그래프
- 작업 알림 설정
