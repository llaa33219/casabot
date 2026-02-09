---
name: System Service Registration
description: Manual for configuring auto-start and service integration
metadata:
  casabot:
    requires:
      bins: [systemctl]
---

# System Service Registration

This manual explains how to register CasAbot as a systemd service, configure automatic agent restart, and set up cron scheduling.

---

## 1. Auto-start base (systemd user service)

Registering the CasAbot base agent as a systemd user service will automatically start it on login.

### Create service file

```bash
# Create directory
mkdir -p ~/.config/systemd/user

# Write service file
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
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF
```

### Enable and start service

```bash
# Reload daemon
systemctl --user daemon-reload

# Enable service (auto-start on boot)
systemctl --user enable casabot

# Start service
systemctl --user start casabot
```

### Keep service running without login

By default, user services are stopped when there is no login session. To keep them always running:

```bash
# Enable lingering (keep service running after logout)
loginctl enable-linger $(whoami)
```

## 2. Check and manage service status

```bash
# Check status
systemctl --user status casabot

# View real-time logs
journalctl --user -u casabot -f

# View last 100 log lines
journalctl --user -u casabot -n 100

# View today's logs only
journalctl --user -u casabot --since today

# Restart service
systemctl --user restart casabot

# Stop service
systemctl --user stop casabot

# Disable service (disable auto-start)
systemctl --user disable casabot
```

## 3. Auto-restart sub-agents

Use podman container's `--restart` option to configure automatic restart for sub-agents.

### Set at container creation

```bash
# Always restart (until manually stopped)
podman run -d \
  --restart=always \
  --name <agent-name> \
  --label casabot=true \
  -v ~/casabot/workspaces/<agent-name>:/workspace \
  -v ~/casabot/skills:/skills:ro \
  node:20-slim sleep infinity
```

### Restart policy options

| Option | Description |
|--------|-------------|
| `no` | Do not restart (default) |
| `on-failure` | Restart only on abnormal exit |
| `always` | Always restart (except manual stop) |
| `unless-stopped` | Always restart until manually stopped |

### Change restart policy for existing containers

```bash
podman update --restart=always <agent-name>
```

### Register sub-agent as systemd service

You can also register specific sub-agents as individual systemd services:

```bash
# Auto-generate systemd service file from podman
podman generate systemd --name <agent-name> --new > \
  ~/.config/systemd/user/casabot-<agent-name>.service

systemctl --user daemon-reload
systemctl --user enable casabot-<agent-name>
systemctl --user start casabot-<agent-name>
```

## 4. Cron Scheduling

Use cron or systemd timers for tasks that need to run periodically.

### Periodic tasks with cron

```bash
# Edit crontab
crontab -e
```

#### Example: Run monitoring agent periodically

```cron
# Run monitoring agent every 5 minutes
*/5 * * * * podman exec monitor node /workspace/check.js >> ~/casabot/workspaces/monitor/cron.log 2>&1

# Run cleanup task daily at midnight
0 0 * * * podman exec cleaner node /workspace/cleanup.js >> ~/casabot/workspaces/cleaner/cron.log 2>&1

# Generate weekly report every Monday at 9 AM
0 9 * * 1 podman exec reporter node /workspace/weekly-report.js >> ~/casabot/workspaces/reporter/cron.log 2>&1
```

### Periodic tasks with systemd timer

Using systemd timers instead of cron makes log management more convenient.

```bash
# Create timer service file
cat > ~/.config/systemd/user/casabot-monitor.service << 'EOF'
[Unit]
Description=CasAbot Monitor Check

[Service]
Type=oneshot
ExecStart=/usr/bin/podman exec monitor node /workspace/check.js
EOF

# Create timer file
cat > ~/.config/systemd/user/casabot-monitor.timer << 'EOF'
[Unit]
Description=CasAbot Monitor Timer

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Enable timer
systemctl --user daemon-reload
systemctl --user enable casabot-monitor.timer
systemctl --user start casabot-monitor.timer
```

### Check timer status

```bash
# List active timers
systemctl --user list-timers

# Check specific timer status
systemctl --user status casabot-monitor.timer
```

## 5. Troubleshooting

### Service won't start

```bash
# Check detailed logs
journalctl --user -u casabot -n 50 --no-pager

# Validate service file syntax
systemd-analyze verify ~/.config/systemd/user/casabot.service
```

### After modifying service files

```bash
# Always run daemon-reload after changes
systemctl --user daemon-reload
systemctl --user restart casabot
```
