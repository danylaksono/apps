import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  // Served from https://danylaksono.github.io/apps/hazer/. Anything referencing
  // a static asset must go through import.meta.env.BASE_URL rather than a
  // leading "/", or it resolves against the domain root in production.
  base: "/apps/hazer/",
  // Output stays the default `dist/`: scripts/prepare-deploy.sh builds each
  // project and copies its dist/ into deploy/<project>/, which CI publishes
  // to gh-pages. Nothing is committed pre-built.
  // maplibre's worker is an ES module and imports siblings; bundle it as ESM
  worker: { format: "es" },
  plugins: [react(), tailwindcss()],
  // maplibre-gl loads its worker as a sibling ES module. Vite's dep optimizer
  // rewrites the entry but does not emit the worker chunk, so in dev the
  // worker 404s and nothing ever paints. Excluding it keeps the package's own
  // module layout intact.
  optimizeDeps: { exclude: ["maplibre-gl"] },
});
