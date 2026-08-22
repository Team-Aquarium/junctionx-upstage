import { NextResponse } from "next/server";
import {
  fetchWevityList,
  fetchWevityPoster,
  politeDelay,
  type CrawlSourceKey,
} from "@/lib/crawler";
import { ingestAnnouncementDocument } from "@/lib/ingest";
import { matchAnnouncement } from "@/lib/matching";
import { getProfile, listAnnouncements } from "@/lib/store";

export const maxDuration = 300;

/** Studio 실행 과금을 고려해 한 번에 처리할 수 있는 최대 건수 */
const MAX_PER_RUN = 3;

interface CrawlResultItem {
  title: string;
  sourceUrl: string;
  status: "완료" | "실패" | "건너뜀";
  error?: string;
  announcement?: unknown;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    source?: CrawlSourceKey;
    limit?: number;
  };
  const source: CrawlSourceKey = body.source ?? "it";
  const limit = Math.min(Math.max(1, body.limit ?? 2), MAX_PER_RUN);

  try {
    const candidates = await fetchWevityList(source, 12);
    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "목록에서 공모전을 찾지 못했습니다. 사이트 구조가 바뀌었을 수 있어요." },
        { status: 502 },
      );
    }

    const knownUrls = new Set(
      listAnnouncements()
        .map((a) => a.sourceUrl)
        .filter(Boolean),
    );
    const fresh = candidates.filter((c) => !knownUrls.has(c.detailUrl)).slice(0, limit);
    if (fresh.length === 0) {
      return NextResponse.json({
        results: [],
        message: "새로 수집할 공모전이 없습니다. (최근 목록이 모두 이미 등록됨)",
      });
    }

    const profile = getProfile();
    const results: CrawlResultItem[] = [];

    for (const candidate of fresh) {
      try {
        await politeDelay();
        const poster = await fetchWevityPoster(candidate.detailUrl);
        if (!poster) {
          results.push({
            title: candidate.title,
            sourceUrl: candidate.detailUrl,
            status: "건너뜀",
            error: "포스터 이미지를 찾지 못했습니다.",
          });
          continue;
        }
        const announcement = await ingestAnnouncementDocument({
          filename: poster.filename,
          mediaType: poster.mediaType,
          bytes: poster.bytes,
          sourceUrl: candidate.detailUrl,
        });
        results.push({
          title: announcement.title,
          sourceUrl: candidate.detailUrl,
          status: "완료",
          announcement: { ...announcement, match: matchAnnouncement(announcement, profile) },
        });
      } catch (error) {
        results.push({
          title: candidate.title,
          sourceUrl: candidate.detailUrl,
          status: "실패",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
