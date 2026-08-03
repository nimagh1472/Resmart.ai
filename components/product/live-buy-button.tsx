"use client";

import { ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { BUTTON_MOTION, buttonStyles } from "@/components/ui/button-styles";
import type { Product } from "@/lib/marketplace";
import { trackAffiliateClick } from "@/lib/analytics";
import { formatCurrency, safeExternalUrl } from "@/lib/utils";

/** Hero "Buy Now" CTA for the live product detail page's best-price anchor offer. */
export function LiveBuyButton({
  productId,
  offer,
  offerCount,
}: {
  productId: string;
  offer: Product;
  offerCount: number;
}) {
  const href = safeExternalUrl(offer.url);

  if (!href) {
    return (
      <span
        className={buttonStyles({
          fullWidth: true,
          size: "lg",
          className: "cursor-not-allowed opacity-50",
        })}
        aria-disabled="true"
      >
        Currently unavailable
      </span>
    );
  }

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      onClick={() =>
        trackAffiliateClick({
          productId,
          retailer: offer.store,
          condition: offer.condition ?? "not specified",
          price: offer.price,
          msrp: offer.originalPrice ?? offer.price,
          cashback: 0,
          dealUrl: href,
          offerRank: 1,
          offerCount,
          placement: "product-hero",
        })
      }
      whileHover={BUTTON_MOTION.whileHover}
      whileTap={BUTTON_MOTION.whileTap}
      transition={BUTTON_MOTION.transition}
      className={buttonStyles({ fullWidth: true, size: "lg" })}
    >
      Buy at {offer.store} — {formatCurrency(offer.price)}
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
    </motion.a>
  );
}
