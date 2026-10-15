# Projection Lab

An interactive comparison of **100 map projections**, in the spirit of
[Mike Bostock's projection comparison](https://observablehq.com/@d3/projection-comparison)
but built for poking at: three comparison layouts, per-projection parameters,
zoom and pan, and measured distortion.

Plain HTML, CSS and JavaScript — no build step, no network requests.

## Running it

Open `index.html`. That is genuinely all: the world topology is inlined as a
script, so it works straight off the filesystem (`file://`).

To also use the finer 1:50m coastlines, serve the folder over HTTP so the
browser is allowed to `fetch` the data file:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

Deployed with the rest of this repository at
<https://danylaksono.github.io/apps/projection-lab/>.

## What it does

**Three comparison modes**

| Mode | What you get |
| --- | --- |
| Side by side | Two panels, split into columns or rows (`Auto` picks whichever gives the maps more room) |
| Overlay | Both projections in one frame — additively blended in two colours, or split by a draggable wipe divider |
| Small multiples | A grid of any number of projections, from a curated preset or hand-picked in the browser |

**Configurable projections.** Every projection gets the three rotation angles
(λ, φ, γ) plus a plane rotation; projections with their own parameters get
controls for them, discovered from the library rather than hard-coded — conic
standard parallels, Hammer's coefficient, satellite distance and tilt,
hyperelliptical α/k/γ, HEALPix and Berghaus lobes, azimuthal clip angle, and so
on. Orientation and shared parameters can be linked across A and B or edited
independently.

**Zoom and pan.** Scroll or pinch to zoom about the cursor, double-click to zoom
in (with <kbd>Alt</kbd> to zoom out), drag to spin the globe (versor rotation,
so the point you grabbed follows the cursor), <kbd>Shift</kbd>-drag to pan. All
panels share one view, so a comparison stays honest.

**Two scale references.** *Fit each panel* sizes every projection to its frame.
*Equal radius* gives them all the same sphere radius instead, which is what you
want when comparing how big a projection draws the world.

**Measured distortion.** Rather than trusting a table of properties, the app
differentiates each projection numerically and reports what it finds:

- area or angular (shape) distortion as a shaded grid, with a legend;
- Tissot indicatrices — true circles on the globe, at a configurable spacing and
  radius;
- per-panel badges: `equal-area` / `conformal` when the measurements support it,
  otherwise the area spread and the median / 98th-percentile angular distortion;
- local figures for the point under the cursor, in the tooltip.

**Details.** Click any country to highlight it in every panel. Copy a link that
restores the exact view (the state lives in the URL fragment). Export the
current comparison as a 2× PNG. Light and dark themes. Keyboard shortcuts for
rotation, zoom, mode and layers.

## Layout

```
index.html            markup and control panel
styles.css            all styling, themed with CSS custom properties
src/projections.js    registry: which projections exist, their family, labels
                      and which parameters they expose
src/metrics.js        distortion analysis by finite differences
src/render.js         projection construction (fit → rotate → zoom) and canvas drawing
src/app.js            state, controls, interaction, URL state, export
src/versor.js         quaternion helpers for drag-to-rotate
vendor/               d3, d3-geo-projection, topojson-client (see NOTICES.md)
data/world-110m.js    Natural Earth 1:110m topology, inlined as a script
data/countries-50m.json  optional finer coastlines, fetched on demand
```

The projection list is built by asking `d3` at load time what it provides, so
the app never offers a projection the bundled libraries cannot draw. Projections
without a `rotate()` accessor (region-specific ones such as Chamberlin Africa or
the modified stereographics) are skipped, because the shared orientation
controls could not drive them.

## Credits

Projections from [d3-geo](https://github.com/d3/d3-geo) and
[d3-geo-projection](https://github.com/d3/d3-geo-projection); coastlines from
[world-atlas](https://github.com/topojson/world-atlas) (Natural Earth, public
domain). Distortion formulas follow Snyder's treatment of the Tissot indicatrix.
