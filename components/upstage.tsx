"use client";

import { useT } from "@/lib/i18n/client";
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
    description: "Document structure & OCR",
  },
  "information-extract": {
    label: "Information Extract",
    icon: "/upstage/information-extract.svg",
    description: "Schema-based field extraction",
  },
  solar: {
    label: "Solar Pro 4",
    icon: "/upstage/solar-llm.svg",
    description: "LLM reasoning & generation",
  },
  agents: {
    label: "Studio Agents",
    icon: "/upstage/studio-agents.svg",
    description: "Parse → Classify → Extract → Instruct pipeline",
  },
};

export function UpstageBadge({
  feature,
  className,
  compact = true,
}: {
  feature: UpstageFeature;
  className?: string;
  compact?: boolean;
}) {
  const t = useT();
  const meta = UPSTAGE_FEATURES[feature];
  const desc =
    feature === "document-parse"
      ? t("upstage.parseDesc")
      : feature === "information-extract"
        ? t("upstage.extractDesc")
        : feature === "solar"
          ? t("upstage.solarDesc")
          : t("upstage.agentsDesc");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-accent/60 px-2 py-0.5 text-xs font-medium text-accent-foreground shrink-0 max-w-full",
        className,
      )}
      title={`Upstage ${meta.label} — ${desc}`}
    >
      <img
        alt="Upstage"
        className="size-3.5 shrink-0 rounded-xs object-contain"
        height={14}
        src={meta.icon}
        width={14}
      />
      <span className="truncate">{compact ? meta.label : `Upstage ${meta.label}`}</span>
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
  if (/classify|에이전트 실행|agent run|studio/i.test(title)) {
    return "agents";
  }
  return null;
}
