import { NextResponse } from "next/server";
import { matchAnnouncement } from "@/lib/matching";
import {
  parseAgentJson,
  runStudioAgentDetailed,
  type StoredDocument,
} from "@/lib/upstage";
import {
  getProfile,
  saveAnnouncement,
  saveUploadFile,
  type Announcement,
  type EligibilityRules,
} from "@/lib/store";

export const maxDuration = 300;

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

export async function POST(req: Request) {
  const agentId = process.env.UPSTAGE_AGENT_ID;
  if (!agentId) {
    return NextResponse.json(
      { error: "UPSTAGE_AGENT_ID가 설정되지 않았습니다. (.env.local 확인)" },
      { status: 500 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const id = crypto.randomUUID().slice(0, 8);
  const mediaType = file.type || "application/octet-stream";
  const doc: StoredDocument = {
    id,
    filename: file.name,
    mediaType,
    url: `data:${mediaType};base64,${bytes.toString("base64")}`,
  };

  try {
    const run = await runStudioAgentDetailed([doc], agentId);
    if (run.status !== "completed") {
      return NextResponse.json(
        { error: `에이전트 실행이 완료되지 않았습니다 (status: ${run.status})`, detail: run.error ?? null },
        { status: 502 },
      );
    }

    const parsed = parseAgentJson(run.outputText);
    if (!parsed) {
      return NextResponse.json(
        { error: "에이전트 출력을 JSON으로 해석하지 못했습니다.", raw: run.outputText.slice(0, 2000) },
        { status: 502 },
      );
    }

    const announcement: Announcement = {
      id,
      category: str(parsed.category) ?? "others",
      title: str(parsed.title) ?? file.name,
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
      sourceFile: { name: file.name, mediaType },
      createdAt: new Date().toISOString(),
    };

    saveUploadFile(id, bytes);
    saveAnnouncement(announcement);
    return NextResponse.json({
      announcement: { ...announcement, match: matchAnnouncement(announcement, getProfile()) },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
