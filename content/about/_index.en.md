---
title: "About Me"
toc: true
---

## **Profile**
**"I'm Jeong Jeong-il, a developer who enjoys digging into the root of a problem, starting with the question 'Why?'"**

Hello! I'm a backend developer who loves uncovering the real story behind the error logs. For me, development is more than just writing code; it's like a detective novel where I hypothesize and persistently dig to solve a single problem.

Instead of getting lost in the technical implementation itself, I enjoy asking myself questions like:

> "What improvement does our service need most right now?" <br>
> "What's the optimal way to solve this problem, and is it right for our team's situation?" <br>
> "What do our users really want?".

I believe these considerations act as the most solid compass to guide my technical decisions.

This blog is a record of my struggles and growth. Rather than glamorous success stories, I want to honestly share the deep thought/worry I faced during problem-solving and the 'Aha!' moments of realization. Please feel free to share your experiences and opinions. I want to share the joy of learning and growing together.

![GitHub 잔디](https://ghchart.rshah.org/12OneTwo12)

## **Skills**

| Skill         |              Experience (Years)               | Description                                                                       |
|:--------------|:---------------------------------------------:|:----------------------------------------------------------------------------------|
| Java          | `{{< experience-years start="2023-03-06" >}}` | Experience developing backend systems in various environments such as MSA and Batch |
| Kotlin        | `{{< experience-years start="2023-08-01" >}}` | Experience with asynchronous processing using Coroutines and as a primary language in MSA environments |
| Spring Boot   | `{{< experience-years start="2023-03-06" >}}` | Experience developing and operating REST APIs using Spring Security, Actuator, etc. |
| Spring Batch  | `{{< experience-years start="2023-05-01" >}}` | Experience designing large-scale data processing systems and optimizing performance through Chunk and Partitioning |
| Spring Cloud  | `{{< experience-years start="2024-03-01" >}}` | Experience building and operating MSA using Gateway, Eureka, etc. |
| MySQL         | `{{< experience-years start="2023-03-06" >}}` | **Certified - SQL Developer** \| Experience in database design, query tuning, and Replication operations |
| Kubernetes    | `{{< experience-years start="2023-12-01" >}}` | Experience designing and building GKE-based infrastructure and automating deployments with ArgoCD |
| Linux         | `{{< experience-years start="2022-03-06" >}}` | **Certified - Linux Master Level-II**, **AWS Certified Cloud Practitioner (CCP)** \| Experience in server configuration, script writing, and operations |

## **Work Experience**

### **Bootalk Inc.**
> AI-based and BigData-utilized real estate brokerage platform <br>
>*2025.03 ~ Present ({{< work-duration start="2025-03-01" >}})* | Dev. Team - Back-end Engineer

{{< callout type="info" icon="code" >}}
**[Key Technologies Used]**: `Kotlin` `Spring Cloud` `Kubernetes` `ArgoCD` `Opentelemetry` `Grafana LGTM Stack` `Redis` `MySQL` `Manticore Search`
{{< /callout >}}

- #### **Participated in Design and Implementation of Monolithic Architecture → MSA Transition**
  **[Key Achievement]** **Doubled the speed of new feature additions** by decoupling tightly coupled domains and successfully transitioning to MSA
{{% details title="**See Details**" %}}
- **Project Overview**: A project that migrated a Java Servlet legacy monolithic architecture service to a [**Kotlin/Spring Cloud-based MSA with zero downtime**]({{< relref "/blog/architecture/is-gradual-msa-transition-an-illusion" >}})
- **Duration**: 2025.04 ~ 2025.09 (3 members)
- **[Problem]**
  - At the time of joining, MSA separation of loosely coupled domains such as notifications and user events was complete.
  - **Tightly coupled core domains** (real estate listings, broker-user matching) encountered **strong coupling problems** that could not be solved by existing strategies → Gradual transition was impossible.
  - Existing MSA transition strategy (separate separation by domain) carried **risks of data inconsistency and tangled business logic**.
- **[Solution & Role]**
  - Established and executed a realistic **MSA transition strategy** to resolve tightly coupled domain issues, and designed transition period management strategies.
    - Applied a **partial big bang approach** by grouping tightly coupled domains (real estate listings + user matching) as a single transition unit for simultaneous separation.
    - During the transition, established a new MSA API call structure from legacy, dual writing for data duplication, and batch processing.
  - **Removed external technical dependencies from domain logic** with Hexagonal Architecture + CQRS pattern.
  - Reviewed and discussed various communication methods such as gRPC and Zero-Payload, built synchronous communication between services based on FeignClient, and event processing based on AWS SQS.
- **[Achievements]**
  - Achieved **service flexibility and independent scalability** by operating independent service units per domain through MSA transition.
  - Successfully migrated to MSA while **maintaining 100% service availability** of core services through zero-downtime transition.
  - **Increased the speed of subsequent service expansion and new feature additions by approximately 2 times** by stably separating tightly coupled domains.
- **[Key Technologies]**: `Kotlin`, `Spring Cloud`, `gRPC`, `Feign Client`, `CQRS`, `Hexagonal Architecture`, `AWS SQS`, `AWS SNS`, `Redis`
{{% /details %}}

- #### **Built and Operated Kubernetes-based Infrastructure and Monitoring System**
  **[Key Achievement]** Led Kubernetes transition to secure **high availability and scalability**, and built a monitoring system to **reduce incident detection time by 98%**.
{{% details title="**See Details**" %}}
- **Project Overview**: A project that [**proposed, designed, and built a Kubernetes-based transition**]({{< relref "/blog/infrastructure/docker-compose-to-k8s" >}}) from a single VM environment and [**proposed, designed, and built a monitoring system**]({{< relref "/blog/infrastructure/building-a-monitoring-system" >}}) to secure high availability and operational efficiency.
- **Duration**: 2025.04 ~ 2025.09 (1 member)
- **[Problem]**
  - Single instance + Shell Script/Docker CLI based deployment environment → **Single Point of Failure (SPOF)** leading to **decreased service reliability, requiring developer intervention for service expansion and disaster recovery**.
  - Absence of monitoring system led to **reliance solely on user CS for incident detection** → **Average of 1 hour to recognize problems**.
- **[Solution & Role]**
  - **Proposed, designed, and built** Kubernetes-based orchestration to secure **high availability** and **service scalability**.
    - Compared Managed Kubernetes (GKE) vs Self-Managed Kubernetes, then selected and introduced GKE considering in-house resources.
    - Removed Spring Cloud Eureka, API Gateway dependencies → **Transitioned to Kubernetes native environment**.
    - **Built deployment automation** with GitHub Actions based CI/CD pipeline and ArgoCD.
  - Recognized the 1-hour incident resolution time as a **critical issue that could lead to service abandonment**, and **proposed, designed, and built a monitoring and incident detection system**.
    - Compared ELK Stack vs Grafana·Loki·Tempo·Prometheus technologies and reviewed cost efficiency, then proposed and built the latter.
    - Centralized log/metric collection using Kubernetes sidecar pattern.
- **[Achievements]**
  - **Incident Detection Time**: Average **1 hour → 1 minute** (**98% reduction**), **proactive incident detection and response possible** without user CS, improved operational efficiency and productivity through metric visualization.
  - **Eliminated developer intervention** in incident recovery and service expansion → **Secured automation system**.
  - **Rollback Time**: Average **12 minutes → 2 minutes** (**83% reduction**).
  - **Secured zero-downtime deployment system** with Kubernetes rolling updates, improved deployment stability.
- **[Key Technologies]**: `Kubernetes`, `GCP GKE`, `ArgoCD`, `Github Actions`, `Grafana`, `Loki`, `Tempo`, `Prometheus`, `Opentelemetry`, `Kubernetes Sidecar`
{{% /details %}}

- #### **On-premise → AWS Cloud Zero-Downtime Transition**
  **[Key Achievement]** Successfully migrated from **on-premise to AWS cloud with zero downtime** without service interruption.
{{% details title="**See Details**" %}}
- **Project Overview**: A project that [**migrated services operating in an on-premise IDC to an AWS cloud environment with zero downtime**]({{< relref "/blog/infrastructure/from-on-premises-to-cloud-a-zero-downtime-migration-story" >}}) to improve stability, scalability, and operational efficiency.
- **Duration**: 2025.07 ~ 2025.08 (2 members)
- **[Problem]**
  - Intermittent server downtime issues due to hardware contact failures in the on-premise environment.
  - Limitations of manual scaling due to increasing traffic and increased operational burden due to complex operating environment.
- **[Solution & Role]**
  - **Responsible for establishing and executing a migration strategy for zero-downtime transition**: Established a dual operation strategy considering DNS propagation time to minimize degradation of user experience.
  - **Resolved data consistency issues (introduced CDC)**
    - Reviewed various technologies (Replication, Dual Write, Message Queue, etc.) to resolve **data inconsistency issues between IDC DB and AWS RDS** during the migration period.
    - Introduced **CDC (Change Data Capture)** technology, which has high real-time performance and reliability, to build a unidirectional real-time synchronization pipeline from IDC DB to AWS RDS. For the CDC solution, AWS DMS (Data Migration Service) was chosen for its **excellent compatibility with RDS and stable managed service** advantages for migration to the AWS environment.
  - Infrastructure automation (Terraform IaC): **Automated core infrastructure resources** such as EC2, RDS, VPC in the AWS environment with **Terraform code**.
- **[Achievements]**
  - **Successful zero-downtime transition**: Successfully migrated from on-premise to cloud without service downtime, maintaining user experience.
  - **Improved operational stability**: Resolved server downtime issues due to hardware failures.
  - **Secured scalability and efficiency**: Achieved scalability to flexibly respond to traffic changes through transition to the cloud environment.
  - Minimized human error through IaC, securing infrastructure reproducibility and documentation.
- **[Key Technologies]**: `AWS`, `Terraform`, `AWS DMS(CDC)`, `AWS RDS`, `AWS EC2`, `AWS VPC`
{{% /details %}}

---

### **Hello Fintech Co., Ltd.**
> P2P online investment-linked financial platform startup that achieved 2.5137 trillion won in cumulative loans <br>
>*2023.03 ~ 2025.03 (2 years)* | Backend Developer

{{< callout type="info" icon="code" >}}
**[Key Technologies Used]**: `Java` `Spring Boot` `Spring Batch` `JPA` `QueryDSL` `Redis` `MySQL` `Kubernetes` `ELK Stack`
{{< /callout >}}

- #### **Settlement Renewal Project**
  **[Key Achievement]** Integrated settlement logic distributed across 3 servers, 24 DB Procedures, and DB Functions, **improving requirement reflection speed by 46%**.
{{% details title="**See Details**" %}}
- **Project Overview**: **Proposed, designed, and built integration of settlement business logic** that was previously separated into multiple domains.
- **Duration**: 2024.06 ~ 2025.03 (4 members)
- **[Problem]**
  - Settlement logic was **distributed across 3 servers, 13 DB Procedures, and 11 DB Functions**, leading to high complexity and excessive maintenance and development costs.
  - **Race Condition occurred in distributed environment**.
- **[Solution & Role]**
  - [**Analyzed existing architecture and dependencies**](https://www.notion.so/Analyzed-the-existing-As-Is-settlement-architecture-and-dependency-configurations-13fde4324e3d80878b38c17b3370231f?pvs=21) and **designed a gradual transition strategy** to secure service stability.
  - Resolved Race Condition issues through **Redisson-based distributed lock**.
  - Proposed and introduced Git flow strategy to [**systematize configuration management**]({{< relref "/blog/culture/git-flow-introduction" >}})
- **[Achievements]**
  - **Reduced system complexity** leading to an [**average 46.31% improvement in requirement reflection speed**](https://www.notion.so/14ade4324e3d809b9af9ea4164ddd8cc?pvs=21) (4.06 weeks → 2.18 weeks).
  - **Improved reliability and stability** of settlement process by resolving concurrency issues.
  - **Successfully integrated** while maintaining service operational stability through gradual transition.
- **[Key Technologies]**: `Spring Boot 2.7.3`, `Java 11`, `JPA`, `Redisson`, `Rest API`
{{% /details %}}

- #### **Developed, Operated, and Improved Back-office Web Server**
  **[Key Achievement]** **Improved major API performance by 87%** through SQL tuning and caching.
{{% details title="**See Details**" %}}
- **Project Overview**: **Renewed PHP legacy back-office server to Java, Spring**, and further improved existing technical debt.
- **Duration**: 2024.04 ~ 2025.03 (2~6 members)
- **[Problem]**
  - **HikariCP Deadlock occurred** due to a mix of JPA and MyBatis within one Task.
  - **Data inconsistency issues** due to DB Replication lag.
  - **Increased server load** due to inefficient subqueries, unutilized indexes, and N+1 problems.
  - **Performance degradation** due to mixed domain logic in a single logic (e.g., saving evaluation results, sending SMS, administrator notifications when approving a loan).
- **[Solution & Role]**
  - [**Explored and identified the cause of HikariCP Deadlock**]({{< relref "/blog/reflection/hikaricp-deadlock-with-jpa-mybatis-memoir" >}}), [**resolved through unification to JPA**]({{< relref "/blog/backend/troubleshooting/hikaricp-deadlock-with-jpa-mybatis" >}}).
    - Considered separating connection pools, changing connection return timing of persistence context, but since Mybatis code was already scheduled to be changed to JPA, **resolved through unification to JPA**.
    - Prioritized fixing the problematic logic, and during the change week, increased the number of Pods to distribute load to prevent DBCP connection exhaustion.
  - [**Resolved DB Replication lag issue**]({{< relref "/blog/backend/troubleshooting/db-replication-lag" >}})
    - By dynamically separating DataSources using **`AbstractRoutingDataSource` and AOP**, the system was configured to use Slave DB for data retrieval and Master DB for changes, resolving data inconsistency issues caused by Replication lag.
  - **Performance Improvement**
    - Designed and implemented [**Redis-based caching**]({{< relref "/blog/backend/performance/look-aside-cache-api-perf" >}}) to improve API response speed.
    - **Removed unnecessary subqueries** and used Joins, utilized and reconfigured indexes, query tuning ([**index optimization, introduction of covering index for paging**]({{< relref "/blog/architecture/jpa-sql-ideology-and-gap" >}}))
    - Proposed and introduced **event-based asynchronous processing** to optimize performance and separate concerns.
- **[Achievements]**
  - **Improved user reliability** by resolving replication lag.
  - **Improved server stability** by resolving HikariCP Deadlock issues.
  - **Improved major API performance by 87.66%** through SQL tuning (Average: 10.295 seconds → 1.27 seconds).
  - **Improved API response speed by 74.69%** through Redis-based caching (Average: 5.132 seconds → 1.299 seconds).
  - **Improved system maintainability and performance** by separating concerns through event processing.
- **[Key Technologies]**: `Spring Boot 2.6.7`, `Spring Security`, `Java 11`, `JPA`, `Mybatis`, `Thymeleaf`
{{% /details %}}

- #### **Developed, Operated, and Improved Batch Server**
  **[Key Achievement]** **Reduced batch data processing time by 64%** by introducing Chunk/Partitioning.
{{% details title="**See Details**" %}}
- **Project Overview**: **Renewed PHP, Crontab legacy Batch server to Spring Batch**, and further improved technical aspects and operations.
- **Duration**: 2024.05 ~ 2025.03 (4~6 members)
- **[Problem]**
  - Built with PHP and Crontab, making management difficult, and **Deadlock issues occurred when Job ran concurrently** during the transition to Spring Batch.
  - **Performance degradation and data consistency issues** when processing large amounts of data with **Tasklet method**.
- **[Solution & Role]**
  - [**Identified and resolved Spring Batch Metadata Table Deadlock cause**]({{< relref "/blog/backend/troubleshooting/spring-batch-job-deadlock" >}})
    - Considered methods such as prohibiting concurrent execution of multiple Jobs, upgrading Spring Batch version (rejected due to requiring full Java, Spring Boot, Spring Batch version upgrade), and **changing Isolation Level related to Metadata Table**.
    - Prohibiting concurrent Job execution was unrealistic and rejected, Spring Batch version upgrade was rejected due to requiring full Java, Spring Boot, Spring Batch version upgrade, so **resolved by changing Isolation Level related to Metadata Table**.
  - [**Introduced Chunk-based processing and Partitioning method**]({{< relref "/blog/backend/performance/spring-batch-tasklet-to-chunk" >}}) to improve large data processing performance.
    - Optimized large data processing performance by compensating for the shortcomings of the Tasklet method.
    - Significantly improved batch performance from 13 minutes to 5 minutes.
- **[Achievements]**
  - **Established a stable Batch environment** by resolving Deadlock issues.
  - **Reduced data consistency issue occurrence by 99.9%** by resolving data consistency issues (maximum transaction processing time 22 minutes → 0.01 seconds).
  - **Optimized performance** by **reducing data processing time by 64%** (13.27 minutes → 4.77 minutes).
  - **Shared resolution case within the company**, documented for use by other teams.
- **[Key Technologies]**: `Spring Boot 2.7.3`, `Spring Batch`, `Java 11`, `JPA`, `MyBatis`
{{% /details %}}

## **Activity**

- **Spring Project Open Source Contribution**
  - Spring security / [PR#16216](https://github.com/spring-projects/spring-security/pull/16216)

- **[Backend Technology Article Study](https://minnim1010.notion.site/6af63324e8614108bf32b0c2f5a1c87c)**
  - 2023.08 ~ ongoing / 1-2 times a week

- **[Big Data Based Intelligent SW and MLOps Developer Training Course](https://inthiswork.com/archives/105995)**
  - Playdata (encore) / 2022.07~2022.12

## **Certificate**

- **Linux Master Level 2** \| KAIT / 2024.10
- **Certified Cloud Practitioner (CCP)** \| AWS / 2024.08
- **SQLD** \| Korea Data Agency / 2022.12
