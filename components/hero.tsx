import Link from "next/link";
import { ArrowRightIcon, FilePlusIcon } from "lucide-react";
import {
  AnnouncementCard,
  type AnnouncementWithMatch,
} from "@/components/announcement";
import { Button } from "@/components/ui/button";

interface HeroProps {
  stats?: {
    total: number;
    eligible: number;
    closing: number;
    recommended: number;
  };
}

const DEMO_ANNOUNCEMENT: AnnouncementWithMatch = {
  id: "demo-hero-notice",
  category: "공모전/해커톤",
  title: "제2회 Upstage AI 서비스 개발 챌린지",
  organizer: "Upstage",
  field: "인공지능 · 서비스 개발",
  apply_start: "2026-08-01",
  apply_end: "2026-08-31",
  result_date: "2026-09-10",
  benefits: "총 상금 2,000만원 및 Upstage 채용 서류 면제",
  contact: null,
  apply_url: null,
  summary: [
    "Upstage Document AI 기반의 실서비스 프로토타입 개발",
    "개인 또는 4인 이하 팀 참가 가능",
  ],
  rules: {
    majors: ["컴퓨터공학과", "인공지능학과", "소프트웨어학과"],
    status: ["재학생", "휴학생", "졸업예정자"],
  },
  todo_checklist: ["기획서 제출", "프로토타입 영상", "GitHub 저장소"],
  sourceFile: { name: "2026_Upstage_챌린지_모집요강.pdf", mediaType: "application/pdf" },
  createdAt: "2026-08-01T00:00:00.000Z",
  match: {
    verdict: "eligible",
    score: 96,
    reasons: ["컴퓨터공학 전공 일치", "재학생 신분 요건 충족"],
  },
};

export function Hero({ stats }: HeroProps) {
  return (
    <section className="border-b border-border/80 bg-background py-24 sm:py-32 lg:py-40">
      <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Headline & Call to Action */}
          <div className="space-y-6 text-center lg:text-left">
            <p className="text-xs font-semibold tracking-wider text-primary uppercase">
              Upstage Document Agent
            </p>

            <h1 className="font-bold text-3xl sm:text-5xl tracking-tight text-foreground leading-[1.18] break-keep">
              공고문 분석부터 자격 판정까지,{" "}
              <br className="hidden sm:inline" />
              <span className="text-primary">모아보라</span>
            </h1>

            <p className="mx-auto lg:mx-0 max-w-xl text-sm sm:text-base text-muted-foreground leading-relaxed break-keep">
              PDF·HWP·포스터 공고문을 Upstage Studio 에이전트가 구조화하고,
              내 프로필과 대조해 지원 가능 여부를 실시간으로 판정합니다.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
              <Button asChild size="default">
                <Link href="/feed">
                  공고 피드 둘러보기
                  <ArrowRightIcon className="size-4 ml-1.5" />
                </Link>
              </Button>
              <Button asChild size="default" variant="outline">
                <Link href="/ingest">
                  <FilePlusIcon className="size-4 mr-1.5" />
                  공고문 직접 등록
                </Link>
              </Button>
            </div>
          </div>

          {/* Right: Minimal Live Showcase Preview */}
          <div className="mx-auto w-full max-w-xl lg:max-w-none">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="font-medium text-foreground">에이전트 분석 카드 예시</span>
              <span>2026_Upstage_챌린지_모집요강.pdf</span>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card p-1 shadow-xs">
              <AnnouncementCard
                item={DEMO_ANNOUNCEMENT}
                recommendReason="컴퓨터공학 전공 및 AI 프로젝트 이력이 대회 요구 역량과 완벽히 일치합니다."
                recommendScore={96}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
