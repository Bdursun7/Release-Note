"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { useI18n } from "@/components/i18n-provider";
import { Button, ErrorBanner, TextInput } from "@/components/ui";
import type { RepoSummary } from "@/types/brief";

export function ReposScreen() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [hasGithubToken, setHasGithubToken] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/repos")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("error.generic"));
        if (cancelled) return;
        setRepos(data.repos);
        setIsDemo(Boolean(data.isDemo));
        setHasGithubToken(data.hasGithubToken !== false);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (repo) =>
        repo.fullName.toLowerCase().includes(q) ||
        (repo.description || "").toLowerCase().includes(q),
    );
  }, [repos, query]);

  async function startDraft(repo: RepoSummary) {
    setBusy(repo.fullName);
    setError(null);
    const res = await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: repo.owner,
        repo: repo.name,
        defaultBranch: repo.defaultBranch,
      }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(data.error || t("error.generic"));
      return;
    }
    router.push(`/drafts/${data.draft.id}/range`);
  }

  const emptyGithub = !loading && !isDemo && repos.length === 0 && !query.trim();
  const emptySearch = !loading && filtered.length === 0 && repos.length > 0;

  return (
    <div className="min-h-screen">
      <AppHeader compact />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-serif text-3xl tracking-tight">{t("repos.title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t("repos.subtitle")}</p>
        <div className="mt-6">
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("repos.search")}
            aria-label={t("repos.search")}
          />
        </div>
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-sm">
          {loading ? (
            <li className="px-4 py-8 text-sm text-ink-faint">{t("repos.loading")}</li>
          ) : emptyGithub ? (
            <li className="space-y-2 px-4 py-8 text-sm text-ink-muted">
              <p>{t("repos.emptyGithub")}</p>
              <p className="text-xs leading-relaxed text-ink-faint">
                {hasGithubToken ? t("repos.emptyGithubHint") : t("repos.emptyNoToken")}
              </p>
            </li>
          ) : emptySearch || filtered.length === 0 ? (
            <li className="px-4 py-8 text-sm text-ink-faint">{t("repos.emptySearch")}</li>
          ) : (
            filtered.map((repo) => (
              <li key={String(repo.id)} className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-paper-recede/40">
                <div>
                  <p className="font-medium">{repo.fullName}</p>
                  <p className="text-xs text-ink-muted">
                    {repo.description || repo.language || repo.defaultBranch}
                    {repo.private ? ` · ${t("repos.private")}` : ""}
                    {repo.updatedAt
                      ? ` · ${t("repos.updated")} ${new Date(repo.updatedAt).toLocaleDateString(locale)}`
                      : ""}
                  </p>
                </div>
                <Button disabled={busy === repo.fullName} onClick={() => startDraft(repo)}>
                  {t("repos.newDraft")}
                </Button>
              </li>
            ))
          )}
        </ul>
      </main>
    </div>
  );
}
