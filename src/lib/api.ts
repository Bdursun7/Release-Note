import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function currentUser() {
  const session = await requireSession();
  if (!session?.userId) return { session: null, userId: null as string | null };
  return { session, userId: session.userId };
}

export async function ownedDraft(id: string, userId: string) {
  return prisma.draft.findFirst({ where: { id, userId } });
}
