---
title: "GitHub Actions 무료 사용량 부족 문제를 Self-hosted Runner와 Jenkins로 해결한 과정"
tags:
  - "ci/cd"
  - "jenkins"
  - "kubernetes"
  - "github-actions"
  - "self-hosted-runner"
  - "cost-optimization"
  - "co-work"
date: '2025-12-16'
---

안녕하세요. 프롭테크 플랫폼에서 백엔드 개발자로 근무 중인 3년차 백엔드 개발자 정정일입니다.

이 글은 회사에서 CI/CD 파이프라인을 개선해나가면서 겪었던 시행착오와 문제 해결 과정을 담은 이야기입니다.

GitHub Actions로 시작했다가 Self-hosted Runner를 거쳐, 최종적으로 Jenkins on Kubernetes까지 오게 된 여정을 공유하려 합니다.

---

## 시작: GitHub Actions로 시작한 CI/CD

회사는 프롭테크 스타트업입니다. MSA(Microservices Architecture)로 백엔드를 구성하고 있으며, 초기에는 5~6개 정도의 서비스로 시작했습니다.

CI/CD는 **GitHub Actions**를 사용하고 있었습니다.

당시 워크플로우는 단순했습니다:

```yaml
# 기존 ci-cd.yml (단순 버전)
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up JDK 17
        uses: actions/setup-java@v3
        with:
          java-version: '17'
      - name: Build with Gradle
        run: ./gradlew build
      - name: Build Docker image
        run: docker build -t my-service .
      - name: Push to registry
        run: docker push my-service
```

간단한 빌드와 배포만 수행했고, GitHub Actions의 무료 플랜(Organization 월 2,000분)으로 충분했습니다.

---

## 전환점: 코드 품질 개선의 필요성

시간이 지나면서 회사는 성장했고, 서비스도 점점 늘어났습니다.

그러면서 자연스럽게 **코드 품질 관리**에 대한 고민이 생겼습니다:

### 당시 겪었던 문제들

1. **PR 리뷰 부담 증가**
   - 팀원의 수는 적었지만 PR이 많아지면서, 리뷰어가 놓치는 코드 컨벤션 위반 사례들이 생김
   - "이건 리뷰에서 매번 지적하는데 자동으로 체크할 순 없나?"

2. **테스트 커버리지 관리 어려움**
   - 테스트는 작성하고 있지만, 커버리지가 얼마나 되는지 가시적으로 확인하기 어려움
   - PR마다 커버리지가 떨어지는지 올라가는지 알 수 없음

3. **잠재적 버그 발견의 어려움**
   - 간단한 실수들(null 체크 누락, 리소스 미반환 등)을 사람이 일일이 찾기엔 한계

이런 문제들을 해결하기 위해 **정적 분석 도구**와 **테스트 커버리지 도구**를 도입하기로 했습니다.

### 도구 선택 과정

처음엔 **SonarQube**나 **SonarCloud**를 검토했습니다.

하지만:
- **SonarQube**: 자체 서버를 운영해야 함 (인프라 리소스 소모, 관리 부담)
- **SonarCloud**: 유료 ($10/month부터 시작, 서비스 늘어날수록 비용 증가)

스타트업이다 보니 비용과 운영 부담이 부담스러웠습니다.

그러다 찾은 게 **ReviewDog**과 **Jacoco**였습니다:

**Detekt, ReviewDog**
- GitHub Actions에서 바로 실행 가능
- PR에 라인별 코멘트 자동 작성
- 서버 불필요

**Jacoco**
- Java 프로젝트 테스트 커버리지 측정
- Gradle 플러그인으로 간단히 통합
- PR 코멘트에 커버리지 리포트 자동 작성

바로 도입하기 위해 github actions로 구성했습니다.

### 도입 후 효과

도입 효과는 생각보다 더 좋았습니다.

- PR 리뷰 시간 단축 (자동으로 체크되니 리뷰어가 컨벤션 체크에 쓰는 시간 감소)
- 코드 품질 향상 (잠재적 버그 사전 발견)
- 테스트 커버리지 가시화 (PR마다 커버리지 변화 확인 가능)

팀원들도 PR에 데코레이션으로 남은 결과를 보시곤 만족해하셨습니다. ㅎㅎ

---

## 문제 발생: GitHub Actions 무료 사용량 문제

그런데 2~3주쯤 지나니 문제가 생겼습니다.

**사용량을 보아하니 GitHub Actions 무료 사용량을 초과할 수 있겠다 싶었습니다.**

### 사용량 분석

워크플로우가 3개로 늘어났습니다:

| 워크플로우                  | 실행 조건 | 평균 실행 시간 | 비고 |
|------------------------|---------|----------|------|
| jacoco-rule.yml        | PR 생성/수정 시 | 4.60분    | 테스트 실행 + 커버리지 측정 |
| detekt, review-dog.yml | PR 생성/수정 시 | 1.63분    | 정적 분석 |
| ci-cd.yml              | main 머지 시 | 6.18분    | 빌드 + 배포 |

배포 1회당 사용량을 계산해보니:

```
feature → develop 단계 (PR 작업):
- PR 작성부터 머지까지 평균 5회 커밋 가정
- jacoco-rule.yml (4.60분) + review-dog.yml (1.63분) = 6.23분
- 총 5회 실행: 6.23분 × 5 = 31.15분

develop → main 단계 (배포):
- jacoco-rule.yml + review-dog.yml + ci-cd.yml = 12.41분

배포 1회 총합: 31.15분 + 12.41분 = 43.56분
```

**월 2,000분 ÷ 43.56분 = 약 45회 배포**

더 큰 문제는 이 2,000분이 **Organization 전체**에 적용된다는 점이었습니다.

MSA 환경에서 여러 서비스를 운영하다 보니, 한 달에 45회 배포로는 턱없이 부족했습니다.

---

## 고민: 어떻게 해결할 것인가

팀 내에서 논의가 시작됐습니다.

### 고려했던 옵션들

**1. GitHub Actions 유료 플랜으로 전환**
- 가장 간단한 해결책
- 하지만 비용 부담 (월 $4/user)
- 서비스가 계속 늘어나는데 비용도 계속 증가

**2. 정적 분석 도구 제거**
- 사용량 문제는 해결되지만
- 코드 품질 관리는 포기?
- 막 좋아지기 시작한 개발 문화를 다시 되돌리는 건 아니다

**3. Jenkins 구축**
- 장점: 무료, 확장성 좋음
- 단점: CI/CD 파이프라인 전면 재구축 필요
- 당시 상황: 기능 개발에 집중해야 하는 시기, 시간적 여유 없음

**4. Self-hosted Runner**
- GitHub Actions는 Self-hosted Runner 사용 시 **무료 사용량 제한 없음**
- 기존 워크플로우를 그대로 사용 가능 (영향도 최소)
- 빠른 적용 가능 (몇 시간이면 설정 완료)

---

## 해결 시도 1: Self-hosted Runner 도입

고민 끝에 **Self-hosted Runner**를 선택했습니다.

### 왜 Self-hosted Runner였나?

당시 상황을 고려했을 때는 최선의 선택이었던 것 같습니다.

1. **시간적, 금전적 여유가 없었습니다**
   - Jenkins는 파이프라인을 처음부터 다시 작성해야 함
   - 당장 기능 개발에 집중해야 하는 시기
   - CI/CD 재구축에 시간을 쏟을 여력이 없었음
   - 별도로 Jenkins를 구성한다면 추가적인 비용이 불가피

2. **영향도가 거의 없었습니다**
   - 기존 GitHub Actions 워크플로우를 그대로 사용
   - jacoco-rule.yml, review-dog.yml, ci-cd.yml 수정 불필요
   - 단지 실행 환경만 Self-hosted Runner로 바뀔 뿐

3. **빠르게 적용 가능했습니다**
   - Runner 설치와 등록만 하면 끝
   - 몇 시간이면 설정 완료

### Self-hosted Runner 구성

EC2 인스턴스와 팀원들의 Macbook에 GitHub Actions Runner를 설치했습니다.

```bash
# GitHub Actions Runner 다운로드 및 설치
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz

# GitHub Organization에 Runner 등록
./config.sh --url https://github.com/your-organization --token [토큰 값]
```

systemd 서비스로 등록해서 자동 시작되도록 설정했습니다:

```bash
# systemd 서비스 파일 생성
sudo vim /etc/systemd/system/github-runner.service
```

```ini
[Unit]
Description=GitHub Actions Runner
After=network.target

[Service]
ExecStart=/home/ec2-user/actions-runner/run.sh
WorkingDirectory=/home/ec2-user/actions-runner
User=ec2-user
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# 서비스 시작
sudo systemctl daemon-reload
sudo systemctl enable github-runner
sudo systemctl start github-runner
sudo systemctl status github-runner
```

### 초기 결과: 문제 해결!

처음엔 잘 작동했습니다:

✅ GitHub Actions 무료 사용량 문제 해결
✅ 모든 워크플로우 정상 동작
✅ 기존 워크플로우 수정 없이 그대로 사용
✅ 비용 문제 해결

며칠간은 만족스러웠습니다.

---

## 시간이 흐르고... 새로운 문제들

몇 달이 지나면서 상황이 변했습니다.

### 서비스 증가

회사가 성장하면서 MSA 서비스가 계속 늘어났습니다:

```
초기: 5~6개 서비스
현재: 14개 이상 서비스
```

서비스가 늘어나면서 예상하지 못했던 문제들이 하나씩 나타나기 시작했습니다.

### 문제 1: Macbook 발열과 성능 저하

Self-hosted Runner로 등록한 **팀원들의 Macbook**에서 문제가 시작됐습니다.

**증상:**
- CI/CD 파이프라인이 돌아갈 때마다 Macbook 발열 심각
- 시스템 전체가 느려짐
- 코딩하다가 파이프라인 돌아가면 작업 중단 불가피

특히 Gradle 빌드나 Docker 이미지 빌드가 돌아갈 때는 맥북이 뜨거워져서 팬이 계속 돌아가는 상황이었습니다.

**왜 이런 일이?**

Self-hosted Runner는 로컬 머신의 CPU, 메모리를 직접 사용합니다.

Spring Boot 빌드 + Docker 이미지 빌드는 리소스를 많이 소모하는 작업입니다:
- Gradle 빌드: JVM 메모리 2~3GB 사용
- Docker 이미지 빌드: CPU 집약적 작업

개발하면서 동시에 CI/CD가 돌아가니, 맥북이 버티지 못한 겁니다.

### 문제 2: 동시 실행 병목

서비스가 늘어나면서 여러 서비스에서 동시에 배포가 일어나는 경우가 많아졌습니다.

**문제:**
- Runner는 한 번에 하나의 Job만 처리
- 여러 서비스 배포가 동시에 발생하면 순차 처리
- 앞 배포가 끝나야 다음 배포 시작
- 대기 시간 점점 증가

**실제 사례:**

```
12:00 - user-service 배포 시작 (예상 시간: 5분)
12:02 - chat-service 배포 대기 중...
12:04 - match-service 배포 대기 중...
12:05 - user-service 배포 완료
12:05 - chat-service 배포 시작 (예상 시간: 5분)
12:10 - chat-service 배포 완료
12:10 - match-service 배포 시작 (예상 시간: 5분)
12:15 - match-service 배포 완료

총 15분 소요 (동시 실행 시 5분이면 끝날 작업)
```

### 문제 3: 유지보수 부담

Runner가 여러 대 있다 보니:

- 각 Runner의 상태 관리 필요
- 환경 일관성 유지 어려움
  - A Runner: Docker 20.x
  - B Runner: Docker 24.x
  - 어떤 Runner에서 빌드되느냐에 따라 미묘한 차이 발생
- 장애 발생 시 디버깅 복잡
  - "왜 이 빌드는 실패했지? 아, A Runner에서 돌아갔네..."

### 결정적 순간

어느 날, 팀원이 Slack에 메시지를 남겨주셨습니다.

> "정일님.. CI 돌아가는 동안 맥북 너무 느려서 작업이 어렵습니다 ㅠㅜ 다른 방법 없을까요?"

저희는 **비용 문제를 해결하려다 개발자 경험(DX)을 해치고 있었던 겁니다.**

---

## 다시 고민: 근본적인 해결이 필요하다

다시 팀 내에서 논의가 시작됐습니다.

### 다시 검토한 옵션들

**1. EC2 인스턴스만 Self-hosted Runner로 사용?**
- Macbook 발열 문제는 해결
- 하지만 동시 실행 병목은 여전
- 유지보수 부담도 여전
- EC2 인스턴스 추가 비용 발생 (여러 대 띄워야 동시 실행 가능)

**2. GitHub Actions 유료 플랜?**
- 가장 간단한 해결책
- 하지만 서비스가 계속 늘어나는데 비용도 계속 증가
- 월 사용량 예측 어려움

**3. Jenkins?**
- 파이프라인 전면 재구축 필요 (여전히 부담)
- 하지만 이제는 시간적 여유가 생겼음 (초기 개발 단계 지남)
- 스타트업 GCP 크레딧 프로그램 선정으로 비용 부분도 해결 가능한 상태가 됐음
- **Kubernetes 클러스터가 이미 있음** (서비스 배포용으로 운영 중)
- 동적 Pod 프로비저닝으로 리소스 효율적 사용 가능

### 결정: Jenkins로 마이그레이션

고민 끝에 **Jenkins on Kubernetes**로 마이그레이션하기로 결정했습니다.

### 왜 Jenkins였나?

저희 상황을 고려한 결정적 이유들은 다음과 같습니다.

1. **Kubernetes 클러스터가 이미 있었습니다**

회사는 이미 서비스 배포를 위해 Kubernetes를 운영하고 있었습니다.

- 추가 인프라 비용 최소화 (Jenkins를 Kubernetes 위에 띄우면 됨)
- 기존 인프라 활용

**2. 동적 Pod 프로비저닝이 가능합니다**

Jenkins Kubernetes Plugin을 사용하면:
- 파이프라인 실행 시에만 Pod 생성
- 완료 후 자동 삭제
- Macbook에 부담 없음
- 리소스 낭비 없음 (필요할 때만 사용)

**3. 동시 실행 제한이 없습니다**

- 여러 서비스 동시 배포 가능
- Kubernetes가 알아서 스케줄링
- Pod 개수만큼 동시 실행

**4. 확장성과 유연성**

- Jenkinsfile로 파이프라인 코드화
- 복잡한 빌드 로직도 구현 가능
- 서비스가 늘어나도 대응 가능

---

## 구현: Jenkins on Kubernetes 구성

### 아키텍처 개요

Jenkins를 Kubernetes 위에 구성하고, **Jenkins Kubernetes Plugin**을 활용해 동적으로 Agent Pod를 생성하는 구조를 만들었습니다.

```
┌─────────────────────────────────────────────┐
│           Kubernetes Cluster                │
│                                             │
│  ┌───────────────┐                          │
│  │ Jenkins       │                          │
│  │ Controller    │                          │
│  │ (Master Pod)  │                          │
│  └───────┬───────┘                          │
│          │                                  │
│          │ 파이프라인 실행 시                   │
│          ↓                                  │
│  ┌───────────────┐  ┌───────────────┐       │
│  │ Agent Pod #1  │  │ Agent Pod #2  │       │
│  │ (동적 생성)     │  │ (동적 생성)     │ ...   │
│  └───────────────┘  └───────────────┘       │
│                                             │
└─────────────────────────────────────────────┘
```

핵심은 **필요할 때만 Pod를 생성하고, 완료되면 바로 삭제**하는 겁니다.

### 1단계: Jenkins Helm Chart로 설치

Kubernetes에 Jenkins를 설치하기 위해 공식 Helm Chart를 사용했습니다.

```bash
# Jenkins Helm Repository 추가
helm repo add jenkins https://charts.jenkins.io
helm repo update

# jenkins namespace 생성
kubectl create namespace jenkins

# Secret 생성 (GitHub Token, GCP SA Key)
kubectl create secret generic jenkins-secrets \
  --from-literal=github-username=your-username \
  --from-literal=github-token=your-token \
  --from-file=gcp-sa-key-base64=gcp-sa-key.json \
  -n jenkins
```

`jenkins-values.yaml` 파일을 작성했습니다:

```yaml
# jenkins-values.yaml
controller:
  image:
    repository: "jenkins/jenkins"
    tag: "lts-jdk17"

  numExecutors: 0  # Controller에서는 빌드 실행 안함

  nodeSelector:
    node-pool: jenkins  # Jenkins 전용 노드 풀

  # GitHub Credential 환경변수 주입
  containerEnv:
    - name: GITHUB_USERNAME
      valueFrom:
        secretKeyRef:
          name: jenkins-secrets
          key: github-username
    - name: GITHUB_TOKEN
      valueFrom:
        secretKeyRef:
          name: jenkins-secrets
          key: github-token
    - name: GCP_SA_KEY_BASE64
      valueFrom:
        secretKeyRef:
          name: jenkins-secrets
          key: gcp-sa-key-base64

  # Probe 설정 (시작 시간 충분히 확보)
  probes:
    startupProbe:
      failureThreshold: 12
      periodSeconds: 10
      initialDelaySeconds: 60
    livenessProbe:
      failureThreshold: 12
      periodSeconds: 10
      initialDelaySeconds: 180
    readinessProbe:
      failureThreshold: 10
      periodSeconds: 10
      initialDelaySeconds: 60

  # 플러그인 설치
  installPlugins:
    - kubernetes
    - workflow-aggregator
    - git
    - configuration-as-code
    - blueocean
    - job-dsl
    - plain-credentials

  # Ingress 설정
  ingress:
    enabled: true
    ingressClassName: nginx
    hostName: jenkins.example.com
    path: /
    pathType: Prefix

  # JCasC (Jenkins Configuration as Code)
  JCasC:
    defaultConfig: true
    configScripts:
      # Credential 설정
      credentials-config: |
        credentials:
          system:
            domainCredentials:
              - credentials:
                  # GitHub Token
                  - usernamePassword:
                      scope: GLOBAL
                      id: "github-token"
                      username: "${GITHUB_USERNAME}"
                      password: "${GITHUB_TOKEN}"
                  # GCP Service Account Key
                  - file:
                      scope: GLOBAL
                      id: "gcp-sa-key"
                      fileName: "gcp-sa-key.json"
                      secretBytes: "${GCP_SA_KEY_BASE64}"

      # Kubernetes Cloud 설정
      k8s-cloud-config: |
        jenkins:
          clouds:
            - kubernetes:
                name: "kubernetes"
                serverUrl: "https://kubernetes.default"
                skipTlsVerify: true
                namespace: "jenkins"
                jenkinsUrl: "http://jenkins.jenkins.svc.cluster.local:8080"
                jenkinsTunnel: "jenkins-agent.jenkins.svc.cluster.local:50000"
                containerCapStr: "10"

      # Job 설정 (MultiBranch Pipeline)
      jobs-config: |
        jobs:
          - script: >
              multibranchPipelineJob('backend') {
                branchSources {
                  git {
                    id('backend')
                    remote('https://github.com/your-organization/your-backend-repo.git')
                    credentialsId('github-token')
                  }
                }
                orphanedItemStrategy {
                  discardOldItems {
                    numToKeep(20)
                  }
                }
              }

persistence:
  enabled: true
  size: "10Gi"

serviceAccount:
  create: true
  name: jenkins

rbac:
  create: true
  readSecrets: true
```

```bash
# Jenkins 설치
helm install jenkins jenkins/jenkins \
  -f jenkins-values.yaml \
  -n jenkins
```

### 2단계: Jenkinsfile 작성

각 서비스별로 독립된 Pod를 동적으로 생성하는 Jenkinsfile을 작성했습니다.

핵심 아이디어:
1. Git 변경 사항 감지 → 변경된 서비스만 배포
2. 각 서비스별로 독립된 Pod 생성
3. 병렬 실행

```groovy
pipeline {
    agent none  // 마스터 노드에서 가볍게 시작

    parameters {
        booleanParam(name: 'agent-service', defaultValue: false)
        booleanParam(name: 'community-service', defaultValue: false)
        ...
    }

    environment {
        GCP_REGION = "REGION-docker.pkg.dev"
        GCP_PROJECT = "your-gcp-project"
        MANIFEST_REPO = "your-organization/manifest-repo"
    }

    stages {
        stage('Checkout & Plan') {
            agent any
            steps {
                checkout scm
                script {
                    // Git 변경 사항 감지
                    def changedFiles = sh(
                        script: "git diff --name-only HEAD^ HEAD",
                        returnStdout: true
                    ).trim()

                    def services = [
                        'agent-service', 'community-service', ...
                    ]

                    def deployments = [:]

                    // Pod Template YAML 정의
                    def podYaml = """
apiVersion: v1
kind: Pod
spec:
  nodeSelector:
    node-pool: jenkins-agent
  tolerations:
  - key: "node-pool"
    operator: "Equal"
    value: "jenkins-agent"
    effect: "NoSchedule"
  containers:
  - name: gradle
    image: gradle:8.5-jdk17
    command:
    - cat
    tty: true
    resources:
      limits:
        memory: "4Gi"
        cpu: "1.5"
      requests:
        memory: "2Gi"
        cpu: "1000m"
  - name: dind
    image: docker:24.0.7-dind
    securityContext:
      privileged: true
    env:
    - name: DOCKER_TLS_CERTDIR
      value: ""
  - name: utils
    image: bitnami/git:latest
    command:
    - cat
    tty: true
"""

                    // 배포할 서비스 결정 및 병렬 실행
                    services.each { serviceName ->
                        def isManualSelected = params[serviceName] == true
                        def isForceAll = params.FORCE_DEPLOY_ALL == true
                        def isGitChanged = !params.IGNORE_GIT_CHANGES &&
                                          changedFiles.contains("${serviceName}/")
                        def isCommonChanged = !params.IGNORE_GIT_CHANGES &&
                                             changedFiles.contains("common/")

                        if (isManualSelected || isForceAll ||
                            isGitChanged || isCommonChanged) {

                            // 각 서비스별로 독립된 Pod 생성 및 실행
                            deployments[serviceName] = {
                                podTemplate(yaml: podYaml) {
                                    node(POD_LABEL) {
                                        stage("Deploy ${serviceName}") {
                                            checkout scm

                                            // Gradle Build
                                            container('gradle') {
                                                sh """
                                                    ./gradlew :${serviceName}:bootJar \
                                                    -Dorg.gradle.jvmargs='-Xmx3072m -XX:MaxMetaspaceSize=512m'
                                                """
                                            }

                                            // Docker Build & Push
                                            container('dind') {
                                                withCredentials([
                                                    file(credentialsId: 'gcp-sa-key',
                                                         variable: 'GCP_CREDENTIALS')
                                                ]) {
                                                    def fullImageName = "${env.GCP_REGION}/${env.GCP_PROJECT}/${serviceName}:${env.GIT_COMMIT}"
                                                    sh """
                                                        cat \$GCP_CREDENTIALS > /tmp/gcp-key.json
                                                        cat /tmp/gcp-key.json | docker login \
                                                            -u _json_key --password-stdin \
                                                            https://${env.GCP_REGION}

                                                        docker build -t ${fullImageName} ./${serviceName}
                                                        docker push ${fullImageName}
                                                    """
                                                }
                                            }

                                            // Manifest Update (GitOps)
                                            container('utils') {
                                                withCredentials([
                                                    usernamePassword(
                                                        credentialsId: 'github-token',
                                                        usernameVariable: 'GH_USER',
                                                        passwordVariable: 'GH_TOKEN'
                                                    )
                                                ]) {
                                                    sh """
                                                        curl -L https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -o /usr/bin/yq
                                                        chmod +x /usr/bin/yq

                                                        git clone https://\${GH_TOKEN}@github.com/${env.MANIFEST_REPO}.git manifest-repo
                                                        cd manifest-repo

                                                        # yq로 이미지 태그 업데이트
                                                        export NEW_IMAGE="${env.GCP_REGION}/${env.GCP_PROJECT}/${serviceName}:${env.GIT_COMMIT}"
                                                        yq e -i '.spec.template.spec.containers[0].image = env(NEW_IMAGE)' \${serviceName}/deployment.yaml

                                                        git config user.name "Jenkins Pipeline"
                                                        git config user.email "jenkins@example.com"
                                                        git add \${serviceName}/deployment.yaml
                                                        git commit -m "Update ${serviceName} image tag to ${env.GIT_COMMIT}"
                                                        git push origin main
                                                    """
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 병렬 실행
                    if (deployments.size() > 0) {
                        parallel deployments
                    } else {
                        echo "No services to deploy."
                    }
                }
            }
        }
    }
}
```

### 핵심 포인트 설명

#### 1. 동적 Pod 프로비저닝

```groovy
podTemplate(yaml: podYaml) {
    node(POD_LABEL) {
        // 파이프라인 실행
    }
}
```

**동작 방식:**
- 파이프라인 실행 시 Jenkins가 Kubernetes API를 호출해 Pod 생성
- 파이프라인 완료 후 Pod 자동 삭제
- Self-hosted Runner처럼 항상 떠 있을 필요 없음

**장점:**
- 리소스 절약 (필요할 때만 사용)
- 환경 일관성 (매번 새 Pod로 시작)
- Macbook에 부담 전혀 없음

#### 2. 멀티 컨테이너 구성

```yaml
containers:
  - name: gradle      # Gradle 빌드용
  - name: dind        # Docker 빌드용 (Docker in Docker)
  - name: utils       # Git, yq 등 유틸리티용
```

**왜 멀티 컨테이너?**

각 단계에서 필요한 환경이 다릅니다:
- Gradle 빌드: JDK 17 + Gradle
- Docker 빌드: Docker Daemon
- Manifest 업데이트: Git + yq

하나의 컨테이너에 전부 넣으면 이미지가 비대해지고 관리가 어렵습니다.

멀티 컨테이너로 분리하면:
- 각 컨테이너는 필요한 도구만 포함
- 이미지 재사용 가능 (공식 이미지 활용)
- 관심사 분리

#### 3. Git 변경 감지 자동 배포

```groovy
def isGitChanged = changedFiles.contains("${serviceName}/")
```

**동작 방식:**
- `git diff --name-only HEAD^ HEAD`로 변경된 파일 목록 추출
- 각 서비스 디렉토리 확인
- 변경된 서비스만 배포 대상에 포함

**장점:**
- 불필요한 빌드 방지
- 시간 절약
- 리소스 절약

**예시:**

```
변경된 파일:
- user-service/src/main/java/UserController.java
- common/src/main/java/CommonUtil.java

배포 대상:
- user-service (직접 변경)
- 모든 서비스 (common 변경 시)
```

#### 4. 병렬 실행

```groovy
parallel deployments
```

**동작 방식:**
- 배포할 서비스들을 Map에 저장
- `parallel`로 동시 실행
- 각 서비스별로 독립된 Pod 생성

**효과:**

```
Self-hosted Runner (순차 실행):
user-service: 5분
chat-service: 5분
match-service: 5분
총: 15분

Jenkins (병렬 실행):
user-service: 5분
chat-service: 5분  } 동시 실행
match-service: 5분
총: 5분
```

---

## 결과

### Before: Self-hosted Runner

**문제점**
- ❌ 팀원 Macbook 발열로 개발 작업 방해
- ❌ 동시 실행 안 돼서 대기 시간 증가 (15분 → 5분)
- ❌ Runner 관리 부담 (환경 일관성, 상태 관리)
- ❌ 서비스 증가 시 확장성 한계

### After: Jenkins on Kubernetes

**개선사항**

**1. 개발자 경험(DX) 개선**
- Macbook에 부담 전혀 없음
- CI/CD 돌아가는 동안에도 개발자 영향도 없음
- 팀원들 만족도 상승

**2. 배포 시간 단축**
- 동시 실행으로 대기 시간 없음
- 여러 서비스 동시 배포 가능
- 전체 배포 시간 **단축**

**3. 비용 효율성**
- GitHub Actions 과금 없음
- Kubernetes 클러스터 활용으로 추가 인프라 비용 최소화
- 동적 Pod 생성으로 리소스 낭비 방지

**4. 확장성**
- 서비스 추가 시 Jenkinsfile 파라미터만 추가
- 자동 스케일링
- MSA 환경에 적합

**5. 유지보수성**
- Jenkinsfile로 파이프라인 코드화
- GitOps 패턴 적용 (Manifest 자동 업데이트)
- 중앙집중식 관리
- 환경 일관성 (매번 새 Pod로 시작)

### 하지만 새로운 트레이드오프도 생겼습니다

물론 Jenkins on Kubernetes도 완벽한 해결책은 아니었습니다.

**1. Cold Start 문제**

동적 Pod 프로비저닝의 가장 큰 단점입니다.

```
GitHub Actions (Hosted Runner): 즉시 시작
Self-hosted Runner: 즉시 시작 (이미 떠 있음)
Jenkins Pod 프로비저닝: 30초~1분 대기

- Pod 스케줄링: 5~10초
- 컨테이너 이미지 pull: 20~40초 (캐시 없을 시)
- 컨테이너 시작: 5초
```

특히 처음 빌드하거나 한동안 빌드를 안 했을 때, 이미지 캐시가 없으면 더 오래 걸렸습니다.

**해결 방법:**
- Node에 이미지 미리 pull 해두기 (ImagePullPolicy: IfNotPresent)
- 자주 사용하는 이미지는 DaemonSet으로 미리 캐싱

**2. Jenkins 관리 복잡도 증가**

GitHub Actions는 관리할 서버가 없지만, Jenkins는:

- Jenkins Controller Pod 관리 필요
- 플러그인 버전 관리
- JCasC 설정 관리
- Jenkins 업그레이드 시 호환성 이슈

한 번은 Jenkins 플러그인 업데이트 후 Kubernetes Plugin과 호환성 문제로 빌드가 안 되는 일도 있었습니다.

**3. GitHub Actions에 비해 높은 학습 곡선**

GitHub Actions:
- YAML 작성만 하면 됨
- Marketplace에서 Action 가져다 쓰면 됨
- 문서화 잘 되어 있음

Jenkins:
- Groovy 문법 익혀야 함
- Jenkinsfile DSL 이해 필요
- podTemplate 설정 이해 필요
- Kubernetes와 Jenkins 통합 개념 이해 필요

신규 팀원이 Jenkins 파이프라인 수정하는 데 적응 시간이 필요했습니다.

**4. 초기 설정 복잡도**

GitHub Actions:
- Repository에 .github/workflows/ 폴더 만들고 YAML 파일 작성하면 끝

Jenkins on Kubernetes:
- Helm Chart 설정
- Kubernetes Secret 관리
- Credential 설정 (JCasC)
- Kubernetes Cloud 연동 설정
- Jenkinsfile 작성

초기 구축에 약 2~3일 정도 걸렸습니다.

**5. UI/UX**

솔직히 GitHub Actions의 UI/UX가 더 직관적이고 깔끔합니다.

- GitHub Actions: PR과 통합, 로그 보기 편함, 실시간 업데이트
- Jenkins: Blue Ocean 써도 GitHub Actions보단 덜 직관적

### GitHub Actions vs Jenkins: 언제 무엇을 선택해야 할까?

제 경험을 토대로 정리해보자면

**GitHub Actions를 선택하는 게 나은 경우:**

- 팀 규모가 작고 (5명 이하)
- 서비스 개수가 적고 (5개 이하)
- 월 배포 횟수가 적고 (50회 이하)
- 빠르게 CI/CD 구축하고 싶고
- 관리 부담을 최소화하고 싶을 때

**Jenkins on Kubernetes를 선택하는 게 나은 경우:**

- MSA 환경에서 서비스가 많고 (10개 이상)
- 배포가 빈번하고 (월 100회 이상)
- Kubernetes 클러스터가 이미 있고
- 복잡한 빌드 로직이 필요하고
- 비용을 최소화하고 싶을 때

**Self-hosted Runner를 선택하는 게 나은 경우:**

- 임시 방편으로 빠르게 적용하고 싶을 때
- GitHub Actions 워크플로우를 그대로 유지하고 싶을 때
- 단, 서비스가 많아지면 결국 다른 선택을 고려해야 함

---

## 배운 점

### 1. 모든 선택엔 트레이드오프가 있다

Self-hosted Runner를 도입할 때는 그게 **당시엔 최선**이었습니다.

- 시간적 여유가 없었고
- 기존 파이프라인을 유지할 수 있었고
- 비용 문제도 해결됐으니까요

Jenkins on Kubernetes로 마이그레이션했을 때도:

- Macbook 발열 문제는 해결됐지만
- Cold start 지연 시간이 생겼고
- 관리 복잡도가 증가했습니다

**완벽한 CI/CD는 없는 것 같습니다. 각 선택마다 장단점이 있고, 현재 상황에서 가장 중요한 게 무엇인지 파악해서 선택해야 한다고 느꼈습니다.**

### 2. 비용 최적화는 단순히 돈만의 문제가 아니다

처음엔 GitHub Actions 무료 사용량 문제로 시작했지만, 결국 **개발자 경험(DX)** 문제로 귀결됐습니다.

Self-hosted Runner가 Macbook에서 돌아가면서 발열과 성능 저하를 일으켰고, 이게 개발 생산성에 직접적인 영향을 미쳤습니다.

**진짜 비용은 인프라 비용이 아니라 개발자의 시간이 아닐까 싶습니다.**

### 3. Kubernetes는 단순히 오케스트레이션 도구가 아니다

Kubernetes의 동적 Pod 프로비저닝을 활용하니, CI/CD 파이프라인의 리소스 효율성이 크게 개선됐습니다.

필요할 때만 Pod를 생성하고 완료 후 삭제하는 패턴은, Self-hosted Runner처럼 항상 떠 있는 방식보다 훨씬 효율적이었습니다.

**Kubernetes는 서비스 배포뿐 아니라 CI/CD 인프라로도 강력하다고 느꼈습니다.**

### 4. 도구는 트렌드가 아닌 상황에 맞춰 선택해야 한다

실제로 Jenkins를 써보니, **유연성**과 **확장성**이 정말 강력했습니다.

특히 Kubernetes와의 통합은 MSA 환경에 매우 적합했습니다.

**도구의 선택은 트렌드가 아니라 현재 상황과 요구사항에 맞춰야 한다고 느꼈습니다.**

### 5. 문제 해결은 단계적으로

```
1단계: GitHub Actions 무료 사용량 부족
   → Self-hosted Runner 도입

2단계: Self-hosted Runner 성능 문제
   → Jenkins 마이그레이션
```

각 단계에서 겪은 문제를 해결하면서, 점진적으로 더 나은 방향으로 발전할 수 있었습니다.

**한 번에 완벽한 해결책을 찾으려 하지 말고, 지금 당장의 문제를 해결하면서 점진적으로 개선해나가는 게 중요하다고 느꼈습니다.**

---

## 마치며

CI/CD는 한 번 구성하면 끝이 아니더라구요.

팀의 규모, 서비스의 개수, 비용, 성능 등 여러 요소를 고려해서 지속적으로 개선해나가야 한다고 느꼈습니다.

저희는 **GitHub Actions → Self-hosted Runner → Jenkins on Kubernetes**로 진화했고, 현재는 안정적으로 운영 중입니다.

물론 이게 완벽한 해결책은 아니라고 생각합니다. 시간이 지나면 또 다른 문제가 생길 수 있고, 그때는 또 고민하고 개선해나가야겠죠.

혹시 비슷한 고민을 하고 계신 분들께 이 글이 도움이 되길 바랍니다.

---

## Reference

- [GitHub Actions billing - GitHub Docs](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Self-hosted runners - GitHub Docs](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/about-self-hosted-runners)
- [Jenkins Kubernetes Plugin - Official Documentation](https://plugins.jenkins.io/kubernetes/)
- [GitHub - jenkinsci/kubernetes-plugin](https://github.com/jenkinsci/kubernetes-plugin)
- [Jenkins on Kubernetes: Dynamic Agents & Effortless Scalability](https://dev.to/alex_aslam/jenkins-on-kubernetes-dynamic-agents-effortless-scalability-for-modern-cicd-2ff3)
- [How to Setup Jenkins Build Agents on Kubernetes Pods](https://devopscube.com/jenkins-build-agents-kubernetes/)
