import { NextResponse } from "next/server";
import { currentUser, jsonError } from "@/lib/api";
import { listBranches } from "@/lib/github";

export async function GET(request: Request) {
  const { session, githubAccessToken } = await currentUser();
  if (!session?.userId) return jsonError("Unauthorized", 401);
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  if (!owner || !repo) return jsonError("owner and repo required");
  try {
    const branches = await listBranches({
      token: githubAccessToken,
      isDemo: Boolean(session.isDemo),
      owner,
      repo,
    });
    return NextResponse.json({ branches });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "GitHub request failed", 502);
  }
}
