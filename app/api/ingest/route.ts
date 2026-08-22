import { NextResponse } from "next/server";
import { ingestAnnouncementDocument } from "@/lib/ingest";
import { matchAnnouncement } from "@/lib/matching";
import { getProfile } from "@/lib/store";
import { runWorkflowSession } from "@/lib/workflow-session";

export const maxDuration = 300;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());

  // 업로드 실행마다 고유 세션 — 새로고침 시 /api/workflows에서 발견해 이어본다.
  return runWorkflowSession(`ingest:${crypto.randomUUID().slice(0, 8)}`, async (emit) => {
    emit({
      type: "step",
      id: "recv",
      title: `파일 수신 — ${file.name}`,
      status: "done",
      detail: `${(bytes.length / 1024).toFixed(0)}KB · ${file.type || "unknown"}`,
    });

    const announcement = await ingestAnnouncementDocument(
      {
        filename: file.name,
        mediaType: file.type || "application/octet-stream",
        bytes,
      },
      emit,
    );

    const match = matchAnnouncement(announcement, await getProfile());
    emit({
      type: "step",
      id: "match",
      title: "프로필 자격 판정",
      status: "done",
      detail:
        match.verdict === "eligible"
          ? "지원 가능"
          : match.verdict === "ineligible"
            ? "자격 미달"
            : "확인 필요",
      payload: match,
    });
    emit({ type: "result", data: { announcement: { ...announcement, match } } });
  });
}
