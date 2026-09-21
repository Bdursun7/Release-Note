import { Document, Packer, Paragraph, TextRun, HeadingLevel, LevelFormat } from "docx";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BriefBlock, BriefDocument } from "@/types/brief";
import { footnote, normalizeBrief, sectionBlocks, sectionHeading, SECTION_ORDER } from "@/lib/brief-format";
import { t } from "@/lib/i18n";

function brandName(brief: BriefDocument): string {
  return t(brief.locale, "brand.name");
}

function markdownForBlock(block: BriefBlock): string[] {
  if (block.type === "item") return [`- ${block.text}`];
  return [`- **${block.title}**`, ...block.items.map((item) => `  - ${item}`)];
}

export function briefToMarkdown(brief: BriefDocument): string {
  const doc = normalizeBrief(brief);
  const lines: string[] = [`# ${doc.title}`, "", doc.summary, ""];
  for (const key of SECTION_ORDER) {
    const items = sectionBlocks(doc.sections, key);
    if (!items.length) continue;
    lines.push(`## ${sectionHeading(doc.locale, key)}`, "");
    for (const item of items) lines.push(...markdownForBlock(item));
    lines.push("");
  }
  lines.push("---", "", `_${footnote(doc)}_`, "", `<details>`, `<summary>${doc.locale === "tr" ? "Kaynak commit’ler" : "Source commits"}</summary>`, "");
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
    const items = sectionBlocks(doc.sections, key);
    if (!items.length) continue;
    children.push(
      new Paragraph({
        text: sectionHeading(doc.locale, key),
        heading: HeadingLevel.HEADING_1,
      }),
    );
    for (const item of items) {
      if (item.type === "item") {
        children.push(
          new Paragraph({
            text: item.text,
            numbering: { reference: "brief-bullets", level: 0 },
          }),
        );
        continue;
      }
      children.push(
        new Paragraph({
          children: [new TextRun({ text: item.title, bold: true })],
          numbering: { reference: "brief-bullets", level: 0 },
        }),
      );
      for (const child of item.items) {
        children.push(
          new Paragraph({
            text: child,
            numbering: { reference: "brief-bullets", level: 1 },
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
          reference: "brief-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: "left",
              style: {
                paragraph: {
                  indent: { left: 360, hanging: 180 },
                },
              },
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: "◦",
              alignment: "left",
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 180 },
                },
              },
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

  const writeBullet = (
    text: string,
    level: number,
    font: typeof regular = regular,
    size = 11,
  ) => {
    const indent = margin + level * 18;
    const width = pageSize[0] - margin - indent - 14;
    const lines = wrap(text, font, size, width);
    for (let i = 0; i < lines.length; i += 1) {
      ensure(size + 5);
      if (i === 0) {
        page.drawText(level === 0 ? "•" : "–", { x: indent, y, size, font: regular, color: ink });
      }
      page.drawText(lines[i], { x: indent + 14, y, size, font, color: ink });
      y -= size + 5;
    }
    y -= 3;
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
    const items = sectionBlocks(doc.sections, key);
    if (!items.length) continue;
    writeWrapped(sectionHeading(doc.locale, key), bold, 13, copper, 6);
    y -= 2;
    for (const item of items) {
      if (item.type === "item") {
        writeBullet(item.text, 0);
        continue;
      }
      writeBullet(item.title, 0, bold, 11);
      for (const child of item.items) writeBullet(child, 1);
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
