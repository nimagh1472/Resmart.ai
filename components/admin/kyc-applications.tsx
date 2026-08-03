"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  Check,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatPhone, type KycStatus, type MerchantKyc } from "@/lib/kyc";
import { cn, formatDate } from "@/lib/utils";

/** The `/api/merchants` view of an application. */
export type AdminApplication = {
  id: string;
  status: KycStatus;
  statusLabel: string;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  businessName: string;
  contactEmail: string;
  address: string;
  kyc: Omit<MerchantKyc, "document"> & {
    document: {
      name: string;
      sizeBytes: number;
      mediaType: string;
      dataUrl: string;
    } | null;
  };
};

const STATUS_TONE = {
  pending: "amber",
  approved: "emerald",
  rejected: "rose",
} as const;

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Merchant KYC review. Reads the applications the onboarding form posted to
 * `/api/merchants` and writes decisions back to the same route, so approving
 * here is what actually flips a merchant out of "Pending Approval" — the list
 * is refetched from the response rather than guessed at locally.
 */
export function KycApplications({ className }: { className?: string }) {
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<AdminApplication | null>(null);
  const [rejecting, setRejecting] = useState<AdminApplication | null>(null);
  const [reason, setReason] = useState("");
  const [deciding, setDeciding] = useState<string | null>(null);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/merchants", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { applications: AdminApplication[] };
      setApplications(body.applications);
    } catch {
      setLoadError("Could not load merchant applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (
    app: AdminApplication,
    decision: "approve" | "reject",
    rejectionReason?: string,
  ) => {
    setDeciding(app.id);
    try {
      const res = await fetch("/api/merchants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: app.id, decision, reason: rejectionReason }),
      });

      const body = (await res.json().catch(() => null)) as {
        merchant?: AdminApplication;
        details?: string[];
      } | null;

      if (!res.ok || !body?.merchant) {
        toast({
          tone: "error",
          title: `Could not ${decision} ${app.businessName}`,
          description:
            body?.details?.[0] ?? "The review service rejected the decision.",
        });
        return;
      }

      const updated = body.merchant;
      setApplications((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a)),
      );
      setInspecting(null);
      setRejecting(null);
      setReason("");

      toast(
        decision === "approve"
          ? {
              tone: "success",
              title: `${updated.businessName} approved`,
              description:
                "The merchant can now publish listings and enable CPC boost.",
            }
          : {
              tone: "info",
              title: `${updated.businessName} rejected`,
              description: `Reason sent to ${updated.contactEmail}.`,
            },
      );
    } catch {
      toast({
        tone: "error",
        title: "Decision not saved",
        description: "Could not reach the review service. Try again.",
      });
    } finally {
      setDeciding(null);
    }
  };

  const pending = applications.filter((a) => a.status === "pending");
  const decided = applications.filter((a) => a.status !== "pending");

  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border border-surface-border bg-surface shadow-card",
        className,
      )}
      aria-labelledby="kyc-heading"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-border p-5">
        <span className="rounded-lg bg-accent-soft p-2 ring-1 ring-inset ring-vip/25">
          <ShieldCheck className="h-4 w-4 text-vip-strong" aria-hidden="true" />
        </span>
        <h2 id="kyc-heading" className="font-heading text-sm font-semibold">
          Merchant KYC Applications
        </h2>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {pending.length} awaiting review
        </span>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh applications"
          className="rounded-lg p-1.5 text-muted transition hover:bg-surface-raised hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {loadError && (
        <p role="alert" className="px-5 py-4 text-sm text-rose-700">
          {loadError}
        </p>
      )}

      {loading && applications.length === 0 && (
        <p className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading applications…
        </p>
      )}

      {!loading && applications.length === 0 && !loadError && (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">
          No merchant applications have been submitted.
        </p>
      )}

      <ul className="flex flex-col divide-y divide-surface-border">
        <AnimatePresence initial={false}>
          {[...pending, ...decided].map((app) => (
            <motion.li
              key={app.id}
              layout
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-navy">
                    {app.businessName}
                  </p>
                  <Badge tone={STATUS_TONE[app.status]} size="sm">
                    {app.statusLabel}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {app.contactEmail}
                </p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>EIN {app.kyc.taxId}</span>
                  <span>
                    {app.kyc.city}, {app.kyc.state}
                  </span>
                  <span>{formatDate(app.submittedAt)}</span>
                </p>
                {app.rejectionReason && (
                  <p className="mt-1 text-[11px] text-rose-700">
                    Rejected — {app.rejectionReason}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setInspecting(app)}
                  leftIcon={<ScanSearch className="h-3.5 w-3.5" />}
                >
                  Inspect
                </Button>
                {app.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      variant="success"
                      disabled={deciding === app.id}
                      onClick={() => void decide(app, "approve")}
                      leftIcon={
                        deciding === app.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )
                      }
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
                  </>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {/* Full submission ------------------------------------------- */}
      <Modal
        open={inspecting !== null}
        onClose={() => setInspecting(null)}
        title="Merchant KYC application"
        description={inspecting?.businessName}
        className="sm:max-w-2xl"
      >
        {inspecting && (
          <div className="flex flex-col gap-5 p-5">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail
                icon={Building2}
                label="Legal business name"
                value={inspecting.kyc.legalBusinessName}
              />
              <Detail
                icon={FileText}
                label="Tax ID / EIN"
                value={inspecting.kyc.taxId}
                mono
              />
              <Detail
                icon={Mail}
                label="Business email"
                value={inspecting.contactEmail}
                href={`mailto:${inspecting.contactEmail}`}
              />
              <Detail
                icon={Phone}
                label="Phone"
                value={formatPhone(inspecting.kyc.phone)}
                href={`tel:${inspecting.kyc.phone}`}
                mono
              />
              <Detail
                icon={ExternalLink}
                label="Website / social"
                value={inspecting.kyc.website}
                href={inspecting.kyc.website}
                external
                className="sm:col-span-2"
              />
              <Detail
                icon={MapPin}
                label="Business physical address"
                value={inspecting.address}
                className="sm:col-span-2"
              />
            </dl>

            {/* Proof of business ----------------------------------- */}
            <div className="rounded-xl border border-surface-border bg-canvas p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Proof of business
              </p>

              {inspecting.kyc.document ? (
                <div className="mt-2.5 flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-surface-border bg-surface">
                    {inspecting.kyc.document.mediaType.startsWith("image/") ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- inline data URL; next/image can't take one */
                      <img
                        src={inspecting.kyc.document.dataUrl}
                        alt="Submitted proof of business"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileText
                        className="h-5 w-5 text-muted"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy">
                      {inspecting.kyc.document.name}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {inspecting.kyc.document.mediaType} ·{" "}
                      {formatBytes(inspecting.kyc.document.sizeBytes)}
                    </p>
                  </div>
                  <a
                    href={inspecting.kyc.document.dataUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={inspecting.kyc.document.name}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-navy transition hover:border-accent hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                  >
                    <ImageIcon className="h-3 w-3" aria-hidden="true" />
                    Open
                  </a>
                </div>
              ) : (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-700">
                  No document attached — approval blocked.
                </p>
              )}
            </div>

            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Submitted {formatDate(inspecting.submittedAt)}
              {inspecting.reviewedAt &&
                ` · reviewed ${formatDate(inspecting.reviewedAt)}`}
            </p>

            {inspecting.status === "pending" ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setRejecting(inspecting)}
                  leftIcon={<X className="h-4 w-4" />}
                >
                  Reject Application
                </Button>
                <Button
                  variant="success"
                  fullWidth
                  disabled={
                    deciding === inspecting.id || !inspecting.kyc.document
                  }
                  onClick={() => void decide(inspecting, "approve")}
                  leftIcon={
                    deciding === inspecting.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )
                  }
                >
                  Approve Merchant
                </Button>
              </div>
            ) : (
              <p className="rounded-xl border border-surface-border bg-canvas px-3.5 py-2.5 text-sm text-muted">
                This application was already {inspecting.status}.
                {inspecting.rejectionReason &&
                  ` Reason: ${inspecting.rejectionReason}`}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Reject ----------------------------------------------------- */}
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
              placeholder="The uploaded certificate does not match the registered business name."
              className="w-full resize-none rounded-xl border border-surface-border bg-canvas px-3 py-2.5 text-sm text-navy placeholder:text-muted-foreground focus:border-rose-500 focus:bg-surface focus:outline-none focus:ring-1 focus:ring-rose-500/40"
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
              disabled={!reason.trim() || deciding === rejecting?.id}
              onClick={() =>
                rejecting && void decide(rejecting, "reject", reason.trim())
              }
              className="bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-none hover:from-rose-500 hover:to-rose-400 focus-visible:outline-rose-500"
            >
              Reject application
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  href,
  external,
  mono,
  className,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {label}
      </dt>
      <dd className={cn("mt-0.5 break-words text-sm text-navy", mono && "font-mono")}>
        {href ? (
          <a
            href={href}
            {...(external
              ? { target: "_blank", rel: "noreferrer noopener" }
              : {})}
            className="underline decoration-surface-border underline-offset-2 transition hover:text-accent-strong hover:decoration-accent"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
