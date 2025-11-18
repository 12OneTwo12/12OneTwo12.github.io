---
title: "3 Ways for Developers to Quickly Adapt to a New Company"
tags:
  - "daily"
date: '2025-09-30'
---


Hello.

I'm Jeongil Jeong, a 3rd-year backend developer working at a proptech platform.

Job changes are not easy for anyone. New codebase, unfamiliar team culture, unknown business domain... I was also at a loss when I joined a new company.

Today I want to share **how I adapted to the new company** and the methods I tried in that process.

Starting from the second day after joining, I began updating onboarding documents bit by bit, drew system architecture within a week, and built a monitoring system in 1.5 months.

Of course, not because I had special abilities, but I think it's the result of trying little by little while experiencing trial and error.

---

## First Day Choice: Consumer or Producer?

On the first day at a new company, everyone opens the office door with both tension and excitement. I was no different.

I joined a new team in March 2025, and it's already been 6 months now since it's September.

The documents the onboarding manager handed me when I joined were as follows:
- Company introduction
- Backend onboarding guide
- Tech stack document
- Development environment setup guide

While reading onboarding documents, I had these thoughts:

"Oh, this part isn't updated?"
"When was this technology added? It's not in the documents..."
"It would be nice to have a diagram showing the entire system structure at a glance"

**The onboarding documents weren't perfect.** But this is natural. Documents always lag behind code, and can't contain everything.

Here I faced two choices:

1. **Remaining as consumer**: Reading documents and asking directly about insufficient parts
2. **Converting to producer**: Learning while adding what I learned to documents

I chose option 2.

---

## Strategy 1: Directly Improving Onboarding Documents - From Consumer to Producer

### The Day After Joining, First PR

On joining day, I took notes of things I found while reading onboarding documents. And the next day, I submitted my first PR.

```markdown
# Added content
- Tech Stack: Spring Boot, Kotlin, MySQL, Redis, ...
- Infrastructure: AWS, GCP (using in parallel)
- Monitoring: Using AWS CloudWatch
```

"Submitting PR the day after joining?" It might feel burdensome, but I hesitated at first too. But approaching this way was more natural than expected:

- "This part is wrong" (X)
- "I looked into this part because I was curious, is my understanding correct?" (O)

Onboarding document improvement was **a contribution you can start relatively safely**.
- Don't have to directly touch code
- Mistakes don't become big problems
- Can help the team
- Process of organizing what I learned

### Small but Steady

For a few weeks after joining, I improved documents little by little every day:

- March 11: Added Tech Stack
- March 12: Added AWS Lambda
- March 14: Added DDD design related content (aggregate vs domain service)

For me, **'tidying' of what I currently understand** was more important than 'perfection'. I added what I learned to documents even if just one line per day.

### Good Points About Doing This

1. **Fast learning**: Learning while "writing" rather than just "reading" documents made understanding faster
2. **Active attitude**: When asking questions, it changed from "what's this?" to "I understood it this way, is it correct?"
3. **Contributing to team**: Made next new developer's onboarding a bit easier
4. **Gaining trust**: I think I could make a good impression on team members

---

## Strategy 2: Drawing to Understand - Understanding System Through Diagrams

### One Week After Joining, Still at a Loss

One week after joining, I still hadn't fully grasped the entire system structure. This is actually natural. It's hard to understand the overall flow of an operating service in just one week.

- "Does legacy service also call MSA?"
- "Which services consume AWS SQS and publish events?"
- "How is Elastic Search being used?"

Understanding came piece by piece while looking at code, but the overall picture wasn't drawn.

So I tried: **"Let's draw it myself."**

### Struggle with Draw.io

On weekend, I opened Draw.io and started drawing the system as I understood it.

```
[Client] → [API Gateway] → [User Service] → [MySQL]
                         → [Match Service] → [Redis]
                         → [Payment Service] → [External PG API]
```

I started simply. And added one by one:
- Communication methods between services (REST API)
- Database connections
- External API integrations
- Message queues (SQS)

**I asked questions where stuck, and when I heard answers, I reflected them back in the diagram.**

### Verification Process

And I submitted a PR adding system architecture.

> "This PR's items are as follows!
>
> - Added backend system architecture
>
> If there are any corrections needed or improvements, please let me know!
> Thank you for reviewing! 😊"

Not trying to create perfect diagrams, but **using them as means to share what I understood and receive feedback**.

### Good Points About Doing This

1. **Understanding entire system**: The overall structure naturally got drawn in my head during drawing process
2. **Specific questions**: Could ask specifically like "are A and B connected like this?" rather than "how does this part work?"
3. **Team reaction**: It seems it was needed since the team didn't have diagrams
4. **Living document**: Could continue updating whenever system changed thereafter

Actually in April after building monitoring system, I added Metrics server to diagram, and in August when new services were added, I continued updating.

---

## Strategy 3: Finding What You Can Quickly Contribute

Improving onboarding documents and drawing system architecture is good, but I thought it would be better if I could create **something actually helpful to the team**.

### Identifying Team Pain Points

During first few weeks after joining, I took notes of keywords repeatedly appearing in meetings and daily conversations:

- "If there's a failure now, we can't know until CS comes..."
- "Checking logs takes too long"

**It was a signal that monitoring system needed improvement**.

### Finding What I Can Do

As a 3rd-year developer, I can't do everything well. But I could find **what I can relatively try**.

In my case:
- Have some infrastructure/DevOps experience
- Have experience building Grafana, Loki, Tempo, Prometheus stack
- Have Kubernetes operation experience (this later led to Kubernetes construction and introduction)
- Don't know company business logic yet

**"What I can quickly contribute to seems to be monitoring system improvement"**

### 1.5 Months After Joining, Building Monitoring System

Joined in March and built monitoring system in April:
- Built integrated observability with OpenTelemetry
- Configured Prometheus, Loki, Tempo, Grafana stack
- Collected consistent metrics for all services

This process was covered in detail in [previous blog post (Service Failures Should Be Known Without Users Telling - In-house Monitoring System Construction Story)](https://velog.io/write?id=079c21d1-e969-4526-8be4-e6c918ada224).

### Collaboration Culture Improvement

Not just monitoring, but also improved other pain points felt during onboarding:

**Git Strategy Introduction and Document Addition** (April 2)
- Git Flow introduction and branch strategy documentation
- Git commit convention
- Branch strategy
- PR rules
- **Added Issue/PR templates** (Established collaboration standards)

**Added PR Auto Code Review, Test Coverage** (April 4)
- Jacoco, dekekt, review dog
- CI/CD environment construction guide
- Self-hosted Runner guide

**Added Backend Improvement Tasks** (August)
- Organized technical debt and improvement tasks team needs to solve

### Good Points About Doing This

1. **Fast trust acquisition**: Team members seemed to trust me
2. **Clear role**: My strengths and role in team gradually became clear
3. **Sense of achievement**: There was satisfaction of creating something actually helpful to team
4. **Learning opportunity**: Could gain experience in actual production environment

---

## Practical Tips: Things You Can Try Right Now

I was also vague at first, but trying this way was helpful.

### 1. First Week: Taking Notes and Organizing

```markdown
# My Onboarding Notes (First Week)

## Curious Things
- [ ] Does legacy service also call MSA?
- [ ] Which services consume AWS SQS and publish events?
- [x] How is Elastic Search being used?

## Documents That Would Be Good to Add
- AWS Lambda usage (not in current documents)
- Environment variable setting guide

## Improvement Ideas
- Git commit message convention isn't clear
- PR template would be nice
```

Take notes and add what you organized to documents every day.

### 2. First Month: Drawing

Draw to understand system:

**Start from simple version**
```
[Client] → [Backend] → [DB]
```

**Gradually expand**
```
[Client]
  ↓
[API Gateway]
  ↓
[Service A] → [DB A]
[Service B] → [DB B]
  ↓
[External API]
```

**Tool recommendations:**
- Draw.io (free, web-based)
- Excalidraw (hand-drawn style)
- Mermaid (drawing diagrams with code)

### 3. Second Month: Quick Contribution

Identify team's pain points and find what you can quickly solve.

**Checklist:**
- [ ] What are frequent inconveniences in team?
- [ ] Among them, what can I solve?
- [ ] Can I start small?
- [ ] Does it align with team priorities?

**Examples:**
- Automation script for repetitive tasks
- Documentation (especially documenting tacit knowledge)
- Development environment improvement
- Adding test code
- Code review improvement (review guide, checklist)

---

## In Conclusion

Many developers seem to sometimes think of team adaptation as a problem of **"how the company helps me"**. Of course it's important that the company provides good onboarding programs, but

**"Quick adaptation isn't enough with just company support. My active attitude is also needed."**

- If documents are insufficient? → I try adding little by little
- If system is complex? → I try drawing it
- If team has problems? → I try finding what I can solve

Approaching onboarding this way:
1. I could adapt relatively quickly
2. Could help team even a little
3. Could naturally gain trust
4. Above all, could grow

I think documents like code should continuously evolve and improve. And that improvement seems to be something everyone from newcomers to seniors does together.

If you also join next company, how about submitting PR if you find points that would be good to add to onboarding documents.

**"I don't think first PR necessarily needs to be bug fix. Document improvement is also sufficient contribution as first step. haha"**

I hope this article helps developers adapting to new environments even a little, and I'll end the article here.

Thank you for reading this long article.
