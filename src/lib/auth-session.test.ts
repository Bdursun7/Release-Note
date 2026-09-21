import { describe, expect, it } from "vitest";
import {
  applyGithubPatToJwt,
  buildClientSession,
  githubOAuthRedirectIsBroken,
} from "./auth-session";

const SECRET = "ghp_SUPERSECRETTOKENVALUE";

describe("applyGithubPatToJwt", () => {
  it("stores the PAT as accessToken and is not a demo session", () => {
    const token = applyGithubPatToJwt({ pat: SECRET, isDemo: true }, {
      id: "user-1",
      githubLogin: "octocat",
      pat: SECRET,
    });
    expect(token.userId).toBe("user-1");
    expect(token.githubLogin).toBe("octocat");
    expect(token.isDemo).toBe(false);
    expect(token.accessToken).toBe(SECRET);
    expect(token).not.toHaveProperty("pat");
  });
});

describe("buildClientSession", () => {
  it("never puts the GitHub token on the session JSON", () => {
    const session = buildClientSession(
      {
        expires: "2099-01-01T00:00:00.000Z",
        user: { name: "Ada", email: "ada@example.com", image: null },
        accessToken: SECRET,
        pat: SECRET,
      },
      {
        userId: "user-1",
        isDemo: false,
        githubLogin: "ada",
        accessToken: SECRET,
        pat: SECRET,
      },
    );
    const json = JSON.stringify(session);
    expect(json).not.toContain(SECRET);
    expect(json).not.toContain("ghp_");
    expect(session).not.toHaveProperty("accessToken");
    expect(session).not.toHaveProperty("pat");
    expect(session.userId).toBe("user-1");
    expect(session.isDemo).toBe(false);
    expect(session.githubLogin).toBe("ada");
    expect(session.user?.name).toBe("Ada");
  });
});

describe("githubOAuthRedirectIsBroken", () => {
  it("blocks empty or missing client_id authorize URLs", () => {
    expect(githubOAuthRedirectIsBroken(null)).toBe(true);
    expect(githubOAuthRedirectIsBroken("")).toBe(true);
    expect(
      githubOAuthRedirectIsBroken("https://github.com/login/oauth/authorize?client_id="),
    ).toBe(true);
    expect(
      githubOAuthRedirectIsBroken("https://github.com/login/oauth/authorize?scope=read:user"),
    ).toBe(true);
  });

  it("allows a real GitHub authorize URL and in-app callbacks", () => {
    expect(
      githubOAuthRedirectIsBroken(
        "https://github.com/login/oauth/authorize?client_id=Iv1.abc123&scope=read:user",
      ),
    ).toBe(false);
    expect(githubOAuthRedirectIsBroken("http://localhost:3000/repos")).toBe(false);
    expect(githubOAuthRedirectIsBroken("/api/auth/callback/github?code=x")).toBe(false);
  });

  it("treats NextAuth error redirects as broken", () => {
    expect(githubOAuthRedirectIsBroken("http://localhost:3000/api/auth/error?error=Configuration")).toBe(
      true,
    );
    expect(githubOAuthRedirectIsBroken("/?error=OAuthSignin")).toBe(true);
  });
});
