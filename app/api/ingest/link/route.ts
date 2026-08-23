import { NextResponse } from "next/server";
import { fetchLinkDocument } from "@/lib/crawler";
import { createTranslator } from "@/lib/i18n";
import { localeFromRequest } from "@/lib/i18n/request";
import { ingestAnnouncementDocument } from "@/lib/ingest";
import { matchAnnouncement } from "@/lib/matching";
import { getProfile, listAnnouncements } from "@/lib/store";
import { scopedWorkflowKey, visitorIdFromRequest } from "@/lib/visitor";
import { runWorkflowSession } from "@/lib/workflow-session";

export const maxDuration = 300;

export async function POST(req: Request) {
  const t = createTranslator(localeFromRequest(req));
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: t("api.noLink") }, { status: 400 });
  }

  // 같은 링크가 실행 중이면 그 세션에 붙는다. (새로고침 이어보기 + 중복 실행 방지)
  const visitorId = visitorIdFromRequest(req);
  return runWorkflowSession(scopedWorkflowKey(req, `link:${url}`), async (emit) => {
    if ((await listAnnouncements()).some((a) => a.sourceUrl === url)) {
      emit({ type: "error", message: t("api.alreadyRegistered") });
      return;
    }

    emit({
      type: "step",
      id: "fetch",
      title: t("api.fetchLink", { url: url.slice(0, 60) }),
      status: "start",
    });
    const document = await fetchLinkDocument(url);
    if (!document) {
      emit({
        type: "step",
        id: "fetch",
        title: t("api.fetchLink", { url: url.slice(0, 60) }),
        status: "error",
      });
      emit({
        type: "error",
        message: t("api.noDocument"),
      });
      return;
    }
    emit({
      type: "step",
      id: "fetch",
      title: t("api.fetchLink", { url: url.slice(0, 60) }),
      status: "done",
      detail: `${document.via} · ${(document.bytes.length / 1024).toFixed(0)}KB`,
      payload: {
        filename: document.filename,
        mediaType: document.mediaType,
        via: document.via,
        sourceUrl: url,
      },
    });

    const announcement = await ingestAnnouncementDocument(
      {
        filename: document.filename,
        mediaType: document.mediaType,
        bytes: document.bytes,
        sourceUrl: url,
        extras: document.extras,
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
  });
}
