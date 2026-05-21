import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
