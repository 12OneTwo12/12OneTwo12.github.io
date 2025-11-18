---
title: "16개 레포지토리를 하나로 - MSA 멀티모듈 전환기"
tags:
  - "multi-module"
  - "msa"
date: '2025-10-16'
---

## 들어가며

안녕하세요.

저는 프롭테크 플랫폼에서 백엔드 개발자로 근무 중인 3년차 백엔드 개발자 정정일입니다.

저는 2025년 3월에 팀에 합류에 회사에 16개의 개별 `Repository`에서 관리되던 백엔드 프로젝트를 단일  Repository 기반의 멀티모듈 구조로 변경하는 과정을 가지게 됐습니다.

왜 이런 결정을 내렸고, 그 과정에서 어떤 현실적인 고민들이 있었는지, 그리고 무엇을 얻었는지 담아보려 합니다.

---

## 왜 멀티모듈로 전환했나?

### 합류 첫날의 충격

저희 회사의 MSA 구조는 각 서비스가 개별 Git 레포지토리로 분리되어 운영되고 있었습니다.

```
기존 레포 구조:
- agent-service (중개사 서비스)
- ai-service (AI 서비스)
- community-service (커뮤니티 서비스)
- event-service (이벤트 서비스)
- notification-service (알림 서비스)
- real-price-service (실거래가 서비스)
... 총 16개
```

얼핏 보면 MSA의 이상적인 모습처럼 보이지만 저는 팀에 합류한 첫날 꽤나 놀랐습니다.

레포가 16개라고 놀랄 일인가? 하실 수 있지만 제가 놀란 부분은 **팀 규모 대비 관리하는 레포 갯수**였습니다. 백엔드 팀의 규모는 저 포함 2명이였고 이는 단순히 계산해봐도 꽤나 인원 대비 관리해야할 레포가 많지 않나 싶었습니다. 16개인 이유는 저희 팀은 제가 합류하는 시점에 모놀리식한 서비스를 MSA로 전환하는 과정중에 있었고 각 서비스를 개별 레포로 관리하고 있었습니다. 이 인원으로 16개의 레포지토리를 관리한다는 건 관리의 용이성 측면에서 말이 안 됐습니다.

다만 공통적으로 사용하는 코드들이 모듈화가 이루어져 한번의 수정으로 여러 서비스에 적용될 수 있다면 16개라 하더라도 괜찮을 수 있겠다 싶었지만 **아쉽게도 같은 기능을 하는 로직이면 서로 다른 레포에 똑같은 코드가 개별적으로 관리**되고 있었습니다.

### 반복되는 비효율

가장 큰 문제는 코드 중복과 설정 불일치였습니다. 예를 들어

- **공통 DTO**: 같은 DTO가 여러 서비스에 복사되어 있었고, 하나를 수정하려면 모든 레포를 찾아다녀야 했습니다
- **유틸리티 클래스**: `FileUtils`, `SqsMessageSender` 같은 유틸리티가 여러 곳에 중복 선언되어 있었습니다
- **CI/CD 설정**: 각 레포마다 거의 동일한 파이프라인 설정을 별도로 관리해야 했습니다

**가장 심각했던 건 똑같은 수정사항을 모든 레포에 적용해야 하는 경우였습니다.** 공통 Exception 클래스를 수정할 일이 생겼을 때, 16개 레포를 모두 열어서 하나씩 수정하고 각각 PR을 16개 올리는 작업을 했습니다. 이때 확신했습니다. **"이 구조는 우리 팀 규모에 맞지 않다."**

### 제안과 설득

팀 합류 한 달쯤 되었을 때, 팀에 멀티모듈 전환을 제안했습니다. 제 생각에는 2~3명으로 운영되는 소규모 팀이 여러 레포로 관리하는 건 관리 용이성 측면에서 오버헤드가 크다고 생각했고, 우리 팀 규모에 맞는 방향이 필요하다 생각했습니다.

설득은 어렵지 않았습니다. 현재 상황을 분석한 자료를 만들어 보여드렸고 같은 어려움을 몸소 느끼고 계셨던 팀원분들은 적극 찬성해 주셨습니다.

| 항목 | 멀티레포 (기존) | 모노레포/멀티모듈 (전환 후) |
|------|----------------|---------------------------|
| 공통 모듈 관리 | 중복 존재, 수동 복사 필요 | 한 곳에서 관리, 즉시 공유 |
| CI/CD 구성 | 서비스별로 분산 관리 | 통합 관리 (독립 배포는 유지) |
| 테스트 편의성 | 통합 테스트 어려움 | 통합 테스트 용이 |
| 로컬 개발 환경 | 여러 레포 클론 필요 | 한 레포에서 전체 실행 가능 |
| 팀 규모 적합성 | 대규모/조직별 분업 | 소규모/협업 중심 |

---

## 어떻게 전환했나?

### Step 1: 멀티모듈 구조 전환

팀원분들은 멀티모듈에 대한 정보가 거의 없는 상태였기에 멀티모듈로의 전환을 제가 리드하게 됐습니다.
팀원분들의 동의를 받고 일정을 산정한 이후 본격적으로 작업에 들어갔습니다. 첫 번째 단계는 16개의 개별 레포를 하나로 합치면서 멀티모듈 구조로 만드는 것이었습니다.

#### Git History 유지하기

가장 먼저 고민한 것은 기존 커밋 히스토리를 어떻게 유지할 것인가였습니다. 단순히 파일을 복사하면 수년간의 히스토리가 모두 사라지기 때문에, **Git Subtree**를 이용해 형상관리 히스토리를 유지한 채로 통합했습니다.

```bash
# 각 서비스를 subtree로 추가
git subtree add --prefix=agent-service [agent-repo-url] main
git subtree add --prefix=community-service [ai-repo-url] main
# ... 반복
```

이 과정 덕분에 각 서비스의 개발 이력을 모두 보존할 수 있었습니다.

#### 프로젝트 구조 설계

멀티모듈 구조를 설계하면서 가장 고민한 부분은 **"어떤 기준으로 모듈을 나눌 것인가"**였습니다.

저희는 이미 도메인별로 서비스가 분리되어 있었기 때문에, **도메인 기반 모듈 분리 방식**을 선택했습니다.

최종적으로 다음과 같은 구조를 만들었습니다:

![](https://velog.velcdn.com/images/12onetwo12/post/454e7c11-915d-4eae-8da9-83edce478f83/image.png)

```
multimodule_backend/
├── agent-service/       ← 도메인 모듈
├── ai-service/
├── community-service/
├── event-service/
├── notification-service/
├── real-price-service/
├── common/              ← 공통 모듈
├── settings.gradle.kts
└── build.gradle.kts     ← 루트 빌드 설정
```

여기서 중요했던 것은 **모듈 간 의존성 방향을 명확히 하는 것**이었습니다. 저희는 다음과 같은 원칙을 세웠습니다:

- 각 도메인 서비스 모듈은 `common` 모듈만 의존
- 도메인 모듈 간에는 **직접 의존 금지** (순환 참조 방지)
- 필요시 이벤트 기반 통신 또는 API 호출 활용

#### Gradle 멀티모듈 설정

멀티모듈 프로젝트를 구성하기 위해서는 3개 파일이 핵심입니다.

**1) settings.gradle - 모듈 등록**

가장 먼저 루트에 `settings.gradle` 파일을 만들어 포함할 모듈들을 선언합니다.

```groovy
rootProject.name = 'multimodule_backend'
include 'common'
include 'agent-service'
include 'ai-service'
include 'community-service'
// ... 나머지 서비스들
```

**2) 루트 build.gradle.kts - 공통 설정 정의**

루트의 `build.gradle.kts`에서 모든 서브 모듈이 공유할 플러그인과 의존성을 정의합니다. 핵심은 **`apply false`를 사용해 플러그인 버전만 선언**하고, 실제 적용은 `subprojects` 블록에서 하는 것입니다:

```kotlin
plugins {
    id("org.springframework.boot") version "3.1.1" apply false
    id("io.spring.dependency-management") version "1.1.2"
    kotlin("jvm") version "1.8.22"
    kotlin("plugin.spring") version "1.8.22"
    kotlin("plugin.jpa") version "1.8.22"
}

val queryDslVersion by extra("5.0.0")  // 공통 버전 변수

subprojects {
    group = "me.example"
    version = "0.0.1-SNAPSHOT"

    // 모든 서브 모듈에 플러그인 적용
    apply(plugin = "org.springframework.boot")
    apply(plugin = "io.spring.dependency-management")
    apply(plugin = "kotlin")
    apply(plugin = "kotlin-spring")
    apply(plugin = "kotlin-jpa")

    dependencies {
        // 모든 모듈의 공통 의존성
        implementation("org.springframework.boot:spring-boot-starter")
        implementation("org.jetbrains.kotlin:kotlin-reflect")
        testImplementation("org.springframework.boot:spring-boot-starter-test")
    }

    tasks.withType<Test> {
        useJUnitPlatform()
        maxParallelForks = (Runtime.getRuntime().availableProcessors() / 2).takeIf { it > 0 } ?: 1
    }
}
```

**3) common 모듈 설정 - 라이브러리 모듈**

중요한 포인트는 **common 모듈은 실행 불가능한 라이브러리**로 만들어야 한다는 점입니다. 루트 `build.gradle.kts`에서 `project(":common")` 블록으로 설정합니다:

```kotlin
// 루트 build.gradle.kts 하단에 추가
project(":common") {
    // bootJar 비활성화 (실행 불가능)
    tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
        enabled = false
    }

    // jar 활성화 (라이브러리용)
    tasks.named<Jar>("jar") {
        enabled = true
    }
}
```

**4) 각 서비스 모듈 설정 - 실행 가능한 애플리케이션**

서비스 모듈들은 루트 `build.gradle.kts`에서 `project(":서비스명")` 블록으로 common 의존성만 추가하면 됩니다:

```kotlin
// 루트 build.gradle.kts
project(":agent-service") {
    dependencies {
        implementation(project(":common"))
    }
}

project(":ai-service") {
    dependencies {
        implementation(project(":common"))
    }
}
// ... 모든 서비스 반복
```

각 서비스의 `build.gradle.kts`는 필요한 의존성만 추가:

```kotlin
// agent-service/build.gradle.kts
val queryDslVersion: String by rootProject.extra

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    runtimeOnly("com.mysql:mysql-connector-j")

    // QueryDSL
    implementation("com.querydsl:querydsl-jpa:$queryDslVersion:jakarta")
    kapt("com.querydsl:querydsl-apt:$queryDslVersion:jakarta")
}
```

이렇게 설정하면:
- 공통 설정은 루트에서 한 번만 관리
- 각 서비스는 필요한 의존성만 추가
- common 모듈 변경 시 모든 서비스에 자동 반영

```bash
# 전체 빌드
./gradlew build

# 특정 서비스만 빌드
./gradlew :agent-service:build

# 특정 서비스 실행
./gradlew :agent-service:bootRun
```


#### 버전 통일의 고통

가장 시간이 오래 걸린 부분은 버전 통일이었습니다. 기존 프로젝트 중 가장 높은 버전인 `Spring Boot:3.1.1`를 기준으로 마이그레이션했습니다.

- **Spring Boot** 2.7.* → 3.1.1
- **Kotlin** 1.7.* → 1.8.22
- **AWS SDK** 버전 업
- **QueryDSL** 버전 충돌 해결

Spring Boot 3.x 마이그레이션은 특히 골치 아팠습니다. `javax.*` 패키지가 `jakarta.*`로 변경되면서 수많은 import 문을 수정해야 했고, 일부 라이브러리는 호환되지 않아 대체 라이브러리를 찾아야 했습니다.

**230,909개의 라인이 추가**된 거대한 PR이 만들어졌습니다. 😂

#### 빌드 성능 개선

전체 프로젝트가 커지면서 빌드할 때 IntelliJ의 JVM이 heap이 터지는 경우도 있었습니다. 해당 문제를 해결하기 위해 Gradle 설정을 개선했습니다.

```properties
# gradle.properties
org.gradle.jvmargs=-Xmx2g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
org.gradle.parallel=true
```

```kotlin
// build.gradle.kts
tasks.withType<Test> {
    useJUnitPlatform()
    maxParallelForks = (Runtime.getRuntime().availableProcessors() / 2).takeIf { it > 0 } ?: 1
}
```

이 개선으로 전체 빌드 시간이 27분에서 8분으로 대폭 단축되었습니다!

### Step 2: 공통 로직 정리 및 모듈화

두 번째 단계는 중복되어 있던 코드들을 `common` 모듈로 이전하는 작업이었습니다.

#### 공통 모듈 설계

`common` 모듈에 다음과 같은 것들을 모았습니다:

- **공통 DTO**: 여러 서비스에서 사용하는 응답/요청 객체들
- **유틸리티 클래스**: `FileUtils`, `SqsMessageSender` 등
- **공통 Exception**: `GlobalExceptionHandler`, 커스텀 예외 클래스들
- **공통 설정**: Spring Bean 정의, Auto Configuration

#### Auto Configuration 적용

각 서비스에서 `common` 모듈의 빈들을 자동으로 등록할 수 있도록 Spring Boot Auto Configuration을 구현했습니다:

```kotlin
// common/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
me.example.common.config.CommonAutoConfiguration
```

```kotlin
@AutoConfiguration
@ConditionalOnProperty(
    prefix = "example.common",
    name = ["enabled"],
    havingValue = "true",
    matchIfMissing = true
)
@Import(CommonComponentConfig::class)
class CommonAutoConfiguration
```

이제 각 서비스는 단순히 `implementation(project(":common"))`만 추가하면 공통 기능을 사용할 수 있게 되었습니다.

#### 중복 코드 정리의 놀라움

작업을 진행하면서 놀라웠던 것은 중복 코드의 양이 생각보다 훨씬 많았다는 점입니다. 같은 목적의 Enum 클래스인데 서로 다른 서비스에서 필드 이름이 다른 경우도 있었고, 거의 동일한 유틸리티 메서드가 5~6개 서비스에 복사되어 있기도 했습니다.

**5,545개의 라인 변경**을 통해 이 모든 중복을 제거했습니다.

### Step 3: CI/CD 파이프라인 재구성

멀티모듈 구조로 전환하면서 가장 중요했던 것 중 하나는 **독립적인 배포**를 유지하는 것이었습니다. 한 서비스를 수정했다고 모든 서비스가 재배포되면 안 되니까요.

저희는 CI/CD가 Github actions로 구성돼 있었기 때문에 배포 스크립트를 수정하는 과정을 거쳤습니다.

---

## 전환 후 달라진 점

#### 1. 개발 생산성 향상

공통 코드 수정이 필요할 때 이제는 `common` 모듈 한 곳만 수정하면 됩니다. 예를 들어 Exception 처리 로직을 개선하거나 새로운 유틸리티를 추가할 때, 16개 레포를 돌아다닐 필요가 없어졌습니다.

#### 2. 일관된 코드 품질

버전과 설정이 통일되면서 코드의 일관성이 크게 향상되었습니다. 이제 모든 서비스가 동일한 Spring Boot 버전을 사용하고, 같은 코딩 컨벤션을 따릅니다.

#### 3. 통합 테스트 용이

여러 서비스 간의 통합 테스트를 작성하기가 훨씬 쉬워졌습니다. 같은 프로젝트 내에 있으니 서비스 간 인터페이스를 테스트하는 것도 자연스럽게 할 수 있습니다.

#### 4. 신규 서비스 추가 시간 단축

새로운 서비스를 추가할 때도 보일러플레이트 코드를 작성할 필요가 없어졌습니다. `common` 모듈을 의존하고, 필요한 비즈니스 로직만 작성하면 됩니다.

실제로 서비스를 하나 새로 추가할 때 기본 설정에 들어가는 시간이 크게 줄어들었습니다.

#### 5. 팀 협업 개선

코드 리뷰할 때도 전체 컨텍스트를 보기 쉬워졌습니다. 같은 레포지토리 안에서 영향받는 다른 서비스를 바로 확인할 수 있으니, 변경 사항의 영향 범위를 파악하기가 훨씬 수월해졌습니다.

---

## 겪었던 어려움과 해결

### 1. 빌드 시간 증가

초기에는 전체 프로젝트를 빌드할 때 시간이 오래 걸렸습니다. 특히 모든 테스트를 돌리면 상당한 시간이 소요됐죠.

**해결책**:
- Gradle 병렬 빌드 활성화
- 변경된 모듈만 빌드하도록 스크립트 개선
- 테스트도 병렬로 실행 (`maxParallelForks` 설정)

### 2. 버전 문제

버전을 통일하는 과정에서 의존성 충돌이 발생하는 경우도 있었고, 기존 버전에선 문제 없던 설정이 버전을 올리며 문제가 되는 경우들도 있었습니다. 이 문제를 하나하나 해결해줘야했죠 🥲

### 3. CI/CD 파이프라인 복잡도

16개 서비스를 독립적으로 배포하면서도 공통 모듈 변경 시 영향받는 모든 서비스를 재배포해야 하는 로직을 구현하는 것이 복잡했습니다.

**해결책**:
- `common` 모듈 변경 시 모든 서비스 빌드
- 개별 서비스 변경 시 해당 서비스만 빌드
- 명확한 배포 매트릭스 정의

---

## 배운 점

### 1. 아키텍처는 팀에 맞게

MSA를 멀티레포로 운영하는 것이 꼭 정답은 아니라고 생각합니다. 팀 규모, 조직 구조, 협업 방식에 따라 모노레포가 더 적합할 수 있지 않나 싶습니다. 저희 팀처럼 소규모 팀에서는 모노레포/멀티모듈이 훨씬 효율적인 것 같습니다.

### 2. 점진적 마이그레이션의 중요성

한 번에 모든 것을 바꾸려고 하면 부담이 너무 크다고 생각합니다. 저희는
1. 먼저 구조만 통합 (Step 1)
2. 그다음 공통 로직 정리 (Step 2)
3. 마지막으로 CI/CD 재구성 (Step 3)

이렇게 단계적으로 접근했기 때문에 각 단계에서 문제를 해결하고 안정화할 수 있었습니다.

### 3. 히스토리 보존의 가치

Git Subtree를 사용해 커밋 히스토리를 보존한 것은 정말 잘한 선택이었습니다. 나중에 버그를 추적하거나 변경 이유를 파악할 때 큰 도움이 되었습니다.

### 4. 독립 배포는 꼭 유지

모노레포로 통합했지만 각 서비스의 독립적인 배포는 반드시 유지해야 합니다. 이것이 MSA의 핵심 장점이니까요. 저희는 CI/CD 파이프라인을 잘 설계해서 이 부분을 지킬 수 있었습니다.

### 5. Common 모듈은 최소화하라

멀티모듈 전환의 가장 큰 함정 중 하나는 **"공통으로 사용하는 코드라면 common에"**라는 생각인것 같습니다. 원하든 원치 않든 여러 서비스가 공통적으로 사용할 코드는 늘어나고 변하고 삭제됩니다. 이럴때마다 Common 모듈은 변화하게 될텐데 이는 자칫 잘못하면 프로젝트 전체에 영향을 주게 된다는말과 다르지 않습니다.

초기에는 저도 이렇게 접근하며 멀티모듈로 전환하다가 Common 모듈이 비대해지면서 **"이래도 되나...?"** 싶은 순간들이 생겼고, 작업하던 내용을 날리고 공통 모듈의 기준을 정확하게 새우고 작업을 해야겠다 다짐하게 됐습니다.

**해결책은 간단했습니다. Common을 최소화하고, 나머지는 기능별로 분리하는 것입니다.**

감사하게도 저희가 겪으려던 과정을 이미 체험하신 개발자 분들이 계셨고 이를 [경험과 함께 공유](https://techblog.woowahan.com/2637/)해주셨기 때문에 저희는 같은 문제를 겪지 않을 수 있었습니다.

위 글에 적힌것처럼 common은 정말 **모든 서비스가 사용하는 Type, Enum, Util 정도만** 포함시켰습니다. 인프라 관련 코드(JPA, Redis, S3 등)는 별도 모듈로 분리하여 필요한 서비스만 선택적으로 의존하도록 했습니다.

### 6. 순환 참조 방지의 중요성

멀티모듈 구조에서 또 하나 조심해야할 것은 **순환 참조**입니다. A 모듈이 B 모듈을 참조하고, B 모듈이 다시 A 모듈을 참조하면 빌드 자체가 실패합니다.

저희는 이를 방지하기 위해
- 도메인 모듈 간 직접 의존을 금지했습니다
- 모듈 간 명확한 계층 구조를 정의했습니다
- 서비스 간 통신이 필요하면 이벤트나 API 호출을 사용하도록 했습니다

초기에 이 원칙을 명확히 세워둔 덕분에 큰 문제 없이 진행할 수 있었습니다.

---

## 마치며

저희는 다행히 멀티모듈 전환 프로젝트를 무사히 마쳤습니다. 지금 돌이켜보면 팀에 합류한지 얼마 안된 저를 믿고 멀티모듈로의 전환을 맡겨주신 팀원분들께 감사했습니다. 팀의 신뢰와 지원 덕분에 해낼 수 있었다고 생각합니다.

제가 이번 작업을 하면서 가장 크게 느낀 점은 **"좋은 아키텍처는 이론이 아니라 팀 상황에 맞춰야 한다"**는 것이었습니다. "MSA = 멀티레포"라는 고정관념에서 벗어나, 백엔드 2~3명이라는 우리 팀 현실에 맞는 구조를 찾았다는 게 뿌듯합니다.

이제는 코드 중복 걱정 없이 개발할 수 있고, 팀원들도 협업이 훨씬 수월해졌다고 이야기합니다. 무엇보다 입사 초기에 이런 큰 프로젝트를 맡겨주신 팀에 감사하고, 좋은 결과로 보답할 수 있어서 다행입니다.

여러분의 팀도 비슷한 고민을 하고 계신다면, 이 글이 조금이나마 도움이 되었으면 좋겠습니다. 긴 글 읽어주셔서 감사합니다!

