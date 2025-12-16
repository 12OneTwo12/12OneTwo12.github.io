---
title: "Solving GitHub Actions Free Tier Limits: Our Journey from Self-hosted Runners to Jenkins"
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

Hello! I'm Jeongil Jeong, a 3-year backend developer working at a proptech platform.

This is the story of trial and error we experienced while improving our CI/CD pipeline at the company.

I'd like to share our journey from starting with GitHub Actions, through Self-hosted Runners, to finally settling on Jenkins on Kubernetes.

---

## Beginning: Starting with GitHub Actions

Our company is a proptech startup. We built our backend with MSA (Microservices Architecture), initially starting with about 5-6 services.

For CI/CD, we were using **GitHub Actions**.

The workflow was simple at the time:

```yaml
# Original ci-cd.yml (simple version)
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

We only performed simple builds and deployments, and GitHub Actions' free plan (2,000 minutes per month for Organizations) was sufficient.

---

## Turning Point: The Need for Code Quality Improvement

As time passed, the company grew and our services gradually increased.

Naturally, concerns about **code quality management** arose:

### Problems We Faced

1. **Increased PR Review Burden**
   - Although the team was small, as PRs increased, reviewers started missing code convention violations
   - "Can't we automatically check things we point out in every review?"

2. **Difficulty Managing Test Coverage**
   - We were writing tests, but it was hard to visually check the coverage
   - No way to know if coverage was increasing or decreasing with each PR

3. **Difficulty Finding Potential Bugs**
   - Human limitations in finding simple mistakes (missing null checks, unreleased resources, etc.)

To solve these problems, we decided to introduce **static analysis tools** and **test coverage tools**.

### Tool Selection Process

Initially, we considered **SonarQube** or **SonarCloud**.

However:
- **SonarQube**: Requires running our own server (infrastructure resource consumption, management burden)
- **SonarCloud**: Paid service (starting from $10/month, cost increases with more services)

As a startup, the cost and operational burden were concerning.

Then we found **Detekt, ReviewDog** and **Jacoco**:

**Detekt, ReviewDog**
- Can run directly in GitHub Actions
- Automatically posts line-by-line comments on PRs
- No server required

**Jacoco**
- Measures test coverage for Java projects
- Simple integration with Gradle plugin
- Automatically posts coverage reports in PR comments

We configured them with GitHub Actions for immediate adoption.

### Results After Introduction

The results were better than expected:

- Reduced PR review time (reviewers spend less time checking conventions)
- Improved code quality (early detection of potential bugs)
- Visualized test coverage (can check coverage changes with each PR)

Team members were satisfied seeing the results as decorations on their PRs. haha

---

## Problem Arises: GitHub Actions Free Usage Issue

About 2-3 weeks later, a problem emerged.

**Looking at our usage, we realized we might exceed GitHub Actions' free tier.**

### Usage Analysis

Our workflows increased to 3:

| Workflow | Trigger | Avg Runtime | Note |
|---------|---------|-------------|------|
| jacoco-rule.yml | PR creation/update | 4.60 min | Test execution + coverage measurement |
| detekt, review-dog.yml | PR creation/update | 1.63 min | Static analysis |
| ci-cd.yml | main merge | 6.18 min | Build + deployment |

Calculating usage per deployment:

```
feature → develop stage (PR work):
- Assuming average 5 commits from PR creation to merge
- jacoco-rule.yml (4.60 min) + review-dog.yml (1.63 min) = 6.23 min
- Total 5 executions: 6.23 min × 5 = 31.15 min

develop → main stage (deployment):
- jacoco-rule.yml + review-dog.yml + ci-cd.yml = 12.41 min

Total per deployment: 31.15 min + 12.41 min = 43.56 min
```

**2,000 minutes per month ÷ 43.56 min = approximately 45 deployments**

The bigger problem was that this 2,000 minutes applied to the **entire Organization**.

In an MSA environment running multiple services, 45 deployments per month was far from sufficient.

---

## Consideration: How to Solve This

Team discussions began.

### Options We Considered

**1. Switch to GitHub Actions Paid Plan**
- Simplest solution
- But cost burden ($4/user per month)
- Costs continue to increase as services grow

**2. Remove Static Analysis Tools**
- Would solve usage problem
- But give up code quality management?
- Not willing to reverse the improving development culture

**3. Build Jenkins**
- Pros: Free, good scalability
- Cons: Need to rebuild entire CI/CD pipeline
- Current situation: Focusing on feature development, no time to spare

**4. Self-hosted Runner**
- GitHub Actions has **no free usage limit** when using Self-hosted Runner
- Can use existing workflows as-is (minimal impact)
- Quick to implement (setup complete in a few hours)

---

## Solution Attempt 1: Introducing Self-hosted Runner

After consideration, we chose **Self-hosted Runner**.

### Why Self-hosted Runner?

Considering the situation at the time, it seemed like the best choice:

1. **We had no time or budget to spare**
   - Jenkins would require rewriting pipelines from scratch
   - We needed to focus on feature development
   - No capacity to spend on CI/CD reconstruction
   - Setting up separate Jenkins would inevitably incur additional costs

2. **Almost no impact**
   - Use existing GitHub Actions workflows as-is
   - No need to modify jacoco-rule.yml, review-dog.yml, ci-cd.yml
   - Only the execution environment changes to Self-hosted Runner

3. **Quick to implement**
   - Just install and register Runner
   - Setup complete in a few hours

### Self-hosted Runner Configuration

We installed GitHub Actions Runner on EC2 instances and team members' Macbooks.

```bash
# Download and install GitHub Actions Runner
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz

# Register Runner to GitHub Organization
./config.sh --url https://github.com/your-organization --token [token value]
```

We configured it as a systemd service for auto-start:

```bash
# Create systemd service file
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
# Start service
sudo systemctl daemon-reload
sudo systemctl enable github-runner
sudo systemctl start github-runner
sudo systemctl status github-runner
```

### Initial Results: Problem Solved!

Initially, it worked well:

✅ GitHub Actions free usage problem solved
✅ All workflows functioning normally
✅ Using existing workflows without modification
✅ Cost problem resolved

We were satisfied for a few days.

---

## Time Passes... New Problems Emerge

As months passed, the situation changed.

### Service Growth

As the company grew, MSA services continued to increase:

```
Initial: 5-6 services
Current: 14+ services
```

As services increased, unexpected problems began to emerge one by one.

### Problem 1: Macbook Overheating and Performance Degradation

Problems started with **team members' Macbooks** registered as Self-hosted Runners.

**Symptoms:**
- Severe Macbook overheating whenever CI/CD pipeline runs
- Entire system slows down
- Work disruption inevitable when pipeline runs during coding

Especially during Gradle builds or Docker image builds, Macbooks would heat up and fans would run constantly.

**Why did this happen?**

Self-hosted Runner directly uses the local machine's CPU and memory.

Spring Boot build + Docker image build are resource-intensive tasks:
- Gradle build: Uses 2-3GB of JVM memory
- Docker image build: CPU-intensive task

When CI/CD runs while developing, the Macbook couldn't handle it.

### Problem 2: Concurrent Execution Bottleneck

As services increased, multiple deployments often occurred simultaneously.

**Problem:**
- Runner processes only one Job at a time
- Sequential processing when multiple service deployments occur
- Next deployment waits until previous one finishes
- Gradually increasing wait times

**Real Example:**

```
12:00 - user-service deployment starts (expected time: 5 min)
12:02 - chat-service deployment waiting...
12:04 - match-service deployment waiting...
12:05 - user-service deployment complete
12:05 - chat-service deployment starts (expected time: 5 min)
12:10 - chat-service deployment complete
12:10 - match-service deployment starts (expected time: 5 min)
12:15 - match-service deployment complete

Total 15 minutes (would take 5 minutes with concurrent execution)
```

### Problem 3: Maintenance Burden

With multiple Runners:

- Need to manage each Runner's state
- Difficulty maintaining environment consistency
  - Runner A: Docker 20.x
  - Runner B: Docker 24.x
  - Subtle differences depending on which Runner builds
- Complex debugging when failures occur
  - "Why did this build fail? Oh, it ran on Runner A..."

### Decisive Moment

One day, a team member left a message on Slack:

> "Jeongil.. My Macbook is so slow during CI that I can't work ㅠㅜ Is there another way?"

**We were harming developer experience (DX) while trying to solve cost problems.**

---

## Reconsidering: Need for Fundamental Solution

Team discussions began again.

### Options Reconsidered

**1. Use Only EC2 Instances as Self-hosted Runner?**
- Solves Macbook overheating problem
- But concurrent execution bottleneck remains
- Maintenance burden remains
- Additional EC2 instance costs (need multiple instances for concurrent execution)

**2. GitHub Actions Paid Plan?**
- Simplest solution
- But costs continue to increase as services grow
- Difficult to predict monthly usage

**3. Jenkins?**
- Still requires complete pipeline reconstruction (still burdensome)
- But now we have time (past initial development stage)
- Startup GCP credit program selection made cost aspect solvable
- **Already have Kubernetes cluster** (running for service deployment)
- Can use resources efficiently with dynamic Pod provisioning

### Decision: Migrate to Jenkins

After deliberation, we decided to migrate to **Jenkins on Kubernetes**.

### Why Jenkins?

The decisive reasons considering our situation were as follows:

**1. We already had a Kubernetes cluster**

The company was already running Kubernetes for service deployment.

- Minimize additional infrastructure costs (just deploy Jenkins on Kubernetes)
- Utilize existing infrastructure

**2. Dynamic Pod provisioning is possible**

Using Jenkins Kubernetes Plugin:
- Create Pods only when pipeline runs
- Automatically delete after completion
- No burden on Macbooks
- No resource waste (use only when needed)

**3. No concurrent execution limits**

- Can deploy multiple services simultaneously
- Kubernetes handles scheduling
- Concurrent execution up to the number of Pods

**4. Scalability and Flexibility**

- Codify pipeline with Jenkinsfile
- Can implement complex build logic
- Can handle increasing services

---

## Implementation: Configuring Jenkins on Kubernetes

### Architecture Overview

We deployed Jenkins on Kubernetes and created a structure that dynamically generates Agent Pods using **Jenkins Kubernetes Plugin**.

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
│          │ When pipeline executes           │
│          ↓                                  │
│  ┌───────────────┐  ┌───────────────┐       │
│  │ Agent Pod #1  │  │ Agent Pod #2  │       │
│  │ (Dynamic)     │  │ (Dynamic)     │ ...   │
│  └───────────────┘  └───────────────┘       │
│                                             │
└─────────────────────────────────────────────┘
```

The key is **creating Pods only when needed and deleting them immediately after completion**.

### Step 1: Install with Jenkins Helm Chart

We used the official Helm Chart to install Jenkins on Kubernetes.

```bash
# Add Jenkins Helm Repository
helm repo add jenkins https://charts.jenkins.io
helm repo update

# Create jenkins namespace
kubectl create namespace jenkins

# Create Secret (GitHub Token, GCP SA Key)
kubectl create secret generic jenkins-secrets \
  --from-literal=github-username=your-username \
  --from-literal=github-token=your-token \
  --from-file=gcp-sa-key-base64=gcp-sa-key.json \
  -n jenkins
```

We created a `jenkins-values.yaml` file:

```yaml
# jenkins-values.yaml
controller:
  image:
    repository: "jenkins/jenkins"
    tag: "lts-jdk17"

  numExecutors: 0  # Don't run builds on Controller

  nodeSelector:
    node-pool: jenkins  # Dedicated Jenkins node pool

  # Inject GitHub Credential environment variables
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

  # Probe settings (ensure sufficient startup time)
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

  # Install plugins
  installPlugins:
    - kubernetes
    - workflow-aggregator
    - git
    - configuration-as-code
    - blueocean
    - job-dsl
    - plain-credentials

  # Ingress settings
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
      # Credential configuration
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

      # Kubernetes Cloud configuration
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

      # Job configuration (MultiBranch Pipeline)
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
# Install Jenkins
helm install jenkins jenkins/jenkins \
  -f jenkins-values.yaml \
  -n jenkins
```

### Step 2: Write Jenkinsfile

We wrote a Jenkinsfile that dynamically creates independent Pods for each service.

Core ideas:
1. Detect Git changes → Deploy only changed services
2. Create independent Pod for each service
3. Parallel execution

```groovy
pipeline {
    agent none  // Start lightly on master node

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
                    // Detect Git changes
                    def changedFiles = sh(
                        script: "git diff --name-only HEAD^ HEAD",
                        returnStdout: true
                    ).trim()

                    def services = [
                        'agent-service', 'community-service', ...
                    ]

                    def deployments = [:]

                    // Define Pod Template YAML
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

                    // Determine services to deploy and execute in parallel
                    services.each { serviceName ->
                        def isManualSelected = params[serviceName] == true
                        def isForceAll = params.FORCE_DEPLOY_ALL == true
                        def isGitChanged = !params.IGNORE_GIT_CHANGES &&
                                          changedFiles.contains("${serviceName}/")
                        def isCommonChanged = !params.IGNORE_GIT_CHANGES &&
                                             changedFiles.contains("common/")

                        if (isManualSelected || isForceAll ||
                            isGitChanged || isCommonChanged) {

                            // Create and run independent Pod for each service
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

                                                        # Update image tag with yq
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

                    // Execute in parallel
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

### Key Points Explained

#### 1. Dynamic Pod Provisioning

```groovy
podTemplate(yaml: podYaml) {
    node(POD_LABEL) {
        // Pipeline execution
    }
}
```

**How it works:**
- Jenkins calls Kubernetes API to create Pod when pipeline runs
- Automatically delete Pod after pipeline completes
- No need to be always running like Self-hosted Runner

**Benefits:**
- Resource savings (use only when needed)
- Environment consistency (start with new Pod every time)
- No burden on Macbooks

#### 2. Multi-container Configuration

```yaml
containers:
  - name: gradle      # For Gradle build
  - name: dind        # For Docker build (Docker in Docker)
  - name: utils       # For utilities like Git, yq
```

**Why multi-container?**

Each stage requires different environments:
- Gradle build: JDK 17 + Gradle
- Docker build: Docker Daemon
- Manifest update: Git + yq

Putting everything in one container makes the image bloated and hard to manage.

Separating into multi-containers:
- Each container contains only necessary tools
- Can reuse images (utilize official images)
- Separation of concerns

#### 3. Git Change Detection Auto-deployment

```groovy
def isGitChanged = changedFiles.contains("${serviceName}/")
```

**How it works:**
- Extract changed file list with `git diff --name-only HEAD^ HEAD`
- Check each service directory
- Include only changed services in deployment targets

**Benefits:**
- Prevent unnecessary builds
- Save time
- Save resources

**Example:**

```
Changed files:
- user-service/src/main/java/UserController.java
- common/src/main/java/CommonUtil.java

Deployment targets:
- user-service (direct change)
- All services (when common changes)
```

#### 4. Parallel Execution

```groovy
parallel deployments
```

**How it works:**
- Store services to deploy in Map
- Execute simultaneously with `parallel`
- Create independent Pod for each service

**Effect:**

```
Self-hosted Runner (sequential execution):
user-service: 5 min
chat-service: 5 min
match-service: 5 min
Total: 15 min

Jenkins (parallel execution):
user-service: 5 min
chat-service: 5 min  } Concurrent execution
match-service: 5 min
Total: 5 min
```

---

## Results

### Before: Self-hosted Runner

**Problems**
- ❌ Team member Macbook overheating disrupting development work
- ❌ No concurrent execution causing increased wait times
- ❌ Runner management burden (environment consistency, state management)
- ❌ Scalability limitations with increasing services

### After: Jenkins on Kubernetes

**Improvements**

**1. Developer Experience (DX) Improvement**
- No burden on Macbooks
- No developer impact during CI/CD runs
- Increased team satisfaction

**2. Reduced Deployment Time**
- No wait time with concurrent execution
- Can deploy multiple services simultaneously
- Overall deployment time **reduced**

**3. Cost Efficiency**
- No GitHub Actions charges
- Minimize additional infrastructure costs by utilizing Kubernetes cluster
- Prevent resource waste with dynamic Pod creation

**4. Scalability**
- Just add Jenkinsfile parameters when adding services
- Auto-scaling
- Suitable for MSA environment

**5. Maintainability**
- Codify pipeline with Jenkinsfile
- Apply GitOps pattern (automatic Manifest updates)
- Centralized management
- Environment consistency (start with new Pod every time)

### But New Trade-offs Emerged

Of course, Jenkins on Kubernetes wasn't a perfect solution either.

**1. Cold Start Problem**

The biggest drawback of dynamic Pod provisioning.

```
GitHub Actions (Hosted Runner): Starts immediately
Self-hosted Runner: Starts immediately (already running)
Jenkins Pod provisioning: 30 seconds~1 minute wait

- Pod scheduling: 5-10 seconds
- Container image pull: 20-40 seconds (without cache)
- Container startup: 5 seconds
```

Especially when building for the first time or after not building for a while, it took longer without image cache.

**Solutions:**
- Pre-pull images on Nodes (ImagePullPolicy: IfNotPresent)
- Pre-cache frequently used images with DaemonSet

**2. Increased Jenkins Management Complexity**

While GitHub Actions has no server to manage, Jenkins requires:

- Jenkins Controller Pod management
- Plugin version management
- JCasC configuration management
- Compatibility issues during Jenkins upgrades

Once, after a Jenkins plugin update, builds failed due to compatibility issues with the Kubernetes Plugin.

**3. Higher Learning Curve Compared to GitHub Actions**

GitHub Actions:
- Just write YAML
- Use Actions from Marketplace
- Well documented

Jenkins:
- Need to learn Groovy syntax
- Need to understand Jenkinsfile DSL
- Need to understand podTemplate configuration
- Need to understand Kubernetes and Jenkins integration concepts

New team members needed adaptation time to modify Jenkins pipelines.

**4. Initial Setup Complexity**

GitHub Actions:
- Just create .github/workflows/ folder and write YAML file

Jenkins on Kubernetes:
- Helm Chart configuration
- Kubernetes Secret management
- Credential configuration (JCasC)
- Kubernetes Cloud integration setup
- Jenkinsfile writing

Initial setup took about 2-3 days.

**5. UI/UX**

To be honest, GitHub Actions' UI/UX is more intuitive and cleaner.

- GitHub Actions: PR integration, easy log viewing, real-time updates
- Jenkins: Even with Blue Ocean, less intuitive than GitHub Actions

### GitHub Actions vs Jenkins: When to Choose What?

Based on my experience:

**When GitHub Actions is better:**

- Small team size (5 or fewer)
- Few services (5 or fewer)
- Infrequent deployments (50 or fewer per month)
- Want to quickly set up CI/CD
- Want to minimize management burden

**When Jenkins on Kubernetes is better:**

- Many services in MSA environment (10 or more)
- Frequent deployments (100+ per month)
- Already have Kubernetes cluster
- Need complex build logic
- Want to minimize costs

**When Self-hosted Runner is better:**

- Want quick application as temporary measure
- Want to keep GitHub Actions workflows as-is
- However, should consider other options as services increase

---

## Lessons Learned

### 1. Every Choice Has Trade-offs

When we introduced Self-hosted Runner, it was **the best choice at the time**.

- We had no time to spare
- Could maintain existing pipeline
- Solved cost problem

When we migrated to Jenkins on Kubernetes:

- Macbook overheating problem was solved, but
- Cold start delay was introduced
- Management complexity increased

**It seems there's no perfect CI/CD. Each choice has pros and cons, and we need to identify what's most important in the current situation and choose accordingly.**

### 2. Cost Optimization Isn't Just About Money

We started with GitHub Actions free usage problem, but it ultimately came down to **developer experience (DX)**.

Self-hosted Runner running on Macbooks caused overheating and performance degradation, directly impacting developer productivity.

**The real cost might not be infrastructure cost but developer time.**

### 3. Kubernetes Is More Than Just an Orchestration Tool

Utilizing Kubernetes' dynamic Pod provisioning greatly improved CI/CD pipeline resource efficiency.

The pattern of creating Pods only when needed and deleting them after completion was much more efficient than Self-hosted Runner's always-on approach.

**Kubernetes is powerful not only for service deployment but also as CI/CD infrastructure.**

### 4. Choose Tools Based on Situation, Not Trends

Actually using Jenkins, the **flexibility** and **scalability** were really powerful.

Especially integration with Kubernetes was very suitable for MSA environments.

**Tool selection should be based on current situation and requirements, not trends.**

### 5. Problem Solving Is Incremental

```
Stage 1: GitHub Actions free usage shortage
   → Introduced Self-hosted Runner

Stage 2: Self-hosted Runner performance issues
   → Migrated to Jenkins
```

By solving problems at each stage, we could gradually evolve in a better direction.

**Rather than trying to find the perfect solution at once, it's important to solve immediate problems while gradually improving.**

---

## Conclusion

CI/CD isn't finished once configured.

We need to continuously improve considering various factors like team size, number of services, cost, and performance.

We evolved from **GitHub Actions → Self-hosted Runner → Jenkins on Kubernetes**, and are currently operating stably.

Of course, this isn't a perfect solution. More problems may arise over time, and we'll need to consider and improve again then.

I hope this post helps those with similar concerns.

Especially if you're thinking "Self-hosted Runner is free," I'd recommend considering the **Jenkins + Kubernetes combination** from the start if you have many services in an MSA environment.

---

## Reference

- [GitHub Actions billing - GitHub Docs](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Self-hosted runners - GitHub Docs](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/about-self-hosted-runners)
- [Jenkins Kubernetes Plugin - Official Documentation](https://plugins.jenkins.io/kubernetes/)
- [GitHub - jenkinsci/kubernetes-plugin](https://github.com/jenkinsci/kubernetes-plugin)
- [Jenkins on Kubernetes: Dynamic Agents & Effortless Scalability](https://dev.to/alex_aslam/jenkins-on-kubernetes-dynamic-agents-effortless-scalability-for-modern-cicd-2ff3)
- [How to Setup Jenkins Build Agents on Kubernetes Pods](https://devopscube.com/jenkins-build-agents-kubernetes/)
