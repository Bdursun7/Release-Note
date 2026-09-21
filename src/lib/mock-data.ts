import type { CommitRecord, RepoSummary } from "@/types/brief";

export const DEMO_OWNER = "acme";
export const DEMO_REPO = "checkout-service";
export const DEMO_BRANCH = "main";

export const demoRepos: RepoSummary[] = [
  {
    id: "demo-checkout",
    owner: DEMO_OWNER,
    name: DEMO_REPO,
    fullName: `${DEMO_OWNER}/${DEMO_REPO}`,
    description: "Sample checkout service used for Ship Brief Builder demos",
    defaultBranch: DEMO_BRANCH,
    private: false,
    updatedAt: "2026-09-12T09:00:00.000Z",
    language: "TypeScript",
  },
];

function c(
  sha: string,
  message: string,
  authorName: string,
  authoredAt: string,
  parents: string[] = ["parent"],
): CommitRecord {
  const headline = message.split("\n")[0] ?? message;
  return {
    sha,
    shortSha: sha.slice(0, 7),
    message,
    headline,
    authorName,
    authorLogin: authorName.toLowerCase().replace(/\s+/g, ""),
    authoredAt,
    htmlUrl: `https://github.com/${DEMO_OWNER}/${DEMO_REPO}/commit/${sha}`,
    parents,
  };
}

/** Realistic mixed history: features, fixes, chores, merges, dependabot. Newest first. */
export const demoCommits: CommitRecord[] = [
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60001", "feat(checkout): retry card authorization on 409", "Ada Martin", "2026-09-12T08:40:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60002", "fix(checkout): keep coupon when payment sheet reopens", "Ada Martin", "2026-09-12T07:10:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60003", "feat(wallet): surface Apple Pay unavailability reason", "Kenji Sato", "2026-09-11T16:22:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60004", "Merge branch 'main' into release/2026-09", "Ada Martin", "2026-09-11T15:01:00.000Z", ["p1", "p2"]),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60005", "fix(tax): recompute VAT after shipping country change", "Lina Ortiz", "2026-09-11T14:12:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60006", "chore: ignore .turbo in git", "Kenji Sato", "2026-09-11T11:03:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60007", "feat(orders): show estimated arrival on confirmation", "Ada Martin", "2026-09-10T19:44:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60008", "fix(orders): prevent double submit on slow networks", "Lina Ortiz", "2026-09-10T18:02:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60009", "feat(checkout): remember last used shipping address", "Kenji Sato", "2026-09-10T12:30:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60010", "chore(deps): bump undici from 6.19.8 to 6.21.0", "dependabot[bot]", "2026-09-10T09:11:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60011", "fix(wallet): token refresh no longer drops billing zip", "Ada Martin", "2026-09-09T21:18:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60012", "feat(pricing): explain strike-through vs member price", "Lina Ortiz", "2026-09-09T17:40:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60013", "test(checkout): add authorization retry cases", "Kenji Sato", "2026-09-09T15:05:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60014", "fix(pricing): rounding on JPY member discounts", "Ada Martin", "2026-09-09T11:22:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60015", "docs: note new tax webhook in README", "Lina Ortiz", "2026-09-08T16:50:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60016", "feat(tax): persist tax snapshot on the order", "Kenji Sato", "2026-09-08T14:08:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60017", "Merge pull request #842 from acme/dependabot/npm_and_yarn/qs-6.14.0", "dependabot[bot]", "2026-09-08T10:00:00.000Z", ["p1", "p2"]),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60018", "feat(checkout): guest path no longer requires account banner", "Ada Martin", "2026-09-07T20:33:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60019", "fix(checkout): restore cart line after failed 3DS", "Lina Ortiz", "2026-09-07T18:41:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60020", "chore: format prisma schema", "Kenji Sato", "2026-09-07T09:12:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60021", "feat(orders): cancel reason shown to support tools", "Ada Martin", "2026-09-06T19:27:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60022", "fix(orders): inventory hold released when session expires", "Kenji Sato", "2026-09-06T16:55:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60023", "feat(wallet): Google Pay shipping updates flow through quote", "Lina Ortiz", "2026-09-06T12:14:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60024", "build: switch CI to frozen lockfile", "Kenji Sato", "2026-09-06T08:02:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60025", "fix(tax): handle missing region code as unspecified", "Ada Martin", "2026-09-05T21:09:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60026", "feat(checkout): delayed capture flag for high-risk orders", "Lina Ortiz", "2026-09-05T15:47:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60027", "refactor(pricing): extract member price calculator", "Kenji Sato", "2026-09-05T11:30:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60028", "fix(wallet): do not reuse expired payment method ids", "Ada Martin", "2026-09-04T22:18:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60029", "feat(orders): email includes pickup instructions", "Lina Ortiz", "2026-09-04T17:05:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60030", "chore(deps): bump eslint-config-next", "dependabot[bot]", "2026-09-04T09:40:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60031", "fix(checkout): keyboard submit no longer skips TOS", "Kenji Sato", "2026-09-03T19:12:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60032", "feat(pricing): bundle savings line on review step", "Ada Martin", "2026-09-03T14:28:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60033", "ci: cache playwright browsers", "Kenji Sato", "2026-09-03T08:50:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60034", "fix(orders): map 409 from warehouse into a retryable error", "Lina Ortiz", "2026-09-02T20:03:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60035", "feat(checkout): split digital and physical shipments in UI", "Ada Martin", "2026-09-02T16:41:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60036", "docs: add sequence diagram for delayed capture", "Kenji Sato", "2026-09-02T10:15:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60037", "fix(tax): inclusive price still shows net for B2B", "Lina Ortiz", "2026-09-01T18:37:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60038", "feat(wallet): store network token when issuer supports it", "Ada Martin", "2026-09-01T13:09:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60039", "Merge branch 'hotfix/tax-region' into main", "Ada Martin", "2026-09-01T11:00:00.000Z", ["p1", "p2"]),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60040", "chore: update yarn.lock", "Kenji Sato", "2026-08-31T16:22:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60041", "feat(orders): delayed jobs use idempotency keys", "Lina Ortiz", "2026-08-31T12:48:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60042", "fix(checkout): address autocomplete no longer overwrites unit", "Ada Martin", "2026-08-30T21:05:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60043", "perf(pricing): memoize catalog lookups on review", "Kenji Sato", "2026-08-30T15:33:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60044", "feat(tax): webhook retries with backoff", "Lina Ortiz", "2026-08-29T19:20:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60045", "fix(wallet): 3DS return URL includes locale", "Ada Martin", "2026-08-29T11:44:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60046", "chore(deps): bump qs from 6.13.0 to 6.14.0", "dependabot[bot]", "2026-08-28T08:18:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60047", "feat(checkout): accessibility name for pay button states", "Kenji Sato", "2026-08-27T17:55:00.000Z"),
  c("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60048", "fix(orders): timezone on pickup windows for TR locale", "Lina Ortiz", "2026-08-27T09:06:00.000Z"),
];

export const demoStats = {
  additions: 1840,
  deletions: 612,
  filesChanged: 47,
  truncated: false,
};

export const demoBranches = [
  { name: "main", protected: true },
  { name: "release/2026-09", protected: false },
];

export const demoTags = [{ name: "v1.4.0" }];

/** Named refs → index in `demoCommits` (newest-first). Used for fixture three-dot compares. */
export const demoRefIndex: Record<string, number> = {
  main: 0,
  HEAD: 0,
  "v1.4.0": 20,
  "release/2026-09": 3,
};

export function resolveDemoRefIndex(ref: string): number {
  const key = ref.trim();
  if (key in demoRefIndex) return demoRefIndex[key];
  const idx = demoCommits.findIndex(
    (commit) => commit.sha === key || commit.sha.startsWith(key) || commit.shortSha === key,
  );
  if (idx >= 0) return idx;
  throw new Error(`Unknown demo ref: ${ref}`);
}

function scaleDemoStats(count: number) {
  const ratio = demoCommits.length ? count / demoCommits.length : 0;
  return {
    additions: Math.round(demoStats.additions * ratio),
    deletions: Math.round(demoStats.deletions * ratio),
    filesChanged: count === 0 ? 0 : Math.max(1, Math.round(demoStats.filesChanged * ratio)),
    truncated: false,
  };
}

/** Linear-history stand-in for GitHub `base...head` (commits after base, up to head). */
export function loadFixtureRange(opts: {
  rangeType: "refs" | "lastN";
  baseRef?: string | null;
  headRef?: string | null;
  branch: string;
  lastN?: number | null;
}): { commits: typeof demoCommits; stats: typeof demoStats } {
  const head = opts.headRef?.trim() || opts.branch || "main";
  if (opts.rangeType === "lastN") {
    const n = Math.min(500, Math.max(1, opts.lastN ?? 50));
    const headIdx = resolveDemoRefIndex(head);
    const commits = demoCommits.slice(headIdx, headIdx + n);
    return { commits, stats: scaleDemoStats(commits.length) };
  }
  const base = opts.baseRef?.trim();
  if (!base) throw new Error("Base ref is required for base...head");
  const headIdx = resolveDemoRefIndex(head);
  const baseIdx = resolveDemoRefIndex(base);
  if (baseIdx <= headIdx) {
    return { commits: [], stats: scaleDemoStats(0) };
  }
  const commits = demoCommits.slice(headIdx, baseIdx);
  return { commits, stats: scaleDemoStats(commits.length) };
}
