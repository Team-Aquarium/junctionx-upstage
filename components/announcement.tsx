"use client";

import { BuildingIcon, CalendarIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import type { MatchResult } from "@/lib/matching";
import type { Announcement } from "@/lib/store";
import { cn } from "@/lib/utils";

export type AnnouncementWithMatch = Announcement & { match: MatchResult };

export function ddayInfo(applyEnd: string | null): {
  label: string;
  closed: boolean;
  days: number | null;
} {
  if (!applyEnd) {
    return { label: "상시", closed: false, days: null };
  }
  const end = new Date(`${applyEnd}T23:59:59`);
  if (Number.isNaN(end.getTime())) {
    return { label: "상시", closed: false, days: null };
  }
  const days = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  if (days < 0) {
    return { label: "마감", closed: true, days };
  }
  if (days === 0) {
    return { label: "D-DAY", closed: false, days };
  }
  return { label: `D-${days}`, closed: false, days };
}

const VERDICT_META: Record<MatchResult["verdict"], { label: string; className: string }> = {
  eligible: {
    label: "지원 가능",
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  ineligible: {
    label: "자격 미달",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  check: {
    label: "확인 필요",
    className: "border-border bg-secondary text-secondary-foreground",
  },
};

export function VerdictBadge({
  verdict,
  className,
}: {
  verdict: MatchResult["verdict"];
  className?: string;
}) {
  const meta = VERDICT_META[verdict];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-xs",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground text-xs">
      {category === "others" ? "기타" : category}
    </span>
  );
}

export function DdayBadge({ applyEnd }: { applyEnd: string | null }) {
  const info = ddayInfo(applyEnd);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-semibold text-xs",
        info.closed
          ? "bg-muted text-muted-foreground line-through"
          : info.days !== null && info.days <= 7
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/10 text-primary",
      )}
    >
      {info.label}
    </span>
  );
}

export function AnnouncementCard({ item }: { item: AnnouncementWithMatch }) {
  const closed = ddayInfo(item.apply_end).closed;
  return (
    <Link
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground transition-shadow hover:shadow-md",
        closed && "opacity-60",
      )}
      href={`/notice/${item.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <CategoryBadge category={item.category} />
          <VerdictBadge verdict={item.match.verdict} />
        </div>
        <DdayBadge applyEnd={item.apply_end} />
      </div>
      <h3 className="line-clamp-2 font-semibold text-base leading-snug">{item.title}</h3>
      <div className="mt-auto flex flex-col gap-1.5 text-muted-foreground text-xs">
        {item.organizer && (
          <span className="flex items-center gap-1.5 truncate">
            <BuildingIcon className="size-3.5 shrink-0" />
            <span className="truncate">{item.organizer}</span>
          </span>
        )}
        {item.benefits && (
          <span className="flex items-center gap-1.5 truncate">
            <TrophyIcon className="size-3.5 shrink-0" />
            <span className="truncate">{item.benefits}</span>
          </span>
        )}
        {(item.apply_start || item.apply_end) && (
          <span className="flex items-center gap-1.5 truncate">
            <CalendarIcon className="size-3.5 shrink-0" />
            <span className="truncate">
              {item.apply_start ?? "?"} ~ {item.apply_end ?? "상시"}
            </span>
          </span>
        )}
      </div>
    </Link>
  );
}
