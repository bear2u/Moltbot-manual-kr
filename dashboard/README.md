# Gateway Dashboard 문서 인덱스

**최종 업데이트**: 2026-01-28

Gateway Dashboard는 Moltbot Gateway를 브라우저에서 제어할 수 있는 웹 기반 Control UI입니다.

## 📁 문서 구조

```
dashboard/
├── README.md              # 이 파일
├── 00-dashboard-overview.md  # Dashboard 전체 개요
├── 01-chat.md            # 채팅 기능
├── 02-overview.md        # 개요 화면
├── 03-channels.md        # 채널 관리
├── 04-instances.md       # 인스턴스 관리
├── 05-sessions.md        # 세션 관리
├── 06-cron.md            # 크론 작업 관리
├── 07-skills.md          # Skills 관리
├── 08-nodes.md           # 노드 관리
├── 09-config.md          # 설정 관리
├── 10-debug.md           # 디버그 기능
└── 11-logs.md            # 로그 뷰어
```

## 📚 문서 목록

| 번호 | 문서명 | 설명 | 모듈 |
|------|--------|------|------|
| 00 | [Dashboard 개요](00-dashboard-overview.md) | Dashboard 전체 개요 및 아키텍처 | `ui/src/ui/` |
| 01 | [Chat](01-chat.md) | 채팅 기능 및 컴포넌트 | `ui/src/ui/chat/` |
| 02 | [Overview](02-overview.md) | 개요 화면 및 대시보드 | `ui/src/ui/overview/` |
| 03 | [Channels](03-channels.md) | 채널 관리 화면 | `ui/src/ui/channels/` |
| 04 | [Instances](04-instances.md) | 인스턴스 관리 화면 | `ui/src/ui/instances/` |
| 05 | [Sessions](05-sessions.md) | 세션 관리 화면 | `ui/src/ui/sessions/` |
| 06 | [Cron](06-cron.md) | 크론 작업 관리 화면 | `ui/src/ui/cron/` |
| 07 | [Skills](07-skills.md) | Skills 관리 화면 | `ui/src/ui/skills/` |
| 08 | [Nodes](08-nodes.md) | 노드 관리 화면 | `ui/src/ui/nodes/` |
| 09 | [Config](09-config.md) | 설정 관리 화면 | `ui/src/ui/config/` |
| 10 | [Debug](10-debug.md) | 디버그 기능 및 도구 | `ui/src/ui/debug/` |
| 11 | [Logs](11-logs.md) | 로그 뷰어 | `ui/src/ui/logs/` |

## 🔍 빠른 찾기

### 시작하기
- **[Dashboard 개요](00-dashboard-overview.md)** - Dashboard의 구조와 아키텍처

### 주요 기능
- **[Chat](01-chat.md)** - 채팅 인터페이스
- **[Overview](02-overview.md)** - 대시보드 개요 화면
- **[Sessions](05-sessions.md)** - 세션 관리

### 관리 기능
- **[Channels](03-channels.md)** - 채널 설정 및 관리
- **[Cron](06-cron.md)** - 스케줄된 작업 관리
- **[Skills](07-skills.md)** - Skills 설치 및 관리
- **[Nodes](08-nodes.md)** - 노드 연결 및 관리
- **[Config](09-config.md)** - Gateway 설정 편집

### 개발 및 디버깅
- **[Debug](10-debug.md)** - 디버그 도구
- **[Logs](11-logs.md)** - 로그 확인

## 🔗 관련 문서

- [Gateway 문서](../gateway/README.md) - Gateway 서버 문서
- [프로젝트 개요](../01-project-overview.md) - 프로젝트 전체 개요

## 📝 기술 스택

- **프레임워크**: Lit (Web Components)
- **빌드 도구**: Vite
- **통신**: WebSocket (Gateway Protocol)
- **스타일링**: CSS (커스텀 디자인 시스템)
- **타입**: TypeScript

## 🎯 주요 컴포넌트

- **MoltbotApp**: 메인 애플리케이션 컴포넌트
- **WebSocket 연결 관리**: Gateway와의 실시간 통신
- **상태 관리**: Lit의 reactive properties
- **라우팅**: 화면 간 네비게이션
