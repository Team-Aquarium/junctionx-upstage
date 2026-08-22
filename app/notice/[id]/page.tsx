"use client";

import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HelpCircleIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CategoryBadge,
  ddayInfo,
  DdayBadge,
  VerdictBadge,
  type AnnouncementWithMatch,
} from "@/components/announcement";
import { UpstageBadge } from "@/components/upstage";
import { readWorkflowResult } from "@/components/workflow";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { createDemoNotice, createDemoRecommendation, DEMO_NOTICE_ID } from "@/lib/demo-notice";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export default function NoticeDetailPage() {
  const { t, locale } = useI18n();
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const [item, setItem] = useState<AnnouncementWithMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [rec, setRec] = useState<{ score: number; reason: string } | null>(null);

  useEffect(() => {
    if (!id) return;

    if (id === DEMO_NOTICE_ID) {
      setItem(createDemoNotice(t));
      setRec(createDemoRecommendation(t));
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/announcements");
        const data = await res.json();
        const found =
          (data.announcements as AnnouncementWithMatch[]).find((a) => a.id === id) ?? null;
        setItem(found);
      } finally {
        setLoading(false);
      }
    })();

    readWorkflowResult<{ recommendations: { id: string; score: number; reason: string }[] }>(
      "/api/recommendations",
    )
      .then((data) => {
        const found = (data?.recommendations ?? []).find((r) => r.id === id);
        setRec(found ?? null);
      })
      .catch(() => setRec(null));
  }, [id, locale, t]);

  const toggleCheck = (index: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-4xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="font-bold text-lg text-foreground">{t("notice.notFoundTitle")}</h2>
        <p className="text-xs text-muted-foreground">
          {t("notice.notFoundBody")}
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/feed">
            <ArrowLeftIcon className="size-4" />
            {t("notice.backFeed")}
          </Link>
        </Button>
      </div>
    );
  }

  const dday = ddayInfo(item.apply_end);

  return (
    <div className="w-full py-10 sm:py-12">
      <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 space-y-8">
        {/* Breadcrumb */}
        <div>
          <Link
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            href="/feed"
          >
            <ArrowLeftIcon className="size-3.5" />
            {t("notice.backList")}
          </Link>
        </div>

        {/* Title Header */}
        <div className="space-y-3 pb-6 border-b border-border/80">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={item.category} />
            <VerdictBadge verdict={item.match.verdict} />
            <DdayBadge applyEnd={item.apply_end} />
            {item.field && (
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {item.field}
              </span>
            )}
          </div>

          <h1 className="font-bold text-2xl sm:text-3xl leading-snug tracking-tight text-foreground">
            {item.title}
          </h1>

          {item.organizer && (
            <p className="text-sm text-muted-foreground">
              {t("notice.organizer")} <span className="font-medium text-foreground">{item.organizer}</span>
            </p>
          )}
        </div>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
          {/* Main Left Content */}
          <div className="space-y-10">
            {/* AI Recommendation Score Card — Solar 추천 결과가 있을 때만 표시 */}
            {rec && (
              <section className="rounded-xl border border-border bg-card p-6 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                    {t("notice.solarFit")}
                  </span>
                  <span className="font-bold text-lg text-primary">
                    {t("notice.points", { score: rec.score })}
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{rec.reason}</p>
              </section>
            )}

            {/* Agent Summary */}
            {item.summary.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-lg text-foreground">
                    {t("notice.summary")}
                  </h2>
                  <UpstageBadge compact feature="agents" />
                </div>
                <div className="rounded-xl border border-border bg-card p-5">
                  <ul className="space-y-2 text-sm text-foreground">
                    {item.summary.map((line, idx) => (
                      <li className="flex items-start gap-2.5" key={idx}>
                        <span className="text-primary font-bold text-xs mt-0.5">•</span>
                        <span className="leading-relaxed">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* Eligibility Verdict */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg text-foreground">
                  {t("notice.verdictTitle")}
                </h2>
                <VerdictBadge verdict={item.match.verdict} />
              </div>
              <div className="rounded-xl border border-border bg-card p-5 space-y-2.5">
                {item.match.reasons.map((reason, idx) => (
                  <div className="flex items-start gap-2.5 text-sm" key={idx}>
                    {item.match.verdict === "eligible" ? (
                      <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : item.match.verdict === "check" ? (
                      <HelpCircleIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                    ) : (
                      <XCircleIcon className="size-4 text-destructive shrink-0 mt-0.5" />
                    )}
                    <span className="text-foreground leading-relaxed">{reason}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Checklist */}
            {item.todo_checklist.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-bold text-lg text-foreground">
                  {t("notice.checklist")}
                </h2>
                <div className="rounded-xl border border-border bg-card p-4 space-y-1">
                  {item.todo_checklist.map((todo, index) => {
                    const isChecked = checked.has(index);
                    return (
                      <button
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg p-2.5 text-left text-sm transition-colors",
                          isChecked ? "text-muted-foreground bg-muted/40" : "hover:bg-muted/50 text-foreground",
                        )}
                        key={todo}
                        onClick={() => toggleCheck(index)}
                        type="button"
                      >
                        <div
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                            isChecked
                              ? "bg-primary border-primary text-white"
                              : "border-input bg-background",
                          )}
                        >
                          {isChecked && <CheckIcon className="size-3 stroke-[3]" />}
                        </div>
                        <span className={cn(isChecked && "line-through")}>
                          {todo}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Detailed Info */}
            <section className="space-y-3">
              <h2 className="font-bold text-lg text-foreground">
                {t("notice.details")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-border bg-card p-4 sm:col-span-2">
                  <span className="text-xs text-muted-foreground block mb-1">{t("notice.period")}</span>
                  <p className="font-medium text-foreground">
                    {item.apply_start ?? "?"} ~ {item.apply_end ?? t("common.openEnded")}
                  </p>
                </div>
                {item.result_date && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <span className="text-xs text-muted-foreground block mb-1">{t("notice.resultDate")}</span>
                    <p className="font-medium text-foreground">{item.result_date}</p>
                  </div>
                )}
                {item.benefits && (
                  <div className="rounded-xl border border-border bg-card p-4 sm:col-span-2">
                    <span className="text-xs text-muted-foreground block mb-1">{t("notice.awards")}</span>
                    <p className="font-medium text-foreground">{item.benefits}</p>
                  </div>
                )}
                {item.contact && (
                  <div className="rounded-xl border border-border bg-card p-4 sm:col-span-2">
                    <span className="text-xs text-muted-foreground block mb-1">{t("notice.contact")}</span>
                    <p className="font-medium text-foreground">{item.contact}</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Rail Sticky Card */}
          <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-5">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("notice.deadline")}</span>
                <p className="font-bold text-xl text-foreground">
                  {dday.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.apply_end ?? t("common.alwaysOpen")}
                </p>
              </div>

              <div className="pt-4 border-t border-border/80 space-y-2">
                {item.apply_url ? (
                  <Button asChild className="w-full">
                    <a href={item.apply_url} rel="noreferrer" target="_blank">
                      {t("notice.applyOfficial")}
                      <ExternalLinkIcon className="size-3.5 ml-1.5" />
                    </a>
                  </Button>
                ) : item.sourceUrl ? (
                  <Button asChild className="w-full">
                    <a href={item.sourceUrl} rel="noreferrer" target="_blank">
                      {t("notice.applyPage")}
                      <ExternalLinkIcon className="size-3.5 ml-1.5" />
                    </a>
                  </Button>
                ) : null}

                {item.sourceFile && (
                  <Button asChild className="w-full" size="sm" variant="outline">
                    <a href={`/api/files/${item.id}`} rel="noreferrer" target="_blank">
                      <FileTextIcon className="size-3.5" />
                      {t("notice.openFile")}
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
