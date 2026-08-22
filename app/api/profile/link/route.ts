import { NextResponse } from "next/server";
import { extractProfileFromText } from "@/lib/upstage";
import { getProfile, mergeProfile, saveProfile } from "@/lib/store";
import { clip, workflowStream } from "@/lib/workflow";

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
  const { url } = (await req.json()) as { url?: string };
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "http(s) 링크를 입력해 주세요." }, { status: 400 });
  }

  return workflowStream(async (emit) => {
    emit({ type: "step", id: "fetch", title: `페이지 요청 — ${url}`, status: "start" });
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
        title: `페이지 요청 — ${url}`,
        status: "error",
        detail: `HTTP ${res.status}`,
      });
      emit({
        type: "error",
        message: `링크를 불러오지 못했습니다 (HTTP ${res.status}). 공개 페이지인지 확인해 주세요.`,
      });
      return;
    }
    const html = await res.text();
    emit({
      type: "step",
      id: "fetch",
      title: `페이지 요청 — ${url}`,
      status: "done",
      detail: `HTTP ${res.status} · ${(html.length / 1024).toFixed(0)}KB`,
    });

    const text = htmlToText(html);
    if (text.length < 80) {
      emit({
        type: "step",
        id: "text",
        title: "본문 텍스트 추출",
        status: "error",
        detail: `${text.length}자`,
      });
      emit({
        type: "error",
        message:
          "페이지에서 읽을 수 있는 텍스트가 거의 없어요. 로그인 필요 페이지거나 스크립트로만 그려지는 페이지일 수 있습니다. (GitHub·블로그·링크트리 추천)",
      });
      return;
    }
    emit({
      type: "step",
      id: "text",
      title: "본문 텍스트 추출",
      status: "done",
      detail: `${text.length.toLocaleString()}자`,
      payload: clip(text, 1200),
    });

    emit({
      type: "step",
      id: "solar",
      title: "Solar 프로필 추출 (solar-pro4)",
      status: "start",
    });
    const { extracted, reasoning } = await extractProfileFromText(text);
    if (reasoning) {
      emit({
        type: "step",
        id: "reasoning",
        title: "Solar 추론 과정",
        status: "done",
        payload: clip(reasoning),
      });
    }
    emit({
      type: "step",
      id: "solar",
      title: "Solar 프로필 추출 (solar-pro4)",
      status: "done",
      payload: extracted,
    });

    const profile = mergeProfile(getProfile(), extracted, {
      type: "link",
      label: url,
      addedAt: new Date().toISOString(),
    });
    saveProfile(profile);
    emit({ type: "step", id: "merge", title: "프로필 병합·저장", status: "done", payload: profile });
    emit({ type: "result", data: { profile, extracted } });
  });
}
