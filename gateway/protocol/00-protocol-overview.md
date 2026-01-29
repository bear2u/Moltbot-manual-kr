---
layout: default
title: Protocol Overview
---

# Gateway 프로토콜 개요

**작성일**: 2026-01-28  
**모듈**: `src/gateway/protocol/`

## 1. 개요

Gateway 프로토콜은 JSON 기반 WebSocket 통신 프로토콜입니다. TypeBox를 사용하여 스키마를 정의하고, Ajv를 사용하여 런타임 검증을 수행합니다.

## 2. 프로토콜 버전

현재 프로토콜 버전은 `PROTOCOL_VERSION` 상수로 정의되어 있습니다. 클라이언트는 `minProtocol`과 `maxProtocol`을 지정하여 호환성 범위를 제시할 수 있습니다.

## 3. 프레임 타입

### 3.1 Request Frame

**스키마:**
```typescript
{
  type: "req",
  id: string;
  method: string;
  params?: unknown;
}
```

**설명:**
- 클라이언트가 서버에 메서드를 호출할 때 사용
- `id`: 요청 고유 ID (응답과 매칭)
- `method`: 호출할 메서드 이름
- `params`: 메서드 파라미터 (선택적)

### 3.2 Response Frame

**스키마:**
```typescript
{
  type: "res",
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
  };
}
```

**설명:**
- 서버가 클라이언트 요청에 응답할 때 사용
- `id`: 요청 ID와 일치
- `ok`: 성공 여부
- `payload`: 성공 시 페이로드
- `error`: 실패 시 에러 정보

### 3.3 Event Frame

**스키마:**
```typescript
{
  type: "event",
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: {
    presence?: number;
    health?: number;
  };
}
```

**설명:**
- 서버가 클라이언트에 이벤트를 브로드캐스트할 때 사용
- `event`: 이벤트 이름
- `payload`: 이벤트 페이로드
- `seq`: 이벤트 순차 번호
- `stateVersion`: 상태 버전 정보

### 3.4 Gateway Frame

**스키마:**
```typescript
GatewayFrame = RequestFrame | ResponseFrame | EventFrame
```

**설명:**
- 모든 프레임의 유니온 타입
- `type` 필드를 discriminator로 사용

## 4. Connect 파라미터

### 4.1 ConnectParams 구조

```typescript
{
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    displayName?: string;
    version: string;
    platform: string;
    deviceFamily?: string;
    modelIdentifier?: string;
    mode: string;
    instanceId?: string;
  };
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  pathEnv?: string;
  role?: string;
  scopes?: string[];
  device?: {
    id: string;
    publicKey: string;
    signature: string;
    signedAt: number;
    nonce?: string;
  };
  auth?: {
    token?: string;
    password?: string;
  };
  locale?: string;
  userAgent?: string;
}
```

### 4.2 HelloOk 응답

```typescript
{
  type: "hello-ok",
  protocol: number;
  server: {
    version: string;
    commit?: string;
    host?: string;
    connId: string;
  };
  features: {
    methods: string[];
    events: string[];
  };
  snapshot: Snapshot;
  canvasHostUrl?: string;
  auth?: {
    deviceToken: string;
    role: string;
    scopes: string[];
    issuedAtMs?: number;
  };
  policy: {
    maxPayload: number;
    maxBufferedBytes: number;
    tickIntervalMs: number;
  };
}
```

## 5. 에러 코드

### 5.1 에러 코드 목록

- `NOT_LINKED`: 연결되지 않음
- `NOT_PAIRED`: 페어링되지 않음
- `AGENT_TIMEOUT`: 에이전트 타임아웃
- `INVALID_REQUEST`: 잘못된 요청
- `UNAVAILABLE`: 사용 불가능

### 5.2 에러 형식

```typescript
{
  code: ErrorCode;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
}
```

## 6. 스키마 검증

### 6.1 검증 프로세스

1. JSON 파싱
2. TypeBox 스키마 검증
3. Ajv를 통한 런타임 검증

### 6.2 검증 함수

각 파라미터 타입에 대해 검증 함수가 제공됩니다:

- `validateConnectParams`
- `validateRequestFrame`
- `validateResponseFrame`
- `validateEventFrame`
- `validateGatewayFrame`

### 6.3 검증 에러 포맷팅

`formatValidationErrors()` 함수는 검증 에러를 사용자 친화적인 형식으로 변환합니다.

## 7. 이벤트 타입

주요 이벤트 타입들:

- `connect.challenge`: 연결 챌린지
- `agent`: 에이전트 실행 이벤트
- `chat`: 채팅 이벤트
- `presence`: 프레즌스 변경
- `tick`: Keepalive
- `shutdown`: 서버 종료
- `health`: Health 업데이트
- `heartbeat`: Heartbeat 이벤트
- `cron`: 크론 작업 이벤트
- `node.pair.requested`: 노드 페어링 요청
- `node.pair.resolved`: 노드 페어링 해결
- `device.pair.requested`: 디바이스 페어링 요청
- `device.pair.resolved`: 디바이스 페어링 해결
- `exec.approval.requested`: Exec 승인 요청
- `exec.approval.resolved`: Exec 승인 해결
- `voicewake.changed`: Voice wake 트리거 변경
- `talk.mode`: Talk 모드 변경

## 8. 스냅샷

### 8.1 Snapshot 구조

```typescript
{
  presence: PresenceEntry[];
  health: unknown;
  stateVersion: {
    presence: number;
    health: number;
  };
  uptimeMs: number;
  configPath: string;
  stateDir: string;
  sessionDefaults: {
    defaultAgentId: string;
    mainKey: string;
    mainSessionKey: string;
    scope: string;
  };
}
```

### 8.2 PresenceEntry 구조

```typescript
{
  key: string;
  reason?: string;
  client?: {
    id: string;
    displayName?: string;
    version?: string;
    platform?: string;
  };
  role?: string;
  // ...
}
```

## 9. 프로토콜 확장

프로토콜은 채널 플러그인과 Gateway 플러그인을 통해 확장될 수 있습니다:

- 채널별 메서드 추가
- 플러그인별 메서드 추가
- 플러그인별 이벤트 추가

## 10. 호환성

### 10.1 프로토콜 버전 협상

클라이언트는 `minProtocol`과 `maxProtocol`을 지정하여 호환성 범위를 제시합니다. 서버는 이 범위 내에서 프로토콜 버전을 선택합니다.

### 10.2 하위 호환성

프로토콜 버전이 증가해도 하위 호환성을 유지합니다. 새로운 필드는 선택적으로 추가되며, 기존 클라이언트는 계속 작동합니다.
