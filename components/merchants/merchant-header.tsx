import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { buttonStyles } from "@/components/ui/button-styles";

/** Slim B2B header — the consumer navbar's ticker and VIP CTA don't belong here. */
export function MerchantHeader({
  action = "dashboard",
}: {
  action?: "dashboard" | "exit";
}) {
  return (
    <header className="pt-safe sticky top-0 z-40 border-b border-surface-border bg-surface/85 backdrop-blur-xl">
      <div className="px-gutter mx-auto flex h-16 max-w-7xl items-center gap-3">
        <Link
          href="/"
          className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <Logo size="sm" />
        </Link>
        <span className="rounded-md border border-surface-border bg-surface px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted">
          Merchant Portal
        </span>

        <div className="ml-auto flex items-center gap-2">
          {action === "dashboard" ? (
            <>
              <Link
                href="/merchants/dashboard"
                className={buttonStyles({ variant: "ghost", size: "sm" })}
              >
                Sign In
              </Link>
              <Link
                href="/merchants/dashboard"
                className={buttonStyles({ size: "sm" })}
              >
                Open Dashboard
              </Link>
            </>
          ) : (
            <Link
              href="/merchants"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              Exit Dashboard
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
