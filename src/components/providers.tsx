"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { I18nProvider } from "@/components/i18n-provider";
import type { Locale } from "@/lib/i18n";

export function Providers({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <SessionProvider>
      <I18nProvider initialLocale={locale}>{children}</I18nProvider>
    </SessionProvider>
  );
}
