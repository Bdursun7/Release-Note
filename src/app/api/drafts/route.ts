import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  defaultBranch: z.string().min(1).default("main"),
  source: z.enum(["github", "demo"]).optional(),
});

export async function GET() {
  const { session, userId } = await currentUser();
  if (!userId || !session) return jsonError("Unauthorized", 401);
  const drafts = await prisma.draft.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  return NextResponse.json({ drafts });
}

export async function POST(request: Request) {
  const { session, userId } = await currentUser();
  if (!userId || !session) return jsonError("Unauthorized", 401);
  const body = createSchema.safeParse(await request.json());
  if (!body.success) return jsonError("Invalid payload");
  const source = body.data.source || (session.isDemo ? "demo" : "github");
  const draft = await prisma.draft.create({
    data: {
      userId,
      source,
      owner: body.data.owner,
      repo: body.data.repo,
      defaultBranch: body.data.defaultBranch,
      branch: body.data.defaultBranch,
      headRef: body.data.defaultBranch,
      baseRef: source === "demo" ? "v1.4.0" : null,
      rangeType: "lastN",
      lastN: 50,
      status: "range",
    },
  });
  return NextResponse.json({ draft });
}
