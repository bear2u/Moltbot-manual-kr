# Gateway 인증 및 보안

**작성일**: 2026-01-28  
**모듈**: `src/gateway/auth.ts`, `src/gateway/server/ws-connection/message-handler.ts`

## 1. 개요

Gateway는 다양한 인증 방식을 지원하여 보안을 보장합니다. 인증 방식은 설정 파일, 환경변수, CLI 옵션을 통해 구성할 수 있으며, 바인딩 모드와 Tailscale 설정에 따라 요구사항이 달라집니다.

## 2. 인증 방식

### 2.1 토큰 기반 인증

**설정:**
```json
{
  "gateway": {
    "auth": {
      "mode": "token",
      "token": "your-secret-token"
    }
  }
}
```

**환경변수:**
```bash
CLAWDBOT_GATEWAY_TOKEN=your-secret-token
```

**특징:**
- `timingSafeEqual`을 사용한 안전한 비교
- 타이밍 공격 방지
- 간단하고 빠른 인증

### 2.2 비밀번호 기반 인증

**설정:**
```json
{
  "gateway": {
    "auth": {
      "mode": "password",
      "password": "your-secret-password"
    }
  }
}
```

**환경변수:**
```bash
CLAWDBOT_GATEWAY_PASSWORD=your-secret-password
```

**특징:**
- `timingSafeEqual`을 사용한 안전한 비교
- Tailscale Funnel 모드에서 필수
- 사용자 친화적 (토큰보다 기억하기 쉬움)

### 2.3 Tailscale 인증

**설정:**
```json
{
  "gateway": {
    "tailscale": {
      "mode": "serve"
    },
    "auth": {
      "allowTailscale": true
    }
  }
}
```

**특징:**
- Tailscale Serve/Funnel을 통한 자동 인증
- Tailscale 사용자 정보 자동 추출
- 프록시 헤더 검증
- `tailscale whois` 명령을 통한 사용자 확인

**인증 프로세스:**
1. Tailscale 프록시 헤더 확인 (`X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`)
2. Tailscale 사용자 헤더 확인 (`Tailscale-User-Login`, `Tailscale-User-Name`)
3. 클라이언트 IP에서 `tailscale whois` 실행
4. 사용자 정보 일치 확인

### 2.4 디바이스 인증 (노드)

노드 역할의 클라이언트는 공개키 기반 디바이스 인증을 사용합니다.

**인증 프로세스:**
1. 디바이스 공개키 추출
2. 디바이스 ID 생성 (`deriveDeviceIdFromPublicKey`)
3. 페어링 요청 확인 또는 토큰 검증
4. 서명 검증 (`verifyDeviceSignature`)

**서명 검증:**
```typescript
const payload = buildDeviceAuthPayload({
  nonce: connectNonce,
  ts: Date.now(),
  deviceId: deviceId,
});
const verified = verifyDeviceSignature({
  publicKey: devicePublicKey,
  signature: deviceSignature,
  payload,
  skewMs: DEVICE_SIGNATURE_SKEW_MS, // 10분
});
```

## 3. 인증 설정 해결

### 3.1 설정 우선순위

`resolveGatewayAuth()` 함수는 다음 순서로 인증 설정을 해결합니다:

1. CLI 옵션 (`opts.auth`)
2. 설정 파일 (`gateway.auth`)
3. 환경변수 (`CLAWDBOT_GATEWAY_TOKEN`, `CLAWDBOT_GATEWAY_PASSWORD`)

### 3.2 인증 모드 결정

```typescript
const mode: ResolvedGatewayAuth["mode"] = 
  authConfig.mode ?? (password ? "password" : "token");
```

- 명시적으로 `mode`가 지정되면 해당 모드 사용
- 그렇지 않으면 비밀번호가 있으면 `password`, 없으면 `token`

### 3.3 Tailscale 허용 여부

```typescript
const allowTailscale =
  authConfig.allowTailscale ?? 
  (tailscaleMode === "serve" && mode !== "password");
```

- 명시적으로 지정되면 해당 값 사용
- 그렇지 않으면 Tailscale Serve 모드이고 비밀번호 모드가 아니면 허용

## 4. 인증 수행

### 4.1 연결 인증

`authorizeGatewayConnect()` 함수는 연결 요청을 인증합니다.

**프로세스:**

1. **로컬 직접 요청 확인**
```typescript
const localDirect = isLocalDirectRequest(req, trustedProxies);
```

로컬 직접 요청의 조건:
- 클라이언트 IP가 loopback 주소 (`127.0.0.1`, `::1`)
- Host 헤더가 `localhost`, `127.0.0.1`, `::1`, 또는 `.ts.net`으로 끝남
- 프록시 헤더가 없거나 신뢰할 수 있는 프록시에서 옴

2. **Tailscale 인증 시도** (로컬 직접 요청이 아니고 `allowTailscale`이 true인 경우)
```typescript
if (auth.allowTailscale && !localDirect) {
  const tailscaleCheck = await resolveVerifiedTailscaleUser({
    req,
    tailscaleWhois,
  });
  if (tailscaleCheck.ok) {
    return {
      ok: true,
      method: "tailscale",
      user: tailscaleCheck.user.login,
    };
  }
}
```

3. **토큰 인증** (모드가 `token`인 경우)
```typescript
if (auth.mode === "token") {
  if (!auth.token) {
    return { ok: false, reason: "token_missing_config" };
  }
  if (!connectAuth?.token) {
    return { ok: false, reason: "token_missing" };
  }
  if (!safeEqual(connectAuth.token, auth.token)) {
    return { ok: false, reason: "token_mismatch" };
  }
  return { ok: true, method: "token" };
}
```

4. **비밀번호 인증** (모드가 `password`인 경우)
```typescript
if (auth.mode === "password") {
  const password = connectAuth?.password;
  if (!auth.password) {
    return { ok: false, reason: "password_missing_config" };
  }
  if (!password) {
    return { ok: false, reason: "password_missing" };
  }
  if (!safeEqual(password, auth.password)) {
    return { ok: false, reason: "password_mismatch" };
  }
  return { ok: true, method: "password" };
}
```

### 4.2 안전한 비교

`safeEqual()` 함수는 `timingSafeEqual`을 사용하여 타이밍 공격을 방지합니다:

```typescript
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

## 5. 보안 검증

### 5.1 시작 시 검증

Gateway 시작 시 `assertGatewayAuthConfigured()` 함수가 인증 설정을 검증합니다:

```typescript
export function assertGatewayAuthConfigured(auth: ResolvedGatewayAuth): void {
  if (auth.mode === "token" && !auth.token) {
    if (auth.allowTailscale) return;
    throw new Error(
      "gateway auth mode is token, but no token was configured"
    );
  }
  if (auth.mode === "password" && !auth.password) {
    throw new Error("gateway auth mode is password, but no password was configured");
  }
}
```

### 5.2 바인딩 모드별 요구사항

**Loopback 바인딩:**
- 인증 선택적 (로컬 요청은 신뢰)

**LAN 바인딩:**
- 인증 필수 (토큰 또는 비밀번호)

**Tailscale Funnel:**
- 비밀번호 인증 필수
- Loopback 바인딩 필수

**Tailscale Serve:**
- 토큰 또는 비밀번호 인증
- Loopback 바인딩 필수

### 5.3 신뢰할 수 있는 프록시

`gateway.trustedProxies` 설정을 통해 역방향 프록시의 IP 주소를 지정할 수 있습니다:

```json
{
  "gateway": {
    "trustedProxies": ["127.0.0.1", "::1"]
  }
}
```

프록시 헤더 (`X-Forwarded-For`, `X-Real-IP`)는 신뢰할 수 있는 프록시에서만 신뢰됩니다.

## 6. 권한 및 스코프

### 6.1 역할 (Role)

- **operator**: 일반 운영자 (기본값)
- **node**: 노드 디바이스

### 6.2 스코프 (Scopes)

- **operator.read**: 읽기 전용 권한
- **operator.write**: 쓰기 권한
- **operator.admin**: 관리자 권한
- **operator.approvals**: 승인 권한
- **operator.pairing**: 페어링 권한

### 6.3 메서드별 권한 요구사항

**읽기 메서드** (`READ_METHODS`):
- `health`, `logs.tail`, `channels.status`, `status`, `usage.status`, `usage.cost`, `tts.status`, `tts.providers`, `models.list`, `agents.list`, `agent.identity.get`, `skills.status`, `voicewake.get`, `sessions.list`, `sessions.preview`, `cron.list`, `cron.status`, `cron.runs`, `system-presence`, `last-heartbeat`, `node.list`, `node.describe`, `chat.history`

**쓰기 메서드** (`WRITE_METHODS`):
- `send`, `agent`, `agent.wait`, `wake`, `talk.mode`, `tts.enable`, `tts.disable`, `tts.convert`, `tts.setProvider`, `voicewake.set`, `node.invoke`, `chat.send`, `chat.abort`, `browser.request`

**승인 메서드** (`APPROVAL_METHODS`):
- `exec.approval.request`, `exec.approval.resolve`

**페어링 메서드** (`PAIRING_METHODS`):
- `node.pair.request`, `node.pair.list`, `node.pair.approve`, `node.pair.reject`, `node.pair.verify`, `device.pair.list`, `device.pair.approve`, `device.pair.reject`, `device.token.rotate`, `device.token.revoke`, `node.rename`

**관리자 메서드**:
- `config.*`, `wizard.*`, `update.*`, `channels.logout`, `skills.install`, `skills.update`, `cron.add`, `cron.update`, `cron.remove`, `cron.run`, `sessions.patch`, `sessions.reset`, `sessions.delete`, `sessions.compact`, `exec.approvals.*`

### 6.4 권한 검사

`authorizeGatewayMethod()` 함수는 메서드 호출 시 권한을 검사합니다:

```typescript
function authorizeGatewayMethod(method: string, client: GatewayRequestOptions["client"]) {
  if (!client?.connect) return null;
  const role = client.connect.role ?? "operator";
  const scopes = client.connect.scopes ?? [];
  
  // 노드 역할 검사
  if (NODE_ROLE_METHODS.has(method)) {
    if (role === "node") return null;
    return errorShape(ErrorCodes.INVALID_REQUEST, `unauthorized role: ${role}`);
  }
  
  // 관리자 스코프 확인
  if (scopes.includes(ADMIN_SCOPE)) return null;
  
  // 스코프별 검사
  if (APPROVAL_METHODS.has(method) && !scopes.includes(APPROVALS_SCOPE)) {
    return errorShape(ErrorCodes.INVALID_REQUEST, "missing scope: operator.approvals");
  }
  // ...
}
```

## 7. 이벤트 스코프 필터링

특정 이벤트는 스코프가 있는 클라이언트에게만 전송됩니다:

```typescript
const EVENT_SCOPE_GUARDS: Record<string, string[]> = {
  "exec.approval.requested": [APPROVALS_SCOPE],
  "exec.approval.resolved": [APPROVALS_SCOPE],
  "device.pair.requested": [PAIRING_SCOPE],
  "device.pair.resolved": [PAIRING_SCOPE],
  "node.pair.requested": [PAIRING_SCOPE],
  "node.pair.resolved": [PAIRING_SCOPE],
};
```

## 8. 에러 메시지

인증 실패 시 사용자 친화적인 에러 메시지를 제공합니다:

```typescript
function formatGatewayAuthFailureMessage(params: {
  authMode: ResolvedGatewayAuth["mode"];
  authProvided: AuthProvidedKind;
  reason?: string;
  client?: { id?: string | null; mode?: string | null };
}): string {
  // 클라이언트 타입에 따라 다른 힌트 제공
  const isCli = isGatewayCliClient(client);
  const isControlUi = client?.id === GATEWAY_CLIENT_IDS.CONTROL_UI;
  const isWebchat = isWebchatClient(client);
  
  // 이유별 메시지 생성
  switch (reason) {
    case "token_missing":
      return `unauthorized: gateway token missing (${tokenHint})`;
    case "token_mismatch":
      return `unauthorized: gateway token mismatch (${tokenHint})`;
    // ...
  }
}
```

## 9. 보안 모범 사례

1. **강력한 토큰/비밀번호 사용**: 충분히 긴 랜덤 문자열 사용
2. **환경변수 사용**: 설정 파일보다 환경변수 사용 권장
3. **Tailscale 사용**: 가능하면 Tailscale Serve/Funnel 사용
4. **신뢰할 수 있는 프록시 설정**: 역방향 프록시 사용 시 `trustedProxies` 설정
5. **최소 권한 원칙**: 필요한 최소한의 스코프만 부여
6. **정기적인 토큰 회전**: 보안을 위해 정기적으로 토큰 변경

## 10. TLS 지원

Gateway는 TLS를 지원하여 암호화된 연결을 제공합니다:

**설정:**
```json
{
  "gateway": {
    "tls": {
      "enabled": true,
      "cert": "/path/to/cert.pem",
      "key": "/path/to/key.pem"
    }
  }
}
```

TLS 활성화 시:
- WebSocket은 `wss://`로 접근
- 인증서 지문 검증 지원
- 자체 서명 인증서 지원
