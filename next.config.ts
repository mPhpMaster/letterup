import type { NextConfig } from "next";

// Discord renders Activities in an iframe served from https://<client_id>.discordsays.com,
// embedded by the Discord web/desktop clients. Allow exactly those ancestors.
const frameAncestors = [
  "'self'",
  "https://discord.com",
  "https://*.discord.com",
  "https://discordapp.com",
  "https://*.discordsays.com",
].join(" ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors}` },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
