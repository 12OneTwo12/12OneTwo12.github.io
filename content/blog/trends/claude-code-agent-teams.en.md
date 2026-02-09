---
title: "The Ever-Changing AI Coding Agent Ecosystem: oh-my-opencode, oh-my-claudecode, OpenClaw, Agent Teams"
tags:
  - "ai"
  - "claude-code"
  - "agent-teams"
  - "oh-my-opencode"
  - "oh-my-claudecode"
  - "multi-agent"
  - "anthropic"
  - "openclaw"
date: '2026-02-09'
---

Hello. I'm Jeongil Jeong, a 3rd-year backend developer working at a proptech platform.

The AI coding tool ecosystem has been changing incredibly fast lately. A tool that was trending a few days ago gets blocked the next week, then ships as an official feature the week after... It's been a rollercoaster of a month.

In this post, I'll walk through the timeline of how a community tool called **oh-my-opencode** rose to popularity, how Anthropic blocked it, and how **Agent Teams** eventually launched as an official feature.

I've been watching this unfold and have quite a few thoughts of my own, which I'll weave in along the way.

## Background: Claude Code's Sub-Agents

Before diving into the main story, let me briefly cover the background.

Since mid-2025, Anthropic's Claude Code had a feature called **Sub-Agents**. Within a single Claude Code session, you could delegate specific tasks to a separate agent and just receive the results back.

For example, there was an **Explore** agent for searching the codebase, a **Plan** agent for creating implementation plans, and you could define custom agents by creating markdown files in the `.claude/agents/` directory.

But Sub-Agents had limitations. They only worked **within a single session**, couldn't communicate with each other, and could only report results back to the main agent. They weren't enough for having multiple agents **collaborate in parallel** on complex tasks.

**"What if multiple AI agents could work on different tasks simultaneously while communicating with each other?"**

Developers who had this need started building their own solutions.

## Community Innovation: oh-my-opencode

### OpenCode and oh-my-opencode

[OpenCode](https://github.com/anomalyco/opencode) is an open-source AI coding agent created by the SST team. Similar to Anthropic's Claude Code, its key differentiator was being **provider-agnostic** — you could freely use Claude, OpenAI, Google, or even local models. It gained massive popularity with over 100,000 GitHub stars.

On top of this, Korean developer **Yeongyu Kim (code-yeongyu)** created a plugin called [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode). Just as oh-my-zsh enhances the Zsh shell, oh-my-opencode added **multi-agent orchestration** to OpenCode.

**Key features of oh-my-opencode** included:
- Multi-model agent orchestration
- Parallel background agents
- LSP/AST tool integration
- Specialized agents (Oracle, Librarian, Frontend Engineer, etc.)
- Parallel execution via "Ultrawork" mode

Yeongyu Kim reportedly spent **$24,000 (approximately 34 million KRW)** worth of tokens researching the optimal multi-agent structure.

### Why Did It Become So Popular?

The core reason was the **economic structure**.

Claude Max subscriptions ($100–200/month) offered 5x–20x higher usage limits compared to Pro, but could only be used through the official Claude Code CLI. Equivalent API usage could cost thousands of dollars. I saw cases where monthly costs exceeded $3,650 in actual testing.

With the OpenCode + oh-my-opencode combo, developers could burn through their Claude Max subscription limits much more aggressively. Running autonomous agents overnight for coding/testing/fixing loops was entirely possible.

Think of it like **having the speed limit removed at a buffet**. Anthropic was offering an "all-you-can-eat" buffet but limiting eating speed through the official CLI — and third-party tools removed that speed limit.

When I tried it myself, I found it remarkably convenient — I could leverage multi-agent capabilities without any special setup.

However, it consumed tokens way too quickly, so I stopped using it fairly soon. I'm on a Max 20x subscription, but a single query would hit the current session token limit.

I even reached out to Anthropic support about it.

![](https://www.dropbox.com/scl/fi/qy9n2v19lqo4d5gsifz59/03ED9941-21BF-414C-A7B9-66AF1F49FE65.jpg?rlkey=swq9dkrbvlbjh2sf5kt8urlh7&st=kb1lvzh3&raw=1)

>... Although, we currently don't have a tool to investigate usage specifically, I see that your usage significantly increased on 2026-01-06 and 2026-01-04. We do encourage you to review our Usage Limits Best Practices documentation if you haven't already as this outlines strategies to help optimize your usage and get the most out of your subscription.

They confirmed that my usage had spiked on January 4th and 6th — the days I'd been trying oh-my-opencode. They also suggested checking the usage optimization guide.

I wasn't the only one experiencing this excessive token consumption. On [GitHub Issue #115](https://github.com/code-yeongyu/oh-my-opencode/issues/115), there were multiple reports like *"switching to API burns $15–20 in 30 minutes"* and *"hit the rate limit so quickly I stopped using it."* The maintainer acknowledged the problem and committed to adding task queue limits.

### oh-my-claudecode: Multi-Agent for Claude Code

While oh-my-opencode was built on OpenCode, [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) was a separate project built **specifically for Claude Code**. Originally named "oh-my-claude-sisyphus," it was rebranded to oh-my-claudecode in v3.0.0. Agent names also changed from Greek mythology references to intuitive ones (planner, architect, critic, etc.).

**oh-my-claudecode's key features** were impressive:
- 7 execution modes: Autopilot, Ultrawork, Ralph, Ultrapilot (3–5x parallel), Ecomode, Swarm, Pipeline
- 32 specialized agents and 40+ skills
- Built on Claude Code's native Hooks (shell scripts) to avoid ToS violations

The **Ultrapilot mode** in particular could run 3–5 agents in parallel, dramatically speeding up work. Before Agent Teams arrived, this was the most powerful way to use multi-agent capabilities with Claude Code.

Community-built multi-agent tools were thriving. Watching these tools, I thought, "So many developers are thinking about how to better leverage AI."

## Anthropic's Response: The Block

### January 5, 2026 — First Ban Report

The first signal came from [GitHub Issue #6930](https://github.com/anomalyco/opencode/issues/6930). A user reported being **banned for ToS violation** after using Anthropic OAuth with OpenCode.

The user had just upgraded from Claude Max 5x to Max 20x when the review was triggered. After contacting an Anthropic engineer on Twitter, they were told that using a Claude subscription through OpenCode was a ToS violation.

### January 9, 2026 — Mass Block

On January 9, 2026, around 02:20 UTC, Anthropic deployed a **technical measure blocking the use of Claude Pro/Max subscription OAuth tokens in third-party tools**.

An important distinction here: **they didn't block API access itself**. Third-party tools using pay-as-you-go API keys worked perfectly fine. What was blocked was using OAuth tokens included with Claude Max subscriptions in tools other than Claude Code.

All third-party tools using subscription authentication were affected, including OpenCode (56,000 GitHub stars at the time).

The error message read:

> *"This credential is only authorized for use with Claude Code and cannot be used for other API requests."*

It was blocked overnight, **with no warning and no migration path**.

### Developer Community Backlash

The backlash was fierce. I checked the related communities myself, and virtually every thread was heated about this issue.

- [Over 170 upvotes and 150+ comments on Hacker News](https://news.ycombinator.com/item?id=46625918)

Ruby on Rails creator **DHH (David Heinemeier Hansson)** posted this on Twitter:

> *"Confirmation that Anthropic is intentionally blocking OpenCode and all third-party tools. A paranoid attempt to lock developers into Claude Code. A terrible policy for a company that trained its models on our code, our writing, our everything."*

**Theo** from t3.gg also expressed concern on Twitter: *"Anthropic is now cracking down on utilizing Claude subs in 3rd party apps like OpenCode and Clawdbot. Oh boy."*

Personally, I think DHH's "paranoid attempt" framing is a bit much, but I can fully understand the frustration of developers paying $200/month and wanting to choose their own tools.

On the other hand, some expressed understanding. Yearn Finance developer **@banteg** [tweeted](https://x.com/banteg/status/2009587028728713647):

> *"Anthropic's crackdown on people abusing subscription credentials was about as gentle as it could have been. Instead of deleting accounts or retroactively charging API prices, they just sent a polite message."*

### Anthropic's Official Stance

**Thariq Shihipar** from the Claude Code team shared the official position on Twitter:

- **Reason for blocking**: Unauthorized tools caused bugs and abnormal usage patterns, and when things went wrong, users blamed Claude, damaging trust.
- Offered to discuss via DM with third-party tool developers
- Confirmed that all **bans related to this issue were reversed**
- The supported path for third-party tools is **API (pay-as-you-go)**, not subscription OAuth tokens

Anthropic's position boiled down to: **subscription plans are for Claude Code only, and third-party tools should use the pay-as-you-go API**. Technically, Claude Code has prompt caching optimization (about 90% cache hit rate per session), keeping costs low for Anthropic, while third-party tools lack this optimization, making the actual server cost much higher even under the same subscription.

Community reactions were split. Some said "subscriptions are for Claude Code, so this is reasonable," but there was also strong pushback: **"I'm paying $200, let me choose my own tools."** However, more criticism was directed at the **lack of prior warning** rather than the principle itself.

Looking back, the shift in Anthropic's response strategy is interesting. On January 5th, they used a **"punishment"** approach — banning individual users. After reversing the bans, they shifted to **"prevention"** — technically blocking OAuth tokens at the system level. They seem to have decided that blocking at the system level was more efficient than catching people one by one.

## Community Adaptation

### The Rise of oh-my-claudecode

After the block, oh-my-claudecode gained even more attention. While oh-my-opencode was OpenCode-based (posing ToS violation risks when using subscription OAuth), oh-my-claudecode was built using **Claude Code's native Hooks (shell scripts)** — making it fully compatible with Max subscriptions without violating ToS.

Developers quickly migrated to oh-my-claudecode. They could use multi-agent orchestration within official Claude Code with no ban risk.

### Clawdbot → OpenClaw

As a side note, around this time, an open-source AI assistant project called **Clawdbot** received a trademark-related email from Anthropic and rebranded to **[OpenClaw](https://openclaw.ai/)**. I'll revisit this project later.

## The Hidden Card: Already Built

### January 24, 2026 — Swarm Discovery

This is where things get really interesting.

Developer **kieranklaassen** ran the `strings` command on the Claude Code binary and discovered a **fully implemented but hidden** multi-agent feature.

```bash
strings ~/.local/share/claude/versions/2.1.29 | grep TeammateTool
```

Under the name **"TeammateTool"**, a complete orchestration layer with 13 operations was already embedded in the code. Functions for creating, managing, and coordinating agents — all hidden behind a feature flag.

Based on this discovery, **Mike Kelly** created [claude-sneakpeek](https://github.com/mikekelly/claude-sneakpeek), which bypassed the feature flag to enable the Swarm functionality, and the community erupted.

**"They blocked third-party multi-agent tools while simultaneously building their own multi-agent system?"**

This discovery left many developers with an uncomfortable question. Whether Anthropic was inspired by community innovation or developing independently is unclear, but **the timing was just too perfect.** When I saw this news, my thought was, "So that's how it goes."

## Official Launch: Agent Teams

### February 5, 2026 — Announced Alongside Opus 4.6

On February 5, 2026, Anthropic announced [Claude Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6) and officially released **Agent Teams** as a Research Preview.

Agent Teams is a feature where **multiple Claude Code instances work simultaneously while communicating with each other**.

Here's how it compares to the existing Sub-Agents:

| Aspect | Sub-Agent | Agent Teams |
|--------|-----------|-------------|
| **Context** | Own context, returns only results to caller | Own context, fully independent |
| **Communication** | Reports only to main agent | Direct message exchange between teammates |
| **Coordination** | Main agent manages all tasks | Autonomous coordination via shared task list |
| **Best For** | Focused tasks where only results matter | Complex tasks requiring discussion and collaboration |
| **Token Cost** | Low (results returned summarized) | High (each teammate is a separate Claude instance) |

### Core Architecture

Agent Teams is structured as follows:

| Component | Role |
|-----------|------|
| **Team Lead** | The main session that creates the team, assigns teammates, and coordinates tasks |
| **Teammates** | Independent Claude Code instances that perform assigned tasks |
| **Task List** | A shared task list with dependency management |
| **Mailbox** | Inter-agent messaging system |

Team configuration files are stored at `~/.claude/teams/{team-name}/config.json`, and task lists at `~/.claude/tasks/{team-name}/`.

### Enabling Agent Teams

Agent Teams is still experimental and disabled by default. Enabling it is simple:

```json
// settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### Creating and Using Teams

You can request team creation in natural language:

```
Analyze the entire architecture of the project.
Assign teammates for backend, frontend, infrastructure, and database analysis,
run them simultaneously, and create an integrated document.
```

With a request like this, Claude Code takes the Team Lead role, creates teammates, and distributes work.

I actually used Agent Teams to create a **comprehensive architecture document for my company's MSA environment**. The task involved analyzing backend service flows, frontend structure, infrastructure setup, and DB schemas all at once to produce an integrated document.

![Agent Teams creating team and running agents](https://www.dropbox.com/scl/fi/8vd9sanjohc53atch3dry/3A2B94B2-A1D9-47C7-BCF1-4602FD3D0B74.jpg?rlkey=d8g83pstkzuy7xbdki0p2n3wv&st=xdtzpg4n&raw=1)

Here you can see four analysis agents (backend-analyzer, frontend-analyzer, infra-analyzer, db-analyzer) running in parallel.

![Agent Teams running](https://www.dropbox.com/scl/fi/v2s0iatowdap9js3auq5r/C4DE224D-95DB-44D9-89CB-B82212F0202A.jpg?rlkey=dqzjoovpi223pbyuj4q2yvuzq&st=k1a0x50y&raw=1)

This would have been nearly impossible with existing Sub-Agents or a single session. Cramming an entire MSA into one session's context risks exceeding the context window and producing hallucinations. With Agent Teams, each teammate analyzes only their designated area with an independent context, **noticeably reducing hallucinations.** The process of the Team Lead aggregating each analysis into an integrated document was clean too.

As a backend developer, what I particularly appreciated was that infrastructure analysis and DB analysis didn't have to wait — **backend service flow analysis ran simultaneously in parallel**. Running everything at once instead of sequentially made a huge difference in perceived speed.

That said, there were drawbacks. oh-my-claudecode has 32 specialized agents (planner, architect, critic, etc.) and 7 execution modes pre-defined and ready to go. With Agent Teams, **you have to describe the team composition and roles every time**. Without pre-defined agent templates, you need to think "what team structure works best for this task?" each time. The one-click experience of oh-my-claudecode's Ultrapilot mode — "just run it in parallel for me" — doesn't exist yet. There were also occasional cases where teammates failed to mark their tasks as complete, giving it a very Research Preview feel.

### Other Features

Beyond this, you can assign different models to each teammate (Opus for the Lead, Sonnet for teammates), require teammates to create plans and get approval before implementing, or set up automated quality checks via Hook events (TeammateIdle, TaskCompleted). Custom agent definitions are also possible by creating markdown files in the `.claude/agents/` directory.

For detailed usage, refer to the [official documentation](https://code.claude.com/docs/en/agent-teams).

### Known Limitations

As a Research Preview, there are limitations. Teammates aren't restored when resuming sessions, only one team per session is possible, and Split Pane mode only works with tmux or iTerm2. There were also occasional cases where teammates failed to mark tasks as complete.

## Comparison: oh-my-opencode vs oh-my-claudecode vs Agent Teams

Let's compare the tools discussed so far.

| Aspect | oh-my-opencode | oh-my-claudecode | Agent Teams |
|--------|---------------|-----------------|-------------|
| **Platform** | OpenCode (third-party) | Claude Code (native Hooks) | Claude Code (official feature) |
| **Provider** | Multi (Claude, OpenAI, Google, etc.) | Claude only | Claude only |
| **Installation** | OpenCode plugin | `.claude/hooks/` scripts | One config change |
| **Agent Count** | Various specialized agents | 32 specialized agents, 40+ skills | User-defined |
| **Execution Modes** | Ultrawork mode | 7 modes (Autopilot, Ultrapilot, Swarm, etc.) | Team Lead + Teammates |
| **Inter-Agent Communication** | Plugin SDK | Hooks-based | Built-in mailbox system |
| **Task Management** | Custom implementation | Custom implementation | Built-in task list (with dependencies) |
| **Stability** | Community-maintained | Community-maintained | Official Anthropic support |
| **ToS Compliance** | Risk of violation with subscription OAuth | Compatible (Claude Code native) | Compatible (official feature) |
| **Cost** | Subscription or API | Subscription | Subscription |

**My Assessment:**

oh-my-opencode and oh-my-claudecode were truly brilliant innovations before Agent Teams. I especially admire how oh-my-claudecode implemented multi-agent capabilities using only official Claude Code features even after the block.

However, now that Agent Teams is officially released, I believe **using the official feature is more stable** in the long run. Community tools can stop being updated, and internal Claude Code changes can cause compatibility issues. That said, at this point, oh-my-claudecode's pre-defined agents and execution modes are ahead in terms of convenience.

## Personal Thoughts: Where Is Anthropic Heading?

Watching this month's events unfold, I've had quite a few thoughts.

### The Subscription Plan Block — How to See It

Honestly, I think I can understand Anthropic's **principle itself**.

As covered earlier, there's a real server cost gap between Claude Code (with prompt caching optimization) and third-party tools without it. The distinction of **"subscription plans for Claude Code only, third-party via API"** is reasonable from a business perspective.

There were voices in the community acknowledging this point. Yearn Finance developer [@banteg](https://x.com/banteg/status/2009587028728713647) said *"instead of deleting accounts or retroactively charging API prices, they just sent a polite message — about as gentle as it could have been,"* and on [Lobsters](https://lobste.rs/s/mhgog9/anthropic_blocks_third_party_tools_using), there were opinions like *"restricting the use of OAuth tokens by the issuer is standard security practice."*

However, the **execution** was disappointing. As we saw in the community reactions earlier, there was more anger about the lack of prior warning than the principle itself. I agree, and taking it a step further — I think what Anthropic missed was the perspective that **"these people are potential API customers."** Third-party tool users were people willing to spend hundreds of dollars a month on multi-agent workflows. Blocking without simultaneously offering an alternative was a way to lose customers.

[An HN user](https://news.ycombinator.com/item?id=46625918) compared it to *"an all-you-can-eat restaurant forcing you to eat with their plastic forks while banning the utensils you brought from home."* I think this captures the core frustration well. Even if the principle is right, rough execution erodes trust.

And honestly, I think what Anthropic was truly afraid of wasn't just server costs. **If third-party tools take over the UX, the model company gets reduced to infrastructure running in the background.** If the tool developers use every day becomes OpenCode, then Claude is just "one of the APIs that OpenCode calls." Losing the touchpoint with developers means losing both lock-in and brand. For Anthropic, this scenario was probably far scarier than the cost issue.

This is especially disappointing given that **Anthropic is a company that grew on the trust of the developer community**. Claude's ability to compete with GPT-4 was partly due to model performance, but its developer-friendly image played a role too.

### The Pattern of Absorbing Community Innovation

Looking at the timeline:

1. Community builds multi-agent tools (oh-my-opencode, oh-my-claudecode)
2. Tools gain massive popularity
3. Anthropic blocks them (January 9, 2026)
4. Hidden Swarm feature discovered in Claude Code (January 24, 2026)
5. Agent Teams officially launches (February 5, 2026)

Whether Anthropic was inspired by community innovation or developing independently is unknown. But looking at the results, **the pattern of the community proving possibilities first, then the platform absorbing them as official features** is repeating.

This is actually a common pattern in platform businesses. Just like ad-blocking and dark mode that were popular as browser extensions eventually became built-in browser features. Or how features like flashlight and screen recording that third-party iOS apps pioneered were later built into the OS.

Of course, in this case, it's hard to say "they blocked third-party tools then released a similar feature." What was blocked was **unauthorized use of subscription plans**, not the existence of third-party tools. Third-party tool usage via API is still perfectly fine.

I feel that **Anthropic is trying to quickly identify and add features that people in the developer ecosystem want**. That itself is a good thing, and the distinction between subscription plans and API is understandable from a business perspective. I just wish the process had been more transparent in communicating with the community.

### What's Next — Messenger Integration and Error Automation?

[OpenClaw](https://openclaw.ai/), which I briefly mentioned earlier, is an open-source tool that lets you **work with AI agents through various messenger channels** including Telegram, Discord, Slack, WhatsApp, Signal, and Email. Self-hosted on your local machine, you can request code changes, monitor tasks, and even automate browser operations right from a messenger.

Asking "How's the PR review?" via Telegram on your commute and getting an instant response from the agent — **this is already possible with OpenClaw.** GitHub Copilot has also enabled mobile code-related queries through [Copilot Chat in GitHub Mobile](https://github.blog/changelog/2024-10-29-copilot-chat-in-github-mobile/). The need to "communicate with agents without sitting in front of a terminal" has already been validated across the industry.

Just as Agent Teams absorbed the community's multi-agent needs into an official feature, I wonder if **agent work through messengers might soon become an official Claude Code feature**.

As a backend developer, there's something else I'm looking forward to. I recently shared my experience [automating late-night error alert responses with OpenClaw]({{< relref "/blog/trends/openclaw-error-autopilot" >}}). It was a pipeline where Loki detects errors, AI analyzes them, traces them, fixes the code, and submits a PR. If Claude Code were to **natively support messenger channels** like OpenClaw, this error detection → analysis → auto-fix flow could be done directly within Claude Code without separate tools. When an error alert comes in, Agent Teams could automatically form a team — one teammate analyzing logs, another finding related code, and another writing the fix PR.

If the pattern of community-proven patterns becoming official features continues, this kind of operational automation will eventually be absorbed into Claude Code.

## Wrapping Up: So What Should You Choose?

Reading this, you might be left wondering: "So what should I actually use?"

**"Right now,"** I recommend starting with Agent Teams. There's no ban risk since it's an official feature, it takes just one config change to enable, and Anthropic will keep improving it. While oh-my-claudecode's pre-defined agents are convenient, community tools often stop being maintained once official features catch up.

There's a reason I said "right now." As you can tell from the fact that all of this happened within a single month, the AI agent ecosystem is changing incredibly fast. What was trending today, what we called innovation, is already falling behind tomorrow. It honestly feels insane, and I sometimes wonder if this pace even makes sense. But if we can't be ahead, the only option is to adapt quickly so we don't fall behind.

Ultimately, "how to use multi-agent well" in the current landscape comes down to **how you divide tasks and what roles and context you give each agent**. Whether the tool is official or community-built, without this design ability, running multiple agents won't produce quality results. I learned this firsthand while creating the MSA architecture document — the team composition made a huge difference in output quality.

The biggest takeaway from this month for me is this: **Community tools are prototypes that prove "this is possible," and platform features are products that make it stable to use.** Both are necessary, and this cycle drives the ecosystem forward. I still wish Anthropic would communicate more transparently with the community in this cycle, though.

I previously wrote about [How to Collaborate with AI Coding Tools]({{< relref "/blog/trends/ai-agent-co-work" >}}), but back then the question was "how to use one agent well." Now, the question has shifted to **"how to design multiple agents"** — and that shift happened in just one month.

Thank you for reading this long post.

## Reference

- [Claude Code Agent Teams Official Docs](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Sub-Agents Official Docs](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Custom Agents Official Docs](https://code.claude.com/docs/en/custom-agents)
- [Claude Opus 4.6 Announcement](https://www.anthropic.com/news/claude-opus-4-6)
- [oh-my-opencode GitHub](https://github.com/code-yeongyu/oh-my-opencode)
- [oh-my-claudecode GitHub](https://github.com/Yeachan-Heo/oh-my-claudecode)
- [OpenCode GitHub](https://github.com/anomalyco/opencode)
- [OpenClaw](https://openclaw.ai/)
- [GitHub Issue #6930 - OpenCode ToS Ban](https://github.com/anomalyco/opencode/issues/6930)
- [Hacker News - Anthropic Blocking OpenCode](https://news.ycombinator.com/item?id=46625918)
- [VentureBeat - Anthropic Cracks Down on Unauthorized Claude Usage](https://venturebeat.com/technology/anthropic-cracks-down-on-unauthorized-claude-usage-by-third-party-harnesses)
- [claude-sneakpeek GitHub](https://github.com/mikekelly/claude-sneakpeek)
- [DHH Twitter - Anthropic Block Criticism](https://x.com/dhh/status/2009716350374293963)
- [Paddo.dev - Anthropic's Walled Garden Crackdown](https://paddo.dev/blog/anthropic-walled-garden-crackdown/)
- [Paddo.dev - Claude Code Hidden Swarm](https://paddo.dev/blog/claude-code-hidden-swarm/)
- [CNBC - OpenClaw: Open-source AI agent rise, controversy](https://www.cnbc.com/2026/02/02/openclaw-open-source-ai-agent-rise-controversy-clawdbot-moltbot-moltbook.html)
- [GitHub Blog - Copilot Chat in GitHub Mobile](https://github.blog/changelog/2024-10-29-copilot-chat-in-github-mobile/)
