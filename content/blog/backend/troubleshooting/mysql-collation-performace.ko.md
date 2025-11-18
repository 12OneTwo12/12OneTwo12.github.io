---
title: "MySQL 컬럼의 타입을 bigint에서 varchar로 변경했더니 8배나 느려졌어요...! : 프로시저 성능 저하 트러블 슈팅"
tags:
  - "mysql"
  - "procedure"
  - "collation"
  - "innodb"
  - "myisam"
date: '2025-10-20'
---

## 들어가며

안녕하세요.

프롭테크 플랫폼에서 백엔드 개발자로 근무 중인 3년차 백엔드 개발자 정정일입니다.

오늘은 저희 서비스에서 발생한 흥미로운 성능 이슈와 해결 과정을 공유하려고 합니다. MySQL 프로시저 하나가 갑자기 8배나 느려진 문제를 해결하면서,  DB에 존재하는 다양한 문제들을 직면하게 됐는데요. 읽고 계신 분들도 문제를 따라가며 원인이 뭔지 추측해보면 재미있지 않을 까 싶습니다.

---

## 문제 발견: 갑자기 느려진 프로시저

회사에서 레거시 모놀리스 시스템을 MSA로 전환하는 프로젝트를 진행하고 있었습니다. 그 과정에서 `item_id` 컬럼의 데이터 타입을 `bigint`에서 `varchar(30)`으로 변경하기로 결정했습니다. 서비스 간 데이터 일관성을 맞추고, 향후 다른 식별 체계로의 확장성을 고려한 의사결정이었습니다.

테스트를 위해 개발 서버부터 마이그레이션을 완료하고 개발 환경에서 테스트를 진행하던 중, 특정 프로시저의 성능이 눈에 띄게 저하된 것을 발견했습니다.

```
개발 환경 (varchar 파라미터): 457-465ms
운영 환경 (bigint 파라미터): 56-70ms
```

약 8배의 성능 차이였습니다. 같은 하드웨어 스펙, 같은 MySQL 버전(8.0.37), 비슷한 데이터 갯수임에도 불구하고 말입니다. 측정 오류를 의심하고 여러 차례 재실행해봤지만 결과는 일관되게 동일했습니다.

문제가 된 프로시저는 레거시 서비스에서 사용하는 프로시저로 상세 정보를 조회하는 `getItemDetailInfo`였습니다.

> 글에 작성된 프로시저, 테이블, 파라미터, 컬럼명 등은 전부 예시입니다.

```sql
CREATE PROCEDURE getItemDetailInfo(
    IN P_ITEM_ID varchar(30),  -- bigint에서 varchar(30)으로 변경
    IN P_AREA_SIZE double,
    IN P_PREFIX varchar(5),
    IN P_USER_NO int,
    IN P_ITEM_TYPE varchar(10)
)
BEGIN
    -- 사용자 조회 기록 INSERT
    -- 빈번한 방문 기록 INSERT
    -- 아이템 상세 정보 SELECT (서브쿼리 포함)
END
```

단순히 파라미터 타입만 바꿨을 뿐인데, 왜 이렇게 느려진 걸까요?

---

## 첫 번째 가설: 인덱스 문제

가장 먼저 의심한 것은 인덱스였습니다. 데이터 타입을 VARCHAR로 변경하면서 인덱스가 제대로 작동하지 않는 것은 아닐까 하는 생각이 들었습니다.

```sql
-- 관련 테이블들의 인덱스 확인
SELECT COLUMN_NAME, COLUMN_KEY, DATA_TYPE, COLLATION_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('item_badge', 'user_history', 'item_special')
  AND COLUMN_NAME = 'item_id';
```

결과:
```
item_badge.item_id     → COLUMN_KEY = 'MUL', varchar(30)
user_history.item_id   → COLUMN_KEY = 'MUL', varchar(30)
item_special.item_id   → COLUMN_KEY = 'MUL', varchar(30)
```

의외의 결과였습니다. 인덱스는 모두 정상적으로 존재했고, 타입도 이미 `varchar(30)`으로 통일되어 있었습니다. 인덱스 누락이나 타입 불일치는 문제의 원인이 아니었습니다. 첫 번째 가설은 빗나갔습니다.

---

## 두 번째 가설: 서브쿼리 성능 문제

인덱스가 아니라면 무엇이 문제일까요? 프로시저 코드를 다시 분석해봤습니다. 메인 SELECT 쿼리에 3개의 서브쿼리가 포함되어 있었습니다.

```sql
SELECT i.*, ia.*,
    -- 서브쿼리 1: 뱃지 정보
    IFNULL((SELECT badge FROM item_badge WHERE item_id = i.item_id), 0) AS badge_info,
    -- 서브쿼리 2: 이벤트 개수
    (SELECT COUNT(*) FROM user_history WHERE item_id = i.item_id) AS event_count,
    -- 서브쿼리 3: 특별 항목 여부
    if(exists(select 1 from item_special where item_id = i.item_id) = 1, '특별', category) as category
FROM item_info AS i
INNER JOIN item_area AS ia ON i.item_id = ia.item_id
WHERE i.item_id = P_ITEM_ID;
```

서브쿼리가 반복 실행되면서 N+1 문제를 일으키는 것은 아닐까 하는 가설을 세웠습니다. 이를 검증하기 위해 서브쿼리를 LEFT JOIN으로 변경해봤습니다.

```sql
SELECT i.*, ia.*,
    IFNULL(ib.badge, 0) AS badge_info,
    IFNULL(uh.event_count, 0) AS event_count,
    IF(is.item_id IS NOT NULL, '특별', i.category) AS category
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

결과: 477ms (오히려 20ms 더 느려짐)

예상과 다른 결과였습니다. 오히려 더 느려진 것입니다. `user_history` 테이블 전체를 GROUP BY 하면서 역효과가 발생한 것이었습니다. 개별 쿼리를 직접 실행해본 결과, 서브쿼리들은 각각 1ms도 걸리지 않았습니다. 서브쿼리는 성능 저하의 원인이 아니었습니다.

---

### 더 이상한 점: 개별 쿼리는 빠르다

더 당황스러운 것은, 프로시저 내부의 쿼리를 직접 실행해보면 매우 빠르다는 점이었습니다.

```sql
-- 프로시저 내부 쿼리를 직접 실행
SELECT * FROM item_info WHERE item_id = '1168010609';  -- 1.8ms
SELECT * FROM user_history WHERE item_id = '1168010609';  -- 0.7ms
SELECT * FROM item_badge WHERE item_id = '1168010609';  -- 1ms 미만
```

모든 개별 쿼리는 1~2ms 내외로 실행되었습니다. 그런데 같은 쿼리를 프로시저에 넣으면 457ms가 걸립니다.

```
개별 쿼리:  1~2ms
프로시저:   457ms
```

같은 쿼리, 같은 데이터베이스, 같은 파라미터인데 200배 이상 차이가 납니다. 이게 대체 왜 그런 걸까요?

---

## 세 번째 시도: EXPLAIN으로 실행 계획 분석

이쯤 되니 정말 답답했습니다. 인덱스도 있고, 서브쿼리도 문제가 없고 개별 쿼리로 실행하면 빠른데 프로시저로만 실행하면 느려지다니 도대체 대체 뭐가 문제일까요?

뭔가 더 근본적인 걸 놓치고 있는 게 분명했습니다. 그래서 EXPLAIN으로 실행 계획을 분석해보기로 했어요.

```sql
-- 변수 사용 시 (프로시저와 유사한 상황)
SET @v_item_id = '1168010609';
EXPLAIN SELECT * FROM item_info WHERE item_id = @v_item_id;
```

결과:
```
type: ALL (풀 테이블 스캔)
rows: 45,453
Extra: Using where

경고: Cannot use ref access on index 'PRIMARY' due to type or collation conversion on field 'item_id'
```

중요한 단서를 발견했습니다. `type: ALL`은 풀 테이블 스캔을 의미했습니다. 45,453개의 행을 전부 읽고 있었던 것입니다. 그리고 경고 메시지가 있었습니다. "type or collation conversion 때문에 인덱스를 사용할 수 없다"는 내용이었습니다.

Collation... 이 키워드가 눈에 띄었습니다. 비교를 위해 직접 값을 사용하는 경우도 테스트해봤습니다.

```sql
EXPLAIN SELECT * FROM item_info WHERE item_id = '1168010609';
```

결과:
```
type: const (인덱스 사용)
rows: 1
```

명확한 차이가 있었습니다. 직접 값을 사용하면 `type: const`로 인덱스를 완벽하게 사용하며, 단 1개의 행만 읽습니다. 하지만 변수를 사용하면 풀 테이블 스캔을 하는 것이었습니다.

드디어 실마리를 잡았습니다. 경고 메시지의 `type or collation conversion`이 핵심 키워드였습니다.

---

## 근본 원인 발견: Collation 불일치

Collation이라는 단어가 계속 머릿속을 맴돌았습니다. "분명 MySQL에서 문자열 비교 규칙 같은 거였는데..." 경고 메시지를 단서로 테이블 컬럼의 collation을 확인해봤습니다.

```sql
SHOW FULL COLUMNS FROM item_info WHERE Field = 'item_id';
SHOW FULL COLUMNS FROM item_area WHERE Field = 'item_id';
```

결과:
```
item_id, varchar(30), utf8mb3_general_ci
```

원인을 찾았습니다. 테이블 컬럼은 `utf8mb3_general_ci`를 사용하고 있었습니다. 반면 MySQL 8.0에서는 기본 문자셋이 `utf8mb4`이고, 기본 collation은 `utf8mb4_0900_ai_ci`입니다.

> "From MySQL 8.0, utf8mb4 is the default character set, and utf8mb4_0900_ai_ci is the default collation."
>
> — [MySQL 8.0 Reference Manual, Section 10.2 Character Sets and Collations in MySQL](https://dev.mysql.com/doc/refman/8.0/en/charset-mysql.html)

문제는 명확했습니다. utf8mb3와 utf8mb4, 두 개의 서로 다른 collation을 가진 값을 비교하면서 MySQL이 내부적으로 변환 작업을 수행하고 있었던 것입니다. 그리고 이 변환 과정에서 인덱스를 사용할 수 없게 되는 것이었습니다.

### Collation 불일치가 일으키는 문제

MySQL은 collation이 다른 값을 비교할 때, 내부적으로 타입 변환(collation conversion)을 수행합니다. MySQL 공식 문서에 따르면:

> "Comparison of dissimilar columns (comparing a string column to a temporal or numeric column, for example) may prevent use of indexes if values cannot be compared directly without conversion."
>
> — [MySQL 8.0 Reference Manual, Section 10.3.1 How MySQL Uses Indexes](https://dev.mysql.com/doc/refman/8.0/en/mysql-indexes.html)

이 과정에서 다음과 같은 문제가 발생합니다:

1. **인덱스를 사용할 수 없게 됨**: Collation이 다른 값을 직접 비교할 수 없어 변환이 필요하므로 인덱스 사용 불가
2. **전체 테이블 스캔 수행**: 45,453개 행을 모두 읽어야 함
3. **각 행마다 collation 변환 수행**: 매 행마다 문자열 변환 오버헤드 발생
4. **결과**: 수백 밀리초의 성능 저하

이 문제는 MySQL 버그 트래커에 여러 건 보고되어 있으며(Bug #83856, #83857 등), MySQL 공식 문서에도 명시된 제약사항입니다.

PREPARE STATEMENT로 실제 차이를 측정해봤습니다.

```sql
SET profiling = 1;

-- bigint로 바인딩 (collation 변환 발생)
SET @item_id = 1168010609;
PREPARE stmt FROM 'SELECT * FROM item_info WHERE item_id = ?';
EXECUTE stmt USING @item_id;

-- varchar로 바인딩 (collation 일치)
SET @item_id = '1168010609';
PREPARE stmt FROM 'SELECT * FROM item_info WHERE item_id = ?';
EXECUTE stmt USING @item_id;

SHOW PROFILES;
```

결과:
```
bigint 바인딩:  202ms
varchar 바인딩: 0.6ms
```

335배 차이가 발생했습니다. 이제 프로시저가 느린 이유를 정확히 알게 되었습니다.

---

## 프로파일링으로 병목 지점 정확히 찾기

프로시저 내부에서 정확히 어디가 느린지 확인하기 위해 프로파일링을 실행했습니다.

```sql
SET profiling = 1;
CALL getItemDetailInfo('1168010609', 34, 'item', 219786, 'type_a');
SHOW PROFILES;
```

결과:

| Query_ID | Duration | Query |
|----------|----------|-------|
| 1179 | 0.225648초 (225ms) | INSERT INTO user_view_log ... SELECT |
| 1180 | 0.202043초 (202ms) | INSERT INTO frequent_visits ... SELECT |
| 1181 | 0.209143초 (209ms) | SELECT (메인 쿼리) |

총 실행 시간: 약 636ms

그런데 흥미로운 점이 있었습니다. 동일한 쿼리를 개별적으로 실행하면:
- INSERT user_view_log: 4.5ms
- INSERT frequent_visits: 0.7ms
- SELECT: 1.8ms

개별 쿼리를 직접 실행하면 매우 빠른 반면, 프로시저로 실행하면 636ms가 걸렸습니다. 이 차이는 프로시저 파라미터를 사용할 때 collation 변환이 발생하기 때문이었습니다.

---

## 임시 해결: 지역 변수로 Collation 맞추기

원인을 알았으니 이제 해결책을 찾아야 했습니다. 하지만 데이터베이스 전체를 utf8mb4로 바꾸는 건 시간이 걸리고 리스크도 있었어요. 일단 빠르게 프로시저부터 고쳐보기로 했습니다.

생각해낸 방법은 간단했습니다. 프로시저 내부에서 지역 변수를 만들고, 그 변수에 명시적으로 `utf8mb3` collation을 지정하는 거였어요.

```sql
CREATE PROCEDURE getItemDetailInfo(
    IN P_ITEM_ID varchar(30),
    IN P_AREA_SIZE double,
    IN P_PREFIX varchar(5),
    IN P_USER_NO int,
    IN P_ITEM_TYPE varchar(10)
)
BEGIN
    -- 지역 변수에 utf8mb3 collation 명시
    DECLARE v_item_id VARCHAR(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci;
    DECLARE v_item_title VARCHAR(255);

    -- 파라미터 값을 지역 변수로 복사
    SET v_item_id = P_ITEM_ID;

    IF P_USER_NO IS NOT NULL THEN
        -- v_item_id 사용 (P_ITEM_ID 대신)
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

    -- 메인 SELECT에서도 v_item_id 사용
    SELECT i.*, ia.*, ...
    FROM item_info AS i
    INNER JOIN item_area AS ia ON i.item_id = ia.item_id
        AND ia.area_size = P_AREA_SIZE
    WHERE i.item_id = v_item_id;  -- P_ITEM_ID 대신 v_item_id
END
```

결과: 457ms → 42ms (약 11배 개선)

상당한 개선이었습니다. 프로파일링 결과를 보니 각 쿼리가 정상적인 속도로 실행되고 있었습니다.

```
Query 1568: SELECT title → 0.55ms
Query 1569: INSERT user_view_log → 4.25ms
Query 1570: INSERT frequent_visits → 0.71ms
Query 1571: SELECT (메인 쿼리) → 1.40ms
```

당장의 성능 문제는 해결했지만, 여전히 찜찜한 부분이 남아있었습니다. 경고 메시지가 계속 출력되고 있었기 때문입니다.

참고로 실제 프로시저를 실행해보면 다음과 같이 나타납니다:
```
1 row retrieved starting from 1 in 404 ms (execution: 42 ms, fetching: 362 ms)
```
총 404ms 중 실제 쿼리 실행 시간은 42ms이고, 나머지 362ms는 데이터 전송(fetching) 시간입니다.

```
[HY000][3778] 'utf8mb3_general_ci' is a collation of the deprecated character set UTF8MB3.
```

utf8mb3가 deprecated 되었다는 경고 메시지였습니다. MySQL 공식 문서에서 utf8mb3는 deprecated 상태입니다. 이 방법은 어디까지나 임시방편이었습니다. 근본적으로 해결하려면 데이터베이스 전체를 utf8mb4로 마이그레이션해야 했습니다.

> "The utf8mb3 character set is deprecated."
>
> — [MySQL 8.0 Reference Manual, Section 10.9.2 The utf8mb3 Character Set](https://dev.mysql.com/doc/refman/8.0/en/charset-unicode-utf8mb3.html)

---

## 근본 해결 방향: 전체 데이터베이스 utf8mb4 마이그레이션

### 1단계: 마이그레이션 대상 확인

데이터베이스 상태를 확인해보니 상황이 복잡했습니다:

```sql
SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_COLLATION
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql');
```

결과:
- utf8mb3 테이블: 약 100개
- utf8mb4_general_ci 테이블: 약 21개 (이미 일부 마이그레이션됨)
- 합계: 121개 테이블

일부 테이블은 이미 utf8mb4_general_ci로 마이그레이션되어 있었습니다. 아마도 과거에 부분적으로 작업했던 것 같았습니다.

이렇게 많은 테이블을 일일이 변경할 수는 없으니, 자동 스크립트를 생성했습니다.

어떤 collation을 선택할지 고민했습니다. 기존에 사용하던 `utf8mb4_general_ci`를 그대로 쓸지, MySQL 8.0 기본값인 `utf8mb4_0900_ai_ci`를 사용할지 결정해야 했습니다.

**`utf8mb4_0900_ai_ci`를 선택한 이유:**
- MySQL 8.0의 기본 collation
- 더 정확한 유니코드 정렬 알고리즘 (UCA 9.0.0 기준)
- 애플리케이션 레벨의 기본 collation과 일치하여 추가 변환 불필요
- 향후 호환성 보장

```sql
SELECT CONCAT(
    'ALTER TABLE ', TABLE_SCHEMA, '.', TABLE_NAME, ' ',
    'CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;'
) AS alter_statement
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_COLLATION LIKE 'utf8mb3%'
  AND TABLE_SCHEMA NOT IN ('information_schema', 'mysql');
```

### 2단계: 첫 번째 장애물 - 인덱스 키 길이 제한

스크립트로 생성한 ALTER 문을 실행할 차례였습니다. 첫 번째 테이블부터 변환을 시작했는데, 예상치 못한 문제가 발생했습니다.

```sql
ALTER TABLE user_assignment CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

에러:
```
[42000][1071] Specified key was too long; max key length is 1000 bytes
```

예상치 못한 에러가 발생했습니다. "인덱스 키가 너무 길다"는 메시지였습니다. utf8mb3에서는 문제없었는데, utf8mb4로 변환하는 순간 제약에 걸린 것입니다. 원인을 파악했습니다.

```sql
-- 문제가 된 인덱스
INDEX idx_user_assignment_1 (userID)
-- userID VARCHAR(255)
```

여기서 문자셋에 따른 바이트 계산이 중요합니다:

```
utf8mb3: VARCHAR(255) × 3 bytes = 765 bytes  ✅ (1000 bytes 미만)
utf8mb4: VARCHAR(255) × 4 bytes = 1020 bytes ❌ (1000 bytes 초과)
```

utf8mb3를 사용할 때는 765바이트로 MyISAM의 1000바이트 제한 안에 들어가서 문제가 없었습니다. 하지만 utf8mb4로 변경하는 순간 1020바이트가 되어 제한을 초과하게 된 것입니다.

> "utf8mb4: A UTF-8 encoding of the Unicode character set using one to four bytes per character."
>
> — [MySQL 8.0 Reference Manual, Section 12.9.1 The utf8mb4 Character Set](https://dev.mysql.com/doc/refman/8.0/en/charset-unicode-utf8mb4.html)

### 3단계: ROW_FORMAT 변경 시도

InnoDB에서 ROW_FORMAT=DYNAMIC을 사용하면 인덱스 키 길이를 3072바이트까지 늘릴 수 있다는 것을 알고 있었습니다. 이 방법을 시도해봤습니다.

```sql
ALTER TABLE user_assignment ROW_FORMAT=DYNAMIC;
ALTER TABLE user_assignment CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

그러나 여전히 같은 에러가 발생했습니다. ROW_FORMAT을 변경했음에도 제약이 해소되지 않았습니다. 뭔가 다른 요인이 있는 것 같았습니다.

---

## 숨겨진 문제 발견: MyISAM 스토리지 엔진

문제의 근본 원인을 찾기 위해 테이블 구조를 직접 확인해봤습니다.

```sql
SHOW CREATE TABLE user_assignment;
```

결과:
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

의외의 사실을 발견했습니다. 이 테이블은 InnoDB가 아니라 MyISAM 엔진을 사용하고 있었습니다. ROW_FORMAT이 DYNAMIC으로 설정되어 있어서 InnoDB로 착각했지만, 실제로는 MyISAM 테이블이었던 것입니다.

### MyISAM vs InnoDB 인덱스 제한

| 엔진 | ROW_FORMAT | 최대 인덱스 키 길이 |
|------|-----------|-------------------|
| InnoDB | COMPACT | 767 bytes |
| InnoDB | DYNAMIC | 3072 bytes |
| MyISAM | 모든 포맷 | 1000 bytes (고정) |

MySQL 공식 문서에 명시된 제한 사항입니다:

> "The index key prefix length limit is 3072 bytes for InnoDB tables that use DYNAMIC or COMPRESSED row format. The index key prefix length limit is 767 bytes for InnoDB tables that use the REDUNDANT or COMPACT row format."
>
> — [MySQL 8.0 Reference Manual, Section 17.22 InnoDB Limits](https://dev.mysql.com/doc/refman/8.0/en/innodb-limits.html)

MyISAM의 경우 1000바이트 제한이 고정되어 있습니다. MyISAM은 ROW_FORMAT과 관계없이 이 제한을 초과할 수 없습니다. ROW_FORMAT을 변경해도 문제가 해결되지 않았던 이유가 바로 이것이었습니다.

### 해결책: MyISAM → InnoDB 변환

문제의 원인을 파악했으니 해결책은 명확했습니다. MyISAM을 InnoDB로 변환하면 됩니다.

```sql
-- 엔진 변환과 문자셋 변경을 한 번에 처리
ALTER TABLE user_assignment
CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
ENGINE=InnoDB;
```

변환에 성공했습니다. 이제 InnoDB의 3072바이트 인덱스 키 길이 제한을 활용할 수 있게 되었습니다.

### MyISAM 테이블 일괄 변환 스크립트

```sql
-- MyISAM + utf8mb3 테이블 찾기
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

이 스크립트를 통해 109개의 MyISAM 테이블을 InnoDB로 전환했습니다.

---

## MyISAM → InnoDB 전환의 추가 이점

단순히 utf8mb4 마이그레이션 문제를 해결한 것을 넘어서, 성능과 안정성 측면에서도 큰 개선을 얻었습니다.

### MyISAM vs InnoDB: 왜 전환해야 했을까?

MyISAM도 나름의 장점이 있습니다. 그렇다면 왜 InnoDB로 전환한 것일까요?

### MyISAM의 장점

MyISAM은 특정 상황에서 InnoDB보다 나은 성능을 보입니다:

**1. 빠른 읽기 성능**

읽기 전용(read-only) 또는 읽기 위주(read-mostly) 환경에서 MyISAM은 매우 빠릅니다. 트랜잭션 오버헤드가 없기 때문입니다.

**2. COUNT(*) 쿼리 최적화**

```sql
SELECT COUNT(*) FROM large_table;
```

MyISAM은 테이블의 총 row 수를 메타데이터에 저장하기 때문에, WHERE 조건이 없는 COUNT(*) 쿼리가 거의 즉시 실행됩니다.

**3. 작은 디스크 공간**

트랜잭션 로그나 MVCC(Multi-Version Concurrency Control)를 위한 추가 공간이 필요 없어 디스크 사용량이 적습니다.

**4. 단순한 구조**

복잡한 트랜잭션 메커니즘이 없어 구조가 단순하고, 특정 상황에서는 관리가 쉽습니다.

### MyISAM의 한계

그러나 현대적인 웹 애플리케이션 환경에서는 MyISAM의 단점이 치명적입니다.

> "MySQL uses table-level locking for MyISAM, MEMORY, and MERGE tables, permitting only one session to update those tables at a time."
>
> — [MySQL 8.0 Reference Manual, Section 10.11.1 Internal Locking Methods](https://dev.mysql.com/doc/refman/8.0/en/internal-locking.html)

**1. 테이블 레벨 락**

MyISAM은 테이블 전체에 락을 걸기 때문에 동시성이 매우 낮습니다.

```
사용자 A: INSERT 중...  (전체 테이블 락)
사용자 B: SELECT 대기...
사용자 C: UPDATE 대기...
```

**2. 트랜잭션 미지원**

```sql
BEGIN;
INSERT INTO orders VALUES (...);
-- 오류 발생
ROLLBACK;  -- 작동하지 않음
```

MyISAM은 nontransactional 스토리지 엔진으로, 트랜잭션을 지원하지 않아 데이터 정합성 보장이 어렵습니다.

**3. 크래시 복구 취약**

```
서버 비정상 종료 → 테이블 손상 가능 → 수동 복구 필요
```

### InnoDB의 장점

MySQL 공식 문서에서 InnoDB의 장점을 명확히 설명하고 있습니다:

> "InnoDB implements standard row-level locking where there are two types of locks, shared (S) locks and exclusive (X) locks."
>
> — [MySQL 8.0 Reference Manual, Section 17.7.1 InnoDB Locking](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html)

**1. Row 레벨 락 (동시성 향상)**

```
사용자 A: 행 1 수정 중
사용자 B: 행 2 수정 가능 (동시 처리)
사용자 C: 행 3 수정 가능 (동시 처리)
```

**2. ACID 트랜잭션**

> "Isolation is the I in the acronym ACID; the isolation level is the setting that fine-tunes the balance between performance and reliability, consistency, and reproducibility of results."
>
> — [MySQL 8.0 Reference Manual, Section 17.7.2.1 Transaction Isolation Levels](https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html)

```sql
BEGIN;
INSERT INTO orders VALUES (...);
INSERT INTO payments VALUES (...);
-- 오류 발생
ROLLBACK;  -- 모두 되돌림
```

**3. 자동 크래시 복구**

```
서버 비정상 종료 → 자동 복구 → 데이터 정합성 보장
```

특히 이전에 발견했던 프로시저 성능 문제에서 `INSERT INTO user_view_log`가 225ms 걸렸던 것도, collation 변환뿐만 아니라 MyISAM의 테이블 락이 추가 오버헤드를 일으켰을 가능성이 높습니다.

### 우리 서비스에서 InnoDB를 선택한 이유

저희 서비스는 다음과 같은 특성이 있습니다:

- **높은 동시성**: 여러 사용자가 동시에 데이터를 읽고 쓰는 환경
- **빈번한 INSERT/UPDATE**: 사용자 활동 로그, 방문 기록 등 지속적인 쓰기 작업
- **데이터 정합성 중요**: 결제, 사용자 정보 등 일관성이 보장되어야 하는 데이터
- **트랜잭션 필요**: 여러 테이블에 걸친 원자적 작업 필요

이런 환경에서는 MyISAM의 장점(빠른 읽기, COUNT(*) 최적화)보다 InnoDB의 장점(Row-level Lock, 트랜잭션, ACID)이 훨씬 중요했습니다. 특히 utf8mb4 마이그레이션을 위해 어차피 테이블을 변경해야 하는 상황이었기 때문에, 이 기회에 스토리지 엔진까지 현대화하는 것이 합리적인 선택이었습니다.

---

## 최종 성능 개선 결과

### 프로시저 실행 시간

| 단계 | 실행 시간 | 개선율 |
|------|-----------|--------|
| 수정 전 (utf8mb3 + varchar 파라미터) | 457ms | - |
| 임시 해결 (utf8mb3 지역 변수) | 42ms | 약 11배 개선 |
| 최종 (utf8mb4 + InnoDB) | 42ms | 약 11배 개선 |

### 쿼리별 실행 시간 변화

**수정 전:**
```
INSERT user_view_log:      225ms
INSERT frequent_visits:    202ms
SELECT (메인 쿼리):       209ms
총합:                     636ms
```

**수정 후:**
```
SELECT title:             0.55ms
INSERT user_view_log:     4.25ms
INSERT frequent_visits:   0.71ms
SELECT (메인 쿼리):      1.40ms
총합:                     6.91ms
```

### 데이터베이스 전체 개선 사항

- 121개 테이블 utf8mb4로 마이그레이션
- 109개 MyISAM 테이블을 InnoDB로 전환
- 모든 프로시저에서 collation 경고 제거
- 향후 MySQL 버전 업그레이드 대비

---

## 추가로 발견한 문제: Collation 불일치 재발

그런데 마이그레이션 후 애플리케이션을 실행하자 새로운 에러가 발생했습니다:

```
java.sql.SQLException: Illegal mix of collations (utf8mb4_0900_ai_ci,IMPLICIT)
and (utf8mb4_general_ci,IMPLICIT) for operation '='
```

문제를 파악해보니 기존에 일부 테이블들이 `utf8mb4_general_ci`로 설정된 테이블들이 존재했습니다.

결국 테이블 collation과 MySQL 8.0의 기본 collation 사이에 충돌이 발생한 것입니다.

### 원인

- 테이블: `utf8mb4_general_ci`
- Connection/Session 기본값: `utf8mb4_0900_ai_ci` (MySQL 8.0 기본값)
- 애플리케이션 레벨 파라미터: `utf8mb4_0900_ai_ci`

결국 같은 문제가 다른 형태로 재발한 것이었습니다.

### 최종 해결

모든 테이블을 MySQL 8.0의 기본값인 `utf8mb4_0900_ai_ci`로 통일했습니다.

```sql
-- 모든 테이블을 utf8mb4_0900_ai_ci로 재변환
ALTER TABLE table_name
CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

**`utf8mb4_0900_ai_ci`를 선택한 이유:**
1. MySQL 8.0의 기본 collation
2. 더 정확한 유니코드 정렬 알고리즘 (UCA 9.0.0 기준)
3. 애플리케이션 레벨의 기본값과 일치
4. 추가적인 collation 변환 불필요
5. 향후 MySQL 버전 업그레이드 시 호환성 보장

이 교훈을 통해 배운 것은, **단순히 utf8mb4로 변환하는 것만으로는 부족하고, 정확한 collation까지 일치시켜야 한다**는 점이었습니다.

---

## 배운 점

### 1. Collation은 조용한 성능 킬러

프로시저 파라미터나 세션 변수의 collation은 눈에 보이지 않습니다. MySQL 8.0에서는 기본값이 `utf8mb4_0900_ai_ci`인데, 레거시 테이블은 `utf8mb3_general_ci`를 사용하는 경우가 많습니다.

EXPLAIN에서 이런 경고가 나온다면, 반드시 collation을 확인해야 합니다:
```
Cannot use ref access on index due to type or collation conversion
```

이 경고는 인덱스를 사용할 수 없다는 명확한 신호입니다.

### 2. "동작한다" ≠ "최적화되어 있다"

개별 쿼리를 직접 실행하면 빠르게 동작하지만, 프로시저 내부에서는 파라미터 바인딩으로 인해 전혀 다른 성능을 보일 수 있습니다.

반드시 실제 환경과 유사한 조건에서 테스트해야 합니다. 특히 프로시저의 경우 SET profiling을 활용한 상세 분석이 필수적입니다.

### 3. MyISAM은 이제 과거의 유물

MyISAM을 사용해야 할 특별한 이유가 없다면, InnoDB를 사용하는 것이 압도적으로 유리합니다:

- Row 레벨 락으로 동시성 향상
- 트랜잭션 지원으로 데이터 정합성 보장
- 자동 크래시 복구
- 더 큰 인덱스 키 지원 (3072 bytes)
- Foreign Key 지원

특히 웹 서비스처럼 동시 접속이 많은 환경에서는 MyISAM의 테이블 락이 심각한 병목이 될 수 있습니다.

### 4. 단계적 마이그레이션의 중요성

처음부터 완벽한 해결책을 찾으려 하지 말고 단계적으로 접근하는 것이 효과적입니다:

1. 빠른 임시 해결 (지역 변수로 collation 맞추기)
2. 근본 원인 파악 (utf8mb3 deprecated, MyISAM 제한)
3. 전체 시스템 개선 (utf8mb4 마이그레이션, InnoDB 전환)

이런 단계적 접근이 더 안전하고 효과적이었습니다. 특히 운영 중인 서비스에서는 한 번에 모든 것을 바꾸는 것보다 단계별로 검증하며 진행하는 것이 리스크를 줄일 수 있습니다.

### 5. EXPLAIN은 거짓말하지 않는다

성능 문제가 발생하면 반드시 EXPLAIN으로 실행 계획을 확인해야 합니다. 특히 다음 사항들에 주의해야 합니다:

- `type: ALL` → 풀 테이블 스캔 경고
- 경고 메시지 → 무시하지 말고 정확한 원인 파악
- `rows` 값 → 예상과 크게 다르다면 문제의 신호

EXPLAIN의 경고 메시지는 성능 문제의 가장 명확한 단서입니다.

### 6. 레거시 시스템의 숨겨진 기술 부채

이번 작업을 통해 발견한 것은 단순히 프로시저 성능 문제만이 아니었습니다.

- deprecated된 utf8mb3 사용
- 레거시 스토리지 엔진 MyISAM 사용
- 일관되지 않은 character set 및 collation

표면적인 문제 하나를 해결하려다 보면, 그 아래에 쌓여있던 기술 부채들을 발견하게 됩니다. 이를 기회로 삼아 전체 시스템을 개선할 수 있었습니다.

---

## 마치며

"왜 갑자기 느려진 거지?" 하는 단순한 의문에서 시작한 이번 작업은, 생각보다 훨씬 깊은 곳까지 이어졌습니다. Collation 불일치를 발견하고, MyISAM의 숨겨진 제약을 만나고, 결국 데이터베이스 전체를 현대화하는 여정이 되었습니다.

457ms 걸리던 프로시저를 42ms로 개선했고(약 11배), 121개 테이블을 utf8mb4로 마이그레이션했으며, 109개의 MyISAM 테이블을 InnoDB로 전환했습니다. 숫자로 보면 큰 성과지만, 사실 더 의미 있었던 건 이 과정에서 배운 것들이었습니다.

처음에는 빠른 해결에만 집중했습니다. 하지만 근본 원인을 파고들면서, 단순한 버그 픽스를 넘어 서비스 인프라를 한 단계 업그레이드하는 기회로 만들 수 있었습니다.

이제 저희 서비스는

- 이모지와 특수문자를 완벽하게 지원하고 (utf8mb4)
- 더 나은 동시성을 제공하며 (InnoDB Row-level Lock)
- 데이터 정합성이 보장되고 (트랜잭션)
- 향후 MySQL 버전 업그레이드에도 문제없이 대응할 수 있습니다 (utf8mb3 deprecated 해결)

성능 문제 하나를 해결하려다 보니, 그동안 쌓여있던 기술 부채들이 하나씩 보였습니다. 표면적인 해결에 그치지 않고 근본 원인까지 파고든 것이 결과적으로 좋은 선택이었습니다.

비슷한 문제로 고민하고 계신 분들께 이 글이 조금이나마 도움이 되었으면 합니다. 긴 글 읽어주셔서 감사합니다.

---

## 참고 자료

### MySQL 공식 문서

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

### MySQL 버그 리포트
- [Bug #83856: Index ref not used for multi-column IN - type or collation conversion warning](https://bugs.mysql.com/bug.php?id=83856)
- [Bug #83857: Index not used for the implicit integer to string conversion](https://bugs.mysql.com/bug.php?id=83857)

---

## 주의 사항

이 글은 실제 경험을 바탕으로 작성되었으며, MySQL 공식 문서를 참고하여 작성되었습니다. 하지만 일부 내용에 정확하지 않은 정보가 포함되어 있을 수 있습니다. 제 정보가 정확하지 않을 수 있으니 실제 프로덕션 환경에 적용하기 전에 반드시 공식 문서를 확인하시고, 충분한 테스트를 거치시기 바랍니다...!
