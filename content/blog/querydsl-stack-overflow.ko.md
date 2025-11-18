---
title: "[트러블슈팅] QueryDSL StackOverflowError 탐방기"
tags:
  - "jpa"
  - "querydsl"
  - "stackoverflow"
date: '2024-03-15'
---

이번에 회사에서 직면했던 Querydsl StackOverflow에 관한 내용을 공유하고자 글을 남깁니다.

---

## 문제 발생

![Slack 메시지](https://velog.velcdn.com/images/12onetwo12/post/c0d01332-d81a-4671-8d23-e08ec17593d2/image.png)

오늘도 어김없이 문제는 Slack 메시지로부터 시작합니다.

메시지를 받자마자 어라? 라는 반응을 할 수밖에 없었습니다.
**StackOverflow?** 서버에 재귀식으로 구현된 코드가 있었던가?

---

## StackOverflow란

여러분들 모두 잘 알고 계시겠지만 StackOverflow란 지정한 스택 메모리 사이즈보다 더 많은 스택 메모리를 사용하게 되어 에러가 발생하는 상황입니다.

![JVM Stack](https://www.artima.com/insidejvm/ed2/images/fig5-3.gif)

메서드가 호출되면 호출 스택에 새 `Stack frame`이 생성됩니다. 이 `Stack frame`은 호출된 메서드의 매개 변수, 로컬 변수 및 메서드의 반환 주소, 즉 호출된 메서드가 반환된 후 메서드 실행이 계속되어야 하는 지점을 포함합니다.

`Stack frame` 생성은 중첩된 메서드 내에서 발견된 메서드 호출의 끝에 도달할 때까지 계속됩니다.

이 과정에서 JVM이 새 스택 프레임을 생성할 공간이 없는 상황이 발생하면 StackOverflowError가 발생합니다.

JVM이 이 상황에 직면하는 가장 일반적인 원인은 **종료되지 않은/무한 재귀**입니다.

---

## 원인

원인 발생지점은 어렵지 않게 찾을 수 있었습니다.

JPA를 사용하며 동적쿼리 작성을 용이하기 위해 사용한 QueryDsl이 문제지점이였습니다.

![StackTrace](https://velog.velcdn.com/images/12onetwo12/post/cb22d02a-cbc5-4fca-9038-02007fa6c042/image.png)

Stacktrace를 보자마자 아...

이거 Querydsl이 재귀식으로 구현돼있는 부분이 있나보구나 했습니다.

코드를 까보죠.

해당하는 각 `JPAMapAccessVisitor`, `OperationImpl`, `ReplaceVisitor`를 보겠습니다.

![JPAMapAccessVisitor](https://velog.velcdn.com/images/12onetwo12/post/64441f9f-c057-4a17-9ab4-734eb7974551/image.png)

![OperationImpl](https://velog.velcdn.com/images/12onetwo12/post/62cbc40e-b180-493c-ac0a-00402cb886cc/image.png)

![ReplaceVisitor 1](https://velog.velcdn.com/images/12onetwo12/post/a81591c1-b4e9-4ef1-869b-90b2a5089a62/image.png)

![ReplaceVisitor 2](https://velog.velcdn.com/images/12onetwo12/post/fb524f75-4aac-4c12-900f-205078a17f0d/image.png)

코드를 까서보니 조건 `Expression`을 만드는 과정에서 재귀식으로 구현돼있는게 맞았습니다.

위 `JPAMapAccessVisitor` 27,58 라인, `OperationImpl` 88 라인, `ReplaceVisitor` 51,161 라인을 계속 돌며 Stack frame을 열심히 차곡차곡 쌓아갔던 겁니다.

### 그런데 말입니다

처음엔 우리가 익히 쓰는 BooleanBuilder를 사용할 경우 위와 같은 로직을 타서 문제가 생긴다고 생각했습니다.

**하지만** 실제 원인은 **BooleanExpression을 체이닝하는 방식**이었습니다.

```java
// ❌ 이렇게 쓰면 문제가 됩니다
BooleanExpression expression = null;
for (Long apartId : apartIds) {  // apartId가 2000개 이상...
    BooleanExpression condition = qApart.id.eq(apartId);
    expression = (expression == null) ? condition : expression.or(condition);
}
```

왜 이게 문제가 될까요?

BooleanExpression은 **불변(Immutable) 객체**입니다. `and()` 또는 `or()`를 호출할 때마다 매번 새로운 객체를 만들어내죠.

```java
// BooleanExpression.or() 내부 코드
public BooleanExpression or(@Nullable Predicate right) {
    return Expressions.booleanOperation(Ops.OR, mixin, right);
    // ↑ 새 객체를 생성해서 반환합니다
}
```

2000개의 조건을 이렇게 체이닝하면 다음과 같은 구조가 만들어집니다.

```
                    OR
                   /  \
                  OR   expr2000
                 /  \
                OR   expr1999
               /  \
              OR   expr1998
             ...
            /  \
          expr1 expr2
```

깊이가 2000인 트리가 만들어지는 겁니다.

그리고 이 트리를 쿼리로 변환(직렬화)할 때 재귀 호출을 2000번 하게 되고, 결국 StackOverflow가 터지게 됩니다.

위 슬랙 메세지가 온 경우에는 조건이 2000개가 넘었습니다.

---

## 해결

그럼 어떻게 해결해야 할까요?

### 방법 1. BooleanBuilder 활용

```java
// 이렇게 하면 안전합니다
BooleanBuilder builder = new BooleanBuilder();
for (Long apartId : apartIds) {  // 2000개 이상도 OK
    builder.or(qApart.id.eq(apartId));
}

List<Apart> result = queryFactory
    .selectFrom(qApart)
    .where(builder)
    .fetch();
```

BooleanBuilder는 BooleanExpression과 다르게 **가변(Mutable) 객체**입니다.

내부 코드를 보면 다음과 같습니다.

```java
// BooleanBuilder.java
public class BooleanBuilder implements Predicate {
    @Nullable
    private Predicate predicate;  // 단일 필드

    public BooleanBuilder or(Predicate right) {
        if (predicate == null) {
            predicate = right;
        } else {
            predicate = ExpressionUtils.or(predicate, right);
        }
        return this;  // 자기 자신을 반환
    }
}
```

매번 새 객체를 만드는게 아니라, 내부의 `predicate` 필드를 업데이트하는 방식이죠.

따라서 불필요한 재귀 호출 없이 메모리를 효율적으로 사용할 수 있습니다.

### 방법 2. ExpressionUtils.inAny() 사용 (QueryDSL 3.6.0+)

대량 IN 조건이라면 QueryDSL이 제공하는 유틸을 사용할 수 있습니다.

```java
// Guava 라이브러리로 999개씩 나눔 (Oracle 제한 때문)
List<List<Long>> partitions = Lists.partition(apartIds, 999);

BooleanExpression expression = ExpressionUtils.inAny(qApart.id, partitions);

List<Apart> result = queryFactory
    .selectFrom(qApart)
    .where(expression)
    .fetch();
```

**999개씩 나누는 이유**

Oracle DB는 IN 절에 최대 1000개까지만 넣을 수 있습니다(ORA-01795 에러).
안전하게 999개씩 나누는 것을 권장합니다.

### 방법 3. 수동으로 파티셔닝하기

```java
List<List<Long>> partitions = Lists.partition(apartIds, 999);
BooleanBuilder builder = new BooleanBuilder();

for (List<Long> partition : partitions) {
    builder.or(qApart.id.in(partition));  // IN 절로 처리
}

List<Apart> result = queryFactory
    .selectFrom(qApart)
    .where(builder)
    .fetch();
```

이렇게 하면 SQL이 다음처럼 생성됩니다.

```sql
WHERE apart_id IN (1, 2, ..., 999)
   OR apart_id IN (1000, 1001, ..., 1999)
   OR apart_id IN (2000, 2001, ..., 2500)
```

### 방법 4. 임시 테이블 활용 (정말 많을 때)

조건이 수만 개 이상으로 극단적으로 많을 경우에는 이 방법도 있습니다.

```java
// 1. 임시 테이블에 ID 넣기
jdbcTemplate.batchUpdate(
    "INSERT INTO temp_apart_ids (id) VALUES (?)",
    apartIds,
    apartIds.size(),
    (ps, id) -> ps.setLong(1, id)
);

// 2. JOIN으로 조회
String sql = """
    SELECT a.*
    FROM apart a
    INNER JOIN temp_apart_ids t ON a.id = t.id
    """;
```

### 방법 5. JPQL 직접 작성

저는 프로젝트 상황상 JPQL을 사용하는 것으로 결론지었습니다.

```java
List<Apart> result = new ArrayList<>();
List<List<Long>> partitions = Lists.partition(apartIds, 999);

for (List<Long> partition : partitions) {
    String jpql = "SELECT a FROM Apart a WHERE a.id IN :ids";
    result.addAll(entityManager.createQuery(jpql, Apart.class)
        .setParameter("ids", partition)
        .getResultList());
}
```

**주의:** JPQL도 IN 절에 대량 조건을 그대로 넣으면 똑같은 문제가 생길 수 있어서, 파티셔닝을 함께 적용했습니다.

---

## 해결 방법 비교

| 방법 | 장점 | 단점 | 권장 상황 |
|------|------|------|-----------|
| **BooleanBuilder** | 간단하고 안전, 타입 안전성 유지 | - | ✅ 일반적인 경우 |
| **ExpressionUtils.inAny()** | 가장 깔끔한 코드 | QueryDSL 3.6.0+ 필요 | ✅ 최신 버전 사용 시 |
| **수동 파티셔닝** | 모든 버전 호환 | 코드가 조금 길어짐 | ✅ 구버전 사용 시 |
| **임시 테이블** | 대량 데이터에 최적 | 복잡도 증가 | ⚠️ 수만 개 이상 |
| **JPQL 직접 작성** | 완전한 제어 | 타입 안전성 포기 | ⚠️ 최후의 수단 |

저희는 BooleanBuilder로 일관된 사용을 하기로 결론 지었습니다.

---

## 추가 팁

### JVM 스택 크기 조정 (임시 방편)

근본 해결책은 아니지만, 급한 경우 스택 크기를 늘릴 수 있습니다.

```bash
# 스택 크기를 2MB로 증가
java -Xss2m -jar application.jar
```

**⚠️ 주의:** 이는 임시방편일 뿐이며, 근본 해결책은 **조건 분할**입니다.

### Oracle IN 절 제한

```sql
-- ❌ 에러 발생 (ORA-01795)
SELECT * FROM apart WHERE id IN (1, 2, 3, ..., 1001);

-- ✅ 999개씩 분할
SELECT * FROM apart
WHERE id IN (1, 2, ..., 999)
   OR id IN (1000, 1001, ..., 1998);
```

---

## 정리하며

오랜만에 보는 StackOverflowError라서 반갑기도 했습니다.

한편으로는 Querydsl도 애플리케이션 입장에서보면 의존성이 하나 더 생기는 것이기때문에 장애발생 가능지점이 하나 늘어나는 거구나 싶긴합니다.

### 핵심 교훈

1. **BooleanExpression 체이닝은 위험합니다** (대량 조건 시 StackOverflow 발생)
2. **BooleanBuilder를 사용하는 것이 안전합니다** (가변 객체라 안전함)
3. **Oracle IN 절은 1000개 제한** (999개씩 나누기)
4. **상황에 맞는 해결책을 선택하시면 됩니다** (ExpressionUtils.inAny() > BooleanBuilder > JPQL)

Querydsl 사용할때 대량 조건 처리 다들 조심하십쇼!

---

## Reference

- [QueryDSL GitHub Issue #721 - StackOverflow error](https://github.com/querydsl/querydsl/issues/721)
- [Google Groups - StackOverflowError discussion](https://groups.google.com/g/querydsl/c/PJX9o6yxx-A)
- [QueryDSL BooleanBuilder Source Code](https://github.com/querydsl/querydsl/blob/master/querydsl-core/src/main/java/com/querydsl/core/BooleanBuilder.java)
- [QueryDSL BooleanExpression Source Code](https://github.com/querydsl/querydsl/blob/master/querydsl-core/src/main/java/com/querydsl/core/types/dsl/BooleanExpression.java)

---

> 위 본문 내용중 정확하지 않은 내용이 포함돼 있을 수 있습니다.
> 저는 1년차 백엔드 개발자로 스스로 굉장히 부족한 사람이라는 점을 인지하고 있는지라
> 제가 적은 정보가 정확하지 않을까 걱정하고 있습니다.
> 혹여 제 정보가 잘못 됐을 수 있으니 단지 참고용으로만 봐주시고 관련된 내용을 한번 직접 알아보시는 걸 추천합니다.
> 혹여 잘못된 내용이 있거나 말씀해주시고 싶은 부분이 있으시다면 부담없이 적어주세요.
> 수용하고 개선하기 위해 노력하겠습니다.