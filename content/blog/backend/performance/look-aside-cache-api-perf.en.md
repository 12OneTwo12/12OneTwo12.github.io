---
title: "External API Performance Improvement: Reducing Response Time from 5100ms to 57ms with Look-aside Cache"
tags:
  - "cache"
  - "redis"
  - "look-aside"
  - "api"
  - "performance optimization"
date: '2024-12-16'
---

Hello. I'm a 2-year backend developer currently working at a lending and investment platform. In this post, I'd like to share my experience of **improving external API performance using the Look-aside cache pattern**.

The problems I faced during this process were not simple. Various issues were intertwined, including API call delays, cost issues due to duplicate calls, and degradation of user experience.

Particularly, with the external API's average response time reaching about 5100ms, user waiting time became excessively long, and this was recognized as a critical problem that could lead to user churn.

Since it was difficult to rely solely on external API improvement requests to solve these problems, I wondered if there was anything I could do to improve the external API's performance, and **decided to introduce caching**.

This post will cover the concept of Look-aside cache, the implementation process, and the actual results of its application.


### 1. Problem Situation

One of our company's loan brokerage products, the **mortgage loan service**, calculates and displays the loan limit based on the housing market price when users enter a housing address. The key here is **housing market price and complex/floor plan information data**, which we were fetching through an external API.

#### Key Problems
- **Response Speed Delay**: The external API's average response time was about 5100ms, making user waiting time excessively long.

- **Difficulty in External System Improvement**: Even if we requested performance improvements as customers, it was difficult to implement improvements immediately.

- **Duplicate Requests**: Due to a temporary save feature in the loan application process, duplicate queries occurred for the same address.

- **Cost Issues**: Accumulated external API call costs increased operational expenses.

![](https://velog.velcdn.com/images/12onetwo12/post/f6718b3d-e3cc-41e1-9dd4-d23df18f7394/image.png)
(External API response speed: minimum 3006ms, maximum 9412ms)

![](https://velog.velcdn.com/images/12onetwo12/post/25af37e4-f525-4802-bcbd-70568d6c4914/image.png)


> **API Response Speed Analysis**
> - Minimum: 3006ms
> - Average: 5132ms
> - Maximum: 9412ms

This led to increased user complaints and degradation of service quality. Particularly, unnecessary costs occurred due to repeated calls during the loan application process.

---

### 2. Solution: Introducing Look-aside Cache Pattern

I chose the **Look-aside cache pattern** as a method to improve external API performance.

#### What is Look-aside Cache?
Look-aside cache is **a caching strategy that checks the cache first before accessing the database (DB) or external API**. If data exists in the cache, it returns that data; if not, it calls the external API and then stores it in the cache.

![](https://velog.velcdn.com/images/12onetwo12/post/141a4a30-e9e5-416a-aaba-2a4408fb3b0a/image.png)

> **Operating Principle**
> 1. When a user request comes in, check if data exists in the **Cache**.
> 2. If data exists in the cache, return it (**cache hit**).
> 3. If data doesn't exist in the cache, **send a request to the external API**, store the received data in the cache, and then return it (**cache miss**).

> **Example Flow**
> - [User Request] → [Check Cache] → **(If data exists, return)** → [Response]
> - [User Request] → [Check Cache] → **(If data doesn't exist)** → [Call External API] → [Store in Cache] → [Response]

#### Why Did I Choose Look-aside Cache?

- **Unpredictable Request Pattern**: Since the addresses of houses that users request couldn't be predicted in advance, we couldn't pre-load data. If it had been predictable, I would have considered Cache Warm-up.

- **Solving Duplicate Request Problem**: As mentioned in the problems, there was a temporary save feature in the loan application process, and duplicate queries occurred for the same address every time temporarily saved data was loaded. Therefore, I judged that the cache hit possibility would be high when loading temporary saves.

- **Accepting First Request Delay**: Due to the nature of the Look-aside pattern, the first request would have the same speed as before, but subsequent identical requests could be served quickly from the cache.


---

### 3. Implementation Process

#### Tech Stack
- **Redis**: I adopted Redis as an in-memory DB. Since we were already using Redis for distributed locks and Session Clustering, the fact that no additional infrastructure setup was needed was most attractive.

#### Implementation Flow
```
[User Request] → [Check Cache] → [Return if data exists in cache] → [Call external API if not] → [Store response data in cache] → [Return response]
```

#### Main Implementation Code Example
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

- Client Server: WAS where general users are clients
- Admin Server: Back-office WAS
- API Server: Server that abstracts communication with external servers
- External API Server: External API server

> The above diagram represents the **server architecture including the API server's cache structure**. The **API Server is a server that abstracts communication with external servers**, designed to integrate communication with various external systems such as bank protocols.

>Client Server and Admin Server send requests to the API Server, where the API server first **checks the cache** to query data. If data doesn't exist in the cache, it **communicates with the external API server** to query data, stores this data in the cache, and then returns it.

> However, in the case of Admin Server, since **more accurate information is required for operations like loan limit assessments**, it **communicates directly with the external API server instead of using cached data** to fetch the latest information.

---

### 4. Results and Improvement Effects

![](https://velog.velcdn.com/images/12onetwo12/post/22da82d3-80af-4884-a273-2f9914d476a4/image.png)
(First request averages about 5100ms, cache hit averages 57ms)

![](https://velog.velcdn.com/images/12onetwo12/post/8db5c419-e105-4129-9dcf-6dfe7df3d4dc/image.png)


|  **Category**  | **Before** | **After** |
|------------|------------|------------|
| **Average Response Time** | 5132ms      |  1299ms       |
| **Cache Miss** |    5132ms    |    5231ms       |
| **Cache Hit** |    X    |   57ms       |
| **API Call Count** | 100%        | 76% reduction    |
| **User Satisfaction** | Low        | Relatively increased       |

- **Response Speed Improvement**: Average response time improved by 74.69% from 5132ms to 1299ms.

- **API Cost Reduction**: External API call count decreased by more than 76%.

- **User Experience Enhancement**: Page loading speed improved, leading to increased user satisfaction.

---


### 5. Cache Expiration Strategy

I think it's extremely important to maintain cached data in line with the intended purpose. In our case, if the cache wasn't refreshed even though the external API data had changed, there was a risk of providing inaccurate loan limits to users.

To solve this problem, I chose **a strategy of clearing the cache when the external API data changes**. Since the external API's **data change cycle was consistent**, I configured it to delete cache data for specific keys stored in Redis at this time.

To solve the problem of old data accumulating in a limited Redis memory situation, I applied the **LRU (Least Recently Used) policy**.

---

### 6. Conclusion

Through this **introduction of Look-aside cache**, I was able to improve response speed, even if slightly, by utilizing cache for services dependent on external API calls.

I think there are moments when dependency on external systems is unavoidable in service operations. However, I believe finding the best method within the given environment is important.

I hope the experiences and improvements gained through this work can be of some help to you, and I'll conclude this post here.
