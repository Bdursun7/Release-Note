import { NextResponse } from "next/server";
import { currentUser, jsonError, ownedDraft } from "@/lib/api";
import { briefToDocx, briefToMarkdown, briefToPdf, exportFilename } from "@/lib/export";
import type { BriefDocument } from "@/types/brief";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await currentUser();
  if (!userId) return jsonError("Unauthorized", 401);
  const { id } = await context.params;
  const draft = await ownedDraft(id, userId);
  if (!draft) return jsonError("Not found", 404);
  const brief = draft.briefJson as BriefDocument | null;
  if (!brief) return jsonError("Generate the notes first", 409);
  const format = new URL(request.url).searchParams.get("format") || "md";
  if (format === "md") {
    const markdown = briefToMarkdown(brief);
    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename(brief, "md")}"`,
      },
    });
  }
  if (format === "docx") {
    const buffer = await briefToDocx(brief);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${exportFilename(brief, "docx")}"`,
      },
    });
  }
  if (format === "pdf") {
    const buffer = await briefToPdf(brief);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${exportFilename(brief, "pdf")}"`,
      },
    });
  }
  return jsonError("format must be md, pdf, or docx");
}
