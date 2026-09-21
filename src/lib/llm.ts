import "server-only";

import type {
  BriefDocument,
  CommitRecord,
  CurationState,
  GroupSuggestion,
  Locale,
  RangeStats,
} from "@/types/brief";
import { conventionalScope, heuristicGroupSuggestions, includedCommits } from "@/lib/curation";
import { finalizeSections, heuristicBrief } from "@/lib/brief-format";

function llmConfig(byok?: string | null, allowEnvKey = true) {
  const apiKey = byok?.trim() || (allowEnvKey ? process.env.OPENAI_API_KEY || "" : "");
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  return { apiKey, baseUrl, model };
}

export function hasLlm(byok?: string | null, allowEnvKey = true): boolean {
  return Boolean(llmConfig(byok, allowEnvKey).apiKey);
}

async function completeJson(opts: {
  byok?: string | null;
  allowEnvKey?: boolean;
  system: string;
  user: string;
}): Promise<unknown> {
  const { apiKey, baseUrl, model } = llmConfig(opts.byok, opts.allowEnvKey !== false);
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
  allowEnvKey?: boolean;
}): Promise<{
  suggestions: GroupSuggestion[];
  usedLlm: boolean;
  llmFallback?: "no_key" | "llm_error";
}> {
  const payload = opts.commits.map((commit) => ({
    sha: commit.shortSha,
    full: commit.sha,
    headline: commit.headline,
    scope: conventionalScope(commit.message),
  }));
  if (!hasLlm(opts.byok, opts.allowEnvKey !== false)) {
    return {
      suggestions: heuristicGroupSuggestions(opts.commits),
      usedLlm: false,
      llmFallback: "no_key",
    };
  }
  try {
    const json = (await completeJson({
      byok: opts.byok,
      allowEnvKey: opts.allowEnvKey,
      system:
        "You group git commits for internal release notes. Return JSON {suggestions:[{id,title,shas,rationale}]}. Groups are thematic outcomes, 2-8 groups, each with 2+ shas from the provided full SHAs. Do not invent SHAs. Titles in the same language as most headlines if mixed, else English. No chore/merge groups.",
      user: JSON.stringify(payload),
    })) as { suggestions?: GroupSuggestion[] };
    const allowed = new Set(opts.commits.map((commit) => commit.sha));
    const suggestions = (json.suggestions ?? [])
      .map((suggestion, index) => ({
        id: suggestion.id || `llm-${index}`,
        title: suggestion.title,
        rationale: suggestion.rationale,
        shas: (suggestion.shas || [])
          .map((sha) => {
            if (allowed.has(sha)) return sha;
            const match = opts.commits.find(
              (commit) => commit.sha.startsWith(sha) || commit.shortSha === sha,
            );
            return match?.sha;
          })
          .filter((sha): sha is string => Boolean(sha)),
      }))
      .filter((suggestion) => suggestion.shas.length >= 2 && suggestion.title);
    return {
      suggestions: suggestions.slice(0, 8),
      usedLlm: true,
    };
  } catch {
    return {
      suggestions: heuristicGroupSuggestions(opts.commits),
      usedLlm: false,
      llmFallback: "llm_error",
    };
  }
}

export async function generateBrief(opts: {
  title: string;
  locale: Locale;
  commits: CommitRecord[];
  curation: CurationState;
  stats: RangeStats;
  byok?: string | null;
  allowEnvKey?: boolean;
}): Promise<BriefDocument> {
  if (!hasLlm(opts.byok, opts.allowEnvKey !== false)) {
    return heuristicBrief({ ...opts, llmFallback: "no_key" });
  }
  const fallback = heuristicBrief({ ...opts, llmFallback: "llm_error" });
  const included = includedCommits(opts.commits, opts.curation);
  const grouped = new Set(opts.curation.groups.flatMap((group) => group.shas));
  const groups = opts.curation.groups
    .map((group) => ({
      title: group.title,
      commits: included
        .filter((commit) => group.shas.includes(commit.sha))
        .map((commit) => commit.headline),
    }))
    .filter((group) => group.commits.length > 0);
  const ungrouped = included
    .filter((commit) => !grouped.has(commit.sha))
    .map((commit) => ({
      headline: commit.headline,
      author: commit.authorName,
    }));
  try {
    const json = (await completeJson({
      byok: opts.byok,
      allowEnvKey: opts.allowEnvKey,
      system: `You write internal release notes (not a changelog dump, not a LinkedIn post). Language: ${opts.locale === "tr" ? "Turkish" : "English"}.
Return JSON {summary, improvements, bugFixes, other}.
summary: 2-4 sentences.
Each section is an array. Entries are either:
- a standalone outcome string (ungrouped work only), or
- a group object {title, items} where items are 1-4 synthesized outcome bullets (what is now true).
Rules:
- Every provided group becomes exactly one {title, items} object under the best heading. Prefer group title + nested outcomes. Never also list those commits as sibling bullets.
- Do not repeat a group or commit under Other (or any second heading) if it is already covered.
- Never emit raw commit messages, conventional prefixes (feat:/fix:/chore:), or a grouped commit as a flat headline.
- Other is only leftover ungrouped work that is not an improvement or bug fix. Use [] when empty.
- Keep proper nouns and APIs. Do not translate code identifiers. Do not mention SHAs.`,
      user: JSON.stringify({
        title: opts.title,
        groups,
        ungrouped,
      }),
    })) as {
      summary?: string;
      improvements?: unknown;
      bugFixes?: unknown;
      other?: unknown;
    };
    return {
      ...fallback,
      summary: json.summary?.trim() || fallback.summary,
      sections: finalizeSections({
        llm: json,
        commits: opts.commits,
        curation: opts.curation,
      }),
      usedLlm: true,
      llmFallback: undefined,
    };
  } catch {
    return fallback;
  }
}
