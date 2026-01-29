# 채팅 첨부파일 처리

**작성일**: 2026-01-28  
**모듈**: `src/gateway/chat-attachments.ts`

## 1. 개요

채팅 첨부파일 처리 시스템은 메시지와 함께 전송되는 이미지를 파싱하고 Claude API 호환 형식으로 변환합니다.

## 2. 첨부파일 타입

### 2.1 ChatAttachment

```typescript
export type ChatAttachment = {
  type?: string;
  mimeType?: string;
  fileName?: string;
  content?: unknown;
};
```

**필드:**
- `type`: 첨부파일 타입 (선택적)
- `mimeType`: MIME 타입 (선택적)
- `fileName`: 파일 이름 (선택적)
- `content`: 파일 내용 (Base64 문자열 또는 ArrayBuffer)

### 2.2 ChatImageContent

```typescript
export type ChatImageContent = {
  type: "image";
  data: string;
  mimeType: string;
};
```

Claude API 호환 이미지 형식입니다.

### 2.3 ParsedMessageWithImages

```typescript
export type ParsedMessageWithImages = {
  message: string;
  images: ChatImageContent[];
};
```

파싱된 메시지와 이미지입니다.

## 3. 메시지 파싱

### 3.1 parseMessageWithAttachments

```typescript
export async function parseMessageWithAttachments(
  message: string,
  attachments: ChatAttachment[] | undefined,
  opts?: { maxBytes?: number; log?: AttachmentLog },
): Promise<ParsedMessageWithImages>
```

메시지와 첨부파일을 파싱하여 Claude API 호환 형식으로 변환합니다.

**파라미터:**
- `message`: 메시지 텍스트
- `attachments`: 첨부파일 배열
- `opts.maxBytes`: 최대 파일 크기 (기본값: 5MB)
- `opts.log`: 로거

**프로세스:**

1. **첨부파일 확인**
```typescript
if (!attachments || attachments.length === 0) {
  return { message, images: [] };
}
```

2. **각 첨부파일 처리**
```typescript
for (const [idx, att] of attachments.entries()) {
  // Base64 추출
  let b64 = content.trim();
  const dataUrlMatch = /^data:[^;]+;base64,(.*)$/.exec(b64);
  if (dataUrlMatch) {
    b64 = dataUrlMatch[1];
  }
  
  // Base64 검증
  if (b64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(b64)) {
    throw new Error(`attachment ${label}: invalid base64 content`);
  }
  
  // 크기 확인
  const sizeBytes = Buffer.from(b64, "base64").byteLength;
  if (sizeBytes <= 0 || sizeBytes > maxBytes) {
    throw new Error(`attachment ${label}: exceeds size limit`);
  }
  
  // MIME 감지
  const providedMime = normalizeMime(mime);
  const sniffedMime = normalizeMime(await sniffMimeFromBase64(b64));
  
  // 이미지 확인
  if (sniffedMime && !isImageMime(sniffedMime)) {
    log?.warn(`attachment ${label}: detected non-image, dropping`);
    continue;
  }
  
  // 이미지 추가
  images.push({
    type: "image",
    data: b64,
    mimeType: sniffedMime ?? providedMime ?? mime,
  });
}
```

### 3.2 MIME 정규화

```typescript
function normalizeMime(mime?: string): string | undefined {
  if (!mime) return undefined;
  const cleaned = mime.split(";")[0]?.trim().toLowerCase();
  return cleaned || undefined;
}
```

MIME 타입을 정규화합니다 (파라미터 제거, 소문자 변환).

### 3.3 MIME 감지

```typescript
async function sniffMimeFromBase64(base64: string): Promise<string | undefined> {
  const trimmed = base64.trim();
  if (!trimmed) return undefined;
  
  const take = Math.min(256, trimmed.length);
  const sliceLen = take - (take % 4);
  if (sliceLen < 8) return undefined;
  
  try {
    const head = Buffer.from(trimmed.slice(0, sliceLen), "base64");
    return await detectMime({ buffer: head });
  } catch {
    return undefined;
  }
}
```

Base64 데이터의 처음 256바이트를 읽어 MIME 타입을 감지합니다.

### 3.4 이미지 MIME 확인

```typescript
function isImageMime(mime?: string): boolean {
  return typeof mime === "string" && mime.startsWith("image/");
}
```

MIME 타입이 이미지인지 확인합니다.

## 4. 레거시 함수

### 4.1 buildMessageWithAttachments (Deprecated)

```typescript
export function buildMessageWithAttachments(
  message: string,
  attachments: ChatAttachment[] | undefined,
  opts?: { maxBytes?: number },
): string
```

**경고:** 이 함수는 deprecated입니다. Markdown data URL을 생성하지만 Claude API는 이를 이미지로 처리하지 않습니다.

**대신 사용:** `parseMessageWithAttachments()`를 사용하세요.

## 5. 크기 제한

### 5.1 기본 제한

- `parseMessageWithAttachments`: 5MB
- `buildMessageWithAttachments`: 2MB (deprecated)

### 5.2 크기 검증

```typescript
const sizeBytes = Buffer.from(b64, "base64").byteLength;
if (sizeBytes <= 0 || sizeBytes > maxBytes) {
  throw new Error(`attachment ${label}: exceeds size limit (${sizeBytes} > ${maxBytes} bytes)`);
}
```

## 6. 에러 처리

### 6.1 주요 에러

- **invalid base64 content**: Base64 형식이 잘못됨
- **exceeds size limit**: 파일 크기가 제한을 초과함
- **non-image detected**: 이미지가 아님 (자동 제거)

### 6.2 에러 메시지

에러 메시지는 첨부파일 레이블을 포함합니다:
- `fileName`
- `type`
- `attachment-{index}` (기본값)

## 7. MIME 타입 우선순위

1. **감지된 MIME**: Base64 데이터에서 감지
2. **제공된 MIME**: 요청에서 제공된 MIME 타입
3. **기본 MIME**: 제공되지 않은 경우

**불일치 처리:**
감지된 MIME과 제공된 MIME이 다르면 감지된 MIME을 사용하고 경고를 로깅합니다.

## 8. 사용 예시

### 8.1 이미지 첨부

```typescript
const parsed = await parseMessageWithAttachments(
  "이 이미지를 분석해주세요",
  [
    {
      fileName: "screenshot.png",
      mimeType: "image/png",
      content: "iVBORw0KGgoAAAANSUhEUgAA...", // Base64
    },
  ],
  { maxBytes: 5_000_000 },
);

// parsed.images는 Claude API 호환 형식
// parsed.message는 원본 메시지
```

### 8.2 Data URL 처리

Data URL은 자동으로 처리됩니다:

```typescript
const parsed = await parseMessageWithAttachments(
  "이미지",
  [
    {
      content: "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    },
  ],
);
```

## 9. Claude API 통합

### 9.1 메시지 형식

파싱된 이미지는 Claude API 메시지 형식으로 변환됩니다:

```typescript
{
  role: "user",
  content: [
    { type: "text", text: parsed.message },
    ...parsed.images.map(img => ({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mimeType,
        data: img.data,
      },
    })),
  ],
}
```

## 10. 성능 고려사항

### 10.1 MIME 감지

MIME 감지는 비동기로 수행되며, 최대 256바이트만 읽습니다.

### 10.2 크기 제한

파일 크기는 Base64 디코딩 전에 검증하여 불필요한 처리를 방지합니다.

### 10.3 이미지 필터링

이미지가 아닌 첨부파일은 자동으로 제거되어 처리 시간을 절약합니다.

## 11. 보안 고려사항

### 11.1 크기 제한

파일 크기 제한을 통해 DoS 공격을 방지합니다.

### 11.2 MIME 검증

제공된 MIME 타입과 실제 파일 타입을 비교하여 위장을 방지합니다.

### 11.3 Base64 검증

Base64 형식을 엄격하게 검증하여 잘못된 데이터를 거부합니다.
