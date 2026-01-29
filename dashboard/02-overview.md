---
layout: default
title: Overview
---

# Overview 기능 상세 분석

**작성일**: 2026-01-28  
**모듈**: `ui/src/ui/views/overview.ts`

## 1. 개요

Overview 페이지는 Gateway의 전반적인 상태와 접근 설정을 한눈에 볼 수 있는 대시보드입니다. Gateway 연결 상태, 스냅샷 정보, 인스턴스/세션/크론 통계를 제공합니다.

## 2. 주요 섹션

### 2.1 Gateway Access
- **목적**: Gateway 연결 설정 및 인증
- **기능**:
  - WebSocket URL 설정
  - Gateway Token 입력
  - Password 입력 (저장되지 않음)
  - Default Session Key 설정
  - Connect/Refresh 버튼

### 2.2 Snapshot
- **목적**: Gateway 핸드셰이크 정보 표시
- **정보**:
  - 연결 상태 (Connected/Disconnected)
  - Uptime (가동 시간)
  - Tick Interval (틱 간격)
  - Last Channels Refresh (마지막 채널 새로고침 시간)

### 2.3 통계 카드
- **Instances**: 최근 5분간 Presence 비콘 수
- **Sessions**: Gateway가 추적하는 세션 키 수
- **Cron**: 크론 작업 활성화 상태 및 다음 실행 시간

### 2.4 Notes
- **목적**: 원격 제어 설정에 대한 빠른 참고사항
- **내용**:
  - Tailscale serve 권장사항
  - 세션 관리 팁
  - 크론 작업 팁

## 3. UI 구조

### 3.1 Gateway Access 카드
```typescript
// ui/src/ui/views/overview.ts
<div class="card">
  <div class="card-title">Gateway Access</div>
  <div class="card-sub">Where the dashboard connects and how it authenticates.</div>
  
  <div class="form-grid">
    <label>WebSocket URL</label>
    <input value={gatewayUrl} />
    
    <label>Gateway Token</label>
    <input value={token} />
    
    <label>Password (not stored)</label>
    <input type="password" value={password} />
    
    <label>Default Session Key</label>
    <input value={sessionKey} />
  </div>
  
  <button @click={onConnect}>Connect</button>
  <button @click={onRefresh}>Refresh</button>
</div>
```

### 3.2 Snapshot 카드
```typescript
<div class="card">
  <div class="card-title">Snapshot</div>
  <div class="card-sub">Latest gateway handshake information.</div>
  
  <div class="stat-grid">
    <div class="stat">
      <div class="stat-label">Status</div>
      <div class="stat-value">{connected ? "Connected" : "Disconnected"}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Uptime</div>
      <div class="stat-value">{uptime}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Tick Interval</div>
      <div class="stat-value">{tick}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Last Channels Refresh</div>
      <div class="stat-value">{lastChannelsRefresh}</div>
    </div>
  </div>
</div>
```

## 4. 데이터 소스

### 4.1 Hello 응답
```typescript
// Gateway WebSocket 연결 시 받는 초기 응답
type GatewayHelloOk = {
  snapshot: {
    uptimeMs?: number;
    policy?: {
      tickIntervalMs?: number;
    };
  };
};
```

### 4.2 상태 계산
```typescript
const uptime = snapshot?.uptimeMs 
  ? formatDurationMs(snapshot.uptimeMs) 
  : "n/a";

const tick = snapshot?.policy?.tickIntervalMs
  ? `${snapshot.policy.tickIntervalMs}ms`
  : "n/a";
```

## 5. 인증 힌트

### 5.1 인증 실패 시
```typescript
const authHint = (() => {
  if (connected || !lastError) return null;
  const lower = lastError.toLowerCase();
  const authFailed = lower.includes("unauthorized") 
    || lower.includes("connect failed");
  
  if (!authFailed) return null;
  
  // Token/Password 없음
  if (!hasToken && !hasPassword) {
    return html`
      <div class="muted">
        This gateway requires auth. Add a token or password, then click Connect.
        <div>
          <span class="mono">moltbot dashboard --no-open</span> → tokenized URL
        </div>
      </div>
    `;
  }
  
  // 인증 실패
  return html`
    <div class="muted">
      Auth failed. Re-copy a tokenized URL with
      <span class="mono">moltbot dashboard --no-open</span>
    </div>
  `;
})();
```

### 5.2 비보안 컨텍스트 힌트
```typescript
const insecureContextHint = (() => {
  if (connected || !lastError) return null;
  const isSecureContext = window.isSecureContext;
  if (isSecureContext !== false) return null;
  
  return html`
    <div class="muted">
      This page is HTTP, so the browser blocks device identity.
      Use HTTPS (Tailscale Serve) or open
      <span class="mono">http://127.0.0.1:18789</span> on the gateway host.
    </div>
  `;
})();
```

## 6. 통계 데이터

### 6.1 Instances
```typescript
// Presence 엔트리 수 (최근 5분)
const presenceCount = presenceEntries.length;
```

### 6.2 Sessions
```typescript
// Sessions 목록에서 세션 수
const sessionsCount = sessionsResult?.sessions?.length ?? null;
```

### 6.3 Cron
```typescript
// Cron 상태
const cronEnabled = cronStatus?.enabled ?? null;
const cronNext = cronStatus?.nextWakeAtMs ?? null;
```

## 7. 이벤트 처리

### 7.1 Connect 버튼
```typescript
onConnect: () => {
  // Gateway WebSocket 연결 시도
  // 설정된 URL, Token, Password 사용
  connectGateway({
    url: settings.gatewayUrl,
    token: settings.token,
    password: password,
  });
}
```

### 7.2 Refresh 버튼
```typescript
onRefresh: () => {
  // 현재 상태 새로고침
  loadOverview();
  loadPresence();
  loadSessions();
  loadCron();
}
```

## 8. 포맷팅 함수

### 8.1 Uptime 포맷
```typescript
// ui/src/ui/format.ts
export function formatDurationMs(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
```

### 8.2 시간 경과 포맷
```typescript
export function formatAgo(timestamp: number): string {
  const elapsed = Date.now() - timestamp;
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

### 8.3 다음 실행 시간 포맷
```typescript
// ui/src/ui/presenter.ts
export function formatNextRun(nextWakeAtMs: number | null): string {
  if (!nextWakeAtMs) return "n/a";
  const now = Date.now();
  if (nextWakeAtMs <= now) return "overdue";
  
  const ms = nextWakeAtMs - now;
  return formatDurationMs(ms);
}
```

## 9. 설정 저장

### 9.1 LocalStorage
```typescript
// ui/src/ui/storage.ts
export function saveSettings(settings: UiSettings) {
  localStorage.setItem("moltbot-ui-settings", JSON.stringify(settings));
}

export function loadSettings(): UiSettings {
  const stored = localStorage.getItem("moltbot-ui-settings");
  if (!stored) return DEFAULT_SETTINGS;
  return JSON.parse(stored);
}
```

### 9.2 설정 항목
- `gatewayUrl`: WebSocket URL
- `token`: Gateway Token
- `sessionKey`: 기본 세션 키
- `theme`: 테마 설정
- `splitRatio`: 패널 분할 비율

## 10. 에러 처리

### 10.1 연결 에러 표시
```typescript
{lastError ? (
  <div class="callout danger">
    <div>{lastError}</div>
    {authHint}
    {insecureContextHint}
  </div>
) : (
  <div class="callout">
    Use Channels to link WhatsApp, Telegram, Discord, Signal, or iMessage.
  </div>
)}
```

### 10.2 에러 타입
- **Unauthorized**: 인증 실패
- **Connect failed**: 연결 실패
- **Secure context required**: 비보안 컨텍스트

## 11. Notes 섹션

### 11.1 Tailscale serve
```typescript
<div>
  <div class="note-title">Tailscale serve</div>
  <div class="muted">
    Prefer serve mode to keep the gateway on loopback with tailnet auth.
  </div>
</div>
```

### 11.2 Session hygiene
```typescript
<div>
  <div class="note-title">Session hygiene</div>
  <div class="muted">
    Use /new or sessions.patch to reset context.
  </div>
</div>
```

### 11.3 Cron reminders
```typescript
<div>
  <div class="note-title">Cron reminders</div>
  <div class="muted">
    Use isolated sessions for recurring runs.
  </div>
</div>
```

## 12. 사용 시나리오

### 12.1 첫 접속
1. Overview 페이지 열기
2. Gateway URL 확인 (기본: `ws://127.0.0.1:18789`)
3. Token 입력 (또는 `moltbot dashboard` 명령으로 토큰 URL 사용)
4. Connect 버튼 클릭
5. 연결 상태 확인

### 12.2 원격 접속
1. SSH 터널 설정 또는 Tailscale Serve 사용
2. Gateway URL 변경
3. Token 입력
4. Connect 버튼 클릭

### 12.3 상태 모니터링
1. Overview 페이지에서 실시간 상태 확인
2. Uptime, Tick Interval 확인
3. Instances, Sessions, Cron 통계 확인
4. Refresh 버튼으로 최신 정보 갱신

## 13. 코드 구조

### 13.1 주요 파일
- `ui/src/ui/views/overview.ts`: Overview 뷰 렌더링
- `ui/src/ui/app.ts`: Overview 상태 관리
- `ui/src/ui/app-gateway.ts`: Gateway 연결 로직
- `ui/src/ui/format.ts`: 포맷팅 함수
- `ui/src/ui/presenter.ts`: 프레젠테이션 함수

### 13.2 Props 타입
```typescript
export type OverviewProps = {
  connected: boolean;
  hello: GatewayHelloOk | null;
  settings: UiSettings;
  password: string;
  lastError: string | null;
  presenceCount: number;
  sessionsCount: number | null;
  cronEnabled: boolean | null;
  cronNext: number | null;
  lastChannelsRefresh: number | null;
  onSettingsChange: (next: UiSettings) => void;
  onPasswordChange: (next: string) => void;
  onSessionKeyChange: (next: string) => void;
  onConnect: () => void;
  onRefresh: () => void;
};
```

## 14. 향후 개선 사항

- 실시간 상태 업데이트 (폴링 대신 이벤트)
- 상태 히스토리 그래프
- 알림 설정
- 빠른 액션 버튼
- 상태 내보내기
