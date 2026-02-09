---
name: Conversation Management
description: Manual for managing conversation sessions and integrating with external services
metadata:
  casabot:
    requires:
      bins: []
---

# Conversation Management

This manual explains how to create, view, and search conversation sessions, and how to integrate with external services.

---

## 1. Session Management

### Session Structure

Each conversation session is automatically saved as a JSON file in the `~/casabot/history/` directory.

```json
{
  "id": "unique session ID",
  "startedAt": "2024-01-15T09:30:00.000Z",
  "messages": [
    {
      "role": "user | assistant | system | tool",
      "content": "message content",
      "toolCalls": [],
      "toolCallId": ""
    }
  ]
}
```

### Session Lifecycle
- **Creation**: A new session is automatically created when you run the `casabot` command.
- **Persistence**: Messages are automatically appended as the conversation progresses.
- **Termination**: The session closes when the program exits.
- **Preservation**: Logs are permanently preserved in the history directory after termination.

## 2. Loading Conversations

### View recent conversation list

```bash
# Recent 20 conversations (newest first)
ls -lt ~/casabot/history/ | head -20

# Check filenames and sizes
ls -lhS ~/casabot/history/
```

### View specific conversation

```bash
# View full conversation (formatted)
cat ~/casabot/history/<conversation-id>.json | jq '.messages[] | {role, content: .content[:100]}'

# View only user messages
cat ~/casabot/history/<conversation-id>.json | jq '.messages[] | select(.role == "user") | .content'

# View only assistant responses
cat ~/casabot/history/<conversation-id>.json | jq '.messages[] | select(.role == "assistant") | .content'
```

### Check session metadata

```bash
# Session ID and start time
cat ~/casabot/history/<conversation-id>.json | jq '{id, startedAt, messageCount: (.messages | length)}'
```

## 3. Searching Previous Conversations

### Search by keyword

```bash
# Search all conversations for a keyword
grep -rl "keyword" ~/casabot/history/

# View context of conversations containing the keyword
grep -l "keyword" ~/casabot/history/*.json | while read f; do
  echo "=== $(basename $f) ==="
  cat "$f" | jq '.messages[] | select(.content | contains("keyword")) | {role, content: .content[:200]}'
done
```

### Search by date

```bash
# Conversations after a specific date
find ~/casabot/history/ -name "*.json" -newermt "2024-01-15" -type f

# Today's conversations only
find ~/casabot/history/ -name "*.json" -newermt "$(date +%Y-%m-%d)" -type f

# Conversations from the last 7 days
find ~/casabot/history/ -name "*.json" -mtime -7 -type f
```

### Search by role

```bash
# Find conversations with tool calls
grep -rl "toolCalls" ~/casabot/history/ | head -10

# Find conversations where a specific tool was used
grep -rl "run_command" ~/casabot/history/
```

## 4. Conversation Statistics

```bash
# Total number of conversations
ls ~/casabot/history/*.json 2>/dev/null | wc -l

# Longest conversations (by message count)
for f in ~/casabot/history/*.json; do
  echo "$(cat "$f" | jq '.messages | length') $(basename $f)"
done | sort -rn | head -10
```

## 5. External Service Integration

CasAbot can be used through integration with external messaging services (WhatsApp, Discord, Telegram, Slack, etc.).

### Integration Architecture

```
External Service → [Integration Sub-Agent] → base agent → [Task Sub-Agents]
                                               ↓
                                         Response to user
```

### Integration Setup Steps

1. **Create integration sub-agent** — Refer to the `agent` skill to create a dedicated integration container.
2. **Configure service API/bot** — Set up the bot token or webhook URL for the target service.
3. **Receive messages** — When a message is received from the service, forward it to base.
4. **Send responses** — Send base's response back to the service.

### Example: Webhook-based integration

```bash
# Create integration agent (see agent skill)
podman run -d \
  --name webhook-bridge \
  --label casabot=true \
  -p 8080:8080 \
  -v ~/casabot/workspaces/webhook-bridge:/workspace \
  -v ~/casabot/skills:/skills:ro \
  node:20-slim sleep infinity

# Deploy webhook server script to agent
podman cp webhook-server.js webhook-bridge:/workspace/
podman exec -d webhook-bridge node /workspace/webhook-server.js
```

## 6. Important Notes

- **Do not modify history files**: Files in `~/casabot/history/` are raw logs. If you need modifications, create a separate copy.
- **Use memory for notes**: If you need to record important information from conversations, refer to the `memory` skill.
- **Managing large volumes of history**: If logs accumulate, archive or compress older files.
