import type { Translator } from "./i18n";
import type { MatchResult } from "./matching";
import type { Announcement } from "./store";

export type DemoNotice = Announcement & { match: MatchResult };

export const DEMO_NOTICE_ID = "demo-hero-notice";

export function createDemoNotice(t: Translator): DemoNotice {
  return {
    id: DEMO_NOTICE_ID,
    category: "공모전/해커톤",
    title: t("hero.demoTitle"),
    organizer: "Upstage",
    field: t("hero.demoField"),
    apply_start: "2026-08-01",
    apply_end: "2026-08-31",
    result_date: "2026-09-10",
    benefits: t("hero.demoBenefits"),
    contact: t("hero.demoContact"),
    apply_url: "https://www.upstage.ai/",
    summary: [t("hero.demoSummary1"), t("hero.demoSummary2"), t("hero.demoSummary3")],
    rules: {
      majors: ["Computer Science", "Artificial Intelligence", "Software"],
      status: ["Enrolled", "On leave", "Expected graduate"],
      team_size: "1–4",
    },
    todo_checklist: [t("hero.demoTodo1"), t("hero.demoTodo2"), t("hero.demoTodo3")],
    sourceFile: null,
    sourceUrl: "https://www.upstage.ai/",
    createdAt: "2026-08-01T00:00:00.000Z",
    match: {
      verdict: "eligible",
      score: 96,
      reasons: [t("hero.demoReasonFit"), t("hero.demoReasonStatus")],
      reviewItems: [],
    },
  };
}

export function createDemoRecommendation(t: Translator) {
  return { score: 96, reason: t("hero.demoReason") };
}
