/**
 * Merchant KYC / business verification.
 *
 * The shapes and the validator live here rather than in the form so the API
 * route can re-run the exact same checks. Client-side validation is a courtesy;
 * the route is what actually decides whether an application is well-formed.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Proof-of-business upload. Held as a data URL so it rides in the JSON body. */
export type KycDocument = {
  name: string;
  /** `data:<mime>;base64,…` */
  dataUrl: string;
  /** Decoded size, for display in the admin review panel. */
  sizeBytes: number;
};

/** Everything the merchant fills in. Ids and timestamps are server-assigned. */
export type MerchantKyc = {
  legalBusinessName: string;
  /** Tax ID / EIN, normalised to `12-3456789`. */
  taxId: string;
  contactEmail: string;
  phone: string;
  website: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  document: KycDocument | null;
};

export type KycField = Exclude<keyof MerchantKyc, "document"> | "document";
export type KycErrors = Partial<Record<KycField, string>>;

/** Review state of a submitted application. */
export type KycStatus = "pending" | "approved" | "rejected";

/** A stored application: the merchant's submission plus review metadata. */
export type MerchantApplicationRecord = {
  id: string;
  status: KycStatus;
  /** ISO-8601 timestamp of submission. */
  submittedAt: string;
  reviewedAt?: string;
  /** Required when `status` is `rejected`. */
  rejectionReason?: string;
  kyc: MerchantKyc;
};

/* ------------------------------------------------------------------ */
/* Upload constraints                                                  */
/* ------------------------------------------------------------------ */

export const MAX_DOC_BYTES = 5 * 1024 * 1024;
export const MAX_DOC_MB = MAX_DOC_BYTES / (1024 * 1024);

export const ACCEPTED_DOC_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

const DOC_URL_RE =
  /^data:(image\/(?:png|jpeg|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/;

/** Decoded byte length of a base64 payload, without allocating the buffer. */
function base64Bytes(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return (b64.length * 3) / 4 - padding;
}

export function validateDocument(
  doc: Pick<KycDocument, "dataUrl">,
): { ok: true; sizeBytes: number } | { ok: false; reason: string } {
  const match = DOC_URL_RE.exec(doc.dataUrl);
  if (!match) {
    return {
      ok: false,
      reason: "Upload a PNG, JPG, WebP, or PDF of your proof of business.",
    };
  }
  const sizeBytes = base64Bytes(match[2]);
  if (sizeBytes > MAX_DOC_BYTES) {
    return { ok: false, reason: `Document must be under ${MAX_DOC_MB}MB.` };
  }
  return { ok: true, sizeBytes };
}

/* ------------------------------------------------------------------ */
/* Field validation                                                    */
/* ------------------------------------------------------------------ */

/** US EIN shape: two digits, then seven. The dash is optional on input. */
const EIN_RE = /^\d{2}-?\d{7}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const POSTAL_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{2,11}$/;

/** `12-3456789`, whatever separator style the merchant typed. */
export const formatTaxId = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 9 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : raw.trim();
};

/** Digits only, so two merchants can't submit the "same" number twice. */
export const normalizePhone = (raw: string) => raw.replace(/[^\d+]/g, "");

/**
 * Display-only formatting. Storage stays normalised — this exists so a review
 * panel doesn't show an admin a 10-digit run of numbers.
 */
export function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  const national =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return national.length === 10
    ? `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`
    : raw;
}

export const BLANK_KYC: MerchantKyc = {
  legalBusinessName: "",
  taxId: "",
  contactEmail: "",
  phone: "",
  website: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "United States",
  document: null,
};

/**
 * Validates a submission and returns per-field messages. An empty object means
 * the application is complete — every field below is required for verification,
 * including the proof-of-business upload.
 */
export function validateKyc(kyc: MerchantKyc): KycErrors {
  const errors: KycErrors = {};
  const t = (v: string | undefined) => (v ?? "").trim();

  if (t(kyc.legalBusinessName).length < 2) {
    errors.legalBusinessName =
      "Enter the legal business name exactly as registered.";
  }

  if (!t(kyc.taxId)) {
    errors.taxId = "Enter your Tax ID / EIN.";
  } else if (!EIN_RE.test(t(kyc.taxId))) {
    errors.taxId = "Tax ID must be 9 digits, e.g. 12-3456789.";
  }

  if (!EMAIL_RE.test(t(kyc.contactEmail))) {
    errors.contactEmail = "Enter a business contact email.";
  }

  const phone = normalizePhone(t(kyc.phone));
  if (phone.replace(/\D/g, "").length < 10) {
    errors.phone = "Enter a phone number with at least 10 digits.";
  }

  if (!t(kyc.website)) {
    errors.website = "Enter your website or a business social profile link.";
  } else {
    try {
      if (!/^https?:$/.test(new URL(t(kyc.website)).protocol)) {
        errors.website = "Link must start with http:// or https://";
      }
    } catch {
      errors.website = "Enter a valid URL, e.g. https://yourstore.com";
    }
  }

  if (t(kyc.addressLine1).length < 4) {
    errors.addressLine1 = "Enter the street address of the business.";
  }
  if (!t(kyc.city)) errors.city = "Enter a city.";
  if (t(kyc.state).length < 2) errors.state = "Enter a state or region.";
  if (!POSTAL_RE.test(t(kyc.postalCode))) {
    errors.postalCode = "Enter a valid postal code.";
  }
  if (!t(kyc.country)) errors.country = "Enter a country.";

  if (!kyc.document) {
    errors.document = "Attach a proof of business document or government ID.";
  } else {
    const check = validateDocument(kyc.document);
    if (!check.ok) errors.document = check.reason;
  }

  return errors;
}

/** Trims and canonicalises a submission once it has passed validation. */
export function normalizeKyc(kyc: MerchantKyc): MerchantKyc {
  return {
    legalBusinessName: kyc.legalBusinessName.trim(),
    taxId: formatTaxId(kyc.taxId),
    contactEmail: kyc.contactEmail.trim().toLowerCase(),
    phone: normalizePhone(kyc.phone),
    website: kyc.website.trim(),
    addressLine1: kyc.addressLine1.trim(),
    addressLine2: kyc.addressLine2?.trim() || undefined,
    city: kyc.city.trim(),
    state: kyc.state.trim(),
    postalCode: kyc.postalCode.trim().toUpperCase(),
    country: kyc.country.trim(),
    document: kyc.document,
  };
}

/** Single-line address for tables and summaries. */
export const formatAddress = (kyc: MerchantKyc) =>
  [
    kyc.addressLine1,
    kyc.addressLine2,
    kyc.city,
    `${kyc.state} ${kyc.postalCode}`.trim(),
    kyc.country,
  ]
    .filter(Boolean)
    .join(", ");

export const KYC_STATUS_LABEL: Record<KycStatus, string> = {
  pending: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
};
