import type { ReactNode } from "react";
import { BadgeCheck, PackageOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "emerald"
  | "sky"
  | "teal"
  | "slate"
  | "amber"
  | "rose";
export type BadgeSize = "sm" | "md";

const TONES: Record<BadgeTone, string> = {
  emerald: "bg-accent-soft text-vip-strong ring-vip/30",
  // Slate navy rather than a second green — keeps "refurbished" visually
  // distinct from "open-box" now that the accent itself is emerald.
  sky: "bg-navy/[0.06] text-navy ring-navy/15",
  teal: "bg-condition-likenew/10 text-condition-likenew ring-condition-likenew/25",
  slate: "bg-surface-raised text-muted ring-surface-border",
  amber: "bg-amber-400/15 text-amber-700 ring-amber-500/25",
  rose: "bg-rose-500/10 text-rose-700 ring-rose-500/25",
};

const SIZES: Record<BadgeSize, string> = {
  sm: "h-5 gap-1 px-2 text-[10px]",
  md: "h-6 gap-1.5 px-2.5 text-xs",
};

const ICON_SIZE: Record<BadgeSize, string> = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  icon?: ReactNode;
}

export function Badge({
  tone = "slate",
  size = "md",
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-center whitespace-nowrap rounded-full font-mono font-medium uppercase tracking-wider ring-1 ring-inset",
        TONES[tone],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Condition tags                                                      */
/* ------------------------------------------------------------------ */

export type ProductCondition =
  | "open-box-excellent"
  | "certified-refurbished"
  | "like-new";

export const CONDITIONS: Record<
  ProductCondition,
  { label: string; tone: BadgeTone; description: string }
> = {
  "open-box-excellent": {
    label: "Open-Box Excellent",
    tone: "emerald",
    description: "Opened but unused, in as-new cosmetic condition.",
  },
  "certified-refurbished": {
    label: "Certified Refurbished",
    tone: "sky",
    description: "Professionally restored and tested to manufacturer spec.",
  },
  "like-new": {
    label: "Like New",
    tone: "teal",
    description: "Lightly used with no visible wear.",
  },
};

const CONDITION_ICONS: Record<ProductCondition, typeof BadgeCheck> = {
  "open-box-excellent": PackageOpen,
  "certified-refurbished": BadgeCheck,
  "like-new": Sparkles,
};

export interface ConditionBadgeProps
  extends Omit<BadgeProps, "tone" | "icon" | "children"> {
  condition: ProductCondition;
  /** Set false to render the label alone. */
  showIcon?: boolean;
}

export function ConditionBadge({
  condition,
  size = "md",
  showIcon = true,
  className,
  ...props
}: ConditionBadgeProps) {
  const { label, tone, description } = CONDITIONS[condition];
  const Icon = CONDITION_ICONS[condition];

  return (
    <Badge
      tone={tone}
      size={size}
      title={description}
      icon={
        showIcon ? (
          <Icon className={ICON_SIZE[size]} aria-hidden="true" />
        ) : undefined
      }
      className={className}
      {...props}
    >
      {label}
    </Badge>
  );
}
