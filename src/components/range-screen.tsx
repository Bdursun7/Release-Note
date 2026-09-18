"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { useI18n } from "@/components/i18n-provider";
import { Button, ErrorBanner, Field, Select, TextInput } from "@/components/ui";
import type { BranchSummary, RangeType } from "@/types/brief";

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

export function RangeScreen({ draftId }: { draftId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [draft, setDraft] = useState<DraftPayload | null>(null);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
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
        setBranch(d.branch || d.defaultBranch);
        setRangeType((d.rangeType as RangeType) || "refs");
        setBaseRef(d.baseRef || "");
        setHeadRef(d.headRef || d.branch || d.defaultBranch);
        setLastN(d.lastN || 50);
        return fetch(`/api/branches?owner=${encodeURIComponent(d.owner)}&repo=${encodeURIComponent(d.repo)}`);
      })
      .then(async (res) => {
        if (!res) return;
        const data = await res.json();
        if (res.ok) setBranches(data.branches);
      })
      .catch((err: Error) => setError(err.message));
  }, [draftId]);

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
        <h1 className="mt-2 font-serif text-3xl">{t("range.title")}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t("range.subtitle")}</p>
        <div className="paper-card mt-8 space-y-6 p-6">
          <Field label={t("range.branch")}>
            <Select value={branch} onChange={(e) => {
              setBranch(e.target.value);
              if (!headRef || headRef === branch) setHeadRef(e.target.value);
            }}>
              {(branches.length ? branches.map((b) => b.name) : [branch || "main"]).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("range.mode")}>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="rangeType"
                  checked={rangeType === "refs"}
                  onChange={() => setRangeType("refs")}
                />
                {t("range.refs")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="rangeType"
                  checked={rangeType === "lastN"}
                  onChange={() => setRangeType("lastN")}
                />
                {t("range.lastN")}
              </label>
            </div>
          </Field>
          {rangeType === "refs" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("range.base")} hint={t("range.baseHint")}>
                <TextInput value={baseRef} onChange={(e) => setBaseRef(e.target.value)} placeholder="v1.4.0" />
              </Field>
              <Field label={t("range.head")} hint={t("range.headHint")}>
                <TextInput value={headRef} onChange={(e) => setHeadRef(e.target.value)} />
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
