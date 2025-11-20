---
title: Architecture
weight: 3
---

The principle I consider important in development is **clear separation of concerns**. Regardless of the architectural pattern, each layer's responsibility must be clearly separated.

## Layer Structure Example (MVC Pattern)

A typical example of layered architecture is the Controller-Service-Repository 3-layer structure:

```
┌────────────────────────┐
│   Controller Layer     │  ← HTTP request/response only
├────────────────────────┤
│   Service Layer        │  ← Business logic only
├────────────────────────┤
│   Repository Layer     │  ← Database access only
└────────────────────────┘
```

**Core Principles**:
- **Controller calls Service only**: Direct Repository calls forbidden
- **Service does not invade Repository layer responsibilities**: Direct query writing forbidden (utility classes and external service calls are allowed)
- **Each layer has single responsibility**: Clear separation of concerns between layers

## Controller Layer

### Role

**Controller handles HTTP request/response only.**

- Receive and validate HTTP requests
- Call Service layer
- Generate HTTP responses (including status codes, headers)
- DTO transformation (Request DTO → Service, Domain → Response DTO)

### Allowed Operations

```kotlin
@RestController
@RequestMapping("/api/v1/users")
class UserController(
    private val userService: UserService  // ✅ Service dependency only
) {
    companion object {
        private val logger = LoggerFactory.getLogger(UserController::class.java)
    }

    @GetMapping("/{id}")
    fun getUser(@PathVariable id: UUID): ResponseEntity<UserResponse> {
        logger.info("GET /api/v1/users/{}", id)

        // ✅ GOOD: Only Service calls and HTTP response generation
        val user = userService.getUserById(id)
        return user?.let { ResponseEntity.ok(UserResponse.from(it)) }
            ?: ResponseEntity.notFound().build()
    }

    @PostMapping
    fun createUser(@Valid @RequestBody request: CreateUserRequest): ResponseEntity<UserResponse> {
        logger.info("POST /api/v1/users: email={}", request.email)

        // ✅ GOOD: Validation via Bean Validation, business logic in Service
        val user = userService.createUser(request)
        return ResponseEntity.status(HttpStatus.CREATED)
            .header("Location", "/api/v1/users/${user.id}")
            .body(UserResponse.from(user))
    }
}
```

### Forbidden Operations

```kotlin
// ❌ BAD: Direct Repository call
@RestController
class UserController(
    private val userRepository: UserRepository  // ❌ Repository dependency forbidden
) {
    @GetMapping("/{id}")
    fun getUser(@PathVariable id: UUID): ResponseEntity<User> {
        return userRepository.findById(id)  // ❌ Direct Repository call from Controller
            .map { ResponseEntity.ok(it) }
            .orElse(ResponseEntity.notFound().build())
    }
}

// ❌ BAD: Contains business logic
@RestController
class UserController(
    private val userService: UserService
) {
    @PostMapping
    fun createUser(@RequestBody request: CreateUserRequest): ResponseEntity<UserResponse> {
        // ❌ Email duplicate check is business logic → Should be in Service
        if (userService.existsByEmail(request.email)) {
            throw BusinessException("Email already exists")
        }
        val user = userService.createUser(request)
        return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(user))
    }
}

// ❌ BAD: Transaction management
@RestController
class UserController {
    @Transactional  // ❌ Transaction management in Controller forbidden
    @PostMapping
    fun createUser(@RequestBody request: CreateUserRequest): ResponseEntity<UserResponse> {
        // ...
    }
}
```

## Service Layer

### Role

**Service handles business logic only.**

- Implement business rules
- Transaction management
- Domain object manipulation
- External service calls (event publishing, external APIs, etc.)
- Combine multiple Repositories

### Allowed Operations

```kotlin
@Service
class UserService(
    private val userRepository: UserRepository,  // ✅ Repository dependency
    private val eventPublisher: EventPublisher    // ✅ External service dependency
) {
    companion object {
        private val logger = LoggerFactory.getLogger(UserService::class.java)
    }

    // ✅ GOOD: Business logic implementation
    @Transactional
    fun createUser(request: CreateUserRequest): User {
        logger.info("Creating user: email={}", request.email)

        // ✅ Duplicate check (business rule)
        if (userRepository.existsByEmail(request.email)) {
            throw BusinessException("Email already exists")
        }

        val user = User(
            id = UUID.randomUUID(),
            email = request.email,
            name = request.name,
            createdAt = LocalDateTime.now()
        )

        // ✅ Repository call
        val savedUser = userRepository.save(user)

        // ✅ Event publishing
        eventPublisher.publish(UserCreatedEvent(savedUser.id))

        return savedUser
    }

    // ✅ GOOD: Combine multiple Repositories
    @Transactional
    fun transferOwnership(userId: UUID, targetUserId: UUID) {
        val user = userRepository.findById(userId)
            .orElseThrow { UserNotFoundException(userId) }
        val targetUser = userRepository.findById(targetUserId)
            .orElseThrow { UserNotFoundException(targetUserId) }

        // Business logic: Transfer ownership
        orderRepository.updateOwner(user.id, targetUser.id)
    }
}
```

### Forbidden Operations

```kotlin
// ❌ BAD: HTTP response generation
@Service
class UserService {
    fun createUser(request: CreateUserRequest): ResponseEntity<UserResponse> {  // ❌ ResponseEntity return forbidden
        // ...
        return ResponseEntity.status(HttpStatus.CREATED).body(response)  // ❌ HTTP related code
    }
}

// ❌ BAD: HTTP status code handling
@Service
class UserService {
    fun getUser(id: UUID): User {
        return userRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND) }  // ❌ HTTP status code
    }
}

// ❌ BAD: Using @Valid
@Service
class UserService {
    fun createUser(@Valid request: CreateUserRequest): User {  // ❌ @Valid only in Controller
        // ...
    }
}
```

## Repository Layer

### Role

**Repository handles database access only.**

- CRUD operations
- Query execution
- Data persistence management

### Allowed Operations

```kotlin
interface UserRepository : JpaRepository<User, UUID> {

    // ✅ GOOD: Simple query
    fun findByEmail(email: String): Optional<User>

    // ✅ GOOD: Existence check
    fun existsByEmail(email: String): Boolean

    // ✅ GOOD: Conditional query
    @Query("SELECT u FROM User u WHERE u.status = :status AND u.deletedAt IS NULL")
    fun findAllByStatus(@Param("status") status: String): List<User>

    // ✅ GOOD: Complex query
    @Query("""
        SELECT u FROM User u
        JOIN u.orders o
        WHERE o.createdAt >= :since
        GROUP BY u.id
        HAVING COUNT(o.id) > :minOrders
    """)
    fun findActiveUsers(@Param("since") since: LocalDateTime, @Param("minOrders") minOrders: Int): List<User>
}
```

### Forbidden Operations

```kotlin
// ❌ BAD: Contains business logic
interface UserRepository : JpaRepository<User, UUID> {

    // ❌ Check email then save → Business logic should be in Service
    fun saveIfEmailNotExists(user: User): User {
        if (existsByEmail(user.email)) {
            throw BusinessException("Email exists")
        }
        return save(user)
    }
}

// ❌ BAD: Transaction management
interface UserRepository : JpaRepository<User, UUID> {

    @Transactional  // ❌ Transaction management in Repository forbidden (managed by Service)
    fun deleteByEmail(email: String)
}

// ❌ BAD: Event publishing
class UserRepositoryImpl(
    private val eventPublisher: EventPublisher
) {

    fun save(user: User): User {
        val savedUser = entityManager.persist(user)
        eventPublisher.publish(UserCreatedEvent(savedUser.id))  // ❌ Event publishing in Repository forbidden
        return savedUser
    }
}
```

## Data Flow Between Layers

### Request Flow (Request → Domain)

```kotlin
// 1. Controller: Receive Request DTO
data class CreateUserRequest(
    val email: String,
    val name: String
)

// 2. Service: Create Domain object
@Service
class UserService {
    @Transactional
    fun createUser(request: CreateUserRequest): User {
        val user = User(
            id = UUID.randomUUID(),
            email = request.email,
            name = request.name
        )
        return userRepository.save(user)
    }
}

// 3. Repository: Save Domain object
interface UserRepository : JpaRepository<User, UUID>
```

### Response Flow (Domain → Response)

```kotlin
// 1. Repository: Return Domain object
interface UserRepository : JpaRepository<User, UUID> {
    override fun findById(id: UUID): Optional<User>
}

// 2. Service: Return Domain object (no transformation)
@Service
class UserService {
    @Transactional(readOnly = true)
    fun getUserById(id: UUID): User? {
        return userRepository.findById(id).orElse(null)
    }
}

// 3. Controller: Transform to Response DTO
@RestController
class UserController {
    @GetMapping("/{id}")
    fun getUser(@PathVariable id: UUID): ResponseEntity<UserResponse> {
        val user = userService.getUserById(id)
        return user?.let { ResponseEntity.ok(UserResponse.from(it)) }
            ?: ResponseEntity.notFound().build()
    }
}

// Response DTO
data class UserResponse(
    val id: UUID,
    val email: String,
    val name: String
) {
    companion object {
        fun from(user: User): UserResponse {
            return UserResponse(
                id = user.id,
                email = user.email,
                name = user.name
            )
        }
    }
}
```

## Service Dependencies

### No Same-Layer Calls

```kotlin
// ❌ BAD: Service directly calls another Service
@Service
class OrderService(
    private val userService: UserService,  // ❌ Same layer dependency forbidden
    private val productService: ProductService  // ❌ Same layer dependency forbidden
) {
    @Transactional
    fun createOrder(userId: UUID, productId: UUID): Order {
        val user = userService.getUserById(userId)  // ❌ Service → Service call
            ?: throw UserNotFoundException(userId)
        val product = productService.getProductById(productId)
            ?: throw ProductNotFoundException(productId)

        // Create Order
        return orderRepository.save(Order(userId = user.id, productId = product.id))
    }
}
```

### Solution 1: Direct Repository Call

```kotlin
// ✅ GOOD: Call Repository only
@Service
class OrderService(
    private val userRepository: UserRepository,  // ✅ Repository dependency
    private val productRepository: ProductRepository,  // ✅ Repository dependency
    private val orderRepository: OrderRepository
) {
    @Transactional
    fun createOrder(userId: UUID, productId: UUID): Order {
        val user = userRepository.findById(userId)  // ✅ Repository call
            .orElseThrow { UserNotFoundException(userId) }
        val product = productRepository.findById(productId)
            .orElseThrow { ProductNotFoundException(productId) }

        val order = Order(
            id = UUID.randomUUID(),
            userId = user.id,
            productId = product.id
        )
        return orderRepository.save(order)
    }
}
```

### Solution 2: Event-Based Communication

```kotlin
// ✅ GOOD: Loose coupling via events
@Service
class OrderService(
    private val orderRepository: OrderRepository,
    private val eventPublisher: EventPublisher
) {
    @Transactional
    fun createOrder(order: Order): Order {
        val savedOrder = orderRepository.save(order)

        // Publish event
        eventPublisher.publish(OrderCreatedEvent(savedOrder.id))

        return savedOrder
    }
}

// Other service receives event
@Service
class NotificationService {
    @EventListener
    @Async
    fun handleOrderCreated(event: OrderCreatedEvent) {
        // Send order completion notification
        sendNotification(event.orderId)
    }
}
```

## Layer-Specific Test Strategy

### Controller Test

```kotlin
@WebMvcTest(UserController::class)
class UserControllerTest {

    @MockBean
    private lateinit var userService: UserService

    @Autowired
    private lateinit var mockMvc: MockMvc

    @Test
    fun `should return user when exists`() {
        // Given
        val userId = UUID.randomUUID()
        val user = User(id = userId, email = "test@example.com", name = "Test")
        `when`(userService.getUserById(userId)).thenReturn(user)

        // When & Then
        mockMvc.perform(get("/api/v1/users/{id}", userId))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(userId.toString()))
            .andExpect(jsonPath("$.email").value("test@example.com"))
    }
}
```

### Service Test

```kotlin
@ExtendWith(MockitoExtension::class)
class UserServiceTest {

    @Mock
    private lateinit var userRepository: UserRepository

    @Mock
    private lateinit var eventPublisher: EventPublisher

    @InjectMocks
    private lateinit var userService: UserService

    @Test
    fun `should create user when email not exists`() {
        // Given
        val request = CreateUserRequest(email = "test@example.com", name = "Test")
        `when`(userRepository.existsByEmail(request.email)).thenReturn(false)
        `when`(userRepository.save(any())).thenAnswer { it.arguments[0] }

        // When
        val result = userService.createUser(request)

        // Then
        assertThat(result).isNotNull
        assertThat(result.email).isEqualTo("test@example.com")
        verify(userRepository).save(any())
        verify(eventPublisher).publish(any())
    }
}
```

### Repository Test

```kotlin
@DataJpaTest
class UserRepositoryTest {

    @Autowired
    private lateinit var userRepository: UserRepository

    @Test
    fun `should find user by email`() {
        // Given
        val user = User(
            id = UUID.randomUUID(),
            email = "test@example.com",
            name = "Test",
            createdAt = LocalDateTime.now()
        )
        userRepository.save(user)

        // When
        val found = userRepository.findByEmail("test@example.com").orElse(null)

        // Then
        assertThat(found).isNotNull
        assertThat(found?.email).isEqualTo("test@example.com")
    }
}
```

## DTO vs Entity Separation (Required)

### Never Expose Entity Directly

```kotlin
// ❌ BAD: Returning Entity directly
@GetMapping("/{id}")
fun getUser(@PathVariable id: UUID): User {  // ❌ Direct Entity exposure
    return userService.getUserById(id)
}

// ✅ GOOD: Convert to DTO
@GetMapping("/{id}")
fun getUser(@PathVariable id: UUID): ResponseEntity<UserResponse> {
    val user = userService.getUserById(id)
    return user?.let { ResponseEntity.ok(UserResponse.from(it)) }
        ?: ResponseEntity.notFound().build()
}
```

### DTO Conversion Location

**Principle: Convert DTO only in Controller**

```kotlin
// ✅ GOOD: DTO conversion in Controller
@RestController
class UserController(private val userService: UserService) {
    @GetMapping("/{id}")
    fun getUser(@PathVariable id: UUID): ResponseEntity<UserResponse> {
        val user = userService.getUserById(id)  // Service returns Domain
        return user?.let { ResponseEntity.ok(UserResponse.from(it)) }
            ?: ResponseEntity.notFound().build()
    }
}

// ❌ BAD: DTO return from Service
@Service
class UserService {
    fun getUserById(id: UUID): UserResponse {  // ❌ DTO return from Service forbidden
        val user = userRepository.findById(id).orElse(null)
        return UserResponse.from(user)
    }
}
```

### Preventing Circular References

```kotlin
// ❌ BAD: Circular reference occurs
@Entity
class User(
    val id: UUID,
    val name: String,
    @OneToMany(mappedBy = "user", fetch = FetchType.EAGER)
    val orders: List<Order> = emptyList()  // ❌ EAGER fetch
)

@Entity
class Order(
    val id: UUID,
    @ManyToOne(fetch = FetchType.EAGER)
    val user: User  // ❌ Circular reference
)

// ✅ GOOD: LAZY fetch + DTO usage
@Entity
class User(
    val id: UUID,
    val name: String,
    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)
    val orders: List<Order> = emptyList()  // ✅ LAZY fetch
)

@Entity
class Order(
    val id: UUID,
    @ManyToOne(fetch = FetchType.LAZY)
    val user: User  // ✅ LAZY fetch
)

// Expose only required data in Response DTO
data class UserResponse(
    val id: UUID,
    val name: String,
    val orderCount: Int  // Only required data instead of circular reference
)
```

## Security

### No Logging of Sensitive Information

```kotlin
// ❌ BAD: Logging sensitive information
@Service
class UserService {
    fun login(email: String, password: String): User {
        logger.info("Login attempt: email={}, password={}", email, password)  // ❌ Password logging
        // ...
    }
}

// ✅ GOOD: Mask sensitive information
@Service
class UserService {
    fun login(email: String, password: String): User {
        logger.info("Login attempt: email={}", email)  // ✅ Only email logged
        // ...
    }
}
```

### No Sensitive Information in Exception Messages

```kotlin
// ❌ BAD: Sensitive information in exception
class UserNotFoundException(userId: UUID, email: String) : RuntimeException(
    "User not found: userId=$userId, email=$email"  // ❌ Email exposure
)

// ✅ GOOD: Exclude sensitive information
class UserNotFoundException(userId: UUID) : RuntimeException(
    "User not found: userId=$userId"  // ✅ Only ID exposed
)
```

### SQL Injection Prevention

```kotlin
// ❌ BAD: Direct string concatenation
@Repository
class UserRepository(private val jdbcTemplate: JdbcTemplate) {
    fun findByEmail(email: String): User? {
        val sql = "SELECT * FROM users WHERE email = '$email'"  // ❌ SQL Injection risk
        return jdbcTemplate.queryForObject(sql, User::class.java)
    }
}

// ✅ GOOD: Use Prepared Statement
@Repository
interface UserRepository : JpaRepository<User, UUID> {
    @Query("SELECT u FROM User u WHERE u.email = :email")  // ✅ Parameter binding
    fun findByEmail(@Param("email") email: String): Optional<User>
}
```

## Performance

### Solving N+1 Query Problem

```kotlin
// ❌ BAD: N+1 problem occurs
@Service
class OrderService(private val orderRepository: OrderRepository) {
    fun getOrders(): List<Order> {
        return orderRepository.findAll()  // 1 query
        // N queries occur when accessing order.user
    }
}

// ✅ GOOD: Use Fetch Join
interface OrderRepository : JpaRepository<Order, UUID> {
    @Query("SELECT DISTINCT o FROM Order o LEFT JOIN FETCH o.user WHERE o.deletedAt IS NULL")
    fun findAllWithUser(): List<Order>
}

// ✅ GOOD: Use @EntityGraph
interface OrderRepository : JpaRepository<Order, UUID> {
    @EntityGraph(attributePaths = ["user"])
    @Query("SELECT o FROM Order o WHERE o.deletedAt IS NULL")
    fun findAllWithUser(): List<Order>
}
```

### Utilizing @Transactional(readOnly = true)

```kotlin
// ✅ GOOD: Read-only transaction
@Service
@Transactional(readOnly = true)  // readOnly at class level
class UserService {

    fun getUserById(id: UUID): User? {
        return userRepository.findById(id).orElse(null)
    }

    @Transactional  // Remove readOnly only for write operations
    fun createUser(request: CreateUserRequest): User {
        // ...
    }
}
```

### Pagination Handling

```kotlin
// ❌ BAD: Load all and paginate in memory
@Service
class UserService {
    fun getUsers(page: Int, size: Int): List<User> {
        val allUsers = userRepository.findAll()
        return allUsers.drop(page * size).take(size)  // ❌ Memory waste
    }
}

// ✅ GOOD: DB-level pagination
@Service
class UserService {
    fun getUsers(pageable: Pageable): Page<User> {
        return userRepository.findAll(pageable)  // ✅ Pagination at DB
    }
}
```

## Transaction

### Minimize Transaction Scope

```kotlin
// ❌ BAD: Transaction scope too large
@Service
class OrderService {
    @Transactional
    fun processOrder(orderId: UUID) {
        val order = orderRepository.findById(orderId).orElseThrow()

        // External API calls should be outside transaction
        val paymentResult = paymentGateway.charge(order.amount)  // ❌ External API call in transaction

        order.status = OrderStatus.COMPLETED
        orderRepository.save(order)
    }
}

// ✅ GOOD: Minimize transaction scope
@Service
class OrderService {
    fun processOrder(orderId: UUID) {
        // External API calls outside transaction
        val order = getOrder(orderId)
        val paymentResult = paymentGateway.charge(order.amount)

        // Only DB operations in transaction
        updateOrderStatus(orderId, OrderStatus.COMPLETED)
    }

    @Transactional(readOnly = true)
    fun getOrder(orderId: UUID): Order {
        return orderRepository.findById(orderId).orElseThrow()
    }

    @Transactional
    fun updateOrderStatus(orderId: UUID, status: OrderStatus) {
        val order = orderRepository.findById(orderId).orElseThrow()
        order.status = status
        orderRepository.save(order)
    }
}
```

### Understanding Propagation Options

```kotlin
@Service
class OrderService {
    // REQUIRED (default): Use existing transaction, create new if none exists
    @Transactional(propagation = Propagation.REQUIRED)
    fun createOrder(order: Order): Order {
        return orderRepository.save(order)
    }

    // REQUIRES_NEW: Always create new transaction
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun logOrderCreated(orderId: UUID) {
        auditRepository.save(Audit(action = "ORDER_CREATED", entityId = orderId))
    }

    // SUPPORTS: Use transaction if exists, work without if none
    @Transactional(propagation = Propagation.SUPPORTS, readOnly = true)
    fun getOrder(orderId: UUID): Order {
        return orderRepository.findById(orderId).orElseThrow()
    }
}
```

## Concurrency Handling

### Optimistic Locking

```kotlin
// ✅ GOOD: Optimistic locking with @Version
@Entity
class Product(
    @Id val id: UUID,
    var name: String,
    var stock: Int,

    @Version  // Optimistic locking
    var version: Long = 0
)

@Service
class ProductService {
    @Transactional
    fun decreaseStock(productId: UUID, quantity: Int) {
        val product = productRepository.findById(productId).orElseThrow()

        if (product.stock < quantity) {
            throw InsufficientStockException()
        }

        product.stock -= quantity
        productRepository.save(product)  // version auto-increment, OptimisticLockException on conflict
    }
}
```

### Pessimistic Locking

```kotlin
// ✅ GOOD: Pessimistic locking (for critical data like stock)
interface ProductRepository : JpaRepository<Product, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Product p WHERE p.id = :id")
    fun findByIdWithLock(@Param("id") id: UUID): Optional<Product>
}

@Service
class ProductService {
    @Transactional
    fun decreaseStock(productId: UUID, quantity: Int) {
        val product = productRepository.findByIdWithLock(productId).orElseThrow()

        if (product.stock < quantity) {
            throw InsufficientStockException()
        }

        product.stock -= quantity
        productRepository.save(product)
    }
}
```

## Large Data Processing

### Batch Processing

```kotlin
// ❌ BAD: Load all data at once
@Service
class UserService {
    @Transactional
    fun updateAllUsers() {
        val users = userRepository.findAll()  // ❌ Memory overflow risk
        users.forEach { it.status = UserStatus.ACTIVE }
        userRepository.saveAll(users)
    }
}

// ✅ GOOD: Batch processing
@Service
class UserService(private val entityManager: EntityManager) {
    @Transactional
    fun updateAllUsers() {
        val batchSize = 1000
        var page = 0

        while (true) {
            val users = userRepository.findAll(
                PageRequest.of(page, batchSize)
            ).content

            if (users.isEmpty()) break

            users.forEach { it.status = UserStatus.ACTIVE }
            userRepository.saveAll(users)

            // Manage 1st level cache memory with flush & clear
            entityManager.flush()
            entityManager.clear()

            page++
        }
    }
}
```

### EntityManager flush/clear Pattern

```kotlin
@Service
class BulkDataService(
    private val entityManager: EntityManager,
    private val userRepository: UserRepository
) {
    @Transactional
    fun bulkInsertUsers(users: List<User>) {
        val batchSize = 100

        users.forEachIndexed { index, user ->
            entityManager.persist(user)

            // flush & clear every 100 records
            if (index > 0 && index % batchSize == 0) {
                entityManager.flush()  // Reflect to DB
                entityManager.clear()  // Clear 1st level cache
            }
        }

        // Process remaining data
        entityManager.flush()
        entityManager.clear()
    }
}
```

## Checklist

**When writing Controller:**
- [ ] Depends only on Service? (No Repository dependency)
- [ ] Handles only HTTP request/response?
- [ ] Contains no business logic?
- [ ] Only performs DTO transformation?
- [ ] Not returning Entity directly?

**When writing Service:**
- [ ] Depends only on Repository? (No other Service dependency)
- [ ] Contains only business logic?
- [ ] No HTTP related code? (ResponseEntity, HttpStatus, etc.)
- [ ] Manages transactions appropriately?
- [ ] Applied @Transactional(readOnly = true) to query methods?
- [ ] Solved N+1 problem?
- [ ] Not logging sensitive information?

**When writing Repository:**
- [ ] Performs only database access?
- [ ] Contains no business logic?
- [ ] No event publishing?
- [ ] No transaction management? (Managed by Service)

**Security:**
- [ ] Using Prepared Statement to prevent SQL Injection?
- [ ] Not logging sensitive information (passwords, tokens)?
- [ ] Not including sensitive information in exception messages?

**Performance:**
- [ ] Solved N+1 problem with Fetch Join or @EntityGraph?
- [ ] Applied pagination?
- [ ] Applied batch processing for large data?

**Concurrency:**
- [ ] Applied Optimistic or Pessimistic Locking for concurrency issues?
- [ ] Considered optimistic locking with @Version?
