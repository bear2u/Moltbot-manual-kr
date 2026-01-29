# Channels 기능 상세 분석

**작성일**: 2026-01-28  
**모듈**: `ui/src/ui/views/channels.ts`, `ui/src/ui/controllers/channels.ts`

## 1. 개요

Channels 페이지는 모든 메시징 채널의 상태를 확인하고 관리할 수 있는 인터페이스입니다. WhatsApp, Telegram, Discord, Slack, Signal, iMessage, Google Chat 등 각 채널의 연결 상태, 설정, 로그인을 관리합니다.

## 2. 지원 채널

### 2.1 Core 채널
- **WhatsApp**: Baileys 기반, QR 코드 로그인
- **Telegram**: Bot API, Bot Token 설정
- **Discord**: Bot API, Bot Token 설정
- **Slack**: Bolt API, Bot Token + App Token 설정
- **Signal**: signal-cli 기반
- **iMessage**: macOS 전용, imsg CLI
- **Google Chat**: Chat API

### 2.2 Extension 채널
- **Nostr**: Extension 플러그인
- **Matrix**: Extension 플러그인
- **Microsoft Teams**: Extension 플러그인
- 기타 플러그인 채널

## 3. UI 구조

### 3.1 채널 카드 그리드
```typescript
// ui/src/ui/views/channels.ts
<section class="grid grid-cols-2">
  {orderedChannels.map(channel => 
    renderChannel(channel.key, props, {
      whatsapp, telegram, discord, slack, signal, imessage, nostr
    })
  )}
</section>
```

### 3.2 채널 순서
- 활성화된 채널이 먼저 표시
- `channelMeta` 설정에 따른 순서
- 기본 순서: WhatsApp, Telegram, Discord, Slack, Signal, iMessage, Google Chat

## 4. 채널별 기능

### 4.1 WhatsApp
```typescript
// ui/src/ui/views/channels.whatsapp.ts
export function renderWhatsAppCard(
  status: WhatsAppStatus | undefined,
  props: ChannelsProps
) {
  return html`
    <div class="card">
      <div class="card-title">WhatsApp</div>
      
      {/* 연결 상태 */}
      {status?.connected ? (
        <div class="callout success">Connected</div>
      ) : (
        <div class="callout warn">Not connected</div>
      )}
      
      {/* QR 코드 로그인 */}
      {status?.qrDataUrl && (
        <img src={status.qrDataUrl} alt="QR Code" />
      )}
      
      {/* 로그인 버튼 */}
      <button @click={onStartLogin}>Start Login</button>
      <button @click={onLogout}>Logout</button>
      
      {/* 설정 */}
      <button @click={onEditConfig}>Edit Config</button>
    </div>
  `;
}
```

#### 주요 기능
- QR 코드 로그인 (`web.login.start`, `web.login.wait`)
- 연결 상태 확인
- 로그아웃 (`channels.logout`)
- 설정 편집 (`config.patch`)

### 4.2 Telegram
```typescript
// ui/src/ui/views/channels.telegram.ts
export function renderTelegramCard(
  status: TelegramStatus | undefined,
  props: ChannelsProps
) {
  return html`
    <div class="card">
      <div class="card-title">Telegram</div>
      
      {/* Bot Token 설정 */}
      <label>
        <span>Bot Token</span>
        <input 
          value={status?.botToken || ""}
          @input={onTokenChange}
        />
      </label>
      
      {/* 연결 상태 */}
      {status?.connected ? (
        <div class="callout success">Connected</div>
      ) : (
        <div class="callout warn">Not connected</div>
      )}
      
      {/* 설정 저장 */}
      <button @click={onSaveConfig}>Save</button>
    </div>
  `;
}
```

#### 주요 기능
- Bot Token 설정
- 연결 상태 확인
- 설정 저장

### 4.3 Discord
```typescript
// ui/src/ui/views/channels.discord.ts
export function renderDiscordCard(
  status: DiscordStatus | null,
  props: ChannelsProps
) {
  return html`
    <div class="card">
      <div class="card-title">Discord</div>
      
      {/* Bot Token 설정 */}
      <label>
        <span>Bot Token</span>
        <input value={status?.token || ""} />
      </label>
      
      {/* Guild 목록 */}
      {status?.guilds && (
        <div class="list">
          {status.guilds.map(guild => (
            <div class="list-item">{guild.name}</div>
          ))}
        </div>
      )}
      
      {/* 설정 편집 */}
      <button @click={onEditConfig}>Edit Config</button>
    </div>
  `;
}
```

#### 주요 기능
- Bot Token 설정
- Guild 목록 표시
- 설정 편집

### 4.4 Slack
```typescript
// ui/src/ui/views/channels.slack.ts
export function renderSlackCard(
  status: SlackStatus | null,
  props: ChannelsProps
) {
  return html`
    <div class="card">
      <div class="card-title">Slack</div>
      
      {/* Bot Token + App Token */}
      <label>
        <span>Bot Token</span>
        <input value={status?.botToken || ""} />
      </label>
      <label>
        <span>App Token</span>
        <input value={status?.appToken || ""} />
      </label>
      
      {/* 설정 편집 */}
      <button @click={onEditConfig}>Edit Config</button>
    </div>
  `;
}
```

#### 주요 기능
- Bot Token 및 App Token 설정
- 설정 편집

## 5. Gateway API 호출

### 5.1 채널 상태 조회
```typescript
// ui/src/ui/controllers/channels.ts
export async function loadChannels(
  state: ChannelsState,
  probe: boolean
) {
  const res = await state.client.request("channels.status", {
    probe,
    timeoutMs: 8000,
  });
  
  state.channelsSnapshot = res;
  state.channelsLastSuccess = Date.now();
}
```

### 5.2 WhatsApp 로그인 시작
```typescript
export async function startWhatsAppLogin(
  state: ChannelsState,
  force: boolean
) {
  const res = await state.client.request("web.login.start", {
    force,
    timeoutMs: 30000,
  });
  
  state.whatsappLoginMessage = res.message ?? null;
  state.whatsappLoginQrDataUrl = res.qrDataUrl ?? null;
}
```

### 5.3 WhatsApp 로그인 대기
```typescript
export async function waitWhatsAppLogin(state: ChannelsState) {
  const res = await state.client.request("web.login.wait", {
    timeoutMs: 120000,
  });
  
  state.whatsappLoginConnected = res.connected ?? null;
  if (res.connected) {
    state.whatsappLoginQrDataUrl = null;
  }
}
```

### 5.4 로그아웃
```typescript
export async function logoutWhatsApp(state: ChannelsState) {
  await state.client.request("channels.logout", {
    channel: "whatsapp",
  });
  
  state.whatsappLoginMessage = "Logged out.";
  state.whatsappLoginQrDataUrl = null;
  state.whatsappLoginConnected = null;
}
```

### 5.5 설정 저장
```typescript
// Config 페이지를 통해 설정 저장
await state.client.request("config.patch", {
  path: ["channels", "whatsapp", "botToken"],
  value: newToken,
});
```

## 6. 채널 상태 타입

### 6.1 공통 상태
```typescript
type ChannelStatus = {
  connected?: boolean;
  error?: string;
  lastError?: string;
  lastSuccess?: number;
};
```

### 6.2 WhatsApp 상태
```typescript
type WhatsAppStatus = {
  connected?: boolean;
  qrDataUrl?: string;
  message?: string;
  error?: string;
};
```

### 6.3 Telegram 상태
```typescript
type TelegramStatus = {
  connected?: boolean;
  botToken?: string;
  error?: string;
};
```

## 7. 채널 설정 편집

### 7.1 설정 폼
```typescript
// ui/src/ui/views/channels.config.ts
export function renderChannelConfigSection(
  channelKey: ChannelKey,
  props: ChannelsProps
) {
  return html`
    <div class="card">
      <div class="card-title">{channelKey} Config</div>
      
      {/* 설정 폼 렌더링 */}
      {renderConfigForm(channelKey, props)}
      
      {/* 저장 버튼 */}
      <button @click={onSave}>Save</button>
      <button @click={onReload}>Reload</button>
    </div>
  `;
}
```

### 7.2 설정 저장
```typescript
export async function saveChannelConfig(
  channelKey: ChannelKey,
  config: Record<string, unknown>
) {
  await state.client.request("config.patch", {
    path: ["channels", channelKey],
    value: config,
  });
}
```

## 8. 채널 Health 섹션

### 8.1 상태 스냅샷
```typescript
<section class="card">
  <div class="card-title">Channel health</div>
  <div class="card-sub">
    Channel status snapshots from the gateway.
  </div>
  
  {/* 마지막 성공 시간 */}
  <div class="muted">
    {lastSuccessAt ? formatAgo(lastSuccessAt) : "n/a"}
  </div>
  
  {/* 에러 표시 */}
  {lastError && (
    <div class="callout danger">{lastError}</div>
  )}
  
  {/* 전체 스냅샷 JSON */}
  <pre class="code-block">
    {JSON.stringify(snapshot, null, 2)}
  </pre>
</section>
```

## 9. 채널 계정 정보

### 9.1 계정 목록
```typescript
// channelAccounts에서 계정 정보 추출
const accounts = snapshot?.channelAccounts ?? null;

function renderChannelAccountCount(
  channelKey: ChannelKey,
  accounts: ChannelAccountSnapshot | null
): string {
  const count = accounts?.[channelKey]?.length ?? 0;
  return count > 0 ? `${count} accounts` : "no accounts";
}
```

## 10. Nostr 프로필 관리

### 10.1 프로필 폼
```typescript
// ui/src/ui/views/channels.nostr-profile-form.ts
export function renderNostrProfileForm(
  state: NostrProfileFormState,
  props: ChannelsProps
) {
  return html`
    <div class="card">
      <div class="card-title">Nostr Profile</div>
      
      {/* 프로필 필드 */}
      <label>
        <span>Name</span>
        <input value={state.name} />
      </label>
      
      <label>
        <span>About</span>
        <textarea value={state.about}></textarea>
      </label>
      
      {/* 저장/취소 */}
      <button @click={onSave}>Save</button>
      <button @click={onCancel}>Cancel</button>
    </div>
  `;
}
```

### 10.2 프로필 가져오기
```typescript
export async function importNostrProfile(
  npub: string
): Promise<NostrProfile> {
  const res = await state.client.request("channels.nostr.profile.import", {
    npub,
  });
  return res.profile;
}
```

## 11. 에러 처리

### 11.1 연결 에러
```typescript
{status?.error && (
  <div class="callout danger">
    {status.error}
  </div>
)}
```

### 11.2 타임아웃 처리
```typescript
try {
  await state.client.request("channels.status", {
    probe: true,
    timeoutMs: 8000,
  });
} catch (err) {
  if (err.message.includes("timeout")) {
    state.channelsError = "Channel probe timeout";
  } else {
    state.channelsError = String(err);
  }
}
```

## 12. 새로고침

### 12.1 수동 새로고침
```typescript
<button @click={onRefresh}>
  {loading ? "Refreshing..." : "Refresh"}
</button>
```

### 12.2 자동 새로고침
- Overview 페이지에서 주기적으로 호출
- 또는 사용자가 수동으로 Refresh 버튼 클릭

## 13. 사용 시나리오

### 13.1 WhatsApp 연결
1. Channels 페이지 열기
2. WhatsApp 카드에서 "Start Login" 클릭
3. QR 코드 표시 확인
4. WhatsApp 앱에서 QR 코드 스캔
5. "Wait Login" 클릭하여 연결 대기
6. 연결 완료 확인

### 13.2 Telegram 설정
1. Channels 페이지 열기
2. Telegram 카드에서 Bot Token 입력
3. "Save" 클릭
4. 연결 상태 확인

### 13.3 채널 설정 편집
1. 채널 카드에서 "Edit Config" 클릭
2. 설정 폼에서 값 수정
3. "Save" 클릭
4. 변경사항 적용 확인

## 14. 코드 구조

### 14.1 주요 파일
- `ui/src/ui/views/channels.ts`: 메인 Channels 뷰
- `ui/src/ui/views/channels.*.ts`: 채널별 카드 렌더링
  - `channels.whatsapp.ts`
  - `channels.telegram.ts`
  - `channels.discord.ts`
  - `channels.slack.ts`
  - `channels.signal.ts`
  - `channels.imessage.ts`
  - `channels.nostr.ts`
- `ui/src/ui/views/channels.config.ts`: 설정 편집
- `ui/src/ui/views/channels.shared.ts`: 공통 유틸리티
- `ui/src/ui/controllers/channels.ts`: API 호출 로직

### 14.2 타입 정의
```typescript
// ui/src/ui/views/channels.types.ts
export type ChannelKey = 
  | "whatsapp"
  | "telegram"
  | "discord"
  | "slack"
  | "signal"
  | "imessage"
  | "googlechat"
  | "nostr";

export type ChannelsProps = {
  snapshot: ChannelsStatusSnapshot | null;
  lastSuccessAt: number | null;
  lastError: string | null;
  loading: boolean;
  // ...
};
```

## 15. 향후 개선 사항

- 채널별 상세 통계
- 메시지 전송 테스트 기능
- 채널별 로그 뷰어
- 일괄 채널 관리
- 채널 상태 알림
