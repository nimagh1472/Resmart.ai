import { NextResponse } from "next/server";

/**
 * Hands the browser off to the Stripe Customer Portal.
 *
 * Set `STRIPE_CUSTOMER_PORTAL_URL` to a Stripe no-code portal link and this
 * works as-is. For per-customer sessions, install the `stripe` package and
 * replace the lookup below with:
 *
 *   const session = await stripe.billingPortal.sessions.create({
 *     customer: customerId,
 *     return_url: `${origin}/account`,
 *   });
 *   return NextResponse.json({ url: session.url });
 */
export async function POST() {
  const url = process.env.STRIPE_CUSTOMER_PORTAL_URL;

  if (!url) {
    return NextResponse.json(
      {
        configured: false,
        message:
          "Stripe is not configured. Set STRIPE_CUSTOMER_PORTAL_URL to enable the billing portal.",
      },
      { status: 501 },
    );
  }

  return NextResponse.json({ configured: true, url });
}
