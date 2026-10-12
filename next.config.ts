import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) locates its worker script by a relative
  // require/import at runtime; bundling it rewrites that path and breaks
  // the lookup ("Setting up fake worker failed: Cannot find module
  // .../pdf.worker.mjs"). Excluding it from bundling lets Node resolve it
  // straight from node_modules instead. See api/import-note/route.ts.
  //
  // "@napi-rs/canvas" (a native binary, pulled in transitively by pdf-parse
  // to polyfill DOMMatrix/ImageData/Path2D — Node has no browser canvas
  // APIs natively) needs the same treatment for the same underlying reason:
  // bundling a native addon breaks it. Without this, the deployed Vercel
  // function throws "Cannot find module '@napi-rs/canvas'" followed by
  // "ReferenceError: DOMMatrix is not defined" the moment a PDF import is
  // attempted in production — works locally (`pnpm dev` resolves node_modules
  // directly) but fails once bundled for serverless. Don't remove this entry
  // without reproducing a real PDF import against a Vercel deploy, not just
  // local dev — that's exactly how this gap went unnoticed the first time.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
