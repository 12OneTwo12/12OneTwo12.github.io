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

I'm Jeongil Jung, a backend developer in my fourth year, always asking **"What improvement does our service need most right now?"**

I built 5 of our 13 microservices myself, ran them in production, and then proposed merging them back, which cut infrastructure costs by 36%.

I designed and shipped a conversational AI agent, and brought the P95 response time of our apartment complex info API down from 4,045ms to under 50ms.

Alongside backend development, I built and run our Kubernetes infrastructure, reducing rollback time from 12 minutes to 2. Before that, at a P2P lending platform, I proposed and led the consolidation of settlement logic, cutting the time to ship a requirement from 4 weeks to 2.

**Core Strengths:** MSA & Modular Monolith Architecture · LLM Agent Design · API & Query Performance · Kubernetes & Terraform Infrastructure

## **Skills**

| Skill         |              Experience (Years)               | Description                                                                       |
|:--------------|:---------------------------------------------:|:----------------------------------------------------------------------------------|
| Java          | `{{< experience-years start="2023-03-06" >}}` | Settlement, back-office, and batch systems on a fintech platform |
| Kotlin        | `{{< experience-years start="2023-08-01" >}}` | Primary language for MSA/modular monolith services and an LLM agent |
| Spring Boot   | `{{< experience-years start="2023-03-06" >}}` | REST APIs, JWT authn/authz, OpenFeign, JUnit 5 & ArchUnit tests |
| Spring Batch  | `{{< experience-years start="2023-05-01" >}}` | Chunk/Partitioning migration, metadata deadlock fix |
| MySQL         | `{{< experience-years start="2023-03-06" >}}` | **Certified - SQL Developer** \| Query tuning, replication lag and collation issues |
| Kubernetes    | `{{< experience-years start="2023-12-01" >}}` | **Certified - CKA** \| Built and operated GKE/EKS, ArgoCD GitOps, Gateway API migration |
| Terraform     | `{{< experience-years start="2025-07-01" >}}` | Imported console-managed AWS resources, EKS/RDS setup, drift management |
| Linux         | `{{< experience-years start="2022-03-06" >}}` | **Certified - Linux Master Level-II**, **AWS CCP** \| Server operations |

## **Work Experience**

### **Bootalk Inc.**
> AI-based real estate brokerage platform (210K+ members, 50K+ broker matches) <br>
>*2025.03 ~ Present ({{< work-duration start="2025-03-01" >}})* | Backend Engineer

{{< callout type="info" icon="code" >}}
**Tech Stack**: `Kotlin` `Spring Boot` `JPA` `MySQL` `Redis` `Elasticsearch` `OpenAI Responses API` `AWS EKS` `Terraform` `ArgoCD` `Grafana`
{{< /callout >}}

- #### **MSA Migration and Re-consolidation into a Modular Monolith**
  Core domains migrated **with zero downtime**; re-consolidation cut pods from 26+ to 5–7 and **infrastructure costs by 36%**
{{% details title="**See Details**" %}}
- **Period**: 2025.04 ~ 2026.02 | Designed and built 5 of 13 services (settlement, listings, matching, etc.); proposed, designed, and built the modular monolith re-consolidation
- **[Problem]**
  - Matching logic joined the listings table directly, so tightly coupled that domains couldn't be split off one at a time
  - After the migration, running 13 services (26+ pods) was costly to operate and expensive
- **[Key Contributions]**
  - Proposed a [**partial big bang**]({{< relref "/blog/architecture/is-gradual-msa-transition-an-illusion" >}}) that moved only the tightly coupled domains (listings, matching, brokers) together, implemented with hexagonal architecture
  - During the transition, used dual writes to both DBs with a verification batch for mismatches, keeping an immediate rollback path to the legacy system
  - Found a procedure that slowed from 56–70ms to 457ms before release; fixed the [**collation mismatch**]({{< relref "/blog/backend/troubleshooting/mysql-collation-performace" >}}) to bring it to 42ms and unified collation across 121 tables
  - After merging per-service repos into a [**multi-module monorepo**]({{< relref "/blog/architecture/msa-to-multi-module" >}}), proposed, designed, and built the [**modular monolith re-consolidation**]({{< relref "/blog/architecture/msa-to-modular-monolith" >}}), replacing OpenFeign calls with module interfaces while keeping schemas and transaction managers separate so modules can be split again
  - Found ~120 `@Transactional` usages across 8 modules silently bound to the `@Primary` transaction manager; assigned per-module managers and added ArchUnit tests to prevent regressions
  - Switched test parallelism to JUnit 5 threads and added CI caching, [**cutting the full test run from 45 to 10 minutes**]({{< relref "/blog/backend/performance/ci-test-build-optimization" >}})
- **[Results]**
  - Core domains (listings, matching, brokers) migrated **with zero downtime**
  - Pods 26+ → **5–7**, infrastructure costs **down 36%** (cloud cost before vs. after re-consolidation)
- **Tech**: `Kotlin`, `Spring Boot`, `JPA`, `OpenFeign`, `AWS SNS/SQS`, `MySQL`, `JUnit 5`, `ArchUnit`
{{% /details %}}

- #### **[Bootalk AI](https://bootalk.co.kr/ai/chat): LLM-based Conversational Real Estate Agent**
  Built the agent loop from scratch and **shipped on web and app in 2026.11**; LLM calls per question **2.9 → 2.3**
{{% details title="**See Details**" %}}
- **Period**: 2025.08 ~ Present | Designed and built the agent pipeline
- **[Problem]**
  - The product moved to a conversational experience, and the [**Plan-and-Execute listing recommender**]({{< relref "/blog/architecture/ai-property-recommendation-system" >}}) I had designed and operated couldn't handle follow-up questions or re-searches
- **[Key Contributions]**
  - Implemented the [**agent loop**]({{< relref "/blog/architecture/real-estate-integrated-agent" >}}) (build context → call LLM → run tools → apply results) in Kotlin without Spring AI or LangChain4j, connecting 30 tools
  - Brokerage requests and alert registrations are only proposed by the LLM and [**run after the user confirms**]({{< relref "/blog/architecture/real-estate-integrated-agent-llm-boundary" >}}) (human-in-the-loop)
  - Logged LLM and tool calls with arguments, tokens, and latency to trace the basis of each answer; capped iterations and tokens per turn
  - Streamed responses over SSE; system prompts load from a config server so they change without a deploy
  - Added a real-estate Q&A RAG tool (Elasticsearch vector search); fixed the order of system prompt and tool definitions to keep prompt cache hits
  - Prevented concurrent requests in the same conversation with a Redis distributed lock and optimistic locking (`@Version`), added rate limiting, and deployed the AI module as a separate service for load isolation
  - Regression-tested every system prompt or tool change against a set of real production user questions
- **[Results]**
  - **Shipped on web and app in November 2026**
  - On the same real user questions, LLM calls per question **2.9 → 2.3**; **95%** of input tokens hit the prompt cache (development environment)
- **Tech**: `Kotlin`, `Spring Boot`, `OpenAI Responses API (Tool Calling)`, `Elasticsearch`, `MySQL`, `Redis`, `SSE`
{{% /details %}}

- #### **API, Query, and Batch Performance**
  Apartment complex info API **P95 4,045ms → under 50ms**, trading volume ranking API **P95 1.9–2.4s → 95ms**
{{% details title="**See Details**" %}}
- **Period**: 2025.12 ~ 2026.04 | Root-cause analysis and implementation
- **[Problem]**
  - Average response times were a few hundred ms, but some APIs took seconds at P95 in production Grafana
  - The favorite-complex alert batch took 50 minutes on average and up to 87 minutes
- **[Key Contributions]**
  - [**Identified the cause per API first**]({{< relref "/blog/backend/performance/backend-api-performance-optimization" >}}) with EXPLAIN and Tempo traces
  - Applied Cache-Aside instead of Write-Through to the rarely written apartment complex info API, with TTL jitter and DB fallback when Redis fails
  - Fixed a non-sargable condition in the trading volume ranking API to compare columns directly
  - Fixed N+1 queries in the alert batch with bulk lookups
  - Traced slow first requests after deploys to JIT compilation and [**added warm-up**]({{< relref "/blog/backend/performance/k8s-jvm-warm-up" >}}), holding traffic with a startupProbe until it finishes
- **[Results]**
  - Apartment complex info API P95: 4,045ms → **under 50ms**
  - Trading volume ranking API: EXPLAIN rows ~1.2M → 14K, P95 1.9–2.4s → **95ms**
  - Alert batch (together with a colleague's reader query improvement): average 50 → **21 minutes**, max 87 → **25 minutes**
- **Tech**: `Kotlin`, `Spring Boot`, `JPA`, `QueryDSL`, `MySQL`, `Redis`, `Spring Batch`, `Grafana`, `Tempo`
{{% /details %}}

- #### **Kubernetes Infrastructure and Monitoring**
  GitOps cut **rollback from 12 to 2 minutes**; brought console-managed AWS resources **into Terraform**
{{% details title="**See Details**" %}}
- **Period**: 2025.04 ~ Present | Proposed, designed, built, and operated (alongside backend development)
- **[Problem]**
  - Services ran with Docker Compose on a single server, and incidents were only noticed through customer inquiries
  - There was no development environment to verify changes
- **[Key Contributions]**
  - Proposed [**adopting Kubernetes**]({{< relref "/blog/infrastructure/docker-compose-to-k8s" >}}) to replace the single point of failure, chose GKE, and moved deployments to ArgoCD GitOps; built the development environment first and verified it before moving production
  - Proposed and built [**monitoring on the Grafana stack (Loki, Tempo, Prometheus)**]({{< relref "/blog/infrastructure/building-a-monitoring-system" >}}), which we could run ourselves at lower cost than ELK
  - In July 2025, [**moved services from a separate IDC to AWS with zero downtime**]({{< relref "/blog/infrastructure/from-on-premises-to-cloud-a-zero-downtime-migration-story" >}}) by replicating the DB with AWS DMS CDC, introducing Terraform; later imported existing AWS resources and reconciled manual changes (drift) with code
  - In April 2026, moved to EKS built with Terraform; in September–November 2026, [**upgraded to EKS 1.37 and MySQL 8.4**]({{< relref "/blog/infrastructure/eks-mysql-end-of-standard-support-upgrade" >}}) and [**migrated to the Gateway API**]({{< relref "/blog/infrastructure/eks-node-upgrade-to-1-37-gateway-api" >}})
  - Measured failures by sending external requests throughout node rolls, matched failure times against Kubernetes events to find the cause, and applied graceful shutdown
  - Defined an availability SLI and SLO and built [**error budget and burn rate dashboards**]({{< relref "/blog/infrastructure/from-observability-to-reliability-slo-error-budget" >}})
- **[Results]**
  - Rollback 12 → **2 minutes**, deployment 15 → **5 minutes**
  - Incidents previously noticed only via customer inquiries are now caught by alerts **within minutes**
  - **No request failures** on the Gateway path during the EKS 1.37 production node roll
- **Tech**: `AWS EKS`, `GKE`, `Terraform`, `ArgoCD`, `AWS DMS`, `Gateway API (Istio)`, `Grafana`, `Loki`, `Tempo`, `Prometheus`, `OpenTelemetry`
{{% /details %}}

- #### **Authentication, Authorization, and Payments**
  JWT authn/authz across all APIs, refresh token rotation, Toss Payments and iOS in-app purchase integration
{{% details title="**See Details**" %}}
- **Period**: 2026.01 ~ Present | Design and implementation
- **[Problem]**
  - The app and its web view could request a token refresh with the same refresh token at the same time (race condition)
  - Paid features needed verification so that one payment couldn't be used for multiple analyses
- **[Key Contributions]**
  - Applied JWT authn/authz to all APIs: authentication is required unless an annotation says otherwise, and role-based access uses annotation-based RBAC; user identifiers come only from token claims
  - Serialized refresh token reissue with a pessimistic lock and gave the previous token a 10-second grace period; on reuse detection, the whole token family is revoked
  - Built OAuth 2.0 social account linking/unlinking and phone number change APIs; blocked SMS verification abuse with Redis rate limiting
  - Integrated Toss Payments and iOS in-app purchases (App Store Server API, JWS signature verification) for a paid registry analysis feature, with server-side order/payment matching and idempotency
- **[Results]**
  - Even with simultaneous refresh requests from the app and web view, a token is rotated only once, and one payment is used for exactly one analysis
- **Tech**: `Kotlin`, `Spring Boot`, `JWT`, `MySQL`, `Redis`, `Toss Payments`, `App Store Server API`
{{% /details %}}

---

### **HelloFintech Co., Ltd.**
> P2P online investment-linked finance platform (KRW 2.5 trillion cumulative loans) <br>
>*2023.03 ~ 2025.03 (2 years)* | Backend Engineer

{{< callout type="info" icon="code" >}}
**Tech Stack**: `Java` `Spring Boot` `Spring Batch` `JPA` `QueryDSL` `MyBatis` `MySQL` `Redis (Redisson)` `Kubernetes` `Jenkins` `ArgoCD`
{{< /callout >}}

- #### **Settlement Renewal**
  Consolidated settlement logic into one server, cutting the time to ship a requirement **from 4 weeks to 2 on average**
{{% details title="**See Details**" %}}
- **Period**: 2024.06 ~ 2025.03 | Proposed and led design and build (4-person team)
- **[Problem]**
  - Settlement logic was spread across 3 servers, 13 stored procedures, and 11 functions, so even one requirement touched many places
  - The existing procedures corrupted some settlement data when called concurrently
- **[Key Contributions]**
  - Proposed consolidating into a single settlement server (adopted) and designed a gradual migration
  - Each time a piece of logic moved, compared results from the old procedures and the new server to verify consistency
  - Prevented duplicate settlement with a Redisson distributed lock
  - Introduced PR-based code review and [**Git Flow**]({{< relref "/blog/culture/git-flow-introduction" >}}) to a team that had been merging straight into the dev branch, with priority labels (P1–P5) on review comments
- **[Results]**
  - Time to ship a requirement (to ticket completion): 4 weeks → **2 weeks** on average
  - No mismatches in result comparisons, and no recurrence of data corruption from concurrent calls
- **Tech**: `Java`, `Spring Boot`, `JPA`, `MySQL`, `Redisson`
{{% /details %}}

- #### **Back-office Incident Resolution and Performance**
  Resolved connection exhaustion; housing price API average response **5.1s → 1.3s**
{{% details title="**See Details**" %}}
- **Period**: 2023.04 ~ 2025.03 | Root-cause analysis and performance work
- **[Problem]**
  - An outage where all 40 connections were held and requests waited, read-after-write inconsistencies, and an external housing price API averaging 5.1 seconds
- **[Key Contributions]**
  - Reproduced the [**HikariCP deadlock**]({{< relref "/blog/backend/troubleshooting/hikaricp-deadlock-with-jpa-mybatis" >}}) with a pool size of 1, found that OSIV plus mixed JPA/MyBatis held two connections per request, and removed the mixing
  - Fixed read inconsistencies caused by [**replication lag**]({{< relref "/blog/backend/troubleshooting/db-replication-lag" >}}) with an AOP that routes only reads right after writes to the master (read-your-writes)
  - Applied [**Cache-Aside (Redis)**]({{< relref "/blog/backend/performance/look-aside-cache-api-perf" >}}) to the external housing price API, invalidating on price updates
- **[Results]**
  - External calls **down 76%**, average response 5.1s → **1.3s** (57ms on cache hit)
- **Tech**: `Java`, `Spring Boot`, `JPA`, `QueryDSL`, `MyBatis`, `Redis`, `MySQL`
{{% /details %}}

- #### **Chunk/Partitioning Migration of the Deposit Balance Verification Batch**
  Longest transaction **22 minutes → 0.01 seconds**, average run time **13.3 → 4.8 minutes**
{{% details title="**See Details**" %}}
- **Period**: 2023.05 ~ 2024.12 | Root cause, proposed the Chunk/Partitioning migration, technical decisions and code review; took part in the Spring Batch migration
- **[Problem]**
  - The existing balance verification batch (Tasklet) ran as a single transaction of up to 22 minutes, so the REPEATABLE READ MVCC snapshot stayed fixed and deposits arriving mid-run were missed, triggering false mismatch alerts
- **[Key Contributions]**
  - Confirmed the fixed snapshot as the cause and proposed a [**Chunk/Partitioning migration**]({{< relref "/blog/backend/performance/spring-batch-tasklet-to-chunk" >}}); joined the design, made technical decisions and reviewed code, migrating with two teammates
  - Took part in the ongoing PHP/Crontab-to-Spring Batch migration and moved some batches
  - Resolved a [**metadata deadlock**]({{< relref "/blog/backend/troubleshooting/spring-batch-job-deadlock" >}}) under concurrent job runs by changing the JobRepository isolation level
- **[Results]**
  - Longest transaction 22 minutes → **~0.01 seconds**, reflecting deposits that arrive mid-run almost in real time
  - Average run time 13.3 → **4.8 minutes**
- **Tech**: `Java`, `Spring Boot`, `Spring Batch`, `JPA`, `MySQL`
{{% /details %}}

- #### **Infrastructure Operations in a Network-Separated Financial Environment**
  **Ran the Kubernetes cluster and deployment pipeline alone for 7 months** in a network-separated environment
{{% details title="**See Details**" %}}
- **Period**: 2023.12 ~ 2024.06 | Sole operator of the Kubernetes cluster and deployment pipeline
- **[Problem]**
  - A sidecar image on the latest tag couldn't be pulled, blocking deployments for every service; async jobs and sessions were lost during scale-in
- **[Key Contributions]**
  - Volunteered to run the Kubernetes cluster and Jenkins/ArgoCD pipeline in a network-separated financial environment, managing deployments and access for all services
  - Pinned the sidecar image version and changed the imagePullPolicy
  - Applied [**graceful shutdown**]({{< relref "/blog/backend/troubleshooting/graceful-shutdown-async" >}}) so async jobs finish during HPA scale-in, and shared sessions through Redis
- **[Results]**
  - Restored deployments for all services; no loss of async jobs or sessions during scale-in
- **Tech**: `Kubernetes`, `Jenkins`, `ArgoCD`, `Redis`
{{% /details %}}

## **Side Project**

#### **Upvy** - Educational Short-form Video Platform
> *2025.10 ~ Present* | [App Store](https://apps.apple.com/app/upvy/id6756291696) | [Play Store](https://play.google.com/store/apps/details?id=com.upvy.app) | [GitHub](https://github.com/12OneTwo12/upvy)

- **Overview**: Educational short-form platform that turns scroll time into learning time
- **Tech**: `Kotlin` `Spring WebFlux` `R2DBC` `React Native` `Vertex AI`
- **Highlights**: Solo development · Live on App Store · 79% test coverage
- **Key Implementation**: AI-powered YouTube video auto-editing pipeline (Vertex AI Gemini + Speech-to-Text)

## **Education**

- **Korea National Open University**, Computer Science (transfer student, enrolled) (2025.03 ~ Present)
- **Academic Credit Bank System**, Computer Engineering credits completed (2022.11 ~ 2024.10)
- **Korean International School Ho Chi Minh City**, graduated (2014 ~ 2017)

## **Certificate**

- **[ISTQB CTFL]({{< relref "/blog/reflection/istqb-ctfl" >}})** \| ISTQB / 2026.04
- **[Certified Kubernetes Administrator (CKA)](https://www.credly.com/badges/e357623d-2e5c-4c5c-aed9-d3e90f06aa56/public_url)** \| CNCF / 2025.11
- **Linux Master Level 2** \| KAIT / 2024.10
- **[Certified Cloud Practitioner (CCP)](https://www.credly.com/badges/924d4107-fbcb-4a48-abed-7f42266ae34f/public_url)** \| AWS / 2024.08
- **SQLD** \| Korea Data Agency / 2022.12

## **Activity**

- **Open Source**: Spring Security documentation improvement [PR#16216](https://github.com/spring-projects/spring-security/pull/16216)
- **Tech Study**: [Backend Article Study](https://minnim1010.notion.site/6af63324e8614108bf32b0c2f5a1c87c) (2023.08 ~ ongoing)
- **Training**: [Big Data Based Intelligent SW and MLOps Developer Course](https://inthiswork.com/archives/105995) (2022.07 ~ 2022.12)
