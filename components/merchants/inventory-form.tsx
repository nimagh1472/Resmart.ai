"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  ImageOff,
  ImageUp,
  Loader2,
  Lock,
  Rocket,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CONDITIONS } from "@/components/ui/badge";
import type { CardCondition } from "@/lib/catalog";
import {
  ACCEPTED_IMAGE_TYPES,
  COMMISSION_RATE,
  CPC_MAX,
  CPC_MIN,
  CPC_STEP,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
  forecastForBid,
  netPerUnit,
  validateImageSource,
  type MerchantListing,
} from "@/lib/mock-merchant";
import { cn, formatCurrency } from "@/lib/utils";

/** The two grades ReSmart surfaces, labelled as merchants refer to them. */
const CONDITION_OPTIONS: { value: CardCondition; label: string }[] = [
  { value: "open-box-excellent", label: "Open-Box" },
  { value: "certified-refurbished", label: "Refurbished" },
];

/** Everything a merchant supplies; ids and metrics are assigned by the server. */
export type ListingDraft = Pick<
  MerchantListing,
  | "title"
  | "description"
  | "condition"
  | "msrp"
  | "price"
  | "stock"
  | "url"
  | "imageUrl"
  | "boostEnabled"
  | "cpcBid"
>;

type FieldKey = "title" | "msrp" | "price" | "stock" | "url" | "imageUrl";
type Errors = Partial<Record<FieldKey, string>>;

const BLANK = {
  title: "",
  description: "",
  condition: "open-box-excellent" as CardCondition,
  msrp: "",
  price: "",
  stock: "",
  url: "",
  boostEnabled: false,
  cpcBid: 0.75,
};

/* ------------------------------------------------------------------ */
/* AI assistant                                                        */
/* ------------------------------------------------------------------ */

type PricingTier = {
  tier: "quick-sale" | "market" | "premium";
  price: number;
  discountPercent: number;
  note: string;
};

type PriceEstimate = {
  tiers: PricingTier[];
  recommendedTier: PricingTier["tier"];
  rationale: string;
  confidence: "high" | "medium" | "low";
};

type DescriptionDraft = {
  headline: string;
  description: string;
  bullets: string[];
};

const TIER_LABEL: Record<PricingTier["tier"], string> = {
  "quick-sale": "Quick sale",
  market: "Market",
  premium: "Premium",
};

/**
 * Calls the merchant assistant. The route answers from Claude when a key is
 * configured and from a local heuristic otherwise, so `source` is surfaced in
 * the UI rather than swallowed — a merchant pricing real stock should know
 * which one they're looking at.
 */
async function askAssistant<T>(body: Record<string, unknown>) {
  const res = await fetch("/api/merchants/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => null)) as
    | { source?: string; result?: T; message?: string; details?: string[] }
    | null;

  if (!res.ok || !payload?.result) {
    throw new Error(
      payload?.details?.[0] ??
        payload?.message ??
        "The assistant is unavailable right now.",
    );
  }
  return { source: payload.source ?? "claude", result: payload.result };
}

const FILE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(",");

/**
 * Uploads ride along in the JSON payload, so the file has to become a string
 * before submit — a blob URL would preview fine and then break everywhere else.
 */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function InventoryForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Add listing",
  canBoost = true,
  className,
}: {
  /** Present when editing; omitted when creating. */
  initial?: MerchantListing;
  onSubmit: (draft: ListingDraft) => void;
  onCancel?: () => void;
  submitLabel?: string;
  /** False while the merchant is unapproved — boost stays locked off. */
  canBoost?: boolean;
  className?: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? BLANK.title);
  const [description, setDescription] = useState(
    initial?.description ?? BLANK.description,
  );
  const [condition, setCondition] = useState<CardCondition>(
    initial?.condition ?? BLANK.condition,
  );
  const [msrp, setMsrp] = useState(
    initial ? String(initial.msrp) : BLANK.msrp,
  );
  const [price, setPrice] = useState(
    initial ? String(initial.price) : BLANK.price,
  );
  const [stock, setStock] = useState(
    initial ? String(initial.stock) : BLANK.stock,
  );
  const [url, setUrl] = useState(initial?.url ?? BLANK.url);

  // One image, two entry points. An upload is held as {name, dataUrl} so the
  // preview and the payload are the same string; a hotlink lives in the text
  // field. Re-opening an edited listing restores whichever it came from.
  const initialImage = initial?.imageUrl ?? "";
  const [upload, setUpload] = useState<{ name: string; dataUrl: string } | null>(
    initialImage.startsWith("data:")
      ? { name: "Uploaded image", dataUrl: initialImage }
      : null,
  );
  const [imageUrl, setImageUrl] = useState(
    initialImage.startsWith("data:") ? "" : initialImage,
  );
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [boostEnabled, setBoostEnabled] = useState(
    canBoost ? (initial?.boostEnabled ?? BLANK.boostEnabled) : false,
  );
  const [cpcBid, setCpcBid] = useState(initial?.cpcBid ?? BLANK.cpcBid);
  const [errors, setErrors] = useState<Errors>({});

  // AI assistant state. `source` distinguishes a Claude answer from the
  // heuristic the API falls back to when no key is configured.
  const [estimate, setEstimate] = useState<
    (PriceEstimate & { source: string }) | null
  >(null);
  const [estimating, setEstimating] = useState(false);
  const [writing, setWriting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const msrpNum = Number(msrp);
  const priceNum = Number(price);
  const forecast = forecastForBid(cpcBid);

  /** Both assistant actions need a title and a usable MSRP to say anything. */
  const aiReady = title.trim().length > 0 && msrpNum > 0;

  const estimatePrice = async () => {
    setAiError(null);
    setAiNote(null);
    setEstimating(true);
    try {
      const { source, result } = await askAssistant<PriceEstimate>({
        task: "price",
        title: title.trim(),
        condition,
        msrp: msrpNum,
      });
      setEstimate({ ...result, source });

      // Prefill only an empty field — never overwrite a price the merchant set.
      const recommended = result.tiers.find(
        (t) => t.tier === result.recommendedTier,
      );
      if (recommended && !price.trim()) {
        setPrice(String(recommended.price));
        setErrors((prev) => ({ ...prev, price: undefined }));
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Could not estimate a price.");
    } finally {
      setEstimating(false);
    }
  };

  const generateDescription = async () => {
    setAiError(null);
    setAiNote(null);
    setWriting(true);
    try {
      const { source, result } = await askAssistant<DescriptionDraft>({
        task: "description",
        title: title.trim(),
        condition,
        msrp: msrpNum,
        price: priceNum > 0 ? priceNum : msrpNum,
      });

      const bullets = result.bullets.map((b) => `• ${b}`).join("\n");
      setDescription(`${result.description}\n\n${bullets}`.trim());
      setAiNote(
        source === "heuristic"
          ? "Drafted from a template — set ANTHROPIC_API_KEY for a written draft."
          : "Draft written by Claude. Review before publishing.",
      );
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : "Could not draft a description.",
      );
    } finally {
      setWriting(false);
    }
  };

  /**
   * Upload wins over a pasted link — only one photo ships with the listing. A
   * half-typed link isn't previewed (or submitted) until it parses as a URL.
   */
  const typedImage = imageUrl.trim();
  const previewSrc =
    upload?.dataUrl ??
    (typedImage && validateImageSource(typedImage).ok ? typedImage : "");

  // Remembering *which* src failed resets the fallback as soon as it changes.
  const [failedPreview, setFailedPreview] = useState<string | null>(null);
  const previewBroken = failedPreview !== null && failedPreview === previewSrc;

  const acceptFile = async (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("That file isn't an image. Use PNG, JPG, WebP, or GIF.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError(
        `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_IMAGE_MB}MB.`,
      );
      return;
    }

    try {
      const dataUrl = await readAsDataUrl(file);
      const check = validateImageSource(dataUrl);
      if (!check.ok) {
        setUploadError(check.reason);
        return;
      }
      setUpload({ name: file.name, dataUrl });
      setImageUrl("");
      setUploadError(null);
      setErrors((prev) => ({ ...prev, imageUrl: undefined }));
    } catch {
      setUploadError("Could not read that file. Try another image.");
    }
  };

  const clearImage = () => {
    setUpload(null);
    setImageUrl("");
    setUploadError(null);
    setErrors((prev) => ({ ...prev, imageUrl: undefined }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const discount =
    msrpNum > 0 && priceNum > 0 && priceNum <= msrpNum
      ? Math.round(((msrpNum - priceNum) / msrpNum) * 100)
      : null;

  const validate = (): Errors => {
    const next: Errors = {};

    if (!title.trim()) next.title = "Enter a listing title.";

    if (!msrp.trim() || Number.isNaN(msrpNum) || msrpNum <= 0) {
      next.msrp = "Enter an MSRP greater than zero.";
    }
    if (!price.trim() || Number.isNaN(priceNum) || priceNum <= 0) {
      next.price = "Enter a price greater than zero.";
    } else if (msrpNum > 0 && priceNum > msrpNum) {
      // An open-box price above MSRP isn't a deal — it's a data error.
      next.price = "Open-box price must be at or below MSRP.";
    }

    const stockNum = Number(stock);
    if (!stock.trim() || Number.isNaN(stockNum) || stockNum < 0) {
      next.stock = "Enter stock as zero or more.";
    } else if (!Number.isInteger(stockNum)) {
      next.stock = "Stock must be a whole number.";
    }

    if (!url.trim()) {
      next.url = "Enter the product URL.";
    } else {
      try {
        if (!/^https?:$/.test(new URL(url).protocol))
          next.url = "URL must start with http:// or https://";
      } catch {
        next.url = "Enter a valid URL.";
      }
    }

    // The photo is optional, but a typed link still has to be usable.
    if (!upload && imageUrl.trim()) {
      const check = validateImageSource(imageUrl.trim());
      if (!check.ok) next.imageUrl = check.reason;
    }

    return next;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      condition,
      msrp: msrpNum,
      price: priceNum,
      stock: Number(stock),
      url: url.trim(),
      imageUrl: previewSrc || undefined,
      boostEnabled: canBoost && boostEnabled,
      cpcBid,
    });

    if (!initial) {
      setTitle("");
      setDescription("");
      setMsrp("");
      setPrice("");
      setStock("");
      setUrl("");
      clearImage();
      setBoostEnabled(false);
      setCpcBid(BLANK.cpcBid);
      setErrors({});
      setEstimate(null);
      setAiError(null);
      setAiNote(null);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className={cn("flex flex-col gap-4", className)}
    >
      <Field
        label="Listing title"
        id="listing-title"
        value={title}
        onChange={setTitle}
        placeholder='Apple MacBook Air 13" M2 · 16GB / 512GB'
        error={errors.title}
      />

      {/* Condition ------------------------------------------------- */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Condition
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {CONDITION_OPTIONS.map((opt) => {
            const active = condition === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => setCondition(opt.value)}
                title={CONDITIONS[opt.value].description}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-sm transition",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  active
                    ? "border-accent/50 bg-accent/10 text-accent-strong"
                    : "border-surface-border bg-canvas text-muted hover:border-accent/30",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Pricing --------------------------------------------------- */}
      {/* items-end keeps the two inputs on one line when the assist button
          wraps below the price label in the narrow side panel. */}
      <div className="grid items-end gap-4 sm:grid-cols-2">
        <Field
          label="Retail MSRP"
          id="listing-msrp"
          value={msrp}
          onChange={setMsrp}
          placeholder="1199"
          inputMode="decimal"
          prefix="$"
          error={errors.msrp}
        />
        <Field
          label="Open-box price"
          id="listing-price"
          value={price}
          onChange={setPrice}
          placeholder="849"
          inputMode="decimal"
          prefix="$"
          error={errors.price}
          action={
            <AssistButton
              onClick={estimatePrice}
              busy={estimating}
              disabled={!aiReady}
              title={
                aiReady
                  ? "Suggest a price from MSRP and condition"
                  : "Add a title and MSRP first"
              }
            >
              AI Estimate Price
            </AssistButton>
          }
        />
      </div>

      {discount !== null && (
        <p className="-mt-1 font-mono text-[11px] tabular-nums text-vip-strong">
          {discount}% below MSRP · you net{" "}
          {formatCurrency(netPerUnit(priceNum), { cents: true })} per unit after
          the {Math.round(COMMISSION_RATE * 100)}% commission
        </p>
      )}

      {/* AI pricing tiers ------------------------------------------ */}
      {estimate && (
        <div className="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles
              className="h-3.5 w-3.5 text-accent-strong"
              aria-hidden="true"
            />
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent-strong">
              Suggested pricing
            </p>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {estimate.source === "heuristic"
                ? "Heuristic · no API key"
                : `Claude · ${estimate.confidence} confidence`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {estimate.tiers.map((tier) => {
              const recommended = tier.tier === estimate.recommendedTier;
              const active = Number(price) === tier.price;
              return (
                <button
                  key={tier.tier}
                  type="button"
                  onClick={() => {
                    setPrice(String(tier.price));
                    setErrors((prev) => ({ ...prev, price: undefined }));
                  }}
                  title={tier.note}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-xl border px-2.5 py-2 text-left transition",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong",
                    active
                      ? "border-accent bg-surface shadow-glow"
                      : recommended
                        ? "border-accent/50 bg-surface hover:border-accent"
                        : "border-surface-border bg-surface/70 hover:border-accent/40",
                  )}
                >
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {TIER_LABEL[tier.tier]}
                    {recommended && " ★"}
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-navy">
                    {formatCurrency(tier.price, { cents: true })}
                  </span>
                  <span className="font-mono text-[9px] tabular-nums text-vip-strong">
                    −{tier.discountPercent}%
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] leading-relaxed text-muted">
            {estimate.rationale}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Stock on hand"
          id="listing-stock"
          value={stock}
          onChange={setStock}
          placeholder="4"
          inputMode="numeric"
          error={errors.stock}
        />
        <Field
          label="Product URL"
          id="listing-url"
          value={url}
          onChange={setUrl}
          placeholder="https://…"
          type="url"
          error={errors.url}
        />
      </div>

      {/* Description ----------------------------------------------- */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="listing-description"
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
          >
            Item description
            <span className="normal-case tracking-normal">(optional)</span>
          </label>
          <AssistButton
            onClick={generateDescription}
            busy={writing}
            disabled={!aiReady}
            icon={<Wand2 className="h-3 w-3" aria-hidden="true" />}
            title={
              aiReady
                ? "Draft customer-facing copy from the listing details"
                : "Add a title and MSRP first"
            }
          >
            AI Generate Description
          </AssistButton>
        </div>
        <textarea
          id="listing-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="What the buyer is getting, what condition it's in, and what's included."
          className="w-full resize-y rounded-xl border border-surface-border bg-canvas px-3 py-2.5 text-sm leading-relaxed text-navy placeholder:text-muted-foreground focus:border-accent focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
        {aiNote && (
          <p className="text-[11px] text-muted-foreground">{aiNote}</p>
        )}
      </div>

      {aiError && (
        <p
          role="alert"
          className="-mt-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2 text-[11px] text-rose-700"
        >
          {aiError}
        </p>
      )}

      {/* Product image --------------------------------------------- */}
      <fieldset className="flex flex-col gap-2">
        <legend className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Product image
          <span className="normal-case tracking-normal">(optional)</span>
        </legend>

        {/* Stays a drop target in both states; only the empty state doubles as
            a click-to-browse button, so the preview's controls stay reachable. */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void acceptFile(e.dataTransfer.files?.[0]);
          }}
          {...(previewSrc
            ? {}
            : {
                role: "button" as const,
                tabIndex: 0,
                onClick: () => fileInputRef.current?.click(),
                onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                },
              })}
          className={cn(
            "rounded-xl border-2 border-dashed p-3 transition",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            !previewSrc && "cursor-pointer px-6 py-8 text-center",
            dragging
              ? "border-accent bg-accent/[0.07]"
              : uploadError
                ? "border-rose-500/50 bg-canvas"
                : "border-surface-border bg-canvas hover:border-accent/40",
          )}
        >
          {previewSrc ? (
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-surface-border bg-canvas">
                {previewBroken ? (
                  <ImageOff
                    className="h-5 w-5 text-surface-border"
                    aria-label="Image preview unavailable"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element -- data URL or arbitrary merchant host; next/image allows neither */
                  <img
                    src={previewSrc}
                    alt="Product image preview"
                    className="h-full w-full object-contain"
                    onError={() => setFailedPreview(previewSrc)}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {upload ? upload.name : "Linked image"}
                </p>
                {previewBroken && (
                  <p className="text-[11px] text-amber-600/80">
                    Preview unavailable — the image may not be publicly
                    reachable.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="font-mono text-[10px] uppercase tracking-wider text-accent-strong hover:underline"
                >
                  Replace
                </button>
              </div>
              <button
                type="button"
                onClick={clearImage}
                aria-label="Remove product image"
                className="rounded-lg p-2 text-muted transition hover:bg-surface-raised hover:text-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span
                className={cn(
                  "rounded-xl border border-surface-border bg-surface p-2.5 transition",
                  dragging && "border-accent/50",
                )}
              >
                <ImageUp className="h-5 w-5 text-accent-strong" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium">
                {dragging ? "Drop to attach" : "Drag & drop a product photo"}
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, WebP or GIF · up to {MAX_IMAGE_MB}MB · or click to
                browse
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={FILE_ACCEPT}
            className="hidden"
            aria-label="Upload product image"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Clear the input so re-picking the same file still fires change.
              e.target.value = "";
              void acceptFile(file);
            }}
          />
        </div>

        {uploadError && (
          <p role="alert" className="text-[11px] text-rose-600">
            {uploadError}
          </p>
        )}

        <Field
          label="Image URL"
          id="listing-image-url"
          value={imageUrl}
          onChange={(v) => {
            setImageUrl(v);
            setUploadError(null);
          }}
          placeholder="https://…/product.jpg"
          type="url"
          disabled={upload !== null}
          error={errors.imageUrl}
        />
        <p className="-mt-0.5 text-[11px] text-muted-foreground">
          {upload
            ? "Remove the upload to link an image by URL instead."
            : "Paste a direct link to the product photo if you'd rather not upload."}
        </p>
      </fieldset>

      {/* CPC boost ------------------------------------------------- */}
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border bg-canvas p-3.5 transition",
          boostEnabled
            ? "border-accent/40"
            : "border-surface-border",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Rocket className="h-3.5 w-3.5 text-accent-strong" aria-hidden="true" />
              CPC Boost
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Optional
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {canBoost
                ? "Sponsor this listing for priority search ranking. Billed per click, on top of commission."
                : "Available once your merchant account is approved."}
            </p>
          </div>
          <Switch
            checked={boostEnabled}
            onCheckedChange={setBoostEnabled}
            label="Enable CPC boost for this listing"
            tone="accent"
            disabled={!canBoost}
          />
        </div>

        {!canBoost && (
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-amber-600/80">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Locked pending approval
          </p>
        )}

        {boostEnabled && canBoost && (
          <div className="flex flex-col gap-2 border-t border-surface-border pt-3">
            <label
              htmlFor="cpc-bid"
              className="flex items-baseline justify-between gap-2"
            >
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Bid per click
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-accent-strong">
                {formatCurrency(cpcBid, { cents: true })}
              </span>
            </label>

            <input
              id="cpc-bid"
              type="range"
              min={CPC_MIN}
              max={CPC_MAX}
              step={CPC_STEP}
              value={cpcBid}
              onChange={(e) => setCpcBid(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-raised accent-accent"
            />

            <div className="flex justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
              <span>{formatCurrency(CPC_MIN, { cents: true })}</span>
              <span>{formatCurrency(CPC_MAX, { cents: true })}</span>
            </div>

            <dl className="mt-1 grid grid-cols-3 gap-2 border-t border-surface-border pt-3 text-center">
              <Forecast label="Est. rank" value={forecast.position} />
              <Forecast
                label="Clicks / day"
                value={`${forecast.dailyClicks}`}
              />
              <Forecast
                label="Spend / day"
                value={formatCurrency(forecast.dailySpend, { cents: true })}
              />
            </dl>
            <p className="text-center text-[10px] text-muted-foreground">
              Forecast only — actual placement is decided at auction.
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" fullWidth>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Forecast({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="font-mono text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Compact secondary action for the AI assistant, sized to sit beside a label. */
function AssistButton({
  onClick,
  busy,
  disabled,
  children,
  icon,
  title,
}: {
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
  children: ReactNode;
  icon?: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-2 py-1",
        "font-mono text-[10px] font-medium uppercase tracking-wider text-accent-strong transition",
        "hover:border-accent hover:bg-accent/15",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong",
        "disabled:cursor-not-allowed disabled:border-surface-border disabled:bg-surface-raised disabled:text-muted-foreground",
      )}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      ) : (
        (icon ?? <Sparkles className="h-3 w-3" aria-hidden="true" />)
      )}
      {busy ? "Thinking…" : children}
    </button>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  error,
  prefix,
  action,
  ...props
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  prefix?: string;
  /** Control rendered on the label row — used for the AI assist buttons. */
  action?: ReactNode;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "id"
>) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-[1.375rem] flex-wrap items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
        >
          {label}
        </label>
        {action}
      </div>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <input
          {...props}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "h-11 w-full rounded-xl border bg-canvas pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            prefix ? "pl-7" : "pl-3",
            error
              ? "border-rose-500/50 focus:border-rose-500/60 focus:ring-rose-500/40"
              : "border-surface-border focus:border-accent/50 focus:ring-accent/40",
          )}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-[11px] text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
