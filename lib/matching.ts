import { createTranslator, type Translator } from "./i18n";
import type { Announcement, UserProfile } from "./store";

export type Verdict = "eligible" | "ineligible" | "check";

export interface MatchResult {
  verdict: Verdict;
  reasons: string[];
  /** Review일 때 사용자가 원문에서 확인해야 할 항목 */
  reviewItems: string[];
  /** 관심사·기술 키워드 겹침 수 — 추천 정렬용 */
  score: number;
}

/** "전국", "제한 없음" 같은 값은 지역 제한이 아닌 것으로 본다. */
const OPEN_REGION_PATTERN = /전국|제한\s*없|무관/;

/** 전공 요건 문구를 토큰으로 쪼개 학과명과 부분 일치시킨다. (예: "컴퓨터공학·소프트웨어 관련 전공" ↔ "컴퓨터공학과") */
const MAJOR_STOPWORDS = new Set(["관련", "전공", "계열", "분야", "무관", "학과", "학부"]);

/** 프로필로 자동 판정하기 어려운 조항 — Review로 보낸다. */
const AMBIGUOUS_CLAUSE =
  /평점|학점|GPA|성적|gpa|이수|수강|수상|우대|제외|자격증|어학|TOEIC|토익|토플|포트폴리오|경력|인턴|필수과목|선수과목|선수\s*과목|특정\s*과목|휴학생\s*제외|재학생만/i;

function majorMatches(majors: string[], department: string): boolean {
  return majors.some((major) => {
    if (department.includes(major) || major.includes(department)) {
      return true;
    }
    const tokens = major.match(/[가-힣A-Za-z]{2,}/g) ?? [];
    return tokens.some((token) => !MAJOR_STOPWORDS.has(token) && department.includes(token));
  });
}

/** 재학/휴학/졸업을 한·영 표기 모두 같은 토큰으로 맞춘다. */
function normalizeStatusToken(value: string): string {
  const v = value.toLowerCase().replace(/\s+/g, "");
  if (/휴학|onleave|leave/.test(v)) {
    return "leave";
  }
  if (/졸업|graduat/.test(v)) {
    return "graduated";
  }
  if (/재학|enrolled|재적/.test(v)) {
    return "enrolled";
  }
  return v;
}

function statusMatches(rules: string[], profileStatus: string): boolean {
  const profileToken = normalizeStatusToken(profileStatus);
  return rules.some((rule) => {
    const ruleToken = normalizeStatusToken(rule);
    return (
      ruleToken === profileToken ||
      profileStatus.includes(rule) ||
      rule.includes(profileStatus)
    );
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
      reviewItems: [t("match.reviewNoProfile")],
      score: 0,
    };
  }

  const rules = announcement.rules ?? {};
  const reasons: string[] = [];
  const reviewItems: string[] = [];
  let ineligible = false;
  let needCheck = false;

  const markCheck = (reason: string, item: string) => {
    needCheck = true;
    reasons.push(reason);
    reviewItems.push(item);
  };

  if (rules.grades && rules.grades.length > 0) {
    const grades = rules.grades.join("·");
    if (profile.grade == null) {
      markCheck(t("match.gradeMissing", { grades }), t("match.reviewGrade", { grades }));
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
      markCheck(t("match.statusMissing", { status }), t("match.reviewStatus", { status }));
    } else if (!statusMatches(rules.status, profile.enrollment_status)) {
      ineligible = true;
      reasons.push(t("match.statusFail", { status, current: profile.enrollment_status }));
    } else {
      reasons.push(t("match.statusOk", { status: profile.enrollment_status }));
    }
  }

  if (rules.max_age != null || rules.min_age != null) {
    if (profile.birth_year == null) {
      markCheck(t("match.ageMissing"), t("match.reviewAge"));
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
      markCheck(t("match.majorMissing", { majors }), t("match.reviewMajor", { majors }));
    } else if (!majorMatches(rules.majors, profile.department)) {
      markCheck(
        t("match.majorCheck", { majors, department: profile.department }),
        t("match.reviewMajor", { majors }),
      );
    } else {
      reasons.push(t("match.majorOk", { department: profile.department }));
    }
  }

  if (rules.region && !OPEN_REGION_PATTERN.test(rules.region)) {
    markCheck(t("match.regionCheck", { region: rules.region }), t("match.reviewRegion", { region: rules.region }));
  }

  if (rules.team_size) {
    reasons.push(t("match.team", { team: rules.team_size }));
  }

  if (rules.courses && rules.courses.length > 0) {
    for (const course of rules.courses) {
      markCheck(t("match.courseCheck", { course }), t("match.reviewCourse", { course }));
    }
  }

  if (rules.preferred && rules.preferred.length > 0) {
    for (const item of rules.preferred) {
      markCheck(t("match.preferredCheck", { item }), t("match.reviewPreferred", { item }));
    }
  }

  if (rules.review_items && rules.review_items.length > 0) {
    for (const item of rules.review_items) {
      markCheck(t("match.reviewClause", { item }), item);
    }
  }

  if (rules.etc) {
    if (AMBIGUOUS_CLAUSE.test(rules.etc)) {
      markCheck(t("match.etcCheck", { etc: rules.etc }), t("match.reviewEtc", { etc: rules.etc }));
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
    reviewItems,
    score,
  };
}
