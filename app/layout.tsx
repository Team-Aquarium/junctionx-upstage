import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_KR } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/lib/i18n/client";
import { localeFromCookies } from "@/lib/i18n/server";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-en",
  subsets: ["latin"],
});

const notoSansKr = Noto_Sans_KR({
  variable: "--font-ko",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const espeak = localFont({
  src: [
    { path: "../public/fonts/ESPeak-Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/ESPeak-Semibold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-espeak",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Moabora — Upstage Document Agent",
  description:
    "An Upstage Studio agent reads notices and matches them against your profile to judge eligibility and recommend the best fit.",
  icons: {
    icon: "/upstage/symbol.svg",
    shortcut: "/upstage/symbol.svg",
    apple: "/upstage/symbol.svg",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await localeFromCookies();
  return (
    <html
      className={`${geistSans.variable} ${notoSansKr.variable} ${geistMono.variable} ${espeak.variable} h-full antialiased`}
      lang={locale}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background text-foreground antialiased selection:bg-primary/10 selection:text-primary">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
          enableSystem
        >
          <I18nProvider initialLocale={locale}>
            <TooltipProvider>
              <SiteHeader />
              <main className="flex flex-1 flex-col">{children}</main>
              <SiteFooter />
            </TooltipProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
