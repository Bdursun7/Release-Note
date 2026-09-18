import { NextResponse } from "next/server";
import { LOCALE_COOKIE } from "@/lib/i18n";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const locale = body.locale === "tr" ? "tr" : body.locale === "en" ? "en" : null;
  if (!locale) return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  const response = NextResponse.json({ locale });
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
