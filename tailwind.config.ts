import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#2a241c",
          muted: "#6a6156",
          faint: "#90867a",
        },
        paper: {
          DEFAULT: "#f6efe3",
          raised: "#fffaf2",
          recede: "#efe4d4",
        },
        copper: {
          DEFAULT: "#c45c26",
          dark: "#9a4519",
          soft: "#e8c4ad",
        },
        sea: {
          DEFAULT: "#2a5d59",
          mist: "#e3eeec",
        },
        line: "#e4d9c8",
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-plex)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        dispatch: "0 18px 50px -24px rgba(22, 20, 16, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
