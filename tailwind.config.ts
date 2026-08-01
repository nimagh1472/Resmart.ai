import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background Canvas — Deep Void
        canvas: {
          DEFAULT: "#05070A",
          soft: "#080B10",
        },
        // Surface / Card — Elevated Slate
        surface: {
          DEFAULT: "#0F172A",
          raised: "#152036",
          border: "#1E293B",
        },
        // Primary Accent — Electric Cyan
        accent: {
          DEFAULT: "#38BDF8",
          hover: "#0EA5E9",
          muted: "#0C4A6E",
        },
        // Success / VIP Accent — Emerald Green
        vip: {
          DEFAULT: "#10B981",
          hover: "#059669",
          muted: "#064E3B",
        },
        // Condition tags
        condition: {
          openbox: "#10B981", // Open-Box Excellent — Emerald
          refurbished: "#38BDF8", // Certified Refurbished — Sky Blue
          likenew: "#2DD4BF", // Like New — Teal
        },
        // Semantic aliases wired to CSS variables
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: {
          DEFAULT: "#94A3B8",
          foreground: "#64748B",
        },
        border: "#1E293B",
      },
      fontFamily: {
        heading: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(56, 189, 248, 0.35)",
        "glow-vip": "0 0 24px -4px rgba(16, 185, 129, 0.35)",
        card: "0 1px 2px 0 rgba(0, 0, 0, 0.6), 0 8px 24px -12px rgba(0, 0, 0, 0.9)",
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #38BDF8 0%, #10B981 100%)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      spacing: {
        // Notch / home-indicator insets. Usable as p-safe-t, pb-safe-b, etc.
        "safe-t": "env(safe-area-inset-top, 0px)",
        "safe-b": "env(safe-area-inset-bottom, 0px)",
        "safe-l": "env(safe-area-inset-left, 0px)",
        "safe-r": "env(safe-area-inset-right, 0px)",
      },
      minHeight: {
        // WCAG 2.5.8 asks for 44px; 48px is the comfortable iOS/Android target.
        touch: "48px",
        "touch-sm": "44px",
      },
      minWidth: {
        touch: "48px",
        "touch-sm": "44px",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "lens-pulse": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "lens-pulse": "lens-pulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
