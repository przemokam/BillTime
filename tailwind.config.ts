import type { Config } from "tailwindcss";

/**
 * BillTime - skinnable theme. Colors read CSS variables set per [data-skin]
 * (see globals.css): rgb triplets for tailwind alpha, full vars for hairlines.
 */
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        panel: "rgb(var(--c-panel) / <alpha-value>)",
        elev: "rgb(var(--c-elev) / <alpha-value>)",
        "elev-hi": "rgb(var(--c-elev-hi) / <alpha-value>)",
        black: "var(--black)",
        hair: "var(--hair)",
        "hair-hot": "var(--hair-hot)",
        "hair-neon": "var(--hair-neon)",
        ink: {
          DEFAULT: "rgb(var(--c-ink) / <alpha-value>)",
          dim: "rgb(var(--c-ink-dim) / <alpha-value>)",
          faint: "rgb(var(--c-ink-faint) / <alpha-value>)",
        },
        neon: {
          yellow: "rgb(var(--c-yellow) / <alpha-value>)",
          cyan: "rgb(var(--c-cyan) / <alpha-value>)",
          magenta: "rgb(var(--c-magenta) / <alpha-value>)",
          red: "rgb(var(--c-red) / <alpha-value>)",
          green: "rgb(var(--c-green) / <alpha-value>)",
        },
      },
      fontFamily: {
        disp: ["var(--font-disp)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "glow-cyan": "0 0 6px rgba(47,230,255,.35)",
        "glow-yellow": "0 0 10px rgba(212,255,46,.4)",
        "glow-magenta": "0 0 9px rgba(255,61,127,.4)",
      },
      animation: {
        blink: "blink 1.2s steps(1) infinite",
        rise: "rise .5s ease forwards",
        swipe: "swipe 3.2s ease-in-out infinite",
        glitch: "glitch .35s steps(2) 2",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
