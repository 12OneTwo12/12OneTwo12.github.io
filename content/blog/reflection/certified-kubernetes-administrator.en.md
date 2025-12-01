---
title: My Journey to Passing the CKA (Certified Kubernetes Administrator) Exam
tags:
  - "kubernetes"
  - "certified"
  - "cka"
date: '2025-12-01'
---

## Introduction

Hi, I'm Jeongil Jeong, a backend developer with 3 years of experience, currently working at a proptech platform.

Containerization has become increasingly important in modern web server deployment.

In the past, it was common to install and operate web servers like Tomcat directly on virtual machines or on-premises servers. However, with the emergence of containers, many companies have started deploying through containerization.

Running web servers directly on servers had so many inconveniences. Containers are attractive because they're lightweight, deploy quickly, and provide a consistent environment.

As more companies adopted container-based deployments, the need for container orchestration tools emerged. Among these tools, **Kubernetes** has become one of the most widely used.

I also wanted to learn more about Kubernetes while building, deploying, and operating it. That's why I decided to pursue the **Certified Kubernetes Administrator (CKA)** certification, and I'd like to share my experience.

## My Journey with Kubernetes

If someone asks me "Why did you get the CKA certification?", I'd need to start by explaining my journey with Kubernetes.

When I worked at my previous company, the infrastructure was already running on Kubernetes. At that time, I was focused on application development as a backend developer, and all infrastructure-related work was handled by the company's only DevOps engineer.

I used tools like Jenkins, ArgoCD, ELK, Prometheus, and Grafana for monitoring and deployment, but I didn't really understand how the infrastructure was configured, what technologies were involved, or how Kubernetes actually worked.

Then the DevOps engineer decided to leave the company. A month before leaving, he proposed to the management: "If you hire a new DevOps engineer, I'll train them for a month before I go." However, the company couldn't hire anyone new at that time.

The DevOps engineer said he would at least leave documentation, but I thought that wouldn't be enough. I didn't know when a new DevOps engineer would be hired, and if something went wrong with the infrastructure in the meantime, someone would need to fix it.

So I approached the DevOps engineer and carefully asked:

>"If you don't mind, could you teach me a bit about the company's infrastructure? If something happens to the servers while we don't have a DevOps engineer, someone will need to handle it... I know it's asking a lot, but if you could share some knowledge, I'll do my best to manage with what I learn."

He was kind enough to mentor and train me for a month, and thanks to him, I learned about **Kubernetes, AWS EKS, Jenkins, ArgoCD, and ELK**. I ended up managing the infrastructure alone for about 7 months until the next DevOps engineer was hired.

> Honestly, a month of mentoring wasn't enough to learn everything. I wrote down every infrastructure-related keyword he mentioned and studied each one on my own.

Looking back, it was quite a reckless challenge. During those 7 months, I somehow managed to resolve several incidents, and there were times when I had to privately contact the former DevOps engineer for SOS.

But thanks to that experience, I learned so much. It was one of the luckiest opportunities in my career, especially since I had never had infrastructure access before, like at most companies.

## Building Kubernetes with My Own Hands

Later, I joined my current company. When I first joined, all MSA web servers were deployed and operated on a single instance in a monolithic architecture environment.

You might wonder, "MSA on a single instance?" Since the company was a startup, they chose that structure for cost savings.

However, when we were selected for GCP's startup credit program (offering one year of credits), I proposed migrating the infrastructure to GCP and introducing Kubernetes.

Fortunately, the company positively reviewed the proposal, and I, having Kubernetes operation experience, was tasked with building and designing the Kubernetes infrastructure.

I managed to set up a GKE-based Managed Kubernetes and successfully completed a zero-downtime migration. You can read about the Kubernetes setup process here: [**From No Dev Server to GitOps: Our Kubernetes Journey from Scratch**]({{< relref "/blog/infrastructure/docker-compose-to-k8s" >}})

## So Why CKA?

Getting back to the point, let me explain why I decided to get the CKA certification.

While operating and building Kubernetes, I wanted to validate my knowledge. I also thought that the validation process would help me study Kubernetes more deeply.

So I looked into Kubernetes-related certifications and found that the **Certified Kubernetes Administrator (CKA)** is the most well-known and credible certification.

Once I learned about it, I didn't hesitate long. I decided to go for the CKA during the Black Friday discount period.

CKA is quite expensive—before February 2025, it cost $395 (about 500,000 KRW), but after February 4th, it increased to $445 (over 600,000 KRW).

The price is really steep, so I strongly recommend taking the exam during Black Friday or when you have a voucher. Once you purchase it, you can take the exam anytime within a year, and even if you fail once, you get one free retake. So it's best to buy during sales, study, and then take the exam.

I purchased during Black Friday with a 50% discount, so I got it for half price. Even half price isn't cheap, though. Also, consider that you need to retake the exam every 2 years to maintain the certification.

## Exam Preparation

The CKA exam is available online and lasts 2 hours. It's hands-on, meaning you need to enter commands to perform specific tasks, such as checking application logs in a specific namespace or creating/deleting resources.

For exam preparation, I used the following resources. Since many others have already written detailed guides about exam questions and preparation methods, I'll just share the materials I used:

- [Udemy: Certified Kubernetes Administrator with Practice Tests](https://udemy.com/course/certified-kubernetes-administrator-with-practice-tests)
  - This is the famous Mumshad course. It's so well-known that many of you have probably already taken it, so I won't write a detailed review. However, the course is excellent, and I strongly recommend it for anyone preparing for CKA.
- [2025 CKA Exam Preparation Core Summary - by Naegiroku](https://sunrise-min.tistory.com/entry/2025-CKA-%EC%8B%9C%ED%97%98-%EC%A4%80%EB%B9%84-%ED%95%B5%EC%8B%AC-%EC%9A%94%EC%95%BD)
  - The CKA format changed in 2025, and this post is well-organized for the new format.
- [[CKA] CKA Exam 2025 Problem-Solving Summary 1 - hyunlulu](https://hyunlulu.tistory.com/entry/CKA-CKA-exam-2025-question-%EB%AC%B8%EC%A0%9C%ED%92%80%EC%9D%B4-%EC%A0%95%EB%A6%AC)
  - This is a problem-solving guide. It helped me understand the types of questions. There's also a part 2, so check it out as well.

My preparation took about a month. Although I had some Kubernetes knowledge, I couldn't dedicate much time to studying due to work commitments, so it took longer than expected. If you're starting from scratch with no Kubernetes experience, I'd recommend allocating 2-3 months.

## Exam Results and Honest Review

![cka-result](https://www.dropbox.com/scl/fi/qk0up2fv3zd3m887zh3r4/cka-result.png?rlkey=svogl1ge9tesbqqi7lt41caem&st=nrcmpmw0&raw=1)

Let me start with the results: I passed with **76 points** (passing score: 66 points).

Honestly, I expected to score higher, but the score was lower than I anticipated. After the exam, I spent some time thinking about why the score was so low, and in retrospect, the reason was clear.

**I only knew half of Kubernetes from my work experience.**

At my previous company, I used AWS EKS, and at my current company, I use GKE. In these Managed Kubernetes environments, **you rarely touch the Control Plane directly.** Google or AWS manages it for you.

So what I mainly dealt with in production:
- **Application Level**: Deployment, Pod, Service, Ingress, ConfigMap, Secret, etc.
- Application deployment, scaling, log checking, simple troubleshooting

On the other hand, what the CKA exam requires:
- **Infrastructure Level**: ETCD backup/restore, understanding Control Plane components, Static Pods, node management, CNI networking (like Calico), etc.
- Ability to build and manage clusters themselves

What I realized during the exam was: **"Ah, I'm comfortable running applications on Kubernetes, but I don't really know how to manage Kubernetes itself."**

For example:
- ETCD backup/restore: Never done in production (managed service handles it)
- Static Pod: Only knew the concept, just checked logs in practice
- Control Plane component troubleshooting: Never had to touch apiserver, scheduler, controller-manager
- CNI network configuration: GKE just handled it automatically

My high scores on Mock Exams were because I got familiar with the patterns through repetition. In the real exam, I panicked when these "unknown areas" came up.

But **this process was truly valuable.**

Preparing for CKA was the first time I understood Kubernetes "holistically." While Managed services are convenient, not knowing the internal workings has its limitations.

During exam preparation, I learned:
- "Oh, this is how kubelet works"
- "This is how Control Plane components communicate"
- "ETCD plays such a crucial role"

Now when incidents occur, I have a sense of where to start looking.

![cka-percent](https://www.dropbox.com/scl/fi/qcdxgfokoqygxhycvmxy9/cka-percent.png?rlkey=i8klrn347rv7usgbltmpyfloh&st=3ffx8m2n&raw=1)

The exam distribution is as shown above. I found the **Troubleshooting section** particularly valuable, as solving these problems requires understanding Kubernetes' internal workings.

Even after the exam ended, I found myself thinking, "Wait, why does this part work this way?" and looking things up. It sparked a genuine desire to keep learning more.

I believe CKA isn't just a certification—it's **a catalyst for truly understanding Kubernetes**.

## Would I Recommend CKA?

**I personally recommend getting the CKA certification.**

I especially **strongly recommend it for those who, like me, have only used Managed Kubernetes**. If you're good at deploying applications in production but don't know much about Kubernetes internals, you'll learn a lot while preparing for CKA.

The value of CKA isn't the "certificate" itself—it's that **the preparation process forces you to study areas you haven't dealt with in production.**

Since the exam is hands-on, you don't just memorize theory but actually practice commands in a terminal, which really helps with learning.

Most certifications involve memorizing dump questions, so people often just focus on "getting certified." But CKA's preparation process itself is the learning experience.

Honestly, **I'm not sure if CKA is highly valued in the job market.** I haven't tried job hunting with CKA yet. And even if I did, it probably wouldn't be rated that highly.

However, for those who want to properly study Kubernetes, especially those who've only used Managed environments, I recommend **the CKA preparation process itself.**

## Exam Preparation Tips

Even though I said the CKA preparation process is more valuable than the certificate itself, since you're paying good money for it, you should definitely try to pass, right?

Here are some tips for those preparing for the exam:

First, **don't just memorize—study to truly understand Kubernetes.** For example, you should be able to answer conceptual questions like "What is the role of Kubelet?" or "What is etcd?" in your head.

Also, you should be able to clearly answer questions like "Who manages Static Pods?", "What's the difference between Ingress and Service?", and "What are PVC and PV respectively?"

Second, **I strongly recommend solving the Mock Exams and Lightning Lab in the Udemy course multiple times.** The problem types are very similar, and the course includes solutions for each problem, which helps you identify what you know and don't know.

I solved the Lightning Lab 3 times and each Mock Exam 4 times. I also went through all of them once more right before the actual exam.

However, **don't get complacent just because your Mock Exam scores are high.** Like me, you might score high just from getting familiar with patterns. In the real exam, you might encounter variations or new situations, so it's more important to understand **"why you solve it this way"** rather than just solving problems.

When you purchase CKA, you get access to killer.sh twice, which provides simulation tests in an environment similar to the actual exam. The difficulty is much harder than the actual exam, so I recommend trying it at least once before the exam.

Use it more for getting familiar with the exam environment rather than solving problems. The exam environment is much less convenient than Mock Exams.

Third, I strongly recommend reviewing the practice problems from the blogs I mentioned above before taking the exam. Since the problem types are similar, reviewing practice problems helps you understand what types of questions might appear.

## Conclusion

That wraps up my Certified Kubernetes Administrator (CKA) certification experience.

A score of 76 isn't particularly high, but through this process, I learned the half of Kubernetes I didn't know. I thought I "knew Kubernetes" from using Managed Kubernetes, but I only knew the Application level, not the Infrastructure level.

Through CKA preparation, I gained a "holistic" understanding of Kubernetes, and now I have a sense of where to start when incidents occur.

If you want to study Kubernetes more deeply, especially if you've only used Managed environments, I recommend getting the CKA certification. However, since it's expensive, I recommend taking it during Black Friday or when you have a voucher.

I'll continue studying Kubernetes more deeply and writing related posts. Thank you for reading this long post!

![cka-certificate](https://www.dropbox.com/scl/fi/j3zovsvpuz7d60wok1rz2/jeongil-jeong-4e19e861-4428-4d91-8ab1-fd0beda3aaed-certificate.jpg?rlkey=qta1xivk3ygsf0v2egp7slulo&st=kjr6kgqx&raw=1)
