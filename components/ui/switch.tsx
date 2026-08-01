"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Accessible name. Required when no visible label sits beside the switch. */
  label: string;
  /** Renders `label` next to the control instead of only to screen readers. */
  showLabel?: boolean;
  size?: "sm" | "md";
  tone?: "accent" | "vip";
  disabled?: boolean;
  className?: string;
}

const TRACK = {
  sm: "h-5 w-9",
  md: "h-6 w-11",
};

// Knob travel (OFFSET) = track width − borders − padding − knob width.
const KNOB = {
  sm: "h-3.5 w-3.5",
  md: "h-[1.125rem] w-[1.125rem]",
};

const OFFSET = {
  sm: 16,
  md: 20,
};

export function Switch({
  checked,
  onCheckedChange,
  label,
  showLabel = false,
  size = "md",
  tone = "vip",
  disabled = false,
  className,
}: SwitchProps) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={showLabel ? undefined : label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full border px-0.5 transition-colors",
        "touch-manipulation",
        // The track itself is 20–24px tall; the pseudo-element extends the
        // hit area to 44px on touch without changing the visual size.
        "after:absolute after:-inset-x-2 after:-inset-y-3 after:content-[''] sm:after:hidden",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        TRACK[size],
        checked
          ? tone === "vip"
            ? "border-vip/40 bg-vip/25 focus-visible:outline-vip"
            : "border-accent/40 bg-accent/25 focus-visible:outline-accent"
          : "border-surface-border bg-surface-raised focus-visible:outline-accent",
      )}
    >
      <motion.span
        aria-hidden="true"
        animate={{ x: checked ? OFFSET[size] : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 34 }}
        className={cn(
          "rounded-full",
          KNOB[size],
          checked
            ? tone === "vip"
              ? "bg-vip shadow-glow-vip"
              : "bg-accent shadow-glow"
            : "bg-muted-foreground",
        )}
      />
    </button>
  );

  if (!showLabel) return <span className={className}>{control}</span>;

  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2.5 text-sm",
        className,
      )}
    >
      {control}
      <span className="text-muted">{label}</span>
    </label>
  );
}
