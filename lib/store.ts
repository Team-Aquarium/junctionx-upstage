import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// 해커톤 데모용 파일 기반 저장소. 서버 로컬에서 단일 사용자를 가정한다.
const DATA_DIR = join(process.cwd(), "data");
const UPLOADS_DIR = join(DATA_DIR, "uploads");
const ANNOUNCEMENTS_FILE = join(DATA_DIR, "announcements.json");
const PROFILE_FILE = join(DATA_DIR, "profile.json");

function ensureDirs() {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) {
      return fallback;
    }
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
  ensureDirs();
  writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// 공고 (Announcement)
// ---------------------------------------------------------------------------

export interface EligibilityRules {
  grades?: number[] | null;
  status?: string[] | null;
  min_age?: number | null;
  max_age?: number | null;
  majors?: string[] | null;
  team_size?: string | null;
  region?: string | null;
  etc?: string | null;
}

export interface Announcement {
  id: string;
  category: string;
  title: string;
  organizer: string | null;
  field: string | null;
  apply_start: string | null;
  apply_end: string | null;
  result_date: string | null;
  benefits: string | null;
  contact: string | null;
  apply_url: string | null;
  summary: string[];
  rules: EligibilityRules;
  todo_checklist: string[];
  sourceFile: { name: string; mediaType: string } | null;
  createdAt: string;
}

export function listAnnouncements(): Announcement[] {
  return readJson<Announcement[]>(ANNOUNCEMENTS_FILE, []);
}

export function getAnnouncement(id: string): Announcement | null {
  return listAnnouncements().find((item) => item.id === id) ?? null;
}

export function saveAnnouncement(announcement: Announcement) {
  const list = listAnnouncements().filter((item) => item.id !== announcement.id);
  writeJson(ANNOUNCEMENTS_FILE, [announcement, ...list]);
}

export function deleteAnnouncement(id: string) {
  writeJson(
    ANNOUNCEMENTS_FILE,
    listAnnouncements().filter((item) => item.id !== id),
  );
}

export function saveUploadFile(id: string, bytes: Buffer) {
  ensureDirs();
  writeFileSync(join(UPLOADS_DIR, id), bytes);
}

export function readUploadFile(id: string): Buffer | null {
  const file = join(UPLOADS_DIR, id);
  // id는 서버가 생성한 UUID 조각이지만, 경로 조작 문자는 방어적으로 거른다.
  if (id.includes("/") || id.includes("..") || !existsSync(file)) {
    return null;
  }
  return readFileSync(file);
}

// ---------------------------------------------------------------------------
// 사용자 프로필 (단일 사용자)
// ---------------------------------------------------------------------------

export interface ProfileSource {
  type: "file" | "link";
  label: string;
  addedAt: string;
}

export interface UserProfile {
  name: string | null;
  university: string | null;
  department: string | null;
  grade: number | null;
  enrollment_status: string | null;
  birth_year: number | null;
  interests: string[];
  skills: string[];
  activities: string[];
  sources: ProfileSource[];
}

export function emptyProfile(): UserProfile {
  return {
    name: null,
    university: null,
    department: null,
    grade: null,
    enrollment_status: null,
    birth_year: null,
    interests: [],
    skills: [],
    activities: [],
    sources: [],
  };
}

export function getProfile(): UserProfile | null {
  return readJson<UserProfile | null>(PROFILE_FILE, null);
}

export function saveProfile(profile: UserProfile) {
  writeJson(PROFILE_FILE, profile);
}

export function clearProfile() {
  writeJson(PROFILE_FILE, null);
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(values.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim()))];
}

/** 새로 추출된 값을 기존 프로필에 병합한다. null이 아닌 값만 덮어쓴다. */
export function mergeProfile(
  base: UserProfile | null,
  patch: Partial<Record<string, unknown>>,
  source: ProfileSource,
): UserProfile {
  const profile = base ?? emptyProfile();
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown) => {
    const n = typeof v === "string" ? Number.parseInt(v, 10) : typeof v === "number" ? v : Number.NaN;
    return Number.isFinite(n) ? n : null;
  };

  return {
    name: str(patch.name) ?? profile.name,
    university: str(patch.university) ?? profile.university,
    department: str(patch.department) ?? profile.department,
    grade: num(patch.grade) ?? profile.grade,
    enrollment_status: str(patch.enrollment_status) ?? profile.enrollment_status,
    birth_year: num(patch.birth_year) ?? profile.birth_year,
    interests: [...new Set([...profile.interests, ...uniqueStrings(patch.interests)])],
    skills: [...new Set([...profile.skills, ...uniqueStrings(patch.skills)])],
    activities: [...new Set([...profile.activities, ...uniqueStrings(patch.activities)])],
    sources: [...profile.sources, source],
  };
}
