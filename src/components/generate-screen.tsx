"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { useI18n } from "@/components/i18n-provider";
import { Button, ErrorBanner, Field, Select, TextInput, WarningBanner } from "@/components/ui";
import type { Locale } from "@/lib/i18n";

const KEY = "sbb-llm-key";

export function GenerateScreen({ draftId }: { draftId: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<"follow" | "en" | "tr">("follow");
  const [byok, setByok] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [included, setIncluded] = useState<number | null>(null);
  const [envLlm, setEnvLlm] = useState<boolean | null>(null);

  useEffect(() => {
    setByok(localStorage.getItem(KEY) || "");
    fetch(`/api/drafts/${draftId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const selected = data.draft.curationJson?.selected || {};
        setIncluded(Object.values(selected).filter(Boolean).length);
      })
      .catch((err: Error) => setError(err.message));
    fetch("/api/health")
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setEnvLlm(Boolean(data.llmConfigured));
      })
      .catch(() => setEnvLlm(false));
  }, [draftId]);

  const hasKey = Boolean(byok.trim()) || envLlm === true;
  const showLlmWarning = envLlm !== null && !hasKey;

  async function run() {
    if (included === 0) {
      setError(t("generate.empty"));
      return;
    }
    setRunning(true);
    setError(null);
    if (byok) localStorage.setItem(KEY, byok);
    else localStorage.removeItem(KEY);
    const briefLocale: Locale = mode === "follow" ? locale : mode;
    const res = await fetch(`/api/drafts/${draftId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: briefLocale, byok: byok || null }),
    });
    const data = await res.json();
    setRunning(false);
    if (!res.ok) {
      setError(data.error || t("error.generic"));
      return;
    }
    router.push(`/drafts/${draftId}`);
  }

  return (
    <div className="min-h-screen">
      <AppHeader compact />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-serif text-3xl tracking-tight">{t("generate.title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t("generate.subtitle")}</p>
        {included !== null ? (
          <p className="mt-3 font-mono text-xs uppercase tracking-wider text-copper">
            {t("curate.included", { n: included })}
          </p>
        ) : null}
        <div className="paper-card mt-8 space-y-6 p-7">
          {showLlmWarning ? <WarningBanner message={t("generate.llmMissing")} /> : null}
          <Field label={t("generate.locale")}>
            <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="follow">{t("generate.followUi", { ui: locale.toUpperCase() })}</option>
              <option value="en">{t("generate.en")}</option>
              <option value="tr">{t("generate.tr")}</option>
            </Select>
          </Field>
          <Field label={t("generate.byok")} hint={t("generate.byokHint")}>
            <TextInput
              type="password"
              autoComplete="off"
              value={byok}
              onChange={(e) => setByok(e.target.value)}
              placeholder="sk-…"
            />
          </Field>
          <ErrorBanner message={error} />
          {included === 0 ? <WarningBanner message={t("generate.empty")} /> : null}
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => router.push(`/drafts/${draftId}/curate`)}>
              {t("generate.back")}
            </Button>
            <Button onClick={run} disabled={running || included === 0}>
              {running ? t("generate.running") : t("generate.run")}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
