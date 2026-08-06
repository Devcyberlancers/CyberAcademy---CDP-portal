import type { NextConfig } from "next";

const adminAssetPrefix = process.env.NEXT_PUBLIC_ADMIN_ASSET_PREFIX?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  assetPrefix: adminAssetPrefix || undefined,
  // Avoid development/production chunk collisions when an admin build is run
  // while the local dev server is still open.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false
};

export default nextConfig;
