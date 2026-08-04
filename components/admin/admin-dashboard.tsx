"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, Lock, PanelRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SideDrawer } from "@/components/ui/side-drawer";
import { ToastProvider } from "@/components/ui/toast";
import { useIsDesktop } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { FinancialOverview } from "@/components/admin/financial-overview";
import { ApprovalQueue } from "@/components/admin/approval-queue";
import { KycApplications } from "@/components/admin/kyc-applications";
import { SystemControls } from "@/components/admin/system-controls";
import { ModerationPanel } from "@/components/admin/moderation-panel";
import {
  DEFAULT_SETTINGS,
  MOCK_APPLICATIONS,
  MOCK_FINANCIALS,
  MOCK_FLAGGED,
  MOCK_USERS,
  type FlaggedListing,
  type MerchantApplication,
  type PlatformSettings,
  type PlatformUser,
} from "@/lib/mock-admin";

type Decision = { id: string; name: string; outcome: "approved" | "rejected" };

/**
 * Two review surfaces, one column: KYC applications are the live queue backed
 * by `/api/merchants`, while the document queue is the per-document checklist.
 */
const TABS = [
  { id: "kyc", label: "Merchant KYC Applications", icon: ShieldCheck },
  { id: "documents", label: "Document Queue", icon: ClipboardList },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AdminDashboard() {
  return (
    // Approve/reject feedback is a toast, so the provider has to sit above the
    // whole console rather than inside the queue component.
    <ToastProvider>
      <AdminConsole />
    </ToastProvider>
  );
}

function AdminConsole() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [applications, setApplications] =
    useState<MerchantApplication[]>(MOCK_APPLICATIONS);
  const [users, setUsers] = useState<PlatformUser[]>(MOCK_USERS);
  const [flagged, setFlagged] = useState<FlaggedListing[]>(MOCK_FLAGGED);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("kyc");

  const isDesktop = useIsDesktop();

  // Pick up any cashback rates a previous save already persisted, so
  // reopening the console doesn't show stale defaults.
  useEffect(() => {
    fetch("/api/cashback-rates", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.rates) {
          setSettings((prev) => ({ ...prev, cashbackRates: data.rates }));
        }
      })
      .catch(() => {
        /* Falls back to DEFAULT_SETTINGS — the live catalog still applies its own default rates. */
      });
  }, []);

  const saveSettings = (next: PlatformSettings) => {
    setSettings(next);
    fetch("/api/cashback-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rates: next.cashbackRates }),
    }).catch(() => {
      /* Local state still reflects the change even if the persist call fails. */
    });
  };

  const decide = (id: string, outcome: Decision["outcome"]) => {
    const app = applications.find((a) => a.id === id);
    if (!app) return;
    setApplications((prev) => prev.filter((a) => a.id !== id));
    setDecisions((prev) => [
      { id, name: app.businessName, outcome },
      ...prev.slice(0, 4),
    ]);
  };

  const sidePanel = (
    <>
      <SystemControls
        settings={settings}
        financials={MOCK_FINANCIALS}
        onSave={saveSettings}
      />

      {decisions.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-surface-border bg-surface shadow-card p-5">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Recent decisions
          </h2>
          <ul className="flex flex-col gap-1.5">
            {decisions.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="truncate text-muted">{d.name}</span>
                <span
                  className={
                    d.outcome === "approved"
                      ? "font-mono text-[10px] uppercase tracking-wider text-vip-strong"
                      : "font-mono text-[10px] uppercase tracking-wider text-rose-600"
                  }
                >
                  {d.outcome}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-vip-strong" aria-hidden="true" />
            Merchants are notified automatically.
          </p>
        </section>
      )}
    </>
  );

  return (
    <div className="px-gutter mx-auto flex max-w-[110rem] flex-col gap-8 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-bold sm:text-2xl">
          Super Admin
        </h1>
        <p className="text-sm text-muted-foreground">
          Platform financials, merchant KYC verification, pricing controls, and
          moderation.
        </p>
      </div>

      <FinancialOverview financials={MOCK_FINANCIALS} />

      {!isDesktop && (
        <Button
          variant="secondary"
          fullWidth
          onClick={() => setPanelOpen(true)}
          leftIcon={<PanelRight className="h-4 w-4" />}
        >
          System controls
        </Button>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Review tabs -------------------------------------------- */}
          <div
            role="tablist"
            aria-label="Merchant review"
            className="flex w-full gap-1 rounded-2xl border border-surface-border bg-surface p-1 shadow-card"
          >
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`tab-${id}`}
                  aria-selected={active}
                  aria-controls={`panel-${id}`}
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex min-h-touch-sm flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition sm:text-sm",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong",
                    active
                      ? "bg-accent-soft text-accent-strong ring-1 ring-inset ring-accent/30"
                      : "text-muted hover:bg-surface-raised hover:text-navy",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
            className="min-w-0"
          >
            {tab === "kyc" ? (
              <KycApplications />
            ) : (
              <ApprovalQueue
                applications={applications}
                onApprove={(id) => decide(id, "approved")}
                onReject={(id) => decide(id, "rejected")}
                onRequestDocs={() => {
                  /* Wired to the merchant notification service. */
                }}
              />
            )}
          </div>

          <ModerationPanel
            users={users}
            flagged={flagged}
            onToggleVip={(id, isVip) =>
              setUsers((prev) =>
                prev.map((u) => (u.id === id ? { ...u, isVip } : u)),
              )
            }
            onToggleSuspended={(id, suspended) =>
              setUsers((prev) =>
                prev.map((u) =>
                  u.id === id
                    ? { ...u, status: suspended ? "suspended" : "active" }
                    : u,
                ),
              )
            }
            onDeleteListing={(id) =>
              setFlagged((prev) => prev.filter((l) => l.id !== id))
            }
            onDismissFlag={(id) =>
              setFlagged((prev) => prev.filter((l) => l.id !== id))
            }
          />
        </div>

        {isDesktop && <div className="flex flex-col gap-6">{sidePanel}</div>}
      </div>

      <SideDrawer
        open={!isDesktop && panelOpen}
        onClose={() => setPanelOpen(false)}
        title="System controls"
      >
        {sidePanel}
      </SideDrawer>

      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        <Lock className="h-3 w-3" aria-hidden="true" />
        Demo data with no access control. Put this route behind admin
        authentication before deploying.
      </p>
    </div>
  );
}
