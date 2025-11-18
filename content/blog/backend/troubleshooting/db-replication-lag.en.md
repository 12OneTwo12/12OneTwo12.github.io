---
title: Resolving DB Replication Lag
tags:
  - "db"
  - "rdbms"
  - "mysql"
  - "replication"
  - "lag"
date: '2024-11-15'
---

I'm sharing about a replication lag issue I encountered at work.

------------------------------------------------------------------

### Problem Occurrence

Our company uses database replication to distribute load and improve performance.


![Replication Structure](https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Fblog.kakaocdn.net%2Fdn%2FbFKM8F%2FbtrivOHy0Cu%2FvKnHaVkMDbsl90KTDCxUk0%2Fimg.png)

The system is configured as Active-Active redundancy in a Master-Slave structure, and through ProxySQL, `SELECT` statements are sent to Slave, and `INSERT`, `UPDATE`, `DELETE` statements are sent to Master. Afterwards, data changed in Master is synchronized to Slave.

Through this structure, we were distributing load and improving performance, but one of the problems that occasionally occurs here is the "replication lag issue".

![Replication Lag Issue](https://velog.velcdn.com/images/kimtjsdlf/post/6958e35a-7f9a-4a3d-a011-a1ebf9a39153/image.png)

For example, when a user performs an `INSERT` operation and immediately calls `SELECT`, if data synchronization to Slave is not complete, from the user's perspective, data may appear to be missing.

![Exception Example](https://velog.velcdn.com/images/12onetwo12/post/51cb4601-f3bf-4a08-8d2a-8471d4be69cc/image.png)

The above example is a screen where an exception message occurred due to a related problem was sent to Slack.

---

### Solution Methods

The company considered various methods to solve the replication lag problem. Generally, the following solutions can be considered:

- **Read-Your-Own-Write**
- **Monotonic Reads**
- **Consistent Reads**

However, the method our company initially chose was simple and straightforward.

> **For applications handling major business logic, don't use ProxySQL and only point to Master.**

There were three main reasons for adopting this method:

1. Because it's a **temporary problem**, and once data is synchronized, no more problems occur.
2. Because **major business logic often requires SELECT after INSERT**, it could lower the probability of problems occurring.
3. Because **other development schedules were prioritized**, we needed to save additional debugging and development time.

This method was somewhat distant from the goal of load distribution through replication, but it was a realistic alternative to solve the immediate problem.

---

### Considering and Applying More Substantial Solution Methods

I, who was feeling the need for a better solution, volunteered to solve this problem myself when there was room in the schedule. The main references I consulted while searching for related materials were:

- [Applying AbstractRoutingDataSource](https://velog.io/@ghkvud2/AbstractRoutingDataSource-%EC%A0%81%EC%9A%A9%ED%95%98%EA%B8%B0)
- [Select Database - Drunken HW's Blog](https://drunkenhw.github.io/java/select-database/)

Based on these materials, I introduced a method to solve it using **AbstractRoutingDataSource**. Through this method, I implemented it to point to Master in parts containing logic that may require `SELECT` operations after `INSERT`.

#### **Application Method**

1. **Applying AbstractRoutingDataSource, AOP**:
    - I distinguished parts where `SELECT` operations are needed after `INSERT` and configured them to point to Master within that logic.

2. **Introducing Transactions**:
    - When using ProxySQL, it basically points only to Master within a transaction. Using this, I made it naturally point to Master even where individual `INSERT` operations occur.

3. **Using Master Only for Major Business Logic**:
    - For some major business applications, I configured them to connect directly to Master only without going through ProxySQL.

This method still left some potential for problems. For example, when users A and B insert and query data almost simultaneously, problems can occur when B tries to immediately query data that A `INSERT`ed. However, I judged that such cases would not be frequent.

Also, since major business logic was connected only to Master, the possibility that users would experience problems was very low.

---

### Reflections

Actually, I think the replication lag problem is a chronic problem that must be faced when having a Replication structure or when data replication between different DBs must occur.

I had always been thinking "I should solve it later, I should solve it" and kept postponing it, but after attending NAVER conference DAN24 this time and listening to Kim Jin-han's session [Growth and Change of NAVER Pay Payment System](https://dan.naver.com/24/sessions/635) at NAVER FINANCIAL Tech, I thought "I also want to solve the replication lag problem when I return to the company" and ended up solving it.

It was a very good session and presentation.

>The above content may contain inaccurate information.
As a second-year backend developer, I'm aware that I'm quite lacking,
so I'm worried that the information I've written may not be accurate.
My information may be incorrect, so please use it for reference only and I recommend looking into the related content yourself.
If there's any incorrect information or if you'd like to comment on anything, please feel free to write!
I'll accept it and strive to improve!

---

### Reference
https://drunkenhw.github.io/java/select-database/
https://velog.io/@ghkvud2/AbstractRoutingDataSource-%EC%A0%81%EC%9A%A9%ED%95%98%EA%B8%B0
https://velog.io/@kimtjsdlf/%EB%B3%B5%EC%A0%9C2-%EB%B3%B5%EC%A0%9C-%EC%A7%80%EC%97%B0
