"use client";

import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronRightIcon as ArrowIcon,
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
import { UpstageBadge } from "@/components/upstage";
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

const PIPELINE_STEPS = [
  {
    icon: "/upstage/document-parse.svg",
    name: "Parse",
    description: "문서 구조화·OCR",
  },
  {
    icon: "/upstage/symbol.png",
    name: "Classify",
    description: "공고 유형 분류",
  },
  {
    icon: "/upstage/information-extract.svg",
    name: "Extract",
    description: "필드 10종 추출",
  },
  {
    icon: "/upstage/solar-llm.svg",
    name: "Instruct",
    description: "요약·자격 규칙화",
  },
] as const;

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
  const createdAnnouncements = [
    ...crawlItems.map((c) => c.announcement),
    ...doneItems.map((d) => d.announcement),
  ].filter((a): a is AnnouncementWithMatch => Boolean(a));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <p className="font-semibold text-[11px] text-primary uppercase tracking-[0.2em]">
        Studio Agents Pipeline
      </p>
      <h1 className="mt-1.5 flex flex-wrap items-center gap-2.5 font-bold text-3xl tracking-tight">
        공고 등록
        <UpstageBadge feature="agents" />
      </h1>
      <p className="mt-1.5 max-w-2xl text-muted-foreground text-sm">
        어떤 형태의 공고든 — 파일이든 웹이든 — 하나의 Studio 에이전트가 읽습니다. 모든 처리
        단계와 중간 산출물이 실시간으로 표시됩니다.
      </p>

      <div className="mt-6 rounded-xl border bg-card p-4">
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {PIPELINE_STEPS.map((step, index) => (
            <div className="flex flex-1 items-center gap-2" key={step.name}>
              <div className="flex flex-1 items-center gap-2.5 rounded-lg bg-muted/60 px-3 py-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={step.name}
                  className="size-6 shrink-0 rounded-md"
                  height={24}
                  src={step.icon}
                  width={24}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-xs">{step.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {index < PIPELINE_STEPS.length - 1 && (
                <ArrowIcon className="size-4 shrink-0 rotate-90 text-muted-foreground/60 sm:rotate-0" />
              )}
            </div>
          ))}
        </div>
      </div>

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

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="flex flex-col rounded-xl border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold text-sm">
            <FileUpIcon className="size-4 text-primary" />파일로 등록
          </h2>
          <p className="mt-1 text-muted-foreground text-xs">
            PDF · 포스터 이미지 · 오피스 · HWP · HTML, 여러 개 한 번에
          </p>
          <button
            className={cn(
              "mt-3 flex flex-1 flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
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
            <UploadCloudIcon className="size-7 text-primary" />
            <p className="font-medium text-sm">끌어다 놓거나 클릭해서 선택</p>
          </button>
          {queue.length > 0 && (
            <Button
              className="mt-3 w-full"
              disabled={running || pendingCount === 0}
              onClick={run}
            >
              {running ? (
                <>
                  <Spinner className="size-4" />
                  에이전트 실행 중…
                </>
              ) : (
                `에이전트로 분석 (${pendingCount}건)`
              )}
            </Button>
          )}
        </section>

        <section className="flex flex-col rounded-xl border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold text-sm">
            <GlobeIcon className="size-4 text-primary" />웹에서 자동 수집
          </h2>
          <p className="mt-1 text-muted-foreground text-xs">
            콘테스트코리아·위비티의 최신 공모전 문서를 첨부 HWP·PDF → 본문 → 포스터 순으로
            가져와 같은 파이프라인에 태웁니다.
          </p>
          <div className="mt-3 flex flex-1 flex-col justify-end gap-2">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
            <div className="flex gap-2">
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
              <Button className="flex-1" disabled={crawlWf.running} onClick={runCrawl}>
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
              <p className="rounded-lg border bg-muted/50 px-3 py-2 text-xs">{crawlMessage}</p>
            )}
          </div>
        </section>
      </div>

      {(queue.length > 0 || crawlWf.steps.length > 0 || crawlItems.length > 0) && (
        <section className="mt-8">
          <h2 className="font-semibold text-lg">처리 현황</h2>

          {queue.length > 0 && (
            <div className="mt-3 space-y-2">
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
                          <p className="mt-0.5 break-words text-destructive text-xs">
                            {item.error}
                          </p>
                        )}
                        {item.announcement && (
                          <p className="mt-0.5 truncate text-muted-foreground text-xs">
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
              <div className="pt-1">
                <Button
                  disabled={running}
                  onClick={() => {
                    setQueue([]);
                    setExpandedLogs(new Set());
                  }}
                  size="sm"
                  variant="ghost"
                >
                  목록 비우기
                </Button>
              </div>
            </div>
          )}

          {crawlWf.steps.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-muted-foreground text-xs">자동 수집 실행 과정</p>
              <WorkflowLog steps={crawlWf.steps} />
            </div>
          )}

          {crawlItems.length > 0 && (
            <ul className="mt-3 space-y-2">
              {crawlItems.map((item) => (
                <li
                  className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2"
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
        </section>
      )}

      {createdAnnouncements.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-lg">생성된 공고 카드</h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/">피드에서 보기</Link>
            </Button>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {createdAnnouncements.map((announcement) => (
              <AnnouncementCard item={announcement} key={announcement.id} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
