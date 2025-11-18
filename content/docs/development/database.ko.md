---
title: 데이터베이스
weight: 6
---

제가 데이터베이스를 다룰 때 따르는 원칙과 쿼리 작성 규칙입니다.

## 핵심 원칙

### 1. Audit Trail (필수 5가지 필드)

모든 테이블은 다음 5가지 필드를 필수로 포함해야 합니다:

```sql
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,

    -- Audit Trail 필드 (필수)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by BIGINT,
    deleted_at TIMESTAMP NULL  -- Soft Delete용
);
```

### 2. Soft Delete (물리적 삭제 금지)

**절대 금지**: `DELETE` 쿼리 사용 금지

```kotlin
// ❌ BAD: 물리적 삭제 (절대 금지)
fun deleteUser(userId: Long) {
    userRepository.deleteById(userId)  // ❌ 절대 금지
}

// ✅ GOOD: Soft Delete (논리적 삭제만 허용)
fun deleteUser(userId: Long, deletedBy: Long) {
    val user = userRepository.findById(userId).orElseThrow()
    user.delete(deletedBy)  // deletedAt, updatedAt, updatedBy 설정
    userRepository.save(user)
}
```

### 3. JPA 엔티티 설계

**Audit Trail과 Soft Delete를 포함한 Base Entity**

```kotlin
@MappedSuperclass
@EntityListeners(AuditingEntityListener::class)
abstract class BaseEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @CreatedDate
    @Column(nullable = false, updatable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(nullable = true, updatable = false)
    var createdBy: Long? = null,

    @LastModifiedDate
    @Column(nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),

    @Column(nullable = true)
    var updatedBy: Long? = null,

    @Column(nullable = true)
    var deletedAt: LocalDateTime? = null
) {
    fun delete(deletedBy: Long) {
        this.deletedAt = LocalDateTime.now()
        this.updatedBy = deletedBy
        this.updatedAt = LocalDateTime.now()
    }

    fun isDeleted(): Boolean = deletedAt != null
}
```

```kotlin
@Entity
@Table(name = "users")
class User(
    @Column(nullable = false, unique = true, length = 255)
    var email: String,

    @Column(nullable = false, length = 255)
    var name: String,

    @Column(nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    var status: UserStatus = UserStatus.ACTIVE
) : BaseEntity()

enum class UserStatus {
    ACTIVE, INACTIVE
}
```

## Spring Data JPA Repository

### 기본 조회

```kotlin
interface UserRepository : JpaRepository<User, Long> {

    // 단일 조회 (Soft Delete 제외)
    @Query("SELECT u FROM User u WHERE u.id = :id AND u.deletedAt IS NULL")
    fun findByIdAndNotDeleted(id: Long): Optional<User>

    // 이메일로 조회
    @Query("SELECT u FROM User u WHERE u.email = :email AND u.deletedAt IS NULL")
    fun findByEmailAndNotDeleted(email: String): Optional<User>

    // 전체 조회 (Soft Delete 제외)
    @Query("SELECT u FROM User u WHERE u.deletedAt IS NULL ORDER BY u.createdAt DESC")
    fun findAllNotDeleted(): List<User>

    // 상태별 조회
    @Query("SELECT u FROM User u WHERE u.status = :status AND u.deletedAt IS NULL ORDER BY u.createdAt DESC")
    fun findByStatusAndNotDeleted(status: UserStatus): List<User>

    // 존재 여부 확인
    @Query("SELECT COUNT(u) > 0 FROM User u WHERE u.email = :email AND u.deletedAt IS NULL")
    fun existsByEmailAndNotDeleted(email: String): Boolean
}
```

### INSERT

```kotlin
// ✅ GOOD: Audit Trail 자동 설정 (AuditingEntityListener 사용)
@Service
class UserService(
    private val userRepository: UserRepository
) {
    fun createUser(request: CreateUserRequest, createdBy: Long): User {
        val user = User(
            email = request.email,
            name = request.name,
            status = UserStatus.ACTIVE
        ).apply {
            this.createdBy = createdBy
            this.updatedBy = createdBy
        }

        return userRepository.save(user)
    }
}
```

### UPDATE

```kotlin
// ✅ GOOD: Audit Trail 업데이트 포함
@Service
class UserService(
    private val userRepository: UserRepository
) {
    @Transactional
    fun updateUser(userId: Long, email: String?, name: String?, updatedBy: Long): User {
        val user = userRepository.findByIdAndNotDeleted(userId)
            .orElseThrow { NotFoundException("User not found") }

        email?.let { user.email = it }
        name?.let { user.name = it }
        user.updatedBy = updatedBy
        user.updatedAt = LocalDateTime.now()

        return userRepository.save(user)
    }
}
```

### Soft DELETE

```kotlin
// ✅ GOOD: Soft Delete만 허용
@Service
class UserService(
    private val userRepository: UserRepository
) {
    @Transactional
    fun deleteUser(userId: Long, deletedBy: Long) {
        val user = userRepository.findByIdAndNotDeleted(userId)
            .orElseThrow { NotFoundException("User not found") }

        user.delete(deletedBy)
        userRepository.save(user)
    }
}

// ❌ BAD: 물리적 삭제 절대 금지
@Service
class UserService(
    private val userRepository: UserRepository
) {
    fun hardDeleteUser(userId: Long) {
        userRepository.deleteById(userId)  // ❌ 절대 금지
    }
}
```

## QueryDSL 사용

### 설정

```kotlin
@Configuration
class QueryDslConfig(
    @PersistenceContext
    private val entityManager: EntityManager
) {
    @Bean
    fun jpaQueryFactory(): JPAQueryFactory {
        return JPAQueryFactory(entityManager)
    }
}
```

### 기본 조회

```kotlin
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user

    // 단일 조회
    fun findById(id: Long): User? {
        return queryFactory
            .selectFrom(user)
            .where(
                user.id.eq(id),
                user.deletedAt.isNull
            )
            .fetchOne()
    }

    // 목록 조회
    fun findAll(): List<User> {
        return queryFactory
            .selectFrom(user)
            .where(user.deletedAt.isNull)
            .orderBy(user.createdAt.desc())
            .fetch()
    }

    // 조건부 조회
    fun findByStatus(status: UserStatus): List<User> {
        return queryFactory
            .selectFrom(user)
            .where(
                user.status.eq(status),
                user.deletedAt.isNull
            )
            .orderBy(user.createdAt.desc())
            .fetch()
    }
}
```

### JOIN 쿼리

```kotlin
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user
    private val order = QOrder.order

    // INNER JOIN
    fun findUsersWithOrders(): List<UserWithOrdersDto> {
        return queryFactory
            .select(
                Projections.constructor(
                    UserWithOrdersDto::class.java,
                    user.id,
                    user.email,
                    user.name,
                    order.id,
                    order.productName,
                    order.amount
                )
            )
            .from(user)
            .innerJoin(order).on(user.id.eq(order.userId))
            .where(
                user.deletedAt.isNull,
                order.deletedAt.isNull
            )
            .orderBy(user.createdAt.desc())
            .fetch()
    }

    // LEFT JOIN
    fun findUsersWithOptionalOrders(): List<UserWithOrdersDto> {
        return queryFactory
            .select(
                Projections.constructor(
                    UserWithOrdersDto::class.java,
                    user.id,
                    user.email,
                    user.name,
                    order.id,
                    order.productName,
                    order.amount
                )
            )
            .from(user)
            .leftJoin(order).on(
                user.id.eq(order.userId)
                    .and(order.deletedAt.isNull)
            )
            .where(user.deletedAt.isNull)
            .orderBy(user.createdAt.desc())
            .fetch()
    }
}

data class UserWithOrdersDto(
    val userId: Long,
    val email: String,
    val name: String,
    val orderId: Long?,
    val productName: String?,
    val amount: Long?
)
```

### 페이징

```kotlin
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user

    fun findAllWithPaging(page: Int, size: Int): Page<User> {
        val content = queryFactory
            .selectFrom(user)
            .where(user.deletedAt.isNull)
            .orderBy(user.createdAt.desc())
            .offset((page * size).toLong())
            .limit(size.toLong())
            .fetch()

        val total = queryFactory
            .select(user.count())
            .from(user)
            .where(user.deletedAt.isNull)
            .fetchOne() ?: 0L

        return PageImpl(content, PageRequest.of(page, size), total)
    }
}
```

### 집계 함수

```kotlin
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user
    private val order = QOrder.order

    // COUNT, SUM, AVG 등
    fun getUserStatistics(): UserStatistics {
        val result = queryFactory
            .select(
                user.count(),
                user.id.count().filter(user.status.eq(UserStatus.ACTIVE)),
                user.id.count().filter(user.status.eq(UserStatus.INACTIVE))
            )
            .from(user)
            .where(user.deletedAt.isNull)
            .fetchOne()

        return UserStatistics(
            totalUsers = result?.get(0, Long::class.java) ?: 0L,
            activeUsers = result?.get(1, Long::class.java) ?: 0L,
            inactiveUsers = result?.get(2, Long::class.java) ?: 0L
        )
    }

    // GROUP BY
    fun getOrderCountByUser(): List<UserOrderCount> {
        return queryFactory
            .select(
                Projections.constructor(
                    UserOrderCount::class.java,
                    order.userId,
                    user.email,
                    user.name,
                    order.count()
                )
            )
            .from(order)
            .innerJoin(user).on(order.userId.eq(user.id))
            .where(
                order.deletedAt.isNull,
                user.deletedAt.isNull
            )
            .groupBy(order.userId, user.email, user.name)
            .orderBy(order.count().desc())
            .fetch()
    }
}

data class UserStatistics(
    val totalUsers: Long,
    val activeUsers: Long,
    val inactiveUsers: Long
)

data class UserOrderCount(
    val userId: Long,
    val email: String,
    val name: String,
    val orderCount: Long
)
```

### 서브쿼리

```kotlin
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user
    private val order = QOrder.order

    fun findUsersWithRecentOrders(): List<User> {
        val recentDate = LocalDateTime.now().minusDays(30)

        val subQuery = JPAExpressions
            .select(order.userId)
            .from(order)
            .where(
                order.createdAt.goe(recentDate),
                order.deletedAt.isNull
            )

        return queryFactory
            .selectFrom(user)
            .where(
                user.id.`in`(subQuery),
                user.deletedAt.isNull
            )
            .orderBy(user.createdAt.desc())
            .fetch()
    }
}
```

### EXISTS 쿼리

```kotlin
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user
    private val order = QOrder.order

    fun existsByEmail(email: String): Boolean {
        val result = queryFactory
            .selectOne()
            .from(user)
            .where(
                user.email.eq(email),
                user.deletedAt.isNull
            )
            .fetchFirst()

        return result != null
    }

    fun hasOrders(userId: Long): Boolean {
        val result = queryFactory
            .selectOne()
            .from(order)
            .where(
                order.userId.eq(userId),
                order.deletedAt.isNull
            )
            .fetchFirst()

        return result != null
    }
}
```

## 동적 쿼리

```kotlin
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user

    fun findUsers(
        email: String?,
        status: UserStatus?,
        ageMin: Int?,
        ageMax: Int?
    ): List<User> {
        return queryFactory
            .selectFrom(user)
            .where(
                emailEq(email),
                statusEq(status),
                ageGoe(ageMin),
                ageLoe(ageMax),
                user.deletedAt.isNull
            )
            .orderBy(user.createdAt.desc())
            .fetch()
    }

    private fun emailEq(email: String?): BooleanExpression? {
        return email?.let { user.email.eq(it) }
    }

    private fun statusEq(status: UserStatus?): BooleanExpression? {
        return status?.let { user.status.eq(it) }
    }

    private fun ageGoe(ageMin: Int?): BooleanExpression? {
        return ageMin?.let { user.age.goe(it) }
    }

    private fun ageLoe(ageMax: Int?): BooleanExpression? {
        return ageMax?.let { user.age.loe(it) }
    }
}
```

## 프로젝션 (DTO 직접 조회)

```kotlin
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user

    // ✅ GOOD: 필요한 필드만 DTO로 조회
    fun findUserDtos(): List<UserDto> {
        return queryFactory
            .select(
                Projections.constructor(
                    UserDto::class.java,
                    user.id,
                    user.email,
                    user.name,
                    user.status
                )
            )
            .from(user)
            .where(user.deletedAt.isNull)
            .fetch()
    }

    // @QueryProjection 사용 (타입 안전)
    fun findUserProjections(): List<UserProjection> {
        return queryFactory
            .select(
                QUserProjection(
                    user.id,
                    user.email,
                    user.name,
                    user.status
                )
            )
            .from(user)
            .where(user.deletedAt.isNull)
            .fetch()
    }
}

data class UserDto(
    val id: Long,
    val email: String,
    val name: String,
    val status: UserStatus
)

// @QueryProjection 사용 시
data class UserProjection @QueryProjection constructor(
    val id: Long,
    val email: String,
    val name: String,
    val status: UserStatus
)
```

## 트랜잭션

```kotlin
// ✅ GOOD: @Transactional로 트랜잭션 관리
@Service
class UserService(
    private val userRepository: UserRepository,
    private val orderRepository: OrderRepository
) {

    @Transactional
    fun createUserWithOrder(
        userRequest: CreateUserRequest,
        orderRequest: CreateOrderRequest,
        createdBy: Long
    ): User {
        val user = User(
            email = userRequest.email,
            name = userRequest.name,
            status = UserStatus.ACTIVE
        ).apply {
            this.createdBy = createdBy
            this.updatedBy = createdBy
        }

        val savedUser = userRepository.save(user)

        val order = Order(
            userId = savedUser.id,
            productName = orderRequest.productName,
            amount = orderRequest.amount
        ).apply {
            this.createdBy = createdBy
            this.updatedBy = createdBy
        }

        orderRepository.save(order)

        return savedUser
    }

    @Transactional
    fun deleteUserAndOrders(userId: Long, deletedBy: Long) {
        val user = userRepository.findByIdAndNotDeleted(userId)
            .orElseThrow { NotFoundException("User not found") }

        // User Soft Delete
        user.delete(deletedBy)
        userRepository.save(user)

        // 관련 Orders Soft Delete
        val orders = orderRepository.findByUserIdAndNotDeleted(userId)
        orders.forEach { it.delete(deletedBy) }
        orderRepository.saveAll(orders)
    }
}
```

## 벌크 연산

```kotlin
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user

    // ✅ GOOD: 벌크 업데이트 (대량 데이터 처리 시)
    @Transactional
    fun bulkUpdateStatus(oldStatus: UserStatus, newStatus: UserStatus, updatedBy: Long): Long {
        return queryFactory
            .update(user)
            .set(user.status, newStatus)
            .set(user.updatedBy, updatedBy)
            .set(user.updatedAt, LocalDateTime.now())
            .where(
                user.status.eq(oldStatus),
                user.deletedAt.isNull
            )
            .execute()
    }

    // ❌ BAD: 벌크 삭제 금지 (Soft Delete 사용)
    @Transactional
    fun bulkDelete(status: UserStatus, deletedBy: Long): Long {
        return queryFactory
            .update(user)
            .set(user.deletedAt, LocalDateTime.now())
            .set(user.updatedBy, deletedBy)
            .set(user.updatedAt, LocalDateTime.now())
            .where(
                user.status.eq(status),
                user.deletedAt.isNull
            )
            .execute()
    }
}
```

## 인덱스 전략

### 권장 인덱스

```sql
-- Primary Key (자동 생성)
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    -- ...
);

-- Unique 제약조건 (인덱스 자동 생성)
CREATE UNIQUE INDEX idx_users_email ON users(email, deleted_at);

-- 자주 조회되는 컬럼
CREATE INDEX idx_users_status ON users(status, deleted_at);

-- 복합 인덱스
CREATE INDEX idx_users_status_created_at ON users(status, created_at, deleted_at);

-- Foreign Key
CREATE INDEX idx_orders_user_id ON orders(user_id, deleted_at);
```

## N+1 문제 해결

```kotlin
// ❌ BAD: N+1 문제 발생
@Entity
class User(
    // ...
    @OneToMany(mappedBy = "user")
    val orders: List<Order> = emptyList()
)

fun getUsers(): List<User> {
    return userRepository.findAll()  // 1번 쿼리
    // orders 접근 시 N번 쿼리 발생
}

// ✅ GOOD: Fetch Join으로 해결
@Repository
interface UserRepository : JpaRepository<User, Long> {
    @Query("SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.orders o WHERE u.deletedAt IS NULL AND (o.deletedAt IS NULL OR o IS NULL)")
    fun findAllWithOrders(): List<User>
}

// ✅ GOOD: QueryDSL로 해결
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user
    private val order = QOrder.order

    fun findAllWithOrders(): List<User> {
        return queryFactory
            .selectFrom(user)
            .distinct()
            .leftJoin(user.orders, order).fetchJoin()
            .where(
                user.deletedAt.isNull,
                order.deletedAt.isNull.or(order.isNull)
            )
            .fetch()
    }
}
```

## 체크리스트

**쿼리 작성 시:**
- [ ] 모든 WHERE 절에 `deletedAt IS NULL` 조건이 포함되어 있는가?
- [ ] DELETE 쿼리 대신 Soft Delete를 사용하는가?
- [ ] INSERT/UPDATE 시 Audit Trail 필드를 업데이트하는가?
- [ ] 프로젝션(DTO)을 사용하여 필요한 필드만 조회하는가?

**테이블 설계 시:**
- [ ] Audit Trail 5가지 필드가 모두 포함되어 있는가?
- [ ] deleted_at 컬럼이 존재하는가?
- [ ] 적절한 인덱스가 생성되어 있는가?
- [ ] Foreign Key 제약조건이 설정되어 있는가?

**성능 최적화:**
- [ ] N+1 문제가 없는가? (Fetch Join 또는 Batch Size 설정)
- [ ] 프로젝션을 사용하여 불필요한 데이터를 조회하지 않는가?
- [ ] 페이징을 적용했는가?
- [ ] 인덱스를 활용하는 쿼리인가?
