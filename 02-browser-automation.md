---
layout: default
title: Browser Automation
---

# 브라우저 자동화 시스템 상세 분석

**작성일**: 2026-01-28  
**프로젝트**: moltbot  
**모듈**: `src/browser/`

## 1. 개요

Moltbot의 브라우저 자동화 시스템은 매우 독특한 아키텍처를 가지고 있습니다. 일반적인 브라우저 자동화 도구들이 별도의 브라우저 인스턴스를 실행하는 것과 달리, Moltbot은 **Chrome 확장 프로그램을 통한 Relay 방식**을 사용하여 사용자의 기존 Chrome 탭을 제어할 수 있습니다.

## 2. 아키텍처 개요

### 2.1 3계층 구조

```
┌─────────────────────────────────────────┐
│   Browser Control Service               │
│   (Gateway 또는 Node)                   │
│   - browser tool API                    │
│   - Playwright 통합                     │
└──────────────┬──────────────────────────┘
               │ WebSocket (CDP)
               │
┌──────────────▼──────────────────────────┐
│   Local Relay Server                    │
│   (Loopback CDP)                        │
│   http://127.0.0.1:18792                │
│                                         │
│   - Extension WebSocket: /extension     │
│   - CDP WebSocket: /cdp                 │
│   - HTTP Endpoints: /json/*             │
└──────────────┬──────────────────────────┘
               │ WebSocket
               │
┌──────────────▼──────────────────────────┐
│   Chrome MV3 Extension                  │
│   (background.js)                       │
│                                         │
│   - chrome.debugger API                 │
│   - 탭 attach/detach                    │
│   - CDP 명령 전달                        │
└──────────────┬──────────────────────────┘
               │ chrome.debugger
               │
┌──────────────▼──────────────────────────┐
│   Chrome Browser Tab                    │
│   (사용자의 기존 탭)                     │
└─────────────────────────────────────────┘
```

### 2.2 컴포넌트 설명

#### Browser Control Service
- **위치**: Gateway 또는 Node에서 실행
- **역할**: AI 에이전트가 호출하는 브라우저 도구 API 제공
- **구현**: `src/browser/server.ts`, `src/browser/routes/`
- **통신**: Playwright를 통해 CDP WebSocket 연결

#### Local Relay Server
- **위치**: 로컬 머신에서 실행 (loopback)
- **역할**: Extension과 CDP 클라이언트 간 브릿지
- **구현**: `src/browser/extension-relay.ts`
- **포트**: 기본 18792 (Gateway 포트 + 1)
- **프로토콜**: HTTP + WebSocket

#### Chrome Extension
- **위치**: Chrome 브라우저에 설치
- **역할**: 사용자 탭에 attach하고 CDP 명령을 Relay로 전달
- **구현**: `assets/chrome-extension/background.js`
- **권한**: `debugger`, `tabs`, `activeTab`, `storage`

## 3. Relay 서버 상세 분석

### 3.1 파일 구조
- **파일**: `src/browser/extension-relay.ts`
- **주요 함수**:
  - `ensureChromeExtensionRelayServer()`: Relay 서버 시작
  - `stopChromeExtensionRelayServer()`: Relay 서버 중지

### 3.2 WebSocket 엔드포인트

#### `/extension` - Extension 연결
```typescript
// Extension이 연결하는 WebSocket
wssExtension.on("connection", (ws) => {
  extensionWs = ws;
  // Ping/Pong 유지
  // CDP 명령 수신 및 전달
  // CDP 이벤트 브로드캐스팅
});
```

**메시지 타입**:
- `forwardCDPCommand`: Extension → Relay → Chrome Debugger
- `forwardCDPEvent`: Chrome Debugger → Extension → Relay
- `ping`/`pong`: 연결 유지

#### `/cdp` - CDP 클라이언트 연결
```typescript
// Playwright 등 CDP 클라이언트가 연결하는 WebSocket
wssCdp.on("connection", (ws) => {
  cdpClients.add(ws);
  // CDP 명령을 Extension으로 전달
  // Extension 응답을 클라이언트로 전달
});
```

**프로토콜**: 표준 CDP (Chrome DevTools Protocol)

### 3.3 HTTP 엔드포인트

#### `/json/version`
```json
{
  "Browser": "Moltbot/extension-relay",
  "Protocol-Version": "1.3",
  "webSocketDebuggerUrl": "ws://127.0.0.1:18792/cdp"
}
```

#### `/json/list`
```json
[
  {
    "id": "target-id",
    "type": "page",
    "title": "Tab Title",
    "url": "https://example.com",
    "webSocketDebuggerUrl": "ws://127.0.0.1:18792/cdp"
  }
]
```

#### `/json/activate/{targetId}`
- 특정 탭 활성화

#### `/json/close/{targetId}`
- 특정 탭 닫기

### 3.4 CDP 명령 라우팅

```typescript
const routeCdpCommand = async (cmd: CdpCommand): Promise<unknown> => {
  switch (cmd.method) {
    case "Browser.getVersion":
      return { /* 버전 정보 */ };
    
    case "Target.getTargets":
      return { targetInfos: Array.from(connectedTargets.values()) };
    
    case "Target.attachToTarget":
      // Extension에 attach 명령 전달
      return { sessionId: target.sessionId };
    
    default:
      // 기타 CDP 명령을 Extension으로 전달
      return await sendToExtension({
        id: nextExtensionId++,
        method: "forwardCDPCommand",
        params: { method: cmd.method, params: cmd.params }
      });
  }
};
```

### 3.5 이벤트 브로드캐스팅

```typescript
// Extension에서 받은 CDP 이벤트를 모든 CDP 클라이언트에 브로드캐스트
const broadcastToCdpClients = (evt: CdpEvent) => {
  const msg = JSON.stringify(evt);
  for (const ws of cdpClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
};
```

**주요 이벤트**:
- `Target.attachedToTarget`: 탭이 attach됨
- `Target.detachedFromTarget`: 탭이 detach됨
- `Target.targetInfoChanged`: 탭 정보 변경 (URL, 제목 등)

## 4. Chrome Extension 상세 분석

### 4.1 파일 구조
- **파일**: `assets/chrome-extension/background.js`
- **Manifest**: `assets/chrome-extension/manifest.json`
- **타입**: Manifest V3 (Service Worker)

### 4.2 주요 기능

#### Relay 연결 관리
```javascript
async function ensureRelayConnection() {
  const port = await getRelayPort(); // 기본 18792
  const wsUrl = `ws://127.0.0.1:${port}/extension`;
  
  // HTTP preflight 체크
  await fetch(`http://127.0.0.1:${port}/`, { method: 'HEAD' });
  
  // WebSocket 연결
  const ws = new WebSocket(wsUrl);
  relayWs = ws;
  
  // 메시지 핸들러 등록
  ws.onmessage = (event) => onRelayMessage(String(event.data));
}
```

#### 탭 Attach/Detach
```javascript
async function attachTab(tabId) {
  // chrome.debugger API로 탭에 attach
  await chrome.debugger.attach({ tabId }, '1.3');
  
  // Target 정보 가져오기
  const info = await chrome.debugger.sendCommand(
    { tabId },
    'Target.getTargetInfo'
  );
  
  // Relay에 attached 이벤트 전송
  sendToRelay({
    method: 'forwardCDPEvent',
    params: {
      method: 'Target.attachedToTarget',
      params: {
        sessionId: `cb-tab-${nextSession++}`,
        targetInfo: { ...info.targetInfo, attached: true }
      }
    }
  });
  
  // 배지 업데이트
  setBadge(tabId, 'on');
}
```

#### CDP 명령 전달
```javascript
async function handleForwardCdpCommand(msg) {
  const method = msg.params.method;
  const params = msg.params.params;
  const sessionId = msg.params.sessionId;
  
  // 세션 ID로 탭 찾기
  const tabId = getTabBySessionId(sessionId)?.tabId;
  
  // chrome.debugger로 명령 실행
  return await chrome.debugger.sendCommand(
    { tabId, sessionId },
    method,
    params
  );
}
```

#### CDP 이벤트 수신 및 전달
```javascript
function onDebuggerEvent(source, method, params) {
  const tabId = source.tabId;
  const tab = tabs.get(tabId);
  
  // Relay로 이벤트 전달
  sendToRelay({
    method: 'forwardCDPEvent',
    params: {
      sessionId: source.sessionId || tab.sessionId,
      method,
      params
    }
  });
}
```

### 4.3 사용자 인터페이스

#### 툴바 버튼 클릭
```javascript
chrome.action.onClicked.addListener(() => {
  connectOrToggleForActiveTab();
});

async function connectOrToggleForActiveTab() {
  const [active] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  
  const existing = tabs.get(active.id);
  if (existing?.state === 'connected') {
    await detachTab(active.id, 'toggle');
  } else {
    await attachTab(active.id);
  }
}
```

#### 배지 상태
- `ON`: 탭이 attach됨 (빨간색)
- `…`: 연결 중 (주황색)
- `!`: 오류 (빨간색)
- 빈 배지: detach됨

## 5. 브라우저 프로필 시스템

### 5.1 프로필 타입

#### `clawd` 드라이버 (기본)
- 전용 Chrome 프로필 실행
- 독립적인 사용자 데이터 디렉토리
- 자동으로 브라우저 시작/종료

#### `extension` 드라이버
- 기존 Chrome 탭 제어
- Relay 서버 필요
- 사용자가 수동으로 탭 attach

### 5.2 프로필 설정
```typescript
// src/browser/config.ts
function ensureDefaultChromeExtensionProfile(
  controlPort: number
): BrowserProfiles {
  const relayPort = controlPort + 1; // 기본 18792
  return {
    chrome: {
      driver: "extension",
      cdpUrl: `http://127.0.0.1:${relayPort}`,
      color: "#FF5A36"
    }
  };
}
```

### 5.3 프로필 컨텍스트
```typescript
// src/browser/server-context.ts
function createProfileContext(
  opts: ContextOptions,
  profile: ResolvedBrowserProfile
): ProfileContext {
  const ensureBrowserAvailable = async (): Promise<void> => {
    if (profile.driver === "extension") {
      // Relay 서버 시작 확인
      await ensureChromeExtensionRelayServer({ cdpUrl: profile.cdpUrl });
      
      // Extension 연결 확인
      if (!await isReachable(600)) {
        throw new Error(
          "Chrome extension relay is running, but no tab is connected. " +
          "Click the Moltbot Chrome extension icon on a tab to attach it."
        );
      }
    }
  };
}
```

## 6. 통신 흐름 예시

### 6.1 탭 Attach 흐름

```
1. 사용자가 Extension 아이콘 클릭
   ↓
2. Extension: chrome.debugger.attach({ tabId }, '1.3')
   ↓
3. Extension: Target.getTargetInfo로 targetId 획득
   ↓
4. Extension → Relay: forwardCDPEvent (Target.attachedToTarget)
   ↓
5. Relay: connectedTargets에 탭 정보 저장
   ↓
6. Relay → CDP Clients: Target.attachedToTarget 이벤트 브로드캐스트
   ↓
7. Playwright: 탭 사용 가능 상태로 인식
```

### 6.2 CDP 명령 실행 흐름

```
1. Playwright → Relay: CDP 명령 (예: Page.navigate)
   ↓
2. Relay: routeCdpCommand()로 명령 처리
   ↓
3. Relay → Extension: forwardCDPCommand
   ↓
4. Extension: chrome.debugger.sendCommand() 실행
   ↓
5. Chrome: 명령 실행 및 결과 반환
   ↓
6. Extension → Relay: forwardCDPCommand 응답
   ↓
7. Relay → Playwright: CDP 응답 전달
```

### 6.3 CDP 이벤트 수신 흐름

```
1. Chrome: 이벤트 발생 (예: Page.frameNavigated)
   ↓
2. Extension: chrome.debugger.onEvent 리스너 트리거
   ↓
3. Extension → Relay: forwardCDPEvent
   ↓
4. Relay: broadcastToCdpClients() 호출
   ↓
5. Relay → CDP Clients: 이벤트 브로드캐스트
   ↓
6. Playwright: 이벤트 수신 및 처리
```

## 7. 보안 고려사항

### 7.1 Loopback 제한
```typescript
// extension-relay.ts
if (!isLoopbackAddress(remote)) {
  rejectUpgrade(socket, 403, "Forbidden");
  return;
}
```
- Relay 서버는 loopback 주소에서만 접근 가능
- 외부 네트워크 접근 차단

### 7.2 Extension 권한
```json
{
  "permissions": ["debugger", "tabs", "activeTab", "storage"],
  "host_permissions": ["http://127.0.0.1/*", "http://localhost/*"]
}
```
- `debugger` 권한: Chrome Debugger API 사용
- `host_permissions`: Loopback 주소만 허용

### 7.3 사용자 제어
- 사용자가 명시적으로 탭을 attach해야 함
- 자동 attach 없음
- 언제든지 detach 가능

## 8. 원격 Gateway 시나리오

### 8.1 로컬 Gateway (기본)
```
Gateway (로컬) → Browser Control Service (로컬) → Relay (로컬) → Extension (로컬)
```
- 모든 컴포넌트가 같은 머신에서 실행
- 추가 설정 불필요

### 8.2 원격 Gateway
```
Gateway (원격) → Node Host (로컬) → Relay (로컬) → Extension (로컬)
```
- Gateway는 원격 머신에서 실행
- Node Host가 로컬 머신에서 실행되어 브라우저 제어
- Relay와 Extension은 로컬 머신에 유지

### 8.3 Node Host 설정
```typescript
// Gateway가 Node Host를 통해 브라우저 제어
if (profile.driver === "extension" && remoteCdp) {
  throw new Error(
    "Profile uses driver=extension but cdpUrl is not loopback"
  );
}
```
- Extension 드라이버는 반드시 loopback CDP URL 사용
- 원격 Gateway는 Node Host를 통해 프록시

## 9. 코드 구조 요약

### 9.1 핵심 파일

#### Relay 서버
- `src/browser/extension-relay.ts`: Relay 서버 구현
- `src/browser/extension-relay.test.ts`: 테스트

#### Extension
- `assets/chrome-extension/background.js`: Extension 로직
- `assets/chrome-extension/manifest.json`: Manifest 정의
- `assets/chrome-extension/options.html`: 설정 페이지

#### 브라우저 서버
- `src/browser/server.ts`: 브라우저 제어 서버
- `src/browser/server-context.ts`: 프로필 컨텍스트 관리
- `src/browser/routes/`: API 라우트 핸들러

#### 클라이언트
- `src/browser/client.ts`: 브라우저 클라이언트
- `src/agents/tools/browser-tool.ts`: AI 도구 통합

### 9.2 주요 타입

```typescript
// Extension 메시지 타입
type ExtensionForwardCommandMessage = {
  id: number;
  method: "forwardCDPCommand";
  params: { method: string; params?: unknown; sessionId?: string };
};

type ExtensionResponseMessage = {
  id: number;
  result?: unknown;
  error?: string;
};

type ExtensionForwardEventMessage = {
  method: "forwardCDPEvent";
  params: { method: string; params?: unknown; sessionId?: string };
};
```

## 10. 사용 예시

### 10.1 Extension 설치
```bash
# Extension 파일 설치
moltbot browser extension install

# 설치 경로 확인
moltbot browser extension path
```

### 10.2 Chrome에서 로드
1. `chrome://extensions` 접속
2. "Developer mode" 활성화
3. "Load unpacked" 클릭
4. 설치 경로 선택
5. Extension 고정

### 10.3 탭 Attach
1. 제어할 탭 열기
2. Extension 아이콘 클릭
3. 배지가 "ON"으로 변경되면 완료

### 10.4 AI 도구 사용
```typescript
// AI 에이전트가 브라우저 도구 호출
browser({
  profile: "chrome",
  action: "navigate",
  url: "https://example.com"
});
```

## 11. 장단점 분석

### 11.1 장점
1. **기존 브라우저 활용**: 별도 브라우저 인스턴스 불필요
2. **사용자 제어**: 사용자가 명시적으로 탭 선택
3. **세션 유지**: 로그인 상태 등 기존 세션 유지
4. **원격 지원**: Node Host를 통한 원격 제어 가능

### 11.2 단점
1. **수동 작업**: 사용자가 탭을 attach해야 함
2. **보안 위험**: 기존 브라우저 세션에 접근 가능
3. **Chrome 전용**: 다른 브라우저 미지원
4. **복잡성**: 3계층 구조로 인한 복잡도 증가

## 12. 결론

Moltbot의 브라우저 자동화 시스템은 매우 독창적인 접근 방식을 사용합니다. Chrome 확장 프로그램을 통한 Relay 방식은 사용자의 기존 브라우저 세션을 활용할 수 있게 해주며, 동시에 사용자에게 명시적인 제어권을 부여합니다. 이는 프라이버시와 보안을 고려한 설계로 보이며, 특히 원격 Gateway 시나리오에서 Node Host를 통한 프록시 방식은 유연한 배포를 가능하게 합니다.
