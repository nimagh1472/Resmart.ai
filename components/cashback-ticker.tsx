"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type CashbackEvent = {
  user: string;
  amount: number;
  retailer: string;
  product: string;
};

/** Placeholder feed — swap for a Supabase realtime subscription. */
export const MOCK_CASHBACK_EVENTS: CashbackEvent[] = [
  {
    user: "#4829",
    amount: 64,
    retailer: "Best Buy",
    product: "Open-Box Mac",
  },
  {
    user: "#1174",
    amount: 212,
    retailer: "Dell Outlet",
    product: "Refurb XPS 15",
  },
  {
    user: "#9063",
    amount: 38,
    retailer: "Woot",
    product: "Like-New AirPods Pro",
  },
  {
    user: "#2510",
    amount: 149,
    retailer: "Samsung",
    product: "Certified Refurb S24 Ultra",
  },
  {
    user: "#7742",
    amount: 87,
    retailer: "Amazon Renewed",
    product: "Open-Box iPad Air",
  },
];

export function CashbackTicker({
  events = MOCK_CASHBACK_EVENTS,
  intervalMs = 4000,
  className,
}: {
  events?: CashbackEvent[];
  intervalMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  // Starts at 0 on both server and client, then advances after hydration.
  useEffect(() => {
    if (events.length < 2) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % events.length),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [events.length, intervalMs]);

  const event = events[index];

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "flex h-8 items-center gap-2 overflow-hidden rounded-full border border-vip/20 bg-vip/[0.06] pl-2.5 pr-3.5",
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vip opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-vip" />
      </span>

      <Zap className="h-3.5 w-3.5 shrink-0 text-vip-strong" aria-hidden="true" />

      <div className="relative min-w-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="truncate text-xs text-muted"
          >
            User{" "}
            <span className="font-mono text-foreground">{event.user}</span> just
            saved{" "}
            <span className="font-mono font-medium tabular-nums text-vip-strong">
              ${event.amount}
            </span>{" "}
            on {event.retailer} {event.product}!
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
