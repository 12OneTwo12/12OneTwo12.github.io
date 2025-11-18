---
title: Testing
weight: 5
---

These are the principles and templates I follow when writing test code.

## Test Strategy

### All Layer Testing (Required)

**All layers of the architecture must be tested.** Below is an example of testing in a Controller-Service-Repository 3-layer structure:

```
┌─────────────────────┐
│  Controller Test    │  ← HTTP request/response testing
├─────────────────────┤
│  Service Test       │  ← Business logic testing
├─────────────────────┤
│  Repository Test    │  ← Database testing
└─────────────────────┘
```

**Core Principles**:
- **Controller**: Test HTTP layer only, Mock Service
- **Service**: Test business logic only, Mock Repository  
- **Repository**: Use actual database (or TestContainer)

### Given-When-Then Pattern (Required)

All tests must include Given-When-Then comments:

```kotlin
@Test
fun `should create user when email not exists`() {
    // Given: Test preparation
    val request = CreateUserRequest(email = "test@example.com", name = "Test")
    `when`(userRepository.existsByEmail(request.email)).thenReturn(Mono.just(false))
    `when`(userRepository.save(any())).thenAnswer { Mono.just(it.arguments[0]) }

    // When: Test execution
    val result = userService.createUser(request).block()

    // Then: Verification
    assertThat(result).isNotNull
    assertThat(result?.email).isEqualTo("test@example.com")
    verify(userRepository).save(any())
}
```

## Controller Tests

### Basic Template

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
            "email" to "invalid-email",  // Invalid email format
            "name" to ""  // Empty name
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

### Controller Test Checklist

- [ ] Is Service mocked?
- [ ] Testing only HTTP request/response?
- [ ] Testing all HTTP status codes? (200, 201, 400, 404, etc.)
- [ ] Testing validation errors?
- [ ] Are Given-When-Then comments present?

## Service Tests

### Basic Template

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

### Service Test Checklist

- [ ] Is Repository mocked?
- [ ] Testing only business logic?
- [ ] Testing both success and failure cases?
- [ ] Testing exception handling?
- [ ] Using verify() to check invocations?
- [ ] Are Given-When-Then comments present?

## Repository Tests

### Basic Template

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
        // Given: No data

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
        assertThat(found).isNull()  // Soft deleted users should not be retrieved
    }
}
```

### Repository Test Checklist

- [ ] Using actual database or TestContainer?
- [ ] Using @DataR2dbcTest annotation?
- [ ] Initializing data in @BeforeEach?
- [ ] Testing all CRUD operations (Create, Read, Update, Delete)?
- [ ] Testing Soft Delete handling?
- [ ] Are Given-When-Then comments present?

## Integration Tests

### WebFlux Integration Test

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

        // When: Create user
        val createResponse = webTestClient.post()
            .uri("/api/v1/users")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(createRequest)
            .exchange()
            .expectStatus().isCreated
            .expectBody(UserResponse::class.java)
            .returnResult()
            .responseBody

        // Then: Retrieve created user
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
        // Given: Create user
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

        // When: Update user
        webTestClient.put()
            .uri("/api/v1/users/{id}", user.id)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(updateRequest)
            .exchange()
            .expectStatus().isOk

        // Then: Verify update
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
        // Given: Create user
        val user = User(
            id = UUID.randomUUID(),
            email = "todelete@example.com",
            name = "To Delete",
            createdAt = LocalDateTime.now()
        )
        userRepository.save(user).block()

        // When: Delete user
        webTestClient.delete()
            .uri("/api/v1/users/{id}", user.id)
            .exchange()
            .expectStatus().isNoContent

        // Then: Deleted user should not be retrievable
        webTestClient.get()
            .uri("/api/v1/users/{id}", user.id)
            .exchange()
            .expectStatus().isNotFound
    }
}
```

## Async Testing (Reactor)

### Using StepVerifier

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

## Test Naming Convention

### Recommended Format

```kotlin
// ✅ GOOD: Clear Korean description
@Test
fun `should create user when email not exists`()

@Test
fun `should throw exception when email already exists`()

@Test
fun `should return 404 when user not found`()

// ❌ BAD: Meaningless names
@Test
fun test1()

@Test
fun testCreateUser()
```

## Checklist

**Common to all tests:**
- [ ] Are Given-When-Then comments clearly written?
- [ ] Is the test name clear? (Korean recommended)
- [ ] Does one test verify only one case?
- [ ] Testing both success and failure cases?

**Layer-specific tests:**
- [ ] Controller test: Is Service mocked?
- [ ] Service test: Is Repository mocked?
- [ ] Repository test: Using actual DB or TestContainer?

**Verification:**
- [ ] Are results clearly verified with assertThat()?
- [ ] Is Mock invocation checked with verify()?
- [ ] Are exception cases tested?
