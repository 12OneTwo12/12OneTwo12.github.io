---
title: Git 워크플로우
weight: 2
---

제가 주로 사용하는 Git 브랜치 전략과 커밋 규칙입니다.

## 커밋 메시지 규칙 (Conventional Commits)

### 기본 형식

```
<type>(<scope>): <subject>

<body>

<footer>
```

**필수 요소:**
- `type`: 변경 유형 (필수)
- `scope`: 변경 범위 (선택)
- `subject`: 변경 요약 (필수, 50자 이내)

### Type 종류

| Type | 설명 | 예시 |
|------|------|------|
| `feat` | 새로운 기능 | `feat(auth): add JWT authentication` |
| `fix` | 버그 수정 | `fix(user): resolve null pointer exception` |
| `docs` | 문서 수정 | `docs(readme): update installation guide` |
| `style` | 코드 포맷팅 (기능 변경 없음) | `style(user): apply ktlint formatting` |
| `refactor` | 코드 리팩토링 | `refactor(order): extract payment logic` |
| `test` | 테스트 코드 추가/수정 | `test(user): add UserService unit tests` |
| `chore` | 빌드, 설정 파일 수정 | `chore(deps): upgrade spring boot to 3.2` |
| `perf` | 성능 개선 | `perf(query): optimize database query` |

### Scope 작성 가이드

**Scope는 변경된 모듈/기능을 명시합니다:**

```bash
# 기능별
feat(user): add user registration
feat(auth): implement OAuth2 login
feat(order): add payment processing

# 레이어별
fix(controller): fix validation error
refactor(service): extract common logic
test(repository): add integration tests
```

### Subject 작성 규칙

- **명령형 현재 시제**: "add" (O), "added" (X), "adds" (X)
- **소문자 시작**: "Add feature" (X), "add feature" (O)
- **마침표 없음**: "Add feature." (X), "Add feature" (O)
- **50자 이내**: 간결하게 작성

```bash
# ✅ GOOD
feat(user): add email verification
fix(auth): resolve token expiration issue
docs(api): update REST API documentation

# ❌ BAD
feat(user): Added email verification feature.  # 과거형, 마침표
Fix Auth: Token Expiration  # 대문자 시작
feat: this is a very long commit message that exceeds 50 characters  # 너무 김
```

### Body 작성 (선택)

**복잡한 변경사항은 Body에 설명합니다:**

```
feat(user): add user profile update API

- Add PUT /api/v1/users/{id} endpoint
- Implement validation for profile data
- Add unit tests for UserService.updateProfile()

Changes were made to support user profile editing feature
requested in issue #123.
```

### Footer 작성 (선택)

**이슈 번호, Breaking Changes를 명시합니다:**

```
feat(auth): migrate to OAuth2

BREAKING CHANGE: JWT authentication is replaced with OAuth2.
All existing tokens will be invalid.

Closes #456
Fixes #789
```

## 커밋 단위 규칙

### 원칙: 원자적 커밋 (Atomic Commits)

**하나의 커밋 = 하나의 논리적 변경**

```bash
# ✅ GOOD: 각 변경사항을 별도 커밋으로 분리
git commit -m "feat(user): add User entity"
git commit -m "feat(user): add UserRepository"
git commit -m "feat(user): add UserService"
git commit -m "test(user): add UserService tests"

# ❌ BAD: 여러 변경사항을 하나의 커밋으로
git commit -m "feat(user): add user feature"  # Entity, Repository, Service, Test 모두 포함
```

### 커밋 크기 가이드

| 커밋 크기 | 설명 | 예시 |
|---------|------|------|
| **너무 작음** | 의미 없는 단위로 분리 | `git commit -m "add import"` |
| **적당함** | 하나의 논리적 변경 | `git commit -m "feat(user): add User entity"` |
| **너무 큼** | 여러 기능을 한 번에 | `git commit -m "feat: add user and order features"` |

### WIP (Work In Progress) 커밋

**작업 중간 커밋은 나중에 Squash 합니다:**

```bash
# 작업 중간 커밋
git commit -m "wip: implementing user service"
git commit -m "wip: add validation logic"
git commit -m "wip: fix typo"

# PR 전에 불필요한 커밋 중복은 반드시 Squash
git rebase -i HEAD~3
# pick → squash로 변경
# 최종 커밋 메시지 작성: "feat(user): add UserService with validation"
```

## 브랜치 전략

### 브랜치 종류

```
main              # 프로덕션 배포 브랜치
├── develop       # 개발 통합 브랜치
├── feature/*     # 기능 개발 브랜치
├── bugfix/*      # 버그 수정 브랜치
├── hotfix/*      # 긴급 수정 브랜치
└── release/*     # 릴리즈 준비 브랜치
```

### 브랜치 네이밍

```bash
# 기능 개발
feature/ISSUE-123
feature/add-payment-gateway

# 버그 수정
bugfix/ISSUE-456
bugfix/fix-null-pointer

# 핫픽스
hotfix/ISSUE-789
hotfix/critical-db-connection

# 릴리즈
release/v1.0.0
release/v2.0.0-beta
```

## 작업 프로세스

### 1. Feature 개발

```bash
# 1. develop에서 최신 코드 받기
git checkout develop
git pull origin develop

# 2. feature 브랜치 생성
git checkout -b feature/ISSUE-123

# 3. 작업 및 커밋 (원자적 커밋)
git add src/main/User.kt
git commit -m "feat(user): add User entity"

git add src/main/UserRepository.kt
git commit -m "feat(user): add UserRepository"

git add src/test/UserServiceTest.kt
git commit -m "test(user): add UserService tests"

# 4. 원격 브랜치에 푸시
git push origin feature/ISSUE-123

# 5. PR 생성 (GitHub, GitLab 등)
```

### 2. Pull Request 생성

**PR 템플릿:**

```markdown
## 작업 내용
사용자 인증 기능을 추가했습니다.

## 관련 이슈
Closes #123

## 작업 사항
- User 엔티티 추가
- UserRepository 추가
- UserService 및 단위 테스트 추가

## 테스트
- [x] 로컬 테스트 완료
- [x] 단위 테스트 작성
- [x] 통합 테스트 통과

## 체크리스트
- [x] Git Convention 준수
- [x] 코드 리뷰 준비 완료
- [x] Breaking Change 없음
```

### 3. 코드 리뷰

**리뷰어가 확인할 사항:**
- [ ] 커밋 메시지가 Conventional Commits 형식을 따르는가?
- [ ] 원자적 커밋인가? (하나의 커밋 = 하나의 논리적 변경)
- [ ] 코딩 컨벤션을 준수했는가?
- [ ] 테스트 코드가 작성되었는가?
- [ ] Breaking Change가 있다면 명시되었는가?

### 4. Merge 전략

```bash
# Squash and Merge
# - 여러 커밋을 하나로 합침
# - 깔끔한 히스토리 유지
git merge --squash feature/ISSUE-123

# Rebase and Merge
# - 커밋을 그대로 유지하되 일렬로 정렬
git rebase develop
git merge feature/ISSUE-123

# Merge Commit
# - 머지 커밋을 남김
git merge feature/ISSUE-123
```

## Git Hooks (자동 검증)

### pre-commit (커밋 전 검증)

```bash
#!/bin/bash
# .git/hooks/pre-commit

# 코드 포맷 체크
./gradlew ktlintCheck || {
    echo "❌ ktlint check failed"
    exit 1
}

# 테스트 실행
./gradlew test || {
    echo "❌ Tests failed"
    exit 1
}

echo "✅ Pre-commit checks passed"
```

### commit-msg (커밋 메시지 검증)

```bash
#!/bin/bash
# .git/hooks/commit-msg

commit_msg=$(cat "$1")
pattern="^(feat|fix|docs|style|refactor|test|chore|perf)(\(.+\))?: .+"

if ! echo "$commit_msg" | grep -qE "$pattern"; then
    echo "❌ Invalid commit message format"
    echo "Format: <type>(<scope>): <subject>"
    echo "Example: feat(user): add user registration"
    exit 1
fi

echo "✅ Commit message format is valid"
```

## 충돌 해결

```bash
# 1. 최신 코드 받기
git fetch origin

# 2. Rebase로 충돌 해결 (권장)
git rebase origin/develop

# 3. 충돌 파일 수정
# (충돌 마커 <<<<<<, ======, >>>>>> 제거)

# 4. 계속 진행
git add <resolved-files>
git rebase --continue

# 5. 원격 브랜치에 강제 푸시 (주의!)
git push origin feature/ISSUE-123 --force
```

## 보안 (Security)

### 1. .gitignore 설정

**민감정보 커밋 방지를 위한 필수 .gitignore 설정:**

```bash
# .gitignore

# 환경 변수 및 설정 파일
.env
.env.local
.env.*.local
application-local.yml
application-secret.yml

# IDE 설정 (팀 공유 설정 제외)
.idea/
.vscode/
*.swp
*.swo

# 빌드 결과물
build/
target/
dist/
*.jar
*.war

# 로그 파일
*.log
logs/

# 데이터베이스
*.db
*.sqlite

# OS 파일
.DS_Store
Thumbs.db

# 민감한 설정 파일
*-secret.yml
*-credentials.json
*.pem
*.key
```

### 2. Credential 관리

```bash
# ❌ BAD: 민감정보를 커밋
git add .env
git commit -m "feat: add environment variables"

# ✅ GOOD: .gitignore에 추가
echo ".env" >> .gitignore
git add .gitignore
git commit -m "chore: add .env to gitignore"

# 민감정보 템플릿 파일 제공
cp .env .env.example
# .env.example에서 실제 값 제거
git add .env.example
git commit -m "docs: add env example file"
```

### 3. 이미 커밋된 민감정보 제거

```bash
# ❌ 이미 커밋된 경우: git-filter-repo 사용
pip install git-filter-repo

# 특정 파일 히스토리에서 완전 제거
git filter-repo --path .env --invert-paths

# 또는 BFG Repo-Cleaner 사용
java -jar bfg.jar --delete-files .env

# 강제 푸시 (주의: 팀원과 사전 협의 필수)
git push origin --force --all
```

### 4. Pre-commit Hook으로 민감정보 검증

```bash
#!/bin/bash
# .git/hooks/pre-commit

# 민감한 패턴 검사
PATTERNS=(
    "password\s*=\s*['\"][^'\"]+['\"]"
    "api_key\s*=\s*['\"][^'\"]+['\"]"
    "secret\s*=\s*['\"][^'\"]+['\"]"
    "AWS_SECRET_ACCESS_KEY"
    "PRIVATE_KEY"
)

for pattern in "${PATTERNS[@]}"; do
    if git diff --cached | grep -qE "$pattern"; then
        echo "Error: Potential sensitive information detected!"
        echo "Pattern: $pattern"
        exit 1
    fi
done

echo "Pre-commit checks passed"
```

### 5. GitHub Secret Scanning 활성화

**GitHub에서 자동으로 민감정보를 탐지합니다:**
- Settings → Security → Code security and analysis
- Secret scanning 활성화
- Push protection 활성화 (권장)

## 협업 (Collaboration)

### 1. Code Review 가이드

**리뷰어 역할:**

```markdown
## 코드 리뷰 체크리스트

### 기능 (Functionality)
- [ ] 요구사항을 정확히 구현했는가?
- [ ] Edge case를 고려했는가?
- [ ] 에러 처리가 적절한가?

### 코드 품질 (Code Quality)
- [ ] 코딩 컨벤션을 준수했는가?
- [ ] 불필요한 코드가 없는가?
- [ ] 복잡한 로직에 주석이 있는가?

### 보안 (Security)
- [ ] 입력 검증이 있는가?
- [ ] SQL Injection 취약점이 없는가?
- [ ] 민감정보가 노출되지 않는가?

### 테스트 (Testing)
- [ ] 단위 테스트가 작성되었는가?
- [ ] 테스트 커버리지가 충분한가?
- [ ] 기존 테스트가 모두 통과하는가?

### 성능 (Performance)
- [ ] 성능 저하가 없는가?
- [ ] N+1 쿼리 문제가 없는가?
- [ ] 불필요한 API 호출이 없는가?
```

**리뷰 받는 사람:**

```bash
# PR 생성 전 Self-Review
git diff origin/main...HEAD

# 모든 테스트 실행
./gradlew test

# 코드 포맷팅
./gradlew ktlintFormat

# PR 생성 시 명확한 설명 작성
# - 무엇을 변경했는지
# - 왜 변경했는지
# - 어떻게 테스트했는지
```

### 2. Conventional Commits 자동 검증

**commitlint 설정:**

```bash
# package.json
{
  "devDependencies": {
    "@commitlint/cli": "^17.0.0",
    "@commitlint/config-conventional": "^17.0.0",
    "husky": "^8.0.0"
  }
}

# commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'perf']
    ],
    'subject-max-length': [2, 'always', 50]
  }
}

# Husky 설정
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit "$1"'
```

### 3. PR 템플릿 개선

**.github/pull_request_template.md:**

```markdown
## 변경 사항 (Changes)
<!-- 무엇을 변경했는지 간단히 설명 -->

## 변경 이유 (Why)
<!-- 왜 이 변경이 필요한지 설명 -->

## 관련 이슈 (Related Issues)
Closes #

## 변경 타입 (Type of Change)
- [ ] 새로운 기능 (feat)
- [ ] 버그 수정 (fix)
- [ ] 리팩토링 (refactor)
- [ ] 문서 수정 (docs)
- [ ] 성능 개선 (perf)
- [ ] Breaking Change

## 테스트 (Testing)
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 작성
- [ ] 수동 테스트 완료
- [ ] 테스트 시나리오:

## 스크린샷 (Screenshots)
<!-- UI 변경이 있는 경우 스크린샷 첨부 -->

## 체크리스트 (Checklist)
- [ ] 코딩 컨벤션 준수
- [ ] 자체 리뷰 완료
- [ ] 문서 업데이트 (필요시)
- [ ] Breaking Change 문서화 (필요시)

## 추가 정보 (Additional Notes)
<!-- 리뷰어가 알아야 할 추가 정보 -->
```

### 4. Protected Branch 설정

**GitHub에서 main/develop 브랜치 보호:**

```yaml
# Settings → Branches → Branch protection rules

main:
  - Require pull request reviews before merging: ✅
  - Require status checks to pass before merging: ✅
    - CI/CD tests
    - Code coverage
    - Security scan
  - Require conversation resolution before merging: ✅
  - Require linear history: ✅
  - Do not allow bypassing the above settings: ✅

develop:
  - Require pull request reviews before merging: ✅
  - Require status checks to pass before merging: ✅
```

## 금지 사항

### 절대 금지
- ❌ **main 브랜치에 직접 push**: PR을 통해서만 병합
- ❌ **force push to shared branches**: develop, main 등
- ❌ **의미 없는 커밋 메시지**: "수정", "테스트", "ㅁㄴㅇㄹ"
- ❌ **대용량 바이너리 파일 커밋**: Git LFS 사용
- ❌ **민감한 정보 커밋**: 비밀번호, API 키, 토큰
- ❌ **리뷰 없이 병합**: 최소 1명 이상의 승인 필수
- ❌ **테스트 실패 시 병합**: CI/CD 통과 후에만 병합

### 주의 사항
- ⚠️ **WIP 커밋**: PR 전에 반드시 Squash
- ⚠️ **Merge 커밋**: Squash and Merge 또는 Rebase and Merge 사용
- ⚠️ **커밋 메시지 수정**: 이미 푸시한 커밋은 수정하지 않기
- ⚠️ **대용량 PR**: 500줄 이상은 리뷰가 어려우므로 분할 고려

## 체크리스트

**커밋 전 확인:**
- [ ] 커밋 메시지가 Conventional Commits 형식인가?
- [ ] 하나의 커밋이 하나의 논리적 변경인가?
- [ ] Subject가 50자 이내인가?
- [ ] 명령형 현재 시제를 사용했는가?
- [ ] 테스트가 통과하는가?
- [ ] 민감한 정보가 포함되지 않았는가?
- [ ] .gitignore가 적절히 설정되어 있는가?

**PR 전 확인:**
- [ ] 모든 커밋이 Conventional Commits 형식인가?
- [ ] WIP 커밋을 Squash 했는가?
- [ ] 테스트가 모두 통과하는가?
- [ ] 코드 리뷰 준비가 완료되었는가?
- [ ] PR 설명이 명확한가? (무엇을, 왜, 어떻게)
- [ ] Self-review를 완료했는가?
- [ ] 관련 문서를 업데이트했는가?

**Code Review 시 확인:**
- [ ] 기능이 요구사항을 충족하는가?
- [ ] 코딩 컨벤션을 준수하는가?
- [ ] 보안 취약점이 없는가?
- [ ] 테스트 커버리지가 충분한가?
- [ ] 성능 저하가 없는가?
