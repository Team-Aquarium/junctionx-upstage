"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export interface SearchFilterState {
  keyword: string;
  verdict: "all" | "eligible" | "check";
  timeline: "all" | "closing" | "open";
}

interface SearchFilterProps {
  onSearchChange: (filters: SearchFilterState) => void;
  className?: string;
}

export function SearchFilter({ onSearchChange, className }: SearchFilterProps) {
  const t = useT();
  const [keyword, setKeyword] = useState("");
  const [verdict, setVerdict] = useState<"all" | "eligible" | "check">("all");
  const [timeline, setTimeline] = useState<"all" | "closing" | "open">("all");

  const updateFilters = (next: Partial<SearchFilterState>) => {
    const updated = {
      keyword: next.keyword !== undefined ? next.keyword : keyword,
      verdict: next.verdict !== undefined ? next.verdict : verdict,
      timeline: next.timeline !== undefined ? next.timeline : timeline,
    };
    onSearchChange(updated);
  };

  const handleKeyword = (val: string) => {
    setKeyword(val);
    updateFilters({ keyword: val });
  };

  const handleVerdict = (val: "all" | "eligible" | "check") => {
    setVerdict(val);
    updateFilters({ verdict: val });
  };

  const handleTimeline = (val: "all" | "closing" | "open") => {
    setTimeline(val);
    updateFilters({ timeline: val });
  };

  const isFiltered = keyword || verdict !== "all" || timeline !== "all";

  const handleClear = () => {
    setKeyword("");
    setVerdict("all");
    setTimeline("all");
    onSearchChange({ keyword: "", verdict: "all", timeline: "all" });
  };

  return (
    <div className={cn("w-full space-y-4", className)}>
      <div className="relative flex items-center w-full rounded-xl border border-border bg-card px-4 py-3 transition-colors focus-within:border-primary">
        <SearchIcon className="size-4.5 text-muted-foreground shrink-0 mr-3" />
        <input
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          onChange={(e) => handleKeyword(e.target.value)}
          placeholder={t("search.placeholder")}
          type="text"
          value={keyword}
        />
        {keyword && (
          <button
            aria-label={t("search.clearQuery")}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => handleKeyword("")}
            type="button"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground font-medium mr-1">{t("search.eligibility")}</span>
          <button
            className={cn(
              "rounded-lg px-2.5 py-1 font-medium transition-colors",
              verdict === "all"
                ? "bg-foreground text-background font-semibold"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handleVerdict("all")}
            type="button"
          >
            {t("search.all")}
          </button>
          <button
            className={cn(
              "rounded-lg px-2.5 py-1 font-medium transition-colors",
              verdict === "eligible"
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handleVerdict("eligible")}
            type="button"
          >
            {t("search.eligibleOnly")}
          </button>
          <button
            className={cn(
              "rounded-lg px-2.5 py-1 font-medium transition-colors",
              verdict === "check"
                ? "bg-foreground text-background font-semibold"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handleVerdict("check")}
            type="button"
          >
            {t("search.includeCheck")}
          </button>

          <span className="text-muted-foreground font-medium ml-3 mr-1">{t("search.timeline")}</span>
          <button
            className={cn(
              "rounded-lg px-2.5 py-1 font-medium transition-colors",
              timeline === "all"
                ? "bg-foreground text-background font-semibold"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handleTimeline("all")}
            type="button"
          >
            {t("search.all")}
          </button>
          <button
            className={cn(
              "rounded-lg px-2.5 py-1 font-medium transition-colors",
              timeline === "closing"
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handleTimeline("closing")}
            type="button"
          >
            {t("search.closing7")}
          </button>
          <button
            className={cn(
              "rounded-lg px-2.5 py-1 font-medium transition-colors",
              timeline === "open"
                ? "bg-foreground text-background font-semibold"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handleTimeline("open")}
            type="button"
          >
            {t("search.openOnly")}
          </button>
        </div>

        {isFiltered && (
          <button
            className="text-muted-foreground hover:text-foreground underline underline-offset-2"
            onClick={handleClear}
            type="button"
          >
            {t("search.reset")}
          </button>
        )}
      </div>
    </div>
  );
}
