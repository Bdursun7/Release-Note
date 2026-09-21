/** Client-safe auth helpers (no Prisma, Next headers, or Octokit). */

export const GITHUB_PAT_DOCS_URL =
  "https://docs.github.com/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token";

export type ClientSessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export type ClientSession = {
  user?: ClientSessionUser;
  expires: string;
  userId?: string;
  isDemo?: boolean;
  githubLogin?: string;
  accessToken?: unknown;
  pat?: unknown;
};

export type JwtSlice = {
  userId?: unknown;
  isDemo?: unknown;
  githubLogin?: unknown;
  accessToken?: unknown;
  pat?: unknown;
};

export type GithubPatUser = {
  id: string;
  githubLogin?: string;
  pat?: string;
};

/** Copy a PAT onto the encrypted JWT only. Never leave it under `pat`. */
export function applyGithubPatToJwt<T extends JwtSlice>(token: T, user: GithubPatUser): T {
  const next: T = { ...token };
  next.userId = user.id;
  next.githubLogin = user.githubLogin;
  next.isDemo = false;
  if (typeof user.pat === "string" && user.pat) {
    next.accessToken = user.pat;
  }
  delete next.pat;
  return next;
}

/**
 * Public NextAuth session. The GitHub token stays on the JWT and is stripped
 * here so `/api/auth/session` never includes it.
 */
export function buildClientSession<S extends ClientSession>(session: S, token: JwtSlice): S {
  const githubLogin = typeof token.githubLogin === "string" ? token.githubLogin : undefined;
  const next: S = {
    ...session,
    userId: typeof token.userId === "string" ? token.userId : undefined,
    isDemo: Boolean(token.isDemo),
    githubLogin,
  };
  if (session.user) {
    next.user = {
      name: session.user.name || githubLogin || "User",
      email: session.user.email,
      image: session.user.image,
    };
  }
  delete next.accessToken;
  delete next.pat;
  return next;
}

/** True when NextAuth would send the browser to a broken GitHub authorize URL. */
export function githubOAuthRedirectIsBroken(url: string | null | undefined): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url, "http://localhost");
    if (parsed.searchParams.get("error")) return true;
    if (parsed.pathname.includes("/api/auth/error")) return true;
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "github.com" && parsed.pathname.includes("/login/oauth/authorize")) {
      return !parsed.searchParams.get("client_id")?.trim();
    }
    return false;
  } catch {
    return true;
  }
}
