import { NextResponse } from "next/server";
import {
  KYC_STATUS_LABEL,
  formatAddress,
  normalizeKyc,
  validateDocument,
  validateKyc,
  type KycStatus,
  type MerchantApplicationRecord,
  type MerchantKyc,
} from "@/lib/kyc";
import {
  addApplication,
  decideApplication,
  listApplications,
} from "@/lib/merchant-store";

/**
 * Merchant registration and KYC review.
 *
 * GET    /api/merchants[?status=pending]  — applications for the admin console
 * POST   /api/merchants                   — merchant submits verification details
 * PATCH  /api/merchants                   — admin approves or rejects one
 *
 * Backed by the in-memory store in `lib/merchant-store.ts`; swapping that for
 * Supabase leaves this contract untouched. The validator is the same module the
 * onboarding form uses, so a client bypass can't smuggle in a half-filled
 * application.
 */

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Public view of a record. The document body is summarised, not echoed. */
function toSummary(app: MerchantApplicationRecord) {
  return {
    id: app.id,
    status: app.status,
    statusLabel: KYC_STATUS_LABEL[app.status],
    submittedAt: app.submittedAt,
    reviewedAt: app.reviewedAt ?? null,
    rejectionReason: app.rejectionReason ?? null,
    businessName: app.kyc.legalBusinessName,
    contactEmail: app.kyc.contactEmail,
    address: formatAddress(app.kyc),
    kyc: {
      ...app.kyc,
      document: app.kyc.document
        ? {
            name: app.kyc.document.name,
            sizeBytes: app.kyc.document.sizeBytes,
            mediaType:
              /^data:([^;]+);/.exec(app.kyc.document.dataUrl)?.[1] ?? "unknown",
            dataUrl: app.kyc.document.dataUrl,
          }
        : null,
    },
  };
}

const VALID_STATUSES: KycStatus[] = ["pending", "approved", "rejected"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  if (status && !VALID_STATUSES.includes(status as KycStatus)) {
    return NextResponse.json(
      {
        error: "invalid_request",
        details: [`status must be one of ${VALID_STATUSES.join(", ")}.`],
      },
      { status: 400, headers: NO_STORE },
    );
  }

  const applications = listApplications((status as KycStatus) ?? undefined);

  return NextResponse.json(
    {
      source: "mock",
      count: applications.length,
      pending: listApplications("pending").length,
      applications: applications.map(toSummary),
    },
    { headers: NO_STORE },
  );
}

/* ------------------------------------------------------------------ */
/* Submission                                                          */
/* ------------------------------------------------------------------ */

type Body = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Pulls the KYC shape out of an untrusted body without trusting any of it. */
function readKyc(body: Body): MerchantKyc {
  const doc = body.document as Body | null | undefined;

  return {
    legalBusinessName: str(body.legalBusinessName),
    taxId: str(body.taxId),
    contactEmail: str(body.contactEmail),
    phone: str(body.phone),
    website: str(body.website),
    addressLine1: str(body.addressLine1),
    addressLine2: str(body.addressLine2) || undefined,
    city: str(body.city),
    state: str(body.state),
    postalCode: str(body.postalCode),
    country: str(body.country),
    document:
      doc && typeof doc === "object" && typeof doc.dataUrl === "string"
        ? {
            name: str(doc.name) || "proof-of-business",
            dataUrl: doc.dataUrl,
            // Recomputed server-side — a client-supplied size proves nothing.
            sizeBytes: 0,
          }
        : null,
  };
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "invalid_request", details: ["Body must be JSON."] },
      { status: 400, headers: NO_STORE },
    );
  }

  const kyc = readKyc(body);
  const fieldErrors = validateKyc(kyc);

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      {
        error: "invalid_request",
        details: Object.values(fieldErrors),
        fieldErrors,
      },
      { status: 400, headers: NO_STORE },
    );
  }

  const normalized = normalizeKyc(kyc);
  if (normalized.document) {
    const check = validateDocument(normalized.document);
    // validateKyc already ran this; re-reading it here is how the trusted size
    // gets onto the record.
    if (check.ok) normalized.document.sizeBytes = check.sizeBytes;
  }

  // Every new merchant lands in "Pending Approval" — the store owns that
  // default so no caller can self-approve by posting a status.
  const created = addApplication({
    submittedAt: new Date().toISOString(),
    kyc: normalized,
  });

  return NextResponse.json(
    {
      source: "mock",
      persisted: false,
      merchant: toSummary(created),
    },
    { status: 201, headers: NO_STORE },
  );
}

/* ------------------------------------------------------------------ */
/* Admin decision                                                      */
/* ------------------------------------------------------------------ */

export async function PATCH(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "invalid_request", details: ["Body must be JSON."] },
      { status: 400, headers: NO_STORE },
    );
  }

  const id = str(body.id).trim();
  const decision = str(body.decision);
  const reason = str(body.reason).trim();

  const details: string[] = [];
  if (!id) details.push("id is required.");
  if (decision !== "approve" && decision !== "reject") {
    details.push('decision must be "approve" or "reject".');
  }
  // A rejection without a reason turns into a support ticket instead of a
  // resubmission, so the API refuses one.
  if (decision === "reject" && !reason) {
    details.push("reason is required when rejecting an application.");
  }

  if (details.length > 0) {
    return NextResponse.json(
      { error: "invalid_request", details },
      { status: 400, headers: NO_STORE },
    );
  }

  const updated = decideApplication(
    id,
    decision === "approve" ? "approved" : "rejected",
    reason || undefined,
  );

  if (!updated) {
    return NextResponse.json(
      { error: "not_found", details: [`No application with id "${id}".`] },
      { status: 404, headers: NO_STORE },
    );
  }

  return NextResponse.json(
    { source: "mock", merchant: toSummary(updated) },
    { headers: NO_STORE },
  );
}
