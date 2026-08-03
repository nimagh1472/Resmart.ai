"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Store, Sparkles } from "lucide-react";
import { SmartSearch } from "@/components/smart-search";
import { ConditionBadge } from "@/components/ui/badge";

const TRUST_SIGNALS = [
  { icon: Store, label: "40+ retailers indexed" },
  { icon: ShieldCheck, label: "Warranty-backed listings only" },
  { icon: Sparkles, label: "AI-verified condition grading" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Ambient cyan/emerald wash behind the fold. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute left-1/2 top-[-18rem] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute bottom-[-14rem] right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-vip/10 blur-[120px]" />
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.09 }}
        className="px-gutter mx-auto flex max-w-4xl flex-col items-center gap-6 py-16 text-center sm:gap-8 sm:py-28"
      >
        <motion.span
          variants={fadeUp}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-accent-strong"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Powered by Vision AI
        </motion.span>

        <motion.h1
          variants={fadeUp}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-balance text-3xl font-bold leading-[1.12] sm:text-5xl sm:leading-[1.08] lg:text-6xl"
        >
          Search{" "}
          <span className="bg-accent-gradient bg-clip-text text-transparent">
            $200B+
          </span>{" "}
          Open-Box &amp; Refurbished Inventory in One AI Search
        </motion.h1>

        <motion.p
          variants={fadeUp}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-2xl text-balance text-base text-muted sm:text-lg"
        >
          Every open-box, certified refurbished, and like-new listing across the
          web — graded, price-compared, and cashback-eligible in one place.
        </motion.p>

        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-3xl pt-2"
        >
          <SmartSearch />
        </motion.div>

        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          <ConditionBadge condition="open-box-excellent" size="sm" />
          <ConditionBadge condition="certified-refurbished" size="sm" />
          <ConditionBadge condition="like-new" size="sm" />
        </motion.div>

        <motion.ul
          variants={fadeUp}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 pt-2"
        >
          {TRUST_SIGNALS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Icon className="h-3.5 w-3.5 text-vip-strong" aria-hidden="true" />
              {label}
            </li>
          ))}
        </motion.ul>
      </motion.div>
    </section>
  );
}
