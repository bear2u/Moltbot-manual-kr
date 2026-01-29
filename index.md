---
layout: default
title: Moltbot 한국어 매뉴얼
---

# Moltbot 한국어 매뉴얼

**최종 업데이트**: 2026-01-28

이 사이트는 Moltbot 프로젝트의 주요 컴포넌트에 대한 상세한 기술 문서를 제공합니다.

## 📁 문서 구조

### 프로젝트 전체
- [프로젝트 개요](01-project-overview.md) - Moltbot 프로젝트 전체 개요
- [브라우저 자동화](02-browser-automation.md) - 브라우저 자동화 시스템 상세 분석
- [빠진 문서 분석](03-missing-documentation-analysis.md) - 문서화가 필요한 영역 분석
- [안드로이드 모바일 앱 자동화](04-android-emulator-browser-automation.md) - 모바일 앱 자동화 가이드
- [Appium 스킬 통합](05-appium-skill-integration.md) - Appium을 이용한 모바일 앱 자동화 스킬
- [멀티 에이전트 시스템](06-multi-agent-system.md) - 멀티 에이전트 핸들링 및 통신 가이드

### Gateway Dashboard
- [Dashboard 개요](dashboard/00-dashboard-overview.md) - Control UI 전체 개요
- [Chat](dashboard/01-chat.md) - 채팅 기능
- [Overview](dashboard/02-overview.md) - 대시보드 개요 화면
- [Channels](dashboard/03-channels.md) - 채널 관리
- [Instances](dashboard/04-instances.md) - 인스턴스 관리
- [Sessions](dashboard/05-sessions.md) - 세션 관리
- [Cron](dashboard/06-cron.md) - 크론 작업 관리
- [Skills](dashboard/07-skills.md) - Skills 관리
- [Nodes](dashboard/08-nodes.md) - 노드 관리
- [Config](dashboard/09-config.md) - 설정 관리
- [Debug](dashboard/10-debug.md) - 디버그 기능
- [Logs](dashboard/11-logs.md) - 로그 뷰어

### Gateway 서버
자세한 내용은 [Gateway 문서 인덱스](gateway/README.md)를 참조하세요.

## 🔍 빠른 찾기

### Gateway 관련
- Gateway 시작하기: [Gateway 개요](gateway/00-gateway-overview.md)
- WebSocket 프로토콜: [WebSocket 프로토콜](gateway/02-websocket-protocol.md)
- 인증: [인증 시스템](gateway/03-authentication.md)
- 메서드 호출: [메서드 핸들러](gateway/05-method-handlers.md)

### Dashboard 관련
- Dashboard 시작하기: [Dashboard 개요](dashboard/00-dashboard-overview.md)
- 채팅 기능: [Chat](dashboard/01-chat.md)

### 브라우저 자동화
- 브라우저 자동화: [브라우저 자동화 시스템](02-browser-automation.md)

## 📝 문서 작성 가이드

### 파일 명명 규칙
- `00-*.md`: 개요 문서
- `01-*.md`, `02-*.md`, ...: 순차적 번호
- 하위 폴더는 기능별로 그룹화

### 문서 구조
각 문서는 다음 구조를 따릅니다:
1. 제목 및 메타데이터 (작성일, 모듈 경로)
2. 개요
3. 상세 설명
4. 사용 예시
5. 성능/보안 고려사항

## 🔄 업데이트 이력

- **2026-01-28**: Gateway 문서 대량 추가 (프로토콜, 서버 컴포넌트, 메서드 핸들러, 특수 기능, 유틸리티)
- **2026-01-29**: 멀티 에이전트 시스템 문서 추가
