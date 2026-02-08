---
name: 시스템 서비스 등록
description: 자동 시작 및 서비스 연동을 설정하기 위한 매뉴얼
metadata:
  casabot:
    requires:
      bins: [systemctl]
---

# 시스템 서비스 등록

이 매뉴얼은 CasAbot을 systemd 서비스로 등록하고, 에이전트 자동 재시작 및 cron 스케줄링을 설정하는 방법을 설명합니다.

---

## 1. base 자동 시작 (systemd 사용자 서비스)

CasAbot base 에이전트를 systemd 사용자 서비스로 등록하면 로그인 시 자동으로 시작됩니다.

### 서비스 파일 생성

```bash
# 디렉토리 생성
mkdir -p ~/.config/systemd/user

# 서비스 파일 작성
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

### 서비스 활성화 및 시작

```bash
# 데몬 리로드
systemctl --user daemon-reload

# 서비스 활성화 (부팅 시 자동 시작)
systemctl --user enable casabot

# 서비스 시작
systemctl --user start casabot
```

### 로그인 없이도 서비스 유지

기본적으로 사용자 서비스는 로그인 세션이 없으면 종료됩니다. 항상 실행되게 하려면:

```bash
# lingering 활성화 (로그아웃 후에도 서비스 유지)
loginctl enable-linger $(whoami)
```

## 2. 서비스 상태 확인 및 관리

```bash
# 상태 확인
systemctl --user status casabot

# 실시간 로그 보기
journalctl --user -u casabot -f

# 최근 100줄 로그
journalctl --user -u casabot -n 100

# 오늘 로그만
journalctl --user -u casabot --since today

# 서비스 재시작
systemctl --user restart casabot

# 서비스 중지
systemctl --user stop casabot

# 서비스 비활성화 (자동 시작 해제)
systemctl --user disable casabot
```

## 3. 서브에이전트 자동 재시작

podman 컨테이너의 `--restart` 옵션을 사용하여 서브에이전트가 자동으로 재시작되도록 설정합니다.

### 컨테이너 생성 시 설정

```bash
# 항상 재시작 (수동 중지 전까지)
podman run -d \
  --restart=always \
  --name <agent-name> \
  --label casabot=true \
  -v ~/casabot/workspaces/<agent-name>:/workspace \
  -v ~/casabot/skills:/skills:ro \
  node:20-slim sleep infinity
```

### 재시작 정책 옵션

| 옵션 | 설명 |
|------|------|
| `no` | 재시작하지 않음 (기본값) |
| `on-failure` | 비정상 종료 시에만 재시작 |
| `always` | 항상 재시작 (수동 중지 제외) |
| `unless-stopped` | 수동 중지 전까지 항상 재시작 |

### 기존 컨테이너에 재시작 정책 변경

```bash
podman update --restart=always <agent-name>
```

### 서브에이전트를 systemd 서비스로 등록

특정 서브에이전트를 개별 systemd 서비스로 등록할 수도 있습니다:

```bash
# podman에서 systemd 서비스 파일 자동 생성
podman generate systemd --name <agent-name> --new > \
  ~/.config/systemd/user/casabot-<agent-name>.service

systemctl --user daemon-reload
systemctl --user enable casabot-<agent-name>
systemctl --user start casabot-<agent-name>
```

## 4. cron 스케줄링

주기적으로 실행해야 하는 작업은 cron 또는 systemd timer를 사용합니다.

### cron을 사용한 주기적 작업

```bash
# crontab 편집
crontab -e
```

#### 예시: 모니터링 에이전트 주기적 실행

```cron
# 매 5분마다 모니터링 에이전트 실행
*/5 * * * * podman exec monitor node /workspace/check.js >> ~/casabot/workspaces/monitor/cron.log 2>&1

# 매일 자정에 정리 작업 실행
0 0 * * * podman exec cleaner node /workspace/cleanup.js >> ~/casabot/workspaces/cleaner/cron.log 2>&1

# 매주 월요일 오전 9시에 주간 보고서 생성
0 9 * * 1 podman exec reporter node /workspace/weekly-report.js >> ~/casabot/workspaces/reporter/cron.log 2>&1
```

### systemd timer를 사용한 주기적 작업

cron 대신 systemd timer를 사용하면 로그 관리가 더 편리합니다.

```bash
# 타이머 서비스 파일 생성
cat > ~/.config/systemd/user/casabot-monitor.service << 'EOF'
[Unit]
Description=CasAbot Monitor Check

[Service]
Type=oneshot
ExecStart=/usr/bin/podman exec monitor node /workspace/check.js
EOF

# 타이머 파일 생성
cat > ~/.config/systemd/user/casabot-monitor.timer << 'EOF'
[Unit]
Description=CasAbot Monitor Timer

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
EOF

# 타이머 활성화
systemctl --user daemon-reload
systemctl --user enable casabot-monitor.timer
systemctl --user start casabot-monitor.timer
```

### 타이머 상태 확인

```bash
# 활성 타이머 목록
systemctl --user list-timers

# 특정 타이머 상태
systemctl --user status casabot-monitor.timer
```

## 5. 서비스 문제 해결

### 서비스가 시작되지 않을 때

```bash
# 상세 로그 확인
journalctl --user -u casabot -n 50 --no-pager

# 서비스 파일 문법 검증
systemd-analyze verify ~/.config/systemd/user/casabot.service
```

### 서비스 파일 변경 후

```bash
# 반드시 daemon-reload 실행
systemctl --user daemon-reload
systemctl --user restart casabot
```
