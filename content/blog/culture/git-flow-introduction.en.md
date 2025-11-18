---
title: "Escaping Cherry-pick Hell: Junior Developers' PR-based Code Review and Git Flow Introduction Story"
tags:
  - "git"
  - "pr"
  - "code review"
  - "git flow"
  - "git strategy"
  - "cherry-pick"
date: '2024-12-10'
---

### Introduction
Hello. In this article, I'll share our experience of introducing **Pull Request (PR)-based code reviews and Git Flow** in a company where PRs didn't exist, in a chaotic local development environment.

At that time, our team worked by merging and pushing from each person's local, and all development was done on a single branch (dev), so **excessive cherry-picking** and resulting **conflicts** kept repeating.

I want to share the story of change created by junior developers like myself and colleagues to solve this.

---

### ❔ Why Did We Decide to Introduce It?

#### **Existing Work Method**
Before introduction, our team's branch structure and git strategy were as follows:

```
- prod(main): Branch reflected in production environment
- staging: Branch for testing in environment identical to production
- dev: Branch where all developers work and commit
```

This structure had its pros and cons as GitLab Flow approach, but our working method had problems.

- **Local-centric Merge**
  Since everyone merged and pushed from their local, when conflicts occurred, resolving them was entirely individual responsibility.
  Since each developer's local state was different, someone would face conflicts when fetching commits late.

- **All work concentrated on single dev branch**
  All work like feature development, bug fixes, hotfixes concentrated on one dev branch, making management difficult.
  It was hard to distinguish which features were completed and which were still incomplete.

- **Emergency deployment difficulty**
  When only specific features or urgent bugs needed deployment, we used Cherry-pick to bring only specific commits to staging and reflect them.
  Later, when merging dev branch back to staging, commits already entered through Cherry-pick and identical commits from dev caused conflicts.
  We had to resolve these conflicts every time, and it got increasingly complex.

---

#### **Cherry-pick Hell**
The problem especially occurred when **only specific commits** from code being worked on in **dev branch** needed to be reflected first in production environment (prod). When urgent bug fixes or specific features were needed, we used Cherry-pick, but this induced **repetitive conflict hell**.

**Why was Cherry-pick problematic?**
- **Incomplete reflection flow**:
  When reflecting only part of code committed to dev to staging through Cherry-pick, and merging staging to prod again, conflicts occurred when merge history between dev and staging didn't match.

- **Repetitive conflicts**:
  Later, when trying to merge dev branch to staging, commits already reflected in staging through Cherry-pick and identical commits from dev caused conflicts.

- **Work interruption**:
  Other work was interrupted in the process of resolving these conflicts, and consequently the workflow of **staging → prod** kept being hindered.

- **Increased management complexity**:
  As merge history became inconsistent between dev, staging, and prod, a vicious cycle of additional conflicts during subsequent work continued.

---

### Start of Persuasion: Centered on Cherry-pick Problem

#### **Difficulty of Persuasion**
My colleague and I proposed introducing **PR-based code review** and **Git Flow** to solve these problems. But not everyone welcomed this approach from the start.

- Team members:
  "It looks difficult because we've never done it."
  "Won't doing PR take longer?"
  "Isn't it working well enough as is?"

- Manager:
  "Looks like a waste of time."

In this response, we started persuading colleagues and manager centered on the Cherry-pick problem.

---

#### **Presenting Git Flow Strategy as Alternative**
I proceeded with persuasion based on conflict cases that had occurred due to Cherry-pick problems in the past.

- **Reproducing conflict cases**:
  I visually explained how easily the workflow between dev → staging → prod gets tangled by reproducing Cherry-pick conflict situations that had occurred previously.

- **Presenting Git Flow strategy as alternative**:
  Using Git Flow strategy, branch management is done systematically, and specific work can be reflected to staging without Cherry-pick. I also emphasized that possibility of conflicts can be removed in advance through review and testing before merge.

- **Time-saving effect**:
  I appealed that while Git Flow and PR introduction might be unfamiliar initially, it could reduce time spent on conflict resolution and improve workflow in the long term.

---

#### **Small Start: Test MR**
Since persuasion alone wasn't enough, I created test MR so team members could directly experience the change.

1. **Configuring test environment**:
   After working on simple features in dev branch, I conducted simulation of merging that feature to staging and prod in PR units.

2. **Comparison with existing method**:
   I showed how conflicts don't occur and workflow proceeds smoothly through PR method while comparing Cherry-pick method and PR method.

3. **Encouraging participation**:
   I encouraged team members to directly write PRs and request reviews, making them feel that PR writing and review aren't complicated.


![](https://velog.velcdn.com/images/12onetwo12/post/e28bbed8-4131-4b14-b886-bfaf4b889457/image.png)
(Test MR for persuasion at that time)

---

### 🌱 Actual Introduction of PR-based Code Review and Git Flow

#### **Git Flow Introduction**
Git Flow played an important role in organizing confusion between dev, staging, and prod.

```
- main (prod): Production environment
- staging: Test environment with conditions identical to production
- dev: Development integration branch
- feature/*: Feature unit work branches
- hotfix/*: Emergency fix work branches
```

- **Effects**:
    1. As feature development and merge stages separated clearly, specific work could be reflected to staging without Cherry-pick.
    2. As review and testing proceeded before merge, possibility of conflicts decreased significantly.
    3. Work history was managed clearly, making it easy to identify who did what.



#### **PR Code Review: Minimum Force, Maximum Autonomy**
We didn't forcibly introduce code review but designed it so team members could adapt without burden.

- **Reviewer designation method**:
  We reduced compulsion by allowing review requesters to designate reviewers themselves.

- **Introducing Pn rule**:
  We added Pn rule to control review intensity, making the review process a place for collaboration and learning.

```
P1: Please definitely reflect (Request changes)
P2: Please actively consider (Request changes)
P3: Please reflect if possible (Comment)
P4: Either reflect or pass (Approve)
P5: Just minor opinion (Approve)
```

We mainly got reviews like these:


![](https://velog.velcdn.com/images/12onetwo12/post/03119a0d-20e6-4c05-8e74-9f9f72669494/image.png)
**Asking questions**


![](https://velog.velcdn.com/images/12onetwo12/post/9e185383-0c74-4d50-9a35-51acd670dcfd/image.png)
**Giving praise**

![](https://velog.velcdn.com/images/12onetwo12/post/8f0aba3c-0156-48a9-ae75-6b221ca9402b/image.png)
**Checking if anything was missed**

---

### Changes and Feelings After Introduction

#### **Achievements After Introduction**
1. **Reduced conflict problems**:
   As we worked in PR units, Cherry-pick was no longer needed, and conflicts hardly occurred in the merge process from dev → staging → prod.

2. **Transparency of workflow**:
   Through Git Flow and PR, work history and changes were clearly recorded, increasing management efficiency.

3. **Collaboration culture establishment**:
   Code review became not just error detection but a place for collaboration and learning.
   Workers and reviewers communicated and discussed better code, and team's overall code quality improved.

---

### ✨ In Conclusion
PR-based code review and Git Flow were not simply about introducing tools, but a journey that changed the entire team's collaboration culture.

Trying something new is never easy. But our team members **started with small changes** and now have created development culture that the company can't do without.

I hope this experience gives a small hint to those considering similar situations. 😊
