---
name: CasAbot 설정
description: CasAbot 자체의 구조와 설정을 이해하기 위한 매뉴얼
metadata:
  casabot:
    requires:
      bins: [jq]
---

# CasAbot 설정

이 매뉴얼은 CasAbot의 디렉토리 구조, 설정 파일 스키마, 공급자 관리 방법을 설명합니다.

---

## 1. 디렉토리 구조

CasAbot의 모든 데이터는 `~/casabot/` 아래에 저장됩니다.

```
~/casabot/
├── casabot.json          # 모든 설정 (공급자, 모델 등)
├── skills/               # 스킬 디렉토리 (SKILL.md 포함)
│   ├── agent/            # 에이전트 생성 및 관리
│   ├── config/           # 설정 관리 (이 문서)
│   ├── chat/             # 대화 관리
│   ├── service/          # 시스템 서비스 등록
│   └── memory/           # 기록(메모) 관리
├── workspaces/           # 에이전트별 워크스페이스
│   └── <agent-name>/     # 개별 에이전트 작업 디렉토리
│       └── output/       # 에이전트 출력 결과
├── history/              # 대화 전체 기록 (원본 로그, JSON)
└── memory/               # 에이전트가 직접 작성한 메모 (.md)
```

### 각 디렉토리의 역할

| 디렉토리 | 설명 | 형식 |
|---------|------|------|
| `casabot.json` | 공급자 설정, 활성 모델 등 전체 설정 | JSON |
| `skills/` | base 에이전트가 참조하는 스킬 매뉴얼 | SKILL.md (YAML + Markdown) |
| `workspaces/` | 서브에이전트 컨테이너에 마운트되는 작업 공간 | 자유 형식 |
| `history/` | 자동 저장되는 대화 로그 (수정 불가) | JSON |
| `memory/` | 에이전트가 직접 작성하는 메모 | Markdown |

## 2. casabot.json 스키마

설정 파일의 전체 구조입니다.

```json
{
  "providers": [
    {
      "name": "공급자 이름 (고유 식별자)",
      "type": "openai | anthropic | huggingface | openrouter | custom-openai | custom-anthropic",
      "apiKey": "API 키",
      "endpoint": "커스텀 엔드포인트 URL (선택, custom-* 타입에서 필수)",
      "model": "모델 이름",
      "isDefault": true
    }
  ],
  "activeProvider": "현재 사용 중인 공급자 이름",
  "baseModel": "기본 모델 이름"
}
```

### 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|-----|------|-----|------|
| `providers` | 배열 | ✅ | 등록된 공급자 목록 |
| `providers[].name` | 문자열 | ✅ | 공급자의 고유 이름 |
| `providers[].type` | 문자열 | ✅ | 공급자 타입 (아래 지원 타입 참조) |
| `providers[].apiKey` | 문자열 | ✅ | 해당 공급자의 API 키 |
| `providers[].endpoint` | 문자열 | ❌ | 커스텀 엔드포인트 (custom-openai, custom-anthropic에서 필수) |
| `providers[].model` | 문자열 | ✅ | 사용할 모델 이름 |
| `providers[].isDefault` | 불리언 | ✅ | 기본 공급자 여부 |
| `activeProvider` | 문자열 | ✅ | 현재 활성 공급자의 name 값 |
| `baseModel` | 문자열 | ✅ | base 에이전트가 사용하는 모델 |

### 지원하는 공급자 타입

- `openai` — OpenAI API (GPT 시리즈)
- `anthropic` — Anthropic API (Claude 시리즈)
- `huggingface` — Hugging Face Inference API
- `openrouter` — OpenRouter 통합 API
- `custom-openai` — OpenAI 호환 커스텀 엔드포인트
- `custom-anthropic` — Anthropic 호환 커스텀 엔드포인트

## 3. 공급자 추가 방법

casabot.json의 `providers` 배열에 새 항목을 추가합니다.

```bash
# 새 공급자 추가 (jq 사용)
cat ~/casabot/casabot.json | jq '.providers += [{
  "name": "my-openai",
  "type": "openai",
  "apiKey": "sk-...",
  "model": "gpt-4o",
  "isDefault": false
}]' > /tmp/casabot.json && mv /tmp/casabot.json ~/casabot/casabot.json
```

### 커스텀 공급자 추가 예시

```bash
cat ~/casabot/casabot.json | jq '.providers += [{
  "name": "local-llm",
  "type": "custom-openai",
  "apiKey": "not-needed",
  "endpoint": "http://localhost:11434/v1",
  "model": "llama3",
  "isDefault": false
}]' > /tmp/casabot.json && mv /tmp/casabot.json ~/casabot/casabot.json
```

## 4. 활성 공급자 변경

현재 사용하는 공급자를 변경합니다.

```bash
# activeProvider 변경
cat ~/casabot/casabot.json | jq '.activeProvider = "my-openai"' > /tmp/casabot.json && mv /tmp/casabot.json ~/casabot/casabot.json
```

### baseModel도 함께 변경

```bash
cat ~/casabot/casabot.json | jq '
  .activeProvider = "my-openai" |
  .baseModel = "gpt-4o"
' > /tmp/casabot.json && mv /tmp/casabot.json ~/casabot/casabot.json
```

## 5. 현재 설정 확인

```bash
# 전체 설정 보기
cat ~/casabot/casabot.json | jq .

# 활성 공급자만 확인
cat ~/casabot/casabot.json | jq '.activeProvider'

# 등록된 공급자 목록
cat ~/casabot/casabot.json | jq '.providers[] | {name, type, model}'
```

## 6. 공급자 삭제

```bash
# 이름으로 공급자 삭제
cat ~/casabot/casabot.json | jq '.providers = [.providers[] | select(.name != "삭제할-이름")]' > /tmp/casabot.json && mv /tmp/casabot.json ~/casabot/casabot.json
```

## 7. 설정 초기화

전체 설정을 초기화하려면 `casabot setup` 명령어를 다시 실행합니다.

```bash
casabot setup
```

또는 설정 파일을 직접 초기화합니다:

```bash
echo '{"providers":[],"activeProvider":"","baseModel":""}' > ~/casabot/casabot.json
```
