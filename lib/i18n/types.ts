export const LOCALES = ["en", "ko"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "moabora-locale";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "ko";
}

export type MessageParams = Record<string, string | number>;
export type Translator = (key: string, params?: MessageParams) => string;
