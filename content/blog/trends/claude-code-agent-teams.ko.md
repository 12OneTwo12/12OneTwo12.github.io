---
title: "매일 바뀌는 AI 코딩 에이전트 생태계: oh-my-opencode, oh-my-claudecode, OpenClaw, Agent Teams"
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

안녕하세요. 프롭테크 플랫폼에서 백엔드 개발자로 근무 중인 3년차 백엔드 개발자 정정일입니다.

최근 AI 코딩 도구 생태계가 정말 빠르게 변하고 있습니다. 며칠 전까지 유행하던 도구가 다음 주에는 차단되고, 그 다음 주에는 공식 기능으로 출시되는... 마치 롤러코스터 같은 한 달이었습니다.

이번 글에서는 **oh-my-opencode**라는 커뮤니티 도구가 유행하고, Anthropic이 이를 차단하고, 결국 **Agent Teams**라는 공식 기능이 출시되기까지의 이야기를 시간 순서대로 정리해보려 합니다.

저도 이 흐름을 지켜보면서 많은 생각이 들었고, 개인적인 의견도 함께 녹여보려 합니다.

## 배경: Claude Code의 Sub-Agent

본격적인 이야기에 앞서 간단히 배경을 짚고 넘어가겠습니다.

2025년 중반부터 Anthropic의 Claude Code에는 **Sub-Agent**라는 기능이 있었습니다. 하나의 Claude Code 세션 안에서 특정 작업을 별도의 에이전트에게 맡기고, 결과만 받아오는 방식이었죠.

예를 들어 코드베이스를 탐색하는 **Explore** 에이전트, 구현 계획을 세우는 **Plan** 에이전트 등이 있었고, `.claude/agents/` 디렉토리에 마크다운 파일을 만들면 커스텀 에이전트도 정의할 수 있었습니다.

하지만 Sub-Agent에는 한계가 있었습니다. **하나의 세션 안에서만** 동작하고, 에이전트끼리 서로 대화할 수 없고, 결과를 메인 에이전트에게만 보고하는 구조였죠. 복잡한 작업을 여러 에이전트가 **병렬로 협업**하며 처리하기에는 부족했습니다.

**"여러 AI 에이전트가 동시에 다른 작업을 하면서 서로 소통할 수는 없을까?"**

이런 니즈를 가진 개발자들이 있었고, 커뮤니티에서 직접 해결책을 만들기 시작합니다.

## 커뮤니티의 혁신: oh-my-opencode

### OpenCode와 oh-my-opencode

[OpenCode](https://github.com/anomalyco/opencode)는 SST 팀이 만든 오픈소스 AI 코딩 에이전트입니다. Anthropic의 Claude Code와 비슷하지만 **프로바이더에 독립적**이라는 점이 차별점이었죠. Claude, OpenAI, Google, 심지어 로컬 모델까지 자유롭게 사용할 수 있었습니다. GitHub 스타가 100,000개가 넘을 정도로 인기를 끌었습니다.

여기에 한국 개발자 **김영규(code-yeongyu)** 님이 [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)라는 플러그인을 만들었습니다. oh-my-zsh가 Zsh 셸을 강화하듯, oh-my-opencode는 OpenCode에 **멀티 에이전트 오케스트레이션**을 더해줬죠.

**oh-my-opencode의 핵심 기능**을 살펴보면
- 멀티 모델 에이전트 오케스트레이션
- 병렬 백그라운드 에이전트
- LSP/AST 도구 통합
- 전문화된 에이전트 (Oracle, Librarian, Frontend Engineer 등)
- "Ultrawork" 모드로 병렬 실행

김영규 님은 최적의 멀티 에이전트 구조를 연구하는 데 **24,000달러(약 3,400만원)** 상당의 토큰을 사용했다고 합니다.

### 왜 이렇게 인기를 끌었나?

핵심은 **경제적 구조**에 있었습니다.

Claude Max 구독(`$100~200`/월)은 Pro 대비 5배~20배의 높은 사용량 한도를 제공했지만, 공식 Claude Code CLI를 통해서만 사용할 수 있었습니다. 같은 수준의 API 사용료는 수천 달러에 달할 수 있었죠. 실제 테스트에서 한 달 `$3,650` 이상 나온 사례도 있더라구요.

개발자들이 OpenCode + oh-my-opencode 조합을 사용하면 Claude Max 구독의 사용량 한도를 훨씬 더 적극적으로 소진할 수 있었습니다. 밤새 자율 에이전트를 돌리며 코딩/테스트/수정 루프를 실행하는 것도 가능했죠.

비유하자면 **뷔페에서 먹는 속도 제한이 풀린** 것과 같았습니다. Anthropic이 "올-유-캔-잇(all-you-can-eat)" 뷔페를 제공하되, 공식 CLI를 통해 먹는 속도를 제한하고 있었는데, 써드파티 도구들이 그 속도 제한을 풀어버린 셈이었죠.

실제로 사용해봤을 때 별다른 세팅 없이도 멀티 에이전트를 활용할 수 있어서 굉장히 편리했습니다.

다만 제 경우에는 토큰을 너무 빠르게 소진하는 바람에 금방 사용을 중단했습니다. 저는 Max 20x 구독을 사용 중인데, 단 한번의 질의로 Current session 토큰 한도에 도달해버리는 등의 문제가 있었거든요.

그 때문에 Anthropic에 문의를 남기기도 했었습니다.

![](https://www.dropbox.com/scl/fi/qy9n2v19lqo4d5gsifz59/03ED9941-21BF-414C-A7B9-66AF1F49FE65.jpg?rlkey=swq9dkrbvlbjh2sf5kt8urlh7&st=kb1lvzh3&raw=1)

>... Although, we currently don't have a tool to investigate usage specifically, I see that your usage significantly increased on 2026-01-06 and 2026-01-04. We do encourage you to review our Usage Limits Best Practices documentation if you haven't already as this outlines strategies to help optimize your usage and get the most out of your subscription.

oh-my-opencode를 사용해봤던 1월 4일과 6일에 사용량이 급증한 것을 확인했다는 답변이었죠. 토큰 사용 최적화 가이드 문서를 참고하라는 안내도 있었습니다.

이런 토큰 과다 소진 문제는 저만 겪은 게 아니었습니다. [GitHub Issue](https://github.com/code-yeongyu/oh-my-opencode/issues/115)에서도 *"API로 전환하면 30분 만에 $15~20을 태운다"*, *"rate limit에 금방 걸려서 사용을 중단했다"* 는 보고가 여럿 올라왔고, 메인테이너도 이 문제를 인정하고 task queue 제한을 추가하겠다고 밝혔을 정도였습니다.

### oh-my-claudecode: Claude Code 전용 멀티 에이전트

oh-my-opencode가 OpenCode 기반이었다면, [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode)는 **Claude Code 전용**으로 만들어진 별도의 프로젝트입니다. 원래 "oh-my-claude-sisyphus"라는 이름이었다가 v3.0.0에서 oh-my-claudecode로 리브랜딩됐죠. 에이전트 이름도 그리스 신화에서 직관적인 이름(planner, architect, critic 등)으로 바뀌었습니다.

**oh-my-claudecode의 핵심 기능**도 인상적이었습니다.
- 7가지 실행 모드: Autopilot, Ultrawork, Ralph, Ultrapilot(3~5배 병렬), Ecomode, Swarm, Pipeline
- 32개의 전문 에이전트와 40개 이상의 스킬
- Claude Code의 네이티브 Hooks(쉘 스크립트)를 활용해 ToS를 위반하지 않는 구조

특히 **Ultrapilot 모드**는 3~5개의 에이전트를 병렬로 실행시켜 작업 속도를 극적으로 끌어올리는 기능인데, Agent Teams가 나오기 전까지는 이게 Claude Code에서 멀티 에이전트를 사용하는 가장 강력한 방법이었습니다.

이렇게 커뮤니티에서 멀티 에이전트 도구들이 활발하게 만들어지고 있었습니다. 저도 이 도구들을 보면서 "어떻게 하면 AI를 더 잘 활용할 수 있을까에 대한 고민을 많은 개발자들이 하고 있구나" 싶었죠.

## Anthropic의 대응: 차단

### 2026년 1월 5일 - 첫 번째 밴 보고

첫 번째 신호는 [GitHub Issue #6930](https://github.com/anomalyco/opencode/issues/6930)에서 올라왔습니다. 한 사용자가 OpenCode에서 Anthropic OAuth를 사용했다가 **ToS(이용약관) 위반으로 밴**당했다는 보고였죠.

해당 사용자는 Claude Max 5x에서 Max 20x로 업그레이드한 직후 리뷰가 트리거됐다고 합니다. Twitter에서 Anthropic 엔지니어에게 연락한 결과, Claude 구독을 OpenCode를 통해 사용하는 것이 ToS 위반이라는 답변을 받았습니다.

### 2026년 1월 9일 - 대규모 차단

2026년 1월 9일 UTC 02:20경, Anthropic은 **써드파티 도구에서 Claude Pro/Max 구독 OAuth 토큰 사용을 차단하는 기술적 조치**를 배포했습니다.

여기서 중요한 건 **API 접근 자체를 막은 건 아니라는 점**입니다. 종량제 API 키를 사용하는 써드파티 도구는 아무 문제 없이 동작했습니다. 차단된 건 Claude Max 구독에 포함된 OAuth 토큰을 Claude Code가 아닌 도구에서 사용하는 것이었죠.

OpenCode(당시 GitHub 스타 56,000개)를 비롯해 구독 인증을 사용하는 모든 써드파티 도구가 영향을 받았습니다.

에러 메시지는 이랬습니다.

> *"This credential is only authorized for use with Claude Code and cannot be used for other API requests."*

**아무런 경고도, 마이그레이션 경로도 없이** 하루아침에 차단됐습니다.

### 개발자 커뮤니티의 반발

반발은 거셌습니다. 저도 관련 커뮤니티를 살펴봤는데, 거의 모든 스레드가 이 이슈로 뜨겁더라구요.

- [Hacker News에서 170개 이상의 업보트와 150개 이상의 댓글](https://news.ycombinator.com/item?id=46625918)

Ruby on Rails 창시자 **DHH(David Heinemeier Hansson)** 가 [트위터에](https://x.com/dhh/status/2009716350374293963) 이런 글을 올리기도 했습니다.

> *"Anthropic이 의도적으로 OpenCode와 모든 써드파티 도구를 차단하고 있다는 확인. 개발자들을 Claude Code에 강제로 가두려는 편집증적 시도. 우리의 코드, 우리의 글, 우리의 모든 것으로 모델을 학습시킨 회사가 취할 정책으로서는 끔찍하다."*

t3.gg의 **Theo**도 [트위터에서](https://x.com/theo/status/2009464346846621700) *"Anthropic is now cracking down on utilizing Claude subs in 3rd party apps like OpenCode and Clawdbot. Oh boy."* 라며 우려를 표했습니다.

개인적으로 DHH의 "편집증적 시도"라는 표현은 과하다고 생각하지만, 월 $200을 내면서 도구 선택권을 원하는 개발자들의 감정 자체는 충분히 이해가 됩니다.

반면 이해를 표하는 의견도 있었습니다. Yearn Finance 개발자 **@banteg**는 [트위터에서](https://x.com/banteg/status/2009587028728713647) 이렇게 말했죠.

> *"구독 인증을 악용하는 사람들에 대한 Anthropic의 단속은 가능한 한 가장 부드러운 방식이었다. 계정을 삭제하거나 소급해서 API 가격을 청구하는 대신 정중한 메시지만 보냈으니까."*

### Anthropic의 공식 입장

Claude Code 팀의 **Thariq Shihipar**가 [트위터에서](https://x.com/trq212/status/2009689809875591565) 공식 입장을 밝혔습니다.

- **차단 사유**: 인증되지 않은 도구들이 버그와 비정상적인 사용 패턴을 야기하고, 문제가 생기면 사용자들이 Claude 탓을 해서 신뢰도가 떨어진다.
- 써드파티 도구 개발자들에게 DM으로 논의할 것을 제안
- 해당 이슈로 밴된 사용자들의 **밴은 모두 해제**됨을 확인
- 써드파티 도구의 지원 경로는 **API(종량제 과금)** 이며, 구독 OAuth 토큰은 아님

Anthropic의 입장을 정리하면, **구독 Plan은 Claude Code 전용이고, 써드파티 도구는 종량제 API를 사용하는 것이 정상적인 경로**라는 것이었습니다. 기술적으로도 Claude Code는 프롬프트 캐싱 최적화(세션당 약 90% 캐시 적중률)가 적용돼 있어 Anthropic 입장에서 비용이 낮지만, 써드파티 도구는 이런 최적화가 없어 같은 구독이라도 실제 서버 비용이 훨씬 높다는 주장이었죠.

커뮤니티 반응은 갈렸습니다. "구독은 Claude Code 전용이니 당연한 조치다"라는 의견도 있었지만, **"$200 내고 쓰는데 도구는 내가 선택하게 해달라"** 는 반발도 컸습니다. 다만 원칙 자체보다는 **사전 경고 없는 실행 방식**에 대한 비판이 더 크더라구요.

돌이켜보면 Anthropic의 대응 전략 변화가 흥미롭습니다. 1월 5일에는 개별 사용자를 밴하는 **"처벌"** 방식이었는데, 밴을 해제한 뒤 OAuth 토큰 자체를 기술적으로 차단하는 **"원천 봉쇄"** 로 전환한 겁니다. 한 명씩 잡아내는 것보다 시스템 레벨에서 아예 막는 게 효율적이라고 판단한 것 같습니다.

## 커뮤니티의 적응

### oh-my-claudecode의 부상

차단 이후, oh-my-claudecode가 더욱 주목받게 됩니다. oh-my-opencode는 OpenCode 기반이라 구독 OAuth 사용 시 ToS 위반 리스크가 있었지만, oh-my-claudecode는 **Claude Code의 네이티브 Hooks(쉘 스크립트)** 를 활용해 구현됐기 때문에 Max 구독과 완전히 호환되면서 ToS를 위반하지 않는 구조였습니다.

개발자들은 빠르게 oh-my-claudecode로 옮겨갔습니다. 공식 Claude Code 안에서 멀티 에이전트 오케스트레이션을 사용하면서도 밴 리스크 없이 쓸 수 있었으니까요.

### Clawdbot → OpenClaw 이야기

여담이지만 이 시기에 **Clawdbot**이라는 오픈소스 AI 어시스턴트 프로젝트도 Anthropic으로부터 상표권 관련 이메일을 받아 **[OpenClaw](https://openclaw.ai/)** 로 리브랜딩한 일이 있었습니다. 이 프로젝트는 뒤에서 다시 다루겠습니다.

## 숨겨진 카드: 이미 만들어져 있었다

### 2026년 1월 24일 - Swarm 발견

이 시점에서 정말 흥미로운 일이 벌어집니다.

개발자 **kieranklaassen**이 Claude Code 바이너리에 `strings` 명령어를 실행했다가 **이미 구현되어 있지만 숨겨진** 멀티 에이전트 기능을 발견한 겁니다.

```bash
strings ~/.local/share/claude/versions/2.1.29 | grep TeammateTool
```

**"TeammateTool"** 이라는 이름으로, 13개의 오퍼레이션을 가진 완전한 오케스트레이션 레이어가 이미 코드 안에 있었습니다. 에이전트를 생성하고, 관리하고, 조율하는 기능이 피처 플래그 뒤에 숨겨져 있었던 거죠.

이 발견을 바탕으로 **Mike Kelly**가 [claude-sneakpeek](https://github.com/mikekelly/claude-sneakpeek)이라는 프로젝트를 만들어 피처 플래그를 우회하고 Swarm 기능을 사용할 수 있게 공개했고, 커뮤니티는 발칵 뒤집혔습니다.

**"써드파티 멀티 에이전트 도구를 차단하면서, 동시에 자체 멀티 에이전트 시스템을 이미 만들고 있었다고?"**

이 발견은 많은 개발자들에게 불편한 질문을 남겼습니다. 커뮤니티의 혁신에서 영감을 받은 건지, 독자적으로 개발하고 있었는지는 알 수 없지만, **타이밍이 너무 절묘했기 때문이죠.** 저도 이 소식을 보고 "결국 이렇게 되는구나" 싶었습니다.

## 공식 출시: Agent Teams

### 2026년 2월 5일 - Opus 4.6과 함께 발표

그리고 2026년 2월 5일, Anthropic은 [Claude Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6)을 발표하면서 **Agent Teams**를 Research Preview로 공식 출시했습니다.

Agent Teams는 **여러 Claude Code 인스턴스가 동시에 작업하면서 서로 소통하는** 기능입니다.

기존 Sub-Agent와의 가장 큰 차이점을 정리하면 이렇습니다.

| 특성 | Sub-Agent | Agent Teams |
|------|-----------|-------------|
| **컨텍스트** | 자체 컨텍스트, 결과만 호출자에게 반환 | 자체 컨텍스트, 완전히 독립적 |
| **커뮤니케이션** | 메인 에이전트에게만 보고 | 팀원끼리 직접 메시지 교환 |
| **조율** | 메인 에이전트가 모든 작업 관리 | 공유 Task 리스트로 자율 조율 |
| **적합한 작업** | 결과만 중요한 집중 작업 | 논의와 협업이 필요한 복잡한 작업 |
| **토큰 비용** | 낮음 (결과가 요약돼서 반환) | 높음 (각 팀원이 별도 Claude 인스턴스) |

### 핵심 아키텍처

Agent Teams의 구조는 이렇습니다.

| 구성요소 | 역할 |
|----------|------|
| **Team Lead** | 팀을 생성하고, 팀원을 배치하고, 작업을 조율하는 메인 세션 |
| **Teammates** | 할당된 작업을 수행하는 독립 Claude Code 인스턴스 |
| **Task List** | 팀원들이 공유하는 작업 목록 (의존성 관리 포함) |
| **Mailbox** | 에이전트 간 메시징 시스템 |

팀 설정 파일은 `~/.claude/teams/{team-name}/config.json`에, 작업 목록은 `~/.claude/tasks/{team-name}/`에 저장됩니다.

### Agent Teams 활성화하기

Agent Teams는 아직 실험적 기능이라 기본적으로 비활성화돼 있습니다. 활성화 방법은 간단합니다.

```json
// settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### 팀 생성과 사용

팀 생성은 자연어로 요청하면 됩니다.

```
프로젝트의 전체 아키텍처를 분석해줘.
백엔드, 프론트엔드, 인프라, 데이터베이스 각각 분석하는 팀원을 배치해서
동시에 분석하고 통합 문서를 만들어줘.
```

이렇게 요청하면 Claude Code가 Team Lead 역할을 맡아서 팀원을 생성하고 작업을 배분합니다.

저는 실제로 회사의 **MSA 환경 전체 아키텍처 문서**를 Agent Teams로 작성시켜 봤습니다. 백엔드 서비스 흐름, 프론트엔드 구조, 인프라 구성, DB 스키마까지 한 번에 분석하고 통합 문서를 만드는 작업이었죠.

![Agent Teams 팀 생성 및 에이전트 실행 모습](https://www.dropbox.com/scl/fi/8vd9sanjohc53atch3dry/3A2B94B2-A1D9-47C7-BCF1-4602FD3D0B74.jpg?rlkey=d8g83pstkzuy7xbdki0p2n3wv&st=xdtzpg4n&raw=1)

4개의 분석 에이전트(backend-analyzer, frontend-analyzer, infra-analyzer, db-analyzer)가 병렬로 실행되는 모습입니다.

![Agent Teams 실행 중인 모습](https://www.dropbox.com/scl/fi/v2s0iatowdap9js3auq5r/C4DE224D-95DB-44D9-89CB-B82212F0202A.jpg?rlkey=dqzjoovpi223pbyuj4q2yvuzq&st=k1a0x50y&raw=1)

이 작업을 기존 Sub-Agent나 단일 세션으로 했다면 거의 불가능했을 겁니다. MSA 전체를 한 세션의 컨텍스트에 담으면 컨텍스트 윈도우를 넘어서면서 환각이 생기기 쉬운데, Agent Teams는 각 팀원이 독립된 컨텍스트로 담당 영역만 집중 분석하니까 **환각이 눈에 띄게 줄었습니다.** Team Lead가 각 분석 결과를 취합해서 통합 문서를 만들어주는 과정도 깔끔했고요.

백엔드 개발자 입장에서 특히 좋았던 건, 인프라 분석과 DB 분석을 기다리지 않고 **백엔드 서비스 흐름 분석이 병렬로 동시에 진행**된다는 점이었습니다. 순차적으로 하나씩 실행했으면 한참 걸렸을 작업을 동시에 돌리니 체감 속도 차이가 컸죠.

다만 아쉬운 점도 있었습니다. oh-my-claudecode는 32개의 전문화된 에이전트(planner, architect, critic 등)와 7가지 실행 모드가 이미 정의돼 있어서 바로 쓸 수 있는데, Agent Teams는 **매번 팀 구성과 역할을 직접 설명해야 합니다.** 사전 정의된 에이전트 템플릿이 없으니 "이 작업에는 어떤 팀 구성이 좋을까?"를 매번 고민해야 하는 거죠. oh-my-claudecode의 Ultrapilot 모드처럼 "알아서 병렬로 돌려줘"라는 원클릭 경험은 아직 없습니다. 그리고 팀원이 작업 완료를 표시하지 못하고 멈추는 경우도 간혹 있어서 아직은 Research Preview답다는 느낌도 받았습니다.

### 그 외 기능들

이 외에도 팀원마다 다른 모델을 지정하거나(Lead는 Opus, 팀원은 Sonnet), 팀원이 계획을 먼저 세우고 승인을 받은 후에만 구현하게 하거나, Hook 이벤트(TeammateIdle, TaskCompleted)로 자동화된 품질 검증을 걸 수도 있습니다. `.claude/agents/` 디렉토리에 마크다운 파일을 만들면 커스텀 에이전트 정의도 가능하고요.

자세한 사용법은 [공식 문서](https://code.claude.com/docs/en/agent-teams)를 참고하시면 됩니다.

### 알려진 한계

아직 Research Preview인 만큼 한계도 있습니다. 세션 재개 시 팀원이 복원되지 않고, 세션당 하나의 팀만 운영 가능하며, Split Pane 모드는 tmux 또는 iTerm2에서만 동작합니다. 팀원이 작업 완료를 표시하지 못하는 경우도 간혹 있었습니다.

## 비교: oh-my-opencode vs oh-my-claudecode vs Agent Teams

지금까지 이야기한 도구들을 비교해보겠습니다.

| 특성 | oh-my-opencode | oh-my-claudecode | Agent Teams |
|------|---------------|-----------------|-------------|
| **플랫폼** | OpenCode (써드파티) | Claude Code (네이티브 Hooks) | Claude Code (공식 기능) |
| **프로바이더** | 다중 (Claude, OpenAI, Google 등) | Claude 전용 | Claude 전용 |
| **설치** | OpenCode 플러그인 | `.claude/hooks/` 스크립트 | 설정값 1개 변경 |
| **에이전트 수** | 다양한 전문 에이전트 | 32개 전문 에이전트, 40+ 스킬 | 사용자 정의 |
| **실행 모드** | Ultrawork 모드 | 7가지 (Autopilot, Ultrapilot, Swarm 등) | Team Lead + Teammates |
| **에이전트 간 통신** | 플러그인 SDK | Hooks 기반 | 내장 메일박스 시스템 |
| **Task 관리** | 자체 구현 | 자체 구현 | 내장 Task 리스트 (의존성 포함) |
| **안정성** | 커뮤니티 유지보수 | 커뮤니티 유지보수 | Anthropic 공식 지원 |
| **ToS 호환** | 구독 OAuth로 사용 시 위반 가능 | Claude Code 네이티브라 호환 | 공식 기능이니 당연히 호환 |
| **비용** | 구독 or API | 구독 | 구독 |

**개인적인 판단:**

oh-my-opencode와 oh-my-claudecode는 Agent Teams 이전에 정말 훌륭한 혁신이었습니다. 특히 oh-my-claudecode는 Anthropic의 차단 이후에도 Claude Code의 공식 기능만 활용해서 멀티 에이전트를 구현했다는 점에서 대단하다고 생각합니다.

하지만 Agent Teams가 공식 출시된 지금, 장기적으로는 **공식 기능을 사용하는 게 안정적**이라고 생각합니다. 커뮤니티 도구는 업데이트가 중단될 수 있고, Claude Code의 내부 구조가 바뀌면 호환성 문제가 생길 수 있으니까요. 다만 현 시점에서는 oh-my-claudecode의 사전 정의된 에이전트와 실행 모드가 편의성 면에서 앞서 있는 건 사실입니다.

## 개인적인 생각: Anthropic은 어디로 향하고 있나

이 한 달간의 흐름을 지켜보면서 꽤 많은 생각이 들었습니다.

### 구독 Plan 차단, 어떻게 볼 것인가

솔직히 말하면, 저는 Anthropic의 **원칙 자체**는 이해할 수 있다고 생각합니다.

앞서 정리한 것처럼 Claude Code와 써드파티 도구 사이에는 프롬프트 캐싱 최적화로 인한 실제 서버 비용 차이가 있고, **"구독 Plan은 Claude Code 전용, 써드파티는 API로"** 라는 구분은 비즈니스적으로 합리적이죠.

커뮤니티에서도 이 점을 인정하는 목소리가 있었습니다. Yearn Finance 개발자 [@banteg](https://x.com/banteg/status/2009587028728713647)는 *"계정을 삭제하거나 소급해서 API 가격을 청구하는 대신 정중한 메시지만 보냈으니 가능한 한 부드러운 방식이었다"* 고 평가했고, [Lobsters](https://lobste.rs/s/mhgog9/anthropic_blocks_third_party_tools_using)에서는 *"OAuth 토큰 발급자가 해당 토큰의 용도를 제한하는 건 일반적인 보안 관행"* 이라는 의견도 있었습니다.

다만 **실행 방식**은 아쉬웠습니다. 앞서 커뮤니티 반응에서도 봤듯이, 원칙 자체보다 사전 경고 없는 실행에 대한 분노가 컸죠. 저도 같은 생각인데, 여기서 한 발 더 나가면 — Anthropic이 놓친 건 **"이 사람들은 잠재적 API 고객이다"** 라는 관점인 것 같습니다. 써드파티 도구 사용자들은 멀티 에이전트에 월 수백 달러를 쓸 의향이 있는 사람들이었거든요. 차단만 하고 대안을 동시에 제시하지 못한 건, 고객을 잃는 방식이었다고 봅니다.

[HN의 한 유저](https://news.ycombinator.com/item?id=46625918)는 *"올-유-캔-잇 레스토랑에서 자기네 플라스틱 포크로만 먹으라고 강요하면서, 내가 가져온 수저는 쓰지 못하게 하는 꼴"* 이라고 비유했는데, 이게 불만의 핵심을 잘 보여준다고 생각합니다. 원칙이 맞더라도, 실행 방식이 거칠면 신뢰가 깎이는 거죠.

그리고 솔직히 말하면, Anthropic이 진짜 두려웠던 건 서버 비용만이 아니라고 생각합니다. **써드파티 도구가 UX를 장악하면, 모델 회사는 뒤에서 돌아가는 인프라로 추락합니다.** 개발자가 매일 쓰는 도구가 OpenCode가 되면, Claude는 그냥 "OpenCode가 호출하는 API 중 하나"가 되는 거죠. 개발자와의 접점을 잃는다는 건, 락인도 브랜드도 잃는다는 뜻입니다. Anthropic 입장에서 이건 비용 문제보다 훨씬 무서운 시나리오였을 겁니다.

**Anthropic이 개발자 커뮤니티의 신뢰로 성장한 회사**라는 점에서 더 아쉽습니다. Claude가 GPT-4와 경쟁할 수 있었던 건 모델 성능도 있지만, 개발자 친화적인 이미지도 한몫했거든요.

### 커뮤니티의 혁신을 흡수하는 패턴

시간순으로 보면

1. 커뮤니티가 멀티 에이전트 도구 만듦 (oh-my-opencode, oh-my-claudecode)
2. 도구들이 큰 인기를 끔
3. Anthropic이 차단 (2026년 1월 9일)
4. Claude Code에 숨겨진 Swarm 기능 발견 (2026년 1월 24일)
5. Agent Teams 공식 출시 (2026년 2월 5일)

Anthropic이 커뮤니티의 혁신에서 영감을 받았는지, 독자적으로 개발하고 있었는지는 알 수 없습니다. 하지만 결과적으로 보면, **커뮤니티가 먼저 가능성을 증명하고, 플랫폼이 이를 공식 기능으로 흡수하는 패턴**이 반복되고 있습니다.

사실 이건 플랫폼 비즈니스에서 흔히 보는 모습이기도 합니다. 브라우저 확장 프로그램으로 인기를 끌던 광고 차단이나 다크 모드가 결국 브라우저 기본 기능이 된 것처럼요. iOS에서 써드파티 앱이 먼저 보여준 손전등, 화면 녹화 같은 기능이 나중에 기본 탑재된 것도 비슷한 맥락입니다.

물론 이번 경우는 "써드파티를 차단한 뒤 비슷한 기능을 출시했다"고 단정하기는 어렵습니다. 차단한 것은 **구독 Plan의 무단 사용**이지, 써드파티 도구의 존재 자체가 아니었으니까요. API를 통한 써드파티 도구 사용은 여전히 가능합니다.

저는 **Anthropic이 개발자 생태계에서 사람들이 바라는 기능을 빠르게 포착해서 추가하려 한다**고 느껴집니다. 그 자체는 좋은 일이고, 구독 Plan과 API의 구분도 비즈니스적으로 이해할 수 있습니다. 다만 과정에서 커뮤니티와의 소통이 더 투명했으면 합니다.

### 다음은 메신저 통합과 에러 자동화?

앞서 잠깐 언급한 [OpenClaw](https://openclaw.ai/)는 Telegram, Discord, Slack, WhatsApp, Signal, Email 등 **다양한 메신저 채널을 통해 AI 에이전트와 작업**할 수 있는 오픈소스 도구입니다. 로컬 머신에서 셀프호스팅되며, 코드 수정 요청, 작업 모니터링, 브라우저 자동화까지 메신저에서 바로 할 수 있죠.

출퇴근 길에 Telegram으로 "PR 리뷰 결과 어때?"라고 물어보면 에이전트가 바로 답해주는 것, **이건 이미 OpenClaw로 가능한 현실입니다.** GitHub Copilot도 [Copilot Chat in GitHub Mobile](https://github.blog/changelog/2024-10-29-copilot-chat-in-github-mobile/)을 통해 모바일에서 코드 관련 질문을 할 수 있게 했고요. "터미널 앞에 앉아있지 않아도 에이전트와 소통한다"는 니즈는 이미 업계 전반에서 검증된 셈입니다.

Agent Teams가 커뮤니티의 멀티 에이전트 니즈를 공식 기능으로 흡수한 것처럼, **메신저를 통한 에이전트 작업도 곧 Claude Code의 공식 기능으로 지원되지 않을까** 하는 생각이 듭니다.

그리고 백엔드 개발자로서 또 하나 기대하는 게 있습니다. 저는 얼마 전에 [OpenClaw로 새벽 에러 알림 대응을 자동화한 경험]({{< relref "/blog/trends/openclaw-error-autopilot" >}})을 공유한 적이 있는데요. Loki에서 에러를 감지하면 AI가 분석하고, trace를 추적하고, 코드를 수정해서 PR까지 올리는 파이프라인이었습니다. 만약 Claude Code에서 OpenClaw처럼 **메신저 채널을 네이티브로 지원**하게 된다면, 이런 에러 감지 → 분석 → 자동 수정 흐름도 별도 도구 없이 Claude Code 안에서 바로 가능해지지 않을까 싶습니다. 에러 알림이 오면 Agent Teams가 알아서 팀을 구성해서, 한 팀원은 로그를 분석하고, 다른 팀원은 관련 코드를 찾고, 또 다른 팀원은 수정 PR을 작성하는 식으로요.

커뮤니티가 먼저 보여준 패턴이 공식 기능이 되는 흐름이 계속된다면, 이런 운영 자동화도 결국 Claude Code에 녹아들 거라고 생각합니다.

## 마치며: 그래서 지금 뭘 선택해야 하나

이 글을 읽고 "그래서 나는 뭘 써야 해?"라는 질문이 남을 수 있을 것 같습니다.

**"지금 당장은"** Agent Teams로 시작하는 걸 추천합니다. 공식 기능이라 밴 리스크가 없고, 설정 하나면 바로 쓸 수 있고, Anthropic이 계속 개선할 거니까요. oh-my-claudecode의 사전 정의된 에이전트가 편리한 건 사실이지만, 커뮤니티 도구는 결국 공식 기능이 따라잡으면 유지보수가 멈추는 경우가 많습니다.

다만 "지금 당장"이라고 표현한 이유가 있습니다. 위 모든 일이 한 달 만에 벌어졌다는 점에서 알 수 있듯이, AI 에이전트 생태계는 매우 빠르게 변하고 있습니다. 오늘 유행했던 게, 혁신이라 말했던 게 내일 뒤쳐지고 있는 상황들이 벌어지고 있는 것 같습니다. 정말 미친 세상이다 싶기도 하고 이 속도가 말이되나 싶기도 합니다. 앞서진 못해도 뒤쳐지지 않으려면 빠르게 적응하는 수밖에 없다고 생각합니다.

결국 지금 상황에서 "멀티 에이전트를 어떻게 하면 잘 쓰느냐"는 건 **작업을 어떻게 분할하고, 각 에이전트에게 어떤 역할과 맥락을 줄 것인가**의 문제라고 생각합니다. 도구가 공식이든 커뮤니티든, 이 설계 능력이 없으면 에이전트 여러 개를 돌려도 결과물 품질이 안 나옵니다. 저도 MSA 아키텍처 문서를 만들면서 느꼈는데, 팀 구성을 어떻게 잡느냐에 따라 결과 차이가 컸습니다.

이번 한 달간의 흐름에서 제가 가장 크게 느낀 건 이겁니다. **커뮤니티 도구는 "이런 게 가능하다"를 증명하는 프로토타입이고, 플랫폼 기능은 그걸 안정적으로 쓸 수 있게 만든 제품입니다.** 둘 다 필요하고, 이 순환이 생태계를 발전시킵니다. 다만 Anthropic이 이 순환에서 커뮤니티와 더 투명하게 소통했으면 하는 바람은 여전히 있습니다.

이전에 [AI 코딩 툴과 협업하는 법]({{< relref "/blog/trends/ai-agent-co-work" >}})에서 AI와 협업하는 방법에 대해 쓴 적이 있는데, 그때는 "에이전트 하나를 잘 쓰는 법"이었습니다. 지금은 **"여러 에이전트를 어떻게 설계하느냐"** 로 한달만에 질문이 바뀌게 되었네요.

긴 글 읽어주셔서 감사합니다.

## Reference

- [Claude Code Agent Teams 공식 문서](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Sub-Agents 공식 문서](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Custom Agents 공식 문서](https://code.claude.com/docs/en/custom-agents)
- [Claude Opus 4.6 발표](https://www.anthropic.com/news/claude-opus-4-6)
- [oh-my-opencode GitHub](https://github.com/code-yeongyu/oh-my-opencode)
- [oh-my-claudecode GitHub](https://github.com/Yeachan-Heo/oh-my-claudecode)
- [OpenCode GitHub](https://github.com/anomalyco/opencode)
- [OpenClaw](https://openclaw.ai/)
- [GitHub Issue #6930 - OpenCode ToS Ban](https://github.com/anomalyco/opencode/issues/6930)
- [Hacker News - Anthropic Blocking OpenCode](https://news.ycombinator.com/item?id=46625918)
- [VentureBeat - Anthropic Cracks Down on Unauthorized Claude Usage](https://venturebeat.com/technology/anthropic-cracks-down-on-unauthorized-claude-usage-by-third-party-harnesses)
- [claude-sneakpeek GitHub](https://github.com/mikekelly/claude-sneakpeek)
- [DHH 트위터 - Anthropic 차단 비판](https://x.com/dhh/status/2009716350374293963)
- [Paddo.dev - Anthropic's Walled Garden Crackdown](https://paddo.dev/blog/anthropic-walled-garden-crackdown/)
- [Paddo.dev - Claude Code Hidden Swarm](https://paddo.dev/blog/claude-code-hidden-swarm/)
- [CNBC - OpenClaw: Open-source AI agent rise, controversy](https://www.cnbc.com/2026/02/02/openclaw-open-source-ai-agent-rise-controversy-clawdbot-moltbot-moltbook.html)
- [GitHub Blog - Copilot Chat in GitHub Mobile](https://github.blog/changelog/2024-10-29-copilot-chat-in-github-mobile/)
