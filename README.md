# Moltbot 문서 인덱스

**최종 업데이트**: 2026-01-28

이 디렉토리는 Moltbot 프로젝트의 주요 컴포넌트에 대한 상세한 기술 문서를 포함합니다.

## 📁 폴더 구조

```
reviews/
├── README.md                    # 이 파일
├── 01-project-overview.md       # 프로젝트 전체 개요
├── 02-browser-automation.md     # 브라우저 자동화 시스템
├── dashboard/                    # Gateway Dashboard (Control UI)
│   ├── 00-dashboard-overview.md
│   ├── 01-chat.md
│   ├── 02-overview.md
│   ├── 03-channels.md
│   ├── 04-instances.md
│   ├── 05-sessions.md
│   ├── 06-cron.md
│   ├── 07-skills.md
│   ├── 08-nodes.md
│   ├── 09-config.md
│   ├── 10-debug.md
│   └── 11-logs.md
└── gateway/                      # Gateway 서버
    ├── README.md                 # Gateway 문서 인덱스
    ├── 00-gateway-overview.md    # Gateway 개요
    ├── 01-server-startup.md     # 서버 시작
    ├── 02-websocket-protocol.md # WebSocket 프로토콜
    ├── 03-authentication.md     # 인증 시스템
    ├── 04-event-broadcasting.md # 이벤트 브로드캐스팅
    ├── 05-method-handlers.md    # 메서드 핸들러
    ├── 06-node-management.md   # 노드 관리
    ├── 07-channel-management.md # 채널 관리
    ├── 08-cron-service.md       # 크론 서비스
    ├── 09-config-management.md  # 설정 관리
    ├── 10-http-server.md        # HTTP 서버
    ├── protocol/                 # 프로토콜 관련
    │   ├── 00-protocol-overview.md
    │   └── 01-protocol-schemas.md
    ├── server/                   # 서버 내부 컴포넌트
    │   └── 00-server-components-overview.md
    ├── server-methods/           # 메서드 핸들러 상세
    │   ├── 00-methods-overview.md
    │   ├── 01-send-handler.md
    │   └── 02-chat-handlers.md
    ├── specialized/             # 특수 기능
    │   ├── 00-specialized-features-overview.md
    │   ├── 01-discovery.md
    │   ├── 02-exec-approval.md
    │   ├── 03-hooks.md
    │   ├── 04-chat-abort.md
    │   ├── 05-chat-attachments.md
    │   ├── 06-openai-http.md
    │   └── 07-control-ui.md
    └── utils/                    # 유틸리티 함수
        ├── 00-utils-overview.md
        ├── 01-http-utils.md
        ├── 02-session-utils-detail.md
        ├── 03-node-helpers.md
        ├── 04-device-auth.md
        ├── 05-node-command-policy.md
        ├── 06-control-ui-shared.md
        ├── 07-protocol-client-info.md
        └── 08-config-reload.md
```

## 📚 문서 카테고리

### 1. 프로젝트 전체
- **[프로젝트 개요](01-project-overview.md)** - Moltbot 프로젝트 전체 개요
- **[브라우저 자동화](02-browser-automation.md)** - 브라우저 자동화 시스템 상세 분석

### 2. Gateway Dashboard
- **[Dashboard 개요](dashboard/00-dashboard-overview.md)** - Control UI 전체 개요
- **[Chat](dashboard/01-chat.md)** - 채팅 기능
- **[Overview](dashboard/02-overview.md)** - 대시보드 개요 화면
- **[Channels](dashboard/03-channels.md)** - 채널 관리
- **[Instances](dashboard/04-instances.md)** - 인스턴스 관리
- **[Sessions](dashboard/05-sessions.md)** - 세션 관리
- **[Cron](dashboard/06-cron.md)** - 크론 작업 관리
- **[Skills](dashboard/07-skills.md)** - Skills 관리
- **[Nodes](dashboard/08-nodes.md)** - 노드 관리
- **[Config](dashboard/09-config.md)** - 설정 관리
- **[Debug](dashboard/10-debug.md)** - 디버그 기능
- **[Logs](dashboard/11-logs.md)** - 로그 뷰어

### 3. Gateway 서버
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
