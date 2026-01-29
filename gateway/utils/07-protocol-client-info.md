---
layout: default
title: Protocol Client Info
---

# 프로토콜 클라이언트 정보

**작성일**: 2026-01-28  
**모듈**: `src/gateway/protocol/client-info.ts`

## 1. 개요

프로토콜 클라이언트 정보는 Gateway 프로토콜에서 사용하는 클라이언트 ID와 모드를 정의합니다.

## 2. 클라이언트 ID

### 2.1 GATEWAY_CLIENT_IDS

```typescript
export const GATEWAY_CLIENT_IDS = {
  WEBCHAT_UI: "webchat-ui",
  CONTROL_UI: "moltbot-control-ui",
  WEBCHAT: "webchat",
  CLI: "cli",
  GATEWAY_CLIENT: "gateway-client",
  MACOS_APP: "moltbot-macos",
  IOS_APP: "moltbot-ios",
  ANDROID_APP: "moltbot-android",
  NODE_HOST: "node-host",
  TEST: "test",
  FINGERPRINT: "fingerprint",
  PROBE: "moltbot-probe",
} as const;
```

**클라이언트 ID 목록:**
- `webchat-ui`: WebChat UI
- `moltbot-control-ui`: Control UI
- `webchat`: WebChat
- `cli`: CLI
- `gateway-client`: Gateway 클라이언트
- `moltbot-macos`: macOS 앱
- `moltbot-ios`: iOS 앱
- `moltbot-android`: Android 앱
- `node-host`: 노드 호스트
- `test`: 테스트
- `fingerprint`: 지문
- `moltbot-probe`: 프로브

### 2.2 GatewayClientId 타입

```typescript
export type GatewayClientId = (typeof GATEWAY_CLIENT_IDS)[keyof typeof GATEWAY_CLIENT_IDS];
```

### 2.3 정규화 함수

```typescript
export function normalizeGatewayClientId(raw?: string | null): GatewayClientId | undefined {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return undefined;
  return GATEWAY_CLIENT_ID_SET.has(normalized as GatewayClientId)
    ? (normalized as GatewayClientId)
    : undefined;
}
```

클라이언트 ID를 정규화합니다. 허용된 값이 아니면 `undefined`를 반환합니다.

## 3. 클라이언트 모드

### 3.1 GATEWAY_CLIENT_MODES

```typescript
export const GATEWAY_CLIENT_MODES = {
  WEBCHAT: "webchat",
  CLI: "cli",
  UI: "ui",
  BACKEND: "backend",
  NODE: "node",
  PROBE: "probe",
  TEST: "test",
} as const;
```

**클라이언트 모드 목록:**
- `webchat`: WebChat
- `cli`: CLI
- `ui`: UI
- `backend`: 백엔드
- `node`: 노드
- `probe`: 프로브
- `test`: 테스트

### 3.2 GatewayClientMode 타입

```typescript
export type GatewayClientMode = (typeof GATEWAY_CLIENT_MODES)[keyof typeof GATEWAY_CLIENT_MODES];
```

### 3.3 정규화 함수

```typescript
export function normalizeGatewayClientMode(raw?: string | null): GatewayClientMode | undefined {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return undefined;
  return GATEWAY_CLIENT_MODE_SET.has(normalized as GatewayClientMode)
    ? (normalized as GatewayClientMode)
    : undefined;
}
```

클라이언트 모드를 정규화합니다.

## 4. 클라이언트 정보

### 4.1 GatewayClientInfo 타입

```typescript
export type GatewayClientInfo = {
  id: GatewayClientId;
  displayName?: string;
  version: string;
  platform: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  mode: GatewayClientMode;
  instanceId?: string;
};
```

**필드:**
- `id`: 클라이언트 ID
- `displayName`: 표시 이름 (선택적)
- `version`: 버전
- `platform`: 플랫폼
- `deviceFamily`: 디바이스 패밀리 (선택적)
- `modelIdentifier`: 모델 식별자 (선택적)
- `mode`: 클라이언트 모드
- `instanceId`: 인스턴스 ID (선택적)

## 5. 호환성

### 5.1 GATEWAY_CLIENT_NAMES

```typescript
export const GATEWAY_CLIENT_NAMES = GATEWAY_CLIENT_IDS;
export type GatewayClientName = GatewayClientId;
```

하위 호환성을 위한 별칭입니다.

### 5.2 normalizeGatewayClientName

```typescript
export function normalizeGatewayClientName(raw?: string | null): GatewayClientName | undefined {
  return normalizeGatewayClientId(raw);
}
```

`normalizeGatewayClientId`의 별칭입니다.

## 6. 사용 예시

### 6.1 클라이언트 ID 정규화

```typescript
const clientId = normalizeGatewayClientId("moltbot-ios");
// 결과: "moltbot-ios"

const invalid = normalizeGatewayClientId("unknown");
// 결과: undefined
```

### 6.2 클라이언트 모드 정규화

```typescript
const mode = normalizeGatewayClientMode("node");
// 결과: "node"

const invalid = normalizeGatewayClientMode("unknown");
// 결과: undefined
```

### 6.3 Connect 파라미터에서 사용

```typescript
const connectParams: ConnectParams = {
  minProtocol: 1,
  maxProtocol: 1,
  client: {
    id: GATEWAY_CLIENT_IDS.IOS_APP,
    displayName: "Moltbot iOS",
    version: "1.0.0",
    platform: "ios",
    mode: GATEWAY_CLIENT_MODES.NODE,
  },
  // ...
};
```

## 7. 검증

### 7.1 허용된 값 확인

클라이언트 ID와 모드는 허용된 값 집합에 속해야 합니다. 그렇지 않으면 `undefined`가 반환됩니다.

### 7.2 대소문자 무시

정규화 함수는 대소문자를 구분하지 않습니다.

## 8. 확장성

### 8.1 새로운 클라이언트 추가

새로운 클라이언트를 추가하려면 `GATEWAY_CLIENT_IDS`에 추가하면 됩니다.

### 8.2 새로운 모드 추가

새로운 모드를 추가하려면 `GATEWAY_CLIENT_MODES`에 추가하면 됩니다.

## 9. 보안 고려사항

### 9.1 값 검증

클라이언트 ID와 모드는 엄격하게 검증되어 허용되지 않은 값은 거부됩니다.

### 9.2 정규화

모든 값은 정규화되어 일관성을 보장합니다.
