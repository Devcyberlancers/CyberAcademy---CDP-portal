import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep development chunks separate from production builds. This prevents a
  // `next build` run from replacing files used by an open `next dev` server.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false
};

export default nextConfig;
