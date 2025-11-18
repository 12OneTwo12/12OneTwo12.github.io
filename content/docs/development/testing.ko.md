---
title: 테스트 작성
weight: 5
---

제가 테스트 코드를 작성할 때 따르는 원칙과 템플릿입니다.

## 테스트 전략

### 모든 계층 테스트 (필수)

**아키텍처의 모든 계층은 반드시 테스트되어야 합니다.** 아래는 Controller-Service-Repository 3계층 구조의 테스트 예시입니다:

```
┌─────────────────────┐
│  Controller Test    │  ← HTTP 요청/응답 테스트
├─────────────────────┤
│  Service Test       │  ← 비즈니스 로직 테스트
├─────────────────────┤
│  Repository Test    │  ← 데이터베이스 테스트
└─────────────────────┘
```

**핵심 원칙**:
- **Controller**: HTTP 계층만 테스트, Service는 Mock
- **Service**: 비즈니스 로직만 테스트, Repository는 Mock
- **Repository**: 실제 데이터베이스 사용 (또는 TestContainer)

### Given-When-Then 패턴 (필수)

모든 테스트는 Given-When-Then 주석을 포함해야 합니다:

```kotlin
@Test
fun `should create user when email not exists`() {
    // Given: 테스트 준비 단계
    val request = CreateUserRequest(email = "test@example.com", name = "Test")
    `when`(userRepository.existsByEmail(request.email)).thenReturn(Mono.just(false))
    `when`(userRepository.save(any())).thenAnswer { Mono.just(it.arguments[0]) }

    // When: 테스트 실행 단계
    val result = userService.createUser(request).block()

    // Then: 검증 단계
    assertThat(result).isNotNull
    assertThat(result?.email).isEqualTo("test@example.com")
    verify(userRepository).save(any())
}
```

## Controller 테스트

### 기본 템플릿

```kotlin
@WebFluxTest(UserController::class)
class UserControllerTest {

    @MockBean
    private lateinit var userService: UserService

    @Autowired
    private lateinit var webTestClient: WebTestClient

    @Test
    fun `should return user when user exists`() {
        // Given
        val userId = UUID.randomUUID()
        val user = User(
            id = userId,
            email = "test@example.com",
            name = "Test User",
            createdAt = LocalDateTime.now()
        )
        `when`(userService.getUserById(userId)).thenReturn(Mono.just(user))

        // When & Then
        webTestClient.get()
            .uri("/api/v1/users/{id}", userId)
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.id").isEqualTo(userId.toString())
            .jsonPath("$.email").isEqualTo("test@example.com")
            .jsonPath("$.name").isEqualTo("Test User")
    }

    @Test
    fun `should return 404 when user not found`() {
        // Given
        val userId = UUID.randomUUID()
        `when`(userService.getUserById(userId)).thenReturn(Mono.empty())

        // When & Then
        webTestClient.get()
            .uri("/api/v1/users/{id}", userId)
            .exchange()
            .expectStatus().isNotFound
    }

    @Test
    fun `should create user with valid request`() {
        // Given
        val request = CreateUserRequest(
            email = "test@example.com",
            name = "Test User"
        )
        val user = User(
            id = UUID.randomUUID(),
            email = request.email,
            name = request.name,
            createdAt = LocalDateTime.now()
        )
        `when`(userService.createUser(request)).thenReturn(Mono.just(user))

        // When & Then
        webTestClient.post()
            .uri("/api/v1/users")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(request)
            .exchange()
            .expectStatus().isCreated
            .expectHeader().exists("Location")
            .expectBody()
            .jsonPath("$.email").isEqualTo("test@example.com")
            .jsonPath("$.name").isEqualTo("Test User")
    }

    @Test
    fun `should return 400 when request is invalid`() {
        // Given
        val invalidRequest = mapOf(
            "email" to "invalid-email",  // 잘못된 이메일 형식
            "name" to ""  // 빈 이름
        )

        // When & Then
        webTestClient.post()
            .uri("/api/v1/users")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(invalidRequest)
            .exchange()
            .expectStatus().isBadRequest
            .expectBody()
            .jsonPath("$.code").isEqualTo("VALIDATION_ERROR")
    }
}
```

### Controller 테스트 체크리스트

- [ ] Service는 Mock으로 처리했는가?
- [ ] HTTP 요청/응답만 테스트하는가?
- [ ] 모든 HTTP 상태 코드를 테스트하는가? (200, 201, 400, 404 등)
- [ ] 검증 오류를 테스트하는가?
- [ ] Given-When-Then 주석이 있는가?

## Service 테스트

### 기본 템플릿

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
        val request = CreateUserRequest(
            email = "test@example.com",
            name = "Test User"
        )
        `when`(userRepository.existsByEmail(request.email)).thenReturn(Mono.just(false))
        `when`(userRepository.save(any())).thenAnswer { Mono.just(it.arguments[0]) }
        `when`(eventPublisher.publish(any())).thenReturn(Mono.empty())

        // When
        val result = userService.createUser(request).block()

        // Then
        assertThat(result).isNotNull
        assertThat(result?.email).isEqualTo("test@example.com")
        assertThat(result?.name).isEqualTo("Test User")
        verify(userRepository).existsByEmail(request.email)
        verify(userRepository).save(any())
        verify(eventPublisher).publish(any())
    }

    @Test
    fun `should throw exception when email already exists`() {
        // Given
        val request = CreateUserRequest(
            email = "existing@example.com",
            name = "Test User"
        )
        `when`(userRepository.existsByEmail(request.email)).thenReturn(Mono.just(true))

        // When & Then
        assertThrows<DuplicateEmailException> {
            userService.createUser(request).block()
        }
        verify(userRepository).existsByEmail(request.email)
        verify(userRepository, never()).save(any())
    }

    @Test
    fun `should return user when user exists`() {
        // Given
        val userId = UUID.randomUUID()
        val user = User(
            id = userId,
            email = "test@example.com",
            name = "Test User",
            createdAt = LocalDateTime.now()
        )
        `when`(userRepository.findById(userId)).thenReturn(Mono.just(user))

        // When
        val result = userService.getUserById(userId).block()

        // Then
        assertThat(result).isNotNull
        assertThat(result?.id).isEqualTo(userId)
        assertThat(result?.email).isEqualTo("test@example.com")
        verify(userRepository).findById(userId)
    }

    @Test
    fun `should return empty when user not found`() {
        // Given
        val userId = UUID.randomUUID()
        `when`(userRepository.findById(userId)).thenReturn(Mono.empty())

        // When
        val result = userService.getUserById(userId).block()

        // Then
        assertThat(result).isNull()
        verify(userRepository).findById(userId)
    }

    @Test
    fun `should update user when user exists`() {
        // Given
        val userId = UUID.randomUUID()
        val existingUser = User(
            id = userId,
            email = "old@example.com",
            name = "Old Name",
            createdAt = LocalDateTime.now()
        )
        val updateRequest = UpdateUserRequest(
            email = "new@example.com",
            name = "New Name"
        )
        `when`(userRepository.findById(userId)).thenReturn(Mono.just(existingUser))
        `when`(userRepository.save(any())).thenAnswer { Mono.just(it.arguments[0]) }

        // When
        val result = userService.updateUser(userId, updateRequest).block()

        // Then
        assertThat(result).isNotNull
        assertThat(result?.email).isEqualTo("new@example.com")
        assertThat(result?.name).isEqualTo("New Name")
        verify(userRepository).findById(userId)
        verify(userRepository).save(any())
    }

    @Test
    fun `should soft delete user when user exists`() {
        // Given
        val userId = UUID.randomUUID()
        val deletedBy = UUID.randomUUID()
        val user = User(
            id = userId,
            email = "test@example.com",
            name = "Test User",
            createdAt = LocalDateTime.now(),
            deletedAt = null
        )
        `when`(userRepository.findById(userId)).thenReturn(Mono.just(user))
        `when`(userRepository.save(any())).thenAnswer { Mono.just(it.arguments[0]) }

        // When
        userService.deleteUser(userId, deletedBy).block()

        // Then
        verify(userRepository).findById(userId)
        verify(userRepository).save(argThat { it.deletedAt != null })
    }
}
```

### Service 테스트 체크리스트

- [ ] Repository는 Mock으로 처리했는가?
- [ ] 비즈니스 로직만 테스트하는가?
- [ ] 성공 케이스와 실패 케이스를 모두 테스트하는가?
- [ ] 예외 처리를 테스트하는가?
- [ ] verify()로 호출 여부를 검증하는가?
- [ ] Given-When-Then 주석이 있는가?

## Repository 테스트

### 기본 템플릿

```kotlin
@DataR2dbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class UserRepositoryTest {

    @Container
    private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine").apply {
        withDatabaseName("testdb")
        withUsername("test")
        withPassword("test")
    }

    @Autowired
    private lateinit var userRepository: UserRepository

    @BeforeEach
    fun setUp() {
        userRepository.deleteAll().block()
    }

    @Test
    fun `should save and find user by id`() {
        // Given
        val user = User(
            id = UUID.randomUUID(),
            email = "test@example.com",
            name = "Test User",
            createdAt = LocalDateTime.now(),
            createdBy = UUID.randomUUID()
        )

        // When
        val saved = userRepository.save(user).block()
        val found = userRepository.findById(user.id).block()

        // Then
        assertThat(found).isNotNull
        assertThat(found?.id).isEqualTo(user.id)
        assertThat(found?.email).isEqualTo("test@example.com")
        assertThat(found?.name).isEqualTo("Test User")
    }

    @Test
    fun `should find user by email`() {
        // Given
        val user = User(
            id = UUID.randomUUID(),
            email = "test@example.com",
            name = "Test User",
            createdAt = LocalDateTime.now()
        )
        userRepository.save(user).block()

        // When
        val found = userRepository.findByEmail("test@example.com").block()

        // Then
        assertThat(found).isNotNull
        assertThat(found?.email).isEqualTo("test@example.com")
    }

    @Test
    fun `should return empty when user not found by email`() {
        // Given: 데이터 없음

        // When
        val found = userRepository.findByEmail("nonexistent@example.com").block()

        // Then
        assertThat(found).isNull()
    }

    @Test
    fun `should check if email exists`() {
        // Given
        val user = User(
            id = UUID.randomUUID(),
            email = "existing@example.com",
            name = "Existing User",
            createdAt = LocalDateTime.now()
        )
        userRepository.save(user).block()

        // When
        val exists = userRepository.existsByEmail("existing@example.com").block()
        val notExists = userRepository.existsByEmail("nonexistent@example.com").block()

        // Then
        assertThat(exists).isTrue()
        assertThat(notExists).isFalse()
    }

    @Test
    fun `should find all users by status`() {
        // Given
        val activeUser1 = User(
            id = UUID.randomUUID(),
            email = "active1@example.com",
            name = "Active User 1",
            status = "ACTIVE",
            createdAt = LocalDateTime.now()
        )
        val activeUser2 = User(
            id = UUID.randomUUID(),
            email = "active2@example.com",
            name = "Active User 2",
            status = "ACTIVE",
            createdAt = LocalDateTime.now()
        )
        val inactiveUser = User(
            id = UUID.randomUUID(),
            email = "inactive@example.com",
            name = "Inactive User",
            status = "INACTIVE",
            createdAt = LocalDateTime.now()
        )
        userRepository.saveAll(listOf(activeUser1, activeUser2, inactiveUser)).collectList().block()

        // When
        val activeUsers = userRepository.findAllByStatus("ACTIVE").collectList().block()

        // Then
        assertThat(activeUsers).hasSize(2)
        assertThat(activeUsers?.map { it.status }).allMatch { it == "ACTIVE" }
    }

    @Test
    fun `should not find soft deleted users`() {
        // Given
        val user = User(
            id = UUID.randomUUID(),
            email = "deleted@example.com",
            name = "Deleted User",
            createdAt = LocalDateTime.now(),
            deletedAt = LocalDateTime.now()  // Soft deleted
        )
        userRepository.save(user).block()

        // When
        val found = userRepository.findByEmail("deleted@example.com").block()

        // Then
        assertThat(found).isNull()  // Soft deleted 사용자는 조회되지 않음
    }
}
```

### Repository 테스트 체크리스트

- [ ] 실제 데이터베이스 또는 TestContainer를 사용하는가?
- [ ] @DataR2dbcTest 어노테이션을 사용하는가?
- [ ] @BeforeEach에서 데이터를 초기화하는가?
- [ ] 조회, 저장, 수정, 삭제를 모두 테스트하는가?
- [ ] Soft Delete 처리를 테스트하는가?
- [ ] Given-When-Then 주석이 있는가?

## 통합 테스트

### WebFlux 통합 테스트

```kotlin
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
@Testcontainers
class UserIntegrationTest {

    @Container
    private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine")

    @Autowired
    private lateinit var webTestClient: WebTestClient

    @Autowired
    private lateinit var userRepository: UserRepository

    @BeforeEach
    fun setUp() {
        userRepository.deleteAll().block()
    }

    @Test
    fun `should create and retrieve user`() {
        // Given
        val createRequest = CreateUserRequest(
            email = "integration@example.com",
            name = "Integration Test"
        )

        // When: 사용자 생성
        val createResponse = webTestClient.post()
            .uri("/api/v1/users")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(createRequest)
            .exchange()
            .expectStatus().isCreated
            .expectBody(UserResponse::class.java)
            .returnResult()
            .responseBody

        // Then: 생성된 사용자 조회
        webTestClient.get()
            .uri("/api/v1/users/{id}", createResponse?.id)
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.email").isEqualTo("integration@example.com")
            .jsonPath("$.name").isEqualTo("Integration Test")
    }

    @Test
    fun `should update user`() {
        // Given: 사용자 생성
        val user = User(
            id = UUID.randomUUID(),
            email = "old@example.com",
            name = "Old Name",
            createdAt = LocalDateTime.now()
        )
        userRepository.save(user).block()

        val updateRequest = UpdateUserRequest(
            email = "new@example.com",
            name = "New Name"
        )

        // When: 사용자 수정
        webTestClient.put()
            .uri("/api/v1/users/{id}", user.id)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(updateRequest)
            .exchange()
            .expectStatus().isOk

        // Then: 수정된 내용 확인
        webTestClient.get()
            .uri("/api/v1/users/{id}", user.id)
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.email").isEqualTo("new@example.com")
            .jsonPath("$.name").isEqualTo("New Name")
    }

    @Test
    fun `should delete user with soft delete`() {
        // Given: 사용자 생성
        val user = User(
            id = UUID.randomUUID(),
            email = "todelete@example.com",
            name = "To Delete",
            createdAt = LocalDateTime.now()
        )
        userRepository.save(user).block()

        // When: 사용자 삭제
        webTestClient.delete()
            .uri("/api/v1/users/{id}", user.id)
            .exchange()
            .expectStatus().isNoContent

        // Then: 삭제된 사용자는 조회 불가
        webTestClient.get()
            .uri("/api/v1/users/{id}", user.id)
            .exchange()
            .expectStatus().isNotFound
    }
}
```

## 비동기 테스트 (Reactor)

### StepVerifier 사용

```kotlin
@Test
fun `should emit user when exists`() {
    // Given
    val userId = UUID.randomUUID()
    val user = User(id = userId, email = "test@example.com", name = "Test")
    `when`(userRepository.findById(userId)).thenReturn(Mono.just(user))

    // When & Then
    StepVerifier.create(userService.getUserById(userId))
        .assertNext { result ->
            assertThat(result.id).isEqualTo(userId)
            assertThat(result.email).isEqualTo("test@example.com")
        }
        .verifyComplete()
}

@Test
fun `should emit multiple users`() {
    // Given
    val users = listOf(
        User(id = UUID.randomUUID(), email = "user1@example.com", name = "User 1"),
        User(id = UUID.randomUUID(), email = "user2@example.com", name = "User 2")
    )
    `when`(userRepository.findAll()).thenReturn(Flux.fromIterable(users))

    // When & Then
    StepVerifier.create(userService.getAllUsers())
        .expectNextCount(2)
        .verifyComplete()
}

@Test
fun `should emit error when user not found`() {
    // Given
    val userId = UUID.randomUUID()
    `when`(userRepository.findById(userId)).thenReturn(Mono.empty())

    // When & Then
    StepVerifier.create(userService.getUserByIdOrThrow(userId))
        .expectError(UserNotFoundException::class.java)
        .verify()
}
```

## 테스트 명명 규칙

### 권장 형식

```kotlin
// ✅ GOOD: 한글로 명확하게 작성
@Test
fun `should create user when email not exists`()

@Test
fun `should throw exception when email already exists`()

@Test
fun `should return 404 when user not found`()

// ❌ BAD: 의미 없는 이름
@Test
fun test1()

@Test
fun testCreateUser()
```

## 체크리스트

**모든 테스트 공통:**
- [ ] Given-When-Then 주석이 명확하게 작성되었는가?
- [ ] 테스트 이름이 명확한가? (한글 권장)
- [ ] 하나의 테스트는 하나의 케이스만 검증하는가?
- [ ] 성공/실패 케이스를 모두 테스트하는가?

**계층별 테스트:**
- [ ] Controller 테스트: Service를 Mock으로 처리했는가?
- [ ] Service 테스트: Repository를 Mock으로 처리했는가?
- [ ] Repository 테스트: 실제 DB 또는 TestContainer를 사용하는가?

**검증:**
- [ ] assertThat()으로 결과를 명확히 검증하는가?
- [ ] verify()로 Mock 호출 여부를 확인하는가?
- [ ] 예외 케이스를 테스트하는가?
