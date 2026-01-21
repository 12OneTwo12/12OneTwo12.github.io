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

I'm Jeongil Jung, a backend developer with 3 years of experience, always asking **"What improvement does our service need most right now?"**

From API performance optimization to MSA migration, K8s infrastructure setup and operations, and team development culture— if needed, I proposed it and built it with my team.

I completed our MSA migration with zero downtime, and reduced incident detection time from 1 hour to 1 minute.

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
  Decoupled tightly coupled domains, **zero-downtime transition**
{{% details title="**See Details**" %}}
- **Overview**: Zero-downtime migration from Java Servlet monolith to Kotlin/Spring Cloud MSA
- **Duration**: 2025.04 ~ 2025.11 | 3-member team, designed and implemented 5 of 18 services (Property Listings, Broker-User Matching, Transaction Prices, User, Notification)
- **[Problem]**
  - Tightly coupled core domains (listings, broker-user matching) blocked gradual migration
  - Risk of data inconsistency and business logic conflicts with domain-by-domain separation
  - Common code duplicated across service codebases, causing version mismatch and maintenance overhead
- **[Key Contributions]**
  - Designed [**partial big-bang strategy**]({{< relref "/blog/architecture/is-gradual-msa-transition-an-illusion" >}}) to migrate tightly coupled domains as a single unit
  - Dual Write + validation batch for **data consistency during transition**
  - Hexagonal Architecture + CQRS to **remove technical dependencies from domain logic**
  - FeignClient sync communication, AWS SQS **event-driven communication**
  - [**Multi-module structure design**]({{< relref "/blog/architecture/msa-to-multi-module" >}}) for **centralized dependency management** and code deduplication
- **[Results]**
  - **Zero-downtime** MSA migration completed
  - Hexagonal Architecture enabled **independent domain deployment**
  - Multi-module migration **eliminated code duplication** and unified dependency versions
- **Tech**: `Kotlin`, `Spring Cloud`, `Feign Client`, `CQRS`, `Hexagonal Architecture`, `AWS SQS`
{{% /details %}}

- #### **Kubernetes Infrastructure & Monitoring System**
  From no monitoring, incident detection **98% faster** (1hr → 1min), Rollback **83% faster**
{{% details title="**See Details**" %}}
- **Overview**: Migrated from single VM to Kubernetes and built monitoring system
- **Duration**: 2025.04 ~ 2025.09 | Infrastructure owner
- **[Problem]**
  - Single instance + Shell Script deployment → **SPOF**, manual intervention for recovery
  - No monitoring, relied on customer support for incident detection (avg 1 hour)
- **[Key Contributions]**
  - Compared GKE vs Self-Managed K8s, [**proposed and built GKE adoption**]({{< relref "/blog/infrastructure/docker-compose-to-k8s" >}})
  - Removed Spring Cloud Eureka/Gateway dependencies → **Kubernetes native transition**
  - Built GitHub Actions + ArgoCD **CI/CD pipeline**
  - Designed and built Grafana LGTM Stack [**monitoring system**]({{< relref "/blog/infrastructure/building-a-monitoring-system" >}}) (sidecar pattern)
  - Some services [**on-premises → AWS cloud zero-downtime migration**]({{< relref "/blog/infrastructure/from-on-premises-to-cloud-a-zero-downtime-migration-story" >}})
- **[Results]**
  - Incident detection: 1hr → **1min (98% faster)**
  - Rollback time: 12min → **2min (83% faster)**
  - **Zero-downtime deployment** and **auto-scaling** achieved
- **Tech**: `Kubernetes`, `GKE`, `ArgoCD`, `GitHub Actions`, `Grafana`, `Loki`, `Tempo`, `Prometheus`
{{% /details %}}

- #### **[Natural Language Location-based Property Recommendation System](https://bootalk.co.kr/ai/chat) Design & Implementation**
  Built **natural language location search property recommendation** with RAG + Geo-search
{{% details title="**See Details**" %}}
- **Overview**: Added location-based property recommendation feature to existing real estate AI service 'Butogi'
- **Duration**: 2025.08 ~ 2025.11 | 3-member team, backend owner
- **[Problem]**
  - Existing AI service only had real estate Q&A RAG, no property recommendation feature
  - Unable to handle location-based natural language queries like "Recommend apartments near Yeouido Station"
- **[Key Contributions]**
  - Automated **POI (Point of Interest) indexing** to Elasticsearch via Spring Batch daily job
  - Built RAG pipeline: LLM extracts location & condition keywords from natural language → Elasticsearch **similarity search to identify location** → radius & condition filtering → property recommendation
  - Built **vectorization and similarity search** for property data using OpenAI Embedding API
- **[Results]**
  - Launched **AI property recommendation** with natural language location search
  - Supported **complex queries** like "2-room within 10 min walk from Gangnam Station"
- **Tech**: `Kotlin`, `Spring Batch`, `Elasticsearch`, `OpenAI API`, `RAG`, `Geo-search`, `Embedding`
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
  - Unified to JPA to [**resolve HikariCP Deadlock**]({{< relref "/blog/backend/troubleshooting/hikaricp-deadlock-with-jpa-mybatis" >}})
  - AbstractRoutingDataSource + AOP for **dynamic DataSource routing**
  - Redis caching for [**external API optimization**]({{< relref "/blog/backend/performance/look-aside-cache-api-perf" >}}), covering index for **query performance**
  - Introduced Git flow for [**improved collaboration process**]({{< relref "/blog/culture/git-flow-introduction" >}})
- **[Results]**
  - API response: 10.3s → **1.3s (87% faster)**
  - Cached API: 5.1s → **1.3s (75% faster)**
  - Resolved HikariCP Deadlock and Replication lag
- **Tech**: `Spring Boot`, `Java 11`, `JPA`, `Redis`, `MySQL`
{{% /details %}}

- #### **Infrastructure Operations & Maintenance**
  Covered DevOps gap, **resolved session loss with Redis Session Clustering**
{{% details title="**See Details**" %}}
- **Overview**: Cloud-based server infrastructure operations and maintenance
- **Duration**: 2023.12 ~ 2024.09 | Solo infrastructure owner
- **[Problem]**
  - **Infrastructure operations gap** due to DevOps departure
  - K8s Ingress Sticky Session causing **session loss** on app restart
- **[Key Contributions]**
  - **Owned infrastructure operations** until new DevOps hire
  - Managed **19 instances, 10 nodes, 3 web servers, 9 WAS, 2 DBs**
  - Implemented **Redis Session Clustering** to resolve session loss
- **[Results]**
  - **Stable infrastructure** maintained during gap period
  - Session loss resolved, **improved user experience**
- **Tech**: `Kubernetes`, `Jenkins`, `ArgoCD`, `ELK`, `Prometheus`, `Redis`, `MySQL`
{{% /details %}}

- #### **Spring Batch Performance Optimization**
  Chunk/Partitioning, **batch processing 64% faster** (13min → 5min)
{{% details title="**See Details**" %}}
- **Overview**: Migrated PHP/Crontab batch to Spring Batch with [**optimization**]({{< relref "/blog/backend/performance/spring-batch-tasklet-to-chunk" >}})
- **Duration**: 2024.05 ~ 2025.03 | 4~6-member team, batch system migration & optimization design
- **[Problem]**
  - [**Metadata Table Deadlock**]({{< relref "/blog/backend/troubleshooting/spring-batch-job-deadlock" >}}) on concurrent Job execution
  - Tasklet causing performance and consistency issues with large data
- **[Key Contributions]**
  - Resolved Deadlock by changing Isolation Level
  - Migrated Tasklet → **Chunk + Partitioning**
  - **Documented and shared** solution internally
- **[Results]**
  - Batch processing: 13.3min → **4.8min (64% faster)**
  - Transaction lock hold: 22min → **0.01s** (99.9% fewer consistency issues with Chunk commits)
- **Tech**: `Spring Batch`, `Java 11`, `JPA`
{{% /details %}}

## **Side Project**

#### **Upvy** - Educational Short-form Video Platform
> *2025.10 ~ Present* | [App Store](https://apps.apple.com/app/upvy/id6756291696) | [GitHub](https://github.com/12OneTwo12/upvy)

- **Overview**: Educational short-form platform that turns scroll time into learning time
- **Tech**: `Kotlin` `Spring WebFlux` `R2DBC` `React Native` `Vertex AI`
- **Highlights**: Solo development · Live on App Store · 79% test coverage
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
