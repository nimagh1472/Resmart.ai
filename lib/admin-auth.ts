import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Admin authorization for the privileged API routes.
 *
 * Two accepted credentials, in order:
 *   1. `Authorization: Bearer <ADMIN_API_TOKEN>` — a shared server-to-server
 *      secret, for CI, cron, and local seeding.
 *   2. `Authorization: Bearer <supabase access token>` — a signed-in user
 *      whose `public.users.role` is `admin`.
 *
 * Fails closed. With neither credential configured, every call is rejected
 * rather than defaulting to open: these endpoints change platform pricing
 * and approve merchants.
 */

export type AdminActor =
  | { kind: "service"; id: null }
  | { kind: "user"; id: string; email: string };

type AuthResult =
  | { ok: true; actor: AdminActor }
  | { ok: false; response: NextResponse };

function deny(status: number, error: string, message: string) {
  return {
    ok: false as const,
    response: NextResponse.json({ error, message }, { status }),
  };
}

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, ...rest] = header.split(" ");
  if (scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
}

/** Length-independent compare so a token can't be probed byte by byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function requireAdmin(request: Request): Promise<AuthResult> {
  const token = bearer(request);
  const serviceToken = process.env.ADMIN_API_TOKEN;

  if (!token) {
    return deny(
      401,
      "unauthorized",
      "Missing bearer token. Send Authorization: Bearer <token>.",
    );
  }

  if (serviceToken && safeEqual(token, serviceToken)) {
    return { ok: true, actor: { kind: "service", id: null } };
  }

  if (!isSupabaseConfigured) {
    // With no Supabase, the service token was the only possible credential —
    // so a mismatch here is a bad token, not a configuration gap.
    return serviceToken
      ? deny(401, "unauthorized", "Invalid admin token.")
      : deny(
          503,
          "not_configured",
          "Set ADMIN_API_TOKEN, or configure Supabase to authenticate an admin user.",
        );
  }

  // Verify the JWT against Supabase, then check the role with the service
  // client — the role lookup must not run under the caller's own RLS.
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: userData, error: userError } = await anon.auth.getUser(token);
  if (userError || !userData.user) {
    return deny(401, "unauthorized", "Invalid or expired access token.");
  }

  let role: string | null = null;
  try {
    const { data, error } = await getServiceClient()
      .from("users")
      .select("role")
      .eq("id", userData.user.id)
      .single();
    if (error) throw error;
    role = data?.role ?? null;
  } catch {
    return deny(
      503,
      "role_lookup_failed",
      "Could not verify the caller's role. Is SUPABASE_SERVICE_ROLE_KEY set?",
    );
  }

  if (role !== "admin") {
    return deny(403, "forbidden", "Admin role required.");
  }

  return {
    ok: true,
    actor: {
      kind: "user",
      id: userData.user.id,
      email: userData.user.email ?? "",
    },
  };
}
