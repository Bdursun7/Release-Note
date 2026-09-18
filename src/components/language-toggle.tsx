"use client";

import { useI18n } from "@/components/i18n-provider";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className={`lang-toggle ${className}`} role="group" aria-label={t("lang.group")}>
      <button type="button" aria-pressed={locale === "tr"} onClick={() => setLocale("tr")}>
        TR
      </button>
      <span aria-hidden="true">|</span>
      <button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>
        EN
      </button>
    </div>
  );
}
