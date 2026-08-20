# Hazer

A situational map of forest and peatland fire in **Kalimantan** — active fire
detections, haze, peat, and the land-tenure context that explains where fires
sit and who holds the permit.

Live at **https://danylaksono.github.io/apps/hazer/**

## Deployment

This repo's `main` branch is the source of truth. `scripts/prepare-deploy.sh`
walks every top-level project, runs `npm ci && npm run build` where a build
script exists, copies the resulting `dist/` into `deploy/<project>/`, and CI
publishes `deploy/` to the `gh-pages` branch. **`gh-pages` is generated — never
edit it by hand, it is replaced wholesale on every deploy.**

So deploying is just: commit to `main` and push.

Two things must stay in step if you copy this setup for another app:

- `base` in `vite.config.ts` must match the served path (`/apps/<name>/`).
- Every static asset reference must go through `import.meta.env.BASE_URL`
  rather than a leading `/`, or it resolves against the domain root in
  production. See `src/lib/config.ts`.

## Development

```sh
npm install
npm run dev            # serves at /apps/hazer/, not / — `base` applies in dev too
npm run lint
```

## Data pipeline

`pipeline/` converts local boundary and population data into the PMTiles served
from `public/data/`. It only needs re-running when those inputs change:

```sh
python pipeline/build_tiles.py   # stage Kalimantan subsets
python pipeline/tile.py          # -> public/data/*.pmtiles
```

Everything else — fires, peat, concessions, haze — is fetched live from public
APIs at runtime and needs no build step.

## Documentation

- **[METHODOLOGY.md](METHODOLOGY.md)** — where every layer comes from, how it is
  processed, and the caveats that matter. Read this before adding a layer.
- **[LAYERS.md](LAYERS.md)** — the layer catalogue, styling conventions, and
  render order.
- **[AGENTS.md](AGENTS.md)** — project state, working endpoints, dead ends, and
  bugs already fixed.
