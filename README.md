# CasAbot

> **Cassiopeia A** — 초신성 폭발과 같이 모든 것을 자유롭게 창조한다.

스킬 중심 멀티에이전트 오케스트레이터 시스템. base 에이전트가 스킬 문서를 읽고, 서브에이전트를 생성·위임하여 모든 작업을 처리합니다.

## 설치

```bash
npm i -g casabot
```

## 시작하기

```bash
# 최초 설정 (공급자, 모델 선택)
casabot setup

# TUI 대화창 열기
casabot

# 설정 초기화
casabot reset
```

## 핵심 철학

- **스킬이 전부다** — base는 코드를 하드코딩하지 않습니다. 스킬 문서(SKILL.md)를 읽고 터미널을 통해 실행합니다. 새 기능이 필요하면 스킬 문서 하나를 추가하면 됩니다.
- **base는 일하지 않는다** — base는 오케스트레이터입니다. 직접 작업하지 않고, 서브에이전트에게 위임합니다.

## 아키텍처

```
사용자 ↔ TUI (터미널 UI) ↔ base 에이전트 (터미널 권한)
                               │
                               ├── 스킬 문서 읽기
                               ├── 터미널 명령 실행
                               │
                               ├── 서브에이전트 A (podman 컨테이너)
                               │     └── 자체 워크스페이스 + 도구
                               ├── 서브에이전트 B (podman 컨테이너)
                               │     └── 자체 워크스페이스 + 도구
                               └── ...
```

## 디렉토리 구조

```
~/casabot/
├── casabot.json          # 모든 설정 (공급자, 모델 등)
├── skills/               # 스킬 문서 (AgentSkills 표준)
│   ├── agent/SKILL.md    # 에이전트 생성 및 관리
│   ├── config/SKILL.md   # CasAbot 설정
│   ├── chat/SKILL.md     # 대화 관리
│   ├── service/SKILL.md  # 시스템 서비스 등록
│   └── memory/SKILL.md   # 기록 관리
├── workspaces/           # 에이전트별 워크스페이스
├── history/              # 대화 전체 기록 (원본 로그)
└── memory/               # 에이전트가 작성한 메모 (.md)
```

## 지원 공급자

| 공급자 | 타입 |
|--------|------|
| OpenAI | `openai` |
| Anthropic | `anthropic` |
| Hugging Face | `huggingface` |
| OpenRouter | `openrouter` |
| 커스텀 (OpenAI 호환) | `custom-openai` |
| 커스텀 (Anthropic 호환) | `custom-anthropic` |

## 기본 제공 스킬

| 스킬 | 설명 |
|------|------|
| `agent` | podman 기반 서브에이전트 생성, 위임, 관리 |
| `config` | CasAbot 설정 구조 및 변경 방법 |
| `chat` | 대화 세션 관리 및 검색 |
| `service` | systemd 서비스 등록 및 자동화 |
| `memory` | 기록 작성, 조회, 검색 |

## 스킬 추가

`~/casabot/skills/` 아래에 디렉토리를 만들고 `SKILL.md`를 작성하면 됩니다.

```yaml
---
name: 스킬이름
description: 스킬 설명
metadata:
  casabot:
    requires:
      bins: []
---

# 스킬 제목

(base가 읽고 해석하여 터미널로 실행할 지침)
```

## 기술 스택

- **런타임**: Node.js
- **언어**: TypeScript
- **TUI**: [Ink](https://github.com/vadimdemedes/ink) (React for CLI)
- **컨테이너**: podman
- **LLM SDK**: OpenAI, Anthropic

## 라이선스

ISC
