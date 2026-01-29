# Appium을 이용한 모바일 앱 자동화 스킬 통합 가이드

**작성일**: 2026-01-28  
**관련 문서**: `reviews/04-android-emulator-browser-automation.md`, `docs/tools/skills.md`

## 개요

Moltbot의 Skills 시스템을 활용하여 Appium 기반 모바일 앱 자동화 스킬을 만들 수 있습니다. Skills는 외부 도구와 API를 통합하는 완벽한 방법을 제공합니다.

## 기술적 가능성 분석

### ✅ 가능한 이유

1. **Skills 시스템의 유연성**
   - Skills는 `bash`, `python` 등의 도구를 통해 외부 서비스와 통신 가능
   - `scripts/` 폴더에 실행 가능한 스크립트 포함 가능
   - HTTP API 호출, CLI 도구 실행 등 다양한 방식 지원

2. **기존 패턴 확인**
   - `local-places` skill: Python FastAPI 서버와 통신
   - `coding-agent` skill: bash를 통해 외부 CLI 도구 실행
   - `nano-banana-pro` skill: Python 스크립트 실행

3. **Appium 통합 방법**
   - Appium 서버는 HTTP API 제공 (WebDriver Protocol)
   - Python `appium-python-client` 또는 Node.js `webdriverio` 사용 가능
   - bash를 통해 `appium` CLI 사용 가능

## 구현 방법

### 방법 1: Python 스크립트를 통한 Appium 통합 (권장)

#### 1. Skill 구조

```
skills/appium-mobile-automation/
├── SKILL.md                    # Skill 정의 및 사용법
├── scripts/
│   └── appium_automation.py    # Appium 자동화 스크립트
└── references/
    └── appium-api.md           # Appium API 참조 문서
```

#### 2. SKILL.md 예시

```markdown
---
name: appium-mobile-automation
description: Automate mobile apps (Android/iOS) using Appium WebDriver protocol. Supports element finding, clicking, typing, swiping, and screenshot capture.
metadata: {"moltbot":{"emoji":"📱","requires":{"bins":["python3"],"env":["APPIUM_SERVER_URL"],"config":[]},"primaryEnv":"APPIUM_SERVER_URL"}}
---

# Appium Mobile Automation

Automate Android and iOS mobile apps using Appium WebDriver protocol.

## Prerequisites

1. **Appium Server**: Must be running and accessible
   ```bash
   # Start Appium server
   appium --port 4723
   
   # Or use Appium Desktop
   # Set APPIUM_SERVER_URL=http://127.0.0.1:4723
   ```

2. **Python dependencies**: Install required packages
   ```bash
   pip install appium-python-client selenium
   ```

3. **Android/iOS setup**:
   - Android: ADB connected device/emulator
   - iOS: Xcode + iOS Simulator or physical device

## Quick Start

```bash
# Install dependencies
cd {baseDir}
pip install -r requirements.txt

# Run automation script
python scripts/appium_automation.py \
  --action find_element \
  --platform android \
  --selector "id:com.example.app:id/button" \
  --appium-url http://127.0.0.1:4723
```

## Available Actions

### 1. Find Element
```bash
python scripts/appium_automation.py \
  --action find_element \
  --platform android \
  --selector "id:com.example.app:id/button" \
  --appium-url http://127.0.0.1:4723
```

### 2. Click Element
```bash
python scripts/appium_automation.py \
  --action click \
  --platform android \
  --selector "xpath://android.widget.Button[@text='Login']" \
  --appium-url http://127.0.0.1:4723
```

### 3. Type Text
```bash
python scripts/appium_automation.py \
  --action type \
  --platform android \
  --selector "id:com.example.app:id/username" \
  --text "user@example.com" \
  --appium-url http://127.0.0.1:4723
```

### 4. Swipe
```bash
python scripts/appium_automation.py \
  --action swipe \
  --platform android \
  --direction up \
  --distance 500 \
  --appium-url http://127.0.0.1:4723
```

### 5. Screenshot
```bash
python scripts/appium_automation.py \
  --action screenshot \
  --platform android \
  --output /tmp/screenshot.png \
  --appium-url http://127.0.0.1:4723
```

### 6. Get Element Text
```bash
python scripts/appium_automation.py \
  --action get_text \
  --platform android \
  --selector "id:com.example.app:id/title" \
  --appium-url http://127.0.0.1:4723
```

## Selector Types

- `id:` - Resource ID (Android) or Accessibility ID (iOS)
- `xpath:` - XPath expression
- `class:` - Class name
- `text:` - Text content (partial match)
- `name:` - Name attribute

## Platform Support

- **Android**: Requires `ANDROID_HOME` and ADB
- **iOS**: Requires Xcode and iOS Simulator/Device

## Error Handling

- Connection errors: Check Appium server is running
- Element not found: Verify selector and app state
- Timeout: Increase `--timeout` parameter (default: 10s)
```

#### 3. Python 스크립트 예시

```python
#!/usr/bin/env python3
"""
Appium Mobile Automation Script
Supports Android and iOS app automation via Appium WebDriver protocol.
"""

import argparse
import json
import sys
from typing import Optional

from appium import webdriver
from appium.options.android import UiAutomator2Options
from appium.options.ios import XCUITestOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


def parse_selector(selector: str):
    """Parse selector string into (by, value) tuple."""
    if selector.startswith("id:"):
        return (By.ID, selector[3:])
    elif selector.startswith("xpath:"):
        return (By.XPATH, selector[6:])
    elif selector.startswith("class:"):
        return (By.CLASS_NAME, selector[6:])
    elif selector.startswith("text:"):
        return (By.XPATH, f"//*[contains(@text, '{selector[5:]}')]")
    else:
        # Default to ID
        return (By.ID, selector)


def create_driver(platform: str, appium_url: str, app_package: Optional[str] = None):
    """Create Appium WebDriver instance."""
    if platform.lower() == "android":
        options = UiAutomator2Options()
        if app_package:
            options.app_package = app_package
        options.automation_name = "UiAutomator2"
    elif platform.lower() == "ios":
        options = XCUITestOptions()
        if app_package:
            options.bundle_id = app_package
        options.automation_name = "XCUITest"
    else:
        raise ValueError(f"Unsupported platform: {platform}")
    
    driver = webdriver.Remote(appium_url, options=options)
    return driver


def find_element(driver, selector: str, timeout: int = 10):
    """Find element by selector."""
    by, value = parse_selector(selector)
    wait = WebDriverWait(driver, timeout)
    element = wait.until(EC.presence_of_element_located((by, value)))
    return element


def main():
    parser = argparse.ArgumentParser(description="Appium Mobile Automation")
    parser.add_argument("--action", required=True, choices=[
        "find_element", "click", "type", "swipe", "screenshot", "get_text"
    ])
    parser.add_argument("--platform", required=True, choices=["android", "ios"])
    parser.add_argument("--appium-url", default="http://127.0.0.1:4723")
    parser.add_argument("--app-package", help="App package name (Android) or bundle ID (iOS)")
    parser.add_argument("--selector", help="Element selector")
    parser.add_argument("--text", help="Text to type")
    parser.add_argument("--direction", choices=["up", "down", "left", "right"])
    parser.add_argument("--distance", type=int, default=500)
    parser.add_argument("--output", help="Output file path for screenshot")
    parser.add_argument("--timeout", type=int, default=10)
    
    args = parser.parse_args()
    
    driver = None
    try:
        driver = create_driver(args.platform, args.appium_url, args.app_package)
        
        if args.action == "find_element":
            element = find_element(driver, args.selector, args.timeout)
            result = {
                "status": "success",
                "found": True,
                "tag": element.tag_name,
                "text": element.text
            }
            print(json.dumps(result))
            
        elif args.action == "click":
            element = find_element(driver, args.selector, args.timeout)
            element.click()
            result = {"status": "success", "action": "clicked"}
            print(json.dumps(result))
            
        elif args.action == "type":
            element = find_element(driver, args.selector, args.timeout)
            element.clear()
            element.send_keys(args.text)
            result = {"status": "success", "action": "typed", "text": args.text}
            print(json.dumps(result))
            
        elif args.action == "swipe":
            size = driver.get_window_size()
            start_x = size["width"] // 2
            start_y = size["height"] // 2
            
            if args.direction == "up":
                end_x, end_y = start_x, start_y - args.distance
            elif args.direction == "down":
                end_x, end_y = start_x, start_y + args.distance
            elif args.direction == "left":
                end_x, end_y = start_x - args.distance, start_y
            else:  # right
                end_x, end_y = start_x + args.distance, start_y
            
            driver.swipe(start_x, start_y, end_x, end_y, duration=500)
            result = {"status": "success", "action": "swiped", "direction": args.direction}
            print(json.dumps(result))
            
        elif args.action == "screenshot":
            output_path = args.output or "/tmp/appium_screenshot.png"
            driver.save_screenshot(output_path)
            result = {"status": "success", "action": "screenshot", "path": output_path}
            print(json.dumps(result))
            
        elif args.action == "get_text":
            element = find_element(driver, args.selector, args.timeout)
            text = element.text
            result = {"status": "success", "text": text}
            print(json.dumps(result))
            
    except Exception as e:
        result = {"status": "error", "message": str(e)}
        print(json.dumps(result))
        sys.exit(1)
    finally:
        if driver:
            driver.quit()


if __name__ == "__main__":
    main()
```

#### 4. 사용 예시 (AI 에이전트에서)

```bash
# 1. Appium 서버 시작
bash background:true command:"appium --port 4723"

# 2. 앱 자동화 실행
bash workdir:{baseDir} command:"python scripts/appium_automation.py --action click --platform android --selector 'id:com.example.app:id/login_button' --appium-url http://127.0.0.1:4723"
```

### 방법 2: Node.js/WebdriverIO를 통한 통합

#### 1. Skill 구조

```
skills/appium-mobile-automation/
├── SKILL.md
├── scripts/
│   └── appium_automation.js    # WebdriverIO 스크립트
└── package.json                # Node.js 의존성
```

#### 2. Node.js 스크립트 예시

```javascript
#!/usr/bin/env node
/**
 * Appium Mobile Automation using WebdriverIO
 */

const { remote } = require('webdriverio');

async function runAutomation(options) {
  const {
    action,
    platform,
    appiumUrl = 'http://127.0.0.1:4723',
    appPackage,
    selector,
    text,
    direction,
    distance = 500,
    output,
    timeout = 10000
  } = options;

  const capabilities = platform === 'android' ? {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:appPackage': appPackage,
    'appium:deviceName': 'Android Emulator'
  } : {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:bundleId': appPackage,
    'appium:deviceName': 'iPhone Simulator'
  };

  const driver = await remote({
    hostname: new URL(appiumUrl).hostname,
    port: parseInt(new URL(appiumUrl).port) || 4723,
    path: '/',
    capabilities
  });

  try {
    let result;
    
    switch (action) {
      case 'click':
        const clickElement = await driver.$(selector);
        await clickElement.click();
        result = { status: 'success', action: 'clicked' };
        break;
        
      case 'type':
        const typeElement = await driver.$(selector);
        await typeElement.setValue(text);
        result = { status: 'success', action: 'typed', text };
        break;
        
      case 'screenshot':
        const screenshot = await driver.takeScreenshot();
        const fs = require('fs');
        const buffer = Buffer.from(screenshot, 'base64');
        fs.writeFileSync(output || '/tmp/appium_screenshot.png', buffer);
        result = { status: 'success', action: 'screenshot', path: output };
        break;
        
      // ... 기타 액션들
    }
    
    console.log(JSON.stringify(result));
  } catch (error) {
    console.log(JSON.stringify({ status: 'error', message: error.message }));
    process.exit(1);
  } finally {
    await driver.deleteSession();
  }
}

// CLI 인터페이스
const args = require('minimist')(process.argv.slice(2));
runAutomation(args);
```

### 방법 3: HTTP API 래퍼 서버 (고급)

더 복잡한 자동화를 위해 별도의 HTTP API 서버를 만들고 Skills에서 호출:

```
skills/appium-mobile-automation/
├── SKILL.md
├── server/
│   ├── app.py                 # FastAPI 서버
│   └── appium_client.py       # Appium 클라이언트
└── scripts/
    └── start_server.sh        # 서버 시작 스크립트
```

## 구현 단계

### 1단계: 기본 Skill 생성

```bash
# Skill 디렉토리 생성
mkdir -p ~/.clawdbot/skills/appium-mobile-automation/scripts
mkdir -p ~/.clawdbot/skills/appium-mobile-automation/references

# SKILL.md 작성
cat > ~/.clawdbot/skills/appium-mobile-automation/SKILL.md << 'EOF'
---
name: appium-mobile-automation
description: Automate mobile apps using Appium WebDriver protocol
metadata: {"moltbot":{"emoji":"📱","requires":{"bins":["python3","appium"],"env":["APPIUM_SERVER_URL"]}}}
---
# Appium Mobile Automation
[위의 SKILL.md 내용]
EOF
```

### 2단계: Python 스크립트 작성

```bash
# 스크립트 작성
cat > ~/.clawdbot/skills/appium-mobile-automation/scripts/appium_automation.py << 'EOF'
[위의 Python 스크립트 내용]
EOF

chmod +x ~/.clawdbot/skills/appium-mobile-automation/scripts/appium_automation.py
```

### 3단계: 의존성 설치

```bash
# requirements.txt 생성
cat > ~/.clawdbot/skills/appium-mobile-automation/requirements.txt << 'EOF'
appium-python-client>=3.0.0
selenium>=4.0.0
EOF

# 설치
pip install -r ~/.clawdbot/skills/appium-mobile-automation/requirements.txt
```

### 4단계: Appium 서버 설정

```bash
# Appium 설치 (Node.js 필요)
npm install -g appium
npm install -g @appium/uiautomator2-driver  # Android
npm install -g @appium/xcuitest-driver       # iOS

# Appium 서버 시작
appium --port 4723
```

### 5단계: 사용

```bash
# AI 에이전트가 자동으로 skill을 인식하고 사용
# 또는 수동으로 호출:

bash workdir:~/.clawdbot/skills/appium-mobile-automation \
  command:"python scripts/appium_automation.py \
    --action click \
    --platform android \
    --selector 'id:com.example.app:id/button' \
    --appium-url http://127.0.0.1:4723"
```

## 고급 기능

### 1. 세션 관리

Appium 세션을 유지하여 여러 액션을 수행:

```python
# 세션 ID를 파일에 저장
SESSION_FILE = "/tmp/appium_session.json"

def save_session(driver):
    with open(SESSION_FILE, 'w') as f:
        json.dump({"session_id": driver.session_id}, f)

def load_session(appium_url):
    with open(SESSION_FILE, 'r') as f:
        session_id = json.load(f)["session_id"]
    # 기존 세션에 재연결
    # (Appium은 직접 재연결을 지원하지 않으므로, 세션 정보를 유지)
```

### 2. 요소 대기 및 재시도

```python
def wait_for_element(driver, selector, timeout=30, retry=3):
    for attempt in range(retry):
        try:
            element = find_element(driver, selector, timeout)
            return element
        except:
            if attempt < retry - 1:
                time.sleep(2)
            else:
                raise
```

### 3. 스크린샷 및 비교

```python
def compare_screenshots(driver, baseline_path, current_path):
    driver.save_screenshot(current_path)
    # 이미지 비교 로직
    # (PIL, opencv 등 사용)
```

## 제한사항 및 고려사항

### 1. Appium 서버 필요

- Appium 서버가 별도로 실행되어야 함
- 네트워크 연결 필요 (로컬 또는 원격)

### 2. 플랫폼별 설정

- **Android**: `ANDROID_HOME`, ADB, UiAutomator2 드라이버 필요
- **iOS**: Xcode, iOS Simulator 또는 물리적 디바이스 필요

### 3. 성능

- HTTP 기반 통신으로 인한 지연
- 네트워크 상태에 의존

### 4. 보안

- Appium 서버 접근 제어 필요
- 민감한 앱 데이터 처리 시 주의

## 통합 패턴 비교

### 패턴 1: 직접 스크립트 실행 (간단)

**장점**:
- 구현이 간단함
- 의존성이 적음
- 빠른 프로토타이핑 가능

**단점**:
- 매번 드라이버 생성/종료로 인한 오버헤드
- 세션 관리 복잡

### 패턴 2: HTTP API 서버 (권장)

**장점**:
- 세션 재사용 가능
- 더 나은 에러 처리
- 확장성 좋음

**단점**:
- 구현 복잡도 증가
- 별도 서버 관리 필요

### 패턴 3: Node.js 통합

**장점**:
- WebdriverIO의 풍부한 기능
- 비동기 처리 효율적

**단점**:
- Node.js 런타임 필요
- Python보다 무거움

## 실제 사용 예시

### 예시 1: 로그인 자동화

```bash
# 1. 앱 시작
python scripts/appium_automation.py \
  --action launch_app \
  --platform android \
  --app-package com.example.app

# 2. 사용자명 입력
python scripts/appium_automation.py \
  --action type \
  --platform android \
  --selector "id:com.example.app:id/username" \
  --text "user@example.com"

# 3. 비밀번호 입력
python scripts/appium_automation.py \
  --action type \
  --platform android \
  --selector "id:com.example.app:id/password" \
  --text "password123"

# 4. 로그인 버튼 클릭
python scripts/appium_automation.py \
  --action click \
  --platform android \
  --selector "id:com.example.app:id/login_button"

# 5. 결과 확인
python scripts/appium_automation.py \
  --action get_text \
  --platform android \
  --selector "id:com.example.app:id/welcome_message"
```

### 예시 2: 스크롤 및 스크린샷

```bash
# 스크롤 다운
python scripts/appium_automation.py \
  --action swipe \
  --platform android \
  --direction down \
  --distance 500

# 스크린샷 캡처
python scripts/appium_automation.py \
  --action screenshot \
  --platform android \
  --output /tmp/app_screenshot.png
```

## 결론

**Appium을 이용한 모바일 앱 자동화 스킬은 완전히 가능합니다!**

### 구현 가능성: ✅ 높음

1. ✅ Skills 시스템이 외부 도구 통합을 지원
2. ✅ Python/Node.js 스크립트 실행 가능
3. ✅ Appium은 표준 HTTP API 제공
4. ✅ 기존 패턴 (local-places, coding-agent) 재사용 가능

### 권장 접근 방법

1. **1단계**: Python 스크립트 기반 기본 구현
2. **2단계**: HTTP API 래퍼 서버로 고도화
3. **3단계**: 세션 관리 및 고급 기능 추가

### 다음 단계

1. Skill 구조 생성
2. Python 스크립트 작성
3. Appium 서버 설정 가이드 작성
4. 테스트 및 문서화

이렇게 하면 Moltbot이 네이티브 모바일 앱을 자동화할 수 있게 됩니다!
