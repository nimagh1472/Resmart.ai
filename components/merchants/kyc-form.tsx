"use client";

import { useRef, useState } from "react";
import {
  BadgeCheck,
  Building2,
  FileCheck2,
  FileUp,
  Globe,
  Loader2,
  MapPin,
  Phone,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ACCEPTED_DOC_TYPES,
  BLANK_KYC,
  MAX_DOC_BYTES,
  MAX_DOC_MB,
  validateDocument,
  validateKyc,
  type KycDocument,
  type KycErrors,
  type MerchantKyc,
} from "@/lib/kyc";
import { cn } from "@/lib/utils";

const FILE_ACCEPT = ACCEPTED_DOC_TYPES.join(",");

/** Uploads ride along in the JSON payload, so the file becomes a string first. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export type KycSubmission = {
  id: string;
  status: string;
  submittedAt: string;
  businessName: string;
};

/**
 * Business verification form. Every field here is required before an account
 * can be reviewed, so the form validates locally for fast feedback and then
 * lets `/api/merchants` re-validate — the route's `fieldErrors` are merged back
 * in, which is what surfaces server-only rules the client can't check.
 */
export function MerchantKycForm({
  initial,
  onSubmitted,
  onCancel,
  className,
}: {
  initial?: Partial<MerchantKyc>;
  /** Called with the created application once the API accepts it. */
  onSubmitted?: (submission: KycSubmission, kyc: MerchantKyc) => void;
  onCancel?: () => void;
  className?: string;
}) {
  const [kyc, setKyc] = useState<MerchantKyc>({ ...BLANK_KYC, ...initial });
  const [errors, setErrors] = useState<KycErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set =
    <K extends keyof MerchantKyc>(key: K) =>
    (value: MerchantKyc[K]) => {
      setKyc((prev) => ({ ...prev, [key]: value }));
      // Clear the field's error as soon as it's touched — leaving it up while
      // the merchant retypes reads as "still wrong".
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  const acceptFile = async (file: File | undefined) => {
    if (!file) return;

    if (file.size > MAX_DOC_BYTES) {
      setErrors((prev) => ({
        ...prev,
        document: `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_DOC_MB}MB.`,
      }));
      return;
    }

    try {
      const dataUrl = await readAsDataUrl(file);
      const check = validateDocument({ dataUrl });
      if (!check.ok) {
        setErrors((prev) => ({ ...prev, document: check.reason }));
        return;
      }
      const document: KycDocument = {
        name: file.name,
        dataUrl,
        sizeBytes: check.sizeBytes,
      };
      setKyc((prev) => ({ ...prev, document }));
      setErrors((prev) => ({ ...prev, document: undefined }));
    } catch {
      setErrors((prev) => ({
        ...prev,
        document: "Could not read that file. Try another.",
      }));
    }
  };

  const clearDocument = () => {
    setKyc((prev) => ({ ...prev, document: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const found = validateKyc(kyc);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/merchants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kyc),
      });

      const body = (await res.json().catch(() => null)) as {
        merchant?: KycSubmission;
        fieldErrors?: KycErrors;
        details?: string[];
      } | null;

      if (!res.ok) {
        if (body?.fieldErrors) setErrors(body.fieldErrors);
        setFormError(
          body?.details?.[0] ??
            "Verification could not be submitted. Check the details and try again.",
        );
        return;
      }

      if (body?.merchant) onSubmitted?.(body.merchant, kyc);
    } catch {
      setFormError(
        "Could not reach the verification service. Your details were not submitted.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className={cn("flex flex-col gap-5", className)}
    >
      {/* Business identity ------------------------------------------ */}
      <Section icon={Building2} title="Business identity">
        <Field
          label="Legal business name"
          id="kyc-legal-name"
          value={kyc.legalBusinessName}
          onChange={set("legalBusinessName")}
          placeholder="Northgate Electronics LLC"
          autoComplete="organization"
          error={errors.legalBusinessName}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Tax ID / EIN"
            id="kyc-tax-id"
            value={kyc.taxId}
            onChange={set("taxId")}
            placeholder="12-3456789"
            inputMode="numeric"
            error={errors.taxId}
            hint="9 digits, as filed with the IRS."
          />
          <Field
            label="Business email"
            id="kyc-email"
            type="email"
            value={kyc.contactEmail}
            onChange={set("contactEmail")}
            placeholder="ops@yourstore.com"
            autoComplete="email"
            error={errors.contactEmail}
          />
        </div>
      </Section>

      {/* Contact ----------------------------------------------------- */}
      <Section icon={Phone} title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Phone number"
            id="kyc-phone"
            type="tel"
            value={kyc.phone}
            onChange={set("phone")}
            placeholder="+1 206 555 0188"
            autoComplete="tel"
            error={errors.phone}
          />
          <Field
            label="Website or social link"
            id="kyc-website"
            type="url"
            value={kyc.website}
            onChange={set("website")}
            placeholder="https://yourstore.com"
            autoComplete="url"
            error={errors.website}
            hint="A storefront, or a business profile we can verify."
          />
        </div>
      </Section>

      {/* Address ----------------------------------------------------- */}
      <Section icon={MapPin} title="Business physical address">
        <Field
          label="Street address"
          id="kyc-address-1"
          value={kyc.addressLine1}
          onChange={set("addressLine1")}
          placeholder="1420 Aurora Ave N"
          autoComplete="address-line1"
          error={errors.addressLine1}
        />
        <Field
          label="Suite / unit"
          id="kyc-address-2"
          value={kyc.addressLine2 ?? ""}
          onChange={set("addressLine2")}
          placeholder="Suite 300"
          autoComplete="address-line2"
          optional
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="City"
            id="kyc-city"
            value={kyc.city}
            onChange={set("city")}
            placeholder="Seattle"
            autoComplete="address-level2"
            error={errors.city}
          />
          <Field
            label="State / region"
            id="kyc-state"
            value={kyc.state}
            onChange={set("state")}
            placeholder="WA"
            autoComplete="address-level1"
            error={errors.state}
          />
          <Field
            label="Postal code"
            id="kyc-postal"
            value={kyc.postalCode}
            onChange={set("postalCode")}
            placeholder="98109"
            autoComplete="postal-code"
            error={errors.postalCode}
          />
        </div>
        <Field
          label="Country"
          id="kyc-country"
          value={kyc.country}
          onChange={set("country")}
          placeholder="United States"
          autoComplete="country-name"
          error={errors.country}
        />
      </Section>

      {/* Proof of business ------------------------------------------- */}
      <Section icon={FileCheck2} title="Proof of business">
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
          {...(kyc.document
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
            "rounded-2xl border-2 border-dashed p-3 transition",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong",
            !kyc.document && "cursor-pointer px-6 py-8 text-center",
            dragging
              ? "border-accent bg-accent-soft"
              : errors.document
                ? "border-rose-500/50 bg-rose-500/[0.04]"
                : "border-surface-border bg-canvas hover:border-accent/50",
          )}
        >
          {kyc.document ? (
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-vip-strong">
                <FileCheck2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-navy">
                  {kyc.document.name}
                </p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {formatBytes(kyc.document.sizeBytes)} · attached
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="font-mono text-[10px] uppercase tracking-wider text-accent-strong hover:underline"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={clearDocument}
                aria-label="Remove document"
                className="rounded-lg p-2 text-muted transition hover:bg-surface-raised hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span
                className={cn(
                  "rounded-xl border border-surface-border bg-surface p-2.5 transition",
                  dragging && "border-accent/60",
                )}
              >
                <FileUp className="h-5 w-5 text-accent-strong" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium text-navy">
                {dragging
                  ? "Drop to attach"
                  : "Business license, reseller certificate, or government ID"}
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, WebP or PDF · up to {MAX_DOC_MB}MB · or click to browse
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={FILE_ACCEPT}
            className="hidden"
            aria-label="Upload proof of business"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Clear the input so re-picking the same file still fires change.
              e.target.value = "";
              void acceptFile(file);
            }}
          />
        </div>

        {errors.document && (
          <p role="alert" className="text-[11px] text-rose-700">
            {errors.document}
          </p>
        )}

        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
          Documents are used for verification only and are visible to platform
          reviewers, never to buyers.
        </p>
      </Section>

      {formError && (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/[0.06] px-3.5 py-2.5 text-sm text-rose-700"
        >
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {onCancel && (
          <Button type="button" variant="secondary" fullWidth onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          fullWidth
          disabled={submitting}
          leftIcon={
            submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BadgeCheck className="h-4 w-4" />
            )
          }
        >
          {submitting ? "Submitting…" : "Submit for verification"}
        </Button>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        New merchant accounts start in{" "}
        <span className="font-medium text-navy">Pending Approval</span> until a
        platform admin reviews these details.
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Globe;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-accent-strong" aria-hidden="true" />
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  error,
  hint,
  optional,
  ...props
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  optional?: boolean;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "id"
>) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
      >
        {label}
        {optional && (
          <span className="normal-case tracking-normal">(optional)</span>
        )}
      </label>
      <input
        {...props}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-11 w-full rounded-xl border bg-canvas px-3 text-sm text-navy placeholder:text-muted-foreground focus:bg-surface focus:outline-none focus:ring-1",
          error
            ? "border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/40"
            : "border-surface-border focus:border-accent focus:ring-accent/40",
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="text-[11px] text-rose-700">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-[11px] text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
