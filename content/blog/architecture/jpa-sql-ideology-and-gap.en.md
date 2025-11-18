---
title: The Ideology of JPA and the Gap with SQL
tags:
  - java
  - jpa
  - sql
date: '2024-11-28'
---

When using JPA, you sometimes encounter moments like "Huh? They don't support this?"

JPA (Java Persistence API) is a tool designed to bridge the gap between databases and objects in Java applications and help with object-oriented development. However, despite the advantages gained from using JPA, there are cases where you feel a gap between SQL functionality and JPA functionality in practice. Especially when using JPQL (Java Persistence Query Language), you can experience cases where SQL functionality is limited due to conflicts with JPA's design philosophy.

In this article, I'd like to examine JPA's ideology and limitations through some cases showing the **gap** between JPA and SQL that I've experienced.

## JPA's Design Ideology

JPA is not simply about wrapping SQL in objects, but aims for **object-centric** design rather than databases.

- **Database independence**: Designed to work on various databases without depending on a specific database.
- **Entity-centric**: Data modeling centered on objects (Entity) rather than tables.
- **Providing abstraction**: Abstracting data access complexity to enable focus on business logic only.
- **Relationship mapping automation**: Mapping relationships between objects to database tables.

These ideologies have greatly improved development productivity, but practical work sometimes creates limitations due to representation differences between databases and objects.

### Gap Between JPA and SQL
#### 1. No Support for UNION / UNION ALL

In SQL, `UNION` and `UNION ALL` combine results from multiple queries into one. However, JPQL doesn't support operations like `UNION`. This is because JPA is designed centered on entities, and operations like UNION conflict with the **basic ideology of entity modeling**.

In a sense, it seems JPA is asking this:

_"If entity design was done properly, would UNION ever be necessary?"_

However, there can be situations where UNION must be used due to requirements.
In such cases, you ultimately have to use Native Query.

#### 2. No Support for INSERT in JPQL

The `INSERT` statement for inserting data in SQL is basic functionality, but JPQL doesn't support it. JPA adopted an object-oriented approach using the **`EntityManager.persist()`** method when inserting data. Actually, there would rarely be cases to do `INSERT` in JPQL.

#### 3. No Support for FROM Clause in Subqueries

In SQL, you can use subqueries in FROM clause to use temporary results like tables. However, JPQL **doesn't support subqueries in FROM clause**. Since JPQL works based on entities, functionality to use temporary results in FROM clause like SQL is not supported.

This also leads to situations where you have to return to SQL.

#### 4. No Support for LIMIT in Subqueries

In SQL, you can use `LIMIT` inside subqueries.
However, in JPQL, you can only use Limit through `setMaxResults()` and `setFirstResult()` in the main query. Since `setMaxResults()` and `setFirstResult()` are for simple **pagination**, they support it, but subquery `LIMIT` might be for similar reasons to not supporting FROM clause.



> These gaps between JPA and SQL felt to me like being urged to properly design Entities from the start.

### However, Requirements Always Change

However, in realistic development environments, requirements change frequently, and there are cases where gaps arise between databases and objects.

#### 1. When Tables Aren't Designed by You

If you designed the database based on object-oriented design from the project's start, the gap could narrow. But in practice, you mostly have to work with already designed tables, namely **legacy databases**.

In such cases, **should we change schemas and migrate data just to use JPA?**

#### 2. Sudden Requirement Changes

Requirements always change. Data models that were initially simple become complex over time, and business logic changes can affect existing design or systems. I think the abstraction layer provided by JPA sometimes becomes an obstacle rather than helping secure flexibility in such cases.

For example, if initially you only needed to handle two tables "customer and order", but later situations arise where you need to manage additional information like "delivery status", "payment history", "refund processing" in the order table, additional entities or relationship mappings are needed to process data while maintaining existing design. These requirements can affect the entire existing code. Especially, the deeper the association relationships are set in entities, the exponentially larger the impact range from changes becomes.

#### 3. Complex Query Requirements

There are times when you suddenly need to write complex aggregation queries for business insights like "customers who purchased most" or "order growth rate within a specific period", moving away from simple data queries.

In such cases, JPQL isn't suitable for complex aggregation or conditional queries due to the above constraints. Especially, situations arise where it's difficult to use SQL's advanced features like subqueries, joins, grouping, window functions.

In such cases, you ultimately have to return to Native Query.

### Harmony Between JPA and SQL

I think JPA supports object-centric design but isn't a perfect solution.

When using JPA, in a sense it seems we become independent from databases but dependent on JPA.

I've come to think that it's appropriate to not insist only on JPA but consider various aspects by properly combining Native Query, QueryDSL, or tools like SQL Mapper.

After all, I think what's important is not being constrained by tools but finding the most effective way to solve given problems.
