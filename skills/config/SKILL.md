---
name: CasAbot Configuration
description: Manual for understanding CasAbot's structure and configuration
metadata:
  casabot:
    requires:
      bins: [jq]
---

# CasAbot Configuration

This manual explains CasAbot's directory structure, configuration file schema, and provider management methods.

---

## 1. Directory Structure

All CasAbot data is stored under `~/casabot/`.

```
~/casabot/
├── casabot.json          # All settings (providers, models, etc.)
├── skills/               # Skills directory (contains SKILL.md)
│   ├── agent/            # Agent creation & management
│   ├── config/           # Configuration management (this document)
│   ├── chat/             # Conversation management
│   ├── service/          # System service registration
│   ├── memory/           # Memory (memo) management
│   └── subskills/        # Sub-agent skill attachment and management
├── workspaces/           # Per-agent workspaces
│   └── <agent-name>/     # Individual agent working directory
│       └── output/       # Agent output results
├── history/              # Full conversation logs (raw logs, JSON)
└── memory/               # Agent-written memos (.md)
```

### Role of Each Directory

| Directory | Description | Format |
|-----------|-------------|--------|
| `casabot.json` | Provider settings, active model, and all configuration | JSON |
| `skills/` | Skill manuals referenced by the base agent | SKILL.md (YAML + Markdown) |
| `workspaces/` | Working spaces mounted to sub-agent containers | Free format |
| `history/` | Auto-saved conversation logs (read-only) | JSON |
| `memory/` | Memos written directly by agents | Markdown |

## 2. casabot.json Schema

Full structure of the configuration file.

```json
{
  "providers": [
    {
      "name": "provider name (unique identifier)",
      "type": "openai | anthropic | huggingface | openrouter | custom-openai | custom-anthropic",
      "apiKey": "API key",
      "endpoint": "custom endpoint URL (optional, required for custom-* types)",
      "model": "model name",
      "isDefault": true
    }
  ],
  "activeProvider": "name of the currently active provider",
  "baseModel": "base model name"
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `providers` | array | ✅ | List of registered providers |
| `providers[].name` | string | ✅ | Unique name of the provider |
| `providers[].type` | string | ✅ | Provider type (see supported types below) |
| `providers[].apiKey` | string | ✅ | API key for the provider |
| `providers[].endpoint` | string | ❌ | Custom endpoint (required for custom-openai, custom-anthropic) |
| `providers[].model` | string | ✅ | Model name to use |
| `providers[].isDefault` | boolean | ✅ | Whether this is the default provider |
| `activeProvider` | string | ✅ | Name value of the currently active provider |
| `baseModel` | string | ✅ | Model used by the base agent |

### Supported Provider Types

- `openai` — OpenAI API (GPT series)
- `anthropic` — Anthropic API (Claude series)
- `huggingface` — Hugging Face Inference API
- `openrouter` — OpenRouter unified API
- `custom-openai` — OpenAI-compatible custom endpoint
- `custom-anthropic` — Anthropic-compatible custom endpoint

## 3. Adding a Provider

> **Important:** Always read `~/casabot/casabot.json` first to check current settings. Ask the user which provider type, model name, and API key to use — do not assume or hardcode these values.

Add a new entry to the `providers` array in casabot.json.

```bash
# Add a new provider (using jq)
cat ~/casabot/casabot.json | jq '.providers += [{
  "name": "<provider-name>",
  "type": "<provider-type>",
  "apiKey": "<api-key>",
  "model": "<model-name>",
  "isDefault": false
}]' > /tmp/casabot.json && mv /tmp/casabot.json ~/casabot/casabot.json
```

### Adding a custom provider example

```bash
cat ~/casabot/casabot.json | jq '.providers += [{
  "name": "<provider-name>",
  "type": "<provider-type>",
  "apiKey": "<api-key>",
  "endpoint": "<endpoint-url>",
  "model": "<model-name>",
  "isDefault": false
}]' > /tmp/casabot.json && mv /tmp/casabot.json ~/casabot/casabot.json
```

## 4. Changing Active Provider

Change the currently active provider.

```bash
# Change activeProvider
cat ~/casabot/casabot.json | jq '.activeProvider = "<provider-name>"' > /tmp/casabot.json && mv /tmp/casabot.json ~/casabot/casabot.json
```

### Also change baseModel

```bash
cat ~/casabot/casabot.json | jq '
  .activeProvider = "<provider-name>" |
  .baseModel = "<model-name>"
' > /tmp/casabot.json && mv /tmp/casabot.json ~/casabot/casabot.json
```

## 5. Check Current Configuration

```bash
# View full configuration
cat ~/casabot/casabot.json | jq .

# Check active provider only
cat ~/casabot/casabot.json | jq '.activeProvider'

# List registered providers
cat ~/casabot/casabot.json | jq '.providers[] | {name, type, model}'
```

## 6. Remove a Provider

```bash
# Remove provider by name
cat ~/casabot/casabot.json | jq '.providers = [.providers[] | select(.name != "name-to-delete")]' > /tmp/casabot.json && mv /tmp/casabot.json ~/casabot/casabot.json
```

## 7. Reset Configuration

To reset all configuration, run the `casabot setup` command again.

```bash
casabot setup
```

Or reset the configuration file directly:

```bash
echo '{"providers":[],"activeProvider":"","baseModel":""}' > ~/casabot/casabot.json
```
