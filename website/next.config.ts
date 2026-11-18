import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: path.resolve(import.meta.dirname) },
};

export default nextConfig;
