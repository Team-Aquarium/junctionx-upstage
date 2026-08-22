"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return (
    <Button
      aria-label={t("common.themeToggle")}
      className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      size="icon"
      variant="ghost"
    >
      {mounted && resolvedTheme === "dark" ? (
        <SunIcon className="size-4" />
      ) : (
        <MoonIcon className="size-4" />
      )}
    </Button>
  );
}

function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="flex items-center rounded-lg bg-secondary p-0.5 text-xs" role="group" aria-label={t("common.language")}>
      <button
        className={cn(
          "rounded-md px-2 py-1 font-medium transition-colors",
          locale === "en" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setLocale("en")}
        type="button"
      >
        {t("header.langEn")}
      </button>
      <button
        className={cn(
          "rounded-md px-2 py-1 font-medium transition-colors",
          locale === "ko" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setLocale("ko")}
        type="button"
      >
        {t("header.langKo")}
      </button>
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { t } = useI18n();
  const navItems = [
    { href: "/feed", label: t("nav.feed") },
    { href: "/ingest", label: t("nav.ingest") },
    { href: "/me", label: t("nav.profile") },
    { href: "/chat", label: t("nav.chat") },
    { href: "/pitch", label: t("nav.pitch") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-6 sm:px-8">
        <div className="flex items-center gap-8">
          <Link className="flex items-center gap-2.5" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Upstage"
              className="size-6 object-contain"
              height={24}
              src="/upstage/symbol.svg"
              width={24}
            />
            <span className="font-bold text-base tracking-tight text-foreground">
              {t("brand.name")}
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-secondary font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
