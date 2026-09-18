import { NextResponse } from "next/server";
import { currentUser, jsonError, ownedDraft } from "@/lib/api";
import { rangeLabel } from "@/lib/brief-format";
import { generateBrief, hasLlm } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import { clientIp, consumeDemoLlmLimit } from "@/lib/rate-limit";
import type {
  CommitRecord,
  CurationState,
  Locale,
  RangeStats,
} from "@/types/brief";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { session, userId } = await currentUser();
  if (!userId || !session) return jsonError("Unauthorized", 401);
  const { id } = await context.params;
  const draft = await ownedDraft(id, userId);
  if (!draft) return jsonError("Not found", 404);
  const body = await request.json().catch(() => ({}));
  const locale = (body.locale === "tr" || body.locale === "en" ? body.locale : draft.briefLocale) as Locale;
  const byok = typeof body.byok === "string" ? body.byok : null;
  const allowEnvKey = !session.isDemo;
  if (session.isDemo && hasLlm(byok, allowEnvKey)) {
    if (!consumeDemoLlmLimit({ userId, ip: clientIp(request) })) {
      return jsonError("Too many LLM requests from the sample workspace.", 429);
    }
  }
  const commits = (draft.commitsJson as CommitRecord[] | null) ?? [];
  const curation = (draft.curationJson as CurationState | null) ?? {
    selected: {},
    groups: [],
  };
  const stats = (draft.statsJson as RangeStats | null) ?? {
    additions: 0,
    deletions: 0,
    filesChanged: 0,
    truncated: false,
  };
  const title = rangeLabel({
    owner: draft.owner,
    repo: draft.repo,
    branch: draft.branch || draft.defaultBranch,
    rangeType: draft.rangeType,
    baseRef: draft.baseRef,
    headRef: draft.headRef,
    lastN: draft.lastN,
  });
  const brief = await generateBrief({
    title,
    locale,
    commits,
    curation,
    stats,
    byok,
    allowEnvKey,
  });
  const updated = await prisma.draft.update({
    where: { id: draft.id },
    data: {
      briefJson: brief,
      briefLocale: locale,
      status: "generated",
    },
  });
  return NextResponse.json({ draft: updated, brief });
}
