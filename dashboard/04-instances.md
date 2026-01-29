---
layout: default
title: Instances
---

# Instances 기능 상세 분석

**작성일**: 2026-01-28  
**모듈**: `ui/src/ui/views/instances.ts`, `ui/src/ui/controllers/presence.ts`

## 1. 개요

Instances 페이지는 Gateway에 연결된 모든 클라이언트와 노드의 Presence 정보를 표시합니다. 각 인스턴스의 호스트, 역할, 플랫폼, 마지막 활동 시간 등을 확인할 수 있습니다.

## 2. 주요 기능

### 2.1 Presence 목록
- 연결된 모든 인스턴스 표시
- 호스트 정보
- 역할 및 스코프
- 플랫폼 정보
- 마지막 활동 시간

### 2.2 실시간 업데이트
- Presence 이벤트 구독
- 자동 새로고침
- 상태 변경 감지

## 3. UI 구조

### 3.1 메인 카드
```typescript
// ui/src/ui/views/instances.ts
<section class="card">
  <div class="card-title">Connected Instances</div>
  <div class="card-sub">
    Presence beacons from the gateway and clients.
  </div>
  
  {/* 새로고침 버튼 */}
  <button @click={onRefresh}>
    {loading ? "Loading…" : "Refresh"}
  </button>
  
  {/* 에러 표시 */}
  {lastError && (
    <div class="callout danger">{lastError}</div>
  )}
  
  {/* 상태 메시지 */}
  {statusMessage && (
    <div class="callout">{statusMessage}</div>
  )}
  
  {/* 인스턴스 목록 */}
  <div class="list">
    {entries.length === 0 ? (
      <div class="muted">No instances reported yet.</div>
    ) : (
      entries.map(entry => renderEntry(entry))
    )}
  </div>
</section>
```

## 4. Presence Entry 렌더링

### 4.1 Entry 구조
```typescript
function renderEntry(entry: PresenceEntry) {
  return html`
    <div class="list-item">
      <div class="list-main">
        {/* 호스트 이름 */}
        <div class="list-title">
          {entry.host ?? "unknown host"}
        </div>
        
        {/* 요약 정보 */}
        <div class="list-sub">
          {formatPresenceSummary(entry)}
        </div>
        
        {/* 칩 (역할, 플랫폼 등) */}
        <div class="chip-row">
          <span class="chip">{entry.mode ?? "unknown"}</span>
          {entry.roles?.map(role => 
            html`<span class="chip">${role}</span>`
          )}
          {entry.scopes && entry.scopes.length > 0 && (
            <span class="chip">
              {entry.scopes.length > 3
                ? `${entry.scopes.length} scopes`
                : `scopes: ${entry.scopes.join(", ")}`}
            </span>
          )}
          {entry.platform && (
            <span class="chip">{entry.platform}</span>
          )}
          {entry.deviceFamily && (
            <span class="chip">{entry.deviceFamily}</span>
          )}
          {entry.modelIdentifier && (
            <span class="chip">{entry.modelIdentifier}</span>
          )}
          {entry.version && (
            <span class="chip">{entry.version}</span>
          )}
        </div>
      </div>
      
      {/* 메타 정보 */}
      <div class="list-meta">
        <div>{formatPresenceAge(entry)}</div>
        <div class="muted">
          Last input {formatLastInput(entry.lastInputSeconds)}
        </div>
        <div class="muted">
          Reason {entry.reason ?? ""}
        </div>
      </div>
    </div>
  `;
}
```

## 5. Presence Entry 타입

### 5.1 타입 정의
```typescript
// ui/src/ui/types.ts
type PresenceEntry = {
  host?: string;
  mode?: string;  // "cli", "node", "control-ui", etc.
  roles?: string[];  // ["operator", "node"], etc.
  scopes?: string[];  // ["browser", "camera"], etc.
  platform?: string;  // "darwin", "linux", "win32"
  deviceFamily?: string;  // "macos", "ios", "android"
  modelIdentifier?: string;  // "MacBookPro18,1"
  version?: string;  // 클라이언트 버전
  lastInputSeconds?: number;  // 마지막 입력으로부터 경과 시간
  reason?: string;  // 연결 이유
  timestamp?: number;  // Presence 비콘 타임스탬프
};
```

## 6. Gateway API 호출

### 6.1 Presence 목록 조회
```typescript
// ui/src/ui/controllers/presence.ts
export async function loadPresence(state: PresenceState) {
  if (!state.client || !state.connected) return;
  
  state.presenceLoading = true;
  state.presenceError = null;
  
  try {
    const res = await state.client.request("system-presence", {});
    
    state.presenceEntries = Array.isArray(res.entries) 
      ? res.entries 
      : [];
    state.presenceStatus = res.status ?? null;
  } catch (err) {
    state.presenceError = String(err);
  } finally {
    state.presenceLoading = false;
  }
}
```

### 6.2 Presence 이벤트 구독
```typescript
// Gateway에서 전송되는 이벤트
{
  type: "event",
  event: "presence",
  payload: {
    entries: PresenceEntry[];
    status?: string;
  }
}
```

## 7. 포맷팅 함수

### 7.1 Presence 요약
```typescript
// ui/src/ui/presenter.ts
export function formatPresenceSummary(entry: PresenceEntry): string {
  const parts: string[] = [];
  
  if (entry.mode) parts.push(entry.mode);
  if (entry.roles && entry.roles.length > 0) {
    parts.push(entry.roles.join(", "));
  }
  
  return parts.join(" · ") || "unknown";
}
```

### 7.2 Presence Age
```typescript
export function formatPresenceAge(entry: PresenceEntry): string {
  if (!entry.timestamp) return "unknown";
  
  const elapsed = Date.now() - entry.timestamp;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

### 7.3 Last Input
```typescript
function formatLastInput(lastInputSeconds?: number): string {
  if (lastInputSeconds == null) return "n/a";
  return `${lastInputSeconds}s ago`;
}
```

## 8. 필터링 및 정렬

### 8.1 시간 기반 필터링
- 최근 5분간 활동한 인스턴스만 표시 (기본)
- 설정 가능한 시간 범위

### 8.2 정렬
- 최근 활동 순
- 호스트 이름 순
- 역할 순

## 9. 역할 및 스코프

### 9.1 역할 (Roles)
- **operator**: 운영자 클라이언트
- **node**: 디바이스 노드
- **control-ui**: 웹 대시보드
- **cli**: CLI 클라이언트

### 9.2 스코프 (Scopes)
- **browser**: 브라우저 제어 가능
- **camera**: 카메라 접근 가능
- **screen**: 화면 녹화 가능
- **location**: 위치 정보 접근 가능
- **canvas**: Canvas 제어 가능

## 10. 플랫폼 정보

### 10.1 플랫폼 타입
- **darwin**: macOS
- **linux**: Linux
- **win32**: Windows
- **ios**: iOS
- **android**: Android

### 10.2 디바이스 패밀리
- **macos**: macOS
- **ios**: iOS
- **android**: Android
- **linux**: Linux
- **windows**: Windows

### 10.3 모델 식별자
- macOS: "MacBookPro18,1"
- iOS: "iPhone15,2"
- Android: 기기 모델명

## 11. 상태 메시지

### 11.1 상태 타입
```typescript
type PresenceStatus = 
  | "ok"
  | "degraded"
  | "error"
  | null;
```

### 11.2 상태 표시
```typescript
{statusMessage && (
  <div class="callout">
    {statusMessage}
  </div>
)}
```

## 12. 에러 처리

### 12.1 에러 표시
```typescript
{lastError && (
  <div class="callout danger">
    {lastError}
  </div>
)}
```

### 12.2 빈 목록
```typescript
{entries.length === 0 && (
  <div class="muted">
    No instances reported yet.
  </div>
)}
```

## 13. 새로고침

### 13.1 수동 새로고침
```typescript
<button @click={onRefresh}>
  {loading ? "Loading…" : "Refresh"}
</button>
```

### 13.2 자동 새로고침
- Presence 이벤트 구독으로 자동 업데이트
- 또는 주기적 폴링 (설정 가능)

## 14. 사용 시나리오

### 14.1 연결된 인스턴스 확인
1. Instances 페이지 열기
2. 연결된 모든 인스턴스 목록 확인
3. 각 인스턴스의 역할 및 플랫폼 확인
4. 마지막 활동 시간 확인

### 14.2 노드 상태 확인
1. Instances 페이지 열기
2. 역할이 "node"인 인스턴스 확인
3. 스코프 확인 (browser, camera, screen 등)
4. 연결 상태 확인

### 14.3 문제 진단
1. Instances 페이지 열기
2. 특정 인스턴스가 표시되지 않는지 확인
3. 마지막 활동 시간이 오래된 인스턴스 확인
4. 에러 메시지 확인

## 15. 코드 구조

### 15.1 주요 파일
- `ui/src/ui/views/instances.ts`: Instances 뷰 렌더링
- `ui/src/ui/controllers/presence.ts`: Presence API 호출
- `ui/src/ui/presenter.ts`: 포맷팅 함수
- `ui/src/ui/types.ts`: 타입 정의

### 15.2 Props 타입
```typescript
export type InstancesProps = {
  loading: boolean;
  entries: PresenceEntry[];
  lastError: string | null;
  statusMessage: string | null;
  onRefresh: () => void;
};
```

## 16. 향후 개선 사항

- 인스턴스별 상세 정보 모달
- 인스턴스 필터링 및 검색
- 인스턴스별 통계 그래프
- 인스턴스 연결/해제 알림
- 인스턴스별 로그 뷰어
