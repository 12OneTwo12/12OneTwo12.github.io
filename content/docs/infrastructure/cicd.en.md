---
title: CI/CD Pipeline
weight: 2
---

## CI/CD Overview

My frequently used CI/CD pipeline. CI is performed with GitHub Actions, and CD is automated with ArgoCD.

```
GitHub Push → GitHub Actions (Build & Test) → Docker Registry → ArgoCD → Kubernetes
```

## GitHub Actions

### CI Workflow

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

### Application Definition

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

### Manual Sync

```bash
# Install ArgoCD CLI
brew install argocd

# Login
argocd login argocd.example.com

# Sync Application
argocd app sync user-service

# Rollback
argocd app rollback user-service
```

## Kustomize

### Directory Structure

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

## Docker Image Build

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

# Non-root user for security
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

### Jib (Build without Dockerfile)

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

Build:

```bash
./gradlew jib
```

## Deployment Process

### 1. Development Environment

```bash
# Work on feature branch
git checkout -b feature/new-api

# Test locally
./gradlew test

# Create PR
git push origin feature/new-api
# Create PR on GitHub → CI runs automatically
```

### 2. Staging Environment

```bash
# Merge to develop branch
git checkout develop
git merge feature/new-api

# CI automatically builds and tests
# ArgoCD automatically deploys to staging
```

### 3. Production Environment

```bash
# Merge to main branch
git checkout main
git merge develop

# CI builds and pushes Docker image
# Updates k8s manifests
# ArgoCD automatically deploys to production
```

## Rollback

### Rollback with ArgoCD

```bash
# Rollback to previous version
argocd app rollback user-service

# Rollback to specific version
argocd app rollback user-service --revision=3
```

### Rollback with Kubernetes

```bash
# Check Deployment history
kubectl rollout history deployment/user-service -n user-service

# Rollback to previous version
kubectl rollout undo deployment/user-service -n user-service

# Rollback to specific revision
kubectl rollout undo deployment/user-service --to-revision=2 -n user-service
```

## Monitoring

### Check Deployment Status

```bash
# Deployment status
kubectl rollout status deployment/user-service -n user-service

# Pod status
kubectl get pods -n user-service -w

# ArgoCD status
argocd app get user-service
```

### Slack Notifications

Deployment notifications from GitHub Actions to Slack:

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

## Security

### Secrets Management

Store in GitHub Actions Secrets:
- `GCP_PROJECT`: GCP Project ID
- `GCP_SA_KEY`: GCP Service Account Key
- `SLACK_WEBHOOK`: Slack Webhook URL

Kubernetes Secrets:

```bash
# Create Secret
kubectl create secret generic user-service-secret \
  --from-literal=database-password=supersecret \
  -n user-service

# Use Sealed Secrets (store encrypted Secrets in Git)
kubeseal --format yaml < secret.yaml > sealed-secret.yaml
```

## Performance Optimization

### Docker Image Optimization

```dockerfile
# Minimize final image size with multi-stage build
# Use Alpine images
# Remove unnecessary files
```

### Build Cache

```yaml
# GitHub Actions cache
- uses: actions/cache@v3
  with:
    path: ~/.gradle/caches
    key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*') }}
```

## Troubleshooting

### Image Pull Failure

```bash
# On ImagePullBackOff error
kubectl describe pod POD_NAME -n user-service

# Check Secret
kubectl get secret -n user-service
```

### ArgoCD Sync Failure

```bash
# Check ArgoCD logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller

# Try manual sync
argocd app sync user-service --force
```
