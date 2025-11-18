---
title: "[Troubleshooting] QueryDSL StackOverflowError Investigation"
tags:
  - "jpa"
  - "querydsl"
  - "stackoverflow"
date: '2024-03-15'
---

I'm sharing about a Querydsl StackOverflow issue I encountered at work.

---

## Problem Occurrence

![Slack Message](https://velog.velcdn.com/images/12onetwo12/post/c0d01332-d81a-4671-8d23-e08ec17593d2/image.png)

As always, the problem starts with a Slack message.

As soon as I received the message, I couldn't help but react with "huh?"
**StackOverflow?** Was there recursively implemented code in the server?

---

## What is StackOverflow

As you all know well, StackOverflow is a situation where an error occurs because more stack memory is used than the specified stack memory size.

![JVM Stack](https://www.artima.com/insidejvm/ed2/images/fig5-3.gif)

When a method is called, a new `Stack frame` is created on the call stack. This `Stack frame` contains the called method's parameters, local variables, and the method's return address, i.e., the point where method execution should continue after the called method returns.

`Stack frame` creation continues until the end of method calls found within nested methods is reached.

If the JVM runs out of space to create a new stack frame during this process, a StackOverflowError occurs.

The most common reason the JVM faces this situation is **unterminated/infinite recursion**.

---

## Cause

The point where the cause occurred was not difficult to find.

It was QueryDsl, which we used to facilitate dynamic query creation while using JPA.

![StackTrace](https://velog.velcdn.com/images/12onetwo12/post/cb22d02a-cbc5-4fca-9038-02007fa6c042/image.png)

As soon as I saw the Stacktrace, ah...

I thought there must be a recursively implemented part in Querydsl.

Let's dig into the code.

I'll look at each of the `JPAMapAccessVisitor`, `OperationImpl`, and `ReplaceVisitor`.

![JPAMapAccessVisitor](https://velog.velcdn.com/images/12onetwo12/post/64441f9f-c057-4a17-9ab4-734eb7974551/image.png)

![OperationImpl](https://velog.velcdn.com/images/12onetwo12/post/62cbc40e-b180-493c-ac0a-00402cb886cc/image.png)

![ReplaceVisitor 1](https://velog.velcdn.com/images/12onetwo12/post/a81591c1-b4e9-4ef1-869b-90b2a5089a62/image.png)

![ReplaceVisitor 2](https://velog.velcdn.com/images/12onetwo12/post/fb524f75-4aac-4c12-900f-205078a17f0d/image.png)

After digging into the code, it was correct that it was recursively implemented in the process of creating condition `Expression`.

It was diligently stacking Stack frames by repeatedly going through `JPAMapAccessVisitor` lines 27,58, `OperationImpl` line 88, and `ReplaceVisitor` lines 51,161.

### But Here's the Thing

At first, I thought the problem occurred when using BooleanBuilder, which we commonly use, and it went through the above logic.

**However**, the actual cause was **chaining BooleanExpression**.

```java
// ❌ Using it like this causes problems
BooleanExpression expression = null;
for (Long apartId : apartIds) {  // apartId is over 2000...
    BooleanExpression condition = qApart.id.eq(apartId);
    expression = (expression == null) ? condition : expression.or(condition);
}
```

Why does this cause problems?

BooleanExpression is an **Immutable object**. Every time you call `and()` or `or()`, it creates a new object.

```java
// BooleanExpression.or() internal code
public BooleanExpression or(@Nullable Predicate right) {
    return Expressions.booleanOperation(Ops.OR, mixin, right);
    // ↑ Creates and returns a new object
}
```

If you chain 2000 conditions like this, the following structure is created.

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

A tree with a depth of 2000 is created.

And when converting this tree to a query (serialization), it makes 2000 recursive calls, eventually causing a StackOverflow.

In the case where the Slack message above came, there were over 2000 conditions.

---

## Solution

So how should we solve it?

### Method 1. Using BooleanBuilder

```java
// This is safe
BooleanBuilder builder = new BooleanBuilder();
for (Long apartId : apartIds) {  // Over 2000 is OK
    builder.or(qApart.id.eq(apartId));
}

List<Apart> result = queryFactory
    .selectFrom(qApart)
    .where(builder)
    .fetch();
```

Unlike BooleanExpression, BooleanBuilder is a **Mutable object**.

Looking at the internal code:

```java
// BooleanBuilder.java
public class BooleanBuilder implements Predicate {
    @Nullable
    private Predicate predicate;  // Single field

    public BooleanBuilder or(Predicate right) {
        if (predicate == null) {
            predicate = right;
        } else {
            predicate = ExpressionUtils.or(predicate, right);
        }
        return this;  // Returns itself
    }
}
```

Instead of creating a new object each time, it updates the internal `predicate` field.

Therefore, it can use memory efficiently without unnecessary recursive calls.

### Method 2. Using ExpressionUtils.inAny() (QueryDSL 3.6.0+)

For bulk IN conditions, you can use the utility provided by QueryDSL.

```java
// Split into 999 each using Guava library (due to Oracle limitation)
List<List<Long>> partitions = Lists.partition(apartIds, 999);

BooleanExpression expression = ExpressionUtils.inAny(qApart.id, partitions);

List<Apart> result = queryFactory
    .selectFrom(qApart)
    .where(expression)
    .fetch();
```

**Why split into 999?**

Oracle DB can only put a maximum of 1000 items in an IN clause (ORA-01795 error).
It's recommended to safely split into 999.

### Method 3. Manual Partitioning

```java
List<List<Long>> partitions = Lists.partition(apartIds, 999);
BooleanBuilder builder = new BooleanBuilder();

for (List<Long> partition : partitions) {
    builder.or(qApart.id.in(partition));  // Process with IN clause
}

List<Apart> result = queryFactory
    .selectFrom(qApart)
    .where(builder)
    .fetch();
```

This way, SQL is generated like this:

```sql
WHERE apart_id IN (1, 2, ..., 999)
   OR apart_id IN (1000, 1001, ..., 1999)
   OR apart_id IN (2000, 2001, ..., 2500)
```

### Method 4. Using Temporary Table (When Really Large)

If conditions are extremely large, in the tens of thousands or more, this method is also available.

```java
// 1. Insert IDs into temporary table
jdbcTemplate.batchUpdate(
    "INSERT INTO temp_apart_ids (id) VALUES (?)",
    apartIds,
    apartIds.size(),
    (ps, id) -> ps.setLong(1, id)
);

// 2. Query with JOIN
String sql = """
    SELECT a.*
    FROM apart a
    INNER JOIN temp_apart_ids t ON a.id = t.id
    """;
```

### Method 5. Writing JPQL Directly

For my project situation, I concluded to use JPQL.

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

**Note:** JPQL can also have the same problem if you put bulk conditions directly in the IN clause, so I applied partitioning together.

---

## Solution Comparison

| Method | Advantages | Disadvantages | Recommended When |
|------|------|------|-----------|
| **BooleanBuilder** | Simple and safe, maintains type safety | - | Generally recommended |
| **ExpressionUtils.inAny()** | Cleanest code | Requires QueryDSL 3.6.0+ | When using latest version |
| **Manual Partitioning** | Compatible with all versions | Code becomes a bit longer | When using older versions |
| **Temporary Table** | Optimal for large data | Increased complexity | When tens of thousands or more |
| **Writing JPQL Directly** | Complete control | Loses type safety | Last resort |

We concluded to use BooleanBuilder consistently.

---

## Additional Tips

### Adjusting JVM Stack Size (Temporary Measure)

While not a fundamental solution, you can increase the stack size in urgent cases.

```bash
# Increase stack size to 2MB
java -Xss2m -jar application.jar
```

**Warning:** This is only a temporary measure, and the fundamental solution is **condition splitting**.

### Oracle IN Clause Limitation

```sql
-- ❌ Error occurs (ORA-01795)
SELECT * FROM apart WHERE id IN (1, 2, 3, ..., 1001);

-- Split into 999 each
SELECT * FROM apart
WHERE id IN (1, 2, ..., 999)
   OR id IN (1000, 1001, ..., 1998);
```

---

## In Conclusion

It was nice to see a StackOverflowError after a long time.

On the other hand, I thought that Querydsl is one more dependency from the application's perspective, so it's one more point where failures can occur.

### Key Lessons

1. **BooleanExpression chaining is dangerous** (causes StackOverflow with bulk conditions)
2. **Using BooleanBuilder is safe** (safe as a mutable object)
3. **Oracle IN clause has a 1000 limit** (split into 999)
4. **Choose the solution that fits your situation** (ExpressionUtils.inAny() > BooleanBuilder > JPQL)

Everyone be careful when processing bulk conditions with Querydsl!

---

## Reference

- [QueryDSL GitHub Issue #721 - StackOverflow error](https://github.com/querydsl/querydsl/issues/721)
- [Google Groups - StackOverflowError discussion](https://groups.google.com/g/querydsl/c/PJX9o6yxx-A)
- [QueryDSL BooleanBuilder Source Code](https://github.com/querydsl/querydsl/blob/master/querydsl-core/src/main/java/com/querydsl/core/BooleanBuilder.java)
- [QueryDSL BooleanExpression Source Code](https://github.com/querydsl/querydsl/blob/master/querydsl-core/src/main/java/com/querydsl/core/types/dsl/BooleanExpression.java)

---

> The above content may contain inaccurate information.
> As a first-year backend developer, I'm aware that I'm quite lacking,
> so I'm worried that the information I've written may not be accurate.
> My information may be incorrect, so please use it for reference only and I recommend looking into the related content yourself.
> If there's any incorrect information or if you'd like to comment on anything, please feel free to write.
> I'll accept it and strive to improve.
