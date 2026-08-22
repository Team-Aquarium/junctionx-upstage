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
): MatchResult {
  const hay = `${announcement.title} ${announcement.field ?? ""} ${announcement.category}`.toLowerCase();
  const keywords = profile ? [...profile.interests, ...profile.skills] : [];
  const score = keywords.filter((kw) => kw && hay.includes(kw.toLowerCase())).length;

  if (!profile) {
    return {
      verdict: "check",
      reasons: ["프로필이 없어 자격을 판정할 수 없어요. 링크나 서류로 프로필을 만들어 보세요."],
      score: 0,
    };
  }

  const rules = announcement.rules ?? {};
  const reasons: string[] = [];
  let ineligible = false;
  let needCheck = false;

  if (rules.grades && rules.grades.length > 0) {
    if (profile.grade == null) {
      needCheck = true;
      reasons.push(`학년 요건(${rules.grades.join("·")}학년)이 있는데 프로필에 학년 정보가 없어요.`);
    } else if (!rules.grades.includes(profile.grade)) {
      ineligible = true;
      reasons.push(`학년 요건(${rules.grades.join("·")}학년)에 해당하지 않아요. (현재 ${profile.grade}학년)`);
    } else {
      reasons.push(`학년 요건 충족 (${profile.grade}학년)`);
    }
  }

  if (rules.status && rules.status.length > 0) {
    if (!profile.enrollment_status) {
      needCheck = true;
      reasons.push(`재학 상태 요건(${rules.status.join("/")})이 있는데 프로필에 재학 상태가 없어요.`);
    } else if (!rules.status.some((s) => profile.enrollment_status?.includes(s))) {
      ineligible = true;
      reasons.push(`재학 상태 요건(${rules.status.join("/")})에 해당하지 않아요. (현재 ${profile.enrollment_status})`);
    } else {
      reasons.push(`재학 상태 충족 (${profile.enrollment_status})`);
    }
  }

  if (rules.max_age != null || rules.min_age != null) {
    if (profile.birth_year == null) {
      needCheck = true;
      reasons.push("나이 요건이 있는데 프로필에 출생연도가 없어요.");
    } else {
      const age = new Date().getFullYear() - profile.birth_year;
      if (rules.max_age != null && age > rules.max_age) {
        ineligible = true;
        reasons.push(`나이 상한(만 ${rules.max_age}세)을 초과해요. (약 만 ${age}세 기준, 생일에 따라 달라질 수 있음)`);
      } else if (rules.min_age != null && age < rules.min_age) {
        ineligible = true;
        reasons.push(`나이 하한(만 ${rules.min_age}세)에 미달이에요. (약 만 ${age}세 기준)`);
      } else {
        reasons.push(`나이 요건 충족 (약 만 ${age}세)`);
      }
    }
  }

  if (rules.majors && rules.majors.length > 0) {
    if (!profile.department) {
      needCheck = true;
      reasons.push(`전공 요건(${rules.majors.join(", ")})이 있는데 프로필에 학과 정보가 없어요.`);
    } else if (!majorMatches(rules.majors, profile.department)) {
      needCheck = true;
      reasons.push(`전공 요건(${rules.majors.join(", ")})과 일치하는지 확인이 필요해요. (프로필: ${profile.department})`);
    } else {
      reasons.push(`전공 요건 충족 (${profile.department})`);
    }
  }

  if (rules.region && !OPEN_REGION_PATTERN.test(rules.region)) {
    needCheck = true;
    reasons.push(`지역 요건 확인 필요: ${rules.region}`);
  }

  if (rules.team_size) {
    reasons.push(`팀 구성 요건: ${rules.team_size}`);
  }

  if (rules.etc) {
    // 성적처럼 프로필로 확인할 수 없는 요건은 판정을 보수적으로 낮춘다.
    if (/평점|학점|GPA|성적/i.test(rules.etc)) {
      needCheck = true;
      reasons.push(`성적 요건 확인 필요: ${rules.etc}`);
    } else {
      reasons.push(`참고 요건: ${rules.etc}`);
    }
  }

  if (reasons.length === 0) {
    reasons.push("명시된 자격 제한이 없어요.");
  }

  return {
    verdict: ineligible ? "ineligible" : needCheck ? "check" : "eligible",
    reasons,
    score,
  };
}
