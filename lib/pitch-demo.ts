import type { UIMessage } from "ai";
import type { AnnouncementWithMatch } from "@/components/announcement";
import { createDemoNotice, createDemoRecommendation, DEMO_NOTICE_ID } from "@/lib/demo-notice";
import { createTranslator } from "@/lib/i18n";
import type { Translator } from "@/lib/i18n/types";
import type { UserProfile } from "@/lib/store";
import type { RecommendationItem } from "@/lib/upstage";

export function isPitchDemo(forced?: boolean): boolean {
  if (forced) {
    return true;
  }
  if (typeof window === "undefined") {
    return false;
  }
  return (
    new URLSearchParams(window.location.search).get("demo") === "1" ||
    window.location.pathname.includes("demo-hero-notice")
  );
}

export function pitchDemoBoot(forced?: boolean) {
  if (!isPitchDemo(forced)) {
    return null;
  }
  const t = createTranslator("en");
  return {
    t,
    announcements: createPitchDemoFeed(t),
    profile: createPitchDemoProfile(),
    recommendations: createPitchDemoRecs(t),
    notice: createDemoNotice(t),
    rec: createDemoRecommendation(t),
    messages: createPitchDemoChat(t),
  };
}

export function createPitchDemoProfile(): UserProfile {
  return {
    name: "Sumin Kim",
    university: "Upstage University",
    department: "Computer Science",
    grade: 3,
    enrollment_status: "재학",
    birth_year: 2003,
    interests: ["LLM agents", "Hackathons", "Document AI"],
    skills: ["TypeScript", "Next.js", "Python"],
    activities: ["JunctionX Korea 2026"],
    sources: [
      {
        type: "link",
        label: "github.com/sspzoa",
        addedAt: "2026-08-20T00:00:00.000Z",
      },
      {
        type: "file",
        label: "enrollment.pdf",
        addedAt: "2026-08-20T00:00:00.000Z",
      },
    ],
  };
}

function card(
  partial: Pick<AnnouncementWithMatch, "id" | "category" | "title" | "organizer" | "apply_end" | "benefits" | "match">,
): AnnouncementWithMatch {
  return {
    field: null,
    apply_start: "2026-08-01",
    result_date: null,
    contact: null,
    apply_url: null,
    sourceUrl: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    sourceFile: null,
    summary: [],
    rules: {},
    todo_checklist: [],
    ...partial,
  };
}

export function createPitchDemoFeed(t: Translator): AnnouncementWithMatch[] {
  const hero = createDemoNotice(t);
  return [
    {
      ...hero,
      match: {
        ...hero.match,
        reasons: [
          t("hero.demoReasonFit"),
          t("hero.demoReasonStatus"),
          "Team size 1–4 — individual applications allowed",
        ],
      },
    },
    card({
      id: "demo-supporters",
      category: "대외활동/서포터즈",
      title: "2026 Data Youth Supporters — 3rd cohort",
      organizer: "Korea Data Agency",
      apply_end: "2026-09-07",
      benefits: "Monthly stipend and a completion certificate",
      match: {
        verdict: "eligible",
        score: 82,
        reasons: ["Enrollment status met"],
        reviewItems: [],
      },
    }),
    card({
      id: "demo-scholarship",
      category: "장학금",
      title: "SW Talent Scholarship — Fall intake",
      organizer: "Future Tech Foundation",
      apply_end: "2026-09-13",
      benefits: "Full tuition",
      match: {
        verdict: "check",
        score: 71,
        reasons: ["GPA clause needs a manual check"],
        reviewItems: ["Confirm the minimum GPA in the brief"],
      },
    }),
    card({
      id: "demo-intern",
      category: "채용/인턴",
      title: "2026 Summer AI Engineer Internship",
      organizer: "Upstage",
      apply_end: "2026-09-03",
      benefits: "Intern-to-hire track",
      match: {
        verdict: "eligible",
        score: 88,
        reasons: ["Major requirement met"],
        reviewItems: [],
      },
    }),
    card({
      id: "demo-thesis",
      category: "공모전/해커톤",
      title: "National Graduate Thesis Competition",
      organizer: "Academic Society",
      apply_end: "2026-09-22",
      benefits: null,
      match: {
        verdict: "ineligible",
        score: 12,
        reasons: ["Graduate students only"],
        reviewItems: [],
      },
    }),
    card({
      id: "demo-wevity",
      category: "공모전/해커톤",
      title: "Wevity AI Service Idea Challenge",
      organizer: "Wevity",
      apply_end: "2026-09-18",
      benefits: "KRW 5M in prizes",
      match: {
        verdict: "eligible",
        score: 74,
        reasons: ["Open to enrolled undergraduates"],
        reviewItems: [],
      },
    }),
  ];
}

export function createPitchDemoRecs(t: Translator): RecommendationItem[] {
  return [
    { id: DEMO_NOTICE_ID, score: 96, reason: t("hero.demoReason") },
    {
      id: "demo-supporters",
      score: 82,
      reason: "Data and youth-program interests line up with this supporters role.",
    },
    {
      id: "demo-scholarship",
      score: 71,
      reason: "CS major fits, but the GPA rule still needs a check.",
    },
    { id: "demo-intern", score: 88, reason: "AI engineering internship matches the skill set." },
    { id: "demo-wevity", score: 74, reason: "Idea-challenge format matches prior hackathon work." },
  ];
}

export function createPitchDemoChat(_t: Translator): UIMessage[] {
  return [
    {
      id: "demo-user",
      role: "user",
      parts: [
        {
          type: "text",
          text: "Can students on leave apply to this notice?",
        },
        {
          type: "file",
          url: "/upstage/symbol.svg",
          filename: "brief.pdf",
          mediaType: "application/pdf",
        },
      ],
    },
    {
      id: "demo-assistant",
      role: "assistant",
      parts: [
        {
          type: "tool-parse_document",
          toolCallId: "demo-parse",
          state: "output-available",
          input: { docId: "doc-1" },
          output: { pages: 3, markdown: "Eligibility includes enrolled students, students on leave, and expected graduates." },
        },
        {
          type: "tool-extract_information",
          toolCallId: "demo-extract",
          state: "output-available",
          input: { schema: "eligibility" },
          output: { status: ["enrolled", "on leave", "expected graduate"] },
        },
        {
          type: "reasoning",
          text: "Page 3 lists three enrollment statuses. Leave of absence is included, so the answer is yes — with the team-wide caveat.",
          state: "done",
        },
        {
          type: "text",
          text: "Yes. Page 3 of the brief lists **enrolled students, students on leave, and expected graduates**. Every teammate must meet the same rule.",
        },
      ],
    },
  ];
}

export function markPitchDemoReady() {
  document.documentElement.classList.add("dark", "pitch-demo");
  try {
    localStorage.setItem("theme", "dark");
  } catch {
    // ignore
  }
  document.body.dataset.pitchDemo = "1";
  document.body.dataset.pitchReady = "1";
}
