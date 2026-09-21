"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { useI18n } from "@/components/i18n-provider";
import { Button, ErrorBanner, TextInput } from "@/components/ui";
import {
  PAGE_SIZE,
  applySuggestion,
  excludeNoise,
  groupedShaSet,
  leftOutCount,
  mergeShasIntoGroup,
  noiseShas,
  setSelected,
  ungroupShas,
} from "@/lib/curation";
import type {
  CommitRecord,
  CurationState,
  GroupSuggestion,
} from "@/types/brief";

type DraftShape = {
  id: string;
  owner: string;
  repo: string;
  branch: string | null;
  commitsJson: CommitRecord[] | null;
  curationJson: CurationState | null;
  suggestionsJson: GroupSuggestion[] | null;
};

type Row =
  | { kind: "group"; groupId: string; title: string; shas: string[]; collapsed: boolean }
  | { kind: "commit"; commit: CommitRecord; groupId?: string };

export function CurateScreen({ draftId }: { draftId: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [commits, setCommits] = useState<CommitRecord[]>([]);
  const [curation, setCuration] = useState<CurationState>({ selected: {}, groups: [] });
  const [suggestions, setSuggestions] = useState<GroupSuggestion[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [showExcluded, setShowExcluded] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [repoLabel, setRepoLabel] = useState("");
  const [noiseNote, setNoiseNote] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/drafts/${draftId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const draft = data.draft as DraftShape;
        setRepoLabel(`${draft.owner}/${draft.repo}@${draft.branch || "main"}`);
        setCommits(draft.commitsJson || []);
        setCuration(draft.curationJson || { selected: {}, groups: [] });
        setSuggestions(Array.isArray(draft.suggestionsJson) ? draft.suggestionsJson : []);
      })
      .catch((err: Error) => setError(err.message));
  }, [draftId]);

  async function persist(next: CurationState, nextSuggestions?: GroupSuggestion[]) {
    setCuration(next);
    if (nextSuggestions) setSuggestions(nextSuggestions);
    const res = await fetch(`/api/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        curationJson: next,
        suggestionsJson: nextSuggestions ?? suggestions,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t("error.generic"));
    }
  }

  const matchesQuery = (commit: CommitRecord) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      commit.headline.toLowerCase().includes(q) ||
      commit.authorName.toLowerCase().includes(q) ||
      commit.sha.toLowerCase().includes(q)
    );
  };

  const rows: Row[] = useMemo(() => {
    const grouped = groupedShaSet(curation);
    const bySha = new Map(commits.map((c) => [c.sha, c]));
    const out: Row[] = [];
    for (const group of curation.groups) {
      const visibleShas = group.shas.filter((sha) => {
        const commit = bySha.get(sha);
        if (!commit || !matchesQuery(commit)) return false;
        if (!showExcluded && !curation.selected[sha]) return false;
        return true;
      });
      if (visibleShas.length === 0 && query) continue;
      out.push({
        kind: "group",
        groupId: group.id,
        title: group.title,
        shas: group.shas,
        collapsed: group.collapsed,
      });
      if (!group.collapsed) {
        for (const sha of visibleShas) {
          const commit = bySha.get(sha);
          if (commit) out.push({ kind: "commit", commit, groupId: group.id });
        }
      }
    }
    for (const commit of commits) {
      if (grouped.has(commit.sha)) continue;
      if (!matchesQuery(commit)) continue;
      if (!showExcluded && !curation.selected[commit.sha]) continue;
      out.push({ kind: "commit", commit });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commits, curation, query, showExcluded]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedShas = Object.keys(checked).filter((sha) => checked[sha]);
  const included = commits.filter((c) => curation.selected[c.sha]).length;
  const left = leftOutCount(commits, curation);

  function toggleCheck(sha: string) {
    setChecked((prev) => ({ ...prev, [sha]: !prev[sha] }));
  }

  function visibleCommitShas() {
    return pageRows.filter((row): row is Extract<Row, { kind: "commit" }> => row.kind === "commit").map((row) => row.commit.sha);
  }

  function removeNoise() {
    const shas = noiseShas(commits);
    const removed = shas.filter((sha) => curation.selected[sha]).length;
    setChecked((prev) => {
      const next = { ...prev };
      for (const sha of shas) next[sha] = false;
      return next;
    });
    setShowExcluded(true);
    setNoiseNote(removed);
    void persist(excludeNoise(commits, curation));
  }

  return (
    <div className="min-h-screen">
      <AppHeader compact />
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <p className="font-mono text-xs uppercase tracking-widest text-copper">{repoLabel}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl tracking-tight">{t("curate.title")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{t("curate.subtitle")}</p>
          </div>
          <Button onClick={() => router.push(`/drafts/${draftId}/generate`)}>{t("curate.continue")}</Button>
        </div>
        <ErrorBanner message={error} />

        {suggestions.length > 0 ? (
          <section className="paper-card mt-6 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-lg">{t("suggest.title")}</h2>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={async () => {
                    let next = curation;
                    for (const suggestion of suggestions) next = applySuggestion(next, suggestion);
                    await persist(next, []);
                  }}
                >
                  {t("suggest.applyAll")}
                </Button>
                <Button variant="ghost" onClick={() => persist(curation, [])}>
                  {t("suggest.ignoreAll")}
                </Button>
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {suggestions.map((suggestion) => (
                <li key={suggestion.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper-recede/40 px-3 py-2 text-sm">
                  <span>
                    <strong>{suggestion.title}</strong>{" "}
                    <span className="text-ink-muted">({suggestion.shas.length})</span>
                  </span>
                  <span className="flex gap-2">
                    <Button
                      variant="ink"
                      onClick={async () => {
                        const next = applySuggestion(curation, suggestion);
                        await persist(next, suggestions.filter((s) => s.id !== suggestion.id));
                      }}
                    >
                      {t("suggest.apply")}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => persist(curation, suggestions.filter((s) => s.id !== suggestion.id))}
                    >
                      {t("suggest.ignore")}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="sticky-bulk mt-6 flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">
            {t("curate.included", { n: included })} · {t("curate.leftOut", { n: left })}
            {selectedShas.length ? ` · ${t("curate.selected", { n: selectedShas.length })}` : ""}
          </span>
          {noiseNote !== null ? (
            <span className="rounded-full bg-copper/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-copper" role="status">
              {t("curate.noiseRemoved", { n: noiseNote })}
            </span>
          ) : null}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => {
              const next: Record<string, boolean> = { ...checked };
              for (const sha of visibleCommitShas()) next[sha] = true;
              setChecked(next);
            }}>
              {t("curate.selectAll")}
            </Button>
            <Button variant="ghost" onClick={() => setChecked({})}>
              {t("curate.deselectAll")}
            </Button>
            <Button
              variant="ghost"
              disabled={!selectedShas.length}
              onClick={() => persist(setSelected(curation, selectedShas, true))}
            >
              {t("curate.include")}
            </Button>
            <Button
              variant="danger"
              disabled={!selectedShas.length}
              onClick={() => persist(setSelected(curation, selectedShas, false))}
            >
              {t("curate.exclude")}
            </Button>
            <TextInput
              className="w-40"
              placeholder={t("curate.groupName")}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <Button
              variant="ghost"
              disabled={!selectedShas.length || !groupName.trim()}
              onClick={() => {
                persist(mergeShasIntoGroup(curation, selectedShas, groupName.trim()));
                setGroupName("");
                setChecked({});
              }}
            >
              {t("curate.group")}
            </Button>
            <Button
              variant="ghost"
              disabled={!selectedShas.length}
              onClick={() => persist(ungroupShas(curation, selectedShas))}
            >
              {t("curate.ungroup")}
            </Button>
            <Button variant="ghost" onClick={removeNoise}>
              {t("curate.removeNoise")}
            </Button>
            <Button
              variant="ink"
              disabled={suggesting}
              onClick={async () => {
                setSuggesting(true);
                const key = typeof window !== "undefined" ? localStorage.getItem("sbb-llm-key") : null;
                const res = await fetch(`/api/drafts/${draftId}/suggest`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ byok: key }),
                });
                const data = await res.json();
                setSuggesting(false);
                if (!res.ok) {
                  setError(data.error || t("error.generic"));
                  return;
                }
                setSuggestions(data.suggestions || []);
              }}
            >
              {suggesting ? t("curate.suggesting") : t("curate.suggest")}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <TextInput
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={t("curate.search")}
            aria-label={t("curate.search")}
            className="max-w-md"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showExcluded}
              onChange={(e) => setShowExcluded(e.target.checked)}
            />
            {t("curate.showExcluded")}
          </label>
        </div>

        <div className="curate-table mt-4">
          <div className="grid grid-cols-[auto_5.5rem_1fr_9rem_7rem] gap-2 border-b border-line bg-paper-recede/70 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
            <span />
            <span>{t("curate.hash")}</span>
            <span>{t("curate.message")}</span>
            <span className="hidden sm:block">{t("curate.author")}</span>
            <span className="hidden md:block">{t("curate.date")}</span>
          </div>
          {pageRows.length === 0 ? (
            <p className="px-4 py-8 text-sm text-ink-faint">{t("curate.empty")}</p>
          ) : (
            <ul>
              {pageRows.map((row) =>
                row.kind === "group" ? (
                  <li key={`g-${row.groupId}`} className="border-b border-line bg-sea-mist/70">
                    <div className="grid grid-cols-[auto_5.5rem_1fr] items-center gap-2 px-4 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={row.title}
                        checked={row.shas.length > 0 && row.shas.every((sha) => checked[sha])}
                        onChange={(e) => {
                          const next = { ...checked };
                          for (const sha of row.shas) next[sha] = e.target.checked;
                          setChecked(next);
                        }}
                      />
                      <button
                        type="button"
                        className="text-left font-mono text-xs text-sea"
                        onClick={() =>
                          persist({
                            ...curation,
                            groups: curation.groups.map((g) =>
                              g.id === row.groupId ? { ...g, collapsed: !g.collapsed } : g,
                            ),
                          })
                        }
                      >
                        {row.collapsed ? "▸" : "▾"} {row.shas.length}
                      </button>
                      <div className="flex items-center justify-between gap-2">
                        <strong className="tracking-tight">{row.title}</strong>
                        <span className="text-xs text-ink-faint">
                          {row.collapsed ? t("curate.expand") : t("curate.collapse")}
                        </span>
                      </div>
                    </div>
                  </li>
                ) : (
                  <li
                    key={row.commit.sha}
                    className={`grid grid-cols-[auto_5.5rem_1fr_9rem_7rem] items-center gap-2 border-b border-line/70 px-4 py-2.5 text-sm transition hover:bg-paper-recede/40 ${
                      row.groupId ? "bg-sea-mist/25 pl-8" : ""
                    } ${curation.selected[row.commit.sha] ? "" : "opacity-45"}`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(checked[row.commit.sha])}
                      onChange={() => toggleCheck(row.commit.sha)}
                      aria-label={row.commit.shortSha}
                    />
                    <span className="font-mono text-xs text-copper">{row.commit.shortSha}</span>
                    <div className="min-w-0">
                      <p className="truncate">{row.commit.headline}</p>
                      <label className="mt-1 flex items-center gap-2 text-[11px] text-ink-faint">
                        <input
                          type="checkbox"
                          checked={Boolean(curation.selected[row.commit.sha])}
                          onChange={(e) =>
                            persist(setSelected(curation, [row.commit.sha], e.target.checked))
                          }
                        />
                        {curation.selected[row.commit.sha] ? t("curate.include") : t("curate.exclude")}
                      </label>
                    </div>
                    <span className="hidden truncate text-xs text-ink-muted sm:block">{row.commit.authorName}</span>
                    <span className="hidden font-mono text-[11px] text-ink-faint md:block">
                      {new Date(row.commit.authoredAt).toLocaleDateString(locale)}
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-ink-muted">{t("curate.page", { page, pages: pageCount })}</span>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t("curate.prev")}
            </Button>
            <Button variant="ghost" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
              {t("curate.next")}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
