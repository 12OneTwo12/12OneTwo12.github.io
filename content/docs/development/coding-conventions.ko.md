---
title: 코딩 컨벤션
weight: 1
---

제가 개발할 때 따르는 코딩 컨벤션입니다.

## 핵심 원칙

### 1. TDD (Test-Driven Development)

- **테스트 먼저 작성**: 구현 전에 테스트 코드를 작성합니다.
- **시나리오 기반**: 테스트만 보고 기능을 즉시 파악할 수 있어야 합니다.
- **Given-When-Then**: 모든 테스트에 주석으로 명시합니다.

### 2. SOLID 원칙

- **단일 책임 원칙 (SRP)**: 클래스는 하나의 책임만 가집니다.
- **개방-폐쇄 원칙 (OCP)**: 확장에는 열려있고 수정에는 닫혀있어야 합니다.
- **리스코프 치환 원칙 (LSP)**: 하위 타입은 상위 타입을 대체할 수 있어야 합니다.
- **인터페이스 분리 원칙 (ISP)**: 클라이언트는 사용하지 않는 인터페이스에 의존하지 않아야 합니다.
- **의존성 역전 원칙 (DIP)**: 구체적인 것이 아닌 추상적인 것에 의존해야 합니다.

### 3. 문서화

- **KDoc**: 모든 public 함수와 클래스에 KDoc을 작성합니다.
- **API 문서**: REST API는 자동 문서화 도구(Spring REST Docs 등)를 사용합니다.
- **주석**: 코드가 "무엇"을 하는지가 아닌 "왜" 하는지를 설명합니다.

### 4. 데이터베이스 규칙

#### Audit Trail (필수 5가지 필드)

모든 엔티티는 다음 5가지 필드를 필수로 포함해야 합니다:

```kotlin
data class User(
    val id: UUID,
    val email: String,

    // Audit Trail 필드 (필수)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    val createdBy: UUID? = null,
    val updatedAt: LocalDateTime = LocalDateTime.now(),
    val updatedBy: UUID? = null,
    val deletedAt: LocalDateTime? = null  // Soft Delete
)
```

#### Soft Delete (물리적 삭제 금지)

- **논리적 삭제만 허용**: `deletedAt` 필드를 사용하여 삭제 표시
- **물리적 삭제 금지**: `DELETE` 쿼리 사용 금지

```kotlin
// ✅ GOOD: Soft Delete
fun deleteUser(userId: UUID, deletedBy: UUID) {
    dslContext.update(USER)
        .set(USER.DELETED_AT, LocalDateTime.now())
        .set(USER.UPDATED_BY, deletedBy)
        .where(USER.ID.eq(userId))
        .execute()
}

// ❌ BAD: 물리적 삭제
fun deleteUser(userId: UUID) {
    dslContext.deleteFrom(USER)
        .where(USER.ID.eq(userId))
        .execute()
}
```

## Kotlin 코딩 스타일

### 기본 원칙

- **Kotlin 공식 코딩 컨벤션** 준수
- **IntelliJ IDEA 기본 포맷터** 사용
- **가독성 우선**: 성능보다 가독성을 우선시하고, 필요시 최적화

### 네이밍 규칙

```kotlin
// 클래스명: PascalCase
class UserService

// 함수명: camelCase
fun getUserById(id: UUID): User

// 변수명: camelCase
val userId = UUID.randomUUID()

// 상수명: UPPER_SNAKE_CASE
const val MAX_RETRY_COUNT = 3

// 패키지명: lowercase
package com.example.user.service
```

### 로깅 규칙

**절대 금지:**
- ❌ **println 사용 금지 (당연하지만)**: `println()` 절대 사용하지 않습니다.
- ❌ **이모티콘 금지**: 코드, 주석, 로그에 이모티콘을 사용하지 않습니다.

**필수 사용:**
- ✅ **SLF4J Logger**: 모든 로깅은 SLF4J Logger를 사용합니다.

```kotlin
// ❌ BAD: println 사용
println("User created: $userId")

// ❌ BAD: 이모티콘 사용
logger.info("✅ User created: $userId")

// ✅ GOOD: SLF4J Logger 사용
private val logger = LoggerFactory.getLogger(UserService::class.java)
logger.info("User created: userId={}", userId)
```

### Import 규칙

**FQCN (Fully Qualified Class Name) 사용 금지**

```kotlin
// ❌ BAD: FQCN 사용
org.springframework.data.redis.connection.ReturnType.INTEGER

// ✅ GOOD: import 문 사용
import org.springframework.data.redis.connection.ReturnType
ReturnType.INTEGER
```

### 클래스 구조 순서

```kotlin
class UserService(
    private val userRepository: UserRepository,
    private val eventPublisher: EventPublisher
) {
    // 1. Companion object
    companion object {
        private val logger = LoggerFactory.getLogger(UserService::class.java)
    }

    // 2. Public 함수
    fun createUser(request: CreateUserRequest): User {
        logger.info("Creating user: email={}", request.email)
        // ...
    }

    // 3. Private 함수
    private fun validateUser(user: User) {
        // ...
    }
}
```

### 함수 작성 규칙

```kotlin
// 단일 표현식 함수
fun isAdult(age: Int): Boolean = age >= 18

// 명시적 반환 타입 (public 함수는 필수)
fun getUserName(userId: UUID): String {
    return userRepository.findById(userId).name
}

// 긴 파라미터는 여러 줄로
fun createOrder(
    userId: UUID,
    productId: UUID,
    quantity: Int,
    deliveryAddress: String
): Order {
    // ...
}
```

### Null Safety

```kotlin
// Nullable 타입 명시적 표시
fun findUser(id: UUID): User?

// Elvis operator 활용
val name = user?.name ?: "Unknown"

// Safe call chain
user?.address?.city?.let { city ->
    logger.info("City: {}", city)
}
```

### Data Class 사용

```kotlin
// DTO는 data class로
data class UserResponse(
    val id: UUID,
    val name: String,
    val email: String
)

// 불변 객체 권장
data class User(
    val id: UUID,
    val name: String,
    val email: String
) {
    fun updateName(newName: String): User = copy(name = newName)
}
```

## Spring Boot 규칙

### 레이어 구조

```
controller/     # REST API 엔드포인트
├── request/    # Request DTO
└── response/   # Response DTO

service/        # 비즈니스 로직
domain/         # 도메인 모델 (Entity)
repository/     # 데이터 접근 계층
```

### 의존성 주입

```kotlin
// ✅ GOOD: Constructor injection 사용
@Service
class UserService(
    private val userRepository: UserRepository,
    private val emailService: EmailService
)

// ❌ BAD: Field injection
@Service
class UserService {
    @Autowired
    private lateinit var userRepository: UserRepository
}
```

### 트랜잭션

```kotlin
// 서비스 계층에서 @Transactional 사용
@Transactional(readOnly = true)
class UserService {

    @Transactional
    fun createUser(request: CreateUserRequest): User {
        // ...
    }
}
```

## 코드 리뷰 체크리스트

- [ ] **TDD**: 테스트 코드를 먼저 작성했는가?
- [ ] **SOLID**: 단일 책임 원칙을 따르는가?
- [ ] **네이밍**: 명확하고 의미를 잘 전달하는가?
- [ ] **Null Safety**: 적절히 처리됐는가?
- [ ] **로깅**: SLF4J Logger를 사용했는가? println, 이모티콘이 없는가?
- [ ] **Import**: FQCN을 사용하지 않았는가?
- [ ] **문서화**: KDoc이 작성됐는가?
- [ ] **Audit Trail**: 모든 엔티티에 5가지 필드가 있는가?
- [ ] **Soft Delete**: 물리적 삭제를 사용하지 않았는가?

## 절대 금지 사항

### 로깅 관련
- ❌ **println 사용 금지 (당연하지만)**: `println()` 절대 사용 금지
- ❌ **이모티콘 금지**: 코드, 주석, 로그에 이모티콘 사용 금지
- ❌ **FQCN 사용 금지**: import 문을 반드시 사용

### 코드 품질
- ❌ **`!!` (non-null assertion) 남발**: 최소한으로 사용
- ❌ **`Any` 타입 사용**: 명확한 타입 지정
- ❌ **Magic number**: 상수로 정의할 것
- ❌ **긴 함수**: 20줄 이상은 리팩토링 고려
- ❌ **God class**: 하나의 클래스가 너무 많은 책임을 가지지 않도록

### 데이터베이스
- ❌ **물리적 삭제 금지**: `DELETE` 쿼리 사용 금지
- ❌ **SELECT asterisk (*) 금지**: 필요한 컬럼만 명시적으로 선택
- ❌ **Audit Trail 누락 금지**: 모든 엔티티에 5가지 필드 필수
