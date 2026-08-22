import { NextResponse } from "next/server";
import { extractInformation, type StoredDocument } from "@/lib/upstage";
import { clearProfile, getProfile, mergeProfile, saveProfile } from "@/lib/store";
import { workflowStream } from "@/lib/workflow";

export const maxDuration = 120;

/** 재학증명서·성적증명서 등에서 뽑을 프로필 필드 (Universal Information Extraction 스키마) */
const PROFILE_PROPERTIES = {
  name: { type: "string", description: "문서에 기재된 사람 이름" },
  university: { type: "string", description: "대학교 이름" },
  department: { type: "string", description: "학과 또는 전공 이름" },
  grade: { type: "number", description: "학년 (1~6 숫자). 문서에 없으면 생략" },
  enrollment_status: {
    type: "string",
    description: "학적 상태. 재학/휴학/졸업 중 하나로 표기",
  },
  birth_year: { type: "number", description: "출생연도 4자리 (생년월일에서 연도만)" },
} as const;

export async function GET() {
  return NextResponse.json({ profile: getProfile() });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mediaType = file.type || "application/octet-stream";
  const doc: StoredDocument = {
    id: "profile-doc",
    filename: file.name,
    mediaType,
    url: `data:${mediaType};base64,${bytes.toString("base64")}`,
  };

  return workflowStream(async (emit) => {
    emit({
      type: "step",
      id: "recv",
      title: `서류 수신 — ${file.name}`,
      status: "done",
      detail: `${(bytes.length / 1024).toFixed(0)}KB`,
    });

    emit({
      type: "step",
      id: "uie",
      title: "Universal Information Extraction 호출 (student_profile 스키마)",
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
      title: "Universal Information Extraction 호출 (student_profile 스키마)",
      status: "done",
      detail: result.model,
      payload: extracted,
    });

    const profile = mergeProfile(getProfile(), extracted, {
      type: "file",
      label: file.name,
      addedAt: new Date().toISOString(),
    });
    saveProfile(profile);
    emit({
      type: "step",
      id: "merge",
      title: "프로필 병합·저장",
      status: "done",
      payload: profile,
    });
    emit({ type: "result", data: { profile, extracted } });
  });
}

export async function DELETE() {
  clearProfile();
  return NextResponse.json({ profile: null });
}
