import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { detectLocale, LOCALE_COOKIE } from "@/lib/i18n";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  display: "swap",
});

const plex = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ship Brief Builder",
  description: "Internal ship briefs from Git commits — synthesized, not dumped.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = detectLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language"),
  });
  return (
    <html lang={locale} className={`${fraunces.variable} ${plex.variable} ${plexMono.variable}`}>
      <body className="font-sans antialiased">
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
