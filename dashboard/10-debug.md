---
layout: default
title: Debug
---

# Debug 기능 상세 분석

**작성일**: 2026-01-28  
**모듈**: `ui/src/ui/views/debug.ts`

## 1. 개요

Debug 페이지는 Gateway의 내부 상태를 확인하고, 수동으로 RPC 호출을 테스트할 수 있는 디버깅 인터페이스입니다. Gateway 스냅샷, 이벤트 로그, 보안 감사 정보를 확인할 수 있습니다.

## 2. 주요 기능

### 2.1 스냅샷
- Status 스냅샷
- Health 스냅샷
- Heartbeat 정보
- 보안 감사 요약

### 2.2 이벤트 로그
- Gateway 이벤트 실시간 표시
- 이벤트 페이로드 확인
- 이벤트 필터링

### 2.3 수동 RPC 호출
- Gateway 메서드 직접 호출
- JSON 파라미터 입력
- 결과 확인

## 3. UI 구조

### 3.1 스냅샷 카드
```typescript
// ui/src/ui/views/debug.ts
<div class="card">
  <div class="card-title">Snapshots</div>
  <div class="card-sub">
    Status, health, and heartbeat data.
  </div>
  
  <button @click={onRefresh}>
    {loading ? "Refreshing…" : "Refresh"}
  </button>
  
  <div class="stack">
    {/* Status */}
    <div>
      <div class="muted">Status</div>
      {securitySummary && (
        <div class="callout ${securityTone}">
          Security audit: {securityLabel}
          {info > 0 && ` · ${info} info`}
          <div>
            Run <span class="mono">moltbot security audit --deep</span> for details.
          </div>
        </div>
      )}
      <pre class="code-block">
        {JSON.stringify(status ?? {}, null, 2)}
      </pre>
    </div>
    
    {/* Health */}
    <div>
      <div class="muted">Health</div>
      <pre class="code-block">
        {JSON.stringify(health ?? {}, null, 2)}
      </pre>
    </div>
    
    {/* Heartbeat */}
    <div>
      <div class="muted">Last heartbeat</div>
      <pre class="code-block">
        {JSON.stringify(heartbeat ?? {}, null, 2)}
      </pre>
    </div>
  </div>
</div>
```

### 3.2 수동 RPC 카드
```typescript
<div class="card">
  <div class="card-title">Manual RPC</div>
  <div class="card-sub">
    Send a raw gateway method with JSON params.
  </div>
  
  <div class="form-grid">
    {/* 메서드 입력 */}
    <label>
      <span>Method</span>
      <input
        value={callMethod}
        placeholder="system-presence"
      />
    </label>
    
    {/* 파라미터 입력 */}
    <label>
      <span>Params (JSON)</span>
      <textarea
        value={callParams}
        rows="6"
      ></textarea>
    </label>
  </div>
  
  <button @click={onCall}>Call</button>
  
  {/* 결과 표시 */}
  {callResult && (
    <pre class="code-block">
      {callResult}
    </pre>
  )}
  
  {/* 에러 표시 */}
  {callError && (
    <div class="callout danger">
      {callError}
    </div>
  )}
</div>
```

### 3.3 이벤트 로그 카드
```typescript
<div class="card">
  <div class="card-title">Event Log</div>
  <div class="card-sub">
    Gateway events in real-time.
  </div>
  
  <div class="event-log">
    {eventLog.map(entry => renderEventEntry(entry))}
  </div>
</div>
```

## 4. Gateway API 호출

### 4.1 Status 조회
```typescript
// ui/src/ui/controllers/debug.ts
export async function loadStatus(state: DebugState) {
  const res = await state.client.request("status", {});
  
  state.debugStatus = res;
}
```

### 4.2 Health 조회
```typescript
export async function loadHealth(state: DebugState) {
  const res = await state.client.request("health", {});
  
  state.debugHealth = res;
}
```

### 4.3 Heartbeat 조회
```typescript
// Heartbeat는 이벤트로 수신
// 또는 status 응답에 포함될 수 있음
```

### 4.4 수동 RPC 호출
```typescript
export async function callMethod(
  state: DebugState,
  method: string,
  params: unknown
) {
  try {
    const res = await state.client.request(method, params);
    state.callResult = JSON.stringify(res, null, 2);
    state.callError = null;
  } catch (err) {
    state.callResult = null;
    state.callError = String(err);
  }
}
```

## 5. 보안 감사

### 5.1 보안 요약
```typescript
const securityAudit = status?.securityAudit;
const securitySummary = securityAudit?.summary ?? null;
const critical = securitySummary?.critical ?? 0;
const warn = securitySummary?.warn ?? 0;
const info = securitySummary?.info ?? 0;

const securityTone = critical > 0 
  ? "danger" 
  : warn > 0 
    ? "warn" 
    : "success";

const securityLabel = critical > 0
  ? `${critical} critical`
  : warn > 0
    ? `${warn} warnings`
    : "No critical issues";
```

### 5.2 보안 감사 표시
```typescript
{securitySummary && (
  <div class="callout ${securityTone}">
    Security audit: {securityLabel}
    {info > 0 && ` · ${info} info`}
    <div>
      Run <span class="mono">moltbot security audit --deep</span> for details.
    </div>
  </div>
)}
```

## 6. 이벤트 로그

### 6.1 이벤트 엔트리 타입
```typescript
// ui/src/ui/app-events.ts
type EventLogEntry = {
  timestamp: number;
  event: string;
  payload: unknown;
};
```

### 6.2 이벤트 렌더링
```typescript
function renderEventEntry(entry: EventLogEntry) {
  return html`
    <div class="event-entry">
      <div class="event-time">
        {formatTime(entry.timestamp)}
      </div>
      <div class="event-name">
        {entry.event}
      </div>
      <div class="event-payload">
        <pre class="code-block">
          {formatEventPayload(entry.payload)}
        </pre>
      </div>
    </div>
  `;
}
```

### 6.3 이벤트 포맷팅
```typescript
// ui/src/ui/presenter.ts
export function formatEventPayload(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  return JSON.stringify(payload, null, 2);
}
```

## 7. 수동 RPC 호출

### 7.1 메서드 입력
```typescript
<input
  value={callMethod}
  placeholder="system-presence"
  @input={(e) => onCallMethodChange(e.target.value)}
/>
```

### 7.2 파라미터 입력
```typescript
<textarea
  value={callParams}
  rows="6"
  @input={(e) => {
    const value = e.target.value;
    try {
      // JSON 검증
      JSON.parse(value);
      onCallParamsChange(value);
    } catch {
      // 유효하지 않은 JSON
    }
  }}
></textarea>
```

### 7.3 호출 실행
```typescript
async function handleCall() {
  let params: unknown = {};
  
  if (callParams.trim()) {
    try {
      params = JSON.parse(callParams);
    } catch (err) {
      callError = `Invalid JSON: ${String(err)}`;
      return;
    }
  }
  
  await callMethod(callMethod, params);
}
```

## 8. 사용 시나리오

### 8.1 Gateway 상태 확인
1. Debug 페이지 열기
2. "Refresh" 버튼 클릭
3. Status, Health, Heartbeat 스냅샷 확인
4. 보안 감사 요약 확인

### 8.2 수동 RPC 테스트
1. Debug 페이지 열기
2. "Manual RPC" 섹션에서 메서드 입력 (예: "system-presence")
3. 파라미터 입력 (JSON 형식, 선택사항)
4. "Call" 버튼 클릭
5. 결과 확인

### 8.3 이벤트 모니터링
1. Debug 페이지 열기
2. 이벤트 로그 확인
3. 실시간 이벤트 수신 확인

### 8.4 보안 감사 확인
1. Debug 페이지 열기
2. Status 스냅샷에서 보안 감사 요약 확인
3. 문제가 있으면 `moltbot security audit --deep` 실행

## 9. 코드 구조

### 9.1 주요 파일
- `ui/src/ui/views/debug.ts`: Debug 뷰 렌더링
- `ui/src/ui/controllers/debug.ts`: Debug API 호출
- `ui/src/ui/app-events.ts`: 이벤트 로그 관리
- `ui/src/ui/presenter.ts`: 포맷팅 함수
- `ui/src/ui/types.ts`: 타입 정의

### 9.2 Props 타입
```typescript
export type DebugProps = {
  loading: boolean;
  status: Record<string, unknown> | null;
  health: Record<string, unknown> | null;
  models: unknown[];
  heartbeat: unknown;
  eventLog: EventLogEntry[];
  callMethod: string;
  callParams: string;
  callResult: string | null;
  callError: string | null;
  onCallMethodChange: (next: string) => void;
  onCallParamsChange: (next: string) => void;
  onRefresh: () => void;
  onCall: () => void;
};
```

## 10. 향후 개선 사항

- 이벤트 필터링
- 이벤트 검색
- 이벤트 내보내기
- RPC 호출 히스토리
- 자동화된 테스트 스크립트
