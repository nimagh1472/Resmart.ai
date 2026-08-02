"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  MousePointerClick,
  PackagePlus,
  PanelRight,
  Percent,
  ShoppingBag,
  TrendingUp,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Button } from "@/components/ui/button";
import { useIsDesktop } from "@/lib/use-media-query";
import { ApprovalBanner } from "@/components/merchants/approval-banner";
import { WalletCard } from "@/components/merchants/wallet-card";
import {
  InventoryForm,
  type ListingDraft,
} from "@/components/merchants/inventory-form";
import { AnalyticsTable } from "@/components/merchants/analytics-table";
import {
  COMMISSION_RATE,
  MOCK_LISTINGS,
  MOCK_MERCHANT,
  MOCK_WALLET,
  adSpend,
  canPublish,
  commission,
  revenue,
  type MerchantListing,
  type MerchantProfile,
  type MerchantStatus,
  type MerchantWallet,
} from "@/lib/mock-merchant";
import { cn, formatCurrency } from "@/lib/utils";

export function MerchantDashboard() {
  const [profile, setProfile] = useState<MerchantProfile>(MOCK_MERCHANT);
  const [wallet, setWallet] = useState<MerchantWallet>(MOCK_WALLET);
  const [listings, setListings] = useState<MerchantListing[]>(MOCK_LISTINGS);

  const [editing, setEditing] = useState<MerchantListing | null>(null);
  const [deleting, setDeleting] = useState<MerchantListing | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const isDesktop = useIsDesktop();
  const boostAllowed = canPublish(profile.status);

  const summary = useMemo(() => {
    // Ad metrics count only listings actually serving.
    const serving = listings.filter((l) => l.boostEnabled && boostAllowed);
    const impressions = serving.reduce((n, l) => n + l.impressions, 0);
    const clicks = serving.reduce((n, l) => n + l.clicks, 0);
    const spend = serving.reduce((n, l) => n + adSpend(l), 0);

    // Sales accrue regardless of boost.
    const totalRevenue = listings.reduce((n, l) => n + revenue(l), 0);
    const totalCommission = listings.reduce((n, l) => n + commission(l), 0);

    return {
      impressions,
      clicks,
      ctr: impressions === 0 ? 0 : clicks / impressions,
      avgCpc: clicks === 0 ? 0 : spend / clicks,
      unitsSold: listings.reduce((n, l) => n + l.unitsSold, 0),
      totalRevenue,
      totalCommission,
      // Clamp: deleting a listing can drop earned commission below settled.
      commissionsOwed: Math.max(0, totalCommission - wallet.commissionsSettled),
    };
  }, [listings, boostAllowed, wallet.commissionsSettled]);

  /**
   * Sends the draft — product photo included, as either a hotlink or the
   * upload's data URL — to the inventory API. The board is optimistic: the row
   * is already on screen, so a rejection surfaces as a banner instead of
   * yanking it back.
   */
  const publish = async (draft: ListingDraft) => {
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          details?: string[];
        } | null;
        setApiError(
          body?.details?.join(" ") ??
            "The inventory API rejected this listing.",
        );
        return;
      }
      setApiError(null);
    } catch {
      setApiError(
        "Could not reach the inventory API — this listing is only saved locally.",
      );
    }
  };

  const addListing = (draft: ListingDraft) => {
    setListings((prev) => [
      {
        ...draft,
        id: `lst-${Date.now().toString(36)}`,
        impressions: 0,
        clicks: 0,
        unitsSold: 0,
      },
      ...prev,
    ]);
    void publish(draft);
  };

  const updateListing = (draft: ListingDraft) => {
    if (!editing) return;
    setListings((prev) =>
      prev.map((l) => (l.id === editing.id ? { ...l, ...draft } : l)),
    );
    setEditing(null);
    void publish(draft);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    setListings((prev) => prev.filter((l) => l.id !== deleting.id));
    setDeleting(null);
  };

  const toggleBoost = (id: string, boostEnabled: boolean) =>
    setListings((prev) =>
      prev.map((l) => (l.id === id ? { ...l, boostEnabled } : l)),
    );

  const sidePanel = (
    <>
      <WalletCard
        wallet={wallet}
        totalSalesRevenue={summary.totalRevenue}
        commissionsOwed={summary.commissionsOwed}
        onToggleAutoRecharge={(autoRecharge) =>
          setWallet((w) => ({ ...w, autoRecharge }))
        }
        onAddFunds={() =>
          setWallet((w) => ({ ...w, adSpendBalance: w.adSpendBalance + 500 }))
        }
      />

      <section
        className="flex flex-col gap-5 rounded-2xl border border-surface-border bg-surface p-5"
        aria-labelledby="add-inventory-heading"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-accent/10 p-2 ring-1 ring-inset ring-accent/20">
            <PackagePlus className="h-4 w-4 text-accent" aria-hidden="true" />
          </span>
          <h2
            id="add-inventory-heading"
            className="font-heading text-sm font-semibold"
          >
            Add Inventory
          </h2>
        </div>
        <InventoryForm
          onSubmit={(draft) => {
            addListing(draft);
            setPanelOpen(false);
          }}
          canBoost={boostAllowed}
          submitLabel="Add listing"
        />
      </section>
    </>
  );

  return (
    <div className="px-gutter mx-auto flex max-w-7xl flex-col gap-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-bold sm:text-2xl">
          Merchant Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile.businessName} · inventory, commission, and CPC boost.
        </p>
      </div>

      <ApprovalBanner profile={profile} />

      {/* Summary strip -------------------------------------------- */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-surface-border bg-surface-border lg:grid-cols-5">
        <Summary
          icon={MousePointerClick}
          label="Clicks"
          value={summary.clicks.toLocaleString("en-US")}
        />
        <Summary
          icon={Percent}
          label="Blended CTR"
          value={`${(summary.ctr * 100).toFixed(2)}%`}
        />
        <Summary
          icon={TrendingUp}
          label="Avg. CPC"
          value={formatCurrency(summary.avgCpc, { cents: true })}
        />
        <Summary
          icon={ShoppingBag}
          label="Units sold"
          value={summary.unitsSold.toLocaleString("en-US")}
          tone="vip"
        />
        <Summary
          icon={Percent}
          label={`Commission (${Math.round(COMMISSION_RATE * 100)}%)`}
          value={formatCurrency(summary.totalCommission, { cents: true })}
          tone="amber"
        />
      </dl>

      {/* Below lg the panel moves into a drawer so the inventory list gets
          the full width. Rendered once, never duplicated across layouts. */}
      {!isDesktop && (
        <Button
          variant="secondary"
          fullWidth
          onClick={() => setPanelOpen(true)}
          leftIcon={<PanelRight className="h-4 w-4" />}
        >
          Wallet &amp; add inventory
        </Button>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {apiError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4"
            >
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-rose-300"
                aria-hidden="true"
              />
              <p className="text-sm text-rose-100">{apiError}</p>
              <button
                type="button"
                onClick={() => setApiError(null)}
                aria-label="Dismiss"
                className="ml-auto rounded-lg p-1 text-muted transition hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <AnalyticsTable
            listings={listings}
            canBoost={boostAllowed}
            onToggleBoost={toggleBoost}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
        </div>

        {isDesktop && <div className="flex flex-col gap-6">{sidePanel}</div>}
      </div>

      <SideDrawer
        open={!isDesktop && panelOpen}
        onClose={() => setPanelOpen(false)}
        title="Wallet & inventory"
      >
        {sidePanel}
      </SideDrawer>

      {/* Demo-only status switcher so both states are reachable. */}
      <StatusSwitcher
        status={profile.status}
        onChange={(status) => setProfile((p) => ({ ...p, status }))}
      />

      {/* Edit ------------------------------------------------------ */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit listing"
        description={editing?.title}
        className="sm:max-w-lg"
      >
        <div className="p-5">
          {editing && (
            <InventoryForm
              key={editing.id}
              initial={editing}
              onSubmit={updateListing}
              onCancel={() => setEditing(null)}
              canBoost={boostAllowed}
              submitLabel="Save changes"
            />
          )}
        </div>
      </Modal>

      {/* Delete ---------------------------------------------------- */}
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete listing"
        className="sm:max-w-md"
      >
        <div className="flex flex-col gap-5 p-5">
          <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-rose-300"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                Delete{" "}
                <span className="text-rose-200">{deleting?.title}</span>?
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                This removes the listing and its performance history. Sales
                already completed still settle at the next payout.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setDeleting(null)}
            >
              Keep listing
            </Button>
            <Button
              fullWidth
              onClick={confirmDelete}
              className="bg-gradient-to-r from-rose-500 to-rose-400 text-canvas shadow-none hover:from-rose-400 hover:to-rose-300 focus-visible:outline-rose-400"
            >
              Delete listing
            </Button>
          </div>
        </div>
      </Modal>

      <p className="text-center text-[11px] text-muted-foreground">
        Demo data. Listings, wallet, and approval status reset on reload.
      </p>
    </div>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Percent;
  label: string;
  value: string;
  tone?: "default" | "vip" | "amber";
}) {
  return (
    <div className="flex flex-col gap-1 bg-surface px-4 py-4">
      <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {label}
      </dt>
      <dd
        className={cn(
          "font-mono text-2xl font-semibold tabular-nums",
          tone === "vip" && "text-vip",
          tone === "amber" && "text-amber-300",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

const STATUSES: MerchantStatus[] = ["pending", "approved", "suspended"];

function StatusSwitcher({
  status,
  onChange,
}: {
  status: MerchantStatus;
  onChange: (s: MerchantStatus) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-dashed border-surface-border px-4 py-3">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Demo · account status
      </span>
      {STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          aria-pressed={status === s}
          className={cn(
            "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition",
            status === s
              ? "border-accent/50 bg-accent/10 text-accent"
              : "border-surface-border text-muted hover:text-foreground",
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
