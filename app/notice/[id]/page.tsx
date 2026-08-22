"use client";

import {
  ArrowLeftIcon,
  BuildingIcon,
  CalendarIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LinkIcon,
  PhoneIcon,
  SparklesIcon,
  TrophyIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CategoryBadge,
  DdayBadge,
  VerdictBadge,
  type AnnouncementWithMatch,
} from "@/components/announcement";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof CalendarIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <div className="mt-0.5 break-words text-sm">{children}</div>
      </div>
    </div>
  );
}

export default function NoticeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<AnnouncementWithMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [rec, setRec] = useState<{ score: number; reason: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/announcements");
        const data = await res.json();
        setItem(
          (data.announcements as AnnouncementWithMatch[]).find((a) => a.id === id) ?? null,
        );
      } finally {
        setLoading(false);
      }
    })();
    fetch("/api/recommendations")
      .then((r) => r.json())
      .then((data) => {
        const found = (data.recommendations ?? []).find(
          (r: { id: string }) => r.id === id,
        );
        setRec(found ?? null);
      })
      .catch(() => setRec(null));
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto flex min-h-[60dvh] w-full max-w-3xl flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground">공고를 찾을 수 없어요.</p>
        <Button asChild variant="outline">
          <Link href="/">피드로 돌아가기</Link>
        </Button>
      </div>
    );
  }

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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
        href="/"
      >
        <ArrowLeftIcon className="size-4" />피드로
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <CategoryBadge category={item.category} />
        <VerdictBadge verdict={item.match.verdict} />
        <DdayBadge applyEnd={item.apply_end} />
      </div>
      <h1 className="mt-3 font-bold text-2xl leading-snug tracking-tight">{item.title}</h1>
      {(item.organizer || item.field) && (
        <p className="mt-2 text-muted-foreground text-sm">
          {[item.organizer, item.field].filter(Boolean).join(" · ")}
        </p>
      )}

      {item.summary.length > 0 && (
        <div className="mt-6 rounded-xl border bg-card p-4">
          <h2 className="font-semibold text-sm">에이전트 요약</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {item.summary.map((line) => (
              <li className="flex gap-2" key={line}>
                <span className="text-primary">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoRow icon={CalendarIcon} label="접수 기간">
          {item.apply_start ?? "?"} ~ {item.apply_end ?? "상시"}
        </InfoRow>
        {item.result_date && (
          <InfoRow icon={CalendarIcon} label="결과 발표">
            {item.result_date}
          </InfoRow>
        )}
        {item.benefits && (
          <InfoRow icon={TrophyIcon} label="시상·혜택">
            {item.benefits}
          </InfoRow>
        )}
        {item.contact && (
          <InfoRow icon={PhoneIcon} label="문의">
            {item.contact}
          </InfoRow>
        )}
        {item.apply_url && (
          <InfoRow icon={LinkIcon} label="접수 링크">
            <a
              className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
              href={item.apply_url}
              rel="noreferrer"
              target="_blank"
            >
              {item.apply_url}
              <ExternalLinkIcon className="size-3.5" />
            </a>
          </InfoRow>
        )}
        {item.organizer && (
          <InfoRow icon={BuildingIcon} label="주최·주관">
            {item.organizer}
          </InfoRow>
        )}
      </div>

      <div className="mt-4 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-sm">자격 판정</h2>
          <VerdictBadge verdict={item.match.verdict} />
        </div>
        <ul className="mt-2 space-y-1.5 text-sm">
          {item.match.reasons.map((reason) => (
            <li className="flex gap-2" key={reason}>
              <span className="text-muted-foreground">—</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
        {item.match.verdict === "check" && (
          <Button asChild className="mt-3" size="sm" variant="outline">
            <Link href="/me">프로필 보완하러 가기</Link>
          </Button>
        )}
      </div>

      {rec && (
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-sm">
            <SparklesIcon className="size-4 text-primary" />AI 추천 — 적합도 {rec.score}
          </h2>
          <p className="mt-2 text-sm leading-relaxed">{rec.reason}</p>
        </div>
      )}

      {item.todo_checklist.length > 0 && (
        <div className="mt-4 rounded-xl border bg-card p-4">
          <h2 className="font-semibold text-sm">지원 준비 체크리스트</h2>
          <ul className="mt-2 space-y-1">
            {item.todo_checklist.map((todo, index) => (
              <li key={todo}>
                <button
                  className="flex w-full items-start gap-2.5 rounded-md px-1 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => toggleCheck(index)}
                  type="button"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border text-[10px]",
                      checked.has(index)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background",
                    )}
                  >
                    {checked.has(index) ? "✓" : ""}
                  </span>
                  <span className={cn(checked.has(index) && "text-muted-foreground line-through")}>
                    {todo}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.sourceFile && (
        <div className="mt-4">
          <Button asChild size="sm" variant="outline">
            <a href={`/api/files/${item.id}`} rel="noreferrer" target="_blank">
              <FileTextIcon className="size-4" />원문 문서 보기 ({item.sourceFile.name})
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
