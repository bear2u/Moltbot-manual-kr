# Config 기능 상세 분석

**작성일**: 2026-01-28  
**모듈**: `ui/src/ui/views/config.ts`, `ui/src/ui/controllers/config.ts`

## 1. 개요

Config 페이지는 Gateway 설정 파일 (`~/.clawdbot/moltbot.json`)을 안전하게 편집할 수 있는 인터페이스입니다. 폼 기반 편집과 Raw JSON 편집을 모두 지원하며, 스키마 기반 검증과 동시 편집 방지 기능을 제공합니다.

## 2. 주요 기능

### 2.1 설정 편집
- 폼 기반 편집 (스키마 기반)
- Raw JSON 편집
- 설정 검증
- 설정 저장 및 적용

### 2.2 설정 스키마
- 동적 스키마 로드
- 플러그인 및 채널 스키마 포함
- UI 힌트 지원

### 2.3 동시 편집 방지
- Base hash 가드
- 변경 감지
- 충돌 해결

## 3. UI 구조

### 3.1 메인 카드
```typescript
// ui/src/ui/views/config.ts
<section class="card">
  <div class="card-title">Config</div>
  <div class="card-sub">
    Edit ~/.clawdbot/moltbot.json safely.
  </div>
  
  {/* 모드 전환 */}
  <div class="row">
    <button 
      class={formMode === "form" ? "btn active" : "btn"}
      @click={() => onFormModeChange("form")}
    >
      Form
    </button>
    <button 
      class={formMode === "raw" ? "btn active" : "btn"}
      @click={() => onFormModeChange("raw")}
    >
      Raw JSON
    </button>
  </div>
  
  {/* 검색 */}
  <div class="filters">
    <label>
      <span>Search</span>
      <input 
        value={searchQuery}
        placeholder="Search config..."
      />
    </label>
  </div>
  
  {/* 편집 영역 */}
  {formMode === "form" ? (
    renderConfigForm(props)
  ) : (
    renderRawEditor(props)
  )}
  
  {/* 액션 버튼 */}
  <div class="row">
    <button @click={onReload}>Reload</button>
    <button 
      @click={onSave}
      disabled={saving || !dirty}
    >
      {saving ? "Saving…" : "Save"}
    </button>
    <button 
      @click={onApply}
      disabled={applying || !dirty}
    >
      {applying ? "Applying…" : "Apply & Restart"}
    </button>
  </div>
</section>
```

## 4. 폼 기반 편집

### 4.1 설정 폼 렌더링
```typescript
// ui/src/ui/views/config-form.ts
export function renderConfigForm(props: ConfigFormProps) {
  const schema = props.schema;
  const form = props.form;
  const activeSection = props.activeSection;
  
  return html`
    <div class="config-form">
      {/* 사이드바 (섹션 목록) */}
      <div class="config-sidebar">
        {renderSectionList(schema, activeSection, props)}
      </div>
      
      {/* 메인 편집 영역 */}
      <div class="config-main">
        {activeSection ? (
          renderSection(schema, activeSection, form, props)
        ) : (
          renderAllSections(schema, form, props)
        )}
      </div>
    </div>
  `;
}
```

### 4.2 섹션 렌더링
```typescript
function renderSection(
  schema: JsonSchema,
  sectionKey: string,
  form: Record<string, unknown>,
  props: ConfigFormProps
) {
  const sectionSchema = getSectionSchema(schema, sectionKey);
  const sectionValue = form[sectionKey];
  
  return html`
    <div class="config-section">
      <div class="section-title">{humanize(sectionKey)}</div>
      
      {renderFields(sectionSchema, sectionValue, props)}
    </div>
  `;
}
```

### 4.3 필드 렌더링
```typescript
function renderFields(
  schema: JsonSchema,
  value: unknown,
  props: ConfigFormProps
) {
  const fields = schema.properties ?? {};
  
  return Object.entries(fields).map(([key, fieldSchema]) => {
    const fieldValue = value?.[key];
    const fieldType = schemaType(fieldSchema);
    
    switch (fieldType) {
      case "string":
        return renderStringField(key, fieldSchema, fieldValue, props);
      case "number":
        return renderNumberField(key, fieldSchema, fieldValue, props);
      case "boolean":
        return renderBooleanField(key, fieldSchema, fieldValue, props);
      case "object":
        return renderObjectField(key, fieldSchema, fieldValue, props);
      case "array":
        return renderArrayField(key, fieldSchema, fieldValue, props);
      default:
        return renderUnknownField(key, fieldSchema, fieldValue, props);
    }
  });
}
```

## 5. Raw JSON 편집

### 5.1 Raw 에디터 렌더링
```typescript
function renderRawEditor(props: ConfigProps) {
  return html`
    <div class="raw-editor">
      <textarea
        .value={props.raw}
        @input={(e) => props.onRawChange(e.target.value)}
        class="code-editor"
        spellcheck="false"
      ></textarea>
      
      {/* 검증 결과 */}
      {props.valid === false && (
        <div class="callout danger">
          <div>Validation errors:</div>
          <ul>
            {props.issues.map(issue => (
              <li>{formatIssue(issue)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  `;
}
```

## 6. Gateway API 호출

### 6.1 설정 조회
```typescript
// ui/src/ui/controllers/config.ts
export async function loadConfig(state: ConfigState) {
  const res = await state.client.request("config.get", {});
  
  state.configRaw = JSON.stringify(res.config, null, 2);
  state.configRawOriginal = state.configRaw;
  state.configForm = res.config;
  state.configFormOriginal = JSON.parse(JSON.stringify(res.config));
}
```

### 6.2 설정 스키마 조회
```typescript
export async function loadConfigSchema(state: ConfigState) {
  const res = await state.client.request("config.schema", {});
  
  state.configSchema = res.schema;
  state.configSchemaVersion = res.version ?? null;
  state.configUiHints = res.uiHints ?? {};
}
```

### 6.3 설정 저장
```typescript
export async function saveConfig(
  state: ConfigState,
  config: Record<string, unknown>
) {
  const baseHash = state.configSnapshot?.baseHash;
  
  await state.client.request("config.set", {
    config,
    baseHash,  // 동시 편집 방지
  });
}
```

### 6.4 설정 적용 및 재시작
```typescript
export async function applyConfig(
  state: ConfigState,
  config: Record<string, unknown>,
  sessionKey?: string
) {
  const baseHash = state.configSnapshot?.baseHash;
  
  await state.client.request("config.apply", {
    config,
    baseHash,
    sessionKey,  // 마지막 활성 세션 깨우기
  });
}
```

## 7. 설정 스키마

### 7.1 스키마 구조
```typescript
type JsonSchema = {
  type: "object";
  properties: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
  // ...
};
```

### 7.2 UI 힌트
```typescript
type ConfigUiHints = {
  [path: string]: {
    description?: string;
    placeholder?: string;
    examples?: unknown[];
    // ...
  };
};
```

## 8. 검증

### 8.1 JSON 검증
```typescript
function validateJson(raw: string): {
  valid: boolean;
  issues: unknown[];
} {
  try {
    const parsed = JSON.parse(raw);
    // 추가 검증 로직
    return { valid: true, issues: [] };
  } catch (err) {
    return {
      valid: false,
      issues: [{ message: String(err) }],
    };
  }
}
```

### 8.2 스키마 검증
```typescript
function validateSchema(
  value: unknown,
  schema: JsonSchema
): {
  valid: boolean;
  issues: unknown[];
} {
  // JSON Schema 검증
  // AJV 또는 다른 검증 라이브러리 사용
}
```

## 9. 동시 편집 방지

### 9.1 Base Hash
```typescript
// 설정 파일의 해시 값
type ConfigSnapshot = {
  config: Record<string, unknown>;
  baseHash: string;  // 파일 해시
};
```

### 9.2 변경 감지
```typescript
const dirty = JSON.stringify(configForm) 
  !== JSON.stringify(configFormOriginal);
```

### 9.3 충돌 처리
```typescript
try {
  await saveConfig(config, baseHash);
} catch (err) {
  if (err.message.includes("base hash")) {
    // 충돌 발생 - 재로드 필요
    await loadConfig();
    showError("Config was modified by another process. Please reload.");
  }
}
```

## 10. 섹션 목록

### 10.1 주요 섹션
- **env**: 환경 변수
- **agents**: 에이전트 설정
- **auth**: 인증 설정
- **channels**: 채널 설정
- **gateway**: Gateway 설정
- **tools**: 도구 설정
- **skills**: Skills 설정
- **hooks**: Hooks 설정

### 10.2 섹션 네비게이션
```typescript
function renderSectionList(
  schema: JsonSchema,
  activeSection: string | null,
  props: ConfigFormProps
) {
  const sections = Object.keys(schema.properties ?? {});
  
  return html`
    <div class="section-list">
      {sections.map(section => (
        <button
          class={activeSection === section ? "active" : ""}
          @click={() => props.onSectionChange(section)}
        >
          {humanize(section)}
        </button>
      ))}
    </div>
  `;
}
```

## 11. 검색 기능

### 11.1 검색 구현
```typescript
function filterSections(
  schema: JsonSchema,
  query: string
): string[] {
  const sections = Object.keys(schema.properties ?? {});
  const needle = query.toLowerCase();
  
  return sections.filter(section => {
    const sectionSchema = schema.properties[section];
    const description = sectionSchema.description ?? "";
    
    return (
      section.toLowerCase().includes(needle) ||
      description.toLowerCase().includes(needle)
    );
  });
}
```

## 12. 사용 시나리오

### 12.1 설정 편집 (폼 모드)
1. Config 페이지 열기
2. "Form" 모드 선택
3. 사이드바에서 섹션 선택
4. 필드 값 수정
5. "Save" 또는 "Apply & Restart" 클릭

### 12.2 설정 편집 (Raw 모드)
1. Config 페이지 열기
2. "Raw JSON" 모드 선택
3. JSON 직접 편집
4. 검증 결과 확인
5. "Save" 또는 "Apply & Restart" 클릭

### 12.3 설정 검색
1. Config 페이지 열기
2. 검색 필드에 키워드 입력
3. 관련 섹션/필드 하이라이트
4. 해당 섹션으로 이동

### 12.4 설정 적용 및 재시작
1. Config 페이지에서 설정 편집
2. "Apply & Restart" 버튼 클릭
3. Gateway 재시작 확인
4. 마지막 활성 세션 자동 깨우기

## 13. 코드 구조

### 13.1 주요 파일
- `ui/src/ui/views/config.ts`: Config 뷰 렌더링
- `ui/src/ui/views/config-form.ts`: 폼 렌더링
- `ui/src/ui/views/config-form.render.ts`: 필드 렌더링
- `ui/src/ui/views/config-form.shared.ts`: 공통 유틸리티
- `ui/src/ui/controllers/config.ts`: Config API 호출
- `ui/src/ui/types.ts`: 타입 정의

### 13.2 Props 타입
```typescript
export type ConfigProps = {
  raw: string;
  originalRaw: string;
  valid: boolean | null;
  issues: unknown[];
  loading: boolean;
  saving: boolean;
  applying: boolean;
  updating: boolean;
  connected: boolean;
  schema: unknown | null;
  schemaLoading: boolean;
  uiHints: ConfigUiHints;
  formMode: "form" | "raw";
  formValue: Record<string, unknown> | null;
  originalValue: Record<string, unknown> | null;
  searchQuery: string;
  activeSection: string | null;
  activeSubsection: string | null;
  onRawChange: (next: string) => void;
  onFormModeChange: (mode: "form" | "raw") => void;
  onFormPatch: (path: Array<string | number>, value: unknown) => void;
  onSearchChange: (query: string) => void;
  onSectionChange: (section: string | null) => void;
  onSubsectionChange: (section: string | null) => void;
  onReload: () => void;
  onSave: () => void;
  onApply: () => void;
  onUpdate: () => void;
};
```

## 14. 향후 개선 사항

- 설정 히스토리
- 설정 비교 기능
- 설정 템플릿
- 설정 가져오기/내보내기
- 설정 검증 규칙 커스터마이징
