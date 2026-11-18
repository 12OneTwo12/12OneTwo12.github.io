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

**"지금 우리 서비스에 가장 필요한 개선이 무엇인가?"** 를 고민하는 4년 차 백엔드 개발자 정정일입니다.

MSA 13개 서비스 중 5개를 직접 만들고, 운영해 본 뒤 다시 합치자고 제안해 인프라 비용을 36% 줄였습니다.

대화형 AI 에이전트를 설계·구현해 출시했고, 아파트 단지 기본정보 API의 응답 시간(P95)을 4,045ms에서 50ms 이하로 낮췄습니다.

백엔드 개발과 함께 Kubernetes 인프라를 구축·운영하며 롤백을 12분에서 2분으로 단축했습니다. 앞서 P2P 금융 플랫폼에서는 정산 로직 통합을 제안·주도해 요구사항 반영 기간을 4주에서 2주로 줄였습니다.

**Core Strengths:** MSA·모듈러 모놀리식 아키텍처 · LLM 에이전트 설계 · API·쿼리 성능 개선 · Kubernetes·Terraform 인프라

## **Skills**

| Skill         |                  Experience (Years)                  | Description                                                                       |
|:--------------|:---------------------------------------------:|:----------------------------------------------------------------------------------|
| Java          | `{{< experience-years start="2023-03-06" >}}` | 금융 플랫폼의 정산·백오피스·배치 시스템 개발 경험                                       |
| Kotlin        | `{{< experience-years start="2023-08-01" >}}` | MSA·모듈러 모놀리식 서비스와 LLM 에이전트 개발의 메인 언어                          |
| Spring Boot   | `{{< experience-years start="2023-03-06" >}}` | REST API, JWT 인증·인가, OpenFeign, JUnit 5·ArchUnit 테스트                          |
| Spring Batch  | `{{< experience-years start="2023-05-01" >}}` | Chunk·Partitioning 전환과 메타데이터 Deadlock 해결 경험                   |
| MySQL         | `{{< experience-years start="2023-03-06" >}}` | **Certified - SQL Developer** \| 쿼리 튜닝, Replication 지연·Collation 문제 해결                         |
| Kubernetes    | `{{< experience-years start="2023-12-01" >}}` | **Certified - Certified Kubernetes Administrator (CKA)** \| GKE·EKS 구축·운영, ArgoCD GitOps, Gateway API 전환 |
| Terraform     | `{{< experience-years start="2025-07-01" >}}` | 콘솔로 관리되던 AWS 리소스 import, EKS·RDS 구성과 drift 관리 |
| Linux         | `{{< experience-years start="2022-03-06" >}}` | **Certified - Linux Master Level-II**, **AWS Certified Cloud Practitioner (CCP)** \| 서버 설정 및 스크립트 작성 등 운영 경험     |

## **Work Experience**

### **부톡㈜**
> AI 기반 부동산 중개 플랫폼 (누적 회원 21만 명, 중개 매칭 5만 건) <br>
>*2025.03 ~ Present ({{< work-duration start="2025-03-01" >}})* | Back-end Developer

{{< callout type="info" icon="code" >}}
**주요 기술**: `Kotlin` `Spring Boot` `JPA` `MySQL` `Redis` `Elasticsearch` `OpenAI Responses API` `AWS EKS` `Terraform` `ArgoCD` `Grafana`
{{< /callout >}}

- #### **MSA 전환과 모듈러 모놀리식 재전환**
  핵심 도메인 **무중단 전환**, 재전환으로 파드 26개 이상 → 5~7개, **인프라 비용 36% 절감**
{{% details title="**자세히 보기**" %}}
- **기간**: 2025.04 ~ 2026.02 | 13개 서비스 중 5개(정산·매물·매칭 등) 설계·구현, 모듈러 모놀리식 재전환 제안·설계·구현
- **[문제]**
  - 매칭 로직이 매물 테이블을 직접 JOIN할 만큼 결합도가 높아, 도메인을 하나씩 분리할 수 없었음
  - 전환 뒤에는 13개 서비스(파드 26개 이상)의 운영 부담과 인프라 비용이 컸음
- **[주요 기여]**
  - 결합도가 높은 도메인(매물·매칭·중개사)만 묶어 함께 옮기는 [**부분적 빅뱅**]({{< relref "/blog/architecture/is-gradual-msa-transition-an-illusion" >}})을 제안하고 헥사고날 아키텍처로 구현
  - 전환 기간에는 Dual Write로 양쪽 DB에 반영하고 검증 배치로 불일치를 확인, 레거시로 바로 롤백할 수 있게 유지
  - 프로시저가 56~70ms에서 457ms로 느려진 것을 운영 반영 전에 찾아, [**Collation 불일치**]({{< relref "/blog/backend/troubleshooting/mysql-collation-performace" >}})를 맞춰 42ms로 낮추고 121개 테이블의 Collation 통일
  - 서비스별 저장소를 [**멀티모듈 모노레포**]({{< relref "/blog/architecture/msa-to-multi-module" >}})로 합친 뒤, [**모듈러 모놀리식 재전환**]({{< relref "/blog/architecture/msa-to-modular-monolith" >}})을 제안·설계·구현. OpenFeign 호출을 모듈 인터페이스로 교체하고, 스키마와 트랜잭션 매니저는 나눠 두어 다시 분리할 수 있게 유지
  - 트랜잭션 매니저 미지정 `@Transactional` 약 120곳(8개 모듈)이 `@Primary`로 묶이는 문제를 찾아 모듈별로 지정하고 ArchUnit 테스트로 재발 방지
  - 테스트 병렬화 단위를 JUnit 5 스레드로 바꾸고 CI 캐싱을 더해 [**전체 테스트 시간 45분 → 10분**]({{< relref "/blog/backend/performance/ci-test-build-optimization" >}})
- **[성과]**
  - 핵심 도메인(매물·매칭·중개사) **무중단 전환**
  - 재전환으로 파드 26개 이상 → **5~7개**, 인프라 비용 **36% 절감**(재전환 전후 클라우드 비용 기준)
- **기술**: `Kotlin`, `Spring Boot`, `JPA`, `OpenFeign`, `AWS SNS/SQS`, `MySQL`, `JUnit 5`, `ArchUnit`
{{% /details %}}

- #### **[부톡AI](https://bootalk.co.kr/ai/chat): LLM 기반 대화형 부동산 에이전트**
  Agent Loop를 직접 구현해 **2026.11 웹·앱 출시**, 질문당 LLM 호출 **2.9회 → 2.3회**
{{% details title="**자세히 보기**" %}}
- **기간**: 2025.08 ~ Present | 에이전트 파이프라인 설계·구현
- **[문제]**
  - 기획이 대화형으로 바뀌어, 직접 설계해 운영하던 [**Plan-and-Execute 방식 매물 추천**]({{< relref "/blog/architecture/ai-property-recommendation-system" >}})으로는 후속 질문과 재검색을 처리할 수 없었음
- **[주요 기여]**
  - [**Agent Loop**]({{< relref "/blog/architecture/real-estate-integrated-agent" >}})(컨텍스트 구성 → LLM 호출 → 도구 실행 → 결과 반영)를 Spring AI·LangChain4j 없이 Kotlin으로 직접 구현하고 도구 30종 연결
  - 중개 신청과 알림 등록은 LLM이 제안만 하고 [**사용자 확인 뒤에 실행**]({{< relref "/blog/architecture/real-estate-integrated-agent-llm-boundary" >}})(Human-in-the-loop)
  - LLM·도구 호출을 인자·토큰·지연 시간과 함께 기록해 응답 근거를 추적하고, 턴마다 반복 횟수와 토큰에 상한 적용
  - 응답은 SSE로 스트리밍, 시스템 프롬프트는 Config 서버에서 받아 배포 없이 반영
  - 부동산 문답 RAG 도구(Elasticsearch 벡터 검색) 추가, 시스템 프롬프트·도구 정의 순서를 고정해 프롬프트 캐시 적중 유지
  - 같은 대화의 동시 요청은 Redis 분산 락과 낙관적 락(`@Version`)으로 막고 Rate Limit 적용, AI 모듈은 부하 격리를 위해 별도 서비스로 배포
  - 운영 실사용자 질문 세트로 시스템 프롬프트·도구를 바꿀 때마다 회귀 검증
- **[성과]**
  - **2026년 11월 웹·앱 출시**
  - 같은 운영 실사용자 질문 기준 질문당 LLM 호출 **2.9회 → 2.3회**, 입력 토큰 **95%** 프롬프트 캐시 적중(개발 환경 기준)
- **기술**: `Kotlin`, `Spring Boot`, `OpenAI Responses API(Tool Calling)`, `Elasticsearch`, `MySQL`, `Redis`, `SSE`
{{% /details %}}

- #### **API·쿼리·배치 성능 개선**
  아파트 단지 기본정보 API **P95 4,045ms → 50ms 이하**, 거래량 랭킹 API **P95 1.9~2.4초 → 95ms**
{{% details title="**자세히 보기**" %}}
- **기간**: 2025.12 ~ 2026.04 | 원인 분석과 구현
- **[문제]**
  - 평균 응답 시간은 수백 ms였지만, 운영 Grafana의 P95로 보면 수 초가 걸리는 API가 있었음
  - 관심 단지 알림 배치가 평균 50분, 길면 87분 걸렸음
- **[주요 기여]**
  - EXPLAIN과 Tempo 트레이스로 [**API마다 원인을 먼저 확인**]({{< relref "/blog/backend/performance/backend-api-performance-optimization" >}})
  - 쓰기가 드문 아파트 단지 기본정보 API에 Write-Through 대신 Cache-Aside 적용, TTL Jitter와 Redis 장애 시 DB 폴백
  - 거래량 랭킹 API의 Non-sargable 조건을 컬럼 직접 비교로 수정
  - 관심 단지 알림 배치의 N+1을 일괄 조회로 수정
  - 배포 직후 첫 요청이 느린 원인을 JIT 컴파일로 확인하고 [**Warm-up 적용**]({{< relref "/blog/backend/performance/k8s-jvm-warm-up" >}}), 끝날 때까지 startupProbe로 트래픽 차단
- **[성과]**
  - 아파트 단지 기본정보 API P95: 4,045ms → **50ms 이하**
  - 거래량 랭킹 API: EXPLAIN rows 약 120만 → 1.4만, P95 1.9~2.4초 → **95ms**
  - 알림 배치(동료의 Reader 쿼리 개선과 함께): 평균 50분 → **21분**, 최대 87분 → **25분**
- **기술**: `Kotlin`, `Spring Boot`, `JPA`, `QueryDSL`, `MySQL`, `Redis`, `Spring Batch`, `Grafana`, `Tempo`
{{% /details %}}

- #### **Kubernetes 인프라·모니터링 구축과 운영**
  GitOps 도입으로 **롤백 12분 → 2분**, 콘솔로 관리되던 AWS 리소스를 **Terraform으로 코드화**
{{% details title="**자세히 보기**" %}}
- **기간**: 2025.04 ~ Present | 제안·설계·구축·운영 (백엔드 개발과 병행)
- **[문제]**
  - 단일 서버에 Docker Compose로 서비스가 올라가 있었고, 장애는 고객 문의로만 알 수 있었음
  - 개발 환경이 없어 변경을 검증할 곳이 없었음
- **[주요 기여]**
  - 단일 장애점이던 서버 한 대를 대신할 [**Kubernetes 도입**]({{< relref "/blog/infrastructure/docker-compose-to-k8s" >}})을 제안해 GKE를 골랐고, 배포는 ArgoCD GitOps로 전환. 개발 환경을 먼저 구축해 검증한 뒤 운영 환경을 옮김
  - ELK와 비교해 직접 운영할 수 있고 비용이 낮은 [**Grafana 스택(Loki·Tempo·Prometheus) 모니터링**]({{< relref "/blog/infrastructure/building-a-monitoring-system" >}})을 제안·구축
  - 2025년 7월 별도 IDC 서버의 DB를 [**AWS DMS CDC로 복제해 AWS로 무중단 이전**]({{< relref "/blog/infrastructure/from-on-premises-to-cloud-a-zero-downtime-migration-story" >}})하면서 Terraform 도입, 이후 기존 AWS 리소스를 import해 수동 변경(drift)을 코드와 맞춤
  - 2026년 4월 Terraform으로 구성한 EKS로 이전, 2026년 9~11월 [**EKS 1.37·MySQL 8.4 업그레이드**]({{< relref "/blog/infrastructure/eks-mysql-end-of-standard-support-upgrade" >}})와 함께 [**Gateway API로 전환**]({{< relref "/blog/infrastructure/eks-node-upgrade-to-1-37-gateway-api" >}})
  - 노드 롤링 중 외부에서 요청을 계속 보내 실패를 측정하고, 실패 시각을 Kubernetes 이벤트와 대조해 원인을 찾아 Graceful Shutdown 적용
  - 가용성 SLI와 SLO를 정의하고 [**Error Budget·Burn Rate 대시보드**]({{< relref "/blog/infrastructure/from-observability-to-reliability-slo-error-budget" >}}) 구축
- **[성과]**
  - 롤백 12분 → **2분**, 배포 15분 → **5분**
  - 고객 문의로만 알던 장애를 알림으로 **수 분 안에** 확인
  - EKS 1.37 운영 노드 롤링에서 Gateway 경로 **요청 실패 없음**
- **기술**: `AWS EKS`, `GKE`, `Terraform`, `ArgoCD`, `AWS DMS`, `Gateway API(Istio)`, `Grafana`, `Loki`, `Tempo`, `Prometheus`, `OpenTelemetry`
{{% /details %}}

- #### **인증·인가와 결제 연동**
  전 API 공통 JWT 인증·인가, Refresh Token Rotation, 토스페이먼츠·iOS 인앱결제 연동
{{% details title="**자세히 보기**" %}}
- **기간**: 2026.01 ~ Present | 설계·구현
- **[문제]**
  - 앱과 웹뷰가 같은 Refresh Token으로 동시에 재발급을 요청하는 Race Condition이 있었음
  - 유료 기능에는 결제 한 건이 여러 분석에 쓰이지 않게 할 검증이 필요했음
- **[주요 기여]**
  - JWT 인증·인가를 전 API에 적용. 어노테이션이 없으면 인증을 요구하고, 역할별 접근은 어노테이션 기반 RBAC로 구분. 사용자 식별자는 토큰 클레임에서만 추출
  - Refresh Token 재발급을 비관적 락으로 직렬화하고 직전 토큰에 Grace Period(10초)를 둠. 재사용이 감지되면 토큰 패밀리 폐기
  - OAuth 2.0 소셜 로그인 계정 연동·해제(Account Linking)와 휴대폰 번호 변경 API 개발, SMS 인증 요청 남용은 Redis Rate Limit으로 차단
  - 등기부등본 분석 유료 기능에 토스페이먼츠와 iOS 인앱결제(App Store Server API, JWS 서명 검증)를 연동하고, 주문·결제 일치 검증과 멱등 처리
- **[성과]**
  - 앱과 웹뷰가 동시에 재발급을 요청해도 토큰은 한 번만 교체되고, 결제 한 건은 분석 한 건에만 쓰임
- **기술**: `Kotlin`, `Spring Boot`, `JWT`, `MySQL`, `Redis`, `토스페이먼츠`, `App Store Server API`
{{% /details %}}

---

### **㈜헬로핀테크**
> 온라인투자연계금융(P2P) 플랫폼 (누적 대출 2.5조 원) <br>
>*2023.03 ~ 2025.03 (2년)* | Back-end Developer

{{< callout type="info" icon="code" >}}
**주요 기술**: `Java` `Spring Boot` `Spring Batch` `JPA` `QueryDSL` `MyBatis` `MySQL` `Redis(Redisson)` `Kubernetes` `Jenkins` `ArgoCD`
{{< /callout >}}

- #### **정산 리뉴얼**
  정산 로직을 단일 서버로 통합해 요구사항 반영 기간 **평균 4주 → 2주**
{{% details title="**자세히 보기**" %}}
- **기간**: 2024.06 ~ 2025.03 | 통합 프로젝트 제안·설계·구축 주도 (4명 팀)
- **[문제]**
  - 정산 로직이 서버 3대와 Stored Procedure 13개·Function 11개에 나뉘어, 요구사항 하나에도 여러 곳을 고쳐야 했음
  - 기존 프로시저는 동시에 호출되면 정산 데이터 일부가 오염됐음
- **[주요 기여]**
  - 단일 정산 서버로의 통합을 제안해 채택됐고, 점진적 전환으로 설계
  - 정산 로직을 하나씩 옮길 때마다 기존 프로시저 결과와 새 서버 결과를 대조해 정합성을 검증하며 이전
  - 중복 정산은 Redisson 분산 락으로 방지
  - PR 없이 dev 브랜치에 직접 병합하던 팀에 PR 기반 코드 리뷰와 [**Git Flow**]({{< relref "/blog/culture/git-flow-introduction" >}})를 제안해 도입, 리뷰 의견에 중요도(P1~P5)를 붙이는 규칙 마련
- **[성과]**
  - 요구사항 반영 기간(티켓 완료 기준) 평균 4주 → **2주**
  - 결과 대조에서 불일치 없음, 동시 호출로 인한 정산 데이터 오염 재발 없음
- **기술**: `Java`, `Spring Boot`, `JPA`, `MySQL`, `Redisson`
{{% /details %}}

- #### **백오피스 장애 해결과 성능 개선**
  커넥션 고갈 장애 해결, 주택 시세 외부 API 평균 응답 **5.1초 → 1.3초**
{{% details title="**자세히 보기**" %}}
- **기간**: 2023.04 ~ 2025.03 | 장애 원인 분석과 성능 개선
- **[문제]**
  - 커넥션 40개가 모두 점유돼 요청이 대기하는 장애, 저장 직후 조회 불일치, 평균 5.1초가 걸리는 주택 시세 외부 API
- **[주요 기여]**
  - [**HikariCP Deadlock**]({{< relref "/blog/backend/troubleshooting/hikaricp-deadlock-with-jpa-mybatis" >}})을 풀 크기 1로 재현해, OSIV와 JPA·MyBatis 혼용으로 요청마다 커넥션 2개를 점유하는 원인을 찾고 혼용 제거
  - [**Replication 지연**]({{< relref "/blog/backend/troubleshooting/db-replication-lag" >}})으로 인한 조회 불일치를 저장 직후 조회만 Master로 보내는 AOP로 해결(Read-your-writes)
  - 주택 시세 외부 API에 [**Cache-Aside(Redis)**]({{< relref "/blog/backend/performance/look-aside-cache-api-perf" >}})를 적용하고 시세 갱신 때 캐시 무효화
- **[성과]**
  - 외부 호출 **76% 감소**, 평균 응답 5.1초 → **1.3초**(캐시 적중 시 57ms)
- **기술**: `Java`, `Spring Boot`, `JPA`, `QueryDSL`, `MyBatis`, `Redis`, `MySQL`
{{% /details %}}

- #### **예치금 잔고 정합성 검증 배치의 Chunk·Partitioning 전환**
  가장 긴 트랜잭션 **22분 → 0.01초**, 평균 처리 시간 **13.3분 → 4.8분**
{{% details title="**자세히 보기**" %}}
- **기간**: 2023.05 ~ 2024.12 | 원인 규명, Chunk·Partitioning 전환 제안·기술 결정·코드 리뷰, Spring Batch 전환 참여
- **[문제]**
  - 기존 잔고 검증 배치(Tasklet)는 최대 22분짜리 단일 트랜잭션이라 REPEATABLE READ의 MVCC 스냅샷이 고정돼, 실행 중 들어온 입금을 읽지 못하고 잘못된 불일치 알림을 보냈음
- **[주요 기여]**
  - 원인이 스냅샷 고정임을 확인하고 [**Chunk·Partitioning 전환**]({{< relref "/blog/backend/performance/spring-batch-tasklet-to-chunk" >}})을 제안, 설계에 참여하고 기술 결정과 코드 리뷰를 맡아 팀원 2명과 전환
  - 진행 중이던 PHP·Crontab 배치의 Spring Batch 전환에 참여해 일부 배치를 이전
  - Job 동시 실행 때 생기던 [**메타데이터 Deadlock**]({{< relref "/blog/backend/troubleshooting/spring-batch-job-deadlock" >}})을 JobRepository 격리 수준 변경으로 해결
- **[성과]**
  - 가장 긴 트랜잭션 22분 → **0.01초** 수준, 실행 중 들어온 입금을 거의 실시간으로 반영
  - 평균 처리 시간 13.3분 → **4.8분**
- **기술**: `Java`, `Spring Boot`, `Spring Batch`, `JPA`, `MySQL`
{{% /details %}}

- #### **망분리 금융 환경 인프라 운영**
  망분리 환경의 Kubernetes 클러스터와 배포 파이프라인을 **7개월간 단독 운영**
{{% details title="**자세히 보기**" %}}
- **기간**: 2023.12 ~ 2024.06 | Kubernetes 클러스터·배포 파이프라인 단독 운영
- **[문제]**
  - latest 태그의 사이드카 이미지를 받지 못해 전 서비스 배포가 막혔고, 스케일 인 중에는 비동기 작업과 세션이 유실됐음
- **[주요 기여]**
  - 망분리 금융 환경의 Kubernetes 클러스터와 Jenkins·ArgoCD 배포 파이프라인 운영을 자원해 맡아 전 서비스 배포와 접근 권한 관리
  - 사이드카 이미지 버전을 고정하고 imagePullPolicy 변경
  - HPA 스케일 인 중에도 비동기 작업이 끝나도록 [**Graceful Shutdown**]({{< relref "/blog/backend/troubleshooting/graceful-shutdown-async" >}})을 적용하고, Redis로 세션 공유
- **[성과]**
  - 전 서비스 배포 복구, 스케일 인 중에도 비동기 작업과 세션 유실 없음
- **기술**: `Kubernetes`, `Jenkins`, `ArgoCD`, `Redis`
{{% /details %}}

## **Side Project**

#### **Upvy** - 교육용 숏폼 영상 플랫폼
> *2025.10 ~ Present* | [App Store](https://apps.apple.com/app/upvy/id6756291696) | [Play Store](https://play.google.com/store/apps/details?id=com.upvy.app) | [GitHub](https://github.com/12OneTwo12/upvy)

- **개요**: 스크롤 시간을 학습 시간으로 전환하는 교육용 숏폼 플랫폼
- **기술**: `Kotlin` `Spring WebFlux` `R2DBC` `React Native` `Vertex AI`
- **특징**: 1인 개발 · App Store 출시 및 운영 중 · 79% test coverage
- **주요 구현**: AI 기반 YouTube 영상 자동 편집 파이프라인 (Vertex AI Gemini + Speech-to-Text)

## **Education**

- **한국방송통신대학교** 컴퓨터과학과 편입, 재학 중 (2025.03 ~ Present)
- **학점은행제** 컴퓨터공학 전공 학점 이수 (2022.11 ~ 2024.10)
- **호치민시한국국제학교** 졸업 (2014 ~ 2017)

## **Certificate**

- **[ISTQB CTFL]({{< relref "/blog/reflection/istqb-ctfl" >}})** \| ISTQB / 2026.04
- **[Certified Kubernetes Administrator (CKA)](https://www.credly.com/badges/e357623d-2e5c-4c5c-aed9-d3e90f06aa56/public_url)** \| CNCF / 2025.11
- **리눅스마스터 2급** \| KAIT / 2024.10
- **[Certified Cloud Practitioner (CCP)](https://www.credly.com/badges/924d4107-fbcb-4a48-abed-7f42266ae34f/public_url)** \| AWS / 2024.08
- **SQLD** \| 한국데이터산업진흥원 / 2022.12

## **Activity**

- **오픈소스**: Spring Security 문서 개선 기여 [PR#16216](https://github.com/spring-projects/spring-security/pull/16216)
- **기술 스터디**: [백엔드 아티클 스터디](https://minnim1010.notion.site/6af63324e8614108bf32b0c2f5a1c87c) (2023.08 ~ 진행중)
- **교육**: [빅데이터 기반 지능형SW 및 MLOps 개발자 양성 과정](https://inthiswork.com/archives/105995) (2022.07 ~ 2022.12)
