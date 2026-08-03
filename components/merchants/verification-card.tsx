"use client";

import {
  BadgeCheck,
  Building2,
  FileCheck2,
  Globe,
  MapPin,
  Phone,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatAddress, formatPhone } from "@/lib/kyc";
import type { MerchantProfile } from "@/lib/mock-merchant";
import { cn, formatDate } from "@/lib/utils";

/**
 * Business-verification status for the merchant's own dashboard: a prompt
 * while KYC is outstanding, a read-back of what was submitted once it isn't.
 */
export function VerificationCard({
  profile,
  onOpen,
  className,
}: {
  profile: MerchantProfile;
  /** Opens the KYC form — used for both first submission and edits. */
  onOpen: () => void;
  className?: string;
}) {
  const kyc = profile.kyc;

  if (!kyc) {
    return (
      <section
        aria-labelledby="verification-heading"
        className={cn(
          "flex flex-col gap-4 rounded-2xl border border-accent/30 bg-accent-soft p-5 shadow-card sm:flex-row sm:items-center",
          className,
        )}
      >
        <span className="w-fit rounded-xl bg-surface p-2.5 ring-1 ring-inset ring-accent/25">
          <ShieldAlert className="h-5 w-5 text-accent-strong" aria-hidden="true" />
        </span>

        <div className="flex-1">
          <h2
            id="verification-heading"
            className="font-heading text-sm font-semibold text-navy"
          >
            Complete your business verification
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            We need your legal business name, Tax ID, registered address, and a
            proof-of-business document before an admin can approve the account.
            Listings stay private until then.
          </p>
        </div>

        <Button
          onClick={onOpen}
          className="w-full sm:w-auto"
          leftIcon={<BadgeCheck className="h-4 w-4" />}
        >
          Start verification
        </Button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="verification-heading"
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface p-5 shadow-card",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-accent-soft p-2 ring-1 ring-inset ring-vip/25">
          <BadgeCheck className="h-4 w-4 text-vip-strong" aria-hidden="true" />
        </span>
        <h2
          id="verification-heading"
          className="font-heading text-sm font-semibold text-navy"
        >
          Business verification
        </h2>
        <Badge
          tone={profile.status === "approved" ? "emerald" : "amber"}
          size="sm"
          className="ml-auto"
        >
          {profile.status === "approved" ? "Verified" : "Pending approval"}
        </Badge>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Row icon={Building2} label="Legal name" value={kyc.legalBusinessName} />
        <Row icon={FileCheck2} label="Tax ID / EIN" value={kyc.taxId} mono />
        <Row icon={Phone} label="Phone" value={formatPhone(kyc.phone)} mono />
        <Row icon={Globe} label="Website" value={kyc.website} />
        <Row
          icon={MapPin}
          label="Address"
          value={formatAddress(kyc)}
          className="sm:col-span-2"
        />
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-3">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <FileCheck2 className="h-3 w-3" aria-hidden="true" />
          {kyc.document?.name ?? "No document attached"} · submitted{" "}
          {formatDate(profile.submittedOn)}
        </p>
        <Button variant="secondary" size="sm" onClick={onOpen}>
          Update details
        </Button>
      </div>
    </section>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  mono,
  className,
}: {
  icon: typeof Globe;
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-sm text-navy",
          mono && "font-mono tabular-nums",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
