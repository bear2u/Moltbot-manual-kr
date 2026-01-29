# Control UI 서빙

**작성일**: 2026-01-28  
**모듈**: `src/gateway/control-ui.ts`, `src/gateway/control-ui-shared.ts`

## 1. 개요

Control UI는 Gateway의 웹 기반 관리 인터페이스입니다. Gateway는 Control UI의 정적 파일을 서빙하고, 에이전트 아바타를 제공합니다.

## 2. Control UI 루트 해결

### 2.1 루트 경로 해결

```typescript
function resolveControlUiRoot(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const execDir = (() => {
    try {
      return path.dirname(fs.realpathSync(process.execPath));
    } catch {
      return null;
    }
  })();
  
  const candidates = [
    // 패키지된 앱: 실행 파일과 같은 디렉토리
    execDir ? path.resolve(execDir, "control-ui") : null,
    // dist에서 실행: dist/gateway/control-ui.js -> dist/control-ui
    path.resolve(here, "../control-ui"),
    // 소스에서 실행: src/gateway/control-ui.ts -> dist/control-ui
    path.resolve(here, "../../dist/control-ui"),
    // Fallback: cwd (dev)
    path.resolve(process.cwd(), "dist", "control-ui"),
  ].filter((dir): dir is string => Boolean(dir));
  
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}
```

**우선순위:**
1. 실행 파일과 같은 디렉토리의 `control-ui`
2. `dist/control-ui` (dist에서 실행)
3. `../../dist/control-ui` (소스에서 실행)
4. `process.cwd()/dist/control-ui` (개발)

## 3. HTTP 요청 처리

### 3.1 handleControlUiHttpRequest

```typescript
export async function handleControlUiHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  basePath: string,
): Promise<boolean>
```

Control UI HTTP 요청을 처리합니다.

**프로세스:**

1. **경로 확인**
```typescript
const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
if (!url.pathname.startsWith(basePath)) return false;
```

2. **파일 경로 해결**
```typescript
const path = url.pathname.slice(basePath.length).replace(/^\/+/, "") || "index.html";
const filePath = path.join(controlUiRoot, path);
```

3. **파일 서빙**
```typescript
serveFile(res, filePath);
```

### 3.2 파일 서빙

```typescript
function serveFile(res: ServerResponse, filePath: string) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    respondNotFound(res);
    return;
  }
  
  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypeForExt(ext);
  
  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "no-cache");
  
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}
```

## 4. 아바타 서빙

### 4.1 handleControlUiAvatarRequest

```typescript
export function handleControlUiAvatarRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: { basePath?: string; resolveAvatar: (agentId: string) => ControlUiAvatarResolution },
): boolean
```

에이전트 아바타 요청을 처리합니다.

**엔드포인트:** `GET /{basePath}/avatar/{agentId}`

**파라미터:**
- `meta=1`: 아바타 메타데이터만 반환

### 4.2 아바타 해결

```typescript
export type ControlUiAvatarResolution =
  | { kind: "none"; reason: string }
  | { kind: "local"; filePath: string }
  | { kind: "remote"; url: string }
  | { kind: "data"; url: string };
```

**해결 순서:**
1. 설정 파일 (`ui.assistant.avatar`)
2. 에이전트 설정 (`agents.list[].identity.avatar`)
3. 워크스페이스 파일 (`identity.json`)

**타입:**
- `none`: 아바타 없음
- `local`: 로컬 파일 경로
- `remote`: 원격 URL
- `data`: Data URL

### 4.3 로컬 파일 처리

로컬 파일인 경우:
1. 파일 존재 확인
2. 크기 확인 (최대 2MB)
3. 파일 읽기
4. MIME 타입 결정
5. Base64 인코딩
6. Data URL 생성

## 5. Content-Type 결정

### 5.1 contentTypeForExt

```typescript
function contentTypeForExt(ext: string): string {
  switch (ext) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "application/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".jpg": case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    case ".ico": return "image/x-icon";
    case ".txt": return "text/plain; charset=utf-8";
    default: return "application/octet-stream";
  }
}
```

## 6. Base Path

### 6.1 Base Path 설정

Control UI는 `gateway.controlUi.basePath` 설정으로 기본 경로를 변경할 수 있습니다. 기본값은 `/`입니다.

### 6.2 Base Path 정규화

```typescript
export function normalizeControlUiBasePath(basePath?: string): string {
  if (!basePath) return ROOT_PREFIX;
  const trimmed = basePath.trim();
  if (!trimmed) return ROOT_PREFIX;
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const normalized = withSlash.replace(/\/+$/, "");
  return normalized === "" ? ROOT_PREFIX : normalized;
}
```

## 7. 아바타 URL 빌드

### 7.1 buildControlUiAvatarUrl

```typescript
export function buildControlUiAvatarUrl(basePath: string, agentId: string): string {
  const normalized = normalizeControlUiBasePath(basePath);
  return `${normalized}${CONTROL_UI_AVATAR_PREFIX}/${agentId}`;
}
```

아바타 URL을 생성합니다.

### 7.2 resolveAssistantAvatarUrl

```typescript
export function resolveAssistantAvatarUrl(
  cfg: MoltbotConfig,
  agentId: string,
  basePath?: string,
): string | null
```

에이전트 아바타 URL을 해결합니다.

## 8. 에러 처리

### 8.1 파일 없음

파일이 없으면 404 Not Found를 반환합니다.

### 8.2 잘못된 에이전트 ID

에이전트 ID가 유효하지 않으면 404 Not Found를 반환합니다.

### 8.3 파일 읽기 실패

파일 읽기 실패 시 500 Internal Server Error를 반환합니다.

## 9. 캐싱

### 9.1 Cache-Control

모든 파일은 `Cache-Control: no-cache` 헤더를 설정하여 캐싱을 방지합니다.

## 10. 보안 고려사항

### 10.1 경로 트래버설 방지

파일 경로는 Control UI 루트 내로 제한됩니다:

```typescript
const resolved = path.resolve(controlUiRoot, path);
const relative = path.relative(controlUiRoot, resolved);
if (relative.startsWith("..") || path.isAbsolute(relative)) {
  respondNotFound(res);
  return;
}
```

### 10.2 에이전트 ID 검증

에이전트 ID는 정규식으로 검증됩니다:

```typescript
function isValidAgentId(agentId: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(agentId);
}
```

### 10.3 파일 크기 제한

아바타 파일은 최대 2MB로 제한됩니다.

## 11. 사용 예시

### 11.1 Control UI 접근

```
http://localhost:18789/
```

### 11.2 커스텀 Base Path

```
http://localhost:18789/admin/
```

설정:
```json
{
  "gateway": {
    "controlUi": {
      "basePath": "/admin"
    }
  }
}
```

### 11.3 아바타 접근

```
http://localhost:18789/avatar/main
```

### 11.4 아바타 메타데이터

```
http://localhost:18789/avatar/main?meta=1
```

응답:
```json
{
  "avatarUrl": "http://localhost:18789/avatar/main"
}
```

## 12. 통합

### 12.1 HTTP 서버 통합

Control UI는 HTTP 서버의 라우팅에서 가장 높은 우선순위를 가집니다 (Canvas Host 제외).

### 12.2 WebSocket 통합

Control UI는 WebSocket을 통해 Gateway와 통신합니다.

## 13. 개발 모드

개발 모드에서는 `dist/control-ui` 디렉토리를 사용합니다. 파일 변경 시 자동으로 반영됩니다 (브라우저 새로고침 필요).

## 14. 프로덕션 모드

프로덕션 모드에서는 패키지된 앱의 `control-ui` 디렉토리를 사용합니다.
