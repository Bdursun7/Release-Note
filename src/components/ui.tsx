"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

export function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "ink" | "danger";
}) {
  const styles = {
    primary:
      "bg-copper text-paper shadow-sm hover:bg-copper-dark hover:shadow-md disabled:opacity-50",
    ghost:
      "border border-line/90 bg-paper-raised text-ink hover:bg-paper-recede/80 disabled:opacity-50",
    ink: "bg-ink text-paper hover:bg-black disabled:opacity-50",
    danger:
      "border border-copper/35 bg-copper/5 text-copper hover:bg-copper/12 disabled:opacity-50",
  }[variant];
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium tracking-tight transition duration-150 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="block space-y-1.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">{label}</span>
      {children}
      {hint ? <span className="block text-xs leading-relaxed text-ink-faint">{hint}</span> : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-line bg-paper-raised px-3.5 py-2.5 text-sm outline-none ring-copper/25 transition focus:border-copper/40 focus:ring-2 ${props.className || ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-line bg-paper-raised px-3.5 py-2.5 text-sm outline-none ring-copper/25 transition focus:border-copper/40 focus:ring-2 ${props.className || ""}`}
    />
  );
}

const CUSTOM_VALUE = "__custom__";

export function RefSelect({
  value,
  onChange,
  groups,
  customLabel,
  customHint,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  groups: Array<{ label: string; options: string[] }>;
  customLabel: string;
  customHint?: string;
  placeholder?: string;
}) {
  const known = groups.flatMap((group) => group.options);
  const isKnown = Boolean(value) && known.includes(value);
  const selectValue = isKnown ? value : value ? CUSTOM_VALUE : "";
  return (
    <div className="space-y-2">
      <Select
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value;
          if (next === CUSTOM_VALUE) {
            if (isKnown) onChange("");
            return;
          }
          onChange(next);
        }}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {groups.map((group) =>
          group.options.length ? (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((option) => (
                <option key={`${group.label}-${option}`} value={option}>
                  {option}
                </option>
              ))}
            </optgroup>
          ) : null,
        )}
        <option value={CUSTOM_VALUE}>{customLabel}</option>
      </Select>
      {!isKnown ? (
        <>
          <TextInput
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={customLabel}
            spellCheck={false}
          />
          {customHint ? <span className="block text-xs text-ink-faint">{customHint}</span> : null}
        </>
      ) : null}
    </div>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-copper/30 bg-copper/10 px-3.5 py-2.5 text-sm text-copper-dark">
      {message}
    </p>
  );
}

export function WarningBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="rounded-sm border border-copper/40 bg-copper/15 px-3 py-2.5 text-sm leading-relaxed text-copper-dark"
    >
      {message}
    </p>
  );
}
