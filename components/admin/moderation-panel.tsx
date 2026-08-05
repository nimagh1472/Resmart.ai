"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  Bot,
  Crown,
  Flag,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Undo2,
  Users,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  FLAG_LABELS,
  type FlaggedListing,
  type PlatformUser,
} from "@/lib/mock-admin";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type TabId = "users" | "listings";

export function ModerationPanel({
  users,
  flagged,
  onToggleVip,
  onToggleSuspended,
  onDeleteListing,
  onDismissFlag,
  className,
}: {
  users: PlatformUser[];
  flagged: FlaggedListing[];
  onToggleVip: (id: string, isVip: boolean) => void;
  onToggleSuspended: (id: string, suspended: boolean) => void;
  onDeleteListing: (id: string) => void;
  onDismissFlag: (id: string) => void;
  className?: string;
}) {
  const [tab, setTab] = useState<TabId>("users");
  const [deleting, setDeleting] = useState<FlaggedListing | null>(null);

  const TABS: { id: TabId; label: string; icon: typeof Users; count: number }[] =
    [
      { id: "users", label: "Registered users", icon: Users, count: users.length },
      { id: "listings", label: "Flagged listings", icon: Flag, count: flagged.length },
    ];

  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border border-surface-border bg-surface shadow-card",
        className,
      )}
      aria-labelledby="moderation-heading"
    >
      <div className="flex flex-wrap items-center gap-4 border-b border-surface-border px-5 pt-4">
        <h2 id="moderation-heading" className="sr-only">
          User and product moderation
        </h2>
        <div role="tablist" aria-label="Moderation sections" className="flex gap-4">
          {TABS.map(({ id, label, icon: Icon, count }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                role="tab"
                id={`mod-tab-${id}`}
                aria-selected={active}
                aria-controls={`mod-panel-${id}`}
                onClick={() => setTab(id)}
                className={cn(
                  "relative flex items-center gap-2 pb-3 text-sm transition",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  active ? "text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("h-4 w-4", active && "text-accent-strong")}
                  aria-hidden="true"
                />
                {label}
                <span className="rounded-full bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {count}
                </span>
                {active && (
                  <motion.span
                    layoutId="mod-underline"
                    className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`mod-panel-${tab}`}
        aria-labelledby={`mod-tab-${tab}`}
        tabIndex={0}
        className="focus-visible:outline-none"
      >
        {tab === "users" ? (
          <UsersTable
            users={users}
            onToggleVip={onToggleVip}
            onToggleSuspended={onToggleSuspended}
          />
        ) : (
          <FlaggedList
            flagged={flagged}
            onDismiss={onDismissFlag}
            onRequestDelete={setDeleting}
          />
        )}
      </div>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete listing"
        className="sm:max-w-md"
      >
        <div className="flex flex-col gap-5 p-5">
          <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
            <TriangleAlert
              className="mt-0.5 h-5 w-5 shrink-0 text-rose-600"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                Remove <span className="text-rose-700">{deleting?.title}</span>?
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The listing is pulled from search immediately and{" "}
                {deleting?.merchant} is notified with the flag reason. Completed
                orders are unaffected.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" fullWidth onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              fullWidth
              onClick={() => {
                if (deleting) onDeleteListing(deleting.id);
                setDeleting(null);
              }}
              className="bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-none hover:from-rose-500 hover:to-rose-400 focus-visible:outline-rose-400"
            >
              Delete listing
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function UsersTable({
  users,
  onToggleVip,
  onToggleSuspended,
}: {
  users: PlatformUser[];
  onToggleVip: (id: string, isVip: boolean) => void;
  onToggleSuspended: (id: string, suspended: boolean) => void;
}) {
  return (
    <>
      {/* Card list below lg — six columns don't fit a phone. */}
      <ul className="flex flex-col divide-y divide-surface-border/60 lg:hidden">
        {users.map((u) => (
          <li
            key={u.id}
            className={cn(
              "flex flex-col gap-3 p-4",
              u.status === "suspended" && "opacity-60",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{u.name}</p>
              {u.isVip && (
                <Badge tone="emerald" size="sm" icon={<Crown className="h-3 w-3" />}>
                  VIP
                </Badge>
              )}
              {u.status === "suspended" && (
                <Badge tone="rose" size="sm">
                  Suspended
                </Badge>
              )}
            </div>
            <p className="-mt-2 break-all text-xs text-muted-foreground">
              {u.email}
            </p>

            {u.flagReason && (
              <p className="flex items-start gap-1.5 text-[11px] text-amber-600/80">
                <TriangleAlert className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
                {u.flagReason}
              </p>
            )}

            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-surface-border bg-canvas p-3">
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  Joined
                </dt>
                <dd className="font-mono text-xs tabular-nums">
                  {formatDate(u.joinedOn)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  Spend
                </dt>
                <dd className="font-mono text-xs tabular-nums">
                  {formatCurrency(u.lifetimeSpend)}
                </dd>
              </div>
            </dl>

            <div className="flex items-center justify-between gap-3">
              <Switch
                checked={u.isVip}
                onCheckedChange={(v) => onToggleVip(u.id, v)}
                label="VIP badge"
                showLabel
                size="sm"
              />
              <SuspendButton user={u} onToggle={onToggleSuspended} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[62rem] border-collapse text-sm">
        <caption className="sr-only">Registered users</caption>
        <thead>
          <tr className="border-b border-surface-border">
            {[
              ["User", "left"],
              ["Joined", "right"],
              ["Lifetime spend", "right"],
              ["VIP badge", "right"],
              ["Account", "right"],
            ].map(([label, align]) => (
              <th
                key={label}
                scope="col"
                className={cn(
                  "px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
                  align === "left" ? "text-left" : "text-right",
                )}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {users.map((u) => (
            <tr
              key={u.id}
              className={cn(
                "border-b border-surface-border/60 transition-colors hover:bg-surface-raised/40",
                u.status === "suspended" && "opacity-60",
              )}
            >
              <td className="max-w-xs px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-foreground">{u.name}</p>
                  {u.isVip && (
                    <Badge tone="emerald" size="sm" icon={<Crown className="h-3 w-3" />}>
                      VIP
                    </Badge>
                  )}
                  {u.status === "suspended" && (
                    <Badge tone="rose" size="sm">
                      Suspended
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                {u.flagReason && (
                  <p className="mt-1 flex items-start gap-1.5 text-[11px] text-amber-600/80">
                    <TriangleAlert
                      className="mt-px h-3 w-3 shrink-0"
                      aria-hidden="true"
                    />
                    {u.flagReason}
                  </p>
                )}
              </td>

              <td className="px-5 py-3.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                {formatDate(u.joinedOn)}
              </td>
              <td className="px-5 py-3.5 text-right font-mono tabular-nums text-muted">
                {formatCurrency(u.lifetimeSpend, { cents: true })}
              </td>

              <td className="px-5 py-3.5">
                <div className="flex justify-end">
                  <Switch
                    checked={u.isVip}
                    onCheckedChange={(v) => onToggleVip(u.id, v)}
                    label={`VIP badge for ${u.name}`}
                    size="sm"
                  />
                </div>
              </td>

              <td className="px-5 py-3.5 text-right">
                <SuspendButton user={u} onToggle={onToggleSuspended} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

function SuspendButton({
  user,
  onToggle,
}: {
  user: PlatformUser;
  onToggle: (id: string, suspended: boolean) => void;
}) {
  const suspended = user.status === "suspended";
  return (
    <button
      type="button"
      onClick={() => onToggle(user.id, !suspended)}
      className={cn(
        "touch-target inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition",
        suspended
          ? "border-vip/30 text-vip-strong hover:bg-vip/10"
          : "border-surface-border text-muted hover:border-rose-500/40 hover:text-rose-600",
      )}
    >
      {suspended ? (
        <>
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          Reinstate
        </>
      ) : (
        <>
          <Ban className="h-3 w-3" aria-hidden="true" />
          Suspend
        </>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */

function FlaggedList({
  flagged,
  onDismiss,
  onRequestDelete,
}: {
  flagged: FlaggedListing[];
  onDismiss: (id: string) => void;
  onRequestDelete: (l: FlaggedListing) => void;
}) {
  if (flagged.length === 0) {
    return (
      <p className="px-5 py-14 text-center text-sm text-muted-foreground">
        No flagged listings. The moderation queue is clear.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-surface-border/60">
      <AnimatePresence initial={false}>
        {flagged.map((l) => (
          <motion.li
            key={l.id}
            layout
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="rose" size="sm">
                    {FLAG_LABELS[l.reason]}
                  </Badge>
                  {l.autoFlagged ? (
                    <Badge tone="sky" size="sm" icon={<Bot className="h-3 w-3" />}>
                      AI flagged
                    </Badge>
                  ) : (
                    <Badge tone="amber" size="sm">
                      {l.reports} user reports
                    </Badge>
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {formatDate(l.reportedOn)}
                  </span>
                </div>

                <h3 className="mt-2 font-heading text-sm font-medium leading-snug">
                  {l.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {l.merchant} · listed as {l.statedCondition} ·{" "}
                  <span className="font-mono">{formatCurrency(l.price)}</span>
                  <span className="ml-1 font-mono line-through opacity-60">
                    {formatCurrency(l.msrp)}
                  </span>
                </p>

                <p className="mt-2 max-w-2xl rounded-lg bg-surface-raised/60 px-3 py-2 text-xs leading-relaxed text-muted">
                  {l.detail}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onDismiss(l.id)}
                  leftIcon={<Undo2 className="h-3.5 w-3.5" />}
                >
                  Dismiss flag
                </Button>
                <Button
                  size="sm"
                  onClick={() => onRequestDelete(l)}
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                  className="bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-none hover:from-rose-500 hover:to-rose-400 focus-visible:outline-rose-400"
                >
                  Delete
                </Button>
              </div>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
