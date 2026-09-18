"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/components/i18n-provider";

export function AppHeader({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { data } = useSession();
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-ink px-6 py-3 text-paper">
      <Link href={data ? "/repos" : "/"} className="flex items-baseline gap-3">
        <span className="font-serif text-lg tracking-tight">{t("brand.name")}</span>
        {!compact ? (
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-copper-soft sm:inline">
            {t("landing.kicker")}
          </span>
        ) : null}
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {data ? (
          <Link href="/repos" className="text-paper/80 hover:text-paper">
            {t("nav.repos")}
          </Link>
        ) : null}
        <LanguageToggle className="text-paper" />
        {data ? (
          <button
            type="button"
            className="font-mono text-[11px] uppercase tracking-wider text-paper/70 hover:text-paper"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            {t("nav.signOut")}
          </button>
        ) : null}
      </div>
    </header>
  );
}
