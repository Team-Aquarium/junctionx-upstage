"use client";

import {
  ArrowDownIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileTextIcon,
  GlobeIcon,
  Link2Icon,
  UploadCloudIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AnnouncementCard,
  type AnnouncementWithMatch,
} from "@/components/announcement";
import { UpstageBadge } from "@/components/upstage";
import { useWorkflowStream, WorkflowLog, type WorkflowStep } from "@/components/workflow";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.bmp,.tif,.tiff,.heic,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.hwp,.hwpx,.html";

type ItemStatus = "queued" | "processing" | "done" | "failed";

interface QueueItem {
  file: File;
  status: ItemStatus;
  error?: string;
  announcement?: AnnouncementWithMatch;
  log?: WorkflowStep[];
}

const CRAWL_SOURCES = [
  { value: "ck-it", labelKey: "ingest.sourceCkIt" },
  { value: "ck-all", labelKey: "ingest.sourceCkAll" },
  { value: "it", labelKey: "ingest.sourceWevityIt" },
  { value: "idea", labelKey: "ingest.sourceWevityIdea" },
  { value: "all", labelKey: "ingest.sourceWevityAll" },
] as const;

interface WebItem {
  title: string;
  sourceUrl: string;
  status: "done" | "failed" | "skipped";
  error?: string;
  announcement?: AnnouncementWithMatch;
}

const MAX_CRAWL_LIMIT = 10;

const PIPELINE_STEPS = [
  {
    icon: "/upstage/document-parse.svg",
    step: "1",
    title: "Document Parse",
    descKey: "ingest.step1Desc",
  },
  {
    icon: "/upstage/symbol.svg",
    step: "2",
    title: "Category Classify",
    descKey: "ingest.step2Desc",
  },
  {
    icon: "/upstage/information-extract.svg",
    step: "3",
    title: "Information Extract",
    descKey: "ingest.step3Desc",
  },
  {
    icon: "/upstage/solar-llm.svg",
    step: "4",
    title: "Solar Pro 4",
    descKey: "ingest.step4Desc",
  },
] as const;

export default function IngestPage() {
  const t = useT();
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
  const [webItems, setWebItems] = useState<WebItem[]>([]);
  const crawlWf = useWorkflowStream();

  const [linkUrl, setLinkUrl] = useState("");
  const linkWf = useWorkflowStream();

  const { run: runCrawlWf } = crawlWf;
  const { run: runLinkWf } = linkWf;
  const { run: runUploadWf } = uploadWf;
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/workflows");
        const { active } = (await res.json()) as { active: string[] };

        if (active.includes("crawl")) {
          runCrawlWf<{ results: WebItem[]; message?: string }>(
            "/api/workflows/attach?key=crawl",
          ).then((data) => {
            if (data) {
              setWebItems((prev) => [...(data.results ?? []), ...prev]);
              if (data.message) {
                setCrawlMessage(data.message);
              }
            }
          });
        }

        const linkKey = active.find((key) => key.startsWith("link:"));
        if (linkKey) {
          runLinkWf<{ announcement: AnnouncementWithMatch }>(
            `/api/workflows/attach?key=${encodeURIComponent(linkKey)}`,
          ).then((data) => {
            if (data?.announcement) {
              setWebItems((prev) => [
                {
                  title: data.announcement.title,
                  sourceUrl: linkKey.slice(5),
                  status: "done",
                  announcement: data.announcement,
                },
                ...prev,
              ]);
            }
          });
        }

        const ingestKey = active.find((key) => key.startsWith("ingest:"));
        if (ingestKey) {
          runUploadWf<{ announcement: AnnouncementWithMatch }>(
            `/api/workflows/attach?key=${encodeURIComponent(ingestKey)}`,
          ).then((data) => {
            if (data?.announcement) {
              setWebItems((prev) => [
                {
                  title: data.announcement.title,
                  sourceUrl: `resumed-${data.announcement.id}`,
                  status: "done",
                  announcement: data.announcement,
                },
                ...prev,
              ]);
            }
          });
        }
      } catch {
        // ignore
      }
    })();
  }, [runCrawlWf, runLinkWf, runUploadWf]);

  const addFiles = (files: FileList | File[]) => {
    const items = [...files].map((file) => ({ file, status: "queued" as ItemStatus }));
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
      if (queue[i].status === "done") {
        continue;
      }
      setActiveIndex(i);
      updateItem(i, { status: "processing", error: undefined, log: undefined });
      const form = new FormData();
      form.append("file", queue[i].file);
      const data = await uploadWf.run<{ announcement: AnnouncementWithMatch }>("/api/ingest", {
        method: "POST",
        body: form,
      });
      const log = [...uploadWf.stepsRef.current];
      if (data?.announcement) {
        updateItem(i, { status: "done", announcement: data.announcement, log });
      } else {
        updateItem(i, {
          status: "failed",
          error: uploadWf.errorRef.current ?? t("common.unknownError"),
          log,
        });
      }
    }
    setActiveIndex(null);
    setRunning(false);
  };

  const runCrawl = async () => {
    setCrawlMessage(null);
    const data = await crawlWf.run<{ results: WebItem[]; message?: string }>("/api/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: crawlSource, limit: crawlLimit }),
    });
    if (data) {
      setWebItems((prev) => [...(data.results ?? []), ...prev]);
      if (data.message) {
        setCrawlMessage(data.message);
      }
    } else if (crawlWf.errorRef.current) {
      setCrawlMessage(crawlWf.errorRef.current);
    }
  };

  const runLink = async () => {
    const url = linkUrl.trim();
    if (!url) {
      return;
    }
    const data = await linkWf.run<{ announcement: AnnouncementWithMatch }>("/api/ingest/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (data?.announcement) {
      setWebItems((prev) => [
        {
          title: data.announcement.title,
          sourceUrl: url,
          status: "done",
          announcement: data.announcement,
        },
        ...prev,
      ]);
      setLinkUrl("");
    } else {
      setWebItems((prev) => [
        {
          title: url,
          sourceUrl: url,
          status: "failed",
          error: linkWf.errorRef.current ?? t("common.unknownError"),
        },
        ...prev,
      ]);
    }
  };

  const doneItems = queue.filter((item) => item.announcement);
  const pendingCount = queue.filter(
    (item) => item.status === "queued" || item.status === "failed",
  ).length;
  const createdAnnouncements = [
    ...webItems.map((c) => c.announcement),
    ...doneItems.map((d) => d.announcement),
  ].filter((a): a is AnnouncementWithMatch => Boolean(a));

  return (
    <div className="w-full py-10 sm:py-14">
      <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 space-y-10">
        {/* Header */}
        <div>
          <span className="text-xs font-semibold tracking-wider text-primary uppercase">
            Studio Agents
          </span>
          <h1 className="mt-1 flex items-center gap-3 font-bold text-3xl tracking-tight text-foreground">
            {t("ingest.title")}
            <UpstageBadge compact feature="agents" />
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {t("ingest.subtitle")}
          </p>
        </div>

        {/* Pipeline Steps Diagram */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-foreground">
              {t("ingest.pipelineTitle")}
            </h2>
            <span className="text-xs text-muted-foreground">
              {t("ingest.pipelineHint")}
            </span>
          </div>

          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 lg:gap-0">
            {PIPELINE_STEPS.map((step, idx) => (
              <div
                className="flex flex-1 flex-col lg:flex-row items-stretch lg:items-center gap-2"
                key={step.title}
              >
                <div className="flex flex-1 items-start gap-3 rounded-lg bg-secondary/60 p-3.5 border border-border/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={step.title}
                    className="size-6 object-contain shrink-0 mt-0.5"
                    height={24}
                    src={step.icon}
                    width={24}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[11px] text-primary">0{step.step}</span>
                      <h3 className="font-semibold text-xs text-foreground truncate">
                        {step.title}
                      </h3>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                      {t(step.descKey)}
                    </p>
                  </div>
                </div>

                {idx < PIPELINE_STEPS.length - 1 && (
                  <div className="flex items-center justify-center py-1 lg:py-0 lg:px-2 text-muted-foreground/50 shrink-0">
                    <ArrowRightIcon className="hidden lg:block size-4" />
                    <ArrowDownIcon className="lg:hidden size-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Ingest Source Cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Method 1: Link */}
          <section className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link2Icon className="size-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">{t("ingest.linkTitle")}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("ingest.linkBody")}
              </p>
            </div>

            <div className="space-y-2">
              <input
                className="h-8 w-full rounded-lg border border-input bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                disabled={linkWf.running}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runLink()}
                placeholder="https://..."
                type="url"
                value={linkUrl}
              />
              <Button
                className="h-8 w-full"
                disabled={linkWf.running || !linkUrl.trim()}
                onClick={runLink}
                size="sm"
              >
                {linkWf.running ? <Spinner className="size-4" /> : t("ingest.linkCta")}
              </Button>
            </div>
          </section>

          {/* Method 2: File Upload */}
          <section className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileTextIcon className="size-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">{t("ingest.fileTitle")}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("ingest.fileBody")}
              </p>
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

            <div className="space-y-2">
              <button
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-4 text-center transition-colors cursor-pointer",
                  dragOver ? "border-primary bg-accent/30" : "border-border hover:bg-muted/40",
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
                <UploadCloudIcon className="size-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">
                  {t("ingest.drop")}
                </span>
              </button>

              {queue.length > 0 && (
                <Button
                  className="w-full"
                  disabled={running || pendingCount === 0}
                  onClick={run}
                  size="sm"
                >
                  {running ? <Spinner className="size-4" /> : t("ingest.runAgent", { n: pendingCount })}
                </Button>
              )}
            </div>
          </section>

          {/* Method 3: Web Auto Crawler */}
          <section className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GlobeIcon className="size-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">{t("ingest.crawlTitle")}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("ingest.crawlBody")}
              </p>
            </div>

            <div className="space-y-2">
              <select
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
                disabled={crawlWf.running}
                onChange={(e) => setCrawlSource(e.target.value)}
                value={crawlSource}
              >
                {CRAWL_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(s.labelKey)}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <div className="flex h-8 w-28 shrink-0 items-center justify-between rounded-lg border border-input bg-background px-2.5 text-xs focus-within:border-primary">
                  <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">{t("ingest.crawlQty")}</span>
                  <input
                    className="w-10 bg-transparent text-center text-xs font-semibold text-foreground outline-none"
                    disabled={crawlWf.running}
                    max={MAX_CRAWL_LIMIT}
                    min={1}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      setCrawlLimit(
                        Number.isFinite(n) ? Math.min(Math.max(1, n), MAX_CRAWL_LIMIT) : 1,
                      );
                    }}
                    type="number"
                    value={crawlLimit}
                  />
                  <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">{t("ingest.crawlUnit")}</span>
                </div>
                <Button
                  className="h-8 flex-1"
                  disabled={crawlWf.running}
                  onClick={runCrawl}
                  size="sm"
                >
                  {crawlWf.running ? <Spinner className="size-4" /> : t("ingest.crawlStart")}
                </Button>
              </div>
              {crawlMessage && (
                <p className="text-[11px] text-muted-foreground">{crawlMessage}</p>
              )}
            </div>
          </section>
        </div>

        {/* Processing Queues & Workflow Logs */}
        {(queue.length > 0 ||
          uploadWf.steps.length > 0 ||
          crawlWf.steps.length > 0 ||
          linkWf.steps.length > 0 ||
          webItems.length > 0) && (
          <section className="space-y-3 pt-4 border-t border-border/80">
            <h2 className="font-bold text-base text-foreground">
              {t("ingest.statusTitle")}
            </h2>

            {queue.length > 0 && (
              <div className="space-y-2">
                {queue.map((item, index) => {
                  const isActive = activeIndex === index;
                  const log = isActive ? uploadWf.steps : item.log;
                  const showLog = isActive || expandedLogs.has(index);
                  return (
                    <div
                      className="rounded-lg border border-border bg-card p-3.5"
                      key={`${item.file.name}-${index}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-xs text-foreground truncate">
                            {item.file.name}
                          </p>
                          {item.announcement && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {item.announcement.category} · {item.announcement.title}
                            </p>
                          )}
                          {item.error && (
                            <p className="text-[11px] text-destructive truncate">{item.error}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {log && log.length > 0 && !isActive && (
                            <button
                              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                              onClick={() => toggleLog(index)}
                              type="button"
                            >
                              {t("ingest.process", { n: log.length })}
                              {showLog ? (
                                <ChevronDownIcon className="size-3" />
                              ) : (
                                <ChevronRightIcon className="size-3" />
                              )}
                            </button>
                          )}

                          {item.status === "queued" && (
                            <span className="text-[11px] text-muted-foreground">{t("ingest.queued")}</span>
                          )}
                          {item.status === "processing" && (
                            <Spinner className="size-3.5 text-primary" />
                          )}
                          {item.status === "done" && (
                            <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                          )}
                          {item.status === "failed" && (
                            <XCircleIcon className="size-4 text-destructive" />
                          )}
                        </div>
                      </div>

                      {log && log.length > 0 && showLog && (
                        <div className="mt-3 pt-3 border-t border-border">
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
                    {t("ingest.clearList")}
                  </Button>
                </div>
              </div>
            )}

            {linkWf.steps.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-4">
                <WorkflowLog steps={linkWf.steps} />
              </div>
            )}

            {crawlWf.steps.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-4">
                <WorkflowLog steps={crawlWf.steps} />
              </div>
            )}

            {webItems.length > 0 && (
              <div className="space-y-1.5 pt-2">
                {webItems.map((item) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs"
                    key={item.sourceUrl}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.status === "done" ? (
                        <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : item.status === "skipped" ? (
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {t("ingest.skipped")}
                        </span>
                      ) : (
                        <XCircleIcon className="size-3.5 text-destructive shrink-0" />
                      )}
                      <p className="font-medium text-foreground truncate">{item.title}</p>
                    </div>

                    {item.sourceUrl.startsWith("http") && (
                      <a
                        className="text-muted-foreground hover:text-foreground underline shrink-0"
                        href={item.sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {t("common.original")}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Created Announcements Preview */}
        {createdAnnouncements.length > 0 && (
          <section className="space-y-4 pt-6 border-t border-border/80">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-foreground">
                {t("ingest.createdTitle", { n: createdAnnouncements.length })}
              </h2>
              <Button asChild size="sm" variant="outline">
                <Link href="/feed">
                  {t("ingest.goFeed")}
                  <ArrowRightIcon className="size-3.5 ml-1" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {createdAnnouncements.map((announcement) => (
                <AnnouncementCard item={announcement} key={announcement.id} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
