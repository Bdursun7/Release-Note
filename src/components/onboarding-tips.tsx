"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";

const STORAGE = "rnb-onboarding-dismissed";

export function OnboardingTips() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(STORAGE) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="border-b border-line bg-sea-mist/80 px-6 py-2.5">
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
        <ol className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-ink">
          {[t("onboard.step1"), t("onboard.step2"), t("onboard.step3")].map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-copper">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-ink-muted hover:text-ink"
          onClick={() => {
            try {
              localStorage.setItem(STORAGE, "1");
            } catch {
              /* ignore quota */
            }
            setVisible(false);
          }}
        >
          {t("onboard.dismiss")}
        </button>
      </div>
    </div>
  );
}
