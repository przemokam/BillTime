import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // BillTime reads local Claude Code transcripts server-side via Node fs.
  // Keep server-only modules out of the client bundle.
  serverExternalPackages: ["@prisma/client"],
  async headers() {
    // Conservative defaults for a local-first, no-telemetry app.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
