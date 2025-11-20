---
title: API 설계
weight: 4
---

제가 API를 설계할 때 따르는 RESTful API 설계 원칙입니다.

## RESTful API 기본 원칙

### HTTP 메서드

각 HTTP 메서드는 명확한 의미를 가집니다:

| 메서드 | 용도 | 멱등성 | 안전성 |
|--------|------|--------|--------|
| `GET` | 리소스 조회 | O | O |
| `POST` | 리소스 생성 | X | X |
| `PUT` | 리소스 전체 수정 | O | X |
| `PATCH` | 리소스 부분 수정 | X | X |
| `DELETE` | 리소스 삭제 (Soft Delete) | O | X |

**멱등성**: 동일한 요청을 여러 번 보내도 결과가 동일
**안전성**: 서버 상태를 변경하지 않음

### URL 설계 규칙

```bash
# ✅ GOOD: 명사 복수형, 소문자, 하이픈 사용
GET    /api/v1/users
GET    /api/v1/users/{id}
POST   /api/v1/users
PUT    /api/v1/users/{id}
DELETE /api/v1/users/{id}

# ✅ GOOD: 계층 구조 표현
GET    /api/v1/users/{userId}/orders
GET    /api/v1/users/{userId}/orders/{orderId}

# ✅ GOOD: 검색, 필터링
GET    /api/v1/users?status=active&page=1&size=20
GET    /api/v1/orders?startDate=2024-01-01&endDate=2024-12-31

# ❌ BAD: 동사 사용
GET    /api/v1/getUsers
POST   /api/v1/createUser

# ❌ BAD: 대문자, 언더스코어 사용
GET    /api/v1/Users
GET    /api/v1/user_orders

# ❌ BAD: 파일 확장자 포함
GET    /api/v1/users.json
```

## HTTP 상태 코드

### 성공 응답 (2xx)

```kotlin
// 200 OK: 조회 성공
@GetMapping("/{id}")
fun getUser(@PathVariable id: UUID): ResponseEntity<UserResponse> {
    val user = userService.getUserById(id)
        ?: return ResponseEntity.notFound().build()
    return ResponseEntity.ok(UserResponse.from(user))
}

// 201 Created: 생성 성공
@PostMapping
fun createUser(@Valid @RequestBody request: CreateUserRequest): ResponseEntity<UserResponse> {
    val user = userService.createUser(request)
    return ResponseEntity
        .created(URI.create("/api/v1/users/${user.id}"))
        .body(UserResponse.from(user))
}

// 204 No Content: 삭제 성공 (응답 본문 없음)
@DeleteMapping("/{id}")
fun deleteUser(@PathVariable id: UUID): ResponseEntity<Void> {
    userService.deleteUser(id)
    return ResponseEntity.noContent().build()
}
```

### 클라이언트 오류 (4xx)

```kotlin
// 400 Bad Request: 잘못된 요청
// @RestControllerAdvice를 통해 처리하는 것을 권장
@PostMapping
fun createUser(@Valid @RequestBody request: CreateUserRequest): ResponseEntity<UserResponse> {
    try {
        val user = userService.createUser(request)
        return ResponseEntity
            .created(URI.create("/api/v1/users/${user.id}"))
            .body(UserResponse.from(user))
    } catch (e: ValidationException) {
        // @RestControllerAdvice에서 처리하도록 throw
        throw e
    }
}

// 401 Unauthorized: 인증 실패
// 403 Forbidden: 권한 없음
// 404 Not Found: 리소스 없음
@GetMapping("/{id}")
fun getUser(@PathVariable id: UUID): ResponseEntity<UserResponse> {
    val user = userService.getUserById(id)
        ?: return ResponseEntity.notFound().build()  // 404
    return ResponseEntity.ok(UserResponse.from(user))
}

// 409 Conflict: 리소스 충돌
// @RestControllerAdvice를 통해 처리
@PostMapping
fun createUser(@Valid @RequestBody request: CreateUserRequest): ResponseEntity<UserResponse> {
    // DuplicateEmailException은 @RestControllerAdvice에서 처리
    val user = userService.createUser(request)
    return ResponseEntity
        .created(URI.create("/api/v1/users/${user.id}"))
        .body(UserResponse.from(user))
}
```

### 서버 오류 (5xx)

```kotlin
// 500 Internal Server Error: 서버 내부 오류
@RestControllerAdvice
class GlobalExceptionHandler {

    companion object {
        private val logger = LoggerFactory.getLogger(GlobalExceptionHandler::class.java)
    }

    @ExceptionHandler(Exception::class)
    fun handleException(e: Exception): ResponseEntity<ErrorResponse> {
        logger.error("Unexpected error occurred", e)
        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ErrorResponse(
                code = "INTERNAL_ERROR",
                message = "An unexpected error occurred"
            ))
    }
}
```

## 요청/응답 DTO

### Request DTO

```kotlin
// ✅ GOOD: 검증 어노테이션 사용
data class CreateUserRequest(
    @field:NotBlank(message = "Email is required")
    @field:Email(message = "Invalid email format")
    val email: String,

    @field:NotBlank(message = "Name is required")
    @field:Size(min = 2, max = 50, message = "Name must be between 2 and 50 characters")
    val name: String,

    @field:Min(value = 18, message = "Age must be at least 18")
    val age: Int
)

// ✅ GOOD: 부분 수정용 DTO
data class UpdateUserRequest(
    @field:Email(message = "Invalid email format")
    val email: String? = null,

    @field:Size(min = 2, max = 50, message = "Name must be between 2 and 50 characters")
    val name: String? = null,

    @field:Min(value = 18, message = "Age must be at least 18")
    val age: Int? = null
)
```

### Response DTO

```kotlin
// ✅ GOOD: 필요한 필드만 노출
data class UserResponse(
    val id: UUID,
    val email: String,
    val name: String,
    val status: String,
    val createdAt: LocalDateTime
) {
    companion object {
        fun from(user: User): UserResponse {
            return UserResponse(
                id = user.id,
                email = user.email,
                name = user.name,
                status = user.status,
                createdAt = user.createdAt
            )
        }
    }
}

// ❌ BAD: Domain 객체 직접 노출
@GetMapping("/{id}")
fun getUser(@PathVariable id: UUID): User {  // ❌ Domain 객체 노출
    return userService.getUserById(id)
}
```

### 리스트 응답 (페이징)

```kotlin
// ✅ GOOD: Spring Data의 Pageable과 Page 사용
@GetMapping
fun getUsers(
    @PageableDefault(size = 20, sort = ["createdAt"], direction = Sort.Direction.DESC)
    pageable: Pageable
): ResponseEntity<Page<UserResponse>> {
    val users = userService.getUsers(pageable)
    val userResponses = users.map { UserResponse.from(it) }
    return ResponseEntity.ok(userResponses)
}

// 커스텀 페이징 응답이 필요한 경우
data class PageResponse<T>(
    val content: List<T>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
    val hasNext: Boolean,
    val hasPrevious: Boolean
) {
    companion object {
        fun <T> from(page: Page<T>): PageResponse<T> {
            return PageResponse(
                content = page.content,
                page = page.number,
                size = page.size,
                totalElements = page.totalElements,
                totalPages = page.totalPages,
                hasNext = page.hasNext(),
                hasPrevious = page.hasPrevious()
            )
        }
    }
}
```

## 에러 응답

### 표준 에러 응답 형식

```kotlin
// ✅ GOOD: 일관된 에러 응답 형식
data class ErrorResponse(
    val code: String,
    val message: String,
    val errors: List<FieldError>? = null,
    val timestamp: LocalDateTime = LocalDateTime.now()
)

data class FieldError(
    val field: String,
    val message: String,
    val rejectedValue: Any? = null
)
```

### 검증 오류 처리

```kotlin
@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidationException(e: MethodArgumentNotValidException): ResponseEntity<ErrorResponse> {
        val errors = e.bindingResult.fieldErrors.map { error ->
            FieldError(
                field = error.field,
                message = error.defaultMessage ?: "Validation failed",
                rejectedValue = error.rejectedValue
            )
        }

        return ResponseEntity
            .badRequest()
            .body(ErrorResponse(
                code = "VALIDATION_ERROR",
                message = "Request validation failed",
                errors = errors
            ))
    }
}
```

### 비즈니스 오류 처리

```kotlin
// Custom Exception
sealed class BusinessException(
    val errorCode: String,
    message: String
) : RuntimeException(message)

class DuplicateEmailException(email: String) : BusinessException(
    errorCode = "DUPLICATE_EMAIL",
    message = "Email already exists: $email"
)

class UserNotFoundException(userId: UUID) : BusinessException(
    errorCode = "USER_NOT_FOUND",
    message = "User not found: $userId"
)

// Exception Handler
@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException::class)
    fun handleBusinessException(e: BusinessException): ResponseEntity<ErrorResponse> {
        val status = when (e) {
            is DuplicateEmailException -> HttpStatus.CONFLICT
            is UserNotFoundException -> HttpStatus.NOT_FOUND
            else -> HttpStatus.BAD_REQUEST
        }

        return ResponseEntity
            .status(status)
            .body(ErrorResponse(
                code = e.errorCode,
                message = e.message ?: "Business error occurred"
            ))
    }
}
```

## API 버전 관리

### URL 버전 관리 (권장)

```kotlin
// ✅ GOOD: URL에 버전 명시
@RestController
@RequestMapping("/api/v1/users")
class UserControllerV1

@RestController
@RequestMapping("/api/v2/users")
class UserControllerV2
```

### 헤더 버전 관리

```kotlin
// 선택적: Accept 헤더로 버전 관리
@RestController
@RequestMapping("/api/users")
class UserController {

    @GetMapping(produces = ["application/vnd.api.v1+json"])
    fun getUsersV1(): List<UserResponseV1>

    @GetMapping(produces = ["application/vnd.api.v2+json"])
    fun getUsersV2(): List<UserResponseV2>
}
```

## 필터링, 정렬, 검색

### 필터링

```kotlin
// ✅ GOOD: Query Parameter로 필터링
@GetMapping
fun getUsers(
    @RequestParam(required = false) status: String?,
    @RequestParam(required = false) email: String?,
    @RequestParam(required = false) ageMin: Int?,
    @RequestParam(required = false) ageMax: Int?
): ResponseEntity<List<UserResponse>> {
    val users = userService.getUsers(
        status = status,
        email = email,
        ageMin = ageMin,
        ageMax = ageMax
    )
    val userResponses = users.map { UserResponse.from(it) }
    return ResponseEntity.ok(userResponses)
}

// 사용 예시
// GET /api/v1/users?status=active&ageMin=18&ageMax=65
```

### 정렬

```kotlin
// ✅ GOOD: Pageable을 사용한 정렬
@GetMapping
fun getUsers(
    @PageableDefault(size = 20, sort = ["createdAt"], direction = Sort.Direction.DESC)
    pageable: Pageable
): ResponseEntity<Page<UserResponse>> {
    val users = userService.getUsers(pageable)
    val userResponses = users.map { UserResponse.from(it) }
    return ResponseEntity.ok(userResponses)
}

// 사용 예시
// GET /api/v1/users?sort=name,asc
// GET /api/v1/users?sort=createdAt,desc
// GET /api/v1/users?sort=name,asc&sort=createdAt,desc (다중 정렬)
```

### 검색

```kotlin
// ✅ GOOD: 검색어는 q 또는 search 파라미터 사용
@GetMapping("/search")
fun searchUsers(
    @RequestParam q: String,
    @PageableDefault(size = 20, sort = ["createdAt"], direction = Sort.Direction.DESC)
    pageable: Pageable
): ResponseEntity<Page<UserResponse>> {
    val users = userService.searchUsers(q, pageable)
    val userResponses = users.map { UserResponse.from(it) }
    return ResponseEntity.ok(userResponses)
}

// 사용 예시
// GET /api/v1/users/search?q=john&page=0&size=20
// GET /api/v1/users/search?q=john&sort=name,asc
```

## Validation 계층

### Request DTO Validation

```kotlin
// ✅ GOOD: 여러 계층의 검증
data class CreateUserRequest(
    // 1. 기본 검증 (Bean Validation)
    @field:NotBlank(message = "Email is required")
    @field:Email(message = "Invalid email format")
    val email: String,

    // 2. 길이 검증
    @field:Size(min = 8, max = 100, message = "Password must be between 8 and 100 characters")
    @field:Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@\$!%*?&])[A-Za-z\\d@\$!%*?&]{8,}\$",
        message = "Password must contain uppercase, lowercase, number and special character"
    )
    val password: String,

    // 3. 범위 검증
    @field:Min(value = 18, message = "Age must be at least 18")
    @field:Max(value = 150, message = "Age must be less than 150")
    val age: Int
)

// Controller에서 @Valid 적용
@PostMapping
fun createUser(@Valid @RequestBody request: CreateUserRequest): ResponseEntity<UserResponse> {
    val user = userService.createUser(request)
    return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(user))
}
```

### Custom Validation

```kotlin
// 커스텀 어노테이션
@Target(AnnotationTarget.FIELD)
@Retention(AnnotationRetention.RUNTIME)
@Constraint(validatedBy = [PhoneNumberValidator::class])
annotation class PhoneNumber(
    val message: String = "Invalid phone number format",
    val groups: Array<KClass<*>> = [],
    val payload: Array<KClass<out Payload>> = []
)

// Validator 구현
class PhoneNumberValidator : ConstraintValidator<PhoneNumber, String> {
    override fun isValid(value: String?, context: ConstraintValidatorContext): Boolean {
        if (value == null) return true
        return value.matches(Regex("^01[0-9]-\\d{4}-\\d{4}\$"))
    }
}

// 사용
data class CreateUserRequest(
    @field:PhoneNumber(message = "Phone number must be in format 010-1234-5678")
    val phoneNumber: String?
)
```

### 비즈니스 검증 (Service 계층)

```kotlin
@Service
class UserService(private val userRepository: UserRepository) {

    @Transactional
    fun createUser(request: CreateUserRequest): User {
        // 비즈니스 검증: 이메일 중복 체크
        if (userRepository.existsByEmail(request.email)) {
            throw DuplicateEmailException("Email already exists: ${request.email}")
        }

        // 비즈니스 검증: 나이 제한 (예: 특정 서비스는 20세 이상만 가능)
        if (request.age < 20) {
            throw BusinessValidationException("This service requires age 20 or above")
        }

        val user = User(
            id = UUID.randomUUID(),
            email = request.email,
            name = request.name,
            age = request.age
        )

        return userRepository.save(user)
    }
}
```

## 보안 (Security)

### 비밀번호 평문 저장 금지

```kotlin
// ❌ BAD: 비밀번호 평문 저장
@Entity
class User(
    val id: UUID,
    val email: String,
    val password: String  // ❌ 평문 저장
)

// ✅ GOOD: BCrypt로 암호화
@Entity
class User(
    val id: UUID,
    val email: String,
    var password: String  // BCrypt 해시 저장
) {
    fun updatePassword(rawPassword: String, passwordEncoder: PasswordEncoder) {
        this.password = passwordEncoder.encode(rawPassword)
    }
}

@Service
class UserService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder  // BCryptPasswordEncoder
) {
    @Transactional
    fun createUser(request: CreateUserRequest): User {
        val user = User(
            id = UUID.randomUUID(),
            email = request.email,
            password = passwordEncoder.encode(request.password)  // ✅ 암호화
        )
        return userRepository.save(user)
    }
}
```

### XSS 방지

```kotlin
// ✅ GOOD: HTML 이스케이프 처리
@RestControllerAdvice
class SecurityAdvice {

    @InitBinder
    fun initBinder(binder: WebDataBinder) {
        binder.registerCustomEditor(String::class.java, object : PropertyEditorSupport() {
            override fun setAsText(text: String) {
                // HTML 태그 제거 또는 이스케이프
                value = StringEscapeUtils.escapeHtml4(text)
            }
        })
    }
}

// 또는 Request DTO에서 검증
data class CreatePostRequest(
    @field:NotBlank
    @field:Pattern(
        regexp = "^[^<>]*\$",  // HTML 태그 금지
        message = "HTML tags are not allowed"
    )
    val content: String
)
```

### CSRF 토큰 사용

```kotlin
@Configuration
@EnableWebSecurity
class SecurityConfig {

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        return http
            // CSRF 활성화 (기본값, REST API는 비활성화 가능)
            .csrf { csrf ->
                csrf.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
            }
            .authorizeHttpRequests {
                it.requestMatchers("/api/v1/public/**").permitAll()
                  .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                  .anyRequest().authenticated()
            }
            .build()
    }
}
```

### JWT 토큰 보안

```kotlin
@Service
class JwtTokenProvider(
    @Value("\${jwt.secret}") private val secretKey: String,
    @Value("\${jwt.expiration}") private val expiration: Long
) {
    private val logger = LoggerFactory.getLogger(JwtTokenProvider::class.java)

    fun generateToken(userId: UUID): String {
        val now = Date()
        val expiryDate = Date(now.time + expiration)

        return Jwts.builder()
            .setSubject(userId.toString())
            .setIssuedAt(now)
            .setExpiration(expiryDate)
            .signWith(SignatureAlgorithm.HS512, secretKey)  // ✅ 강력한 알고리즘 사용
            .compact()
    }

    fun validateToken(token: String): Boolean {
        try {
            Jwts.parser().setSigningKey(secretKey).parseClaimsJws(token)
            return true
        } catch (ex: MalformedJwtException) {
            logger.error("Invalid JWT token")
        } catch (ex: ExpiredJwtException) {
            logger.error("Expired JWT token")
        } catch (ex: UnsupportedJwtException) {
            logger.error("Unsupported JWT token")
        } catch (ex: IllegalArgumentException) {
            logger.error("JWT claims string is empty")
        }
        return false
    }
}
```

### 인증 헤더

```kotlin
// ✅ GOOD: Bearer Token 사용
// Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

@Configuration
@EnableWebSecurity
class SecurityConfig {

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        return http
            .csrf { it.disable() }  // REST API는 CSRF 비활성화 (stateless)
            .sessionManagement {
                it.sessionCreationPolicy(SessionCreationPolicy.STATELESS)  // ✅ Stateless
            }
            .authorizeHttpRequests {
                it.requestMatchers("/api/v1/public/**").permitAll()
                  .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                  .anyRequest().authenticated()
            }
            .oauth2ResourceServer { it.jwt { } }
            .build()
    }
}
```

### Input Sanitization

```kotlin
// ✅ GOOD: 입력 값 정제
@Service
class UserService {

    fun createUser(request: CreateUserRequest): User {
        // 공백 제거
        val trimmedEmail = request.email.trim()
        val trimmedName = request.name.trim()

        // 특수문자 제거 (이름에서)
        val sanitizedName = trimmedName.replace(Regex("[^a-zA-Z가-힣\\s]"), "")

        // 길이 제한
        if (sanitizedName.length > 50) {
            throw ValidationException("Name is too long")
        }

        val user = User(
            id = UUID.randomUUID(),
            email = trimmedEmail.toLowerCase(),  // 이메일은 소문자로 정규화
            name = sanitizedName
        )

        return userRepository.save(user)
    }
}
```

### Rate Limiting

```kotlin
// ✅ GOOD: Rate Limit 헤더 응답
@GetMapping
fun getUsers(): ResponseEntity<List<UserResponse>> {
    val users = userService.getUsers()
    val userResponses = users.map { UserResponse.from(it) }

    // Response Headers:
    // X-RateLimit-Limit: 100
    // X-RateLimit-Remaining: 99
    // X-RateLimit-Reset: 1640995200
    return ResponseEntity.ok(userResponses)
}
```

## CORS 설정

```kotlin
@Configuration
class CorsConfig {

    @Bean
    fun corsFilter(): CorsFilter {
        val config = CorsConfiguration().apply {
            allowedOrigins = listOf("https://example.com")
            allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            allowedHeaders = listOf("*")
            allowCredentials = true
            maxAge = 3600L
        }

        val source = UrlBasedCorsConfigurationSource().apply {
            registerCorsConfiguration("/**", config)
        }

        return CorsFilter(source)
    }
}
```

## 체크리스트

**API 설계 시:**
- [ ] RESTful 원칙을 따르는가? (명사, 복수형, HTTP 메서드)
- [ ] 적절한 HTTP 상태 코드를 사용하는가?
- [ ] URL에 버전을 포함하는가? (/api/v1/...)
- [ ] Request/Response DTO를 사용하는가? (Domain 직접 노출 금지)
- [ ] 일관된 에러 응답 형식을 사용하는가?

**Validation:**
- [ ] Request DTO에 Bean Validation 어노테이션이 있는가?
- [ ] Controller에서 @Valid를 사용하는가?
- [ ] 비즈니스 검증은 Service 계층에서 수행하는가?
- [ ] Custom Validation이 필요한 경우 구현했는가?
- [ ] 입력 값 정제(sanitization)를 수행하는가?

**보안 (Security):**
- [ ] SQL Injection 방지를 위해 Prepared Statement를 사용하는가?
- [ ] XSS 방지를 위해 HTML 이스케이프 처리를 하는가?
- [ ] CSRF 토큰을 사용하는가? (stateful의 경우)
- [ ] 비밀번호를 평문으로 저장하지 않는가? (BCrypt 사용)
- [ ] JWT 토큰에 강력한 알고리즘을 사용하는가? (HS512 이상)
- [ ] HTTPS를 강제하는가?
- [ ] 민감정보를 로깅하지 않는가?
- [ ] 예외 메시지에 민감정보가 포함되지 않는가?
- [ ] CORS가 적절히 설정되어 있는가?
- [ ] Rate Limiting이 적용되어 있는가?

**인증/인가:**
- [ ] 인증이 필요한 API에 인증이 적용되어 있는가?
- [ ] 역할 기반 접근 제어(RBAC)가 구현되어 있는가?
- [ ] Stateless 세션 관리를 사용하는가? (JWT)
- [ ] 토큰 만료 시간이 적절한가?

**에러 메시지:**
- [ ] 에러 메시지가 명확한가?
- [ ] 일관된 에러 응답 형식을 사용하는가?
- [ ] 검증 오류 시 어떤 필드가 문제인지 명시하는가?
- [ ] 민감정보가 에러 메시지에 포함되지 않는가?

**페이징 및 필터링:**
- [ ] 리스트 API에 페이징이 적용되어 있는가?
- [ ] 페이징 파라미터(page, size)가 명확한가?
- [ ] 필터링 파라미터가 명확한가?
- [ ] 정렬 옵션이 제공되는가?
- [ ] 최대 페이지 크기 제한이 있는가? (예: max 100)
