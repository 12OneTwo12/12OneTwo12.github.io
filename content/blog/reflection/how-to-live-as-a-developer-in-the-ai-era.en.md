---
title: "Toby's Meetup Report: 31-Year Developer's Message on How to Live as a Developer in the AI Era"
tags:
  - "ai"
  - "ai agent"
  - "toby"
  - "meetup"
date: '2025-07-11'
---

![](https://velog.velcdn.com/images/12onetwo12/post/5e2c0805-2c88-4ec3-a02b-a369511e7432/image.jpeg)

Yesterday (July 10), I attended a meetup titled [[31-Year Developer's Message on "How to Live as a Developer in the AI Era"]](https://www.inflearn.com/course/offline/31%EB%85%84%EC%B0%A8%EA%B0%9C%EB%B0%9C%EC%9E%90-ai%EC%8B%9C%EB%8C%80-%EC%A6%9D%EA%B0%95%EA%B0%9C%EB%B0%9C%EC%9E%90).

It was a lecture by Toby hosted by Inflearn, and it was time where I could gain knowledge about core competencies required of developers in the AI coding era and AI collaboration models.

![](https://velog.velcdn.com/images/12onetwo12/post/719aa44f-1ff1-47f0-b4b7-a2b6325de85b/image.png)

Toby is the author of "Toby's Spring" that anyone who has touched Spring has probably heard of at least once. These days he's also uploading lectures on Inflearn.

### 1. What Ability Is Essential for Developers in the AI Coding Era?

They say the AI coding era demands distinctly different competencies from the past. Toby emphasized that passive attitude of simply commanding AI and just waiting for results should be avoided.

The first competency he mentioned as important was **multitasking**.

I deeply agreed with the statement that while AI performs specific tasks, developers shouldn't spend that time just spacing out, but should use time efficiently by doing other work or thinking deeply.

Recently while I've been using AI tools, I found myself reflecting on whether there was time I spaced out after requesting specific work.

Also, I thought I should allocate time in a way where I request AI to create guide documents or develop according to API specs, and during that time I focus on higher-level architecture or planning.

Toby described now as the 'era of great AI confusion for developers'.

Especially the part where Toby honestly said "I honestly don't know well how developers should live in the AI era..." is most memorable.

![](https://velog.velcdn.com/images/12onetwo12/post/c06da691-0d16-44ae-b665-809655b2d29a/image.jpeg)

It seemed to show as is the confused situation now facing a new era. But simultaneously presenting clear direction made me think a lot.

The statement that developers are no longer a fixed profession but will become a **fluid concept** continuously newly defined together with AI resonated most. I'm simultaneously feeling a sense of crisis that I could be left behind if I don't continuously change and learn, and expectations that I can discover new opportunities.

### 2. AI Coding Spectrum: Autonomy Level 6 Stages (0~5)

He said understanding AI's autonomy levels is very important for establishing AI collaboration strategy.

* **Level 0: Static Tooling** (linter, formatter, etc.)
* **Level 1: Token-Level Completion** (IDE auto-completion)
* **Level 2: Block-Level Completion** (IntelliJ inline completion)
* **Level 3: Intent-Based Chat Agent** (ChatGPT, Gemini, etc.)
* **Level 4: Local Autonomous Agent**
* **Level 5: Fully Autonomous Dev Agent**

Especially he said **active utilization is recommended** up to level 2 because it doesn't greatly break development flow.

I'm already using IDE auto-completion and inline completion on a daily basis, but thinking that AI is getting smarter by collecting telemetry (suggestions, accept/reject logs) from IDE and advancing models, I thought I should try developing in ways that can utilize even up to level 2 stage more.

### 3. Human-AI Collaboration Model

They say collaboration between human developers and AI goes beyond the simple dichotomy of human-led or AI-led. I felt a lot in this part.

* **3.1. AI-in-the-Loop (AITL):** AI plays assistant role, human completely controls development process. (Corresponds to AI autonomy level 1~3)
* **3.2. Human-in-the-Loop (HITL):** AI leads development process, human verification and approval needed for major decisions. (Corresponds to AI autonomy level late 3~4)
* **3.3. Human-on-the-Loop (HOTL):** AI performs work autonomously, human plays supervisor role. (Corresponds to AI autonomy level 4~5)

Toby emphasized that efficient developers should become **'Mode Switchers'** who can flexibly switch collaboration models according to work nature and complexity.

I actually came to know such terms exist through this meetup. I haven't consciously thought which mode would be appropriate now, but there seems to have been parts I did instinctively.

**How much can I trust AI for the work?** seems to have unknowingly determined the mode for me.

Simple repetitive tasks were **HOTL** mode, when verification was needed **HITL** mode, for very important tasks, situations where AI can't be trusted were **AITL** mode.

Complex domains or tasks requiring subtle judgments like architecture are more familiar with me leading and utilizing AI as a tool. But I thought I should practice actively utilizing HOTL model to increase efficiency for simple and repetitive tasks in the future.

### 4. Architecture Design for Collaboration with AI

They say upper-level architecture and design decisions are still ideally controlled by human developers.

Especially he emphasized principles of **clear layer definition with separated concerns and responsibilities, using interfaces as contracts, decomposing work into small units and developing incrementally**. The point that humans must clearly record architecture design reasons and grounds was also impressive.

**4.1. Is Clean Code Important in AI Development Too?**
Yes, **'That's right!'** He said all principles and strategies for making code easy for humans to read, understand, and change are prerequisites for effective collaboration with AI. He emphasized that well-designed architecture provides the clearest guidance not just for humans but for AI too.

After all, I realized once again that keeping the basics is unchangingly important even in the AI era.

### 5. Renaissance of Test-Driven Development (TDD)

There was Toby's strong assertion that **you can't not do TDD** in the AI era. He said TDD is the most effective workflow and core framework for safely and productively utilizing autonomous agents of level 4 or higher.

**5.1. Why TDD Is Important for AI Collaboration**
* **Presenting clear success criteria:** AI retries if it doesn't pass tests.
* **Ultimate guardrail role:** It's a safety device preventing AI mistakes.
* **Perfect harmony with agent work loop:** Perfectly matches the process where AI generates and modifies code to pass tests.

![](https://velog.velcdn.com/images/12onetwo12/post/ac84b9e3-ae8d-4a4d-808e-c1b47d6c3e02/image.jpeg)

**5.2. AI-Assisted TDD Workflow (Claude Code Best Practices)**
Watching the workflow where humans create failing tests, AI implements code to pass them, then humans review and refactor, I realized how powerful synergy TDD can create with AI. Actually I hadn't been perfectly practicing TDD, but I took this opportunity to realize the importance of TDD again and try to actively introduce TDD together with AI.

### 6. Exploration and Exploitation Dilemma

He pointed out that many people only talk about how fast to develop with AI, namely **productivity**. But he said we need to understand **reinforcement learning's exploration and exploitation dilemma**. He said strategic approach is needed to balance immediate productivity pursuit and intentional effort for continuous learning and technology development.

**6.2. Vibe Coding and Productivity-First Approach**
He said vibe coding isn't simply about speed, but means fundamental change where developer's role changes to **product engineer, intent designer, creative director, prompter, guide** etc. He said it's important to reduce cognitive load on detailed implementation through AI and focus on higher-level 'intent specification'. I should also practice focusing on designing bigger pictures and intent while leaving implementation to AI in the future.

### 7. AI Utilization for Capability Enhancement and Learning

The point that AI can be utilized not just as productivity tool but as **learning catalyst** was also interesting though I knew it.

* **Understanding and analyzing complex code**
* **Learning new languages, technologies, APIs**

**7.1. Analyzing and Learning Existing Code with AI (e.g., Spring Framework 7.0)**
I was amazed watching examples of analyzing Spring source code with AI (Claude Code) and learning architecture, code quality, asynchronous technology usage methods etc. I thought I should try analyzing open source projects I'm interested in together with AI and creating guide documents based on results.

**7.2. Learning Reference Documents Using Web Browser Connection (MCP)**
**7.3. Gathering Learning Sources and Creating Various Learning Materials (Active Use of NotebookLM)**
The point that you can register various sources like purchased ebooks, websites, YouTube video texts etc. in NotebookLM to generate summaries, learning guides, mind maps etc. looked very useful. The method of gathering multiple materials, designating topics, and organizing concepts by comparing commonalities or differences was a learning method I really needed.

### 8. Deep Research Utilization

Using Deep Research function, when you designate research goals, content, result format, it generates reports with sources displayed through vast amounts of search and multiple stages of research direction resetting.

He mentioned it's attractive that you can request in-depth analysis even during meetings when there are topics needing investigation.

I've tried using it too but haven't used it actively, so I should actively utilize this function when analyzing complex technology trends or before introducing new technology in the future.

### 9. Meetup Page Content Creation Process (Speaker Toby's Case)

![](https://velog.velcdn.com/images/12onetwo12/post/82010850-4ef8-46bc-acef-8c369f99949a/image.png)


He shared Toby's case of how this meetup page content was created, and that process itself was a best practice of collaboration with AI.

1.  Write research prompts after organizing AI coding related topics.
2.  Perform in-depth exploration through ChatGPT, Gemini, Claude.
3.  Carefully read research results and check for hallucinations.
4.  Convert results to PDF and **register in NotebookLM**.
5.  Put existing meetup guide page content as **one-shot** into NotebookLM, and request "Please write as document the core content to present for 1 hour 20 minutes with content from 3 sources (AI in-depth exploration results) in this structure."
6.  Edit results and deliver to Inflearn.

Watching this process, I realized AI can be utilized throughout the entire process from information gathering-organization-planning-draft writing, beyond simply using it as a writing tool.

### 10. Most Important Attitude When Collaborating with AI: No 'Click-Click'!

Toby shouted **'No click-click!'** when collaborating with AI. He especially warned that the habit of unconditionally accepting AI suggestions at stages 3~5 is very bad. When AI generates code, he emphasized you 'must watch' this entire process of refining request content, what plans to solve problems with, what thoughts at each stage, and detailed explanations about code.

I deeply agreed with the statement that we're missing how much effective learning is possible while developing together with AI. The analogy that thinking of it as junior developer who only inputs code while ignoring all explanations when senior developer helps making code with detailed explanations next to them clearly resonated to understand its importance. I should also cultivate the attitude of examining AI explanations more carefully and learning by asking why it generated such code from now on.

### 11. Developer's Role in Exploratory AI Use

They say in exploratory AI use, developers should become **active learners** who critically evaluate explanations and code generated by AI and deepen understanding using AI functions. Should include questions of **'how' 'why'** not just 'what', and **ask about alternatives** besides already produced code to check why current method was chosen.

### 12. Securing Dedicated Time for Learning and Deliberate Practice

They say organizations and individual developers should **allocate specific time to use AI tools in exploration mode**. Should set challenging or unfamiliar areas as goals and actively utilize AI as learning partner.

**12.1. Deliberate Practice Needed**
They say learning effects can be maximized through **deliberate practice** like requesting AI to explain what you learned yesterday in retrieval learning method, requesting evaluation of my explanation. I thought this part is good tip I can apply right away personally.

### 13. Conclusion: Change to Augmented Developer

Toby concluded we should change to **'Augmented Developer'** who skillfully combines human intelligence and AI efficiency. He said it's important to choose optimal AI collaboration mode according to work nature and provide clear architecture and sustainable context for AI to demonstrate best performance.

Also importantly, he said **you must be responsible for final judgment on results generated by AI**. The message that you must know to be responsible, so you must continuously grow, and you can grow more efficiently utilizing AI greatly motivated me.

I could have such a good time being able to think about development methods and learning strategies based on insights gained from this meetup.

I was really lucky to be able to attend haha..
I know this meetup had 80 spots for first-come-first-served recruitment and sold out in 20-30 minutes. Fortunately I could attend as one of the 80. Random attendance meetups or conferences have fierce competition so I fell a lot 😢

I'll likewise leave records if I attend other conferences or meetups again. Thank you for reading.
