"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, ScanSearch } from "lucide-react";
import { SavedDealsTab } from "@/components/account/saved-deals-tab";
import { VisionHistoryTab } from "@/components/account/vision-history-tab";
import {
  MOCK_SAVED_DEALS,
  MOCK_VISION_HISTORY,
  type SavedDeal,
  type VisionScan,
} from "@/lib/mock-account";
import { cn } from "@/lib/utils";

type TabId = "saved" | "vision";

export function AccountTabs() {
  const [tab, setTab] = useState<TabId>("saved");
  const [deals, setDeals] = useState<SavedDeal[]>(MOCK_SAVED_DEALS);
  const [scans, setScans] = useState<VisionScan[]>(MOCK_VISION_HISTORY);

  const TABS: { id: TabId; label: string; icon: typeof Bookmark; count: number }[] =
    [
      {
        id: "saved",
        label: "Saved Deals & Alerts",
        icon: Bookmark,
        count: deals.length,
      },
      {
        id: "vision",
        label: "AI Vision History",
        icon: ScanSearch,
        count: scans.length,
      },
    ];

  const updateDeal = (productId: string, patch: Partial<SavedDeal>) =>
    setDeals((prev) =>
      prev.map((d) => (d.productId === productId ? { ...d, ...patch } : d)),
    );

  const removeDeal = (productId: string) =>
    setDeals((prev) => prev.filter((d) => d.productId !== productId));

  const toggleScanSaved = (id: string, saved: boolean) =>
    setScans((prev) => prev.map((s) => (s.id === id ? { ...s, saved } : s)));

  return (
    <section className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Account sections"
        className="flex flex-wrap gap-2 border-b border-surface-border"
      >
        {TABS.map(({ id, label, icon: Icon, count }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-selected={active}
              aria-controls={`panel-${id}`}
              onClick={() => setTab(id)}
              className={cn(
                "relative flex items-center gap-2 px-1 pb-3 pt-1 text-sm transition",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                active
                  ? "text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              <Icon
                className={cn("h-4 w-4", active && "text-accent")}
                aria-hidden="true"
              />
              {label}
              <span className="rounded-full bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                {count}
              </span>
              {active && (
                <motion.span
                  layoutId="account-tab-underline"
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
        className="focus-visible:outline-none"
      >
        {tab === "saved" ? (
          <SavedDealsTab
            deals={deals}
            onUpdate={updateDeal}
            onRemove={removeDeal}
          />
        ) : (
          <VisionHistoryTab
            scans={scans}
            onToggleSaved={toggleScanSaved}
            onRescan={() => {
              /* Wired to the Vision AI modal once scans persist server-side. */
            }}
          />
        )}
      </div>
    </section>
  );
}
