import type {
  BriefBlock,
  BriefDocument,
  BriefSectionKey,
  CommitRecord,
  CurationState,
  LlmFallbackReason,
  Locale,
  RangeStats,
} from "@/types/brief";
import {
  categorizeCommit,
  groupedShaSet,
  humanizeHeadline,
  includedCommits,
  leftOutCount,
} from "@/lib/curation";
import { t } from "@/lib/i18n";

export const SECTION_ORDER: BriefSectionKey[] = ["improvements", "bugFixes", "other"];

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
  return `${repoAt} · ${input.baseRef || "?"}...${input.headRef || input.branch}`;
}

export function emptySections(): Record<BriefSectionKey, BriefBlock[]> {
  return { improvements: [], bugFixes: [], other: [] };
}

export function sectionBlocks(
  sections: Record<BriefSectionKey, unknown> | undefined,
  key: BriefSectionKey,
): BriefBlock[] {
  return normalizeBlocks(sections?.[key]);
}

export function normalizeBlocks(raw: unknown): BriefBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: BriefBlock[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      const text = entry.trim();
      if (text) out.push({ type: "item", text });
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const title = typeof rec.title === "string" ? rec.title.trim() : "";
    const nested = Array.isArray(rec.items)
      ? rec.items
      : Array.isArray(rec.bullets)
        ? rec.bullets
        : null;
    if (rec.type === "group" || (title && nested)) {
      const items = (nested ?? [])
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
      if (title && items.length) out.push({ type: "group", title, items });
      else if (title) out.push({ type: "item", text: title });
      else items.forEach((text) => out.push({ type: "item", text }));
      continue;
    }
    if (typeof rec.text === "string" && rec.text.trim()) {
      out.push({ type: "item", text: rec.text.trim() });
    }
  }
  return out;
}

export function flattenBlocks(blocks: BriefBlock[]): string[] {
  const out: string[] = [];
  for (const block of blocks) {
    if (block.type === "item") out.push(block.text);
    else {
      out.push(block.title);
      out.push(...block.items);
    }
  }
  return out;
}

export function countBlocks(blocks: BriefBlock[]): number {
  return blocks.length;
}

function fingerprint(text: string): string {
  return text
    .toLowerCase()
    .replace(
      /^(feat|fix|docs|style|refactor|perf|test|chore|build|ci|revert)(\([^)]+\))?!?:\s*/i,
      "",
    )
    .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, " ")
    .trim();
}

function commitFingerprints(commit: CommitRecord): string[] {
  const prints = [fingerprint(commit.headline), fingerprint(humanizeHeadline(commit.message))];
  return [...new Set(prints.filter((print) => print.length > 0))];
}

function majorityCategory(commits: CommitRecord[]): BriefSectionKey {
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

export function buildHeuristicSections(
  commits: CommitRecord[],
  curation: CurationState,
): Record<BriefSectionKey, BriefBlock[]> {
  const included = includedCommits(commits, curation);
  const sections = emptySections();
  const used = new Set<string>();
  for (const group of curation.groups) {
    const groupCommits = included.filter((commit) => group.shas.includes(commit.sha));
    if (groupCommits.length === 0) continue;
    const items = groupCommits.map((commit) => humanizeHeadline(commit.message));
    sections[majorityCategory(groupCommits)].push({
      type: "group",
      title: group.title,
      items,
    });
    for (const commit of groupCommits) used.add(commit.sha);
  }
  for (const commit of included) {
    if (used.has(commit.sha)) continue;
    sections[categorizeCommit(commit)].push({
      type: "item",
      text: humanizeHeadline(commit.message),
    });
  }
  return sections;
}

function groupedFingerprints(commits: CommitRecord[], curation: CurationState): Set<string> {
  const grouped = groupedShaSet(curation);
  const prints = new Set<string>();
  for (const commit of includedCommits(commits, curation)) {
    if (!grouped.has(commit.sha)) continue;
    for (const print of commitFingerprints(commit)) prints.add(print);
  }
  return prints;
}

function isGroupedRawHeadline(text: string, groupedPrints: Set<string>): boolean {
  const print = fingerprint(text);
  if (!print) return false;
  if (groupedPrints.has(print)) return true;
  for (const grouped of groupedPrints) {
    if (grouped.length < 8) continue;
    if (print === grouped) return true;
  }
  return false;
}

function coversGroupedHeadline(text: string, groupedPrints: Set<string>): boolean {
  const print = fingerprint(text);
  if (!print) return false;
  for (const grouped of groupedPrints) {
    if (grouped.length < 8) continue;
    if (print === grouped || print.includes(grouped) || grouped.includes(print)) return true;
  }
  return false;
}

function stripRawGrouped(
  blocks: BriefBlock[],
  groupedPrints: Set<string>,
): BriefBlock[] {
  const out: BriefBlock[] = [];
  for (const block of blocks) {
    if (block.type === "item") {
      if (!isGroupedRawHeadline(block.text, groupedPrints)) out.push(block);
      continue;
    }
    const items = block.items.map((item) => item.trim()).filter(Boolean);
    // Group children may be humanized headlines; they are nested, not flat peers.
    if (block.title.trim() && items.length) {
      out.push({ type: "group", title: block.title.trim(), items });
    }
  }
  return out;
}

function hasGroupBlocks(sections: Record<BriefSectionKey, BriefBlock[]>): boolean {
  return SECTION_ORDER.some((key) => sections[key].some((block) => block.type === "group"));
}

function groupTitles(sections: Record<BriefSectionKey, BriefBlock[]>): Set<string> {
  const titles = new Set<string>();
  for (const key of SECTION_ORDER) {
    for (const block of sections[key]) {
      if (block.type === "group") titles.add(fingerprint(block.title));
    }
  }
  return titles;
}

function similarTitle(a: string, b: string): boolean {
  const left = fingerprint(a);
  const right = fingerprint(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function dedupeSections(
  sections: Record<BriefSectionKey, BriefBlock[]>,
): Record<BriefSectionKey, BriefBlock[]> {
  const seen = new Set<string>();
  const next = emptySections();
  for (const key of SECTION_ORDER) {
    for (const block of sections[key]) {
      if (block.type === "item") {
        const print = fingerprint(block.text);
        if (!print || seen.has(print)) continue;
        seen.add(print);
        next[key].push(block);
        continue;
      }
      const titlePrint = fingerprint(block.title);
      if (titlePrint && seen.has(`group:${titlePrint}`)) continue;
      if (titlePrint) seen.add(`group:${titlePrint}`);
      const items: string[] = [];
      for (const item of block.items) {
        const print = fingerprint(item);
        if (!print || seen.has(print)) continue;
        seen.add(print);
        items.push(item);
      }
      if (items.length) next[key].push({ type: "group", title: block.title, items });
    }
  }
  return next;
}

/**
 * Merge LLM bullets onto the heuristic skeleton.
 * Grouped commits never remain as flat raw headlines (typically dumped into Other).
 */
export function finalizeSections(opts: {
  llm?: {
    improvements?: unknown;
    bugFixes?: unknown;
    other?: unknown;
  } | null;
  commits: CommitRecord[];
  curation: CurationState;
}): Record<BriefSectionKey, BriefBlock[]> {
  const heuristic = buildHeuristicSections(opts.commits, opts.curation);
  if (!opts.llm) return heuristic;

  const llmSections: Record<BriefSectionKey, BriefBlock[]> = {
    improvements: normalizeBlocks(opts.llm.improvements),
    bugFixes: normalizeBlocks(opts.llm.bugFixes),
    other: normalizeBlocks(opts.llm.other),
  };
  const groupedPrints = groupedFingerprints(opts.commits, opts.curation);
  const cleaned: Record<BriefSectionKey, BriefBlock[]> = {
    improvements: stripRawGrouped(llmSections.improvements, groupedPrints),
    bugFixes: stripRawGrouped(llmSections.bugFixes, groupedPrints),
    other: stripRawGrouped(llmSections.other, groupedPrints),
  };

  if (!hasGroupBlocks(cleaned) && hasGroupBlocks(heuristic)) {
    const merged = emptySections();
    for (const key of SECTION_ORDER) {
      for (const block of heuristic[key]) {
        if (block.type === "group") merged[key].push(block);
      }
      for (const block of cleaned[key]) {
        if (block.type !== "item") continue;
        if (coversGroupedHeadline(block.text, groupedPrints)) continue;
        merged[key].push(block);
      }
    }
    return dedupeSections(merged);
  }

  const present = groupTitles(cleaned);
  for (const key of SECTION_ORDER) {
    for (const block of heuristic[key]) {
      if (block.type !== "group") continue;
      const already = [...present].some((title) => similarTitle(title, block.title));
      if (!already) {
        cleaned[key].unshift(block);
        present.add(fingerprint(block.title));
      }
    }
  }
  return dedupeSections(cleaned);
}

function heuristicSummary(
  locale: Locale,
  title: string,
  included: CommitRecord[],
  sections: Record<BriefSectionKey, BriefBlock[]>,
): string {
  const authors = [...new Set(included.map((commit) => commit.authorName))];
  const authorText =
    authors.length <= 3 ? authors.join(", ") : `${authors.slice(0, 3).join(", ")} +${authors.length - 3}`;
  if (locale === "tr") {
    return [
      `${title} aralığı ${included.length} commit’ten süzüldü.`,
      `${countBlocks(sections.improvements)} geliştirme ve ${countBlocks(sections.bugFixes)} hata düzeltmesi öne çıkıyor.`,
      `Katkı: ${authorText}. Ham mesajlar ekte; gövde sonuç dilindedir.`,
    ].join(" ");
  }
  return [
    `${title} covers ${included.length} curated commits.`,
    `The notes highlight ${countBlocks(sections.improvements)} improvements and ${countBlocks(sections.bugFixes)} bug fixes.`,
    `Authors: ${authorText}. Source messages remain in the appendix; the body is outcomes, not a dump.`,
  ].join(" ");
}

export function normalizeBrief(brief: BriefDocument): BriefDocument {
  return {
    ...brief,
    sections: {
      improvements: normalizeBlocks(brief.sections?.improvements),
      bugFixes: normalizeBlocks(brief.sections?.bugFixes),
      other: normalizeBlocks(brief.sections?.other),
    },
    usedLlm: Boolean(brief.usedLlm),
    llmFallback: brief.usedLlm ? undefined : brief.llmFallback,
  };
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
  const sections = finalizeSections({
    llm: null,
    commits: opts.commits,
    curation: opts.curation,
  });
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
