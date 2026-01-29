---
layout: default
title: Nodes
---

# Nodes 기능 상세 분석

**작성일**: 2026-01-28  
**모듈**: `ui/src/ui/views/nodes.ts`, `ui/src/ui/controllers/nodes.ts`

## 1. 개요

Nodes 페이지는 Gateway에 페어링된 디바이스 노드와 그들의 기능을 관리하는 인터페이스입니다. 노드 목록, 디바이스 페어링, Exec 승인 설정 등을 관리할 수 있습니다.

## 2. 주요 기능

### 2.1 노드 목록
- 연결된 노드 목록 표시
- 노드 기능 (caps) 표시
- 노드 상태 확인

### 2.2 디바이스 페어링
- 페어링 요청 목록
- 페어링된 디바이스 목록
- 디바이스 승인/거부
- 디바이스 토큰 회전/해지

### 2.3 노드 바인딩
- 기본 노드 설정
- 에이전트별 노드 바인딩

### 2.4 Exec 승인 설정
- Gateway Exec 승인 설정
- 노드별 Exec 승인 설정
- 에이전트별 Allowlist 관리

## 3. UI 구조

### 3.1 노드 목록 카드
```typescript
// ui/src/ui/views/nodes.ts
<section class="card">
  <div class="card-title">Nodes</div>
  <div class="card-sub">
    Paired devices and live links.
  </div>
  
  <button @click={onRefresh}>
    {loading ? "Loading…" : "Refresh"}
  </button>
  
  <div class="list">
    {nodes.length === 0 ? (
      <div class="muted">No nodes found.</div>
    ) : (
      nodes.map(n => renderNode(n))
    )}
  </div>
</section>
```

### 3.2 디바이스 카드
```typescript
<section class="card">
  <div class="card-title">Devices</div>
  <div class="card-sub">
    Pairing requests + role tokens.
  </div>
  
  {/* 페어링 요청 */}
  {pending.length > 0 && (
    <div>
      <div class="muted">Pending</div>
      <div class="list">
        {pending.map(device => renderPendingDevice(device))}
      </div>
    </div>
  )}
  
  {/* 페어링된 디바이스 */}
  {paired.length > 0 && (
    <div>
      <div class="muted">Paired</div>
      <div class="list">
        {paired.map(device => renderPairedDevice(device))}
      </div>
    </div>
  )}
</section>
```

## 4. 노드 렌더링

### 4.1 노드 행 구조
```typescript
function renderNode(node: Record<string, unknown>) {
  const nodeId = String(node.id ?? "unknown");
  const caps = Array.isArray(node.caps) ? node.caps : [];
  const commands = Array.isArray(node.commands) ? node.commands : [];
  
  return html`
    <div class="list-item">
      <div class="list-main">
        {/* 노드 ID */}
        <div class="list-title">{nodeId}</div>
        
        {/* 기능 및 명령 */}
        <div class="chip-row">
          {caps.map(cap => (
            <span class="chip">{cap}</span>
          ))}
          {commands.map(cmd => (
            <span class="chip chip-info">{cmd}</span>
          ))}
        </div>
      </div>
    </div>
  `;
}
```

## 5. 디바이스 페어링

### 5.1 페어링 요청 렌더링
```typescript
function renderPendingDevice(device: PendingDevice) {
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">{device.deviceId}</div>
        <div class="list-sub">
          Role: {device.role}
          {device.scopes && device.scopes.length > 0 && (
            <> · Scopes: {device.scopes.join(", ")}</>
          )}
        </div>
      </div>
      <div class="list-actions">
        <button @click={() => onDeviceApprove(device.requestId)}>
          Approve
        </button>
        <button @click={() => onDeviceReject(device.requestId)}>
          Reject
        </button>
      </div>
    </div>
  `;
}
```

### 5.2 페어링된 디바이스 렌더링
```typescript
function renderPairedDevice(device: PairedDevice) {
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">{device.deviceId}</div>
        <div class="list-sub">
          Role: {device.role}
          {device.scopes && device.scopes.length > 0 && (
            <> · Scopes: {device.scopes.join(", ")}</>
          )}
        </div>
        <div class="chip-row">
          {device.summary && (
            <span class="chip">{device.summary}</span>
          )}
        </div>
      </div>
      <div class="list-actions">
        <button @click={() => onDeviceRotate(
          device.deviceId,
          device.role,
          device.scopes
        )}>
          Rotate Token
        </button>
        <button @click={() => onDeviceRevoke(
          device.deviceId,
          device.role
        )}>
          Revoke
        </button>
      </div>
    </div>
  `;
}
```

## 6. Gateway API 호출

### 6.1 노드 목록 조회
```typescript
// ui/src/ui/controllers/nodes.ts
export async function loadNodes(state: NodesState) {
  const res = await state.client.request("node.list", {});
  
  state.nodes = Array.isArray(res.nodes) ? res.nodes : [];
}
```

### 6.2 디바이스 목록 조회
```typescript
export async function loadDevices(state: NodesState) {
  const res = await state.client.request("devices.list", {});
  
  state.devicesList = res;
}
```

### 6.3 디바이스 승인
```typescript
export async function approveDevice(
  state: NodesState,
  requestId: string
) {
  await state.client.request("devices.approve", {
    requestId,
  });
}
```

### 6.4 디바이스 거부
```typescript
export async function rejectDevice(
  state: NodesState,
  requestId: string
) {
  await state.client.request("devices.reject", {
    requestId,
  });
}
```

### 6.5 토큰 회전
```typescript
export async function rotateDeviceToken(
  state: NodesState,
  deviceId: string,
  role: string,
  scopes?: string[]
) {
  await state.client.request("devices.rotate", {
    deviceId,
    role,
    scopes,
  });
}
```

### 6.6 토큰 해지
```typescript
export async function revokeDeviceToken(
  state: NodesState,
  deviceId: string,
  role: string
) {
  await state.client.request("devices.revoke", {
    deviceId,
    role,
  });
}
```

## 7. 노드 바인딩

### 7.1 기본 노드 설정
```typescript
export async function bindDefaultNode(
  state: NodesState,
  nodeId: string | null
) {
  await state.client.request("config.patch", {
    path: ["gateway", "nodes", "browser", "node"],
    value: nodeId,
  });
}
```

### 7.2 에이전트별 노드 바인딩
```typescript
export async function bindAgentNode(
  state: NodesState,
  agentIndex: number,
  nodeId: string | null
) {
  await state.client.request("config.patch", {
    path: ["routing", "agents", agentIndex, "node"],
    value: nodeId,
  });
}
```

## 8. Exec 승인 설정

### 8.1 Exec 승인 폼
```typescript
function renderExecApprovals(props: NodesProps) {
  return html`
    <section class="card">
      <div class="card-title">Exec Approvals</div>
      
      {/* 타겟 선택 */}
      <div class="form-grid">
        <label>
          <span>Target</span>
          <select 
            value={props.execApprovalsTarget}
            @change={(e) => props.onExecApprovalsTargetChange(
              e.target.value as "gateway" | "node",
              props.execApprovalsTargetNodeId
            )}
          >
            <option value="gateway">Gateway</option>
            <option value="node">Node</option>
          </select>
        </label>
        
        {/* 노드 선택 (Node 타겟인 경우) */}
        {props.execApprovalsTarget === "node" && (
          <label>
            <span>Node</span>
            <select 
              value={props.execApprovalsTargetNodeId || ""}
              @change={(e) => props.onExecApprovalsTargetChange(
                "node",
                e.target.value || null
              )}
            >
              <option value="">Select node</option>
              {props.nodes.map(n => (
                <option value={String(n.id)}>{String(n.id)}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      
      {/* 에이전트 선택 */}
      <label>
        <span>Agent</span>
        <select 
          value={props.execApprovalsSelectedAgent || ""}
          @change={(e) => props.onExecApprovalsSelectAgent(
            e.target.value
          )}
        >
          <option value="">Select agent</option>
          {agents.map(agent => (
            <option value={agent.id}>{agent.id}</option>
          ))}
        </select>
      </label>
      
      {/* Allowlist 편집 */}
      {props.execApprovalsForm && (
        <div>
          {/* Allowlist 항목 표시 및 편집 */}
          {renderAllowlistForm(props.execApprovalsForm)}
        </div>
      )}
      
      {/* 저장 버튼 */}
      <button 
        @click={props.onSaveExecApprovals}
        disabled={props.execApprovalsSaving || !props.execApprovalsDirty}
      >
        {props.execApprovalsSaving ? "Saving…" : "Save"}
      </button>
    </section>
  `;
}
```

## 9. 타입 정의

### 9.1 노드 타입
```typescript
type Node = {
  id: string;
  caps?: string[];  // 기능 (예: "browser", "camera", "screen")
  commands?: string[];  // 명령 (예: "canvas.push", "camera.snap")
};
```

### 9.2 디바이스 타입
```typescript
type PendingDevice = {
  requestId: string;
  deviceId: string;
  role: string;
  scopes?: string[];
};

type PairedDevice = {
  deviceId: string;
  role: string;
  scopes?: string[];
  summary?: string;
};

type DevicePairingList = {
  pending: PendingDevice[];
  paired: PairedDevice[];
};
```

### 9.3 Exec 승인 타입
```typescript
type ExecApprovalsFile = {
  allowlist: ExecApprovalsAllowlistEntry[];
  askPolicy?: "allow" | "deny" | "ask";
};

type ExecApprovalsAllowlistEntry = {
  pattern: string;
  comment?: string;
};
```

## 10. 노드 기능 (Caps)

### 10.1 일반적인 기능
- **browser**: 브라우저 제어
- **camera**: 카메라 접근
- **screen**: 화면 녹화
- **location**: 위치 정보
- **canvas**: Canvas 제어
- **notify**: 알림 전송

## 11. 사용 시나리오

### 11.1 노드 목록 확인
1. Nodes 페이지 열기
2. 연결된 노드 목록 확인
3. 각 노드의 기능 및 명령 확인

### 11.2 디바이스 페어링 승인
1. Nodes 페이지 열기
2. "Devices" 섹션에서 페어링 요청 확인
3. "Approve" 버튼 클릭
4. 디바이스가 "Paired" 목록에 추가됨

### 11.3 노드 바인딩 설정
1. Nodes 페이지 열기
2. "Bindings" 섹션에서 기본 노드 선택
3. 또는 에이전트별 노드 선택
4. "Save" 버튼 클릭

### 11.4 Exec 승인 설정
1. Nodes 페이지 열기
2. "Exec Approvals" 섹션에서 타겟 선택 (Gateway/Node)
3. 에이전트 선택
4. Allowlist 편집
5. "Save" 버튼 클릭

## 12. 코드 구조

### 12.1 주요 파일
- `ui/src/ui/views/nodes.ts`: Nodes 뷰 렌더링
- `ui/src/ui/controllers/nodes.ts`: Nodes API 호출
- `ui/src/ui/controllers/devices.ts`: 디바이스 관리
- `ui/src/ui/controllers/exec-approvals.ts`: Exec 승인 관리
- `ui/src/ui/types.ts`: 타입 정의

### 12.2 Props 타입
```typescript
export type NodesProps = {
  loading: boolean;
  nodes: Array<Record<string, unknown>>;
  devicesLoading: boolean;
  devicesError: string | null;
  devicesList: DevicePairingList | null;
  configForm: Record<string, unknown> | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  configFormMode: "form" | "raw";
  execApprovalsLoading: boolean;
  execApprovalsSaving: boolean;
  execApprovalsDirty: boolean;
  execApprovalsSnapshot: ExecApprovalsSnapshot | null;
  execApprovalsForm: ExecApprovalsFile | null;
  execApprovalsSelectedAgent: string | null;
  execApprovalsTarget: "gateway" | "node";
  execApprovalsTargetNodeId: string | null;
  onRefresh: () => void;
  onDevicesRefresh: () => void;
  onDeviceApprove: (requestId: string) => void;
  onDeviceReject: (requestId: string) => void;
  onDeviceRotate: (deviceId: string, role: string, scopes?: string[]) => void;
  onDeviceRevoke: (deviceId: string, role: string) => void;
  onLoadConfig: () => void;
  onLoadExecApprovals: () => void;
  onBindDefault: (nodeId: string | null) => void;
  onBindAgent: (agentIndex: number, nodeId: string | null) => void;
  onSaveBindings: () => void;
  onExecApprovalsTargetChange: (kind: "gateway" | "node", nodeId: string | null) => void;
  onExecApprovalsSelectAgent: (agentId: string) => void;
  onExecApprovalsPatch: (path: Array<string | number>, value: unknown) => void;
  onExecApprovalsRemove: (path: Array<string | number>) => void;
  onSaveExecApprovals: () => void;
};
```

## 13. 향후 개선 사항

- 노드별 상세 정보 모달
- 노드 상태 모니터링
- 노드별 로그 뷰어
- 노드 그룹 관리
- 노드 알림 설정
