---
title: Jeongil-Jeong's Tech Blog
layout: hextra-home
---

<div class="home-wrapper" style="padding-left: max(4rem, env(safe-area-inset-left)); padding-right: max(4rem, env(safe-area-inset-right));">

{{< hextra/hero-badge >}}
  <div class="hx:w-2 hx:h-2 hx:rounded-full hx:bg-primary-400"></div>
  <span id="developer-experience-main"></span>
{{< /hextra/hero-badge >}}

<div class="hx:mt-8 hx:mb-2">
{{< hextra/hero-headline >}}
  안녕하세요!&nbsp;<br class="hx:sm:block hx:hidden" /> 백엔드 개발자 정정일입니다
{{< /hextra/hero-headline >}}
</div>

<div class="hx:mb-12">
{{< hextra/hero-subtitle >}}
  개발하며 겪은 시행착오, 문제 해결 과정, 그리고 배움을 솔직하게 기록하는 기술 블로그입니다. 방문해주셔서 감사합니다.
{{< /hextra/hero-subtitle >}}
</div>

<script>
(function() {
  const startDate = new Date('2023-03-06T10:00:00+09:00');

  function updateExperience() {
    const now = new Date();
    const diff = now - startDate;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const years = Math.floor(days / 365);
    const remainingDays = days % 365;
    const months = Math.floor(remainingDays / 30);
    const daysLeft = remainingDays % 30;

    const hoursLeft = hours % 24;
    const minutesLeft = minutes % 60;
    const secondsLeft = seconds % 60;

    const text = `개발 경력 ${years}년 ${months}개월 ${daysLeft}일 ${hoursLeft}시간 ${minutesLeft}분 ${secondsLeft}초`;

    const el = document.getElementById('developer-experience-main');
    if (el) {
      el.textContent = text;
    }
  }

  updateExperience();
  setInterval(updateExperience, 1000);
})();
</script>

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
    subtitle="개발할 때 지키는 규칙들과 레퍼런스를 정리합니다"
    icon="book-open"
    link="docs"
  >}}
{{< /hextra/feature-grid >}}

<div class="hx:mt-16 hx:mb-6">
  <h2 class="hx:text-2xl hx:font-bold">최신 글</h2>
</div>

{{< recent-posts limit=5 includeAll=true >}}

</div>
