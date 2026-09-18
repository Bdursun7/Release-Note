import type {
  BriefDocument,
  BriefSectionKey,
  CommitRecord,
  CurationState,
  GroupSuggestion,
  Locale,
  RangeStats,
} from "@/types/brief";
import {
  categorizeCommit,
  conventionalScope,
  heuristicGroupSuggestions,
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

function llmConfig(byok?: string | null) {
  const apiKey = byok?.trim() || process.env.OPENAI_API_KEY || "";
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  return { apiKey, baseUrl, model };
}

export function hasLlm(byok?: string | null): boolean {
  return Boolean(llmConfig(byok).apiKey);
}

async function completeJson(opts: {
  byok?: string | null;
  system: string;
  user: string;
}): Promise<unknown> {
  const { apiKey, baseUrl, model } = llmConfig(opts.byok);
  if (!apiKey) throw new Error("No LLM key");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM error ${response.status}: ${text.slice(0, 200)}`);
  }
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");
  return JSON.parse(content);
}

export async function suggestGroups(opts: {
  commits: CommitRecord[];
  byok?: string | null;
}): Promise<{ suggestions: GroupSuggestion[]; usedLlm: boolean }> {
  const payload = opts.commits.map((commit) => ({
    sha: commit.shortSha,
    full: commit.sha,
    headline: commit.headline,
    scope: conventionalScope(commit.message),
  }));
  if (!hasLlm(opts.byok)) {
    return { suggestions: heuristicGroupSuggestions(opts.commits), usedLlm: false };
  }
  try {
    const json = (await completeJson({
      byok: opts.byok,
      system:
        "You group git commits for an internal ship brief. Return JSON {suggestions:[{id,title,shas,rationale}]}. Groups are thematic outcomes, 2-8 groups, each with 2+ shas from the provided full SHAs. Do not invent SHAs. Titles in the same language as most headlines if mixed, else English. No chore/merge groups.",
      user: JSON.stringify(payload),
    })) as { suggestions?: GroupSuggestion[] };
    const allowed = new Set(opts.commits.map((commit) => commit.sha));
    const suggestions = (json.suggestions ?? [])
      .map((suggestion, index) => ({
        id: suggestion.id || `llm-${index}`,
        title: suggestion.title,
        rationale: suggestion.rationale,
        shas: (suggestion.shas || []).map((sha) => {
          if (allowed.has(sha)) return sha;
          const match = opts.commits.find(
            (commit) => commit.sha.startsWith(sha) || commit.shortSha === sha,
          );
          return match?.sha;
        }).filter((sha): sha is string => Boolean(sha)),
      }))
      .filter((suggestion) => suggestion.shas.length >= 2 && suggestion.title);
    return {
      suggestions: suggestions.slice(0, 8),
      usedLlm: true,
    };
  } catch {
    return { suggestions: heuristicGroupSuggestions(opts.commits), usedLlm: false };
  }
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
    const item =
      opts.locale === "tr"
        ? `${group.title}: ${outcomes.join("; ")}`
        : `${group.title}: ${outcomes.join("; ")}`;
    sections[category].push(item);
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
      message: headlineOfSafe(commit.message),
    })),
    generatedAt: new Date().toISOString(),
    usedLlm: false,
  };
}

function headlineOfSafe(message: string): string {
  return (message.split("\n")[0] ?? message).trim();
}

export async function generateBrief(opts: {
  title: string;
  locale: Locale;
  commits: CommitRecord[];
  curation: CurationState;
  stats: RangeStats;
  byok?: string | null;
}): Promise<BriefDocument> {
  const fallback = heuristicBrief(opts);
  if (!hasLlm(opts.byok)) return fallback;
  const included = includedCommits(opts.commits, opts.curation);
  const groups = opts.curation.groups.map((group) => ({
    title: group.title,
    headlines: included
      .filter((commit) => group.shas.includes(commit.sha))
      .map((commit) => commit.headline),
  }));
  try {
    const json = (await completeJson({
      byok: opts.byok,
      system: `You write an internal ship brief (not a changelog dump, not a LinkedIn post). Language: ${opts.locale === "tr" ? "Turkish" : "English"}. Return JSON {summary, improvements, bugFixes, other}. summary: 2-4 sentences. Each section is an array of human-readable outcome bullets (what shipped / what is now true), not raw commit messages. Omit empty meaning — use [] and the UI will hide the heading. Keep proper nouns and APIs from the source. Do not translate code identifiers. Do not mention SHAs in the body.`,
      user: JSON.stringify({
        title: opts.title,
        groups,
        commits: included.map((commit) => ({
          headline: commit.headline,
          author: commit.authorName,
        })),
      }),
    })) as {
      summary?: string;
      improvements?: string[];
      bugFixes?: string[];
      other?: string[];
    };
    return {
      ...fallback,
      summary: json.summary?.trim() || fallback.summary,
      sections: {
        improvements: Array.isArray(json.improvements) ? json.improvements.filter(Boolean) : fallback.sections.improvements,
        bugFixes: Array.isArray(json.bugFixes) ? json.bugFixes.filter(Boolean) : fallback.sections.bugFixes,
        other: Array.isArray(json.other) ? json.other.filter(Boolean) : fallback.sections.other,
      },
      usedLlm: true,
    };
  } catch {
    return fallback;
  }
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
