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
