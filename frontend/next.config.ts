import type { NextConfig } from "next";

// The browser only ever talks to /api on the frontend's own origin; Next.js proxies it to
// FastAPI. That keeps the session cookie first-party in production (Vercel -> Render).
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@cloudscape-design/components", "@cloudscape-design/component-toolkit"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
