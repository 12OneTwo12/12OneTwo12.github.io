---
title: "🚀 외부 API 성능 개선기: Look-aside 캐시로 5100ms ➔ 57ms 단축"
tags:
  - "cache"
  - "redis"
  - "look-aside"
  - "api"
  - "performance optimization"
date: '2024-12-16'
---

안녕하세요. 저는 현재 대출 및 투자 연계 플랫폼에서 백엔드 개발자로 근무 중인 2년 차 개발자입니다. 이번 글에서는 **Look-aside 캐시 패턴을 활용하여 외부 API 성능을 개선한 경험**을 공유하려고 합니다.

이 과정에서 제가 직면했던 문제들은 단순하지 않았습니다. API 호출의 지연, 중복 호출로 인한 비용 문제, 그리고 사용자 경험의 저하 등 다양한 문제들이 얽혀 있었습니다.

특히, 외부 API의 평균 응답 시간이 약 5100ms에 달하면서 사용자 대기 시간이 지나치게 길어졌고, 이는 사용자 이탈로 이어질 수 있는 중대한 문제로 인식되었습니다.

이러한 문제들을 단순히 외부 API 개선요구에만 의존하기에는 어려웠기에, 외부 API의 성능개선을 위해 내가 할 수 있는 건 없을까 고민하다 **캐시를 도입하기로 결정하게 됐습니다.**

이 글에서는 Look-aside 캐시의 개념, 구현 과정, 그리고 실제 적용 결과에 대해 다루려 합니다.


### 1. 문제 상황

저희 회사의 대출 중계 상품 중 하나인 **주택담보대출 서비스**는 사용자가 주택 주소를 입력하면 해당 주택의 시세에 따라 대출 한도를 계산해 보여줍니다. 여기서 핵심은 **주택 시세 및 단지, 평형 정보 데이터**로, 이 정보를 외부 API를 통해 가져오고 있었습니다.

#### 🔹 **주요 문제**
- **응답 속도 지연**: 외부 API의 평균 응답 시간이 약 5100ms로, 사용자 대기 시간이 지나치게 길어졌습니다.

- **외부 시스템 개선의 어려움**: 고객사의 입장에서 성능개선을 요구한다 하더라도 개선이 바로 이루어지기엔 어려움이 있었습니다.

- **중복 요청 발생**: 대출 신청 프로세스 중 임시 저장 기능이 있어, 동일한 주소에 대해 중복 조회가 발생했습니다.

- **비용 문제**: 외부 API 호출 비용이 누적되면서 운영 비용이 증가했습니다.

![](https://velog.velcdn.com/images/12onetwo12/post/f6718b3d-e3cc-41e1-9dd4-d23df18f7394/image.png)
(외부 API 응답속도 최저 3006ms 최대 9412ms)

![](https://velog.velcdn.com/images/12onetwo12/post/25af37e4-f525-4802-bcbd-70568d6c4914/image.png)


> **📉 API 응답 속도 분석**
> - 최저: 3006ms
> - 평균: 5132ms
> - 최대: 9412ms

이로 인해 사용자 불만이 증가했고, 서비스 품질 저하로 이어졌습니다. 특히, 대출 신청 과정에서의 반복 호출로 인해 불필요한 비용이 발생했습니다.

---

### 2. 해결 방법: Look-aside 캐시 패턴 도입

외부 API의 성능을 개선하는 방법으로 **Look-aside 캐시 패턴**을 선택했습니다.

#### 🔹 **Look-aside 캐시란?**
Look-aside 캐시는 **데이터베이스(DB) 또는 외부 API에 접근하기 전에 캐시를 먼저 확인하는 캐싱 전략**입니다. 만약 캐시에 데이터가 존재하면 이를 반환하고, 없다면 외부 API를 호출한 후 캐시에 저장하는 방식입니다.

![](https://velog.velcdn.com/images/12onetwo12/post/141a4a30-e9e5-416a-aaba-2a4408fb3b0a/image.png)

> **🔹 동작 원리**
> 1. 사용자의 요청이 들어오면 **캐시(Cache)** 에서 데이터 존재 여부를 확인합니다.
> 2. 캐시에 데이터가 있으면 반환합니다 (**cache hit**).
> 3. 캐시에 데이터가 없으면 **외부 API에 요청**을 보내고, 응답받은 데이터를 캐시에 저장한 후 반환합니다 (**cache miss**).

> **🌐 예시 흐름**
> - [사용자 요청] ➞ [캐시 확인] ➞ **(데이터가 있으면 반환)** ➞ [응답]
> - [사용자 요청] ➞ [캐시 확인] ➞ **(데이터가 없으면)** ➞ [외부 API 호출] ➞ [캐시에 저장] ➞ [응답]

#### 🔹 **왜 Look-aside 캐시를 선택했을까?**

- **불확실한 요청 패턴**: 사용자가 요청하는 주택의 주소가 사전에 예측되지 않기때문에, 미리 데이터를 적재할 수 없었습니다. 만약 특정할 수 있었다면 Cache Warm up을 고려했을 것 같습니다.

- **중복 요청 문제 해결**: 문제점에서 언급했던대로 대출 신청 프로세스 중 임시 저장 기능이 있었는데, 임시 저장된 데이터를 불러올 때마다 동일한 주소에 대해 중복 조회가 발생했습니다. 그렇기 때문에 임시저장을 불러올때 Cache hit 가능성이 높을 거라 판단했습니다.

- **첫 요청 지연 감수**: Look-aside 패턴의 특성상 첫 요청은 기존 속도와 동일 할테지만 이후 동일한 요청은 캐시로부터 빠르게 제공할 수 있습니다.


---

### 3. 구현 과정

#### 🔹 **기술 스택**
- **Redis**: 인메모리 DB로 Redis를 채택했습니다. 기존에 분산 락 및 Session Clustering 용도로 redis를 사용중이기도 해서 추가적인 Infra 셋팅이 필요하지 않는다는 점이 가장 매력적이였습니다.

#### 🔹 **구현 흐름**
```
[사용자 요청] ➞ [캐시 확인] ➞ [캐시에 데이터가 있으면 반환] ➞ [없으면 외부 API 호출] ➞ [응답 데이터 캐시에 저장] ➞ [응답 반환]
```

#### 🔹 **주요 구현 코드 예시**
```java
@Bean
public RedisCacheManager cacheManager(RedisConnectionFactory redisConnectionFactory) {
    RedisCacheConfiguration defaultCacheConfig = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofSeconds(86400))
            .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer()));

    Map<String, RedisCacheConfiguration> cacheConfigurations = new HashMap<>();
    cacheConfigurations.put("realPrice", getRealPriceCacheConfiguration());

    return RedisCacheManager.builder(redisConnectionFactory)
            .cacheDefaults(defaultCacheConfig)
            .withInitialCacheConfigurations(cacheConfigurations)
            .build();
}

private RedisCacheConfiguration getRealPriceCacheConfiguration() {
    long secondsUntilThursday = ChronoUnit.SECONDS.between(LocalDateTime.now(), LocalDateTime.now().with(TemporalAdjusters.nextOrSame(DayOfWeek.THURSDAY)).withHour(23).withMinute(30));
    return RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofSeconds(secondsUntilThursday));
}
```
```java

if(!noCache) {
  try {
      Cache searchCache = cacheManager.getCache("realPrice");
      String cacheKey = buildingCd;
      RealPriceInquiryResponse cacheData = searchCache.get(cacheKey, RealPriceInquiryResponse.class);

      if (cacheData != null) return cacheData;
  } catch (Exception e) {
      log.error("Cache lookup failed", e);
  }
}

RealPriceInquiryResponse response = webClient.requestRealPriceApi();

try {
    searchCache.put(cacheKey, response);
} catch (Exception e) {
    log.error("Cache save failed", e);
}

return response;
```

![](https://velog.velcdn.com/images/12onetwo12/post/1108dfed-3124-495c-864f-f1672acf4bde/image.png)

- Client Server : 일반사용자가 Client인 WAS
- Admin Server : 백오피스 WAS
- API Server : 외부 서버와 통신을 추상화한 서버
- External Api Server : 외부 API 서버

> 위 그림은 **API 서버의 캐시 구조를 포함한 서버 아키텍처**를 나타낸 것입니다. **API 서버는 외부 서버와 통신을 추상화한 서버**로, 은행 전문 등 다양한 외부 시스템과의 통신을 통합하기 위해 설계되었습니다.

>Client Server와 Admin Server는 API Server로 요청을 보내며, 이때 API 서버는 먼저 **캐시를 확인**하여 데이터를 조회합니다. 만약 캐시에 데이터가 없다면 **외부 API 서버와 통신**하여 데이터를 조회하고, 이 데이터를 캐시에 저장한 후 반환합니다.

> 단, Admin Server의 경우, **대출 한도 심사와 같이 더 정확한 정보가 요구**되므로, **캐시된 데이터가 아닌 외부 API 서버와 직접 통신**하여 최신 정보를 가져옵니다.

---

### 4. 성과 및 개선 효과

![](https://velog.velcdn.com/images/12onetwo12/post/22da82d3-80af-4884-a273-2f9914d476a4/image.png)
(첫 요청은 평균 약 5100ms로 동일 캐시 hit시 평균 57ms)

![](https://velog.velcdn.com/images/12onetwo12/post/8db5c419-e105-4129-9dcf-6dfe7df3d4dc/image.png)


|  **구분**  | **도입 전** | **도입 후** |
|------------|------------|------------|
| **평균 응답 시간** | 5132ms      |  1299ms       |
| **Cache Miss** |    5132ms    |    5231ms       |
| **Cache Hit** |    X    |   57ms       |
| **API 호출 횟수** | 100%        | 76% 감소    |
| **사용자 만족도** | 낮음        | 비교적 상승       |

- **응답 속도 개선**: 평균 5132ms였던 응답 시간이 1299ms로 74.69% 개선됐습니다.

- **API 비용 절감**: 외부 API 호출 횟수가 76% 이상 감소했습니다.

- **사용자 경험 향상**: 페이지 로딩 속도가 빨라져 사용자 만족도가 개선되었습니다.

---


### 5. 캐시 만료 전략

캐시된 데이터를 목적하는 바에 부합하게 데이터를 유지하는 것은 굉장히 중요하다고 생각합니다. 저희같은 경우는 외부 API의 데이터가 변경되었음에도 불구하고 캐시가 갱신되지 않으면, 정확하지 않은 대출한도가 사용자에게 제공될 위험이 있었습니다.

이 문제를 해결하기 위해 **외부 API의 데이터가 변경되는 시점에 캐시를 비우는 전략을 선택**했습니다. 외부 API의 **데이터 변경 주기가 일정**했기 때문에 이 시간에 맞춰 Redis에 저장된 특정 키의 캐시 데이터를 삭제하도록 설정했습니다.

Redis 메모리가 제한된 상황에서 오래된 데이터가 쌓이는 문제를 해결하기 위해 **LRU(Least Recently Used) 정책**을 적용했습니다.

---

### 6. 결론

이번 **Look-aside 캐시 도입**을 통해 외부 API 호출에 의존하는 서비스에 캐시를 활용함으로써 응답 속도를 조금이라도 개선 할 수 있었습니다.

외부 시스템에 대한 의존성은 서비스 운영에 있어 피할 수 없는 순간들이 있을 수 있다고 생각합니다. 그렇지만 주어진 환경 안에서 최선의 방법을 찾는것이 중요하지 않나 싶습니다.

이번 작업을 통해 얻은 경험들과 개선사항들이 여러분들에게 조금이라도 도움이 됐으면하며 이만 글을 마치도록 하겠습니다.
