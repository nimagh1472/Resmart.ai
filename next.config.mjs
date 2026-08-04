/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Product imagery is hotlinked from each retailer's CDN. next/image throws
    // on unconfigured hosts, so every supported retailer must be listed here.
    remotePatterns: [
      { protocol: "https", hostname: "pisces.bbystatic.com" }, // Best Buy
      { protocol: "https", hostname: "i.ebayimg.com" }, // eBay
      { protocol: "https", hostname: "i5.walmartimages.com" }, // Walmart
      { protocol: "https", hostname: "m.media-amazon.com" }, // Amazon Warehouse
      { protocol: "https", hostname: "target.scene7.com" }, // Target
      { protocol: "https", hostname: "targetimg1.targetstatic.com" }, // Target
    ],
  },
};

export default nextConfig;
