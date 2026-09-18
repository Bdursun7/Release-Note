import { NextResponse } from "next/server";
import { currentUser, jsonError, ownedDraft } from "@/lib/api";
import { includedCommits } from "@/lib/curation";
import { suggestGroups } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import type { CommitRecord, CurationState } from "@/types/brief";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await currentUser();
  if (!userId) return jsonError("Unauthorized", 401);
  const { id } = await context.params;
  const draft = await ownedDraft(id, userId);
  if (!draft) return jsonError("Not found", 404);
  const commits = (draft.commitsJson as CommitRecord[] | null) ?? [];
  const curation = (draft.curationJson as CurationState | null) ?? {
    selected: {},
    groups: [],
  };
  const body = await request.json().catch(() => ({}));
  const byok = typeof body.byok === "string" ? body.byok : null;
  const selected = includedCommits(commits, curation);
  const result = await suggestGroups({ commits: selected, byok });
  await prisma.draft.update({
    where: { id: draft.id },
    data: { suggestionsJson: result.suggestions },
  });
  return NextResponse.json(result);
}
