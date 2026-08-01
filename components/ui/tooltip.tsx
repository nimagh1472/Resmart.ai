"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  /** Which side of the trigger the bubble sits on. */
  side?: "top" | "bottom";
  className?: string;
}

/**
 * Lightweight hover/focus tooltip. Positioned relative to the trigger rather
 * than portalled, so keep it out of `overflow-hidden` containers.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className="relative inline-flex"
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: side === "top" ? 4 : -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "pointer-events-none absolute left-1/2 z-30 w-max max-w-[15rem] -translate-x-1/2 rounded-lg border border-surface-border bg-canvas px-2.5 py-1.5 text-left text-xs font-normal normal-case tracking-normal text-muted shadow-card",
              side === "top" ? "bottom-full mb-2" : "top-full mt-2",
              className,
            )}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
