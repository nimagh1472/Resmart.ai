import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { buttonStyles } from "@/components/ui/button-styles";

export function AdminHeader() {
  return (
    <header className="pt-safe sticky top-0 z-40 border-b border-rose-500/20 bg-canvas/80 backdrop-blur-xl">
      <div className="px-gutter mx-auto flex h-16 max-w-[110rem] items-center gap-3">
        <Link
          href="/"
          className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <Logo size="sm" />
        </Link>

        {/* Rose rather than cyan: this console can move money and delete
            accounts, and should never be mistaken for the consumer app. */}
        <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-rose-300">
          <ShieldAlert className="h-3 w-3" aria-hidden="true" />
          Super Admin
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/merchants/dashboard"
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            Merchant view
          </Link>
          <Link
            href="/"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            Exit console
          </Link>
        </div>
      </div>
    </header>
  );
}
