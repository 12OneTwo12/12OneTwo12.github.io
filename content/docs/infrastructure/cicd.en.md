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

### 1. Secrets Management

**GitHub Actions Secrets:**

```yaml
# ❌ BAD: Hardcoded in code
env:
  GCP_PROJECT: my-project-123
  DATABASE_PASSWORD: supersecret123

# ✅ GOOD: Using GitHub Secrets
env:
  GCP_PROJECT: ${{ secrets.GCP_PROJECT }}
  DATABASE_PASSWORD: ${{ secrets.DATABASE_PASSWORD }}
```

**Required Secret Items:**
- `GCP_PROJECT`: GCP Project ID
- `GCP_SA_KEY`: GCP Service Account Key (JSON)
- `DATABASE_URL`: Database connection string
- `SLACK_WEBHOOK`: Slack notification Webhook URL
- `DOCKER_REGISTRY_TOKEN`: Docker Registry authentication token

### 2. Container Security

**Scanning image vulnerabilities with Trivy:**

```yaml
# .github/workflows/security.yml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'gcr.io/${{ secrets.GCP_PROJECT }}/user-service:${{ github.sha }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'  # Fail build if vulnerabilities found

- name: Upload Trivy results to GitHub Security
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: 'trivy-results.sarif'
```

### 3. Docker Layer Optimization and Security

```dockerfile
# ❌ BAD: Running as root user
FROM openjdk:17-jre
COPY app.jar /app.jar
ENTRYPOINT ["java", "-jar", "/app.jar"]

# ✅ GOOD: Non-root user + optimization
FROM eclipse-temurin:17-jre-alpine AS runtime

# Create non-root user
RUN addgroup -S spring && adduser -S spring -G spring

# Copy application files
WORKDIR /app
COPY --chown=spring:spring build/libs/*.jar app.jar

# Switch to non-root user
USER spring:spring

# Add security options
EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", \
  "app.jar"]
```

### 4. SAST/DAST Security Scanning

```yaml
# CodeQL static analysis
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

### 5. Secret Manager Usage (Production)

**Using external Secret Manager in Kubernetes:**

```yaml
# Integrating GCP Secret Manager with external-secrets
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

### 6. Deployment Permission Management

**Restricting deployment permissions with RBAC:**

```yaml
# GitHub Actions Service Account (Principle of least privilege)
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

## Performance

### 1. Docker Image Optimization

**Multi-stage Build + Layer Optimization:**

```dockerfile
# ❌ BAD: Single stage, large image size
FROM gradle:8-jdk17
WORKDIR /app
COPY . .
RUN ./gradlew build
ENTRYPOINT ["java", "-jar", "build/libs/app.jar"]

# ✅ GOOD: Multi-stage build, minimal image
FROM gradle:8-jdk17 AS builder
WORKDIR /app

# Separate layers for dependency caching
COPY build.gradle.kts settings.gradle.kts ./
COPY gradle ./gradle
RUN ./gradlew dependencies --no-daemon

# Copy source code and build
COPY src ./src
RUN ./gradlew build -x test --no-daemon

# Runtime stage
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Non-root user
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copy only JAR file
COPY --from=builder --chown=spring:spring /app/build/libs/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-jar", \
  "app.jar"]
```

### 2. Build Cache Strategy

```yaml
# ❌ BAD: Full build every time without caching
- name: Build with Gradle
  run: ./gradlew build

# ✅ GOOD: Gradle dependency caching
- name: Cache Gradle packages
  uses: actions/cache@v3
  with:
    path: |
      ~/.gradle/caches
      ~/.gradle/wrapper
    key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}
    restore-keys: |
      ${{ runner.os }}-gradle-

# ✅ GOOD: Docker Layer caching
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

### 3. Parallel Build and Testing

```yaml
# ✅ GOOD: Reduce build time with parallel execution
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-suite: [unit, integration, e2e]
      fail-fast: false  # Continue others even if one fails

    steps:
    - uses: actions/checkout@v4

    - name: Run ${{ matrix.test-suite }} tests
      run: ./gradlew ${{ matrix.test-suite }}Test
      timeout-minutes: 10  # Set timeout
```

### 4. Conditional Builds

```yaml
# Selective build based on changed files
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

## Reliability

### 1. Blue-Green Deployment

```yaml
# Blue-Green deployment with ArgoCD Rollout
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
      autoPromotionEnabled: false  # Require manual approval
      scaleDownDelaySeconds: 300   # Wait 5 minutes after Green deployment
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

### 2. Canary Deployment

```yaml
# Progressive canary deployment
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: user-service
spec:
  strategy:
    canary:
      steps:
      - setWeight: 10    # 10% traffic
      - pause: {duration: 5m}
      - setWeight: 30    # 30% traffic
      - pause: {duration: 5m}
      - setWeight: 50    # 50% traffic
      - pause: {duration: 5m}
      - setWeight: 100   # 100% traffic

      # Automatic rollback conditions
      analysis:
        templates:
        - templateName: success-rate
        startingStep: 1
        args:
        - name: service-name
          value: user-service
```

### 3. Health Checks and Readiness

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
      failureThreshold: 30  # Wait up to 150 seconds
```

### 4. Rollback Strategy

```yaml
# Configure automatic rollback conditions
apiVersion: argoproj.io/v1alpha1
kind: Rollout
spec:
  revisionHistoryLimit: 5  # Keep last 5 versions

  strategy:
    canary:
      # Auto rollback if error rate > 5%
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

### 5. Deployment Notifications and Monitoring

```yaml
# Slack notifications
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

# Notify on failure
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    text: '❌ Deployment failed! Please check logs.'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## Checklist

### Security
- [ ] Are sensitive information stored in GitHub Secrets?
- [ ] Is container image vulnerability scanning enabled?
- [ ] Are containers running as non-root user?
- [ ] Is SAST/DAST security scanning performed?
- [ ] Are deployment permissions restricted with RBAC?

### Performance
- [ ] Using multi-stage builds?
- [ ] Leveraging Docker Layer caching?
- [ ] Running builds/tests in parallel?
- [ ] Skipping unnecessary builds?

### Reliability
- [ ] Using Blue-Green or Canary deployment?
- [ ] Are Health Checks properly configured?
- [ ] Are automatic rollback conditions defined?
- [ ] Are deployment notifications configured?
- [ ] Maintaining rollback history?

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
