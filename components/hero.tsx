"use client";

import Link from "next/link";
import { ArrowRightIcon, FilePlusIcon } from "lucide-react";
import {
  AnnouncementCard,
  type AnnouncementWithMatch,
} from "@/components/announcement";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

interface HeroProps {
  stats?: {
    total: number;
    eligible: number;
    closing: number;
    recommended: number;
  };
}

export function Hero({ stats: _stats }: HeroProps) {
  const t = useT();
  const demo: AnnouncementWithMatch = {
    id: "demo-hero-notice",
    category: "공모전/해커톤",
    title: t("hero.demoTitle"),
    organizer: "Upstage",
    field: t("hero.demoField"),
    apply_start: "2026-08-01",
    apply_end: "2026-08-31",
    result_date: "2026-09-10",
    benefits: t("hero.demoBenefits"),
    contact: null,
    apply_url: null,
    summary: [t("hero.demoSummary1"), t("hero.demoSummary2")],
    rules: {
      majors: ["Computer Science", "Artificial Intelligence", "Software"],
      status: ["Enrolled", "On leave", "Expected graduate"],
    },
    todo_checklist: ["Proposal", "Prototype video", "GitHub repo"],
    sourceFile: { name: t("hero.previewFile"), mediaType: "application/pdf" },
    createdAt: "2026-08-01T00:00:00.000Z",
    match: {
      verdict: "eligible",
      score: 96,
      reasons: [t("hero.demoReasonFit"), t("hero.demoReasonStatus")],
    },
  };

  return (
    <section className="border-b border-border/80 bg-background py-24 sm:py-32 lg:py-40">
      <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-6 text-center lg:text-left">
            <p className="text-xs font-semibold tracking-wider text-primary uppercase">
              {t("hero.eyebrow")}
            </p>

            <h1 className="font-bold text-3xl sm:text-5xl tracking-tight text-foreground leading-[1.18] break-keep">
              {t("hero.titleBefore")}{" "}
              <br className="hidden sm:inline" />
              <span className="text-primary">{t("hero.titleBrand")}</span>
            </h1>

            <p className="mx-auto lg:mx-0 max-w-xl text-sm sm:text-base text-muted-foreground leading-relaxed break-keep">
              {t("hero.body")}
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
              <Button asChild size="default">
                <Link href="/feed">
                  {t("hero.browseFeed")}
                  <ArrowRightIcon className="size-4 ml-1.5" />
                </Link>
              </Button>
              <Button asChild size="default" variant="outline">
                <Link href="/ingest">
                  <FilePlusIcon className="size-4 mr-1.5" />
                  {t("hero.addNotice")}
                </Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto w-full max-w-xl lg:max-w-none">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="font-medium text-foreground">{t("hero.previewLabel")}</span>
              <span>{t("hero.previewFile")}</span>
            </div>
            <AnnouncementCard
              item={demo}
              recommendReason={t("hero.demoReason")}
              recommendScore={96}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
