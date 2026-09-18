import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#161410",
          muted: "#5c564c",
          faint: "#8a8276",
        },
        paper: {
          DEFAULT: "#f4efe4",
          raised: "#fbf8f1",
          recede: "#e8e1d4",
        },
        copper: {
          DEFAULT: "#c45c26",
          dark: "#9a4519",
          soft: "#e8c4ad",
        },
        sea: {
          DEFAULT: "#1e4d4a",
          mist: "#d7e4e2",
        },
        line: "#d9d1c3",
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
