---
layout: default
title: Chat
---

# Chat 기능 상세 분석

**작성일**: 2026-01-28  
**모듈**: `ui/src/ui/views/chat.ts`, `ui/src/ui/controllers/chat.ts`

## 1. 개요

Chat 기능은 Gateway와 직접 대화할 수 있는 인터페이스를 제공합니다. AI 에이전트와 실시간으로 대화하고, 도구 호출을 시각화하며, 스트리밍 응답을 받을 수 있습니다.

## 2. 주요 기능

### 2.1 채팅 인터페이스
- 메시지 입력 및 전송
- 스트리밍 응답 표시
- 도구 호출 카드 표시
- 이미지 첨부 지원
- 메시지 히스토리 표시

### 2.2 세션 관리
- 세션 키 선택 및 변경
- 세션별 히스토리 로드
- 세션 리셋 (`/new` 명령)

### 2.3 스트리밍
- 실시간 텍스트 스트리밍
- 도구 호출 이벤트 표시
- 진행 상태 표시

## 3. UI 컴포넌트

### 3.1 메시지 영역
```typescript
// ui/src/ui/views/chat.ts
export type ChatProps = {
  sessionKey: string;
  messages: unknown[];
  toolMessages: unknown[];
  stream: string | null;
  streamStartedAt: number | null;
  draft: string;
  queue: ChatQueueItem[];
  // ...
};
```

### 3.2 메시지 그룹화
- 같은 역할의 연속 메시지를 그룹화
- 타임스탬프 표시
- 읽기 표시기

### 3.3 도구 카드
- 도구 호출 시각화
- 도구 출력 표시
- 사이드바에서 상세 보기

## 4. Gateway API 호출

### 4.1 히스토리 로드
```typescript
// ui/src/ui/controllers/chat.ts
export async function loadChatHistory(state: ChatState) {
  const res = await state.client.request("chat.history", {
    sessionKey: state.sessionKey,
    limit: 200,
  });
  state.chatMessages = res.messages ?? [];
}
```

### 4.2 메시지 전송
```typescript
export async function sendChatMessage(
  state: ChatState,
  message: string,
  attachments?: ChatAttachment[]
): Promise<boolean> {
  const runId = generateUUID();
  
  await state.client.request("chat.send", {
    sessionKey: state.sessionKey,
    message,
    attachments: apiAttachments,
    idempotencyKey: runId,
  });
  
  // 스트리밍 응답은 이벤트로 수신
}
```

### 4.3 중단
```typescript
await state.client.request("chat.abort", {
  sessionKey: state.sessionKey,
  runId: state.chatRunId,
});
```

## 5. 이벤트 처리

### 5.1 Chat 이벤트
```typescript
// Gateway에서 전송되는 이벤트
{
  type: "event",
  event: "chat",
  payload: {
    runId: string;
    sessionKey: string;
    state: "delta" | "final" | "aborted" | "error";
    message?: unknown;
    errorMessage?: string;
  }
}
```

### 5.2 Agent 이벤트
```typescript
// 도구 호출 이벤트
{
  type: "event",
  event: "agent",
  payload: {
    runId: string;
    sessionKey: string;
    toolCall?: {
      name: string;
      arguments: unknown;
    };
    toolResult?: unknown;
  }
}
```

## 6. 이미지 첨부

### 6.1 지원 형식
- PNG, JPEG, GIF 등 이미지 형식
- Base64 인코딩
- 클립보드에서 붙여넣기 지원

### 6.2 처리 흐름
```typescript
// Paste 이벤트 처리
function handlePaste(e: ClipboardEvent, props: ChatProps) {
  const items = e.clipboardData?.items;
  const imageItems = Array.from(items).filter(
    item => item.type.startsWith("image/")
  );
  
  // FileReader로 Data URL 생성
  // attachments 상태에 추가
}
```

## 7. 스트리밍 표시

### 7.1 델타 업데이트
```typescript
// 스트리밍 중 델타 이벤트
if (payload.state === "delta") {
  state.chatStream = (state.chatStream || "") + delta;
  // UI 업데이트
}
```

### 7.2 최종 응답
```typescript
// 최종 응답
if (payload.state === "final") {
  state.chatMessages.push({
    role: "assistant",
    content: payload.message,
    timestamp: Date.now(),
  });
  state.chatStream = null;
}
```

## 8. 도구 카드 표시

### 8.1 도구 호출 카드
- 도구 이름
- 인자 미리보기
- 실행 상태

### 8.2 도구 결과 카드
- 결과 미리보기
- 사이드바에서 전체 결과 보기
- 마크다운 렌더링

## 9. Focus Mode

### 9.1 기능
- 메시지 입력 영역 확대
- 사이드바 숨김
- 집중 모드 활성화

### 9.2 토글
```typescript
onToggleFocusMode: () => void;
```

## 10. 큐 시스템

### 10.1 메시지 큐
- 여러 메시지를 큐에 추가
- 순차적으로 전송
- 큐에서 제거 가능

### 10.2 큐 아이템
```typescript
type ChatQueueItem = {
  id: string;
  message: string;
  timestamp: number;
};
```

## 11. 컨텍스트 압축 표시

### 11.1 압축 인디케이터
- 압축 진행 중 표시
- 압축 완료 알림
- 일정 시간 후 자동 숨김

### 11.2 상태
```typescript
type CompactionIndicatorStatus = {
  active: boolean;
  startedAt: number | null;
  completedAt: number | null;
};
```

## 12. 키보드 단축키

- `Enter`: 메시지 전송
- `Shift+Enter`: 줄바꿈
- `↑`: 이전 메시지 (히스토리)
- `/new`: 새 세션 시작
- `/stop`: 현재 실행 중단

## 13. 코드 구조

### 13.1 주요 파일
- `ui/src/ui/views/chat.ts`: Chat 뷰 렌더링
- `ui/src/ui/controllers/chat.ts`: Chat 로직 및 API 호출
- `ui/src/ui/app-chat.ts`: App 레벨 Chat 통합
- `ui/src/ui/chat/`: Chat 관련 유틸리티
  - `message-normalizer.ts`: 메시지 정규화
  - `grouped-render.ts`: 그룹화 렌더링
  - `tool-cards.ts`: 도구 카드 렌더링

### 13.2 메시지 정규화
```typescript
// ui/src/ui/chat/message-normalizer.ts
export function normalizeMessage(msg: unknown): ChatItem {
  // 메시지를 표준 형식으로 변환
  // 역할, 내용, 타임스탬프 추출
}
```

### 13.3 그룹화 렌더링
```typescript
// ui/src/ui/chat/grouped-render.ts
export function renderMessageGroup(
  group: MessageGroup,
  props: ChatProps
): TemplateResult {
  // 연속된 같은 역할 메시지를 그룹화하여 렌더링
}
```

## 14. 사용 예시

### 14.1 기본 채팅
1. Chat 탭 열기
2. 메시지 입력
3. Enter 또는 전송 버튼 클릭
4. 스트리밍 응답 확인

### 14.2 이미지 첨부
1. 이미지 복사
2. 메시지 입력 영역에 붙여넣기
3. 이미지 미리보기 확인
4. 메시지와 함께 전송

### 14.3 도구 결과 확인
1. 도구 호출 카드 클릭
2. 사이드바에서 전체 결과 확인
3. 마크다운 렌더링 확인

## 15. 제한사항

### 15.1 메시지 길이
- 히스토리 제한: 200개 메시지
- 긴 메시지는 자동 압축

### 15.2 이미지 크기
- 큰 이미지는 자동 리사이즈
- Base64 인코딩으로 인한 크기 증가

### 15.3 동시 실행
- 한 세션당 하나의 실행만 가능
- 새 메시지는 큐에 추가

## 16. 향후 개선 사항

- 다중 세션 동시 채팅
- 파일 첨부 지원 확대
- 메시지 검색 기능
- 히스토리 내보내기
- 커스텀 프롬프트 템플릿
