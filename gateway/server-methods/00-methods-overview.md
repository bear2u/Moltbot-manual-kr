---
layout: default
title: Methods Overview
---

# Gateway 메서드 핸들러 개요

**작성일**: 2026-01-28  
**모듈**: `src/gateway/server-methods/`

## 1. 개요

Gateway는 RPC 스타일의 메서드 호출 시스템을 제공합니다. 각 메서드는 독립적인 핸들러로 구현되며, 파라미터 검증, 권한 검사, 비즈니스 로직 실행을 수행합니다.

## 2. 핸들러 구조

### 2.1 핸들러 타입

```typescript
export type GatewayRequestHandler = (opts: GatewayRequestHandlerOptions) => Promise<void> | void;
```

### 2.2 핸들러 옵션

```typescript
export type GatewayRequestHandlerOptions = {
  req: RequestFrame;
  params: Record<string, unknown>;
  client: GatewayClient | null;
  isWebchatConnect: (params: ConnectParams | null | undefined) => boolean;
  respond: RespondFn;
  context: GatewayRequestContext;
};
```

## 3. 핸들러 그룹

### 3.1 Agent 관련

**agent.ts**
- `agent`: 에이전트 실행
- `agent.wait`: 에이전트 실행 대기
- `agent.identity.get`: 에이전트 신원 조회

**agents.ts**
- `agents.list`: 에이전트 목록 조회

**agent-job.ts**
- 에이전트 작업 대기 유틸리티

### 3.2 Browser 관련

**browser.ts**
- `browser.request`: 브라우저 요청 (노드 또는 로컬 브라우저 제어 서버)

### 3.3 Channels 관련

**channels.ts**
- `channels.status`: 채널 상태 조회
- `channels.logout`: 채널 로그아웃

### 3.4 Chat 관련

**chat.ts**
- `chat.history`: 채팅 히스토리 조회
- `chat.send`: 채팅 메시지 전송
- `chat.abort`: 채팅 중단

### 3.5 Config 관련

**config.ts**
- `config.get`: 설정 조회
- `config.set`: 설정 설정
- `config.apply`: 설정 적용
- `config.patch`: 설정 패치
- `config.schema`: 설정 스키마 조회

### 3.6 Cron 관련

**cron.ts**
- `cron.list`: 크론 작업 목록 조회
- `cron.status`: 크론 서비스 상태 조회
- `cron.add`: 크론 작업 추가
- `cron.update`: 크론 작업 업데이트
- `cron.remove`: 크론 작업 제거
- `cron.run`: 크론 작업 즉시 실행
- `cron.runs`: 크론 실행 로그 조회

### 3.7 Devices 관련

**devices.ts**
- `device.pair.list`: 디바이스 페어링 목록 조회
- `device.pair.approve`: 디바이스 페어링 승인
- `device.pair.reject`: 디바이스 페어링 거부
- `device.token.rotate`: 디바이스 토큰 회전
- `device.token.revoke`: 디바이스 토큰 취소

### 3.8 Exec Approvals 관련

**exec-approvals.ts**
- `exec.approvals.get`: Exec 승인 설정 조회
- `exec.approvals.set`: Exec 승인 설정 설정
- `exec.approvals.node.get`: 노드 Exec 승인 설정 조회
- `exec.approvals.node.set`: 노드 Exec 승인 설정 설정

**exec-approval.ts**
- `exec.approval.request`: Exec 승인 요청
- `exec.approval.resolve`: Exec 승인 해결

### 3.9 Health 관련

**health.ts**
- `health`: Health 스냅샷 조회

### 3.10 Logs 관련

**logs.ts**
- `logs.tail`: 로그 파일 조회 (JSONL 형식)

### 3.11 Models 관련

**models.ts**
- `models.list`: 모델 카탈로그 조회

### 3.12 Nodes 관련

**nodes.ts**
- `node.list`: 노드 목록 조회
- `node.describe`: 노드 상세 정보 조회
- `node.invoke`: 노드 명령 실행
- `node.pair.request`: 노드 페어링 요청
- `node.pair.list`: 노드 페어링 목록 조회
- `node.pair.approve`: 노드 페어링 승인
- `node.pair.reject`: 노드 페어링 거부
- `node.pair.verify`: 노드 페어링 검증
- `node.rename`: 노드 이름 변경

**nodes.helpers.ts**
- 노드 관련 유틸리티 함수들

### 3.13 Send 관련

**send.ts**
- `send`: 메시지 전송

### 3.14 Sessions 관련

**sessions.ts**
- `sessions.list`: 세션 목록 조회
- `sessions.preview`: 세션 미리보기
- `sessions.resolve`: 세션 키 해결
- `sessions.patch`: 세션 패치
- `sessions.reset`: 세션 리셋
- `sessions.delete`: 세션 삭제
- `sessions.compact`: 세션 압축

### 3.15 Skills 관련

**skills.ts**
- `skills.status`: Skills 상태 조회
- `skills.bins`: Skills 바이너리 목록 조회
- `skills.install`: Skill 설치
- `skills.update`: Skill 업데이트

### 3.16 System 관련

**system.ts**
- `last-heartbeat`: 마지막 Heartbeat 이벤트 조회
- `set-heartbeats`: Heartbeats 활성화/비활성화
- `system-presence`: 시스템 프레즌스 조회
- `system-event`: 시스템 이벤트 전송

### 3.17 Talk 관련

**talk.ts**
- `talk.mode`: Talk 모드 설정

### 3.18 TTS 관련

**tts.ts**
- `tts.status`: TTS 상태 조회
- `tts.providers`: TTS 프로바이더 목록 조회
- `tts.enable`: TTS 활성화
- `tts.disable`: TTS 비활성화
- `tts.convert`: 텍스트를 음성으로 변환
- `tts.setProvider`: TTS 프로바이더 설정

### 3.19 Update 관련

**update.ts**
- `update.run`: Gateway 업데이트 실행

### 3.20 Usage 관련

**usage.ts**
- `usage.status`: 사용량 상태 조회
- `usage.cost`: 비용 사용량 조회

### 3.21 Voicewake 관련

**voicewake.ts**
- `voicewake.get`: Voice wake 트리거 조회
- `voicewake.set`: Voice wake 트리거 설정

### 3.22 Web 관련

**web.ts**
- `web.login.start`: 웹 로그인 시작 (QR 코드)
- `web.login.wait`: 웹 로그인 대기

### 3.23 Wizard 관련

**wizard.ts**
- `wizard.start`: 온보딩 위저드 시작
- `wizard.next`: 위저드 다음 단계
- `wizard.cancel`: 위저드 취소
- `wizard.status`: 위저드 상태 조회

## 4. 공통 패턴

### 4.1 파라미터 검증

대부분의 핸들러는 파라미터 검증을 수행합니다:

```typescript
if (!validateMethodParams(params)) {
  respond(
    false,
    undefined,
    errorShape(
      ErrorCodes.INVALID_REQUEST,
      `invalid method params: ${formatValidationErrors(validateMethodParams.errors)}`,
    ),
  );
  return;
}
```

### 4.2 에러 처리

핸들러는 try-catch를 사용하여 에러를 처리합니다:

```typescript
try {
  const result = await performOperation();
  respond(true, result);
} catch (err) {
  respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
}
```

### 4.3 중복 제거

일부 핸들러는 중복 제거를 사용합니다:

```typescript
const cached = context.dedupe.get(`method:${idempotencyKey}`);
if (cached) {
  respond(cached.ok, cached.payload, cached.error, { cached: true });
  return;
}
```

## 5. 컨텍스트 활용

핸들러는 컨텍스트를 통해 Gateway 기능에 접근합니다:

- `context.deps`: CLI 의존성
- `context.cron`: 크론 서비스
- `context.broadcast`: 이벤트 브로드캐스트
- `context.nodeRegistry`: 노드 레지스트리
- `context.loadGatewayModelCatalog`: 모델 카탈로그 로드
- 기타

## 6. 권한 검사

권한 검사는 `authorizeGatewayMethod()`에서 자동으로 수행되므로, 핸들러는 권한이 있는 요청만 받습니다.

## 7. 응답 생성

핸들러는 `respond()` 함수를 사용하여 응답을 생성합니다:

```typescript
respond(true, payload); // 성공
respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "error message")); // 실패
```
