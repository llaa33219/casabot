import { createInterface } from "readline";
import { ensureDirectories, saveConfig, loadConfig, PATHS } from "../config/manager.js";
import { writeFile, access } from "fs/promises";
import { join } from "path";
import type { ProviderConfig, ProviderType } from "../config/types.js";

function askQuestion(
  rl: ReturnType<typeof createInterface>,
  question: string,
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

const PROVIDER_OPTIONS: { label: string; type: ProviderType; defaultModel: string }[] = [
  { label: "OpenAI", type: "openai", defaultModel: "gpt-4o" },
  { label: "Anthropic", type: "anthropic", defaultModel: "claude-sonnet-4-20250514" },
  { label: "Hugging Face", type: "huggingface", defaultModel: "meta-llama/Meta-Llama-3-8B-Instruct" },
  { label: "OpenRouter", type: "openrouter", defaultModel: "openai/gpt-4o" },
  { label: "Custom (OpenAI 호환)", type: "custom-openai", defaultModel: "" },
  { label: "Custom (Anthropic 호환)", type: "custom-anthropic", defaultModel: "" },
];

async function installDefaultSkills(): Promise<void> {
  const defaultSkills: Record<string, { name: string; description: string; content: string }> = {
    agent: {
      name: "에이전트 생성 및 관리",
      description: "base가 서브에이전트를 만들고 관리하기 위한 매뉴얼",
      content: `# 에이전트 생성 및 관리

## podman 설치
\`\`\`bash
# 설치 확인
which podman || sudo apt install -y podman
\`\`\`

## podman 저장공간 설정
\`\`\`bash
# 저장 경로 확인
podman info --format '{{.Store.GraphRoot}}'
\`\`\`

## 서브에이전트 컨테이너 생성
\`\`\`bash
# 새 에이전트 컨테이너 생성
podman run -d --name <agent-name> \\
  -v ~/casabot/workspaces/<agent-name>:/workspace \\
  -v ~/casabot/skills:/skills:ro \\
  node:20-slim sleep infinity

# 에이전트 스크립트 복사 및 실행
podman cp <script-path> <agent-name>:/workspace/agent.js
podman exec <agent-name> node /workspace/agent.js
\`\`\`

## 공급자 설정 전달
\`\`\`bash
# 환경변수로 API 키 전달
podman exec -e API_KEY=<key> -e MODEL=<model> <agent-name> node /workspace/agent.js
\`\`\`

## 스킬 전달
컨테이너 생성 시 \`-v ~/casabot/skills:/skills:ro\`로 마운트하면 에이전트가 스킬을 읽을 수 있습니다.

## 에이전트 목록 조회
\`\`\`bash
podman ps --filter "label=casabot" --format "{{.Names}}\\t{{.Status}}"
\`\`\`

## 에이전트 파괴 및 정리
\`\`\`bash
podman stop <agent-name> && podman rm <agent-name>
# 워크스페이스도 정리할 경우:
rm -rf ~/casabot/workspaces/<agent-name>
\`\`\`

## 작업 위임
\`\`\`bash
# 에이전트에 작업 전달 (stdin으로)
echo "<task-description>" | podman exec -i <agent-name> node /workspace/agent.js
\`\`\`

## 결과 수집
\`\`\`bash
# 에이전트 출력 확인
podman logs <agent-name>
# 워크스페이스 결과 파일 확인
ls ~/casabot/workspaces/<agent-name>/output/
\`\`\``,
    },
    config: {
      name: "CasAbot 설정",
      description: "CasAbot 자체의 구조와 설정을 이해하기 위한 매뉴얼",
      content: `# CasAbot 설정

## 디렉토리 구조
\`\`\`
~/casabot/
├── casabot.json          # 모든 설정
├── skills/               # 스킬 디렉토리 (SKILL.md 포함)
│   ├── agent/
│   ├── config/
│   ├── chat/
│   ├── service/
│   └── memory/
├── workspaces/           # 에이전트별 워크스페이스
├── history/              # 대화 전체 기록 (원본 로그)
└── memory/               # 에이전트가 직접 작성한 메모 (.md)
\`\`\`

## casabot.json 스키마
\`\`\`json
{
  "providers": [
    {
      "name": "공급자 이름",
      "type": "openai | anthropic | huggingface | openrouter | custom-openai | custom-anthropic",
      "apiKey": "API 키",
      "endpoint": "커스텀 엔드포인트 (선택)",
      "model": "모델 이름",
      "isDefault": true
    }
  ],
  "activeProvider": "활성 공급자 이름",
  "baseModel": "기본 모델 이름"
}
\`\`\`

## 공급자 추가 방법
casabot.json의 providers 배열에 새 항목을 추가합니다:
\`\`\`bash
# casabot.json 편집
cat ~/casabot/casabot.json | jq '.providers += [{"name":"new","type":"openai","apiKey":"sk-...","model":"gpt-4o","isDefault":false}]' > /tmp/casabot.json && mv /tmp/casabot.json ~/casabot/casabot.json
\`\`\`

## 공급자 변경 방법
activeProvider 값을 변경합니다:
\`\`\`bash
cat ~/casabot/casabot.json | jq '.activeProvider = "new-provider-name"' > /tmp/casabot.json && mv /tmp/casabot.json ~/casabot/casabot.json
\`\`\``,
    },
    chat: {
      name: "대화 관리",
      description: "대화 세션을 관리하고 외부 서비스와 연동하기 위한 매뉴얼",
      content: `# 대화 관리

## 대화 세션 관리
대화 기록은 ~/casabot/history/ 에 JSON 파일로 저장됩니다.

## 대화 불러오기
\`\`\`bash
# 최근 대화 목록
ls -lt ~/casabot/history/ | head -20

# 특정 대화 내용 보기
cat ~/casabot/history/<conversation-id>.json | jq '.messages[] | {role, content: .content[:100]}'
\`\`\`

## 이전 대화 검색
\`\`\`bash
# 키워드로 대화 검색
grep -rl "검색어" ~/casabot/history/

# 특정 날짜 이후 대화
find ~/casabot/history/ -newer <date-reference-file> -name "*.json"
\`\`\`

## 외부 서비스 연동
외부 서비스(WhatsApp, Discord 등)와의 연동은 서브에이전트를 통해 처리합니다:
1. 연동 서브에이전트를 생성합니다 (agent 스킬 참조)
2. 해당 서비스의 API/봇을 설정합니다
3. 메시지를 수신하면 base에게 전달하고, 응답을 서비스로 보냅니다`,
    },
    service: {
      name: "시스템 서비스 등록",
      description: "자동 시작 및 서비스 연동을 설정하기 위한 매뉴얼",
      content: `# 시스템 서비스 등록

## base 자동 시작 (systemd)
\`\`\`bash
# systemd 서비스 파일 생성
cat > ~/.config/systemd/user/casabot.service << 'EOF'
[Unit]
Description=CasAbot Base Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/env casabot
Restart=on-failure
RestartSec=10
WorkingDirectory=%h/casabot

[Install]
WantedBy=default.target
EOF

# 서비스 활성화 및 시작
systemctl --user daemon-reload
systemctl --user enable casabot
systemctl --user start casabot
\`\`\`

## 서비스 상태 확인
\`\`\`bash
systemctl --user status casabot
journalctl --user -u casabot -f
\`\`\`

## 특정 에이전트 자동 시작
에이전트 컨테이너에 \`--restart=always\` 옵션을 추가합니다:
\`\`\`bash
podman run -d --restart=always --name <agent-name> ...
\`\`\`

## 외부 서비스 연동 자동화
cron 또는 systemd timer를 사용하여 주기적 작업을 설정합니다:
\`\`\`bash
# crontab 편집
crontab -e
# 매 5분마다 모니터링 에이전트 실행
*/5 * * * * podman exec monitor node /workspace/check.js
\`\`\``,
    },
    memory: {
      name: "기록",
      description: "base와 서브에이전트가 기록(memory)을 작성하고 조회하기 위한 매뉴얼",
      content: `# 기록 (Memory)

## 기억(History)과 기록(Memory)의 차이
- **기억 (History)**: ~/casabot/history/ — 대화 전체의 원본 로그 (자동 저장, 수정 불가)
- **기록 (Memory)**: ~/casabot/memory/ — 에이전트가 직접 작성한 메모 (.md 파일)

## 기록 파일 위치
~/casabot/memory/

## 기록 작성 규칙
- 파일 형식: 마크다운 (.md)
- 파일명: \`YYYY-MM-DD-주제.md\` 또는 \`주제.md\`
- 내용: 자유 형식이나 다음을 포함하면 좋음:
  - 날짜/시간
  - 작성자 (어떤 에이전트가 작성했는지)
  - 요약
  - 상세 내용

### 기록 작성 예시
\`\`\`bash
cat > ~/casabot/memory/2024-01-15-프로젝트-분석.md << 'EOF'
# 프로젝트 분석 결과
- 작성자: code-reviewer
- 날짜: 2024-01-15

## 요약
사용자의 프로젝트 코드를 분석한 결과...

## 상세
...
EOF
\`\`\`

## 기록 조회 및 검색
\`\`\`bash
# 전체 기록 목록
ls -lt ~/casabot/memory/

# 키워드 검색
grep -rl "검색어" ~/casabot/memory/

# 특정 기록 읽기
cat ~/casabot/memory/<filename>.md
\`\`\``,
    },
  };

  for (const [dir, skill] of Object.entries(defaultSkills)) {
    const skillPath = join(PATHS.skills, dir, "SKILL.md");
    const exists = await access(skillPath).then(() => true).catch(() => false);
    if (exists) continue;

    const content = `---
name: ${skill.name}
description: ${skill.description}
metadata:
  casabot:
    requires:
      bins: []
---

${skill.content}
`;
    await writeFile(skillPath, content, "utf-8");
  }
}

export async function setupWizard(): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("\n🌟 CasAbot 설정을 시작합니다.\n");

    console.log("공급자를 선택하세요:");
    PROVIDER_OPTIONS.forEach((opt, i) => {
      console.log(`  ${i + 1}. ${opt.label}`);
    });

    const choiceStr = await askQuestion(rl, `\n선택 (1-${PROVIDER_OPTIONS.length}): `);
    const choice = parseInt(choiceStr, 10) - 1;

    if (choice < 0 || choice >= PROVIDER_OPTIONS.length) {
      console.error("❌ 잘못된 선택입니다.");
      return;
    }

    const selected = PROVIDER_OPTIONS[choice];

    const apiKey = await askQuestion(rl, "API Key: ");
    if (!apiKey) {
      console.error("❌ API Key는 필수입니다.");
      return;
    }

    let endpoint: string | undefined;
    if (selected.type === "custom-openai" || selected.type === "custom-anthropic") {
      endpoint = await askQuestion(rl, "엔드포인트 URL: ");
      if (!endpoint) {
        console.error("❌ 커스텀 공급자는 엔드포인트가 필수입니다.");
        return;
      }
    }

    const defaultModelHint = selected.defaultModel ? ` (기본: ${selected.defaultModel})` : "";
    const modelInput = await askQuestion(rl, `모델${defaultModelHint}: `);
    const model = modelInput || selected.defaultModel;

    if (!model) {
      console.error("❌ 모델 이름은 필수입니다.");
      return;
    }

    const nameInput = await askQuestion(rl, `공급자 이름 (기본: ${selected.type}): `);
    const providerName = nameInput || selected.type;

    const providerConfig: ProviderConfig = {
      name: providerName,
      type: selected.type,
      apiKey,
      model,
      isDefault: true,
      ...(endpoint ? { endpoint } : {}),
    };

    await ensureDirectories();

    const config = await loadConfig();
    config.providers = config.providers.filter((p) => p.name !== providerName);
    config.providers.push(providerConfig);
    config.activeProvider = providerName;
    config.baseModel = model;
    await saveConfig(config);

    console.log("\n📦 기본 스킬을 설치합니다...");
    await installDefaultSkills();

    console.log("\n✅ 설정이 완료되었습니다!");
    console.log(`   공급자: ${providerName} (${selected.label})`);
    console.log(`   모델: ${model}`);
    console.log(`   설정 파일: ~/casabot/casabot.json`);
    console.log("\n'casabot' 명령어로 시작하세요.\n");
  } finally {
    rl.close();
  }
}
