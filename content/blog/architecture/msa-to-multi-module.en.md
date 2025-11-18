---
title: "From 16 Repositories to One - MSA Multi-Module Migration Story"
tags:
  - "multi-module"
  - "msa"
date: '2025-10-16'
---

## Introduction

Hello.

I'm Jeongil Jeong, a 3rd-year backend developer working at a proptech platform.

In March 2025, I joined the team and went through the process of converting 16 backend projects managed in individual `Repositories` into a multi-module structure based on a single Repository.

I'd like to share why we made this decision, what realistic considerations we had in the process, and what we gained.

---

## Why Switch to Multi-Module?

### The Shock of Day One

Our company's MSA structure had each service separated into individual Git repositories.

```
Existing repo structure:
- agent-service (Real estate agent service)
- ai-service (AI service)
- community-service (Community service)
- event-service (Event service)
- notification-service (Notification service)
- real-price-service (Real transaction price service)
... Total of 16
```

At first glance, it looked like an ideal form of MSA, but I was quite surprised on my first day joining the team.

You might wonder, "Why be surprised about 16 repos?" What surprised me was the **number of repos managed relative to team size**. The backend team size was 2 people including me, and simple calculation showed we had quite a lot of repos to manage per person. The reason for 16 was that our team was in the process of transitioning from monolithic service to MSA when I joined, managing each service as an individual repo. Managing 16 repositories with this number of people didn't make sense in terms of manageability.

However, if commonly used code was modularized so a single modification could be applied to multiple services, even 16 might be acceptable. But **unfortunately, logic performing the same function was managed separately with identical code in different repos**.

### Recurring Inefficiencies

The biggest problems were code duplication and configuration inconsistencies. For example:

- **Common DTOs**: The same DTOs were copied across multiple services, and modifying one required searching through all repos
- **Utility classes**: Utilities like `FileUtils`, `SqsMessageSender` were duplicated across multiple places
- **CI/CD configuration**: We had to manage almost identical pipeline settings separately for each repo

**The most serious case was when we had to apply identical modifications to all repos.** When we needed to modify a common Exception class, we opened all 16 repos, modified them one by one, and created 16 PRs. I was convinced then. **"This structure doesn't fit our team size."**

### Proposal and Persuasion

About a month after joining the team, I proposed multi-module transition to the team. I thought that managing multiple repos with a small team of 2-3 people had too much overhead in terms of manageability, and we needed an approach that fit our team size.

Persuasion wasn't difficult. I created and showed materials analyzing the current situation, and team members who had physically experienced the same difficulties actively agreed.

| Item | Multi-repo (Existing) | Monorepo/Multi-module (After transition) |
|------|----------------|---------------------------|
| Common module management | Duplication exists, manual copying needed | Managed in one place, immediately shared |
| CI/CD configuration | Distributed management per service | Integrated management (independent deployment maintained) |
| Testing convenience | Difficult integration testing | Easy integration testing |
| Local development environment | Need to clone multiple repos | Can run everything in one repo |
| Team size suitability | Large scale/organizational division | Small scale/collaboration focused |

---

## How Did We Transition?

### Step 1: Multi-Module Structure Transition

Team members had almost no knowledge about multi-module, so I led the multi-module transition.
After getting team members' consent and estimating the timeline, I started working in earnest. The first step was merging 16 individual repos into one while creating a multi-module structure.

#### Preserving Git History

The first thing I considered was how to preserve existing commit history. Simply copying files would lose years of history, so I integrated using **Git Subtree** while preserving version control history.

```bash
# Add each service as subtree
git subtree add --prefix=agent-service [agent-repo-url] main
git subtree add --prefix=community-service [ai-repo-url] main
# ... repeat
```

Thanks to this process, we could preserve all development history of each service.

#### Project Structure Design

The part I considered most when designing the multi-module structure was **"what criteria to use for dividing modules"**.

Since we already had services separated by domain, we chose the **domain-based module separation approach**.

We ultimately created the following structure:

![](https://velog.velcdn.com/images/12onetwo12/post/454e7c11-915d-4eae-8da9-83edce478f83/image.png)

```
multimodule_backend/
├── agent-service/       ← Domain module
├── ai-service/
├── community-service/
├── event-service/
├── notification-service/
├── real-price-service/
├── common/              ← Common module
├── settings.gradle.kts
└── build.gradle.kts     ← Root build configuration
```

What was important here was **clarifying dependency direction between modules**. We established the following principles:

- Each domain service module depends only on `common` module
- **Direct dependencies between domain modules are prohibited** (prevents circular references)
- Use event-based communication or API calls when needed

#### Gradle Multi-Module Configuration

Three files are core for configuring a multi-module project.

**1) settings.gradle - Module registration**

First, create `settings.gradle` file in root to declare modules to include.

```groovy
rootProject.name = 'multimodule_backend'
include 'common'
include 'agent-service'
include 'ai-service'
include 'community-service'
// ... remaining services
```

**2) Root build.gradle.kts - Define common settings**

In root's `build.gradle.kts`, define plugins and dependencies that all submodules will share. The key is to **declare only plugin versions using `apply false`**, and actually apply them in `subprojects` block:

```kotlin
plugins {
    id("org.springframework.boot") version "3.1.1" apply false
    id("io.spring.dependency-management") version "1.1.2"
    kotlin("jvm") version "1.8.22"
    kotlin("plugin.spring") version "1.8.22"
    kotlin("plugin.jpa") version "1.8.22"
}

val queryDslVersion by extra("5.0.0")  // Common version variable

subprojects {
    group = "me.example"
    version = "0.0.1-SNAPSHOT"

    // Apply plugins to all submodules
    apply(plugin = "org.springframework.boot")
    apply(plugin = "io.spring.dependency-management")
    apply(plugin = "kotlin")
    apply(plugin = "kotlin-spring")
    apply(plugin = "kotlin-jpa")

    dependencies {
        // Common dependencies for all modules
        implementation("org.springframework.boot:spring-boot-starter")
        implementation("org.jetbrains.kotlin:kotlin-reflect")
        testImplementation("org.springframework.boot:spring-boot-starter-test")
    }

    tasks.withType<Test> {
        useJUnitPlatform()
        maxParallelForks = (Runtime.getRuntime().availableProcessors() / 2).takeIf { it > 0 } ?: 1
    }
}
```

**3) common module configuration - Library module**

An important point is that **common module should be made as a non-executable library**. Configure it in root `build.gradle.kts` using `project(":common")` block:

```kotlin
// Add at bottom of root build.gradle.kts
project(":common") {
    // Disable bootJar (non-executable)
    tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
        enabled = false
    }

    // Enable jar (for library)
    tasks.named<Jar>("jar") {
        enabled = true
    }
}
```

**4) Each service module configuration - Executable application**

For service modules, just add common dependency in root `build.gradle.kts` using `project(":service-name")` block:

```kotlin
// Root build.gradle.kts
project(":agent-service") {
    dependencies {
        implementation(project(":common"))
    }
}

project(":ai-service") {
    dependencies {
        implementation(project(":common"))
    }
}
// ... repeat for all services
```

Each service's `build.gradle.kts` just adds necessary dependencies:

```kotlin
// agent-service/build.gradle.kts
val queryDslVersion: String by rootProject.extra

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    runtimeOnly("com.mysql:mysql-connector-j")

    // QueryDSL
    implementation("com.querydsl:querydsl-jpa:$queryDslVersion:jakarta")
    kapt("com.querydsl:querydsl-apt:$queryDslVersion:jakarta")
}
```

With this configuration:
- Common settings managed once in root
- Each service adds only necessary dependencies
- Common module changes automatically reflected to all services

```bash
# Full build
./gradlew build

# Build specific service only
./gradlew :agent-service:build

# Run specific service
./gradlew :agent-service:bootRun
```


#### Pain of Version Unification

The part that took the longest was version unification. We migrated based on the highest version among existing projects, `Spring Boot:3.1.1`.

- **Spring Boot** 2.7.* → 3.1.1
- **Kotlin** 1.7.* → 1.8.22
- **AWS SDK** version upgrade
- **QueryDSL** version conflict resolution

Spring Boot 3.x migration was particularly painful. As `javax.*` packages changed to `jakarta.*`, we had to modify countless import statements, and some libraries weren't compatible so we had to find replacement libraries.

A massive PR with **230,909 lines added** was created. 😂

#### Build Performance Improvement

As the entire project grew, IntelliJ's JVM heap sometimes burst when building. To solve this problem, we improved Gradle configuration.

```properties
# gradle.properties
org.gradle.jvmargs=-Xmx2g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
org.gradle.parallel=true
```

```kotlin
// build.gradle.kts
tasks.withType<Test> {
    useJUnitPlatform()
    maxParallelForks = (Runtime.getRuntime().availableProcessors() / 2).takeIf { it > 0 } ?: 1
}
```

This improvement dramatically reduced full build time from 27 minutes to 8 minutes!

### Step 2: Common Logic Organization and Modularization

The second step was migrating duplicated code to `common` module.

#### Common Module Design

We gathered the following into `common` module:

- **Common DTOs**: Response/request objects used by multiple services
- **Utility classes**: `FileUtils`, `SqsMessageSender`, etc.
- **Common Exceptions**: `GlobalExceptionHandler`, custom exception classes
- **Common configuration**: Spring Bean definitions, Auto Configuration

#### Auto Configuration Application

We implemented Spring Boot Auto Configuration so that beans from `common` module could be automatically registered in each service:

```kotlin
// common/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
me.example.common.config.CommonAutoConfiguration
```

```kotlin
@AutoConfiguration
@ConditionalOnProperty(
    prefix = "example.common",
    name = ["enabled"],
    havingValue = "true",
    matchIfMissing = true
)
@Import(CommonComponentConfig::class)
class CommonAutoConfiguration
```

Now each service can use common functions simply by adding `implementation(project(":common"))`.

#### Surprise of Duplicate Code Cleanup

What was surprising during the work was that there was much more duplicate code than expected. There were cases where Enum classes for the same purpose had different field names in different services, and almost identical utility methods were copied across 5-6 services.

We eliminated all this duplication through **5,545 lines changed**.

### Step 3: CI/CD Pipeline Reconstruction

One of the most important things when transitioning to multi-module structure was maintaining **independent deployment**. When one service is modified, all services shouldn't be redeployed.

Since our CI/CD was configured with Github actions, we went through the process of modifying deployment scripts.

---

## What Changed After Transition

#### 1. Improved Development Productivity

When common code modification is needed, now we just modify `common` module in one place. For example, when improving Exception handling logic or adding new utilities, there's no need to go around 16 repos.

#### 2. Consistent Code Quality

With unified versions and settings, code consistency improved significantly. Now all services use the same Spring Boot version and follow the same coding conventions.

#### 3. Easy Integration Testing

Writing integration tests between multiple services became much easier. Since they're in the same project, testing interfaces between services became natural.

#### 4. Reduced New Service Addition Time

When adding new services, there's no need to write boilerplate code. Just depend on `common` module and write only necessary business logic.

Actually, the time spent on basic configuration when adding a new service decreased significantly.

#### 5. Improved Team Collaboration

During code reviews, it became easier to see the full context. Since we can immediately check other affected services in the same repository, it became much easier to understand the impact range of changes.

---

## Difficulties and Solutions

### 1. Increased Build Time

Initially, building the entire project took a long time. Especially running all tests consumed considerable time.

**Solution**:
- Enabled Gradle parallel build
- Improved script to build only changed modules
- Made tests run in parallel (`maxParallelForks` configuration)

### 2. Version Issues

During version unification, dependency conflicts occurred in some cases, and settings that had no problem in existing versions became problematic when upgrading. We had to solve these issues one by one 🥲

### 3. CI/CD Pipeline Complexity

Implementing logic to deploy 16 services independently while redeploying all affected services when common module changes was complex.

**Solution**:
- Build all services when `common` module changes
- Build only that service when individual service changes
- Defined clear deployment matrix

---

## What We Learned

### 1. Architecture Should Fit the Team

I don't think running MSA with multi-repo is always the answer. Depending on team size, organizational structure, and collaboration style, monorepo might be more suitable. For small teams like ours, monorepo/multi-module seems much more efficient.

### 2. Importance of Gradual Migration

I think trying to change everything at once creates too much burden. We approached it in stages:
1. First integrate structure only (Step 1)
2. Then organize common logic (Step 2)
3. Finally reconstruct CI/CD (Step 3)

By approaching step by step, we could solve and stabilize problems at each stage.

### 3. Value of History Preservation

Using Git Subtree to preserve commit history was a really good choice. It was very helpful later when tracking bugs or understanding reasons for changes.

### 4. Must Maintain Independent Deployment

Though we integrated into monorepo, independent deployment of each service must be maintained. This is MSA's core advantage. We could keep this through well-designed CI/CD pipeline.

### 5. Minimize Common Module

I think one of the biggest pitfalls of multi-module transition is the thinking **"if it's commonly used code, put it in common"**. Whether you want it or not, code used commonly by multiple services will increase, change, and be deleted. Each time this happens, Common module changes, which means it can affect the entire project if done wrong.

Initially, I also approached this way and transitioned to multi-module, but as Common module became bloated, there were moments of **"is this really okay...?"**, so I discarded what I was working on and decided to precisely establish standards for common modules before working.

**The solution was simple. Minimize Common and separate the rest by feature.**

Thankfully, there were developers who had already experienced the process we were about to go through, and they [shared it with experience](https://techblog.woowahan.com/2637/), so we didn't have to experience the same problem.

As written in that article, common includes only **Types, Enums, Utils that all services really use**. Infrastructure-related code (JPA, Redis, S3, etc.) was separated into separate modules so only necessary services could selectively depend on them.

### 6. Importance of Preventing Circular References

Another thing to be careful about in multi-module structure is **circular references**. If module A references module B, and module B references module A again, the build itself fails.

We prevented this by:
- Prohibiting direct dependencies between domain modules
- Defining clear hierarchical structure for modules
- Using events or API calls when communication between services is needed

Thanks to clearly establishing these principles early, we could proceed without major problems.

---

## Conclusion

We fortunately finished the multi-module transition project safely. Looking back now, I was grateful to team members who trusted me, a newcomer, and entrusted me with the multi-module transition. I think I could do it thanks to the team's trust and support.

What I felt most during this work was that **"good architecture should fit team circumstances, not theory"**. I'm proud that we found a structure that fits our reality of 2-3 backend engineers, breaking away from the stereotype of "MSA = multi-repo".

Now we can develop without worrying about code duplication, and team members say collaboration has become much easier. Above all, I'm grateful to the team for entrusting me with such a big project early on, and I'm glad I could repay them with good results.

If your team is having similar concerns, I hope this article helps even a little. Thank you for reading this long article!
