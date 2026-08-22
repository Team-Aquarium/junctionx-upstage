import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./types";

export function localeFromCookieHeader(cookieHeader: string | null | undefined): Locale {
  const match = cookieHeader?.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=(en|ko)`));
  return isLocale(match?.[1]) ? match[1] : DEFAULT_LOCALE;
}

export function localeFromRequest(req: Request): Locale {
  return localeFromCookieHeader(req.headers.get("cookie"));
}
