import { cn } from "@/lib/utils";

/* eslint-disable @next/next/no-img-element -- 로컬 정적 브랜드 에셋이라 next/image 불필요 */

/** 화면 곳곳에서 "어떤 Upstage 기능을 쓰는지"를 공식 심볼과 함께 표기하는 배지. */
export type UpstageFeature =
  | "document-parse"
  | "information-extract"
  | "solar"
  | "agents";

export const UPSTAGE_FEATURES: Record<
  UpstageFeature,
  { label: string; icon: string; description: string }
> = {
  "document-parse": {
    label: "Document Parse",
    icon: "/upstage/document-parse.svg",
    description: "문서 구조화·OCR",
  },
  "information-extract": {
    label: "Information Extract",
    icon: "/upstage/information-extract.svg",
    description: "스키마 기반 필드 추출",
  },
  solar: {
    label: "Solar Pro 4",
    icon: "/upstage/solar-llm.svg",
    description: "LLM 추론·생성",
  },
  agents: {
    label: "Studio Agents",
    icon: "/upstage/symbol.png",
    description: "Parse→Classify→Extract→Instruct 파이프라인",
  },
};

export function UpstageBadge({
  feature,
  className,
  compact = false,
}: {
  feature: UpstageFeature;
  className?: string;
  compact?: boolean;
}) {
  const meta = UPSTAGE_FEATURES[feature];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 py-0.5 pr-2.5 pl-1 font-medium text-[11px] text-primary",
        className,
      )}
      title={`Upstage ${meta.label} — ${meta.description}`}
    >
      <img
        alt="Upstage"
        className="size-4 rounded-full"
        height={16}
        src={meta.icon}
        width={16}
      />
      {compact ? meta.label : `Upstage ${meta.label}`}
    </span>
  );
}

/** 헤더·푸터용 "Powered by Upstage" 마크. */
export function PoweredByUpstage({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-muted-foreground text-xs",
        className,
      )}
    >
      Powered by
      <img
        alt="Upstage"
        className="size-4 rounded-full"
        height={16}
        src="/upstage/symbol.png"
        width={16}
      />
      <span className="font-semibold text-foreground">Upstage</span>
    </span>
  );
}

/** 워크플로우 단계 제목에서 사용된 Upstage 기능을 추론한다. (단계 로그에 아이콘 표시용) */
export function featureFromStepTitle(title: string): UpstageFeature | null {
  if (/parse/i.test(title)) {
    return "document-parse";
  }
  if (/extract/i.test(title) && !/instruct/i.test(title)) {
    return "information-extract";
  }
  if (/instruct|solar/i.test(title)) {
    return "solar";
  }
  if (/classify|에이전트 실행|studio/i.test(title)) {
    return "agents";
  }
  return null;
}
