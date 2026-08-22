"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { PoweredByUpstage } from "@/components/upstage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "피드" },
  { href: "/ingest", label: "공고 등록" },
  { href: "/me", label: "프로필" },
  { href: "/chat", label: "문서 챗" },
] as const;

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Button
      aria-label="테마 전환"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      size="icon-sm"
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
    <header className="sticky top-0 z-40 h-14 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-center gap-5">
          <Link className="flex items-center gap-2" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="모아보라"
              className="size-6 rounded-md"
              height={24}
              src="/upstage/symbol.png"
              width={24}
            />
            <span className="font-bold text-base tracking-tight">모아보라</span>
          </Link>
          <nav className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-secondary font-medium text-secondary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
        <div className="flex shrink-0 items-center gap-3">
          <PoweredByUpstage className="max-sm:hidden" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
