---
title: 아키텍처
weight: 3
---

제가 개발할 때 중요하게 생각하는 원칙은 **명확한 책임 분리**입니다. 아키텍처 패턴과 관계없이 각 계층의 책임이 명확히 분리되어야 합니다.

## 계층 구조 예시 (MVC Pattern)

계층형 아키텍처의 대표적인 예시로, Controller-Service-Repository 3계층 구조가 있습니다:

```
┌────────────────────────┐
│   Controller Layer     │  ← HTTP 요청/응답만
├────────────────────────┤
│   Service Layer        │  ← 비즈니스 로직만
├────────────────────────┤
│   Repository Layer     │  ← 데이터베이스 접근만
└────────────────────────┘
```

**핵심 원칙**:
- **Controller는 Service만 호출**: Repository 직접 호출 금지
- **Service는 Repository 계층의 책임을 침범하지 않음**: 직접 쿼리 작성 금지 (유틸리티 클래스, 외부 서비스 호출은 가능)
- **각 계층은 단일 책임**: 계층 간 책임 명확히 분리

## Controller 계층

### 역할

**Controller는 HTTP 요청/응답만 처리합니다.**

- HTTP 요청 수신 및 검증
- Service 계층 호출
- HTTP 응답 생성 (상태 코드, 헤더 포함)
- DTO 변환 (Request DTO → Service, Domain → Response DTO)

### 허용된 작업

```kotlin
@RestController
@RequestMapping("/api/v1/users")
class UserController(
    private val userService: UserService  // ✅ Service 의존성만
) {
    companion object {
        private val logger = LoggerFactory.getLogger(UserController::class.java)
    }

    @GetMapping("/{id}")
    fun getUser(@PathVariable id: UUID): ResponseEntity<UserResponse> {
        logger.info("GET /api/v1/users/{}", id)

        // ✅ GOOD: Service 호출 및 HTTP 응답 생성만
        val user = userService.getUserById(id)
        return user?.let { ResponseEntity.ok(UserResponse.from(it)) }
            ?: ResponseEntity.notFound().build()
    }

    @PostMapping
    fun createUser(@Valid @RequestBody request: CreateUserRequest): ResponseEntity<UserResponse> {
        logger.info("POST /api/v1/users: email={}", request.email)

        // ✅ GOOD: 검증은 Bean Validation, 비즈니스 로직은 Service
        val user = userService.createUser(request)
        return ResponseEntity.status(HttpStatus.CREATED)
            .header("Location", "/api/v1/users/${user.id}")
            .body(UserResponse.from(user))
    }
}
```

### 금지된 작업

```kotlin
// ❌ BAD: Repository 직접 호출
@RestController
class UserController(
    private val userRepository: UserRepository  // ❌ Repository 의존성 금지
) {
    @GetMapping("/{id}")
    fun getUser(@PathVariable id: UUID): ResponseEntity<User> {
        return userRepository.findById(id)  // ❌ Controller에서 Repository 직접 호출
            .map { ResponseEntity.ok(it) }
            .orElse(ResponseEntity.notFound().build())
    }
}

// ❌ BAD: 비즈니스 로직 포함
@RestController
class UserController(
    private val userService: UserService
) {
    @PostMapping
    fun createUser(@RequestBody request: CreateUserRequest): ResponseEntity<UserResponse> {
        // ❌ 이메일 중복 체크는 비즈니스 로직 → Service에서 해야 함
        if (userService.existsByEmail(request.email)) {
            throw BusinessException("Email already exists")
        }
        val user = userService.createUser(request)
        return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(user))
    }
}

// ❌ BAD: 트랜잭션 관리
@RestController
class UserController {
    @Transactional  // ❌ Controller에서 트랜잭션 관리 금지
    @PostMapping
    fun createUser(@RequestBody request: CreateUserRequest): ResponseEntity<UserResponse> {
        // ...
    }
}
```

## Service 계층

### 역할

**Service는 비즈니스 로직만 처리합니다.**

- 비즈니스 규칙 구현
- 트랜잭션 관리
- 도메인 객체 조작
- 외부 서비스 호출 (이벤트 발행, 외부 API 등)
- 여러 Repository 조합

### 허용된 작업

```kotlin
@Service
class UserService(
    private val userRepository: UserRepository,  // ✅ Repository 의존성
    private val eventPublisher: EventPublisher    // ✅ 외부 서비스 의존성
) {
    companion object {
        private val logger = LoggerFactory.getLogger(UserService::class.java)
    }

    // ✅ GOOD: 비즈니스 로직 구현
    @Transactional
    fun createUser(request: CreateUserRequest): User {
        logger.info("Creating user: email={}", request.email)

        // ✅ 중복 체크 (비즈니스 규칙)
        if (userRepository.existsByEmail(request.email)) {
            throw BusinessException("Email already exists")
        }

        val user = User(
            id = UUID.randomUUID(),
            email = request.email,
            name = request.name,
            createdAt = LocalDateTime.now()
        )

        // ✅ Repository 호출
        val savedUser = userRepository.save(user)

        // ✅ 이벤트 발행
        eventPublisher.publish(UserCreatedEvent(savedUser.id))

        return savedUser
    }

    // ✅ GOOD: 여러 Repository 조합
    @Transactional
    fun transferOwnership(userId: UUID, targetUserId: UUID) {
        val user = userRepository.findById(userId)
            .orElseThrow { UserNotFoundException(userId) }
        val targetUser = userRepository.findById(targetUserId)
            .orElseThrow { UserNotFoundException(targetUserId) }

        // 비즈니스 로직: 권한 이전
        orderRepository.updateOwner(user.id, targetUser.id)
    }
}
```

### 금지된 작업

```kotlin
// ❌ BAD: HTTP 응답 생성
@Service
class UserService {
    fun createUser(request: CreateUserRequest): ResponseEntity<UserResponse> {  // ❌ ResponseEntity 반환 금지
        // ...
        return ResponseEntity.status(HttpStatus.CREATED).body(response)  // ❌ HTTP 관련 코드
    }
}

// ❌ BAD: HTTP 상태 코드 처리
@Service
class UserService {
    fun getUser(id: UUID): User {
        return userRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND) }  // ❌ HTTP 상태 코드
    }
}

// ❌ BAD: @Valid 사용
@Service
class UserService {
    fun createUser(@Valid request: CreateUserRequest): User {  // ❌ @Valid는 Controller에서만
        // ...
    }
}
```

## Repository 계층

### 역할

**Repository는 데이터베이스 접근만 처리합니다.**

- CRUD 작업
- 쿼리 실행
- 데이터 영속성 관리

### 허용된 작업

```kotlin
interface UserRepository : JpaRepository<User, UUID> {

    // ✅ GOOD: 단순 조회 쿼리
    fun findByEmail(email: String): Optional<User>

    // ✅ GOOD: 존재 여부 확인
    fun existsByEmail(email: String): Boolean

    // ✅ GOOD: 조건부 조회
    @Query("SELECT u FROM User u WHERE u.status = :status AND u.deletedAt IS NULL")
    fun findAllByStatus(@Param("status") status: String): List<User>

    // ✅ GOOD: 복잡한 쿼리
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

### 금지된 작업

```kotlin
// ❌ BAD: 비즈니스 로직 포함
interface UserRepository : JpaRepository<User, UUID> {

    // ❌ 이메일 중복 체크 후 저장 → 비즈니스 로직은 Service에서
    fun saveIfEmailNotExists(user: User): User {
        if (existsByEmail(user.email)) {
            throw BusinessException("Email exists")
        }
        return save(user)
    }
}

// ❌ BAD: 트랜잭션 관리
interface UserRepository : JpaRepository<User, UUID> {

    @Transactional  // ❌ Repository에서 트랜잭션 관리 금지 (Service에서 관리)
    fun deleteByEmail(email: String)
}

// ❌ BAD: 이벤트 발행
class UserRepositoryImpl(
    private val eventPublisher: EventPublisher
) {

    fun save(user: User): User {
        val savedUser = entityManager.persist(user)
        eventPublisher.publish(UserCreatedEvent(savedUser.id))  // ❌ Repository에서 이벤트 발행 금지
        return savedUser
    }
}
```

## 계층 간 데이터 흐름

### 요청 흐름 (Request → Domain)

```kotlin
// 1. Controller: Request DTO 수신
data class CreateUserRequest(
    val email: String,
    val name: String
)

// 2. Service: Domain 객체 생성
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

// 3. Repository: Domain 객체 저장
interface UserRepository : JpaRepository<User, UUID>
```

### 응답 흐름 (Domain → Response)

```kotlin
// 1. Repository: Domain 객체 반환
interface UserRepository : JpaRepository<User, UUID> {
    override fun findById(id: UUID): Optional<User>
}

// 2. Service: Domain 객체 반환 (변환 없음)
@Service
class UserService {
    @Transactional(readOnly = true)
    fun getUserById(id: UUID): User? {
        return userRepository.findById(id).orElse(null)
    }
}

// 3. Controller: Response DTO로 변환
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

## 서비스 간 의존성

### 같은 계층 간 호출 금지

```kotlin
// ❌ BAD: Service가 다른 Service 직접 호출
@Service
class OrderService(
    private val userService: UserService,  // ❌ 같은 계층 의존성 금지
    private val productService: ProductService  // ❌ 같은 계층 의존성 금지
) {
    @Transactional
    fun createOrder(userId: UUID, productId: UUID): Order {
        val user = userService.getUserById(userId)  // ❌ Service → Service 호출
            ?: throw UserNotFoundException(userId)
        val product = productService.getProductById(productId)
            ?: throw ProductNotFoundException(productId)

        // Order 생성
        return orderRepository.save(Order(userId = user.id, productId = product.id))
    }
}
```

### 해결 방법 1: Repository 직접 호출

```kotlin
// ✅ GOOD: Repository만 호출
@Service
class OrderService(
    private val userRepository: UserRepository,  // ✅ Repository 의존성
    private val productRepository: ProductRepository,  // ✅ Repository 의존성
    private val orderRepository: OrderRepository
) {
    @Transactional
    fun createOrder(userId: UUID, productId: UUID): Order {
        val user = userRepository.findById(userId)  // ✅ Repository 호출
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

### 해결 방법 2: 이벤트 기반 통신

```kotlin
// ✅ GOOD: 이벤트로 느슨한 결합
@Service
class OrderService(
    private val orderRepository: OrderRepository,
    private val eventPublisher: EventPublisher
) {
    @Transactional
    fun createOrder(order: Order): Order {
        val savedOrder = orderRepository.save(order)

        // 이벤트 발행
        eventPublisher.publish(OrderCreatedEvent(savedOrder.id))

        return savedOrder
    }
}

// 다른 서비스에서 이벤트 수신
@Service
class NotificationService {
    @EventListener
    @Async
    fun handleOrderCreated(event: OrderCreatedEvent) {
        // 주문 완료 알림 발송
        sendNotification(event.orderId)
    }
}
```

## 계층별 테스트 전략

### Controller 테스트

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

### Service 테스트

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

### Repository 테스트

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

## DTO vs Entity 분리 (필수)

### Entity는 절대 외부 노출 금지

```kotlin
// ❌ BAD: Entity 직접 반환
@GetMapping("/{id}")
fun getUser(@PathVariable id: UUID): User {  // ❌ Entity 직접 노출
    return userService.getUserById(id)
}

// ✅ GOOD: DTO로 변환
@GetMapping("/{id}")
fun getUser(@PathVariable id: UUID): ResponseEntity<UserResponse> {
    val user = userService.getUserById(id)
    return user?.let { ResponseEntity.ok(UserResponse.from(it)) }
        ?: ResponseEntity.notFound().build()
}
```

### DTO 변환 위치

**원칙: Controller에서만 DTO 변환**

```kotlin
// ✅ GOOD: Controller에서 DTO 변환
@RestController
class UserController(private val userService: UserService) {
    @GetMapping("/{id}")
    fun getUser(@PathVariable id: UUID): ResponseEntity<UserResponse> {
        val user = userService.getUserById(id)  // Service는 Domain 반환
        return user?.let { ResponseEntity.ok(UserResponse.from(it)) }
            ?: ResponseEntity.notFound().build()
    }
}

// ❌ BAD: Service에서 DTO 반환
@Service
class UserService {
    fun getUserById(id: UUID): UserResponse {  // ❌ Service에서 DTO 반환 금지
        val user = userRepository.findById(id).orElse(null)
        return UserResponse.from(user)
    }
}
```

### 순환 참조 방지

```kotlin
// ❌ BAD: 순환 참조 발생
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
    val user: User  // ❌ 순환 참조
)

// ✅ GOOD: LAZY fetch + DTO 사용
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

// Response DTO에서 필요한 데이터만 노출
data class UserResponse(
    val id: UUID,
    val name: String,
    val orderCount: Int  // 순환 참조 대신 필요한 데이터만
)
```

## 보안 (Security)

### 민감정보 로깅 금지

```kotlin
// ❌ BAD: 민감정보 로깅
@Service
class UserService {
    fun login(email: String, password: String): User {
        logger.info("Login attempt: email={}, password={}", email, password)  // ❌ 비밀번호 로깅
        // ...
    }
}

// ✅ GOOD: 민감정보 마스킹
@Service
class UserService {
    fun login(email: String, password: String): User {
        logger.info("Login attempt: email={}", email)  // ✅ 이메일만 로깅
        // ...
    }
}
```

### 예외 메시지에 민감정보 포함 금지

```kotlin
// ❌ BAD: 예외에 민감정보 포함
class UserNotFoundException(userId: UUID, email: String) : RuntimeException(
    "User not found: userId=$userId, email=$email"  // ❌ 이메일 노출
)

// ✅ GOOD: 민감정보 제외
class UserNotFoundException(userId: UUID) : RuntimeException(
    "User not found: userId=$userId"  // ✅ ID만 노출
)
```

### SQL Injection 방지

```kotlin
// ❌ BAD: 문자열 직접 조합
@Repository
class UserRepository(private val jdbcTemplate: JdbcTemplate) {
    fun findByEmail(email: String): User? {
        val sql = "SELECT * FROM users WHERE email = '$email'"  // ❌ SQL Injection 위험
        return jdbcTemplate.queryForObject(sql, User::class.java)
    }
}

// ✅ GOOD: Prepared Statement 사용
@Repository
interface UserRepository : JpaRepository<User, UUID> {
    @Query("SELECT u FROM User u WHERE u.email = :email")  // ✅ 파라미터 바인딩
    fun findByEmail(@Param("email") email: String): Optional<User>
}
```

## 성능 (Performance)

### N+1 쿼리 문제 해결

```kotlin
// ❌ BAD: N+1 문제 발생
@Service
class OrderService(private val orderRepository: OrderRepository) {
    fun getOrders(): List<Order> {
        return orderRepository.findAll()  // 1번 쿼리
        // order.user 접근 시 N번 쿼리 발생
    }
}

// ✅ GOOD: Fetch Join 사용
interface OrderRepository : JpaRepository<Order, UUID> {
    @Query("SELECT DISTINCT o FROM Order o LEFT JOIN FETCH o.user WHERE o.deletedAt IS NULL")
    fun findAllWithUser(): List<Order>
}

// ✅ GOOD: @EntityGraph 사용
interface OrderRepository : JpaRepository<Order, UUID> {
    @EntityGraph(attributePaths = ["user"])
    @Query("SELECT o FROM Order o WHERE o.deletedAt IS NULL")
    fun findAllWithUser(): List<Order>
}
```

### @Transactional(readOnly = true) 활용

```kotlin
// ✅ GOOD: 읽기 전용 트랜잭션
@Service
@Transactional(readOnly = true)  // 클래스 레벨에 readOnly
class UserService {

    fun getUserById(id: UUID): User? {
        return userRepository.findById(id).orElse(null)
    }

    @Transactional  // 쓰기 작업에만 readOnly 제거
    fun createUser(request: CreateUserRequest): User {
        // ...
    }
}
```

### 페이징 처리

```kotlin
// ❌ BAD: 전체 조회 후 메모리에서 페이징
@Service
class UserService {
    fun getUsers(page: Int, size: Int): List<User> {
        val allUsers = userRepository.findAll()
        return allUsers.drop(page * size).take(size)  // ❌ 메모리 낭비
    }
}

// ✅ GOOD: DB 레벨 페이징
@Service
class UserService {
    fun getUsers(pageable: Pageable): Page<User> {
        return userRepository.findAll(pageable)  // ✅ DB에서 페이징
    }
}
```

## 트랜잭션 (Transaction)

### 트랜잭션 범위 최소화

```kotlin
// ❌ BAD: 트랜잭션 범위가 너무 큼
@Service
class OrderService {
    @Transactional
    fun processOrder(orderId: UUID) {
        val order = orderRepository.findById(orderId).orElseThrow()

        // 외부 API 호출은 트랜잭션 밖에서
        val paymentResult = paymentGateway.charge(order.amount)  // ❌ 트랜잭션 중 외부 API 호출

        order.status = OrderStatus.COMPLETED
        orderRepository.save(order)
    }
}

// ✅ GOOD: 트랜잭션 범위 최소화
@Service
class OrderService {
    fun processOrder(orderId: UUID) {
        // 외부 API 호출은 트랜잭션 밖에서
        val order = getOrder(orderId)
        val paymentResult = paymentGateway.charge(order.amount)

        // DB 작업만 트랜잭션으로
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

### 전파 옵션 이해

```kotlin
@Service
class OrderService {
    // REQUIRED (기본값): 기존 트랜잭션 사용, 없으면 새로 생성
    @Transactional(propagation = Propagation.REQUIRED)
    fun createOrder(order: Order): Order {
        return orderRepository.save(order)
    }

    // REQUIRES_NEW: 항상 새 트랜잭션 생성
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun logOrderCreated(orderId: UUID) {
        auditRepository.save(Audit(action = "ORDER_CREATED", entityId = orderId))
    }

    // SUPPORTS: 트랜잭션이 있으면 사용, 없어도 동작
    @Transactional(propagation = Propagation.SUPPORTS, readOnly = true)
    fun getOrder(orderId: UUID): Order {
        return orderRepository.findById(orderId).orElseThrow()
    }
}
```

## 동시성 처리 (Concurrency)

### Optimistic Locking

```kotlin
// ✅ GOOD: @Version으로 낙관적 잠금
@Entity
class Product(
    @Id val id: UUID,
    var name: String,
    var stock: Int,

    @Version  // 낙관적 잠금
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
        productRepository.save(product)  // version 자동 증가, 충돌 시 OptimisticLockException
    }
}
```

### Pessimistic Locking

```kotlin
// ✅ GOOD: 비관적 잠금 (재고 등 중요한 데이터)
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

## 대용량 데이터 처리

### 배치 처리

```kotlin
// ❌ BAD: 전체 데이터를 한 번에 조회
@Service
class UserService {
    @Transactional
    fun updateAllUsers() {
        val users = userRepository.findAll()  // ❌ 메모리 부족 위험
        users.forEach { it.status = UserStatus.ACTIVE }
        userRepository.saveAll(users)
    }
}

// ✅ GOOD: 배치 처리
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

            // flush & clear로 1차 캐시 메모리 관리
            entityManager.flush()
            entityManager.clear()

            page++
        }
    }
}
```

### EntityManager flush/clear 패턴

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

            // 100건마다 flush & clear
            if (index > 0 && index % batchSize == 0) {
                entityManager.flush()  // DB에 반영
                entityManager.clear()  // 1차 캐시 초기화
            }
        }

        // 남은 데이터 처리
        entityManager.flush()
        entityManager.clear()
    }
}
```

## 체크리스트

**Controller 작성 시:**
- [ ] Service만 의존하는가? (Repository 의존 금지)
- [ ] HTTP 요청/응답만 처리하는가?
- [ ] 비즈니스 로직이 없는가?
- [ ] DTO 변환만 수행하는가?
- [ ] Entity를 직접 반환하지 않는가?

**Service 작성 시:**
- [ ] Repository만 의존하는가? (다른 Service 의존 금지)
- [ ] 비즈니스 로직만 포함하는가?
- [ ] HTTP 관련 코드가 없는가? (ResponseEntity, HttpStatus 등)
- [ ] 트랜잭션을 적절히 관리하는가?
- [ ] @Transactional(readOnly = true)를 조회 메서드에 적용했는가?
- [ ] N+1 문제를 해결했는가?
- [ ] 민감정보를 로깅하지 않는가?

**Repository 작성 시:**
- [ ] 데이터베이스 접근만 수행하는가?
- [ ] 비즈니스 로직이 없는가?
- [ ] 이벤트 발행이 없는가?
- [ ] 트랜잭션 관리가 없는가? (Service에서 관리)

**보안:**
- [ ] SQL Injection 방지를 위해 Prepared Statement를 사용하는가?
- [ ] 민감정보(비밀번호, 토큰)를 로깅하지 않는가?
- [ ] 예외 메시지에 민감정보를 포함하지 않는가?

**성능:**
- [ ] N+1 문제를 Fetch Join 또는 @EntityGraph로 해결했는가?
- [ ] 페이징 처리를 적용했는가?
- [ ] 대용량 데이터 처리 시 배치 처리를 적용했는가?

**동시성:**
- [ ] 동시성 이슈가 있는 경우 Optimistic 또는 Pessimistic Locking을 적용했는가?
- [ ] @Version을 사용한 낙관적 잠금을 고려했는가?
