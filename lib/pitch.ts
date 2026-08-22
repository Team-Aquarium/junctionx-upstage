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
    time: "0:00 – 0:20",
    title: { ko: "타이틀", en: "Title" },
    markdown: {
      ko: `안녕하세요, Team Aquarium입니다.

저희는 공고문을 분석해서 **지원 가능 여부**까지 바로 알려주는

Upstage Document Agent **모아보라**를 만들었습니다.

**Understand → Judge → Act**

문서를 이해하는 것을 넘어, 일을 끝내는 서비스입니다.`,
      en: `Hello, we are Team Aquarium.

We built **Moabora**.

It is an Upstage Document Agent that analyzes notices and tells you

**whether you can apply** — instantly.

**Understand → Judge → Act**

A service that goes beyond understanding documents to actually getting the work done.`,
    },
  },
  {
    n: 2,
    time: "0:20 – 0:50",
    title: { ko: "PROBLEM", en: "PROBLEM" },
    markdown: {
      ko: `공고는 정말 많습니다.

그런데 정작 “내가 지원할 수 있는지”는 아무도 알려주지 않습니다.

대학생 20명을 설문한 결과,

- **70%**가 “첨부파일(HWP·PDF·포스터)을 열고 긴 요강을 읽는 것”이 가장 고통스럽다고 답했습니다.
- **65%**가 “본문 속에 숨겨진 자격 조항을 찾는 것”,
- **55%**가 “내 스펙과 맞는 공고를 고르는 것”을 가장 큰 부담으로 꼽았습니다.

학생들이 기회를 놓치는 이유는

목록이 없어서가 아니라, **비정형 문서를 읽고 대조하는 비용** 때문입니다.`,
      en: `Notices are everywhere.

But no one tells you whether **you are actually eligible**.

We surveyed 20 university students:

- **70%** said the most painful part is opening attachments (HWP, PDF, posters) and reading long briefs.
- **65%** said finding buried qualification clauses.
- **55%** said matching opportunities to their own profile.

Students miss opportunities not because there are no listings,

but because of the **cost of reading unstructured documents**.`,
    },
  },
  {
    n: 3,
    time: "0:50 – 1:20",
    title: { ko: "INSIGHT", en: "INSIGHT" },
    markdown: {
      ko: `기존 서비스는 여기서 멈춥니다.

위비티나 콘테스트코리아는 링크만 모아줄 뿐입니다.

첨부 HWP나 포스터 이미지를 **읽어주지 않습니다**.

왜냐하면 이 문제는 단순한 텍스트 검색이 아니라,

**비정형 문서 이해**이기 때문입니다.

테이블, 스탬프, 스캔본, 한글 문서(HWP)까지 정확하게 읽어야 합니다.

이 문제를 풀 수 있는 건 **Upstage Document AI**뿐입니다.

Document Parse → Information Extraction → Solar 추론 스택이

정확히 이 병목을 해결합니다.

베타 테스트 결과,

맞는 공고 5개를 찾는 시간이 **23분에서 5분**으로 줄었습니다.

**78% 시간 단축, 약 4.6배** 빨라졌습니다.`,
      en: `Existing services stop here.

Wevity and ContestKorea only collect links.

They do **not** read the attached HWP files or poster images.

Because this is not a simple text-search problem.

It is a **document-understanding problem** — tables, stamps, scans, and Korean HWP files.

Only **Upstage Document AI** can solve this.

Document Parse → Information Extraction → Solar reasoning

is the exact stack that removes this bottleneck.

In our beta test,

finding 5 matching notices dropped from **23 minutes to 5 minutes**.

**78% time saved — about 4.6× faster**.`,
    },
  },
  {
    n: 4,
    time: "1:20 – 1:50",
    title: { ko: "SOLUTION", en: "SOLUTION" },
    markdown: {
      ko: `모아보라는 Upstage만이 가능한 세 단계로 일을 끝냅니다.

**01 Understand**

PDF, HWP, 포스터, HTML까지 모두 읽어 구조화된 필드로 만듭니다.

일반 LLM이나 다른 도구로는 불가능한 레이아웃과 OCR 정확도를 사용합니다.

**02 Judge**

내 프로필과 실시간으로 대조해서

Eligible / Review / Ineligible을 판정하고, 사유까지 명시합니다.

**03 Act**

Solar Pro 4가 0~100점 적합도 점수와 추천 사유를 주고,

제출 체크리스트까지 만들어줍니다.

“이해하는 것”에서 끝나지 않고,

**지원 결정과 준비**까지 한 번에 해결하는 것.

이것이 Upstage Studio가 가능하게 한 핵심입니다.`,
      en: `Moabora finishes the work in three stages that only Upstage makes possible.

**01 Understand**

It reads PDF, HWP, posters, and HTML and turns them into structured fields.

This level of layout and OCR accuracy is not possible with ordinary LLMs or other tools.

**02 Judge**

It cross-checks against your profile in real time

and returns Eligible / Review / Ineligible — with explicit reasons.

**03 Act**

Solar Pro 4 gives a 0–100 fit score with a one-sentence rationale

and generates a submission checklist.

It does not stop at understanding.

It delivers the **application decision and preparation** in one pass.

This is what Upstage Studio enables.`,
    },
  },
  {
    n: 5,
    time: "1:50 – 2:15",
    title: { ko: "USER JOURNEY", en: "USER JOURNEY" },
    markdown: {
      ko: `사용자는 단 4단계로 끝냅니다.

1. **프로필 만들기** (1분)
    
    재학증명서, GitHub 링크, 짧은 소개글 — Upstage UIE와 Solar가 병합합니다.
    
2. **공고 모으기**
    
    파일 업로드, URL, 또는 위비티·콘테스트코리아 자동 수집.
    
    HWP 첨부까지 에이전트가 직접 읽습니다.
    
3. **피드에서 확인**
    
    카드마다 자격 뱃지와 Solar 적합도 점수가 이미 붙어 있습니다.
    
4. **상세에서 행동**
    
    판정 사유, 확인 필요 체크리스트, 제출 준비물, 문서 챗으로 바로 이어갑니다.`,
      en: `Users finish in just four steps.

1. **Create a profile** (1 minute)
    
    Certificate, GitHub link, or short note — Upstage UIE and Solar merge everything.
    
2. **Collect notices**
    
    File upload, URL paste, or one-click crawl from Wevity and ContestKorea.
    
    The agent itself reads the HWP attachments.
    
3. **Check the feed**
    
    Every card already has an eligibility badge and a Solar fit score.
    
4. **Take action on the detail page**
    
    Verdict reasons, review checklist, submission checklist, and direct hand-off to Document Chat.`,
    },
  },
  {
    n: 6,
    time: "2:15 – 2:50",
    title: { ko: "UPSTAGE STUDIO", en: "UPSTAGE STUDIO" },
    markdown: {
      ko: `모든 공고는 **하나의 4노드 Studio 에이전트**를 통과합니다.

우회 경로는 **절대 없습니다**.

이것이 트랙 요구사항을 가장 충실히 지킨 방식입니다.

1. **Parse** — Document AI + OCR로 마크다운 변환 (HWP·포스터까지)
2. **Classify** — 6종으로 분류
3. **Extract** — 10개 핵심 필드 추출
4. **Instruct** — 요약 + 자격 규칙 JSON + 체크리스트 생성

REST API로 완전히 통합되어 있고,

폴링 스냅샷을 누적해서 중간 결과까지 모두 보존합니다.

다른 도구로는 이 수준의 안정적인 다단계 문서 파이프라인을 만들기 어렵습니다.`,
      en: `Every notice flows through **one single 4-node Studio agent**.

There is **zero bypass**.

This is the purest way to meet the track requirement.

1. **Parse** — Document AI + OCR to clean Markdown (including HWP and posters)
2. **Classify** — 6 categories
3. **Extract** — 10 key fields
4. **Instruct** — Summary + eligibility-rules JSON + checklist

Fully integrated via REST API.

We accumulate polling snapshots so every intermediate node output is preserved.

Building a stable multi-stage document pipeline at this level is extremely difficult with any other tool.`,
    },
  },
  {
    n: 7,
    time: "2:50 – 3:15",
    title: { ko: "UPSTAGE PRODUCTS", en: "UPSTAGE PRODUCTS" },
    markdown: {
      ko: `Upstage의 **4개 제품 라인**을 모두 프로덕션으로 사용합니다.

단순 조합이 아니라, 실제로 돌아가는 서비스에 모두 넣었습니다.

- **Studio Agents** — 핵심 4노드 파이프라인
- **Document Parse** — 고정밀 OCR과 레이아웃 분석 (HWP·포스터의 핵심)
- **Information Extract** — 재학증명서와 챗 툴
- **Solar Pro 4** — 적합도 점수, 프로필 추출, 멀티툴 오케스트레이션

이 네 가지를 한 서비스 안에서 유기적으로 연결한 것이

모아보라의 기술적 차별점입니다.`,
      en: `We use **all four Upstage product lines** in production.

Not a simple combination — every one of them runs inside a real service.

- **Studio Agents** — Core 4-node pipeline
- **Document Parse** — High-precision OCR and layout analysis (the key to HWP and posters)
- **Information Extract** — Certificate parsing and chat tool
- **Solar Pro 4** — Fit scores, profile extraction, multi-tool orchestration

Connecting these four products organically inside one service

is Moabora’s technical differentiator.`,
    },
  },
  {
    n: 8,
    time: "3:15 – 3:40",
    title: { ko: "ENGINEERING", en: "ENGINEERING" },
    markdown: {
      ko: `실제 한국어 문서의 엣지 케이스를 다루기 위해

서비스 수준의 견고함을 갖췄습니다.

- 이중 인코딩 JSON과 인용 마커를 정제
- 폴링 스냅샷을 누적해서 모든 노드 출력을 보존
- 실시간 NDJSON 스트리밍으로 AI 추론 과정을 투명하게 공개
- 새로고침에도 이어지는 세션
- 이중 캐시로 비용과 지연을 제어
- 6개 규칙을 결정론적으로 판정하고 사유를 설명

Upstage의 문서 처리 능력을 최대한 끌어내면서,

투명성과 재현성까지 확보했습니다.`,
      en: `To handle real Korean document edge cases,

we built service-grade reliability.

- Sanitization of double-encoded JSON and citation markers
- Accumulating polling snapshots so every node output is kept
- Live NDJSON streams that make the AI reasoning fully transparent
- Sessions that survive browser refresh
- Dual-layer caching for cost and latency control
- Deterministic 6-rule matcher with clear per-rule reasons

We pushed Upstage’s document capabilities to the maximum

while securing transparency and reproducibility.`,
    },
  },
  {
    n: 9,
    time: "3:40 – 4:00",
    title: { ko: "SCOPE & ROADMAP", en: "SCOPE & ROADMAP" },
    markdown: {
      ko: `3일 안에 엔드투엔드 루프를 완성하는 데 집중했습니다.

출시한 것:

3가지 인제스트 경로, 4노드 에이전트, 다중 프로필 경로, 자격 엔진, Solar 추천, Document Chat, Supabase + Docker 배포.

의도적으로 미룬 것:

멀티 유저 인증, 푸시 알림, 스케줄 크롤러.

스키마는 이미 RLS 준비 상태이고,

다음 단계로 인증, 알림, 지원서 초안 생성, 팀 매칭까지 로드맵을 명확히 잡았습니다.`,
      en: `We focused on completing the end-to-end loop within three days.

What we shipped:

3 ingest paths, 4-node agent, multi-path profiles, eligibility engine, Solar recommendations, Document Chat, Supabase + Docker deployment.

What we deliberately scoped out:

Multi-user auth, push notifications, scheduled crawlers.

The schema is already RLS-ready.

The roadmap is clear: auth, alerts, application-draft generation, team matching.`,
    },
  },
  {
    n: 10,
    time: "4:00 – 4:20",
    title: { ko: "WHY IT HOLDS UP", en: "WHY IT HOLDS UP" },
    markdown: {
      ko: `우리는 네 가지를 실제로 구현했습니다.

- **Upstage Technology** — 커스텀 4노드 에이전트 + 4개 제품 전체 사용. 우회 없음.
- **Service Completeness** — 완전한 엔드투엔드 루프와 라이브 배포
- **Idea Creativity** — “링크 모음”이 아니라 “지원 판정”으로 패러다임을 바꿈. HWP·포스터까지 읽는 서비스는 Upstage Document AI라서 가능했습니다.
- **Product Planning** — 설문 기반 문제 정의, 명확한 스코프, 확장 가능한 설계

데모용 껍데기가 아니라,

**Upstage만이 가능하게 한** 실제 서비스로 만들었습니다.`,
      en: `We actually shipped four bets.

- **Upstage Technology** — Custom 4-node agent + all four products. Zero bypass.
- **Service Completeness** — Full end-to-end loop and live deployment
- **Idea Creativity** — Not “collecting links” but “delivering application verdicts.” Reading HWP and posters is possible only because of Upstage Document AI.
- **Product Planning** — Survey-backed problem definition, clear scope, extensible design

This is not a demo shell.

It is a real service that **only Upstage made possible**.`,
    },
  },
  {
    n: 11,
    time: "4:20 – 4:30",
    title: { ko: "LIVE DEMO", en: "LIVE DEMO" },
    markdown: {
      ko: `라이브 서비스는 이미 배포되어 있습니다.

**moabora.sharp0802.com**

에이전트가 요강을 읽습니다.

당신은 그냥 지원하면 됩니다.

모아보라, Team Aquarium이었습니다.

감사합니다.`,
      en: `The live service is already running.

**moabora.sharp0802.com**

The agent reads the brief.

You just apply.

Moabora, Team Aquarium.

Thank you.`,
    },
  },
];
