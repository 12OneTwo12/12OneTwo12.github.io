---
title: CI/CD 파이프라인
weight: 2
---

## CI/CD 개요

제가 자주 사용하는 CI/CD 파이프라인입니다. GitHub Actions로 CI를 수행하고, ArgoCD로 CD를 자동화합니다.

```
GitHub Push → GitHub Actions (Build & Test) → Docker Registry → ArgoCD → Kubernetes
```

## GitHub Actions

### CI 워크플로우

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [ main, develop ]
  push:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Set up JDK 17
      uses: actions/setup-java@v4
      with:
        java-version: '17'
        distribution: 'temurin'

    - name: Cache Gradle packages
      uses: actions/cache@v3
      with:
        path: |
          ~/.gradle/caches
          ~/.gradle/wrapper
        key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}

    - name: Run tests
      run: ./gradlew test

    - name: Run ktlint
      run: ./gradlew ktlintCheck

    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: test-results
        path: build/test-results/

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
    - uses: actions/checkout@v4

    - name: Set up JDK 17
      uses: actions/setup-java@v4
      with:
        java-version: '17'
        distribution: 'temurin'

    - name: Build with Gradle
      run: ./gradlew build -x test

    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: |
          gcr.io/${{ secrets.GCP_PROJECT }}/user-service:${{ github.sha }}
          gcr.io/${{ secrets.GCP_PROJECT }}/user-service:latest

    - name: Update manifest
      run: |
        cd k8s/overlays/production
        kustomize edit set image user-service=gcr.io/${{ secrets.GCP_PROJECT }}/user-service:${{ github.sha }}
        git config user.name "GitHub Actions"
        git config user.email "actions@github.com"
        git add .
        git commit -m "Update image to ${{ github.sha }}"
        git push
```

## ArgoCD

### Application 정의

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: user-service
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/USERNAME/k8s-manifests
    targetRevision: main
    path: overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: user-service
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

### 수동 동기화

```bash
# ArgoCD CLI 설치
brew install argocd

# 로그인
argocd login argocd.example.com

# Application 동기화
argocd app sync user-service

# Rollback
argocd app rollback user-service
```

## Kustomize

### 디렉토리 구조

```
k8s/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml
└── overlays/
    ├── development/
    │   ├── kustomization.yaml
    │   └── patches/
    ├── staging/
    │   ├── kustomization.yaml
    │   └── patches/
    └── production/
        ├── kustomization.yaml
        └── patches/
```

### Base

`k8s/base/kustomization.yaml`:

```yaml
resources:
- deployment.yaml
- service.yaml

commonLabels:
  app: user-service
```

### Overlay (Production)

`k8s/overlays/production/kustomization.yaml`:

```yaml
bases:
- ../../base

namespace: user-service

images:
- name: user-service
  newName: gcr.io/PROJECT/user-service
  newTag: v1.0.0

replicas:
- name: user-service
  count: 5

patchesStrategicMerge:
- patches/resources.yaml

configMapGenerator:
- name: user-service-config
  files:
  - config/application-prod.yaml
```

## Docker 이미지 빌드

### Dockerfile

```dockerfile
# Multi-stage build
FROM gradle:8-jdk17 AS builder
WORKDIR /app
COPY . .
RUN ./gradlew build -x test

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar

# 보안을 위한 비-root 유저
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

EXPOSE 8080

ENTRYPOINT ["java", \
  "-Xms1g", \
  "-Xmx2g", \
  "-XX:+UseG1GC", \
  "-jar", \
  "app.jar"]
```

### Jib (Dockerfile 없이 빌드)

`build.gradle.kts`:

```kotlin
plugins {
    id("com.google.cloud.tools.jib") version "3.4.0"
}

jib {
    from {
        image = "eclipse-temurin:17-jre-alpine"
    }
    to {
        image = "gcr.io/${project.properties["gcpProject"]}/user-service"
        tags = setOf("latest", version.toString())
    }
    container {
        jvmFlags = listOf(
            "-Xms1g",
            "-Xmx2g",
            "-XX:+UseG1GC"
        )
        ports = listOf("8080")
        user = "1000:1000"
    }
}
```

빌드:

```bash
./gradlew jib
```

## 배포 프로세스

### 1. 개발 환경

```bash
# Feature 브랜치에서 작업
git checkout -b feature/new-api

# 로컬에서 테스트
./gradlew test

# PR 생성
git push origin feature/new-api
# GitHub에서 PR 생성 → CI 자동 실행
```

### 2. Staging 환경

```bash
# develop 브랜치로 머지
git checkout develop
git merge feature/new-api

# CI가 자동으로 빌드 및 테스트
# ArgoCD가 staging에 자동 배포
```

### 3. Production 환경

```bash
# main 브랜치로 머지
git checkout main
git merge develop

# CI가 Docker 이미지 빌드 및 푸시
# k8s 매니페스트 업데이트
# ArgoCD가 production에 자동 배포
```

## 롤백

### ArgoCD로 롤백

```bash
# 이전 버전으로 롤백
argocd app rollback user-service

# 특정 버전으로 롤백
argocd app rollback user-service --revision=3
```

### Kubernetes로 롤백

```bash
# Deployment 히스토리 확인
kubectl rollout history deployment/user-service -n user-service

# 이전 버전으로 롤백
kubectl rollout undo deployment/user-service -n user-service

# 특정 리비전으로 롤백
kubectl rollout undo deployment/user-service --to-revision=2 -n user-service
```

## 모니터링

### 배포 상태 확인

```bash
# Deployment 상태
kubectl rollout status deployment/user-service -n user-service

# Pod 상태
kubectl get pods -n user-service -w

# ArgoCD 상태
argocd app get user-service
```

### Slack 알림

GitHub Actions에서 Slack으로 배포 알림:

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: |
      Deployment to production ${{ job.status }}
      Commit: ${{ github.sha }}
      Author: ${{ github.actor }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## 보안 (Security)

### 1. Secrets 관리

**GitHub Actions Secrets:**

```yaml
# ❌ BAD: 코드에 하드코딩
env:
  GCP_PROJECT: my-project-123
  DATABASE_PASSWORD: supersecret123

# ✅ GOOD: GitHub Secrets 사용
env:
  GCP_PROJECT: ${{ secrets.GCP_PROJECT }}
  DATABASE_PASSWORD: ${{ secrets.DATABASE_PASSWORD }}
```

**필수 Secret 항목:**
- `GCP_PROJECT`: GCP 프로젝트 ID
- `GCP_SA_KEY`: GCP Service Account Key (JSON)
- `DATABASE_URL`: 데이터베이스 연결 문자열
- `SLACK_WEBHOOK`: Slack 알림 Webhook URL
- `DOCKER_REGISTRY_TOKEN`: Docker Registry 인증 토큰

### 2. Container 보안

**Trivy로 이미지 취약점 스캔:**

```yaml
# .github/workflows/security.yml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'gcr.io/${{ secrets.GCP_PROJECT }}/user-service:${{ github.sha }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'  # 취약점 발견 시 빌드 실패

- name: Upload Trivy results to GitHub Security
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: 'trivy-results.sarif'
```

### 3. Docker Layer 최적화 및 보안

```dockerfile
# ❌ BAD: root 사용자로 실행
FROM openjdk:17-jre
COPY app.jar /app.jar
ENTRYPOINT ["java", "-jar", "/app.jar"]

# ✅ GOOD: 비-root 사용자 + 최적화
FROM eclipse-temurin:17-jre-alpine AS runtime

# 비-root 사용자 생성
RUN addgroup -S spring && adduser -S spring -G spring

# 애플리케이션 파일 복사
WORKDIR /app
COPY --chown=spring:spring build/libs/*.jar app.jar

# 비-root 사용자로 전환
USER spring:spring

# 보안 옵션 추가
EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", \
  "app.jar"]
```

### 4. SAST/DAST 보안 스캔

```yaml
# CodeQL 정적 분석
- name: Initialize CodeQL
  uses: github/codeql-action/init@v2
  with:
    languages: java

- name: Autobuild
  uses: github/codeql-action/autobuild@v2

- name: Perform CodeQL Analysis
  uses: github/codeql-action/analyze@v2

# Dependency Check
- name: OWASP Dependency Check
  run: ./gradlew dependencyCheckAnalyze
```

### 5. Secret Manager 사용 (프로덕션)

**Kubernetes에서 외부 Secret Manager 사용:**

```yaml
# external-secrets를 사용한 GCP Secret Manager 연동
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: user-service-secret
  namespace: user-service
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: gcpsm-secret-store
    kind: SecretStore
  target:
    name: user-service-secret
  data:
  - secretKey: database-password
    remoteRef:
      key: user-service-db-password
  - secretKey: api-key
    remoteRef:
      key: user-service-api-key
```

### 6. 배포 권한 관리

**RBAC로 배포 권한 제한:**

```yaml
# GitHub Actions Service Account (최소 권한 원칙)
apiVersion: v1
kind: ServiceAccount
metadata:
  name: github-actions
  namespace: user-service

---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: deployer
  namespace: user-service
rules:
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "update", "patch"]
- apiGroups: [""]
  resources: ["pods", "services"]
  verbs: ["get", "list"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: github-actions-deployer
  namespace: user-service
subjects:
- kind: ServiceAccount
  name: github-actions
  namespace: user-service
roleRef:
  kind: Role
  name: deployer
  apiGroup: rbac.authorization.k8s.io
```

## 성능 (Performance)

### 1. Docker 이미지 최적화

**Multi-stage Build + Layer 최적화:**

```dockerfile
# ❌ BAD: 단일 스테이지, 큰 이미지 크기
FROM gradle:8-jdk17
WORKDIR /app
COPY . .
RUN ./gradlew build
ENTRYPOINT ["java", "-jar", "build/libs/app.jar"]

# ✅ GOOD: Multi-stage build, 최소 이미지
FROM gradle:8-jdk17 AS builder
WORKDIR /app

# 의존성 캐싱을 위한 레이어 분리
COPY build.gradle.kts settings.gradle.kts ./
COPY gradle ./gradle
RUN ./gradlew dependencies --no-daemon

# 소스 코드 복사 및 빌드
COPY src ./src
RUN ./gradlew build -x test --no-daemon

# Runtime 스테이지
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# 비-root 사용자
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# JAR 파일만 복사
COPY --from=builder --chown=spring:spring /app/build/libs/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-jar", \
  "app.jar"]
```

### 2. 빌드 캐시 전략

```yaml
# ❌ BAD: 캐시 없이 매번 전체 빌드
- name: Build with Gradle
  run: ./gradlew build

# ✅ GOOD: Gradle 의존성 캐싱
- name: Cache Gradle packages
  uses: actions/cache@v3
  with:
    path: |
      ~/.gradle/caches
      ~/.gradle/wrapper
    key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}
    restore-keys: |
      ${{ runner.os }}-gradle-

# ✅ GOOD: Docker Layer 캐싱
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v2

- name: Build and push
  uses: docker/build-push-action@v4
  with:
    context: .
    push: true
    tags: gcr.io/${{ secrets.GCP_PROJECT }}/user-service:${{ github.sha }}
    cache-from: type=registry,ref=gcr.io/${{ secrets.GCP_PROJECT }}/user-service:buildcache
    cache-to: type=registry,ref=gcr.io/${{ secrets.GCP_PROJECT }}/user-service:buildcache,mode=max
```

### 3. 병렬 빌드 및 테스트

```yaml
# ✅ GOOD: 병렬 실행으로 빌드 시간 단축
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-suite: [unit, integration, e2e]
      fail-fast: false  # 하나 실패해도 나머지 계속 실행

    steps:
    - uses: actions/checkout@v4

    - name: Run ${{ matrix.test-suite }} tests
      run: ./gradlew ${{ matrix.test-suite }}Test
      timeout-minutes: 10  # 타임아웃 설정
```

### 4. 조건부 빌드

```yaml
# 변경된 파일에 따라 선택적 빌드
- name: Check changed files
  id: changed-files
  uses: tj-actions/changed-files@v39
  with:
    files: |
      src/**
      build.gradle.kts

- name: Build only if source changed
  if: steps.changed-files.outputs.any_changed == 'true'
  run: ./gradlew build
```

## 안정성 (Reliability)

### 1. Blue-Green 배포

```yaml
# ArgoCD Rollout을 사용한 Blue-Green 배포
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: user-service
  namespace: user-service
spec:
  replicas: 5
  strategy:
    blueGreen:
      activeService: user-service
      previewService: user-service-preview
      autoPromotionEnabled: false  # 수동 승인 필요
      scaleDownDelaySeconds: 300   # Green 배포 후 5분 대기
  template:
    spec:
      containers:
      - name: user-service
        image: gcr.io/PROJECT/user-service:v1.0.0
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
```

### 2. Canary 배포

```yaml
# 점진적 카나리 배포
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: user-service
spec:
  strategy:
    canary:
      steps:
      - setWeight: 10    # 10% 트래픽
      - pause: {duration: 5m}
      - setWeight: 30    # 30% 트래픽
      - pause: {duration: 5m}
      - setWeight: 50    # 50% 트래픽
      - pause: {duration: 5m}
      - setWeight: 100   # 100% 트래픽

      # 자동 롤백 조건
      analysis:
        templates:
        - templateName: success-rate
        startingStep: 1
        args:
        - name: service-name
          value: user-service
```

### 3. Health Check 및 Readiness

```yaml
# Kubernetes Health Checks
spec:
  containers:
  - name: user-service
    livenessProbe:
      httpGet:
        path: /actuator/health/liveness
        port: 8080
      initialDelaySeconds: 30
      periodSeconds: 10
      failureThreshold: 3
      timeoutSeconds: 5

    readinessProbe:
      httpGet:
        path: /actuator/health/readiness
        port: 8080
      initialDelaySeconds: 10
      periodSeconds: 5
      failureThreshold: 3
      successThreshold: 1

    startupProbe:
      httpGet:
        path: /actuator/health/readiness
        port: 8080
      initialDelaySeconds: 10
      periodSeconds: 5
      failureThreshold: 30  # 최대 150초 대기
```

### 4. Rollback 전략

```yaml
# 자동 롤백 조건 설정
apiVersion: argoproj.io/v1alpha1
kind: Rollout
spec:
  revisionHistoryLimit: 5  # 최근 5개 버전 유지

  strategy:
    canary:
      # 에러율 5% 이상 시 자동 롤백
      analysis:
        templates:
        - templateName: error-rate
          clusterScope: true
        args:
        - name: error-rate-threshold
          value: "5"

---
# Analysis Template
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: error-rate
spec:
  metrics:
  - name: error-rate
    interval: 1m
    successCondition: result < 5
    failureLimit: 3
    provider:
      prometheus:
        address: http://prometheus:9090
        query: |
          sum(rate(http_requests_total{status=~"5..",job="user-service"}[1m])) /
          sum(rate(http_requests_total{job="user-service"}[1m])) * 100
```

### 5. 배포 알림 및 모니터링

```yaml
# Slack 알림
- name: Notify deployment start
  uses: 8398a7/action-slack@v3
  with:
    status: custom
    custom_payload: |
      {
        text: "🚀 Deployment started",
        attachments: [{
          color: 'good',
          text: `
            *Service*: user-service
            *Environment*: production
            *Version*: ${{ github.sha }}
            *Triggered by*: ${{ github.actor }}
          `
        }]
      }
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}

# 배포 실패 시 알림
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    text: '❌ Deployment failed! Please check logs.'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## 체크리스트

### 보안
- [ ] GitHub Secrets에 민감정보를 저장했는가?
- [ ] Container 이미지 취약점 스캔을 실행하는가?
- [ ] 비-root 사용자로 컨테이너를 실행하는가?
- [ ] SAST/DAST 보안 스캔을 수행하는가?
- [ ] 배포 권한이 RBAC로 제한되어 있는가?

### 성능
- [ ] Multi-stage build를 사용하는가?
- [ ] Docker Layer 캐싱을 활용하는가?
- [ ] 빌드/테스트를 병렬로 실행하는가?
- [ ] 불필요한 빌드를 스킵하는가?

### 안정성
- [ ] Blue-Green 또는 Canary 배포를 사용하는가?
- [ ] Health Check가 적절히 설정되어 있는가?
- [ ] 자동 롤백 조건이 정의되어 있는가?
- [ ] 배포 알림이 설정되어 있는가?
- [ ] Rollback 히스토리를 유지하는가?

## 트러블슈팅

### 이미지 Pull 실패

```bash
# ImagePullBackOff 에러 시
kubectl describe pod POD_NAME -n user-service

# Secret 확인
kubectl get secret -n user-service
```

### ArgoCD Sync 실패

```bash
# ArgoCD 로그 확인
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller

# Manual sync 시도
argocd app sync user-service --force
```
