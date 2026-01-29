---
layout: default
title: Protocol Schemas
---

# 프로토콜 스키마 상세

**작성일**: 2026-01-28  
**모듈**: `src/gateway/protocol/schema/`

## 1. 개요

Gateway 프로토콜의 모든 타입은 TypeBox를 사용하여 스키마로 정의됩니다. 각 스키마는 JSON Schema로 변환 가능하며, 런타임 검증에 사용됩니다.

## 2. 기본 타입 (Primitives)

### 2.1 NonEmptyString

```typescript
Type.String({ minLength: 1 })
```

비어있지 않은 문자열을 나타냅니다.

### 2.2 SessionLabelString

```typescript
Type.String({
  minLength: 1,
  maxLength: SESSION_LABEL_MAX_LENGTH,
})
```

세션 레이블 문자열을 나타냅니다.

### 2.3 GatewayClientIdSchema

```typescript
Type.Union(
  Object.values(GATEWAY_CLIENT_IDS).map((value) => Type.Literal(value))
)
```

Gateway 클라이언트 ID를 나타냅니다. 허용된 값들:
- `control-ui`
- `cli`
- `webchat`
- `node-ios`
- `node-android`
- `node-macos`
- 기타

### 2.4 GatewayClientModeSchema

```typescript
Type.Union(
  Object.values(GATEWAY_CLIENT_MODES).map((value) => Type.Literal(value))
)
```

Gateway 클라이언트 모드를 나타냅니다.

## 3. 프레임 스키마

### 3.1 RequestFrameSchema

```typescript
Type.Object({
  type: Type.Literal("req"),
  id: NonEmptyString,
  method: NonEmptyString,
  params: Type.Optional(Type.Unknown()),
}, { additionalProperties: false })
```

**필드:**
- `type`: 리터럴 `"req"`
- `id`: 요청 고유 ID
- `method`: 메서드 이름
- `params`: 메서드 파라미터 (선택적)

### 3.2 ResponseFrameSchema

```typescript
Type.Object({
  type: Type.Literal("res"),
  id: NonEmptyString,
  ok: Type.Boolean(),
  payload: Type.Optional(Type.Unknown()),
  error: Type.Optional(ErrorShapeSchema),
}, { additionalProperties: false })
```

**필드:**
- `type`: 리터럴 `"res"`
- `id`: 요청 ID와 일치
- `ok`: 성공 여부
- `payload`: 성공 시 페이로드 (선택적)
- `error`: 실패 시 에러 (선택적)

### 3.3 EventFrameSchema

```typescript
Type.Object({
  type: Type.Literal("event"),
  event: NonEmptyString,
  payload: Type.Optional(Type.Unknown()),
  seq: Type.Optional(Type.Integer({ minimum: 0 })),
  stateVersion: Type.Optional(StateVersionSchema),
}, { additionalProperties: false })
```

**필드:**
- `type`: 리터럴 `"event"`
- `event`: 이벤트 이름
- `payload`: 이벤트 페이로드 (선택적)
- `seq`: 이벤트 순차 번호 (선택적)
- `stateVersion`: 상태 버전 정보 (선택적)

### 3.4 GatewayFrameSchema

```typescript
Type.Union(
  [RequestFrameSchema, ResponseFrameSchema, EventFrameSchema],
  { discriminator: "type" }
)
```

모든 프레임 타입의 유니온입니다. `type` 필드를 discriminator로 사용합니다.

## 4. Connect 스키마

### 4.1 ConnectParamsSchema

```typescript
Type.Object({
  minProtocol: Type.Integer({ minimum: 1 }),
  maxProtocol: Type.Integer({ minimum: 1 }),
  client: Type.Object({
    id: GatewayClientIdSchema,
    displayName: Type.Optional(NonEmptyString),
    version: NonEmptyString,
    platform: NonEmptyString,
    deviceFamily: Type.Optional(NonEmptyString),
    modelIdentifier: Type.Optional(NonEmptyString),
    mode: GatewayClientModeSchema,
    instanceId: Type.Optional(NonEmptyString),
  }),
  caps: Type.Optional(Type.Array(NonEmptyString, { default: [] })),
  commands: Type.Optional(Type.Array(NonEmptyString)),
  permissions: Type.Optional(Type.Record(NonEmptyString, Type.Boolean())),
  pathEnv: Type.Optional(Type.String()),
  role: Type.Optional(NonEmptyString),
  scopes: Type.Optional(Type.Array(NonEmptyString)),
  device: Type.Optional(Type.Object({
    id: NonEmptyString,
    publicKey: NonEmptyString,
    signature: NonEmptyString,
    signedAt: Type.Integer({ minimum: 0 }),
    nonce: Type.Optional(NonEmptyString),
  })),
  auth: Type.Optional(Type.Object({
    token: Type.Optional(Type.String()),
    password: Type.Optional(Type.String()),
  })),
  locale: Type.Optional(Type.String()),
  userAgent: Type.Optional(Type.String()),
}, { additionalProperties: false })
```

### 4.2 HelloOkSchema

```typescript
Type.Object({
  type: Type.Literal("hello-ok"),
  protocol: Type.Integer({ minimum: 1 }),
  server: Type.Object({
    version: NonEmptyString,
    commit: Type.Optional(NonEmptyString),
    host: Type.Optional(NonEmptyString),
    connId: NonEmptyString,
  }),
  features: Type.Object({
    methods: Type.Array(NonEmptyString),
    events: Type.Array(NonEmptyString),
  }),
  snapshot: SnapshotSchema,
  canvasHostUrl: Type.Optional(NonEmptyString),
  auth: Type.Optional(Type.Object({
    deviceToken: NonEmptyString,
    role: NonEmptyString,
    scopes: Type.Array(NonEmptyString),
    issuedAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
  })),
  policy: Type.Object({
    maxPayload: Type.Integer({ minimum: 1 }),
    maxBufferedBytes: Type.Integer({ minimum: 1 }),
    tickIntervalMs: Type.Integer({ minimum: 1 }),
  }),
}, { additionalProperties: false })
```

## 5. 에러 스키마

### 5.1 ErrorShapeSchema

```typescript
Type.Object({
  code: NonEmptyString,
  message: NonEmptyString,
  details: Type.Optional(Type.Unknown()),
  retryable: Type.Optional(Type.Boolean()),
  retryAfterMs: Type.Optional(Type.Integer({ minimum: 0 })),
}, { additionalProperties: false })
```

**필드:**
- `code`: 에러 코드
- `message`: 에러 메시지
- `details`: 추가 상세 정보 (선택적)
- `retryable`: 재시도 가능 여부 (선택적)
- `retryAfterMs`: 재시도 대기 시간 (밀리초, 선택적)

## 6. 이벤트 스키마

### 6.1 TickEventSchema

```typescript
Type.Object({
  ts: Type.Integer({ minimum: 0 }),
}, { additionalProperties: false })
```

Keepalive 이벤트입니다.

### 6.2 ShutdownEventSchema

```typescript
Type.Object({
  reason: NonEmptyString,
  restartExpectedMs: Type.Optional(Type.Integer({ minimum: 0 })),
}, { additionalProperties: false })
```

서버 종료 이벤트입니다.

## 7. 스냅샷 스키마

### 7.1 SnapshotSchema

```typescript
Type.Object({
  presence: Type.Array(PresenceEntrySchema),
  health: Type.Unknown(),
  stateVersion: StateVersionSchema,
  uptimeMs: Type.Integer({ minimum: 0 }),
  configPath: NonEmptyString,
  stateDir: NonEmptyString,
  sessionDefaults: Type.Object({
    defaultAgentId: NonEmptyString,
    mainKey: NonEmptyString,
    mainSessionKey: NonEmptyString,
    scope: NonEmptyString,
  }),
}, { additionalProperties: false })
```

### 7.2 StateVersionSchema

```typescript
Type.Object({
  presence: Type.Integer({ minimum: 0 }),
  health: Type.Integer({ minimum: 0 }),
}, { additionalProperties: false })
```

### 7.3 PresenceEntrySchema

Presence 엔트리 스키마는 동적으로 생성됩니다.

## 8. 메서드 파라미터 스키마

각 메서드에 대해 파라미터 스키마가 정의됩니다:

- `AgentParamsSchema`
- `SessionsListParamsSchema`
- `ConfigGetParamsSchema`
- `CronAddParamsSchema`
- 기타

## 9. 응답 스키마

각 메서드에 대해 응답 스키마가 정의됩니다:

- `AgentIdentityResultSchema`
- `SessionsListResultSchema`
- `ConfigSchemaResponseSchema`
- `CronStatusResultSchema`
- 기타

## 10. 검증 함수

각 스키마에 대해 검증 함수가 생성됩니다:

```typescript
const validateConnectParams = ajv.compile<ConnectParams>(ConnectParamsSchema);
const validateRequestFrame = ajv.compile<RequestFrame>(RequestFrameSchema);
// ...
```

## 11. 타입 추출

TypeBox의 `Static` 타입을 사용하여 TypeScript 타입을 추출합니다:

```typescript
export type ConnectParams = Static<typeof ConnectParamsSchema>;
export type RequestFrame = Static<typeof RequestFrameSchema>;
// ...
```

## 12. 스키마 확장

플러그인은 새로운 메서드와 이벤트를 추가할 수 있으며, 해당 스키마도 정의해야 합니다.
