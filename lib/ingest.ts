import {
  parseAgentJson,
  runStudioAgentDetailed,
  type StoredDocument,
} from "@/lib/upstage";
import {
  saveAnnouncement,
  saveUploadFile,
  type Announcement,
  type EligibilityRules,
} from "@/lib/store";

/** Instruct 출력에 섞여 오는 인용 마커(【†1】)를 제거한다. */
function clean(value: string): string {
  return value.replace(/【†\d+】/g, "").trim();
}

function str(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = clean(value);
  return cleaned && cleaned.toLowerCase() !== "null" ? cleaned : null;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === "string")
        .map(clean)
        .filter((v) => v.length > 0)
    : [];
}

function toRules(value: unknown): EligibilityRules {
  if (!value || typeof value !== "object") {
    return {};
  }
  const raw = value as Record<string, unknown>;
  const numArray = (v: unknown) =>
    Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    grades: numArray(raw.grades),
    status: Array.isArray(raw.status) ? strArray(raw.status) : null,
    min_age: num(raw.min_age),
    max_age: num(raw.max_age),
    majors: Array.isArray(raw.majors) ? strArray(raw.majors) : null,
    team_size: str(raw.team_size),
    region: str(raw.region),
    etc: str(raw.etc),
  };
}

export interface IngestSource {
  filename: string;
  mediaType: string;
  bytes: Buffer;
  /** 크롤링으로 수집한 경우 원문 페이지 URL */
  sourceUrl?: string | null;
}

/**
 * 문서(공고문)를 Studio 공고 에이전트에 태워 Announcement로 저장한다.
 * 실패 시 Error를 throw한다.
 */
export async function ingestAnnouncementDocument(source: IngestSource): Promise<Announcement> {
  const agentId = process.env.UPSTAGE_AGENT_ID;
  if (!agentId) {
    throw new Error("UPSTAGE_AGENT_ID가 설정되지 않았습니다. (.env.local 확인)");
  }

  const id = crypto.randomUUID().slice(0, 8);
  const doc: StoredDocument = {
    id,
    filename: source.filename,
    mediaType: source.mediaType,
    url: `data:${source.mediaType};base64,${source.bytes.toString("base64")}`,
  };

  const run = await runStudioAgentDetailed([doc], agentId);
  if (run.status !== "completed") {
    throw new Error(`에이전트 실행이 완료되지 않았습니다 (status: ${run.status})`);
  }

  const parsed = parseAgentJson(run.outputText);
  if (!parsed) {
    throw new Error("에이전트 출력을 JSON으로 해석하지 못했습니다.");
  }

  const announcement: Announcement = {
    id,
    category: str(parsed.category) ?? "others",
    title: str(parsed.title) ?? source.filename,
    organizer: str(parsed.organizer),
    field: str(parsed.field),
    apply_start: str(parsed.apply_start),
    apply_end: str(parsed.apply_end),
    result_date: str(parsed.result_date),
    benefits: str(parsed.benefits),
    contact: str(parsed.contact),
    apply_url: str(parsed.apply_url),
    summary: strArray(parsed.summary),
    rules: toRules(parsed.rules),
    todo_checklist: strArray(parsed.todo_checklist),
    sourceFile: { name: source.filename, mediaType: source.mediaType },
    sourceUrl: source.sourceUrl ?? null,
    createdAt: new Date().toISOString(),
  };

  saveUploadFile(id, source.bytes);
  saveAnnouncement(announcement);
  return announcement;
}
