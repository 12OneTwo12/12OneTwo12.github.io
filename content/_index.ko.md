---
title: Jeongil-Jeong's Tech Blog
layout: hextra-home
---

<div class="home-wrapper" style="padding-left: max(4rem, env(safe-area-inset-left)); padding-right: max(4rem, env(safe-area-inset-right));">

{{< hextra/hero-badge >}}
  <div class="hx:w-2 hx:h-2 hx:rounded-full hx:bg-primary-400"></div>
  <span>Tech Blog</span>
  {{< icon name="book-open" attributes="height=14" >}}
{{< /hextra/hero-badge >}}

<div class="hx:mt-8 hx:mb-8">
{{< hextra/hero-headline >}}
  안녕하세요!&nbsp;<br class="hx:sm:block hx:hidden" />백엔드 개발자 정정일입니다
{{< /hextra/hero-headline >}}
</div>

<div class="hx:mb-12">
{{< hextra/hero-subtitle >}}
  개발자로서의 성장과 배움을 기록하는 공간입니다
{{< /hextra/hero-subtitle >}}
</div>

<div class="hx:mt-16 hx:mb-6">
<h2 class="hx:text-2xl hx:font-bold">최신 글</h2>
</div>

{{< recent-posts limit=5 >}}

<div class="hx:mt-16 hx:mb-6">
<h2 class="hx:text-2xl hx:font-bold">주요 섹션</h2>
</div>

{{< hextra/feature-grid >}}
  {{< hextra/feature-card
    title="About Me"
    subtitle="백엔드 개발자로서의 여정과 기술 스택을 소개합니다"
    icon="user"
    link="about"
  >}}
  {{< hextra/feature-card
    title="Blog"
    subtitle="개발하면서 겪은 문제들과 해결 과정, 학습한 내용을 기록합니다"
    icon="pencil"
    link="blog"
  >}}
  {{< hextra/feature-card
    title="Documentation"
    subtitle="개발할 때 지키는 원칙과 컨벤션, 인프라 구성 방법을 정리합니다"
    icon="book-open"
    link="docs"
  >}}
{{< /hextra/feature-grid >}}

<div class="hx:mt-16 hx:mb-6">
<h2 class="hx:text-2xl hx:font-bold">주요 토픽</h2>
</div>

{{< hextra/feature-grid >}}
  {{< hextra/feature-card
    title="Backend Development"
    subtitle="Spring Boot, Kotlin, JPA, QueryDSL을 활용한 백엔드 개발"
    icon="code"
    link="blog"
  >}}
  {{< hextra/feature-card
    title="Architecture"
    subtitle="MSA, DDD, Clean Architecture, SOLID 원칙"
    icon="cube"
    link="blog"
  >}}
  {{< hextra/feature-card
    title="Infrastructure"
    subtitle="Kubernetes, Docker, CI/CD, ArgoCD, GitHub Actions"
    icon="server"
    link="docs/infrastructure"
  >}}
  {{< hextra/feature-card
    title="Database"
    subtitle="PostgreSQL, MySQL, Redis, Soft Delete, Audit Trail"
    icon="database"
    link="blog"
  >}}
  {{< hextra/feature-card
    title="Testing"
    subtitle="TDD, Given-When-Then, 단위/통합 테스트"
    icon="beaker"
    link="blog"
  >}}
  {{< hextra/feature-card
    title="API Design"
    subtitle="RESTful API, HTTP 상태 코드, DTO 패턴"
    icon="globe"
    link="blog"
  >}}
{{< /hextra/feature-grid >}}

</div>
