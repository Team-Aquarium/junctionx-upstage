import { NextResponse } from "next/server";
import { fetchLinkDocument } from "@/lib/crawler";
import { ingestAnnouncementDocument } from "@/lib/ingest";
import { matchAnnouncement } from "@/lib/matching";
import { getProfile, listAnnouncements } from "@/lib/store";
import { runWorkflowSession } from "@/lib/workflow-session";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "http(s) 링크를 입력해 주세요." }, { status: 400 });
  }

  // 같은 링크가 실행 중이면 그 세션에 붙는다. (새로고침 이어보기 + 중복 실행 방지)
  return runWorkflowSession(`link:${url}`, async (emit) => {
    if ((await listAnnouncements()).some((a) => a.sourceUrl === url)) {
      emit({ type: "error", message: "이미 등록된 공고 링크입니다." });
      return;
    }

    emit({
      type: "step",
      id: "fetch",
      title: `링크에서 공고 문서 수집 — ${url.slice(0, 60)}`,
      status: "start",
    });
    const document = await fetchLinkDocument(url);
    if (!document) {
      emit({
        type: "step",
        id: "fetch",
        title: `링크에서 공고 문서 수집 — ${url.slice(0, 60)}`,
        status: "error",
      });
      emit({
        type: "error",
        message:
          "링크에서 읽을 수 있는 공고 문서를 찾지 못했습니다. 로그인 필요 페이지거나 스크립트로만 그려지는 페이지일 수 있어요. 공고문 파일(PDF·이미지) 링크를 직접 넣어보세요.",
      });
      return;
    }
    emit({
      type: "step",
      id: "fetch",
      title: `링크에서 공고 문서 수집 — ${url.slice(0, 60)}`,
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
