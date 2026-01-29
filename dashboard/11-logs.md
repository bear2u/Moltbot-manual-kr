---
layout: default
title: Logs
---

# Logs 기능 상세 분석

**작성일**: 2026-01-28  
**모듈**: `ui/src/ui/views/logs.ts`, `ui/src/ui/controllers/logs.ts`

## 1. 개요

Logs 페이지는 Gateway의 파일 로그를 실시간으로 조회할 수 있는 인터페이스입니다. JSONL 형식의 로그를 필터링하고 내보낼 수 있습니다.

## 2. 주요 기능

### 2.1 로그 조회
- Gateway 파일 로그 실시간 조회
- 자동 팔로우 모드
- 로그 레벨 필터링
- 텍스트 검색

### 2.2 로그 내보내기
- 필터링된 로그 내보내기
- 전체 로그 내보내기
- 텍스트 형식으로 다운로드

## 3. UI 구조

### 3.1 메인 카드
```typescript
// ui/src/ui/views/logs.ts
<section class="card">
  <div class="card-title">Logs</div>
  <div class="card-sub">
    Gateway file logs (JSONL).
  </div>
  
  {/* 액션 버튼 */}
  <div class="row">
    <button @click={onRefresh}>
      {loading ? "Loading…" : "Refresh"}
    </button>
    <button 
      @click={() => onExport(filtered.map(e => e.raw), exportLabel)}
      disabled={filtered.length === 0}
    >
      Export {exportLabel}
    </button>
  </div>
  
  {/* 필터 */}
  <div class="filters">
    {/* 텍스트 검색 */}
    <label>
      <span>Filter</span>
      <input
        value={filterText}
        placeholder="Search logs"
      />
    </label>
    
    {/* 자동 팔로우 */}
    <label class="checkbox">
      <span>Auto-follow</span>
      <input
        type="checkbox"
        checked={autoFollow}
      />
    </label>
  </div>
  
  {/* 레벨 필터 */}
  <div class="chip-row">
    {LEVELS.map(level => (
      <label class="chip log-chip ${level}">
        <input
          type="checkbox"
          checked={levelFilters[level]}
        />
        {level}
      </label>
    ))}
  </div>
  
  {/* 로그 목록 */}
  <div class="log-list" @scroll={onScroll}>
    {filtered.map(entry => renderLogEntry(entry))}
  </div>
  
  {/* 잘림 표시 */}
  {truncated && (
    <div class="callout warn">
      Logs truncated. Use filters to narrow down.
    </div>
  )}
</section>
```

## 4. 로그 엔트리 렌더링

### 4.1 로그 행 구조
```typescript
function renderLogEntry(entry: LogEntry) {
  return html`
    <div class="log-entry log-entry--${entry.level || "info"}">
      {/* 타임스탬프 */}
      <div class="log-time">
        {formatTime(entry.timestamp)}
      </div>
      
      {/* 레벨 */}
      <div class="log-level">
        {entry.level || "info"}
      </div>
      
      {/* 서브시스템 */}
      {entry.subsystem && (
        <div class="log-subsystem">
          {entry.subsystem}
        </div>
      )}
      
      {/* 메시지 */}
      <div class="log-message">
        {entry.message}
      </div>
      
      {/* 원본 (전체 JSON) */}
      <details class="log-raw">
        <summary>Raw</summary>
        <pre class="code-block">
          {entry.raw}
        </pre>
      </details>
    </div>
  `;
}
```

## 5. Gateway API 호출

### 5.1 로그 조회
```typescript
// ui/src/ui/controllers/logs.ts
export async function loadLogs(
  state: LogsState,
  options: {
    filterText?: string;
    levelFilters?: Record<LogLevel, boolean>;
    limit?: number;
    follow?: boolean;
  }
) {
  const res = await state.client.request("logs.tail", {
    limit: options.limit ?? 1000,
    follow: options.follow ?? false,
  });
  
  state.logEntries = Array.isArray(res.entries) ? res.entries : [];
  state.logTruncated = res.truncated ?? false;
  state.logFile = res.file ?? null;
}
```

## 6. 로그 타입

### 6.1 LogEntry
```typescript
// ui/src/ui/types.ts
type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

type LogEntry = {
  timestamp?: string | null;  // ISO 8601 형식
  level?: LogLevel | null;
  subsystem?: string | null;
  message?: string | null;
  raw: string;  // 원본 JSONL 라인
};
```

## 7. 필터링

### 7.1 텍스트 검색
```typescript
function matchesFilter(entry: LogEntry, needle: string): boolean {
  if (!needle) return true;
  
  const haystack = [
    entry.message,
    entry.subsystem,
    entry.raw,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  
  return haystack.includes(needle.toLowerCase());
}
```

### 7.2 레벨 필터링
```typescript
const filtered = entries.filter(entry => {
  // 레벨 필터
  if (entry.level && !levelFilters[entry.level]) {
    return false;
  }
  
  // 텍스트 검색
  return matchesFilter(entry, filterText);
});
```

## 8. 자동 팔로우

### 8.1 팔로우 모드
```typescript
if (autoFollow) {
  // 로그 목록 하단으로 자동 스크롤
  scrollToBottom();
  
  // 주기적으로 새 로그 조회
  const interval = setInterval(() => {
    loadLogs({ follow: true });
  }, 2000);
  
  return () => clearInterval(interval);
}
```

## 9. 로그 내보내기

### 9.1 내보내기 함수
```typescript
export function exportLogs(
  entries: LogEntry[],
  label: string
) {
  const text = entries.map(e => e.raw).join("\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `moltbot-logs-${label}-${Date.now()}.txt`;
  a.click();
  
  URL.revokeObjectURL(url);
}
```

## 10. 시간 포맷팅

### 10.1 시간 포맷
```typescript
function formatTime(value?: string | null): string {
  if (!value) return "";
  
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  
  return date.toLocaleTimeString();
}
```

## 11. 레벨별 스타일링

### 11.1 레벨 클래스
```typescript
const levelClasses = {
  trace: "log-entry--trace",
  debug: "log-entry--debug",
  info: "log-entry--info",
  warn: "log-entry--warn",
  error: "log-entry--error",
  fatal: "log-entry--fatal",
};
```

## 12. 사용 시나리오

### 12.1 로그 실시간 모니터링
1. Logs 페이지 열기
2. "Auto-follow" 체크박스 활성화
3. 실시간 로그 확인
4. 자동 스크롤 확인

### 12.2 에러 로그 필터링
1. Logs 페이지 열기
2. 레벨 필터에서 "error", "fatal"만 선택
3. 에러 로그만 표시됨
4. 특정 에러 검색

### 12.3 로그 내보내기
1. Logs 페이지 열기
2. 필요한 필터 적용
3. "Export filtered" 버튼 클릭
4. 로그 파일 다운로드

### 12.4 특정 서브시스템 로그 확인
1. Logs 페이지 열기
2. 필터에 서브시스템 이름 입력 (예: "gateway")
3. 해당 서브시스템 로그만 표시됨

## 13. 코드 구조

### 13.1 주요 파일
- `ui/src/ui/views/logs.ts`: Logs 뷰 렌더링
- `ui/src/ui/controllers/logs.ts`: Logs API 호출
- `ui/src/ui/format.ts`: 포맷팅 함수
- `ui/src/ui/types.ts`: 타입 정의

### 13.2 Props 타입
```typescript
export type LogsProps = {
  loading: boolean;
  error: string | null;
  file: string | null;
  entries: LogEntry[];
  filterText: string;
  levelFilters: Record<LogLevel, boolean>;
  autoFollow: boolean;
  truncated: boolean;
  onFilterTextChange: (next: string) => void;
  onLevelToggle: (level: LogLevel, enabled: boolean) => void;
  onToggleAutoFollow: (next: boolean) => void;
  onRefresh: () => void;
  onExport: (lines: string[], label: string) => void;
  onScroll: (event: Event) => void;
};
```

## 14. 향후 개선 사항

- 로그 레벨별 통계
- 로그 시간 범위 선택
- 로그 하이라이팅
- 로그 북마크
- 로그 분석 도구
