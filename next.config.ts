import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdf-lib", "docx", "@prisma/client"],
};

export default nextConfig;
