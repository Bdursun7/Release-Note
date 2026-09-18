import { NextResponse } from "next/server";
import { currentUser, jsonError } from "@/lib/api";
import { listRepos } from "@/lib/github";

export async function GET() {
  const { session, githubAccessToken } = await currentUser();
  if (!session?.userId) return jsonError("Unauthorized", 401);
  try {
    const repos = await listRepos({
      token: githubAccessToken,
      isDemo: Boolean(session.isDemo),
    });
    return NextResponse.json({ repos });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "GitHub request failed", 502);
  }
}
