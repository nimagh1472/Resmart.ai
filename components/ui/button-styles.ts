import { cn } from "@/lib/utils";

/**
 * Button styling lives outside `button.tsx` on purpose: that file is
 * `"use client"`, and a server component importing a function from a client
 * module receives a client-reference stub rather than the function itself.
 * Keeping these here lets server components style anchors with `buttonStyles`.
 */

export type ButtonVariant = "primary" | "success" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Cyan gradient — the default call to action.
  primary:
    "bg-gradient-to-r from-accent to-sky-400 text-canvas shadow-glow hover:from-accent-hover hover:to-accent focus-visible:outline-accent",
  // Emerald — reserved for cashback / payout confirmations.
  success:
    "bg-gradient-to-r from-vip to-emerald-400 text-canvas shadow-glow-vip hover:from-vip-hover hover:to-vip focus-visible:outline-vip",
  // Slate with a 1px glowing border.
  secondary:
    "bg-surface text-foreground border border-surface-border shadow-[0_0_0_1px_rgba(56,189,248,0.12),0_0_18px_-6px_rgba(56,189,248,0.45)] hover:border-accent/50 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.35),0_0_26px_-6px_rgba(56,189,248,0.7)] focus-visible:outline-accent",
  ghost:
    "bg-transparent text-muted hover:bg-surface hover:text-foreground focus-visible:outline-accent",
};

/**
 * Heights are mobile-first: every button clears a 48px touch target under
 * 640px and tightens up on pointer-precise viewports.
 */
export const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-12 sm:h-9 px-4 sm:px-3.5 text-sm gap-1.5 rounded-lg",
  md: "h-12 sm:h-11 px-5 text-sm gap-2 rounded-xl",
  lg: "h-14 sm:h-[3.25rem] px-6 sm:px-7 text-base gap-2.5 rounded-xl",
};

const BASE = [
  "inline-flex select-none items-center justify-center whitespace-nowrap font-medium",
  "transition-colors duration-200",
  // Kills the ~300ms synthetic click delay on iOS/iPadOS.
  "touch-manipulation",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
  "disabled:pointer-events-none disabled:opacity-50",
].join(" ");

/**
 * Button styling without the element. Use when the control has to be an anchor
 * (affiliate links, external navigation) rather than a `<button>`.
 */
export function buttonStyles({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(
    BASE,
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    fullWidth && "w-full",
    className,
  );
}

/** Shared press/hover feel for both `Button` and anchor-styled variants. */
export const BUTTON_MOTION = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: { type: "spring", stiffness: 420, damping: 26, mass: 0.6 },
} as const;
