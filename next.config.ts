import type { NextConfig } from "next";

// Static export: every page is generated at build time into plain files (out/), so hosting needs no server, no
// functions and no per-request computation. Security headers for static hosts live in public/_headers
// (Cloudflare Pages / Netlify) and vercel.json (Vercel); next.config headers do not apply to a static export.
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  images: { unoptimized: true },
};

export default nextConfig;
