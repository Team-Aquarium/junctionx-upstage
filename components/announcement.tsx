"use client";

import Link from "next/link";
import { localizeCategory } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/client";
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
    return { label: "Open", closed: false, days: null };
  }
  const end = new Date(`${applyEnd}T23:59:59`);
  if (Number.isNaN(end.getTime())) {
    return { label: "Open", closed: false, days: null };
  }
  const days = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  if (days < 0) {
    return { label: "Closed", closed: true, days };
  }
  if (days === 0) {
    return { label: "D-DAY", closed: false, days };
  }
  return { label: `D-${days}`, closed: false, days };
}

export function CategoryBadge({ category }: { category: string }) {
  const t = useT();
  return (
    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
      {localizeCategory(category, t)}
    </span>
  );
}

export function VerdictBadge({
  verdict,
  className,
}: {
  verdict: MatchResult["verdict"];
  className?: string;
}) {
  const t = useT();
  if (verdict === "eligible") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400",
          className,
        )}
      >
        {t("verdict.eligible")}
      </span>
    );
  }
  if (verdict === "check") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground",
          className,
        )}
      >
        {t("verdict.check")}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive",
        className,
      )}
    >
      {t("verdict.ineligible")}
    </span>
  );
}

export function DdayBadge({ applyEnd }: { applyEnd: string | null }) {
  const t = useT();
  const info = ddayInfo(applyEnd);
  const label =
    info.days === null
      ? t("common.openEnded")
      : info.closed
        ? t("common.closed")
        : info.days === 0
          ? t("common.dday")
          : info.label;
  return (
    <span
      className={cn(
        "text-xs font-medium",
        info.closed
          ? "text-muted-foreground line-through"
          : info.days !== null && info.days <= 7
            ? "text-primary font-semibold"
            : "text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

export function AnnouncementCard({
  item,
  recommendReason,
  recommendScore,
}: {
  item: AnnouncementWithMatch;
  recommendReason?: string;
  recommendScore?: number;
}) {
  const t = useT();
  const dday = ddayInfo(item.apply_end);

  return (
    <Link
      className={cn(
        "group flex flex-col justify-between rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40",
        dday.closed && "opacity-50",
      )}
      href={`/notice/${item.id}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CategoryBadge category={item.category} />
            <VerdictBadge verdict={item.match.verdict} />
          </div>
          <DdayBadge applyEnd={item.apply_end} />
        </div>

        <h3 className="mt-4 font-semibold text-base leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {item.title}
        </h3>

        {item.organizer && (
          <p className="mt-2 text-xs text-muted-foreground truncate">
            {item.organizer}
          </p>
        )}

        {item.benefits && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
            {t("common.benefits")}: {item.benefits}
          </p>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border/60 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {item.apply_end
              ? t("common.deadlineOn", { date: item.apply_end })
              : t("common.alwaysOpen")}
          </span>
          {recommendScore !== undefined && (
            <span className="font-semibold text-primary">
              {t("common.fit", { score: recommendScore })}
            </span>
          )}
        </div>

        {recommendReason && (
          <p className="rounded-lg bg-accent/40 p-2.5 text-xs text-accent-foreground leading-relaxed">
            {recommendReason}
          </p>
        )}
      </div>
    </Link>
  );
}
