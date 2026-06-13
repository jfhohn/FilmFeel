import type { Config } from "tailwindcss";

/**
 * FilmFeel design tokens — the single source of truth for D2 (style audit).
 *
 * - Spacing: strict 8px grid (token n = n × 8px). `px` exists only for hairline rules.
 * - Radius: one scale (4 / 8 / 16 / full).
 * - Shadows: exactly two elevations (low, high).
 * - Color: monochrome "ink" ramp + ONE accent (CSS var, set in index.css).
 *   The chrome is monochrome; the only other color on screen is user imagery.
 * - Type: Satoshi for UI, JetBrains Mono for numeric readouts. Line heights on the 8px grid.
 */
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    spacing: {
      "0": "0px",
      px: "1px",
      "1": "8px",
      "2": "16px",
      "3": "24px",
      "4": "32px",
      "5": "40px",
      "6": "48px",
      "8": "64px",
      "10": "80px",
      "12": "96px",
      "16": "128px",
      "20": "160px",
      "24": "192px",
      "32": "256px",
    },
    borderRadius: {
      none: "0px",
      sm: "4px",
      md: "8px",
      lg: "16px",
      full: "9999px",
    },
    boxShadow: {
      none: "none",
      low: "0 1px 2px rgb(0 0 0 / 0.5), 0 2px 8px rgb(0 0 0 / 0.35)",
      high: "0 4px 16px rgb(0 0 0 / 0.5), 0 16px 48px rgb(0 0 0 / 0.45)",
    },
    colors: {
      transparent: "transparent",
      current: "currentColor",
      black: "#000000",
      white: "#ffffff",
      ink: {
        "50": "#f5f5f6",
        "100": "#e6e6e9",
        "200": "#b9b9bf",
        // 400/500 are text tints: raised to clear WCAG AA (4.5:1) on the ink-950
        // body and the ink-900/850 elevated surfaces (PRD D3). 7.1:1 and 5.4:1
        // worst-case while staying muted and below ink-200 in the hierarchy.
        "400": "#a4a4ab",
        "500": "#8d8d94",
        "700": "#2a2a2f",
        "800": "#1f1f23",
        "850": "#18181b",
        "900": "#121214",
        "950": "#0b0b0c",
      },
      accent: "rgb(var(--accent) / <alpha-value>)",
    },
    fontFamily: {
      sans: ["Satoshi", "system-ui", "-apple-system", "sans-serif"],
      mono: ["JetBrains Mono", "ui-monospace", "monospace"],
    },
    fontSize: {
      xs: ["12px", { lineHeight: "16px" }],
      sm: ["14px", { lineHeight: "24px" }],
      base: ["16px", { lineHeight: "24px" }],
      lg: ["20px", { lineHeight: "28px" }],
      xl: ["28px", { lineHeight: "36px" }],
      "2xl": ["40px", { lineHeight: "48px" }],
      "3xl": ["64px", { lineHeight: "72px" }],
    },
    aspectRatio: {
      photo: "3 / 2",
      scope: "2.39 / 1",
      video: "16 / 9",
    },
    extend: {
      transitionDuration: {
        DEFAULT: "180ms",
      },
    },
  },
  plugins: [],
};

export default config;
