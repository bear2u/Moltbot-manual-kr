---
layout: default
title: Node Helpers
---

# 노드 헬퍼 함수

**작성일**: 2026-01-28  
**모듈**: `src/gateway/server-methods/nodes.helpers.ts`

## 1. 개요

노드 헬퍼 함수는 노드 관련 메서드 핸들러에서 사용하는 유틸리티 함수들을 제공합니다.

## 2. 주요 함수

### 2.1 respondInvalidParams

```typescript
export function respondInvalidParams(params: {
  respond: RespondFn;
  method: string;
  validator: ValidatorFn;
}) {
  params.respond(
    false,
    undefined,
    errorShape(
      ErrorCodes.INVALID_REQUEST,
      `invalid ${params.method} params: ${formatValidationErrors(params.validator.errors)}`,
    ),
  );
}
```

파라미터 검증 실패 시 응답을 전송합니다.

**사용 예시:**
```typescript
if (!validateNodeInvokeParams(params)) {
  respondInvalidParams({
    respond,
    method: "node.invoke",
    validator: validateNodeInvokeParams,
  });
  return;
}
```

### 2.2 respondUnavailableOnThrow

```typescript
export async function respondUnavailableOnThrow(respond: RespondFn, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
  }
}
```

비동기 함수 실행 중 에러 발생 시 `UNAVAILABLE` 에러로 응답합니다.

**사용 예시:**
```typescript
await respondUnavailableOnThrow(respond, async () => {
  const result = await performOperation();
  respond(true, result);
});
```

### 2.3 uniqueSortedStrings

```typescript
export function uniqueSortedStrings(values: unknown[]) {
  return [...new Set(values.filter((v) => typeof v === "string"))]
    .map((v) => v.trim())
    .filter(Boolean)
    .sort();
}
```

문자열 배열을 정규화합니다:
1. 문자열만 필터링
2. 공백 제거
3. 빈 문자열 제거
4. 중복 제거
5. 정렬

**사용 예시:**
```typescript
const commands = uniqueSortedStrings(node.commands);
```

### 2.4 safeParseJson

```typescript
export function safeParseJson(value: string | null | undefined): unknown {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return { payloadJSON: value };
  }
}
```

JSON 문자열을 안전하게 파싱합니다. 실패 시 원본 문자열을 포함한 객체를 반환합니다.

**사용 예시:**
```typescript
const payload = res.payloadJSON
  ? safeParseJson(res.payloadJSON)
  : res.payload;
```

## 3. ValidatorFn 타입

### 3.1 타입 정의

```typescript
type ValidatorFn = ((value: unknown) => boolean) & {
  errors?: ErrorObject[] | null;
};
```

Ajv 검증 함수와 호환되는 타입입니다.

## 4. 사용 패턴

### 4.1 파라미터 검증 패턴

```typescript
if (!validateMethodParams(params)) {
  respondInvalidParams({
    respond,
    method: "method.name",
    validator: validateMethodParams,
  });
  return;
}
```

### 4.2 에러 처리 패턴

```typescript
await respondUnavailableOnThrow(respond, async () => {
  // 비즈니스 로직
  const result = await operation();
  respond(true, result);
});
```

### 4.3 JSON 파싱 패턴

```typescript
const payload = res.payloadJSON
  ? safeParseJson(res.payloadJSON)
  : res.payload;

if (!payload || typeof payload !== "object") {
  respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid payload"));
  return;
}
```

## 5. 에러 포맷팅

### 5.1 formatValidationErrors

`formatValidationErrors`는 Ajv 에러 객체 배열을 사용자 친화적인 문자열로 변환합니다.

**에러 형식:**
```
field1: error message; field2: error message
```

## 6. 성능 고려사항

### 6.1 JSON 파싱

`safeParseJson`은 실패 시 예외를 발생시키지 않으므로 성능에 영향을 주지 않습니다.

### 6.2 문자열 정규화

`uniqueSortedStrings`는 Set을 사용하여 효율적으로 중복을 제거합니다.

## 7. 보안 고려사항

### 7.1 JSON 파싱

`safeParseJson`은 파싱 실패 시 원본 값을 반환하므로, 호출자는 결과를 검증해야 합니다.

### 7.2 문자열 정규화

`uniqueSortedStrings`는 공백을 제거하여 보안 문제를 방지합니다.
