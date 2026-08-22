import Link from "next/link";
import { PoweredByUpstage } from "@/components/upstage";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/80 bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-foreground">
                모아보라
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                Upstage Document Agent
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              JunctionX Korea 2026 · Upstage Track
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
            <Link className="hover:text-foreground transition-colors" href="/feed">
              공고 피드
            </Link>
            <Link className="hover:text-foreground transition-colors" href="/ingest">
              공고 등록
            </Link>
            <Link className="hover:text-foreground transition-colors" href="/me">
              내 프로필
            </Link>
            <Link className="hover:text-foreground transition-colors" href="/chat">
              문서 챗
            </Link>
            <a
              className="hover:text-foreground transition-colors"
              href="https://github.com/Team-Aquarium/junctionx-upstage"
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© Team Aquarium. All rights reserved.</p>
          <PoweredByUpstage />
        </div>
      </div>
    </footer>
  );
}
