import type { Translator } from "./types";

export type CategoryFilterKey =
  | "all"
  | "contestHackathon"
  | "competition"
  | "scholarship"
  | "activity"
  | "career"
  | "others";

export const CATEGORY_FILTERS: { key: CategoryFilterKey; match: (category: string) => boolean }[] = [
  { key: "all", match: () => true },
  {
    key: "contestHackathon",
    match: (c) => /공모전|해커톤|contest|hackathon/i.test(c),
  },
  {
    key: "competition",
    match: (c) => /대회|챌린지|competition|challenge/i.test(c) && !/공모전|해커톤|contest|hackathon/i.test(c),
  },
  { key: "scholarship", match: (c) => /장학금|scholarship/i.test(c) },
  {
    key: "activity",
    match: (c) => /대외활동|서포터즈|activit|supporter/i.test(c),
  },
  { key: "career", match: (c) => /채용|인턴|job|intern|career/i.test(c) },
  { key: "others", match: (c) => c === "others" || c === "기타" || /other/i.test(c) },
];

export function localizeCategory(category: string, t: Translator): string {
  if (category === "others" || category === "기타") {
    return t("category.others");
  }
  const hit = CATEGORY_FILTERS.find((f) => f.key !== "all" && f.match(category));
  if (hit) {
    return t(`category.${hit.key}`);
  }
  return category.replace(/\//g, " · ");
}

export function ddayLabel(
  applyEnd: string | null,
  t: Translator,
): { label: string; closed: boolean; days: number | null } {
  if (!applyEnd) {
    return { label: t("common.openEnded"), closed: false, days: null };
  }
  const end = new Date(`${applyEnd}T23:59:59`);
  if (Number.isNaN(end.getTime())) {
    return { label: t("common.openEnded"), closed: false, days: null };
  }
  const days = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  if (days < 0) {
    return { label: t("common.closed"), closed: true, days };
  }
  if (days === 0) {
    return { label: t("common.dday"), closed: false, days };
  }
  return { label: `D-${days}`, closed: false, days };
}
