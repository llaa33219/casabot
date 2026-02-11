---
name: Sub-Agent Skills (subskills)
description: Manual for attaching and managing skills available to sub-agents
metadata:
  casabot:
    requires:
      bins: []
---

# Sub-Agent Skills (subskills)

This manual explains the `/subskills` directory mechanism — a way to attach, discover, and manage skill documents that sub-agents can use.

---

## 1. What is /subskills?

Each skill directory under `~/casabot/skills/` can contain a `/subskills` subdirectory. This subdirectory holds skill documents intended for sub-agents rather than the base agent.

```
~/casabot/skills/
├── agent/
│   ├── SKILL.md
│   └── subskills/          ← Skills for sub-agents in this domain
│       ├── python-dev/
│       │   └── SKILL.md
│       └── web-scraper/
│           └── SKILL.md
├── memory/
│   ├── SKILL.md
│   └── subskills/
│       └── vector-search/
│           └── SKILL.md
└── subskills/
    └── SKILL.md             ← This document
```

### Key Concepts

- **Base skills** (`SKILL.md` at the skill root) are read by the base agent.
- **Subskills** (`subskills/<name>/SKILL.md`) are passed to sub-agents when they are created or delegated tasks.
- Subskill documents follow the same format as regular skills (YAML frontmatter + Markdown body).

## 2. Who can add subskills?

### Agent-driven discovery

The base agent (or a sub-agent) can search for relevant tools, libraries, or techniques and write a new subskill document based on the findings.

```bash
# Create a subskill directory
mkdir -p ~/casabot/skills/agent/subskills/python-dev

# Write the subskill document
cat > ~/casabot/skills/agent/subskills/python-dev/SKILL.md << 'EOF'
---
name: Python Development
description: Guidelines and tools for Python-based sub-agents
metadata:
  casabot:
    requires:
      bins: [python3, pip]
---

# Python Development

Instructions for sub-agents working on Python projects...
EOF
```

### User-provided subskills

Users can also place skill documents directly into the `/subskills` directory of any skill. This is useful for domain-specific instructions or custom tool configurations that the user wants sub-agents to follow.

```bash
# User manually adds a subskill
mkdir -p ~/casabot/skills/agent/subskills/my-custom-tool
cat > ~/casabot/skills/agent/subskills/my-custom-tool/SKILL.md << 'EOF'
---
name: My Custom Tool
description: Custom tool usage instructions for sub-agents
metadata:
  casabot:
    requires:
      bins: []
---

# My Custom Tool

(Custom instructions for sub-agents...)
EOF
```

## 3. How to pass subskills to sub-agents

When creating or delegating to a sub-agent, mount or copy the relevant subskills into the container.

### Mount the entire subskills directory

```bash
# Mount a specific skill's subskills into the container
podman run -d \
  --name <agent-name> \
  --label casabot=true \
  -v ~/casabot/skills/agent/subskills:/subskills:ro \
  -v ~/casabot/workspaces/<agent-name>:/workspace \
  node:20-slim sleep infinity
```

### Copy specific subskill documents

```bash
# Copy only the relevant subskill into the container
podman cp ~/casabot/skills/agent/subskills/python-dev/SKILL.md \
  <agent-name>:/workspace/skills/python-dev/SKILL.md
```

### Reading subskills inside a sub-agent

```bash
# List available subskills
ls /subskills/

# Read a specific subskill
cat /subskills/python-dev/SKILL.md
```

## 4. Listing and searching subskills

### List all subskills across all skill directories

```bash
find ~/casabot/skills/*/subskills -name "SKILL.md" 2>/dev/null
```

### Search subskills by keyword

```bash
grep -rl "keyword" ~/casabot/skills/*/subskills/ 2>/dev/null
```

### List subskills for a specific skill

```bash
ls ~/casabot/skills/agent/subskills/
```

## 5. Managing subskills

### Remove a subskill

```bash
rm -rf ~/casabot/skills/<skill>/subskills/<subskill-name>
```

### Update a subskill

Simply overwrite the `SKILL.md` file in the subskill directory.

```bash
cat > ~/casabot/skills/<skill>/subskills/<subskill-name>/SKILL.md << 'EOF'
---
name: Updated Skill Name
description: Updated description
metadata:
  casabot:
    requires:
      bins: []
---

# Updated content...
EOF
```

## 6. Subskill Document Format

Subskill documents follow the same structure as regular skill documents:

```yaml
---
name: Subskill Name
description: What this subskill provides to sub-agents
metadata:
  casabot:
    requires:
      bins: []
---

# Subskill Title

(Instructions, examples, and references for sub-agents)
```

## 7. Important Notes

- Subskills are **not** automatically loaded by the base agent. They must be explicitly passed to sub-agents.
- The base agent decides which subskills are relevant for a given task and passes them accordingly.
- Agents are encouraged to search for new tools and techniques and create subskills to expand future capabilities.
- Users can add subskills at any time without restarting CasAbot.
