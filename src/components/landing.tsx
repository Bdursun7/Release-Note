"use client";

import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui";

export function Landing({ githubReady, demoReady }: { githubReady: boolean; demoReady: boolean }) {
  const { t } = useI18n();
  const { data, status } = useSession();
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-copper">{t("landing.kicker")}</p>
          <h1 className="mt-4 max-w-xl font-serif text-4xl leading-tight text-ink md:text-5xl">
            {t("landing.title")}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted">{t("landing.body")}</p>
          <ul className="mt-8 space-y-3 text-sm text-ink">
            {[t("landing.point1"), t("landing.point2"), t("landing.point3")].map((point) => (
              <li key={point} className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 bg-copper" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 font-mono text-xs uppercase tracking-wider text-ink-faint">{t("landing.not")}</p>
        </section>
        <aside className="paper-card h-fit p-6">
          <h2 className="font-serif text-2xl">{t("brand.name")}</h2>
          <p className="mt-2 text-sm text-ink-muted">{t("brand.tagline")}</p>
          <div className="mt-8 flex flex-col gap-3">
            {status === "authenticated" && data ? (
              <Link href="/repos">
                <Button className="w-full">{t("nav.repos")}</Button>
              </Link>
            ) : (
              <>
                <Button
                  className="w-full"
                  disabled={!githubReady}
                  onClick={() => signIn("github", { callbackUrl: "/repos" })}
                >
                  {t("landing.connect")}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  disabled={!demoReady}
                  onClick={() => signIn("demo", { intent: "demo", callbackUrl: "/repos" })}
                >
                  {t("landing.demo")}
                </Button>
              </>
            )}
          </div>
          {!githubReady ? (
            <p className="mt-4 text-xs leading-relaxed text-ink-faint">{t("landing.githubMissing")}</p>
          ) : null}
          {!demoReady ? (
            <p className="mt-4 text-xs leading-relaxed text-ink-faint">{t("landing.demoMissing")}</p>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
