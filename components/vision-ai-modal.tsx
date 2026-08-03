"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ImageUp,
  Link2,
  Loader2,
  ScanLine,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge, ConditionBadge, type ProductCondition } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Mock recognition result — replace with the Claude vision call       */
/* ------------------------------------------------------------------ */

const IDENTIFIED_PRODUCT = "Apple MacBook Air M2 16GB";
const RETAIL_PRICE = 1399;

/** Tags stream in as the scan progresses; `at` is the progress % that reveals it. */
const EXTRACTED_TAGS: { label: string; at: number }[] = [
  { label: "Apple", at: 34 },
  { label: "MacBook Air", at: 45 },
  { label: "M2 chip", at: 56 },
  { label: "16GB RAM", at: 67 },
  { label: "512GB SSD", at: 78 },
  { label: "Midnight", at: 87 },
];

const SCAN_STAGES: { label: string; until: number }[] = [
  { label: "Uploading capture…", until: 18 },
  { label: "Detecting product region…", until: 38 },
  { label: "Extracting model identifiers…", until: 62 },
  { label: "Cross-referencing 12.4M listings…", until: 88 },
  { label: "Ranking open-box matches…", until: 101 },
];

type Match = {
  retailer: string;
  condition: ProductCondition;
  price: number;
  inStock: string;
};

const MATCHES: Match[] = [
  {
    retailer: "Best Buy",
    condition: "open-box-excellent",
    price: 1049,
    inStock: "4 in stock",
  },
  {
    retailer: "Woot",
    condition: "like-new",
    price: 1119,
    inStock: "2 in stock",
  },
  {
    retailer: "Apple",
    condition: "certified-refurbished",
    price: 1189,
    inStock: "In stock",
  },
];

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const currentStage = (progress: number) =>
  SCAN_STAGES.find((s) => progress < s.until)?.label ?? "Finalizing…";

/* ------------------------------------------------------------------ */

type Phase = "idle" | "scanning" | "result";

export function VisionAiModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Release the blob whenever the preview is replaced or cleared.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // Reset once the close animation has played out.
  useEffect(() => {
    if (open) return;
    const id = setTimeout(() => {
      setPhase("idle");
      setProgress(0);
      setDragging(false);
      setUrl("");
      setFileName(null);
      setPreviewUrl(null);
    }, 250);
    return () => clearTimeout(id);
  }, [open]);

  // Drive the mock scan.
  useEffect(() => {
    if (phase !== "scanning") return;
    const id = setInterval(() => {
      setProgress((p) => Math.min(100, p + 1.8));
    }, 55);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "scanning" || progress < 100) return;
    const id = setTimeout(() => setPhase("result"), 420);
    return () => clearTimeout(id);
  }, [phase, progress]);

  const acceptFile = useCallback((file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
    setProgress(0);
    setPhase("scanning");
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      acceptFile(e.dataTransfer.files?.[0]);
    },
    [acceptFile],
  );

  const startUrlScan = useCallback(() => {
    if (!url.trim()) return;
    setFileName(null);
    setPreviewUrl(null);
    setProgress(0);
    setPhase("scanning");
  }, [url]);

  const reset = useCallback(() => {
    setPhase("idle");
    setProgress(0);
    setFileName(null);
    setPreviewUrl(null);
    setUrl("");
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
                  onChange={(e) => acceptFile(e.target.files?.[0])}
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
                    placeholder="https://www.bestbuy.com/site/macbook-air…"
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

              <div className="rounded-xl border border-surface-border bg-canvas p-4">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Extracted tags
                </p>
                <div className="flex min-h-[3.25rem] flex-wrap content-start gap-2">
                  <AnimatePresence>
                    {EXTRACTED_TAGS.filter((t) => progress >= t.at).map(
                      (tag) => (
                        <motion.span
                          key={tag.label}
                          initial={{ opacity: 0, scale: 0.9, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 28,
                          }}
                        >
                          <Badge tone="sky" size="sm">
                            {tag.label}
                          </Badge>
                        </motion.span>
                      ),
                    )}
                  </AnimatePresence>
                  {progress < EXTRACTED_TAGS[0].at && (
                    <span className="text-xs text-muted-foreground">
                      Waiting for the model…
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {phase === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24 }}
              className="flex flex-col gap-5"
            >
              <div className="flex items-start gap-3 rounded-xl border border-vip/25 bg-vip/[0.06] p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-vip-strong" />
                <div className="min-w-0">
                  <p className="font-heading font-medium leading-snug">
                    Identified:{" "}
                    <span className="text-vip-strong">{IDENTIFIED_PRODUCT}</span> —{" "}
                    {MATCHES.length} Open-Box Matches Found
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Retail {money(RETAIL_PRICE)} · best match saves{" "}
                    <span className="font-mono text-vip-strong">
                      {money(RETAIL_PRICE - MATCHES[0].price)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {EXTRACTED_TAGS.map((t) => (
                  <Badge key={t.label} tone="sky" size="sm">
                    {t.label}
                  </Badge>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Instant comparison
                </p>
                {MATCHES.map((m, i) => (
                  <motion.div
                    key={m.retailer}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 * i, duration: 0.25 }}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border bg-surface p-3 transition hover:border-accent/40",
                      i === 0
                        ? "border-accent/40 shadow-glow"
                        : "border-surface-border",
                    )}
                  >
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {m.retailer}
                        </span>
                        {i === 0 && (
                          <Badge tone="emerald" size="sm">
                            Best price
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <ConditionBadge condition={m.condition} size="sm" />
                        <span className="text-xs text-muted-foreground">
                          {m.inStock}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end">
                      <span className="font-mono text-lg font-medium tabular-nums text-foreground">
                        {money(m.price)}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-vip-strong">
                        −{money(RETAIL_PRICE - m.price)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  fullWidth
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  See all {MATCHES.length} matches
                </Button>
                <Button variant="secondary" fullWidth onClick={reset}>
                  Scan another
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
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
