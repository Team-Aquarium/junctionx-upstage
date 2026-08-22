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
    label: "ContestKorea · Science / IT",
    site: "contestkorea",
    listUrl: `${CONTESTKOREA_BASE}sub/list.php?int_gbn=1&Txt_bcode=030310001`,
  },
  "ck-all": {
    label: "ContestKorea · All",
    site: "contestkorea",
    listUrl: `${CONTESTKOREA_BASE}sub/list.php?int_gbn=1`,
  },
  it: {
    label: "Wevity · Web / Mobile / IT",
    site: "wevity",
    listUrl: `${WEVITY_BASE}?c=find&s=1&gub=1&cidx=20`,
  },
  idea: {
    label: "Wevity · Planning / Ideas",
    site: "wevity",
    listUrl: `${WEVITY_BASE}?c=find&s=1&gub=1&cidx=21`,
  },
  all: {
    label: "Wevity · All contests",
    site: "wevity",
    listUrl: `${WEVITY_BASE}?c=find&s=1&gub=1`,
  },
} as const;

export type CrawlSourceKey = keyof typeof CRAWL_SOURCES;

export interface CrawlCandidate {
  title: string;
  detailUrl: string;
}

export interface CrawlExtraDocument {
  bytes: Buffer;
  mediaType: string;
  filename: string;
}

export interface CrawlDocument {
  bytes: Buffer;
  mediaType: string;
  filename: string;
  /** 문서를 어떤 경로로 얻었는지: 첨부 공고문 / 본문 HTML / 포스터 이미지 */
  via: string;
  /** 함께 에이전트에 투입할 보조 문서 (예: 첨부가 신청서일 때 본문 HTML) */
  extras?: CrawlExtraDocument[];
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
    throw new Error(`Page request failed (HTTP ${res.status}): ${url}`);
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
  return downloadFile(new URL(match[1], WEVITY_BASE).toString(), detailUrl, "poster image");
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

/** 파일명으로 첨부 우선순위를 매긴다: 요강·공고문(0) > 일반(1) > 신청서·양식(2) */
function attachmentPriority(name: string): number {
  if (/공고|요강|모집|계획|안내|포스터/i.test(name)) {
    return 0;
  }
  if (/신청|지원서|양식|서식|동의|제출/i.test(name)) {
    return 2;
  }
  return 1;
}

async function fetchContestKoreaAttachment(
  html: string,
  detailUrl: string,
): Promise<CrawlDocument | null> {
  const candidates = [...html.matchAll(/<a href="([^"]+)"[^>]*>([^<]*\.(?:hwpx?|pdf|docx?))\s*<\/a>/gi)]
    .map((match) => ({
      href: match[1].replace(/&amp;/g, "&"),
      name: stripTags(match[2]).trim(),
    }))
    .filter(
      (candidate) =>
        candidate.name.length > 0 &&
        (/file_dn\.php|download/i.test(candidate.href) ||
          /\.(?:hwpx?|pdf|docx?)(?:\?|$)/i.test(candidate.href)),
    )
    .sort((a, b) => attachmentPriority(a.name) - attachmentPriority(b.name));

  for (const candidate of candidates) {
    try {
      const fileUrl = new URL(candidate.href, detailUrl).toString();
      const res = await fetch(encodeURI(decodeURI(fileUrl)), {
        headers: { "User-Agent": USER_AGENT, Referer: detailUrl },
        redirect: "follow",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        continue;
      }
      const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
      // 다운로드 핸들러가 에러를 HTML로 돌려주는 경우를 거른다.
      if (/text\/html/i.test(contentType)) {
        continue;
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length < 500) {
        continue;
      }
      return {
        bytes,
        mediaType: contentType || "application/octet-stream",
        filename: sanitizeFilename(candidate.name) || "attachment.hwp",
        via: "attached notice",
      };
    } catch {
      // 다음 후보 시도
    }
  }
  return null;
}

async function fetchContestKoreaDocument(detailUrl: string): Promise<CrawlDocument | null> {
  const html = await fetchHtml(detailUrl);
  const title =
    stripTags(html.match(/<div class="view_top_area[^>]*>[\s\S]*?<h1>([\s\S]*?)<\/h1>/)?.[1] ?? "") ||
    "contest";

  // 본문 영역 HTML — 주최·접수기간·시상 테이블과 요강이 풍부하다.
  let bodyDoc: CrawlExtraDocument | null = null;
  const start = html.indexOf('<div class="view_cont_area');
  if (start >= 0) {
    const section = html.slice(start, start + 80_000);
    if (stripTags(section).length >= 200) {
      const docHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title></head><body>${section
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")}</body></html>`;
      bodyDoc = {
        bytes: Buffer.from(docHtml, "utf8"),
        mediaType: "text/html",
        filename: `${sanitizeFilename(title)}.html`,
      };
    }
  }

  // 1) 첨부 공고문 (HWP/PDF/DOC) — 진짜 공고 문서가 있으면 최우선으로 쓴다.
  // 콘테스트코리아 첨부는 href에 확장자가 없는 다운로드 핸들러(file_dn.php)이고
  // 파일명은 앵커 텍스트에 있다: <a href="file_dn.php?...">공고문.hwp</a>
  // 첨부가 신청서 양식이라 접수기간 등이 빠질 수 있으니 본문 HTML을 보조 문서로 함께 태운다.
  const attachmentDoc = await fetchContestKoreaAttachment(html, detailUrl);
  if (attachmentDoc) {
    return {
      ...attachmentDoc,
      via: bodyDoc ? "attached notice + page body" : attachmentDoc.via,
      extras: bodyDoc ? [bodyDoc] : undefined,
    };
  }

  // 2) 본문 영역 HTML
  if (bodyDoc) {
    return { ...bodyDoc, via: "page HTML" };
  }

  // 3) 포스터 이미지 폴백
  const poster = html.match(/class="img_area">[\s\S]*?<img src="([^"]+\.(?:jpe?g|png|gif|webp))"/i);
  if (poster) {
    return downloadFile(
      new URL(poster[1], CONTESTKOREA_BASE).toString(),
      detailUrl,
      "poster image",
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// 임의 공고 링크 → 문서
// ---------------------------------------------------------------------------

const FILE_MIME_PATTERN = /pdf|image|hwp|msword|officedocument|octet-stream/i;

/**
 * 사용자가 붙여넣은 공고 링크에서 문서를 만든다.
 * - 위비티·콘테스트코리아 링크는 전용 수집기로 처리
 * - 파일 링크(PDF·이미지·HWP 등)는 그대로 다운로드
 * - 일반 웹페이지는 본문 HTML을 문서로 감싼다 (JS 렌더링 페이지는 실패)
 */
export async function fetchLinkDocument(url: string): Promise<CrawlDocument | null> {
  const host = new URL(url).hostname;
  if (host.includes("wevity.com")) {
    return fetchWevityDocument(url);
  }
  if (host.includes("contestkorea.com")) {
    return fetchContestKoreaDocument(url);
  }

  const res = await fetch(encodeURI(decodeURI(url)), {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/pdf,image/*,*/*",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Page request failed (HTTP ${res.status})`);
  }

  const mediaType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (FILE_MIME_PATTERN.test(mediaType)) {
    const rawName = decodeURIComponent(url.split("/").pop()?.split("?")[0] || "document");
    return {
      bytes: Buffer.from(await res.arrayBuffer()),
      mediaType: mediaType || "application/octet-stream",
      filename: rawName.slice(-80) || "document",
      via: "file link",
    };
  }

  const html = await res.text();
  const title =
    stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || "notice";
  const body = (html.match(/<body[\s\S]*?<\/body>/i)?.[0] ?? html)
    .replace(/<\/?body[^>]*>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .slice(0, 150_000);
  if (stripTags(body).length < 200) {
    return null;
  }
  const docHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1>${body}</body></html>`;
  return {
    bytes: Buffer.from(docHtml, "utf8"),
    mediaType: "text/html",
    filename: `${sanitizeFilename(title)}.html`,
    via: "web page body",
  };
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
