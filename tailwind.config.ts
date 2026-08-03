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
        // Background Canvas — subtle slate neutral
        canvas: {
          DEFAULT: "#F8FAFC",
          soft: "#FFFFFF",
        },
        // Surface / Card — clean white on the slate canvas
        surface: {
          DEFAULT: "#FFFFFF",
          raised: "#F1F5F9",
          border: "#E2E8F0",
        },
        /**
         * Primary Accent — Emerald.
         * `DEFAULT` is the brand fill (buttons, tints, rings, icons); `strong`
         * is the darker tone used wherever emerald has to carry text on a light
         * surface, where #10B981 sits well below the 4.5:1 contrast floor.
         */
        accent: {
          DEFAULT: "#10B981",
          hover: "#059669",
          strong: "#047857",
          muted: "#D1FAE5",
          soft: "#ECFDF5",
        },
        // Success / VIP / Cashback — the same emerald family
        vip: {
          DEFAULT: "#10B981",
          hover: "#059669",
          strong: "#047857",
          muted: "#D1FAE5",
        },
        // Secondary / typography — Deep Slate Navy
        navy: {
          DEFAULT: "#0F172A",
          soft: "#1E293B",
          muted: "#334155",
        },
        // Condition tags — emerald, navy, and teal keep the three grades apart
        condition: {
          openbox: "#047857", // Open-Box Excellent — Emerald
          refurbished: "#1E293B", // Certified Refurbished — Slate Navy
          likenew: "#0F766E", // Like New — Teal
        },
        // Semantic aliases wired to CSS variables
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: {
          DEFAULT: "#475569",
          foreground: "#64748B",
        },
        border: "#E2E8F0",
      },
      fontFamily: {
        heading: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        // Soft elevation rather than neon bloom — the light theme reads depth
        // from a tinted slate shadow, with a faint emerald cast on CTAs.
        glow: "0 1px 2px 0 rgba(15, 23, 42, 0.06), 0 8px 20px -8px rgba(16, 185, 129, 0.45)",
        "glow-vip":
          "0 1px 2px 0 rgba(15, 23, 42, 0.06), 0 8px 20px -8px rgba(16, 185, 129, 0.45)",
        card: "0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 12px 32px -16px rgba(15, 23, 42, 0.18)",
        elevated:
          "0 2px 4px -1px rgba(15, 23, 42, 0.06), 0 20px 48px -24px rgba(15, 23, 42, 0.28)",
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #10B981 0%, #047857 100%)",
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
