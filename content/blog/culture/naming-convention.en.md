---
title: "Absence of Naming Conventions Leads to Failures"
tags:
  - "naming"
  - "convention"
date: '2025-06-30'
---

Hello,
I'm Jeongil Jeong, a 3rd-year backend developer working at a proptech platform.

Today I'd like to talk about the **importance of naming conventions**, which we know are important in software development but whose importance we tend to overlook when it comes to resource investment.

Through a problem we actually experienced on our team recently, I want to share how inconsistent naming can threaten system stability.

---

### Monthly Rent Search Function Error

Recently, in a specific function of our service, there was a problem where **system exceptions occurred when searching with monthly rent keywords**. From the user's perspective, they expected normal search results, but under specific conditions, the system threw exceptions and failed.

![](https://velog.velcdn.com/images/12onetwo12/post/05ae0054-9512-41ed-b8e8-a06aca12b733/image.png)

This problem wasn't outwardly visible, but I accidentally discovered it while inspecting the overall system after joining the team in March this year.

The operation structure of that function was as follows:

```
Client (web) request -> Service A client return → Client (web) request with A's response value → Service B → Query through DB procedure
```

The problem occurred because each component was defining the concept of 'monthly rent' differently in this data flow.

---

### Root Cause of Problem: 'Monthly Rent' Naming Inconsistency

Analysis revealed that **naming referring to 'monthly rent' was not unified within the system**, which was the core cause of exception occurrence.

We have services configured based on Microservices Architecture (MSA), and while each service operates independently, interconnection is essential. In this environment, **without clear agreements on common concepts, even a single trivial string can cause fatal errors.**

For example, `Service A` was returning monthly rent as `monthly`:

```kotlin
val dealType = when { // Actually an Enum class. Simplified for explanation.
    dto.isDeal -> "deal"
    dto.isLease -> "lease"
    dto.isMonthly -> "monthly"
    else -> "none"
}
```

On the other hand, `Service B` and the connected database were defining monthly rent as **`rent`**. The problem didn't end with simple naming inconsistency. **The 'transaction type' field in database procedure parameters had limited string length** (`VARCHAR(5)`), and `monthly` (7 characters) exceeded the target, causing exceptions.

That is, in the process of passing from `Service A` → `Service B` → DB, **DB couldn't accept the value `monthly` and threw validation exceptions**.

To temporarily solve this, I modified `Service A`'s code as follows:

```kotlin
val dealType = when {
    dto.isDeal -> "deal"
    dto.isLease -> "lease"
    dto.isMonthly -> "rent" // Temporary response
    else -> "none"
}
```

However, this isn't a fundamental solution, and it still carries the **potential risk** that naming inconsistency could cause problems in other functions or services.

---

### Why Wasn't the Problem Revealed Until Now?

This problem seems like a simple code error, but why this error was **never detected in the operating service until now** is an important point.

The reasons are as follows:

1. **Because requests coming with monthly rent keywords were rare in this function**. This function is only activated under specific conditions, and users also access it in specific situations, so occurrence frequency was low.

2. **Insufficient E2E testing**. Actually, even testing-related certifications like ISTQB say perfect testing doesn't exist and **services without defects don't exist**.

   Therefore, we can't necessarily blame testing, but our team had somewhat focused on unit testing, so there were insufficient E2E test cases. **I think if E2E test cases had been more systematic and detailed, we could have detected defects in advance**

3. **The company had no real-time exception detection system.** Even when exceptions occurred within the system, they couldn't be automatically detected or received as notifications, so most errors could only be identified **when users directly reported to customer service**. This part felt like something that needed to be improved very quickly for me

---

### Users Just Leave When There Are Failures

How do you usually behave when strange messages appear while using an app and the function you wanted doesn't work? Do you often contact customer service and explain? Or do you often just **"Ugh!!"** and close the app?

Unless it's a really necessary function or you're very angry, **most users will probably just close the app**. Like this, even if users face unexpected situations, it's difficult for the company to identify internally without a monitoring system.

This can lead to **user churn**, which is a **critical result** for business, so it can be **a very big problem**.

Here's the approximate CS inflow probability for users.
Please note that these numbers are **empirical estimates** based on extensive customer behavior research rather than direct statistical data.

| Factor | Explanation | Estimated Inflow Probability | Key Sources & Rationale |
|---|---|---|---|
| **User Churn Tendency** | Users have very low patience with service performance degradation (loading delays, errors) and prefer **immediate churn** over problem-solving attempts. | **Less than 5%** | **Think with Google:** If mobile page loading time increases from 1 to 3 seconds, bounce rate increases 32%, and from 1 to 5 seconds increases 90%. This shows users' tendency to quickly churn when facing problems. ([Find out how you stack up to new industry benchmarks for mobile page speed](https://www.thinkwithgoogle.com/intl/en-gb/marketing-strategies/app-and-mobile/mobile-page-speed-new-industry-benchmarks/)) |
| **Silence of Dissatisfied Customers** | Dissatisfied customers have a strong tendency to **quietly leave the service** rather than complain, and customer service inquiries require additional effort and time. | **5% ~ 10%** | **Qualtrics:** 96% of customers simply leave without complaining when they had a bad experience. This suggests users who experienced failures have higher probability of churning than inquiring to customer service. ([Customer Loyalty: What it is and how to build it](https://www.qualtrics.com/experience-management/customer/customer-loyalty/)) |
| **Failure Severity and Repetition** | The more critical and repetitive failures are, the more likely users are to contact customer service for problem resolution. | **5% ~ 20% (serious cases)** | **Indirect estimation:** Based on general **views of customer service and UX (user experience) experts** rather than specific research. Serious financial loss or service unavailability states increase likelihood of inducing customer inquiries. |
| **Customer Service Accessibility** | Complexity of inquiry channels (ARS, long wait times) acts as another barrier to users. Conversely, when easy and quick resolution is possible, inflow can increase. | **Less than 1% when accessibility is low Up to 10%+ when high (maximum)** | **Indirect estimation:** Based on **statistics and principles in customer experience (CX) and call center management fields**. Customer service response time, channel diversity (chatbot, FAQ, live chat, etc.) directly affect customer satisfaction and inquiry rates. (Related content can be confirmed in customer service reports from Zendesk, Genesys, etc.) |
| **User Relationship/Loyalty** | When loyalty to the service is high or it's recognized as an essential service, users may actively try to resolve problems. | **10% ~ 25% (loyal customers)** | **Indirect estimation:** Trends appearing in **Customer Relationship Management (CRM) and customer loyalty research**. Loyal customers show more patience in problem resolution and have strong will to provide feedback for service improvement. (e.g., Bain & Company's NPS (Net Promoter Score) related research) |

As such, cases where users flow in through CS are very rare compared to user experience, so **I think we need to detect failures faced by users without CS inflow.**

After I joined in March, as part of work to increase operational stability, I **issued a ticket to build an observation and monitoring system based on Loki, Grafana, Tempo and proceeded with work**, and in that process **I also introduced exception notification system**.

I'll cover this process separately in another article.

Thanks to this system, exceptions for abnormal requests arrived as real-time notifications, and only then did the team clearly recognize this problem existed.

Ultimately, this problem hadn't surfaced until now due to two reasons: **low usage frequency** and **absence of observation tools**.

---

### Technical Debt That Hadn't Been Revealed

Through this problem, while looking at the entire system, I could confirm how differently the way of referring to the concept of 'monthly rent' was being used per service.

Examples are as follows:

* Some DB fields use `monthly`
* Some DB fields use `rent`
* Other APIs use `MONTHLY_LEASE`
* In specific enum structure, `MONTHLY_LEASE` and `SHORT_TERM_LEASE` are set to same value:

```kotlin
enum class OfficeDealType(...) {
    SALE("Sale", "DEAL"),
    LEASE("Jeonse", "LEASE"),
    MONTHLY_LEASE("Monthly Rent", "MONTHLY_LEASE"),
    SHORT_TERM_LEASE("Short-term Lease", "MONTHLY_LEASE"), // Short-term lease also uses identical value
}
```

* And some DBs use Korean names directly like **`월세`**, **`전세`**

The situation where various naming is being used for one concept (monthly rent) leads beyond simple code style problems to **technical debt that harms system consistency and stability**.

It was like **a dangerous state of walking on a rope about to break**.

Especially according to what we confirmed through this investigation, **there are about 30 tables where `deal_type` related naming inconsistencies need to be fixed**, and **comprehensive investigation is needed for the entire service**.

Ultimately, it's also a case clearly showing **the fact that small inconvenience and absence of conventions at early stages make you consume more development and maintenance resources as time passes**.

I who has to do this work will have a hard time, right? 🤣

---

### Naming Conventions Are Minimum Promise for System Robustness

Through this case, our team once again realized the **importance of naming conventions**. Especially in microservices-based environments, since exchanging data between services is frequent, without clear specifications and consistent naming, the following problems easily occur:

1. **Unpredictable system errors**
   When naming inconsistency and field constraints interlock, exceptions directly connected to user experience can occur anytime.

2. **Increased development and maintenance costs**
   Developers must continuously track code to infer correct values, and unnecessary resources are wasted resolving bugs caused by wrong naming.

3. **Decreased readability and system understanding**
   When one concept is expressed in multiple ways, understanding the entire system's context becomes difficult. This also becomes a big obstacle to new developer onboarding.

4. **Collaboration inefficiency**
   Term inconsistency in communication between developers causes misunderstandings and creates confusion in review and documentation processes.

---

### Future Plan: Company-wide Standardization to Secure Naming Consistency

Our team didn't end this problem with simple bug fixing, but embarked on **maintenance work to unify naming conventions throughout the system**.

Short-term, we plan to prepare clear specifications for major concepts like 'monthly rent', and mid-to-long-term, we plan to prepare structured standards that can be applied consistently across all services.

We judge this is very important work that goes beyond simply improving code quality, improving **system stability, operational efficiency, and development productivity**.

---

### In Conclusion

One seemingly trivial naming gave me a very big lesson on how much it can affect the entire system.

There were cases where the entire team couldn't have one naming convention due to reasons like needing to go through processes where the entire team agrees for naming conventions, or annoyance, or assumptions that obviously everyone uses it this way, but I also had cases of overlooking or postponing such points.

I reflected again and I'm trying to construct an environment where the entire team can share naming so such things don't happen starting from myself.

If you've had similar experiences, I hope this article helped even a little, and I'll end the article here. Thank you for reading.
