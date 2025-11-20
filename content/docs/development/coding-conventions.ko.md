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

### 기본 원칙
- [ ] **TDD**: 테스트 코드를 먼저 작성했는가?
- [ ] **SOLID**: 단일 책임 원칙을 따르는가?
- [ ] **네이밍**: 명확하고 의미를 잘 전달하는가?
- [ ] **문서화**: KDoc이 작성됐는가?

### 보안 (Security)
- [ ] **민감정보**: 하드코딩된 비밀번호/API 키가 없는가?
- [ ] **입력 검증**: 모든 외부 입력을 검증하는가?
- [ ] **SQL Injection**: Prepared Statement 또는 Type-safe DSL을 사용하는가?
- [ ] **비밀번호**: BCrypt 등으로 해싱하여 저장하는가?
- [ ] **로깅**: 민감정보(비밀번호, 토큰)를 로그에 남기지 않는가?

### 동시성 (Concurrency)
- [ ] **Thread-Safety**: 공유 상태가 적절히 동기화되어 있는가?
- [ ] **불변 객체**: val을 사용하고 가변 상태를 최소화했는가?
- [ ] **Synchronized**: 필요한 최소 범위만 동기화했는가?
- [ ] **Coroutine**: GlobalScope 대신 구조화된 동시성을 사용하는가?

### 성능 (Performance)
- [ ] **문자열 연결**: 반복문에서 StringBuilder를 사용하는가?
- [ ] **컬렉션 초기 용량**: 크기를 알 수 있는 경우 초기 용량을 설정했는가?
- [ ] **객체 생성**: 불필요한 객체 생성을 피했는가?
- [ ] **Sequence**: 대용량 데이터 처리 시 Sequence를 고려했는가?

### 코드 품질
- [ ] **Null Safety**: !! 대신 Elvis operator나 let을 사용하는가?
- [ ] **예외 처리**: 빈 catch 블록이 없고, 구체적인 예외를 처리하는가?
- [ ] **매직 넘버**: 모든 숫자 리터럴을 상수로 정의했는가?
- [ ] **로깅**: SLF4J Logger를 사용했는가? println, 이모티콘이 없는가?
- [ ] **Import**: FQCN을 사용하지 않았는가?

### 데이터베이스
- [ ] **Audit Trail**: 모든 엔티티에 5가지 필드가 있는가?
- [ ] **Soft Delete**: 물리적 삭제를 사용하지 않았는가?
- [ ] **SELECT**: 필요한 컬럼만 명시적으로 선택하는가?

## 보안 (Security)

### 1. 민감정보 처리

**절대 금지:**
- ❌ **하드코딩된 비밀번호/API 키**: 코드에 직접 작성 금지
- ❌ **민감정보를 상수로 정의**: 환경변수 또는 Secret Manager 사용
- ❌ **로그에 민감정보 노출**: 비밀번호, 토큰, 개인정보 로깅 금지

```kotlin
// ❌ BAD: 하드코딩된 비밀번호
class DatabaseConfig {
    val password = "mySecretPassword123"
    val apiKey = "sk-1234567890abcdef"
}

// ✅ GOOD: 환경변수 사용
class DatabaseConfig {
    val password = System.getenv("DB_PASSWORD")
        ?: throw IllegalStateException("DB_PASSWORD not set")
    val apiKey = System.getenv("API_KEY")
        ?: throw IllegalStateException("API_KEY not set")
}

// ❌ BAD: 민감정보 로깅
logger.info("User login: email={}, password={}", email, password)

// ✅ GOOD: 민감정보 마스킹
logger.info("User login: email={}, password=***", email)
```

### 2. 입력 검증 (Input Validation)

**모든 외부 입력은 반드시 검증해야 합니다:**

```kotlin
// ❌ BAD: 검증 없는 입력 처리
fun createUser(email: String, age: Int): User {
    return userRepository.save(User(email = email, age = age))
}

// ✅ GOOD: 입력 검증
fun createUser(email: String, age: Int): User {
    require(email.matches(EMAIL_REGEX)) { "Invalid email format" }
    require(age in 1..150) { "Age must be between 1 and 150" }

    return userRepository.save(User(email = email, age = age))
}

companion object {
    private val EMAIL_REGEX = "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$".toRegex()
}
```

### 3. SQL Injection 방지

```kotlin
// ❌ BAD: 문자열 연결로 쿼리 생성
fun findUserByEmail(email: String): User? {
    val query = "SELECT * FROM users WHERE email = '$email'"
    return jdbcTemplate.queryForObject(query, UserRowMapper())
}

// ✅ GOOD: Prepared Statement 사용
fun findUserByEmail(email: String): User? {
    val query = "SELECT * FROM users WHERE email = ?"
    return jdbcTemplate.queryForObject(query, UserRowMapper(), email)
}

// ✅ BETTER: Type-safe DSL (jOOQ 등)
fun findUserByEmail(email: String): User? {
    return dslContext.selectFrom(USER)
        .where(USER.EMAIL.eq(email))
        .fetchOne()
}
```

### 4. 비밀번호 처리

```kotlin
// ❌ BAD: 평문 저장
data class User(
    val email: String,
    val password: String  // 절대 금지!
)

// ✅ GOOD: BCrypt 해싱
class PasswordEncoder {
    private val bcrypt = BCryptPasswordEncoder()

    fun encode(rawPassword: String): String {
        require(isStrongPassword(rawPassword)) { "Weak password" }
        return bcrypt.encode(rawPassword)
    }

    fun matches(rawPassword: String, encodedPassword: String): Boolean {
        return bcrypt.matches(rawPassword, encodedPassword)
    }

    private fun isStrongPassword(password: String): Boolean {
        return password.length >= 8 &&
            password.any { it.isUpperCase() } &&
            password.any { it.isLowerCase() } &&
            password.any { it.isDigit() } &&
            password.any { !it.isLetterOrDigit() }
    }
}

data class User(
    val email: String,
    val passwordHash: String  // 해시된 비밀번호만 저장
)
```

## 동시성 (Concurrency)

### 1. Thread-Safe 코드 작성

```kotlin
// ❌ BAD: Thread-unsafe 변경 가능한 상태
class UserCounter {
    private var count = 0

    fun increment() {
        count++  // Race condition 발생 가능
    }
}

// ✅ GOOD: AtomicInteger 사용
class UserCounter {
    private val count = AtomicInteger(0)

    fun increment() {
        count.incrementAndGet()
    }
}

// ✅ BETTER: 불변 객체 사용
class UserCounter(val count: Int = 0) {
    fun increment(): UserCounter = UserCounter(count + 1)
}
```

### 2. 불변 객체 (Immutable Objects) 권장

```kotlin
// ❌ BAD: 가변 객체
data class User(
    var id: UUID,
    var name: String,
    var email: String
)

// ✅ GOOD: 불변 객체
data class User(
    val id: UUID,
    val name: String,
    val email: String
) {
    fun withName(newName: String): User = copy(name = newName)
    fun withEmail(newEmail: String): User = copy(email = newEmail)
}
```

### 3. Synchronized 사용 가이드

```kotlin
// ❌ BAD: 메서드 전체 동기화
class UserService {
    @Synchronized
    fun processUser(user: User) {
        // 긴 작업...
        Thread.sleep(1000)
        // 실제 동기화가 필요한 부분
        cache.put(user.id, user)
    }
}

// ✅ GOOD: 최소 범위만 동기화
class UserService {
    private val lock = Any()

    fun processUser(user: User) {
        // 긴 작업...
        Thread.sleep(1000)

        // 실제 필요한 부분만 동기화
        synchronized(lock) {
            cache.put(user.id, user)
        }
    }
}
```

### 4. Coroutine 사용 시 주의사항

```kotlin
// ❌ BAD: GlobalScope 사용
fun loadUser(id: UUID) {
    GlobalScope.launch {
        val user = userRepository.findById(id)
        updateUI(user)
    }
}

// ✅ GOOD: 구조화된 동시성
class UserViewModel : ViewModel() {
    fun loadUser(id: UUID) {
        viewModelScope.launch {
            val user = userRepository.findById(id)
            updateUI(user)
        }
    }
}
```

## 성능 (Performance)

### 1. 문자열 연결

```kotlin
// ❌ BAD: 반복문에서 + 연산자 사용
fun buildQuery(ids: List<UUID>): String {
    var query = "SELECT * FROM users WHERE id IN ("
    for (id in ids) {
        query += "'$id',"
    }
    query += ")"
    return query
}

// ✅ GOOD: StringBuilder 사용
fun buildQuery(ids: List<UUID>): String {
    return buildString {
        append("SELECT * FROM users WHERE id IN (")
        ids.forEachIndexed { index, id ->
            if (index > 0) append(",")
            append("'$id'")
        }
        append(")")
    }
}

// ✅ BETTER: joinToString 활용
fun buildQuery(ids: List<UUID>): String {
    val idList = ids.joinToString(",") { "'$it'" }
    return "SELECT * FROM users WHERE id IN ($idList)"
}
```

### 2. 컬렉션 초기 용량 설정

```kotlin
// ❌ BAD: 초기 용량 미설정
fun processLargeData(items: List<Item>): Map<UUID, Item> {
    val map = mutableMapOf<UUID, Item>()  // 기본 크기로 시작
    items.forEach { map[it.id] = it }
    return map
}

// ✅ GOOD: 초기 용량 설정
fun processLargeData(items: List<Item>): Map<UUID, Item> {
    val map = HashMap<UUID, Item>(items.size)  // 초기 크기 지정
    items.forEach { map[it.id] = it }
    return map
}
```

### 3. Stream vs for-loop

```kotlin
// ❌ BAD: 불필요한 중간 컬렉션 생성
fun getAdultUserNames(users: List<User>): List<String> {
    return users
        .filter { it.age >= 18 }
        .map { it.name }
        .toList()
}

// ✅ GOOD: Sequence 사용 (대용량 데이터)
fun getAdultUserNames(users: List<User>): List<String> {
    return users.asSequence()
        .filter { it.age >= 18 }
        .map { it.name }
        .toList()
}

// ✅ GOOD: 단순 반복문 (소량 데이터)
fun getAdultUserNames(users: List<User>): List<String> {
    val result = ArrayList<String>(users.size / 2)
    for (user in users) {
        if (user.age >= 18) {
            result.add(user.name)
        }
    }
    return result
}
```

### 4. 불필요한 객체 생성 금지

```kotlin
// ❌ BAD: 반복문에서 객체 생성
fun processUsers(users: List<User>) {
    for (user in users) {
        val formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")
        logger.info("User created at: {}", user.createdAt.format(formatter))
    }
}

// ✅ GOOD: 재사용 가능한 객체는 외부에 선언
class UserProcessor {
    companion object {
        private val DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd")
    }

    fun processUsers(users: List<User>) {
        for (user in users) {
            logger.info("User created at: {}", user.createdAt.format(DATE_FORMATTER))
        }
    }
}
```

### 5. Lazy 초기화

```kotlin
// ❌ BAD: 사용하지 않을 수도 있는 무거운 객체를 미리 생성
class UserService(
    private val userRepository: UserRepository
) {
    private val heavyCache = HeavyCache()  // 항상 생성됨

    fun getUser(id: UUID): User? {
        // heavyCache를 사용하지 않을 수도 있음
        return userRepository.findById(id)
    }
}

// ✅ GOOD: Lazy 초기화
class UserService(
    private val userRepository: UserRepository
) {
    private val heavyCache by lazy { HeavyCache() }  // 실제 사용 시점에 생성

    fun getCachedUser(id: UUID): User? {
        return heavyCache.get(id) ?: userRepository.findById(id)
    }
}
```

## 코드 품질 (Code Quality)

### 1. Null 체크 패턴

```kotlin
// ❌ BAD: !! 사용
fun getUserName(userId: UUID): String {
    return userRepository.findById(userId)!!.name
}

// ✅ GOOD: Elvis operator
fun getUserName(userId: UUID): String {
    return userRepository.findById(userId)?.name
        ?: throw UserNotFoundException(userId)
}

// ✅ GOOD: let 사용
fun processUser(userId: UUID) {
    userRepository.findById(userId)?.let { user ->
        logger.info("Processing user: {}", user.name)
        emailService.send(user.email, "Welcome")
    } ?: logger.warn("User not found: {}", userId)
}
```

### 2. Optional 사용 가이드

```kotlin
// ❌ BAD: Optional 남발
fun findUser(id: UUID): Optional<User> {
    return Optional.ofNullable(userRepository.findById(id))
}

// ✅ GOOD: Kotlin의 nullable 타입 사용
fun findUser(id: UUID): User? {
    return userRepository.findById(id)
}
```

### 3. 예외 처리 규칙

```kotlin
// ❌ BAD: 빈 catch 블록
fun processUser(user: User) {
    try {
        emailService.send(user.email, "Welcome")
    } catch (e: Exception) {
        // 아무것도 하지 않음
    }
}

// ❌ BAD: Exception을 너무 광범위하게 catch
fun processUser(user: User) {
    try {
        emailService.send(user.email, "Welcome")
    } catch (e: Exception) {  // 모든 예외를 잡음
        logger.error("Error", e)
    }
}

// ✅ GOOD: 구체적인 예외 처리
fun processUser(user: User) {
    try {
        emailService.send(user.email, "Welcome")
    } catch (e: EmailSendException) {
        logger.error("Failed to send email to {}: {}", user.email, e.message)
        notificationService.notifyAdmin(e)
    } catch (e: IllegalArgumentException) {
        logger.warn("Invalid email: {}", user.email)
    }
}
```

### 4. 매직 넘버 금지

```kotlin
// ❌ BAD: 매직 넘버
fun isValidAge(age: Int): Boolean {
    return age >= 18 && age <= 150
}

fun getDiscountRate(purchaseAmount: Int): Double {
    return if (purchaseAmount >= 100000) 0.1 else 0.0
}

// ✅ GOOD: 상수로 정의
class UserValidator {
    companion object {
        private const val MIN_ADULT_AGE = 18
        private const val MAX_HUMAN_AGE = 150
        private const val VIP_PURCHASE_THRESHOLD = 100_000
        private const val VIP_DISCOUNT_RATE = 0.1
    }

    fun isValidAge(age: Int): Boolean {
        return age >= MIN_ADULT_AGE && age <= MAX_HUMAN_AGE
    }

    fun getDiscountRate(purchaseAmount: Int): Double {
        return if (purchaseAmount >= VIP_PURCHASE_THRESHOLD) {
            VIP_DISCOUNT_RATE
        } else {
            0.0
        }
    }
}
```

## 절대 금지 사항

### 로깅 관련
- ❌ **println 사용 금지 (당연하지만)**: `println()` 절대 사용 금지
- ❌ **이모티콘 금지**: 코드, 주석, 로그에 이모티콘 사용 금지
- ❌ **FQCN 사용 금지**: import 문을 반드시 사용
- ❌ **민감정보 로깅 금지**: 비밀번호, 토큰, 개인정보 로그에 기록 금지

### 보안
- ❌ **하드코딩된 비밀번호/API 키**: 환경변수 또는 Secret Manager 사용
- ❌ **SQL Injection 취약점**: Prepared Statement 또는 Type-safe DSL 사용
- ❌ **평문 비밀번호 저장**: 반드시 BCrypt 등으로 해싱
- ❌ **입력 검증 누락**: 모든 외부 입력은 반드시 검증

### 코드 품질
- ❌ **`!!` (non-null assertion) 남발**: 최소한으로 사용
- ❌ **`Any` 타입 사용**: 명확한 타입 지정
- ❌ **Magic number**: 상수로 정의할 것
- ❌ **긴 함수**: 20줄 이상은 리팩토링 고려
- ❌ **God class**: 하나의 클래스가 너무 많은 책임을 가지지 않도록
- ❌ **빈 catch 블록**: 예외는 반드시 적절히 처리

### 동시성
- ❌ **Thread-unsafe 코드**: 공유 상태는 적절히 동기화
- ❌ **GlobalScope 사용**: 구조화된 동시성 사용

### 성능
- ❌ **반복문에서 + 연산자로 문자열 연결**: StringBuilder 사용
- ❌ **대용량 컬렉션에 Stream 남발**: Sequence 사용 고려
- ❌ **불필요한 객체 생성**: 재사용 가능한 객체는 외부에 선언

### 데이터베이스
- ❌ **물리적 삭제 금지**: `DELETE` 쿼리 사용 금지
- ❌ **SELECT asterisk (*) 금지**: 필요한 컬럼만 명시적으로 선택
- ❌ **Audit Trail 누락 금지**: 모든 엔티티에 5가지 필드 필수
