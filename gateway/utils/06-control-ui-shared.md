---
layout: default
title: Control Ui Shared
---

# Control UI 공유 유틸리티

**작성일**: 2026-01-28  
**모듈**: `src/gateway/control-ui-shared.ts`

## 1. 개요

Control UI 공유 유틸리티는 Control UI와 관련된 공통 기능을 제공합니다. Base path 정규화, 아바타 URL 생성, 아바타 해결 등을 지원합니다.

## 2. 상수

### 2.1 CONTROL_UI_AVATAR_PREFIX

```typescript
const CONTROL_UI_AVATAR_PREFIX = "/avatar";
```

아바타 경로 접두사입니다.

## 3. Base Path 정규화

### 3.1 normalizeControlUiBasePath

```typescript
export function normalizeControlUiBasePath(basePath?: string): string {
  if (!basePath) return "";
  let normalized = basePath.trim();
  if (!normalized) return "";
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  if (normalized === "/") return "";
  if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
  return normalized;
}
```

Base path를 정규화합니다:
1. 공백 제거
2. 앞에 `/` 추가 (없는 경우)
3. `/`만 있으면 빈 문자열 반환
4. 뒤의 `/` 제거

**예시:**
- `undefined` → `""`
- `""` → `""`
- `"admin"` → `"/admin"`
- `"/admin"` → `"/admin"`
- `"/admin/"` → `"/admin"`
- `"/"` → `""`

## 4. 아바타 URL 생성

### 4.1 buildControlUiAvatarUrl

```typescript
export function buildControlUiAvatarUrl(basePath: string, agentId: string): string {
  return basePath
    ? `${basePath}${CONTROL_UI_AVATAR_PREFIX}/${agentId}`
    : `${CONTROL_UI_AVATAR_PREFIX}/${agentId}`;
}
```

아바타 URL을 생성합니다.

**예시:**
- `basePath = ""`, `agentId = "main"` → `"/avatar/main"`
- `basePath = "/admin"`, `agentId = "main"` → `"/admin/avatar/main"`

## 5. 아바타 URL 해결

### 5.1 resolveAssistantAvatarUrl

```typescript
export function resolveAssistantAvatarUrl(params: {
  avatar?: string | null;
  agentId?: string | null;
  basePath?: string;
}): string | undefined
```

에이전트 아바타 URL을 해결합니다.

**프로세스:**

1. **아바타 없음 확인**
```typescript
const avatar = params.avatar?.trim();
if (!avatar) return undefined;
```

2. **원격 URL 확인**
```typescript
if (/^https?:\/\//i.test(avatar) || /^data:image\//i.test(avatar)) return avatar;
```

3. **Base path 정규화**
```typescript
const basePath = normalizeControlUiBasePath(params.basePath);
```

4. **이미 Base path 포함 확인**
```typescript
if (basePath && avatar.startsWith(`${CONTROL_UI_AVATAR_PREFIX}/`)) {
  return `${basePath}${avatar}`;
}
```

5. **Base avatar prefix 확인**
```typescript
const baseAvatarPrefix = basePath
  ? `${basePath}${CONTROL_UI_AVATAR_PREFIX}/`
  : `${CONTROL_UI_AVATAR_PREFIX}/`;
if (avatar.startsWith(baseAvatarPrefix)) return avatar;
```

6. **로컬 파일 경로 확인**
```typescript
if (!params.agentId) return avatar;
if (looksLikeLocalAvatarPath(avatar)) {
  return buildControlUiAvatarUrl(basePath, params.agentId);
}
```

7. **그 외**
```typescript
return avatar;
```

### 5.2 looksLikeLocalAvatarPath

```typescript
function looksLikeLocalAvatarPath(value: string): boolean {
  if (/[\\/]/.test(value)) return true;
  return /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(value);
}
```

로컬 파일 경로처럼 보이는지 확인합니다:
- 경로 구분자 (`/` 또는 `\`) 포함
- 이미지 확장자 포함

## 6. 사용 예시

### 6.1 Base Path 정규화

```typescript
const basePath = normalizeControlUiBasePath("/admin/");
// 결과: "/admin"
```

### 6.2 아바타 URL 생성

```typescript
const url = buildControlUiAvatarUrl("/admin", "main");
// 결과: "/admin/avatar/main"
```

### 6.3 아바타 URL 해결

```typescript
// 원격 URL
const url1 = resolveAssistantAvatarUrl({
  avatar: "https://example.com/avatar.png",
  basePath: "/admin",
});
// 결과: "https://example.com/avatar.png"

// Data URL
const url2 = resolveAssistantAvatarUrl({
  avatar: "data:image/png;base64,...",
  basePath: "/admin",
});
// 결과: "data:image/png;base64,..."

// 로컬 파일
const url3 = resolveAssistantAvatarUrl({
  avatar: "avatar.png",
  agentId: "main",
  basePath: "/admin",
});
// 결과: "/admin/avatar/main"

// 이미 정규화된 경로
const url4 = resolveAssistantAvatarUrl({
  avatar: "/avatar/main",
  basePath: "/admin",
});
// 결과: "/admin/avatar/main"
```

## 7. 통합

### 7.1 Control UI 통합

이 함수들은 Control UI 서빙과 아바타 해결에 사용됩니다.

### 7.2 Assistant Identity 통합

`resolveAssistantAvatarUrl`은 `resolveAssistantIdentity`에서 사용됩니다.

## 8. 보안 고려사항

### 8.1 경로 검증

Base path는 정규화되어 경로 트래버설을 방지합니다.

### 8.2 아바타 검증

아바타 URL은 적절히 검증되어야 합니다.

## 9. 성능 고려사항

### 9.1 정규식 최적화

정규식은 간단하여 성능에 영향을 주지 않습니다.

### 9.2 문자열 연산

문자열 연산은 최소화되어 있습니다.
