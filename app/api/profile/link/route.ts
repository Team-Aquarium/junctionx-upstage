import { NextResponse } from "next/server";
import { extractProfileFromText } from "@/lib/upstage";
import { getProfile, mergeProfile, saveProfile } from "@/lib/store";

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

  try {
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
      return NextResponse.json(
        { error: `링크를 불러오지 못했습니다 (HTTP ${res.status}). 공개 페이지인지 확인해 주세요.` },
        { status: 422 },
      );
    }
    const text = htmlToText(await res.text());
    if (text.length < 80) {
      return NextResponse.json(
        {
          error:
            "페이지에서 읽을 수 있는 텍스트가 거의 없어요. 로그인 필요 페이지거나 스크립트로만 그려지는 페이지일 수 있습니다. (GitHub·블로그·링크트리 추천)",
        },
        { status: 422 },
      );
    }

    const extracted = await extractProfileFromText(text);
    const profile = mergeProfile(getProfile(), extracted, {
      type: "link",
      label: url,
      addedAt: new Date().toISOString(),
    });
    saveProfile(profile);
    return NextResponse.json({ profile, extracted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
