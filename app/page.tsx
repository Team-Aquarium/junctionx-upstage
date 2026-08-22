"use client";

import { FilePlusIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AnnouncementCard,
  ddayInfo,
  type AnnouncementWithMatch,
} from "@/components/announcement";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export default function FeedPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementWithMatch[]>([]);
  const [hasProfile, setHasProfile] = useState(true);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("전체");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      const data = await res.json();
      setAnnouncements(data.announcements ?? []);
      setHasProfile(Boolean(data.hasProfile));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">공고 피드</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            공고문을 던지면 에이전트가 읽고, 내 프로필로 지원 가능 여부까지 판정해요.
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

      {!loading && !hasProfile && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm">
            <span className="font-medium text-primary">프로필이 아직 없어요.</span>{" "}
            <span className="text-muted-foreground">
              개인 링크나 재학증명서를 올리면 공고마다 지원 가능 여부를 판정해 드려요.
            </span>
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/me">프로필 만들기</Link>
          </Button>
        </div>
      )}

      {categories.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-1.5">
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
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <AnnouncementCard item={item} key={item.id} />
          ))}
        </div>
      )}
    </div>
  );
}
