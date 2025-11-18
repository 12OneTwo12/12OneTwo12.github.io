---
title:
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
  Hello!&nbsp;<br class="hx:sm:block hx:hidden" />I'm Jeongil Jeong, Backend Developer
{{< /hextra/hero-headline >}}
</div>

<div class="hx:mb-12">
{{< hextra/hero-subtitle >}}
  {{< developer-experience lang="en" >}}
{{< /hextra/hero-subtitle >}}
</div>

<div class="hx:mt-16 hx:mb-6">
<h2 class="hx:text-2xl hx:font-bold">Main Sections</h2>
</div>

{{< hextra/feature-grid >}}
  {{< hextra/feature-card
    title="About Me"
    subtitle="Introducing my journey as a backend developer and tech stack"
    icon="user"
    link="about"
  >}}
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
{{< /hextra/feature-grid >}}

<div class="hx:mt-16 hx:mb-6">
  <h2 class="hx:text-2xl hx:font-bold">Recent Posts</h2>
</div>

{{< recent-posts limit=5 includeAll=true >}}

</div>
