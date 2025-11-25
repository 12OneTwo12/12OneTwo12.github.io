---
title:
layout: hextra-home
---

<main class="home-wrapper" style="padding-left: max(4rem, env(safe-area-inset-left)); padding-right: max(4rem, env(safe-area-inset-right));">


{{< hextra/hero-badge >}}
  <div class="hx:w-2 hx:h-2 hx:rounded-full hx:bg-primary-400"></div>
  <span id="developer-experience-main"></span>
{{< /hextra/hero-badge >}}

<div class="hx:mt-8 hx:mb-2">
{{< hextra/hero-headline >}}
  Hello!&nbsp;<br class="hx:sm:block hx:hidden" />I'm Jeongil Jeong, Backend Developer
{{< /hextra/hero-headline >}}
</div>

<div class="hx:mb-12">
{{< hextra/hero-subtitle >}}
  Sharing my development journey through honest documentation of challenges faced, solutions found, and lessons learned. Thank you for visiting.
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

    const text = `${years} years, ${months} months, ${daysLeft} days, ${hoursLeft}h ${minutesLeft}m ${secondsLeft}s of experience`;

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
<h2 class="hx:text-2xl hx:font-bold">Main Sections</h2>
</div>

{{< hextra/feature-grid >}}
  {{< hextra/feature-card
    title="Blog"
    subtitle="Recording problems I've encountered, solutions, and learning experiences"
    icon="pencil"
    link="blog"
  >}}
  {{< hextra/feature-card
    title="Documentation"
    subtitle="Documenting development rules and references"
    icon="book-open"
    link="docs"
  >}}
  {{< hextra/feature-card
  title="About Me"
  subtitle="Introducing my journey as a backend developer and tech stack"
  icon="user"
  link="about"
  >}}
{{< /hextra/feature-grid >}}

<div class="hx:mt-16 hx:mb-6">
  <h2 class="hx:text-2xl hx:font-bold">Recent Posts</h2>
</div>

{{< recent-posts limit=5 includeAll=true >}}

</main>
