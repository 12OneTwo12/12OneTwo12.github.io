---
title: "Changed MySQL Column Type from bigint to varchar and It Got 8x Slower...! : Procedure Performance Degradation Troubleshooting"
tags:
  - "mysql"
  - "procedure"
  - "collation"
  - "innodb"
  - "myisam"
date: '2025-10-20'
---

## Introduction

Hello.

I'm Jeongil Jeong, a 3rd-year backend developer working at a proptech platform.

Today, I'd like to share an interesting performance issue that occurred in our service and the resolution process. While solving a problem where a MySQL procedure suddenly became 8 times slower, I encountered various issues in the DB. I think it would be fun for readers to follow along with the problem and guess what the cause might be.

---

## Problem Discovery: Suddenly Slow Procedure

At the company, we were working on a project to migrate from a legacy monolith system to MSA. During this process, we decided to change the data type of the `item_id` column from `bigint` to `varchar(30)`. This was a decision considering data consistency between services and future extensibility to other identification schemes.

To test, we completed the migration on the development server first and were testing in the development environment when we discovered that the performance of a specific procedure had noticeably degraded.

```
Development environment (varchar parameter): 457-465ms
Production environment (bigint parameter): 56-70ms
```

It was about an 8x performance difference. Same hardware specs, same MySQL version (8.0.37), and similar amount of data. Suspecting measurement error, I ran it several times, but the results were consistently the same.

The problematic procedure was `getItemDetailInfo`, which queries detail information used in the legacy service.

> All procedures, tables, parameters, and column names written in this article are examples.

```sql
CREATE PROCEDURE getItemDetailInfo(
    IN P_ITEM_ID varchar(30),  -- Changed from bigint to varchar(30)
    IN P_AREA_SIZE double,
    IN P_PREFIX varchar(5),
    IN P_USER_NO int,
    IN P_ITEM_TYPE varchar(10)
)
BEGIN
    -- User view history INSERT
    -- Frequent visit history INSERT
    -- Item detail information SELECT (including subqueries)
END
```

We only changed the parameter type, so why did it get so slow?

---

## First Hypothesis: Index Issue

The first thing I suspected was indexes. I thought that the indexes might not be working properly after changing the data type to VARCHAR.

```sql
-- Check indexes of related tables
SELECT COLUMN_NAME, COLUMN_KEY, DATA_TYPE, COLLATION_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('item_badge', 'user_history', 'item_special')
  AND COLUMN_NAME = 'item_id';
```

Result:
```
item_badge.item_id     → COLUMN_KEY = 'MUL', varchar(30)
user_history.item_id   → COLUMN_KEY = 'MUL', varchar(30)
item_special.item_id   → COLUMN_KEY = 'MUL', varchar(30)
```

It was an unexpected result. All indexes existed normally, and the types were already unified as `varchar(30)`. Missing indexes or type mismatches weren't the cause of the problem. The first hypothesis was wrong.

---

## Second Hypothesis: Subquery Performance Issue

If it's not indexes, what could the problem be? I analyzed the procedure code again. The main SELECT query contained 3 subqueries.

```sql
SELECT i.*, ia.*,
    -- Subquery 1: Badge information
    IFNULL((SELECT badge FROM item_badge WHERE item_id = i.item_id), 0) AS badge_info,
    -- Subquery 2: Event count
    (SELECT COUNT(*) FROM user_history WHERE item_id = i.item_id) AS event_count,
    -- Subquery 3: Special item check
    if(exists(select 1 from item_special where item_id = i.item_id) = 1, 'Special', category) as category
FROM item_info AS i
INNER JOIN item_area AS ia ON i.item_id = ia.item_id
WHERE i.item_id = P_ITEM_ID;
```

I hypothesized that subqueries might be causing an N+1 problem by being executed repeatedly. To verify this, I changed the subqueries to LEFT JOINs.

```sql
SELECT i.*, ia.*,
    IFNULL(ib.badge, 0) AS badge_info,
    IFNULL(uh.event_count, 0) AS event_count,
    IF(is.item_id IS NOT NULL, 'Special', i.category) AS category
FROM item_info AS i
INNER JOIN item_area AS ia ON i.item_id = ia.item_id
LEFT JOIN item_badge AS ib ON i.item_id = ib.item_id
LEFT JOIN (
    SELECT item_id, COUNT(*) AS event_count
    FROM user_history
    GROUP BY item_id
) AS uh ON i.item_id = uh.item_id
LEFT JOIN item_special AS is ON i.item_id = is.item_id
WHERE i.item_id = P_ITEM_ID;
```

Result: 477ms (actually 20ms slower)

It was a different result than expected. It got even slower. The adverse effect occurred while GROUP BY-ing the entire `user_history` table. When executing individual queries directly, each subquery took less than 1ms. Subqueries were not the cause of performance degradation.

---

### Even Stranger: Individual Queries Are Fast

What was even more frustrating was that when executing queries inside the procedure directly, they were very fast.

```sql
-- Execute procedure internal queries directly
SELECT * FROM item_info WHERE item_id = '1168010609';  -- 1.8ms
SELECT * FROM user_history WHERE item_id = '1168010609';  -- 0.7ms
SELECT * FROM item_badge WHERE item_id = '1168010609';  -- less than 1ms
```

All individual queries executed in about 1-2ms. But when putting the same queries into a procedure, it takes 457ms.

```
Individual queries:  1-2ms
Procedure:          457ms
```

Same queries, same database, same parameters, yet over 200x difference. Why on earth is this happening?

---

## Third Attempt: Analyzing Execution Plan with EXPLAIN

At this point, I was really frustrated. There are indexes, subqueries aren't the problem, and individual queries are fast, but only when executed as a procedure it becomes slow - what on earth is the problem?

I was clearly missing something more fundamental. So I decided to analyze the execution plan with EXPLAIN.

```sql
-- When using variables (similar to procedure)
SET @v_item_id = '1168010609';
EXPLAIN SELECT * FROM item_info WHERE item_id = @v_item_id;
```

Result:
```
type: ALL (Full table scan)
rows: 45,453
Extra: Using where

Warning: Cannot use ref access on index 'PRIMARY' due to type or collation conversion on field 'item_id'
```

I found an important clue. `type: ALL` meant full table scan. It was reading all 45,453 rows. And there was a warning message. It said "Can't use indexes because of type or collation conversion".

Collation... this keyword caught my eye. For comparison, I also tested the case of using direct values.

```sql
EXPLAIN SELECT * FROM item_info WHERE item_id = '1168010609';
```

Result:
```
type: const (Uses index)
rows: 1
```

There was a clear difference. When using direct values, it perfectly uses the index with `type: const` and reads only 1 row. But when using variables, it does a full table scan.

I finally got a clue. The warning message's `type or collation conversion` was the key keyword.

---

## Root Cause Discovery: Collation Mismatch

The word Collation kept swirling in my head. "I'm sure it was something like a string comparison rule in MySQL..." Using the warning message as a clue, I checked the collation of table columns.

```sql
SHOW FULL COLUMNS FROM item_info WHERE Field = 'item_id';
SHOW FULL COLUMNS FROM item_area WHERE Field = 'item_id';
```

Result:
```
item_id, varchar(30), utf8mb3_general_ci
```

I found the cause. The table columns were using `utf8mb3_general_ci`. On the other hand, in MySQL 8.0, the default character set is `utf8mb4`, and the default collation is `utf8mb4_0900_ai_ci`.

> "From MySQL 8.0, utf8mb4 is the default character set, and utf8mb4_0900_ai_ci is the default collation."
>
> — [MySQL 8.0 Reference Manual, Section 10.2 Character Sets and Collations in MySQL](https://dev.mysql.com/doc/refman/8.0/en/charset-mysql.html)

The problem was clear. MySQL was internally performing conversion when comparing values with two different collations, utf8mb3 and utf8mb4. And during this conversion process, indexes couldn't be used.

### Problems Caused by Collation Mismatch

When comparing values with different collations, MySQL internally performs type conversion (collation conversion). According to MySQL official documentation:

> "Comparison of dissimilar columns (comparing a string column to a temporal or numeric column, for example) may prevent use of indexes if values cannot be compared directly without conversion."
>
> — [MySQL 8.0 Reference Manual, Section 10.3.1 How MySQL Uses Indexes](https://dev.mysql.com/doc/refman/8.0/en/mysql-indexes.html)

During this process, the following problems occur:

1. **Cannot use indexes**: Cannot directly compare values with different collations, requiring conversion, so indexes cannot be used
2. **Full table scan performed**: Must read all 45,453 rows
3. **Collation conversion performed for each row**: String conversion overhead occurs for every row
4. **Result**: Performance degradation of hundreds of milliseconds

This problem has been reported multiple times in the MySQL bug tracker (Bug #83856, #83857, etc.), and is a constraint specified in MySQL official documentation.

I measured the actual difference with PREPARE STATEMENT.

```sql
SET profiling = 1;

-- Binding as bigint (collation conversion occurs)
SET @item_id = 1168010609;
PREPARE stmt FROM 'SELECT * FROM item_info WHERE item_id = ?';
EXECUTE stmt USING @item_id;

-- Binding as varchar (collation matches)
SET @item_id = '1168010609';
PREPARE stmt FROM 'SELECT * FROM item_info WHERE item_id = ?';
EXECUTE stmt USING @item_id;

SHOW PROFILES;
```

Result:
```
bigint binding:  202ms
varchar binding: 0.6ms
```

A 335x difference occurred. Now I knew exactly why the procedure was slow.

---

## Finding Bottleneck Precisely with Profiling

To check exactly where inside the procedure is slow, I ran profiling.

```sql
SET profiling = 1;
CALL getItemDetailInfo('1168010609', 34, 'item', 219786, 'type_a');
SHOW PROFILES;
```

Result:

| Query_ID | Duration | Query |
|----------|----------|-------|
| 1179 | 0.225648s (225ms) | INSERT INTO user_view_log ... SELECT |
| 1180 | 0.202043s (202ms) | INSERT INTO frequent_visits ... SELECT |
| 1181 | 0.209143s (209ms) | SELECT (main query) |

Total execution time: about 636ms

But there was something interesting. When executing the same queries individually:
- INSERT user_view_log: 4.5ms
- INSERT frequent_visits: 0.7ms
- SELECT: 1.8ms

While individual queries executed very quickly, the procedure took 636ms. This difference was because collation conversion occurred when using procedure parameters.

---

## Temporary Solution: Matching Collation with Local Variables

Now that I knew the cause, I needed to find a solution. But changing the entire database to utf8mb4 would take time and have risks. I decided to fix the procedure quickly first.

The method I came up with was simple. Create local variables inside the procedure and explicitly specify `utf8mb3` collation for those variables.

```sql
CREATE PROCEDURE getItemDetailInfo(
    IN P_ITEM_ID varchar(30),
    IN P_AREA_SIZE double,
    IN P_PREFIX varchar(5),
    IN P_USER_NO int,
    IN P_ITEM_TYPE varchar(10)
)
BEGIN
    -- Explicitly specify utf8mb3 collation for local variables
    DECLARE v_item_id VARCHAR(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci;
    DECLARE v_item_title VARCHAR(255);

    -- Copy parameter value to local variable
    SET v_item_id = P_ITEM_ID;

    IF P_USER_NO IS NOT NULL THEN
        -- Use v_item_id (instead of P_ITEM_ID)
        SELECT title INTO v_item_title
        FROM item_info
        WHERE item_id = v_item_id
        LIMIT 1;

        INSERT INTO user_view_log (user_no, item_id, item_title, area_size, item_type)
        VALUES (P_USER_NO, v_item_id, v_item_title, P_AREA_SIZE, P_ITEM_TYPE)
        ON DUPLICATE KEY UPDATE created_at = NOW();

        INSERT INTO frequent_visits (user_id, item_id, area_size, item_type, visit_count, last_visited)
        SELECT u.id, v_item_id, P_AREA_SIZE, P_ITEM_TYPE, 1, now()
        FROM users u
        WHERE no = P_USER_NO
        ON DUPLICATE KEY UPDATE
            area_size = P_AREA_SIZE,
            item_type = P_ITEM_TYPE,
            visit_count = IF(TIMESTAMPDIFF(HOUR, last_visited, NOW()) >= 1, visit_count + 1, visit_count),
            last_visited = IF(TIMESTAMPDIFF(HOUR, last_visited, NOW()) >= 1, NOW(), last_visited);
    END IF;

    -- Use v_item_id in main SELECT too
    SELECT i.*, ia.*, ...
    FROM item_info AS i
    INNER JOIN item_area AS ia ON i.item_id = ia.item_id
        AND ia.area_size = P_AREA_SIZE
    WHERE i.item_id = v_item_id;  -- v_item_id instead of P_ITEM_ID
END
```

Result: 457ms → 42ms (about 11x improvement)

It was a significant improvement. Looking at the profiling results, each query was executing at normal speed.

```
Query 1568: SELECT title → 0.55ms
Query 1569: INSERT user_view_log → 4.25ms
Query 1570: INSERT frequent_visits → 0.71ms
Query 1571: SELECT (main query) → 1.40ms
```

I solved the immediate performance problem, but there was still something unsettling. Warning messages were still being output.

For reference, when actually executing the procedure, it appears as follows:
```
1 row retrieved starting from 1 in 404 ms (execution: 42 ms, fetching: 362 ms)
```
Out of a total of 404ms, the actual query execution time is 42ms, and the remaining 362ms is data transfer (fetching) time.

```
[HY000][3778] 'utf8mb3_general_ci' is a collation of the deprecated character set UTF8MB3.
```

It was a warning message that utf8mb3 has been deprecated. In MySQL official documentation, utf8mb3 is in deprecated status. This method was only a temporary measure. To solve it fundamentally, I needed to migrate the entire database to utf8mb4.

> "The utf8mb3 character set is deprecated."
>
> — [MySQL 8.0 Reference Manual, Section 10.9.2 The utf8mb3 Character Set](https://dev.mysql.com/doc/refman/8.0/en/charset-unicode-utf8mb3.html)

---

## Fundamental Solution Direction: Full Database utf8mb4 Migration

### Step 1: Confirming Migration Targets

When I checked the database status, the situation was complex:

```sql
SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_COLLATION
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql');
```

Result:
- utf8mb3 tables: about 100
- utf8mb4_general_ci tables: about 21 (already partially migrated)
- Total: 121 tables

Some tables were already migrated to utf8mb4_general_ci. Probably partially worked on in the past.

Since I couldn't manually change so many tables one by one, I generated an automatic script.

I had to decide which collation to choose. Whether to keep using the existing `utf8mb4_general_ci` or use MySQL 8.0's default value `utf8mb4_0900_ai_ci`.

**Reasons for choosing `utf8mb4_0900_ai_ci`:**
- MySQL 8.0's default collation
- More accurate Unicode sorting algorithm (based on UCA 9.0.0)
- Matches application level's default collation, no additional conversion needed
- Future compatibility guaranteed

```sql
SELECT CONCAT(
    'ALTER TABLE ', TABLE_SCHEMA, '.', TABLE_NAME, ' ',
    'CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;'
) AS alter_statement
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_COLLATION LIKE 'utf8mb3%'
  AND TABLE_SCHEMA NOT IN ('information_schema', 'mysql');
```

### Step 2: First Obstacle - Index Key Length Limit

It was time to execute the ALTER statements generated by the script. I started converting from the first table, but an unexpected problem occurred.

```sql
ALTER TABLE user_assignment CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

Error:
```
[42000][1071] Specified key was too long; max key length is 1000 bytes
```

An unexpected error occurred. The message said "index key is too long". It was fine with utf8mb3, but the moment I converted to utf8mb4, it hit the constraint. I identified the cause.

```sql
-- The problematic index
INDEX idx_user_assignment_1 (userID)
-- userID VARCHAR(255)
```

Byte calculation based on character set is important here:

```
utf8mb3: VARCHAR(255) × 3 bytes = 765 bytes  ✅ (less than 1000 bytes)
utf8mb4: VARCHAR(255) × 4 bytes = 1020 bytes ❌ (exceeds 1000 bytes)
```

When using utf8mb3, it was 765 bytes, which fit within MyISAM's 1000 byte limit, so there was no problem. But the moment I changed to utf8mb4, it became 1020 bytes and exceeded the limit.

> "utf8mb4: A UTF-8 encoding of the Unicode character set using one to four bytes per character."
>
> — [MySQL 8.0 Reference Manual, Section 12.9.1 The utf8mb4 Character Set](https://dev.mysql.com/doc/refman/8.0/en/charset-unicode-utf8mb4.html)

### Step 3: Attempting ROW_FORMAT Change

I knew that using ROW_FORMAT=DYNAMIC in InnoDB could increase the index key length to 3072 bytes. I tried this method.

```sql
ALTER TABLE user_assignment ROW_FORMAT=DYNAMIC;
ALTER TABLE user_assignment CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

However, the same error still occurred. Even though I changed ROW_FORMAT, the constraint was not resolved. There seemed to be another factor.

---

## Hidden Problem Discovery: MyISAM Storage Engine

To find the root cause of the problem, I directly checked the table structure.

```sql
SHOW CREATE TABLE user_assignment;
```

Result:
```sql
CREATE TABLE user_assignment (
    conversationID varchar(255) null,
    createdAt varchar(255) null,
    tradeType varchar(255) null,
    userID varchar(255) null
) ENGINE=MyISAM
  COLLATE=utf8mb3_general_ci
  ROW_FORMAT=DYNAMIC;
```

I discovered an unexpected fact. This table was using the MyISAM engine, not InnoDB. I mistook it for InnoDB because ROW_FORMAT was set to DYNAMIC, but it was actually a MyISAM table.

### MyISAM vs InnoDB Index Limits

| Engine | ROW_FORMAT | Maximum Index Key Length |
|------|-----------|-------------------|
| InnoDB | COMPACT | 767 bytes |
| InnoDB | DYNAMIC | 3072 bytes |
| MyISAM | All formats | 1000 bytes (fixed) |

This is a limitation specified in MySQL official documentation:

> "The index key prefix length limit is 3072 bytes for InnoDB tables that use DYNAMIC or COMPRESSED row format. The index key prefix length limit is 767 bytes for InnoDB tables that use the REDUNDANT or COMPACT row format."
>
> — [MySQL 8.0 Reference Manual, Section 17.22 InnoDB Limits](https://dev.mysql.com/doc/refman/8.0/en/innodb-limits.html)

For MyISAM, the 1000 byte limit is fixed. MyISAM cannot exceed this limit regardless of ROW_FORMAT. This was why changing ROW_FORMAT didn't solve the problem.

### Solution: MyISAM → InnoDB Conversion

Now that I identified the cause of the problem, the solution was clear. Convert MyISAM to InnoDB.

```sql
-- Process engine conversion and character set change at once
ALTER TABLE user_assignment
CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
ENGINE=InnoDB;
```

The conversion succeeded. Now I could utilize InnoDB's 3072 byte index key length limit.

### Batch Conversion Script for MyISAM Tables

```sql
-- Find MyISAM + utf8mb3 tables
SELECT CONCAT(
    'ALTER TABLE ', TABLE_SCHEMA, '.', TABLE_NAME,
    ' CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci, ',
    'ENGINE=InnoDB;'
) AS alter_statement
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
  AND TABLE_COLLATION LIKE 'utf8mb3%'
  AND ENGINE != 'InnoDB'
ORDER BY TABLE_SCHEMA, TABLE_NAME;
```

Through this script, I converted 109 MyISAM tables to InnoDB.

---

## Additional Benefits of MyISAM → InnoDB Conversion

Beyond simply solving the utf8mb4 migration problem, I also gained significant improvements in performance and stability.

### MyISAM vs InnoDB: Why Did We Need to Convert?

MyISAM has its own advantages. So why did we convert to InnoDB?

### MyISAM Advantages

MyISAM shows better performance than InnoDB in certain situations:

**1. Fast Read Performance**

In read-only or read-mostly environments, MyISAM is very fast. Because there's no transaction overhead.

**2. COUNT(*) Query Optimization**

```sql
SELECT COUNT(*) FROM large_table;
```

Because MyISAM stores the total row count of the table in metadata, COUNT(*) queries without WHERE conditions execute almost instantly.

**3. Small Disk Space**

Disk usage is low because there's no need for additional space for transaction logs or MVCC (Multi-Version Concurrency Control).

**4. Simple Structure**

The structure is simple without complex transaction mechanisms, making management easier in certain situations.

### MyISAM Limitations

However, in modern web application environments, MyISAM's disadvantages are fatal.

> "MySQL uses table-level locking for MyISAM, MEMORY, and MERGE tables, permitting only one session to update those tables at a time."
>
> — [MySQL 8.0 Reference Manual, Section 10.11.1 Internal Locking Methods](https://dev.mysql.com/doc/refman/8.0/en/internal-locking.html)

**1. Table Level Lock**

MyISAM locks the entire table, resulting in very low concurrency.

```
User A: INSERTing...  (entire table locked)
User B: SELECT waiting...
User C: UPDATE waiting...
```

**2. No Transaction Support**

```sql
BEGIN;
INSERT INTO orders VALUES (...);
-- Error occurs
ROLLBACK;  -- Doesn't work
```

MyISAM is a nontransactional storage engine, making it difficult to guarantee data consistency without transaction support.

**3. Vulnerable to Crash Recovery**

```
Server abnormal termination → Table damage possible → Manual recovery needed
```

### InnoDB Advantages

MySQL official documentation clearly explains InnoDB's advantages:

> "InnoDB implements standard row-level locking where there are two types of locks, shared (S) locks and exclusive (X) locks."
>
> — [MySQL 8.0 Reference Manual, Section 17.7.1 InnoDB Locking](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html)

**1. Row Level Lock (Improved Concurrency)**

```
User A: Modifying row 1
User B: Can modify row 2 (concurrent processing)
User C: Can modify row 3 (concurrent processing)
```

**2. ACID Transactions**

> "Isolation is the I in the acronym ACID; the isolation level is the setting that fine-tunes the balance between performance and reliability, consistency, and reproducibility of results."
>
> — [MySQL 8.0 Reference Manual, Section 17.7.2.1 Transaction Isolation Levels](https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html)

```sql
BEGIN;
INSERT INTO orders VALUES (...);
INSERT INTO payments VALUES (...);
-- Error occurs
ROLLBACK;  -- Rolls back everything
```

**3. Automatic Crash Recovery**

```
Server abnormal termination → Automatic recovery → Data consistency guaranteed
```

In particular, the `INSERT INTO user_view_log` that took 225ms in the previously discovered procedure performance problem was likely also caused by MyISAM's table lock adding additional overhead, not just collation conversion.

### Why We Chose InnoDB for Our Service

Our service has the following characteristics:

- **High concurrency**: Environment where multiple users read and write data simultaneously
- **Frequent INSERT/UPDATE**: Continuous write operations such as user activity logs, visit records
- **Data consistency important**: Data such as payments, user information that requires consistency
- **Transaction needed**: Atomic operations across multiple tables

In such an environment, InnoDB's advantages (Row-level Lock, transactions, ACID) were far more important than MyISAM's advantages (fast reading, COUNT(*) optimization). Especially since we had to change tables anyway for utf8mb4 migration, modernizing the storage engine at this opportunity was a rational choice.

---

## Final Performance Improvement Results

### Procedure Execution Time

| Stage | Execution Time | Improvement Rate |
|------|-----------|--------|
| Before modification (utf8mb3 + varchar parameter) | 457ms | - |
| Temporary solution (utf8mb3 local variable) | 42ms | About 11x improvement |
| Final (utf8mb4 + InnoDB) | 42ms | About 11x improvement |

### Query Execution Time Changes

**Before modification:**
```
INSERT user_view_log:      225ms
INSERT frequent_visits:    202ms
SELECT (main query):       209ms
Total:                     636ms
```

**After modification:**
```
SELECT title:             0.55ms
INSERT user_view_log:     4.25ms
INSERT frequent_visits:   0.71ms
SELECT (main query):      1.40ms
Total:                     6.91ms
```

### Overall Database Improvements

- 121 tables migrated to utf8mb4
- 109 MyISAM tables converted to InnoDB
- Collation warnings removed from all procedures
- Prepared for future MySQL version upgrades

---

## Additional Problem Discovered: Collation Mismatch Recurrence

But when I ran the application after migration, a new error occurred:

```
java.sql.SQLException: Illegal mix of collations (utf8mb4_0900_ai_ci,IMPLICIT)
and (utf8mb4_general_ci,IMPLICIT) for operation '='
```

When I checked the problem, there were some tables that were already set to `utf8mb4_general_ci`.

Eventually, a conflict occurred between table collation and MySQL 8.0's default collation.

### Cause

- Tables: `utf8mb4_general_ci`
- Connection/Session default: `utf8mb4_0900_ai_ci` (MySQL 8.0 default)
- Application level parameters: `utf8mb4_0900_ai_ci`

Eventually, the same problem recurred in a different form.

### Final Solution

I unified all tables to MySQL 8.0's default value `utf8mb4_0900_ai_ci`.

```sql
-- Reconvert all tables to utf8mb4_0900_ai_ci
ALTER TABLE table_name
CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

**Reasons for choosing `utf8mb4_0900_ai_ci`:**
1. MySQL 8.0's default collation
2. More accurate Unicode sorting algorithm (based on UCA 9.0.0)
3. Matches application level default
4. No additional collation conversion needed
5. Compatibility guaranteed for future MySQL version upgrades

What I learned from this lesson was that **simply converting to utf8mb4 is not enough, you must also match the exact collation**.

---

## Lessons Learned

### 1. Collation is a Silent Performance Killer

The collation of procedure parameters or session variables is not visible. In MySQL 8.0, the default is `utf8mb4_0900_ai_ci`, but legacy tables often use `utf8mb3_general_ci`.

If you get this warning in EXPLAIN, you must check the collation:
```
Cannot use ref access on index due to type or collation conversion
```

This warning is a clear signal that indexes cannot be used.

### 2. "Works" ≠ "Optimized"

When executing individual queries directly, they work quickly, but inside procedures, due to parameter binding, they can show completely different performance.

You must test under conditions similar to the actual environment. Especially for procedures, detailed analysis using SET profiling is essential.

### 3. MyISAM is Now a Relic of the Past

Unless there's a special reason to use MyISAM, using InnoDB is overwhelmingly advantageous:

- Improved concurrency with Row-level locks
- Data consistency guaranteed with transaction support
- Automatic crash recovery
- Larger index key support (3072 bytes)
- Foreign Key support

Especially in environments with many concurrent connections like web services, MyISAM's table locks can become a serious bottleneck.

### 4. Importance of Phased Migration

Rather than trying to find the perfect solution from the start, it's effective to approach in stages:

1. Quick temporary solution (matching collation with local variables)
2. Identifying root cause (utf8mb3 deprecated, MyISAM limitations)
3. Overall system improvement (utf8mb4 migration, InnoDB conversion)

This phased approach was safer and more effective. Especially for operating services, verifying step by step is better than changing everything at once to reduce risk.

### 5. EXPLAIN Doesn't Lie

When performance problems occur, you must check the execution plan with EXPLAIN. Especially pay attention to:

- `type: ALL` → Full table scan warning
- Warning messages → Don't ignore, identify exact cause
- `rows` value → If very different from expected, a signal of problems

EXPLAIN's warning messages are the clearest clues to performance problems.

### 6. Hidden Technical Debt in Legacy Systems

What I discovered through this work wasn't just the procedure performance problem.

- Use of deprecated utf8mb3
- Use of legacy storage engine MyISAM
- Inconsistent character set and collation

When you try to solve one surface problem, you discover the technical debt stacked underneath. I was able to use this as an opportunity to improve the entire system.

---

## Conclusion

This work, which started with the simple question "Why did it suddenly get slow?", led much deeper than I thought. I discovered collation mismatches, encountered MyISAM's hidden constraints, and eventually it became a journey to modernize the entire database.

I improved a procedure that took 457ms to 42ms (about 11x), migrated 121 tables to utf8mb4, and converted 109 MyISAM tables to InnoDB. While the numbers show great results, what was actually more meaningful were the things I learned during this process.

At first, I only focused on quick solutions. But by digging into the root cause, I was able to turn it into an opportunity to upgrade the service infrastructure beyond simple bug fixes.

Now our service:

- Fully supports emojis and special characters (utf8mb4)
- Provides better concurrency (InnoDB Row-level Lock)
- Guarantees data consistency (transactions)
- Can handle future MySQL version upgrades without problems (utf8mb3 deprecated resolved)

Trying to solve one performance problem, I saw the technical debts that had been piling up one by one. Digging into the root cause rather than settling for surface solutions turned out to be a good choice in the end.

I hope this article helps those who are worried about similar problems. Thank you for reading this long article.

---

## References

### MySQL Official Documentation

**Character Sets and Collations:**
- [MySQL 8.0 Reference Manual - How MySQL Uses Indexes (Section 10.3.1)](https://dev.mysql.com/doc/refman/8.0/en/mysql-indexes.html)
- [MySQL 8.0 Reference Manual - Character Sets and Collations (Section 10.2)](https://dev.mysql.com/doc/refman/8.0/en/charset-mysql.html)
- [MySQL 8.0 Reference Manual - The utf8mb4 Character Set (Section 12.9.1)](https://dev.mysql.com/doc/refman/8.0/en/charset-unicode-utf8mb4.html)
- [MySQL 8.0 Reference Manual - The utf8mb3 Character Set (Section 12.9.2)](https://dev.mysql.com/doc/refman/8.0/en/charset-unicode-utf8mb3.html)
- [MySQL 8.0 Blog - Collations: Migrating from older collations](https://dev.mysql.com/blog-archive/mysql-8-0-collations-migrating-from-older-collations/)

**InnoDB and MyISAM:**
- [MySQL 8.0 Reference Manual - InnoDB Limits (Section 17.22)](https://dev.mysql.com/doc/refman/8.0/en/innodb-limits.html)
- [MySQL 8.0 Reference Manual - InnoDB Locking (Section 17.7.1)](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html)
- [MySQL 8.0 Reference Manual - Transaction Isolation Levels (Section 17.7.2.1)](https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html)
- [MySQL 8.0 Reference Manual - Internal Locking Methods (Section 10.11.1)](https://dev.mysql.com/doc/refman/8.0/en/internal-locking.html)

### MySQL Bug Reports
- [Bug #83856: Index ref not used for multi-column IN - type or collation conversion warning](https://bugs.mysql.com/bug.php?id=83856)
- [Bug #83857: Index not used for the implicit integer to string conversion](https://bugs.mysql.com/bug.php?id=83857)

---

## Disclaimer

This article was written based on actual experience and with reference to MySQL official documentation. However, some content may contain inaccurate information. My information may not be accurate, so before applying to actual production environments, please be sure to check the official documentation and conduct sufficient testing...!
