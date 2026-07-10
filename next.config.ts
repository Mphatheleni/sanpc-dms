import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['mammoth', 'xlsx', 'pdf-lib', 'pg'],
};

export default nextConfig;
