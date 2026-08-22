import { en } from "./en";
import { ko } from "./ko";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALES,
  LOCALE_COOKIE,
  type Locale,
  type MessageParams,
  type Translator,
} from "./types";

type Catalog = Record<string, unknown>;

const CATALOGS: Record<Locale, Catalog> = { en, ko };

function lookup(catalog: Catalog, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = catalog;
  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function interpolate(template: string, params?: MessageParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] === undefined ? `{${name}}` : String(params[name]),
  );
}

export function translate(locale: Locale, key: string, params?: MessageParams): string {
  const fromLocale = lookup(CATALOGS[locale], key);
  const fallback = locale === DEFAULT_LOCALE ? undefined : lookup(CATALOGS[DEFAULT_LOCALE], key);
  return interpolate(fromLocale ?? fallback ?? key, params);
}

export function createTranslator(locale: Locale = DEFAULT_LOCALE): Translator {
  return (key, params) => translate(locale, key, params);
}

export { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, isLocale };
export type { Locale, MessageParams, Translator };
