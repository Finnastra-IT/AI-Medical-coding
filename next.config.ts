import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) locates its worker script by a relative
  // require/import at runtime; bundling it rewrites that path and breaks
  // the lookup ("Setting up fake worker failed: Cannot find module
  // .../pdf.worker.mjs"). Excluding it from bundling lets Node resolve it
  // straight from node_modules instead. See api/import-note/route.ts.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
