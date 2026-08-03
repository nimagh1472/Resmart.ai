"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Max width of the panel. */
  className?: string;
  /** Set false to keep the modal open on backdrop click. */
  dismissOnBackdrop?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  dismissOnBackdrop = true,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Escape to close, and lock background scroll while open.
  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const { overflow, paddingRight } = document.body.style;
    // Compensate for the vanishing scrollbar so the page doesn't jump.
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
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
             style={{ paddingLeft: "env(safe-area-inset-left, 0px)", paddingRight: "env(safe-area-inset-right, 0px)" }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={dismissOnBackdrop ? onClose : undefined}
            className="absolute inset-0 bg-navy/40 backdrop-blur-sm"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            tabIndex={-1}
            // Slides up from the bottom edge on mobile (sheet), scales in on
            // larger screens (dialog).
            initial={{ opacity: 0, y: 48, scale: 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className={cn(
              "relative flex w-full flex-col overflow-hidden border border-surface-border bg-surface shadow-card outline-none",
              // Sheet: pinned to the bottom, taller ceiling, rounded top only.
              "max-h-[90dvh] rounded-t-2xl border-b-0",
              // Dialog: centered, fully rounded.
              "sm:max-h-[88dvh] sm:max-w-lg sm:rounded-2xl sm:border-b",
              className,
            )}
          >
            {/* Grab handle — signals the sheet affordance on touch. */}
            <div
              aria-hidden="true"
              className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-surface-border sm:hidden"
            />

            {(title || description) && (
              <div className="flex items-start justify-between gap-4 border-b border-surface-border px-5 py-4">
                <div className="flex flex-col gap-1">
                  {title && (
                    <h2 className="font-heading text-lg font-semibold leading-tight">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="text-sm text-muted-foreground">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="touch-target -mr-1 -mt-1 rounded-lg p-1.5 text-muted transition hover:bg-surface-raised hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* overscroll-contain stops a scroll at the sheet's edge from
                chaining to the page behind it on iOS. */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-safe">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
