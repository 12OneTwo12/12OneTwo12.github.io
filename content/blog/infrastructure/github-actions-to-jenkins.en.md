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

Our company is a proptech startup. We built our backend with MSA (Microservices Architecture), initially starting with about 5-6 services. We were already using **GitHub Actions** for CI/CD.

The workflow was quite simple at the time. Here's a simplified example:

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

We only performed simple builds and deployments, and at the time, GitHub Actions' free plan (2,000 minutes per month for Organizations) was sufficient.

---

## Turning Point: The Need for Code Quality Improvement

As time passed, both the company and our architecture gradually grew, and consequently, our services increased.

Naturally, concerns and interest about **code quality management** began to arise.

### Problems We Faced

1. **Increased PR Review Burden**
   - Although the team was small, as PRs increased, reviewers started missing code convention violations.
   - "I wish we could automatically check these conventions."

2. **Difficulty Managing Test Coverage**
   - We were writing tests, but it was hard to visually check the coverage.
   - To check, individuals had to verify locally.
   - Also, there was no way to know if coverage was increasing or decreasing with each PR.

3. **Difficulty Finding Potential Bugs**
   - Simple mistakes (missing null checks, unreleased resources, etc.) could be missed when humans had to find them all.

To solve these problems, we decided to introduce **static analysis tools** and **test coverage tools**.

### Tool Selection Process

Initially, we considered **SonarQube** or **SonarCloud**.

However:
- **SonarQube**: Requires running our own server (infrastructure resource consumption, management burden)
- **SonarCloud**: Paid service (starting from $10/month, cost increases with more services)

As a startup, there were personnel and cost limitations to operating with such tools, making it burdensome.

Then we found **ReviewDog** and **Jacoco**.

**Detekt, ReviewDog**
- Detekt is a Kotlin static analysis tool.
- ReviewDog is a tool that posts results from various static analysis tools as PR comments.
- With these two tools and GitHub Actions, we could automatically write line-by-line comments for PR review.
- Since they could run based on GitHub Actions, no separate server was needed.

**Jacoco**
- A test coverage measurement tool for Java projects.
- Simple integration with Gradle plugin.
- Can also automatically post coverage reports in PR comments.

After not much deliberation, we started adopting these tools.

### Results After Introduction

The results were better than expected:

- Reduced PR review time (reviewers spend less time checking conventions)
- Improved code quality (early detection of potential bugs)
- Visualized test coverage (can check coverage changes with each PR)

Team members were pleased seeing the results as decorations on their PRs after I configured these tools. haha

---

## Problem Arises: GitHub Actions Free Usage Issue

About 2-3 weeks later, I became aware of a potential problem.

**Looking at our usage, we realized we might exceed GitHub Actions' free tier.**

The GitHub Actions free tier is **2,000 minutes per month per Organization**, which I had overlooked.

### Usage Analysis

With the addition of **ReviewDog** and **Jacoco** workflows, our workflows increased to 3 including CI/CD:

| Workflow | Trigger | Avg Runtime | Note |
|---------|---------|-------------|------|
| jacoco-rule.yml | PR creation/update | 4.60 min | Test execution + coverage measurement |
| detekt, review-dog.yml | PR creation/update | 1.63 min | Static analysis |
| ci-cd.yml | main merge | 6.18 min | Build + deployment |

Roughly calculating usage per deployment:

```
feature → develop stage (PR work):
- Assuming average 5 commits from PR creation to merge
- jacoco-rule.yml (4.60 min) + review-dog.yml (1.63 min) = 6.23 min
- Total 5 executions: 6.23 min × 5 = 31.15 min

develop → main stage (deployment):
- jacoco-rule.yml + review-dog.yml + ci-cd.yml = 12.41 min

Total per deployment: 31.15 min + 12.41 min = 43.56 min
```

**2,000 minutes per month ÷ 43.56 min = approximately 45 deployments** was what we could do.

The bigger problem was that this 2,000 minutes applied to the **entire Organization**.

In an MSA environment running multiple services, 45 deployments per month was quite insufficient.

---

## Consideration: How to Solve This

Team discussions began. We considered various options, which were as follows:

### Options We Considered

**1. Switch to GitHub Actions Paid Plan**
- This was the simplest solution. However, the cost was burdensome.
- It was predicted that costs would continue to increase as services grew.

**2. Remove Static Analysis Tools**
- Would solve usage problem, but would giving up code quality management be right?
- We concluded it wasn't right to reverse the improving development culture.

**3. Build Jenkins**
- Pros: Free, good scalability
- Cons: Need to rebuild entire CI/CD pipeline
- At the time, we were focusing on feature development and had no time to spare. Also, since we didn't have Kubernetes configured at the time, we would have to operate a separate instance for Jenkins.

**4. Self-hosted Runner**
- GitHub Actions has **no free usage limit** when using Self-hosted Runner (I recently received a notice that starting March 2026, there will be a charge of $0.002 per minute)
- Being able to use existing workflows as-is was a big advantage (minimal impact)
- Quick implementation was also an advantage (setup complete in a few hours)

---

## Solution Attempt 1: Introducing Self-hosted Runner

After consideration, we chose **Self-hosted Runner**.

### Why Self-hosted Runner?

Considering the situation at the time, it seemed like the best choice.

1. **We had no time or budget to spare**
   - Jenkins would require rewriting pipelines from scratch, so troubleshooting would be necessary, and building Jenkins separately would also be needed.
   - At the time, we were focusing on feature development and had no time to spare.
   - Also, as mentioned, we would have to operate a separate instance, so setting up Jenkins would inevitably incur additional costs.

2. **Almost no impact**
   - Being able to use existing GitHub Actions workflows as-is was a big advantage.
   - jacoco-rule.yml, review-dog.yml, and ci-cd.yml required almost no modification. After all, only the execution environment changes to Self-hosted Runner (though some configuration changes were needed).

3. **Quick to implement**
   - Just install and register Runner.

### Self-hosted Runner Configuration

So I asked team members to install GitHub Actions Runner on their Macbooks.

```bash
# Download and install GitHub Actions Runner
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz

# Register Runner to GitHub Organization
./config.sh --url https://github.com/your-organization --token [token value]
```

I also shared a guide on how to configure it to start automatically when the PC boots.

### Initial Results: Problem Solved!

As a result, initially it worked very well:

- GitHub Actions free usage problem was solved
- All workflows functioned normally

We were satisfied for a few months.

---

## Time Passes... New Problems Emerge

As months passed, the situation changed significantly.

### Service Growth

As the company grew, MSA services continued to increase, and consequently the number of workflow executions increased.

```
Initial: 5-6 services
Current: 14+ services
```

As the frequency increased, the **limitations of Self-hosted Runners based on team members' PCs** began to show. 😢

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

> By the way, my laptop actually had the worst overheating and performance degradation... haha I'm sorry team members ㅠㅜ

### Problem 2: Concurrent Execution Bottleneck

Also, as services increased, multiple deployments often occurred simultaneously.

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

This was a critical bottleneck for fast deployment.

### Problem 3: Maintenance Burden

With multiple Runners, the maintenance burden also increased:

- Need to manage each Runner's state
- Difficulty maintaining environment consistency
  - Runner A: Docker 20.x
  - Runner B: Docker 24.x
  - Subtle differences depending on which Runner builds
- Complex debugging when failures occur
  - "Why did this build fail? Oh, it ran on Runner A... I need to check that machine's status."

### Decisive Moment

One day, a team member left a message on Slack:

> "Jeongil.. My Macbook is so slow during CI that I can't work ㅠㅜ Is there another way?"

**We were severely harming developer experience (DX) while trying to solve cost problems.**
That day, we decided **"We need a more fundamental solution."**

---

## Reconsidering: Need for Fundamental Solution

Team discussions began again. We needed to reconsider our previous deliberations.

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

1. **We already had a Kubernetes cluster**

At this time, we had already migrated service deployment to Kubernetes, so we were running Kubernetes.
If you'd like to see the related experience, please check this article: [From a Team Without Dev Servers to GitOps: Starting Kubernetes Adoption from Scratch]({{< relref "/blog/infrastructure/docker-compose-to-k8s" >}})

We were also selected for GCP's startup credit support program, which greatly reduced our cost burden. Therefore, we could operate Jenkins without significant additional cost burden.

**2. Dynamic Pod provisioning is possible**

Using Jenkins Kubernetes Plugin, we can dynamically create Agent Pods:
- Create Pods only when pipeline runs
- Automatically delete after completion
- No resource waste (use only when needed)

**3. Also, there are no concurrent execution limits**

Moving workflows to Jenkins pipelines eliminates concurrent execution limits. We could run multiple pipelines in parallel, solving the deployment bottleneck.

For these reasons, we decided to migrate to Jenkins on Kubernetes.

---

## Implementation: Configuring Jenkins on Kubernetes

### Architecture Overview

When initially configuring Jenkins, I deliberated a lot about whether to operate only one Master or to create a structure that dynamically generates Agents.
However, if all builds are concentrated on the Master, resource waste would be severe and scalability would drop, so I decided on a structure that dynamically creates Pods.

As decided, we deployed Jenkins on Kubernetes and created a structure that dynamically generates Agent Pods using **Jenkins Kubernetes Plugin**.
The rough architecture is as follows:

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

The key is **creating Pods only when needed and deleting them immediately after completion**. This way, there's no need to keep nodes allocated for Jenkins unnecessarily, and resources can be used efficiently.
I also configured K8s Taints and Node Selectors so Jenkins Pods are scheduled only on a dedicated Jenkins node pool to prevent Jenkins Pods from affecting servers.
The Jenkins dedicated node pool has auto-scaling configured with a minimum count of 0, dynamically expanding and contracting. This way, when Jenkins is not in use, there are 0 nodes, so costs are not incurred, which is how I configured it.

### Step 1: Install with Jenkins Helm Chart

We used the official Helm Chart to install Jenkins on Kubernetes. Using Helm Chart makes installation and management much easier by utilizing the various configuration options it provides.

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
- Jenkins calls Kubernetes API to create Pod when pipeline runs.
- Pods are automatically deleted after pipeline completes.
- This way, there's no need to always be running like Self-hosted Runner.

```yml
  nodeSelector:
    node-pool: jenkins-agent
  tolerations:
    - key: "node-pool"
      operator: "Equal"
      value: "jenkins-agent"
      effect: "NoSchedule"
```

Thanks to the above configuration, Jenkins Agent Pods are scheduled only on the Jenkins dedicated node pool. As mentioned above, since the node pool is configured with auto-scaling and the minimum count is set to 0, when Jenkins is not in use, there are 0 nodes, so costs are not incurred.

**Benefits:**
- Resource savings (use only when needed)
- Environment consistency (start with new Pod every time)
- No burden on Macbooks
- Cost reduction through node pool auto-scaling

#### 2. Multi-container Configuration

```yaml
containers:
  - name: gradle      # For Gradle build
  - name: dind        # For Docker build (Docker in Docker)
  - name: utils       # For utilities like Git, yq
```

**Why multi-container?**

Each stage requires different environments.
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

Thanks to the above configuration, we achieved the following improvements:

### Before: Self-hosted Runner

**Problems**
- Team member Macbook overheating disrupting development work
- No concurrent execution causing increased wait times (15 min → 5 min)
- Runner management burden (environment consistency, state management)
- Scalability limitations with increasing services

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

Of course, Jenkins on Kubernetes isn't a perfect solution either.

**1. Cold Start Problem**

I think this is the biggest drawback of dynamic Pod provisioning. After all, it takes time to create new Pods.

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

Another major drawback is that while GitHub Actions has no server to manage, Jenkins requires separate management:

- Jenkins Controller Pod management
- Plugin version management
- JCasC configuration management
- Compatibility issues during Jenkins upgrades

Once, after a Jenkins plugin update, builds failed due to compatibility issues with the Kubernetes Plugin.

**3. Higher Learning Curve Compared to GitHub Actions**

This is somewhat related to the above, but I think Jenkins has a steeper learning curve compared to GitHub Actions.
GitHub Actions is quite intuitive, but Jenkins requires learning Groovy syntax and Jenkinsfile DSL, and understanding Jenkins architecture, so the learning curve is inevitably higher.

Moreover, since integrating with Kubernetes also needs to be learned additionally, if new team members join, it will take a bit more time to adapt.
Right now, since I'm doing the configuration and management, it's not a big problem, but if team members increase and management becomes distributed in the future, this aspect will also need attention.

**4. Initial Setup Complexity**

This is also related to management complexity, but Jenkins on Kubernetes has much more complex initial setup compared to GitHub Actions. GitHub Actions just requires writing one YAML file, but Jenkins on Kubernetes requires multiple steps:

GitHub Actions:
- Just create .github/workflows/ folder and write YAML file

Jenkins on Kubernetes:
- Helm Chart configuration
- Kubernetes Secret management
- Credential configuration (JCasC)
- Kubernetes Cloud integration setup
- Jenkinsfile writing

Initial setup took about 2-3 days. I did quite a bit of troubleshooting.

**5. UI/UX**

To be honest, I think GitHub Actions' UI/UX is more intuitive and cleaner. I think the part where Jenkins has a high learning curve also somewhat contributes to the UI/UX not being intuitive. (This is my personal opinion.)

- GitHub Actions: PR integration, easy log viewing, real-time updates
- Jenkins: Even with Blue Ocean, less intuitive than GitHub Actions

### GitHub Actions vs Jenkins: When to Choose What?

Actually, I always think there's no right answer for tools. It can always vary depending on the situation, and each tool has its pros and cons.
Based on my experience, to summarize when each of these two tools might be better:

**When I think GitHub Actions is better:**

- Small team size (5 or fewer)
- Few services (5 or fewer)
- Infrequent deployments (2000 minutes or fewer)
- Want to quickly set up CI/CD
- Want to minimize management burden

In these cases, GitHub Actions is sufficient and has less management burden, so I think GitHub Actions is the better choice.

**When I think Jenkins on Kubernetes is better:**

- Many services in MSA environment (10 or more)
- Frequent deployments (100+ per month)
- Already have Kubernetes cluster
- Need complex build logic
- Want to minimize costs

In these cases, Jenkins on Kubernetes can be a better choice. Of course, the learning curve and operational burden should be considered.

**When Self-hosted Runner is better:**

- Want quick application as temporary measure
- Want to keep GitHub Actions workflows as-is
- However, should consider other options as services increase

I think it's not bad as a temporary measure. It can be applied quickly as long as it doesn't significantly worsen developer experience. However, in the long run, I think other options should eventually be considered. (Of course, instead of running Self-hosted Runner on developer laptops, there's also the option of building Self-hosted Runner on a separate server.)

---

## Lessons Learned

### 1. Every Choice Has Trade-offs

When we introduced Self-hosted Runner, I think it was **the best choice at the time**.

- We had no time to spare
- Could maintain existing pipeline
- Solved cost problem

When we migrated to Jenkins on Kubernetes:

- Macbook overheating problem was solved, but
- Cold start delay was introduced
- Management complexity increased

**It seems there's no perfect CI/CD or perfect tool. Each choice has pros and cons, and I felt once again that we need to identify what's most important in the current situation and choose accordingly.**

### 2. Cost Optimization Isn't Just About Money

We started with GitHub Actions free usage problem, but it ultimately came down to **developer experience (DX)**.

Self-hosted Runner running on Macbooks caused overheating and performance degradation, directly impacting developer productivity.

**I think the real cost might be developer time rather than infrastructure cost.**

### 3. Kubernetes Is More Than Just an Orchestration Tool

Utilizing Kubernetes' dynamic Pod provisioning greatly improved CI/CD pipeline resource efficiency.

The pattern of creating Pods only when needed and deleting them after completion was much more efficient than Self-hosted Runner's always-on approach.

**I felt that Kubernetes is powerful not only for service deployment but also as CI/CD infrastructure.**

### 4. Problem Solving Is Incremental

```
Stage 1: GitHub Actions free usage shortage
   → Introduced Self-hosted Runner

Stage 2: Self-hosted Runner performance issues
   → Migrated to Jenkins
```

By solving problems at each stage, we could gradually evolve in a better direction.

**Rather than trying to find the perfect solution at once, I felt it's important to strive to make the best choice among currently available methods while gradually improving.**

---

## Conclusion

CI/CD isn't finished once configured.

We need to continuously improve considering various factors like team size, number of services, cost, and performance.

We evolved from **GitHub Actions → Self-hosted Runner → Jenkins on Kubernetes**, and I think we're currently operating stably. (That's my personal opinion though haha..)

Of course, I think this may not be a perfect solution. More problems may arise over time.

**If that happens, we'll need to deliberate again and find the best solution for that time and gradually improve.**

I hope this post helps those with similar concerns. Thank you for reading this long article.

---

## Reference

- [GitHub Actions billing - GitHub Docs](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Self-hosted runners - GitHub Docs](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/about-self-hosted-runners)
- [Jenkins Kubernetes Plugin - Official Documentation](https://plugins.jenkins.io/kubernetes/)
- [GitHub - jenkinsci/kubernetes-plugin](https://github.com/jenkinsci/kubernetes-plugin)
- [Jenkins on Kubernetes: Dynamic Agents & Effortless Scalability](https://dev.to/alex_aslam/jenkins-on-kubernetes-dynamic-agents-effortless-scalability-for-modern-cicd-2ff3)
- [How to Setup Jenkins Build Agents on Kubernetes Pods](https://devopscube.com/jenkins-build-agents-kubernetes/)
