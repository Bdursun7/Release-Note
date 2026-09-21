import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "Release Note Builder",
    llmConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
  });
}
