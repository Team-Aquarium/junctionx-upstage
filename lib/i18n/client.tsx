"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createTranslator } from ".";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale, type MessageParams, type Translator } from "./types";

const I18nContext = createContext<{
  locale: Locale;
  t: Translator;
  setLocale: (locale: Locale) => void;
} | null>(null);

function writeCookieLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  document.documentElement.lang = locale;
}

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const t = useMemo(() => createTranslator(locale), [locale]);

  const setLocale = useCallback((next: Locale) => {
    writeCookieLocale(next);
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export function useT(): Translator {
  return useI18n().t;
}

export function useLocaleState() {
  const { locale, setLocale } = useI18n();
  return { locale, setLocale };
}

export function tSafe(t: Translator, key: string, params?: MessageParams) {
  return t(key, params);
}
