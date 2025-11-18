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
    fun getUser(@PathVariable id: UUID): Mono<ResponseEntity<UserResponse>> {
        logger.info("GET /api/v1/users/{}", id)

        // ✅ GOOD: Service 호출 및 HTTP 응답 생성만
        return userService.getUserById(id)
            .map { user -> ResponseEntity.ok(UserResponse.from(user)) }
            .defaultIfEmpty(ResponseEntity.notFound().build())
    }

    @PostMapping
    fun createUser(@Valid @RequestBody request: CreateUserRequest): Mono<ResponseEntity<UserResponse>> {
        logger.info("POST /api/v1/users: email={}", request.email)

        // ✅ GOOD: 검증은 Bean Validation, 비즈니스 로직은 Service
        return userService.createUser(request)
            .map { user -> ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(user)) }
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
    fun getUser(@PathVariable id: UUID): Mono<User> {
        return userRepository.findById(id)  // ❌ Controller에서 Repository 직접 호출
    }
}

// ❌ BAD: 비즈니스 로직 포함
@RestController
class UserController(
    private val userService: UserService
) {
    @PostMapping
    fun createUser(@RequestBody request: CreateUserRequest): Mono<UserResponse> {
        // ❌ 이메일 중복 체크는 비즈니스 로직 → Service에서 해야 함
        if (userService.existsByEmail(request.email)) {
            throw BusinessException("Email already exists")
        }
        return userService.createUser(request)
    }
}

// ❌ BAD: 트랜잭션 관리
@RestController
class UserController {
    @Transactional  // ❌ Controller에서 트랜잭션 관리 금지
    @PostMapping
    fun createUser(@RequestBody request: CreateUserRequest): Mono<UserResponse> {
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
    fun createUser(request: CreateUserRequest): Mono<User> {
        logger.info("Creating user: email={}", request.email)

        // ✅ 중복 체크 (비즈니스 규칙)
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

                    // ✅ Repository 호출
                    userRepository.save(user)
                }
            }
            .flatMap { savedUser ->
                // ✅ 이벤트 발행
                eventPublisher.publish(UserCreatedEvent(savedUser.id))
                    .thenReturn(savedUser)
            }
    }

    // ✅ GOOD: 여러 Repository 조합
    @Transactional
    fun transferOwnership(userId: UUID, targetUserId: UUID): Mono<Void> {
        return userRepository.findById(userId)
            .zipWith(userRepository.findById(targetUserId))
            .flatMap { (user, targetUser) ->
                // 비즈니스 로직: 권한 이전
                orderRepository.updateOwner(user.id, targetUser.id)
            }
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
    fun getUser(id: UUID): Mono<User> {
        return userRepository.findById(id)
            .switchIfEmpty(Mono.error(ResponseStatusException(HttpStatus.NOT_FOUND)))  // ❌ HTTP 상태 코드
    }
}

// ❌ BAD: @Valid 사용
@Service
class UserService {
    fun createUser(@Valid request: CreateUserRequest): Mono<User> {  // ❌ @Valid는 Controller에서만
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
interface UserRepository : R2dbcRepository<User, UUID> {

    // ✅ GOOD: 단순 조회 쿼리
    fun findByEmail(email: String): Mono<User>

    // ✅ GOOD: 존재 여부 확인
    fun existsByEmail(email: String): Mono<Boolean>

    // ✅ GOOD: 조건부 조회
    @Query("SELECT * FROM users WHERE status = :status AND deleted_at IS NULL")
    fun findAllByStatus(status: String): Flux<User>

    // ✅ GOOD: 복잡한 쿼리
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

### 금지된 작업

```kotlin
// ❌ BAD: 비즈니스 로직 포함
interface UserRepository : R2dbcRepository<User, UUID> {

    // ❌ 이메일 중복 체크 후 저장 → 비즈니스 로직은 Service에서
    fun saveIfEmailNotExists(user: User): Mono<User> {
        return existsByEmail(user.email)
            .flatMap { exists ->
                if (exists) Mono.error(BusinessException("Email exists"))
                else save(user)
            }
    }
}

// ❌ BAD: 트랜잭션 관리
interface UserRepository : R2dbcRepository<User, UUID> {

    @Transactional  // ❌ Repository에서 트랜잭션 관리 금지 (Service에서 관리)
    fun deleteByEmail(email: String): Mono<Void>
}

// ❌ BAD: 이벤트 발행
class UserRepositoryImpl : UserRepository {

    override fun save(user: User): Mono<User> {
        return super.save(user)
            .flatMap { savedUser ->
                eventPublisher.publish(UserCreatedEvent(savedUser.id))  // ❌ Repository에서 이벤트 발행 금지
                    .thenReturn(savedUser)
            }
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
    fun createUser(request: CreateUserRequest): Mono<User> {
        val user = User(
            id = UUID.randomUUID(),
            email = request.email,
            name = request.name
        )
        return userRepository.save(user)
    }
}

// 3. Repository: Domain 객체 저장
interface UserRepository : R2dbcRepository<User, UUID>
```

### 응답 흐름 (Domain → Response)

```kotlin
// 1. Repository: Domain 객체 반환
interface UserRepository : R2dbcRepository<User, UUID> {
    fun findById(id: UUID): Mono<User>
}

// 2. Service: Domain 객체 반환 (변환 없음)
@Service
class UserService {
    fun getUserById(id: UUID): Mono<User> {
        return userRepository.findById(id)
    }
}

// 3. Controller: Response DTO로 변환
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

## 서비스 간 의존성

### 같은 계층 간 호출 금지

```kotlin
// ❌ BAD: Service가 다른 Service 직접 호출
@Service
class OrderService(
    private val userService: UserService,  // ❌ 같은 계층 의존성 금지
    private val productService: ProductService  // ❌ 같은 계층 의존성 금지
) {
    fun createOrder(userId: UUID, productId: UUID): Mono<Order> {
        return userService.getUserById(userId)  // ❌ Service → Service 호출
            .zipWith(productService.getProductById(productId))
            .flatMap { (user, product) ->
                // Order 생성
            }
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
    fun createOrder(userId: UUID, productId: UUID): Mono<Order> {
        return userRepository.findById(userId)  // ✅ Repository 호출
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

### 해결 방법 2: 이벤트 기반 통신

```kotlin
// ✅ GOOD: 이벤트로 느슨한 결합
@Service
class OrderService(
    private val orderRepository: OrderRepository,
    private val eventPublisher: EventPublisher
) {
    @Transactional
    fun createOrder(order: Order): Mono<Order> {
        return orderRepository.save(order)
            .flatMap { savedOrder ->
                // 이벤트 발행
                eventPublisher.publish(OrderCreatedEvent(savedOrder.id))
                    .thenReturn(savedOrder)
            }
    }
}

// 다른 서비스에서 이벤트 수신
@Service
class NotificationService {
    @EventListener
    fun handleOrderCreated(event: OrderCreatedEvent): Mono<Void> {
        // 주문 완료 알림 발송
        return sendNotification(event.orderId)
    }
}
```

## 계층별 테스트 전략

### Controller 테스트

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

### Repository 테스트

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

## 체크리스트

**Controller 작성 시:**
- [ ] Service만 의존하는가? (Repository 의존 금지)
- [ ] HTTP 요청/응답만 처리하는가?
- [ ] 비즈니스 로직이 없는가?
- [ ] DTO 변환만 수행하는가?

**Service 작성 시:**
- [ ] Repository만 의존하는가? (다른 Service 의존 금지)
- [ ] 비즈니스 로직만 포함하는가?
- [ ] HTTP 관련 코드가 없는가? (ResponseEntity, HttpStatus 등)
- [ ] 트랜잭션을 적절히 관리하는가?

**Repository 작성 시:**
- [ ] 데이터베이스 접근만 수행하는가?
- [ ] 비즈니스 로직이 없는가?
- [ ] 이벤트 발행이 없는가?
- [ ] 트랜잭션 관리가 없는가? (Service에서 관리)
