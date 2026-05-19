# Cekplot

Static MapLibre route planner for ordering and routing multi-stop visits in Makassar City with OpenRouteService.

## Stack

- Vite + React + TypeScript
- Zustand for app state
- MapLibre GL JS for basemap, route, and stop layers
- OpenRouteService Optimization and Directions APIs

## Local Development

```bash
npm install
npm run dev
```

## OpenRouteService Keys

For GitHub Pages, prefer the built-in bring-your-own-key field in the app. The key is saved only in the user's browser local storage.

You may also provide a public fallback key at build time:

```bash
VITE_ORS_API_KEY=your_referrer_restricted_key npm run build
```

Only use a fallback key that is restricted in the ORS dashboard to your deployed GitHub Pages URL.

## Address Search

Address search uses Nominatim by default and is intentionally triggered by a Search button, not autocomplete. The app caches repeated queries in local storage, keeps requests below one per second, and exposes `VITE_NOMINATIM_ENDPOINT` so a self-hosted or commercial-compatible geocoder can be swapped in later.

Review the public service policy before deploying with the default endpoint: https://operations.osmfoundation.org/policies/nominatim/

## GitHub Pages

This app is static-only and uses `base: './'` in `vite.config.ts`, so the built `dist` folder can be served from a repository or project page.

```bash
npm run build
```

Deploy the generated `dist` folder through your preferred GitHub Pages workflow.

## CSV Import

Supported rows:

```csv
name,lat,lng
Fort Rotterdam,-5.13439,119.40574
Pantai Losari,-5.14361,119.40708
```

or:

```csv
-5.13439,119.40574
-5.14361,119.40708
```
