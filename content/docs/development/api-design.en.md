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
fun getUser(@PathVariable id: UUID): Mono<ResponseEntity<UserResponse>> {
    return userService.getUserById(id)
        .map { user -> ResponseEntity.ok(UserResponse.from(user)) }
        .defaultIfEmpty(ResponseEntity.notFound().build())
}

// 201 Created: Creation success
@PostMapping
fun createUser(@Valid @RequestBody request: CreateUserRequest): Mono<ResponseEntity<UserResponse>> {
    return userService.createUser(request)
        .map { user ->
            ResponseEntity
                .status(HttpStatus.CREATED)
                .header("Location", "/api/v1/users/${user.id}")
                .body(UserResponse.from(user))
        }
}

// 204 No Content: Delete success (no response body)
@DeleteMapping("/{id}")
fun deleteUser(@PathVariable id: UUID): Mono<ResponseEntity<Void>> {
    return userService.deleteUser(id)
        .then(Mono.just(ResponseEntity.noContent().build()))
}
```

### Client Errors (4xx)

```kotlin
// 400 Bad Request: Invalid request
@PostMapping
fun createUser(@Valid @RequestBody request: CreateUserRequest): Mono<ResponseEntity<Any>> {
    return userService.createUser(request)
        .map { user -> ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(user)) }
        .onErrorResume { error ->
            when (error) {
                is ValidationException -> Mono.just(
                    ResponseEntity.badRequest().body(
                        ErrorResponse(
                            code = "VALIDATION_ERROR",
                            message = "Invalid request",
                            errors = error.errors
                        )
                    )
                )
                else -> Mono.error(error)
            }
        }
}

// 401 Unauthorized: Authentication failed
// 403 Forbidden: No permission
// 404 Not Found: Resource not found
@GetMapping("/{id}")
fun getUser(@PathVariable id: UUID): Mono<ResponseEntity<UserResponse>> {
    return userService.getUserById(id)
        .map { user -> ResponseEntity.ok(UserResponse.from(user)) }
        .defaultIfEmpty(ResponseEntity.notFound().build())  // 404
}

// 409 Conflict: Resource conflict
@PostMapping
fun createUser(@Valid @RequestBody request: CreateUserRequest): Mono<ResponseEntity<Any>> {
    return userService.createUser(request)
        .map { user -> ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(user)) }
        .onErrorResume(DuplicateEmailException::class.java) { error ->
            Mono.just(
                ResponseEntity.status(HttpStatus.CONFLICT).body(
                    ErrorResponse(
                        code = "DUPLICATE_EMAIL",
                        message = "Email already exists"
                    )
                )
            )
        }
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
fun getUser(@PathVariable id: UUID): Mono<User> {  // ❌ Domain object exposure
    return userService.getUserById(id)
}
```

### List Response (Pagination)

```kotlin
// ✅ GOOD: Include pagination information
data class PageResponse<T>(
    val content: List<T>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
    val hasNext: Boolean,
    val hasPrevious: Boolean
)

@GetMapping
fun getUsers(
    @RequestParam(defaultValue = "0") page: Int,
    @RequestParam(defaultValue = "20") size: Int
): Mono<ResponseEntity<PageResponse<UserResponse>>> {
    return userService.getUsers(page, size)
        .map { pageData ->
            ResponseEntity.ok(
                PageResponse(
                    content = pageData.content.map { UserResponse.from(it) },
                    page = pageData.page,
                    size = pageData.size,
                    totalElements = pageData.totalElements,
                    totalPages = pageData.totalPages,
                    hasNext = pageData.hasNext,
                    hasPrevious = pageData.hasPrevious
                )
            )
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
    fun getUsersV1(): Flux<UserResponseV1>

    @GetMapping(produces = ["application/vnd.api.v2+json"])
    fun getUsersV2(): Flux<UserResponseV2>
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
): Flux<UserResponse> {
    return userService.getUsers(
        status = status,
        email = email,
        ageMin = ageMin,
        ageMax = ageMax
    ).map { UserResponse.from(it) }
}

// Usage example
// GET /api/v1/users?status=active&ageMin=18&ageMax=65
```

### Sorting

```kotlin
// ✅ GOOD: Use sort parameter
@GetMapping
fun getUsers(
    @RequestParam(defaultValue = "createdAt") sort: String,
    @RequestParam(defaultValue = "desc") order: String,
    @RequestParam(defaultValue = "0") page: Int,
    @RequestParam(defaultValue = "20") size: Int
): Mono<PageResponse<UserResponse>>

// Usage example
// GET /api/v1/users?sort=name&order=asc
// GET /api/v1/users?sort=createdAt&order=desc
```

### Searching

```kotlin
// ✅ GOOD: Use q or search parameter for search terms
@GetMapping("/search")
fun searchUsers(
    @RequestParam q: String,
    @RequestParam(defaultValue = "0") page: Int,
    @RequestParam(defaultValue = "20") size: Int
): Mono<PageResponse<UserResponse>> {
    return userService.searchUsers(q, page, size)
        .map { pageData ->
            PageResponse(
                content = pageData.content.map { UserResponse.from(it) },
                page = pageData.page,
                size = pageData.size,
                totalElements = pageData.totalElements,
                totalPages = pageData.totalPages,
                hasNext = pageData.hasNext,
                hasPrevious = pageData.hasPrevious
            )
        }
}

// Usage example
// GET /api/v1/users/search?q=john&page=0&size=20
```

## Security

### Authentication Header

```kotlin
// ✅ GOOD: Using Bearer Token
// Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

@Configuration
@EnableWebFluxSecurity
class SecurityConfig {

    @Bean
    fun securityWebFilterChain(http: ServerHttpSecurity): SecurityWebFilterChain {
        return http
            .csrf { it.disable() }
            .authorizeExchange {
                it.pathMatchers("/api/v1/public/**").permitAll()
                  .pathMatchers("/api/v1/admin/**").hasRole("ADMIN")
                  .anyExchange().authenticated()
            }
            .oauth2ResourceServer { it.jwt() }
            .build()
    }
}
```

### Rate Limiting

```kotlin
// ✅ GOOD: Rate Limit header response
@GetMapping
fun getUsers(): Flux<UserResponse> {
    // Response Headers:
    // X-RateLimit-Limit: 100
    // X-RateLimit-Remaining: 99
    // X-RateLimit-Reset: 1640995200
}
```

## CORS Configuration

```kotlin
@Configuration
class CorsConfig {

    @Bean
    fun corsWebFilter(): CorsWebFilter {
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

        return CorsWebFilter(source)
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

**Validation and Security:**
- [ ] Request DTOs have validation annotations?
- [ ] Error messages are clear?
- [ ] Authentication/authorization applied?
- [ ] CORS properly configured?

**Pagination and Filtering:**
- [ ] List APIs have pagination applied?
- [ ] Filter parameters are clear?
- [ ] Sorting options provided?
