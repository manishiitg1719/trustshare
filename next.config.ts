import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Condition photos are sent as resized data URLs from the browser.
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
};

export default nextConfig;
