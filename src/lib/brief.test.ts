import { describe, expect, it } from "vitest";
import { dictionaries } from "./i18n";
import {
  emptyCuration,
  excludeNoise,
  isNoiseCommit,
  recommendedSelection,
  categorizeCommit,
  humanizeHeadline,
} from "./curation";
import { demoCommits } from "./mock-data";
import { briefToMarkdown } from "./export";
import { finalizeSections, flattenBlocks, heuristicBrief, rangeLabel } from "./brief-format";
import { demoStats } from "./mock-data";
import type { CurationState } from "@/types/brief";

describe("i18n dictionaries", () => {
  it("share the same keys", () => {
    const en = Object.keys(dictionaries.en).sort();
    const tr = Object.keys(dictionaries.tr).sort();
    expect(tr).toEqual(en);
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

  it("excludeNoise deselects merge/chore/deps without re-including left-out signal", () => {
    const allOn: Record<string, boolean> = {};
    for (const commit of demoCommits) allOn[commit.sha] = true;
    const feature = demoCommits.find((c) => c.message.startsWith("feat("));
    expect(feature).toBeTruthy();
    const curation: CurationState = {
      selected: { ...allOn, [feature!.sha]: false },
      groups: [],
    };
    const next = excludeNoise(demoCommits, curation);
    for (const commit of demoCommits) {
      if (isNoiseCommit(commit)) expect(next.selected[commit.sha]).toBe(false);
    }
    expect(next.selected[feature!.sha]).toBe(false);
    const includedNoise = demoCommits.filter((c) => allOn[c.sha] && isNoiseCommit(c));
    expect(includedNoise.length).toBeGreaterThan(0);
    expect(includedNoise.every((c) => next.selected[c.sha] === false)).toBe(true);
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

  it("nests group outcomes and never dumps those commits as Other", () => {
    const feat = demoCommits.find((c) => c.message.startsWith("feat(checkout):"));
    const fix = demoCommits.find((c) => c.message.startsWith("fix(checkout):"));
    expect(feat && fix).toBeTruthy();
    const curation: CurationState = {
      selected: Object.fromEntries(demoCommits.map((c) => [c.sha, true])),
      groups: [
        {
          id: "checkout",
          title: "Checkout reliability",
          shas: [feat!.sha, fix!.sha],
          collapsed: true,
        },
      ],
    };
    const brief = heuristicBrief({
      title: "acme/checkout-service@main · v1.4.0...main",
      locale: "en",
      commits: demoCommits,
      curation,
      stats: demoStats,
    });
    const group = brief.sections.improvements.find((block) => block.type === "group");
    expect(group).toMatchObject({
      type: "group",
      title: "Checkout reliability",
    });
    if (group?.type === "group") {
      expect(group.items.length).toBe(2);
    }
    const markdown = briefToMarkdown(brief);
    expect(markdown).toMatch(/- \*\*Checkout reliability\*\*\n  - /);
    const otherText = flattenBlocks(brief.sections.other).join("\n");
    expect(otherText).not.toContain(humanizeHeadline(feat!.message));
    expect(otherText).not.toContain(feat!.headline);
    expect(flattenBlocks(brief.sections.improvements).join("\n")).not.toContain(feat!.headline);

    const dumped = finalizeSections({
      llm: {
        improvements: ["Checkout now retries card authorization when the processor returns 409."],
        bugFixes: [],
        other: [feat!.headline, humanizeHeadline(feat!.message), humanizeHeadline(fix!.message), "Docs pass"],
      },
      commits: demoCommits,
      curation,
    });
    const other = flattenBlocks(dumped.other).join("\n");
    expect(other).not.toMatch(/retry card/i);
    expect(other).not.toContain(feat!.headline);
    expect(other).toContain("Docs pass");
    expect(dumped.improvements.some((block) => block.type === "group" && block.title === "Checkout reliability")).toBe(
      true,
    );
  });

  it("dedupes the same outcome across sections", () => {
    const sections = finalizeSections({
      llm: {
        improvements: ["Retry card authorization on 409"],
        bugFixes: [],
        other: ["Retry card authorization on 409"],
      },
      commits: demoCommits.slice(0, 3),
      curation: emptyCuration(demoCommits.slice(0, 3)),
    });
    const other = flattenBlocks(sections.other);
    expect(other).not.toContain("Retry card authorization on 409");
  });
});
