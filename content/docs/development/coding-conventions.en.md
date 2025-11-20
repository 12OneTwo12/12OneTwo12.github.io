---
title: Coding Conventions
weight: 1
---

These are the coding conventions I follow during development.

## Core Principles

### 1. TDD (Test-Driven Development)

- **Write tests first**: Write test code before implementation.
- **Scenario-based**: Features should be immediately understandable from tests alone.
- **Given-When-Then**: All tests must include these comments.

### 2. SOLID Principles

- **Single Responsibility Principle (SRP)**: A class should have only one responsibility.
- **Open-Closed Principle (OCP)**: Open for extension, closed for modification.
- **Liskov Substitution Principle (LSP)**: Subtypes must be substitutable for their base types.
- **Interface Segregation Principle (ISP)**: Clients should not depend on interfaces they don't use.
- **Dependency Inversion Principle (DIP)**: Depend on abstractions, not concretions.

### 3. Documentation

- **KDoc**: Write KDoc for all public functions and classes.
- **API Documentation**: Use automatic documentation tools (Spring REST Docs, etc.) for REST APIs.
- **Comments**: Explain "why" not "what" the code does.

### 4. Database Rules

#### Audit Trail (Required 5 Fields)

All entities must include these 5 fields:

```kotlin
data class User(
    val id: UUID,
    val email: String,

    // Audit Trail fields (required)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    val createdBy: UUID? = null,
    val updatedAt: LocalDateTime = LocalDateTime.now(),
    val updatedBy: UUID? = null,
    val deletedAt: LocalDateTime? = null  // Soft Delete
)
```

#### Soft Delete (No Physical Deletion)

- **Only logical deletion allowed**: Use `deletedAt` field to mark deletion
- **Physical deletion forbidden**: Never use `DELETE` queries

```kotlin
// ✅ GOOD: Soft Delete
fun deleteUser(userId: UUID, deletedBy: UUID) {
    dslContext.update(USER)
        .set(USER.DELETED_AT, LocalDateTime.now())
        .set(USER.UPDATED_BY, deletedBy)
        .where(USER.ID.eq(userId))
        .execute()
}

// ❌ BAD: Physical deletion
fun deleteUser(userId: UUID) {
    dslContext.deleteFrom(USER)
        .where(USER.ID.eq(userId))
        .execute()
}
```

## Kotlin Coding Style

### Basic Principles

- Follow **Kotlin official coding conventions**
- Use **IntelliJ IDEA default formatter**
- **Readability first**: Prioritize readability over performance, optimize when necessary

### Naming Rules

```kotlin
// Class names: PascalCase
class UserService

// Function names: camelCase
fun getUserById(id: UUID): User

// Variable names: camelCase
val userId = UUID.randomUUID()

// Constant names: UPPER_SNAKE_CASE
const val MAX_RETRY_COUNT = 3

// Package names: lowercase
package com.example.user.service
```

### Logging Rules

**Strictly Forbidden:**
- ❌ **No println (obviously)**: Never use `println()`
- ❌ **No emojis**: Do not use emojis in code, comments, or logs

**Required:**
- ✅ **SLF4J Logger**: Use SLF4J Logger for all logging

```kotlin
// ❌ BAD: Using println
println("User created: $userId")

// ❌ BAD: Using emojis
logger.info("✅ User created: $userId")

// ✅ GOOD: Using SLF4J Logger
private val logger = LoggerFactory.getLogger(UserService::class.java)
logger.info("User created: userId={}", userId)
```

### Import Rules

**No FQCN (Fully Qualified Class Name)**

```kotlin
// ❌ BAD: Using FQCN
org.springframework.data.redis.connection.ReturnType.INTEGER

// ✅ GOOD: Using import statement
import org.springframework.data.redis.connection.ReturnType
ReturnType.INTEGER
```

### Class Structure Order

```kotlin
class UserService(
    private val userRepository: UserRepository,
    private val eventPublisher: EventPublisher
) {
    // 1. Companion object
    companion object {
        private val logger = LoggerFactory.getLogger(UserService::class.java)
    }

    // 2. Public functions
    fun createUser(request: CreateUserRequest): User {
        logger.info("Creating user: email={}", request.email)
        // ...
    }

    // 3. Private functions
    private fun validateUser(user: User) {
        // ...
    }
}
```

### Function Writing Rules

```kotlin
// Single expression function
fun isAdult(age: Int): Boolean = age >= 18

// Explicit return type (required for public functions)
fun getUserName(userId: UUID): String {
    return userRepository.findById(userId).name
}

// Multiple lines for long parameters
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
// Explicit nullable type
fun findUser(id: UUID): User?

// Elvis operator
val name = user?.name ?: "Unknown"

// Safe call chain
user?.address?.city?.let { city ->
    logger.info("City: {}", city)
}
```

### Data Class Usage

```kotlin
// Use data class for DTOs
data class UserResponse(
    val id: UUID,
    val name: String,
    val email: String
)

// Prefer immutable objects
data class User(
    val id: UUID,
    val name: String,
    val email: String
) {
    fun updateName(newName: String): User = copy(name = newName)
}
```

## Spring Boot Rules

### Layer Structure

```
controller/     # REST API endpoints
├── request/    # Request DTOs
└── response/   # Response DTOs

service/        # Business logic
domain/         # Domain models (Entity)
repository/     # Data access layer
```

### Dependency Injection

```kotlin
// ✅ GOOD: Constructor injection
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

### Transactions

```kotlin
// Use @Transactional at service layer
@Transactional(readOnly = true)
class UserService {

    @Transactional
    fun createUser(request: CreateUserRequest): User {
        // ...
    }
}
```

## Code Review Checklist

### Basic Principles
- [ ] **TDD**: Were tests written first?
- [ ] **SOLID**: Does it follow Single Responsibility Principle?
- [ ] **Naming**: Is it clear and meaningful?
- [ ] **Documentation**: Is KDoc written?

### Security
- [ ] **Sensitive Info**: No hardcoded passwords/API keys?
- [ ] **Input Validation**: Are all external inputs validated?
- [ ] **SQL Injection**: Using Prepared Statement or Type-safe DSL?
- [ ] **Password**: Hashed with BCrypt before storing?
- [ ] **Logging**: No sensitive info (passwords, tokens) in logs?

### Concurrency
- [ ] **Thread-Safety**: Is shared state properly synchronized?
- [ ] **Immutable Objects**: Using val and minimizing mutable state?
- [ ] **Synchronized**: Only minimal necessary scope synchronized?
- [ ] **Coroutine**: Using structured concurrency instead of GlobalScope?

### Performance
- [ ] **String Concatenation**: Using StringBuilder in loops?
- [ ] **Collection Initial Capacity**: Set initial capacity when size is known?
- [ ] **Object Creation**: Avoiding unnecessary object creation?
- [ ] **Sequence**: Considered Sequence for large data processing?

### Code Quality
- [ ] **Null Safety**: Using Elvis operator or let instead of !!?
- [ ] **Exception Handling**: No empty catch blocks, handling specific exceptions?
- [ ] **Magic Numbers**: All numeric literals defined as constants?
- [ ] **Logging**: Using SLF4J Logger? No println or emojis?
- [ ] **Import**: Not using FQCN?

### Database
- [ ] **Audit Trail**: Do all entities have the 5 required fields?
- [ ] **Soft Delete**: Not using physical deletion?
- [ ] **SELECT**: Explicitly selecting only needed columns?

## Security

### 1. Sensitive Information Handling

**Strictly Forbidden:**
- ❌ **Hardcoded passwords/API keys**: Never write directly in code
- ❌ **Sensitive info as constants**: Use environment variables or Secret Manager
- ❌ **Sensitive info in logs**: Never log passwords, tokens, personal information

```kotlin
// ❌ BAD: Hardcoded password
class DatabaseConfig {
    val password = "mySecretPassword123"
    val apiKey = "sk-1234567890abcdef"
}

// ✅ GOOD: Using environment variables
class DatabaseConfig {
    val password = System.getenv("DB_PASSWORD")
        ?: throw IllegalStateException("DB_PASSWORD not set")
    val apiKey = System.getenv("API_KEY")
        ?: throw IllegalStateException("API_KEY not set")
}

// ❌ BAD: Logging sensitive info
logger.info("User login: email={}, password={}", email, password)

// ✅ GOOD: Masking sensitive info
logger.info("User login: email={}, password=***", email)
```

### 2. Input Validation

**All external inputs must be validated:**

```kotlin
// ❌ BAD: No validation
fun createUser(email: String, age: Int): User {
    return userRepository.save(User(email = email, age = age))
}

// ✅ GOOD: Input validation
fun createUser(email: String, age: Int): User {
    require(email.matches(EMAIL_REGEX)) { "Invalid email format" }
    require(age in 1..150) { "Age must be between 1 and 150" }

    return userRepository.save(User(email = email, age = age))
}

companion object {
    private val EMAIL_REGEX = "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$".toRegex()
}
```

### 3. SQL Injection Prevention

```kotlin
// ❌ BAD: String concatenation for queries
fun findUserByEmail(email: String): User? {
    val query = "SELECT * FROM users WHERE email = '$email'"
    return jdbcTemplate.queryForObject(query, UserRowMapper())
}

// ✅ GOOD: Using Prepared Statement
fun findUserByEmail(email: String): User? {
    val query = "SELECT * FROM users WHERE email = ?"
    return jdbcTemplate.queryForObject(query, UserRowMapper(), email)
}

// ✅ BETTER: Type-safe DSL (jOOQ, etc.)
fun findUserByEmail(email: String): User? {
    return dslContext.selectFrom(USER)
        .where(USER.EMAIL.eq(email))
        .fetchOne()
}
```

### 4. Password Handling

```kotlin
// ❌ BAD: Plain text storage
data class User(
    val email: String,
    val password: String  // Absolutely forbidden!
)

// ✅ GOOD: BCrypt hashing
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
    val passwordHash: String  // Only store hashed password
)
```

## Concurrency

### 1. Thread-Safe Code

```kotlin
// ❌ BAD: Thread-unsafe mutable state
class UserCounter {
    private var count = 0

    fun increment() {
        count++  // Race condition possible
    }
}

// ✅ GOOD: Using AtomicInteger
class UserCounter {
    private val count = AtomicInteger(0)

    fun increment() {
        count.incrementAndGet()
    }
}

// ✅ BETTER: Using immutable objects
class UserCounter(val count: Int = 0) {
    fun increment(): UserCounter = UserCounter(count + 1)
}
```

### 2. Immutable Objects Recommended

```kotlin
// ❌ BAD: Mutable object
data class User(
    var id: UUID,
    var name: String,
    var email: String
)

// ✅ GOOD: Immutable object
data class User(
    val id: UUID,
    val name: String,
    val email: String
) {
    fun withName(newName: String): User = copy(name = newName)
    fun withEmail(newEmail: String): User = copy(email = newEmail)
}
```

### 3. Synchronized Usage Guide

```kotlin
// ❌ BAD: Synchronizing entire method
class UserService {
    @Synchronized
    fun processUser(user: User) {
        // Long operation...
        Thread.sleep(1000)
        // Actual part needing synchronization
        cache.put(user.id, user)
    }
}

// ✅ GOOD: Synchronizing minimal scope only
class UserService {
    private val lock = Any()

    fun processUser(user: User) {
        // Long operation...
        Thread.sleep(1000)

        // Synchronize only necessary part
        synchronized(lock) {
            cache.put(user.id, user)
        }
    }
}
```

### 4. Coroutine Precautions

```kotlin
// ❌ BAD: Using GlobalScope
fun loadUser(id: UUID) {
    GlobalScope.launch {
        val user = userRepository.findById(id)
        updateUI(user)
    }
}

// ✅ GOOD: Structured concurrency
class UserViewModel : ViewModel() {
    fun loadUser(id: UUID) {
        viewModelScope.launch {
            val user = userRepository.findById(id)
            updateUI(user)
        }
    }
}
```

## Performance

### 1. String Concatenation

```kotlin
// ❌ BAD: Using + operator in loop
fun buildQuery(ids: List<UUID>): String {
    var query = "SELECT * FROM users WHERE id IN ("
    for (id in ids) {
        query += "'$id',"
    }
    query += ")"
    return query
}

// ✅ GOOD: Using StringBuilder
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

// ✅ BETTER: Using joinToString
fun buildQuery(ids: List<UUID>): String {
    val idList = ids.joinToString(",") { "'$it'" }
    return "SELECT * FROM users WHERE id IN ($idList)"
}
```

### 2. Collection Initial Capacity

```kotlin
// ❌ BAD: No initial capacity set
fun processLargeData(items: List<Item>): Map<UUID, Item> {
    val map = mutableMapOf<UUID, Item>()  // Starts with default size
    items.forEach { map[it.id] = it }
    return map
}

// ✅ GOOD: Setting initial capacity
fun processLargeData(items: List<Item>): Map<UUID, Item> {
    val map = HashMap<UUID, Item>(items.size)  // Specify initial size
    items.forEach { map[it.id] = it }
    return map
}
```

### 3. Stream vs for-loop

```kotlin
// ❌ BAD: Creating unnecessary intermediate collections
fun getAdultUserNames(users: List<User>): List<String> {
    return users
        .filter { it.age >= 18 }
        .map { it.name }
        .toList()
}

// ✅ GOOD: Using Sequence (large data)
fun getAdultUserNames(users: List<User>): List<String> {
    return users.asSequence()
        .filter { it.age >= 18 }
        .map { it.name }
        .toList()
}

// ✅ GOOD: Simple loop (small data)
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

### 4. Avoid Unnecessary Object Creation

```kotlin
// ❌ BAD: Creating objects in loop
fun processUsers(users: List<User>) {
    for (user in users) {
        val formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")
        logger.info("User created at: {}", user.createdAt.format(formatter))
    }
}

// ✅ GOOD: Declare reusable objects outside
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

### 5. Lazy Initialization

```kotlin
// ❌ BAD: Creating heavy object that might not be used
class UserService(
    private val userRepository: UserRepository
) {
    private val heavyCache = HeavyCache()  // Always created

    fun getUser(id: UUID): User? {
        // heavyCache might not be used
        return userRepository.findById(id)
    }
}

// ✅ GOOD: Lazy initialization
class UserService(
    private val userRepository: UserRepository
) {
    private val heavyCache by lazy { HeavyCache() }  // Created when actually used

    fun getCachedUser(id: UUID): User? {
        return heavyCache.get(id) ?: userRepository.findById(id)
    }
}
```

## Code Quality

### 1. Null Check Patterns

```kotlin
// ❌ BAD: Using !!
fun getUserName(userId: UUID): String {
    return userRepository.findById(userId)!!.name
}

// ✅ GOOD: Elvis operator
fun getUserName(userId: UUID): String {
    return userRepository.findById(userId)?.name
        ?: throw UserNotFoundException(userId)
}

// ✅ GOOD: Using let
fun processUser(userId: UUID) {
    userRepository.findById(userId)?.let { user ->
        logger.info("Processing user: {}", user.name)
        emailService.send(user.email, "Welcome")
    } ?: logger.warn("User not found: {}", userId)
}
```

### 2. Optional Usage Guide

```kotlin
// ❌ BAD: Overusing Optional
fun findUser(id: UUID): Optional<User> {
    return Optional.ofNullable(userRepository.findById(id))
}

// ✅ GOOD: Using Kotlin's nullable type
fun findUser(id: UUID): User? {
    return userRepository.findById(id)
}
```

### 3. Exception Handling Rules

```kotlin
// ❌ BAD: Empty catch block
fun processUser(user: User) {
    try {
        emailService.send(user.email, "Welcome")
    } catch (e: Exception) {
        // Do nothing
    }
}

// ❌ BAD: Catching Exception too broadly
fun processUser(user: User) {
    try {
        emailService.send(user.email, "Welcome")
    } catch (e: Exception) {  // Catches all exceptions
        logger.error("Error", e)
    }
}

// ✅ GOOD: Specific exception handling
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

### 4. No Magic Numbers

```kotlin
// ❌ BAD: Magic numbers
fun isValidAge(age: Int): Boolean {
    return age >= 18 && age <= 150
}

fun getDiscountRate(purchaseAmount: Int): Double {
    return if (purchaseAmount >= 100000) 0.1 else 0.0
}

// ✅ GOOD: Define as constants
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

## Strictly Forbidden

### Logging Related
- ❌ **No println (obviously)**: Absolutely forbidden to use `println()`
- ❌ **No emojis**: Forbidden to use emojis in code, comments, logs
- ❌ **No FQCN**: Must use import statements
- ❌ **No sensitive info in logs**: Never log passwords, tokens, personal information

### Security
- ❌ **Hardcoded passwords/API keys**: Use environment variables or Secret Manager
- ❌ **SQL Injection vulnerabilities**: Use Prepared Statement or Type-safe DSL
- ❌ **Plain text password storage**: Must hash with BCrypt, etc.
- ❌ **Missing input validation**: All external inputs must be validated

### Code Quality
- ❌ **Excessive `!!` (non-null assertion)**: Use minimally
- ❌ **`Any` type usage**: Specify explicit types
- ❌ **Magic numbers**: Define as constants
- ❌ **Long functions**: Consider refactoring if over 20 lines
- ❌ **God class**: A single class should not have too many responsibilities
- ❌ **Empty catch blocks**: Exceptions must be properly handled

### Concurrency
- ❌ **Thread-unsafe code**: Shared state must be properly synchronized
- ❌ **Using GlobalScope**: Use structured concurrency

### Performance
- ❌ **String concatenation with + in loops**: Use StringBuilder
- ❌ **Overusing Stream on large collections**: Consider using Sequence
- ❌ **Unnecessary object creation**: Declare reusable objects outside

### Database
- ❌ **Physical deletion forbidden**: Never use `DELETE` queries
- ❌ **SELECT asterisk (*) forbidden**: Explicitly select only needed columns
- ❌ **Missing Audit Trail forbidden**: All entities must have the 5 required fields
