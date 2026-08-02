"use client";

import { useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProductGalleryProps {
  /** Ordered shots. An empty list renders the placeholder frame. */
  images: string[];
  /** Describes the product, not the shot — the index is appended per image. */
  alt: string;
  className?: string;
}

/**
 * Main frame plus thumbnail strip. Images are hotlinked from retailer CDNs, so
 * any of them can 404 at any time; a failed load falls back to the placeholder
 * rather than leaving a broken frame, and the thumb for it is dropped.
 */
export function ProductGallery({ images, alt, className }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(new Set());

  const usable = images.filter((_, i) => !failed.has(i));
  const src = failed.has(active) ? undefined : images[active];

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-surface-border bg-canvas">
        {src ? (
          <Image
            src={src}
            alt={`${alt} — view ${active + 1} of ${images.length}`}
            fill
            priority
            sizes="(min-width: 1024px) 42vw, 100vw"
            onError={() =>
              setFailed((prev) => new Set(prev).add(active))
            }
            className="object-contain p-6"
          />
        ) : (
          <div
            role="img"
            aria-label={`${alt} — no photo available`}
            className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-surface to-canvas"
          >
            <Package
              className="h-14 w-14 text-surface-border"
              aria-hidden="true"
            />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Photo unavailable
            </span>
          </div>
        )}
      </div>

      {usable.length > 1 && (
        <ul className="grid grid-cols-4 gap-3">
          {images.map((img, i) =>
            failed.has(i) ? null : (
              <li key={img}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Show view ${i + 1}`}
                  aria-current={i === active}
                  className={cn(
                    "relative block aspect-square w-full overflow-hidden rounded-xl border bg-canvas transition",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    i === active
                      ? "border-accent/60"
                      : "border-surface-border hover:border-accent/30",
                  )}
                >
                  <Image
                    src={img}
                    alt=""
                    fill
                    sizes="12vw"
                    onError={() => setFailed((prev) => new Set(prev).add(i))}
                    className="object-contain p-2"
                  />
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
