"use client";

import { type FormEvent, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { useI18n } from "@/components/i18n-provider";
import { Button, ErrorBanner, Field, TextInput } from "@/components/ui";
import { GITHUB_PAT_DOCS_URL, githubOAuthRedirectIsBroken } from "@/lib/auth-session";

export function Landing({
  oauthReady,
  demoReady,
  authError,
}: {
  oauthReady: boolean;
  demoReady: boolean;
  authError?: string | null;
}) {
  const { t } = useI18n();
  const { data, status } = useSession();
  const [pat, setPat] = useState("");
  const [showPat, setShowPat] = useState(!oauthReady || Boolean(authError));
  const [busy, setBusy] = useState<"oauth" | "pat" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(() => {
    if (!authError) return null;
    if (authError === "CredentialsSignin") return t("landing.patInvalid");
    return t("landing.oauthError");
  });

  const authed = status === "authenticated" && data;

  async function connectOauth() {
    if (!oauthReady) {
      setShowPat(true);
      setError(t("landing.oauthUnavailable"));
      return;
    }
    setBusy("oauth");
    setError(null);
    try {
      const result = await signIn("github", { callbackUrl: "/repos", redirect: false });
      if (result?.error || githubOAuthRedirectIsBroken(result?.url)) {
        setShowPat(true);
        setError(t("landing.oauthError"));
        return;
      }
      if (result?.url) {
        window.location.assign(result.url);
        return;
      }
      setShowPat(true);
      setError(t("landing.oauthError"));
    } catch {
      setShowPat(true);
      setError(t("landing.oauthError"));
    } finally {
      setBusy(null);
    }
  }

  async function connectPat(event: FormEvent) {
    event.preventDefault();
    const token = pat.trim();
    if (!token) {
      setError(t("landing.patInvalid"));
      return;
    }
    setBusy("pat");
    setError(null);
    try {
      const result = await signIn("github-pat", {
        pat: token,
        callbackUrl: "/repos",
        redirect: false,
      });
      if (result?.error || !result?.ok) {
        setError(t("landing.patInvalid"));
        return;
      }
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      setError(t("landing.patInvalid"));
    } catch {
      setError(t("landing.patInvalid"));
    } finally {
      setBusy(null);
    }
  }

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
            {authed ? (
              <Link href="/repos">
                <Button className="w-full">{t("nav.repos")}</Button>
              </Link>
            ) : (
              <>
                {oauthReady ? (
                  <Button className="w-full" disabled={busy !== null} onClick={() => void connectOauth()}>
                    {t("landing.connect")}
                  </Button>
                ) : null}
                {showPat ? (
                  <form className="space-y-3" onSubmit={(event) => void connectPat(event)}>
                    {!oauthReady ? (
                      <p className="text-sm text-ink-muted">{t("landing.oauthUnavailable")}</p>
                    ) : null}
                    <Field label={t("landing.patLabel")} hint={t("landing.patHint")}>
                      <TextInput
                        type="password"
                        value={pat}
                        onChange={(e) => setPat(e.target.value)}
                        placeholder={t("landing.patPlaceholder")}
                        autoComplete="off"
                        spellCheck={false}
                        aria-label={t("landing.patLabel")}
                      />
                    </Field>
                    <p className="text-xs leading-relaxed text-ink-faint">
                      <a
                        className="text-copper underline decoration-copper/40 underline-offset-2 hover:text-copper-dark"
                        href={GITHUB_PAT_DOCS_URL}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("landing.patHow")}
                      </a>
                      {" · "}
                      {t("landing.patServer")}
                    </p>
                    <Button className="w-full" type="submit" disabled={busy !== null}>
                      {busy === "pat"
                        ? t("landing.patBusy")
                        : oauthReady
                          ? t("landing.patSubmit")
                          : t("landing.connect")}
                    </Button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="text-left text-xs text-ink-muted underline decoration-line underline-offset-2 hover:text-ink"
                    onClick={() => setShowPat(true)}
                  >
                    {t("landing.usePatInstead")}
                  </button>
                )}
                <Button
                  variant="ghost"
                  className="w-full"
                  disabled={!demoReady || busy !== null}
                  onClick={() => {
                    setBusy("demo");
                    void signIn("demo", { intent: "demo", callbackUrl: "/repos" });
                  }}
                >
                  {t("landing.demo")}
                </Button>
              </>
            )}
          </div>
          <div className="mt-4">
            <ErrorBanner message={error} />
          </div>
          {!demoReady ? (
            <p className="mt-4 text-xs leading-relaxed text-ink-faint">{t("landing.demoMissing")}</p>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
