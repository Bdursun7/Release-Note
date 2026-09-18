import { NextResponse } from "next/server";
import { currentUser, jsonError, ownedDraft } from "@/lib/api";
import { includedCommits } from "@/lib/curation";
import { hasLlm, suggestGroups } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import { clientIp, consumeDemoLlmLimit } from "@/lib/rate-limit";
import type { CommitRecord, CurationState } from "@/types/brief";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { session, userId } = await currentUser();
  if (!userId || !session) return jsonError("Unauthorized", 401);
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
  const allowEnvKey = !session.isDemo;
  if (session.isDemo && hasLlm(byok, allowEnvKey)) {
    if (!consumeDemoLlmLimit({ userId, ip: clientIp(request) })) {
      return jsonError("Too many LLM requests from the sample workspace.", 429);
    }
  }
  const selected = includedCommits(commits, curation);
  const result = await suggestGroups({ commits: selected, byok, allowEnvKey });
  await prisma.draft.update({
    where: { id: draft.id },
    data: { suggestionsJson: result.suggestions },
  });
  return NextResponse.json(result);
}
