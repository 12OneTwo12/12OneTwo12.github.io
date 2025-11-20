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
    `when`(userRepository.existsByEmail(request.email)).thenReturn(false)
    `when`(userRepository.save(any())).thenAnswer { it.arguments[0] }

    // When: Test execution
    val result = userService.createUser(request)

    // Then: Verification
    assertThat(result).isNotNull
    assertThat(result?.email).isEqualTo("test@example.com")
    verify(userRepository).save(any())
}
```

## Controller Tests

### Basic Template

```kotlin
@WebMvcTest(UserController::class)
class UserControllerTest {

    @MockBean
    private lateinit var userService: UserService

    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var objectMapper: ObjectMapper

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
        `when`(userService.getUserById(userId)).thenReturn(user)

        // When & Then
        mockMvc.perform(get("/api/v1/users/{id}", userId))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(userId.toString()))
            .andExpect(jsonPath("$.email").value("test@example.com"))
            .andExpect(jsonPath("$.name").value("Test User"))
    }

    @Test
    fun `should return 404 when user not found`() {
        // Given
        val userId = UUID.randomUUID()
        `when`(userService.getUserById(userId)).thenReturn(null)

        // When & Then
        mockMvc.perform(get("/api/v1/users/{id}", userId))
            .andExpect(status().isNotFound)
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
        `when`(userService.createUser(request)).thenReturn(user)

        // When & Then
        mockMvc.perform(
            post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request))
        )
            .andExpect(status().isCreated)
            .andExpect(header().exists("Location"))
            .andExpect(jsonPath("$.email").value("test@example.com"))
            .andExpect(jsonPath("$.name").value("Test User"))
    }

    @Test
    fun `should return 400 when request is invalid`() {
        // Given
        val invalidRequest = mapOf(
            "email" to "invalid-email",  // Invalid email format
            "name" to ""  // Empty name
        )

        // When & Then
        mockMvc.perform(
            post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest))
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
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
        `when`(userRepository.existsByEmail(request.email)).thenReturn(false)
        `when`(userRepository.save(any())).thenAnswer { it.arguments[0] }

        // When
        val result = userService.createUser(request)

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
        `when`(userRepository.existsByEmail(request.email)).thenReturn(true)

        // When & Then
        assertThrows<DuplicateEmailException> {
            userService.createUser(request)
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
        `when`(userRepository.findById(userId)).thenReturn(Optional.of(user))

        // When
        val result = userService.getUserById(userId)

        // Then
        assertThat(result).isNotNull
        assertThat(result?.id).isEqualTo(userId)
        assertThat(result?.email).isEqualTo("test@example.com")
        verify(userRepository).findById(userId)
    }

    @Test
    fun `should return null when user not found`() {
        // Given
        val userId = UUID.randomUUID()
        `when`(userRepository.findById(userId)).thenReturn(Optional.empty())

        // When
        val result = userService.getUserById(userId)

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
        `when`(userRepository.findById(userId)).thenReturn(Optional.of(existingUser))
        `when`(userRepository.save(any())).thenAnswer { it.arguments[0] }

        // When
        val result = userService.updateUser(userId, updateRequest)

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
        `when`(userRepository.findById(userId)).thenReturn(Optional.of(user))
        `when`(userRepository.save(any())).thenAnswer { it.arguments[0] }

        // When
        userService.deleteUser(userId, deletedBy)

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
@DataJpaTest
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
        userRepository.deleteAll()
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
        val saved = userRepository.save(user)
        val found = userRepository.findById(user.id).orElse(null)

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
        userRepository.save(user)

        // When
        val found = userRepository.findByEmail("test@example.com").orElse(null)

        // Then
        assertThat(found).isNotNull
        assertThat(found?.email).isEqualTo("test@example.com")
    }

    @Test
    fun `should return empty when user not found by email`() {
        // Given: No data

        // When
        val found = userRepository.findByEmail("nonexistent@example.com")

        // Then
        assertThat(found).isEmpty
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
        userRepository.save(user)

        // When
        val exists = userRepository.existsByEmail("existing@example.com")
        val notExists = userRepository.existsByEmail("nonexistent@example.com")

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
        userRepository.saveAll(listOf(activeUser1, activeUser2, inactiveUser))

        // When
        val activeUsers = userRepository.findAllByStatus("ACTIVE")

        // Then
        assertThat(activeUsers).hasSize(2)
        assertThat(activeUsers.map { it.status }).allMatch { it == "ACTIVE" }
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
        userRepository.save(user)

        // When
        val found = userRepository.findByEmail("deleted@example.com")

        // Then
        assertThat(found).isEmpty  // Soft deleted users should not be retrieved
    }
}
```

### Repository Test Checklist

- [ ] Using actual database or TestContainer?
- [ ] Using @DataJpaTest annotation?
- [ ] Initializing data in @BeforeEach?
- [ ] Testing all CRUD operations (Create, Read, Update, Delete)?
- [ ] Testing Soft Delete handling?
- [ ] Are Given-When-Then comments present?

## Integration Tests

### Spring MVC Integration Test

```kotlin
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@Testcontainers
class UserIntegrationTest {

    @Container
    private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine")

    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var objectMapper: ObjectMapper

    @Autowired
    private lateinit var userRepository: UserRepository

    @BeforeEach
    fun setUp() {
        userRepository.deleteAll()
    }

    @Test
    fun `should create and retrieve user`() {
        // Given
        val createRequest = CreateUserRequest(
            email = "integration@example.com",
            name = "Integration Test"
        )

        // When: Create user
        val createResult = mockMvc.perform(
            post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createRequest))
        )
            .andExpect(status().isCreated)
            .andReturn()

        val createResponse = objectMapper.readValue(
            createResult.response.contentAsString,
            UserResponse::class.java
        )

        // Then: Retrieve created user
        mockMvc.perform(get("/api/v1/users/{id}", createResponse.id))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.email").value("integration@example.com"))
            .andExpect(jsonPath("$.name").value("Integration Test"))
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
        userRepository.save(user)

        val updateRequest = UpdateUserRequest(
            email = "new@example.com",
            name = "New Name"
        )

        // When: Update user
        mockMvc.perform(
            put("/api/v1/users/{id}", user.id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateRequest))
        )
            .andExpect(status().isOk)

        // Then: Verify update
        mockMvc.perform(get("/api/v1/users/{id}", user.id))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.email").value("new@example.com"))
            .andExpect(jsonPath("$.name").value("New Name"))
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
        userRepository.save(user)

        // When: Delete user
        mockMvc.perform(delete("/api/v1/users/{id}", user.id))
            .andExpect(status().isNoContent)

        // Then: Deleted user should not be retrievable
        mockMvc.perform(get("/api/v1/users/{id}", user.id))
            .andExpect(status().isNotFound)
    }
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

## Security Testing

### Authentication/Authorization Tests

**All security-related endpoints must be tested.**

```kotlin
@WebMvcTest(UserController::class)
class UserSecurityTest {

    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockBean
    private lateinit var userService: UserService

    @Test
    @WithAnonymousUser
    fun `should return 401 when accessing protected endpoint without authentication`() {
        // Given
        val userId = UUID.randomUUID()

        // When & Then
        mockMvc.perform(get("/api/v1/users/{id}", userId))
            .andExpect(status().isUnauthorized)
    }

    @Test
    @WithMockUser(roles = ["USER"])
    fun `should return 403 when user lacks required permission`() {
        // Given
        val adminOnlyResourceId = UUID.randomUUID()

        // When & Then
        mockMvc.perform(delete("/api/v1/admin/users/{id}", adminOnlyResourceId))
            .andExpect(status().isForbidden)
    }

    @Test
    @WithMockUser(roles = ["ADMIN"])
    fun `should allow access when user has admin role`() {
        // Given
        val userId = UUID.randomUUID()
        `when`(userService.deleteUser(userId)).thenReturn(true)

        // When & Then
        mockMvc.perform(delete("/api/v1/admin/users/{id}", userId))
            .andExpect(status().isNoContent)
    }

    @Test
    fun `should reject expired JWT token`() {
        // Given
        val expiredToken = "expired.jwt.token"

        // When & Then
        mockMvc.perform(
            get("/api/v1/users/me")
                .header("Authorization", "Bearer $expiredToken")
        )
            .andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.code").value("TOKEN_EXPIRED"))
    }

    @Test
    @WithMockUser(username = "user1")
    fun `should prevent user from accessing other user's data`() {
        // Given
        val otherUserId = UUID.randomUUID()
        `when`(userService.getUserById(otherUserId))
            .thenThrow(AccessDeniedException("Cannot access other user's data"))

        // When & Then
        mockMvc.perform(get("/api/v1/users/{id}/private-data", otherUserId))
            .andExpect(status().isForbidden)
    }
}
```

### SQL Injection Prevention Tests

```kotlin
@DataJpaTest
class UserRepositorySqlInjectionTest {

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var entityManager: EntityManager

    @Test
    fun `should prevent SQL injection in email search`() {
        // Given: SQL Injection attempt
        val maliciousEmail = "test@example.com' OR '1'='1"

        userRepository.save(User(
            id = UUID.randomUUID(),
            email = "legitimate@example.com",
            name = "Legitimate User"
        ))

        // When: Using Prepared Statement prevents SQL Injection
        val found = userRepository.findByEmail(maliciousEmail)

        // Then: Only exact email matches are found
        assertThat(found).isEmpty()
    }

    @Test
    fun `should use parameterized query for custom queries`() {
        // Given
        userRepository.save(User(
            id = UUID.randomUUID(),
            email = "test@example.com",
            name = "Test User"
        ))

        // When: Using :parameter in @Query (safe)
        val searchTerm = "'; DROP TABLE users; --"
        val results = userRepository.searchByNameContaining(searchTerm)

        // Then: Table not dropped, safe search
        assertThat(results).isEmpty()
        assertThat(userRepository.count()).isEqualTo(1)
    }
}

// ✅ GOOD: Parameterized Query
@Repository
interface UserRepository : JpaRepository<User, UUID> {
    @Query("SELECT u FROM User u WHERE u.name LIKE %:searchTerm%")
    fun searchByNameContaining(@Param("searchTerm") searchTerm: String): List<User>
}

// ❌ BAD: String concatenation (dangerous!)
// @Query("SELECT u FROM User u WHERE u.name LIKE '%" + searchTerm + "%'")
```

### XSS Prevention Tests

```kotlin
@WebMvcTest(UserController::class)
class XssPreventionTest {

    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockBean
    private lateinit var userService: UserService

    @Test
    fun `should escape HTML tags in user input`() {
        // Given: XSS attack attempt
        val maliciousName = "<script>alert('XSS')</script>"
        val request = CreateUserRequest(
            email = "test@example.com",
            name = maliciousName
        )

        val savedUser = User(
            id = UUID.randomUUID(),
            email = request.email,
            name = maliciousName  // Actually escaped
        )
        `when`(userService.createUser(request)).thenReturn(savedUser)

        // When & Then
        mockMvc.perform(
            post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request))
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.name").value(maliciousName))
            // Response is auto-escaped with Content-Type: application/json
    }

    @Test
    fun `should reject script tags in comment field`() {
        // Given
        val maliciousComment = "<img src=x onerror='alert(1)'>"
        val request = CreateCommentRequest(
            content = maliciousComment
        )

        // When & Then
        mockMvc.perform(
            post("/api/v1/comments")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request))
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
            .andExpect(jsonPath("$.message").value("Script tags are not allowed"))
    }
}

// ✅ GOOD: Input Validation
data class CreateCommentRequest(
    @field:NotBlank
    @field:Pattern(
        regexp = "^[^<>]*$",
        message = "HTML tags are not allowed"
    )
    val content: String
)
```

### Sensitive Data Protection Tests

```kotlin
@ExtendWith(MockitoExtension::class)
class SensitiveDataProtectionTest {

    @Mock
    private lateinit var userRepository: UserRepository

    @InjectMocks
    private lateinit var userService: UserService

    @Test
    fun `should not expose password in error messages`() {
        // Given
        val request = CreateUserRequest(
            email = "test@example.com",
            password = "SuperSecret123!",
            name = "Test User"
        )
        `when`(userRepository.existsByEmail(request.email)).thenReturn(true)

        // When
        val exception = assertThrows<DuplicateEmailException> {
            userService.createUser(request)
        }

        // Then: Password not included in exception message
        assertThat(exception.message).doesNotContain("SuperSecret123!")
        assertThat(exception.message).doesNotContain(request.password)
    }

    @Test
    fun `should mask password in logs`() {
        // Given
        val logCapture = LogCapture()
        val user = User(
            email = "test@example.com",
            password = "password123"
        )

        // When
        logger.info("Creating user: {}", user)

        // Then: Password masked in logs
        assertThat(logCapture.logs).doesNotContain("password123")
        assertThat(logCapture.logs).contains("password=****")
    }

    @Test
    fun `should exclude password from JSON serialization`() {
        // Given
        val user = User(
            id = UUID.randomUUID(),
            email = "test@example.com",
            password = "hashedPassword",
            name = "Test User"
        )

        // When
        val json = objectMapper.writeValueAsString(user)

        // Then: Password field not included in JSON
        assertThat(json).doesNotContain("password")
        assertThat(json).doesNotContain("hashedPassword")
    }
}

// ✅ GOOD: Exclude password field
data class User(
    val id: UUID,
    val email: String,
    @JsonIgnore  // Exclude from JSON serialization
    val password: String,
    val name: String
)

// ✅ GOOD: Mask password in toString
data class UserDto(
    val email: String,
    private val password: String
) {
    override fun toString(): String {
        return "UserDto(email=$email, password=****)"
    }
}
```

## Concurrency Testing

### Optimistic Locking Tests

```kotlin
@SpringBootTest
@Testcontainers
class OptimisticLockingTest {

    @Container
    private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine")

    @Autowired
    private lateinit var productRepository: ProductRepository

    @Autowired
    private lateinit var productService: ProductService

    @Test
    fun `should throw OptimisticLockException when version conflict occurs`() {
        // Given: Query same product twice
        val product = productRepository.save(
            Product(
                id = UUID.randomUUID(),
                name = "Test Product",
                stock = 100,
                version = 0L
            )
        )

        val product1 = productRepository.findById(product.id).get()
        val product2 = productRepository.findById(product.id).get()

        // When: First update succeeds
        product1.stock -= 10
        productRepository.save(product1)

        // Then: Second update throws OptimisticLockException
        product2.stock -= 20
        assertThrows<OptimisticLockingFailureException> {
            productRepository.save(product2)
        }
    }

    @Test
    fun `should retry on OptimisticLockException`() {
        // Given
        val productId = UUID.randomUUID()
        productRepository.save(
            Product(
                id = productId,
                name = "Test Product",
                stock = 100,
                version = 0L
            )
        )

        // When: Call service method with retry logic
        val executor = Executors.newFixedThreadPool(2)
        val futures = (1..2).map {
            executor.submit {
                productService.decreaseStockWithRetry(productId, 10)
            }
        }

        futures.forEach { it.get() }
        executor.shutdown()

        // Then: All requests succeed with retry
        val updatedProduct = productRepository.findById(productId).get()
        assertThat(updatedProduct.stock).isEqualTo(80)
    }

    @Test
    fun `should increment version on every update`() {
        // Given
        val product = productRepository.save(
            Product(
                id = UUID.randomUUID(),
                name = "Test Product",
                stock = 100,
                version = 0L
            )
        )

        // When: First update
        product.stock = 90
        val updated1 = productRepository.save(product)

        // Then: Version incremented
        assertThat(updated1.version).isEqualTo(1L)

        // When: Second update
        updated1.stock = 80
        val updated2 = productRepository.save(updated1)

        // Then: Version incremented again
        assertThat(updated2.version).isEqualTo(2L)
    }
}

// ✅ GOOD: Using @Version
@Entity
data class Product(
    @Id
    val id: UUID,
    var name: String,
    var stock: Int,

    @Version  // Optimistic Locking
    var version: Long = 0L
)

// ✅ GOOD: Retry logic
@Service
class ProductService(
    private val productRepository: ProductRepository
) {
    @Retryable(
        value = [OptimisticLockingFailureException::class],
        maxAttempts = 3,
        backoff = Backoff(delay = 100)
    )
    fun decreaseStockWithRetry(productId: UUID, quantity: Int) {
        val product = productRepository.findById(productId).orElseThrow()
        product.stock -= quantity
        productRepository.save(product)
    }
}
```

### Pessimistic Locking Tests

```kotlin
@SpringBootTest
@Testcontainers
class PessimisticLockingTest {

    @Container
    private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine")

    @Autowired
    private lateinit var accountRepository: AccountRepository

    @Autowired
    private lateinit var transactionManager: PlatformTransactionManager

    @Test
    fun `should process concurrent requests sequentially with pessimistic lock`() {
        // Given
        val accountId = UUID.randomUUID()
        accountRepository.save(
            Account(
                id = accountId,
                balance = 1000.toBigDecimal()
            )
        )

        // When: 10 concurrent withdrawal requests
        val executor = Executors.newFixedThreadPool(10)
        val latch = CountDownLatch(10)
        val withdrawAmount = 100.toBigDecimal()

        repeat(10) {
            executor.submit {
                val txTemplate = TransactionTemplate(transactionManager)
                txTemplate.execute {
                    val account = accountRepository.findByIdWithLock(accountId)
                    Thread.sleep(10) // Simulate concurrency
                    account?.balance = account?.balance?.minus(withdrawAmount)
                    account?.let { accountRepository.save(it) }
                    latch.countDown()
                }
            }
        }

        latch.await(10, TimeUnit.SECONDS)
        executor.shutdown()

        // Then: Sequential processing maintains correct balance
        val finalAccount = accountRepository.findById(accountId).get()
        assertThat(finalAccount.balance).isEqualTo(0.toBigDecimal())
    }

    @Test
    fun `should timeout when lock cannot be acquired`() {
        // Given
        val accountId = UUID.randomUUID()
        accountRepository.save(Account(id = accountId, balance = 1000.toBigDecimal()))

        // When: First transaction holds lock
        val executor = Executors.newFixedThreadPool(2)
        val firstTxStarted = CountDownLatch(1)
        val firstTxContinue = CountDownLatch(1)

        executor.submit {
            val txTemplate = TransactionTemplate(transactionManager).apply {
                timeout = 5
            }
            txTemplate.execute {
                accountRepository.findByIdWithLock(accountId)
                firstTxStarted.countDown()
                firstTxContinue.await(10, TimeUnit.SECONDS)
            }
        }

        firstTxStarted.await()

        // Then: Second transaction times out
        val secondTx = executor.submit {
            val txTemplate = TransactionTemplate(transactionManager).apply {
                timeout = 1  // 1 second timeout
            }
            txTemplate.execute {
                accountRepository.findByIdWithLock(accountId)
            }
        }

        assertThrows<TransactionTimedOutException> {
            secondTx.get()
        }

        firstTxContinue.countDown()
        executor.shutdown()
    }

    @Test
    fun `should prevent deadlock with consistent lock ordering`() {
        // Given: Two accounts
        val account1Id = UUID.randomUUID()
        val account2Id = UUID.randomUUID()

        accountRepository.saveAll(listOf(
            Account(id = account1Id, balance = 1000.toBigDecimal()),
            Account(id = account2Id, balance = 1000.toBigDecimal())
        ))

        // When: Bidirectional transfer executed concurrently
        val executor = Executors.newFixedThreadPool(2)
        val latch = CountDownLatch(2)

        // Always acquire locks in ID order (prevent deadlock)
        val sortedIds = listOf(account1Id, account2Id).sorted()

        executor.submit {
            val txTemplate = TransactionTemplate(transactionManager)
            txTemplate.execute {
                val accounts = accountRepository.findAllByIdWithLock(sortedIds)
                // Transfer logic
                latch.countDown()
            }
        }

        executor.submit {
            val txTemplate = TransactionTemplate(transactionManager)
            txTemplate.execute {
                val accounts = accountRepository.findAllByIdWithLock(sortedIds)
                // Transfer logic
                latch.countDown()
            }
        }

        // Then: All complete without deadlock
        assertThat(latch.await(10, TimeUnit.SECONDS)).isTrue()
        executor.shutdown()
    }
}

// ✅ GOOD: Using Pessimistic Lock
@Repository
interface AccountRepository : JpaRepository<Account, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.id = :id")
    fun findByIdWithLock(@Param("id") id: UUID): Account?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.id IN :ids ORDER BY a.id")
    fun findAllByIdWithLock(@Param("ids") ids: List<UUID>): List<Account>
}
```

### Multi-threaded Concurrency Tests

```kotlin
@SpringBootTest
@Testcontainers
class ConcurrencyTest {

    @Container
    private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine")

    @Autowired
    private lateinit var productService: ProductService

    @Autowired
    private lateinit var productRepository: ProductRepository

    @Test
    fun `should handle concurrent stock decrease correctly`() {
        // Given
        val productId = UUID.randomUUID()
        val initialStock = 100
        productRepository.save(
            Product(
                id = productId,
                name = "Limited Product",
                stock = initialStock
            )
        )

        // When: 100 users buy 1 item concurrently
        val threadCount = 100
        val executor = Executors.newFixedThreadPool(threadCount)
        val latch = CountDownLatch(threadCount)

        repeat(threadCount) {
            executor.submit {
                try {
                    productService.decreaseStock(productId, 1)
                } catch (e: Exception) {
                    // Insufficient stock exception is expected
                } finally {
                    latch.countDown()
                }
            }
        }

        latch.await(10, TimeUnit.SECONDS)
        executor.shutdown()

        // Then: Stock becomes 0 (may go negative with race condition)
        val product = productRepository.findById(productId).get()
        assertThat(product.stock).isEqualTo(0)
        assertThat(product.stock).isGreaterThanOrEqualTo(0) // Prevent negative stock
    }

    @Test
    fun `should prevent over-selling with race condition`() {
        // Given: Stock of 10
        val productId = UUID.randomUUID()
        productRepository.save(
            Product(
                id = productId,
                name = "Limited Product",
                stock = 10
            )
        )

        // When: 20 users attempt to purchase
        val threadCount = 20
        val executor = Executors.newFixedThreadPool(threadCount)
        val latch = CountDownLatch(threadCount)
        val successCount = AtomicInteger(0)
        val failCount = AtomicInteger(0)

        repeat(threadCount) {
            executor.submit {
                try {
                    productService.decreaseStock(productId, 1)
                    successCount.incrementAndGet()
                } catch (e: InsufficientStockException) {
                    failCount.incrementAndGet()
                } finally {
                    latch.countDown()
                }
            }
        }

        latch.await(10, TimeUnit.SECONDS)
        executor.shutdown()

        // Then: Exactly 10 succeed, 10 fail
        assertThat(successCount.get()).isEqualTo(10)
        assertThat(failCount.get()).isEqualTo(10)

        val product = productRepository.findById(productId).get()
        assertThat(product.stock).isEqualTo(0)
    }

    @Test
    fun `should maintain data consistency under high concurrency`() {
        // Given: Account with balance 1000
        val accountId = UUID.randomUUID()
        accountRepository.save(
            Account(
                id = accountId,
                balance = 1000.toBigDecimal()
            )
        )

        // When: Concurrent deposits and withdrawals
        val executor = Executors.newFixedThreadPool(20)
        val latch = CountDownLatch(20)

        // 10 deposits (+100 each)
        repeat(10) {
            executor.submit {
                try {
                    accountService.deposit(accountId, 100.toBigDecimal())
                } finally {
                    latch.countDown()
                }
            }
        }

        // 10 withdrawals (-100 each)
        repeat(10) {
            executor.submit {
                try {
                    accountService.withdraw(accountId, 100.toBigDecimal())
                } finally {
                    latch.countDown()
                }
            }
        }

        latch.await(10, TimeUnit.SECONDS)
        executor.shutdown()

        // Then: Final balance must be accurate
        val account = accountRepository.findById(accountId).get()
        assertThat(account.balance).isEqualTo(1000.toBigDecimal())
    }
}
```

## Performance Testing

### N+1 Query Verification

```kotlin
@SpringBootTest
@Testcontainers
class QueryPerformanceTest {

    @Container
    private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine")

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var entityManager: EntityManager

    @Test
    fun `should avoid N+1 query problem with fetch join`() {
        // Given: 10 users with 5 orders each
        repeat(10) { userIndex ->
            val user = User(
                id = UUID.randomUUID(),
                email = "user$userIndex@example.com",
                name = "User $userIndex"
            )
            userRepository.save(user)

            repeat(5) { orderIndex ->
                orderRepository.save(
                    Order(
                        id = UUID.randomUUID(),
                        userId = user.id,
                        productName = "Product $orderIndex"
                    )
                )
            }
        }

        entityManager.clear() // Clear L1 cache

        // When: Query without fetch join (N+1 occurs)
        val hibernateStats = sessionFactory.statistics
        hibernateStats.clear()
        hibernateStats.isStatisticsEnabled = true

        val usersWithoutFetch = userRepository.findAll()
        usersWithoutFetch.forEach { user ->
            user.orders.size // Lazy loading occurs
        }

        val queriesWithoutFetch = hibernateStats.queryExecutionCount

        // Then: 1 + N queries (1 User query + N Order queries)
        assertThat(queriesWithoutFetch).isEqualTo(11L) // 1 + 10

        // When: Using fetch join
        entityManager.clear()
        hibernateStats.clear()

        val usersWithFetch = userRepository.findAllWithOrders()
        usersWithFetch.forEach { user ->
            user.orders.size // No additional queries
        }

        val queriesWithFetch = hibernateStats.queryExecutionCount

        // Then: Only 1 query
        assertThat(queriesWithFetch).isEqualTo(1L)
    }

    @Test
    fun `should use batch size to optimize lazy loading`() {
        // Given: 100 entities
        repeat(100) {
            userRepository.save(
                User(
                    id = UUID.randomUUID(),
                    email = "user$it@example.com",
                    name = "User $it",
                    profileId = UUID.randomUUID()
                )
            )
        }

        entityManager.clear()

        // When: Using @BatchSize
        val hibernateStats = sessionFactory.statistics
        hibernateStats.clear()
        hibernateStats.isStatisticsEnabled = true

        val users = userRepository.findAll()
        users.forEach { user ->
            user.profile?.name // Lazy loading
        }

        val queryCount = hibernateStats.queryExecutionCount

        // Then: Reduced query count due to batch size (10)
        // With @BatchSize(size = 10), 100 items loaded in batches of 10
        assertThat(queryCount).isLessThan(20L) // 1 (User) + 10 (Profile batches)
    }
}

// ✅ GOOD: Using Fetch Join
@Repository
interface UserRepository : JpaRepository<User, UUID> {
    @Query("SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.orders")
    fun findAllWithOrders(): List<User>

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.profile WHERE u.id = :id")
    fun findByIdWithProfile(@Param("id") id: UUID): User?
}

// ✅ GOOD: BatchSize configuration
@Entity
class User(
    @Id val id: UUID,
    val email: String,
    val name: String,

    @OneToMany(mappedBy = "user")
    @BatchSize(size = 10)  // Mitigate N+1
    val orders: List<Order> = emptyList()
)
```

### Pagination Performance Tests

```kotlin
@SpringBootTest
@Testcontainers
class PagingPerformanceTest {

    @Container
    private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine")

    @Autowired
    private lateinit var productRepository: ProductRepository

    @BeforeEach
    fun setUp() {
        // Given: Large dataset (10,000 items)
        val products = (1..10000).map { index ->
            Product(
                id = UUID.randomUUID(),
                name = "Product $index",
                price = BigDecimal.valueOf(index.toLong()),
                createdAt = LocalDateTime.now().minusDays(index.toLong())
            )
        }
        productRepository.saveAll(products)
    }

    @Test
    fun `should compare offset-based vs cursor-based pagination performance`() {
        // When: Offset-based paging (slower with high offset)
        val offsetStart = System.currentTimeMillis()
        val offsetPage = productRepository.findAll(
            PageRequest.of(9900, 10, Sort.by("createdAt").descending())
        )
        val offsetTime = System.currentTimeMillis() - offsetStart

        // When: Cursor-based paging (consistently fast)
        val cursorStart = System.currentTimeMillis()
        val lastCreatedAt = LocalDateTime.now().minusDays(9900)
        val cursorPage = productRepository.findByCreatedAtLessThan(
            lastCreatedAt,
            PageRequest.of(0, 10, Sort.by("createdAt").descending())
        )
        val cursorTime = System.currentTimeMillis() - cursorStart

        // Then: Cursor approach is much faster
        println("Offset-based: ${offsetTime}ms")
        println("Cursor-based: ${cursorTime}ms")
        assertThat(cursorTime).isLessThan(offsetTime)
    }

    @Test
    fun `should use index for efficient pagination`() {
        // When: Sort by indexed column
        val start = System.currentTimeMillis()
        val page = productRepository.findAll(
            PageRequest.of(0, 100, Sort.by("createdAt").descending())
        )
        val time = System.currentTimeMillis() - start

        // Then: Fast query (using index)
        assertThat(time).isLessThan(100L) // Within 100ms
        assertThat(page.content).hasSize(100)
    }
}

// ✅ GOOD: Cursor-based pagination
@Repository
interface ProductRepository : JpaRepository<Product, UUID> {
    fun findByCreatedAtLessThan(
        createdAt: LocalDateTime,
        pageable: Pageable
    ): Page<Product>
}

// ✅ GOOD: Index configuration
@Entity
@Table(indexes = [
    Index(name = "idx_product_created_at", columnList = "createdAt")
])
class Product(
    @Id val id: UUID,
    val name: String,
    val price: BigDecimal,
    val createdAt: LocalDateTime
)
```

### Batch Processing Tests

```kotlin
@SpringBootTest
@Testcontainers
class BatchProcessingTest {

    @Container
    private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine")

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var entityManager: EntityManager

    @Test
    fun `should use batch insert for better performance`() {
        // Given: 1000 users
        val users = (1..1000).map { index ->
            User(
                id = UUID.randomUUID(),
                email = "user$index@example.com",
                name = "User $index"
            )
        }

        // When: Batch save
        val start = System.currentTimeMillis()

        users.chunked(100).forEach { chunk ->
            userRepository.saveAll(chunk)
            entityManager.flush()
            entityManager.clear() // Memory management
        }

        val time = System.currentTimeMillis() - start

        // Then: Fast save
        println("Batch insert time: ${time}ms")
        assertThat(userRepository.count()).isEqualTo(1000L)
    }

    @Test
    fun `should manage memory with flush and clear`() {
        // Given: Large update
        val users = (1..10000).map { index ->
            User(
                id = UUID.randomUUID(),
                email = "user$index@example.com",
                name = "User $index"
            )
        }
        userRepository.saveAll(users)
        entityManager.clear()

        // When: Update with memory management
        val maxMemoryBefore = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()

        userRepository.findAll().forEachIndexed { index, user ->
            user.name = "Updated ${user.name}"

            if (index % 100 == 0) {
                entityManager.flush()
                entityManager.clear() // Clear L1 cache
                System.gc()
            }
        }

        val maxMemoryAfter = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()

        // Then: Memory usage doesn't increase significantly
        val memoryIncrease = maxMemoryAfter - maxMemoryBefore
        println("Memory increase: ${memoryIncrease / 1024 / 1024}MB")

        // Without flush/clear, OutOfMemoryError can occur
    }

    @Test
    fun `should use JDBC batch for bulk operations`() {
        // Given
        val batchSize = 100

        // When: Check JDBC batch configuration
        val hibernateProperties = entityManager.entityManagerFactory
            .unwrap(SessionFactory::class.java)
            .properties

        // Then: Verify batch configuration
        assertThat(hibernateProperties["hibernate.jdbc.batch_size"]).isEqualTo(batchSize.toString())
    }
}

// ✅ GOOD: application.yml batch configuration
/*
spring:
  jpa:
    properties:
      hibernate:
        jdbc:
          batch_size: 100
        order_inserts: true
        order_updates: true
*/
```

## Advanced Integration Test Patterns

### Transaction Rollback Pattern

```kotlin
@SpringBootTest
@Transactional  // Auto rollback after each test
@Testcontainers
class TransactionalIntegrationTest {

    @Container
    private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine")

    @Autowired
    private lateinit var userRepository: UserRepository

    @Test
    fun `should rollback transaction after test`() {
        // Given & When
        userRepository.save(
            User(
                id = UUID.randomUUID(),
                email = "test@example.com",
                name = "Test User"
            )
        )

        // Then
        assertThat(userRepository.count()).isEqualTo(1)

        // Auto rollback after test completion
    }

    @Test
    fun `should have clean database for each test`() {
        // Given: Previous test data rolled back, clean state

        // When & Then
        assertThat(userRepository.count()).isEqualTo(0)
    }

    @Test
    @Commit  // Explicitly commit when needed
    fun `should commit when explicitly specified`() {
        // Given & When
        userRepository.save(
            User(
                id = UUID.randomUUID(),
                email = "persist@example.com",
                name = "Persist User"
            )
        )

        // Then: This data is committed
    }

    @Test
    @Rollback(false)  // Same as @Commit
    fun `should also commit with rollback false`() {
        userRepository.save(
            User(
                id = UUID.randomUUID(),
                email = "another@example.com",
                name = "Another User"
            )
        )
    }
}

// ❌ BAD: Manual cleanup without @Transactional (cumbersome)
@SpringBootTest
class ManualCleanupTest {

    @Autowired
    private lateinit var userRepository: UserRepository

    @AfterEach
    fun tearDown() {
        userRepository.deleteAll() // Manual cleanup every time
    }
}
```

### When to Use @DirtiesContext

```kotlin
@SpringBootTest
@Testcontainers
class DirtiesContextTest {

    @Container
    private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine")

    @Autowired
    private lateinit var cacheManager: CacheManager

    @Autowired
    private lateinit var userService: UserService

    @Test
    @DirtiesContext  // Recreate context after this test
    fun `should clear cache and recreate context`() {
        // Given: Store data in cache
        val user = userService.getUserById(UUID.randomUUID())

        // When: Change cache state
        cacheManager.getCache("users")?.clear()

        // Then: Next test starts with clean context
    }

    @Test
    @DirtiesContext(methodMode = DirtiesContext.MethodMode.BEFORE_METHOD)
    fun `should recreate context before this test`() {
        // Context recreated before this test execution
    }

    // ❌ BAD: Overuse makes tests very slow
    // Don't use @DirtiesContext on every test!
}

// ✅ GOOD: When @DirtiesContext is needed
// 1. Tests that modify cache state
// 2. Tests that modify application context beans
// 3. Tests that modify static variables

// ❌ BAD: When @DirtiesContext is unnecessary
// 1. Simple database operations (@Transactional is sufficient)
// 2. Stateless service tests
// 3. Repository tests
```

### TestContainers Usage

```kotlin
@SpringBootTest
@Testcontainers
class TestContainersIntegrationTest {

    companion object {
        // ✅ GOOD: Reuse containers across all tests
        @Container
        @JvmStatic
        private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine").apply {
            withDatabaseName("testdb")
            withUsername("test")
            withPassword("test")
            withReuse(true)  // Reuse container
        }

        @Container
        @JvmStatic
        private val redis = GenericContainer<Nothing>("redis:7-alpine").apply {
            withExposedPorts(6379)
            withReuse(true)
        }

        @DynamicPropertySource
        @JvmStatic
        fun properties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", postgres::getJdbcUrl)
            registry.add("spring.datasource.username", postgres::getUsername)
            registry.add("spring.datasource.password", postgres::getPassword)
            registry.add("spring.redis.host", redis::getHost)
            registry.add("spring.redis.port", redis::getFirstMappedPort)
        }
    }

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var redisTemplate: RedisTemplate<String, String>

    @Test
    fun `should use PostgreSQL container`() {
        // Given & When
        val user = userRepository.save(
            User(
                id = UUID.randomUUID(),
                email = "test@example.com",
                name = "Test User"
            )
        )

        // Then
        assertThat(user.id).isNotNull()
    }

    @Test
    fun `should use Redis container`() {
        // Given & When
        redisTemplate.opsForValue().set("test-key", "test-value")
        val value = redisTemplate.opsForValue().get("test-key")

        // Then
        assertThat(value).isEqualTo("test-value")
    }
}

// ❌ BAD: Creating container for each test (very slow)
@SpringBootTest
class SlowTestContainersTest {

    @Container
    private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine")
    // Container started/stopped for every test
}
```

### Database Initialization Strategies

```kotlin
@SpringBootTest
@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)  // One instance per class
class DatabaseInitializationTest {

    @Container
    private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine")

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var jdbcTemplate: JdbcTemplate

    // ✅ GOOD: Execute once before all tests
    @BeforeAll
    fun setUpAll() {
        // Create common test data
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_user_email ON users(email)")
    }

    // ✅ GOOD: Execute before each test
    @BeforeEach
    fun setUp() {
        // Initialize test data
        userRepository.deleteAll()
    }

    @Test
    fun `should have clean database`() {
        assertThat(userRepository.count()).isEqualTo(0)
    }

    @Test
    @Sql("/test-data.sql")  // Load test data from SQL file
    fun `should load test data from SQL file`() {
        assertThat(userRepository.count()).isGreaterThan(0)
    }

    @Test
    @Sql(
        scripts = ["/test-data.sql"],
        executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD
    )
    @Sql(
        scripts = ["/cleanup.sql"],
        executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD
    )
    fun `should execute SQL before and after test`() {
        // Test execution
    }
}

// ❌ BAD: Sharing data between tests (violates independence)
@SpringBootTest
class SharedDataTest {

    companion object {
        private var testData: User? = null
    }

    @Test
    fun `first test`() {
        testData = userRepository.save(User(...))
    }

    @Test
    fun `second test`() {
        // Depends on first test (bad pattern!)
        assertThat(testData).isNotNull()
    }
}
```

## Test Data Management

### Fixture Pattern

```kotlin
// ✅ GOOD: Object Mother Pattern
object UserFixture {
    fun createUser(
        id: UUID = UUID.randomUUID(),
        email: String = "test@example.com",
        name: String = "Test User",
        status: UserStatus = UserStatus.ACTIVE
    ): User {
        return User(
            id = id,
            email = email,
            name = name,
            status = status,
            createdAt = LocalDateTime.now()
        )
    }

    fun createAdminUser(): User {
        return createUser(
            email = "admin@example.com",
            name = "Admin User",
            status = UserStatus.ACTIVE
        )
    }

    fun createInactiveUser(): User {
        return createUser(
            status = UserStatus.INACTIVE
        )
    }
}

// ✅ GOOD: Builder Pattern
class UserBuilder {
    private var id: UUID = UUID.randomUUID()
    private var email: String = "test@example.com"
    private var name: String = "Test User"
    private var status: UserStatus = UserStatus.ACTIVE
    private var createdAt: LocalDateTime = LocalDateTime.now()

    fun withId(id: UUID) = apply { this.id = id }
    fun withEmail(email: String) = apply { this.email = email }
    fun withName(name: String) = apply { this.name = name }
    fun withStatus(status: UserStatus) = apply { this.status = status }
    fun withCreatedAt(createdAt: LocalDateTime) = apply { this.createdAt = createdAt }

    fun build(): User {
        return User(
            id = id,
            email = email,
            name = name,
            status = status,
            createdAt = createdAt
        )
    }
}

// Usage examples
@SpringBootTest
class UserServiceTest {

    @Test
    fun `should create user with fixture`() {
        // Given: Object Mother Pattern
        val user = UserFixture.createUser(
            email = "custom@example.com"
        )

        // When & Then
        assertThat(user.email).isEqualTo("custom@example.com")
    }

    @Test
    fun `should create user with builder`() {
        // Given: Builder Pattern
        val user = UserBuilder()
            .withEmail("builder@example.com")
            .withName("Builder User")
            .build()

        // When & Then
        assertThat(user.email).isEqualTo("builder@example.com")
        assertThat(user.name).isEqualTo("Builder User")
    }
}

// ❌ BAD: Duplicating data creation in every test
@Test
fun `bad test 1`() {
    val user = User(
        id = UUID.randomUUID(),
        email = "test@example.com",
        name = "Test User",
        status = UserStatus.ACTIVE,
        createdAt = LocalDateTime.now()
    )
}

@Test
fun `bad test 2`() {
    val user = User(  // Repeating same code
        id = UUID.randomUUID(),
        email = "test@example.com",
        name = "Test User",
        status = UserStatus.ACTIVE,
        createdAt = LocalDateTime.now()
    )
}
```

### Test Isolation

```kotlin
@SpringBootTest
class TestIsolationTest {

    @Autowired
    private lateinit var userRepository: UserRepository

    // ✅ GOOD: @BeforeEach - Execute before each test
    @BeforeEach
    fun setUp() {
        userRepository.deleteAll()
        // Each test starts with independent state
    }

    @Test
    fun `test 1 should not affect test 2`() {
        userRepository.save(UserFixture.createUser())
        assertThat(userRepository.count()).isEqualTo(1)
    }

    @Test
    fun `test 2 should start with clean state`() {
        // setUp() executed, clean state
        assertThat(userRepository.count()).isEqualTo(0)
    }
}

// ✅ GOOD: @BeforeAll - Execute once before all tests
@SpringBootTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OneTimeSetupTest {

    @Autowired
    private lateinit var userRepository: UserRepository

    private lateinit var sharedData: List<User>

    @BeforeAll
    fun setUpAll() {
        // Read-only shared data (do not modify)
        sharedData = listOf(
            UserFixture.createUser(email = "user1@example.com"),
            UserFixture.createUser(email = "user2@example.com")
        )
        userRepository.saveAll(sharedData)
    }

    @Test
    fun `test 1 reads shared data`() {
        val users = userRepository.findAll()
        assertThat(users).hasSize(2)
    }

    @Test
    fun `test 2 also reads shared data`() {
        val users = userRepository.findAll()
        assertThat(users).hasSize(2)
    }

    // ❌ BAD: Don't modify shared data
    // @Test
    // fun `bad test modifies shared data`() {
    //     userRepository.deleteAll()  // Affects other tests!
    // }
}

// ❌ BAD: Depending on test order
@SpringBootTest
@TestMethodOrder(MethodOrderer.OrderAnnotation::class)
class OrderDependentTest {

    @Test
    @Order(1)
    fun `first test creates data`() {
        userRepository.save(UserFixture.createUser())
    }

    @Test
    @Order(2)
    fun `second test depends on first test`() {
        // Depends on first test (bad pattern!)
        assertThat(userRepository.count()).isEqualTo(1)
    }

    // Tests should succeed in any order!
}
```

## Checklist

**Common to all tests:**
- [ ] Are Given-When-Then comments clearly written?
- [ ] Is the test name clear? (descriptive)
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

**Security Testing:**
- [ ] Unauthenticated request tests (401) written?
- [ ] Unauthorized access tests (403) written?
- [ ] SQL Injection prevention verified?
- [ ] XSS prevention tested?
- [ ] Sensitive data not exposed in logs/responses verified?

**Concurrency Testing:**
- [ ] Optimistic Locking tests written?
- [ ] Pessimistic Locking tested when needed?
- [ ] Race Condition verified in multi-threaded environment?
- [ ] Critical business logic concurrency tested (e.g., stock decrease)?

**Performance Testing:**
- [ ] N+1 query problem verified?
- [ ] Fetch Join used appropriately?
- [ ] Pagination performance tested?
- [ ] Flush/clear used in batch processing?

**Integration Testing:**
- [ ] Test isolation guaranteed with @Transactional?
- [ ] TestContainers used for realistic environment testing?
- [ ] Test order independence guaranteed?
- [ ] @DirtiesContext not overused?

**Test Data Management:**
- [ ] Fixture pattern used for test data reuse?
- [ ] Builder or Object Mother pattern utilized?
- [ ] @BeforeEach and @BeforeAll used appropriately?
- [ ] Data isolation between tests guaranteed?
