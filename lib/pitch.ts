import type { Locale } from "@/lib/i18n/types";

export type Localized<T> = Record<Locale, T>;

export type PitchSlide = {
  n: number;
  time: string;
  title: Localized<string>;
  markdown: Localized<string>;
};

export const PITCH_DURATION = "4:30";
export const PITCH_LIVE_URL = "https://moabora.sharp0802.com";

export const PITCH_SLIDES: PitchSlide[] = [
  {
    n: 1,
    time: "0:00 – 0:15",
    title: { ko: "타이틀", en: "Title" },
    markdown: {
      ko: `안녕하세요, Team Aquarium입니다.

공고문을 읽고 **지원 가능 여부까지** 바로 알려주는

Upstage Document Agent, **모아보라**입니다.

에이전트가 요강을 읽습니다. 당신은 지원하면 됩니다.`,
      en: `Hello. We are Team Aquarium.

This is **Moabora** — an Upstage Document Agent

that reads a notice and tells you **whether you can apply**.

The agent reads the brief. You apply.`,
    },
  },
  {
    n: 2,
    time: "0:15 – 0:40",
    title: { ko: "PROBLEM", en: "PROBLEM" },
    markdown: {
      ko: `공고는 많습니다. 문제는 목록이 아닙니다.

**“내가 지원할 수 있나?”** 를 아무도 답하지 않습니다.

대학생 20명 설문:

- **70%** — HWP·PDF·포스터를 열고 긴 요강을 읽는 일
- **65%** — 본문에 숨은 자격 조항을 찾는 일
- **55%** — 내 스펙에 맞는 공고를 고르는 일

기회를 놓치는 이유는 공고가 없어서가 아니라,

**비정형 문서를 읽고 대조하는 비용** 때문입니다.`,
      en: `Notices are everywhere. The problem is not the list.

No one answers **“Can I apply?”**

We asked 20 students. The pain is consistent:

- **70%** — opening HWP, PDF, and posters to scan long briefs
- **65%** — hunting buried eligibility clauses
- **55%** — picking notices that actually fit

Students miss opportunities not from a lack of listings,

but from the **cost of reading unstructured documents**.`,
    },
  },
  {
    n: 3,
    time: "0:40 – 1:05",
    title: { ko: "INSIGHT", en: "INSIGHT" },
    markdown: {
      ko: `기존 보드는 여기서 멈춥니다.

위비티와 콘테스트코리아는 **링크만** 모아줍니다.

첨부 HWP와 포스터는 읽지 않습니다.

이건 검색 문제가 아닙니다. **문서 이해** 문제입니다.

테이블, 스탬프, 스캔본, 한글 문서까지 읽어야 합니다.

이 병목을 푸는 스택은 하나뿐입니다.

**Document Parse → Information Extract → Solar.**

베타 테스트에서 맞는 공고 5개를 찾는 시간이

**23분에서 5분**으로 줄었습니다. 약 **4.6배**.`,
      en: `Existing boards stop at the link.

Wevity and ContestKorea collect URLs.

They do **not** read the attached HWP or the poster.

This is not a search problem. It is a **document-understanding** problem.

Tables. Stamps. Scans. Korean HWP.

Only one stack clears that bottleneck:

**Document Parse → Information Extract → Solar.**

In our beta, finding five matching notices dropped from

**23 minutes to 5.** About **4.6×** faster.`,
    },
  },
  {
    n: 4,
    time: "1:05 – 1:25",
    title: { ko: "SOLUTION", en: "SOLUTION" },
    markdown: {
      ko: `모아보라는 세 단계로 일을 끝냅니다.

**Understand** — PDF, HWP, 포스터, HTML을 구조화된 필드로.

**Judge** — 내 프로필과 6개 규칙을 대조해

Eligible / Needs review / Not eligible. 사유까지.

**Act** — Solar가 0–100 적합도 점수와 제출 체크리스트를 만듭니다.

이해하는 데서 멈추지 않습니다.

**지원 결정과 준비**까지 한 번에 끝냅니다.`,
      en: `Moabora finishes the job in three moves.

**Understand** — PDF, HWP, posters, HTML become structured fields.

**Judge** — six rules against your profile.

Eligible / Needs review / Not eligible — with reasons.

**Act** — Solar scores fit 0–100 and builds a submission checklist.

We do not stop at understanding.

We deliver the **decision and the prep**.`,
    },
  },
  {
    n: 5,
    time: "1:25 – 1:40",
    title: { ko: "USER JOURNEY", en: "USER JOURNEY" },
    markdown: {
      ko: `사용자는 네 걸음입니다.

1. **프로필** — 재학증명서, GitHub, 짧은 메모. 1분.
2. **수집** — 파일, URL, 또는 위비티·콘테스트코리아 크롤.
3. **피드** — 카드마다 자격 뱃지와 Solar 점수가 이미 붙어 있습니다.
4. **지원** — 사유, 체크리스트, 문서 챗.

지금부터 실제 화면을 보여드리겠습니다.`,
      en: `Four steps for the user.

1. **Profile** — certificate, GitHub, or a short note. One minute.
2. **Collect** — a file, a URL, or a crawl from Wevity and ContestKorea.
3. **Feed** — every card already has a verdict and a Solar score.
4. **Apply** — reasons, a checklist, then Document Chat.

Let me walk the product.`,
    },
  },
  {
    n: 6,
    time: "1:40 – 1:55",
    title: { ko: "DEMO · FEED", en: "DEMO · FEED" },
    markdown: {
      ko: `공고 피드입니다.

읽기 전에 이미 판정이 끝나 있습니다.

초록은 **Eligible**. 노랑은 **Needs review**. 빨강은 **Not eligible**.

각 카드에 Solar 적합도 점수가 붙어 있습니다.

대학원 논문 대회는 대학원생 한정 — 그래서 자격 미달입니다.

목록을 훑는 게 아니라, **이미 걸러진 결과**를 보는 겁니다.`,
      en: `This is the notice feed.

The judging is done before you read.

Green is **Eligible**. Amber is **Needs review**. Red is **Not eligible**.

Every card carries a Solar fit score.

The graduate thesis contest is graduate-only — so it is marked Not eligible.

You are not browsing a list. You are looking at a **filtered verdict**.`,
    },
  },
  {
    n: 7,
    time: "1:55 – 2:10",
    title: { ko: "DEMO · INGEST", en: "DEMO · INGEST" },
    markdown: {
      ko: `공고를 넣는 방법은 세 가지입니다.

링크를 붙이거나, 파일을 올리거나, 웹에서 수집합니다.

세 경로 모두 **같은 4노드 Studio 에이전트**를 탑니다.

Parse, Classify, Extract, Instruct.

우회 경로는 없습니다. 단계마다 로그가 실시간으로 흐릅니다.`,
      en: `Three ways to add a notice.

Paste a link. Drop a file. Or collect from the web.

All three hit the **same 4-node Studio agent**.

Parse. Classify. Extract. Instruct.

No bypass. Every stage streams a live log.`,
    },
  },
  {
    n: 8,
    time: "2:10 – 2:25",
    title: { ko: "DEMO · PROFILE", en: "DEMO · PROFILE" },
    markdown: {
      ko: `프로필은 직접 채우지 않습니다.

GitHub 링크는 Solar가 관심사와 기술을 뽑습니다.

재학증명서는 Information Extract가 이름, 학년, 학적을 채웁니다.

관심사는 추천에. 학년과 학적 상태는 자격 판정에.

두 데이터가 갈라져야, 판정이 정확해집니다.`,
      en: `You do not fill the profile by hand.

A GitHub link — Solar extracts interests and skills.

An enrollment certificate — Information Extract fills name, year, status.

Interests drive recommendations. Year and enrollment drive eligibility.

Those two jobs stay separate, so the verdict stays honest.`,
    },
  },
  {
    n: 9,
    time: "2:25 – 2:40",
    title: { ko: "DEMO · NOTICE", en: "DEMO · NOTICE" },
    markdown: {
      ko: `상세 페이지는 판정의 **근거**입니다.

Solar 적합도 96. 한 줄 이유.

규칙별 체크 — 전공, 학적, 팀 규모.

그리고 에이전트가 만든 제출 체크리스트.

공식 지원과 문서 챗으로 바로 넘어갑니다.`,
      en: `The detail page is the **receipt**.

Solar fit 96. One-line rationale.

Per-rule checks — major, enrollment, team size.

Plus a submission checklist the agent wrote.

From here you apply, or you ask Document Chat.`,
    },
  },
  {
    n: 10,
    time: "2:40 – 2:55",
    title: { ko: "DEMO · DOC CHAT", en: "DEMO · DOC CHAT" },
    markdown: {
      ko: `애매한 조항은 원문에 직접 묻습니다.

“휴학생도 지원 가능한가?”

Solar Pro 4가 Document Parse와 Information Extract를

**도구로 호출**하고, 추론을 스트리밍합니다.

답은 요강 3페이지에 있습니다. 추측이 아닙니다.`,
      en: `Ambiguous clauses go to the document itself.

“Can students on leave apply?”

Solar Pro 4 **calls Document Parse and Information Extract as tools**

and streams its reasoning.

The answer is on page 3 of the brief. Not a guess.`,
    },
  },
  {
    n: 11,
    time: "2:55 – 3:15",
    title: { ko: "UPSTAGE STUDIO", en: "UPSTAGE STUDIO" },
    markdown: {
      ko: `핵심은 이 한 줄입니다.

**모든 공고가 하나의 4노드 Studio 에이전트를 통과합니다.**

1. Parse — Document AI + OCR. HWP와 포스터 포함.
2. Classify — 6종.
3. Extract — 핵심 필드 10개.
4. Instruct — 요약, 자격 규칙 JSON, 체크리스트.

트랙 요구사항을 우회하지 않았습니다.

Studio가 핵심 문서 처리를 담당합니다.`,
      en: `The core claim is one sentence.

**Every notice goes through one 4-node Studio agent.**

1. Parse — Document AI plus OCR. HWP and posters included.
2. Classify — six types.
3. Extract — ten fields.
4. Instruct — summary, eligibility-rules JSON, checklist.

We did not bypass the track requirement.

Studio powers the core document stages.`,
    },
  },
  {
    n: 12,
    time: "3:15 – 3:30",
    title: { ko: "UPSTAGE PRODUCTS", en: "UPSTAGE PRODUCTS" },
    markdown: {
      ko: `Upstage 제품 네 줄을 **프로덕션에서** 씁니다.

- **Studio Agents** — 공고 파이프라인
- **Document Parse** — HWP·포스터 OCR
- **Information Extract** — 재학증명서와 챗 스키마
- **Solar Pro 4** — 적합도, 프로필, 툴 오케스트레이션

슬라이드용 조합이 아닙니다.

라이브 서비스 안에서 네 제품이 같이 돕니다.`,
      en: `All four Upstage product lines run **in production**.

- **Studio Agents** — the notice pipeline
- **Document Parse** — OCR for HWP and posters
- **Information Extract** — certificates and chat schemas
- **Solar Pro 4** — fit scores, profiles, tool orchestration

This is not a combo slide.

The four products run together inside a live service.`,
    },
  },
  {
    n: 13,
    time: "3:30 – 3:50",
    title: { ko: "ENGINEERING", en: "ENGINEERING" },
    markdown: {
      ko: `한국어 문서의 엣지 케이스를 서비스로 막았습니다.

이중 인코딩 JSON과 인용 마커를 정제합니다.

폴링 스냅샷을 누적해 중간 노드 출력을 잃지 않습니다.

NDJSON으로 단계와 Solar 추론을 실시간으로 보여줍니다.

새로고침해도 세션이 이어지고, 이중 캐시로 과금을 막습니다.

6개 규칙은 결정론적으로 판정하고, 사유를 남깁니다.`,
      en: `We treated Korean-document edge cases as product work.

We sanitize double-encoded JSON and citation markers.

We accumulate polling snapshots so no node output is lost.

NDJSON streams every stage and Solar’s reasoning live.

Sessions survive refresh. Dual caches stop duplicate bills.

Six rules judge deterministically — and leave a reason.`,
    },
  },
  {
    n: 14,
    time: "3:50 – 4:05",
    title: { ko: "SCOPE", en: "SCOPE" },
    markdown: {
      ko: `3일에 루프를 완성하는 데 집중했습니다.

넣은 것: 인제스트 3경로, 4노드 에이전트, 자격 엔진, Solar 추천, 문서 챗, 배포.

뺀 것: 멀티 유저 인증, 푸시, 스케줄 크롤러.

스키마는 이미 RLS 준비입니다.

다음은 인증, 마감 알림, 지원서 초안, 팀 매칭입니다.`,
      en: `We shipped the loop in three days.

In: three ingest paths, the 4-node agent, eligibility, Solar recs, Document Chat, deploy.

Out: multi-user auth, push, a cron crawler.

The schema is already RLS-ready.

Next is auth, deadline pings, application drafts, team matching.`,
    },
  },
  {
    n: 15,
    time: "4:05 – 4:20",
    title: { ko: "WHY IT HOLDS UP", en: "WHY IT HOLDS UP" },
    markdown: {
      ko: `심사 네 축을 실제로 채웠습니다.

**기술** — 커스텀 4노드 에이전트. 제품 네 줄. 우회 없음.

**완성도** — 프로필에서 챗까지, 라이브 배포.

**창의성** — 링크 모음이 아니라 지원 판정. HWP와 포스터를 읽습니다.

**기획** — 설문으로 문제를 잡고, 스코프를 잘랐습니다.

데모 껍데기가 아닙니다. **Upstage라서 가능한** 서비스입니다.`,
      en: `We filled the four judging axes.

**Technology** — a custom 4-node agent. All four products. No bypass.

**Completeness** — profile to chat, live.

**Creativity** — not a link dump. An application verdict. We read HWP and posters.

**Planning** — a survey-backed problem, and honest cuts.

This is not a demo shell. It is a service **only Upstage makes possible**.`,
    },
  },
  {
    n: 16,
    time: "4:20 – 4:30",
    title: { ko: "LIVE", en: "LIVE" },
    markdown: {
      ko: `라이브는 이미 올라가 있습니다.

**moabora.sharp0802.com**

에이전트가 요강을 읽습니다.

당신은 지원하면 됩니다.

모아보라, Team Aquarium이었습니다. 감사합니다.`,
      en: `The live service is already up.

**moabora.sharp0802.com**

The agent reads the brief.

You apply.

Moabora. Team Aquarium. Thank you.`,
    },
  },
];
