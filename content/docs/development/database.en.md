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

## Checklist

**When writing queries:**
- [ ] Does every WHERE clause include the `deletedAt IS NULL` condition?
- [ ] Are you using Soft Delete instead of DELETE queries?
- [ ] Are you updating Audit Trail fields during INSERT/UPDATE?
- [ ] Are you using projections (DTOs) to query only required fields?

**When designing tables:**
- [ ] Does the table include all 5 Audit Trail fields?
- [ ] Does the deleted_at column exist?
- [ ] Are appropriate indexes created?
- [ ] Are Foreign Key constraints configured?

**Performance optimization:**
- [ ] Is there no N+1 problem? (Fetch Join or Batch Size configuration)
- [ ] Are you using projections to avoid querying unnecessary data?
- [ ] Did you apply pagination?
- [ ] Does the query utilize indexes?
