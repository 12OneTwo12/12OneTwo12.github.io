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
fun getUser(@PathVariable id: UUID): Mono<ResponseEntity<UserResponse>> {
    return userService.getUserById(id)
        .map { user -> ResponseEntity.ok(UserResponse.from(user)) }
        .defaultIfEmpty(ResponseEntity.notFound().build())
}

// 201 Created: 생성 성공
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

// 204 No Content: 삭제 성공 (응답 본문 없음)
@DeleteMapping("/{id}")
fun deleteUser(@PathVariable id: UUID): Mono<ResponseEntity<Void>> {
    return userService.deleteUser(id)
        .then(Mono.just(ResponseEntity.noContent().build()))
}
```

### 클라이언트 오류 (4xx)

```kotlin
// 400 Bad Request: 잘못된 요청
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

// 401 Unauthorized: 인증 실패
// 403 Forbidden: 권한 없음
// 404 Not Found: 리소스 없음
@GetMapping("/{id}")
fun getUser(@PathVariable id: UUID): Mono<ResponseEntity<UserResponse>> {
    return userService.getUserById(id)
        .map { user -> ResponseEntity.ok(UserResponse.from(user)) }
        .defaultIfEmpty(ResponseEntity.notFound().build())  // 404
}

// 409 Conflict: 리소스 충돌
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
fun getUser(@PathVariable id: UUID): Mono<User> {  // ❌ Domain 객체 노출
    return userService.getUserById(id)
}
```

### 리스트 응답 (페이징)

```kotlin
// ✅ GOOD: 페이징 정보 포함
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
    fun getUsersV1(): Flux<UserResponseV1>

    @GetMapping(produces = ["application/vnd.api.v2+json"])
    fun getUsersV2(): Flux<UserResponseV2>
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
): Flux<UserResponse> {
    return userService.getUsers(
        status = status,
        email = email,
        ageMin = ageMin,
        ageMax = ageMax
    ).map { UserResponse.from(it) }
}

// 사용 예시
// GET /api/v1/users?status=active&ageMin=18&ageMax=65
```

### 정렬

```kotlin
// ✅ GOOD: sort 파라미터 사용
@GetMapping
fun getUsers(
    @RequestParam(defaultValue = "createdAt") sort: String,
    @RequestParam(defaultValue = "desc") order: String,
    @RequestParam(defaultValue = "0") page: Int,
    @RequestParam(defaultValue = "20") size: Int
): Mono<PageResponse<UserResponse>>

// 사용 예시
// GET /api/v1/users?sort=name&order=asc
// GET /api/v1/users?sort=createdAt&order=desc
```

### 검색

```kotlin
// ✅ GOOD: 검색어는 q 또는 search 파라미터 사용
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

// 사용 예시
// GET /api/v1/users/search?q=john&page=0&size=20
```

## 보안

### 인증 헤더

```kotlin
// ✅ GOOD: Bearer Token 사용
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
// ✅ GOOD: Rate Limit 헤더 응답
@GetMapping
fun getUsers(): Flux<UserResponse> {
    // Response Headers:
    // X-RateLimit-Limit: 100
    // X-RateLimit-Remaining: 99
    // X-RateLimit-Reset: 1640995200
}
```

## CORS 설정

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

## 체크리스트

**API 설계 시:**
- [ ] RESTful 원칙을 따르는가? (명사, 복수형, HTTP 메서드)
- [ ] 적절한 HTTP 상태 코드를 사용하는가?
- [ ] URL에 버전을 포함하는가? (/api/v1/...)
- [ ] Request/Response DTO를 사용하는가? (Domain 직접 노출 금지)
- [ ] 일관된 에러 응답 형식을 사용하는가?

**검증 및 보안:**
- [ ] Request DTO에 검증 어노테이션이 있는가?
- [ ] 에러 메시지가 명확한가?
- [ ] 인증/인가가 적용되어 있는가?
- [ ] CORS가 적절히 설정되어 있는가?

**페이징 및 필터링:**
- [ ] 리스트 API에 페이징이 적용되어 있는가?
- [ ] 필터링 파라미터가 명확한가?
- [ ] 정렬 옵션이 제공되는가?
