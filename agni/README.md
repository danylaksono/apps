# Agni

A situational map of forest and peatland fire across **Indonesia** -- active fire
detections, haze forecasts, burnt area, peat, population exposure, and the
land-tenure context that explains where fires sit and who holds the permit.

Live at **https://danylaksono.github.io/apps/agni/**

Built by [danylaksono](https://github.com/danylaksono).

## Reproducing this

Almost everything is fetched live from **keyless public APIs** — NASA FIRMS and
GIBS, ECMWF/CAMS, Copernicus Land, Global Forest Watch, BIG SatuPeta. There is
no server and no database. Only boundaries and Kontur population are precomputed, and
only because they are too big to fetch at runtime.

```sh
npm install
npm run dev      # serves at /apps/agni/, not / — `base` applies in dev too
npm run lint
```

### Adding a layer

Layers are data, not code paths. One entry in `src/layers/registry.ts` gives you
a toggle, an opacity slider, a legend, render order and click-to-inspect:

```ts
{
  id: "my-layer",
  group: "fire",              // decides which panel section and draw order
  label: "My layer",
  description: "What it is, where it came from, and the caveat that matters.",
  layerType: "raster",
  defaultVisible: false,
  defaultOpacity: 0.8,
  gradientLegend: { css: "linear-gradient(90deg, …)", min: "low", max: "high" },
  add(map) { /* addSource + addLayer */ },
  remove(map) { /* removeLayer + removeSource */ },
}
```

Optional fields cover the awkward cases: `modes` for a layer with two ways of
drawing itself, `mapLayerIds` when one entry creates several map layers,
`setOpacity` when the default opacity mapping does not fit.

Patterns worth copying when a source is less cooperative:

| Situation                                       | Where it is solved                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| Tiles encode data instead of colour             | `lib/gfwRaster.ts`, `lib/clms.ts` — decode via `addProtocol`         |
| The server dates its imagery and `default` 404s | `lib/gibs.ts` — probe backwards over the area of interest            |
| Render-on-demand WMS, too slow to animate       | `lib/cams.ts` — prefetch frames, gate playback on readiness          |
| Rows too numerous to tile                       | `lib/population.ts` — Parquet + DuckDB-WASM, aggregated per viewport |
| A category code the service will not decode     | `lib/forest.ts` — derive the mapping, then check it against published totals |
| A chart that must scope the map without lying   | `lib/forestTag.ts` — tag once, count tags, exclude the facet from itself |
| A canvas glyph the style spec cannot draw       | `layers/glyphs.ts` — DOM markers keyed to source features            |

### Adapting it for another dashboard

The shell is domain-agnostic: registry-driven layers, a Zustand store, a
filter row that scopes the map and every chart at once, a collapsible chart
rail, and hand-rolled SVG charts with no chart library. To retarget it, replace
the registry entries and `src/lib/config.ts` (endpoints and area of interest),
then swap the analytics in `src/lib/analytics.ts` for your own domain's
aggregations. The map, panels, filters, charts and responsive layout carry over
unchanged.

## Data pipeline

`pipeline/` converts local boundary and population data into the artefacts in
`public/data/`. Re-run only when those inputs change:

```sh
python pipeline/build_tiles.py   # -> kabkota_indonesia.geojson, population_h3.parquet
python pipeline/tile.py          # -> boundaries.pmtiles
```

Population is deliberately **not** tiled: nationally it is 874,919 Kontur
hexagons, ~113 MB as PMTile. This is past GitHub's 100 MB per-file limit. However, it's 3.9 MB
as a geometry-free Parquet, queried in the browser by DuckDB-WASM.

## Deployment

This is part of my `app` playground. `main` is the source of truth. `scripts/prepare-deploy.sh` builds every top-level project and CI publishes `deploy/` to `gh-pages`, which is generated, never edit it by hand. Deploying is: commit to `main` and push.

Two things must stay in step if you copy this setup:

- `base` in `vite.config.ts` must match the served path (`/apps/<name>/`).
- Every static asset must go through `import.meta.env.BASE_URL`, not a leading
  `/`, or it resolves against the domain root in production.

## Documentation

- **[Docs/LAYERS.md](Docs/LAYERS.md)** — the layer catalogue, styling
  conventions, render order, and the patterns behind the awkward sources.
- **[Docs/METHODOLOGY.md](Docs/METHODOLOGY.md)** — where each layer comes from,
  how it is processed, and the caveats that matter.

**Caveats worth knowing up front**: The Peat data is available for Kalimantan only at the moment (at least what I can find so far), so the peat KPI is scoped and labelled as such; FIRMS' near-real-time endpoint caps at five days; and population exposure is meaningless without its radius and
window, which is why the tile prints both. The forest-status breakdown comes
from KLHK's *penetapan* (gazettement) map, so land that is designated forest but
not yet gazetted counts as "outside" — read that share as an upper bound.
