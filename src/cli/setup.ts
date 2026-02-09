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
  { label: "OpenAI", type: "openai", defaultModel: "gpt-5.2-codex" },
  { label: "Anthropic", type: "anthropic", defaultModel: "claude-opus-4-6" },
  { label: "Hugging Face", type: "huggingface", defaultModel: "" },
  { label: "OpenRouter", type: "openrouter", defaultModel: "" },
  { label: "Custom (OpenAI compatible)", type: "custom-openai", defaultModel: "" },
  { label: "Custom (Anthropic compatible)", type: "custom-anthropic", defaultModel: "" },
];

async function installDefaultSkills(): Promise<void> {
  const defaultSkills: Record<string, { name: string; description: string; content: string }> = {
    agent: {
      name: "Agent Creation & Management",
      description: "Manual for base to create and manage sub-agents",
      content: `# Agent Creation & Management

## Install podman
\`\`\`bash
# Check installation
which podman || sudo apt install -y podman
\`\`\`

## Configure podman storage
\`\`\`bash
# Check storage path
podman info --format '{{.Store.GraphRoot}}'
\`\`\`

## Create sub-agent container
\`\`\`bash
# Create a new agent container
podman run -d --name <agent-name> \\
  -v ~/casabot/workspaces/<agent-name>:/workspace \\
  -v ~/casabot/skills:/skills:ro \\
  node:20-slim sleep infinity

# Copy and run agent script
podman cp <script-path> <agent-name>:/workspace/agent.js
podman exec <agent-name> node /workspace/agent.js
\`\`\`

## Pass provider settings

> **Important:** Read the current provider settings from \`~/casabot/casabot.json\` or ask the user for the provider type, API key, and model name. Do not hardcode these values.

\`\`\`bash
# Pass API key via environment variables
podman exec -e PROVIDER_TYPE=<provider-type> -e API_KEY=<key> -e MODEL=<model> <agent-name> node /workspace/agent.js
\`\`\`

## Pass skills
Mount with \`-v ~/casabot/skills:/skills:ro\` when creating the container so the agent can read skills.

## List agents
\`\`\`bash
podman ps --filter "label=casabot" --format "{{.Names}}\\t{{.Status}}"
\`\`\`

## Destroy and clean up agents
\`\`\`bash
podman stop <agent-name> && podman rm <agent-name>
# To also clean up the workspace:
rm -rf ~/casabot/workspaces/<agent-name>
\`\`\`

## Delegate tasks
\`\`\`bash
# Pass task to agent (via stdin)
echo "<task-description>" | podman exec -i <agent-name> node /workspace/agent.js
\`\`\`

## Collect results
\`\`\`bash
# Check agent output
podman logs <agent-name>
# Check workspace result files
ls ~/casabot/workspaces/<agent-name>/output/
\`\`\``,
    },
    config: {
      name: "CasAbot Configuration",
      description: "Manual for understanding CasAbot's structure and configuration",
      content: `# CasAbot Configuration

## Directory Structure
\`\`\`
~/casabot/
├── casabot.json          # All settings
├── skills/               # Skills directory (contains SKILL.md)
│   ├── agent/
│   ├── config/
│   ├── chat/
│   ├── service/
│   └── memory/
├── workspaces/           # Per-agent workspaces
├── history/              # Full conversation logs (raw logs)
└── memory/               # Agent-written memos (.md)
\`\`\`

## casabot.json Schema
\`\`\`json
{
  "providers": [
    {
      "name": "provider name",
      "type": "openai | anthropic | huggingface | openrouter | custom-openai | custom-anthropic",
      "apiKey": "API key",
      "endpoint": "custom endpoint (optional)",
      "model": "model name",
      "isDefault": true
    }
  ],
  "activeProvider": "active provider name",
  "baseModel": "base model name"
}
\`\`\`

## Adding a Provider

> **Important:** Read \`~/casabot/casabot.json\` to check the current provider and model settings before making changes. Ask the user which provider, model, and API key to use if not specified.

Add a new entry to the providers array in casabot.json:
\`\`\`bash
# Edit casabot.json
cat ~/casabot/casabot.json | jq '.providers += [{"name":"<provider-name>","type":"<provider-type>","apiKey":"<api-key>","model":"<model-name>","isDefault":false}]' > /tmp/casabot.json && mv /tmp/casabot.json ~/casabot/casabot.json
\`\`\`

## Changing Provider
Change the activeProvider value:
\`\`\`bash
cat ~/casabot/casabot.json | jq '.activeProvider = "<provider-name>"' > /tmp/casabot.json && mv /tmp/casabot.json ~/casabot/casabot.json
\`\`\``,
    },
    chat: {
      name: "Conversation Management",
      description: "Manual for managing conversation sessions and integrating with external services",
      content: `# Conversation Management

## Session Management
Conversation logs are stored as JSON files in ~/casabot/history/.

## Loading Conversations
\`\`\`bash
# Recent conversation list
ls -lt ~/casabot/history/ | head -20

# View specific conversation
cat ~/casabot/history/<conversation-id>.json | jq '.messages[] | {role, content: .content[:100]}'
\`\`\`

## Searching Previous Conversations
\`\`\`bash
# Search conversations by keyword
grep -rl "keyword" ~/casabot/history/

# Find conversations after a specific date
find ~/casabot/history/ -newer <date-reference-file> -name "*.json"
\`\`\`

## External Service Integration
Integration with external services (WhatsApp, Discord, etc.) is handled through sub-agents:
1. Create an integration sub-agent (see agent skill)
2. Set up the service's API/bot
3. When a message is received, forward it to base and send the response back to the service`,
    },
    service: {
      name: "System Service Registration",
      description: "Manual for configuring auto-start and service integration",
      content: `# System Service Registration

## Auto-start base (systemd)
\`\`\`bash
# Create systemd service file
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

# Enable and start service
systemctl --user daemon-reload
systemctl --user enable casabot
systemctl --user start casabot
\`\`\`

## Check service status
\`\`\`bash
systemctl --user status casabot
journalctl --user -u casabot -f
\`\`\`

## Auto-start specific agents
Add the \`--restart=always\` option to agent containers:
\`\`\`bash
podman run -d --restart=always --name <agent-name> ...
\`\`\`

## Automate external service integration
Use cron or systemd timers to set up periodic tasks:
\`\`\`bash
# Edit crontab
crontab -e
# Run monitoring agent every 5 minutes
*/5 * * * * podman exec monitor node /workspace/check.js
\`\`\``,
    },
    memory: {
      name: "Memory",
      description: "Manual for base and sub-agents to write and query memory",
      content: `# Memory

## Difference between History and Memory
- **History**: ~/casabot/history/ — Raw logs of entire conversations (auto-saved, read-only)
- **Memory**: ~/casabot/memory/ — Memos written directly by agents (.md files)

## Memory file location
~/casabot/memory/

## Writing rules
- File format: Markdown (.md)
- Filename: \`YYYY-MM-DD-topic.md\` or \`topic.md\`
- Content: Free format, but ideally includes:
  - Date/time
  - Author (which agent wrote it)
  - Summary
  - Details

### Writing example
\`\`\`bash
cat > ~/casabot/memory/2024-01-15-project-analysis.md << 'EOF'
# Project Analysis Results
- Author: code-reviewer
- Date: 2024-01-15

## Summary
Analysis results of the user's project code...

## Details
...
EOF
\`\`\`

## Querying and searching memory
\`\`\`bash
# List all memory files
ls -lt ~/casabot/memory/

# Search by keyword
grep -rl "keyword" ~/casabot/memory/

# Read specific memory file
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
    console.log("\n🌟 Starting CasAbot setup.\n");

    console.log("Select a provider:");
    PROVIDER_OPTIONS.forEach((opt, i) => {
      console.log(`  ${i + 1}. ${opt.label}`);
    });

    const choiceStr = await askQuestion(rl, `\nChoice (1-${PROVIDER_OPTIONS.length}): `);
    const choice = parseInt(choiceStr, 10) - 1;

    if (choice < 0 || choice >= PROVIDER_OPTIONS.length) {
      console.error("❌ Invalid selection.");
      return;
    }

    const selected = PROVIDER_OPTIONS[choice];

    const apiKey = await askQuestion(rl, "API Key: ");
    if (!apiKey) {
      console.error("❌ API Key is required.");
      return;
    }

    let endpoint: string | undefined;
    if (selected.type === "custom-openai" || selected.type === "custom-anthropic") {
      endpoint = await askQuestion(rl, "Endpoint URL: ");
      if (!endpoint) {
        console.error("❌ Custom providers require an endpoint.");
        return;
      }
    }

    const defaultModelHint = selected.defaultModel ? ` (default: ${selected.defaultModel})` : "";
    const modelInput = await askQuestion(rl, `Model${defaultModelHint}: `);
    const model = modelInput || selected.defaultModel;

    if (!model) {
      console.error("❌ Model name is required.");
      return;
    }

    const nameInput = await askQuestion(rl, `Provider name (default: ${selected.type}): `);
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

    console.log("\n📦 Installing default skills...");
    await installDefaultSkills();

    console.log("\n✅ Setup complete!");
    console.log(`   Provider: ${providerName} (${selected.label})`);
    console.log(`   Model: ${model}`);
    console.log(`   Config file: ~/casabot/casabot.json`);
    console.log("\nRun 'casabot' to get started.\n");
  } finally {
    rl.close();
  }
}
