import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";

const ICON_SIZE: Record<LogoSize, string> = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-11 w-11",
};

const WORD_SIZE: Record<LogoSize, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
};

const BADGE_SIZE: Record<LogoSize, string> = {
  sm: "px-1 py-px text-[9px]",
  md: "px-1.5 py-0.5 text-[10px]",
  lg: "px-2 py-0.5 text-xs",
};

type LogoMarkProps = {
  size?: LogoSize;
  className?: string;
  /**
   * Namespaces the SVG's gradient/filter ids. The defs are identical across
   * instances, so the default is safe on pages with more than one logo — pass
   * a prefix only if you need to restyle a single instance.
   */
  idPrefix?: string;
};

/** The abstract AI-lens glyph on its own. */
export function LogoMark({
  size = "md",
  className,
  idPrefix = "resmart",
}: LogoMarkProps) {
  const ring = `${idPrefix}-ring`;
  const core = `${idPrefix}-core`;
  const glow = `${idPrefix}-glow`;

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      role="presentation"
      aria-hidden="true"
      className={cn(ICON_SIZE[size], "shrink-0", className)}
    >
      <defs>
        <linearGradient id={ring} x1="4" y1="4" x2="28" y2="28">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <radialGradient id={core}>
          <stop offset="0%" stopColor="#D1FAE5" />
          <stop offset="55%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </radialGradient>
        <filter id={glow} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer housing */}
      <circle
        cx="16"
        cy="16"
        r="13.25"
        stroke={`url(#${ring})`}
        strokeWidth="1.5"
        opacity="0.9"
      />

      {/* Iris — segmented aperture, drifting in brightness */}
      <circle
        cx="16"
        cy="16"
        r="8.25"
        stroke={`url(#${ring})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="9.5 7.4"
        transform="rotate(-24 16 16)"
        className="animate-lens-pulse"
      />

      {/* Lens core */}
      <circle
        cx="16"
        cy="16"
        r="3.4"
        fill={`url(#${core})`}
        filter={`url(#${glow})`}
      />

      {/* Specular highlight */}
      <circle cx="14.5" cy="14.5" r="0.85" fill="#ECFDF5" opacity="0.9" />
    </svg>
  );
}

type LogoProps = LogoMarkProps & {
  /** `full` renders mark + wordmark, `icon` the mark alone, `wordmark` the text alone. */
  variant?: "full" | "icon" | "wordmark";
};

export function Logo({
  variant = "full",
  size = "md",
  className,
  idPrefix,
}: LogoProps) {
  if (variant === "icon") {
    return (
      <span className={cn("inline-flex", className)} aria-label="ReSmart AI">
        <LogoMark size={size} idPrefix={idPrefix} />
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="ReSmart AI"
    >
      {variant === "full" && <LogoMark size={size} idPrefix={idPrefix} />}
      <span
        className={cn(
          "font-heading font-bold leading-none tracking-tight text-foreground",
          WORD_SIZE[size],
        )}
      >
        ReSmart
      </span>
      <span
        className={cn(
          "rounded-md bg-accent font-mono font-bold uppercase leading-none tracking-widest text-white shadow-glow",
          BADGE_SIZE[size],
        )}
      >
        AI
      </span>
    </span>
  );
}
