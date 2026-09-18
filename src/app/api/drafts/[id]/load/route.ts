import { NextResponse } from "next/server";
import { currentUser, jsonError, ownedDraft } from "@/lib/api";
import { loadCommitRange } from "@/lib/github";
import { emptyCuration } from "@/lib/curation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RangeType } from "@/types/brief";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { session, userId } = await currentUser();
  if (!userId || !session) return jsonError("Unauthorized", 401);
  const { id } = await context.params;
  const draft = await ownedDraft(id, userId);
  if (!draft) return jsonError("Not found", 404);
  if (!draft.branch) return jsonError("Branch required");
  try {
    const { commits, stats } = await loadCommitRange({
      token: session.accessToken,
      isDemo: Boolean(session.isDemo) || draft.source === "demo",
      owner: draft.owner,
      repo: draft.repo,
      branch: draft.branch,
      rangeType: draft.rangeType as RangeType,
      baseRef: draft.baseRef,
      headRef: draft.headRef,
      lastN: draft.lastN,
    });
    const curation = emptyCuration(commits);
    const updated = await prisma.draft.update({
      where: { id: draft.id },
      data: {
        commitsJson: commits,
        statsJson: stats,
        curationJson: curation,
        suggestionsJson: [],
        status: "curating",
        briefJson: Prisma.DbNull,
      },
    });
    return NextResponse.json({ draft: updated, commitCount: commits.length });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not load that commit range.", 502);
  }
}
