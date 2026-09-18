import type {
  BriefSectionKey,
  CommitRecord,
  CurationState,
  GroupSuggestion,
} from "@/types/brief";

const NOISE_PREFIX =
  /^(chore|ci|build)(\([^)]+\))?!?:\s*/i;
const MERGE_LINE = /^(merge\b|merge pull request\b)/i;
const DEP_NOISE =
  /dependabot|yarn\.lock|package-lock\.json|pnpm-lock\.yaml|bump .+ from \d/i;

export function headlineOf(message: string): string {
  return (message.split("\n")[0] ?? message).trim();
}

export function isNoiseCommit(commit: CommitRecord): boolean {
  const headline = headlineOf(commit.message);
  if ((commit.parents?.length ?? 0) > 1) return true;
  if (MERGE_LINE.test(headline)) return true;
  if (NOISE_PREFIX.test(headline)) return true;
  if (DEP_NOISE.test(headline)) return true;
  return false;
}

export function recommendedSelection(commits: CommitRecord[]): Record<string, boolean> {
  const selected: Record<string, boolean> = {};
  for (const commit of commits) {
    selected[commit.sha] = !isNoiseCommit(commit);
  }
  return selected;
}

export function emptyCuration(commits: CommitRecord[]): CurationState {
  return {
    selected: recommendedSelection(commits),
    groups: [],
  };
}

export function humanizeHeadline(message: string): string {
  const first = headlineOf(message);
  const stripped = first.replace(
    /^(feat|fix|docs|style|refactor|perf|test|chore|build|ci|revert)(\([^)]+\))?!?:\s*/i,
    "",
  );
  const value = (stripped || first).trim();
  if (!value) return first;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function conventionalType(message: string): string | null {
  const match = headlineOf(message).match(
    /^(feat|fix|docs|style|refactor|perf|test|chore|build|ci|revert)(\([^)]+\))?!?:/i,
  );
  return match?.[1]?.toLowerCase() ?? null;
}

export function conventionalScope(message: string): string | null {
  const match = headlineOf(message).match(/^[a-z]+(?:\(([^)]+)\))?!?:/i);
  const scope = match?.[1]?.trim();
  return scope ? scope.toLowerCase() : null;
}

export function categorizeCommit(commit: CommitRecord): BriefSectionKey {
  const type = conventionalType(commit.message);
  const headline = headlineOf(commit.message).toLowerCase();
  if (type === "feat" || type === "perf") return "improvements";
  if (type === "fix") return "bugFixes";
  if (type === "test" || type === "docs" || type === "refactor" || type === "style") {
    return "other";
  }
  if (/\b(add|improve|enhance|introduce)\b/i.test(headline)) return "improvements";
  if (/\b(fix|bug|hotfix|patch|resolve)\b/i.test(headline)) return "bugFixes";
  return "other";
}

export function includedCommits(commits: CommitRecord[], curation: CurationState): CommitRecord[] {
  return commits.filter((commit) => curation.selected[commit.sha]);
}

export function leftOutCount(commits: CommitRecord[], curation: CurationState): number {
  return commits.reduce((count, commit) => (curation.selected[commit.sha] ? count : count + 1), 0);
}

export function heuristicGroupSuggestions(commits: CommitRecord[]): GroupSuggestion[] {
  const byScope = new Map<string, string[]>();
  for (const commit of commits) {
    const scope = conventionalScope(commit.message);
    if (!scope) continue;
    const list = byScope.get(scope) ?? [];
    list.push(commit.sha);
    byScope.set(scope, list);
  }
  const suggestions: GroupSuggestion[] = [];
  for (const [scope, shas] of byScope) {
    if (shas.length < 2) continue;
    suggestions.push({
      id: `scope-${scope}`,
      title: scope.charAt(0).toUpperCase() + scope.slice(1),
      shas,
      rationale: `conventional scope (${scope})`,
    });
  }
  return suggestions.slice(0, 8);
}

export function applySuggestion(
  curation: CurationState,
  suggestion: GroupSuggestion,
): CurationState {
  const remaining = curation.groups
    .map((group) => ({
      ...group,
      shas: group.shas.filter((sha) => !suggestion.shas.includes(sha)),
    }))
    .filter((group) => group.shas.length > 0);
  return {
    ...curation,
    groups: [
      ...remaining,
      {
        id: suggestion.id,
        title: suggestion.title,
        shas: [...suggestion.shas],
        collapsed: true,
      },
    ],
  };
}

export function mergeShasIntoGroup(
  curation: CurationState,
  shas: string[],
  title: string,
): CurationState {
  if (shas.length === 0) return curation;
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `group-${Date.now()}`;
  const remaining = curation.groups
    .map((group) => ({
      ...group,
      shas: group.shas.filter((sha) => !shas.includes(sha)),
    }))
    .filter((group) => group.shas.length > 0);
  return {
    ...curation,
    groups: [
      ...remaining,
      { id, title, shas: [...shas], collapsed: true },
    ],
  };
}

export function ungroupShas(curation: CurationState, shas: string[]): CurationState {
  return {
    ...curation,
    groups: curation.groups
      .map((group) => ({
        ...group,
        shas: group.shas.filter((sha) => !shas.includes(sha)),
      }))
      .filter((group) => group.shas.length > 0),
  };
}

export function setSelected(
  curation: CurationState,
  shas: string[],
  selected: boolean,
): CurationState {
  const next = { ...curation.selected };
  for (const sha of shas) next[sha] = selected;
  return { ...curation, selected: next };
}

export function groupedShaSet(curation: CurationState): Set<string> {
  const set = new Set<string>();
  for (const group of curation.groups) {
    for (const sha of group.shas) set.add(sha);
  }
  return set;
}

export const PAGE_SIZE = 80;
