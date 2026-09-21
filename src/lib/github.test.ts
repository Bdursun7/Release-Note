import { afterEach, describe, expect, it, vi } from "vitest";
import { githubConfigured, listRepos, validateGithubPat } from "./github";
import { demoRepos } from "./mock-data";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MOCK_GITHUB;
});

describe("githubConfigured", () => {
  it("is false when client id or secret is missing or whitespace", () => {
    expect(githubConfigured({})).toBe(false);
    expect(githubConfigured({ GITHUB_CLIENT_ID: "abc", GITHUB_CLIENT_SECRET: "" })).toBe(false);
    expect(githubConfigured({ GITHUB_CLIENT_ID: "  ", GITHUB_CLIENT_SECRET: "secret" })).toBe(false);
    expect(githubConfigured({ GITHUB_CLIENT_ID: "abc", GITHUB_CLIENT_SECRET: "secret" })).toBe(true);
  });
});

describe("validateGithubPat", () => {
  it("returns identity for a valid token and never echoes the secret", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 42,
          login: "octocat",
          name: "The Octocat",
          email: "octocat@github.com",
          avatar_url: "https://example.com/octocat.png",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const identity = await validateGithubPat("ghp_validtoken", fetchImpl as unknown as typeof fetch);
    expect(identity).toEqual({
      id: 42,
      login: "octocat",
      name: "The Octocat",
      email: "octocat@github.com",
      avatarUrl: "https://example.com/octocat.png",
    });
    const init = fetchImpl.mock.calls[0]?.[1] as { headers?: Record<string, string> } | undefined;
    expect(init?.headers?.Authorization).toBe("Bearer ghp_validtoken");
    expect(JSON.stringify(identity)).not.toContain("ghp_validtoken");
  });

  it("returns null for empty or rejected tokens", async () => {
    expect(await validateGithubPat("   ")).toBeNull();
    const fetchImpl = vi.fn(async () => new Response("Bad credentials", { status: 401 }));
    expect(await validateGithubPat("ghp_nope", fetchImpl as unknown as typeof fetch)).toBeNull();
  });
});

describe("listRepos", () => {
  it("returns demo repos only for demo sessions", async () => {
    await expect(listRepos({ isDemo: true })).resolves.toEqual(demoRepos);
  });

  it("returns an empty list for GitHub users without a token (not demo fixtures)", async () => {
    await expect(listRepos({ isDemo: false })).resolves.toEqual([]);
    await expect(listRepos({ isDemo: false, token: null })).resolves.toEqual([]);
  });
});
