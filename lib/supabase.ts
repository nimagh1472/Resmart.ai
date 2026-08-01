import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase clients.
 *
 * Two distinct clients, because they carry different authority:
 *   - `supabase`            — anon key, safe in the browser, subject to RLS.
 *   - `getServiceClient()`  — service-role key, bypasses RLS. Server only.
 *
 * The service-role key must never reach the client bundle, so it is read
 * lazily inside a function rather than at module scope — a top-level read
 * would evaluate during any import, including from a client component.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

function assertConfigured(url?: string, key?: string): asserts url is string {
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
}

let browserClient: SupabaseClient | null = null;

/**
 * Anon-key client for browser and RLS-scoped server reads.
 * Memoized so repeated imports share one realtime connection.
 */
export function getSupabase(): SupabaseClient {
  assertConfigured(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}

let serviceClient: SupabaseClient | null = null;

/**
 * Service-role client — bypasses Row Level Security. Use only in route
 * handlers, server actions, and cron jobs. Never import into a client
 * component.
 */
export function getServiceClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "getServiceClient() was called in the browser. The service-role key must stay server-side.",
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  if (!serviceClient) {
    serviceClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}
