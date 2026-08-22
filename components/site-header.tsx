"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "공고 피드" },
  { href: "/ingest", label: "공고 등록" },
  { href: "/me", label: "내 프로필" },
  { href: "/chat", label: "문서 챗" },
] as const;

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return (
    <Button
      aria-label="테마 전환"
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

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-6 sm:px-8">
        {/* Left: Brand Logo */}
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
              모아보라
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <Link
            className="flex size-8 items-center justify-center rounded-lg bg-secondary text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            href="/me"
            title="프로필"
          >
            나
          </Link>
        </div>
      </div>
    </header>
  );
}
