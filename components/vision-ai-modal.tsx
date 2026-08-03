"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ImageUp,
  Link2,
  Loader2,
  ScanLine,
  Sparkles,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge, ConditionBadge, type ProductCondition } from "@/components/ui/badge";
import { productHref } from "@/components/ProductCard";
import { cn, formatCurrency } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* API contract — mirrors /app/api/vision/route.ts                     */
/* ------------------------------------------------------------------ */

type Extraction = {
  identified: boolean;
  confidence: "high" | "medium" | "low";
  productName: string;
  brand: string | null;
  model: string | null;
  modelNumber: string | null;
  category: string;
  categoryLabel: string;
  condition: ProductCondition;
  conditionLabel: string;
  conditionStated: string | null;
  estimatedMsrp: number;
  msrpSource: "listed" | "estimated";
  listedPrice: number | null;
  retailer: string | null;
  specifications: Record<string, string | null>;
  searchKeywords: string[];
  notes: string | null;
};

type CatalogMatch = {
  id: string;
  title: string;
  conditionLabel: string;
  condition: ProductCondition;
  msrp: number;
  price: number;
  savings: number;
  offerCount: number;
};

type ProjectedOffer = {
  id: string;
  merchantLabel: string;
  condition: ProductCondition;
  price: number;
  shipping: number;
  cashback: number;
  stock: string;
};

type ScanResult = {
  source: "claude-vision" | "claude-text" | "heuristic";
  degraded: boolean;
  message?: string;
  extraction: Extraction;
  /** Listings confirmed to be the scanned product. */
  catalogMatches: CatalogMatch[];
  /** Same class of product, but not the one that was scanned. */
  relatedMatches: CatalogMatch[];
  projectedOffers: ProjectedOffer[];
};

const SCAN_STAGES: { label: string; until: number }[] = [
  { label: "Uploading capture…", until: 18 },
  { label: "Detecting product region…", until: 38 },
  { label: "Extracting model identifiers…", until: 62 },
  { label: "Cross-referencing 12.4M listings…", until: 88 },
  { label: "Ranking open-box matches…", until: 101 },
];

const currentStage = (progress: number) =>
  SCAN_STAGES.find((s) => progress < s.until)?.label ?? "Finalizing…";

/** Reads a File into the `data:image/png;base64,…` form the API accepts. */
function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

/* ------------------------------------------------------------------ */

type Phase = "idle" | "scanning" | "result" | "error";

export function VisionAiModal({
  open,
  onClose,
  initialQuery = "",
}: {
  open: boolean;
  onClose: () => void;
  /** Whatever is in the search bar, passed to the model as user context. */
  initialQuery?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Bumped on reset/close so an in-flight request can't land on a stale view.
  const requestId = useRef(0);

  // Release the blob whenever the preview is replaced or cleared.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // Reset once the close animation has played out.
  useEffect(() => {
    if (open) return;
    const id = setTimeout(() => {
      requestId.current += 1;
      setPhase("idle");
      setProgress(0);
      setDragging(false);
      setUrl("");
      setFileName(null);
      setPreviewUrl(null);
      setResult(null);
      setError(null);
    }, 250);
    return () => clearTimeout(id);
  }, [open]);

  /**
   * Creep toward 90% while the request is in flight — the real call has no
   * progress events, and a bar frozen at 0 reads as a hang. The jump to 100
   * happens when the response lands.
   */
  useEffect(() => {
    if (phase !== "scanning") return;
    const id = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : Math.min(90, p + 1.8)));
    }, 55);
    return () => clearInterval(id);
  }, [phase]);

  const analyze = useCallback(
    async (payload: {
      image?: string;
      filename?: string;
      url?: string;
      hint?: string;
    }) => {
      const ticket = ++requestId.current;
      setError(null);
      setResult(null);
      setProgress(0);
      setPhase("scanning");

      try {
        const response = await fetch("/api/vision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const body = await response.json();
        if (ticket !== requestId.current) return;

        if (!response.ok) {
          setError(body?.message ?? `Analysis failed (${response.status}).`);
          setPhase("error");
          return;
        }

        setResult(body as ScanResult);
        setProgress(100);
        // Let the bar visibly complete before swapping panels.
        setTimeout(() => {
          if (ticket === requestId.current) setPhase("result");
        }, 320);
      } catch {
        if (ticket !== requestId.current) return;
        setError("Could not reach the analysis service. Check your connection.");
        setPhase("error");
      }
    },
    [],
  );

  const acceptFile = useCallback(
    async (file: File | undefined) => {
      if (!file || !file.type.startsWith("image/")) return;
      setFileName(file.name);
      setPreviewUrl(URL.createObjectURL(file));
      setUrl("");

      try {
        const dataUrl = await toDataUrl(file);
        await analyze({
          image: dataUrl,
          filename: file.name,
          hint: initialQuery || undefined,
        });
      } catch {
        setError("Could not read that image file.");
        setPhase("error");
      }
    },
    [analyze, initialQuery],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      void acceptFile(e.dataTransfer.files?.[0]);
    },
    [acceptFile],
  );

  const startUrlScan = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setFileName(null);
    setPreviewUrl(null);
    void analyze({ url: trimmed, hint: initialQuery || undefined });
  }, [analyze, url, initialQuery]);

  const reset = useCallback(() => {
    requestId.current += 1;
    setPhase("idle");
    setProgress(0);
    setFileName(null);
    setPreviewUrl(null);
    setUrl("");
    setResult(null);
    setError(null);
  }, []);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Vision AI Search"
      description="Drop a screenshot or paste a retail link — we'll find the open-box equivalent."
      className="sm:max-w-2xl"
      dismissOnBackdrop={phase !== "scanning"}
    >
      <div className="p-5">
        <AnimatePresence mode="wait" initial={false}>
          {phase === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-5"
            >
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  dragging
                    ? "border-accent bg-accent/[0.07] shadow-glow"
                    : "border-surface-border bg-canvas hover:border-accent/40",
                )}
              >
                <div
                  className={cn(
                    "rounded-xl border border-surface-border bg-surface p-3 transition",
                    dragging && "border-accent/50 text-accent-strong",
                  )}
                >
                  <ImageUp className="h-6 w-6 text-accent-strong" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="font-heading font-medium">
                    {dragging
                      ? "Drop to scan"
                      : "Drag & drop a product screenshot"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    PNG or JPG · or click to browse
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void acceptFile(e.target.files?.[0])}
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-surface-border" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  or paste a link
                </span>
                <span className="h-px flex-1 bg-surface-border" />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && startUrlScan()}
                    placeholder="https://www.bestbuy.com/site/lg-65-class-c4-oled…"
                    aria-label="Retail product URL"
                    className="h-11 w-full rounded-xl border border-surface-border bg-canvas pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/40"
                  />
                </div>
                <Button onClick={startUrlScan} disabled={!url.trim()}>
                  Parse link
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Works with Best Buy, Amazon, Apple, Dell, Samsung, Woot and 40+
                more.
              </p>
            </motion.div>
          )}

          {phase === "scanning" && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row">
                <ScanPreview previewUrl={previewUrl} url={url} />

                <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-accent-strong" />
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.p
                        key={currentStage(progress)}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                        className="truncate text-sm text-foreground"
                      >
                        {currentStage(progress)}
                      </motion.p>
                    </AnimatePresence>
                  </div>

                  <div
                    role="progressbar"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Scanning product"
                    className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised"
                  >
                    <motion.div
                      className="h-full rounded-full bg-accent-gradient"
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: "linear", duration: 0.06 }}
                    />
                  </div>

                  <p className="truncate font-mono text-xs tabular-nums text-muted-foreground">
                    {Math.round(progress)}%
                    {fileName ? ` · ${fileName}` : ""}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                <div className="min-w-0">
                  <p className="font-heading font-medium">Analysis failed</p>
                  <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                </div>
              </div>
              <Button variant="secondary" fullWidth onClick={reset}>
                Try again
              </Button>
            </motion.div>
          )}

          {phase === "result" && result && (
            <ResultPanel key="result" result={result} onReset={reset} />
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function ResultPanel({
  result,
  onReset,
}: {
  result: ScanResult;
  onReset: () => void;
}) {
  const { extraction: x, catalogMatches, relatedMatches, projectedOffers } = result;
  const inStock = catalogMatches.length > 0;
  const bestPrice = inStock
    ? catalogMatches[0].price
    : projectedOffers[0]?.price ?? x.estimatedMsrp;

  const specs = Object.entries(x.specifications).filter(([, v]) => v);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24 }}
      className="flex flex-col gap-5"
    >
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl p-4",
          x.identified
            ? "border border-vip/25 bg-vip/[0.06]"
            : "border border-surface-border bg-canvas",
        )}
      >
        {x.identified ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-vip-strong" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="font-heading font-medium leading-snug">
            {x.identified ? "Identified: " : "Best guess: "}
            <span className="text-vip-strong">{x.productName}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {x.categoryLabel} · {x.conditionLabel} ·{" "}
            {x.msrpSource === "listed" ? "Listed" : "Est."} retail{" "}
            <span className="font-mono text-foreground">
              {formatCurrency(x.estimatedMsrp)}
            </span>
            {bestPrice < x.estimatedMsrp && (
              <>
                {" · best match saves "}
                <span className="font-mono text-vip-strong">
                  {formatCurrency(x.estimatedMsrp - bestPrice)}
                </span>
              </>
            )}
          </p>
          {x.retailer && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Source: {x.retailer}
            </p>
          )}
        </div>
      </div>

      {/* Extracted signals ------------------------------------------- */}
      <div className="flex flex-wrap gap-2">
        {x.brand && (
          <Badge tone="sky" size="sm">
            {x.brand}
          </Badge>
        )}
        {x.model && (
          <Badge tone="sky" size="sm">
            {x.model}
          </Badge>
        )}
        {specs.map(([label, value]) => (
          <Badge key={label} tone="sky" size="sm">
            {value}
          </Badge>
        ))}
        {x.searchKeywords.slice(0, 6).map((k) => (
          <Badge key={k} tone="slate" size="sm">
            {k}
          </Badge>
        ))}
        <Badge tone={x.confidence === "high" ? "emerald" : "amber"} size="sm">
          {x.confidence} confidence
        </Badge>
      </div>

      {(result.degraded || x.notes) && (
        <p className="rounded-lg border border-surface-border bg-canvas px-3 py-2 text-xs text-muted-foreground">
          {x.notes ?? result.message}
        </p>
      )}

      {/* Matches ------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {inStock ? "In stock now" : "Projected open-box pricing"}
        </p>

        {inStock
          ? catalogMatches.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 * i, duration: 0.25 }}
              >
                <Link
                  href={productHref(m.id)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border bg-surface p-3 transition hover:border-accent/40",
                    i === 0 ? "border-accent/40 shadow-glow" : "border-surface-border",
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{m.title}</span>
                      {i === 0 && (
                        <Badge tone="emerald" size="sm">
                          Best match
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <ConditionBadge condition={m.condition} size="sm" />
                      <span className="text-xs text-muted-foreground">
                        {m.offerCount} offer{m.offerCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="font-mono text-lg font-medium tabular-nums">
                      {formatCurrency(m.price)}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-vip-strong">
                      −{formatCurrency(m.savings)}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))
          : projectedOffers.map((offer, i) => (
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 * i, duration: 0.25 }}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border bg-surface p-3",
                  i === 0 ? "border-accent/40" : "border-surface-border",
                )}
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="truncate font-medium">{offer.merchantLabel}</span>
                  <div className="flex items-center gap-2">
                    <ConditionBadge condition={offer.condition} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {offer.stock}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="font-mono text-lg font-medium tabular-nums">
                    {formatCurrency(offer.price)}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-vip-strong">
                    +{formatCurrency(offer.cashback, { cents: true })} back
                  </span>
                </div>
              </motion.div>
            ))}

        {!inStock && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 shrink-0 text-vip-strong" aria-hidden="true" />
            We don&apos;t stock this exact unit — projected from{" "}
            {x.categoryLabel.toLowerCase()} pricing, not live inventory.
          </p>
        )}
      </div>

      {/* Near misses, kept clearly separate from the scanned product so the
          closest laptop we happen to carry is never presented as a match. */}
      {!inStock && relatedMatches.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-surface-border pt-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Related, in stock today
          </p>
          {relatedMatches.slice(0, 2).map((m) => (
            <Link
              key={m.id}
              href={productHref(m.id)}
              className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-canvas px-3 py-2 transition hover:border-accent/40"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-xs font-medium">{m.title}</span>
                <span className="text-[11px] text-muted-foreground">
                  {m.conditionLabel}
                </span>
              </span>
              <span className="shrink-0 font-mono text-sm tabular-nums">
                {formatCurrency(m.price)}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {inStock ? (
          <Link
            href={productHref(catalogMatches[0].id)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-gradient px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Compare offers
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <Button fullWidth rightIcon={<ArrowRight className="h-4 w-4" />}>
            Track this product
          </Button>
        )}
        <Button variant="secondary" fullWidth onClick={onReset}>
          Scan another
        </Button>
      </div>
    </motion.div>
  );
}

/** Thumbnail of whatever the user handed us, with a sweeping scan line. */
function ScanPreview({
  previewUrl,
  url,
}: {
  previewUrl: string | null;
  url: string;
}) {
  return (
    <div className="relative mx-auto h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-surface-border bg-canvas sm:mx-0">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob URL from a local file
        <img
          src={previewUrl}
          alt="Uploaded product screenshot"
          className="h-full w-full object-cover opacity-80"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <span className="line-clamp-2 break-all text-[9px] leading-tight text-muted-foreground">
            {url.replace(/^https?:\/\//, "").slice(0, 40) || "Retail link"}
          </span>
        </div>
      )}

      <motion.div
        aria-hidden="true"
        className="absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-accent/30 to-transparent"
        animate={{ top: ["-2rem", "6rem"] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
      />
      <ScanLine className="absolute bottom-1 right-1 h-3 w-3 text-accent-strong/70" />
    </div>
  );
}
