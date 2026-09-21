import { Octokit } from "@octokit/rest";
import { demoBranches, demoRepos, loadFixtureRange } from "@/lib/mock-data";
import type {
  BranchSummary,
  CommitRecord,
  RangeStats,
  RepoSummary,
} from "@/types/brief";

const MAX_COMMITS = 500;

/** Classic OAuth: GitHub has no private read-only scope. Prefer a GitHub App (Contents: Read). */
export function githubOAuthScopes(): string {
  return process.env.GITHUB_SCOPE || "read:user public_repo";
}

export function githubConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.GITHUB_CLIENT_ID?.trim() && env.GITHUB_CLIENT_SECRET?.trim());
}

export type GithubIdentity = {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

/** Validate a classic or fine-grained PAT via GET /user. Does not persist the token. */
export async function validateGithubPat(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GithubIdentity | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const res = await fetchImpl("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${trimmed}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "ship-brief-builder",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    id?: unknown;
    login?: unknown;
    name?: unknown;
    email?: unknown;
    avatar_url?: unknown;
  };
  if (typeof data.id !== "number" || typeof data.login !== "string" || !data.login) {
    return null;
  }
  return {
    id: data.id,
    login: data.login,
    name: typeof data.name === "string" ? data.name : null,
    email: typeof data.email === "string" ? data.email : null,
    avatarUrl: typeof data.avatar_url === "string" ? data.avatar_url : null,
  };
}

export function mockForced(): boolean {
  return process.env.MOCK_GITHUB === "true";
}

function octokit(token: string) {
  return new Octokit({ auth: token, userAgent: "ship-brief-builder" });
}

function normalizeCommit(raw: {
  sha: string;
  html_url?: string;
  commit: {
    message: string;
    author?: { name?: string | null; date?: string | null } | null;
  };
  author?: { login?: string | null } | null;
  parents?: Array<{ sha: string }>;
}): CommitRecord {
  const message = raw.commit.message || "";
  return {
    sha: raw.sha,
    shortSha: raw.sha.slice(0, 7),
    message,
    headline: message.split("\n")[0] ?? message,
    authorName: raw.commit.author?.name || raw.author?.login || "unknown",
    authorLogin: raw.author?.login ?? null,
    authoredAt: raw.commit.author?.date || new Date().toISOString(),
    htmlUrl: raw.html_url || "",
    parents: (raw.parents ?? []).map((parent) => parent.sha),
  };
}

export async function listRepos(opts: {
  token?: string | null;
  isDemo: boolean;
}): Promise<RepoSummary[]> {
  if (opts.isDemo || mockForced()) return demoRepos;
  if (!opts.token) return [];
  const client = octokit(opts.token);
  const repos = await client.paginate(client.repos.listForAuthenticatedUser, {
    per_page: 100,
    sort: "updated",
    affiliation: "owner,collaborator,organization_member",
  });
  return repos.map((repo) => ({
    id: repo.id,
    owner: repo.owner.login,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    defaultBranch: repo.default_branch,
    private: repo.private,
    updatedAt: repo.updated_at,
    language: repo.language,
  }));
}

export async function listBranches(opts: {
  token?: string | null;
  isDemo: boolean;
  owner: string;
  repo: string;
}): Promise<BranchSummary[]> {
  if (opts.isDemo || mockForced()) return demoBranches;
  if (!opts.token) return [];
  const client = octokit(opts.token);
  const branches = await client.paginate(client.repos.listBranches, {
    owner: opts.owner,
    repo: opts.repo,
    per_page: 100,
  });
  return branches.map((branch) => ({
    name: branch.name,
    protected: Boolean(branch.protected),
  }));
}

export async function loadCommitRange(opts: {
  token?: string | null;
  isDemo: boolean;
  owner: string;
  repo: string;
  branch: string;
  rangeType: "refs" | "lastN";
  baseRef?: string | null;
  headRef?: string | null;
  lastN?: number | null;
}): Promise<{ commits: CommitRecord[]; stats: RangeStats }> {
  if (opts.isDemo || mockForced() || !opts.token) {
    return loadFixtureRange({
      rangeType: opts.rangeType,
      baseRef: opts.baseRef,
      headRef: opts.headRef,
      branch: opts.branch,
      lastN: opts.lastN,
    });
  }

  const client = octokit(opts.token);
  const head = opts.headRef || opts.branch;

  if (opts.rangeType === "lastN") {
    const n = Math.min(MAX_COMMITS, Math.max(1, opts.lastN ?? 50));
    const raw = await paginateCommits(client, opts.owner, opts.repo, head, n);
    const commits = raw.map(normalizeCommit);
    const stats = await statsForCommits(client, opts.owner, opts.repo, commits, head);
    return { commits, stats };
  }

  const base = opts.baseRef?.trim();
  if (!base) {
    throw new Error("Base ref is required for base...head");
  }

  try {
    const compared = await client.repos.compareCommitsWithBasehead({
      owner: opts.owner,
      repo: opts.repo,
      basehead: `${base}...${head}`,
      per_page: 100,
    });
    let commits = (compared.data.commits ?? []).map(normalizeCommit);
    if (commits.length >= 250 || compared.data.ahead_by > commits.length) {
      commits = (await paginateUntilBase(client, opts.owner, opts.repo, head, base, MAX_COMMITS)).map(
        normalizeCommit,
      );
    }
    if (commits.length > MAX_COMMITS) commits = commits.slice(0, MAX_COMMITS);
    const files = compared.data.files ?? [];
    const stats: RangeStats = {
      additions: files.reduce((sum, file) => sum + (file.additions ?? 0), 0),
      deletions: files.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
      filesChanged: compared.data.files?.length ?? files.length,
      truncated:
        commits.length >= MAX_COMMITS ||
        compared.data.ahead_by > (compared.data.commits?.length ?? 0),
    };
    return { commits: commits.reverse(), stats };
  } catch {
    const raw = await paginateUntilBase(client, opts.owner, opts.repo, head, base, MAX_COMMITS);
    const commits = raw.map(normalizeCommit);
    const stats = await statsForCommits(client, opts.owner, opts.repo, commits, head);
    return { commits, stats };
  }
}

async function paginateCommits(
  client: Octokit,
  owner: string,
  repo: string,
  sha: string,
  limit: number,
) {
  const acc: Awaited<ReturnType<typeof client.repos.listCommits>>["data"] = [];
  let page = 1;
  while (acc.length < limit) {
    const { data } = await client.repos.listCommits({
      owner,
      repo,
      sha,
      per_page: Math.min(100, limit - acc.length),
      page,
    });
    if (data.length === 0) break;
    acc.push(...data);
    if (data.length < 100) break;
    page += 1;
  }
  return acc.slice(0, limit);
}

async function paginateUntilBase(
  client: Octokit,
  owner: string,
  repo: string,
  head: string,
  base: string,
  limit: number,
) {
  const acc: Awaited<ReturnType<typeof client.repos.listCommits>>["data"] = [];
  let page = 1;
  const baseLower = base.toLowerCase();
  while (acc.length < limit) {
    const { data } = await client.repos.listCommits({
      owner,
      repo,
      sha: head,
      per_page: 100,
      page,
    });
    if (data.length === 0) break;
    for (const commit of data) {
      if (
        commit.sha.toLowerCase() === baseLower ||
        commit.sha.toLowerCase().startsWith(baseLower) ||
        commit.sha.toLowerCase().startsWith(baseLower.slice(0, 7))
      ) {
        return acc;
      }
      acc.push(commit);
      if (acc.length >= limit) return acc;
    }
    if (data.length < 100) break;
    page += 1;
  }
  return acc;
}

async function statsForCommits(
  client: Octokit,
  owner: string,
  repo: string,
  commits: CommitRecord[],
  head: string,
): Promise<RangeStats> {
  if (commits.length === 0) {
    return { additions: 0, deletions: 0, filesChanged: 0, truncated: false };
  }
  const oldest = commits[commits.length - 1];
  const base = oldest.parents[0] || oldest.sha;
  try {
    const compared = await client.repos.compareCommitsWithBasehead({
      owner,
      repo,
      basehead: `${base}...${head}`,
    });
    const files = compared.data.files ?? [];
    return {
      additions: files.reduce((sum, file) => sum + (file.additions ?? 0), 0),
      deletions: files.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
      filesChanged: files.length,
      truncated: (compared.data.ahead_by ?? 0) > (compared.data.commits?.length ?? 0),
    };
  } catch {
    return { additions: 0, deletions: 0, filesChanged: 0, truncated: true };
  }
}
