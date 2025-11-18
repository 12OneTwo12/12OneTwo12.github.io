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
    fun getUser(@PathVariable id: UUID): Mono<ResponseEntity<UserResponse>> {
        logger.info("GET /api/v1/users/{}", id)

        // ✅ GOOD: Only Service calls and HTTP response generation
        return userService.getUserById(id)
            .map { user -> ResponseEntity.ok(UserResponse.from(user)) }
            .defaultIfEmpty(ResponseEntity.notFound().build())
    }

    @PostMapping
    fun createUser(@Valid @RequestBody request: CreateUserRequest): Mono<ResponseEntity<UserResponse>> {
        logger.info("POST /api/v1/users: email={}", request.email)

        // ✅ GOOD: Validation via Bean Validation, business logic in Service
        return userService.createUser(request)
            .map { user -> ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(user)) }
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
    fun getUser(@PathVariable id: UUID): Mono<User> {
        return userRepository.findById(id)  // ❌ Direct Repository call from Controller
    }
}

// ❌ BAD: Contains business logic
@RestController
class UserController(
    private val userService: UserService
) {
    @PostMapping
    fun createUser(@RequestBody request: CreateUserRequest): Mono<UserResponse> {
        // ❌ Email duplicate check is business logic → Should be in Service
        if (userService.existsByEmail(request.email)) {
            throw BusinessException("Email already exists")
        }
        return userService.createUser(request)
    }
}

// ❌ BAD: Transaction management
@RestController
class UserController {
    @Transactional  // ❌ Transaction management in Controller forbidden
    @PostMapping
    fun createUser(@RequestBody request: CreateUserRequest): Mono<UserResponse> {
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
    fun createUser(request: CreateUserRequest): Mono<User> {
        logger.info("Creating user: email={}", request.email)

        // ✅ Duplicate check (business rule)
        return userRepository.existsByEmail(request.email)
            .flatMap { exists ->
                if (exists) {
                    Mono.error(BusinessException("Email already exists"))
                } else {
                    val user = User(
                        id = UUID.randomUUID(),
                        email = request.email,
                        name = request.name,
                        createdAt = LocalDateTime.now()
                    )

                    // ✅ Repository call
                    userRepository.save(user)
                }
            }
            .flatMap { savedUser ->
                // ✅ Event publishing
                eventPublisher.publish(UserCreatedEvent(savedUser.id))
                    .thenReturn(savedUser)
            }
    }

    // ✅ GOOD: Combine multiple Repositories
    @Transactional
    fun transferOwnership(userId: UUID, targetUserId: UUID): Mono<Void> {
        return userRepository.findById(userId)
            .zipWith(userRepository.findById(targetUserId))
            .flatMap { (user, targetUser) ->
                // Business logic: Transfer ownership
                orderRepository.updateOwner(user.id, targetUser.id)
            }
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
    fun getUser(id: UUID): Mono<User> {
        return userRepository.findById(id)
            .switchIfEmpty(Mono.error(ResponseStatusException(HttpStatus.NOT_FOUND)))  // ❌ HTTP status code
    }
}

// ❌ BAD: Using @Valid
@Service
class UserService {
    fun createUser(@Valid request: CreateUserRequest): Mono<User> {  // ❌ @Valid only in Controller
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
interface UserRepository : R2dbcRepository<User, UUID> {

    // ✅ GOOD: Simple query
    fun findByEmail(email: String): Mono<User>

    // ✅ GOOD: Existence check
    fun existsByEmail(email: String): Mono<Boolean>

    // ✅ GOOD: Conditional query
    @Query("SELECT * FROM users WHERE status = :status AND deleted_at IS NULL")
    fun findAllByStatus(status: String): Flux<User>

    // ✅ GOOD: Complex query
    @Query("""
        SELECT u.* FROM users u
        JOIN orders o ON u.id = o.user_id
        WHERE o.created_at >= :since
        GROUP BY u.id
        HAVING COUNT(o.id) > :minOrders
    """)
    fun findActiveUsers(since: LocalDateTime, minOrders: Int): Flux<User>
}
```

### Forbidden Operations

```kotlin
// ❌ BAD: Contains business logic
interface UserRepository : R2dbcRepository<User, UUID> {

    // ❌ Check email then save → Business logic should be in Service
    fun saveIfEmailNotExists(user: User): Mono<User> {
        return existsByEmail(user.email)
            .flatMap { exists ->
                if (exists) Mono.error(BusinessException("Email exists"))
                else save(user)
            }
    }
}

// ❌ BAD: Transaction management
interface UserRepository : R2dbcRepository<User, UUID> {

    @Transactional  // ❌ Transaction management in Repository forbidden (managed by Service)
    fun deleteByEmail(email: String): Mono<Void>
}

// ❌ BAD: Event publishing
class UserRepositoryImpl : UserRepository {

    override fun save(user: User): Mono<User> {
        return super.save(user)
            .flatMap { savedUser ->
                eventPublisher.publish(UserCreatedEvent(savedUser.id))  // ❌ Event publishing in Repository forbidden
                    .thenReturn(savedUser)
            }
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
    fun createUser(request: CreateUserRequest): Mono<User> {
        val user = User(
            id = UUID.randomUUID(),
            email = request.email,
            name = request.name
        )
        return userRepository.save(user)
    }
}

// 3. Repository: Save Domain object
interface UserRepository : R2dbcRepository<User, UUID>
```

### Response Flow (Domain → Response)

```kotlin
// 1. Repository: Return Domain object
interface UserRepository : R2dbcRepository<User, UUID> {
    fun findById(id: UUID): Mono<User>
}

// 2. Service: Return Domain object (no transformation)
@Service
class UserService {
    fun getUserById(id: UUID): Mono<User> {
        return userRepository.findById(id)
    }
}

// 3. Controller: Transform to Response DTO
@RestController
class UserController {
    @GetMapping("/{id}")
    fun getUser(@PathVariable id: UUID): Mono<ResponseEntity<UserResponse>> {
        return userService.getUserById(id)
            .map { user -> ResponseEntity.ok(UserResponse.from(user)) }
            .defaultIfEmpty(ResponseEntity.notFound().build())
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
    fun createOrder(userId: UUID, productId: UUID): Mono<Order> {
        return userService.getUserById(userId)  // ❌ Service → Service call
            .zipWith(productService.getProductById(productId))
            .flatMap { (user, product) ->
                // Create Order
            }
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
    fun createOrder(userId: UUID, productId: UUID): Mono<Order> {
        return userRepository.findById(userId)  // ✅ Repository call
            .zipWith(productRepository.findById(productId))
            .flatMap { (user, product) ->
                val order = Order(
                    id = UUID.randomUUID(),
                    userId = user.id,
                    productId = product.id
                )
                orderRepository.save(order)
            }
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
    fun createOrder(order: Order): Mono<Order> {
        return orderRepository.save(order)
            .flatMap { savedOrder ->
                // Publish event
                eventPublisher.publish(OrderCreatedEvent(savedOrder.id))
                    .thenReturn(savedOrder)
            }
    }
}

// Other service receives event
@Service
class NotificationService {
    @EventListener
    fun handleOrderCreated(event: OrderCreatedEvent): Mono<Void> {
        // Send order completion notification
        return sendNotification(event.orderId)
    }
}
```

## Layer-Specific Test Strategy

### Controller Test

```kotlin
@WebFluxTest(UserController::class)
class UserControllerTest {

    @MockBean
    private lateinit var userService: UserService

    @Autowired
    private lateinit var webTestClient: WebTestClient

    @Test
    fun `should return user when exists`() {
        // Given
        val userId = UUID.randomUUID()
        val user = User(id = userId, email = "test@example.com", name = "Test")
        `when`(userService.getUserById(userId)).thenReturn(Mono.just(user))

        // When & Then
        webTestClient.get()
            .uri("/api/v1/users/{id}", userId)
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.id").isEqualTo(userId.toString())
            .jsonPath("$.email").isEqualTo("test@example.com")
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
        `when`(userRepository.existsByEmail(request.email)).thenReturn(Mono.just(false))
        `when`(userRepository.save(any())).thenAnswer { Mono.just(it.arguments[0]) }
        `when`(eventPublisher.publish(any())).thenReturn(Mono.empty())

        // When
        val result = userService.createUser(request).block()

        // Then
        assertThat(result).isNotNull
        assertThat(result?.email).isEqualTo("test@example.com")
        verify(userRepository).save(any())
        verify(eventPublisher).publish(any())
    }
}
```

### Repository Test

```kotlin
@DataR2dbcTest
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
        userRepository.save(user).block()

        // When
        val found = userRepository.findByEmail("test@example.com").block()

        // Then
        assertThat(found).isNotNull
        assertThat(found?.email).isEqualTo("test@example.com")
    }
}
```

## Checklist

**When writing Controller:**
- [ ] Depends only on Service? (No Repository dependency)
- [ ] Handles only HTTP request/response?
- [ ] Contains no business logic?
- [ ] Only performs DTO transformation?

**When writing Service:**
- [ ] Does not invade Repository layer responsibilities? (No direct query writing, but utility classes and external services OK)
- [ ] Contains only business logic?
- [ ] No HTTP related code? (ResponseEntity, HttpStatus, etc.)
- [ ] Manages transactions appropriately?

**When writing Repository:**
- [ ] Performs only database access?
- [ ] Contains no business logic?
- [ ] No event publishing?
- [ ] No transaction management? (Managed by Service)
