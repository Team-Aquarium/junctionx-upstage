"use client";

import {
  BadgeCheckIcon,
  FilePlusIcon,
  LayoutGridIcon,
  SparklesIcon,
  TimerIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AnnouncementCard,
  ddayInfo,
  type AnnouncementWithMatch,
} from "@/components/announcement";
import { PoweredByUpstage, UPSTAGE_FEATURES, UpstageBadge } from "@/components/upstage";
import { useWorkflowStream, WorkflowLog } from "@/components/workflow";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { UserProfile } from "@/lib/store";
import type { RecommendationItem } from "@/lib/upstage";
import { cn } from "@/lib/utils";

const RECOMMEND_THRESHOLD = 60;

function StatCell({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof LayoutGridIcon;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-card px-5 py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-4.5 text-primary" />
      </span>
      <div className="min-w-0">
        <p className="font-bold text-xl leading-none tracking-tight">{value}</p>
        <p className="mt-1 truncate text-muted-foreground text-xs">
          {label}
          {hint && <span className="text-muted-foreground/70"> · {hint}</span>}
        </p>
      </div>
    </div>
  );
}

function ProfileSidebarCard({ profile }: { profile: UserProfile | null }) {
  if (!profile) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold text-sm">프로필이 아직 없어요</h3>
        <p className="mt-1.5 text-muted-foreground text-xs leading-relaxed">
          개인 링크나 재학증명서를 올리면 공고마다 지원 가능 여부와 적합도를 판정해 드려요.
        </p>
        <Button asChild className="mt-3 w-full" size="sm">
          <Link href="/me">
            <UserRoundIcon className="size-4" />프로필 만들기
          </Link>
        </Button>
      </div>
    );
  }

  const chips = [...profile.interests, ...profile.skills].slice(0, 5);
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
          {(profile.name ?? "나").slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-sm">{profile.name ?? "이름 미확인"}</p>
          <p className="truncate text-muted-foreground text-xs">
            {[profile.university, profile.department].filter(Boolean).join(" · ") ||
              "학교 정보 없음"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {profile.grade != null && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground text-xs">
            {profile.grade}학년
          </span>
        )}
        {profile.enrollment_status && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground text-xs">
            {profile.enrollment_status}
          </span>
        )}
        {chips.map((chip) => (
          <span
            className="rounded-full border border-border px-2 py-0.5 text-muted-foreground text-xs"
            key={chip}
          >
            {chip}
          </span>
        ))}
      </div>
      <Button asChild className="mt-4 w-full" size="sm" variant="outline">
        <Link href="/me">프로필 관리</Link>
      </Button>
    </div>
  );
}

function PipelineSidebarCard() {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="font-semibold text-sm">이 서비스가 쓰는 Upstage 기능</h3>
      <ul className="mt-3 space-y-3">
        {(Object.keys(UPSTAGE_FEATURES) as (keyof typeof UPSTAGE_FEATURES)[]).map((key) => {
          const meta = UPSTAGE_FEATURES[key];
          return (
            <li className="flex items-start gap-2.5" key={key}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={meta.label}
                className="mt-0.5 size-5 shrink-0 rounded-md"
                height={20}
                src={meta.icon}
                width={20}
              />
              <div className="min-w-0">
                <p className="font-medium text-xs">{meta.label}</p>
                <p className="text-muted-foreground text-xs">{meta.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 border-t pt-3">
        <PoweredByUpstage />
      </div>
    </div>
  );
}

export default function FeedPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementWithMatch[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hasProfile, setHasProfile] = useState(true);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("전체");
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [showRecLog, setShowRecLog] = useState(false);
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
      .slice(0, 4);
  }, [announcements, recommendations]);

  const categories = useMemo(
    () => ["전체", ...new Set(announcements.map((a) => a.category))],
    [announcements],
  );

  const visible = useMemo(() => {
    const filtered =
      filter === "전체" ? announcements : announcements.filter((a) => a.category === filter);
    return [...filtered].sort((a, b) => {
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
  }, [announcements, filter]);

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
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-semibold text-[11px] text-primary uppercase tracking-[0.2em]">
            Document Agent Feed
          </p>
          <h1 className="mt-1.5 font-bold text-3xl tracking-tight">공고 피드</h1>
          <p className="mt-1.5 max-w-xl text-muted-foreground text-sm">
            에이전트가 공고문을 읽어 만든 카드입니다. 내 프로필 기준의 자격 판정과 적합도가 함께
            표시됩니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/me">
              <UserRoundIcon className="size-4" />내 프로필
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/ingest">
              <FilePlusIcon className="size-4" />공고 등록
            </Link>
          </Button>
        </div>
      </div>

      {!loading && announcements.length > 0 && (
        <div className="mt-6 grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border lg:grid-cols-4 lg:divide-y-0">
          <StatCell icon={LayoutGridIcon} label="전체 공고" value={stats.total} />
          <StatCell icon={BadgeCheckIcon} label="지원 가능" value={stats.eligible} />
          <StatCell hint="D-7 이내" icon={TimerIcon} label="마감 임박" value={stats.closing} />
          <StatCell icon={SparklesIcon} label="AI 추천" value={stats.recommended} />
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0">
          {!loading && hasProfile && (recLoading || recommended.length > 0) && (
            <section className="mb-10">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-semibold text-lg">
                  <SparklesIcon className="size-4.5 text-primary" />나에게 맞는 공고
                  <UpstageBadge compact feature="solar" />
                </h2>
                {!recLoading && recWf.steps.length > 0 && (
                  <button
                    className="text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground"
                    onClick={() => setShowRecLog((v) => !v)}
                    type="button"
                  >
                    {showRecLog ? "생성 과정 접기" : "생성 과정 보기"}
                  </button>
                )}
              </div>
              {(recLoading || showRecLog) && recWf.steps.length > 0 && (
                <div className="mt-3">
                  <WorkflowLog steps={recWf.steps} />
                </div>
              )}
              {recLoading ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-muted-foreground text-sm">
                  <Spinner className="size-4" />
                  에이전트가 프로필과 공고를 대조해 추천을 고르는 중…
                </div>
              ) : (
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {recommended.map(({ rec, item }) => (
                    <div className="flex flex-col gap-2" key={rec.id}>
                      <AnnouncementCard item={item} />
                      <p className="flex items-start gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed">
                        <SparklesIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        <span>
                          <span className="font-semibold text-primary">적합도 {rec.score}</span>
                          {" · "}
                          {rec.reason}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {!loading && announcements.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold text-lg">
                전체 공고
                <UpstageBadge compact feature="agents" />
              </h2>
              <span className="text-muted-foreground text-xs">{visible.length}건</span>
            </div>
          )}

          {categories.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {categories.map((category) => (
                <button
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    filter === category
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                  key={category}
                  onClick={() => setFilter(category)}
                  type="button"
                >
                  {category === "others" ? "기타" : category}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[40dvh] items-center justify-center">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          ) : visible.length === 0 ? (
            <div className="mt-6 flex min-h-[40dvh] flex-col items-center justify-center gap-4 rounded-xl border border-dashed text-center">
              <div>
                <p className="font-medium">아직 등록된 공고가 없어요</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  공고문 PDF나 포스터 이미지를 올리면 에이전트가 카드로 만들어 드립니다.
                </p>
              </div>
              <Button asChild>
                <Link href="/ingest">
                  <FilePlusIcon className="size-4" />첫 공고 등록하기
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {visible.map((item) => (
                <AnnouncementCard item={item} key={item.id} />
              ))}
            </div>
          )}
        </main>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {!loading && <ProfileSidebarCard profile={profile} />}
          <PipelineSidebarCard />
        </aside>
      </div>
    </div>
  );
}
