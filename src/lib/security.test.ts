import { describe, expect, it } from "vitest";
import { demoAuthEnabled } from "./flags";
import { loadFixtureRange, demoCommits, demoRefIndex } from "./mock-data";
import { consumeDemoLlmLimit, resetRateLimitsForTests, rateLimit } from "./rate-limit";

describe("demo auth gate", () => {
  it("is off in production unless ALLOW_DEMO_AUTH=true", () => {
    expect(demoAuthEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(demoAuthEnabled({ NODE_ENV: "production", ALLOW_DEMO_AUTH: "true" })).toBe(true);
    expect(demoAuthEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(demoAuthEnabled({ NODE_ENV: "development", ALLOW_DEMO_AUTH: "false" })).toBe(false);
  });
});

describe("fixture ranges", () => {
  it("honors v1.4.0...main instead of returning the whole fixture", () => {
    const { commits } = loadFixtureRange({
      rangeType: "refs",
      baseRef: "v1.4.0",
      headRef: "main",
      branch: "main",
    });
    const baseIdx = demoRefIndex["v1.4.0"];
    expect(commits.length).toBe(baseIdx);
    expect(commits.length).toBeLessThan(demoCommits.length);
    expect(commits[0].sha).toBe(demoCommits[0].sha);
    expect(commits.at(-1)?.sha).toBe(demoCommits[baseIdx - 1].sha);
    expect(commits.some((c) => c.sha === demoCommits[baseIdx].sha)).toBe(false);
  });

  it("honors last N from the selected head", () => {
    const { commits } = loadFixtureRange({
      rangeType: "lastN",
      lastN: 5,
      branch: "main",
      headRef: "main",
    });
    expect(commits).toHaveLength(5);
    expect(commits.map((c) => c.sha)).toEqual(demoCommits.slice(0, 5).map((c) => c.sha));
  });

  it("rejects unknown refs instead of dumping the fixture", () => {
    expect(() =>
      loadFixtureRange({
        rangeType: "refs",
        baseRef: "not-a-ref",
        headRef: "main",
        branch: "main",
      }),
    ).toThrow(/Unknown demo ref/);
  });
});

describe("demo LLM rate limit", () => {
  it("trips after the per-user cap", () => {
    resetRateLimitsForTests();
    let allowed = 0;
    for (let i = 0; i < 20; i += 1) {
      if (consumeDemoLlmLimit({ userId: "u1", ip: "1.1.1.1" })) allowed += 1;
    }
    expect(allowed).toBe(6);
    expect(consumeDemoLlmLimit({ userId: "u1", ip: "1.1.1.1" })).toBe(false);
  });

  it("rateLimit window resets", () => {
    resetRateLimitsForTests();
    expect(rateLimit("k", 1, 1000, 0)).toBe(true);
    expect(rateLimit("k", 1, 1000, 10)).toBe(false);
    expect(rateLimit("k", 1, 1000, 1001)).toBe(true);
  });
});
