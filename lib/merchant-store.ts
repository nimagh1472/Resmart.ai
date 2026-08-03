import type { KycStatus, MerchantApplicationRecord } from "@/lib/kyc";

/**
 * In-memory merchant application store.
 *
 * Stands in for the `merchants` table until Supabase is wired up: the API route
 * is the only reader/writer, so swapping this for real persistence is a
 * one-file change. Pinned to `globalThis` so the dev server's hot reload
 * doesn't wipe submissions between requests.
 */

const SEED: MerchantApplicationRecord[] = [
  {
    id: "mch-3301",
    status: "pending",
    submittedAt: "2026-07-30T09:14:00.000Z",
    kyc: {
      legalBusinessName: "Northgate Electronics LLC",
      taxId: "84-2910477",
      contactEmail: "ops@northgate-electronics.com",
      phone: "+12065550188",
      website: "https://northgate-electronics.com",
      addressLine1: "1420 Aurora Ave N",
      addressLine2: "Suite 300",
      city: "Seattle",
      state: "WA",
      postalCode: "98109",
      country: "United States",
      document: {
        name: "wa-business-license.pdf",
        // Placeholder stand-in for a real upload — enough for the admin panel
        // to render a document row without shipping a megabyte of base64.
        dataUrl:
          "data:application/pdf;base64,JVBERi0xLjQKJVNlZWQgZG9jdW1lbnQ=",
        sizeBytes: 486_912,
      },
    },
  },
  {
    id: "mch-3302",
    status: "pending",
    submittedAt: "2026-07-29T16:02:00.000Z",
    kyc: {
      legalBusinessName: "Cascade Camera Exchange Inc.",
      taxId: "47-3388120",
      contactEmail: "hello@cascadecamera.co",
      phone: "+15035550142",
      website: "https://instagram.com/cascadecamera",
      addressLine1: "88 SE Grand Ave",
      city: "Portland",
      state: "OR",
      postalCode: "97214",
      country: "United States",
      document: {
        name: "reseller-certificate.png",
        dataUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNiAAAABgADNjd8qAAAAABJRU5ErkJggg==",
        sizeBytes: 312_004,
      },
    },
  },
];

type Store = { applications: MerchantApplicationRecord[] };

const globalStore = globalThis as typeof globalThis & {
  __resmartMerchantStore?: Store;
};

const store: Store =
  globalStore.__resmartMerchantStore ??
  (globalStore.__resmartMerchantStore = { applications: [...SEED] });

/** Newest submission first. */
export function listApplications(
  status?: KycStatus,
): MerchantApplicationRecord[] {
  const all = [...store.applications].sort((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt),
  );
  return status ? all.filter((a) => a.status === status) : all;
}

export function getApplication(id: string) {
  return store.applications.find((a) => a.id === id);
}

/** Adds a submission. Every new merchant starts in "Pending Approval". */
export function addApplication(
  record: Omit<MerchantApplicationRecord, "id" | "status">,
): MerchantApplicationRecord {
  const created: MerchantApplicationRecord = {
    ...record,
    id: `mch-${Math.random().toString(36).slice(2, 8)}`,
    status: "pending",
  };
  store.applications.unshift(created);
  return created;
}

/** Records an admin decision. Returns undefined when the id is unknown. */
export function decideApplication(
  id: string,
  status: Exclude<KycStatus, "pending">,
  rejectionReason?: string,
): MerchantApplicationRecord | undefined {
  const app = getApplication(id);
  if (!app) return undefined;

  app.status = status;
  app.reviewedAt = new Date().toISOString();
  app.rejectionReason = status === "rejected" ? rejectionReason : undefined;
  return app;
}
