"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { useI18n } from "@/components/i18n-provider";
import { Button, ErrorBanner, Field, RefSelect, Select, TextInput } from "@/components/ui";
import type { BranchSummary, RangeType, TagSummary } from "@/types/brief";

type DraftPayload = {
  id: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  branch: string | null;
  rangeType: string;
  baseRef: string | null;
  headRef: string | null;
  lastN: number;
};

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function RangeScreen({ draftId }: { draftId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [draft, setDraft] = useState<DraftPayload | null>(null);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [branch, setBranch] = useState("");
  const [rangeType, setRangeType] = useState<RangeType>("refs");
  const [baseRef, setBaseRef] = useState("");
  const [headRef, setHeadRef] = useState("");
  const [lastN, setLastN] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/drafts/${draftId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const d = data.draft as DraftPayload;
        setDraft(d);
        const nextBranch = d.branch || d.defaultBranch;
        setBranch(nextBranch);
        setRangeType((d.rangeType as RangeType) || "refs");
        setHeadRef(d.headRef || nextBranch);
        setLastN(d.lastN || 50);
        return Promise.all([
          Promise.resolve(d),
          fetch(`/api/branches?owner=${encodeURIComponent(d.owner)}&repo=${encodeURIComponent(d.repo)}`),
        ]);
      })
      .then(async ([d, res]) => {
        if (!res) return;
        const data = await res.json();
        if (!res.ok) return;
        const nextBranches: BranchSummary[] = data.branches || [];
        const nextTags: TagSummary[] = data.tags || [];
        setBranches(nextBranches);
        setTags(nextTags);
        if (d.baseRef) {
          setBaseRef(d.baseRef);
          return;
        }
        const firstTag = nextTags[0]?.name;
        if (firstTag) {
          setBaseRef(firstTag);
          return;
        }
        const fallbackBranch = nextBranches.find((item) => item.name !== (d.branch || d.defaultBranch))?.name;
        if (fallbackBranch) setBaseRef(fallbackBranch);
      })
      .catch((err: Error) => setError(err.message));
  }, [draftId]);

  const refGroups = useMemo(() => {
    const branchNames = uniqueNames(
      (branches.length ? branches.map((item) => item.name) : [branch || "main"]).filter(Boolean),
    );
    const tagNames = uniqueNames(tags.map((item) => item.name).filter((name) => !branchNames.includes(name)));
    return [
      { label: t("range.branches"), options: branchNames },
      { label: t("range.tags"), options: tagNames },
    ];
  }, [branches, tags, branch, t]);

  async function load() {
    if (!draft) return;
    setLoading(true);
    setError(null);
    const patch = await fetch(`/api/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branch,
        rangeType,
        baseRef: rangeType === "refs" ? baseRef : null,
        headRef: rangeType === "refs" ? headRef || branch : branch,
        lastN,
      }),
    });
    if (!patch.ok) {
      const data = await patch.json();
      setLoading(false);
      setError(data.error || t("error.generic"));
      return;
    }
    const res = await fetch(`/api/drafts/${draftId}/load`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || t("error.range"));
      return;
    }
    router.push(`/drafts/${draftId}/curate`);
  }

  return (
    <div className="min-h-screen">
      <AppHeader compact />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="font-mono text-xs uppercase tracking-widest text-copper">
          {draft ? `${draft.owner}/${draft.repo}` : "…"}
        </p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight">{t("range.title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t("range.subtitle")}</p>
        <div className="paper-card mt-8 space-y-6 p-7">
          <Field label={t("range.branch")}>
            <Select
              value={branch}
              aria-label={t("range.branch")}
              onChange={(e) => {
                setBranch(e.target.value);
                if (!headRef || headRef === branch) setHeadRef(e.target.value);
              }}
            >
              {(branches.length ? branches.map((b) => b.name) : [branch || "main"]).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("range.mode")}>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="mode-choice" data-active={rangeType === "refs"}>
                <input
                  type="radio"
                  name="rangeType"
                  checked={rangeType === "refs"}
                  onChange={() => setRangeType("refs")}
                />
                <span>
                  <span className="block font-medium">{t("range.refs")}</span>
                  <span className="mt-0.5 block text-xs text-ink-faint">{t("range.baseHint")}</span>
                </span>
              </label>
              <label className="mode-choice" data-active={rangeType === "lastN"}>
                <input
                  type="radio"
                  name="rangeType"
                  checked={rangeType === "lastN"}
                  onChange={() => setRangeType("lastN")}
                />
                <span>
                  <span className="block font-medium">{t("range.lastN")}</span>
                  <span className="mt-0.5 block text-xs text-ink-faint">{t("range.nHint")}</span>
                </span>
              </label>
            </div>
          </Field>
          {rangeType === "refs" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("range.base")}>
                <RefSelect
                  value={baseRef}
                  onChange={setBaseRef}
                  groups={refGroups}
                  customLabel={t("range.customRef")}
                  customHint={t("range.customHint")}
                  placeholder={t("range.pickRef")}
                />
              </Field>
              <Field label={t("range.head")} hint={t("range.headHint")}>
                <RefSelect
                  value={headRef}
                  onChange={setHeadRef}
                  groups={refGroups}
                  customLabel={t("range.customRef")}
                  customHint={t("range.customHint")}
                  placeholder={t("range.pickRef")}
                />
              </Field>
            </div>
          ) : (
            <Field label={t("range.n")} hint={t("range.nHint")}>
              <TextInput
                type="number"
                min={1}
                max={500}
                value={lastN}
                onChange={(e) => setLastN(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
              />
            </Field>
          )}
          <ErrorBanner message={error} />
          <Button onClick={load} disabled={loading || (rangeType === "refs" && !baseRef.trim())}>
            {loading ? t("range.loading") : t("range.continue")}
          </Button>
        </div>
      </main>
    </div>
  );
}
