---
name: 에이전트 생성 및 관리
description: base가 서브에이전트를 만들고 관리하기 위한 매뉴얼
metadata:
  casabot:
    requires:
      bins: [podman]
---

# 에이전트 생성 및 관리

이 매뉴얼은 base 에이전트가 podman 기반 서브에이전트를 생성·관리하는 방법을 설명합니다.

---

## 1. podman 설치

서브에이전트를 만들기 전에 podman이 설치되어 있어야 합니다.

```bash
# 설치 확인
which podman

# 미설치 시 (Debian/Ubuntu)
sudo apt update && sudo apt install -y podman

# 미설치 시 (Fedora/RHEL)
sudo dnf install -y podman
```

## 2. podman 저장공간 설정

컨테이너 이미지와 레이어가 저장되는 경로를 확인하고, 디스크 용량이 충분한지 점검합니다.

```bash
# 저장 경로 확인
podman info --format '{{.Store.GraphRoot}}'

# 디스크 사용량 확인
df -h $(podman info --format '{{.Store.GraphRoot}}')
```

사용량이 부족할 경우 `~/.config/containers/storage.conf`에서 `graphroot`를 변경합니다.

## 3. 서브에이전트 컨테이너 생성

모든 서브에이전트 컨테이너에는 반드시 `casabot` 라벨을 부여합니다.

```bash
# 새 에이전트 컨테이너 생성
podman run -d \
  --name <agent-name> \
  --label casabot=true \
  -v ~/casabot/workspaces/<agent-name>:/workspace \
  -v ~/casabot/skills:/skills:ro \
  node:20-slim sleep infinity
```

### 필수 규칙
- `--label casabot=true`: 모든 CasAbot 서브에이전트 식별에 사용됩니다.
- `-v ~/casabot/workspaces/<agent-name>:/workspace`: 에이전트별 전용 작업 공간을 마운트합니다.
- `-v ~/casabot/skills:/skills:ro`: 스킬 디렉토리를 읽기 전용으로 공유합니다.

컨테이너 생성 후 에이전트 스크립트를 복사하고 실행합니다:

```bash
podman cp <script-path> <agent-name>:/workspace/agent.js
podman exec <agent-name> node /workspace/agent.js
```

## 4. 공급자(Provider) 설정 전달

서브에이전트에게 LLM 공급자 정보를 환경변수로 전달합니다.

```bash
# 환경변수로 API 키 및 모델 전달
podman exec \
  -e PROVIDER_TYPE=openai \
  -e API_KEY=<key> \
  -e MODEL=<model> \
  -e ENDPOINT=<endpoint> \
  <agent-name> node /workspace/agent.js
```

또는 컨테이너 생성 시 `-e` 옵션으로 미리 설정할 수도 있습니다:

```bash
podman run -d \
  --name <agent-name> \
  --label casabot=true \
  -e PROVIDER_TYPE=openai \
  -e API_KEY=<key> \
  -e MODEL=gpt-4o \
  -v ~/casabot/workspaces/<agent-name>:/workspace \
  -v ~/casabot/skills:/skills:ro \
  node:20-slim sleep infinity
```

## 5. 스킬 전달

컨테이너 생성 시 `-v ~/casabot/skills:/skills:ro`로 마운트하면 서브에이전트가 스킬 문서를 읽을 수 있습니다.

서브에이전트 내부에서 스킬을 읽는 방법:

```bash
# 컨테이너 내부에서
cat /skills/agent/SKILL.md
cat /skills/memory/SKILL.md
ls /skills/
```

## 6. 에이전트 목록 조회

`casabot` 라벨이 붙은 모든 컨테이너를 조회합니다.

```bash
# 실행 중인 에이전트 목록
podman ps --filter "label=casabot" --format "{{.Names}}\t{{.Status}}"

# 전체 에이전트 (중지 포함)
podman ps -a --filter "label=casabot" --format "table {{.Names}}\t{{.Status}}\t{{.Created}}"
```

## 7. 에이전트 파괴 및 정리

사용이 끝난 에이전트를 정리합니다.

```bash
# 컨테이너 중지 및 삭제
podman stop <agent-name> && podman rm <agent-name>

# 워크스페이스도 함께 정리할 경우
rm -rf ~/casabot/workspaces/<agent-name>
```

### 일괄 정리

```bash
# 모든 CasAbot 에이전트 중지 및 삭제
podman ps -a --filter "label=casabot" --format "{{.Names}}" | xargs -r podman stop
podman ps -a --filter "label=casabot" --format "{{.Names}}" | xargs -r podman rm
```

## 8. 작업 위임

서브에이전트에게 작업을 전달하는 방법입니다.

```bash
# stdin으로 작업 전달
echo "<task-description>" | podman exec -i <agent-name> node /workspace/agent.js

# 파일로 작업 전달
echo "<task-description>" > ~/casabot/workspaces/<agent-name>/task.txt
podman exec <agent-name> node /workspace/agent.js --task /workspace/task.txt
```

### 위임 원칙
- base는 오케스트레이터입니다. 실제 작업은 서브에이전트에게 위임하세요.
- 적합한 서브에이전트가 없으면 새로 만들어서 위임하세요.
- 작업 설명은 구체적이고 명확하게 작성하세요.

## 9. 결과 수집

서브에이전트의 작업 결과를 확인합니다.

```bash
# 에이전트 로그 확인
podman logs <agent-name>

# 최근 로그만 확인
podman logs --tail 50 <agent-name>

# 워크스페이스 출력 파일 확인
ls ~/casabot/workspaces/<agent-name>/output/

# 결과 파일 내용 읽기
cat ~/casabot/workspaces/<agent-name>/output/result.txt
```

결과를 수집한 뒤, 사용자에게 요약하여 보고합니다.
