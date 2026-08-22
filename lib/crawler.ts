// 위비티(wevity.com) 공모전 크롤러.
// robots.txt가 전체 허용(Allow: /)이며, 예의상 요청 간 지연을 둔다.
// 크롤러는 "문서(포스터 이미지)"만 수집하고, 이해·구조화는 전부 Studio 에이전트가 담당한다.

const WEVITY_BASE = "https://www.wevity.com/";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 20_000;
const POLITE_DELAY_MS = 1_500;

/** 위비티 분야 목록 페이지. cidx=20이 웹/모바일/IT. */
const LIST_SOURCES: Record<string, { label: string; url: string }> = {
  it: { label: "웹/모바일/IT", url: `${WEVITY_BASE}?c=find&s=1&gub=1&cidx=20` },
  idea: { label: "기획/아이디어", url: `${WEVITY_BASE}?c=find&s=1&gub=1&cidx=21` },
  all: { label: "전체 공모전", url: `${WEVITY_BASE}?c=find&s=1&gub=1` },
};

export type CrawlSourceKey = keyof typeof LIST_SOURCES;

export interface CrawlCandidate {
  title: string;
  detailUrl: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`페이지 요청 실패 (HTTP ${res.status}): ${url}`);
  }
  return res.text();
}

/** 목록 페이지에서 공모전 후보를 추출한다. */
export async function fetchWevityList(
  source: CrawlSourceKey = "it",
  limit = 10,
): Promise<CrawlCandidate[]> {
  const html = await fetchHtml(LIST_SOURCES[source]?.url ?? LIST_SOURCES.it.url);
  const items: CrawlCandidate[] = [];
  const pattern = /<div class="tit">\s*<a href="\?([^"]+)">([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(pattern)) {
    const query = match[1].replace(/&amp;/g, "&");
    if (!query.includes("gbn=view")) {
      continue;
    }
    const title = match[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) {
      continue;
    }
    items.push({ title, detailUrl: `${WEVITY_BASE}?${query}` });
    if (items.length >= limit) {
      break;
    }
  }
  return items;
}

export interface CrawledPoster {
  bytes: Buffer;
  mediaType: string;
  filename: string;
}

/** 상세 페이지에서 공고 포스터 이미지를 내려받는다. 없으면 null. */
export async function fetchWevityPoster(detailUrl: string): Promise<CrawledPoster | null> {
  const html = await fetchHtml(detailUrl);
  const match = html.match(/<img[^>]+src="(\/upload\/contest\/[^"]+\.(?:jpe?g|png|gif|webp))"/i);
  if (!match) {
    return null;
  }
  const imageUrl = new URL(match[1], WEVITY_BASE).toString();
  const res = await fetch(imageUrl, {
    headers: { "User-Agent": USER_AGENT, Referer: detailUrl },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    return null;
  }
  return {
    bytes: Buffer.from(await res.arrayBuffer()),
    mediaType: res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg",
    filename: decodeURIComponent(imageUrl.split("/").pop() ?? "poster.jpg"),
  };
}

export async function politeDelay() {
  await sleep(POLITE_DELAY_MS);
}
