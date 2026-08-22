"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightIcon, FilePlusIcon, UserRoundIcon } from "lucide-react";
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
import type { UserProfile } from "@/lib/store";
import type { RecommendationItem } from "@/lib/upstage";
import { cn } from "@/lib/utils";

const RECOMMEND_THRESHOLD = 60;

const CATEGORIES = [
  "전체",
  "공모전/해커톤",
  "대회/챌린지",
  "장학금",
  "대외활동/서포터즈",
  "채용/인턴",
  "others",
] as const;

export default function FeedPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementWithMatch[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hasProfile, setHasProfile] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
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
    load();
  }, [load]);

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

    if (selectedCategory !== "전체") {
      list = list.filter((a) => {
        if (selectedCategory === "공모전/해커톤") {
          return a.category.includes("공모전") || a.category.includes("해커톤");
        }
        if (selectedCategory === "대회/챌린지") {
          return a.category.includes("대회") || a.category.includes("챌린지");
        }
        if (selectedCategory === "대외활동/서포터즈") {
          return a.category.includes("대외활동") || a.category.includes("서포터즈");
        }
        if (selectedCategory === "채용/인턴") {
          return a.category.includes("채용") || a.category.includes("인턴");
        }
        if (selectedCategory === "장학금") {
          return a.category.includes("장학금");
        }
        if (selectedCategory === "others") {
          return a.category === "others" || a.category === "기타";
        }
        return a.category === selectedCategory;
      });
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
      return b.match.score - a.match.score;
    });
  }, [announcements, selectedCategory, searchFilters]);

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
      {/* 1. Hero Section */}
      <section className="border-b border-border/80 bg-background py-12 sm:py-16">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <span className="inline-block size-1.5 rounded-full bg-primary animate-pulse" />
              JunctionX Korea 2026 · Upstage Document Agent
            </div>

            <h1 className="font-bold text-3xl sm:text-5xl tracking-tight text-foreground leading-[1.15]">
              공고문을 읽는 가장 똑똑한 방법,{" "}
              <span className="text-primary">모아보라</span>
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              복잡한 PDF·HWP·포스터 공고문을 Upstage Studio 에이전트가 분석하여 핵심 요강을 구조화하고, 내 프로필과 대조해 지원 자격을 판정해 드립니다.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button asChild size="default">
                <Link href="/ingest">
                  <FilePlusIcon className="size-4 mr-1.5" />
                  공고문 등록하기
                </Link>
              </Button>
              <Button asChild size="default" variant="outline">
                <Link href="/me">
                  <UserRoundIcon className="size-4 mr-1.5" />
                  내 프로필 설정
                </Link>
              </Button>
              <Button asChild size="default" variant="ghost">
                <Link href="/chat">
                  문서 챗
                  <ArrowRightIcon className="size-4 ml-1" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Clean Search & Filter */}
          <div className="mt-10">
            <SearchFilter onSearchChange={setSearchFilters} />
          </div>

          {/* Quick Metrics */}
          {!loading && announcements.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-6 text-xs text-muted-foreground pt-6 border-t border-border/60">
              <span>
                전체 공고 <strong className="font-semibold text-foreground">{stats.total}</strong>건
              </span>
              <span>
                지원 가능 <strong className="font-semibold text-emerald-600 dark:text-emerald-400">{stats.eligible}</strong>건
              </span>
              <span>
                마감 임박 (D-7) <strong className="font-semibold text-foreground">{stats.closing}</strong>건
              </span>
              <span>
                맞춤 추천 <strong className="font-semibold text-primary">{stats.recommended}</strong>건
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 2. Main Content Area */}
      <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 space-y-14">
        {/* Profile Onboarding Banner if empty */}
        {!loading && !profile && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-secondary/40 p-6">
            <div>
              <h3 className="font-semibold text-sm text-foreground">
                프로필을 등록하면 지원 가능 여부가 자동으로 판정됩니다
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                링크(GitHub, 블로그)나 재학증명서를 올려 나에게 맞는 공고를 확인해보세요.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/me">프로필 등록하기</Link>
            </Button>
          </div>
        )}

        {/* AI Recommendations Section */}
        {!loading && hasProfile && (recLoading || recommended.length > 0) && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-xl text-foreground">
                  맞춤 추천 공고
                </h2>
                <UpstageBadge compact feature="solar" />
              </div>

              {!recLoading && recWf.steps.length > 0 && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                  onClick={() => setShowRecLog((v) => !v)}
                  type="button"
                >
                  {showRecLog ? "과정 접기" : "AI 추천 과정"}
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
                Solar Pro 4가 프로필과 공고를 분석하는 중입니다…
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
                전체 공고
              </h2>
              <span className="text-xs text-muted-foreground">({visible.length}건)</span>
            </div>

            {/* Category Navigation Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {CATEGORIES.map((category) => {
                const label =
                  category === "others"
                    ? "기타"
                    : category.replace(/\//g, " · ");
                const active = selectedCategory === category;
                return (
                  <button
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors shrink-0",
                      active
                        ? "bg-secondary text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                    )}
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    type="button"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <Spinner className="size-6 text-primary" />
            </div>
          ) : visible.length === 0 ? (
            <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center">
              <p className="font-medium text-sm text-foreground">
                해당 조건의 공고가 없습니다
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                검색어를 변경하거나 필터를 초기화해 보세요.
              </p>
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={() => {
                    setSelectedCategory("전체");
                    setSearchFilters({ keyword: "", verdict: "all", timeline: "all" });
                  }}
                  size="sm"
                  variant="outline"
                >
                  필터 초기화
                </Button>
                <Button asChild size="sm">
                  <Link href="/ingest">공고 등록하기</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((item) => (
                <AnnouncementCard item={item} key={item.id} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
