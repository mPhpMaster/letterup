"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import en from "./en.json";
import ar from "./ar.json";

export type Locale = "en" | "ar";
type Dictionary = Record<string, unknown>;
type Vars = Record<string, string | number>;

const DICTIONARIES: Record<Locale, Dictionary> = { en, ar };
const STORAGE_KEY = "hapo.locale";

function lookup(dict: Dictionary, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Dictionary)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Resolves `key` for `locale`. When `vars.count` is a number, CLDR plural forms are tried first
 * (`key_zero`, `key_one`, `key_two`, `key_few`, `key_many`, `key_other`) — Arabic uses all six.
 */
export function translate(locale: Locale, key: string, vars?: Vars): string {
  const dict = DICTIONARIES[locale];
  let template: string | undefined;
  if (typeof vars?.count === "number") {
    const category = new Intl.PluralRules(locale).select(vars.count);
    template = lookup(dict, `${key}_${category}`) ?? lookup(dict, `${key}_other`) ?? lookup(DICTIONARIES.en, `${key}_other`);
  }
  template ??= lookup(dict, key) ?? lookup(DICTIONARIES.en, key) ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (vars && name in vars ? String(vars[name]) : match));
}

interface I18nValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Vars) => string;
  hasStoredLocale: () => boolean;
}

const I18nContext = createContext<I18nValue | null>(null);

function readStored(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "en" || value === "ar" ? value : null;
  } catch {
    return null;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = readStored();
    if (stored) setLocaleState(stored);
  }, []);

  const dir = locale === "ar" ? "rtl" : "ltr";
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage can be unavailable inside some iframes; the choice just won't persist
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      hasStoredLocale: () => readStored() !== null,
    }),
    [locale, dir, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
