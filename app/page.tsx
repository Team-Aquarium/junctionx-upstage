"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  BotIcon,
  LayoutGridIcon,
  UploadCloudIcon,
  UserCheckIcon,
} from "lucide-react";
import {
  AnnouncementCard,
  ddayInfo,
  type AnnouncementWithMatch,
} from "@/components/announcement";
import { Hero } from "@/components/hero";
import { Button } from "@/components/ui/button";
import { UpstageMark, type UpstageFeature } from "@/components/upstage";
import { useI18n } from "@/lib/i18n/client";

const PIPELINE_FEATURES: {
  step: string;
  node: string;
  title: string;
  feature: UpstageFeature;
  subtitleKey: string;
  descKey: string;
}[] = [
  {
    step: "01",
    node: "Parse",
    title: "Document Parse",
    feature: "document-parse",
    subtitleKey: "landing.pipeline1Sub",
    descKey: "landing.pipeline1Desc",
  },
  {
    step: "02",
    node: "Classify",
    title: "Studio Agents",
    feature: "agents",
    subtitleKey: "landing.pipeline2Sub",
    descKey: "landing.pipeline2Desc",
  },
  {
    step: "03",
    node: "Extract",
    title: "Information Extract",
    feature: "information-extract",
    subtitleKey: "landing.pipeline3Sub",
    descKey: "landing.pipeline3Desc",
  },
  {
    step: "04",
    node: "Instruct",
    title: "Solar Pro 4",
    feature: "solar",
    subtitleKey: "landing.pipeline4Sub",
    descKey: "landing.pipeline4Desc",
  },
];

const HIGHLIGHT_POINTS = [
  {
    titleKey: "landing.highlight1Title",
    descKey: "landing.highlight1Desc",
    icon: UploadCloudIcon,
  },
  {
    titleKey: "landing.highlight2Title",
    descKey: "landing.highlight2Desc",
    icon: UserCheckIcon,
  },
  {
    titleKey: "landing.highlight3Title",
    descKey: "landing.highlight3Desc",
    icon: BotIcon,
  },
];

export default function LandingPage() {
  const { t, locale } = useI18n();
  const [announcements, setAnnouncements] = useState<AnnouncementWithMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const annRes = await fetch("/api/announcements");
        const annData = await annRes.json();
        setAnnouncements(annData.announcements ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [locale]);

  const stats = useMemo(() => {
    const open = announcements.filter((a) => !ddayInfo(a.apply_end).closed);
    return {
      total: announcements.length,
      eligible: open.filter((a) => a.match.verdict === "eligible").length,
      closing: open.filter((a) => {
        const d = ddayInfo(a.apply_end);
        return d.days !== null && d.days <= 7;
      }).length,
      recommended: open.filter((a) => a.match.score >= 80).length,
    };
  }, [announcements]);

  const featuredAnnouncements = useMemo(() => {
    return announcements
      .filter((a) => !ddayInfo(a.apply_end).closed)
      .slice(0, 3);
  }, [announcements]);

  return (
    <div className="w-full">
      {/* 1. Hero Section */}
      <Hero stats={stats} />

      {/* 2. Pipeline Overview Section */}
      <section className="border-b border-border/80 bg-secondary/20 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-semibold tracking-wider text-primary uppercase">
              {t("landing.howItWorks")}
            </span>
            <h2 className="font-bold text-2xl sm:text-4xl tracking-tight text-foreground">
              {t("landing.pipelineTitle")}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("landing.pipelineBody")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-3">
            {PIPELINE_FEATURES.map((item, index) => (
              <div className="relative" key={item.step}>
                {index < PIPELINE_FEATURES.length - 1 && (
                  <ArrowRightIcon
                    aria-hidden
                    className="pointer-events-none absolute top-10 -right-3 z-10 hidden size-4 text-primary/50 lg:block"
                  />
                )}
                <div className="h-full rounded-2xl border border-border/80 bg-card p-6 shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex size-14 items-center justify-center rounded-xl bg-secondary/80 ring-1 ring-border/70">
                      <UpstageMark feature={item.feature} size={36} />
                    </div>
                    <span className="font-mono text-[11px] font-bold tracking-wider text-primary">
                      {item.node.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-foreground mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs font-medium text-primary mb-2.5">
                    {t(item.subtitleKey)}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(item.descKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Core Highlights Section */}
      <section className="border-b border-border/80 bg-background py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-semibold tracking-wider text-primary uppercase">
              {t("landing.benefits")}
            </span>
            <h2 className="font-bold text-2xl sm:text-4xl tracking-tight text-foreground">
              {t("landing.benefitsTitle")}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("landing.benefitsBody")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HIGHLIGHT_POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <div
                  className="rounded-2xl border border-border/80 bg-secondary/30 p-6 space-y-4"
                  key={point.titleKey}
                >
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-bold text-base text-foreground">
                    {t(point.titleKey)}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {t(point.descKey)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Live Featured Announcements Preview */}
      {!loading && featuredAnnouncements.length > 0 && (
        <section className="border-b border-border/80 bg-background py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="text-xs font-semibold tracking-wider text-primary uppercase">
                  {t("landing.live")}
                </span>
                <h2 className="mt-1 font-bold text-2xl sm:text-3xl tracking-tight text-foreground">
                  {t("landing.liveTitle")}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  {t("landing.liveBody")}
                </p>
              </div>

              <Button asChild size="sm" variant="outline">
                <Link href="/feed">
                  {t("landing.seeAll", { n: announcements.length })}
                  <ArrowRightIcon className="size-3.5 ml-1" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featuredAnnouncements.map((announcement) => (
                <AnnouncementCard
                  item={announcement}
                  key={announcement.id}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. Bottom Call-To-Action Banner */}
      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/[0.06] to-primary/[0.02] p-8 sm:p-12 text-center space-y-6">
            <div className="max-w-xl mx-auto space-y-3">
              <h2 className="font-bold text-2xl sm:text-3xl tracking-tight text-foreground">
                {t("landing.ctaTitle")}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {t("landing.ctaBody")}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button asChild size="lg">
                <Link href="/feed">
                  <LayoutGridIcon className="size-4 mr-2" />
                  {t("landing.ctaFeed")}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/ingest">{t("landing.ctaIngest")}</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/me">{t("landing.ctaProfile")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
