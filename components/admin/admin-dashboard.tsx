"use client";

import { useState } from "react";
import { CheckCircle2, Lock, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SideDrawer } from "@/components/ui/side-drawer";
import { useIsDesktop } from "@/lib/use-media-query";
import { FinancialOverview } from "@/components/admin/financial-overview";
import { ApprovalQueue } from "@/components/admin/approval-queue";
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

export function AdminDashboard() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [applications, setApplications] =
    useState<MerchantApplication[]>(MOCK_APPLICATIONS);
  const [users, setUsers] = useState<PlatformUser[]>(MOCK_USERS);
  const [flagged, setFlagged] = useState<FlaggedListing[]>(MOCK_FLAGGED);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  const isDesktop = useIsDesktop();

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
        onSave={setSettings}
      />

      {decisions.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-surface-border bg-surface p-5">
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
                      ? "font-mono text-[10px] uppercase tracking-wider text-vip"
                      : "font-mono text-[10px] uppercase tracking-wider text-rose-300"
                  }
                >
                  {d.outcome}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-vip" aria-hidden="true" />
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
          Platform financials, merchant approvals, pricing controls, and
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
          <ApprovalQueue
            applications={applications}
            onApprove={(id) => decide(id, "approved")}
            onReject={(id) => decide(id, "rejected")}
            onRequestDocs={() => {
              /* Wired to the merchant notification service. */
            }}
          />

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
