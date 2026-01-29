---
layout: default
title: Skills
---

# Skills 기능 상세 분석

**작성일**: 2026-01-28  
**모듈**: `ui/src/ui/views/skills.ts`, `ui/src/ui/controllers/skills.ts`

## 1. 개요

Skills 페이지는 에이전트가 사용할 수 있는 Skills를 관리하는 인터페이스입니다. Skills의 활성화/비활성화, 설치, API 키 설정 등을 관리할 수 있습니다.

## 2. 주요 기능

### 2.1 Skills 목록
- 모든 Skills 표시 (bundled, managed, workspace)
- Skills 상태 (enabled, eligible, blocked)
- Skills 메타데이터 (이름, 설명, 소스)

### 2.2 Skills 필터링
- 텍스트 검색
- 소스별 필터링
- 상태별 필터링

### 2.3 Skills 관리
- Skills 활성화/비활성화
- Skills 설치
- API 키 설정

## 3. UI 구조

### 3.1 메인 카드
```typescript
// ui/src/ui/views/skills.ts
<section class="card">
  <div class="card-title">Skills</div>
  <div class="card-sub">
    Bundled, managed, and workspace skills.
  </div>
  
  {/* 새로고침 버튼 */}
  <button @click={onRefresh}>
    {loading ? "Loading…" : "Refresh"}
  </button>
  
  {/* 필터 */}
  <div class="filters">
    <label>
      <span>Filter</span>
      <input 
        value={filter}
        placeholder="Search skills"
      />
    </label>
    <div class="muted">{filtered.length} shown</div>
  </div>
  
  {/* 에러 표시 */}
  {error && (
    <div class="callout danger">{error}</div>
  )}
  
  {/* Skills 목록 */}
  <div class="list">
    {filtered.length === 0 ? (
      <div class="muted">No skills found.</div>
    ) : (
      filtered.map(skill => renderSkill(skill, props))
    )}
  </div>
</section>
```

## 4. Skill 렌더링

### 4.1 Skill 행 구조
```typescript
function renderSkill(skill: SkillStatusEntry, props: SkillsProps) {
  const busy = props.busyKey === skill.skillKey;
  const apiKey = props.edits[skill.skillKey] ?? "";
  const message = props.messages[skill.skillKey] ?? null;
  const canInstall = skill.install.length > 0 
    && skill.missing.bins.length > 0;
  
  const missing = [
    ...skill.missing.bins.map(b => `bin:${b}`),
    ...skill.missing.env.map(e => `env:${e}`),
    ...skill.missing.config.map(c => `config:${c}`),
    ...skill.missing.os.map(o => `os:${o}`),
  ];
  
  const reasons: string[] = [];
  if (skill.disabled) reasons.push("disabled");
  if (skill.blockedByAllowlist) reasons.push("blocked by allowlist");
  
  return html`
    <div class="list-item">
      <div class="list-main">
        {/* 이름 및 이모지 */}
        <div class="list-title">
          {skill.emoji ? `${skill.emoji} ` : ""}{skill.name}
        </div>
        
        {/* 설명 */}
        <div class="list-sub">
          {clampText(skill.description, 140)}
        </div>
        
        {/* 칩 (소스, 상태 등) */}
        <div class="chip-row">
          <span class="chip">{skill.source}</span>
          <span class="chip ${skill.eligible ? "chip-ok" : "chip-warn"}">
            {skill.eligible ? "eligible" : "blocked"}
          </span>
          {skill.enabled && (
            <span class="chip chip-ok">enabled</span>
          )}
          {missing.length > 0 && (
            <span class="chip chip-warn">
              missing: {missing.join(", ")}
            </span>
          )}
          {reasons.length > 0 && (
            <span class="chip chip-warn">
              {reasons.join(", ")}
            </span>
          )}
        </div>
        
        {/* API 키 입력 */}
        {skill.requiresApiKey && (
          <div class="field" style="margin-top: 8px;">
            <input
              value={apiKey}
              placeholder="API key"
              @input={(e) => props.onEdit(skill.skillKey, e.target.value)}
            />
            <button 
              @click={() => props.onSaveKey(skill.skillKey)}
              disabled={busy}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        )}
        
        {/* 메시지 표시 */}
        {message && (
          <div class="callout" style="margin-top: 8px;">
            {message}
          </div>
        )}
      </div>
      
      {/* 액션 버튼 */}
      <div class="list-actions">
        {/* 활성화/비활성화 */}
        <button 
          @click={() => props.onToggle(skill.skillKey, !skill.enabled)}
          disabled={busy || !skill.eligible}
        >
          {skill.enabled ? "Disable" : "Enable"}
        </button>
        
        {/* 설치 */}
        {canInstall && (
          <button 
            @click={() => props.onInstall(
              skill.skillKey,
              skill.name,
              skill.install[0].id
            )}
            disabled={busy}
          >
            Install
          </button>
        )}
      </div>
    </div>
  `;
}
```

## 5. Gateway API 호출

### 5.1 Skills 상태 조회
```typescript
// ui/src/ui/controllers/skills.ts
export async function loadSkills(state: SkillsState) {
  const res = await state.client.request("skills.status", {});
  
  state.skillsReport = res;
}
```

### 5.2 Skill 활성화/비활성화
```typescript
export async function toggleSkill(
  state: SkillsState,
  skillKey: string,
  enabled: boolean
) {
  await state.client.request("skills.toggle", {
    skillKey,
    enabled,
  });
}
```

### 5.3 API 키 저장
```typescript
export async function saveSkillApiKey(
  state: SkillsState,
  skillKey: string,
  apiKey: string
) {
  await state.client.request("skills.setApiKey", {
    skillKey,
    apiKey,
  });
}
```

### 5.4 Skill 설치
```typescript
export async function installSkill(
  state: SkillsState,
  skillKey: string,
  name: string,
  installId: string
) {
  await state.client.request("skills.install", {
    skillKey,
    name,
    installId,
  });
}
```

## 6. Skill 타입

### 6.1 SkillStatusEntry
```typescript
// ui/src/ui/types.ts
type SkillStatusEntry = {
  skillKey: string;  // Skills 고유 키
  name: string;  // Skills 이름
  description: string;  // 설명
  emoji?: string | null;  // 이모지
  source: "bundled" | "managed" | "workspace";  // 소스
  enabled: boolean;  // 활성화 여부
  eligible: boolean;  // 사용 가능 여부
  disabled: boolean;  // 비활성화됨
  blockedByAllowlist: boolean;  // Allowlist에 의해 차단됨
  requiresApiKey: boolean;  // API 키 필요 여부
  missing: {
    bins: string[];  // 누락된 바이너리
    env: string[];  // 누락된 환경 변수
    config: string[];  // 누락된 설정
    os: string[];  // 누락된 OS 요구사항
  };
  install: Array<{
    id: string;
    name: string;
  }>;  // 설치 옵션
};
```

### 6.2 SkillStatusReport
```typescript
type SkillStatusReport = {
  skills: SkillStatusEntry[];
};
```

## 7. 필터링

### 7.1 텍스트 검색
```typescript
const filter = props.filter.trim().toLowerCase();
const filtered = filter
  ? skills.filter(skill =>
      [skill.name, skill.description, skill.source]
        .join(" ")
        .toLowerCase()
        .includes(filter)
    )
  : skills;
```

## 8. Skills 소스

### 8.1 Bundled Skills
- Moltbot에 번들로 포함된 Skills
- 기본 제공 Skills

### 8.2 Managed Skills
- 관리되는 Skills
- 외부에서 관리되는 Skills

### 8.3 Workspace Skills
- 워크스페이스에 있는 Skills
- 사용자 정의 Skills

## 9. Skills 상태

### 9.1 Eligible
- Skills가 사용 가능한 상태
- 모든 요구사항 충족

### 9.2 Blocked
- Skills가 차단된 상태
- Allowlist에 의해 차단되거나 요구사항 미충족

### 9.3 Enabled
- Skills가 활성화된 상태
- 에이전트가 사용 가능

## 10. 누락된 요구사항

### 10.1 바이너리
```typescript
missing.bins: ["python3", "ffmpeg"]
```

### 10.2 환경 변수
```typescript
missing.env: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"]
```

### 10.3 설정
```typescript
missing.config: ["tools.web.search.apiKey"]
```

### 10.4 OS 요구사항
```typescript
missing.os: ["darwin", "linux"]
```

## 11. 설치 옵션

### 11.1 설치 ID
```typescript
install: [
  {
    id: "install-python-deps",
    name: "Install Python dependencies"
  }
]
```

## 12. 사용 시나리오

### 12.1 Skills 활성화
1. Skills 페이지 열기
2. Skills 목록에서 활성화할 Skills 찾기
3. "Enable" 버튼 클릭
4. Skills 활성화 확인

### 12.2 API 키 설정
1. Skills 페이지 열기
2. API 키가 필요한 Skills 찾기
3. API 키 입력 필드에 키 입력
4. "Save" 버튼 클릭
5. API 키 저장 확인

### 12.3 Skills 설치
1. Skills 페이지 열기
2. 설치가 필요한 Skills 찾기
3. "Install" 버튼 클릭
4. 설치 진행 확인

### 12.4 Skills 검색
1. Skills 페이지 열기
2. 필터 입력 필드에 검색어 입력
3. 필터링된 결과 확인

## 13. 코드 구조

### 13.1 주요 파일
- `ui/src/ui/views/skills.ts`: Skills 뷰 렌더링
- `ui/src/ui/controllers/skills.ts`: Skills API 호출
- `ui/src/ui/types.ts`: 타입 정의

### 13.2 Props 타입
```typescript
export type SkillsProps = {
  loading: boolean;
  report: SkillStatusReport | null;
  error: string | null;
  filter: string;
  edits: Record<string, string>;  // 편집 중인 API 키
  busyKey: string | null;  // 처리 중인 Skills 키
  messages: SkillMessageMap;  // 메시지 맵
  onFilterChange: (next: string) => void;
  onRefresh: () => void;
  onToggle: (skillKey: string, enabled: boolean) => void;
  onEdit: (skillKey: string, value: string) => void;
  onSaveKey: (skillKey: string) => void;
  onInstall: (skillKey: string, name: string, installId: string) => void;
};
```

## 14. 향후 개선 사항

- Skills 카테고리별 그룹화
- Skills 상세 정보 모달
- Skills 사용 통계
- Skills 업데이트 알림
- Skills 템플릿
