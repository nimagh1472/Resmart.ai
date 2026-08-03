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
  // Emerald — the default call to action.
  primary:
    "bg-accent text-white shadow-glow hover:bg-accent-hover active:bg-accent-strong focus-visible:outline-accent-strong",
  // Deeper emerald — cashback / payout confirmations.
  success:
    "bg-accent-hover text-white shadow-glow-vip hover:bg-accent-strong focus-visible:outline-accent-strong",
  // White with a crisp slate hairline — the Nordic secondary.
  secondary:
    "bg-surface text-navy border border-surface-border shadow-[0_1px_2px_0_rgba(15,23,42,0.05)] hover:border-accent/60 hover:bg-accent-soft hover:text-accent-strong focus-visible:outline-accent-strong",
  ghost:
    "bg-transparent text-muted hover:bg-surface-raised hover:text-navy focus-visible:outline-accent-strong",
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
