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

jji042842@gmail.com · [GitHub](https://github.com/12OneTwo12) · [Blog](https://jeongil.dev/ko/blog)

## **Profile**

**"왜?"라는 질문에서 출발해 문제의 근원을 파고드는 것을 즐기는 개발자 정정일입니다.**

에러 로그 하나에서 HikariCP Deadlock의 원인을 찾아냈고, "왜 장애 인지가 느릴까?"라는 질문으로 모니터링 시스템을 구축해 인지 시간을 1시간에서 1분으로 줄였습니다.

기술 구현 자체보다 **"지금 서비스에 가장 필요한 개선이 무엇인가?"** 를 먼저 생각합니다.

**Core Strengths:** MSA 전환 설계 및 구현 · K8s 인프라 구축 · 쿼리 및 API 성능 최적화 · 모니터링 시스템 구축

## **Skills**

| Skill         |                  Experience (Years)                  | Description                                                                       |
|:--------------|:---------------------------------------------:|:----------------------------------------------------------------------------------|
| Java          | `{{< experience-years start="2023-03-06" >}}` | MSA, Batch 등 다양한 환경에서의 백엔드 시스템 개발 경험                                       |
| Kotlin        | `{{< experience-years start="2023-08-01" >}}` | Coroutine을 활용한 비동기 처리 및 MSA 환경에서의 메인 언어 활용 경험                          |
| Spring Boot   | `{{< experience-years start="2023-03-06" >}}` | Spring Security, Actuator 등을 활용한 REST API 개발 및 운영 경험                          |
| Spring Batch  | `{{< experience-years start="2023-05-01" >}}` | 대규모 데이터 처리 시스템 설계 및 Chunk, Partitioning을 통한 성능 최적화 경험                   |
| Spring Cloud  | `{{< experience-years start="2024-03-01" >}}` | Gateway, Eureka 등을 활용한 MSA 구축 및 운영 경험                                     |
| MySQL         | `{{< experience-years start="2023-03-06" >}}` | **Certified - SQL Developer** \| 데이터베이스 설계, 쿼리 튜닝 및 Replication 운영 경험                         |
| Kubernetes    | `{{< experience-years start="2023-12-01" >}}` | **Certified - Certified Kubernetes Administrator (CKA)** \| GKE 기반 인프라 구축, Helm 패키지 관리 및 ArgoCD 배포 자동화 경험 |
| Linux         | `{{< experience-years start="2022-03-06" >}}` | **Certified - Linux Master Level-II**, **AWS Certified Cloud Practitioner (CCP)** \| 서버 설정 및 스크립트 작성 등 운영 경험     |

## **Work Experience**

### **부톡㈜**
> AI 기반 부동산 중개 플랫폼 <br>
>*2025.03 ~ Present ({{< work-duration start="2025-03-01" >}})* | Back-end Developer (개발팀 4명)

{{< callout type="info" icon="code" >}}
**주요 기술**: `Kotlin` `Spring Cloud` `Kubernetes` `ArgoCD` `Grafana LGTM Stack` `Redis` `MySQL`
{{< /callout >}}

- #### **모놀리식 → MSA 전환 설계 및 구현**
  강결합 도메인 분리, **서비스 가용성 100% 유지하며 전환 완료**
{{% details title="**자세히 보기**" %}}
- **개요**: Java Servlet 기반 모놀리식을 [Kotlin/Spring Cloud MSA로 무중단 전환]({{< relref "/blog/architecture/is-gradual-msa-transition-an-illusion" >}})
- **기간**: 2025.04 ~ 2025.11 | 3명 팀, 5개 서비스 구현 주도 (부동산 매물·중개사-사용자 매칭·실거래가·유저·알림)
- **[문제]**
  - 핵심 도메인(매물, 중개사-사용자 매칭)의 강결합으로 기존 점진적 전환 전략 적용 불가
  - 도메인별 개별 분리 시 데이터 불일치 및 비즈니스 로직 꼬임 위험
- **[주요 기여]**
  - 강결합 도메인을 하나의 단위로 묶어 동시 분리하는 **부분적 빅뱅 전략 설계**
  - 과도기 **데이터 정합성 보장**을 위한 Dual Write + 검증 배치 설계
  - 헥사고날 아키텍처 + CQRS 패턴 적용으로 **도메인 로직의 기술 의존성 제거**
  - FeignClient 동기 통신, AWS SQS **이벤트 기반 통신 구축**
- **[성과]**
  - 서비스 가용성 **100% 유지**하며 MSA 전환 완료
  - 헥사고날 아키텍처 적용으로 **도메인 독립 배포 체계 구축**
- **기술**: `Kotlin`, `Spring Cloud`, `Feign Client`, `CQRS`, `Hexagonal Architecture`, `AWS SQS`
{{% /details %}}

- #### **Kubernetes 인프라 및 모니터링 시스템 구축**
  장애 인지 시간 **98% 단축** (1시간 → 1분), 롤백 시간 **83% 단축**
{{% details title="**자세히 보기**" %}}
- **개요**: 단일 VM에서 [Kubernetes로 전환]({{< relref "/blog/infrastructure/docker-compose-to-k8s" >}}) 및 [모니터링 시스템 구축]({{< relref "/blog/infrastructure/building-a-monitoring-system" >}})
- **기간**: 2025.04 ~ 2025.09 | 인프라 영역 전담
- **[문제]**
  - 단일 인스턴스 + Shell Script 배포 → **SPOF**, 장애 복구 시 개발자 수동 개입 필수
  - 모니터링 부재로 장애 인식을 CS에만 의존 (평균 1시간 소요)
- **[주요 기여]**
  - GKE vs Self-Managed K8s 비교 후 **GKE 도입 제안 및 구축**
  - Spring Cloud Eureka/Gateway 종속성 제거 → **Kubernetes 네이티브 전환**
  - GitHub Actions + ArgoCD 기반 **CI/CD 파이프라인 구축**
  - Grafana LGTM Stack **모니터링 시스템 설계 및 구축** (사이드카 패턴 활용)
- **[성과]**
  - 장애 인지 시간: 1시간 → **1분 (98% 단축)**
  - 롤백 시간: 12분 → **2분 (83% 단축)**
  - **무중단 배포** 체계 및 **자동 스케일링** 확보
- **기술**: `Kubernetes`, `GKE`, `ArgoCD`, `GitHub Actions`, `Grafana`, `Loki`, `Tempo`, `Prometheus`
{{% /details %}}

- #### **온프레미스 → AWS 클라우드 무중단 마이그레이션**
  서비스 **다운타임 0**으로 클라우드 전환 성공
{{% details title="**자세히 보기**" %}}
- **개요**: [온프레미스 IDC에서 AWS로 무중단 전환]({{< relref "/blog/infrastructure/from-on-premises-to-cloud-a-zero-downtime-migration-story" >}})
- **기간**: 2025.07 ~ 2025.08 | 2명 팀, 전략 설계 및 DMS·Terraform 구축 담당
- **[문제]**
  - 하드웨어 접촉 불량으로 간헐적 서버 다운 발생
  - 수동 스케일링 한계 및 운영 부담 가중
- **[주요 기여]**
  - DNS 전파 시간을 고려한 **이중 운영 전략** 설계
  - AWS DMS(CDC) 기반 IDC → RDS **실시간 동기화 파이프라인 구축**
  - Terraform으로 AWS 인프라(EC2, RDS, VPC) **코드화**
- **[성과]**
  - **다운타임 0**으로 마이그레이션 완료
  - 하드웨어 장애 이슈 해결, 트래픽 대응 확장성 확보
- **기술**: `AWS`, `Terraform`, `AWS DMS`, `AWS RDS`, `AWS VPC`
{{% /details %}}

---

### **㈜헬로핀테크**
> P2P 온라인투자연계 금융플랫폼 (누적대출액 2조 5천억원) <br>
>*2023.03 ~ 2025.03 (2년)* | Back-end Developer (개발팀 5~10명)

{{< callout type="info" icon="code" >}}
**주요 기술**: `Java` `Spring Boot` `Spring Batch` `JPA` `Redis` `MySQL` `Kubernetes`
{{< /callout >}}

- #### **백오피스 서버 성능 최적화**
  SQL 튜닝 및 캐싱으로 **API 응답속도 87% 개선** (10.3초 → 1.3초)
{{% details title="**자세히 보기**" %}}
- **개요**: PHP 레거시 백오피스를 Spring으로 전환하며 성능 개선
- **기간**: 2024.04 ~ 2025.03 | 2~6명 팀, 성능 최적화 및 트러블슈팅 참여
- **[문제]**
  - JPA + MyBatis 혼용으로 [**HikariCP Deadlock** 발생]({{< relref "/blog/reflection/hikaricp-deadlock-with-jpa-mybatis-memoir" >}})
  - [**DB Replication 복제지연**]({{< relref "/blog/backend/troubleshooting/db-replication-lag" >}})으로 데이터 불일치
  - N+1, 인덱스 미활용으로 서버 부하 증가
- **[주요 기여]**
  - [JPA 일원화로 **Deadlock 해결**]({{< relref "/blog/backend/troubleshooting/hikaricp-deadlock-with-jpa-mybatis" >}})
  - AbstractRoutingDataSource + AOP로 **동적 DataSource 분리**
  - [Redis 캐싱]({{< relref "/blog/backend/performance/look-aside-cache-api-perf" >}}), [커버링 인덱스]({{< relref "/blog/architecture/jpa-sql-ideology-and-gap" >}}) 도입으로 **쿼리 성능 최적화**
  - [Git flow 도입]({{< relref "/blog/culture/git-flow-introduction" >}})으로 **협업 프로세스 개선**
- **[성과]**
  - API 응답속도: 10.3초 → **1.3초 (87% 개선)**
  - 캐싱 적용 API: 5.1초 → **1.3초 (75% 개선)**
  - HikariCP Deadlock 및 Replication 지연 문제 해결
- **기술**: `Spring Boot`, `Java 11`, `JPA`, `Redis`, `MySQL`
{{% /details %}}

- #### **서비스 인프라 운영 및 유지보수**
  DevOps 공백 기간 인프라 전담, **Redis Session Clustering으로 세션 유실 문제 해결**
{{% details title="**자세히 보기**" %}}
- **개요**: 클라우드 기반 서버 인프라 운영 및 유지보수
- **기간**: 2023.12 ~ 2024.09 | 인프라 운영 전담
- **[문제]**
  - 기존 DevOps 퇴사로 **인프라 운영 공백** 발생
  - K8s Ingress Sticky Session 설정으로 앱 재기동 시 **세션 유실** 발생
- **[주요 기여]**
  - 새로운 DevOps 입사 전까지 **인프라 운영 전담**
  - 19개 인스턴스, 10개 노드, 3개 웹 서버, 9개 WAS, 2개 DB **운영 및 유지보수**
  - **Redis Session Clustering** 도입으로 세션 유실 문제 해결
- **[성과]**
  - 운영 공백 기간 **안정적 인프라 유지**
  - 세션 유실 문제 해결로 **사용자 경험 개선**
- **기술**: `Kubernetes`, `Jenkins`, `ArgoCD`, `ELK`, `Prometheus`, `Redis`, `MySQL`
{{% /details %}}

- #### **Spring Batch 성능 최적화**
  Chunk/Partitioning 도입으로 **배치 처리 시간 64% 단축** (13분 → 5분)
{{% details title="**자세히 보기**" %}}
- **개요**: PHP/Crontab 기반 배치를 [Spring Batch로 전환]({{< relref "/blog/backend/performance/spring-batch-tasklet-to-chunk" >}}) 및 성능 개선
- **기간**: 2024.05 ~ 2025.03 | 4~6명 팀, 배치 시스템 전환 및 성능 최적화 설계 참여
- **[문제]**
  - [Job 동시 실행 시 Metadata Table Deadlock 발생]({{< relref "/blog/backend/troubleshooting/spring-batch-job-deadlock" >}})
  - Tasklet 방식으로 대량 데이터 처리 시 성능 저하 및 정합성 문제
- **[주요 기여]**
  - Isolation Level 변경으로 Deadlock 해결
  - Tasklet → **Chunk + Partitioning** 전환으로 성능 최적화
  - 해결 사례 **사내 문서화 및 공유**
- **[성과]**
  - 배치 처리 시간: 13.3분 → **4.8분 (64% 단축)**
  - 트랜잭션 처리 시간: 22분 → **0.01초 (정합성 문제 99.9% 감소)**
- **기술**: `Spring Batch`, `Java 11`, `JPA`
{{% /details %}}

## **Side Project**

### **Upvy** - 교육용 숏폼 영상 플랫폼
> [App Store](https://apps.apple.com/app/upvy/id6756291696) | [GitHub](https://github.com/12OneTwo12/upvy)

- **개요**: 스크롤 시간을 학습 시간으로 전환하는 교육용 숏폼 플랫폼
- **기술**: `Kotlin` `Spring WebFlux` `R2DBC` `React Native` `Vertex AI`
- **특징**: 1인 풀스택 개발 · App Store 출시 및 운영 중 · 79% test coverage
- **주요 구현**: AI 기반 YouTube 영상 자동 편집 파이프라인 (Vertex AI Gemini + Speech-to-Text)

## **Certificate**

- **[Certified Kubernetes Administrator (CKA)](https://www.credly.com/badges/e357623d-2e5c-4c5c-aed9-d3e90f06aa56/public_url)** \| CNCF / 2025.11
- **리눅스마스터 2급** \| KAIT / 2024.10
- **[Certified Cloud Practitioner (CCP)](https://www.credly.com/badges/924d4107-fbcb-4a48-abed-7f42266ae34f/public_url)** \| AWS / 2024.08
- **SQLD** \| 한국데이터산업진흥원 / 2022.12

## **Activity**

- **오픈소스**: Spring Security 문서 개선 기여 [PR#16216](https://github.com/spring-projects/spring-security/pull/16216)
- **기술 스터디**: [백엔드 아티클 스터디](https://minnim1010.notion.site/6af63324e8614108bf32b0c2f5a1c87c) (2023.08 ~ 진행중)
- **교육**: [빅데이터 기반 지능형SW 및 MLOps 개발자 양성 과정](https://inthiswork.com/archives/105995) (2022.07 ~ 2022.12)
