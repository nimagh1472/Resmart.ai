"use client";

import { Bookmark, BookmarkCheck, ImageIcon, Link2, ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button-styles";
import { formatDate, type VisionScan } from "@/lib/mock-account";
import { cn, formatCurrency } from "@/lib/utils";

export function VisionHistoryTab({
  scans,
  onToggleSaved,
  onRescan,
}: {
  scans: VisionScan[];
  onToggleSaved: (id: string, saved: boolean) => void;
  onRescan: (id: string) => void;
}) {
  if (scans.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-surface-border py-16 text-center text-sm text-muted-foreground">
        No scans yet. Upload a screenshot from the search bar to get started.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {scans.map((scan) => {
        const savings = scan.retailPrice - scan.bestPrice;
        const pct = Math.round((savings / scan.retailPrice) * 100);

        return (
          <li
            key={scan.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface transition-colors hover:border-accent/40"
          >
            {/* Thumbnail placeholder — original uploads aren't retained. */}
            <div className="relative flex aspect-[16/10] items-center justify-center border-b border-surface-border bg-gradient-to-br from-surface to-canvas">
              {scan.source === "screenshot" ? (
                <ImageIcon className="h-8 w-8 text-surface-border" aria-hidden="true" />
              ) : (
                <Link2 className="h-8 w-8 text-surface-border" aria-hidden="true" />
              )}

              <span className="absolute left-3 top-3">
                <Badge tone={scan.source === "screenshot" ? "sky" : "slate"} size="sm">
                  {scan.source === "screenshot" ? "Screenshot" : "Link"}
                </Badge>
              </span>

              <button
                type="button"
                onClick={() => onToggleSaved(scan.id, !scan.saved)}
                aria-pressed={scan.saved}
                aria-label={
                  scan.saved
                    ? `Unsave comparison for ${scan.identified}`
                    : `Save comparison for ${scan.identified}`
                }
                className={cn(
                  "absolute right-3 top-3 rounded-lg border p-1.5 backdrop-blur transition",
                  scan.saved
                    ? "border-vip/35 bg-vip/10 text-vip"
                    : "border-surface-border bg-canvas/70 text-muted hover:text-foreground",
                )}
              >
                {scan.saved ? (
                  <BookmarkCheck className="h-3.5 w-3.5" />
                ) : (
                  <Bookmark className="h-3.5 w-3.5" />
                )}
              </button>

              <span className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-md bg-canvas/80 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur">
                {scan.sourceLabel}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-3 p-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Identified
                </p>
                <h3 className="font-heading text-sm font-medium leading-snug">
                  {scan.identified}
                </h3>
              </div>

              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Best match
                  </p>
                  <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
                    {formatCurrency(scan.bestPrice)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs tabular-nums text-vip">
                    −{formatCurrency(savings)} ({pct}%)
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {scan.matches} match{scan.matches === 1 ? "" : "es"}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Scanned {formatDate(scan.scannedOn)}
              </p>

              <button
                type="button"
                onClick={() => onRescan(scan.id)}
                className={buttonStyles({
                  variant: "secondary",
                  size: "sm",
                  fullWidth: true,
                  className: "mt-auto",
                })}
              >
                <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
                Re-run comparison
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
