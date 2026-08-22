"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  BotIcon,
  CheckCircle2Icon,
  FileSearchIcon,
  FileTextIcon,
  LayersIcon,
  LayoutGridIcon,
  SparklesIcon,
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
import { UpstageBadge } from "@/components/upstage";
import type { UserProfile } from "@/lib/store";

const PIPELINE_FEATURES = [
  {
    step: "01",
    title: "Document Parse",
    badge: "document-parse" as const,
    subtitle: "문서 구조화 & OCR",
    desc: "PDF, HWP, 스캔본, 포스터 이미지의 레이아웃과 텍스트를 마크다운으로 완벽 변환합니다.",
    icon: FileTextIcon,
  },
  {
    step: "02",
    title: "Category Classify",
    badge: "agents" as const,
    subtitle: "6종 카테고리 자동 분류",
    desc: "공모전/해커톤, 대회, 장학금, 대외활동, 채용, 기타 중 최적 카테고리를 판별합니다.",
    icon: LayersIcon,
  },
  {
    step: "03",
    title: "Information Extract",
    badge: "information-extract" as const,
    subtitle: "10개 핵심 필드 추출",
    desc: "제목, 주최사, 지원 자격 규칙, 일정, 혜택, 담당자 등 핵심 요강을 JSON으로 정밀 추출합니다.",
    icon: FileSearchIcon,
  },
  {
    step: "04",
    title: "Instruct & Match",
    badge: "solar" as const,
    subtitle: "자격 판정 및 추천",
    desc: "내 프로필과 공고 자격 요건을 실시간 대조하고 Solar Pro 4가 맞춤 추천 점수를 산출합니다.",
    icon: SparklesIcon,
  },
];

const HIGHLIGHT_POINTS = [
  {
    title: "복잡한 서류도 한 번에",
    desc: "모집요강 PDF는 물론 HWP 첨부파일, 웹페이지 링크, 포스터 이미지까지 어떤 형식이든 에이전트가 알아서 읽고 분석합니다.",
    icon: UploadCloudIcon,
  },
  {
    title: "내 프로필 기준 실시간 자격 판정",
    desc: "학교, 학과, 학년, 재학/휴학 상태를 대조해 '지원 가능 / 자격 미달 / 확인 필요'를 자동으로 판정하고 사유를 명확히 짚어줍니다.",
    icon: UserCheckIcon,
  },
  {
    title: "Solar Pro 4 맞춤 추천 & 체크리스트",
    desc: "관심 분야와 보유 역량을 분석하여 최적의 공고를 추천하고, 지원 시 챙겨야 할 서류와 일정 체크리스트를 자동 생성합니다.",
    icon: BotIcon,
  },
];

export default function LandingPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementWithMatch[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [annRes, profileRes] = await Promise.all([
          fetch("/api/announcements"),
          fetch("/api/profile"),
        ]);
        const annData = await annRes.json();
        const profileData = await profileRes.json();
        setAnnouncements(annData.announcements ?? []);
        setProfile(profileData.profile ?? null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
              How It Works
            </span>
            <h2 className="font-bold text-2xl sm:text-4xl tracking-tight text-foreground">
              Upstage Studio 에이전트 4단계 파이프라인
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              공고문 한 장을 올리면, 4개의 전문 AI 노드가 순차적으로 협업하여 정밀하게 분석합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PIPELINE_FEATURES.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  className="group relative rounded-2xl border border-border/80 bg-card p-6 shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
                  key={item.step}
                >
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="font-mono text-xs font-bold text-primary bg-primary/10 rounded-md px-2 py-0.5 shrink-0">
                      STEP {item.step}
                    </span>
                    <UpstageBadge compact feature={item.badge} />
                  </div>

                  <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-foreground mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="size-5" />
                  </div>

                  <h3 className="font-bold text-base text-foreground mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs font-medium text-primary mb-2.5">
                    {item.subtitle}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. Core Highlights Section */}
      <section className="border-b border-border/80 bg-background py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-semibold tracking-wider text-primary uppercase">
              Core Benefits
            </span>
            <h2 className="font-bold text-2xl sm:text-4xl tracking-tight text-foreground">
              공고 탐색의 번거로움을 AI로 완전히 해결합니다
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              요강 일일이 읽지 않아도 지원 자격 판정부터 체크리스트 생성까지 한 번에 완료됩니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HIGHLIGHT_POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <div
                  className="rounded-2xl border border-border/80 bg-secondary/30 p-6 space-y-4"
                  key={point.title}
                >
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-bold text-base text-foreground">
                    {point.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {point.desc}
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
                  Live Announcements
                </span>
                <h2 className="mt-1 font-bold text-2xl sm:text-3xl tracking-tight text-foreground">
                  지금 등록된 최신 공고
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  에이전트가 분석 완료한 실시간 공고 카드입니다.
                </p>
              </div>

              <Button asChild size="sm" variant="outline">
                <Link href="/feed">
                  전체 {announcements.length}건 보기
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
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <CheckCircle2Icon className="size-3.5" />
              스마트한 공고 에이전트 서비스
            </div>

            <div className="max-w-xl mx-auto space-y-3">
              <h2 className="font-bold text-2xl sm:text-3xl tracking-tight text-foreground">
                나에게 딱 맞는 공고를 지금 찾아보세요
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                공고문을 업로드하거나 내 프로필을 등록하여 실시간 자격 판정과 AI 추천을 경험해보세요.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button asChild size="lg">
                <Link href="/feed">
                  <LayoutGridIcon className="size-4 mr-2" />
                  공고 피드 바로가기
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/ingest">공고문 등록하기</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/me">내 프로필 설정</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
