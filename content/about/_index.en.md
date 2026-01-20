---
title: ""
toc: true
---
<style>
.content h2:first-of-type {
  margin-top: 0.5rem;
}
.content p:first-of-type {
  margin-top: 0.5rem;
}
.content p:first-of-type + h2 {
  margin-top: 1rem;
}
</style>
## **Contact**

jji042842@gmail.com · [GitHub](https://github.com/12OneTwo12) · [Blog](https://jeongil.dev/en/blog)

## **Profile**

**A developer who enjoys starting with "Why?" and digging to the root of problems.**

I traced a single error log to uncover the cause of a HikariCP Deadlock. Asking "Why is incident detection so slow?" led me to build a monitoring system that cut detection time from 1 hour to 1 minute.

I think about **"What improvement does our service need most right now?"** before diving into implementation.

**Core Strengths:** MSA Migration Design & Implementation · K8s Infrastructure · Query & API Performance Optimization · Monitoring System

## **Skills**

| Skill         |              Experience (Years)               | Description                                                                       |
|:--------------|:---------------------------------------------:|:----------------------------------------------------------------------------------|
| Java          | `{{< experience-years start="2023-03-06" >}}` | Backend development in MSA, Batch environments |
| Kotlin        | `{{< experience-years start="2023-08-01" >}}` | Async processing with Coroutines, primary language in MSA |
| Spring Boot   | `{{< experience-years start="2023-03-06" >}}` | REST API development with Spring Security, Actuator |
| Spring Batch  | `{{< experience-years start="2023-05-01" >}}` | Large-scale data processing, Chunk/Partitioning optimization |
| Spring Cloud  | `{{< experience-years start="2024-03-01" >}}` | MSA with Gateway, Eureka |
| MySQL         | `{{< experience-years start="2023-03-06" >}}` | **Certified - SQL Developer** \| DB design, query tuning, Replication |
| Kubernetes    | `{{< experience-years start="2023-12-01" >}}` | **Certified - CKA** \| GKE infrastructure, Helm, ArgoCD automation |
| Linux         | `{{< experience-years start="2022-03-06" >}}` | **Certified - Linux Master Level-II**, **AWS CCP** \| Server operations |

## **Work Experience**

### **Bootalk Inc.**
> AI-based real estate brokerage platform <br>
>*2025.03 ~ Present ({{< work-duration start="2025-03-01" >}})* | Backend Engineer (4-member dev team)

{{< callout type="info" icon="code" >}}
**Tech Stack**: `Kotlin` `Spring Cloud` `Kubernetes` `ArgoCD` `Grafana LGTM Stack` `Redis` `MySQL`
{{< /callout >}}

- #### **Monolith → MSA Migration**
  Decoupled tightly coupled domains, **doubled new feature development speed**
{{% details title="**See Details**" %}}
- **Overview**: [Zero-downtime migration from Java Servlet monolith to Kotlin/Spring Cloud MSA]({{< relref "/blog/architecture/is-gradual-msa-transition-an-illusion" >}})
- **Duration**: 2025.04 ~ 2025.11 | 3-member team, led 5 service implementations (Property Listings, Broker-User Matching, Transaction Prices, User, Notification)
- **[Problem]**
  - Tightly coupled core domains (listings, broker-user matching) blocked gradual migration
  - Risk of data inconsistency and business logic conflicts with domain-by-domain separation
- **[Key Contributions]**
  - Designed **partial big-bang strategy** to migrate tightly coupled domains as a single unit
  - Dual Write + validation batch for **data consistency during transition**
  - Hexagonal Architecture + CQRS to **remove technical dependencies from domain logic**
  - FeignClient sync communication, AWS SQS **event-driven communication**
- **[Results]**
  - MSA migration completed with **100% service availability**
  - New feature development speed **~2x faster** due to domain separation
- **Tech**: `Kotlin`, `Spring Cloud`, `Feign Client`, `CQRS`, `Hexagonal Architecture`, `AWS SQS`
{{% /details %}}

- #### **Kubernetes Infrastructure & Monitoring System**
  Incident detection **98% faster** (1hr → 1min), Rollback **83% faster**
{{% details title="**See Details**" %}}
- **Overview**: [Migrated from single VM to Kubernetes]({{< relref "/blog/infrastructure/docker-compose-to-k8s" >}}) and [built monitoring system]({{< relref "/blog/infrastructure/building-a-monitoring-system" >}})
- **Duration**: 2025.04 ~ 2025.09 | Infrastructure owner
- **[Problem]**
  - Single instance + Shell Script deployment → **SPOF**, manual intervention for recovery
  - No monitoring, relied on customer support for incident detection (avg 1 hour)
- **[Key Contributions]**
  - Compared GKE vs Self-Managed K8s, **proposed and built GKE adoption**
  - Removed Spring Cloud Eureka/Gateway dependencies → **Kubernetes native transition**
  - Built GitHub Actions + ArgoCD **CI/CD pipeline**
  - Designed and built Grafana LGTM Stack **monitoring system** (sidecar pattern)
- **[Results]**
  - Incident detection: 1hr → **1min (98% faster)**
  - Rollback time: 12min → **2min (83% faster)**
  - **Zero-downtime deployment** and **auto-scaling** achieved
- **Tech**: `Kubernetes`, `GKE`, `ArgoCD`, `GitHub Actions`, `Grafana`, `Loki`, `Tempo`, `Prometheus`
{{% /details %}}

- #### **On-premise → AWS Cloud Zero-Downtime Migration**
  Cloud migration with **zero downtime**
{{% details title="**See Details**" %}}
- **Overview**: [Zero-downtime migration from on-premise IDC to AWS]({{< relref "/blog/infrastructure/from-on-premises-to-cloud-a-zero-downtime-migration-story" >}})
- **Duration**: 2025.07 ~ 2025.08 | 2-member team, strategy design & DMS/Terraform implementation
- **[Problem]**
  - Intermittent server downtime due to hardware issues
  - Manual scaling limitations and operational burden
- **[Key Contributions]**
  - Designed **dual operation strategy** considering DNS propagation time
  - Built AWS DMS (CDC) based IDC → RDS **real-time sync pipeline**
  - Codified AWS infrastructure (EC2, RDS, VPC) with Terraform **(IaC)**
- **[Results]**
  - Migration completed with **zero downtime**
  - Resolved hardware issues, achieved traffic scalability
- **Tech**: `AWS`, `Terraform`, `AWS DMS`, `AWS RDS`, `AWS VPC`
{{% /details %}}

---

### **Hello Fintech Co., Ltd.**
> P2P Online Investment Platform (₩2.5 trillion cumulative loans) <br>
>*2023.03 ~ 2025.03 (2 years)* | Backend Developer (5~10-member dev team)

{{< callout type="info" icon="code" >}}
**Tech Stack**: `Java` `Spring Boot` `Spring Batch` `JPA` `Redis` `MySQL` `Kubernetes`
{{< /callout >}}

- #### **Back-office Server Performance Optimization**
  SQL tuning and caching, **API response 87% faster** (10.3s → 1.3s)
{{% details title="**See Details**" %}}
- **Overview**: Migrated PHP legacy back-office to Spring with performance improvements
- **Duration**: 2024.04 ~ 2025.03 | 2~6-member team, performance optimization & troubleshooting
- **[Problem]**
  - [**HikariCP Deadlock**]({{< relref "/blog/reflection/hikaricp-deadlock-with-jpa-mybatis-memoir" >}}) due to JPA + MyBatis mix
  - [**DB Replication lag**]({{< relref "/blog/backend/troubleshooting/db-replication-lag" >}}) causing data inconsistency
  - N+1, missing indexes causing server load
- **[Key Contributions]**
  - [Unified to JPA to **resolve Deadlock**]({{< relref "/blog/backend/troubleshooting/hikaricp-deadlock-with-jpa-mybatis" >}})
  - AbstractRoutingDataSource + AOP for **dynamic DataSource routing**
  - [Redis caching]({{< relref "/blog/backend/performance/look-aside-cache-api-perf" >}}), [covering index]({{< relref "/blog/architecture/jpa-sql-ideology-and-gap" >}}) for **query performance optimization**
- **[Results]**
  - API response: 10.3s → **1.3s (87% faster)**
  - Cached API: 5.1s → **1.3s (75% faster)**
  - Resolved HikariCP Deadlock and Replication lag
- **Tech**: `Spring Boot`, `Java 11`, `JPA`, `Redis`, `MySQL`
{{% /details %}}

- #### **Settlement System Renewal (Design & Implementation)**
  Integrated 24 DB Procedures/Functions, **46% faster requirement delivery**
{{% details title="**See Details**" %}}
- **Overview**: [Integrated distributed settlement logic into single system](https://www.notion.so/Analyzed-the-existing-As-Is-settlement-architecture-and-dependency-configurations-13fde4324e3d80878b38c17b3370231f?pvs=21)
- **Duration**: 2024.06 ~ 2025.03 | 4-member team, migration strategy design & implementation
- **[Problem]**
  - Settlement logic across 3 servers, 13 Procedures, 11 Functions → high maintenance cost
  - **Race Condition** in distributed environment
- **[Key Contributions]**
  - Analyzed existing architecture dependencies, designed **gradual migration strategy**
  - Redisson distributed lock to **resolve Race Condition**
  - Introduced [Git flow]({{< relref "/blog/culture/git-flow-introduction" >}}) for version control
- **[Results]**
  - Requirement delivery: 4.06 weeks → **2.18 weeks (46% faster)**
  - Improved settlement **reliability** by resolving concurrency issues
- **Tech**: `Spring Boot`, `Java 11`, `JPA`, `Redisson`
{{% /details %}}

- #### **Spring Batch Performance Optimization**
  Chunk/Partitioning, **batch processing 64% faster** (13min → 5min)
{{% details title="**See Details**" %}}
- **Overview**: [Migrated PHP/Crontab batch to Spring Batch]({{< relref "/blog/backend/performance/spring-batch-tasklet-to-chunk" >}}) with optimization
- **Duration**: 2024.05 ~ 2025.03 | 4~6-member team, batch system migration & optimization design
- **[Problem]**
  - [Metadata Table Deadlock on concurrent Job execution]({{< relref "/blog/backend/troubleshooting/spring-batch-job-deadlock" >}})
  - Tasklet causing performance and consistency issues with large data
- **[Key Contributions]**
  - Resolved Deadlock by changing Isolation Level
  - Migrated Tasklet → **Chunk + Partitioning**
  - **Documented and shared** solution internally
- **[Results]**
  - Batch processing: 13.3min → **4.8min (64% faster)**
  - Transaction time: 22min → **0.01s (99.9% fewer consistency issues)**
- **Tech**: `Spring Batch`, `Java 11`, `JPA`
{{% /details %}}

## **Side Project**

### **Upvy** - Educational Short-form Video Platform
> [App Store](https://apps.apple.com/app/upvy/id6756291696) | [GitHub](https://github.com/12OneTwo12/upvy)

- **Overview**: Educational short-form platform that turns scroll time into learning time
- **Tech**: `Kotlin` `Spring WebFlux` `R2DBC` `React Native` `Vertex AI`
- **Highlights**: Solo full-stack development · Live on App Store · 79% test coverage
- **Key Implementation**: AI-powered YouTube video auto-editing pipeline (Vertex AI Gemini + Speech-to-Text)

## **Certificate**

- **[Certified Kubernetes Administrator (CKA)](https://www.credly.com/badges/e357623d-2e5c-4c5c-aed9-d3e90f06aa56/public_url)** \| CNCF / 2025.11
- **Linux Master Level 2** \| KAIT / 2024.10
- **[Certified Cloud Practitioner (CCP)](https://www.credly.com/badges/924d4107-fbcb-4a48-abed-7f42266ae34f/public_url)** \| AWS / 2024.08
- **SQLD** \| Korea Data Agency / 2022.12

## **Activity**

- **Open Source**: Spring Security documentation improvement [PR#16216](https://github.com/spring-projects/spring-security/pull/16216)
- **Tech Study**: [Backend Article Study](https://minnim1010.notion.site/6af63324e8614108bf32b0c2f5a1c87c) (2023.08 ~ ongoing)
- **Training**: [Big Data Based Intelligent SW and MLOps Developer Course](https://inthiswork.com/archives/105995) (2022.07 ~ 2022.12)
