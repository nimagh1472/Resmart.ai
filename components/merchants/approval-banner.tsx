import { AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import type { MerchantProfile } from "@/lib/mock-merchant";
import { cn, formatDate } from "@/lib/utils";

/**
 * Account-status notice. Renders nothing for approved merchants — an
 * always-present "you're fine" banner trains people to ignore the slot.
 */
export function ApprovalBanner({
  profile,
  className,
}: {
  profile: MerchantProfile;
  className?: string;
}) {
  if (profile.status === "approved") return null;

  if (profile.status === "suspended") {
    return (
      <section
        role="alert"
        className={cn(
          "flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/[0.06] p-4",
          className,
        )}
      >
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-rose-300"
          aria-hidden="true"
        />
        <div>
          <h2 className="font-heading text-sm font-semibold text-rose-200">
            Account suspended
          </h2>
          <p className="mt-1 text-sm text-rose-200/70">
            Your listings have been removed from public search. Contact
            merchant support to resolve the issue.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-4 sm:flex-row sm:items-start",
        className,
      )}
    >
      <Clock
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"
        aria-hidden="true"
      />

      <div className="flex-1">
        <h2 className="font-heading text-sm font-semibold text-amber-200">
          Pending Admin Approval
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-amber-200/75">
          <span className="font-medium">{profile.businessName}</span> is under
          review. You can add and edit inventory now, but{" "}
          <span className="font-medium">
            nothing appears in public search and CPC boost cannot be enabled
          </span>{" "}
          until an admin approves the account.
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-amber-200/60">
          <span>Submitted {formatDate(profile.submittedOn)}</span>
          <span>Typical review · {profile.reviewEtaHours}h</span>
        </p>
      </div>

      <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-amber-200">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        Review in progress
      </span>
    </section>
  );
}
