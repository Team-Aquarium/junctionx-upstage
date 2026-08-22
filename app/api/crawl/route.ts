import {
  CRAWL_SOURCES,
  fetchCrawlDocument,
  fetchCrawlList,
  politeDelay,
  type CrawlSourceKey,
} from "@/lib/crawler";
import { ingestAnnouncementDocument } from "@/lib/ingest";
import { matchAnnouncement } from "@/lib/matching";
import { getProfile, listAnnouncements } from "@/lib/store";
import { workflowStream } from "@/lib/workflow";

export const maxDuration = 300;

/** Studio 실행 과금을 고려해 한 번에 처리할 수 있는 최대 건수 */
const MAX_PER_RUN = 10;

interface CrawlResultItem {
  title: string;
  sourceUrl: string;
  status: "완료" | "실패" | "건너뜀";
  error?: string;
  announcement?: unknown;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    source?: string;
    limit?: number;
  };
  const source: CrawlSourceKey =
    body.source && body.source in CRAWL_SOURCES ? (body.source as CrawlSourceKey) : "ck-it";
  const limit = Math.min(Math.max(1, body.limit ?? 2), MAX_PER_RUN);
  const sourceLabel = CRAWL_SOURCES[source].label;

  return workflowStream(async (emit) => {
    emit({
      type: "step",
      id: "list",
      title: `목록 크롤링 — ${sourceLabel}`,
      status: "start",
    });
    const candidates = await fetchCrawlList(source, Math.max(12, limit * 4));
    if (candidates.length === 0) {
      emit({ type: "step", id: "list", title: `목록 크롤링 — ${sourceLabel}`, status: "error" });
      emit({
        type: "error",
        message: "목록에서 공모전을 찾지 못했습니다. 사이트 구조가 바뀌었을 수 있어요.",
      });
      return;
    }

    const knownUrls = new Set(
      listAnnouncements()
        .map((a) => a.sourceUrl)
        .filter(Boolean),
    );
    const fresh = candidates.filter((c) => !knownUrls.has(c.detailUrl)).slice(0, limit);
    emit({
      type: "step",
      id: "list",
      title: `목록 크롤링 — ${sourceLabel}`,
      status: "done",
      detail: `후보 ${candidates.length}건 · 신규 ${fresh.length}건`,
      payload: fresh.map((c) => c.title),
    });

    if (fresh.length === 0) {
      emit({
        type: "result",
        data: { results: [], message: "새로 수집할 공모전이 없습니다. (최근 목록이 모두 이미 등록됨)" },
      });
      return;
    }

    const profile = getProfile();
    const results: CrawlResultItem[] = [];

    for (const [index, candidate] of fresh.entries()) {
      const stepId = `doc-${index}`;
      const shortTitle = candidate.title.slice(0, 28);
      try {
        emit({
          type: "step",
          id: stepId,
          title: `공고 문서 수집 (${index + 1}/${fresh.length}) — ${shortTitle}`,
          status: "start",
        });
        await politeDelay();
        const document = await fetchCrawlDocument(source, candidate.detailUrl);
        if (!document) {
          emit({
            type: "step",
            id: stepId,
            title: `공고 문서 수집 (${index + 1}/${fresh.length}) — ${shortTitle}`,
            status: "error",
            detail: "문서 없음",
          });
          results.push({
            title: candidate.title,
            sourceUrl: candidate.detailUrl,
            status: "건너뜀",
            error: "공고 문서(첨부·본문·포스터)를 찾지 못했습니다.",
          });
          continue;
        }
        emit({
          type: "step",
          id: stepId,
          title: `공고 문서 수집 (${index + 1}/${fresh.length}) — ${shortTitle}`,
          status: "done",
          detail: `${document.via} · ${(document.bytes.length / 1024).toFixed(0)}KB`,
          payload: {
            filename: document.filename,
            mediaType: document.mediaType,
            via: document.via,
            sourceUrl: candidate.detailUrl,
          },
        });

        // 다른 탭·사용자가 동시에 같은 공고를 수집했을 수 있으니 저장 직전에 재확인한다.
        if (
          listAnnouncements().some((a) => a.sourceUrl === candidate.detailUrl)
        ) {
          results.push({
            title: candidate.title,
            sourceUrl: candidate.detailUrl,
            status: "건너뜀",
            error: "이미 등록된 공고입니다. (동시 실행 감지)",
          });
          continue;
        }

        const announcement = await ingestAnnouncementDocument(
          {
            filename: document.filename,
            mediaType: document.mediaType,
            bytes: document.bytes,
            sourceUrl: candidate.detailUrl,
          },
          emit,
        );
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

    emit({ type: "result", data: { results } });
  });
}
