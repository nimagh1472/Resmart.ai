import { NextResponse } from "next/server";

/**
 * First-party analytics sink for `navigator.sendBeacon` (see lib/analytics.ts).
 * Currently logs only — swap the body for a Supabase insert once the events
 * table exists.
 */
export async function POST(request: Request) {
  try {
    const event = await request.json();
    console.log("[track]", event);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // 204 keeps the beacon cheap — there's no response body to read.
  return new NextResponse(null, { status: 204 });
}
