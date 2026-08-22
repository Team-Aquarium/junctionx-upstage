import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/lib/i18n/client";
import { localeFromCookies } from "@/lib/i18n/server";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
