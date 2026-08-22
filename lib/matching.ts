import { createTranslator, type Translator } from "./i18n";
import type { Announcement, UserProfile } from "./store";

export type Verdict = "eligible" | "ineligible" | "check";

export interface MatchResult {
  verdict: Verdict;
  reasons: string[];
  /** 관심사·기술 키워드 겹침 수 — 추천 정렬용 */
  score: number;
}

/** "전국", "제한 없음" 같은 값은 지역 제한이 아닌 것으로 본다. */
const OPEN_REGION_PATTERN = /전국|제한\s*없|무관/;

/** 전공 요건 문구를 토큰으로 쪼개 학과명과 부분 일치시킨다. (예: "컴퓨터공학·소프트웨어 관련 전공" ↔ "컴퓨터공학과") */
const MAJOR_STOPWORDS = new Set(["관련", "전공", "계열", "분야", "무관", "학과", "학부"]);

function majorMatches(majors: string[], department: string): boolean {
  return majors.some((major) => {
    if (department.includes(major) || major.includes(department)) {
      return true;
    }
    const tokens = major.match(/[가-힣A-Za-z]{2,}/g) ?? [];
    return tokens.some((token) => !MAJOR_STOPWORDS.has(token) && department.includes(token));
  });
}

export function matchAnnouncement(
  announcement: Announcement,
  profile: UserProfile | null,
  t: Translator = createTranslator("en"),
): MatchResult {
  const hay = `${announcement.title} ${announcement.field ?? ""} ${announcement.category}`.toLowerCase();
  const keywords = profile ? [...profile.interests, ...profile.skills] : [];
  const score = keywords.filter((kw) => kw && hay.includes(kw.toLowerCase())).length;

  if (!profile) {
    return {
      verdict: "check",
      reasons: [t("match.noProfile")],
      score: 0,
    };
  }

  const rules = announcement.rules ?? {};
  const reasons: string[] = [];
  let ineligible = false;
  let needCheck = false;

  if (rules.grades && rules.grades.length > 0) {
    const grades = rules.grades.join("·");
    if (profile.grade == null) {
      needCheck = true;
      reasons.push(t("match.gradeMissing", { grades }));
    } else if (!rules.grades.includes(profile.grade)) {
      ineligible = true;
      reasons.push(t("match.gradeFail", { grades, grade: profile.grade }));
    } else {
      reasons.push(t("match.gradeOk", { grade: profile.grade }));
    }
  }

  if (rules.status && rules.status.length > 0) {
    const status = rules.status.join("/");
    if (!profile.enrollment_status) {
      needCheck = true;
      reasons.push(t("match.statusMissing", { status }));
    } else if (!rules.status.some((s) => profile.enrollment_status?.includes(s))) {
      ineligible = true;
      reasons.push(t("match.statusFail", { status, current: profile.enrollment_status }));
    } else {
      reasons.push(t("match.statusOk", { status: profile.enrollment_status }));
    }
  }

  if (rules.max_age != null || rules.min_age != null) {
    if (profile.birth_year == null) {
      needCheck = true;
      reasons.push(t("match.ageMissing"));
    } else {
      const age = new Date().getFullYear() - profile.birth_year;
      if (rules.max_age != null && age > rules.max_age) {
        ineligible = true;
        reasons.push(t("match.ageMax", { max: rules.max_age, age }));
      } else if (rules.min_age != null && age < rules.min_age) {
        ineligible = true;
        reasons.push(t("match.ageMin", { min: rules.min_age, age }));
      } else {
        reasons.push(t("match.ageOk", { age }));
      }
    }
  }

  if (rules.majors && rules.majors.length > 0) {
    const majors = rules.majors.join(", ");
    if (!profile.department) {
      needCheck = true;
      reasons.push(t("match.majorMissing", { majors }));
    } else if (!majorMatches(rules.majors, profile.department)) {
      needCheck = true;
      reasons.push(t("match.majorCheck", { majors, department: profile.department }));
    } else {
      reasons.push(t("match.majorOk", { department: profile.department }));
    }
  }

  if (rules.region && !OPEN_REGION_PATTERN.test(rules.region)) {
    needCheck = true;
    reasons.push(t("match.regionCheck", { region: rules.region }));
  }

  if (rules.team_size) {
    reasons.push(t("match.team", { team: rules.team_size }));
  }

  if (rules.etc) {
    if (/평점|학점|GPA|성적|gpa/i.test(rules.etc)) {
      needCheck = true;
      reasons.push(t("match.gpaCheck", { etc: rules.etc }));
    } else {
      reasons.push(t("match.etcNote", { etc: rules.etc }));
    }
  }

  if (reasons.length === 0) {
    reasons.push(t("match.noLimits"));
  }

  return {
    verdict: ineligible ? "ineligible" : needCheck ? "check" : "eligible",
    reasons,
    score,
  };
}
