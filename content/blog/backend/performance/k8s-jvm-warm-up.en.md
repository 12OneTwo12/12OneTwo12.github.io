---
title: "APIs Slowing Down After Deployment: Improving JVM Cold Start Problem by 85%"
tags:
  - "jvm"
  - "warm up"
  - "co-work"
  - "startup probe"
  - "kubernetes"
  - "performance optimization"
date: '2025-11-18'
---

## Introduction

Recently, our team migrated from a Docker Compose-based production environment to Kubernetes.
It was a choice to properly utilize features needed in an MSA environment, such as scalability, automation, and zero-downtime deployment.

> Related article: [From No Dev Server to GitOps: My Journey of Introducing Kubernetes from Scratch]({{< relref "/blog/infrastructure/docker-compose-to-k8s" >}})

While examining metrics after the migration, I discovered a peculiar pattern.
For a few minutes after deployment, the first API requests were unusually slow. Responses that normally took `100~200ms` were taking `1.2-1.4` seconds right after deployment.

"It slows down whenever we deploy?"

At first, I thought it was a deployment process issue, but seeing it naturally speed up over time, I became certain. It was a **JVM Cold Start problem**.

This post records and shares **the process of applying** Kubernetes's `startupProbe` and JVM Warm-up **to our service**.

## Problem: First Request After Deployment Is Too Slow

### Symptoms

Our company's service is composed of MSA, with each service written in Spring Boot + Kotlin. Deployments are done on Kubernetes, and the following phenomenon repeated after deployment:

- First API request: **1.19~1.39s** (1,190~1,390ms)
- From second request onwards: **100~200ms**

About a 7-14x difference.

![](https://velog.velcdn.com/images/12onetwo12/post/076ba38e-d0d8-476f-8a2b-99a030a43099/image.jpg)
> *First request test response time after deployment - 1,000ms~1,300ms*

### Root Cause Analysis

It was due to the characteristics of the **JIT (Just In Time) compiler**, which can be called the fate of JVM-based applications.

The JVM operates in **interpreter mode** when first executing code. It's a structure that only optimizes to **native code** after finding frequently used code (Hot Spot). In other words, the first request becomes a sacrifice.

| Stage | Execution Method | Speed |
|------|------------------|-------|
| Cold Start (first execution) | Interpreter mode | Slow |
| Warm-up complete | JIT optimization complete | Fast |

Kubernetes environment characteristics are added here:

1. **Pods restart anytime** (deployment, scaling, failures)
2. **New JVMs start in Cold Start state every time**
3. **The first user request becomes the Warm-up sacrifice**

I thought, "I can't just leave this alone."

## Why Wasn't This a Problem Before?

Actually, this problem wasn't new. Cold Start existed when operating with Docker Compose too.
However, since containers lived long once they were up, it was only briefly a problem during deployments.

Kubernetes is different.

Kubernetes treats Pods as **"Cattle, not Pets"**. They're seen as entities that can be killed anytime and can die.

- **Rolling Update**: New Pods are continuously created during deployment
- **Auto Scaling**: Pods increase and decrease according to load
- **Node restart**: Pods are relocated due to infrastructure issues

In other words, **the frequency of Pod recreation increased significantly**, and proportionally **the probability of users sending requests to Pods in Cold Start state also increased**.

## Finding a Solution

"This can't be a problem only we're experiencing..."

I started searching. As expected, many companies had already experienced and solved similar problems.

- **OLX** shared methods of dynamically adjusting CPU resources
- **BlaBlaCar** used the startupProbe + Warm-up endpoint pattern
- I could find actual application cases in domestic tech blogs too

"This is a standard pattern. Let's apply it to us too."

## Solution Process: startupProbe + JVM Warm-up

### Strategy

The core idea consists of two parts:

1. **Execute Warm-up**: "Let's wake up the JVM by making requests ourselves before users make requests"
2. **Wait for Warm-up**: "Let's configure `startupProbe` so Kubernetes waits for warm-up completion"

startupProbe doesn't **execute** warm-up, but rather **confirms and waits for** warm-up **completion**.

### Step 1: Understanding Kubernetes Probes

Kubernetes has 3 types of Probes:

| Probe | Purpose | Action on Failure |
|-------|---------|-------------------|
| **livenessProbe** | Check if container is alive | Restart Pod |
| **readinessProbe** | Check if ready to receive traffic | Exclude from Service |
| **startupProbe** | Check if application has started | Disable other Probes until successful |

What we need is **startupProbe**.

**Why is startupProbe necessary?**
- If warm-up takes long (e.g., 1-2 minutes), livenessProbe might fail first and restart the Pod
- `readinessProbe` and `livenessProbe` are disabled **until** startupProbe **succeeds**
- Therefore, we can safely secure warm-up time

### Step 2: Implementing Warm-up

I implemented as follows by referencing various references.

#### (1) Creating WarmupHealthIndicator

Create a Health Indicator that integrates with Spring Actuator:

```kotlin
@Component
class WarmupHealthIndicator : HealthIndicator {
    private val warmedUp = AtomicBoolean(false)

    override fun health(): Health {
        return if (warmedUp.get()) {
            Health.up().build()
        } else {
            Health.down().withDetail("reason", "warmup in progress").build()
        }
    }

    fun complete() {
        warmedUp.set(true)
    }
}
```

#### (2) Implementing Warmup Logic

Use `ContextRefreshedEvent` to automatically execute when the application starts:

```kotlin
@Component
class WarmupRunner(
    private val warmupHealthIndicator: WarmupHealthIndicator,
    private val restTemplate: RestTemplate
) : ApplicationListener<ContextRefreshedEvent> {

    private val logger = LoggerFactory.getLogger(javaClass)
    private val executed = AtomicBoolean(false)

    override fun onApplicationEvent(event: ContextRefreshedEvent) {
        // Ensure execution only once
        if (!executed.compareAndSet(false, true)) {
            return
        }

        logger.info("Starting JVM warm-up...")

        val warmupRequests = listOf(
            "/api/v1/users/profile" to HttpMethod.GET,
            "/api/v1/auth/validate" to HttpMethod.POST,
            "/api/v1/buildings/search" to HttpMethod.POST,
            "/api/v1/communities/popular" to HttpMethod.GET
        )

        warmupRequests.forEach { (path, method) ->
            repeat(10) {
                try {
                    when (method) {
                        HttpMethod.GET -> restTemplate.getForEntity(
                            "http://localhost:8080$path",
                            String::class.java
                        )
                        HttpMethod.POST -> restTemplate.postForEntity(
                            "http://localhost:8080$path",
                            createDummyRequest(path),
                            String::class.java
                        )
                        else -> {}
                    }
                } catch (e: Exception) {
                    // Ignore errors during Warm-up (purpose is code execution)
                    logger.debug("Warm-up request failed (expected): ${e.message}")
                }
            }
        }

        warmupHealthIndicator.complete()
        logger.info("JVM warm-up completed!")
    }

    private fun createDummyRequest(path: String): Any {
        return when {
            path.contains("auth") -> mapOf("token" to "dummy")
            path.contains("search") -> mapOf("keyword" to "test")
            else -> emptyMap<String, Any>()
        }
    }
}
```

#### (3) application.yml Configuration

```yaml
management:
  endpoint:
    health:
      probes:
        enabled: true
      group:
        readiness:
          include: warmup  # Include warmup in readiness
        liveness:
          exclude: warmup  # Exclude from liveness
```

**Key Points**:
- `ContextRefreshedEvent`: Executes before HTTP port opens to prevent request influx during warm-up
- `AtomicBoolean`: Prevents duplicate execution through concurrency control
- `HealthIndicator`: Naturally integrates with Kubernetes probe
- **Only include in readiness**: Block traffic until warm-up completion

### Step 3: Kubernetes Probe Configuration

**Important: startupProbe is required!**

Since livenessProbe can restart the Pod if warm-up takes long, you must wait for warm-up completion with startupProbe.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  template:
    spec:
      containers:
      - name: user-service
        image: example/user-service:latest
        ports:
        - containerPort: 8080

        # startupProbe: Wait until warm-up completion
        startupProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          failureThreshold: 24  # Maximum 2 minutes (5 seconds × 24 times)

        # readinessProbe: Activated after startupProbe success
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
          periodSeconds: 5
          failureThreshold: 3

        # livenessProbe: Activated after startupProbe success
        livenessProbe:
          httpGet:
            path: /actuator/health/liveness
            port: 8080
          periodSeconds: 10
          failureThreshold: 3

        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 1800m      # Allow sufficient CPU usage during Warm-up
            memory: 2Gi
```

**Configuration Intent**:
- **startupProbe**: Waits for warm-up completion, disabling other probes until completion
- `/actuator/health/readiness`: Includes warmup HealthIndicator, returns DOWN until warm-up completion
- `failureThreshold: 24`: Guarantees maximum 2 minutes for warm-up time
- **Exclude warmup from liveness**: Prevents Pod restart even if warm-up takes long
- CPU `limits: 1800m`: Provides sufficient CPU during Warm-up

### Complete Operation Flow

Let's look at the complete flow of how these configurations cooperate:

```
1. Pod starts
   ↓
2. Spring Boot application starts
   ↓
3. ContextRefreshedEvent occurs
   → WarmupRunner starts warm-up execution
   → WarmupHealthIndicator maintains DOWN state
   ↓
4. Warm-up in progress...
   → Repeatedly call main APIs 10 times each
   → JIT compiler optimizes code
   → startupProbe checks /actuator/health/readiness every 5 seconds
   → Continues waiting since DOWN (maximum 24 times)
   ↓
5. Warm-up complete
   → WarmupHealthIndicator.complete() called
   → WarmupHealthIndicator changes to UP
   ↓
6. startupProbe succeeds
   → /actuator/health/readiness returns UP
   → startupProbe succeeds
   ↓
7. readinessProbe, livenessProbe activate
   → readinessProbe registers Pod to Service
   ↓
8. Start receiving traffic
   → Processes requests in already warm-up completed state
```

**Key Points**:
- **Warm-up execution**: Handled by `ContextRefreshedEvent` listener
- **Warm-up wait**: Handled by `startupProbe`
- startupProbe doesn't **execute** warm-up, it just **waits for** warm-up **completion**

### Step 4: CPU Resource Optimization

Here was an important discovery. Initially, I set the CPU limit to `1000m`, but Warm-up didn't work properly.

It turned out that **during JVM Warm-up, about 3 times more CPU than usual** was needed. The JIT compiler uses a lot of CPU while optimizing code.

```yaml
resources:
  requests:
    cpu: 500m       # Normal usage
  limits:
    cpu: 1800m      # Generous setting considering Warm-up
```

Due to Kubernetes's CGroup CPU Throttling, if the limit is hit, Warm-up slows down. So I **guaranteed sufficient CPU during Warm-up** and only reserved minimum resources with `requests` during normal times.

## Results: 85% Improvement

![](https://velog.velcdn.com/images/12onetwo12/post/a3e38702-1050-4404-b04f-a6b4bf1e63aa/image.png)

> *First request response time after applying Warm-up - average 150~230ms*

### Before (Cold Start)
- First API request: **1,190~1,390ms**
- Second request: **100~200ms**
- User-perceived inconvenience: High

### After (Warm-up applied)
- First API request: **150~230ms**
- Second request: **100~200ms**
- User-perceived inconvenience: None

**About 85% improvement**, and most importantly, **the difference between first and subsequent requests was significantly reduced**.

### Positive Effects

1. **Auto Scaling Stabilization**: Scaling became smoother since new Pods can immediately handle traffic
2. **Reduced User Churn**: Users who were churning due to slow first page loading during deployment times decreased

## Precautions During Application

Looking at application cases from other companies, you should be careful about the following points.

### 1. Increased Deployment Time

**Problem**: Time for Pods to reach Ready state may increase due to Warm-up.

**Solution**: Adjust Rolling Update strategy.

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1           # Create only 1 new Pod at a time
      maxUnavailable: 0     # Keep existing Pods until new Pods are Ready
```

This makes deployment a bit slower, but **guarantees zero-downtime deployment**.

### 2. External API Warm-up

**Problem**: Including external APIs in Warm-up **propagates unnecessary load to external systems**.

**Solution**: It's best to limit Warm-up to **internal APIs or dummy data processing logic only**.

```kotlin
// ❌ Bad example
repeat(10) {
    externalApiClient.sendNotification(...)  // External system load!
}

// ✅ Good example
repeat(10) {
    notificationService.validateRequest(dummyRequest)  // Execute only internal logic
}
```

### 3. DB Connection Issues

**Problem**: Calling APIs that query DB during Warm-up can exhaust the connection pool.

**Solution**:
- **Mock** APIs that need DB queries or
- Adjust connection pool size

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20    # Increase from 10 → 20
```

## Lessons Learned

### 1. Understanding JVM Characteristics Is Important

Just because you use Java/Kotlin doesn't mean you can skip knowing the JVM - you can't solve these performance problems without understanding it. I felt again that it's important to understand **JVM internal operation principles** such as JIT compiler, GC, and class loading.

### 2. Kubernetes Probes Are Not Just Health Checks

It's important to **strategically utilize** Kubernetes's 3 Probes **according to situations**.

| Situation | Appropriate Probe |
|-----------|-------------------|
| Slow start (JVM Warm-up) | startupProbe |
| Check traffic reception readiness | readinessProbe |
| Check if process is alive | livenessProbe |

### 3. Resources Generously, But Don't Waste

It's important to understand and utilize the difference between CPU `requests` and `limits`.

- `requests`: Minimum resources needed normally (scheduling basis)
- `limits`: Maximum usable resources (Throttling basis)

**When resources are temporarily needed in large amounts like Warm-up**, it's efficient to set `limits` generously while matching `requests` to normal usage.

### 4. Monitoring Is the Start of Everything

Both discovering this problem and confirming improvements were **thanks to metrics**. If we hadn't monitored API response times with Prometheus + Grafana, we probably would have passed over this problem unknowingly.

> Reference:
> [Applying Warm-up in Spring Boot + Kubernetes - LINE Engineering](https://engineering.linecorp.com/ko/blog/apply-warm-up-in-spring-boot-and-kubernetes/)
> [Improving JVM Warm-up on Kubernetes - OLX Engineering](https://tech.olx.com/improving-jvm-warm-up-on-kubernetes-1b27dd8ecd58)
> [Kubernetes Official Documentation - Liveness, Readiness, Startup Probes](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/)

## Closing

The JVM Cold Start problem is an unavoidable homework in Kubernetes environments. However, by appropriately utilizing `startupProbe` and JVM Warm-up, **you can enjoy the advantages of container orchestration without harming user experience**.

I hope this post helps those experiencing similar problems.
