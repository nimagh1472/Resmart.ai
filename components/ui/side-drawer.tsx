"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Edge-anchored sheet for secondary panels on small screens — the tablet and
 * mobile stand-in for a persistent dashboard sidebar.
 */
export function SideDrawer({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-canvas/80 backdrop-blur-sm"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className={cn(
              "pt-safe absolute inset-y-0 right-0 flex w-[min(26rem,92vw)] flex-col border-l border-surface-border bg-surface shadow-card outline-none",
              className,
            )}
            style={{ paddingRight: "env(safe-area-inset-right, 0px)" }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-surface-border px-5 py-4">
              <h2 className="font-heading text-sm font-semibold">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={`Close ${title}`}
                className="touch-target rounded-lg p-1.5 text-muted transition hover:bg-surface-raised hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-safe">
              <div className="flex flex-col gap-6">{children}</div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
