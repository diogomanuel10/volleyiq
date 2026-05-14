import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";

const SUPPORTED = ["pt-PT", "en", "es", "fr"] as const;
export type Language = typeof SUPPORTED[number];

export const LANGUAGE_LABEL: Record<Language, string> = {
  "pt-PT": "Português",
  en: "English",
  es: "Español",
  fr: "Français",
};

export const LANGUAGE_SHORT: Record<Language, string> = {
  "pt-PT": "PT",
  en: "EN",
  es: "ES",
  fr: "FR",
};

export function useLanguage() {
  const { i18n } = useTranslation();

  const setLanguage = useCallback(async (lang: Language) => {
    await i18n.changeLanguage(lang);
    localStorage.setItem("volleyiq:lang", lang);
    try {
      await api.patch("/api/user/preferences", { language: lang });
    } catch {
      // graceful fallback — preference saved locally even if server fails
    }
  }, [i18n]);

  return { language: i18n.language as Language, setLanguage, supported: SUPPORTED };
}
