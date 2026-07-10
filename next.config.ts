import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['mammoth', 'xlsx', 'pdf-lib', 'better-sqlite3'],
};

export default nextConfig;
