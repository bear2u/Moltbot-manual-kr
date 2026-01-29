---
layout: default
title: Sessions
---

# Sessions 기능 상세 분석

**작성일**: 2026-01-28  
**모듈**: `ui/src/ui/views/sessions.ts`, `ui/src/ui/controllers/sessions.ts`

## 1. 개요

Sessions 페이지는 Gateway가 추적하는 모든 활성 세션을 관리하고, 세션별 설정(thinking level, verbose level 등)을 조정할 수 있는 인터페이스입니다.

## 2. 주요 기능

### 2.1 세션 목록
- 활성 세션 키 목록 표시
- 세션별 메타데이터 (라벨, 모델, 토큰 사용량 등)
- 세션별 설정 오버라이드

### 2.2 세션 필터링
- 활성 시간 범위 필터
- 글로벌 세션 포함/제외
- 알 수 없는 세션 포함/제외

### 2.3 세션 설정
- Thinking Level 설정
- Verbose Level 설정
- Reasoning Level 설정
- 라벨 설정

## 3. UI 구조

### 3.1 메인 카드
```typescript
// ui/src/ui/views/sessions.ts
<section class="card">
  <div class="card-title">Sessions</div>
  <div class="card-sub">
    Active session keys and per-session overrides.
  </div>
  
  {/* 새로고침 버튼 */}
  <button @click={onRefresh}>
    {loading ? "Loading…" : "Refresh"}
  </button>
  
  {/* 필터 */}
  <div class="filters">
    <label>
      <span>Active within (minutes)</span>
      <input value={activeMinutes} />
    </label>
    <label>
      <span>Limit</span>
      <input value={limit} />
    </label>
    <label class="checkbox">
      <span>Include global</span>
      <input type="checkbox" checked={includeGlobal} />
    </label>
    <label class="checkbox">
      <span>Include unknown</span>
      <input type="checkbox" checked={includeUnknown} />
    </label>
  </div>
  
  {/* 세션 목록 */}
  <div class="list">
    {rows.map(row => renderSessionRow(row))}
  </div>
</section>
```

## 4. 세션 행 렌더링

### 4.1 세션 행 구조
```typescript
function renderSessionRow(row: GatewaySessionRow) {
  return html`
    <div class="list-item">
      <div class="list-main">
        {/* 세션 키 */}
        <div class="list-title">
          {row.key}
        </div>
        
        {/* 라벨 */}
        {row.label && (
          <div class="list-sub">{row.label}</div>
        )}
        
        {/* 칩 (모델, 토큰 등) */}
        <div class="chip-row">
          {row.model && (
            <span class="chip">{row.model}</span>
          )}
          {row.tokensUsed && (
            <span class="chip">
              {formatSessionTokens(row.tokensUsed)}
            </span>
          )}
        </div>
      </div>
      
      {/* 설정 오버라이드 */}
      <div class="list-actions">
        {/* Thinking Level */}
        <select value={row.thinkingLevel || ""}>
          <option value="">inherit</option>
          <option value="off">off</option>
          <option value="minimal">minimal</option>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
        
        {/* Verbose Level */}
        <select value={row.verboseLevel || ""}>
          <option value="">inherit</option>
          <option value="off">off</option>
          <option value="on">on</option>
        </select>
        
        {/* 저장 버튼 */}
        <button @click={() => onPatch(row.key, patch)}>
          Save
        </button>
        
        {/* 삭제 버튼 */}
        <button @click={() => onDelete(row.key)}>
          Delete
        </button>
      </div>
    </div>
  `;
}
```

## 5. Gateway API 호출

### 5.1 세션 목록 조회
```typescript
// ui/src/ui/controllers/sessions.ts
export async function loadSessions(
  state: SessionsState,
  filters: {
    activeMinutes: string;
    limit: string;
    includeGlobal: boolean;
    includeUnknown: boolean;
  }
) {
  const res = await state.client.request("sessions.list", {
    activeMinutes: Number.parseInt(filters.activeMinutes) || 60,
    limit: Number.parseInt(filters.limit) || 100,
    includeGlobal: filters.includeGlobal,
    includeUnknown: filters.includeUnknown,
  });
  
  state.sessionsResult = res;
}
```

### 5.2 세션 설정 업데이트
```typescript
export async function patchSession(
  state: SessionsState,
  key: string,
  patch: {
    label?: string | null;
    thinkingLevel?: string | null;
    verboseLevel?: string | null;
    reasoningLevel?: string | null;
  }
) {
  await state.client.request("sessions.patch", {
    sessionKey: key,
    ...patch,
  });
}
```

### 5.3 세션 삭제
```typescript
export async function deleteSession(
  state: SessionsState,
  key: string
) {
  await state.client.request("sessions.delete", {
    sessionKey: key,
  });
}
```

## 6. 세션 타입

### 6.1 GatewaySessionRow
```typescript
// ui/src/ui/types.ts
type GatewaySessionRow = {
  key: string;  // 세션 키 (예: "main", "group:123456")
  label?: string | null;  // 사용자 정의 라벨
  model?: string | null;  // 사용 중인 모델
  tokensUsed?: number | null;  // 사용된 토큰 수
  thinkingLevel?: string | null;  // Thinking Level
  verboseLevel?: string | null;  // Verbose Level
  reasoningLevel?: string | null;  // Reasoning Level
  lastActiveAt?: number | null;  // 마지막 활동 시간
};
```

### 6.2 SessionsListResult
```typescript
type SessionsListResult = {
  sessions: GatewaySessionRow[];
  total?: number;
};
```

## 7. Thinking Level

### 7.1 레벨 옵션
- **inherit**: 기본값 상속
- **off**: 비활성화
- **minimal**: 최소
- **low**: 낮음
- **medium**: 중간
- **high**: 높음

### 7.2 바이너리 Thinking Provider
일부 프로바이더 (예: Z.ai)는 바이너리 모드만 지원:
- **off**: 비활성화
- **on**: 활성화 (내부적으로 "low"로 변환)

```typescript
function resolveThinkLevelOptions(provider?: string | null): readonly string[] {
  return isBinaryThinkingProvider(provider) 
    ? BINARY_THINK_LEVELS 
    : THINK_LEVELS;
}
```

## 8. Verbose Level

### 8.1 레벨 옵션
- **inherit**: 기본값 상속
- **off**: 명시적으로 비활성화
- **on**: 활성화

## 9. Reasoning Level

### 9.1 레벨 옵션
- **inherit**: 기본값 상속
- **off**: 비활성화
- **on**: 활성화
- **stream**: 스트리밍 모드

## 10. 필터링

### 10.1 활성 시간 필터
```typescript
// activeMinutes: 마지막 활동으로부터 경과 시간 (분)
activeMinutes: "60"  // 기본값: 60분
```

### 10.2 Limit 필터
```typescript
// limit: 최대 반환 개수
limit: "100"  // 기본값: 100개
```

### 10.3 Include Global
```typescript
// includeGlobal: 글로벌 세션 포함 여부
includeGlobal: true  // 기본값: false
```

### 10.4 Include Unknown
```typescript
// includeUnknown: 알 수 없는 세션 포함 여부
includeUnknown: false  // 기본값: false
```

## 11. 토큰 포맷팅

### 11.1 포맷 함수
```typescript
// ui/src/ui/presenter.ts
export function formatSessionTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${(tokens / 1000000).toFixed(1)}M`;
}
```

## 12. 세션 링크

### 12.1 Chat 링크
```typescript
// 세션 키를 Chat 페이지로 전달
<a href={pathForTab("chat", basePath) + `?session=${row.key}`}>
  Open in Chat
</a>
```

## 13. 사용 시나리오

### 13.1 세션 목록 확인
1. Sessions 페이지 열기
2. 활성 세션 목록 확인
3. 각 세션의 모델 및 토큰 사용량 확인

### 13.2 세션 설정 변경
1. Sessions 페이지 열기
2. 세션 행에서 Thinking Level 선택
3. "Save" 버튼 클릭
4. 변경사항 적용 확인

### 13.3 세션 라벨 설정
1. Sessions 페이지 열기
2. 세션 행에서 라벨 입력
3. "Save" 버튼 클릭
4. 라벨이 세션 목록에 표시됨

### 13.4 세션 삭제
1. Sessions 페이지 열기
2. 세션 행에서 "Delete" 버튼 클릭
3. 확인 후 세션 삭제

## 14. 코드 구조

### 14.1 주요 파일
- `ui/src/ui/views/sessions.ts`: Sessions 뷰 렌더링
- `ui/src/ui/controllers/sessions.ts`: Sessions API 호출
- `ui/src/ui/presenter.ts`: 포맷팅 함수
- `ui/src/ui/types.ts`: 타입 정의

### 14.2 Props 타입
```typescript
export type SessionsProps = {
  loading: boolean;
  result: SessionsListResult | null;
  error: string | null;
  activeMinutes: string;
  limit: string;
  includeGlobal: boolean;
  includeUnknown: boolean;
  basePath: string;
  onFiltersChange: (next: Filters) => void;
  onRefresh: () => void;
  onPatch: (key: string, patch: SessionPatch) => void;
  onDelete: (key: string) => void;
};
```

## 15. 향후 개선 사항

- 세션별 상세 통계
- 세션 히스토리 그래프
- 세션 검색 기능
- 일괄 세션 관리
- 세션 템플릿
