import { Document, Packer, Paragraph, TextRun, HeadingLevel, LevelFormat } from "docx";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BriefDocument, BriefSectionGroup, BriefSectionKey } from "@/types/brief";
import { footnote, normalizeBrief, sectionHeading } from "@/lib/brief-format";
import { t } from "@/lib/i18n";

const SECTION_ORDER: BriefSectionKey[] = ["improvements", "bugFixes", "other"];

function brandName(brief: BriefDocument): string {
  return t(brief.locale, "brand.name");
}

function renderGroupsMarkdown(groups: BriefSectionGroup[]): string[] {
  const lines: string[] = [];
  for (const group of groups) {
    if (group.title) {
      lines.push(`### ${group.title}`, "");
    }
    for (const bullet of group.bullets) lines.push(`- ${bullet}`);
    lines.push("");
  }
  return lines;
}

export function briefToMarkdown(brief: BriefDocument): string {
  const doc = normalizeBrief(brief);
  const lines: string[] = [`# ${doc.title}`, "", doc.summary, ""];
  for (const key of SECTION_ORDER) {
    const groups = doc.sections[key];
    if (!groups.length) continue;
    lines.push(`## ${sectionHeading(doc.locale, key)}`, "");
    lines.push(...renderGroupsMarkdown(groups));
  }
  lines.push(
    "---",
    "",
    `_${footnote(doc)}_`,
    "",
    `<details>`,
    `<summary>${doc.locale === "tr" ? "Kaynak commit’ler" : "Source commits"}</summary>`,
    "",
  );
  for (const entry of doc.appendix) {
    lines.push(`- \`${entry.sha}\` ${entry.message}`);
  }
  lines.push("", `</details>`, "");
  return lines.join("\n");
}

export async function briefToDocx(brief: BriefDocument): Promise<Buffer> {
  const doc = normalizeBrief(brief);
  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: brandName(doc), size: 18, color: "C45C26" })],
    }),
    new Paragraph({
      text: doc.title,
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: doc.summary, size: 22 })],
    }),
  ];
  for (const key of SECTION_ORDER) {
    const groups = doc.sections[key];
    if (!groups.length) continue;
    children.push(
      new Paragraph({
        text: sectionHeading(doc.locale, key),
        heading: HeadingLevel.HEADING_1,
      }),
    );
    for (const group of groups) {
      if (group.title) {
        children.push(
          new Paragraph({
            text: group.title,
            heading: HeadingLevel.HEADING_2,
          }),
        );
      }
      for (const bullet of group.bullets) {
        children.push(
          new Paragraph({
            text: bullet,
            bullet: { level: 0 },
          }),
        );
      }
    }
  }
  children.push(
    new Paragraph({
      spacing: { before: 300 },
      children: [new TextRun({ text: footnote(doc), italics: true, size: 18, color: "5c564c" })],
    }),
    new Paragraph({
      spacing: { before: 200 },
      children: [
        new TextRun({
          text: doc.locale === "tr" ? "Ek — kaynak commit’ler" : "Appendix — source commits",
          italics: true,
          size: 18,
        }),
      ],
    }),
  );
  for (const entry of doc.appendix) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: entry.sha, font: "Courier New", size: 16 }),
          new TextRun({ text: `  ${entry.message}`, size: 16 }),
        ],
      }),
    );
  }

  const file = new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: "left",
            },
          ],
        },
      ],
    },
    sections: [{ children }],
  });
  const buffer = await Packer.toBuffer(file);
  return Buffer.from(buffer);
}

async function loadPdfFont(): Promise<Uint8Array> {
  const fontPath = path.join(process.cwd(), "src/fonts/IBMPlexSans-Regular.ttf");
  return new Uint8Array(await readFile(fontPath));
}

async function loadPdfFontBold(): Promise<Uint8Array> {
  const fontPath = path.join(process.cwd(), "src/fonts/IBMPlexSans-SemiBold.ttf");
  return new Uint8Array(await readFile(fontPath));
}

export async function briefToPdf(brief: BriefDocument): Promise<Buffer> {
  const doc = normalizeBrief(brief);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([loadPdfFont(), loadPdfFontBold()]);
  const regular = await pdf.embedFont(regularBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 56;
  const copper = rgb(0.77, 0.36, 0.15);
  const ink = rgb(0.09, 0.08, 0.06);
  const muted = rgb(0.36, 0.34, 0.3);

  let page = pdf.addPage(pageSize);
  let y = page.getHeight() - margin;

  const ensure = (needed: number) => {
    if (y - needed < margin + 24) {
      page = pdf.addPage(pageSize);
      y = page.getHeight() - margin;
    }
  };

  const wrap = (text: string, font: typeof regular, size: number, width: number) => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  };

  const writeWrapped = (
    text: string,
    font: typeof regular,
    size: number,
    color: typeof ink,
    extraGap = 6,
  ) => {
    const width = pageSize[0] - margin * 2;
    const lines = wrap(text, font, size, width);
    for (const line of lines) {
      ensure(size + extraGap);
      page.drawText(line, { x: margin, y, size, font, color });
      y -= size + extraGap;
    }
  };

  page.drawRectangle({
    x: 0,
    y: page.getHeight() - 8,
    width: page.getWidth(),
    height: 8,
    color: copper,
  });

  writeWrapped(brandName(doc), regular, 9, copper, 4);
  y -= 4;
  writeWrapped(doc.title, bold, 18, ink, 8);
  y -= 6;
  writeWrapped(doc.summary, regular, 11, ink, 5);
  y -= 10;

  for (const key of SECTION_ORDER) {
    const groups = doc.sections[key];
    if (!groups.length) continue;
    writeWrapped(sectionHeading(doc.locale, key), bold, 13, copper, 6);
    y -= 2;
    for (const group of groups) {
      if (group.title) {
        writeWrapped(group.title, bold, 11, ink, 5);
        y -= 2;
      }
      for (const item of group.bullets) {
        const width = pageSize[0] - margin * 2 - 14;
        const lines = wrap(item, regular, 11, width);
        for (let i = 0; i < lines.length; i += 1) {
          ensure(16);
          if (i === 0) {
            page.drawText("•", { x: margin, y, size: 11, font: regular, color: ink });
          }
          page.drawText(lines[i], { x: margin + 14, y, size: 11, font: regular, color: ink });
          y -= 16;
        }
        y -= 4;
      }
      y -= 6;
    }
    y -= 8;
  }

  y -= 8;
  page.drawLine({
    start: { x: margin, y: y + 8 },
    end: { x: page.getWidth() - margin, y: y + 8 },
    thickness: 0.6,
    color: rgb(0.85, 0.82, 0.76),
  });
  writeWrapped(footnote(doc), regular, 9, muted, 4);
  y -= 10;
  writeWrapped(
    doc.locale === "tr" ? "Ek — kaynak commit’ler" : "Appendix — source commits",
    bold,
    10,
    muted,
    4,
  );
  for (const entry of doc.appendix) {
    writeWrapped(`${entry.sha}  ${entry.message}`, regular, 8, muted, 3);
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

export function exportFilename(brief: BriefDocument, ext: string): string {
  const slug = brief.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug || "release-note"}.${ext}`;
}
