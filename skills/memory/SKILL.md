---
name: Memory
description: Manual for base and sub-agents to write and query memory
metadata:
  casabot:
    requires:
      bins: []
---

# Memory

This manual explains the difference between History and Memory, and guides agents on how to write and query memos.

---

## 1. Difference between History and Memory

CasAbot has two storage systems. Make sure to use them correctly.

### History — Conversation Logs

| Item | Description |
|------|-------------|
| **Path** | `~/casabot/history/` |
| **Format** | JSON |
| **Author** | System (auto-saved) |
| **Editable** | ❌ Read-only |
| **Purpose** | Raw logs of entire conversations |
| **Contents** | User input, agent responses, tool call results, etc. |

### Memory — Agent Memos

| Item | Description |
|------|-------------|
| **Path** | `~/casabot/memory/` |
| **Format** | Markdown (.md) |
| **Author** | Agents (written directly) |
| **Editable** | ✅ Freely editable |
| **Purpose** | Record important information, learning outcomes, analysis results, etc. |
| **Contents** | Things agents need to remember |

### Core Principles

- **Never modify History.** It is preserved as the original conversation log.
- **Memory is freely written, modified, and deleted by agents.** It is a space for organizing important information.
- When important information comes up in conversation, record it in Memory.

## 2. Memory File Location

```
~/casabot/memory/
├── 2024-01-15-project-analysis.md
├── 2024-01-16-server-setup.md
├── user-preferences.md
├── frequently-used-commands.md
└── ...
```

## 3. Writing Rules

### Filename Rules

- **With date (recommended)**: `YYYY-MM-DD-topic.md` — Record at a specific point in time
- **Without date**: `topic.md` — Continuously updated record
- Use alphanumeric characters and hyphens (`-`)
- Use hyphens instead of spaces

### File Format

All memory files are written in Markdown (.md) format.

### Recommended Content Structure

```markdown
# Title

- **Author**: agent name
- **Date**: YYYY-MM-DD
- **Tags**: #keyword1 #keyword2

## Summary
One or two line summary of key content

## Details
Detailed content...

## Related Items
- Related memory filenames
- Related conversation IDs
```

### Writing Example

```bash
cat > ~/casabot/memory/2024-01-15-project-analysis.md << 'EOF'
# Project Analysis Results

- **Author**: code-reviewer
- **Date**: 2024-01-15
- **Tags**: #project #code-analysis

## Summary
Analyzed the user's Node.js project. It is an Express-based REST API server using TypeScript.

## Details
- Framework: Express 4.18
- Language: TypeScript 5.3
- Database: PostgreSQL (Prisma ORM)
- Testing: Jest
- Main endpoints: /api/users, /api/posts, /api/auth

## Improvement Suggestions
1. Add error handling middleware
2. Add environment variable validation logic
3. API documentation (Swagger)
EOF
```

### Updating Memory Example

For ongoing records, append or modify content:

```bash
# Append content to existing memory
cat >> ~/casabot/memory/user-preferences.md << 'EOF'

## 2024-01-16 Update
- Code style: Prefers ESLint + Prettier
- Commit messages: Prefers Conventional Commits format
EOF
```

## 4. Querying and Searching Memory

### List all memory files

```bash
# List memory files (newest first)
ls -lt ~/casabot/memory/

# List filenames only
ls ~/casabot/memory/
```

### Search by keyword

```bash
# Search all memory files for a keyword
grep -rl "keyword" ~/casabot/memory/

# View search results with context (2 lines before/after)
grep -rn -C 2 "keyword" ~/casabot/memory/
```

### Search by tag

```bash
# Find memory files by tag
grep -rl "#project" ~/casabot/memory/
grep -rl "#code-analysis" ~/casabot/memory/
```

### Read specific memory

```bash
# Read full memory file
cat ~/casabot/memory/<filename>.md

# View all titles (h1) at a glance
grep "^# " ~/casabot/memory/*.md
```

### Search by date

```bash
# Memory files modified after a specific date
find ~/casabot/memory/ -name "*.md" -newermt "2024-01-15" -type f

# Memory files modified in the last 7 days
find ~/casabot/memory/ -name "*.md" -mtime -7 -type f

# Search memory files with date in filename
ls ~/casabot/memory/2024-01-*.md 2>/dev/null
```

### Search by author

```bash
# Find memory files written by a specific agent
grep -rl "Author.*code-reviewer" ~/casabot/memory/
```

## 5. Memory Management

### Delete memory

```bash
rm ~/casabot/memory/<filename>.md
```

### Backup memory

```bash
# Backup all memory files
tar czf ~/casabot-memory-backup-$(date +%Y%m%d).tar.gz ~/casabot/memory/
```

### Archive old memory

```bash
# Create archive directory
mkdir -p ~/casabot/memory/archive

# Move memory files older than 30 days
find ~/casabot/memory/ -maxdepth 1 -name "*.md" -mtime +30 -exec mv {} ~/casabot/memory/archive/ \;
```

## 6. Sub-agent Memory Writing

Sub-agents can also write memory to the same `~/casabot/memory/` directory. Mount the memory directory to the container:

```bash
podman run -d \
  --name <agent-name> \
  --label casabot=true \
  -v ~/casabot/workspaces/<agent-name>:/workspace \
  -v ~/casabot/skills:/skills:ro \
  -v ~/casabot/memory:/memory \
  node:20-slim sleep infinity
```

Inside the sub-agent:

```bash
# Write memory
cat > /memory/2024-01-15-analysis-results.md << 'EOF'
# Analysis Results
- **Author**: <agent-name>
...
EOF

# Query memory
ls /memory/
cat /memory/<filename>.md
```
