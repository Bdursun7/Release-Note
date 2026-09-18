import type {
  BriefDocument,
  BriefSectionKey,
  CommitRecord,
  CurationState,
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

function heuristicSummary(
  locale: Locale,
  title: string,
  included: CommitRecord[],
  sections: Record<BriefSectionKey, string[]>,
): string {
  const authors = [...new Set(included.map((commit) => commit.authorName))];
  const authorText =
    authors.length <= 3 ? authors.join(", ") : `${authors.slice(0, 3).join(", ")} +${authors.length - 3}`;
  if (locale === "tr") {
    return [
      `${title} aralığı ${included.length} commit’ten süzüldü.`,
      `${sections.improvements.length} geliştirme ve ${sections.bugFixes.length} hata düzeltmesi öne çıkıyor.`,
      `Katkı: ${authorText}. Ham mesajlar ekte; gövde sonuç dilindedir.`,
    ].join(" ");
  }
  return [
    `${title} covers ${included.length} curated commits.`,
    `The ship highlights ${sections.improvements.length} improvements and ${sections.bugFixes.length} bug fixes.`,
    `Authors: ${authorText}. Source messages remain in the appendix; the body is outcomes, not a dump.`,
  ].join(" ");
}

export function heuristicBrief(opts: {
  title: string;
  locale: Locale;
  commits: CommitRecord[];
  curation: CurationState;
  stats: RangeStats;
}): BriefDocument {
  const included = includedCommits(opts.commits, opts.curation);
  const sections: Record<BriefSectionKey, string[]> = {
    improvements: [],
    bugFixes: [],
    other: [],
  };
  const used = new Set<string>();
  for (const group of opts.curation.groups) {
    const groupCommits = included.filter((commit) => group.shas.includes(commit.sha));
    if (groupCommits.length === 0) continue;
    const category = categorizeCommit(groupCommits[0]);
    const outcomes = groupCommits.map((commit) => humanizeHeadline(commit.message));
    sections[category].push(`${group.title}: ${outcomes.join("; ")}`);
    for (const commit of groupCommits) used.add(commit.sha);
  }
  for (const commit of included) {
    if (used.has(commit.sha)) continue;
    sections[categorizeCommit(commit)].push(humanizeHeadline(commit.message));
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
