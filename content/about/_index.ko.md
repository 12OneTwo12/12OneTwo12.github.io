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

**"지금 우리 서비스에 가장 필요한 개선이 무엇인가?"** 를 고민하는 3년차 백엔드 개발자 정정일입니다.

API 성능 최적화부터 MSA 전환, K8s 인프라 구축 및 운영, 팀 개발문화 개선까지— 필요하다면 제안하고, 팀과 함께 만들어왔습니다.

MSA 전환을 서비스 중단 없이 완료했고, 장애 인지 시간을 1시간에서 1분으로 줄였습니다.

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
> AI 기반 부동산 중개 플랫폼 (누적 회원 21만, 중개 매칭 5만 건) <br>
>*2025.03 ~ Present ({{< work-duration start="2025-03-01" >}})* | Back-end Developer (개발팀 4명)

{{< callout type="info" icon="code" >}}
**주요 기술**: `Kotlin` `Spring Cloud` `Kubernetes` `ArgoCD` `Grafana LGTM Stack` `Redis` `MySQL`
{{< /callout >}}

- #### **모놀리식 → MSA 전환 아키텍처 설계 및 구현**
  강결합 도메인 분리, **무중단 전환 완료**, 공통 로직 수정 **16개 PR → 1개 PR**
{{% details title="**자세히 보기**" %}}
- **개요**: Java Servlet 기반 모놀리식을 Kotlin/Spring Cloud MSA로 무중단 전환
- **기간**: 2025.04 ~ 2025.11 | 3명 팀, 총 18개 서비스 중 5개 설계 및 구현 담당 (부동산 매물·중개사-사용자 매칭·실거래가·유저·알림)
- **[문제]**
  - 핵심 도메인(매물, 중개사-사용자 매칭)의 **강결합**으로 점진적 전환 전략 적용 불가
  - 공통 코드가 **16개 레포에 분산** → 동일 수정에 **16개 PR 필요**, 버전 불일치
- **[주요 기여]**
  - 초기 점진적 전환 시도 실패 후 [**부분적 빅뱅 전략 설계**]({{< relref "/blog/architecture/is-gradual-msa-transition-an-illusion" >}}) – 강결합 도메인 동시 분리로 전환
  - 과도기 **데이터 정합성 보장**을 위한 Dual Write + 검증 배치 설계
  - 헥사고날 아키텍처 + CQRS 패턴 적용으로 **도메인 로직의 기술 의존성 제거**
  - [**멀티모듈 구조 설계**]({{< relref "/blog/architecture/msa-to-multi-module" >}}) – 초기 Common 비대화 문제 발생 후 **Type/Enum/Util만 공통화**, 인프라 코드는 별도 모듈로 분리
- **[성과]**
  - **무중단** MSA 전환 완료, 헥사고날 아키텍처로 **도메인 독립 배포 체계** 구축
  - 공통 로직 수정: 16개 PR → **1개 PR**, 빌드 시간: 27분 → **8분**
- **기술**: `Kotlin`, `Spring Cloud`, `Feign Client`, `CQRS`, `Hexagonal Architecture`, `AWS SQS`
{{% /details %}}

- #### **Kubernetes 인프라 및 모니터링 시스템 구축**
  모니터링 부재 환경에서 장애 인지 시간 **98% 단축** (1시간 → 1분), 배포 시간 **67% 단축**
{{% details title="**자세히 보기**" %}}
- **개요**: 단일 VM에서 Kubernetes로 전환 및 Grafana LGTM Stack 모니터링 시스템 구축
- **기간**: 2025.04 ~ 2025.09 | 인프라 영역 전담
- **[문제]**
  - 단일 인스턴스 + Shell Script 배포 → **SPOF**, 장애 복구 시 개발자 수동 개입 필수
  - 모니터링 부재로 장애 인식을 CS에만 의존 (평균 1시간) → **사용자 서비스 이탈 위험**
- **[주요 기여]**
  - [**GKE 도입 제안 및 구축**]({{< relref "/blog/infrastructure/docker-compose-to-k8s" >}}) – 전문 DevOps 부재 상황에서 **운영 부담 최소화** 위해 Managed K8s 선택
  - 마이그레이션 중 SQS URL 하드코딩, 미문서화 방화벽 등 **레거시 숨은 설정 발견** → 환경변수 분리, Cloud NAT 도입
  - [**Grafana LGTM Stack 선택**]({{< relref "/blog/infrastructure/building-a-monitoring-system" >}}) – ELK($92~200/월) 대비 **비용 효율적**($12~37/월) 대안 도입
  - GitHub Actions + ArgoCD 기반 CI/CD 구축 → **Self-hosted Runner 한계**로 [**Jenkins on K8s 전환**]({{< relref "/blog/infrastructure/github-actions-to-jenkins" >}})
  - 일부 서비스 [**온프레미스 → AWS 무중단 마이그레이션**]({{< relref "/blog/infrastructure/from-on-premises-to-cloud-a-zero-downtime-migration-story" >}}) – 이중 쓰기/배치 동기화 대비 **실시간 동기화 위해 AWS DMS CDC** 선택
- **[성과]**
  - **CS 의존 탈피**, 장애 인지 시간: 1시간 → **1분 (98% 단축)**
  - 롤백 시간: 12분 → **2분 (83% 단축)**
  - 배포 시간: 15분 → **5분 (67% 단축)**
  - **무중단 배포** 체계 및 **자동 스케일링** 확보
- **기술**: `Kubernetes`, `GKE`, `ArgoCD`, `Jenkins`, `Grafana`, `Loki`, `Tempo`, `Prometheus`
{{% /details %}}

- #### **[자연어 위치 검색 기반 매물 추천 시스템](https://bootalk.co.kr/ai/chat) 설계·구현**
  RAG + Geo-search로 **자연어 위치 검색 매물 추천** 구현
{{% details title="**자세히 보기**" %}}
- **개요**: 기존 부동산 AI 서비스 '부토기'에 위치 기반 매물 추천 기능 추가 개발
- **기간**: 2025.08 ~ 2025.11 | 3명 팀, 백엔드 전담
- **[문제]**
  - 기존 AI 서비스는 부동산 Q&A RAG만 존재, 매물 추천 기능 부재
  - "여의도역 근처 아파트 추천해줘" 같은 위치 기반 자연어 검색 불가
- **[주요 기여]**
  - Spring Batch 일배치로 Elasticsearch에 **위치 정보(POI) 인덱싱** 자동화
  - 자연어 질의에서 LLM을 이용해 위치·조건 키워드 추출 → Elasticsearch **유사도 검색으로 위치 특정** → 반경, 조건 필터링 → 매물 추천 RAG 파이프라인 구축
  - OpenAI Embedding API 활용 매물 데이터 **벡터화 및 유사도 검색** 구현
- **[성과]**
  - 자연어 위치 검색 기반 **AI 매물 추천** 기능 런칭
  - "강남역 도보 10분 이내 투룸" 같은 **복합 조건 검색** 지원
- **기술**: `Kotlin`, `Spring Batch`, `Elasticsearch`, `OpenAI API`, `RAG`, `Geo-search`, `Embedding`
{{% /details %}}

---

### **㈜헬로핀테크**
> P2P 온라인투자연계 금융플랫폼 (누적대출액 2조 5천억원) <br>
>*2023.03 ~ 2025.03 (2년)* | Back-end Developer (개발팀 5~10명)

{{< callout type="info" icon="code" >}}
**주요 기술**: `Java` `Spring Boot` `Spring Batch` `JPA` `Redis` `MySQL` `Kubernetes`
{{< /callout >}}

- #### **백오피스 서버 성능 최적화 및 트러블슈팅**
  SQL 튜닝 및 캐싱으로 **API 응답속도 87% 개선** (10.3초 → 1.3초)
{{% details title="**자세히 보기**" %}}
- **개요**: PHP 레거시 백오피스를 Spring으로 전환하며 성능 개선 및 장애 대응
- **기간**: 2024.04 ~ 2025.03 | 2~6명 팀, 성능 최적화 및 트러블슈팅 참여
- **[문제]**
  - JPA + MyBatis 혼용 + OSIV 활성화로 **한 요청에서 2개 Connection 점유** → HikariCP Deadlock
  - Master 저장 후 즉시 Slave 조회 시 **Replication 지연으로 데이터 불일치** → 사용자 문의 증가
- **[주요 기여]**
  - [**HikariCP Deadlock 해결**]({{< relref "/blog/backend/troubleshooting/hikaricp-deadlock-with-jpa-mybatis" >}}) – 원인 분석 후 JPA 일원화로 Connection 순차 사용 유도
  - [**Replication 지연 해결**]({{< relref "/blog/backend/troubleshooting/db-replication-lag" >}}) – 단계적 접근: @Transactional → AbstractRoutingDataSource + AOP로 **일관성/성능 트레이드오프** 조절
  - [**외부 API Redis 캐싱**]({{< relref "/blog/backend/performance/look-aside-cache-api-perf" >}}) – 기존 인프라 활용, 캐시 히트 시 **57ms (90배 향상)**
  - [**Git Flow 도입 제안**]({{< relref "/blog/culture/git-flow-introduction" >}}) – Cherry-pick 충돌 사례 시각화로 팀 설득, Pn룰 코드리뷰 도입
- **[성과]**
  - API 응답속도: 10.3초 → **1.3초 (87% 개선)**, 캐싱 적용 API: 5.1초 → **1.3초 (75% 개선)**
  - HikariCP Deadlock 및 Replication 지연 문제 **완전 해결**
- **기술**: `Spring Boot`, `Java 11`, `JPA`, `Redis`, `MySQL`
{{% /details %}}

- #### **서비스 인프라 운영 및 유지보수**
  DevOps 공백 기간(6개월) 인프라 전담, **Redis Session Clustering으로 세션 유실 문제 해결**
{{% details title="**자세히 보기**" %}}
- **개요**: DevOps 공백 기간 클라우드 기반 서버 인프라 운영 전담
- **기간**: 2023.12 ~ 2024.09 | 인프라 운영 전담
- **[문제]**
  - 기존 DevOps 퇴사로 **인프라 운영 공백** 발생
  - K8s Ingress Sticky Session 설정으로 앱 재기동 시 **세션 유실** 발생
- **[주요 기여]**
  - 새로운 DevOps 입사 전까지 **인프라 운영 전담** (6개월)
  - **19개 인스턴스**, 10개 노드, 3개 웹 서버, 9개 WAS, 2개 DB 운영 및 유지보수
  - **Redis Session Clustering** 도입으로 세션 유실 문제 해결
- **[성과]**
  - 운영 공백 기간 **안정적 인프라 유지**, 세션 유실 문제 해결로 **사용자 경험 개선**
- **기술**: `Kubernetes`, `Jenkins`, `ArgoCD`, `ELK`, `Prometheus`, `Redis`, `MySQL`
{{% /details %}}

- #### **Spring Batch 성능 최적화**
  Chunk/Partitioning 도입으로 **배치 처리 시간 64% 단축** (13분 → 5분)
{{% details title="**자세히 보기**" %}}
- **개요**: PHP/Crontab 기반 배치를 Spring Batch로 전환 및 성능 개선
- **기간**: 2024.05 ~ 2025.03 | 4~6명 팀, 배치 시스템 전환 및 성능 최적화 설계 참여
- **[문제]**
  - Job 동시 실행 시 **Metadata Table Deadlock** – SELECT 공유락 → INSERT 배타락 전환 시 교착
  - Tasklet 방식 전체 작업이 하나의 트랜잭션 → **MVCC 스냅샷으로 중간 입금 데이터 누락**
- **[주요 기여]**
  - [**Deadlock 해결**]({{< relref "/blog/backend/troubleshooting/spring-batch-job-deadlock" >}}) – 4가지 방법(동시 실행 금지, Isolation 변경, DAO Override, 5.0 업그레이드) 비교 후 **Bean 설정으로 Isolation Level 변경**
  - [**Chunk + 10개 파티션 병렬 처리**]({{< relref "/blog/backend/performance/spring-batch-tasklet-to-chunk" >}}) – 스레드 풀 크기 테스트 후 최적값 적용, **사내 문서화 및 공유**
- **[성과]**
  - 배치 처리 시간: 13.3분 → **4.8분 (64% 단축)**
  - 트랜잭션 락 점유: 22분 → **0.01초** (Chunk 단위 커밋으로 정합성 문제 **99.9% 감소**)
- **기술**: `Spring Batch`, `Java 11`, `JPA`, `QueryDSL`
{{% /details %}}

## **Side Project**

#### **Upvy** - 교육용 숏폼 영상 플랫폼
> *2025.10 ~ Present* | [App Store](https://apps.apple.com/app/upvy/id6756291696) | [GitHub](https://github.com/12OneTwo12/upvy)

- **개요**: 스크롤 시간을 학습 시간으로 전환하는 교육용 숏폼 플랫폼
- **기술**: `Kotlin` `Spring WebFlux` `R2DBC` `React Native` `Vertex AI`
- **특징**: 1인 개발 · App Store 출시 및 운영 중 · 79% test coverage
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
