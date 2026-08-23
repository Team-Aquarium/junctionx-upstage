"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AnnouncementCard,
  ddayInfo,
  type AnnouncementWithMatch,
} from "@/components/announcement";
import { SearchFilter, type SearchFilterState } from "@/components/search-filter";
import { UpstageBadge } from "@/components/upstage";
import { useWorkflowStream, WorkflowLog } from "@/components/workflow";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/lib/i18n/client";
import { CATEGORY_FILTERS, type CategoryFilterKey } from "@/lib/i18n/format";
import {
  isPitchDemo,
  markPitchDemoReady,
  pitchDemoBoot,
} from "@/lib/pitch-demo";
import type { UserProfile } from "@/lib/store";
import type { RecommendationItem } from "@/lib/upstage";
import { cn } from "@/lib/utils";

const RECOMMEND_THRESHOLD = 60;

export function FeedClient({ demo = false }: { demo?: boolean }) {
  const { t, locale, setLocale } = useI18n();
  const boot = pitchDemoBoot(demo);
  const [announcements, setAnnouncements] = useState<AnnouncementWithMatch[]>(
    () => boot?.announcements ?? [],
  );
  const [profile, setProfile] = useState<UserProfile | null>(() => boot?.profile ?? null);
  const [hasProfile, setHasProfile] = useState(() => Boolean(boot));
  const [loading, setLoading] = useState(() => !boot);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterKey>("all");
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(
    () => boot?.recommendations ?? [],
  );
  const [showRecLog, setShowRecLog] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilterState>({
    keyword: "",
    verdict: "all",
    timeline: "all",
  });

  const recWf = useWorkflowStream();
  const recLoading = recWf.running;
  const { run: runRecWf } = recWf;

  const load = useCallback(async () => {
    try {
      const [annRes, profileRes] = await Promise.all([
        fetch("/api/announcements"),
        fetch("/api/profile"),
      ]);
      const data = await annRes.json();
      const profileData = await profileRes.json();
      setAnnouncements(data.announcements ?? []);
      setHasProfile(Boolean(data.hasProfile));
      setProfile(profileData.profile ?? null);
      if (data.hasProfile && (data.announcements ?? []).length > 0) {
        runRecWf<{ recommendations: RecommendationItem[] }>("/api/recommendations").then(
          (rec) => setRecommendations(rec?.recommendations ?? []),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [runRecWf]);

  useEffect(() => {
    if (!isPitchDemo(demo)) {
      load();
      return;
    }
    if (locale !== "en") {
      setLocale("en");
      return;
    }
    markPitchDemoReady();
  }, [demo, load, locale, setLocale, t]);

  // Solar 추천 id → score/reason 맵 (전체 공고 카드에도 적합도 표시)
  const recById = useMemo(
    () => new Map(recommendations.map((r) => [r.id, r])),
    [recommendations],
  );

  // Recommendations
  const recommended = useMemo(() => {
    const byId = new Map(announcements.map((a) => [a.id, a]));
    return recommendations
      .filter((rec) => rec.score >= RECOMMEND_THRESHOLD)
      .map((rec) => ({ rec, item: byId.get(rec.id) }))
      .filter(
        (entry): entry is { rec: RecommendationItem; item: AnnouncementWithMatch } =>
          !!entry.item &&
          entry.item.match.verdict !== "ineligible" &&
          !ddayInfo(entry.item.apply_end).closed,
      )
      .slice(0, 3);
  }, [announcements, recommendations]);

  // Filtering
  const visible = useMemo(() => {
    let list = announcements;

    const categoryFilter = CATEGORY_FILTERS.find((f) => f.key === selectedCategory);
    if (categoryFilter && selectedCategory !== "all") {
      list = list.filter((a) => categoryFilter.match(a.category));
    }

    if (searchFilters.keyword.trim()) {
      const q = searchFilters.keyword.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.organizer && a.organizer.toLowerCase().includes(q)) ||
          (a.field && a.field.toLowerCase().includes(q)) ||
          (a.benefits && a.benefits.toLowerCase().includes(q)),
      );
    }

    if (searchFilters.verdict === "eligible") {
      list = list.filter((a) => a.match.verdict === "eligible");
    } else if (searchFilters.verdict === "check") {
      list = list.filter(
        (a) => a.match.verdict === "eligible" || a.match.verdict === "check",
      );
    }

    if (searchFilters.timeline === "closing") {
      list = list.filter((a) => {
        const d = ddayInfo(a.apply_end);
        return !d.closed && d.days !== null && d.days <= 7;
      });
    } else if (searchFilters.timeline === "open") {
      list = list.filter((a) => !ddayInfo(a.apply_end).closed);
    }

    return [...list].sort((a, b) => {
      const da = ddayInfo(a.apply_end);
      const db = ddayInfo(b.apply_end);
      if (da.closed !== db.closed) {
        return da.closed ? 1 : -1;
      }
      const daysA = da.days ?? 9999;
      const daysB = db.days ?? 9999;
      if (daysA !== daysB) {
        return daysA - daysB;
      }
      const aRecScore = recById.get(a.id)?.score ?? -1;
      const bRecScore = recById.get(b.id)?.score ?? -1;
      return bRecScore - aRecScore;
    });
  }, [announcements, selectedCategory, searchFilters, recById]);

  const stats = useMemo(() => {
    const open = announcements.filter((a) => !ddayInfo(a.apply_end).closed);
    return {
      total: announcements.length,
      eligible: open.filter((a) => a.match.verdict === "eligible").length,
      closing: open.filter((a) => {
        const d = ddayInfo(a.apply_end);
        return d.days !== null && d.days <= 7;
      }).length,
      recommended: recommendations.filter((r) => r.score >= RECOMMEND_THRESHOLD).length,
    };
  }, [announcements, recommendations]);

  return (
    <div className="w-full">
      {/* 1. Feed Header & Search Filter */}
      <section className="border-b border-border/80 bg-background py-8 sm:py-10">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="font-bold text-2xl sm:text-3xl tracking-tight text-foreground">
                {t("feed.title")}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                {t("feed.subtitle")}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button asChild size="sm" variant="outline">
                <Link href="/me">{t("feed.myProfile")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/ingest">{t("feed.addNotice")}</Link>
              </Button>
            </div>
          </div>

          <SearchFilter onSearchChange={setSearchFilters} />

          {/* Quick Metrics */}
          {!loading && announcements.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-6 text-xs text-muted-foreground pt-6 border-t border-border/60">
              <span>
                {t("feed.statTotal")}{" "}
                <strong className="font-semibold text-foreground">{stats.total}</strong>
              </span>
              <span>
                {t("feed.statEligible")}{" "}
                <strong className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {stats.eligible}
                </strong>
              </span>
              <span>
                {t("feed.statClosing")}{" "}
                <strong className="font-semibold text-foreground">{stats.closing}</strong>
              </span>
              <span>
                {t("feed.statRecommended")}{" "}
                <strong className="font-semibold text-primary">{stats.recommended}</strong>
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 2. Main Content Area */}
      <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 space-y-12">
        {/* Profile Onboarding Banner if empty */}
        {!loading && !profile && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-secondary/40 p-6">
            <div>
              <h3 className="font-semibold text-sm text-foreground">
                {t("feed.onboardTitle")}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("feed.onboardBody")}
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/me">{t("feed.onboardCta")}</Link>
            </Button>
          </div>
        )}

        {/* AI Recommendations Section */}
        {!loading && hasProfile && (recLoading || recommended.length > 0) && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-xl text-foreground">
                  {t("feed.recTitle")}
                </h2>
                <UpstageBadge compact feature="solar" />
              </div>

              {!recLoading && recWf.steps.length > 0 && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                  onClick={() => setShowRecLog((v) => !v)}
                  type="button"
                >
                  {showRecLog ? t("feed.recHide") : t("feed.recShow")}
                </button>
              )}
            </div>

            {(recLoading || showRecLog) && recWf.steps.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <WorkflowLog steps={recWf.steps} />
              </div>
            )}

            {recLoading ? (
              <div className="flex items-center justify-center gap-2.5 rounded-xl border border-dashed border-border py-12 text-xs text-muted-foreground">
                <Spinner className="size-4 text-primary" />
                {t("feed.recLoading")}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {recommended.map(({ rec, item }) => (
                  <AnnouncementCard
                    item={item}
                    key={rec.id}
                    recommendReason={rec.reason}
                    recommendScore={rec.score}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* All Announcements Section */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-xl text-foreground">
                {t("feed.allTitle")}
              </h2>
              <span className="text-xs text-muted-foreground">
                {t("common.countNotices", { n: visible.length })}
              </span>
            </div>

            {/* Category Navigation Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {CATEGORY_FILTERS.map((filter) => {
                const active = selectedCategory === filter.key;
                return (
                  <button
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors shrink-0",
                      active
                        ? "bg-secondary text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                    )}
                    key={filter.key}
                    onClick={() => setSelectedCategory(filter.key)}
                    type="button"
                  >
                    {t(`category.${filter.key}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid or Empty */}
          {loading ? (
            <div className="flex items-center justify-center gap-2.5 py-24 text-xs text-muted-foreground">
              <Spinner className="size-4 text-primary" />
              {t("feed.loadingList")}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
              <p className="font-semibold text-sm text-foreground">{t("feed.emptyTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("feed.emptyBody")}
              </p>
              <Button asChild className="mt-4" size="sm" variant="outline">
                <Link href="/ingest">{t("feed.emptyCta")}</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((announcement) => {
                const rec = recById.get(announcement.id);
                return (
                  <AnnouncementCard
                    item={announcement}
                    key={announcement.id}
                    recommendReason={rec?.reason}
                    recommendScore={rec?.score}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
