"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { useI18n } from "@/components/i18n-provider";
import { Button, ErrorBanner, WarningBanner } from "@/components/ui";
import { footnote, llmFallbackMessageKey, normalizeBrief, sectionHeading } from "@/lib/brief-format";
import type { BriefDocument, BriefSectionKey } from "@/types/brief";

const ORDER: BriefSectionKey[] = ["improvements", "bugFixes", "other"];

export function BriefScreen({ draftId }: { draftId: string }) {
  const { t } = useI18n();
  const [brief, setBrief] = useState<BriefDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appendixOpen, setAppendixOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/drafts/${draftId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!data.draft.briefJson) throw new Error("missing");
        setBrief(normalizeBrief(data.draft.briefJson));
      })
      .catch(() => setError(t("error.generic")));
  }, [draftId, t]);

  return (
    <div className="min-h-screen">
      <AppHeader compact />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex flex-wrap gap-2">
          <a href={`/api/drafts/${draftId}/export?format=pdf`}>
            <Button>{t("brief.exportPdf")}</Button>
          </a>
          <a href={`/api/drafts/${draftId}/export?format=docx`}>
            <Button variant="ghost">{t("brief.exportDocx")}</Button>
          </a>
          <a href={`/api/drafts/${draftId}/export?format=md`}>
            <Button variant="ghost">{t("brief.exportMd")}</Button>
          </a>
          <Link href={`/drafts/${draftId}/curate`}>
            <Button variant="ghost">{t("brief.recirate")}</Button>
          </Link>
          <Link href={`/drafts/${draftId}/generate`}>
            <Button variant="ghost">{t("brief.regenerate")}</Button>
          </Link>
        </div>
        <ErrorBanner message={error} />
        {brief && !brief.usedLlm ? (
          <div className="mb-4">
            <WarningBanner message={t(llmFallbackMessageKey(brief.llmFallback))} />
          </div>
        ) : null}
        {brief ? (
          <article className="brief-sheet px-8 py-0 md:px-12">
            <div className="brief-sheet-bar" aria-hidden />
            <div className="px-0 py-10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-copper">
                  {t("brand.name")}
                </p>
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider ${
                    brief.usedLlm ? "text-sea" : "text-copper-dark"
                  }`}
                >
                  {brief.usedLlm ? t("brief.llmBadge") : t("brief.basicBadge")}
                </span>
              </div>
              <h1 className="mt-3 text-3xl leading-tight">{brief.title}</h1>
              <p className="mt-5 text-[15px] leading-relaxed text-ink">{brief.summary}</p>
              {ORDER.map((key) => {
                const groups = brief.sections[key];
                if (!groups.length) return null;
                return (
                  <section key={key} className="mt-8">
                    <h2 className="font-serif text-xl text-copper">{sectionHeading(brief.locale, key)}</h2>
                    {groups.map((group, groupIndex) => (
                      <div key={`${key}-${groupIndex}`} className="mt-4">
                        {group.title ? (
                          <h3 className="font-serif text-base text-ink">{group.title}</h3>
                        ) : null}
                        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
                          {group.bullets.map((item, index) => (
                            <li key={`${key}-${groupIndex}-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </section>
                );
              })}
              <p className="mt-10 border-t border-line pt-4 text-xs text-ink-muted">{footnote(brief)}</p>
              <details
                className="mt-6 text-sm"
                open={appendixOpen}
                onToggle={(e) => setAppendixOpen((e.target as HTMLDetailsElement).open)}
              >
                <summary className="cursor-pointer font-medium text-ink-muted">
                  {t("brief.appendix")}
                  <span className="ml-2 text-xs font-normal text-ink-faint">{t("brief.appendixHint")}</span>
                </summary>
                <ul className="mt-3 space-y-1 font-mono text-xs text-ink-muted">
                  {brief.appendix.map((entry) => (
                    <li key={entry.sha}>
                      <span className="text-copper">{entry.sha}</span> {entry.message}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </article>
        ) : null}
      </main>
    </div>
  );
}
