---
title: "[Memoir] Solving HikariCP Deadlock Problem from Mixing JPA and MyBatis"
tags:
  - deadlock
  - hikaricp
  - jpa
  - mybatis
  - osiv
date: '2024-12-02'
---

In early 2024, there was an incident where I faced an unexpected problem. [(That article)](/en/blog/backend/troubleshooting/hikaricp-deadlock-with-jpa-mybatis)
I'll write a memoir about the situation at that time.

HikariCP Deadlock problem occurred in code mixing JPA and MyBatis.
It was more bewildering because it was code that had been operating without problems for several months.

I'd like to organize this experience where I could deeply understand JPA, HikariCP, and persistence context operation principles during the resolution process.

---

## First Encounter with Problem: Unexpected Deadlock

### 📌 Problem Starting with Slack Notification

During high traffic time, a notification like below arrived on Slack.

```
org.springframework.jdbc.CannotGetJdbcConnectionException: Failed to obtain JDBC Connection; nested exception is java.sql.SQLTransientConnectionException: HikariPool-1 - Connection is not available, request timed out after 30008ms.
```

At first I thought it was a Connection Pool related Exception I didn't know about. But I realized the seriousness of the problem while checking logs.

```
HikariPool-1 - Timeout failure stats (total=40, active=40, idle=0, waiting=46)
```

In HikariCP, all 40 Connections set as `maximum-pool-size` were occupied, and even the waiting queue was full. What was more bewildering was that this logic had been working well for several months.

### Why Did Problem Occur Suddenly?

The first question was "why did this problem occur now?"
- If it was a settings problem, it should have occurred before too.
- Why did the problem occur when code hadn't been modified?

This question troubled me throughout problem solving, and ultimately became an important clue to problem resolution.

---

## Cause Analysis: Repetition of Suspicion and Verification

### 1. Building Reproduction Environment: Reproducing Locally

First to reproduce the problem, I set `maximum-pool-size` to 1 in test environment. This allowed me to pinpoint exception occurrence point.

```java
public long findBy~~~() {
    return factory
        .select(serviceNotice.count())
        .from(serviceNotice)
        .where(
            serviceNotice.actType.eq("specific condition"),
            serviceNotice.section.eq("specific condition"),
            serviceNotice.actEnable.eq(true)
        )
        .fetchOne();
}
```

Even though it was a simple Select query written in QueryDSL, Connection remained occupied without being returned.

---

### 2. Is It Connection Leak?

At first I suspected Connection Leak.
- "Why doesn't this logic return Connection after finishing?"
- "Could Connection return logic be missing?"

However, when using QueryDSL, Connection should be automatically returned even without explicitly closing Connection in code. After checking related documents, I thought of the possibility it might be related to OSIV (Open Session In View).

---

### 3. OSIV and Persistence Context

OSIV maintains persistence context (EntityManager) until web request ends.
While this enables Lazy Loading and supports integration with database in View layer, it has the disadvantage of delaying Connection return.

> Due to OSIV, Connection remained occupied without being returned even after transaction ended.

---

### 4. Deadlock Regardless of OSIV? Problem of Mixing Within Transaction

After investigating the problem more deeply, I confirmed that **mixing JPA and MyBatis within same Transaction** can cause Deadlock regardless of OSIV setting.
This was because MyBatis requested additional Connection while JPA was occupying Connection within same Transaction.

```java
@Transactional
public void problematicMethod() {
    jpaSelectMethod();      // Occupies 1 from Connection Pool
    mybatisSelectMethod();  // Requests additional Connection -> Deadlock
}
```

Conditions where HikariCP Deadlock can occur are when one request needs two or more Connections simultaneously, so above case satisfies conditions.

---

### 5. Why Did It Occur Now?

The reason this problem hadn't occurred for several months was due to number of Kubernetes pods.
- **Previously:** Operating minimum 5 pods for traffic distribution.
- **Currently:** Reduced pods to 2 for cost reduction.

With pod count reduction, situation occurred where Connection Pool was all occupied when traffic concentrated on one pod.

---

## Solution Methods

### 1. OSIV Deactivation

Deactivating OSIV (`spring.jpa.open-in-view=false`) could set Connection to be returned when transaction ends. However, turning off OSIV could affect Lazy Loading handling method, requiring modification of existing code.

Also, regardless of OSIV option, Deadlock could likewise occur when mixing within one Transaction, so it wasn't a fundamental solution.

**Conclusion:** Postponed OSIV setting change.

---

### 2. Removing JPA and MyBatis Mixing

The cause of the problem was using JPA and MyBatis simultaneously within same Transaction.

If we refactor code so JPA and Mybatis aren't used simultaneously within one Transaction, we could avoid causing it, enabling problem resolution at code level.

**Conclusion:** Separating JPA and MyBatis is fundamental solution.

---

### Temporary Measure: Increasing Pod Count

Until problem resolution, we increased Kubernetes pod count from existing 2 back to 5 to distribute traffic.

---

## Retrospective: What I Learned From This Problem

This experience became an opportunity to deeply understand basic concepts beyond simple problem solving.

**Learning Point 1. Interaction Between JPA and Connection Pool**
- Point that I need to clearly understand persistence context and Connection return timing.

**Learning Point 2. Methodology of Reproducing Problem**
- It was important to narrow down causes by reproducing conditions where problem occurred in test environment.

**Learning Point 3. Risk of Technology Mixing**
- I felt the danger when mixing technologies like JPA and MyBatis that use different Connection management methods.

---

## Conclusion

This problem taught me many things as a junior developer.
Especially the achievement I felt in the process of defining problem and narrowing down causes became an unforgettable experience. I want to keep growing step by step through such experiences in the future.

---


### Reference
https://techblog.woowahan.com/2664/
https://techblog.woowahan.com/2663/
https://colin-d.medium.com/querydsl-%EC%97%90%EC%84%9C-db-connection-leak-%EC%9D%B4%EC%8A%88-40d426fd4337
https://saramin.github.io/2023-04-27-order-error/
https://github.com/brettwooldridge/HikariCP
https://perfectacle.github.io/2021/05/24/entity-manager-lifecycle/
https://ykh6242.tistory.com/m/entry/JPA-OSIVOpen-Session-In-View%EC%99%80-%EC%84%B1%EB%8A%A5-%EC%B5%9C%EC%A0%81%ED%99%94
https://www.blog.kcd.co.kr/jpa-%EC%98%81%EC%86%8D%EC%84%B1-%EC%BB%A8%ED%85%8D%EC%8A%A4%ED%8A%B8%EC%99%80-osiv-3c5521e6de9f
