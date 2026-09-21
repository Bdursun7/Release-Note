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
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "ink" | "danger";
}) {
  const styles = {
    primary: "bg-copper text-paper hover:bg-copper-dark disabled:opacity-50",
    ghost: "border border-line bg-paper-raised text-ink hover:bg-paper-recede disabled:opacity-50",
    ink: "bg-ink text-paper hover:bg-black disabled:opacity-50",
    danger: "border border-copper/40 text-copper hover:bg-copper/10 disabled:opacity-50",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-sm px-3.5 py-2 text-sm font-medium transition ${styles} ${className}`}
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
    <label className="block space-y-1.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-ink-faint">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-sm border border-line bg-paper-raised px-3 py-2 text-sm outline-none ring-copper/30 focus:ring-2 ${props.className || ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-sm border border-line bg-paper-raised px-3 py-2 text-sm outline-none ring-copper/30 focus:ring-2 ${props.className || ""}`}
    />
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-sm border border-copper/30 bg-copper/10 px-3 py-2 text-sm text-copper-dark">
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
