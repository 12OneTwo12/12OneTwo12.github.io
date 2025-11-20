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
    `when`(userRepository.existsByEmail(request.email)).thenReturn(false)
    `when`(userRepository.save(any())).thenAnswer { it.arguments[0] }

    // When: 테스트 실행 단계
    val result = userService.createUser(request)

    // Then: 검증 단계
    assertThat(result).isNotNull
    assertThat(result?.email).isEqualTo("test@example.com")
    verify(userRepository).save(any())
}
```

## Controller 테스트

### 기본 템플릿

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
            "email" to "invalid-email",  // 잘못된 이메일 형식
            "name" to ""  // 빈 이름
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
        // Given: 데이터 없음

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
        assertThat(found).isEmpty  // Soft deleted 사용자는 조회되지 않음
    }
}
```

### Repository 테스트 체크리스트

- [ ] 실제 데이터베이스 또는 TestContainer를 사용하는가?
- [ ] @DataJpaTest 어노테이션을 사용하는가?
- [ ] @BeforeEach에서 데이터를 초기화하는가?
- [ ] 조회, 저장, 수정, 삭제를 모두 테스트하는가?
- [ ] Soft Delete 처리를 테스트하는가?
- [ ] Given-When-Then 주석이 있는가?

## 통합 테스트

### Spring MVC 통합 테스트

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

        // When: 사용자 생성
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

        // Then: 생성된 사용자 조회
        mockMvc.perform(get("/api/v1/users/{id}", createResponse.id))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.email").value("integration@example.com"))
            .andExpect(jsonPath("$.name").value("Integration Test"))
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
        userRepository.save(user)

        val updateRequest = UpdateUserRequest(
            email = "new@example.com",
            name = "New Name"
        )

        // When: 사용자 수정
        mockMvc.perform(
            put("/api/v1/users/{id}", user.id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateRequest))
        )
            .andExpect(status().isOk)

        // Then: 수정된 내용 확인
        mockMvc.perform(get("/api/v1/users/{id}", user.id))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.email").value("new@example.com"))
            .andExpect(jsonPath("$.name").value("New Name"))
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
        userRepository.save(user)

        // When: 사용자 삭제
        mockMvc.perform(delete("/api/v1/users/{id}", user.id))
            .andExpect(status().isNoContent)

        // Then: 삭제된 사용자는 조회 불가
        mockMvc.perform(get("/api/v1/users/{id}", user.id))
            .andExpect(status().isNotFound)
    }
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

## 보안 테스트

### 인증/인가 테스트

**모든 보안 관련 엔드포인트는 반드시 테스트되어야 합니다.**

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

### SQL Injection 방지 테스트

```kotlin
@DataJpaTest
class UserRepositorySqlInjectionTest {

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var entityManager: EntityManager

    @Test
    fun `should prevent SQL injection in email search`() {
        // Given: SQL Injection 시도
        val maliciousEmail = "test@example.com' OR '1'='1"

        userRepository.save(User(
            id = UUID.randomUUID(),
            email = "legitimate@example.com",
            name = "Legitimate User"
        ))

        // When: Prepared Statement를 사용하므로 SQL Injection 불가
        val found = userRepository.findByEmail(maliciousEmail)

        // Then: 정확히 일치하는 이메일만 검색됨
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

        // When: @Query에서 :parameter 사용 (안전)
        val searchTerm = "'; DROP TABLE users; --"
        val results = userRepository.searchByNameContaining(searchTerm)

        // Then: 테이블이 삭제되지 않고 안전하게 검색
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

// ❌ BAD: String concatenation (위험!)
// @Query("SELECT u FROM User u WHERE u.name LIKE '%" + searchTerm + "%'")
```

### XSS 방지 테스트

```kotlin
@WebMvcTest(UserController::class)
class XssPreventionTest {

    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockBean
    private lateinit var userService: UserService

    @Test
    fun `should escape HTML tags in user input`() {
        // Given: XSS 공격 시도
        val maliciousName = "<script>alert('XSS')</script>"
        val request = CreateUserRequest(
            email = "test@example.com",
            name = maliciousName
        )

        val savedUser = User(
            id = UUID.randomUUID(),
            email = request.email,
            name = maliciousName  // 실제로는 이스케이프 처리됨
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
            // 응답이 Content-Type: application/json이므로 자동 이스케이프
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

### 민감정보 보호 테스트

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

        // Then: 예외 메시지에 비밀번호가 포함되지 않음
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

        // Then: 로그에 비밀번호가 마스킹됨
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

        // Then: JSON에 비밀번호 필드가 포함되지 않음
        assertThat(json).doesNotContain("password")
        assertThat(json).doesNotContain("hashedPassword")
    }
}

// ✅ GOOD: Password 필드 제외
data class User(
    val id: UUID,
    val email: String,
    @JsonIgnore  // JSON 직렬화에서 제외
    val password: String,
    val name: String
)

// ✅ GOOD: toString에서 비밀번호 마스킹
data class UserDto(
    val email: String,
    private val password: String
) {
    override fun toString(): String {
        return "UserDto(email=$email, password=****)"
    }
}
```

## 동시성 테스트

### Optimistic Locking 테스트

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
        // Given: 동일한 상품을 두 번 조회
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

        // When: 첫 번째 수정은 성공
        product1.stock -= 10
        productRepository.save(product1)

        // Then: 두 번째 수정은 OptimisticLockException 발생
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

        // When: 재시도 로직이 있는 서비스 메서드 호출
        val executor = Executors.newFixedThreadPool(2)
        val futures = (1..2).map {
            executor.submit {
                productService.decreaseStockWithRetry(productId, 10)
            }
        }

        futures.forEach { it.get() }
        executor.shutdown()

        // Then: 재시도로 인해 모든 요청 성공
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

        // When: 첫 번째 업데이트
        product.stock = 90
        val updated1 = productRepository.save(product)

        // Then: version이 증가
        assertThat(updated1.version).isEqualTo(1L)

        // When: 두 번째 업데이트
        updated1.stock = 80
        val updated2 = productRepository.save(updated1)

        // Then: version이 다시 증가
        assertThat(updated2.version).isEqualTo(2L)
    }
}

// ✅ GOOD: @Version 사용
@Entity
data class Product(
    @Id
    val id: UUID,
    var name: String,
    var stock: Int,

    @Version  // Optimistic Locking
    var version: Long = 0L
)

// ✅ GOOD: 재시도 로직
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

### Pessimistic Locking 테스트

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

        // When: 동시에 10번 출금 요청
        val executor = Executors.newFixedThreadPool(10)
        val latch = CountDownLatch(10)
        val withdrawAmount = 100.toBigDecimal()

        repeat(10) {
            executor.submit {
                val txTemplate = TransactionTemplate(transactionManager)
                txTemplate.execute {
                    val account = accountRepository.findByIdWithLock(accountId)
                    Thread.sleep(10) // 동시성 시뮬레이션
                    account?.balance = account?.balance?.minus(withdrawAmount)
                    account?.let { accountRepository.save(it) }
                    latch.countDown()
                }
            }
        }

        latch.await(10, TimeUnit.SECONDS)
        executor.shutdown()

        // Then: 순차 처리되어 정확한 잔액 유지
        val finalAccount = accountRepository.findById(accountId).get()
        assertThat(finalAccount.balance).isEqualTo(0.toBigDecimal())
    }

    @Test
    fun `should timeout when lock cannot be acquired`() {
        // Given
        val accountId = UUID.randomUUID()
        accountRepository.save(Account(id = accountId, balance = 1000.toBigDecimal()))

        // When: 첫 번째 트랜잭션이 락을 보유
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

        // Then: 두 번째 트랜잭션은 타임아웃
        val secondTx = executor.submit {
            val txTemplate = TransactionTemplate(transactionManager).apply {
                timeout = 1  // 1초 타임아웃
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
        // Given: 두 개의 계좌
        val account1Id = UUID.randomUUID()
        val account2Id = UUID.randomUUID()

        accountRepository.saveAll(listOf(
            Account(id = account1Id, balance = 1000.toBigDecimal()),
            Account(id = account2Id, balance = 1000.toBigDecimal())
        ))

        // When: 양방향 이체를 동시에 실행
        val executor = Executors.newFixedThreadPool(2)
        val latch = CountDownLatch(2)

        // 항상 ID 순서대로 락 획득 (데드락 방지)
        val sortedIds = listOf(account1Id, account2Id).sorted()

        executor.submit {
            val txTemplate = TransactionTemplate(transactionManager)
            txTemplate.execute {
                val accounts = accountRepository.findAllByIdWithLock(sortedIds)
                // 이체 로직
                latch.countDown()
            }
        }

        executor.submit {
            val txTemplate = TransactionTemplate(transactionManager)
            txTemplate.execute {
                val accounts = accountRepository.findAllByIdWithLock(sortedIds)
                // 이체 로직
                latch.countDown()
            }
        }

        // Then: 데드락 없이 모두 완료
        assertThat(latch.await(10, TimeUnit.SECONDS)).isTrue()
        executor.shutdown()
    }
}

// ✅ GOOD: Pessimistic Lock 사용
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

### 멀티스레드 동시성 테스트

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

        // When: 100명이 동시에 1개씩 구매
        val threadCount = 100
        val executor = Executors.newFixedThreadPool(threadCount)
        val latch = CountDownLatch(threadCount)

        repeat(threadCount) {
            executor.submit {
                try {
                    productService.decreaseStock(productId, 1)
                } catch (e: Exception) {
                    // 재고 부족 예외는 정상
                } finally {
                    latch.countDown()
                }
            }
        }

        latch.await(10, TimeUnit.SECONDS)
        executor.shutdown()

        // Then: 재고가 0이 되어야 함 (Race Condition 발생 시 음수가 될 수 있음)
        val product = productRepository.findById(productId).get()
        assertThat(product.stock).isEqualTo(0)
        assertThat(product.stock).isGreaterThanOrEqualTo(0) // 음수 방지 확인
    }

    @Test
    fun `should prevent over-selling with race condition`() {
        // Given: 재고 10개
        val productId = UUID.randomUUID()
        productRepository.save(
            Product(
                id = productId,
                name = "Limited Product",
                stock = 10
            )
        )

        // When: 20명이 동시에 구매 시도
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

        // Then: 정확히 10번만 성공, 10번은 실패
        assertThat(successCount.get()).isEqualTo(10)
        assertThat(failCount.get()).isEqualTo(10)

        val product = productRepository.findById(productId).get()
        assertThat(product.stock).isEqualTo(0)
    }

    @Test
    fun `should maintain data consistency under high concurrency`() {
        // Given: 잔액 1000원인 계좌
        val accountId = UUID.randomUUID()
        accountRepository.save(
            Account(
                id = accountId,
                balance = 1000.toBigDecimal()
            )
        )

        // When: 동시에 입금/출금 발생
        val executor = Executors.newFixedThreadPool(20)
        val latch = CountDownLatch(20)

        // 10번 입금 (+100원)
        repeat(10) {
            executor.submit {
                try {
                    accountService.deposit(accountId, 100.toBigDecimal())
                } finally {
                    latch.countDown()
                }
            }
        }

        // 10번 출금 (-100원)
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

        // Then: 최종 잔액이 정확해야 함
        val account = accountRepository.findById(accountId).get()
        assertThat(account.balance).isEqualTo(1000.toBigDecimal())
    }
}
```

## 성능 테스트

### N+1 쿼리 검증

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
        // Given: 10명의 사용자, 각각 5개의 주문
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

        entityManager.clear() // 1차 캐시 제거

        // When: Fetch Join 없이 조회 (N+1 발생)
        val hibernateStats = sessionFactory.statistics
        hibernateStats.clear()
        hibernateStats.isStatisticsEnabled = true

        val usersWithoutFetch = userRepository.findAll()
        usersWithoutFetch.forEach { user ->
            user.orders.size // Lazy Loading 발생
        }

        val queriesWithoutFetch = hibernateStats.queryExecutionCount

        // Then: 1 + N번의 쿼리 발생 (1개의 User 조회 + N개의 Order 조회)
        assertThat(queriesWithoutFetch).isEqualTo(11L) // 1 + 10

        // When: Fetch Join 사용
        entityManager.clear()
        hibernateStats.clear()

        val usersWithFetch = userRepository.findAllWithOrders()
        usersWithFetch.forEach { user ->
            user.orders.size // 추가 쿼리 없음
        }

        val queriesWithFetch = hibernateStats.queryExecutionCount

        // Then: 1번의 쿼리만 발생
        assertThat(queriesWithFetch).isEqualTo(1L)
    }

    @Test
    fun `should use batch size to optimize lazy loading`() {
        // Given: 100개의 엔티티
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

        // When: @BatchSize 사용
        val hibernateStats = sessionFactory.statistics
        hibernateStats.clear()
        hibernateStats.isStatisticsEnabled = true

        val users = userRepository.findAll()
        users.forEach { user ->
            user.profile?.name // Lazy Loading
        }

        val queryCount = hibernateStats.queryExecutionCount

        // Then: 배치 사이즈(10) 덕분에 쿼리 수 감소
        // @BatchSize(size = 10)이면 100개를 10개씩 묶어서 조회
        assertThat(queryCount).isLessThan(20L) // 1 (User) + 10 (Profile batches)
    }
}

// ✅ GOOD: Fetch Join 사용
@Repository
interface UserRepository : JpaRepository<User, UUID> {
    @Query("SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.orders")
    fun findAllWithOrders(): List<User>

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.profile WHERE u.id = :id")
    fun findByIdWithProfile(@Param("id") id: UUID): User?
}

// ✅ GOOD: BatchSize 설정
@Entity
class User(
    @Id val id: UUID,
    val email: String,
    val name: String,

    @OneToMany(mappedBy = "user")
    @BatchSize(size = 10)  // N+1 완화
    val orders: List<Order> = emptyList()
)
```

### 페이징 성능 테스트

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
        // Given: 대용량 데이터 (10,000개)
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
        // When: Offset 기반 페이징 (뒤로 갈수록 느림)
        val offsetStart = System.currentTimeMillis()
        val offsetPage = productRepository.findAll(
            PageRequest.of(9900, 10, Sort.by("createdAt").descending())
        )
        val offsetTime = System.currentTimeMillis() - offsetStart

        // When: Cursor 기반 페이징 (항상 빠름)
        val cursorStart = System.currentTimeMillis()
        val lastCreatedAt = LocalDateTime.now().minusDays(9900)
        val cursorPage = productRepository.findByCreatedAtLessThan(
            lastCreatedAt,
            PageRequest.of(0, 10, Sort.by("createdAt").descending())
        )
        val cursorTime = System.currentTimeMillis() - cursorStart

        // Then: Cursor 방식이 훨씬 빠름
        println("Offset-based: ${offsetTime}ms")
        println("Cursor-based: ${cursorTime}ms")
        assertThat(cursorTime).isLessThan(offsetTime)
    }

    @Test
    fun `should use index for efficient pagination`() {
        // When: 인덱스가 있는 컬럼으로 정렬
        val start = System.currentTimeMillis()
        val page = productRepository.findAll(
            PageRequest.of(0, 100, Sort.by("createdAt").descending())
        )
        val time = System.currentTimeMillis() - start

        // Then: 빠른 조회 (인덱스 활용)
        assertThat(time).isLessThan(100L) // 100ms 이내
        assertThat(page.content).hasSize(100)
    }
}

// ✅ GOOD: Cursor 기반 페이징
@Repository
interface ProductRepository : JpaRepository<Product, UUID> {
    fun findByCreatedAtLessThan(
        createdAt: LocalDateTime,
        pageable: Pageable
    ): Page<Product>
}

// ✅ GOOD: 인덱스 설정
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

### 배치 처리 테스트

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
        // Given: 1000명의 사용자
        val users = (1..1000).map { index ->
            User(
                id = UUID.randomUUID(),
                email = "user$index@example.com",
                name = "User $index"
            )
        }

        // When: 배치 저장
        val start = System.currentTimeMillis()

        users.chunked(100).forEach { chunk ->
            userRepository.saveAll(chunk)
            entityManager.flush()
            entityManager.clear() // 메모리 관리
        }

        val time = System.currentTimeMillis() - start

        // Then: 빠른 저장
        println("Batch insert time: ${time}ms")
        assertThat(userRepository.count()).isEqualTo(1000L)
    }

    @Test
    fun `should manage memory with flush and clear`() {
        // Given: 대용량 업데이트
        val users = (1..10000).map { index ->
            User(
                id = UUID.randomUUID(),
                email = "user$index@example.com",
                name = "User $index"
            )
        }
        userRepository.saveAll(users)
        entityManager.clear()

        // When: 메모리 관리하며 업데이트
        val maxMemoryBefore = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()

        userRepository.findAll().forEachIndexed { index, user ->
            user.name = "Updated ${user.name}"

            if (index % 100 == 0) {
                entityManager.flush()
                entityManager.clear() // 1차 캐시 비우기
                System.gc()
            }
        }

        val maxMemoryAfter = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()

        // Then: 메모리 사용량이 크게 증가하지 않음
        val memoryIncrease = maxMemoryAfter - maxMemoryBefore
        println("Memory increase: ${memoryIncrease / 1024 / 1024}MB")

        // flush/clear 없이 하면 OutOfMemoryError 발생 가능
    }

    @Test
    fun `should use JDBC batch for bulk operations`() {
        // Given
        val batchSize = 100

        // When: JDBC 배치 설정 확인
        val hibernateProperties = entityManager.entityManagerFactory
            .unwrap(SessionFactory::class.java)
            .properties

        // Then: 배치 설정 확인
        assertThat(hibernateProperties["hibernate.jdbc.batch_size"]).isEqualTo(batchSize.toString())
    }
}

// ✅ GOOD: application.yml 배치 설정
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

## 통합 테스트 고급 패턴

### 트랜잭션 롤백 패턴

```kotlin
@SpringBootTest
@Transactional  // 각 테스트 후 자동 롤백
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

        // 테스트 종료 후 자동 롤백됨
    }

    @Test
    fun `should have clean database for each test`() {
        // Given: 이전 테스트의 데이터가 롤백되어 깨끗한 상태

        // When & Then
        assertThat(userRepository.count()).isEqualTo(0)
    }

    @Test
    @Commit  // 예외적으로 커밋이 필요한 경우
    fun `should commit when explicitly specified`() {
        // Given & When
        userRepository.save(
            User(
                id = UUID.randomUUID(),
                email = "persist@example.com",
                name = "Persist User"
            )
        )

        // Then: 이 데이터는 커밋됨
    }

    @Test
    @Rollback(false)  // @Commit과 동일
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

// ❌ BAD: @Transactional 없이 수동 정리 (번거로움)
@SpringBootTest
class ManualCleanupTest {

    @Autowired
    private lateinit var userRepository: UserRepository

    @AfterEach
    fun tearDown() {
        userRepository.deleteAll() // 매번 수동으로 정리
    }
}
```

### @DirtiesContext 사용 시기

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
    @DirtiesContext  // 이 테스트 후 컨텍스트 재생성
    fun `should clear cache and recreate context`() {
        // Given: 캐시에 데이터 저장
        val user = userService.getUserById(UUID.randomUUID())

        // When: 캐시 상태 변경
        cacheManager.getCache("users")?.clear()

        // Then: 다음 테스트는 깨끗한 컨텍스트에서 시작
    }

    @Test
    @DirtiesContext(methodMode = DirtiesContext.MethodMode.BEFORE_METHOD)
    fun `should recreate context before this test`() {
        // 이 테스트 실행 전에 컨텍스트 재생성
    }

    // ❌ BAD: 남용하면 테스트가 매우 느려짐
    // @DirtiesContext를 모든 테스트에 사용하지 말 것!
}

// ✅ GOOD: @DirtiesContext 사용이 필요한 경우
// 1. 캐시 상태를 변경하는 테스트
// 2. 애플리케이션 컨텍스트 빈을 수정하는 테스트
// 3. 정적 변수를 변경하는 테스트

// ❌ BAD: @DirtiesContext가 불필요한 경우
// 1. 단순 데이터베이스 조작 (@Transactional로 충분)
// 2. 상태 없는 서비스 테스트
// 3. Repository 테스트
```

### TestContainers 활용

```kotlin
@SpringBootTest
@Testcontainers
class TestContainersIntegrationTest {

    companion object {
        // ✅ GOOD: 모든 테스트에서 컨테이너 재사용
        @Container
        @JvmStatic
        private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine").apply {
            withDatabaseName("testdb")
            withUsername("test")
            withPassword("test")
            withReuse(true)  // 컨테이너 재사용
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

// ❌ BAD: 각 테스트마다 컨테이너 생성 (매우 느림)
@SpringBootTest
class SlowTestContainersTest {

    @Container
    private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine")
    // 매 테스트마다 컨테이너 시작/종료 반복
}
```

### 데이터베이스 초기화 전략

```kotlin
@SpringBootTest
@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)  // 클래스당 한 번만 인스턴스 생성
class DatabaseInitializationTest {

    @Container
    private val postgres = PostgreSQLContainer<Nothing>("postgres:15-alpine")

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var jdbcTemplate: JdbcTemplate

    // ✅ GOOD: 모든 테스트 전에 한 번만 실행
    @BeforeAll
    fun setUpAll() {
        // 공통 테스트 데이터 생성
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_user_email ON users(email)")
    }

    // ✅ GOOD: 각 테스트 전에 실행
    @BeforeEach
    fun setUp() {
        // 테스트 데이터 초기화
        userRepository.deleteAll()
    }

    @Test
    fun `should have clean database`() {
        assertThat(userRepository.count()).isEqualTo(0)
    }

    @Test
    @Sql("/test-data.sql")  // SQL 파일로 테스트 데이터 로드
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
        // 테스트 실행
    }
}

// ❌ BAD: 테스트 간 데이터 공유 (독립성 위배)
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
        // 첫 번째 테스트에 의존 (나쁜 패턴!)
        assertThat(testData).isNotNull()
    }
}
```

## 테스트 데이터 관리

### Fixture 패턴

```kotlin
// ✅ GOOD: Object Mother 패턴
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

// ✅ GOOD: Builder 패턴
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

// 사용 예시
@SpringBootTest
class UserServiceTest {

    @Test
    fun `should create user with fixture`() {
        // Given: Object Mother 패턴
        val user = UserFixture.createUser(
            email = "custom@example.com"
        )

        // When & Then
        assertThat(user.email).isEqualTo("custom@example.com")
    }

    @Test
    fun `should create user with builder`() {
        // Given: Builder 패턴
        val user = UserBuilder()
            .withEmail("builder@example.com")
            .withName("Builder User")
            .build()

        // When & Then
        assertThat(user.email).isEqualTo("builder@example.com")
        assertThat(user.name).isEqualTo("Builder User")
    }
}

// ❌ BAD: 테스트마다 데이터 중복 생성
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
    val user = User(  // 동일한 코드 반복
        id = UUID.randomUUID(),
        email = "test@example.com",
        name = "Test User",
        status = UserStatus.ACTIVE,
        createdAt = LocalDateTime.now()
    )
}
```

### 테스트 격리

```kotlin
@SpringBootTest
class TestIsolationTest {

    @Autowired
    private lateinit var userRepository: UserRepository

    // ✅ GOOD: @BeforeEach - 각 테스트 전에 실행
    @BeforeEach
    fun setUp() {
        userRepository.deleteAll()
        // 각 테스트가 독립적인 상태에서 시작
    }

    @Test
    fun `test 1 should not affect test 2`() {
        userRepository.save(UserFixture.createUser())
        assertThat(userRepository.count()).isEqualTo(1)
    }

    @Test
    fun `test 2 should start with clean state`() {
        // setUp()이 실행되어 깨끗한 상태
        assertThat(userRepository.count()).isEqualTo(0)
    }
}

// ✅ GOOD: @BeforeAll - 모든 테스트 전에 한 번만 실행
@SpringBootTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OneTimeSetupTest {

    @Autowired
    private lateinit var userRepository: UserRepository

    private lateinit var sharedData: List<User>

    @BeforeAll
    fun setUpAll() {
        // 읽기 전용 공통 데이터 (변경하지 않음)
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

    // ❌ BAD: 공유 데이터를 수정하면 안 됨
    // @Test
    // fun `bad test modifies shared data`() {
    //     userRepository.deleteAll()  // 다른 테스트에 영향!
    // }
}

// ❌ BAD: 테스트 순서에 의존
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
        // 첫 번째 테스트에 의존 (나쁜 패턴!)
        assertThat(userRepository.count()).isEqualTo(1)
    }

    // 테스트는 어떤 순서로 실행되어도 성공해야 함!
}
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

**보안 테스트:**
- [ ] 인증되지 않은 요청 테스트 (401)를 작성했는가?
- [ ] 권한 없는 접근 테스트 (403)를 작성했는가?
- [ ] SQL Injection 방지를 검증했는가?
- [ ] XSS 방지 처리를 테스트했는가?
- [ ] 민감정보가 로그/응답에 노출되지 않는지 확인했는가?

**동시성 테스트:**
- [ ] Optimistic Locking 테스트를 작성했는가?
- [ ] Pessimistic Locking이 필요한 경우 테스트했는가?
- [ ] 멀티스레드 환경에서 Race Condition을 검증했는가?
- [ ] 재고 감소 등 중요 비즈니스 로직의 동시성을 테스트했는가?

**성능 테스트:**
- [ ] N+1 쿼리 문제를 검증했는가?
- [ ] Fetch Join을 적절히 사용했는가?
- [ ] 페이징 성능을 테스트했는가?
- [ ] 배치 처리 시 flush/clear를 사용했는가?

**통합 테스트:**
- [ ] @Transactional로 테스트 격리를 보장했는가?
- [ ] TestContainers를 사용하여 실제 환경과 유사하게 테스트했는가?
- [ ] 테스트 순서 독립성을 보장했는가?
- [ ] @DirtiesContext를 남용하지 않았는가?

**테스트 데이터 관리:**
- [ ] Fixture 패턴을 사용하여 테스트 데이터를 재사용하는가?
- [ ] Builder 또는 Object Mother 패턴을 활용하는가?
- [ ] @BeforeEach와 @BeforeAll을 적절히 구분하여 사용하는가?
- [ ] 테스트 간 데이터 격리가 보장되는가?
