---
layout: default
title: Specialized Features Overview
---

# Gateway 특수 기능 개요

**작성일**: 2026-01-28  
**모듈**: `src/gateway/` (특수 기능들)

## 1. 개요

Gateway는 다양한 특수 기능을 제공합니다. 이 문서는 이러한 기능들의 개요를 제공합니다.

## 2. 주요 특수 기능

### 2.1 Discovery (`server-discovery.ts`, `server-discovery-runtime.ts`)

Gateway를 네트워크에서 발견 가능하게 만드는 기능입니다:
- **Bonjour/mDNS**: 로컬 네트워크에서 Gateway 발견
- **Wide Area Discovery**: Tailscale을 통한 원격 발견
- **DNS-SD**: DNS Service Discovery

**주요 함수:**
- `startGatewayDiscovery()`: Discovery 서비스 시작
- `formatBonjourInstanceName()`: Bonjour 인스턴스 이름 포맷팅
- `resolveBonjourCliPath()`: Bonjour CLI 경로 해결
- `resolveTailnetDnsHint()`: Tailnet DNS 힌트 해결

### 2.2 Exec Approval (`exec-approval-manager.ts`, `server-methods/exec-approval.ts`)

명령 실행 승인 시스템입니다:
- **승인 요청**: 명령 실행 전 승인 요청
- **승인 해결**: 승인/거부 결정
- **타임아웃**: 승인 대기 타임아웃
- **전달**: 다른 Gateway로 승인 요청 전달

**주요 클래스:**
- `ExecApprovalManager`: 승인 요청 관리

### 2.3 Hooks (`hooks.ts`, `hooks-mapping.ts`)

외부 시스템과 통합하기 위한 HTTP Hooks입니다:
- **Wake Hook**: 시스템 이벤트 큐에 메시지 추가
- **Agent Hook**: 에이전트 실행
- **매핑**: 커스텀 경로 매핑
- **변환**: 요청 변환 함수

**주요 함수:**
- `resolveHooksConfig()`: Hooks 설정 해결
- `extractHookToken()`: Hooks 토큰 추출
- `normalizeWakePayload()`: Wake 페이로드 정규화
- `normalizeAgentPayload()`: Agent 페이로드 정규화
- `applyHookMappings()`: Hook 매핑 적용

### 2.4 Chat Abort (`chat-abort.ts`)

채팅 실행 중단 기능입니다:
- **중단 요청**: 특정 실행 중단
- **세션별 중단**: 세션의 모든 실행 중단
- **타임아웃**: 자동 중단
- **브로드캐스트**: 중단 이벤트 브로드캐스트

**주요 함수:**
- `abortChatRunById()`: 특정 실행 중단
- `abortChatRunsForSessionKey()`: 세션의 모든 실행 중단
- `isChatStopCommandText()`: 중단 명령 텍스트 확인
- `resolveChatRunExpiresAtMs()`: 실행 만료 시간 해결

### 2.5 Chat Attachments (`chat-attachments.ts`)

채팅 첨부파일 처리 기능입니다:
- **이미지 파싱**: Base64 이미지 파싱
- **MIME 감지**: 파일 타입 자동 감지
- **크기 제한**: 파일 크기 제한
- **Claude API 형식**: Claude API 호환 형식으로 변환

**주요 함수:**
- `parseMessageWithAttachments()`: 메시지와 첨부파일 파싱
- `buildMessageWithAttachments()`: 메시지와 첨부파일 빌드 (deprecated)

### 2.6 Control UI (`control-ui.ts`)

Control UI 서빙 기능입니다:
- **정적 파일 서빙**: HTML, CSS, JS 파일 서빙
- **아바타 서빙**: 에이전트 아바타 이미지 서빙
- **경로 해결**: Control UI 루트 경로 해결

**주요 함수:**
- `handleControlUiHttpRequest()`: Control UI HTTP 요청 처리
- `handleControlUiAvatarRequest()`: 아바타 요청 처리

### 2.7 OpenAI HTTP (`openai-http.ts`)

OpenAI 호환 HTTP API입니다:
- **Chat Completions**: `/v1/chat/completions` 엔드포인트
- **스트리밍**: Server-Sent Events 스트리밍 지원
- **비스트리밍**: 일반 JSON 응답

**주요 함수:**
- `handleOpenAiHttpRequest()`: OpenAI HTTP 요청 처리
- `buildAgentPrompt()`: OpenAI 메시지를 에이전트 프롬프트로 변환

### 2.8 Assistant Identity (`assistant-identity.ts`)

에이전트 신원 해결 기능입니다:
- **이름 해결**: 에이전트 이름 해결
- **아바타 해결**: 에이전트 아바타 해결
- **우선순위**: 설정 → 에이전트 설정 → 파일 설정 → 기본값

**주요 함수:**
- `resolveAssistantIdentity()`: 에이전트 신원 해결

### 2.9 Wizard Sessions (`server-wizard-sessions.ts`)

온보딩 위저드 세션 관리입니다:
- **세션 추적**: 실행 중인 위저드 추적
- **세션 정리**: 완료된 세션 정리

**주요 함수:**
- `createWizardSessionTracker()`: 위저드 세션 트래커 생성
- `findRunningWizard()`: 실행 중인 위저드 찾기
- `purgeWizardSession()`: 위저드 세션 정리

### 2.10 Node Subscriptions (`server-node-subscriptions.ts`)

노드 구독 시스템입니다:
- **세션 구독**: 노드가 특정 세션의 이벤트를 구독
- **이벤트 전송**: 구독 노드에 이벤트 전송
- **구독 관리**: 구독 추가/제거

**주요 함수:**
- `createNodeSubscriptionManager()`: 구독 관리자 생성
- `subscribe()`: 구독 추가
- `unsubscribe()`: 구독 제거
- `sendToSession()`: 세션 구독자에게 이벤트 전송
- `sendToAllSubscribed()`: 모든 구독자에게 이벤트 전송

### 2.11 Lanes (`server-lanes.ts`)

명령 레인 동시성 관리입니다:
- **레인별 동시성**: 각 레인별 최대 동시 실행 수 설정
- **크론 레인**: 크론 작업 레인
- **메인 레인**: 메인 에이전트 레인
- **서브에이전트 레인**: 서브에이전트 레인

**주요 함수:**
- `applyGatewayLaneConcurrency()`: Gateway 레인 동시성 적용

### 2.12 Browser Control (`server-browser.ts`)

브라우저 제어 서버 시작입니다:
- **조건부 시작**: 설정에 따라 시작
- **지연 로딩**: 필요할 때만 모듈 로드

**주요 함수:**
- `startBrowserControlServerIfEnabled()`: 브라우저 제어 서버 시작

### 2.13 Model Catalog (`server-model-catalog.ts`)

모델 카탈로그 로드입니다:
- **카탈로그 로드**: 설정에서 모델 카탈로그 로드
- **캐싱**: 프로세스 생명주기 동안 캐싱

**주요 함수:**
- `loadGatewayModelCatalog()`: Gateway 모델 카탈로그 로드

### 2.14 Plugins (`server-plugins.ts`)

Gateway 플러그인 로딩입니다:
- **플러그인 로드**: Moltbot 플러그인 로드
- **메서드 통합**: 플러그인 메서드를 Gateway 메서드에 통합
- **진단**: 플러그인 로딩 진단 정보

**주요 함수:**
- `loadGatewayPlugins()`: Gateway 플러그인 로드

### 2.15 Session Key (`server-session-key.ts`)

실행 ID에서 세션 키 해결입니다:
- **캐시 확인**: 실행 컨텍스트 캐시 확인
- **스토어 검색**: 세션 스토어에서 검색

**주요 함수:**
- `resolveSessionKeyForRun()`: 실행 ID에서 세션 키 해결

## 3. 통합 패턴

### 3.1 지연 로딩

일부 기능은 지연 로딩을 사용합니다:
- 브라우저 제어 서버
- 플러그인 모듈

### 3.2 캐싱

성능 최적화를 위해 캐싱을 사용합니다:
- Health 스냅샷
- 모델 카탈로그
- 세션 스토어

### 3.3 비동기 처리

대부분의 작업은 비동기로 처리됩니다:
- 파일 I/O
- 네트워크 요청
- 외부 서비스 호출

## 4. 확장성

모든 특수 기능은 확장 가능합니다:
- 플러그인을 통한 확장
- 설정을 통한 커스터마이징
- 이벤트를 통한 통합
