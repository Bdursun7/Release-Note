import { describe, expect, it } from "vitest";
import { dictionaries } from "./i18n";
import { emptyCuration, isNoiseCommit, recommendedSelection, categorizeCommit } from "./curation";
import { demoCommits } from "./mock-data";
import { briefToMarkdown } from "./export";
import {
  heuristicBrief,
  llmFallbackMessageKey,
  normalizeSection,
  rangeLabel,
} from "./brief-format";
import { demoStats } from "./mock-data";

describe("i18n dictionaries", () => {
  it("share the same keys", () => {
    const en = Object.keys(dictionaries.en).sort();
    const tr = Object.keys(dictionaries.tr).sort();
    expect(tr).toEqual(en);
  });

  it("uses Release Note Builder as the product name in both locales", () => {
    expect(dictionaries.en["brand.name"]).toBe("Release Note Builder");
    expect(dictionaries.tr["brand.name"]).toBe("Release Note Builder");
    expect(dictionaries.en["brief.llmMissing"]).toMatch(/basic summary/i);
    expect(dictionaries.tr["brief.llmMissing"]).toMatch(/temel bir özet/i);
  });
});

describe("noise filter", () => {
  it("pre-selects about 90% and drops chore/deps/merge", () => {
    const selected = recommendedSelection(demoCommits);
    const included = demoCommits.filter((c) => selected[c.sha]).length;
    const ratio = included / demoCommits.length;
    expect(ratio).toBeGreaterThan(0.75);
    expect(ratio).toBeLessThan(0.96);
    const merge = demoCommits.find((c) => c.message.startsWith("Merge"));
    const chore = demoCommits.find((c) => c.message.startsWith("chore:"));
    const deps = demoCommits.find((c) => c.message.includes("dependabot") || c.message.includes("chore(deps)"));
    const docs = demoCommits.find((c) => c.message.startsWith("docs:"));
    if (merge) expect(isNoiseCommit(merge)).toBe(true);
    if (chore) expect(isNoiseCommit(chore)).toBe(true);
    if (deps) expect(isNoiseCommit(deps)).toBe(true);
    if (docs) expect(isNoiseCommit(docs)).toBe(false);
  });
});

describe("brief synthesis", () => {
  it("builds category headings and is not a raw dump", async () => {
    const curation = emptyCuration(demoCommits);
    const title = rangeLabel({
      owner: "acme",
      repo: "checkout-service",
      branch: "main",
      rangeType: "lastN",
      lastN: 50,
    });
    const brief = heuristicBrief({
      title,
      locale: "en",
      commits: demoCommits,
      curation,
      stats: demoStats,
    });
    expect(brief.sections.improvements.length).toBeGreaterThan(0);
    expect(brief.sections.bugFixes.length).toBeGreaterThan(0);
    expect(brief.usedLlm).toBe(false);
    expect(brief.llmFallback).toBe("no_key");
    const markdown = briefToMarkdown(brief);
    const body = markdown.split("<details>")[0];
    expect(markdown).toContain("## Improvements");
    expect(markdown).toContain("## Bug fixes");
    expect(body).not.toContain("feat(checkout):");
    expect(brief.summary.split(".").length).toBeGreaterThanOrEqual(2);
    expect(brief.stats.leftOut).toBeGreaterThan(0);
    const docs = demoCommits.find((c) => c.message.startsWith("docs:"));
    if (docs) expect(categorizeCommit(docs)).toBe("other");

    const { briefToPdf, briefToDocx } = await import("./export");
    const pdf = await briefToPdf(brief);
    const docx = await briefToDocx(brief);
    expect(Buffer.from(pdf.subarray(0, 4)).toString()).toBe("%PDF");
    expect(docx.byteLength).toBeGreaterThan(1000);
  });

  it("renders group title then outcome bullets under the category", () => {
    const curation = emptyCuration(demoCommits);
    const checkout = demoCommits.filter(
      (commit) => commit.message.includes("(checkout)") && curation.selected[commit.sha],
    );
    expect(checkout.length).toBeGreaterThanOrEqual(2);
    curation.groups = [
      {
        id: "g-checkout",
        title: "Checkout reliability",
        shas: checkout.map((commit) => commit.sha),
        collapsed: true,
      },
    ];
    const brief = heuristicBrief({
      title: "acme/checkout-service@main · last 50",
      locale: "en",
      commits: demoCommits,
      curation,
      stats: demoStats,
    });
    const grouped = [
      ...brief.sections.improvements,
      ...brief.sections.bugFixes,
      ...brief.sections.other,
    ].find((group) => group.title === "Checkout reliability");
    expect(grouped?.bullets.length).toBe(checkout.length);
    const markdown = briefToMarkdown(brief);
    expect(markdown).toContain("## Improvements");
    expect(markdown).toContain("### Checkout reliability");
    const idx = markdown.indexOf("### Checkout reliability");
    const after = markdown.slice(idx, idx + 200);
    expect(after).toMatch(/### Checkout reliability\n\n- /);
  });

  it("normalizes legacy flat string sections", () => {
    expect(normalizeSection(["Faster checkout", "  "])).toEqual([
      { title: null, bullets: ["Faster checkout"] },
    ]);
    expect(
      normalizeSection([{ title: "Wallet", bullets: ["Apple Pay reason shown"] }]),
    ).toEqual([{ title: "Wallet", bullets: ["Apple Pay reason shown"] }]);
  });

  it("maps fallback reasons to warning copy keys", () => {
    expect(llmFallbackMessageKey("no_key")).toBe("brief.llmMissing");
    expect(llmFallbackMessageKey("llm_error")).toBe("brief.llmError");
    expect(llmFallbackMessageKey(undefined)).toBe("brief.llmMissing");
  });

  it("uses Turkish skeleton headings", () => {
    const curation = emptyCuration(demoCommits);
    const brief = heuristicBrief({
      title: "acme/checkout-service@main · last 50",
      locale: "tr",
      commits: demoCommits,
      curation,
      stats: demoStats,
    });
    const markdown = briefToMarkdown(brief);
    expect(markdown).toContain("## Geliştirmeler");
    expect(markdown).toContain("## Hata düzeltmeleri");
  });
});
