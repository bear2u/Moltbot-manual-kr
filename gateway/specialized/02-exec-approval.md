---
layout: default
title: Exec Approval
---

# Exec Approval 시스템

**작성일**: 2026-01-28  
**모듈**: `src/gateway/exec-approval-manager.ts`, `src/gateway/server-methods/exec-approval.ts`, `src/gateway/server-methods/exec-approvals.ts`

## 1. 개요

Exec Approval 시스템은 에이전트가 명령을 실행하기 전에 사용자 승인을 받는 시스템입니다. 보안을 위해 중요한 명령 실행을 제어할 수 있습니다.

## 2. ExecApprovalManager

### 2.1 클래스 구조

```typescript
export class ExecApprovalManager {
  private pending = new Map<string, PendingEntry>();
  
  create(request: ExecApprovalRequestPayload, timeoutMs: number, id?: string | null): ExecApprovalRecord
  async waitForDecision(record: ExecApprovalRecord, timeoutMs: number): Promise<ExecApprovalDecision | null>
  resolve(recordId: string, decision: ExecApprovalDecision, resolvedBy?: string | null): boolean
  getSnapshot(recordId: string): ExecApprovalRecord | null
}
```

### 2.2 승인 요청 생성

```typescript
create(
  request: ExecApprovalRequestPayload,
  timeoutMs: number,
  id?: string | null,
): ExecApprovalRecord {
  const now = Date.now();
  const resolvedId = id && id.trim().length > 0 ? id.trim() : randomUUID();
  const record: ExecApprovalRecord = {
    id: resolvedId,
    request,
    createdAtMs: now,
    expiresAtMs: now + timeoutMs,
  };
  return record;
}
```

**요청 페이로드:**
```typescript
export type ExecApprovalRequestPayload = {
  command: string;
  cwd?: string | null;
  host?: string | null;
  security?: string | null;
  ask?: string | null;
  agentId?: string | null;
  resolvedPath?: string | null;
  sessionKey?: string | null;
};
```

### 2.3 승인 대기

```typescript
async waitForDecision(
  record: ExecApprovalRecord,
  timeoutMs: number,
): Promise<ExecApprovalDecision | null> {
  return await new Promise<ExecApprovalDecision | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      this.pending.delete(record.id);
      resolve(null); // 타임아웃 시 null 반환
    }, timeoutMs);
    
    this.pending.set(record.id, {
      record,
      resolve,
      reject,
      timer,
    });
  });
}
```

### 2.4 승인 해결

```typescript
resolve(recordId: string, decision: ExecApprovalDecision, resolvedBy?: string | null): boolean {
  const pending = this.pending.get(recordId);
  if (!pending) return false;
  
  clearTimeout(pending.timer);
  pending.record.resolvedAtMs = Date.now();
  pending.record.decision = decision;
  pending.record.resolvedBy = resolvedBy ?? null;
  this.pending.delete(recordId);
  pending.resolve(decision);
  return true;
}
```

**승인 결정:**
- `allow-once`: 한 번만 허용
- `allow-always`: 항상 허용
- `deny`: 거부

## 3. 승인 요청 메서드

### 3.1 exec.approval.request

```typescript
"exec.approval.request": async ({ params, respond, context }) => {
  const p = params as {
    id?: string;
    command: string;
    cwd?: string;
    host?: string;
    security?: string;
    ask?: string;
    agentId?: string;
    resolvedPath?: string;
    sessionKey?: string;
    timeoutMs?: number;
  };
  
  const timeoutMs = typeof p.timeoutMs === "number" ? p.timeoutMs : 120_000;
  const explicitId = typeof p.id === "string" && p.id.trim().length > 0 ? p.id.trim() : null;
  
  // 중복 확인
  if (explicitId && manager.getSnapshot(explicitId)) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "approval id already pending"));
    return;
  }
  
  const request = {
    command: p.command,
    cwd: p.cwd ?? null,
    host: p.host ?? null,
    security: p.security ?? null,
    ask: p.ask ?? null,
    agentId: p.agentId ?? null,
    resolvedPath: p.resolvedPath ?? null,
    sessionKey: p.sessionKey ?? null,
  };
  
  const record = manager.create(request, timeoutMs, explicitId);
  const decisionPromise = manager.waitForDecision(record, timeoutMs);
  
  // 이벤트 브로드캐스트
  context.broadcast("exec.approval.requested", {
    id: record.id,
    request: record.request,
    createdAtMs: record.createdAtMs,
    expiresAtMs: record.expiresAtMs,
  }, { dropIfSlow: true });
  
  // 전달자에게 전달
  void opts?.forwarder?.handleRequested({...}).catch(...);
  
  const decision = await decisionPromise;
  respond(true, {
    id: record.id,
    decision,
    createdAtMs: record.createdAtMs,
    expiresAtMs: record.expiresAtMs,
  });
}
```

### 3.2 exec.approval.resolve

```typescript
"exec.approval.resolve": async ({ params, respond, client, context }) => {
  const p = params as { id: string; decision: string };
  const decision = p.decision as ExecApprovalDecision;
  
  if (decision !== "allow-once" && decision !== "allow-always" && decision !== "deny") {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid decision"));
    return;
  }
  
  const resolvedBy = client?.connect?.client?.displayName ?? client?.connect?.client?.id;
  const ok = manager.resolve(p.id, decision, resolvedBy ?? null);
  
  if (!ok) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown approval id"));
    return;
  }
  
  // 이벤트 브로드캐스트
  context.broadcast("exec.approval.resolved", {
    id: p.id,
    decision,
    resolvedBy,
    ts: Date.now(),
  }, { dropIfSlow: true });
  
  // 전달자에게 전달
  void opts?.forwarder?.handleResolved({...}).catch(...);
  
  respond(true, { ok: true });
}
```

## 4. 승인 설정 관리

### 4.1 exec.approvals.get

```typescript
"exec.approvals.get": ({ params, respond }) => {
  ensureExecApprovals();
  const snapshot = readExecApprovalsSnapshot();
  respond(true, {
    path: snapshot.path,
    exists: snapshot.exists,
    hash: snapshot.hash,
    file: redactExecApprovals(snapshot.file),
  });
}
```

승인 설정 파일의 스냅샷을 조회합니다.

### 4.2 exec.approvals.set

```typescript
"exec.approvals.set": ({ params, respond }) => {
  ensureExecApprovals();
  const snapshot = readExecApprovalsSnapshot();
  
  // Base hash 검증
  if (!requireApprovalsBaseHash(params, snapshot, respond)) {
    return;
  }
  
  const incoming = (params as { file?: unknown }).file;
  const normalized = normalizeExecApprovals(incoming as ExecApprovalsFile);
  
  // Socket 경로 및 토큰 유지
  const currentSocketPath = snapshot.file.socket?.path?.trim();
  const currentToken = snapshot.file.socket?.token?.trim();
  const socketPath = normalized.socket?.path?.trim() ?? currentSocketPath ?? resolveExecApprovalsSocketPath();
  const token = normalized.socket?.token?.trim() ?? currentToken ?? "";
  
  const next: ExecApprovalsFile = {
    ...normalized,
    socket: { path: socketPath, token },
  };
  
  saveExecApprovals(next);
  const nextSnapshot = readExecApprovalsSnapshot();
  respond(true, {
    path: nextSnapshot.path,
    exists: nextSnapshot.exists,
    hash: nextSnapshot.hash,
    file: redactExecApprovals(nextSnapshot.file),
  });
}
```

승인 설정을 설정합니다. Base hash를 사용하여 동시 편집을 방지합니다.

### 4.3 exec.approvals.node.get

노드의 Exec 승인 설정을 조회합니다:

```typescript
"exec.approvals.node.get": async ({ params, respond, context }) => {
  const { nodeId } = params as { nodeId: string };
  const res = await context.nodeRegistry.invoke({
    nodeId,
    command: "system.execApprovals.get",
    params: {},
  });
  respond(res.ok, res.payloadJSON ? safeParseJson(res.payloadJSON) : res.payload, res.error);
}
```

### 4.4 exec.approvals.node.set

노드의 Exec 승인 설정을 설정합니다:

```typescript
"exec.approvals.node.set": async ({ params, respond, context }) => {
  const { nodeId, file, baseHash } = params as {
    nodeId: string;
    file: ExecApprovalsFile;
    baseHash?: string;
  };
  const res = await context.nodeRegistry.invoke({
    nodeId,
    command: "system.execApprovals.set",
    params: { file, baseHash },
  });
  respond(res.ok, safeParseJson(res.payloadJSON ?? null), res.error);
}
```

## 5. 승인 전달

### 5.1 ExecApprovalForwarder

승인 요청을 다른 Gateway로 전달할 수 있습니다:

```typescript
export type ExecApprovalForwarder = {
  handleRequested: (request: {...}) => Promise<void>;
  handleResolved: (resolution: {...}) => Promise<void>;
};
```

## 6. 승인 레코드

### 6.1 ExecApprovalRecord 구조

```typescript
export type ExecApprovalRecord = {
  id: string;
  request: ExecApprovalRequestPayload;
  createdAtMs: number;
  expiresAtMs: number;
  resolvedAtMs?: number;
  decision?: ExecApprovalDecision;
  resolvedBy?: string | null;
};
```

## 7. 이벤트

### 7.1 exec.approval.requested

승인 요청이 생성되면 브로드캐스트됩니다:

```typescript
{
  id: string;
  request: ExecApprovalRequestPayload;
  createdAtMs: number;
  expiresAtMs: number;
}
```

### 7.2 exec.approval.resolved

승인이 해결되면 브로드캐스트됩니다:

```typescript
{
  id: string;
  decision: ExecApprovalDecision;
  resolvedBy?: string;
  ts: number;
}
```

## 8. 스코프

승인 관련 메서드는 `operator.approvals` 스코프가 필요합니다.

## 9. 타임아웃

기본 타임아웃은 120초입니다. 타임아웃이 지나면 `null`이 반환됩니다.

## 10. 보안 고려사항

### 10.1 승인 요청 검증

승인 요청은 다음을 포함해야 합니다:
- 명령 (`command`)
- 작업 디렉토리 (`cwd`, 선택적)
- 호스트 (`host`, 선택적)
- 보안 레벨 (`security`, 선택적)
- 사용자 질문 (`ask`, 선택적)

### 10.2 승인 결정 검증

승인 결정은 다음 중 하나여야 합니다:
- `allow-once`
- `allow-always`
- `deny`

### 10.3 Base Hash 검증

설정 변경 시 Base hash를 사용하여 동시 편집을 방지합니다.

## 11. 사용 예시

### 11.1 승인 요청

```typescript
const result = await gateway.request("exec.approval.request", {
  command: "rm -rf /",
  cwd: "/tmp",
  ask: "정말 삭제하시겠습니까?",
  timeoutMs: 60000,
});

if (result.decision === "allow-once") {
  // 명령 실행
} else if (result.decision === "deny") {
  // 명령 거부
}
```

### 11.2 승인 해결

```typescript
await gateway.request("exec.approval.resolve", {
  id: approvalId,
  decision: "allow-once",
});
```
