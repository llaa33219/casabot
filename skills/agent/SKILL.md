---
name: Agent Creation & Management
description: Manual for base to create and manage sub-agents
metadata:
  casabot:
    requires:
      bins: [podman]
---

# Agent Creation & Management

This manual explains how the base agent creates and manages podman-based sub-agents.

---

## 1. Install podman

podman must be installed before creating sub-agents.

```bash
# Check installation
which podman

# If not installed (Debian/Ubuntu)
sudo apt update && sudo apt install -y podman

# If not installed (Fedora/RHEL)
sudo dnf install -y podman
```

## 2. Configure podman storage

Check the path where container images and layers are stored, and verify sufficient disk space.

```bash
# Check storage path
podman info --format '{{.Store.GraphRoot}}'

# Check disk usage
df -h $(podman info --format '{{.Store.GraphRoot}}')
```

If space is insufficient, change `graphroot` in `~/.config/containers/storage.conf`.

## 3. Create sub-agent container

All sub-agent containers must be assigned the `casabot` label.

```bash
# Create a new agent container
podman run -d \
  --name <agent-name> \
  --label casabot=true \
  -v ~/casabot/workspaces/<agent-name>:/workspace \
  -v ~/casabot/skills:/skills:ro \
  node:20-slim sleep infinity
```

### Required rules
- `--label casabot=true`: Used to identify all CasAbot sub-agents.
- `-v ~/casabot/workspaces/<agent-name>:/workspace`: Mounts a dedicated workspace for each agent.
- `-v ~/casabot/skills:/skills:ro`: Shares the skills directory as read-only.

After creating the container, copy and run the agent script:

```bash
podman cp <script-path> <agent-name>:/workspace/agent.js
podman exec <agent-name> node /workspace/agent.js
```

## 4. Pass provider settings

> **Important:** Read the current provider settings from `~/casabot/casabot.json` or ask the user for the provider type, API key, and model name. Do not hardcode these values.

Pass LLM provider information to sub-agents via environment variables.

```bash
# Pass API key and model via environment variables
podman exec \
  -e PROVIDER_TYPE=<provider-type> \
  -e API_KEY=<key> \
  -e MODEL=<model> \
  -e ENDPOINT=<endpoint> \
  <agent-name> node /workspace/agent.js
```

Or set them in advance with `-e` options when creating the container:

```bash
podman run -d \
  --name <agent-name> \
  --label casabot=true \
  -e PROVIDER_TYPE=<provider-type> \
  -e API_KEY=<key> \
  -e MODEL=<model> \
  -v ~/casabot/workspaces/<agent-name>:/workspace \
  -v ~/casabot/skills:/skills:ro \
  node:20-slim sleep infinity
```

## 5. Pass skills

Mount with `-v ~/casabot/skills:/skills:ro` when creating the container so sub-agents can read skill documents.

How to read skills inside a sub-agent:

```bash
# Inside the container
cat /skills/agent/SKILL.md
cat /skills/memory/SKILL.md
ls /skills/
```

## 6. List agents

Query all containers with the `casabot` label.

```bash
# List running agents
podman ps --filter "label=casabot" --format "{{.Names}}\t{{.Status}}"

# All agents (including stopped)
podman ps -a --filter "label=casabot" --format "table {{.Names}}\t{{.Status}}\t{{.Created}}"
```

## 7. Destroy and clean up agents

Clean up agents that are no longer needed.

```bash
# Stop and remove container
podman stop <agent-name> && podman rm <agent-name>

# To also clean up the workspace
rm -rf ~/casabot/workspaces/<agent-name>
```

### Bulk cleanup

```bash
# Stop and remove all CasAbot agents
podman ps -a --filter "label=casabot" --format "{{.Names}}" | xargs -r podman stop
podman ps -a --filter "label=casabot" --format "{{.Names}}" | xargs -r podman rm
```

## 8. Delegate tasks

How to pass tasks to sub-agents.

```bash
# Pass task via stdin
echo "<task-description>" | podman exec -i <agent-name> node /workspace/agent.js

# Pass task via file
echo "<task-description>" > ~/casabot/workspaces/<agent-name>/task.txt
podman exec <agent-name> node /workspace/agent.js --task /workspace/task.txt
```

### Delegation principles
- base is an orchestrator. Delegate actual work to sub-agents.
- If no suitable sub-agent exists, create a new one and delegate.
- Write task descriptions clearly and specifically.

## 9. Collect results

Check the results of sub-agent work.

```bash
# Check agent logs
podman logs <agent-name>

# Check recent logs only
podman logs --tail 50 <agent-name>

# Check workspace output files
ls ~/casabot/workspaces/<agent-name>/output/

# Read result file contents
cat ~/casabot/workspaces/<agent-name>/output/result.txt
```

After collecting results, summarize and report to the user.
