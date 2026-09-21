import type {
  BriefDocument,
  BriefSectionGroup,
  BriefSectionKey,
  CommitRecord,
  CurationState,
  LlmFallbackReason,
  Locale,
  RangeStats,
} from "@/types/brief";
import {
  categorizeCommit,
  humanizeHeadline,
  includedCommits,
  leftOutCount,
} from "@/lib/curation";
import { t } from "@/lib/i18n";

export function rangeLabel(input: {
  owner: string;
  repo: string;
  branch: string;
  rangeType: string;
  baseRef?: string | null;
  headRef?: string | null;
  lastN?: number | null;
}): string {
  const repoAt = `${input.owner}/${input.repo}@${input.branch}`;
  if (input.rangeType === "lastN") {
    return `${repoAt} · last ${input.lastN ?? 50}`;
  }
  return `${repoAt} · ${input.baseRef || "?"}..${input.headRef || input.branch}`;
}

export function normalizeSection(items: unknown): BriefSectionGroup[] {
  if (!Array.isArray(items)) return [];
  const groups: BriefSectionGroup[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      const text = item.trim();
      if (text) groups.push({ title: null, bullets: [text] });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const rec = item as { title?: unknown; bullets?: unknown; description?: unknown };
    const title = typeof rec.title === "string" && rec.title.trim() ? rec.title.trim() : null;
    let bullets: string[] = [];
    if (Array.isArray(rec.bullets)) {
      bullets = rec.bullets
        .filter((bullet): bullet is string => typeof bullet === "string")
        .map((bullet) => bullet.trim())
        .filter(Boolean);
    } else if (typeof rec.description === "string" && rec.description.trim()) {
      bullets = [rec.description.trim()];
    }
    if (bullets.length) groups.push({ title, bullets });
  }
  return groups;
}

export function bulletCount(groups: BriefSectionGroup[]): number {
  return groups.reduce((count, group) => count + group.bullets.length, 0);
}

export function normalizeBrief(brief: BriefDocument): BriefDocument {
  return {
    ...brief,
    sections: {
      improvements: normalizeSection(brief.sections?.improvements),
      bugFixes: normalizeSection(brief.sections?.bugFixes),
      other: normalizeSection(brief.sections?.other),
    },
    usedLlm: Boolean(brief.usedLlm),
    llmFallback: brief.usedLlm ? undefined : brief.llmFallback,
  };
}

function categorizeGroup(commits: CommitRecord[]): BriefSectionKey {
  const counts: Record<BriefSectionKey, number> = {
    improvements: 0,
    bugFixes: 0,
    other: 0,
  };
  for (const commit of commits) counts[categorizeCommit(commit)] += 1;
  if (counts.improvements >= counts.bugFixes && counts.improvements >= counts.other) {
    return "improvements";
  }
  if (counts.bugFixes >= counts.other) return "bugFixes";
  return "other";
}

function heuristicSummary(
  locale: Locale,
  title: string,
  included: CommitRecord[],
  sections: Record<BriefSectionKey, BriefSectionGroup[]>,
): string {
  const authors = [...new Set(included.map((commit) => commit.authorName))];
  const authorText =
    authors.length <= 3 ? authors.join(", ") : `${authors.slice(0, 3).join(", ")} +${authors.length - 3}`;
  const improvements = bulletCount(sections.improvements);
  const bugFixes = bulletCount(sections.bugFixes);
  if (locale === "tr") {
    return [
      `${title} aralığı ${included.length} commit’ten süzüldü.`,
      `${improvements} geliştirme ve ${bugFixes} hata düzeltmesi öne çıkıyor.`,
      `Katkı: ${authorText}. Ham mesajlar ekte; gövde sonuç dilindedir.`,
    ].join(" ");
  }
  return [
    `${title} covers ${included.length} curated commits.`,
    `The notes highlight ${improvements} improvements and ${bugFixes} bug fixes.`,
    `Authors: ${authorText}. Source messages remain in the appendix; the body is outcomes, not a dump.`,
  ].join(" ");
}

export function heuristicBrief(opts: {
  title: string;
  locale: Locale;
  commits: CommitRecord[];
  curation: CurationState;
  stats: RangeStats;
  llmFallback?: LlmFallbackReason;
}): BriefDocument {
  const included = includedCommits(opts.commits, opts.curation);
  const sections: Record<BriefSectionKey, BriefSectionGroup[]> = {
    improvements: [],
    bugFixes: [],
    other: [],
  };
  const used = new Set<string>();
  for (const group of opts.curation.groups) {
    const groupCommits = included.filter((commit) => group.shas.includes(commit.sha));
    if (groupCommits.length === 0) continue;
    const category = categorizeGroup(groupCommits);
    const bullets = groupCommits.map((commit) => humanizeHeadline(commit.message));
    sections[category].push({ title: group.title, bullets });
    for (const commit of groupCommits) used.add(commit.sha);
  }
  for (const commit of included) {
    if (used.has(commit.sha)) continue;
    sections[categorizeCommit(commit)].push({
      title: null,
      bullets: [humanizeHeadline(commit.message)],
    });
  }
  const authors = [...new Set(included.map((commit) => commit.authorName))];
  return {
    title: opts.title,
    summary: heuristicSummary(opts.locale, opts.title, included, sections),
    locale: opts.locale,
    sections,
    stats: {
      commitCount: included.length,
      authors,
      additions: opts.stats.additions,
      deletions: opts.stats.deletions,
      leftOut: leftOutCount(opts.commits, opts.curation),
    },
    appendix: included.map((commit) => ({
      sha: commit.shortSha,
      message: (commit.message.split("\n")[0] ?? commit.message).trim(),
    })),
    generatedAt: new Date().toISOString(),
    usedLlm: false,
    llmFallback: opts.llmFallback ?? "no_key",
  };
}

export function sectionHeading(locale: Locale, key: BriefSectionKey): string {
  if (key === "improvements") return t(locale, "section.improvements");
  if (key === "bugFixes") return t(locale, "section.bugFixes");
  return t(locale, "section.other");
}

export function footnote(brief: BriefDocument): string {
  const authors =
    brief.stats.authors.length <= 4
      ? brief.stats.authors.join(", ")
      : `${brief.stats.authors.slice(0, 3).join(", ")} +${brief.stats.authors.length - 3}`;
  return t(brief.locale, "brief.footnote", {
    commits: brief.stats.commitCount,
    authors,
    plus: `+${brief.stats.additions}`,
    minus: `−${brief.stats.deletions}`,
    left: brief.stats.leftOut,
  });
}

export function llmFallbackMessageKey(reason?: LlmFallbackReason): string {
  return reason === "llm_error" ? "brief.llmError" : "brief.llmMissing";
}
