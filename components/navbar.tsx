"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { CashbackTicker } from "@/components/cashback-ticker";
import { useVip } from "@/components/vip-modal";
import { cn } from "@/lib/utils";

/** VIP has no route — it opens the subscription modal instead. */
type NavItem = { label: string; href?: string; vip?: boolean };

const NAV_ITEMS: NavItem[] = [
  { label: "Deals", href: "#deals" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Merchant Portal", href: "/merchants" },
  { label: "VIP $14.99/mo", vip: true },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="pt-safe sticky top-0 z-40 border-b border-surface-border bg-surface/85 backdrop-blur-xl">
      <nav
        aria-label="Main"
        className="px-gutter mx-auto flex h-16 max-w-7xl items-center gap-3 sm:gap-4"
      >
        <Link
          href="/"
          className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <Logo size="sm" />
        </Link>

        <ul className="ml-4 hidden items-center gap-1 lg:flex">
          {/* Keyed on label, not href — the VIP entry has no route. */}
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <NavLink item={item} />
            </li>
          ))}
        </ul>

        {/* Ticker takes the slack between nav and actions on wide screens. */}
        <CashbackTicker className="ml-auto hidden max-w-sm flex-1 xl:flex" />

        <div className="ml-auto flex items-center gap-2 xl:ml-4">
          <Button variant="secondary" size="sm" className="hidden sm:inline-flex">
            Sign In
          </Button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="touch-target rounded-lg p-2 text-muted transition hover:bg-surface hover:text-foreground lg:hidden"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Ticker moves below the bar when it can't fit inline. */}
      <div className="border-t border-surface-border/60 px-4 py-1.5 xl:hidden">
        <CashbackTicker className="mx-auto max-w-2xl border-none bg-transparent px-0" />
      </div>

      <AnimatePresence initial={false}>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden border-t border-surface-border lg:hidden"
          >
            <ul className="flex flex-col gap-1 px-4 py-3">
              {NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <NavLink
                    item={item}
                    className="block w-full"
                    onClick={() => setMobileOpen(false)}
                  />
                </li>
              ))}
              <li className="pt-2 sm:hidden">
                <Button variant="secondary" size="sm" fullWidth>
                  Sign In
                </Button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function NavLink({
  item,
  className,
  onClick,
}: {
  item: NavItem;
  className?: string;
  onClick?: () => void;
}) {
  const { openVip } = useVip();

  const classes = cn(
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    item.vip
      ? "font-medium text-vip-strong hover:bg-vip/10"
      : "text-muted hover:bg-surface hover:text-foreground",
    className,
  );

  if (item.vip) {
    return (
      <button
        type="button"
        onClick={() => {
          onClick?.();
          openVip();
        }}
        className={cn(classes, "text-left")}
      >
        <Crown className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          VIP <span className="font-mono text-xs tabular-nums">$14.99/mo</span>
        </span>
      </button>
    );
  }

  return (
    <Link href={item.href ?? "#"} onClick={onClick} className={classes}>
      {item.label}
    </Link>
  );
}
