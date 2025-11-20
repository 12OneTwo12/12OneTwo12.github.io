---
title: API Design
weight: 4
---

These are the RESTful API design principles I follow when designing APIs.

## RESTful API Basic Principles

### HTTP Methods

Each HTTP method has a clear meaning:

| Method | Purpose | Idempotent | Safe |
|--------|---------|-----------|------|
| `GET` | Retrieve resource | O | O |
| `POST` | Create resource | X | X |
| `PUT` | Full update resource | O | X |
| `PATCH` | Partial update resource | X | X |
| `DELETE` | Delete resource (Soft Delete) | O | X |

**Idempotent**: Same result even if the same request is sent multiple times
**Safe**: Does not change server state

### URL Design Rules

```bash
# ✅ GOOD: Plural nouns, lowercase, hyphen usage
GET    /api/v1/users
GET    /api/v1/users/{id}
POST   /api/v1/users
PUT    /api/v1/users/{id}
DELETE /api/v1/users/{id}

# ✅ GOOD: Hierarchical structure
GET    /api/v1/users/{userId}/orders
GET    /api/v1/users/{userId}/orders/{orderId}

# ✅ GOOD: Search, filtering
GET    /api/v1/users?status=active&page=1&size=20
GET    /api/v1/orders?startDate=2024-01-01&endDate=2024-12-31

# ❌ BAD: Using verbs
GET    /api/v1/getUsers
POST   /api/v1/createUser

# ❌ BAD: Uppercase, underscore usage
GET    /api/v1/Users
GET    /api/v1/user_orders

# ❌ BAD: Including file extensions
GET    /api/v1/users.json
```

## HTTP Status Codes

### Success Responses (2xx)

```kotlin
// 200 OK: Retrieve success
@GetMapping("/{id}")
fun getUser(@PathVariable id: UUID): ResponseEntity<UserResponse> {
    val user = userService.getUserById(id)
        ?: return ResponseEntity.notFound().build()
    return ResponseEntity.ok(UserResponse.from(user))
}

// 201 Created: Creation success
@PostMapping
fun createUser(@Valid @RequestBody request: CreateUserRequest): ResponseEntity<UserResponse> {
    val user = userService.createUser(request)
    return ResponseEntity
        .created(URI.create("/api/v1/users/${user.id}"))
        .body(UserResponse.from(user))
}

// 204 No Content: Delete success (no response body)
@DeleteMapping("/{id}")
fun deleteUser(@PathVariable id: UUID): ResponseEntity<Void> {
    userService.deleteUser(id)
    return ResponseEntity.noContent().build()
}
```

### Client Errors (4xx)

```kotlin
// 400 Bad Request: Invalid request
// Recommended to handle via @RestControllerAdvice
@PostMapping
fun createUser(@Valid @RequestBody request: CreateUserRequest): ResponseEntity<UserResponse> {
    try {
        val user = userService.createUser(request)
        return ResponseEntity
            .created(URI.create("/api/v1/users/${user.id}"))
            .body(UserResponse.from(user))
    } catch (e: ValidationException) {
        // Throw to be handled by @RestControllerAdvice
        throw e
    }
}

// 401 Unauthorized: Authentication failed
// 403 Forbidden: No permission
// 404 Not Found: Resource not found
@GetMapping("/{id}")
fun getUser(@PathVariable id: UUID): ResponseEntity<UserResponse> {
    val user = userService.getUserById(id)
        ?: return ResponseEntity.notFound().build()  // 404
    return ResponseEntity.ok(UserResponse.from(user))
}

// 409 Conflict: Resource conflict
// Handled via @RestControllerAdvice
@PostMapping
fun createUser(@Valid @RequestBody request: CreateUserRequest): ResponseEntity<UserResponse> {
    // DuplicateEmailException handled by @RestControllerAdvice
    val user = userService.createUser(request)
    return ResponseEntity
        .created(URI.create("/api/v1/users/${user.id}"))
        .body(UserResponse.from(user))
}
```

### Server Errors (5xx)

```kotlin
// 500 Internal Server Error: Server internal error
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

## Request/Response DTOs

### Request DTO

```kotlin
// ✅ GOOD: Using validation annotations
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

// ✅ GOOD: DTO for partial updates
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
// ✅ GOOD: Expose only necessary fields
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

// ❌ BAD: Directly exposing Domain object
@GetMapping("/{id}")
fun getUser(@PathVariable id: UUID): User {  // ❌ Domain object exposure
    return userService.getUserById(id)
}
```

### List Response (Pagination)

```kotlin
// ✅ GOOD: Using Spring Data's Pageable and Page
@GetMapping
fun getUsers(
    @PageableDefault(size = 20, sort = ["createdAt"], direction = Sort.Direction.DESC)
    pageable: Pageable
): ResponseEntity<Page<UserResponse>> {
    val users = userService.getUsers(pageable)
    val userResponses = users.map { UserResponse.from(it) }
    return ResponseEntity.ok(userResponses)
}

// When custom pagination response is needed
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

## Error Responses

### Standard Error Response Format

```kotlin
// ✅ GOOD: Consistent error response format
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

### Validation Error Handling

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

### Business Error Handling

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

## API Versioning

### URL Versioning (Recommended)

```kotlin
// ✅ GOOD: Specify version in URL
@RestController
@RequestMapping("/api/v1/users")
class UserControllerV1

@RestController
@RequestMapping("/api/v2/users")
class UserControllerV2
```

### Header Versioning

```kotlin
// Optional: Version management via Accept header
@RestController
@RequestMapping("/api/users")
class UserController {

    @GetMapping(produces = ["application/vnd.api.v1+json"])
    fun getUsersV1(): List<UserResponseV1>

    @GetMapping(produces = ["application/vnd.api.v2+json"])
    fun getUsersV2(): List<UserResponseV2>
}
```

## Filtering, Sorting, Searching

### Filtering

```kotlin
// ✅ GOOD: Filter with Query Parameters
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

// Usage example
// GET /api/v1/users?status=active&ageMin=18&ageMax=65
```

### Sorting

```kotlin
// ✅ GOOD: Sorting using Pageable
@GetMapping
fun getUsers(
    @PageableDefault(size = 20, sort = ["createdAt"], direction = Sort.Direction.DESC)
    pageable: Pageable
): ResponseEntity<Page<UserResponse>> {
    val users = userService.getUsers(pageable)
    val userResponses = users.map { UserResponse.from(it) }
    return ResponseEntity.ok(userResponses)
}

// Usage example
// GET /api/v1/users?sort=name,asc
// GET /api/v1/users?sort=createdAt,desc
// GET /api/v1/users?sort=name,asc&sort=createdAt,desc (multiple sorting)
```

### Searching

```kotlin
// ✅ GOOD: Use q or search parameter for search terms
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

// Usage example
// GET /api/v1/users/search?q=john&page=0&size=20
// GET /api/v1/users/search?q=john&sort=name,asc
```

## Validation Layer

### Request DTO Validation

```kotlin
// ✅ GOOD: Multi-layered validation
data class CreateUserRequest(
    // 1. Basic validation (Bean Validation)
    @field:NotBlank(message = "Email is required")
    @field:Email(message = "Invalid email format")
    val email: String,

    // 2. Length validation
    @field:Size(min = 8, max = 100, message = "Password must be between 8 and 100 characters")
    @field:Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@\$!%*?&])[A-Za-z\\d@\$!%*?&]{8,}\$",
        message = "Password must contain uppercase, lowercase, number and special character"
    )
    val password: String,

    // 3. Range validation
    @field:Min(value = 18, message = "Age must be at least 18")
    @field:Max(value = 150, message = "Age must be less than 150")
    val age: Int
)

// Apply @Valid in Controller
@PostMapping
fun createUser(@Valid @RequestBody request: CreateUserRequest): ResponseEntity<UserResponse> {
    val user = userService.createUser(request)
    return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(user))
}
```

### Custom Validation

```kotlin
// Custom annotation
@Target(AnnotationTarget.FIELD)
@Retention(AnnotationRetention.RUNTIME)
@Constraint(validatedBy = [PhoneNumberValidator::class])
annotation class PhoneNumber(
    val message: String = "Invalid phone number format",
    val groups: Array<KClass<*>> = [],
    val payload: Array<KClass<out Payload>> = []
)

// Validator implementation
class PhoneNumberValidator : ConstraintValidator<PhoneNumber, String> {
    override fun isValid(value: String?, context: ConstraintValidatorContext): Boolean {
        if (value == null) return true
        return value.matches(Regex("^01[0-9]-\\d{4}-\\d{4}\$"))
    }
}

// Usage
data class CreateUserRequest(
    @field:PhoneNumber(message = "Phone number must be in format 010-1234-5678")
    val phoneNumber: String?
)
```

### Business Validation (Service Layer)

```kotlin
@Service
class UserService(private val userRepository: UserRepository) {

    @Transactional
    fun createUser(request: CreateUserRequest): User {
        // Business validation: Email duplication check
        if (userRepository.existsByEmail(request.email)) {
            throw DuplicateEmailException("Email already exists: ${request.email}")
        }

        // Business validation: Age restriction (e.g., service requires age 20+)
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

## Security (Enhanced)

### Never Store Passwords in Plain Text

```kotlin
// ❌ BAD: Storing password in plain text
@Entity
class User(
    val id: UUID,
    val email: String,
    val password: String  // ❌ Plain text storage
)

// ✅ GOOD: Encrypt with BCrypt
@Entity
class User(
    val id: UUID,
    val email: String,
    var password: String  // Store BCrypt hash
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
            password = passwordEncoder.encode(request.password)  // ✅ Encrypt
        )
        return userRepository.save(user)
    }
}
```

### XSS Prevention

```kotlin
// ✅ GOOD: HTML escape processing
@RestControllerAdvice
class SecurityAdvice {

    @InitBinder
    fun initBinder(binder: WebDataBinder) {
        binder.registerCustomEditor(String::class.java, object : PropertyEditorSupport() {
            override fun setAsText(text: String) {
                // Remove or escape HTML tags
                value = StringEscapeUtils.escapeHtml4(text)
            }
        })
    }
}

// Or validate in Request DTO
data class CreatePostRequest(
    @field:NotBlank
    @field:Pattern(
        regexp = "^[^<>]*\$",  // Prohibit HTML tags
        message = "HTML tags are not allowed"
    )
    val content: String
)
```

### CSRF Token Usage

```kotlin
@Configuration
@EnableWebSecurity
class SecurityConfig {

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        return http
            // Enable CSRF (default, can be disabled for REST API)
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

### JWT Token Security

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
            .signWith(SignatureAlgorithm.HS512, secretKey)  // ✅ Use strong algorithm
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

### Authentication Header

```kotlin
// ✅ GOOD: Using Bearer Token
// Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

@Configuration
@EnableWebSecurity
class SecurityConfig {

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        return http
            .csrf { it.disable() }  // Disable CSRF for REST API (stateless)
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
// ✅ GOOD: Input value sanitization
@Service
class UserService {

    fun createUser(request: CreateUserRequest): User {
        // Remove whitespace
        val trimmedEmail = request.email.trim()
        val trimmedName = request.name.trim()

        // Remove special characters (from name)
        val sanitizedName = trimmedName.replace(Regex("[^a-zA-Z가-힣\\s]"), "")

        // Length limit
        if (sanitizedName.length > 50) {
            throw ValidationException("Name is too long")
        }

        val user = User(
            id = UUID.randomUUID(),
            email = trimmedEmail.toLowerCase(),  // Normalize email to lowercase
            name = sanitizedName
        )

        return userRepository.save(user)
    }
}
```

### Rate Limiting

```kotlin
// ✅ GOOD: Rate Limit header response
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

## CORS Configuration

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

## Checklist

**When designing APIs:**
- [ ] Follows RESTful principles? (nouns, plural, HTTP methods)
- [ ] Uses appropriate HTTP status codes?
- [ ] Includes version in URL? (/api/v1/...)
- [ ] Uses Request/Response DTOs? (No direct Domain exposure)
- [ ] Uses consistent error response format?

**Validation:**
- [ ] Request DTOs have Bean Validation annotations?
- [ ] Using @Valid in Controller?
- [ ] Business validation performed in Service layer?
- [ ] Custom Validation implemented when necessary?
- [ ] Input sanitization performed?

**Security:**
- [ ] Using Prepared Statements to prevent SQL Injection?
- [ ] HTML escape processing to prevent XSS?
- [ ] Using CSRF tokens? (for stateful)
- [ ] Not storing passwords in plain text? (Using BCrypt)
- [ ] Using strong algorithms for JWT tokens? (HS512 or above)
- [ ] Enforcing HTTPS?
- [ ] Not logging sensitive information?
- [ ] No sensitive information in exception messages?
- [ ] CORS properly configured?
- [ ] Rate Limiting applied?

**Authentication/Authorization:**
- [ ] Authentication applied to APIs that require it?
- [ ] Role-Based Access Control (RBAC) implemented?
- [ ] Using stateless session management? (JWT)
- [ ] Appropriate token expiration time?

**Error Messages:**
- [ ] Error messages are clear?
- [ ] Using consistent error response format?
- [ ] Specifying which fields have validation errors?
- [ ] No sensitive information in error messages?

**Pagination and Filtering:**
- [ ] Pagination applied to list APIs?
- [ ] Clear pagination parameters (page, size)?
- [ ] Clear filtering parameters?
- [ ] Sorting options provided?
- [ ] Maximum page size limit enforced? (e.g., max 100)
