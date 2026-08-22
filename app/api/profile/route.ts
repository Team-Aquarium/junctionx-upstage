import { NextResponse } from "next/server";
import { createTranslator } from "@/lib/i18n";
import { localeFromRequest } from "@/lib/i18n/request";
import { extractInformation, type StoredDocument } from "@/lib/upstage";
import { clearProfile, getProfile, mergeProfile, saveProfile } from "@/lib/store";
import { runWorkflowSession } from "@/lib/workflow-session";

export const maxDuration = 120;

/** 재학증명서·성적증명서 등에서 뽑을 프로필 필드 (Universal Information Extraction 스키마) */
const PROFILE_PROPERTIES = {
  name: { type: "string", description: "Person's name as written in the document" },
  university: { type: "string", description: "University name" },
  department: { type: "string", description: "Department or major name" },
  grade: { type: "number", description: "Year/grade (number 1–6). Omit if not in the document" },
  enrollment_status: {
    type: "string",
    description: "Enrollment status. One of enrolled / on leave / graduated",
  },
  birth_year: { type: "number", description: "4-digit birth year (year only from date of birth)" },
} as const;

export async function GET() {
  return NextResponse.json({ profile: await getProfile() });
}

export async function POST(req: Request) {
  const t = createTranslator(localeFromRequest(req));
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: t("api.noFile") }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mediaType = file.type || "application/octet-stream";
  const doc: StoredDocument = {
    id: "profile-doc",
    filename: file.name,
    mediaType,
    url: `data:${mediaType};base64,${bytes.toString("base64")}`,
  };

  // 새로고침 시 /api/workflows에서 발견해 이어본다.
  return runWorkflowSession("profile-file", async (emit) => {
    emit({
      type: "step",
      id: "recv",
      title: t("api.docRecv", { name: file.name }),
      status: "done",
      detail: `${(bytes.length / 1024).toFixed(0)}KB`,
    });

    emit({
      type: "step",
      id: "uie",
      title: t("api.uieStart"),
      status: "start",
      payload: { schema: Object.keys(PROFILE_PROPERTIES) },
    });
    const result = await extractInformation(doc, "student_profile", { ...PROFILE_PROPERTIES });
    const extracted =
      result.extracted && typeof result.extracted === "object"
        ? (result.extracted as Record<string, unknown>)
        : {};
    emit({
      type: "step",
      id: "uie",
      title: t("api.uieStart"),
      status: "done",
      detail: result.model,
      payload: extracted,
    });

    const profile = mergeProfile(await getProfile(), extracted, {
      type: "file",
      label: file.name,
      addedAt: new Date().toISOString(),
    });
    await saveProfile(profile);
    emit({
      type: "step",
      id: "merge",
      title: t("api.mergeSave"),
      status: "done",
      payload: profile,
    });
    emit({ type: "result", data: { profile, extracted } });
  });
}

export async function DELETE() {
  await clearProfile();
  return NextResponse.json({ profile: null });
}
