# 디바이스 인증 페이로드

**작성일**: 2026-01-28  
**모듈**: `src/gateway/device-auth.ts`

## 1. 개요

디바이스 인증 페이로드는 디바이스 기반 인증에 사용되는 페이로드를 생성합니다.

## 2. 페이로드 파라미터

### 2.1 DeviceAuthPayloadParams 구조

```typescript
export type DeviceAuthPayloadParams = {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce?: string | null;
  version?: "v1" | "v2";
};
```

**필수 필드:**
- `deviceId`: 디바이스 고유 ID
- `clientId`: 클라이언트 ID
- `clientMode`: 클라이언트 모드
- `role`: 역할
- `scopes`: 스코프 배열
- `signedAtMs`: 서명 시각 (밀리초)

**선택 필드:**
- `token`: 토큰 (v1)
- `nonce`: 논스 (v2)
- `version`: 버전 (기본값: nonce가 있으면 v2, 없으면 v1)

## 3. 페이로드 빌드

### 3.1 buildDeviceAuthPayload

```typescript
export function buildDeviceAuthPayload(params: DeviceAuthPayloadParams): string {
  const version = params.version ?? (params.nonce ? "v2" : "v1");
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";
  const base = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
  ];
  if (version === "v2") {
    base.push(params.nonce ?? "");
  }
  return base.join("|");
}
```

**페이로드 형식:**

**v1:**
```
v1|{deviceId}|{clientId}|{clientMode}|{role}|{scopes}|{signedAtMs}|{token}
```

**v2:**
```
v2|{deviceId}|{clientId}|{clientMode}|{role}|{scopes}|{signedAtMs}|{token}|{nonce}
```

**필드 설명:**
- `version`: 페이로드 버전
- `deviceId`: 디바이스 ID
- `clientId`: 클라이언트 ID
- `clientMode`: 클라이언트 모드
- `role`: 역할
- `scopes`: 스코프 (쉼표로 구분)
- `signedAtMs`: 서명 시각
- `token`: 토큰 (v1, 선택적)
- `nonce`: 논스 (v2)

## 4. 버전 선택

### 4.1 자동 버전 선택

버전이 명시되지 않으면 다음 규칙을 따릅니다:
- `nonce`가 있으면 `v2`
- 없으면 `v1`

### 4.2 명시적 버전

`version` 파라미터로 명시적으로 지정할 수 있습니다.

## 5. 사용 예시

### 5.1 v1 페이로드 생성

```typescript
const payload = buildDeviceAuthPayload({
  deviceId: "device-123",
  clientId: "moltbot-ios",
  clientMode: "node",
  role: "node",
  scopes: ["operator.read", "operator.write"],
  signedAtMs: Date.now(),
  token: "device-token",
  version: "v1",
});
```

### 5.2 v2 페이로드 생성

```typescript
const payload = buildDeviceAuthPayload({
  deviceId: "device-123",
  clientId: "moltbot-ios",
  clientMode: "node",
  role: "node",
  scopes: ["operator.read", "operator.write"],
  signedAtMs: Date.now(),
  nonce: "random-nonce-123",
  version: "v2",
});
```

## 6. 보안 고려사항

### 6.1 페이로드 서명

페이로드는 공개 키로 서명되어야 합니다. 서명은 별도로 전송됩니다.

### 6.2 논스 (v2)

v2는 논스를 사용하여 재생 공격을 방지합니다.

### 6.3 타임스탬프

`signedAtMs`는 타임스탬프 검증에 사용됩니다.

## 7. 호환성

### 7.1 v1 호환성

v1은 기존 클라이언트와 호환됩니다.

### 7.2 v2 향상

v2는 논스를 추가하여 보안을 강화합니다.
