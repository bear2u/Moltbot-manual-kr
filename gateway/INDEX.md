---
layout: default
title: INDEX
---

# Gateway 문서 상세 인덱스

**최종 업데이트**: 2026-01-28

이 문서는 Gateway의 모든 문서에 대한 상세 인덱스입니다.

## 📋 문서 목록

### 핵심 문서 (루트 레벨)

| 번호 | 문서명 | 설명 | 모듈 |
|------|--------|------|------|
| 00 | [Gateway 개요](00-gateway-overview.md) | Gateway의 역할, 아키텍처, 주요 기능 | `src/gateway/` |
| 01 | [서버 시작](01-server-startup.md) | Gateway 서버 초기화 및 시작 프로세스 | `src/gateway/server.impl.ts` |
| 02 | [WebSocket 프로토콜](02-websocket-protocol.md) | WebSocket 통신 프로토콜 상세 | `src/gateway/server/ws-connection/` |
| 03 | [인증 시스템](03-authentication.md) | 인증 및 권한 관리 | `src/gateway/auth.ts` |
| 04 | [이벤트 브로드캐스팅](04-event-broadcasting.md) | 실시간 이벤트 전송 시스템 | `src/gateway/server-broadcast.ts` |
| 05 | [메서드 핸들러](05-method-handlers.md) | RPC 스타일 메서드 호출 시스템 | `src/gateway/server-methods.ts` |
| 06 | [노드 관리](06-node-management.md) | 외부 노드 등록 및 통신 | `src/gateway/node-registry.ts` |
| 07 | [채널 관리](07-channel-management.md) | 메시징 채널 생명주기 관리 | `src/gateway/server-channels.ts` |
| 08 | [크론 서비스](08-cron-service.md) | 스케줄된 작업 실행 | `src/gateway/server-cron.ts` |
| 09 | [설정 관리](09-config-management.md) | 설정 파일 관리 및 리로드 | `src/gateway/config-reload.ts` |
| 10 | [HTTP 서버](10-http-server.md) | HTTP 엔드포인트 및 라우팅 | `src/gateway/server-http.ts` |

### 프로토콜 (`protocol/`)

| 번호 | 문서명 | 설명 | 모듈 |
|------|--------|------|------|
| 00 | [프로토콜 개요](protocol/00-protocol-overview.md) | 프로토콜 구조, 프레임 타입, 이벤트 | `src/gateway/protocol/` |
| 01 | [프로토콜 스키마](protocol/01-protocol-schemas.md) | TypeBox 스키마 정의 및 검증 | `src/gateway/protocol/schema/` |

### 서버 컴포넌트 (`server/`)

| 번호 | 문서명 | 설명 | 모듈 |
|------|--------|------|------|
| 00 | [서버 컴포넌트 개요](server/00-server-components-overview.md) | Health, Hooks, TLS 등 내부 컴포넌트 | `src/gateway/server/` |

### 메서드 핸들러 (`server-methods/`)

| 번호 | 문서명 | 설명 | 모듈 |
|------|--------|------|------|
| 00 | [메서드 개요](server-methods/00-methods-overview.md) | 모든 메서드 핸들러 목록 및 그룹 | `src/gateway/server-methods/` |
| 01 | [Send 핸들러](server-methods/01-send-handler.md) | 메시지 전송 메서드 상세 | `src/gateway/server-methods/send.ts` |
| 02 | [Chat 핸들러](server-methods/02-chat-handlers.md) | WebChat 메서드 상세 | `src/gateway/server-methods/chat.ts` |

### 특수 기능 (`specialized/`)

| 번호 | 문서명 | 설명 | 모듈 |
|------|--------|------|------|
| 00 | [특수 기능 개요](specialized/00-specialized-features-overview.md) | 특수 기능 목록 및 개요 | - |
| 01 | [Discovery](specialized/01-discovery.md) | 네트워크에서 Gateway 발견 | `src/gateway/server-discovery*.ts` |
| 02 | [Exec Approval](specialized/02-exec-approval.md) | 명령 실행 승인 시스템 | `src/gateway/exec-approval-manager.ts` |
| 03 | [Hooks](specialized/03-hooks.md) | 외부 시스템 통합 HTTP Hooks | `src/gateway/hooks.ts` |
| 04 | [채팅 중단](specialized/04-chat-abort.md) | 실행 중인 채팅 중단 | `src/gateway/chat-abort.ts` |
| 05 | [채팅 첨부파일](specialized/05-chat-attachments.md) | 이미지 첨부파일 처리 | `src/gateway/chat-attachments.ts` |
| 06 | [OpenAI HTTP API](specialized/06-openai-http.md) | OpenAI 호환 HTTP API | `src/gateway/openai-http.ts` |
| 07 | [Control UI 서빙](specialized/07-control-ui.md) | 웹 UI 정적 파일 서빙 | `src/gateway/control-ui.ts` |

### 유틸리티 (`utils/`)

| 번호 | 문서명 | 설명 | 모듈 |
|------|--------|------|------|
| 00 | [유틸리티 개요](utils/00-utils-overview.md) | 유틸리티 함수 개요 | - |
| 01 | [HTTP 유틸리티](utils/01-http-utils.md) | HTTP 요청 처리 유틸리티 | `src/gateway/http-utils.ts` |
| 02 | [세션 유틸리티](utils/02-session-utils-detail.md) | 세션 관리 유틸리티 | `src/gateway/session-utils*.ts` |
| 03 | [노드 헬퍼](utils/03-node-helpers.md) | 노드 관련 유틸리티 | `src/gateway/server-methods/nodes.helpers.ts` |
| 04 | [디바이스 인증](utils/04-device-auth.md) | 디바이스 페어링 페이로드 | `src/gateway/device-auth.ts` |
| 05 | [노드 명령 정책](utils/05-node-command-policy.md) | 노드 명령 허용/거부 정책 | `src/gateway/node-command-policy.ts` |
| 06 | [Control UI 공유](utils/06-control-ui-shared.md) | Control UI 공유 유틸리티 | `src/gateway/control-ui-shared.ts` |
| 07 | [프로토콜 클라이언트 정보](utils/07-protocol-client-info.md) | 클라이언트 ID 및 모드 정의 | `src/gateway/protocol/client-info.ts` |
| 08 | [설정 리로드](utils/08-config-reload.md) | 설정 변경 감지 및 리로드 | `src/gateway/config-reload.ts` |

## 🔍 주제별 찾기

### 통신 프로토콜
- [WebSocket 프로토콜](02-websocket-protocol.md)
- [프로토콜 개요](protocol/00-protocol-overview.md)
- [프로토콜 스키마](protocol/01-protocol-schemas.md)
- [프로토콜 클라이언트 정보](utils/07-protocol-client-info.md)

### 인증 및 보안
- [인증 시스템](03-authentication.md)
- [디바이스 인증](utils/04-device-auth.md)
- [노드 명령 정책](utils/05-node-command-policy.md)

### 이벤트 및 메시징
- [이벤트 브로드캐스팅](04-event-broadcasting.md)
- [메서드 핸들러](05-method-handlers.md)
- [Send 핸들러](server-methods/01-send-handler.md)
- [Chat 핸들러](server-methods/02-chat-handlers.md)

### 리소스 관리
- [노드 관리](06-node-management.md)
- [채널 관리](07-channel-management.md)
- [크론 서비스](08-cron-service.md)
- [설정 관리](09-config-management.md)
- [설정 리로드](utils/08-config-reload.md)

### HTTP 및 API
- [HTTP 서버](10-http-server.md)
- [OpenAI HTTP API](specialized/06-openai-http.md)
- [Hooks 시스템](specialized/03-hooks.md)
- [Control UI 서빙](specialized/07-control-ui.md)
- [HTTP 유틸리티](utils/01-http-utils.md)

### 특수 기능
- [Discovery](specialized/01-discovery.md)
- [Exec Approval](specialized/02-exec-approval.md)
- [채팅 중단](specialized/04-chat-abort.md)
- [채팅 첨부파일](specialized/05-chat-attachments.md)

### 내부 구현
- [서버 시작](01-server-startup.md)
- [서버 컴포넌트](server/00-server-components-overview.md)
- [세션 유틸리티](utils/02-session-utils-detail.md)
- [노드 헬퍼](utils/03-node-helpers.md)
- [Control UI 공유](utils/06-control-ui-shared.md)

## 📊 문서 통계

- **총 문서 수**: 35개
- **핵심 문서**: 11개
- **프로토콜 문서**: 2개
- **서버 컴포넌트 문서**: 1개
- **메서드 핸들러 문서**: 3개
- **특수 기능 문서**: 8개
- **유틸리티 문서**: 9개

## 🔄 문서 업데이트 가이드

### 새 문서 추가 시
1. 적절한 폴더에 배치
2. 번호 체계 유지 (`00-`, `01-`, ...)
3. `README.md`에 추가
4. 이 `INDEX.md`에 추가

### 문서 수정 시
1. 문서 상단의 작성일 업데이트
2. 변경 사항 반영
3. 관련 문서 링크 확인

## 📝 문서 작성 규칙

1. **파일명**: `{번호}-{설명}.md` 형식
2. **헤더**: 제목, 작성일, 모듈 경로 포함
3. **구조**: 개요 → 상세 → 예시 → 고려사항
4. **링크**: 상대 경로 사용
5. **코드**: TypeScript 코드 예시 포함
