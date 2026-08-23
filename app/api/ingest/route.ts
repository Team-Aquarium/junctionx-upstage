import { NextResponse } from "next/server";
import { createTranslator } from "@/lib/i18n";
import { localeFromRequest } from "@/lib/i18n/request";
import { ingestAnnouncementDocument } from "@/lib/ingest";
import { matchAnnouncement } from "@/lib/matching";
import { getProfile } from "@/lib/store";
import { scopedWorkflowKey, visitorIdFromRequest } from "@/lib/visitor";
import { runWorkflowSession } from "@/lib/workflow-session";

export const maxDuration = 300;

export async function POST(req: Request) {
  const t = createTranslator(localeFromRequest(req));
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: t("api.noFile") }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());

  const visitorId = visitorIdFromRequest(req);
  return runWorkflowSession(
    scopedWorkflowKey(req, `ingest:${crypto.randomUUID().slice(0, 8)}`),
    async (emit) => {
      emit({
        type: "step",
        id: "recv",
        title: t("api.fileRecv", { name: file.name }),
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

      const match = matchAnnouncement(announcement, await getProfile(visitorId), t);
      emit({
        type: "step",
        id: "match",
        title: t("api.matchTitle"),
        status: "done",
        detail: t(`api.${match.verdict}`),
        payload: match,
      });
      emit({ type: "result", data: { announcement: { ...announcement, match } } });
    },
  );
}
