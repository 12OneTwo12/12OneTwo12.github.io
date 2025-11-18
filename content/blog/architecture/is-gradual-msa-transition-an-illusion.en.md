---
title: "Is Gradual MSA Transition an Illusion? - Battling with Tightly Coupled Legacy Services"
tags:
  - "msa"
  - "transition"
  - "ddd"
date: '2025-07-21'
---

Hello, I'm Jeongil Jeong, a 3rd-year backend developer working at a proptech platform.

I joined the team recently in March, and like many companies, our team was undertaking the grand journey of transitioning legacy services to Microservices Architecture (MSA) for better scalability and maintainability.

We drew up a blueprint to systematically separate services by domain, apply new technologies, and gradually improve the system.

But reality was different. We especially hit a big wall: **strong coupling between domains**. The ideal scenario of "gradual, piece-by-piece transition" lost its power in the face of our company's powerful and massive legacy system.

In this article, I want to share how we faced the strong coupling issues in our legacy services and what considerations led us to find solutions.

### **The Challenge We Faced - Core Domain Separation**

When I joined the team, they had already made some progress on the MSA transition journey. Services like notifications and user events (coupons, points, etc.) that had relatively loose coupling with other domains were successfully separated, and the team was enjoying the benefits of MSA. The next target was one of the core domains: 'apartment-related functions'.

However, this decision was the beginning of the **'real problem'** that we hadn't experienced before. A huge mountain called **'domain strong coupling'** appeared.

The diagram below is a simplified view of the legacy system we faced.

![](https://velog.velcdn.com/images/12onetwo12/post/ce57af65-b6a1-4fed-9b84-ed5fc91f33ea/image.png)

As you can see, the core logic of `Matching Domain` was directly dependent on data from `Apartment Domain`.

Beyond simply calling APIs, they shared database tables and business logic was deeply intertwined.

Separating `Apart-Service` meant that modifications to matching-related logic were inevitable.

> **"We wanted to migrate only apartment-related functions, but in the legacy service, apartment information had strong coupling with 'matching' functionality, so we couldn't separate apartments alone. We had to separate matching together too, and these kinds of cases create problems that make gradual transition difficult."**

This one sentence I had to say in team meetings after analyzing the legacy service most accurately described our situation.

### **Laying Technical Foundation and the Real Problem Revealed**

Of course, we made efforts to establish a technical foundation while proceeding with MSA transition.

1.  **Hexagonal Architecture & CQS**: We structured it to improve the design quality within services and ensure domain logic doesn't depend on external technologies.
2.  **Inter-service Communication (FeignClient)**: We considered `gRPC`, `Zero-Payload`, `CQRS` for inter-service communication, but used `FeignClient` as standard for efficient synchronous communication in Spring Cloud environment.
3.  **Event-based Architecture (SQS, Kubernetes)**: We introduced SQS for asynchronous processing between services and built an environment to operate all this stably on Kubernetes.

Thanks to these efforts, the technical stability of our MSA increased.

> **However, these technologies fundamentally didn't solve the 'difficulty of gradual MSA transition due to domain strong coupling'.**

Untangling the tangled thread of domains ultimately depended on our 'strategy'.

### **Finding Realistic Methods**

After much consideration, we chose a realistic approach that used two strategies simultaneously.

**1. Transitioning strongly coupled domains 'together'** (Partial Big Bang approach)
We had to abandon the principle of 'gradual transition' partially. We decided to group apartment and matching as one transition unit and separate them to MSA simultaneously.

While this required more resources in the short term, we judged it was the only way to prevent data inconsistency or business logic confusion from incomplete separation in the long run.

**2. Accepting 'modifications' to legacy service and setting a transitional period**
There were cases where legacy and new MSA had to coexist during the transition period. During this transitional period, we couldn't avoid modifying legacy service code to maintain data consistency and service continuity. We used the following transitional strategies:

*   **Calling new MSA from legacy**: We modified part of the legacy system logic to directly call APIs of the newly separated MSA. This allowed us to gradually use new service functions from necessary parts, rather than moving everything at once.
*   **Dual data loading and synchronization**: Maintaining data consistency during the transition period was the biggest challenge. We adopted a dual write method, loading data to both legacy DB and new MSA's DB when user requests came in. Of course, this method alone couldn't guarantee 100% data consistency, so we went through the arduous process of periodically running batch jobs to synchronize data between the two databases.

Since apartment and matching weren't the only cases with such strong coupling, we had to appropriately choose between the two strategies for each case.

![](https://velog.velcdn.com/images/12onetwo12/post/0a379a40-54ee-43a9-b554-ec1c4979dace/image.png)

We decided to transition apartment and matching domains together.

### **Pros and Cons of MSA Transition**

Thanks to this, we gained a lot:
*   **Clear responsibilities and autonomy**: Team responsibilities became clear by domain, and each team could independently choose technology stacks and deploy.
*   **Improved scalability**: We could independently scale only specific services experiencing traffic spikes, enabling cost-effective operations.

But honestly, the disadvantages were also clear:
*   **Increased development resources**: Naturally, as services and infrastructure to manage increased, initial development and operational resources increased significantly.
*   **Complexity of distributed systems**: When failures occurred in event-based architecture, tracking and debugging which service the problem started from became much more difficult. (To solve this problem, we built a separate monitoring system.)

### **So, Is MSA the Answer?**

When I joined the team, MSA transition had already been decided. But after going through this process, I now ask myself, "If the service isn't large and complex enough, should we really adopt MSA?"

I think MSA is not a silver bullet. Rather, it seems closer to a **tradeoff where you must accept system complexity to solve complex problems**.

Especially when transitioning tightly coupled legacy systems like ours, you need to be prepared to face numerous challenges hidden behind the ideal phrase of 'gradual transition'.

If someone is having similar concerns, I think it would be better to coldly diagnose the 'reality' of our organization and services rather than chasing technical elegance or trends, and choose the most suitable strategy.

Thank you for reading this long article.
