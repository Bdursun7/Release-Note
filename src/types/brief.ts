export type Locale = "en" | "tr";

export type RangeType = "refs" | "lastN";

export type DraftStatus = "range" | "curating" | "generated";

export type CommitRecord = {
  sha: string;
  shortSha: string;
  message: string;
  headline: string;
  authorName: string;
  authorLogin: string | null;
  authoredAt: string;
  htmlUrl: string;
  parents: string[];
};

export type RangeStats = {
  additions: number;
  deletions: number;
  filesChanged: number;
  truncated: boolean;
};

export type CurationGroup = {
  id: string;
  title: string;
  shas: string[];
  collapsed: boolean;
};

export type CurationState = {
  selected: Record<string, boolean>;
  groups: CurationGroup[];
};

export type GroupSuggestion = {
  id: string;
  title: string;
  shas: string[];
  rationale?: string;
};

export type BriefSectionKey = "improvements" | "bugFixes" | "other";

/** Group title with nested outcomes, or a standalone ungrouped bullet. */
export type BriefBlock =
  | { type: "item"; text: string }
  | { type: "group"; title: string; items: string[] };

export type LlmFallbackReason = "no_key" | "llm_error";

export type BriefDocument = {
  title: string;
  summary: string;
  locale: Locale;
  sections: Record<BriefSectionKey, BriefBlock[]>;
  stats: {
    commitCount: number;
    authors: string[];
    additions: number;
    deletions: number;
    leftOut: number;
  };
  appendix: Array<{ sha: string; message: string }>;
  generatedAt: string;
  usedLlm: boolean;
  /** Present when usedLlm is false: missing key vs model/request failure. */
  llmFallback?: LlmFallbackReason;
};

export type RepoSummary = {
  id: number | string;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  private: boolean;
  updatedAt: string | null;
  language: string | null;
};

export type BranchSummary = {
  name: string;
  protected: boolean;
};

export type TagSummary = {
  name: string;
};
