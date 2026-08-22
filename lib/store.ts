import { getSupabase } from "./supabase";

// Supabase(클라우드) 기반 저장소. 단일 사용자 데모를 가정한다.
// - 공고: public.announcements 테이블
// - 프로필: public.profile (id=1 한 행, jsonb)
// - 추천 캐시: public.recommendation_cache (id=1 한 행)
// - 원본 파일: storage 버킷 "uploads" (파일명 = 공고 id)

const UPLOADS_BUCKET = "uploads";

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
  /** 특정 과목 이수 등 — 프로필만으로는 판정 불가 */
  courses?: string[] | null;
  /** 우대 사항 (수상 경력 등) — 미충족이어도 탈락은 아님 */
  preferred?: string[] | null;
  /** Instruct가 뽑은 확인 필요 조항 */
  review_items?: string[] | null;
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
  /** 크롤링으로 수집한 경우 원문 페이지 URL */
  sourceUrl?: string | null;
  createdAt: string;
}

interface AnnouncementRow {
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
  summary: unknown;
  rules: unknown;
  todo_checklist: unknown;
  source_file: { name: string; mediaType: string } | null;
  source_url: string | null;
  created_at: string;
}

function rowToAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    organizer: row.organizer,
    field: row.field,
    apply_start: row.apply_start,
    apply_end: row.apply_end,
    result_date: row.result_date,
    benefits: row.benefits,
    contact: row.contact,
    apply_url: row.apply_url,
    summary: Array.isArray(row.summary) ? (row.summary as string[]) : [],
    rules: (row.rules ?? {}) as EligibilityRules,
    todo_checklist: Array.isArray(row.todo_checklist) ? (row.todo_checklist as string[]) : [],
    sourceFile: row.source_file,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
  };
}

function announcementToRow(a: Announcement): AnnouncementRow {
  return {
    id: a.id,
    category: a.category,
    title: a.title,
    organizer: a.organizer,
    field: a.field,
    apply_start: a.apply_start,
    apply_end: a.apply_end,
    result_date: a.result_date,
    benefits: a.benefits,
    contact: a.contact,
    apply_url: a.apply_url,
    summary: a.summary,
    rules: a.rules,
    todo_checklist: a.todo_checklist,
    source_file: a.sourceFile,
    source_url: a.sourceUrl ?? null,
    created_at: a.createdAt,
  };
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await getSupabase()
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Failed to list announcements: ${error.message}`);
  }
  return (data as AnnouncementRow[]).map(rowToAnnouncement);
}

export async function getAnnouncement(id: string): Promise<Announcement | null> {
  const { data, error } = await getSupabase()
    .from("announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to get announcement: ${error.message}`);
  }
  return data ? rowToAnnouncement(data as AnnouncementRow) : null;
}

export async function saveAnnouncement(announcement: Announcement): Promise<void> {
  const { error } = await getSupabase()
    .from("announcements")
    .upsert(announcementToRow(announcement));
  if (error) {
    throw new Error(`Failed to save announcement: ${error.message}`);
  }
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await getSupabase().from("announcements").delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete announcement: ${error.message}`);
  }
}

export async function saveUploadFile(
  id: string,
  bytes: Buffer,
  contentType = "application/octet-stream",
): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(UPLOADS_BUCKET)
    .upload(id, bytes, { contentType, upsert: true });
  if (error) {
    throw new Error(`Failed to upload source file: ${error.message}`);
  }
}

export async function readUploadFile(id: string): Promise<Buffer | null> {
  if (id.includes("/") || id.includes("..")) {
    return null;
  }
  const { data, error } = await getSupabase().storage.from(UPLOADS_BUCKET).download(id);
  if (error || !data) {
    return null;
  }
  return Buffer.from(await data.arrayBuffer());
}

// ---------------------------------------------------------------------------
// 사용자 프로필 (단일 사용자 — profile 테이블 id=1 한 행)
// ---------------------------------------------------------------------------

export interface ProfileSource {
  type: "file" | "link" | "manual" | "note";
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

export async function getProfile(): Promise<UserProfile | null> {
  const { data, error } = await getSupabase()
    .from("profile")
    .select("data")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to get profile: ${error.message}`);
  }
  return (data?.data as UserProfile | undefined) ?? null;
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  const { error } = await getSupabase()
    .from("profile")
    .upsert({ id: 1, data: profile, updated_at: new Date().toISOString() });
  if (error) {
    throw new Error(`Failed to save profile: ${error.message}`);
  }
}

export async function clearProfile(): Promise<void> {
  const { error } = await getSupabase().from("profile").delete().eq("id", 1);
  if (error) {
    throw new Error(`Failed to clear profile: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// 추천 캐시 (프로필 + 공고 목록이 바뀔 때만 재계산 — id=1 한 행)
// ---------------------------------------------------------------------------

export interface RecommendationCache {
  hash: string;
  createdAt: string;
  items: { id: string; score: number; reason: string }[];
}

export async function getRecommendationCache(): Promise<RecommendationCache | null> {
  const { data, error } = await getSupabase()
    .from("recommendation_cache")
    .select("hash, items, created_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to get recommendation cache: ${error.message}`);
  }
  if (!data) {
    return null;
  }
  return {
    hash: data.hash as string,
    createdAt: data.created_at as string,
    items: (data.items ?? []) as RecommendationCache["items"],
  };
}

export async function saveRecommendationCache(cache: RecommendationCache): Promise<void> {
  const { error } = await getSupabase()
    .from("recommendation_cache")
    .upsert({ id: 1, hash: cache.hash, items: cache.items, created_at: cache.createdAt });
  if (error) {
    throw new Error(`Failed to save recommendation cache: ${error.message}`);
  }
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
