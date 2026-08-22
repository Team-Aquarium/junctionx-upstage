import {
  CRAWL_SOURCES,
  fetchCrawlDocument,
  fetchCrawlList,
  politeDelay,
  type CrawlSourceKey,
} from "@/lib/crawler";
import { createTranslator } from "@/lib/i18n";
import { localeFromRequest } from "@/lib/i18n/request";
import { ingestAnnouncementDocument } from "@/lib/ingest";
import { matchAnnouncement } from "@/lib/matching";
import { getProfile, listAnnouncements } from "@/lib/store";
import { runWorkflowSession } from "@/lib/workflow-session";

export const maxDuration = 300;

/** Studio 실행 과금을 고려해 한 번에 처리할 수 있는 최대 건수 */
const MAX_PER_RUN = 10;

interface CrawlResultItem {
  title: string;
  sourceUrl: string;
  status: "done" | "failed" | "skipped";
  error?: string;
  announcement?: unknown;
}

export async function POST(req: Request) {
  const t = createTranslator(localeFromRequest(req));
  const body = (await req.json().catch(() => ({}))) as {
    source?: string;
    limit?: number;
  };
  const source: CrawlSourceKey =
    body.source && body.source in CRAWL_SOURCES ? (body.source as CrawlSourceKey) : "ck-it";
  const limit = Math.min(Math.max(1, body.limit ?? 2), MAX_PER_RUN);
  const sourceLabelKeys = {
    "ck-it": "ingest.sourceCkIt",
    "ck-all": "ingest.sourceCkAll",
    it: "ingest.sourceWevityIt",
    idea: "ingest.sourceWevityIdea",
    all: "ingest.sourceWevityAll",
  } as const;
  const sourceLabel = t(sourceLabelKeys[source]);

  // 실행 중이면 새로고침해도 "crawl" 세션에 붙어 이어본다.
  return runWorkflowSession("crawl", async (emit) => {
    emit({
      type: "step",
      id: "list",
      title: t("api.listCrawl", { source: sourceLabel }),
      status: "start",
    });
    const candidates = await fetchCrawlList(source, Math.max(12, limit * 4));
    if (candidates.length === 0) {
      emit({ type: "step", id: "list", title: t("api.listCrawl", { source: sourceLabel }), status: "error" });
      emit({
        type: "error",
        message: t("api.listEmpty"),
      });
      return;
    }

    const knownUrls = new Set(
      (await listAnnouncements())
        .map((a) => a.sourceUrl)
        .filter(Boolean),
    );
    const fresh = candidates.filter((c) => !knownUrls.has(c.detailUrl)).slice(0, limit);
    emit({
      type: "step",
      id: "list",
      title: t("api.listCrawl", { source: sourceLabel }),
      status: "done",
      detail: `${candidates.length} candidates · ${fresh.length} new`,
      payload: fresh.map((c) => c.title),
    });

    if (fresh.length === 0) {
      emit({
        type: "result",
        data: { results: [], message: t("api.noFresh") },
      });
      return;
    }

    const profile = await getProfile();
    const results: CrawlResultItem[] = [];

    for (const [index, candidate] of fresh.entries()) {
      const stepId = `doc-${index}`;
      const shortTitle = candidate.title.slice(0, 28);
      try {
        emit({
          type: "step",
          id: stepId,
          title: t("api.fetchDoc", { i: index + 1, n: fresh.length, title: shortTitle }),
          status: "start",
        });
        await politeDelay();
        const document = await fetchCrawlDocument(source, candidate.detailUrl);
        if (!document) {
          emit({
            type: "step",
            id: stepId,
            title: t("api.fetchDoc", { i: index + 1, n: fresh.length, title: shortTitle }),
            status: "error",
            detail: "No document",
          });
          results.push({
            title: candidate.title,
            sourceUrl: candidate.detailUrl,
            status: "skipped",
            error: t("api.noDocSkip"),
          });
          continue;
        }
        emit({
          type: "step",
          id: stepId,
          title: t("api.fetchDoc", { i: index + 1, n: fresh.length, title: shortTitle }),
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
          (await listAnnouncements()).some((a) => a.sourceUrl === candidate.detailUrl)
        ) {
          results.push({
            title: candidate.title,
            sourceUrl: candidate.detailUrl,
            status: "skipped",
            error: t("api.concurrentSkip"),
          });
          continue;
        }

        const announcement = await ingestAnnouncementDocument(
          {
            filename: document.filename,
            mediaType: document.mediaType,
            bytes: document.bytes,
            sourceUrl: candidate.detailUrl,
            extras: document.extras,
          },
          emit,
        );
        results.push({
          title: announcement.title,
          sourceUrl: candidate.detailUrl,
          status: "done",
          announcement: { ...announcement, match: matchAnnouncement(announcement, profile, t) },
        });
      } catch (error) {
        results.push({
          title: candidate.title,
          sourceUrl: candidate.detailUrl,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    emit({ type: "result", data: { results } });
  });
}
