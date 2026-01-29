# 안드로이드 모바일 앱 자동화 가이드

**작성일**: 2026-01-28  
**관련 문서**: `reviews/02-browser-automation.md`, `docs/nodes/index.md`

## 개요

이 문서는 안드로이드 모바일 앱 자동화에 대한 가이드입니다. Moltbot은 여러 가지 방식으로 안드로이드 앱과 상호작용할 수 있습니다:

1. **Moltbot Android Node 앱** - Moltbot 자체 앱의 Canvas (WebView) 제어
2. **WebView를 사용하는 앱** - Chrome DevTools Protocol을 통한 WebView 자동화
3. **네이티브 앱 UI 자동화** - 현재 미지원 (향후 가능성)

## 시나리오별 자동화 방법

### 시나리오 1: Moltbot Android Node 앱 자동화 (현재 지원)

Moltbot Android 앱은 Gateway에 연결되는 Node로 작동하며, 다음 기능들을 제공합니다:

#### 지원되는 명령어

- `canvas.*` - WebView 기반 Canvas 제어
  - `canvas.navigate` - URL/경로로 네비게이션
  - `canvas.eval` - JavaScript 실행
  - `canvas.snapshot` - 스크린샷 캡처
  - `canvas.a2ui.push` - A2UI 콘텐츠 푸시
- `camera.*` - 카메라 캡처 (사진/동영상)
- `screen.record` - 화면 녹화
- `location.get` - 위치 정보
- `sms.send` - SMS 전송 (Android만)

#### 사용 방법

```bash
# 1. Android 노드 연결 확인
moltbot nodes status

# 2. Canvas 제어
moltbot nodes canvas navigate --node <android-node-id> --url "https://example.com"
moltbot nodes canvas eval --node <android-node-id> --js "document.title"
moltbot nodes canvas snapshot --node <android-node-id>

# 3. 카메라 캡처
moltbot nodes camera snap --node <android-node-id> --facing front

# 4. 화면 녹화
moltbot nodes screen record --node <android-node-id> --duration 5000
```

#### 제한사항

- **Foreground 전용**: Canvas와 Camera 명령은 앱이 포그라운드에 있을 때만 작동합니다.
- **Moltbot 앱 내부만**: 다른 앱을 제어할 수 없습니다.

### 시나리오 2: WebView를 사용하는 다른 앱 자동화 (가능)

안드로이드의 WebView는 Chrome DevTools Protocol (CDP)을 지원하므로, WebView를 사용하는 앱을 자동화할 수 있습니다.

#### WebView 디버깅 활성화

```bash
# 1. WebView 디버깅 활성화 (개발자 옵션 필요)
adb shell "echo 'webview_remote_debugging_enabled=1' > /data/local/tmp/webview-debug"

# 또는 앱별로 설정 (Android 4.4+)
adb shell "setprop debug.webview.provider com.android.webview"
adb shell "setprop debug.webview.provider com.google.android.webview"

# 2. WebView 디버깅 포트 확인
adb shell "cat /proc/net/unix | grep webview_devtools_remote"
```

#### CDP 연결 설정

```bash
# 1. WebView CDP 포트 포워딩 (일반적으로 9222)
adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>

# 또는 특정 앱의 WebView에 연결
# 먼저 앱의 PID 확인
adb shell "ps | grep <package-name>"

# 해당 PID의 WebView에 연결
adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>
```

#### Moltbot 설정

```json5
{
  browser: {
    enabled: true,
    profiles: {
      android-webview: {
        cdpUrl: "http://127.0.0.1:9222",
        driver: "clawd"
      }
    }
  }
}
```

#### 사용 예시

```bash
# WebView 앱 자동화
moltbot browser --browser-profile android-webview open https://example.com
moltbot browser --browser-profile android-webview snapshot
moltbot browser --browser-profile android-webview act --kind click --ref "button-123"
```

#### 제한사항

- **WebView만 가능**: 네이티브 UI 요소는 제어할 수 없습니다.
- **디버깅 모드 필요**: 앱이 디버깅 모드로 실행되어야 합니다.
- **앱별 설정 필요**: 각 앱의 WebView에 개별적으로 연결해야 합니다.

### 시나리오 3: 네이티브 앱 UI 자동화 (현재 미지원)

일반적인 네이티브 앱 UI 자동화 (예: 다른 앱의 버튼 클릭, 텍스트 입력)는 현재 Moltbot에서 지원하지 않습니다.

#### 현재 상태

Moltbot은 다음을 지원하지 않습니다:
- UiAutomator2
- Appium
- Espresso
- Accessibility Service를 통한 UI 제어

#### 향후 가능성

네이티브 앱 UI 자동화를 추가하려면:

1. **UiAutomator2 통합**
   - Android의 UiAutomator2 API 사용
   - Gateway에 새로운 `ui.*` 명령어 추가
   - Node에 UiAutomator2 클라이언트 구현

2. **Accessibility Service 활용**
   - Android Accessibility Service를 통한 UI 탐색
   - 화면 읽기 및 상호작용

3. **Appium 통합**
   - Appium 서버와 통합
   - 표준 WebDriver 프로토콜 사용

## 안드로이드 에뮬레이터에서 Chrome 브라우저 자동화

원래 질문이었던 안드로이드 에뮬레이터의 Chrome 브라우저 자동화는 여전히 가능합니다:

## 현재 시스템의 원격 CDP 지원

### 1. 원격 CDP 연결 기능

Moltbot은 이미 원격 CDP 연결을 지원합니다:

```typescript
// src/browser/config.ts
export type ResolvedBrowserConfig = {
  // ...
  cdpHost: string;
  cdpIsLoopback: boolean;
  remoteCdpTimeoutMs: number;
  remoteCdpHandshakeTimeoutMs: number;
  // ...
};

export type ResolvedBrowserProfile = {
  name: string;
  cdpPort: number;
  cdpUrl: string;  // 원격 CDP URL 지원
  cdpHost: string;
  cdpIsLoopback: boolean;
  // ...
};
```

### 2. 원격 프로필 생성

테스트 코드에서 확인할 수 있듯이, 원격 CDP URL로 프로필을 생성할 수 있습니다:

```typescript
// src/browser/server.post-tabs-open-profile-unknown-returns-404.test.ts
it("POST /profiles/create accepts cdpUrl for remote profiles", async () => {
  const res = await fetch(`${base}/profiles/create`, {
    method: "POST",
    body: JSON.stringify({ name: "remote", cdpUrl: "http://10.0.0.42:9222" }),
  });
  // ...
});
```

### 3. 원격 CDP 연결 처리

`server-context.ts`에서 원격 CDP 연결을 처리합니다:

```typescript
// src/browser/server-context.ts
const remoteCdp = !profile.cdpIsLoopback;

if (isExtension && remoteCdp) {
  throw new Error(
    `Profile "${profile.name}" uses driver=extension but cdpUrl is not loopback`
  );
}

// 원격 CDP 연결 확인
if (remoteCdp) {
  const reachable = await isChromeReachable(profile.cdpUrl, httpTimeout);
  if (!reachable) {
    throw new Error(
      `Remote CDP for profile "${profile.name}" is not reachable at ${profile.cdpUrl}.`
    );
  }
}
```

## 안드로이드 에뮬레이터 설정 방법

### 1. 안드로이드 에뮬레이터에서 Chrome 실행

안드로이드 에뮬레이터에서 Chrome을 원격 디버깅 모드로 실행해야 합니다:

```bash
# 에뮬레이터에서 Chrome 실행 (ADB를 통해)
adb shell am start -n com.android.chrome/com.google.android.apps.chrome.Main \
  --es "chrome:remote-debugging-port" "9222"
```

또는 Chrome을 수동으로 실행한 후, 다음 명령으로 원격 디버깅 활성화:

```bash
# Chrome의 원격 디버깅 포트 설정
adb shell "echo 'chrome --remote-debugging-port=9222' > /data/local/tmp/chrome-command"
```

### 2. ADB 포트 포워딩

에뮬레이터의 CDP 포트를 호스트로 포워딩:

```bash
# 에뮬레이터의 9222 포트를 호스트의 9222로 포워딩
adb forward tcp:9222 tcp:9222

# 또는 다른 포트 사용
adb forward tcp:9223 tcp:9222
```

### 3. Moltbot 설정

`~/.clawdbot/moltbot.json`에 안드로이드 에뮬레이터 프로필 추가:

```json5
{
  browser: {
    enabled: true,
    profiles: {
      android: {
        cdpUrl: "http://127.0.0.1:9222",  // ADB 포워딩된 포트
        driver: "clawd"  // extension은 loopback만 지원
      }
    }
  }
}
```

### 4. 연결 확인

```bash
# Chrome CDP 연결 확인
curl http://127.0.0.1:9222/json/version

# Moltbot 브라우저 상태 확인
moltbot browser --browser-profile android status

# 탭 목록 확인
moltbot browser --browser-profile android tabs
```

## 제한사항 및 고려사항

### 1. Extension 드라이버 제한

**중요**: `extension` 드라이버는 loopback 주소만 지원합니다:

```typescript
// src/browser/extension-relay.ts
if (!isLoopbackHost(info.host)) {
  throw new Error(`extension relay requires loopback cdpUrl host (got ${info.host})`);
}
```

따라서 안드로이드 에뮬레이터에서는 반드시 `driver: "clawd"`를 사용해야 합니다.

### 2. ADB 포트 포워딩 유지

ADB 포트 포워딩은 세션이 유지되는 동안만 작동합니다. 에뮬레이터를 재시작하거나 ADB 연결이 끊기면 다시 포워딩해야 합니다.

### 3. 네트워크 지연

에뮬레이터를 통한 연결은 네트워크 지연이 발생할 수 있습니다. `remoteCdpTimeoutMs`를 조정할 수 있습니다:

```json5
{
  browser: {
    remoteCdpTimeoutMs: 5000,  // 기본값: 1500ms
    remoteCdpHandshakeTimeoutMs: 10000  // 기본값: 3000ms
  }
}
```

### 4. Chrome 버전 호환성

안드로이드 Chrome의 CDP 버전이 호스트 Chrome과 다를 수 있습니다. 최신 Chrome 버전을 사용하는 것이 좋습니다.

## 실제 사용 예시

### 1. 프로필 생성

```bash
# CLI를 통해 프로필 생성
moltbot browser profiles create \
  --name android \
  --cdp-url http://127.0.0.1:9222 \
  --driver clawd
```

### 2. 브라우저 제어

```bash
# 탭 열기
moltbot browser --browser-profile android open https://example.com

# 스냅샷 가져오기
moltbot browser --browser-profile android snapshot

# 스크린샷 찍기
moltbot browser --browser-profile android screenshot

# 액션 수행
moltbot browser --browser-profile android act \
  --kind click \
  --ref "button-123"
```

### 3. AI 에이전트에서 사용

AI 에이전트가 브라우저 도구를 호출할 때 프로필을 지정:

```typescript
// AI 도구 호출 예시
browser({
  profile: "android",
  action: "navigate",
  url: "https://example.com"
});
```

## 문제 해결

### 1. 연결 실패

**증상**: `Remote CDP for profile "android" is not reachable`

**해결책**:
- ADB 포트 포워딩 확인: `adb forward --list`
- 에뮬레이터에서 Chrome이 실행 중인지 확인
- Chrome의 원격 디버깅 포트 확인: `adb shell "netstat -an | grep 9222"`

### 2. 타임아웃

**증상**: `CDP connect timeout`

**해결책**:
- `remoteCdpTimeoutMs` 증가
- 에뮬레이터 성능 확인 (느린 에뮬레이터는 지연 발생)
- 네트워크 연결 확인

### 3. CDP 버전 불일치

**증상**: `Protocol version mismatch`

**해결책**:
- Chrome 버전 업데이트
- 에뮬레이터의 Chrome 업데이트
- CDP 버전 확인: `curl http://127.0.0.1:9222/json/version`

## 향후 개선 가능성

### 1. 자동 ADB 포트 포워딩

Moltbot이 자동으로 ADB 포트 포워딩을 설정하고 관리할 수 있습니다:

```typescript
// 향후 구현 가능
async function ensureAndroidEmulatorPortForwarding(
  emulatorPort: number,
  hostPort: number
): Promise<void> {
  // ADB 포트 포워딩 자동 설정
}
```

### 2. 에뮬레이터 자동 감지

연결된 에뮬레이터를 자동으로 감지하고 프로필을 생성:

```bash
# 향후 가능한 명령어
moltbot browser profiles auto-detect-android
```

### 3. WebView 지원

안드로이드 WebView도 CDP를 지원하므로, WebView를 사용하는 앱도 자동화 가능:

```bash
# WebView 원격 디버깅 활성화
adb shell "echo 'webview_remote_debugging_enabled=1' > /data/local/tmp/webview-debug"
```

## 결론

### 현재 지원되는 자동화

1. ✅ **Moltbot Android Node 앱** - Canvas, Camera, Screen Record 등
2. ✅ **WebView를 사용하는 앱** - CDP를 통한 WebView 자동화
3. ✅ **안드로이드 Chrome 브라우저** - 원격 CDP 연결 지원

### 현재 미지원

1. ❌ **네이티브 앱 UI 자동화** - UiAutomator2, Appium 등 미지원
2. ❌ **다른 앱의 네이티브 UI 제어** - 버튼 클릭, 텍스트 입력 등

### 권장 사용 시나리오

- **WebView 기반 앱**: CDP를 통한 자동화 가능
- **Moltbot 앱 내부**: Canvas, Camera 등 Node 명령어 사용
- **Chrome 브라우저**: 원격 CDP 연결로 자동화 가능

### 향후 개선 방향

네이티브 앱 UI 자동화를 위해서는 다음 기능 추가가 필요합니다:

1. UiAutomator2 통합
2. Accessibility Service 활용
3. Appium 서버 통합

현재는 WebView 기반 앱과 Moltbot 자체 앱만 자동화할 수 있으며, 일반적인 네이티브 앱 UI 자동화는 향후 기능으로 계획되어 있습니다.
