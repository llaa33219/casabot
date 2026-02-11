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

podman is needed before creating sub-agents.

### Step 1: Check if podman is already installed

```bash
which podman && podman --version
```

If podman is found, skip to Section 2.

### Step 2: Gather system information

Try to detect as much as possible automatically before involving the user.

```bash
# Detect distro
cat /etc/os-release

# Check if sudo is available
sudo -n true 2>/dev/null && echo "sudo: available" || echo "sudo: not available"
```

If auto-detection fails or sudo is unavailable, ask the user for clarification. You may also ask about preferences like rootless mode or custom storage locations if relevant.

### Step 3: Install podman

```bash
# Debian / Ubuntu
sudo apt update && sudo apt install -y podman

# Fedora / RHEL / CentOS
sudo dnf install -y podman

# Arch Linux
sudo pacman -S podman

# openSUSE
sudo zypper install -y podman
```

If rootless mode is desired, configure subuid/subgid:

```bash
sudo usermod --add-subuids 100000-165535 --add-subgids 100000-165535 $(whoami)
podman system migrate
```

### Step 4: Verify installation

```bash
podman --version
podman info
```

Consider using the memory skill to save the detected distro and podman version for future reference.

## 2. Configure podman storage

Check the path where container images and layers are stored, and verify sufficient disk space.

```bash
# Check storage path
podman info --format '{{.Store.GraphRoot}}'

# Check disk usage
df -h $(podman info --format '{{.Store.GraphRoot}}')
```

If space is insufficient, `graphroot` in `~/.config/containers/storage.conf` can be adjusted.

## 3. Create sub-agent container

All sub-agent containers should be assigned the `casabot` label for identification.

```bash
# Create a new agent container
podman run -d \
  --name <agent-name> \
  --label casabot=true \
  -v ~/casabot/workspaces/<agent-name>:/workspace \
  -v ~/casabot/skills:/skills:ro \
  node:20-slim sleep infinity
```

### Recommended conventions
- `--label casabot=true`: Used to identify all CasAbot sub-agents.
- `-v ~/casabot/workspaces/<agent-name>:/workspace`: Mounts a dedicated workspace for each agent.
- `-v ~/casabot/skills:/skills:ro`: Shares the skills directory as read-only.

After creating the container, copy and run the agent script:

```bash
podman cp <script-path> <agent-name>:/workspace/agent.js
podman exec <agent-name> node /workspace/agent.js
```

## 4. Pass provider settings

Provider settings can be read from `~/casabot/casabot.json`. If the file is unavailable or incomplete, ask the user for the provider type, API key, and model name.

When sensitive information like API keys is obtained, consider persisting it via the memory skill so it doesn't need to be requested again.

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

Or set them when creating the container:

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

## 6. Pass subskills

Each skill directory can contain a `subskills/` subdirectory with skills specifically intended for sub-agents. When delegating a task, consider checking for relevant subskills to pass along.

> **Note:** The full skills mount (`-v ~/casabot/skills:/skills:ro` from Section 3) already includes all `subskills/` directories. The separate mount shown below is an alternative for providing targeted access to specific subskills.

### Discover available subskills

```bash
# List all subskills across all skill directories
find ~/casabot/skills/*/subskills -name "SKILL.md" 2>/dev/null

# List subskills for a specific skill
ls ~/casabot/skills/agent/subskills/ 2>/dev/null

# Search subskills by keyword
grep -rl "keyword" ~/casabot/skills/*/subskills/ 2>/dev/null
```

### Mount subskills into a sub-agent container

```bash
# Mount a specific skill's subskills
podman run -d \
  --name <agent-name> \
  --label casabot=true \
  -v ~/casabot/skills/agent/subskills:/subskills:ro \
  -v ~/casabot/workspaces/<agent-name>:/workspace \
  node:20-slim sleep infinity
```

Or copy specific subskill documents:

```bash
podman cp ~/casabot/skills/agent/subskills/python-dev/SKILL.md \
  <agent-name>:/workspace/skills/python-dev/SKILL.md
```

### Create new subskills

If a task requires capabilities not yet covered by existing subskills, the agent can search the web for relevant tools, libraries, or techniques and write a new subskill document.

```bash
mkdir -p ~/casabot/skills/<skill>/subskills/<new-subskill>
cat > ~/casabot/skills/<skill>/subskills/<new-subskill>/SKILL.md << 'EOF'
---
name: New Subskill
description: What this subskill provides
metadata:
  casabot:
    requires:
      bins: []
---

# New Subskill

(Instructions for sub-agents)
EOF
```

Users can also add subskill documents manually at any time. Refer to the `subskills` skill for detailed guidance.

## 7. List agents

Query all containers with the `casabot` label.

```bash
# List running agents
podman ps --filter "label=casabot" --format "{{.Names}}\t{{.Status}}"

# All agents (including stopped)
podman ps -a --filter "label=casabot" --format "table {{.Names}}\t{{.Status}}\t{{.Created}}"
```

## 8. Destroy and clean up agents

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

## 9. Delegate tasks

How to pass tasks to sub-agents.

```bash
# Pass task via stdin
echo "<task-description>" | podman exec -i <agent-name> node /workspace/agent.js

# Pass task via file
echo "<task-description>" > ~/casabot/workspaces/<agent-name>/task.txt
podman exec <agent-name> node /workspace/agent.js --task /workspace/task.txt
```

### Delegation principles
- The base agent is an orchestrator. Actual work is typically delegated to sub-agents.
- If no suitable sub-agent exists, a new one can be created for the task.
- Clear and specific task descriptions tend to produce better results.

## 10. Collect results

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

After collecting results, the findings can be summarized and reported to the user.
