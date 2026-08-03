"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CircleAlert,
  CircleDashed,
  CircleSlash,
  ClipboardList,
  FileWarning,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  DOCUMENT_LABELS,
  isApprovable,
  type DocumentStatus,
  type MerchantApplication,
} from "@/lib/mock-admin";
import { cn, formatDate } from "@/lib/utils";

const DOC_STYLES: Record<
  DocumentStatus,
  { icon: typeof Check; className: string; label: string }
> = {
  verified: {
    icon: Check,
    className: "border-vip/30 bg-vip/10 text-vip-strong",
    label: "Verified",
  },
  pending: {
    icon: CircleDashed,
    className: "border-surface-border bg-surface-raised text-muted",
    label: "In review",
  },
  missing: {
    icon: CircleAlert,
    className: "border-amber-400/30 bg-amber-400/10 text-amber-600",
    label: "Missing",
  },
  rejected: {
    icon: CircleSlash,
    className: "border-rose-500/30 bg-rose-500/10 text-rose-600",
    label: "Rejected",
  },
};

/** Document status chips plus the blocking explanation, shared by both layouts. */
function DocPills({ app }: { app: MerchantApplication }) {
  const keys = Object.keys(app.documents) as (keyof typeof app.documents)[];
  const blocked = keys.filter(
    (k) => app.documents[k] === "missing" || app.documents[k] === "rejected",
  );

  return (
    <>
      <ul className="flex flex-wrap gap-1.5">
        {keys.map((key) => {
          const style = DOC_STYLES[app.documents[key]];
          return (
            <li key={key}>
              <span
                title={`${DOCUMENT_LABELS[key]}: ${style.label}`}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                  style.className,
                )}
              >
                <style.icon className="h-2.5 w-2.5" aria-hidden="true" />
                {DOCUMENT_LABELS[key]}
              </span>
            </li>
          );
        })}
      </ul>

      {blocked.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-600/80">
          <FileWarning className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
          Approval blocked —{" "}
          {blocked.map((k) => DOCUMENT_LABELS[k]).join(", ")}
        </p>
      )}
    </>
  );
}

export function ApprovalQueue({
  applications,
  onApprove,
  onReject,
  onRequestDocs,
  className,
}: {
  applications: MerchantApplication[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onRequestDocs: (id: string) => void;
  className?: string;
}) {
  const [rejecting, setRejecting] = useState<MerchantApplication | null>(null);
  const [reason, setReason] = useState("");
  const [requested, setRequested] = useState<string[]>([]);

  const submitReject = () => {
    if (!rejecting || !reason.trim()) return;
    onReject(rejecting.id, reason.trim());
    setRejecting(null);
    setReason("");
  };

  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border border-surface-border bg-surface shadow-card",
        className,
      )}
      aria-labelledby="queue-heading"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-border p-5">
        <span className="rounded-lg bg-amber-400/10 p-2 ring-1 ring-inset ring-amber-400/20">
          <ClipboardList
            className="h-4 w-4 text-amber-600"
            aria-hidden="true"
          />
        </span>
        <h2 id="queue-heading" className="font-heading text-sm font-semibold">
          Merchant Approval Queue
        </h2>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {applications.length} pending
        </span>
      </div>

      {/* Card list below lg; the table needs 62rem to stay legible. */}
      <ul className="flex flex-col divide-y divide-surface-border/60 lg:hidden">
        <AnimatePresence initial={false}>
          {applications.map((app) => {
            const approvable = isApprovable(app);
            return (
              <motion.li
                key={app.id}
                layout
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-3 overflow-hidden p-4"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {app.businessName}
                  </p>
                  <p className="break-all text-xs text-muted-foreground">
                    {app.contactEmail}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>{app.category}</span>
                    <span>{app.listingsQueued.toLocaleString("en-US")} queued</span>
                    <span>{formatDate(app.submittedOn)}</span>
                  </p>
                </div>

                <DocPills app={app} />

                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      fullWidth
                      disabled={!approvable}
                      onClick={() => onApprove(app.id)}
                      leftIcon={<Check className="h-3.5 w-3.5" />}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      fullWidth
                      onClick={() => setRejecting(app)}
                      leftIcon={<X className="h-3.5 w-3.5" />}
                    >
                      Reject
                    </Button>
                  </div>
                  {!approvable && (
                    <button
                      type="button"
                      onClick={() => {
                        onRequestDocs(app.id);
                        setRequested((r) => [...r, app.id]);
                      }}
                      disabled={requested.includes(app.id)}
                      className="min-h-touch-sm font-mono text-[10px] uppercase tracking-wider text-accent-strong transition disabled:text-muted-foreground"
                    >
                      {requested.includes(app.id)
                        ? "Documents requested ✓"
                        : "Request documents"}
                    </button>
                  )}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>

        {applications.length === 0 && (
          <li className="px-5 py-12 text-center text-sm text-muted-foreground">
            Queue is clear. No applications awaiting review.
          </li>
        )}
      </ul>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[62rem] border-collapse text-sm">
          <caption className="sr-only">
            Pending merchant applications awaiting approval
          </caption>
          <thead>
            <tr className="border-b border-surface-border">
              {["Business", "Documents", "Listings queued", "Submitted", "Decision"].map(
                (h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={cn(
                      "px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
                      i === 0 ? "text-left" : "text-right",
                      i === 1 && "text-left",
                    )}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>

          <tbody>
            <AnimatePresence initial={false}>
              {applications.map((app) => {
                const approvable = isApprovable(app);

                return (
                  <motion.tr
                    key={app.id}
                    layout
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-b border-surface-border/60 align-top transition-colors hover:bg-surface-raised/40"
                  >
                    <td className="max-w-xs px-5 py-4">
                      <p className="truncate font-medium text-foreground">
                        {app.businessName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {app.contactEmail}
                      </p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {app.category}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <DocPills app={app} />
                    </td>

                    <td className="px-5 py-4 text-right font-mono tabular-nums text-muted">
                      {app.listingsQueued.toLocaleString("en-US")}
                    </td>

                    <td className="px-5 py-4 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {formatDate(app.submittedOn)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="success"
                            disabled={!approvable}
                            onClick={() => onApprove(app.id)}
                            leftIcon={<Check className="h-3.5 w-3.5" />}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setRejecting(app)}
                            leftIcon={<X className="h-3.5 w-3.5" />}
                          >
                            Reject
                          </Button>
                        </div>

                        {/* Blocked rows would otherwise be dead ends. */}
                        {!approvable && (
                          <button
                            type="button"
                            onClick={() => {
                              onRequestDocs(app.id);
                              setRequested((r) => [...r, app.id]);
                            }}
                            disabled={requested.includes(app.id)}
                            className="font-mono text-[10px] uppercase tracking-wider text-accent-strong transition hover:text-accent-hover disabled:text-muted-foreground"
                          >
                            {requested.includes(app.id)
                              ? "Documents requested ✓"
                              : "Request documents"}
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>

            {applications.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-12 text-center text-sm text-muted-foreground"
                >
                  Queue is clear. No applications awaiting review.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Reject ---------------------------------------------------- */}
      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="Reject application"
        description={rejecting?.businessName}
        className="sm:max-w-md"
      >
        <div className="flex flex-col gap-4 p-5">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Reason (sent to the merchant)
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Reseller certificate does not match the registered business name."
              className="w-full resize-none rounded-xl border border-surface-border bg-canvas px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/40"
            />
          </label>
          <p className="text-[11px] text-muted-foreground">
            A reason is required — rejections without one generate support
            tickets instead of resubmissions.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setRejecting(null)}
            >
              Cancel
            </Button>
            <Button
              fullWidth
              disabled={!reason.trim()}
              onClick={submitReject}
              className="bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-none hover:from-rose-500 hover:to-rose-400 focus-visible:outline-rose-400"
            >
              Reject application
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
