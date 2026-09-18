import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, jsonError, ownedDraft } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  branch: z.string().optional(),
  rangeType: z.enum(["refs", "lastN"]).optional(),
  baseRef: z.string().nullable().optional(),
  headRef: z.string().nullable().optional(),
  lastN: z.number().int().min(1).max(500).optional(),
  uiLocale: z.enum(["en", "tr"]).optional(),
  briefLocale: z.enum(["en", "tr"]).optional(),
  status: z.enum(["range", "curating", "generated"]).optional(),
  curationJson: z.unknown().optional(),
  suggestionsJson: z.unknown().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await currentUser();
  if (!userId) return jsonError("Unauthorized", 401);
  const { id } = await context.params;
  const draft = await ownedDraft(id, userId);
  if (!draft) return jsonError("Not found", 404);
  return NextResponse.json({ draft });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await currentUser();
  if (!userId) return jsonError("Unauthorized", 401);
  const { id } = await context.params;
  const draft = await ownedDraft(id, userId);
  if (!draft) return jsonError("Not found", 404);
  const body = patchSchema.safeParse(await request.json());
  if (!body.success) return jsonError("Invalid payload");
  const data = body.data;
  const updated = await prisma.draft.update({
    where: { id: draft.id },
    data: {
      ...(data.branch !== undefined ? { branch: data.branch } : {}),
      ...(data.rangeType !== undefined ? { rangeType: data.rangeType } : {}),
      ...(data.baseRef !== undefined ? { baseRef: data.baseRef } : {}),
      ...(data.headRef !== undefined ? { headRef: data.headRef } : {}),
      ...(data.lastN !== undefined ? { lastN: data.lastN } : {}),
      ...(data.uiLocale !== undefined ? { uiLocale: data.uiLocale } : {}),
      ...(data.briefLocale !== undefined ? { briefLocale: data.briefLocale } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.curationJson !== undefined ? { curationJson: data.curationJson as object } : {}),
      ...(data.suggestionsJson !== undefined
        ? { suggestionsJson: data.suggestionsJson as object }
        : {}),
    },
  });
  return NextResponse.json({ draft: updated });
}
