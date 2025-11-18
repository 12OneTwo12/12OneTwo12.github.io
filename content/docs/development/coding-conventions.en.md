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

- [ ] **TDD**: Were tests written first?
- [ ] **SOLID**: Does it follow Single Responsibility Principle?
- [ ] **Naming**: Is it clear and meaningful?
- [ ] **Null Safety**: Is it properly handled?
- [ ] **Logging**: Using SLF4J Logger? No println or emojis?
- [ ] **Import**: Not using FQCN?
- [ ] **Documentation**: Is KDoc written?
- [ ] **Audit Trail**: Do all entities have the 5 required fields?
- [ ] **Soft Delete**: Not using physical deletion?

## Strictly Forbidden

### Logging Related
- ❌ **No println (obviously)**: Absolutely forbidden to use `println()`
- ❌ **No emojis**: Forbidden to use emojis in code, comments, logs
- ❌ **No FQCN**: Must use import statements

### Code Quality
- ❌ **Excessive `!!` (non-null assertion)**: Use minimally
- ❌ **`Any` type usage**: Specify explicit types
- ❌ **Magic numbers**: Define as constants
- ❌ **Long functions**: Consider refactoring if over 20 lines
- ❌ **God class**: A single class should not have too many responsibilities

### Database
- ❌ **Physical deletion forbidden**: Never use `DELETE` queries
- ❌ **SELECT asterisk (*) forbidden**: Explicitly select only needed columns
- ❌ **Missing Audit Trail forbidden**: All entities must have the 5 required fields
