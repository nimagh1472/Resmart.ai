import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, letting later Tailwind utilities win. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Fixed-timezone date formatting. Rendering ISO dates with the ambient locale
 * would let the server and client disagree and trip a hydration warning.
 */
export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
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
 * list prices read `$849` while cashback reads `$25.47`.
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
