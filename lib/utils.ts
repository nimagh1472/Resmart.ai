import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, letting later Tailwind utilities win. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Fixed-timezone date formatting. Rendering ISO dates with the ambient locale
 * would let the server and client disagree and trip a hydration warning.
 *
 * Accepts both a date (`2026-07-30`) and a full timestamp — API records carry
 * the latter, and appending a time to one that already has one yields an
 * Invalid Date.
 */
export function formatDate(iso: string) {
  const value = iso.includes("T") ? iso : `${iso}T00:00:00Z`;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Decodes a route param or query value that may already be decoded, may be
 * malformed (a lone `%` from a title like "50% off" — not a real escape
 * sequence), may legitimately contain reserved characters (`|`, as in eBay's
 * `v1|110599963383|0` item ids), or may be missing/an array (Next.js's
 * `searchParams` type allows `string | string[] | undefined` even where a
 * page only expects one value, e.g. a duplicated `?title=a&title=b`).
 * `decodeURIComponent` throws a `URIError` on malformed input, which would
 * otherwise crash the whole Server Component render tree; this normalizes
 * missing/array input and falls back to the raw string on a decode error
 * instead.
 */
export function safeDecodeURIComponent(
  value: string | string[] | undefined | null,
): string {
  if (value == null) return "";
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return "";

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Gate for any URL that reaches an `href`. Affiliate destinations arrive from
 * merchant feeds, so they're untrusted input: anything that isn't an absolute
 * http(s) URL — `javascript:`, `data:`, a relative path that would keep the
 * user on our origin while looking outbound — comes back as `null`, and the
 * caller renders a disabled control instead of a link.
 */
export function safeExternalUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    // Not parseable as absolute — reject rather than guess at a base.
    return null;
  }
}

/**
 * USD formatter. Cents are shown only when the value actually has them, so
 * list prices read `$849` while a finer amount reads `$25.47`.
 */
export function formatCurrency(
  value: number,
  { cents = !Number.isInteger(value) }: { cents?: boolean } = {},
) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}
