import { NextResponse } from "next/server";
import { createTranslator } from "@/lib/i18n";
import { localeFromRequest } from "@/lib/i18n/request";
import { extractProfileFromText } from "@/lib/upstage";
import { getProfile, mergeProfile, saveProfile } from "@/lib/store";
import { scopedWorkflowKey, visitorIdFromRequest } from "@/lib/visitor";
import { clip, clipTail } from "@/lib/workflow";
import { runWorkflowSession } from "@/lib/workflow-session";

export const maxDuration = 120;

/** HTML에서 본문 텍스트만 대충 걷어낸다. (SSR 페이지 기준) */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  const t = createTranslator(localeFromRequest(req));
  const { url } = (await req.json()) as { url?: string };
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: t("api.noLink") }, { status: 400 });
  }

  // 새로고침 시 /api/workflows에서 발견해 이어본다.
  const visitorId = visitorIdFromRequest(req);
  return runWorkflowSession(scopedWorkflowKey(req, "profile-link"), async (emit) => {
    emit({ type: "step", id: "fetch", title: `Fetch page — ${url}`, status: "start" });
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      emit({
        type: "step",
        id: "fetch",
        title: `Fetch page — ${url}`,
        status: "error",
        detail: `HTTP ${res.status}`,
      });
      emit({
        type: "error",
        message: `Could not load the link (HTTP ${res.status}). Check that the page is public.`,
      });
      return;
    }
    const html = await res.text();
    emit({
      type: "step",
      id: "fetch",
      title: `Fetch page — ${url}`,
      status: "done",
      detail: `HTTP ${res.status} · ${(html.length / 1024).toFixed(0)}KB`,
    });

    const text = htmlToText(html);
    if (text.length < 80) {
      emit({
        type: "step",
        id: "text",
        title: "Extract page text",
        status: "error",
        detail: `${text.length} chars`,
      });
      emit({
        type: "error",
        message:
          "Almost no readable text on that page. It may need a login or be script-rendered. (GitHub, blogs, and Linktree work well.)",
      });
      return;
    }
    emit({
      type: "step",
      id: "text",
      title: "Extract page text",
      status: "done",
      detail: `${text.length.toLocaleString()} chars`,
      payload: clip(text, 1200),
    });

    emit({
      type: "step",
      id: "solar",
      title: t("api.solarExtract"),
      status: "start",
    });
    let lastReasoningEmit = 0;
    const { extracted, reasoning } = await extractProfileFromText(text, (accumulated) => {
      const now = Date.now();
      if (now - lastReasoningEmit < 200) {
        return;
      }
      lastReasoningEmit = now;
      emit({
        type: "step",
        id: "reasoning",
        title: t("api.solarReasoning"),
        status: "start",
        detail: `${accumulated.length.toLocaleString()} chars`,
        payload: clipTail(accumulated),
      });
    });
    if (reasoning) {
      emit({
        type: "step",
        id: "reasoning",
        title: t("api.solarReasoning"),
        status: "done",
        detail: `${reasoning.length.toLocaleString()} chars`,
        payload: clipTail(reasoning),
      });
    }
    emit({
      type: "step",
      id: "solar",
      title: t("api.solarExtract"),
      status: "done",
      payload: extracted,
    });

    const profile = mergeProfile(await getProfile(visitorId), extracted, {
      type: "link",
      label: url,
      addedAt: new Date().toISOString(),
    });
    await saveProfile(visitorId, profile);
    emit({ type: "step", id: "merge", title: t("api.mergeSave"), status: "done", payload: profile });
    emit({ type: "result", data: { profile, extracted } });
  });
}
