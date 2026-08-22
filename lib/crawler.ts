// 공모전 사이트 크롤러 (위비티 · 콘테스트코리아).
// 두 사이트 모두 robots.txt가 전체 허용(Allow: /)이며, 예의상 요청 간 지연을 둔다.
// 크롤러는 "문서"만 수집하고, 이해·구조화는 전부 Studio 에이전트가 담당한다.
// 문서 우선순위: 첨부 공고문(HWP/PDF) > 본문 HTML > 포스터 이미지.

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 20_000;
const POLITE_DELAY_MS = 1_500;

const WEVITY_BASE = "https://www.wevity.com/";
const CONTESTKOREA_BASE = "https://www.contestkorea.com/";

export const CRAWL_SOURCES = {
  "ck-it": {
    label: "콘테스트코리아 · 학문/과학/IT",
    site: "contestkorea",
    listUrl: `${CONTESTKOREA_BASE}sub/list.php?int_gbn=1&Txt_bcode=030310001`,
  },
  "ck-all": {
    label: "콘테스트코리아 · 전체",
    site: "contestkorea",
    listUrl: `${CONTESTKOREA_BASE}sub/list.php?int_gbn=1`,
  },
  it: {
    label: "위비티 · 웹/모바일/IT",
    site: "wevity",
    listUrl: `${WEVITY_BASE}?c=find&s=1&gub=1&cidx=20`,
  },
  idea: {
    label: "위비티 · 기획/아이디어",
    site: "wevity",
    listUrl: `${WEVITY_BASE}?c=find&s=1&gub=1&cidx=21`,
  },
  all: {
    label: "위비티 · 전체 공모전",
    site: "wevity",
    listUrl: `${WEVITY_BASE}?c=find&s=1&gub=1`,
  },
} as const;

export type CrawlSourceKey = keyof typeof CRAWL_SOURCES;

export interface CrawlCandidate {
  title: string;
  detailUrl: string;
}

export interface CrawlDocument {
  bytes: Buffer;
  mediaType: string;
  filename: string;
  /** 문서를 어떤 경로로 얻었는지: 첨부 공고문 / 본문 HTML / 포스터 이미지 */
  via: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function politeDelay() {
  await sleep(POLITE_DELAY_MS);
}

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

async function downloadFile(
  url: string,
  referer: string,
  via: string,
): Promise<CrawlDocument | null> {
  const res = await fetch(encodeURI(decodeURI(url)), {
    headers: { "User-Agent": USER_AGENT, Referer: referer },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    return null;
  }
  const mediaType = res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  const rawName = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "document");
  return {
    bytes: Buffer.from(await res.arrayBuffer()),
    mediaType,
    filename: rawName.slice(-80),
    via,
  };
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

// ---------------------------------------------------------------------------
// 위비티
// ---------------------------------------------------------------------------

async function fetchWevityList(listUrl: string, limit: number): Promise<CrawlCandidate[]> {
  const html = await fetchHtml(listUrl);
  const items: CrawlCandidate[] = [];
  const pattern = /<div class="tit">\s*<a href="\?([^"]+)">([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(pattern)) {
    const query = match[1].replace(/&amp;/g, "&");
    if (!query.includes("gbn=view")) {
      continue;
    }
    const title = stripTags(match[2]);
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

async function fetchWevityDocument(detailUrl: string): Promise<CrawlDocument | null> {
  const html = await fetchHtml(detailUrl);
  const match = html.match(/<img[^>]+src="(\/upload\/contest\/[^"]+\.(?:jpe?g|png|gif|webp))"/i);
  if (!match) {
    return null;
  }
  return downloadFile(new URL(match[1], WEVITY_BASE).toString(), detailUrl, "포스터 이미지");
}

// ---------------------------------------------------------------------------
// 콘테스트코리아
// ---------------------------------------------------------------------------

async function fetchContestKoreaList(listUrl: string, limit: number): Promise<CrawlCandidate[]> {
  const html = await fetchHtml(listUrl);
  const items: CrawlCandidate[] = [];
  const seen = new Set<string>();
  const pattern =
    /<a href="((?:\/sub\/)?view\.php\?[^"]*str_no=(\d+)[^"]*)">[\s\S]*?<span class="txt">([^<]+)<\/span>/g;
  for (const match of html.matchAll(pattern)) {
    const strNo = match[2];
    if (seen.has(strNo)) {
      continue;
    }
    seen.add(strNo);
    const title = stripTags(match[3]);
    if (!title) {
      continue;
    }
    const href = match[1].replace(/&amp;/g, "&");
    items.push({
      title,
      detailUrl: new URL(href, `${CONTESTKOREA_BASE}sub/`).toString(),
    });
    if (items.length >= limit) {
      break;
    }
  }
  return items;
}

async function fetchContestKoreaDocument(detailUrl: string): Promise<CrawlDocument | null> {
  const html = await fetchHtml(detailUrl);
  const title =
    stripTags(html.match(/<div class="view_top_area[^>]*>[\s\S]*?<h1>([\s\S]*?)<\/h1>/)?.[1] ?? "") ||
    "contest";

  // 1) 첨부 공고문 (HWP/PDF/DOC) — 진짜 공고 문서가 있으면 최우선으로 쓴다.
  const attachment = html.match(/href="([^"]+\.(?:hwpx?|pdf|docx?))(?:"|\?)/i);
  if (attachment) {
    const doc = await downloadFile(
      new URL(attachment[1], detailUrl).toString(),
      detailUrl,
      "첨부 공고문",
    );
    if (doc) {
      return doc;
    }
  }

  // 2) 본문 영역 HTML — 주최·접수기간·시상 테이블과 요강이 풍부하다.
  const start = html.indexOf('<div class="view_cont_area');
  if (start >= 0) {
    const section = html.slice(start, start + 80_000);
    if (stripTags(section).length >= 200) {
      const docHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title></head><body>${section
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")}</body></html>`;
      return {
        bytes: Buffer.from(docHtml, "utf8"),
        mediaType: "text/html",
        filename: `${sanitizeFilename(title)}.html`,
        via: "본문 HTML",
      };
    }
  }

  // 3) 포스터 이미지 폴백
  const poster = html.match(/class="img_area">[\s\S]*?<img src="([^"]+\.(?:jpe?g|png|gif|webp))"/i);
  if (poster) {
    return downloadFile(
      new URL(poster[1], CONTESTKOREA_BASE).toString(),
      detailUrl,
      "포스터 이미지",
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// 공용 진입점
// ---------------------------------------------------------------------------

export async function fetchCrawlList(
  source: CrawlSourceKey,
  limit = 10,
): Promise<CrawlCandidate[]> {
  const config = CRAWL_SOURCES[source] ?? CRAWL_SOURCES["ck-it"];
  return config.site === "wevity"
    ? fetchWevityList(config.listUrl, limit)
    : fetchContestKoreaList(config.listUrl, limit);
}

export async function fetchCrawlDocument(
  source: CrawlSourceKey,
  detailUrl: string,
): Promise<CrawlDocument | null> {
  const config = CRAWL_SOURCES[source] ?? CRAWL_SOURCES["ck-it"];
  return config.site === "wevity"
    ? fetchWevityDocument(detailUrl)
    : fetchContestKoreaDocument(detailUrl);
}
