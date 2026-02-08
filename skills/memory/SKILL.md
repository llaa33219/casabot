---
name: 기록
description: base와 서브에이전트가 기록(memory)을 작성하고 조회하기 위한 매뉴얼
metadata:
  casabot:
    requires:
      bins: []
---

# 기록 (Memory)

이 매뉴얼은 기억(History)과 기록(Memory)의 차이를 설명하고, 에이전트가 메모를 작성하고 조회하는 방법을 안내합니다.

---

## 1. 기억(History)과 기록(Memory)의 차이

CasAbot에는 두 가지 저장소가 있습니다. 반드시 구분하여 사용하세요.

### 기억 (History) — 대화 로그

| 항목 | 설명 |
|------|------|
| **경로** | `~/casabot/history/` |
| **형식** | JSON |
| **작성자** | 시스템 (자동 저장) |
| **수정 가능** | ❌ 수정 불가 |
| **용도** | 대화 전체의 원본 기록 |
| **내용** | 사용자 입력, 에이전트 응답, 도구 호출 결과 등 |

### 기록 (Memory) — 에이전트 메모

| 항목 | 설명 |
|------|------|
| **경로** | `~/casabot/memory/` |
| **형식** | Markdown (.md) |
| **작성자** | 에이전트 (직접 작성) |
| **수정 가능** | ✅ 자유롭게 수정 가능 |
| **용도** | 중요한 정보, 학습 내용, 분석 결과 등을 기록 |
| **내용** | 에이전트가 기억해야 할 사항 |

### 핵심 원칙

- **History는 절대 수정하지 않습니다.** 원본 대화 로그로서 보존됩니다.
- **Memory는 에이전트가 자유롭게 작성·수정·삭제합니다.** 중요한 정보를 정리하는 공간입니다.
- 대화에서 중요한 내용이 나오면, 그 내용을 Memory에 기록하세요.

## 2. 기록 파일 위치

```
~/casabot/memory/
├── 2024-01-15-프로젝트-분석.md
├── 2024-01-16-서버-설정.md
├── 사용자-선호도.md
├── 자주-사용하는-명령어.md
└── ...
```

## 3. 기록 작성 규칙

### 파일명 규칙

- **날짜 포함 (권장)**: `YYYY-MM-DD-주제.md` — 특정 시점의 기록
- **날짜 미포함**: `주제.md` — 지속적으로 업데이트되는 기록
- 한글, 영문, 숫자, 하이픈(`-`) 사용
- 공백 대신 하이픈 사용

### 파일 형식

모든 기록은 마크다운(.md) 형식으로 작성합니다.

### 기록 내용 구조 (권장)

```markdown
# 제목

- **작성자**: 에이전트 이름
- **날짜**: YYYY-MM-DD
- **태그**: #키워드1 #키워드2

## 요약
핵심 내용 한두 줄 요약

## 상세
자세한 내용...

## 관련 항목
- 관련 기록 파일명
- 관련 대화 ID
```

### 기록 작성 예시

```bash
cat > ~/casabot/memory/2024-01-15-프로젝트-분석.md << 'EOF'
# 프로젝트 분석 결과

- **작성자**: code-reviewer
- **날짜**: 2024-01-15
- **태그**: #프로젝트 #코드분석

## 요약
사용자의 Node.js 프로젝트를 분석한 결과, Express 기반 REST API 서버이며 TypeScript를 사용합니다.

## 상세
- 프레임워크: Express 4.18
- 언어: TypeScript 5.3
- 데이터베이스: PostgreSQL (Prisma ORM)
- 테스트: Jest
- 주요 엔드포인트: /api/users, /api/posts, /api/auth

## 개선 제안
1. 에러 핸들링 미들웨어 추가
2. 환경변수 검증 로직 추가
3. API 문서화 (Swagger)
EOF
```

### 기록 업데이트 예시

지속적인 기록은 내용을 추가하거나 수정합니다:

```bash
# 기존 기록에 내용 추가
cat >> ~/casabot/memory/사용자-선호도.md << 'EOF'

## 2024-01-16 추가
- 코드 스타일: ESLint + Prettier 선호
- 커밋 메시지: Conventional Commits 형식 선호
EOF
```

## 4. 기록 조회 및 검색

### 전체 기록 목록

```bash
# 최신순으로 기록 목록
ls -lt ~/casabot/memory/

# 파일명만 목록
ls ~/casabot/memory/
```

### 키워드 검색

```bash
# 전체 기록에서 키워드 검색
grep -rl "검색어" ~/casabot/memory/

# 검색 결과와 함께 맥락 보기 (앞뒤 2줄 포함)
grep -rn -C 2 "검색어" ~/casabot/memory/
```

### 태그 검색

```bash
# 태그로 기록 찾기
grep -rl "#프로젝트" ~/casabot/memory/
grep -rl "#코드분석" ~/casabot/memory/
```

### 특정 기록 읽기

```bash
# 기록 전체 읽기
cat ~/casabot/memory/<filename>.md

# 제목(h1)만 모아보기
grep "^# " ~/casabot/memory/*.md
```

### 날짜별 검색

```bash
# 특정 날짜 이후 수정된 기록
find ~/casabot/memory/ -name "*.md" -newermt "2024-01-15" -type f

# 최근 7일 내 수정된 기록
find ~/casabot/memory/ -name "*.md" -mtime -7 -type f

# 파일명에 날짜가 포함된 기록 검색
ls ~/casabot/memory/2024-01-*.md 2>/dev/null
```

### 작성자별 검색

```bash
# 특정 에이전트가 작성한 기록
grep -rl "작성자.*code-reviewer" ~/casabot/memory/
```

## 5. 기록 관리

### 기록 삭제

```bash
rm ~/casabot/memory/<filename>.md
```

### 기록 백업

```bash
# 전체 기록 백업
tar czf ~/casabot-memory-backup-$(date +%Y%m%d).tar.gz ~/casabot/memory/
```

### 오래된 기록 아카이브

```bash
# 아카이브 디렉토리 생성
mkdir -p ~/casabot/memory/archive

# 30일 이상 된 기록 이동
find ~/casabot/memory/ -maxdepth 1 -name "*.md" -mtime +30 -exec mv {} ~/casabot/memory/archive/ \;
```

## 6. 서브에이전트의 기록 작성

서브에이전트도 동일한 `~/casabot/memory/` 디렉토리에 기록을 작성할 수 있습니다. 컨테이너에 memory 디렉토리를 마운트합니다:

```bash
podman run -d \
  --name <agent-name> \
  --label casabot=true \
  -v ~/casabot/workspaces/<agent-name>:/workspace \
  -v ~/casabot/skills:/skills:ro \
  -v ~/casabot/memory:/memory \
  node:20-slim sleep infinity
```

서브에이전트 내부에서:

```bash
# 기록 작성
cat > /memory/2024-01-15-분석결과.md << 'EOF'
# 분석 결과
- **작성자**: <agent-name>
...
EOF

# 기록 조회
ls /memory/
cat /memory/<filename>.md
```
