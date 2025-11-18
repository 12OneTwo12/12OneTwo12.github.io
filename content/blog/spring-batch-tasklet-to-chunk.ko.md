---
title: "😨 입금된 돈이 사라졌다? 계좌 잔고 정합성 검증 배치, Tasklet에서 Chunk & Partitioning으로의 전환기"
tags:
  - "spring batch"
  - "batch"
  - "chunk"
  - "tasklet"
  - "partitioning"
  - "performance optimization"
date: '2024-12-24'
---

안녕하세요.  
저는 대출 및 투자 연계 플랫폼에서 **백엔드 개발자**로 근무 중인 2년 차 개발자 **정정일**입니다.

운영 중인 회사 서비스에서 내부적으로 데이터 정합성을 검증하던 중, **트랜잭션 처리 시간**과 **배치 작업의 비효율성**으로 **은행 계좌 잔고와 서비스 내부 포인트(Point)의 불일치**로 인해 정합성 검증 작업이 실패하거나, 잘못된 노티가 발송되는 경우가 있었습니다.

이 글에서는 기존의 **Tasklet 기반 배치 처리 방식**에서 발생한 문제점을 해결하기 위해, **Chunk 기반 처리와 Partitioning 기법**을 도입한 경험을 공유하려 합니다.

---

### 1. 배경 상황

저희 회사는 온라인투자연계 금융플랫폼입니다.
현재는 안전한 자금운용을 위해 신한은행을 통한 예치금 신탁 운용을 하고 있습니다. 회사의 자금 흐름을 간단한 다이어그램으로 그려보도록 하겠습니다.

![](https://velog.velcdn.com/images/12onetwo12/post/dc176ce2-0191-4f41-87e9-78e90d0b94dd/image.png)


물론 다이어그램에 그려진 것 외에 자금 흐름이 존재하지만 현재 문제를 이해하기 위한 부분과는 무관하니 빼도록 했습니다.

문제를 이해하기 위해 위 그림에서 가장 중요한 부분은 실제 자금은 신한은행에서 관리를 해준다는 점입니다.

투자자가 만원을 신한은행 가상계좌로 입금한다면 실제 입금된 만원은 신한은행에서 관리하고 만원이 입금됐다는 사실만 자사로 통지된다는 것 입니다.

저희 역시 내부적으로 신한은행과는 별개로 사용자의 잔고에 대한 데이터를 관리하고 정합성을 검증하고 있습니다. **저희가 관리하는 사용자 잔고는 Point라 명명**하고 있습니다.

글에서는 명칭을 다음과 같이 하도록 하겠습니다.

* 계좌 잔고 : 신한은행 예치금
* Point : 자사에서 관리하는 예치금

그렇다면 **계좌 잔고와 Point사이의 데이터 정합성이 불일치하는 경우**들이 생길 수 있습니다. 예로는 다음과 같은 경우들이 있을 수 있죠.

* 투자자 A가 입금을 했지만 은행과 자사 서비스간 사이의 입금 통지 사이 문제로 Point에 반영이 되지 않았을 때

* 원리금 지급 요청으로 신한은행에서 투자자 가상계좌로 입금 처리 했으나 Point에는 반영되지 않은 경우

* 투자자가 투자한 이후에 Point는 차감했으나 실제 대출은 실행되지 않아 계좌 잔고에서는 차감되지 않은 경우

**물론 돈에 관련된 굉장히 굉장히 중요한 데이터이기 때문에 데이터 정합성 문제를 해결하기 위한 수많은 방어로직들이 있습니다. 그렇기에 정합성이 깨지는 경우는 굉장히 드물다고 말씀 드릴 수 있습니다.**

제가 말씀드리고 싶었던 부분은 실제 계좌 잔고와 Point 사이의 간극이 생길 수 있다는 부분을 설명드리고 싶었습니다.
이런 배경부분을 설명드리며 문제상황으로 넘어가도록 하겠습니다.

---

### 2. 문제 상황

위에서 언급한대로 계좌 잔고와 Point는 돈과 관련된 굉장히 중요한 데이터임으로 수많은 방어로직 외에도 데이터 검증을 위해 하루에 한번 사용자분들의 계좌 잔고와 Point 데이터 사이에 차이가 존재하는지 예치금을 비교하고 계좌 잔액과 Point의 차이가 있다면 해당 목록을 저장하고 관리자에게 노티해주는 배치가 돌고 있습니다.

![](https://velog.velcdn.com/images/12onetwo12/post/2a5ddf32-9212-4dae-829e-360087a137b4/image.png)

기존 Tasklet 방식으로 작동하던 예치금 비교 Job입니다.
위 그림만 보더라도 몇가지 문제점을 언급할 수 있을 것 같습니다.

1. 투자자간 잔고는 서로 의존성이 없는데도 동기, 블로킹 방식으로 작동하고 있습니다. 이로 인해 해당 Job이 결과적으로 Batch의 리소스를 필요 이상으로 많이 잡아먹게 됩니다.

2. 한 step안에서 차액 비교와 비교 결과에 대한 핸들링을 모두 하고있습니다. 한 Step안에 책임이 여러개 존재하게돼 가독성 및 유지보수성이 떨어지게 됩니다.

위 언급한 문제점 외에 **가장 중요한 한가지 문제점이 더 존재**했는데 이 이유를 근거로 관리자분을 설득하여 리펙토링을 진행할 수 있었습니다.

**Tasklet이 해당 Step이 끝날때까지 한 Transaction으로 동작했기때문에 예치금 비교도중 데이터 정합성이 맞지 않는 경우가 발생**했습니다.
바로 아래와 같은 경우인데요.

![](https://velog.velcdn.com/images/12onetwo12/post/2226eab4-cc1c-4476-8740-673f63669bc3/image.png)

7시에 Transaction이 시작하고 7시 10분쯤 입금 통지가 발생했다면 해당 point를 읽지 못하는 경우가 생겼습니다.

저희는 DB로 Mysql을 사용하고 있었고 Mysql의 기본 격리 수준은 `REPEATABLE READ`이기 때문에 MVCC로 동작해 transaction 시작 시점의 스냅샷의 데이터를 읽어버린 것이죠.

(비교 로직에는 Point 뿐만 아닌 여러개의 테이블의 데이터들도 필요합니다. ex) 상환 예정 금액, 투자 대기 금액, 지급 예정 금액 등. 예시에서는 Point만 테이블만 예시로 들었습니다. )

불행중 다행으로는 노티를 받아보는 관리자는 내부 사용자 (회사 직원분) 이시기 때문에 노티를 받아보고도 백오피스에서 현재 데이터를 확인하고 계좌 잔고에 데이터 정합성에 문제가 없는 것을 확인해주시지만 관리자 입장에서는 불필요한 업무가 느는 것이고 개발적인 관점에서는 잘못된 데이터로 노티를 보내니 이는 잘못된 부분이라 할 수 있다고 생각합니다.

![](https://velog.velcdn.com/images/12onetwo12/post/cfdbb72a-aa9f-47b1-ba0a-d9fb1ead4ba0/image.png)

---

### 3. 해결 방법: Chunk와 Partitioning 기반으로 전환

기존 Tasklet 방식으로 구현된 배치 작업은 하나의 트랜잭션 내에서 모든 작업이 처리되다 보니, 트랜잭션 종료 전까지 변경된 데이터를 반영하지 못하는 문제가 있었습니다. 특히 7시에 배치 작업이 시작된 후 입금 통지가 7시 10분에 발생하면 해당 데이터는 배치 결과에 반영되지 않는 상황이 발생했습니다.

뿐만 아니라 한 트랜잭션 내에서 비교 작업과 알림 처리 로직을 모두 수행하다 보니, 배치 작업 시간이 길어지고 실패 시 처음부터 재작업해야 하는 구조적 문제도 있었습니다. 이를 해결하기 위해 다음 세 가지를 목표로 설정했습니다.

1. **트랜잭션 단위 최소화**  
   트랜잭션을 가능한 짧은 단위로 분리해 데이터 정합성을 개선.

2. **책임 분리**  
   데이터 검증과 알림 처리 로직을 분리하여 코드 가독성과 유지보수성 향상.

3. **병렬 처리 도입**  
   데이터 간 의존성이 없는 특성을 활용해 작업 속도를 최적화.

#### Chunk 기반 처리로의 전환

Tasklet 방식에서 Chunk 방식으로 전환하며 가장 큰 변화는 트랜잭션 단위가 작아졌다는 점입니다. 기존에는 하나의 트랜잭션이 전체 작업을 아우르다 보니 작업 중간에 변경된 데이터가 반영되지 않는 문제가 있었습니다. 이를 Chunk로 나누어 처리하며 각 Chunk마다 독립적으로 트랜잭션이 커밋되도록 설계했습니다.

- **Chunk 처리 방식**
    1. **Reader**: 데이터베이스에서 설정된 Chunk 크기만큼 데이터를 읽어옴.
    2. **Processor**: Reader가 읽어온 데이터를 비교하거나 가공하는 작업 수행.
    3. **Writer**: 가공된 데이터를 저장하거나 알림을 보내는 후속 작업 수행.

Chunk 방식의 가장 큰 장점은 트랜잭션 범위를 제한할 수 있다는 점입니다. 이로 인해 배치 실행 중에도 변경된 데이터가 반영될 수 있었고, 처리 중 오류가 발생했을 때 특정 Chunk만 재처리할 수 있게 되었습니다.

#### Partitioning을 통한 병렬 처리 도입

Chunk 기반 처리로 데이터 정합성을 개선했지만, 각 Chunk 사이즈 내에서는 마찬가지로 블로킹 방식으로 동작하니 마찬가지로 서버 리소스를 필요 이상으로 잡아먹는 문제는 여전했습니다.

투자자 잔고, Point 데이터간에는 의존성이 없으므로 블로킹 방식으로 동작할 필요는 없었죠.

이를 보완하기 위해 Partitioning 기법을 적용했습니다. 데이터를 여러 개의 Partition으로 나눠 병렬로 처리하면서 속도를 개선했습니다.

- **Partitioning 적용 방식**
    1. 데이터를 GridSize로 나누어 각 Partition에 독립적으로 할당.
    2. 각 Partition은 독립적인 트랜잭션으로 처리.
    3. Spring Batch의 `PartitionHandler`를 활용해 관리.

---

### Partitioning에서 동적 데이터 조회를 위한 QuerydslItemReader 구현

Partitioning을 사용하면 데이터를 미리 정의된 Partition 단위로 나눠 병렬 처리를 수행할 수 있습니다. 일반적으로는 `Partitioner`가 데이터를 GridSize에 따라 미리 나눠 각 Partition에 분배하고, 각 Partition은 자신에게 할당된 데이터를 처리합니다.

하지만 Partition을 미리 고정 크기로 나누면, 각 파티션 스레드 별 종료 시간이 크게 상이함에도 놀고있는 스레드에서 추가로 데이터를 처리하지 않으니 총 처리시간은 늘어나게 됩니다.

저희 팀에서는 이런점을 해결하기 위해 모든 파티션의 Reader가 현재 조회지점을 스레드 세이프하도록 공유하게 해서 먼저 writer의 작업까지 끝낸 파티션이 다음작업을 할당 받을 수 있도록 구현하였습니다.

---

**QuerydslPagingItemReader 구현 코드 예제**

```java
@Bean
@StepScope
public QuerydslPagingItemReader<BalanceCheckDto> querydslItemReader(
        @Value("#{jobParameters['startDate']}") Date startDate,
        @Value("#{jobParameters['endDate']}") Date endDate) {
    return new QuerydslPagingItemReader<>(entityManagerFactory, DEFAULT_CHUNK_SIZE, queryFactory -> {
        QBalanceCheck balanceCheck = QBalanceCheck.balanceCheck;
        return queryFactory.selectFrom(balanceCheck)
                .where(balanceCheck.createdDate.between(startDate, endDate))
                .orderBy(balanceCheck.id.asc());
    });
}
```

- `startDate`, `endDate`: 배치 실행 시 동적으로 제공되는 파라미터.

```java
long currentExecutionOrder = executionOrder.getAndIncrement();
long startIndex = (currentExecutionOrder) * getPageSize();
int totalRecords = stepContext.getInt("totalRecords");

if (startIndex >= totalRecords) {
	initResults(); // 빈 결과로 초기화
	tx.commit();
	return;
}

int chunkSizeToRead = Math.min(getPageSize(), (int) (totalRecords - startIndex)); // 남은 데이터 크기만큼 읽기

// QueryDSL Query 생성
JPQLQuery<T> query = createQuery()
	.offset(startIndex)
	.limit(chunkSizeToRead);
```

**왜 QuerydslPagingItemReader를 선택했는가?**

* 기존 저희 회사는 복잡한 쿼리를 QueryDSL 기반으로 구현해왔기 때문에 일관성을 맞추고자 했습니다.

* 컴파일 시점에 타입에 대한 검증을 위해도 사용했습니다.

#### 리펙토링 후 아키텍쳐

![](https://velog.velcdn.com/images/12onetwo12/post/ce53019f-63db-4622-8ce3-2f8b8d49eeba/image.png)


**개선된 점**

* Querydsl 기반 Reader를 도입하며 Reader가 동적으로 데이터를 조회하면서 더 유연하고 효율적인 배치 작업이 가능해졌다고 생각합니다.

* Step을 각 책임에 맞게 분리하여 유지보수성 및 가독성을 향상시켰습니다. 각 Step은 다음과 같은 책임들을 맡고 있습니다.
    * balanceInitializeStep : Partitioning을 위한 초기화 작업
    * balancePartitionStep : Partitioning을 이용한 병렬 예치금 비교 작업
    * balanceSendSnsStep : 예치금 비교하며 차액 발생한 대상 관리자 노티
    * balanceResetStep : 이전 모든 스탭 완료 후 데이터 초기화 작업

그리고 저희는 트랜잭션의 단위를 최소화하기 위해 Reader, Processor, Writer의 트랜잭션을 각각 분리하여 구현했습니다.

일반적으로는 Reader, Processor, Writer를 청크 단위로 트랜잭션을 묶어 작업하게 되는데 저희는 계좌 잔액이라는 데이터 자체가 신한은행에서 관리하다보니 청크단위로 Reader, Processor, Writer의 transaction을 묶는다 하더라도 의미가 없다고 생각했습니다.

---

### 성과와 개선된 점

**1. 데이터 정합성 강화**  
트랜잭션 단위를 최소화하면서 데이터 정합성 문제의 확률이 현저하게 줄어들게 됐습니다. 작업 중간에 발생한 입금 통지나 기타 변경사항도 거의 실시간으로 반영할 수 있게 되었습니다.

- **최대 트랜잭션 처리 시간**  
  기존: 약 22분 → 변경 후: 0.01초 수준으로 감소.
  (데이터 정합성 문제 발생확률 1/132,000 )

**2. 처리 속도와 리소스 효율성**

![](https://velog.velcdn.com/images/12onetwo12/post/b57fac5f-4a88-4a80-85a7-13e4bd7b3381/image.png)

- **Row당 처리 시간**
  기존: 3.74초 → 변경 후: 0.72초 (80% 단축).

![](https://velog.velcdn.com/images/12onetwo12/post/82d6aedf-62a0-4efd-9adf-db3bf4a3e67f/image.png)

- **평균 소요 시간**  
  기존 Tasklet 방식: 13.27분 → Chunk/Partitioning 방식: 4.77분 (64% 단축).

---

### 개발 과정에서의 고민과 시행착오

**스레드 관리와 병렬 처리**  
병렬 처리를 위해 `SimpleAsyncTaskExecutor`와 `ThreadPoolTaskExecutor`를 비교 테스트하며 최적의 설정을 찾았습니다. 스레드 풀 크기에 따른 속도를 비교하여 적절한 스레드 갯수를 탐색했습니다.

![](https://velog.velcdn.com/images/12onetwo12/post/43efce90-335e-424b-9bbb-ba4d1f5838bf/image.png)
위와 같은 테스트 결과 gridSize 및 thread 개수는 10으로 고정했습니다.

**트랜잭션을 커밋하지 않고 EntityManager를 그냥 close해버렸을 때**
테스트하는 과정에서 Reader에서 transaction을 close하지 않고 entityManager를 close해버렸을 때 HikariCP Deadlock 문제를 맞이하게 됐습니다. transaction을 entityManager가 close 됐을때 commit하겠거니 생각했었는데 아니여서 당황했었죠. 생각해보면 당연한건데 말입니다.![](https://velog.velcdn.com/images/12onetwo12/post/df31cd01-30df-47d6-923f-e6c3ea333c35/image.png)

![](https://velog.velcdn.com/images/12onetwo12/post/25261115-2128-473b-a205-c82c011e250b/image.png)

해당 문제는 transaction을 close하고 entityManager를 close하면서 해결하게 됩니다.

**Reader, Processor, Writer, Listener 간 역할 분리**  
로직 분리 과정에서 가장 고민이 되었던 부분중 하나는 Processor와 Writer 간의 역할이 중첩되지 않도록 설계하는 것이었습니다. 노티해야할 회원 목록 데이터를 어떻게 다음 Step으로 안전하게 전달할지 고민한 끝에 `ConcurrentLinkedQueue`를 사용해 스레드 안전한 데이터 공유를 구현했습니다.

또한 구현 초기에 initialize 작업이나 초기화 작업이 Listener에 구현이 되어있었습니다. 해당 부분이 클래스의 역할과 맞지 않았기 때문에 별도에 Step으로 분리하여 구현했습니다.

![](https://velog.velcdn.com/images/12onetwo12/post/c10e14aa-d77a-48c5-9337-efd65eeb053f/image.png)
![](https://velog.velcdn.com/images/12onetwo12/post/d45e1113-2ec1-4b2d-90ce-cb11d91a862b/image.png)

(해당 코드 리뷰후에 스크럼을 통해 개선점을 조율하고 수정했습니다!)

---

### 마무리하며

저로서는 Chunk, Partitioning 도입을 통한 문제해결이 가능하다는 것을 어필하여 팀장님을 설득하는 과정부터가 도전이였습니다.
다행히 팀장님또한 필요성을 공감해주셨고 저희 팀에서 맡아서 진행할 수 있었습니다.

이번 리팩토링 프로젝트는 단순히 예외 발생확률의 하락 및 성능을 개선하는 데 그치지 않고, 코드 구조를 재정립해 유지보수성과 재사용성을 확보했다는 점에서 중요한 경험이 되었습니다.

특히 Chunk와 Partitioning 기법의 장점을 최대한 활용해 효율적인 배치를 설계한 점은 향후 다른 배치 작업에도 적용할 수 있는 좋은 선례가 될 수 있을 것 같습니다.

여러가지 경험하며 Spring Batch에 대한 이해도도 크게 높일 수 있었던 시간이라고 생각합니다.

이번 리팩토링에서 저는 실제 구현을 담당하진 않았습니다. Chunk, Partitioning 도입 제안, 참여 인원 결정, 일정 조율, 스크럼 진행, 도입 기술 결정, 코드 리뷰 등을 담당했고 아키텍쳐 설계, 트러블 슈팅, 구현방향 설정 등에 참여했습니다.

가장 중요한 Chunk, Partitioning 방식 구현 및 테스트를 담당해주신 저희 팀에 태성님, 병욱님께 감사인사드리며 이만글을 마치도록 하겠습니다.

---

### Reference
https://techblog.woowahan.com/2662/
https://jojoldu.tistory.com/336
https://jojoldu.tistory.com/339
https://docs.spring.io/spring-batch/reference/readersAndWriters.html
