import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: build a hostable `out/` (no Node server, no /api routes).
  // The SQLite-backed server build (desktop/Electron) lives on a separate
  // branch and is not produced by this config.
  output: "export",
  // GitHub Pages serves this project at /manifest-diary — the asset/Link
  // prefix must match the repo subpath. Set `BASE_PATH=""` locally to dev
  // without the prefix.
  basePath: process.env.BASE_PATH ?? "/manifest-diary",
  // Pages has no Next image optimizer.
  images: { unoptimized: true },
  // `trailingSlash: true` makes dynamic client routes (e.g. /projects/[id])
  // resolve cleanly on a static host that serves directory index.html.
  trailingSlash: true,
};

export default nextConfig;
