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

## 동시성 제어 (Concurrency Control)

### Optimistic Locking (낙관적 잠금)

충돌이 거의 발생하지 않는 환경에서 사용합니다. 조회가 많고 수정이 적은 경우에 적합합니다.

```kotlin
// ✅ GOOD: @Version을 사용한 낙관적 잠금
@Entity
@Table(name = "products")
class Product(
    @Column(nullable = false, length = 255)
    var name: String,

    @Column(nullable = false)
    var stock: Int,

    @Column(nullable = false)
    var price: Long,

    @Version  // 낙관적 잠금을 위한 버전 필드
    var version: Long = 0
) : BaseEntity()

@Service
class ProductService(
    private val productRepository: ProductRepository
) {
    @Transactional
    fun updateStock(productId: Long, quantity: Int, updatedBy: Long): Product {
        val product = productRepository.findByIdAndNotDeleted(productId)
            .orElseThrow { NotFoundException("Product not found") }

        product.stock += quantity
        product.updatedBy = updatedBy
        product.updatedAt = LocalDateTime.now()

        return try {
            productRepository.save(product)
        } catch (e: OptimisticLockException) {
            // 동시성 충돌 발생 시 재시도 로직
            throw ConcurrencyException("Product was modified by another transaction. Please retry.")
        }
    }

    // ✅ GOOD: 재시도 로직 포함
    @Transactional
    fun updateStockWithRetry(productId: Long, quantity: Int, updatedBy: Long, maxRetries: Int = 3): Product {
        var attempts = 0
        while (attempts < maxRetries) {
            try {
                return updateStock(productId, quantity, updatedBy)
            } catch (e: OptimisticLockException) {
                attempts++
                if (attempts >= maxRetries) {
                    throw ConcurrencyException("Failed to update product after $maxRetries attempts")
                }
                Thread.sleep(100 * attempts.toLong()) // 지수 백오프
            }
        }
        throw ConcurrencyException("Unexpected error in retry logic")
    }
}
```

**사용 시나리오:**
- 조회가 많고 수정이 적은 경우
- 충돌 확률이 낮은 경우
- 데이터베이스 잠금 오버헤드를 줄이고 싶은 경우

### Pessimistic Locking (비관적 잠금)

충돌이 빈번하게 발생하는 환경에서 사용합니다. 재고 관리, 예약 시스템 등에 적합합니다.

```kotlin
// ✅ GOOD: 비관적 잠금을 사용한 재고 관리
@Repository
interface ProductRepository : JpaRepository<Product, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(QueryHint(name = "javax.persistence.lock.timeout", value = "3000"))
    @Query("SELECT p FROM Product p WHERE p.id = :id AND p.deletedAt IS NULL")
    fun findByIdWithLock(id: Long): Optional<Product>
}

@Service
class OrderService(
    private val productRepository: ProductRepository,
    private val orderRepository: OrderRepository
) {
    @Transactional
    fun createOrder(productId: Long, quantity: Int, createdBy: Long): Order {
        // 비관적 잠금으로 제품 조회 (다른 트랜잭션은 대기)
        val product = productRepository.findByIdWithLock(productId)
            .orElseThrow { NotFoundException("Product not found") }

        // 재고 확인
        if (product.stock < quantity) {
            throw InsufficientStockException("Insufficient stock")
        }

        // 재고 차감
        product.stock -= quantity
        product.updatedBy = createdBy
        product.updatedAt = LocalDateTime.now()
        productRepository.save(product)

        // 주문 생성
        val order = Order(
            productId = productId,
            quantity = quantity,
            totalPrice = product.price * quantity
        ).apply {
            this.createdBy = createdBy
            this.updatedBy = createdBy
        }

        return orderRepository.save(order)
    }
}

// ❌ BAD: 잠금 없이 재고 차감 (동시성 문제 발생)
@Service
class OrderService(
    private val productRepository: ProductRepository,
    private val orderRepository: OrderRepository
) {
    @Transactional
    fun createOrderUnsafe(productId: Long, quantity: Int, createdBy: Long): Order {
        val product = productRepository.findByIdAndNotDeleted(productId)
            .orElseThrow { NotFoundException("Product not found") }

        // ❌ 동시에 여러 요청이 들어오면 재고가 마이너스가 될 수 있음
        if (product.stock < quantity) {
            throw InsufficientStockException("Insufficient stock")
        }

        product.stock -= quantity  // ❌ 동시성 문제 발생
        productRepository.save(product)

        val order = Order(
            productId = productId,
            quantity = quantity,
            totalPrice = product.price * quantity
        ).apply {
            this.createdBy = createdBy
            this.updatedBy = createdBy
        }

        return orderRepository.save(order)
    }
}
```

**사용 시나리오:**
- 재고 관리 (재고 차감)
- 좌석 예약 시스템
- 금융 거래
- 충돌이 빈번하게 발생하는 경우

**데드락 방지 전략:**

```kotlin
// ✅ GOOD: 데드락 방지를 위한 정렬된 잠금 획득
@Service
class TransferService(
    private val accountRepository: AccountRepository
) {
    @Transactional
    fun transfer(fromAccountId: Long, toAccountId: Long, amount: Long, transferBy: Long) {
        // 항상 ID 순서대로 잠금 획득 (데드락 방지)
        val (firstId, secondId) = if (fromAccountId < toAccountId) {
            Pair(fromAccountId, toAccountId)
        } else {
            Pair(toAccountId, fromAccountId)
        }

        val firstAccount = accountRepository.findByIdWithLock(firstId)
            .orElseThrow { NotFoundException("Account not found") }
        val secondAccount = accountRepository.findByIdWithLock(secondId)
            .orElseThrow { NotFoundException("Account not found") }

        val (fromAccount, toAccount) = if (fromAccountId < toAccountId) {
            Pair(firstAccount, secondAccount)
        } else {
            Pair(secondAccount, firstAccount)
        }

        if (fromAccount.balance < amount) {
            throw InsufficientBalanceException("Insufficient balance")
        }

        fromAccount.balance -= amount
        toAccount.balance += amount

        fromAccount.updatedBy = transferBy
        toAccount.updatedBy = transferBy

        accountRepository.saveAll(listOf(fromAccount, toAccount))
    }
}
```

## 성능 최적화 (Performance Optimization)

### 배치 처리 (Batch Processing)

대용량 데이터를 처리할 때 메모리 효율적으로 처리하는 방법입니다.

```kotlin
// ✅ GOOD: EntityManager flush/clear 패턴으로 메모리 관리
@Service
class UserBatchService(
    private val userRepository: UserRepository,
    @PersistenceContext
    private val entityManager: EntityManager
) {
    @Transactional
    fun createUsersInBatch(users: List<CreateUserRequest>, createdBy: Long) {
        val batchSize = 100

        users.chunked(batchSize).forEach { batch ->
            batch.forEach { request ->
                val user = User(
                    email = request.email,
                    name = request.name,
                    status = UserStatus.ACTIVE
                ).apply {
                    this.createdBy = createdBy
                    this.updatedBy = createdBy
                }
                entityManager.persist(user)
            }

            // 배치 단위로 flush하여 DB에 전송하고 1차 캐시 비우기
            entityManager.flush()
            entityManager.clear()
        }
    }

    @Transactional
    fun updateUsersInBatch(updates: List<Pair<Long, String>>, updatedBy: Long) {
        val batchSize = 100

        updates.chunked(batchSize).forEach { batch ->
            batch.forEach { (userId, newName) ->
                val user = userRepository.findById(userId).orElse(null) ?: return@forEach
                user.name = newName
                user.updatedBy = updatedBy
                user.updatedAt = LocalDateTime.now()
            }

            entityManager.flush()
            entityManager.clear()
        }
    }
}

// ❌ BAD: 대용량 데이터를 한 번에 처리 (OutOfMemoryError 발생 가능)
@Service
class UserBatchService(
    private val userRepository: UserRepository
) {
    @Transactional
    fun createUsersUnsafe(users: List<CreateUserRequest>, createdBy: Long) {
        // ❌ 수십만 건의 데이터를 한 번에 메모리에 로드
        val entities = users.map { request ->
            User(
                email = request.email,
                name = request.name,
                status = UserStatus.ACTIVE
            ).apply {
                this.createdBy = createdBy
                this.updatedBy = createdBy
            }
        }
        userRepository.saveAll(entities)  // ❌ 메모리 부족 발생 가능
    }
}
```

**application.yml 배치 설정:**

```yaml
spring:
  jpa:
    properties:
      hibernate:
        jdbc:
          batch_size: 100  # 배치 크기 설정
        order_inserts: true  # INSERT 문 정렬
        order_updates: true  # UPDATE 문 정렬
```

### 쿼리 최적화

```kotlin
// ❌ BAD: SELECT * 사용 (불필요한 컬럼 조회)
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user

    fun findAllUsers(): List<User> {
        return queryFactory
            .selectFrom(user)  // ❌ 모든 컬럼 조회
            .where(user.deletedAt.isNull)
            .fetch()
    }
}

// ✅ GOOD: DTO Projection으로 필요한 컬럼만 조회
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user

    fun findUserSummaries(): List<UserSummaryDto> {
        return queryFactory
            .select(
                Projections.constructor(
                    UserSummaryDto::class.java,
                    user.id,
                    user.email,
                    user.name
                    // Audit Trail 필드는 제외
                )
            )
            .from(user)
            .where(user.deletedAt.isNull)
            .fetch()
    }
}

data class UserSummaryDto(
    val id: Long,
    val email: String,
    val name: String
)
```

**Native Query 사용 시 주의사항:**

```kotlin
// ✅ GOOD: Native Query 사용 시 명시적인 컬럼 지정
@Repository
interface UserRepository : JpaRepository<User, Long> {

    @Query(
        value = """
            SELECT id, email, name, status, created_at, created_by,
                   updated_at, updated_by, deleted_at
            FROM users
            WHERE status = :status
            AND deleted_at IS NULL
            ORDER BY created_at DESC
        """,
        nativeQuery = true
    )
    fun findByStatusNative(status: String): List<User>
}

// ❌ BAD: SELECT * 사용
@Repository
interface UserRepository : JpaRepository<User, Long> {

    @Query(
        value = "SELECT * FROM users WHERE status = :status AND deleted_at IS NULL",
        nativeQuery = true
    )
    fun findByStatusUnsafe(status: String): List<User>  // ❌ 컬럼 추가/삭제 시 오류 발생
}
```

### 캐싱 전략

```kotlin
// ✅ GOOD: 조회 빈도가 높은 데이터 캐싱
@Entity
@Table(name = "categories")
@Cacheable
@org.hibernate.annotations.Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
class Category(
    @Column(nullable = false, unique = true, length = 100)
    var name: String,

    @Column(nullable = false, length = 500)
    var description: String
) : BaseEntity()

@Service
class CategoryService(
    private val categoryRepository: CategoryRepository
) {
    @Cacheable(value = ["categories"], key = "#id")
    fun getCategory(id: Long): Category {
        return categoryRepository.findByIdAndNotDeleted(id)
            .orElseThrow { NotFoundException("Category not found") }
    }

    @CacheEvict(value = ["categories"], key = "#id")
    @Transactional
    fun updateCategory(id: Long, name: String, updatedBy: Long): Category {
        val category = categoryRepository.findByIdAndNotDeleted(id)
            .orElseThrow { NotFoundException("Category not found") }

        category.name = name
        category.updatedBy = updatedBy
        category.updatedAt = LocalDateTime.now()

        return categoryRepository.save(category)
    }

    @CacheEvict(value = ["categories"], allEntries = true)
    @Transactional
    fun refreshAllCategories() {
        // 전체 캐시 갱신
    }
}
```

## 트랜잭션 관리 강화

### 격리 수준 (Isolation Level)

```kotlin
// ✅ GOOD: 격리 수준 명시적 설정
@Service
class PaymentService(
    private val paymentRepository: PaymentRepository,
    private val accountRepository: AccountRepository
) {
    // READ_COMMITTED: 커밋된 데이터만 읽기 (기본값, 대부분의 경우 적합)
    @Transactional(isolation = Isolation.READ_COMMITTED)
    fun processPayment(paymentId: Long, processedBy: Long): Payment {
        val payment = paymentRepository.findById(paymentId)
            .orElseThrow { NotFoundException("Payment not found") }

        payment.status = PaymentStatus.COMPLETED
        payment.updatedBy = processedBy

        return paymentRepository.save(payment)
    }

    // REPEATABLE_READ: 트랜잭션 내에서 같은 데이터를 여러 번 읽어도 동일한 결과 보장
    @Transactional(isolation = Isolation.REPEATABLE_READ)
    fun calculateBalance(accountId: Long): BalanceReport {
        val account = accountRepository.findById(accountId)
            .orElseThrow { NotFoundException("Account not found") }

        val initialBalance = account.balance

        // 비즈니스 로직 수행...
        Thread.sleep(1000)

        val finalBalance = account.balance
        // REPEATABLE_READ 덕분에 initialBalance == finalBalance 보장

        return BalanceReport(initialBalance, finalBalance)
    }

    // SERIALIZABLE: 가장 높은 격리 수준 (동시성 낮음, 일관성 최대)
    @Transactional(isolation = Isolation.SERIALIZABLE)
    fun criticalFinancialOperation(fromAccountId: Long, toAccountId: Long, amount: Long) {
        // 금융 거래 등 절대적인 일관성이 필요한 경우에만 사용
        // 성능이 크게 저하될 수 있음
    }
}
```

**격리 수준별 특징:**

| 격리 수준 | Dirty Read | Non-Repeatable Read | Phantom Read | 성능 | 사용 시나리오 |
|----------|-----------|---------------------|--------------|------|-------------|
| READ_UNCOMMITTED | 발생 | 발생 | 발생 | 최고 | 거의 사용 안 함 |
| READ_COMMITTED | 방지 | 발생 | 발생 | 높음 | 대부분의 경우 (기본값) |
| REPEATABLE_READ | 방지 | 방지 | 발생 | 중간 | 트랜잭션 내 일관성 필요 |
| SERIALIZABLE | 방지 | 방지 | 방지 | 낮음 | 금융 거래 등 중요한 경우 |

### 전파 옵션 (Propagation)

```kotlin
// ✅ GOOD: 전파 옵션 이해하고 사용
@Service
class OrderService(
    private val orderRepository: OrderRepository,
    private val notificationService: NotificationService,
    private val loggingService: LoggingService
) {
    // REQUIRED (기본값): 기존 트랜잭션이 있으면 참여, 없으면 새로 생성
    @Transactional(propagation = Propagation.REQUIRED)
    fun createOrder(request: CreateOrderRequest, createdBy: Long): Order {
        val order = Order(
            productId = request.productId,
            quantity = request.quantity,
            totalPrice = request.totalPrice
        ).apply {
            this.createdBy = createdBy
            this.updatedBy = createdBy
        }

        val savedOrder = orderRepository.save(order)

        // 같은 트랜잭션에 참여 (주문 생성 실패 시 알림도 롤백)
        notificationService.sendOrderConfirmation(savedOrder.id, createdBy)

        return savedOrder
    }

    // REQUIRES_NEW: 항상 새로운 트랜잭션 생성 (기존 트랜잭션 일시 중단)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun createOrderWithIndependentLog(request: CreateOrderRequest, createdBy: Long): Order {
        try {
            val order = Order(
                productId = request.productId,
                quantity = request.quantity,
                totalPrice = request.totalPrice
            ).apply {
                this.createdBy = createdBy
                this.updatedBy = createdBy
            }

            val savedOrder = orderRepository.save(order)

            // 별도의 트랜잭션으로 로깅 (주문 실패해도 로그는 저장됨)
            loggingService.logOrderCreation(savedOrder.id)

            return savedOrder
        } catch (e: Exception) {
            // 주문 실패해도 로그는 이미 커밋됨
            throw e
        }
    }
}

@Service
class LoggingService(
    private val orderLogRepository: OrderLogRepository
) {
    // REQUIRES_NEW: 독립적인 트랜잭션 (로그는 반드시 저장)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun logOrderCreation(orderId: Long) {
        val log = OrderLog(
            orderId = orderId,
            action = "ORDER_CREATED",
            timestamp = LocalDateTime.now()
        )
        orderLogRepository.save(log)
    }
}

@Service
class NotificationService {
    // REQUIRED: 기존 트랜잭션에 참여
    @Transactional(propagation = Propagation.REQUIRED)
    fun sendOrderConfirmation(orderId: Long, userId: Long) {
        // 주문 트랜잭션의 일부로 동작
        // 알림 전송 실패 시 주문도 롤백됨
    }
}
```

**전파 옵션 실무 가이드:**

- **REQUIRED** (기본값): 대부분의 경우 사용
- **REQUIRES_NEW**: 감사 로그, 이벤트 기록 등 독립적으로 저장해야 하는 경우
- **SUPPORTS**: 트랜잭션이 필요 없는 조회 작업
- **NOT_SUPPORTED**: 트랜잭션 없이 실행 (성능 최적화)
- **MANDATORY**: 반드시 트랜잭션 내에서 호출되어야 함 (검증용)
- **NEVER**: 트랜잭션 내에서 호출되면 예외 발생 (검증용)

## 인덱스 전략 강화

### 복합 인덱스 순서

```sql
-- ✅ GOOD: 카디널리티가 높은 컬럼을 앞에 배치
CREATE INDEX idx_users_email_status ON users(email, status, deleted_at);
-- email (카디널리티 높음) -> status (카디널리티 낮음) -> deleted_at

-- ✅ GOOD: WHERE 절 사용 빈도 고려
CREATE INDEX idx_orders_status_created_at ON orders(status, created_at, deleted_at);
-- status로 자주 필터링하고, created_at으로 정렬하는 경우

-- ❌ BAD: 카디널리티가 낮은 컬럼을 앞에 배치
CREATE INDEX idx_users_status_email ON users(status, email, deleted_at);
-- status (카디널리티 낮음)가 앞에 오면 인덱스 효율 저하

-- ✅ GOOD: 범위 검색 컬럼은 뒤에 배치
CREATE INDEX idx_orders_user_id_created_at ON orders(user_id, created_at, deleted_at);
-- user_id (=) -> created_at (범위 검색)
```

**인덱스 순서 결정 원칙:**
1. 카디널리티가 높은 컬럼을 앞에 (이메일, 고유 ID 등)
2. WHERE 절에 자주 사용되는 컬럼을 앞에
3. 등호(=) 비교 컬럼을 범위 검색 컬럼보다 앞에
4. deleted_at은 항상 마지막에

### 인덱스 안티패턴

```sql
-- ❌ BAD: 과도한 인덱스 생성
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    age INT,
    status VARCHAR(50),
    city VARCHAR(100),
    created_at TIMESTAMP,
    deleted_at TIMESTAMP
);

-- ❌ 너무 많은 단일 인덱스 (INSERT/UPDATE 성능 저하)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_users_age ON users(age);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_city ON users(city);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ✅ GOOD: 필요한 복합 인덱스만 생성
CREATE UNIQUE INDEX idx_users_email ON users(email, deleted_at);
CREATE INDEX idx_users_status_created_at ON users(status, created_at, deleted_at);
CREATE INDEX idx_users_city_status ON users(city, status, deleted_at);

-- ❌ BAD: 사용하지 않는 인덱스 방치
-- 주기적으로 사용하지 않는 인덱스 확인 및 삭제
SELECT
    index_name,
    table_name,
    seq_in_index,
    column_name
FROM information_schema.statistics
WHERE table_schema = 'your_database'
  AND table_name = 'users'
ORDER BY index_name, seq_in_index;

-- MySQL에서 인덱스 사용 통계 확인
SELECT * FROM sys.schema_unused_indexes WHERE object_schema = 'your_database';
```

**인덱스 생성 가이드:**
- 테이블당 인덱스는 5-7개 이내로 제한
- WHERE, JOIN, ORDER BY에 자주 사용되는 컬럼에만 생성
- 복합 인덱스로 여러 쿼리 패턴 커버
- 주기적으로 사용하지 않는 인덱스 삭제
- 인덱스 크기 모니터링 (테이블 크기의 20% 이내 권장)

## 보안 (Security)

### Soft Delete 보안

```kotlin
// ✅ GOOD: 삭제된 데이터 조회 방지 철저히 적용
@Repository
interface UserRepository : JpaRepository<User, Long> {

    @Query("SELECT u FROM User u WHERE u.id = :id AND u.deletedAt IS NULL")
    fun findByIdAndNotDeleted(id: Long): Optional<User>

    // ❌ BAD: deletedAt 체크 누락
    @Query("SELECT u FROM User u WHERE u.id = :id")
    fun findByIdUnsafe(id: Long): Optional<User>  // 삭제된 데이터도 조회됨
}

// ✅ GOOD: QueryDSL에서도 항상 deletedAt 체크
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user

    fun findAll(): List<User> {
        return queryFactory
            .selectFrom(user)
            .where(user.deletedAt.isNull)  // ✅ 필수
            .fetch()
    }

    // ❌ BAD: deletedAt 체크 누락
    fun findAllUnsafe(): List<User> {
        return queryFactory
            .selectFrom(user)
            .fetch()  // ❌ 삭제된 데이터도 조회됨
    }
}

// ✅ GOOD: Native Query에서도 체크
@Query(
    value = "SELECT * FROM users WHERE email = :email AND deleted_at IS NULL",
    nativeQuery = true
)
fun findByEmailNative(email: String): User?
```

### 민감 데이터 암호화

```kotlin
// ✅ GOOD: @Convert를 사용한 자동 암호화/복호화
@Converter
class EncryptionConverter(
    private val encryptionService: EncryptionService
) : AttributeConverter<String, String> {

    override fun convertToDatabaseColumn(attribute: String?): String? {
        return attribute?.let { encryptionService.encrypt(it) }
    }

    override fun convertToEntityAttribute(dbData: String?): String? {
        return dbData?.let { encryptionService.decrypt(it) }
    }
}

@Entity
@Table(name = "users")
class User(
    @Column(nullable = false, unique = true, length = 255)
    var email: String,

    @Column(nullable = false, length = 255)
    var name: String,

    @Convert(converter = EncryptionConverter::class)
    @Column(nullable = true, length = 500)
    var socialSecurityNumber: String? = null,  // 주민등록번호 암호화

    @Convert(converter = EncryptionConverter::class)
    @Column(nullable = true, length = 500)
    var phoneNumber: String? = null,  // 전화번호 암호화

    @Column(nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    var status: UserStatus = UserStatus.ACTIVE
) : BaseEntity()

@Component
class EncryptionService(
    @Value("\${encryption.secret-key}")
    private val secretKey: String
) {
    private val algorithm = "AES/CBC/PKCS5Padding"

    fun encrypt(data: String): String {
        // AES 암호화 구현
        val cipher = Cipher.getInstance(algorithm)
        val keySpec = SecretKeySpec(secretKey.toByteArray(), "AES")
        cipher.init(Cipher.ENCRYPT_MODE, keySpec)
        val encrypted = cipher.doFinal(data.toByteArray())
        return Base64.getEncoder().encodeToString(encrypted)
    }

    fun decrypt(encryptedData: String): String {
        // AES 복호화 구현
        val cipher = Cipher.getInstance(algorithm)
        val keySpec = SecretKeySpec(secretKey.toByteArray(), "AES")
        cipher.init(Cipher.DECRYPT_MODE, keySpec)
        val decrypted = cipher.doFinal(Base64.getDecoder().decode(encryptedData))
        return String(decrypted)
    }
}
```

### SQL Injection 방지

```kotlin
// ✅ GOOD: 파라미터 바인딩 사용
@Repository
interface UserRepository : JpaRepository<User, Long> {

    @Query("SELECT u FROM User u WHERE u.email = :email AND u.deletedAt IS NULL")
    fun findByEmail(email: String): Optional<User>
}

// ❌ BAD: 문자열 연결로 쿼리 생성 (SQL Injection 위험)
@Repository
class UserQueryRepository(
    @PersistenceContext
    private val entityManager: EntityManager
) {
    fun findByEmailUnsafe(email: String): User? {
        // ❌ 절대 이렇게 하지 말 것
        val query = entityManager.createQuery(
            "SELECT u FROM User u WHERE u.email = '$email' AND u.deletedAt IS NULL",
            User::class.java
        )
        return query.singleResult
    }
}

// ✅ GOOD: Native Query도 파라미터 바인딩 사용
@Query(
    value = "SELECT * FROM users WHERE email = :email AND deleted_at IS NULL",
    nativeQuery = true
)
fun findByEmailNative(@Param("email") email: String): User?
```

## 체크리스트

### 쿼리 작성 시
- [ ] 모든 WHERE 절에 `deletedAt IS NULL` 조건이 포함되어 있는가?
- [ ] DELETE 쿼리 대신 Soft Delete를 사용하는가?
- [ ] INSERT/UPDATE 시 Audit Trail 필드를 업데이트하는가?
- [ ] 프로젝션(DTO)을 사용하여 필요한 필드만 조회하는가?
- [ ] SELECT * 대신 명시적인 컬럼을 지정하는가?
- [ ] SQL Injection 방지를 위해 파라미터 바인딩을 사용하는가?

### 테이블 설계 시
- [ ] Audit Trail 5가지 필드가 모두 포함되어 있는가?
- [ ] deleted_at 컬럼이 존재하는가?
- [ ] 적절한 인덱스가 생성되어 있는가?
- [ ] 복합 인덱스의 컬럼 순서가 올바른가? (카디널리티 높은 순)
- [ ] Foreign Key 제약조건이 설정되어 있는가?
- [ ] 민감 데이터에 암호화가 적용되어 있는가?

### 성능 최적화
- [ ] N+1 문제가 없는가? (Fetch Join 또는 Batch Size 설정)
- [ ] 프로젝션을 사용하여 불필요한 데이터를 조회하지 않는가?
- [ ] 페이징을 적용했는가?
- [ ] 인덱스를 활용하는 쿼리인가?
- [ ] 대용량 처리 시 배치 처리를 사용하는가?
- [ ] EntityManager flush/clear 패턴으로 메모리를 관리하는가?
- [ ] 조회 빈도가 높은 데이터에 캐싱을 적용했는가?

### 동시성 제어
- [ ] 동시 수정이 발생할 수 있는 데이터에 잠금을 적용했는가?
- [ ] 낙관적 잠금 vs 비관적 잠금 중 적절한 방식을 선택했는가?
- [ ] OptimisticLockException 발생 시 재시도 로직이 있는가?
- [ ] 비관적 잠금 사용 시 타임아웃을 설정했는가?
- [ ] 데드락 방지를 위해 잠금 순서를 정렬했는가?

### 트랜잭션 관리
- [ ] @Transactional 어노테이션이 적절히 적용되어 있는가?
- [ ] 격리 수준(Isolation Level)을 명시적으로 설정했는가?
- [ ] 전파 옵션(Propagation)이 비즈니스 요구사항에 맞는가?
- [ ] REQUIRED vs REQUIRES_NEW를 올바르게 사용하는가?
- [ ] 읽기 전용 트랜잭션에 readOnly = true를 설정했는가?

### 보안
- [ ] 삭제된 데이터가 조회되지 않도록 방어했는가?
- [ ] 민감 데이터가 암호화되어 저장되는가?
- [ ] SQL Injection 공격에 대한 방어가 되어 있는가?
- [ ] 사용자 권한을 검증하는가?
- [ ] 개인정보는 최소한으로만 수집하고 있는가?
