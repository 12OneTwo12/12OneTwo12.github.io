---
title: "[회고록] JPA와 MyBatis 혼용으로 발생한 HikariCP Deadlock 문제를 해결하며"
tags:
  - deadlock
  - hikaricp
  - jpa
  - mybatis
  - osiv
date: '2024-12-02'
---

2024년 초, 예상치 못한 문제와 마주한 사건이 있었습니다. [(해당 글)](/ko/blog/backend/troubleshooting/hikaricp-deadlock-with-jpa-mybatis)
당시의 상황에 대한 회고록을 작성하려 합니다.

JPA와 MyBatis를 혼용한 코드에서 HikariCP Deadlock 문제가 발생했는데요.
몇 달간 문제없이 운영되던 코드였기에 더욱 당황스러웠습니다.

해결 과정에서 JPA, HikariCP, 그리고 영속성 컨텍스트의 동작 원리를 깊이 이해할 수 있었던 이 경험을 정리해보았습니다.

---

## 문제와의 첫 만남: 예상 밖의 Deadlock

### 📌 Slack 알림으로 시작된 문제

트래픽이 몰리는 시간, Slack에 아래와 같은 알림이 도착했습니다.

```
org.springframework.jdbc.CannotGetJdbcConnectionException: Failed to obtain JDBC Connection; nested exception is java.sql.SQLTransientConnectionException: HikariPool-1 - Connection is not available, request timed out after 30008ms.
```

처음에는 제가 모르는 Connection Pool 관련 Exception으로 생각했습니다. 하지만 로그를 확인하며 문제의 심각성을 깨달았습니다.

```
HikariPool-1 - Timeout failure stats (total=40, active=40, idle=0, waiting=46)
```

HikariCP에서 `maximum-pool-size`로 설정된 40개의 Connection이 모두 점유된 상태였고, 대기 큐까지 꽉 차 있었습니다. 더욱 당황스러웠던 점은 이 로직이 몇 달 동안 잘 작동해왔다는 것입니다.

###  왜 갑자기 문제가 발생했을까?

첫 번째 의문은 "왜 지금 이 문제가 발생했는가?"였습니다.
- 설정 문제라면 이전에도 발생했어야 했습니다.
- 코드가 수정된 적이 없는데 문제가 생긴 이유는 무엇일까요?

이 의문은 문제를 해결하는 내내 저를 괴롭혔고, 결국 문제 해결의 중요한 단서가 되었습니다.

---

## 원인 분석: 의심과 확인의 반복

### 1. 재현 환경 구축: Local에서 재현

먼저 문제를 재현하기 위해 테스트 환경에서 `maximum-pool-size`를 1로 설정했습니다. 이로서 Exception 발생지점을 특정할 수 있었습니다.

```java
public long findBy~~~() {
    return factory
        .select(serviceNotice.count())
        .from(serviceNotice)
        .where(
            serviceNotice.actType.eq("특정 조건"),
            serviceNotice.section.eq("특정 조건"),
            serviceNotice.actEnable.eq(true)
        )
        .fetchOne();
}
```

QueryDSL로 작성된 단순한 Select 쿼리였는데도 Connection이 반환되지 않고 점유 상태로 남아 있었습니다.

---

### 2. Connection Leak인가?

처음엔 Connection Leak을 의심했습니다.
- "이 로직이 끝난 후 Connection을 반환하지 않는 이유는 무엇일까?"
- "Connection 반환 로직이 누락되었을 가능성은 없을까?"

하지만 QueryDSL을 사용하는 코드 내부에서 명시적으로 Connection을 닫지 않아도 Connection이 자동으로 반환되어야 합니다. 관련 문서를 확인한 결과 OSIV(Open Session In View)와 관련된 문제일 가능성이 떠올랐습니다.

---

### 3. OSIV와 영속성 컨텍스트

OSIV는 웹 요청이 끝날 때까지 영속성 컨텍스트(EntityManager)를 유지합니다.  
이는 Lazy Loading을 가능하게 하고, View 계층에서 데이터베이스와의 연동을 지원하지만, Connection 반환을 지연시키는 단점이 있습니다.

> OSIV로 인해 트랜잭션이 끝난 뒤에도 Connection이 반환되지 않고 점유 상태로 남아 있었습니다.

---

### 4. OSIV와 상관없는 Deadlock? 트랜잭션 내부 혼용의 문제

문제를 더 깊이 조사한 결과, OSIV 설정 여부와 상관없이 **동일 Transaction 내에서 JPA와 MyBatis를 혼용**하면 Deadlock이 발생할 수 있다는 점을 확인했습니다.  
동일 Transaction 내에서 JPA가 Connection을 점유한 상태로 MyBatis가 추가로 Connection을 요청했기 때문입니다.

```java
@Transactional
public void problematicMethod() {
    jpaSelectMethod();      // Connection Pool에서 1개 점유
    mybatisSelectMethod();  // 추가 Connection 요청 -> Deadlock
}
```

HikariCP Deadlock이 발생할 수 있는 조건은 하나의 요청에서 동시에 두개 이상의 Connection을 필요로하는 경우임으로 위와 같은 경우 조건을 만족하게 됩니다.

---

### 5. 왜 지금 발생했는가?

이 문제가 몇 달 동안 발생하지 않았던 이유는 쿠버네티스 파드 수 때문이었습니다.
- **기존:** 트래픽 분산을 위해 최소 5개의 파드를 운영.
- **현재:** 비용 절감을 위해 파드 수를 2개로 줄임.

파드 수 감소로 인해 한 파드에 트래픽이 몰리면서 Connection Pool이 모두 점유되는 상황이 발생하게 되었던 것입니다.

---

## 해결 방법

### 1. OSIV 비활성화

OSIV를 비활성화(`spring.jpa.open-in-view=false`)하면 트랜잭션 종료 시 Connection을 반환하도록 설정할 수 있었습니다. 하지만 OSIV를 끄면 Lazy Loading 처리 방식에 영향을 줄 수 있어 기존 코드의 수정이 필요했습니다.

또한 OSIV 옵션과는 별개로 한 Transaction 안에서 혼용할 경우 마찬가지로 Deadlock이 발생할 수 있었음으로 근본적인 해결책은 아니였습니다.

**결론:** OSIV 설정 변경은 보류.

---

### 2. JPA와 MyBatis 혼용 제거

문제의 원인은 동일 Transaction 내에서 JPA와 MyBatis를 동시에 사용하는 것이었습니다.

JPA와 Mybatis를 한 Transaction 내에서 동시에 사용하지 않도록 코드를 리팩토링한다면 발생시키지 않을 수 있어 코드레벨에서의 문제 해결이 가능했습니다.

**결론:** JPA와 MyBatis의 분리가 근본적인 해결책.

---

### 임시 조치: 파드 수 증가

문제 해결 전까지 쿠버네티스의 파드 수를 기존 2개에서 5개로 다시 늘려 트래픽을 분산시켰습니다.

---

## 회고: 이 문제에서 배운 것들

이번 경험은 단순한 문제 해결을 넘어, 기본 개념을 깊이 이해하는 계기가 되었습니다.

**배운 점 1. JPA와 Connection Pool의 상호작용**
- 영속성 컨텍스트와 Connection 반환 시점을 명확히 이해해야 한다는 점.

**배운 점 2. 문제를 재현하는 방법론**
- 문제가 발생한 조건을 테스트 환경에서 재현하며 원인을 좁혀나가는 것이 중요했습니다.

**배운 점 3. 기술 혼용의 리스크**
- JPA와 MyBatis처럼 서로 다른 Connection 관리 방식을 사용하는 기술을 혼용할 때의 위험성을 느꼈습니다.

---

## 마무리

이 문제는 주니어 개발자인 저에게 많은 것을 가르쳐 준 사건이었습니다.  
특히, 문제를 정의하고 원인을 좁혀가는 과정에서 느꼈던 성취는 잊지 못할 경험이 되었습니다. 앞으로도 이런 경험을 통해 한 단계씩 성장해 나가고 싶습니다.

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