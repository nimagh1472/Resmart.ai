import { CalendarClock, Crown } from "lucide-react";
import { formatDate, type AccountUser } from "@/lib/mock-account";

export function AccountHeader({ user }: { user: AccountUser }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-vip/25 bg-surface p-6 sm:p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-vip/10 blur-[100px]"
      />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-vip/30 bg-vip/10 font-heading text-lg font-bold text-vip-strong shadow-glow-vip"
          >
            {user.initials}
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-heading text-2xl font-bold">
                {user.name}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-vip/35 bg-vip/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-vip-strong shadow-glow-vip">
                <Crown className="h-3 w-3" aria-hidden="true" />
                VIP
              </span>
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Member since {formatDate(user.memberSince)}
            </p>
          </div>
        </div>

        <div className="shrink-0 rounded-xl border border-surface-border bg-canvas px-4 py-3">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <CalendarClock className="h-3 w-3" aria-hidden="true" />
            Renews on
          </p>
          <p className="mt-0.5 font-mono text-sm font-medium tabular-nums text-foreground">
            {formatDate(user.renewsOn)}
          </p>
        </div>
      </div>
    </section>
  );
}
