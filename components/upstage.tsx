import { cn } from "@/lib/utils";

/* eslint-disable @next/next/no-img-element -- 로컬 정적 브랜드 에셋 */

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
    icon: "/upstage/symbol.svg",
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
        "inline-flex items-center gap-1.5 rounded-md bg-accent/60 px-2 py-0.5 text-xs font-medium text-accent-foreground",
        className,
      )}
      title={`Upstage ${meta.label} — ${meta.description}`}
    >
      <img
        alt="Upstage"
        className="size-3.5 rounded-xs object-contain"
        height={14}
        src={meta.icon}
        width={14}
      />
      <span>{compact ? meta.label : `Upstage ${meta.label}`}</span>
    </span>
  );
}

export function PoweredByUpstage({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      Powered by
      <img
        alt="Upstage"
        className="size-3.5 object-contain"
        height={14}
        src="/upstage/symbol.svg"
        width={14}
      />
      <span className="font-semibold text-foreground">Upstage</span>
    </span>
  );
}

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
