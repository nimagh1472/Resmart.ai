"use client";

import { motion } from "framer-motion";
import { Radar, Scale, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Radar,
    title: "AI Aggregates Retailers",
    description:
      "Vision AI crawls Best Buy, eBay, Walmart, Amazon Warehouse and 40+ more, normalizing every open-box and refurbished listing into one index.",
    tone: "accent" as const,
  },
  {
    icon: Scale,
    title: "Compare Open-Box Prices",
    description:
      "See condition grade, warranty, 90-day price history and true savings against MSRP — side by side, in a single view.",
    tone: "accent" as const,
  },
  {
    icon: Wallet,
    title: "Get Guaranteed Cashback",
    description:
      "Buy through ReSmart and 3% lands in your cashback wallet automatically. Withdraw to your bank whenever you like.",
    tone: "vip" as const,
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-y border-surface-border bg-canvas-soft py-20 sm:py-24"
    >
      <div className="px-gutter mx-auto max-w-6xl">
        <div className="mx-auto mb-14 flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            How ReSmart Works
          </span>
          <h2 className="text-balance text-2xl font-bold sm:text-3xl lg:text-4xl">
            Three steps between you and the open-box price
          </h2>
        </div>

        <ol className="relative grid gap-8 md:grid-cols-3 md:gap-6">
          {/* Connector rail behind the step markers on desktop. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-surface-border to-transparent md:block"
          />

          {STEPS.map((step, i) => (
            <motion.li
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.45, delay: i * 0.1, ease: "easeOut" }}
              className="relative flex flex-col items-center gap-4 text-center"
            >
              <div
                className={cn(
                  "relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border bg-surface",
                  step.tone === "vip"
                    ? "border-vip/30 shadow-glow-vip"
                    : "border-accent/30 shadow-glow",
                )}
              >
                <step.icon
                  className={cn(
                    "h-6 w-6",
                    step.tone === "vip" ? "text-vip" : "text-accent",
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-bold text-canvas",
                    step.tone === "vip" ? "bg-vip" : "bg-accent",
                  )}
                >
                  {i + 1}
                </span>
              </div>

              <h3 className="font-heading text-lg font-semibold">
                {step.title}
              </h3>
              <p className="max-w-sm text-sm leading-relaxed text-muted">
                {step.description}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
