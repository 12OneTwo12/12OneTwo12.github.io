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

## 보안

### Secrets 관리

GitHub Actions Secrets에 저장:
- `GCP_PROJECT`: GCP 프로젝트 ID
- `GCP_SA_KEY`: GCP Service Account Key
- `SLACK_WEBHOOK`: Slack Webhook URL

Kubernetes Secrets:

```bash
# Secret 생성
kubectl create secret generic user-service-secret \
  --from-literal=database-password=supersecret \
  -n user-service

# Sealed Secrets 사용 (Git에 암호화된 Secret 저장)
kubeseal --format yaml < secret.yaml > sealed-secret.yaml
```

## 성능 최적화

### Docker 이미지 최적화

```dockerfile
# Multi-stage build로 최종 이미지 크기 최소화
# Alpine 이미지 사용
# 불필요한 파일 제거
```

### 빌드 캐시

```yaml
# GitHub Actions 캐시
- uses: actions/cache@v3
  with:
    path: ~/.gradle/caches
    key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*') }}
```

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
