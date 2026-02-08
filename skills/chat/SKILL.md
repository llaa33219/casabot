---
name: 대화 관리
description: 대화 세션을 관리하고 외부 서비스와 연동하기 위한 매뉴얼
metadata:
  casabot:
    requires:
      bins: []
---

# 대화 관리

이 매뉴얼은 대화 세션의 생성·조회·검색 방법과 외부 서비스 연동 방법을 설명합니다.

---

## 1. 대화 세션 관리

### 세션 구조

각 대화 세션은 `~/casabot/history/` 디렉토리에 JSON 파일로 자동 저장됩니다.

```json
{
  "id": "세션 고유 ID",
  "startedAt": "2024-01-15T09:30:00.000Z",
  "messages": [
    {
      "role": "user | assistant | system | tool",
      "content": "메시지 내용",
      "toolCalls": [],
      "toolCallId": ""
    }
  ]
}
```

### 세션 생명주기
- **생성**: `casabot` 명령어를 실행하면 새 세션이 자동 생성됩니다.
- **유지**: 대화가 진행되는 동안 메시지가 자동으로 추가됩니다.
- **종료**: 프로그램을 종료하면 세션이 닫힙니다.
- **보존**: 종료 후에도 기록은 history 디렉토리에 영구 보존됩니다.

## 2. 대화 불러오기

### 최근 대화 목록 확인

```bash
# 최근 대화 20개 (최신순)
ls -lt ~/casabot/history/ | head -20

# 파일명과 크기 확인
ls -lhS ~/casabot/history/
```

### 특정 대화 내용 보기

```bash
# 대화 전체 보기 (정리된 형태)
cat ~/casabot/history/<conversation-id>.json | jq '.messages[] | {role, content: .content[:100]}'

# 사용자 메시지만 보기
cat ~/casabot/history/<conversation-id>.json | jq '.messages[] | select(.role == "user") | .content'

# 어시스턴트 응답만 보기
cat ~/casabot/history/<conversation-id>.json | jq '.messages[] | select(.role == "assistant") | .content'
```

### 세션 메타정보 확인

```bash
# 세션 ID와 시작 시간
cat ~/casabot/history/<conversation-id>.json | jq '{id, startedAt, messageCount: (.messages | length)}'
```

## 3. 이전 대화 검색

### 키워드로 검색

```bash
# 모든 대화에서 키워드 검색
grep -rl "검색어" ~/casabot/history/

# 키워드가 포함된 대화의 맥락 보기
grep -l "검색어" ~/casabot/history/*.json | while read f; do
  echo "=== $(basename $f) ==="
  cat "$f" | jq '.messages[] | select(.content | contains("검색어")) | {role, content: .content[:200]}'
done
```

### 날짜로 검색

```bash
# 특정 날짜 이후의 대화
find ~/casabot/history/ -name "*.json" -newermt "2024-01-15" -type f

# 오늘 대화만
find ~/casabot/history/ -name "*.json" -newermt "$(date +%Y-%m-%d)" -type f

# 최근 7일간 대화
find ~/casabot/history/ -name "*.json" -mtime -7 -type f
```

### 역할별 검색

```bash
# 도구 호출이 포함된 대화 찾기
grep -rl "toolCalls" ~/casabot/history/ | head -10

# 특정 도구가 사용된 대화
grep -rl "run_command" ~/casabot/history/
```

## 4. 대화 통계

```bash
# 전체 대화 수
ls ~/casabot/history/*.json 2>/dev/null | wc -l

# 가장 긴 대화 (메시지 수 기준)
for f in ~/casabot/history/*.json; do
  echo "$(cat "$f" | jq '.messages | length') $(basename $f)"
done | sort -rn | head -10
```

## 5. 외부 서비스 연동

외부 메시징 서비스(WhatsApp, Discord, Telegram, Slack 등)와 연동하여 CasAbot을 사용할 수 있습니다.

### 연동 구조

```
외부 서비스 → [연동 서브에이전트] → base 에이전트 → [작업 서브에이전트들]
                                    ↓
                              사용자에게 응답
```

### 연동 설정 단계

1. **연동 서브에이전트 생성** — `agent` 스킬을 참조하여 연동 전용 컨테이너를 만듭니다.
2. **서비스 API/봇 설정** — 해당 서비스의 봇 토큰이나 웹훅 URL을 설정합니다.
3. **메시지 수신** — 서비스에서 메시지를 수신하면 base에게 전달합니다.
4. **응답 전송** — base의 응답을 서비스로 돌려보냅니다.

### 예시: 웹훅 기반 연동

```bash
# 연동 에이전트 생성 (agent 스킬 참조)
podman run -d \
  --name webhook-bridge \
  --label casabot=true \
  -p 8080:8080 \
  -v ~/casabot/workspaces/webhook-bridge:/workspace \
  -v ~/casabot/skills:/skills:ro \
  node:20-slim sleep infinity

# 웹훅 서버 스크립트를 에이전트에 배포
podman cp webhook-server.js webhook-bridge:/workspace/
podman exec -d webhook-bridge node /workspace/webhook-server.js
```

## 6. 주의사항

- **기록은 수정하지 마세요**: `~/casabot/history/`의 파일은 원본 로그입니다. 수정이 필요하면 별도 사본을 만드세요.
- **메모가 필요하면 memory를 사용하세요**: 대화에서 중요한 내용을 기록하려면 `memory` 스킬을 참조하세요.
- **대용량 기록 관리**: 기록이 많아지면 오래된 파일을 아카이브하거나 압축하세요.
