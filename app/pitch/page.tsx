"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  DownloadIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/types";
import {
  PITCH_SLIDES,
  type Localized,
  type PitchSlide,
} from "@/lib/pitch";
import { cn } from "@/lib/utils";

function loc<T>(value: Localized<T>, locale: Locale): T {
  return value[locale];
}

function DeckPlayer({
  active,
  onSelect,
  deckRef,
}: {
  active: number;
  onSelect: (n: number) => void;
  deckRef?: RefObject<HTMLDivElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      if (width > 0) {
        setScale(width / 1280);
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame?.contentWindow) return;
    try {
      frame.contentWindow.postMessage({ type: "moabora-slide", n: active }, "*");
    } catch {
      // ignore
    }
  }, [active]);

  return (
    <div className="flex flex-col space-y-3" ref={deckRef}>
      {/* 16:9 Slide Display */}
      <div
        className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/80 bg-[#0c0b14] shadow-2xl ring-1 ring-white/5"
        ref={containerRef}
      >
        <iframe
          className="absolute top-0 left-0 border-0 pointer-events-auto select-none"
          key={active}
          ref={iframeRef}
          src={`/slides/deck?s=${active}`}
          style={{
            width: 1280,
            height: 720,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          title={`Slide ${active}`}
        />
      </div>

      {/* Slide timeline pills */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {PITCH_SLIDES.map((slide) => {
            const isCurrent = slide.n === active;
            return (
              <button
                aria-current={isCurrent ? "true" : undefined}
                className={cn(
                  "size-7 rounded-lg font-mono text-xs font-medium transition-all",
                  isCurrent
                    ? "bg-primary text-primary-foreground shadow-xs font-bold scale-105"
                    : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
                key={slide.n}
                onClick={() => onSelect(slide.n)}
                title={`Slide ${slide.n}: ${slide.time}`}
                type="button"
              >
                {slide.n}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            aria-label="Previous slide"
            className="size-8"
            disabled={active <= 1}
            onClick={() => onSelect(active - 1)}
            size="icon"
            variant="outline"
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <Button
            aria-label="Next slide"
            className="size-8"
            disabled={active >= PITCH_SLIDES.length}
            onClick={() => onSelect(active + 1)}
            size="icon"
            variant="outline"
          >
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function NarrationCard({
  slide,
  locale,
}: {
  slide: PitchSlide;
  locale: Locale;
}) {
  return (
    <article className="space-y-5">
      <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-foreground">
        {loc(slide.title, locale)}
      </h2>
      <div className="text-[15px] sm:text-base leading-[1.8] text-foreground/90 break-keep [&>p]:mb-4 [&>p:last-child]:mb-0 [&>ul]:my-3 [&>ul]:space-y-2 [&>ol]:my-3 [&>ol]:space-y-2 [&>li]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-foreground">
        <MessageResponse>{loc(slide.markdown, locale)}</MessageResponse>
      </div>
    </article>
  );
}

export default function PitchPage() {
  const { locale, t } = useI18n();
  const [active, setActive] = useState(1);
  const deckRef = useRef<HTMLDivElement>(null);
  const [narrationMaxH, setNarrationMaxH] = useState<number | undefined>();
  const activeSlide = PITCH_SLIDES.find((slide) => slide.n === active) ?? PITCH_SLIDES[0];

  useEffect(() => {
    const hash = Number(window.location.hash.replace("#slide-", ""));
    if (hash >= 1 && hash <= PITCH_SLIDES.length) {
      setActive(hash);
    }
  }, []);

  const selectSlide = useCallback((n: number) => {
    const clamped = Math.max(1, Math.min(PITCH_SLIDES.length, n));
    setActive(clamped);
    window.history.replaceState(null, "", `#slide-${clamped}`);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["input", "textarea", "select"].includes(target.tagName.toLowerCase())) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        selectSlide(active - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        selectSlide(active + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, selectSlide]);

  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;

    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      setNarrationMaxH(mq.matches ? el.offsetHeight : undefined);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    mq.addEventListener("change", update);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", update);
    };
  }, []);

  return (
    <div className="w-full">
      {/* 1. Header / Hero Bar */}
      <section className="border-b border-border/80 bg-background py-12 sm:py-16">
        <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <span className="text-xs font-semibold tracking-wider text-primary uppercase">
                {t("pitch.eyebrow")}
              </span>
              <h1 className="font-display font-semibold text-3xl sm:text-5xl tracking-tight text-foreground leading-[1.18] break-keep">
                {t("pitch.title")}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed break-keep">
                {t("pitch.body")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Button asChild size="sm" variant="outline">
                <a href="/slides/deck" rel="noreferrer" target="_blank">
                  <ExternalLinkIcon className="size-3.5 mr-1.5" />
                  {t("pitch.openFull")}
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href="/slides/pdf" target="_blank">
                  <DownloadIcon className="size-3.5 mr-1.5" />
                  {t("pitch.downloadPdf")}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Main Presenter Stage (Slide Player + Pure Markdown Script Card) */}
      <section className="bg-background py-10 sm:py-14 lg:py-8">
        <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
            {/* Left Column: 16:9 Slide Player (7 cols on lg) */}
            <div className="lg:col-span-7">
              <DeckPlayer active={active} deckRef={deckRef} onSelect={selectSlide} />
            </div>

            {/* Right Column: Narration Cue Card (5 cols on lg) */}
            <div
              className="lg:col-span-5 lg:min-h-0"
              style={narrationMaxH ? { height: narrationMaxH } : undefined}
            >
              <div className="h-full overflow-y-auto overscroll-y-contain pr-1">
                <NarrationCard locale={locale} slide={activeSlide} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
