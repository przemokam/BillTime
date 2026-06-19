import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // BillTime reads local Claude Code transcripts server-side via Node fs.
  // Keep server-only modules out of the client bundle.
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
