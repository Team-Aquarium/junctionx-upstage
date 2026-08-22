"use client";

import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileUpIcon,
  GlobeIcon,
  UploadCloudIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  AnnouncementCard,
  type AnnouncementWithMatch,
} from "@/components/announcement";
import { useWorkflowStream, WorkflowLog, type WorkflowStep } from "@/components/workflow";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.bmp,.tif,.tiff,.heic,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.hwp,.hwpx,.html";

type ItemStatus = "대기" | "처리 중" | "완료" | "실패";

interface QueueItem {
  file: File;
  status: ItemStatus;
  error?: string;
  announcement?: AnnouncementWithMatch;
  log?: WorkflowStep[];
}

const CRAWL_SOURCES = [
  { value: "ck-it", label: "콘테스트코리아 · 학문/과학/IT" },
  { value: "ck-all", label: "콘테스트코리아 · 전체" },
  { value: "it", label: "위비티 · 웹/모바일/IT" },
  { value: "idea", label: "위비티 · 기획/아이디어" },
  { value: "all", label: "위비티 · 전체" },
] as const;

interface CrawlItem {
  title: string;
  sourceUrl: string;
  status: "완료" | "실패" | "건너뜀";
  error?: string;
  announcement?: AnnouncementWithMatch;
}

export default function IngestPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadWf = useWorkflowStream();

  const [crawlSource, setCrawlSource] = useState<string>("ck-it");
  const [crawlLimit, setCrawlLimit] = useState(2);
  const [crawlMessage, setCrawlMessage] = useState<string | null>(null);
  const [crawlItems, setCrawlItems] = useState<CrawlItem[]>([]);
  const crawlWf = useWorkflowStream();

  const addFiles = (files: FileList | File[]) => {
    const items = [...files].map((file) => ({ file, status: "대기" as ItemStatus }));
    setQueue((prev) => [...prev, ...items]);
  };

  const updateItem = (index: number, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const toggleLog = (index: number) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const run = async () => {
    setRunning(true);
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === "완료") {
        continue;
      }
      setActiveIndex(i);
      updateItem(i, { status: "처리 중", error: undefined, log: undefined });
      const form = new FormData();
      form.append("file", queue[i].file);
      const data = await uploadWf.run<{ announcement: AnnouncementWithMatch }>("/api/ingest", {
        method: "POST",
        body: form,
      });
      const log = [...uploadWf.stepsRef.current];
      if (data?.announcement) {
        updateItem(i, { status: "완료", announcement: data.announcement, log });
      } else {
        updateItem(i, {
          status: "실패",
          error: uploadWf.errorRef.current ?? "알 수 없는 오류",
          log,
        });
      }
    }
    setActiveIndex(null);
    setRunning(false);
  };

  const runCrawl = async () => {
    setCrawlMessage(null);
    const data = await crawlWf.run<{ results: CrawlItem[]; message?: string }>("/api/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: crawlSource, limit: crawlLimit }),
    });
    if (data) {
      setCrawlItems((prev) => [...(data.results ?? []), ...prev]);
      if (data.message) {
        setCrawlMessage(data.message);
      }
    } else if (crawlWf.errorRef.current) {
      setCrawlMessage(crawlWf.errorRef.current);
    }
  };

  const doneItems = queue.filter((item) => item.announcement);
  const pendingCount = queue.filter(
    (item) => item.status === "대기" || item.status === "실패",
  ).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="font-bold text-2xl tracking-tight">공고 등록</h1>
      <p className="mt-1 text-muted-foreground text-sm">
        공고문 PDF·포스터 이미지·HWP를 올리면 Studio 에이전트(Parse → Classify → Extract →
        Instruct)가 구조화된 공고 카드로 만들어 줍니다. 모든 단계와 중간 산출물이 아래에 실시간으로
        표시됩니다.
      </p>

      <input
        accept={ACCEPT}
        className="hidden"
        multiple
        onChange={(e) => {
          if (e.target.files?.length) {
            addFiles(e.target.files);
          }
          e.target.value = "";
        }}
        ref={inputRef}
        type="file"
      />

      <button
        className={cn(
          "mt-6 flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
        )}
        onClick={() => inputRef.current?.click()}
        onDragLeave={() => setDragOver(false)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) {
            addFiles(e.dataTransfer.files);
          }
        }}
        type="button"
      >
        <UploadCloudIcon className="size-8 text-primary" />
        <div>
          <p className="font-medium text-sm">공고문을 끌어다 놓거나 클릭해서 선택</p>
          <p className="mt-1 text-muted-foreground text-xs">
            PDF · 이미지 · 오피스 · HWP · HTML — 여러 개 한 번에 가능
          </p>
        </div>
      </button>

      {queue.length > 0 && (
        <div className="mt-4 space-y-2">
          {queue.map((item, index) => {
            const isActive = activeIndex === index;
            const log = isActive ? uploadWf.steps : item.log;
            const showLog = isActive || expandedLogs.has(index);
            return (
              <div className="rounded-lg border bg-card" key={`${item.file.name}-${index}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <FileUpIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{item.file.name}</p>
                    {item.status === "실패" && (
                      <p className="mt-0.5 break-words text-destructive text-xs">{item.error}</p>
                    )}
                    {item.announcement && (
                      <p className="mt-0.5 text-muted-foreground text-xs">
                        {item.announcement.category} · {item.announcement.title}
                      </p>
                    )}
                  </div>
                  {log && log.length > 0 && !isActive && (
                    <button
                      className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
                      onClick={() => toggleLog(index)}
                      type="button"
                    >
                      과정 {log.length}단계
                      {showLog ? (
                        <ChevronDownIcon className="size-3.5" />
                      ) : (
                        <ChevronRightIcon className="size-3.5" />
                      )}
                    </button>
                  )}
                  <span className="shrink-0">
                    {item.status === "대기" && (
                      <span className="text-muted-foreground text-xs">대기</span>
                    )}
                    {item.status === "처리 중" && <Spinner className="size-4 text-primary" />}
                    {item.status === "완료" && (
                      <CheckCircle2Icon className="size-4.5 text-primary" />
                    )}
                    {item.status === "실패" && (
                      <XCircleIcon className="size-4.5 text-destructive" />
                    )}
                  </span>
                </div>
                {log && log.length > 0 && showLog && (
                  <div className="border-t px-4 py-3">
                    <WorkflowLog steps={log} />
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex items-center gap-2 pt-1">
            <Button disabled={running || pendingCount === 0} onClick={run}>
              {running ? (
                <>
                  <Spinner className="size-4" />
                  에이전트 실행 중…
                </>
              ) : (
                `에이전트로 분석 (${pendingCount}건)`
              )}
            </Button>
            <Button
              disabled={running}
              onClick={() => {
                setQueue([]);
                setExpandedLogs(new Set());
              }}
              variant="ghost"
            >
              비우기
            </Button>
          </div>
        </div>
      )}

      <div className="mt-8 rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 font-semibold text-sm">
          <GlobeIcon className="size-4 text-primary" />공모전 사이트에서 자동 수집
        </h2>
        <p className="mt-1 text-muted-foreground text-xs">
          콘테스트코리아·위비티 최신 공모전의 공고 문서(첨부 HWP·PDF → 본문 → 포스터 순)를
          가져와 같은 에이전트 파이프라인에 태웁니다. 이미 수집한 공고는 건너뜁니다.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            disabled={crawlWf.running}
            onChange={(e) => setCrawlSource(e.target.value)}
            value={crawlSource}
          >
            {CRAWL_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            disabled={crawlWf.running}
            onChange={(e) => setCrawlLimit(Number(e.target.value))}
            value={crawlLimit}
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}건
              </option>
            ))}
          </select>
          <Button disabled={crawlWf.running} onClick={runCrawl}>
            {crawlWf.running ? (
              <>
                <Spinner className="size-4" />
                수집·분석 중…
              </>
            ) : (
              "수집 시작"
            )}
          </Button>
        </div>
        {crawlMessage && (
          <p className="mt-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">{crawlMessage}</p>
        )}
        {crawlWf.steps.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-muted-foreground text-xs">실행 과정</p>
            <WorkflowLog steps={crawlWf.steps} />
          </div>
        )}
        {crawlItems.length > 0 && (
          <ul className="mt-3 space-y-2">
            {crawlItems.map((item) => (
              <li
                className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2"
                key={item.sourceUrl}
              >
                <span className="shrink-0">
                  {item.status === "완료" ? (
                    <CheckCircle2Icon className="size-4 text-primary" />
                  ) : (
                    <XCircleIcon className="size-4 text-destructive" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{item.title}</p>
                  {item.error && (
                    <p className="truncate text-destructive text-xs">{item.error}</p>
                  )}
                </div>
                <a
                  className="shrink-0 text-muted-foreground text-xs underline underline-offset-2"
                  href={item.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  원문
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(doneItems.length > 0 || crawlItems.some((c) => c.announcement)) && (
        <div className="mt-8">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">생성된 공고 카드</h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/">피드에서 보기</Link>
            </Button>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {[...crawlItems.map((c) => c.announcement), ...doneItems.map((d) => d.announcement)]
              .filter((a): a is AnnouncementWithMatch => Boolean(a))
              .map((announcement) => (
                <AnnouncementCard item={announcement} key={announcement.id} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
