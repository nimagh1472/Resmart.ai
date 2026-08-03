"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info";

export type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
};

type ToastInput = Omit<Toast, "id"> & { id?: string };

type ToastContextValue = {
  /** Shows a toast and returns its id, so a caller can dismiss it early. */
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Long enough to read two lines; errors linger because they carry a reason. */
const DURATION: Record<ToastTone, number> = {
  success: 4000,
  info: 5000,
  error: 7000,
};

const TONE_STYLES: Record<ToastTone, { ring: string; icon: string; Icon: typeof Info }> = {
  success: {
    ring: "ring-vip/30",
    icon: "bg-accent-soft text-vip-strong",
    Icon: CheckCircle2,
  },
  error: {
    ring: "ring-rose-500/30",
    icon: "bg-rose-500/10 text-rose-700",
    Icon: AlertTriangle,
  },
  info: {
    ring: "ring-navy/15",
    icon: "bg-navy/[0.06] text-navy",
    Icon: Info,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  // Timers are cleared on unmount so a dismissed provider can't set state.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    setMounted(true);
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id =
        input.id ?? `toast-${Date.now().toString(36)}-${toastSeq()}`;
      // Cap the stack — a burst of decisions shouldn't bury the page.
      setToasts((prev) => [...prev.filter((t) => t.id !== id), { ...input, id }].slice(-4));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION[input.tone]),
      );
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            aria-atomic="false"
            className="px-gutter pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 pb-6 sm:bottom-auto sm:right-0 sm:top-0 sm:inset-x-auto sm:items-end sm:pb-0 sm:pt-6"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))" }}
          >
            <AnimatePresence initial={false}>
              {toasts.map((t) => {
                const { ring, icon, Icon } = TONE_STYLES[t.tone];
                return (
                  <motion.div
                    key={t.id}
                    layout
                    role={t.tone === "error" ? "alert" : "status"}
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className={cn(
                      "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-surface p-4 shadow-elevated ring-1",
                      ring,
                    )}
                  >
                    <span className={cn("rounded-lg p-1.5", icon)}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navy">{t.title}</p>
                      {t.description && (
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => dismiss(t.id)}
                      aria-label="Dismiss notification"
                      className="-mr-1 -mt-1 rounded-lg p-1.5 text-muted-foreground transition hover:bg-surface-raised hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

let seq = 0;
const toastSeq = () => (seq = (seq + 1) % 1000);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside a <ToastProvider>.");
  }
  return ctx;
}
