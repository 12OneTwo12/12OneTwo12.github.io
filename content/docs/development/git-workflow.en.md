---
title: Git Workflow
weight: 2
---

This is my Git branching strategy and commit rules.

## Commit Message Rules (Conventional Commits)

### Basic Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Required elements:**
- `type`: Change type (required)
- `scope`: Change scope (optional)
- `subject`: Change summary (required, within 50 characters)

### Type Categories

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(auth): add JWT authentication` |
| `fix` | Bug fix | `fix(user): resolve null pointer exception` |
| `docs` | Documentation changes | `docs(readme): update installation guide` |
| `style` | Code formatting (no functional changes) | `style(user): apply ktlint formatting` |
| `refactor` | Code refactoring | `refactor(order): extract payment logic` |
| `test` | Add/modify test code | `test(user): add UserService unit tests` |
| `chore` | Build, config file changes | `chore(deps): upgrade spring boot to 3.2` |
| `perf` | Performance improvement | `perf(query): optimize database query` |

### Scope Writing Guide

**Scope specifies the changed module/feature:**

```bash
# By feature
feat(user): add user registration
feat(auth): implement OAuth2 login
feat(order): add payment processing

# By layer
fix(controller): fix validation error
refactor(service): extract common logic
test(repository): add integration tests
```

### Subject Writing Rules

- **Imperative present tense**: "add" (O), "added" (X), "adds" (X)
- **Lowercase start**: "Add feature" (X), "add feature" (O)
- **No period**: "Add feature." (X), "Add feature" (O)
- **Within 50 characters**: Keep it concise

```bash
# ✅ GOOD
feat(user): add email verification
fix(auth): resolve token expiration issue
docs(api): update REST API documentation

# ❌ BAD
feat(user): Added email verification feature.  # past tense, period
Fix Auth: Token Expiration  # capitalized start
feat: this is a very long commit message that exceeds 50 characters  # too long
```

### Body Writing (Optional)

**Explain complex changes in the Body:**

```
feat(user): add user profile update API

- Add PUT /api/v1/users/{id} endpoint
- Implement validation for profile data
- Add unit tests for UserService.updateProfile()

Changes were made to support user profile editing feature
requested in issue #123.
```

### Footer Writing (Optional)

**Specify issue numbers, Breaking Changes:**

```
feat(auth): migrate to OAuth2

BREAKING CHANGE: JWT authentication is replaced with OAuth2.
All existing tokens will be invalid.

Closes #456
Fixes #789
```

## Commit Unit Rules

### Principle: Atomic Commits

**One commit = One logical change**

```bash
# ✅ GOOD: Separate each change into individual commits
git commit -m "feat(user): add User entity"
git commit -m "feat(user): add UserRepository"
git commit -m "feat(user): add UserService"
git commit -m "test(user): add UserService tests"

# ❌ BAD: Multiple changes in one commit
git commit -m "feat(user): add user feature"  # Includes Entity, Repository, Service, Test all together
```

### Commit Size Guide

| Commit Size | Description | Example |
|------------|-------------|---------|
| **Too small** | Meaninglessly separated | `git commit -m "add import"` |
| **Appropriate** | One logical change | `git commit -m "feat(user): add User entity"` |
| **Too large** | Multiple features at once | `git commit -m "feat: add user and order features"` |

### WIP (Work In Progress) Commits

**Intermediate work commits should be squashed later:**

```bash
# Intermediate work commits
git commit -m "wip: implementing user service"
git commit -m "wip: add validation logic"
git commit -m "wip: fix typo"

# Must squash unnecessary duplicate commits before PR
git rebase -i HEAD~3
# Change pick → squash
# Final commit message: "feat(user): add UserService with validation"
```

## Branching Strategy

### Branch Types

```
main              # Production deployment branch
├── develop       # Development integration branch
├── feature/*     # Feature development branch
├── bugfix/*      # Bug fix branch
├── hotfix/*      # Emergency fix branch
└── release/*     # Release preparation branch
```

### Branch Naming

```bash
# Feature development
feature/ISSUE-123
feature/add-payment-gateway

# Bug fixes
bugfix/ISSUE-456
bugfix/fix-null-pointer

# Hotfixes
hotfix/ISSUE-789
hotfix/critical-db-connection

# Releases
release/v1.0.0
release/v2.0.0-beta
```

## Workflow Process

### 1. Feature Development

```bash
# 1. Get latest code from develop
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/ISSUE-123

# 3. Work and commit (atomic commits)
git add src/main/User.kt
git commit -m "feat(user): add User entity"

git add src/main/UserRepository.kt
git commit -m "feat(user): add UserRepository"

git add src/test/UserServiceTest.kt
git commit -m "test(user): add UserService tests"

# 4. Push to remote branch
git push origin feature/ISSUE-123

# 5. Create PR (GitHub, GitLab, etc.)
```

### 2. Pull Request Creation

**PR Template:**

```markdown
## Description
Added user authentication feature.

## Related Issues
Closes #123

## Changes Made
- Add User entity
- Add UserRepository
- Add UserService and unit tests

## Testing
- [x] Local testing completed
- [x] Unit tests written
- [x] Integration tests passed

## Checklist
- [x] Git Convention followed
- [x] Code review ready
- [x] No Breaking Changes
```

### 3. Code Review

**Reviewer checklist:**
- [ ] Does commit message follow Conventional Commits format?
- [ ] Are commits atomic? (one commit = one logical change)
- [ ] Does it follow coding conventions?
- [ ] Are tests written?
- [ ] Are Breaking Changes documented if any?

### 4. Merge Strategy

```bash
# Squash and Merge
# - Combines multiple commits into one
# - Maintains clean history
git merge --squash feature/ISSUE-123

# Rebase and Merge
# - Keeps commits but aligns them linearly
git rebase develop
git merge feature/ISSUE-123

# Merge Commit
# - Creates a merge commit
git merge feature/ISSUE-123
```

## Git Hooks (Automatic Validation)

### pre-commit (Pre-commit validation)

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Code format check
./gradlew ktlintCheck || {
    echo "❌ ktlint check failed"
    exit 1
}

# Run tests
./gradlew test || {
    echo "❌ Tests failed"
    exit 1
}

echo "✅ Pre-commit checks passed"
```

### commit-msg (Commit message validation)

```bash
#!/bin/bash
# .git/hooks/commit-msg

commit_msg=$(cat "$1")
pattern="^(feat|fix|docs|style|refactor|test|chore|perf)(\\(.+\\))?: .+"

if ! echo "$commit_msg" | grep -qE "$pattern"; then
    echo "❌ Invalid commit message format"
    echo "Format: <type>(<scope>): <subject>"
    echo "Example: feat(user): add user registration"
    exit 1
fi

echo "✅ Commit message format is valid"
```

## Conflict Resolution

```bash
# 1. Fetch latest code
git fetch origin

# 2. Resolve conflicts with Rebase (recommended)
git rebase origin/develop

# 3. Edit conflicted files
# (Remove conflict markers <<<<<<, ======, >>>>>>)

# 4. Continue
git add <resolved-files>
git rebase --continue

# 5. Force push to remote branch (caution!)
git push origin feature/ISSUE-123 --force
```

## Security

### 1. .gitignore Configuration

**Essential .gitignore settings to prevent committing sensitive information:**

```bash
# .gitignore

# Environment variables and config files
.env
.env.local
.env.*.local
application-local.yml
application-secret.yml

# IDE settings (excluding team shared settings)
.idea/
.vscode/
*.swp
*.swo

# Build artifacts
build/
target/
dist/
*.jar
*.war

# Log files
*.log
logs/

# Database files
*.db
*.sqlite

# OS files
.DS_Store
Thumbs.db

# Sensitive config files
*-secret.yml
*-credentials.json
*.pem
*.key
```

### 2. Credential Management

```bash
# ❌ BAD: Committing sensitive information
git add .env
git commit -m "feat: add environment variables"

# ✅ GOOD: Add to .gitignore
echo ".env" >> .gitignore
git add .gitignore
git commit -m "chore: add .env to gitignore"

# Provide template file for sensitive information
cp .env .env.example
# Remove actual values from .env.example
git add .env.example
git commit -m "docs: add env example file"
```

### 3. Removing Already Committed Sensitive Information

```bash
# ❌ If already committed: Use git-filter-repo
pip install git-filter-repo

# Completely remove from history
git filter-repo --path .env --invert-paths

# Or use BFG Repo-Cleaner
java -jar bfg.jar --delete-files .env

# Force push (Caution: Must coordinate with team first)
git push origin --force --all
```

### 4. Validate Sensitive Information with Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check for sensitive patterns
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

### 5. Enable GitHub Secret Scanning

**GitHub automatically detects sensitive information:**
- Settings → Security → Code security and analysis
- Enable Secret scanning
- Enable Push protection (recommended)

## Collaboration

### 1. Code Review Guide

**Reviewer role:**

```markdown
## Code Review Checklist

### Functionality
- [ ] Does it accurately implement requirements?
- [ ] Are edge cases considered?
- [ ] Is error handling appropriate?

### Code Quality
- [ ] Does it follow coding conventions?
- [ ] Is there no unnecessary code?
- [ ] Are complex logic commented?

### Security
- [ ] Is input validation present?
- [ ] Are there no SQL Injection vulnerabilities?
- [ ] Is sensitive information not exposed?

### Testing
- [ ] Are unit tests written?
- [ ] Is test coverage sufficient?
- [ ] Do all existing tests pass?

### Performance
- [ ] Is there no performance degradation?
- [ ] Are there no N+1 query problems?
- [ ] Are there no unnecessary API calls?
```

**Reviewee role:**

```bash
# Self-Review before creating PR
git diff origin/main...HEAD

# Run all tests
./gradlew test

# Code formatting
./gradlew ktlintFormat

# Write clear description when creating PR
# - What was changed
# - Why it was changed
# - How it was tested
```

### 2. Automatic Validation of Conventional Commits

**commitlint configuration:**

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

# Husky setup
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit "$1"'
```

### 3. Enhanced PR Template

**.github/pull_request_template.md:**

```markdown
## Changes
<!-- Briefly describe what was changed -->

## Why
<!-- Explain why this change is needed -->

## Related Issues
Closes #

## Type of Change
- [ ] New feature (feat)
- [ ] Bug fix (fix)
- [ ] Refactoring (refactor)
- [ ] Documentation (docs)
- [ ] Performance improvement (perf)
- [ ] Breaking Change

## Testing
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Manual testing completed
- [ ] Test scenarios:

## Screenshots
<!-- Attach screenshots if there are UI changes -->

## Checklist
- [ ] Follow coding conventions
- [ ] Self-review completed
- [ ] Documentation updated (if needed)
- [ ] Breaking Change documented (if needed)

## Additional Notes
<!-- Additional information reviewers should know -->
```

### 4. Protected Branch Settings

**Protect main/develop branches on GitHub:**

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

## Forbidden Practices

### Strictly Forbidden
- ❌ **Direct push to main branch**: Only merge through PR
- ❌ **Force push to shared branches**: develop, main, etc.
- ❌ **Meaningless commit messages**: "update", "test", "asdf"
- ❌ **Large binary file commits**: Use Git LFS
- ❌ **Committing sensitive information**: passwords, API keys, tokens
- ❌ **Merge without review**: Minimum 1 approval required
- ❌ **Merge with failing tests**: Only merge after CI/CD passes

### Cautions
- ⚠️ **WIP commits**: Must squash before PR
- ⚠️ **Merge commits**: Use Squash and Merge or Rebase and Merge
- ⚠️ **Modifying commit messages**: Don't modify already pushed commits
- ⚠️ **Large PRs**: Consider splitting if over 500 lines (difficult to review)

## Checklist

**Before commit:**
- [ ] Is commit message in Conventional Commits format?
- [ ] Is one commit one logical change?
- [ ] Is Subject within 50 characters?
- [ ] Using imperative present tense?
- [ ] Do tests pass?
- [ ] No sensitive information included?
- [ ] Is .gitignore properly configured?

**Before PR:**
- [ ] Are all commits in Conventional Commits format?
- [ ] Have WIP commits been squashed?
- [ ] Do all tests pass?
- [ ] Is code review ready?
- [ ] Is PR description clear? (what, why, how)
- [ ] Have you completed self-review?
- [ ] Have you updated related documentation?

**During Code Review:**
- [ ] Does functionality meet requirements?
- [ ] Does it follow coding conventions?
- [ ] Are there no security vulnerabilities?
- [ ] Is test coverage sufficient?
- [ ] Is there no performance degradation?
