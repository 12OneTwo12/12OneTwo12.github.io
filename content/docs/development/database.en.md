---
title: Database
weight: 6
---

Principles and query writing rules I follow when working with databases.

## Core Principles

### 1. Audit Trail (Required 5 Fields)

All tables must include these 5 required fields:

```sql
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,

    -- Audit Trail fields (required)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by BIGINT,
    deleted_at TIMESTAMP NULL  -- For Soft Delete
);
```

### 2. Soft Delete (Physical Delete Forbidden)

**Absolutely Forbidden**: No `DELETE` queries

```kotlin
// ❌ BAD: Physical deletion (absolutely forbidden)
fun deleteUser(userId: Long) {
    userRepository.deleteById(userId)  // ❌ Absolutely forbidden
}

// ✅ GOOD: Soft Delete only (logical deletion)
fun deleteUser(userId: Long, deletedBy: Long) {
    val user = userRepository.findById(userId).orElseThrow()
    user.delete(deletedBy)  // Set deletedAt, updatedAt, updatedBy
    userRepository.save(user)
}
```

### 3. JPA Entity Design

**Base Entity with Audit Trail and Soft Delete**

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

### Basic Queries

```kotlin
interface UserRepository : JpaRepository<User, Long> {

    // Single query (excluding Soft Delete)
    @Query("SELECT u FROM User u WHERE u.id = :id AND u.deletedAt IS NULL")
    fun findByIdAndNotDeleted(id: Long): Optional<User>

    // Find by email
    @Query("SELECT u FROM User u WHERE u.email = :email AND u.deletedAt IS NULL")
    fun findByEmailAndNotDeleted(email: String): Optional<User>

    // Find all (excluding Soft Delete)
    @Query("SELECT u FROM User u WHERE u.deletedAt IS NULL ORDER BY u.createdAt DESC")
    fun findAllNotDeleted(): List<User>

    // Find by status
    @Query("SELECT u FROM User u WHERE u.status = :status AND u.deletedAt IS NULL ORDER BY u.createdAt DESC")
    fun findByStatusAndNotDeleted(status: UserStatus): List<User>

    // Check existence
    @Query("SELECT COUNT(u) > 0 FROM User u WHERE u.email = :email AND u.deletedAt IS NULL")
    fun existsByEmailAndNotDeleted(email: String): Boolean
}
```

### INSERT

```kotlin
// ✅ GOOD: Audit Trail automatically set (using AuditingEntityListener)
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
// ✅ GOOD: Include Audit Trail update
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
// ✅ GOOD: Only Soft Delete allowed
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

// ❌ BAD: Physical deletion absolutely forbidden
@Service
class UserService(
    private val userRepository: UserRepository
) {
    fun hardDeleteUser(userId: Long) {
        userRepository.deleteById(userId)  // ❌ Absolutely forbidden
    }
}
```

## Using QueryDSL

### Configuration

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

### Basic Queries

```kotlin
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user

    // Single query
    fun findById(id: Long): User? {
        return queryFactory
            .selectFrom(user)
            .where(
                user.id.eq(id),
                user.deletedAt.isNull
            )
            .fetchOne()
    }

    // List query
    fun findAll(): List<User> {
        return queryFactory
            .selectFrom(user)
            .where(user.deletedAt.isNull)
            .orderBy(user.createdAt.desc())
            .fetch()
    }

    // Conditional query
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

### JOIN Queries

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

### Pagination

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

### Aggregate Functions

```kotlin
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user
    private val order = QOrder.order

    // COUNT, SUM, AVG, etc.
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

### Subqueries

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

### EXISTS Queries

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

## Dynamic Queries

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

## Projection (Direct DTO Query)

```kotlin
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user

    // ✅ GOOD: Query only required fields as DTO
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

    // Using @QueryProjection (type-safe)
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

// Using @QueryProjection
data class UserProjection @QueryProjection constructor(
    val id: Long,
    val email: String,
    val name: String,
    val status: UserStatus
)
```

## Transactions

```kotlin
// ✅ GOOD: Manage transactions with @Transactional
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

        // Related Orders Soft Delete
        val orders = orderRepository.findByUserIdAndNotDeleted(userId)
        orders.forEach { it.delete(deletedBy) }
        orderRepository.saveAll(orders)
    }
}
```

## Bulk Operations

```kotlin
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user

    // ✅ GOOD: Bulk update (for large data processing)
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

    // ❌ BAD: Bulk delete forbidden (use Soft Delete)
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

## Index Strategy

### Recommended Indexes

```sql
-- Primary Key (automatically created)
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    -- ...
);

-- Unique constraint (index automatically created)
CREATE UNIQUE INDEX idx_users_email ON users(email, deleted_at);

-- Frequently queried columns
CREATE INDEX idx_users_status ON users(status, deleted_at);

-- Composite index
CREATE INDEX idx_users_status_created_at ON users(status, created_at, deleted_at);

-- Foreign Key
CREATE INDEX idx_orders_user_id ON orders(user_id, deleted_at);
```

## Solving N+1 Problem

```kotlin
// ❌ BAD: N+1 problem occurs
@Entity
class User(
    // ...
    @OneToMany(mappedBy = "user")
    val orders: List<Order> = emptyList()
)

fun getUsers(): List<User> {
    return userRepository.findAll()  // 1 query
    // N queries occur when accessing orders
}

// ✅ GOOD: Solve with Fetch Join
@Repository
interface UserRepository : JpaRepository<User, Long> {
    @Query("SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.orders o WHERE u.deletedAt IS NULL AND (o.deletedAt IS NULL OR o IS NULL)")
    fun findAllWithOrders(): List<User>
}

// ✅ GOOD: Solve with QueryDSL
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

## Concurrency Control

### Optimistic Locking

Used in environments where conflicts rarely occur. Suitable when there are many reads and few updates.

```kotlin
// ✅ GOOD: Optimistic locking with @Version
@Entity
@Table(name = "products")
class Product(
    @Column(nullable = false, length = 255)
    var name: String,

    @Column(nullable = false)
    var stock: Int,

    @Column(nullable = false)
    var price: Long,

    @Version  // Version field for optimistic locking
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
            // Retry logic on concurrency conflict
            throw ConcurrencyException("Product was modified by another transaction. Please retry.")
        }
    }

    // ✅ GOOD: With retry logic
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
                Thread.sleep(100 * attempts.toLong()) // Exponential backoff
            }
        }
        throw ConcurrencyException("Unexpected error in retry logic")
    }
}
```

**Use cases:**
- Many reads and few updates
- Low conflict probability
- Reducing database lock overhead

### Pessimistic Locking

Used in environments where conflicts occur frequently. Suitable for inventory management, reservation systems, etc.

```kotlin
// ✅ GOOD: Inventory management with pessimistic locking
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
        // Query product with pessimistic lock (other transactions wait)
        val product = productRepository.findByIdWithLock(productId)
            .orElseThrow { NotFoundException("Product not found") }

        // Check stock
        if (product.stock < quantity) {
            throw InsufficientStockException("Insufficient stock")
        }

        // Deduct stock
        product.stock -= quantity
        product.updatedBy = createdBy
        product.updatedAt = LocalDateTime.now()
        productRepository.save(product)

        // Create order
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

// ❌ BAD: Deducting stock without lock (concurrency issues)
@Service
class OrderService(
    private val productRepository: ProductRepository,
    private val orderRepository: OrderRepository
) {
    @Transactional
    fun createOrderUnsafe(productId: Long, quantity: Int, createdBy: Long): Order {
        val product = productRepository.findByIdAndNotDeleted(productId)
            .orElseThrow { NotFoundException("Product not found") }

        // ❌ Multiple concurrent requests can cause negative stock
        if (product.stock < quantity) {
            throw InsufficientStockException("Insufficient stock")
        }

        product.stock -= quantity  // ❌ Concurrency issue
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

**Use cases:**
- Inventory management (stock deduction)
- Seat reservation systems
- Financial transactions
- Frequent conflicts

**Deadlock prevention strategy:**

```kotlin
// ✅ GOOD: Sorted lock acquisition to prevent deadlocks
@Service
class TransferService(
    private val accountRepository: AccountRepository
) {
    @Transactional
    fun transfer(fromAccountId: Long, toAccountId: Long, amount: Long, transferBy: Long) {
        // Always acquire locks in ID order (prevents deadlock)
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

## Performance Optimization

### Batch Processing

Memory-efficient processing of large data volumes.

```kotlin
// ✅ GOOD: Memory management with EntityManager flush/clear pattern
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

            // Flush to DB and clear 1st level cache per batch
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

// ❌ BAD: Processing large data at once (OutOfMemoryError risk)
@Service
class UserBatchService(
    private val userRepository: UserRepository
) {
    @Transactional
    fun createUsersUnsafe(users: List<CreateUserRequest>, createdBy: Long) {
        // ❌ Loading hundreds of thousands of records into memory at once
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
        userRepository.saveAll(entities)  // ❌ Memory overflow risk
    }
}
```

**application.yml batch configuration:**

```yaml
spring:
  jpa:
    properties:
      hibernate:
        jdbc:
          batch_size: 100  # Batch size setting
        order_inserts: true  # Sort INSERT statements
        order_updates: true  # Sort UPDATE statements
```

### Query Optimization

```kotlin
// ❌ BAD: Using SELECT * (querying unnecessary columns)
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user

    fun findAllUsers(): List<User> {
        return queryFactory
            .selectFrom(user)  // ❌ Querying all columns
            .where(user.deletedAt.isNull)
            .fetch()
    }
}

// ✅ GOOD: DTO Projection to query only required columns
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
                    // Audit Trail fields excluded
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

**Native Query precautions:**

```kotlin
// ✅ GOOD: Explicit column specification in Native Query
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

// ❌ BAD: Using SELECT *
@Repository
interface UserRepository : JpaRepository<User, Long> {

    @Query(
        value = "SELECT * FROM users WHERE status = :status AND deleted_at IS NULL",
        nativeQuery = true
    )
    fun findByStatusUnsafe(status: String): List<User>  // ❌ Errors when columns added/removed
}
```

### Caching Strategy

```kotlin
// ✅ GOOD: Caching frequently accessed data
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
        // Refresh entire cache
    }
}
```

## Enhanced Transaction Management

### Isolation Level

```kotlin
// ✅ GOOD: Explicit isolation level setting
@Service
class PaymentService(
    private val paymentRepository: PaymentRepository,
    private val accountRepository: AccountRepository
) {
    // READ_COMMITTED: Read only committed data (default, suitable for most cases)
    @Transactional(isolation = Isolation.READ_COMMITTED)
    fun processPayment(paymentId: Long, processedBy: Long): Payment {
        val payment = paymentRepository.findById(paymentId)
            .orElseThrow { NotFoundException("Payment not found") }

        payment.status = PaymentStatus.COMPLETED
        payment.updatedBy = processedBy

        return paymentRepository.save(payment)
    }

    // REPEATABLE_READ: Same data returns same result within transaction
    @Transactional(isolation = Isolation.REPEATABLE_READ)
    fun calculateBalance(accountId: Long): BalanceReport {
        val account = accountRepository.findById(accountId)
            .orElseThrow { NotFoundException("Account not found") }

        val initialBalance = account.balance

        // Business logic...
        Thread.sleep(1000)

        val finalBalance = account.balance
        // REPEATABLE_READ guarantees initialBalance == finalBalance

        return BalanceReport(initialBalance, finalBalance)
    }

    // SERIALIZABLE: Highest isolation level (low concurrency, maximum consistency)
    @Transactional(isolation = Isolation.SERIALIZABLE)
    fun criticalFinancialOperation(fromAccountId: Long, toAccountId: Long, amount: Long) {
        // Only use when absolute consistency is required (financial transactions)
        // Can significantly degrade performance
    }
}
```

**Isolation level characteristics:**

| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read | Performance | Use Case |
|----------------|-----------|---------------------|--------------|-------------|----------|
| READ_UNCOMMITTED | Occurs | Occurs | Occurs | Highest | Rarely used |
| READ_COMMITTED | Prevented | Occurs | Occurs | High | Most cases (default) |
| REPEATABLE_READ | Prevented | Prevented | Occurs | Medium | Transaction consistency needed |
| SERIALIZABLE | Prevented | Prevented | Prevented | Low | Critical operations (financial) |

### Propagation Options

```kotlin
// ✅ GOOD: Understanding and using propagation options
@Service
class OrderService(
    private val orderRepository: OrderRepository,
    private val notificationService: NotificationService,
    private val loggingService: LoggingService
) {
    // REQUIRED (default): Join existing transaction or create new one
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

        // Join same transaction (notification rolls back if order creation fails)
        notificationService.sendOrderConfirmation(savedOrder.id, createdBy)

        return savedOrder
    }

    // REQUIRES_NEW: Always create new transaction (suspend existing one)
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

            // Separate transaction for logging (log saved even if order fails)
            loggingService.logOrderCreation(savedOrder.id)

            return savedOrder
        } catch (e: Exception) {
            // Log already committed even if order fails
            throw e
        }
    }
}

@Service
class LoggingService(
    private val orderLogRepository: OrderLogRepository
) {
    // REQUIRES_NEW: Independent transaction (log must be saved)
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
    // REQUIRED: Join existing transaction
    @Transactional(propagation = Propagation.REQUIRED)
    fun sendOrderConfirmation(orderId: Long, userId: Long) {
        // Works as part of order transaction
        // Order rolls back if notification fails
    }
}
```

**Propagation options guide:**

- **REQUIRED** (default): Use for most cases
- **REQUIRES_NEW**: Audit logs, event records that need independent storage
- **SUPPORTS**: Read-only operations not requiring transactions
- **NOT_SUPPORTED**: Run without transaction (performance optimization)
- **MANDATORY**: Must be called within transaction (validation)
- **NEVER**: Exception if called within transaction (validation)

## Enhanced Index Strategy

### Composite Index Order

```sql
-- ✅ GOOD: High cardinality columns first
CREATE INDEX idx_users_email_status ON users(email, status, deleted_at);
-- email (high cardinality) -> status (low cardinality) -> deleted_at

-- ✅ GOOD: Consider WHERE clause usage frequency
CREATE INDEX idx_orders_status_created_at ON orders(status, created_at, deleted_at);
-- Frequently filter by status and sort by created_at

-- ❌ BAD: Low cardinality column first
CREATE INDEX idx_users_status_email ON users(status, email, deleted_at);
-- status (low cardinality) first reduces index efficiency

-- ✅ GOOD: Range search columns at the end
CREATE INDEX idx_orders_user_id_created_at ON orders(user_id, created_at, deleted_at);
-- user_id (=) -> created_at (range search)
```

**Index order principles:**
1. High cardinality columns first (email, unique ID, etc.)
2. Frequently used columns in WHERE clause first
3. Equality (=) comparison before range search columns
4. deleted_at always last

### Index Anti-patterns

```sql
-- ❌ BAD: Excessive index creation
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

-- ❌ Too many single indexes (INSERT/UPDATE performance degradation)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_users_age ON users(age);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_city ON users(city);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ✅ GOOD: Create only necessary composite indexes
CREATE UNIQUE INDEX idx_users_email ON users(email, deleted_at);
CREATE INDEX idx_users_status_created_at ON users(status, created_at, deleted_at);
CREATE INDEX idx_users_city_status ON users(city, status, deleted_at);

-- ❌ BAD: Leaving unused indexes
-- Periodically check and remove unused indexes
SELECT
    index_name,
    table_name,
    seq_in_index,
    column_name
FROM information_schema.statistics
WHERE table_schema = 'your_database'
  AND table_name = 'users'
ORDER BY index_name, seq_in_index;

-- Check index usage statistics in MySQL
SELECT * FROM sys.schema_unused_indexes WHERE object_schema = 'your_database';
```

**Index creation guide:**
- Limit indexes to 5-7 per table
- Create only on columns frequently used in WHERE, JOIN, ORDER BY
- Cover multiple query patterns with composite indexes
- Periodically remove unused indexes
- Monitor index size (recommended within 20% of table size)

## Security

### Soft Delete Security

```kotlin
// ✅ GOOD: Thoroughly prevent deleted data access
@Repository
interface UserRepository : JpaRepository<User, Long> {

    @Query("SELECT u FROM User u WHERE u.id = :id AND u.deletedAt IS NULL")
    fun findByIdAndNotDeleted(id: Long): Optional<User>

    // ❌ BAD: Missing deletedAt check
    @Query("SELECT u FROM User u WHERE u.id = :id")
    fun findByIdUnsafe(id: Long): Optional<User>  // Deleted data also retrieved
}

// ✅ GOOD: Always check deletedAt in QueryDSL
@Repository
class UserQueryRepository(
    private val queryFactory: JPAQueryFactory
) {
    private val user = QUser.user

    fun findAll(): List<User> {
        return queryFactory
            .selectFrom(user)
            .where(user.deletedAt.isNull)  // ✅ Required
            .fetch()
    }

    // ❌ BAD: Missing deletedAt check
    fun findAllUnsafe(): List<User> {
        return queryFactory
            .selectFrom(user)
            .fetch()  // ❌ Deleted data also retrieved
    }
}

// ✅ GOOD: Check in Native Query too
@Query(
    value = "SELECT * FROM users WHERE email = :email AND deleted_at IS NULL",
    nativeQuery = true
)
fun findByEmailNative(email: String): User?
```

### Sensitive Data Encryption

```kotlin
// ✅ GOOD: Automatic encryption/decryption with @Convert
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
    var socialSecurityNumber: String? = null,  // Social security number encryption

    @Convert(converter = EncryptionConverter::class)
    @Column(nullable = true, length = 500)
    var phoneNumber: String? = null,  // Phone number encryption

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
        // AES encryption implementation
        val cipher = Cipher.getInstance(algorithm)
        val keySpec = SecretKeySpec(secretKey.toByteArray(), "AES")
        cipher.init(Cipher.ENCRYPT_MODE, keySpec)
        val encrypted = cipher.doFinal(data.toByteArray())
        return Base64.getEncoder().encodeToString(encrypted)
    }

    fun decrypt(encryptedData: String): String {
        // AES decryption implementation
        val cipher = Cipher.getInstance(algorithm)
        val keySpec = SecretKeySpec(secretKey.toByteArray(), "AES")
        cipher.init(Cipher.DECRYPT_MODE, keySpec)
        val decrypted = cipher.doFinal(Base64.getDecoder().decode(encryptedData))
        return String(decrypted)
    }
}
```

### SQL Injection Prevention

```kotlin
// ✅ GOOD: Use parameter binding
@Repository
interface UserRepository : JpaRepository<User, Long> {

    @Query("SELECT u FROM User u WHERE u.email = :email AND u.deletedAt IS NULL")
    fun findByEmail(email: String): Optional<User>
}

// ❌ BAD: Creating query with string concatenation (SQL Injection risk)
@Repository
class UserQueryRepository(
    @PersistenceContext
    private val entityManager: EntityManager
) {
    fun findByEmailUnsafe(email: String): User? {
        // ❌ Never do this
        val query = entityManager.createQuery(
            "SELECT u FROM User u WHERE u.email = '$email' AND u.deletedAt IS NULL",
            User::class.java
        )
        return query.singleResult
    }
}

// ✅ GOOD: Use parameter binding in Native Query too
@Query(
    value = "SELECT * FROM users WHERE email = :email AND deleted_at IS NULL",
    nativeQuery = true
)
fun findByEmailNative(@Param("email") email: String): User?
```

## Checklist

### When Writing Queries
- [ ] Does every WHERE clause include the `deletedAt IS NULL` condition?
- [ ] Are you using Soft Delete instead of DELETE queries?
- [ ] Are you updating Audit Trail fields during INSERT/UPDATE?
- [ ] Are you using projections (DTOs) to query only required fields?
- [ ] Are you specifying explicit columns instead of SELECT *?
- [ ] Are you using parameter binding to prevent SQL Injection?

### When Designing Tables
- [ ] Does the table include all 5 Audit Trail fields?
- [ ] Does the deleted_at column exist?
- [ ] Are appropriate indexes created?
- [ ] Is the composite index column order correct? (high cardinality first)
- [ ] Are Foreign Key constraints configured?
- [ ] Is encryption applied to sensitive data?

### Performance Optimization
- [ ] Is there no N+1 problem? (Fetch Join or Batch Size configuration)
- [ ] Are you using projections to avoid querying unnecessary data?
- [ ] Did you apply pagination?
- [ ] Does the query utilize indexes?
- [ ] Are you using batch processing for large data volumes?
- [ ] Are you managing memory with EntityManager flush/clear pattern?
- [ ] Is caching applied to frequently accessed data?

### Concurrency Control
- [ ] Is locking applied to data that can be concurrently modified?
- [ ] Did you choose between optimistic vs pessimistic locking appropriately?
- [ ] Is there retry logic for OptimisticLockException?
- [ ] Is timeout configured when using pessimistic locking?
- [ ] Are locks sorted to prevent deadlocks?

### Transaction Management
- [ ] Is @Transactional annotation properly applied?
- [ ] Is the Isolation Level explicitly configured?
- [ ] Does the Propagation option match business requirements?
- [ ] Are you using REQUIRED vs REQUIRES_NEW correctly?
- [ ] Is readOnly = true set for read-only transactions?

### Security
- [ ] Are deleted data prevented from being queried?
- [ ] Is sensitive data encrypted before storage?
- [ ] Is there protection against SQL Injection attacks?
- [ ] Are user permissions validated?
- [ ] Is personal information collected minimally?
