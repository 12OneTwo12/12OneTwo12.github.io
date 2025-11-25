---
title: "About Me"
toc: true
---

## **Profile**
**"왜?'라는 질문에서 출발해 문제의 근원을 파고드는 것을 즐기는 개발자 정정일입니다."**

안녕하세요! 저는 에러 로그 너머의 진짜 이야기를 찾아내는 것을 좋아하는 백엔드 개발자입니다. 저에게 개발은 단순히 코드를 작성하는 행위를 넘어, 하나의 문제를 해결하기 위해 가설을 세우고 집요하게 파고드는 한 편의 추리소설과도 같습니다.

저는 기술 구현 자체에만 매몰되기보다

>"우리 서비스에 지금 가장 필요한 개선은 뭘까?" <br>
"이 문제를 해결할 최적의 방법은 무엇이고, 우리 팀 상황에 적절한 방법은 뭘까?" <br>
"사용자가 정말로 원하는 것은 무엇일까?"

와 같은 질문을 스스로에게 던지는 것을 좋아합니다. 이런 고민들이 기술적 선택의 방향을 잡아주는 가장 단단한 나침반이 되어준다고 믿습니다.

이 블로그는 저의 삽질과 성장의 기록입니다. 화려한 성공담보다는, 문제 해결 과정에서 마주했던 고민과 '아하!'하는 깨달음의 순간들을 솔직하게 나누고 싶습니다. 여러분의 경험과 의견을 자유롭게 나눠주세요. 함께 배우고 성장하는 즐거움을 나누고 싶습니다.

![GitHub 잔디](https://ghchart.rshah.org/12OneTwo12)

## **Skills**

| Skill         |                  Experience (Years)                  | Description                                                                       |
|:--------------|:---------------------------------------------:|:----------------------------------------------------------------------------------|
| Java          | `{{< experience-years start="2023-03-06" >}}` | MSA, Batch 등 다양한 환경에서의 백엔드 시스템 개발 경험                                       |
| Kotlin        | `{{< experience-years start="2023-08-01" >}}` | Coroutine을 활용한 비동기 처리 및 MSA 환경에서의 메인 언어 활용 경험                          |
| Spring Boot   | `{{< experience-years start="2023-03-06" >}}` | Spring Security, Actuator 등을 활용한 REST API 개발 및 운영 경험                          |
| Spring Batch  | `{{< experience-years start="2023-05-01" >}}` | 대규모 데이터 처리 시스템 설계 및 Chunk, Partitioning을 통한 성능 최적화 경험                   |
| Spring Cloud  | `{{< experience-years start="2024-03-01" >}}` | Gateway, Eureka 등을 활용한 MSA 구축 및 운영 경험                                     |
| MySQL         | `{{< experience-years start="2023-03-06" >}}` | **Certified - SQL Developer** \| 데이터베이스 설계, 쿼리 튜닝 및 Replication 운영 경험                         |
| Kubernetes    | `{{< experience-years start="2023-12-01" >}}` | GKE 기반 인프라 설계, 구축 및 ArgoCD를 활용한 배포 자동화 경험                                  |
| Linux         | `{{< experience-years start="2022-03-06" >}}` | **Certified - Linux Master Level-II**, **AWS Certified Cloud Practitioner (CCP)** \| 서버 설정 및 스크립트 작성 등 운영 경험     |

## **Work Experience**

### **부톡㈜**
> AI기반과 BigData를 활용한 부동산 중개 플랫폼 <br>
>*2025.03 ~ Present ({{< work-duration start="2025-03-01" >}})* | Dev. Team - Back-end Engineer

{{< callout type="info" icon="code" >}}
**[주요 사용 기술]**: `Kotlin` `Spring Cloud` `Kubernetes` `ArgoCD` `Opentelemetry` `Grafana LGTM Stack` `Redis` `MySQL` `Manticore Search`
{{< /callout >}}

- #### **모놀리식 아키텍쳐 → MSA 전환 설계 참여 및 구현**
  **[핵심 성과]** 강결합 도메인 분리로 **신규 기능 추가 속도 2배 향상** 및 MSA 전환 성공
{{% details title="**자세히 보기**" %}}
- **프로젝트 개요**: Java Servlet 레거시 모놀리식 아키텍처 서비스를 [**Kotlin/Spring Cloud 기반 MSA로 무중단 전환**]({{< relref "/blog/architecture/is-gradual-msa-transition-an-illusion" >}})하며 마이그레이션한 프로젝트
- **기간**: 2025.04 ~ 2025.09 (3명)
- **[문제]**
  - 입사 당시 알림, 사용자 이벤트 등 느슨한 결합 도메인의 MSA 분리는 완료된 상태
  - **핵심 도메인**(부동산 매물, 중개사-사용자 매칭)이 기존 전략으로는 해결할 수 없는 **강한 결합 문제 발생** → 점진적 전환 불가
  - 기존 MSA 전환 전략(도메인별 개별 분리)으로는 **데이터 불일치 및 비즈니스 로직 꼬임 위험 존재**
- **[해결 및 역할]**
  - 도메인 강결합 문제 해결을 위한 현실적인 **MSA 전환 전략 수립 및 실행**, 과도기 관리 전략 설계
    - 강결합된 도메인(부동산 매물 + 사용자 매칭)을 하나의 전환 단위로 묶어 동시 분리하는 **부분적 빅뱅 방식 적용**
    - 과도기 동안 레거시에서 신규 MSA API 호출 구조, Dual Write를 통한 데이터 이중 적재 및 배치
  - 헥사고날 아키텍처 + CQRS 패턴으로 **도메인 로직의 외부 기술 의존성 제거**
  - gRPC, Zero-Payload 등 다양한 통신 방식을 검토 및 논의, FeignClient 기반 서비스 간 동기 통신, AWS SQS 기반 이벤트 처리 구축
- **[성과]**
  - MSA 전환을 통해 도메인별 독립 서비스 단위 운영으로 **서비스 유연성, 독립적 확장성 확보**
  - 무중단 전환을 통해 핵심 서비스의 **서비스 가용성을 100% 유지**하며 MSA 마이그레이션 성공
  - 강결합 도메인을 안정적으로 분리함으로써 **후속 서비스 확장 및 신규 기능 추가 속도 약 2배 향상**
- **[주요 기술]**: `Kotlin`, `Spring Cloud`, `gRPC`, `Feign Client`, `CQRS`, `Hexagonal Architecture`, `AWS SQS`, `AWS SNS`, `Redis`
{{% /details %}}

- #### **Kubernetes 기반 인프라, 모니터링 시스템 구축 및 운영**
  **[핵심 성과]** Kubernetes 전환을 주도해 **고가용성, 확장성**을 확보하고, 모니터링 시스템을 구축해 **장애 인지 시간을 98% 단축**
{{% details title="**자세히 보기**" %}}
- **프로젝트 개요**: 단일 VM 기반에서 [**Kubernetes 기반으로 전환을 제안·설계·구축**]({{< relref "/blog/infrastructure/docker-compose-to-k8s" >}})하고 [**모니터링 시스템을 제안·설계·구축**]({{< relref "/blog/infrastructure/building-a-monitoring-system" >}})하여 고가용성, 운영 효율성을 확보한 프로젝트
- **기간**: 2025.04 ~ 2025.09 (1명)
- **[문제]**
  - 단일 인스턴스 + Shell Script/Docker CLI 기반 배포 환경 → **단일 장애 지점(SPOF)**으로 인한 **서비스 신뢰성 저하, 서비스 확장 및 장애 복구 시 개발자 개입 필수**
  - 모니터링 시스템 부재로 **장애 인식을 사용자 CS에만 의존** → **문제 인식까지 평균 1시간 소요**
- **[해결 및 역할]**
  - **고가용성 확보** 및 **서비스 확장성**을 위해 Kubernetes 기반 오케스트레이션 **제안·설계·구축**
    - Managed Kubernetes(GKE) vs Self-Managed Kubernetes 비교 후, 사내 리소스를 고려해 GKE 선택 및 도입
    - Spring Cloud Eureka, API Gateway 종속성 제거 → **Kubernetes 네이티브 환경 전환**
    - GitHub Actions 기반 CI/CD 파이프라인 및 ArgoCD **배포 자동화 구축**
  - 장애 해결이 1시간 소요되는 문제는 **서비스 이탈로 이어질 수 있는 중대한 문제로 인식**해 **모니터링·장애 감지 시스템 제안·설계·구축**
    - ELK Stack vs Grafana·Loki·Tempo·Prometheus 기술 비교 및 비용 효율성 검토 후 후자를 제안 및 구축
    - 쿠버네티스 사이드카 패턴을 활용해 **로그/메트릭 수집을 중앙화**
- **[성과]**
  - **장애 인지 시간**: 평균 **1시간 → 1분**(**98% 단축**), 사용자 CS 없이 **선제적 장애 탐지 및 대응 가능**, 메트릭 시각화로 운영 효율성, 생산성 향상
  - 장애 복구 및 서비스 확장 시 **개발자 개입 제거 → 자동화 체계 확보**
  - **롤백 소요 시간**: 평균 **12분 → 2분**(**83% 단축**)
  - Kubernetes 롤링 업데이트로 **무중단 배포 체계 확보**, 배포 안정성 향상
- **[주요 기술]**: `Kubernetes`, `GCP GKE`, `ArgoCD`, `Github Actions`, `Grafana`, `Loki`, `Tempo`, `Prometheus`, `Opentelemetry`, `Kubernetes Sidecar`
{{% /details %}}

- #### **온프레미스 → AWS 클라우드 무중단 전환**
  **[핵심 성과]** 서비스 중단 없이 **온프레미스에서 AWS 클라우드로 무중단 마이그레이션 성공**
{{% details title="**자세히 보기**" %}}
- **프로젝트 개요**: [**온프레미스 IDC에서 운영되던 서비스를 AWS 클라우드 환경으로 무중단 전환**]({{< relref "/blog/infrastructure/from-on-premises-to-cloud-a-zero-downtime-migration-story" >}})하며 안정성, 확장성 및 운영 효율성을 개선한 프로젝트
- **기간**: 2025.07 ~ 2025.08 (2명)
- **[문제]**
  - 온프레미스 환경에서 하드웨어 접촉 불량으로 인한 간헐적 서버 다운 이슈가 발생
  - 트래픽 증가에 따른 수동 스케일링의 한계와 복잡한 운영 환경으로 인해 운영 부담이 가중
- **[해결 및 역할]**
  - **무중단 전환을 위한 마이그레이션 전략 수립 책임 및 실행**: DNS 전파 시간을 고려한 이중 운영 전략을 수립하여 사용자 경험 저하를 최소화
  - **데이터 정합성 문제 해결 (CDC 도입)**
    - 마이그레이션 기간 동안 **IDC DB와 AWS RDS 간의 데이터 불일치 문제**를 해결하기 위해 다양한 기술(Replication, Dual Write, Message Queue 등)을 검토
    - 실시간성과 신뢰성이 높은 **CDC(Change Data Capture)** 기술을 도입하여 IDC DB에서 AWS RDS로의 단방향 실시간 동기화 파이프라인을 구축, CDC 솔루션으론 AWS 환경으로의 이관에 있어 **RDS와의 뛰어난 호환성과 안정적인 관리형 서비스**라는 장점으로 AWS DMS(Data Migration Service)를 선택
  - 인프라 자동화 (Terraform IaC) : AWS 환경의 EC2, RDS, VPC 등 핵심 인프라 리소스를 **Terraform 코드로 자동화**
- **[성과]**
  - **무중단 전환 성공**: 서비스 다운타임 없이 성공적으로 온프레미스에서 클라우드로 마이그레이션하여 사용자 경험을 유지
  - **운영 안정성 향상**: 하드웨어 장애로 인한 서버 다운 이슈를 해결
  - **확장성 및 효율성 확보**: 클라우드 환경으로의 전환을 통해 트래픽 변화에 유연하게 대응할 수 있는 확장성을 확보
  - IaC를 통해 인적 오류를 최소화 인프라의 재현성 및 문서화를 확보
- **[주요 기술]**: `AWS`, `Terraform`, `AWS DMS(CDC)`, `AWS RDS`, `AWS EC2`, `AWS VPC`
{{% /details %}}

---

### **㈜헬로핀테크**
>투자, 대출 연계 P2P 온라인투자연계 금융플랫폼 스타트업으로 누적대출액 2조 5,137억원 달성 <br>
>*2023.03 ~ 2025.03 (2년)* | 개발팀 - 사원

{{< callout type="info" icon="code" >}}
**[주요 사용 기술]**: `Java` `Spring Boot` `Spring Batch` `JPA` `QueryDSL` `Redis` `MySQL` `Kubernetes` `ELK Stack`
{{< /callout >}}

- #### **정산 리뉴얼 프로젝트**
  **[핵심 성과]** 3개의 서버, 24개의 DB Procedure, DB Function으로 분산된 정산 로직 통합, **요구사항 반영 속도 46% 향상**
{{% details title="**자세히 보기**" %}}
- **프로젝트 개요**: 여러 도메인으로 분리되어 있던 **정산 비즈니스 로직 통합 제안·설계·구축**
- **기간**: 2024.06 ~ 2025.03 (4명)
- **[문제]**
  - 정산 로직이 **3개의 서버, 13개의 DB Procedure, 11개의 DB Function으로 분산되어** 복잡도 높아 유지보수와 개발 비용이 과도하게 발생
  - **분산환경에서의 Race Condition 발생**
- **[해결 및 역할]**
  - [**기존 아키텍처와 의존성을 분석**](https://www.notion.so/Analyzed-the-existing-As-Is-settlement-architecture-and-dependency-configurations-13fde4324e3d80878b38c17b3370231f?pvs=21)하고 **점진적 전환 전략을 설계**해 서비스 안정성을 확보
  - **Redisson 기반 분산 락**을 통해 Race Condition 문제 해결
  - Git flow 전략을 제안 및 도입하여 [**형상 관리 체계화**]({{< relref "/blog/culture/git-flow-introduction" >}})
- **[성과]**
  - 시스템 복잡도 감소로 [**요구사항 반영 속도 평균 46.31% 향상**](https://www.notion.so/14ade4324e3d809b9af9ea4164ddd8cc?pvs=21) ( 4.06주 → 2.18주 )
  - 동시성 문제 해결로 정산 프로세스의 **신뢰성 및 안정성 향상**
  - 점진적 전환 방식을 통해 **서비스 운영 안정성을 유지하며 통합 성공**
- **[주요 기술]**: `Spring Boot 2.7.3`, `Java 11`, `JPA`, `Redisson`, `Rest API`
{{% /details %}}

- #### **백오피스 웹서버 개발, 운영 및 개선**
  **[핵심 성과]** SQL 튜닝 및 캐싱 적용으로 **주요 API 성능 87% 개선**
{{% details title="**자세히 보기**" %}}
- **프로젝트 개요**: PHP 레거시 백오피스 서버 **Java, Spring으로 리뉴얼**하며 기존 기술 부채 및 추가 개선 진행
- **기간**: 2024.04 ~ 2025.03 (2~6명)
- **[문제]**
  - 한 Task 내에 JPA와 MyBatis 혼재로 인해 **HikariCP Deadlock 발생**
  - **DB Replication 복제지연 문제**로 일관성 이슈 발생
  - 비효율적인 서브쿼리와 인덱스 미활용 및 N+1 문제로 **서버 부하 증가**
  - 한 로직에서 **여러 도메인 로직 혼재**로 성능저하 (ex: 대출 승인 시 심사결과 저장, 문자 발송, 관리자 알림)
- **[해결 및 역할]**
  - [**HikariCP Dead Lock 탐방 및 원인 파악**]({{< relref "/blog/reflection/hikaricp-deadlock-with-jpa-mybatis-memoir" >}}), [**JPA로의 일원화를 통해 해결**]({{< relref "/blog/backend/troubleshooting/hikaricp-deadlock-with-jpa-mybatis" >}}).
    - Connection pool 분리, 영속성 컨텍스트 Connection 반환 시점 변경을 고려하였으나 Mybatis 코드를 JPA로 변경하는게 이미 예정된 상태였기에 **JPA로의 일원화를 통해 해결**.
    - 문제가 발생한 로직을 우선적으로 수정, 변경 주에는 Pod 수를 늘려 부하 분산을 통해 DBCP의 Connection 고갈이 모두 점유되지 않도록 조치.
  - [**DB Replication 복제지연 문제 해결**]({{< relref "/blog/backend/troubleshooting/db-replication-lag" >}})
    - `**AbstractRoutingDataSource**와 **AOP**를 활용하여 DataSource를 동적으로 분리함으로써, 데이터 조회 시에는 Slave DB를, 변경 시에는 Master DB를 사용하도록 하여 Replication 지연으로 인한 데이터 불일치 문제를 해결
  - **성능 개선**
    - [**Redis 기반 캐싱**]({{< relref "/blog/backend/performance/look-aside-cache-api-perf" >}})을 설계하고 구현해 API 응답 속도 개선
    - **불필요한 서브쿼리 제거** 및 Join 사용, 인덱스 활용 및 재설정, 쿼리 튜닝 [**인덱스 최적화, Paging 시 커버링 인덱스 도입**]({{< relref "/blog/architecture/jpa-sql-ideology-and-gap" >}})
    - **이벤트 기반 비동기 처리** 제안 및 도입으로 성능 최적화 및 관심사 분리
- **[성과]**
  - **복제 지연 해결**을 통한 사용자 **신뢰도 향상**
  - **HikariCP Dead Lock 문제 해결**을 통한 **서버 안정성 향상**
  - SQL 튜닝을 통해 주요 [**API 성능 87.66% 개선**](https://www.notion.so/13fde4324e3d80baaa2be6d9dfd173ee?pvs=21) ( 평균 :  10.295초 → 1.27초 )
  - Redis 기반 캐싱을 통한 API [**응답 속도 74.69% 개선**]({{< relref "/blog/backend/performance/look-aside-cache-api-perf" >}}) ( 평균 : 5.132초 → 1.299초 )
  - 이벤트 처리를 통한관심사 분리로 시스템의 **유지보수성 및 성능 향상**
- **[주요 기술]**: `Spring Boot 2.6.7`, `Spring Security`, `Java 11`, `JPA`, `Mybatis`, `Thymeleaf`
{{% /details %}}

- #### **Batch 서버 개발, 운영 및 개선**
  **[핵심 성과]** Chunk/Partitioning 도입으로 **배치 데이터 처리 시간 64% 단축**
{{% details title="**자세히 보기**" %}}
- **프로젝트 개요**: PHP, Crontab 레거시 Batch서버를 **Spring Batch로 리뉴얼**하며 추가 기술 개선 및 운영
- **기간**: 2024.05 ~ 2025.03 (4~6명)
- **[문제]**
  - PHP와 Crontab 기반으로 구축되어 관리가 어려웠으며, Spring Batch로 이전하는 과정에서 **Job 동시 실행 시 Deadlock 문제**가 발생
  - **Tasklet 방식**으로 대량 데이터 처리 시 성능 저하 및 데이터 정합성 문제 발생
- **[해결 및 역할]**
  - Spring Batch Metadata Table [**Deadlock 원인 파악 및 문제 해결**]({{< relref "/blog/backend/troubleshooting/spring-batch-job-deadlock" >}})
    - 여러 Job 동시 실행 금지, Spring Batch 버전 업 (Java, Spring Boot, Spring Batch 전체 버전업 필요로 반려), **Metadata Table 관련 Isolation Level 변경** 방법등을 고려
    - Job 동시 실행 금지는 비현실적이라 반려, Spring Batch 버전 업의 경우 서버 버전상 Java, Spring Boot, Spring Batch 전체 버전업 필요로 반려하여 **Metadata Table 관련 Isolation Level 변경하여 해결**
  - 대량 데이터 처리 성능을 개선하기 위해 [**Chunk 기반 처리 및 Partitioning 방식 도입**]({{< relref "/blog/backend/performance/spring-batch-tasklet-to-chunk" >}})
    - Tasklet 방식의 단점을 보완해 대량 데이터 처리 성능 최적화
    - 배치 성능을 기존 13분에서 5분으로 대폭 개선
- **[성과]**
  - **Deadlock 문제 해결**로 안정적인 Batch 환경 구축
  - 데이터 정합성 문제 해결로 **정합성 문제 발생확률 99.9% 감소** ( 최대 트랜잭션 처리 시간 22분 → 0.01초 )
  - **성능 최적화**를 통해 데이터 처리 시간을 **64% 단축** ( 13.27분 → 4.77분 )
  - 해결 사례를 **사내에 공유**, 다른 팀에서도 활용하도록 문서화
- **[주요 기술]**: `Spring Boot 2.7.3`, `Spring Batch`, `Java 11`, `JPA`, `MyBatis`
{{% /details %}}

## **Activity**

- **Spring 프로젝트 오픈소스 기여**
  - Spring security / [PR#16216](https://github.com/spring-projects/spring-security/pull/16216)

- **[백엔드 기술 아티클 스터디](https://minnim1010.notion.site/6af63324e8614108bf32b0c2f5a1c87c)**
  - 2023.08 ~ 진행중 / 주 1~2회

- **[빅데이터 기반 지능형SW 및 MLOps 개발자 양성 과정](https://inthiswork.com/archives/105995)**
  - 플레이데이터(encore) / 2022.07~2022.12

## **Certificate**

- **리눅스마스터 2급** \| KAIT / 2024.10
- **Certified Cloud Practitioner (CCP)** \| AWS / 2024.08
- **SQLD** \| 한국데이터산업진흥원 / 2022.12
