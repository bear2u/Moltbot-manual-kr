---
layout: default
title: Node Command Policy
---

# 노드 명령 정책

**작성일**: 2026-01-28  
**모듈**: `src/gateway/node-command-policy.ts`

## 1. 개요

노드 명령 정책은 노드가 실행할 수 있는 명령을 제어합니다. 플랫폼별 기본 명령 목록과 설정 기반 허용/거부 목록을 지원합니다.

## 2. 명령 카테고리

### 2.1 Canvas 명령

```typescript
const CANVAS_COMMANDS = [
  "canvas.present",
  "canvas.hide",
  "canvas.navigate",
  "canvas.eval",
  "canvas.snapshot",
  "canvas.a2ui.push",
  "canvas.a2ui.pushJSONL",
  "canvas.a2ui.reset",
];
```

### 2.2 Camera 명령

```typescript
const CAMERA_COMMANDS = ["camera.list", "camera.snap", "camera.clip"];
```

### 2.3 Screen 명령

```typescript
const SCREEN_COMMANDS = ["screen.record"];
```

### 2.4 Location 명령

```typescript
const LOCATION_COMMANDS = ["location.get"];
```

### 2.5 SMS 명령

```typescript
const SMS_COMMANDS = ["sms.send"];
```

### 2.6 System 명령

```typescript
const SYSTEM_COMMANDS = [
  "system.run",
  "system.which",
  "system.notify",
  "system.execApprovals.get",
  "system.execApprovals.set",
  "browser.proxy",
];
```

## 3. 플랫폼별 기본 명령

### 3.1 iOS

```typescript
ios: [
  ...CANVAS_COMMANDS,
  ...CAMERA_COMMANDS,
  ...SCREEN_COMMANDS,
  ...LOCATION_COMMANDS,
]
```

### 3.2 Android

```typescript
android: [
  ...CANVAS_COMMANDS,
  ...CAMERA_COMMANDS,
  ...SCREEN_COMMANDS,
  ...LOCATION_COMMANDS,
  ...SMS_COMMANDS,
]
```

### 3.3 macOS

```typescript
macos: [
  ...CANVAS_COMMANDS,
  ...CAMERA_COMMANDS,
  ...SCREEN_COMMANDS,
  ...LOCATION_COMMANDS,
  ...SYSTEM_COMMANDS,
]
```

### 3.4 Linux

```typescript
linux: [...SYSTEM_COMMANDS]
```

### 3.5 Windows

```typescript
windows: [...SYSTEM_COMMANDS]
```

### 3.6 Unknown

```typescript
unknown: [
  ...CANVAS_COMMANDS,
  ...CAMERA_COMMANDS,
  ...SCREEN_COMMANDS,
  ...LOCATION_COMMANDS,
  ...SMS_COMMANDS,
  ...SYSTEM_COMMANDS,
]
```

## 4. 플랫폼 ID 정규화

### 4.1 normalizePlatformId

```typescript
function normalizePlatformId(platform?: string, deviceFamily?: string): string {
  const raw = (platform ?? "").trim().toLowerCase();
  if (raw.startsWith("ios")) return "ios";
  if (raw.startsWith("android")) return "android";
  if (raw.startsWith("mac")) return "macos";
  if (raw.startsWith("darwin")) return "macos";
  if (raw.startsWith("win")) return "windows";
  if (raw.startsWith("linux")) return "linux";
  
  const family = (deviceFamily ?? "").trim().toLowerCase();
  if (family.includes("iphone") || family.includes("ipad") || family.includes("ios")) return "ios";
  if (family.includes("android")) return "android";
  if (family.includes("mac")) return "macos";
  if (family.includes("windows")) return "windows";
  if (family.includes("linux")) return "linux";
  
  return "unknown";
}
```

플랫폼 문자열을 정규화된 플랫폼 ID로 변환합니다.

## 5. 허용 목록 해결

### 5.1 resolveNodeCommandAllowlist

```typescript
export function resolveNodeCommandAllowlist(
  cfg: MoltbotConfig,
  node?: Pick<NodeSession, "platform" | "deviceFamily">,
): Set<string>
```

노드에 대한 명령 허용 목록을 해결합니다.

**프로세스:**

1. **플랫폼 ID 정규화**
```typescript
const platformId = normalizePlatformId(node?.platform, node?.deviceFamily);
```

2. **기본 명령 가져오기**
```typescript
const base = PLATFORM_DEFAULTS[platformId] ?? PLATFORM_DEFAULTS.unknown;
```

3. **추가 명령 추가**
```typescript
const extra = cfg.gateway?.nodes?.allowCommands ?? [];
const allow = new Set([...base, ...extra].map((cmd) => cmd.trim()).filter(Boolean));
```

4. **거부 명령 제거**
```typescript
const deny = new Set(cfg.gateway?.nodes?.denyCommands ?? []);
for (const blocked of deny) {
  const trimmed = blocked.trim();
  if (trimmed) allow.delete(trimmed);
}
```

5. **반환**
```typescript
return allow;
```

## 6. 명령 허용 확인

### 6.1 isNodeCommandAllowed

```typescript
export function isNodeCommandAllowed(params: {
  command: string;
  declaredCommands?: string[];
  allowlist: Set<string>;
}): { ok: true } | { ok: false; reason: string }
```

명령이 허용되는지 확인합니다.

**검사 순서:**

1. **명령 비어있음 확인**
```typescript
const command = params.command.trim();
if (!command) return { ok: false, reason: "command required" };
```

2. **허용 목록 확인**
```typescript
if (!params.allowlist.has(command)) {
  return { ok: false, reason: "command not allowlisted" };
}
```

3. **노드 선언 확인**
```typescript
if (Array.isArray(params.declaredCommands) && params.declaredCommands.length > 0) {
  if (!params.declaredCommands.includes(command)) {
    return { ok: false, reason: "command not declared by node" };
  }
} else {
  return { ok: false, reason: "node did not declare commands" };
}
```

4. **허용**
```typescript
return { ok: true };
```

## 7. 설정

### 7.1 허용 명령 추가

```json
{
  "gateway": {
    "nodes": {
      "allowCommands": ["custom.command"]
    }
  }
}
```

### 7.2 명령 거부

```json
{
  "gateway": {
    "nodes": {
      "denyCommands": ["system.run"]
    }
  }
}
```

## 8. 사용 예시

### 8.1 허용 목록 해결

```typescript
const allowlist = resolveNodeCommandAllowlist(cfg, node);
```

### 8.2 명령 허용 확인

```typescript
const allowed = isNodeCommandAllowed({
  command: "system.run",
  declaredCommands: node.commands,
  allowlist,
});

if (!allowed.ok) {
  respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, allowed.reason));
  return;
}
```

## 9. 보안 고려사항

### 9.1 명령 선언 필수

노드는 실행 가능한 명령을 선언해야 합니다. 선언되지 않은 명령은 거부됩니다.

### 9.2 허용 목록 우선

설정의 허용 목록이 기본 목록보다 우선합니다.

### 9.3 거부 목록 최종

거부 목록은 최종적으로 적용되어 허용 목록의 명령도 거부할 수 있습니다.

## 10. 플랫폼별 제한

### 10.1 모바일 플랫폼

iOS와 Android는 시스템 명령에 접근할 수 없습니다.

### 10.2 데스크톱 플랫폼

macOS, Linux, Windows는 시스템 명령에 접근할 수 있습니다.

### 10.3 알 수 없는 플랫폼

알 수 없는 플랫폼은 모든 명령을 허용합니다 (보안상 위험할 수 있음).
