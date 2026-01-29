---
layout: default
title: Discovery
---

# Gateway Discovery 시스템

**작성일**: 2026-01-28  
**모듈**: `src/gateway/server-discovery.ts`, `src/gateway/server-discovery-runtime.ts`

## 1. 개요

Gateway Discovery 시스템은 Gateway를 네트워크에서 발견 가능하게 만듭니다. Bonjour/mDNS를 사용하여 로컬 네트워크에서 Gateway를 발견하고, Tailscale을 사용하여 원격 네트워크에서도 발견할 수 있습니다.

## 2. Discovery 모드

### 2.1 mDNS/Bonjour

**모드:**
- `off`: 비활성화
- `minimal`: 최소 정보만 공개
- `full`: 전체 정보 공개

**공개 정보:**
- Gateway 포트
- TLS 활성화 여부
- TLS 지문 (SHA-256)
- Canvas Host 포트
- SSH 포트 (full 모드)
- CLI 경로 (full 모드)
- Tailnet DNS (있는 경우)

### 2.2 Wide Area Discovery

Tailscale을 통한 원격 발견입니다:
- **DNS-SD**: DNS Service Discovery 사용
- **Zone 파일**: DNS zone 파일 업데이트
- **IPv4/IPv6**: Tailscale IPv4 및 IPv6 주소 사용

## 3. Discovery 시작

### 3.1 시작 함수

```typescript
export async function startGatewayDiscovery(params: {
  machineDisplayName: string;
  port: number;
  gatewayTls?: { enabled: boolean; fingerprintSha256?: string };
  canvasPort?: number;
  wideAreaDiscoveryEnabled: boolean;
  tailscaleMode: "off" | "serve" | "funnel";
  mdnsMode?: "off" | "minimal" | "full";
  logDiscovery: { info: (msg: string) => void; warn: (msg: string) => void };
})
```

**파라미터:**
- `machineDisplayName`: 머신 표시 이름
- `port`: Gateway 포트
- `gatewayTls`: TLS 설정
- `canvasPort`: Canvas Host 포트
- `wideAreaDiscoveryEnabled`: Wide Area Discovery 활성화 여부
- `tailscaleMode`: Tailscale 모드
- `mdnsMode`: mDNS 모드
- `logDiscovery`: 로거

### 3.2 시작 프로세스

1. **mDNS 모드 확인**
```typescript
const mdnsMode = params.mdnsMode ?? "minimal";
const bonjourEnabled =
  mdnsMode !== "off" &&
  process.env.CLAWDBOT_DISABLE_BONJOUR !== "1" &&
  process.env.NODE_ENV !== "test" &&
  !process.env.VITEST;
```

2. **Tailnet DNS 해결**
```typescript
const tailnetDns = needsTailnetDns
  ? await resolveTailnetDnsHint({ enabled: tailscaleEnabled })
  : undefined;
```

3. **Bonjour 광고 시작**
```typescript
if (bonjourEnabled) {
  const bonjour = await startGatewayBonjourAdvertiser({
    instanceName: formatBonjourInstanceName(params.machineDisplayName),
    gatewayPort: params.port,
    gatewayTlsEnabled: params.gatewayTls?.enabled ?? false,
    gatewayTlsFingerprintSha256: params.gatewayTls?.fingerprintSha256,
    canvasPort: params.canvasPort,
    sshPort,
    tailnetDns,
    cliPath,
    minimal: mdnsMinimal,
  });
  bonjourStop = bonjour.stop;
}
```

4. **Wide Area Discovery 업데이트**
```typescript
if (params.wideAreaDiscoveryEnabled) {
  const tailnetIPv4 = pickPrimaryTailnetIPv4();
  if (tailnetIPv4) {
    const tailnetIPv6 = pickPrimaryTailnetIPv6();
    const result = await writeWideAreaGatewayZone({
      gatewayPort: params.port,
      displayName: formatBonjourInstanceName(params.machineDisplayName),
      tailnetIPv4,
      tailnetIPv6: tailnetIPv6 ?? undefined,
      gatewayTlsEnabled: params.gatewayTls?.enabled ?? false,
      gatewayTlsFingerprintSha256: params.gatewayTls?.fingerprintSha256,
      tailnetDns,
      sshPort,
      cliPath: resolveBonjourCliPath(),
    });
  }
}
```

## 4. Bonjour 인스턴스 이름

### 4.1 포맷팅

```typescript
export function formatBonjourInstanceName(displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) return "Moltbot";
  if (/moltbot/i.test(trimmed)) return trimmed;
  return `${trimmed} (Moltbot)`;
}
```

이름에 "moltbot"이 포함되어 있지 않으면 `(Moltbot)` 접미사를 추가합니다.

## 5. Bonjour CLI 경로 해결

### 5.1 해결 순서

```typescript
export function resolveBonjourCliPath(opts: ResolveBonjourCliPathOptions = {}): string | undefined {
  // 1. 환경변수
  const envPath = env.CLAWDBOT_CLI_PATH?.trim();
  if (envPath) return envPath;
  
  // 2. 실행 파일과 같은 디렉토리
  const siblingCli = path.join(execDir, "moltbot");
  if (isFile(siblingCli)) return siblingCli;
  
  // 3. argv[1]
  if (argvPath && isFile(argvPath)) return argvPath;
  
  // 4. dist/cli 또는 bin/cli
  const distCli = path.join(cwd, "dist", "index.js");
  if (isFile(distCli)) return distCli;
  const binCli = path.join(cwd, "bin", "moltbot.js");
  if (isFile(binCli)) return binCli;
  
  return undefined;
}
```

## 6. Tailnet DNS 힌트 해결

### 6.1 해결 순서

```typescript
export async function resolveTailnetDnsHint(opts?: {
  env?: NodeJS.ProcessEnv;
  exec?: typeof runExec;
  enabled?: boolean;
}): Promise<string | undefined> {
  // 1. 환경변수
  const envValue = env.CLAWDBOT_TAILNET_DNS?.trim();
  if (envValue) return envValue.replace(/\.$/, "");
  
  // 2. Tailscale 명령 실행
  if (opts?.enabled !== false) {
    try {
      return await getTailnetHostname(exec);
    } catch {
      return undefined;
    }
  }
  
  return undefined;
}
```

## 7. Wide Area Discovery

### 7.1 Zone 파일 업데이트

```typescript
const result = await writeWideAreaGatewayZone({
  gatewayPort: params.port,
  displayName: formatBonjourInstanceName(params.machineDisplayName),
  tailnetIPv4,
  tailnetIPv6: tailnetIPv6 ?? undefined,
  gatewayTlsEnabled: params.gatewayTls?.enabled ?? false,
  gatewayTlsFingerprintSha256: params.gatewayTls?.fingerprintSha256,
  tailnetDns,
  sshPort,
  cliPath: resolveBonjourCliPath(),
});
```

DNS zone 파일을 업데이트하여 원격에서 Gateway를 발견할 수 있도록 합니다.

### 7.2 도메인

Wide Area Discovery는 `WIDE_AREA_DISCOVERY_DOMAIN` 도메인을 사용합니다.

## 8. Discovery 중지

### 8.1 중지 함수

```typescript
return { bonjourStop };
```

`bonjourStop` 함수를 호출하여 Bonjour 광고를 중지합니다.

## 9. 환경변수

### 9.1 비활성화

- `CLAWDBOT_DISABLE_BONJOUR=1`: Bonjour 비활성화
- `CLAWDBOT_CLI_PATH`: CLI 경로 지정
- `CLAWDBOT_TAILNET_DNS`: Tailnet DNS 지정
- `CLAWDBOT_SSH_PORT`: SSH 포트 지정 (full 모드)

## 10. 에러 처리

Discovery 시작 실패 시:
- 로그에 경고 기록
- Gateway는 계속 실행 (Discovery 없이)

## 11. 보안 고려사항

### 11.1 정보 공개

Discovery는 다음 정보를 공개합니다:
- Gateway 포트
- TLS 활성화 여부
- TLS 지문 (SHA-256)
- Canvas Host 포트
- SSH 포트 (full 모드)

민감한 정보는 공개되지 않습니다.

### 11.2 네트워크 범위

- **mDNS**: 로컬 네트워크만
- **Wide Area**: Tailscale 네트워크만

## 12. 사용 예시

### 12.1 로컬 네트워크에서 발견

클라이언트는 mDNS를 사용하여 로컬 네트워크에서 Gateway를 발견할 수 있습니다.

### 12.2 원격 네트워크에서 발견

Tailscale을 사용하면 원격 네트워크에서도 Gateway를 발견할 수 있습니다.
