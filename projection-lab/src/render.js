/* Projection construction + canvas drawing.
 *
 * A panel's projection is assembled in three steps so that spinning the globe
 * never makes the map resize under the cursor:
 *   1. the projection is fitted to the panel once, at rotation [0,0,0]
 *      (cached per projection + parameters + panel size),
 *   2. the current rotation is applied,
 *   3. zoom and pan are applied as an affine adjustment to scale/translate.
 */
(function (global) {
  "use strict";

  const fitCache = new Map();
  const FIT_CACHE_LIMIT = 600;

  function paramSignature(entry, params) {
    const parts = [];
    for (const spec of entry.params) {
      const v = params[spec.name];
      parts.push(spec.name + ":" + (Array.isArray(v) ? v.join(",") : v));
    }
    if (entry.clippable) parts.push("clip:" + params.clipAngle);
    if (entry.angle) parts.push("angle:" + params.angle);
    return parts.join("|");
  }

  function instantiate(d3, entry, params, rotate, precision) {
    const projection = d3[entry.id]();
    for (const spec of entry.params) {
      const value = params[spec.name];
      if (value === undefined || value === null) continue;
      try {
        projection[spec.name](spec.kind === "pair" ? [+value[0], +value[1]] : +value);
      } catch (err) {
        /* leave the library default in place */
      }
    }
    if (entry.clippable && params.clipAngle !== undefined && params.clipAngle !== null) {
      try {
        projection.clipAngle(+params.clipAngle);
      } catch (err) { /* ignore */ }
    }
    if (entry.angle && params.angle !== undefined && params.angle !== null) {
      try {
        projection.angle(+params.angle);
      } catch (err) { /* ignore */ }
    }
    try {
      projection.rotate([+rotate[0] || 0, +rotate[1] || 0, +rotate[2] || 0]);
    } catch (err) { /* ignore */ }
    if (typeof projection.precision === "function") projection.precision(precision);
    return projection;
  }

  function baseFit(d3, entry, params, width, height, fitMode) {
    const key = [entry.id, paramSignature(entry, params), width, height, fitMode].join("#");
    const hit = fitCache.get(key);
    if (hit) return hit;

    const probe = instantiate(d3, entry, params, [0, 0, 0], 0.5);
    const pad = Math.max(4, Math.min(width, height) * 0.035);
    let scale = 100;
    let offset = [0, 0];
    try {
      probe.fitExtent([[pad, pad], [width - pad, height - pad]], { type: "Sphere" });
      const t = probe.translate();
      scale = probe.scale();
      offset = [t[0] - width / 2, t[1] - height / 2];
      if (!isFinite(scale) || scale <= 0) throw new Error("bad fit");
      if (!isFinite(offset[0]) || !isFinite(offset[1])) offset = [0, 0];
    } catch (err) {
      scale = Math.min(width, height) / 4;
      offset = [0, 0];
    }

    if (fitMode === "equal") {
      const radius = (Math.min(width, height) / 2) * 0.88;
      const ratio = radius / scale;
      offset = [offset[0] * ratio, offset[1] * ratio];
      scale = radius;
    }

    const result = { scale: scale, offset: offset };
    if (fitCache.size > FIT_CACHE_LIMIT) fitCache.clear();
    fitCache.set(key, result);
    return result;
  }

  /* Builds the ready-to-draw projection for a panel. */
  function build(d3, entry, params, geometry) {
    const width = geometry.width;
    const height = geometry.height;
    const view = geometry.view || { zoom: 1, x: 0, y: 0 };
    const fit = baseFit(d3, entry, params, width, height, geometry.fitMode || "fit");
    const zoom = view.zoom || 1;
    const projection = instantiate(
      d3, entry, params, params.rotate || [0, 0, 0],
      geometry.precision === undefined ? 0.4 : geometry.precision
    );
    projection.scale(fit.scale * zoom);
    projection.translate([
      width / 2 + view.x + fit.offset[0] * zoom,
      height / 2 + view.y + fit.offset[1] * zoom,
    ]);
    projection.__fit = fit;
    return projection;
  }

  /* Width-to-height ratio of the projected sphere, used to pick the better
   * split direction automatically. Measured after a fit so that projections
   * with unbounded extents (Mercator) still report a finite box. */
  const aspectCache = new Map();

  function sphereAspect(d3, entry, params) {
    const key = entry.id + "#" + paramSignature(entry, params);
    if (aspectCache.has(key)) return aspectCache.get(key);
    let aspect = 2;
    try {
      const probe = instantiate(d3, entry, params, [0, 0, 0], 0.8);
      probe.fitExtent([[0, 0], [1000, 1000]], { type: "Sphere" });
      const bounds = d3.geoPath(probe).bounds({ type: "Sphere" });
      const w = bounds[1][0] - bounds[0][0];
      const h = bounds[1][1] - bounds[0][1];
      if (isFinite(w) && isFinite(h) && w > 0 && h > 0) aspect = w / h;
    } catch (err) {
      /* keep the 2:1 default */
    }
    if (aspectCache.size > 400) aspectCache.clear();
    aspectCache.set(key, aspect);
    return aspect;
  }

  function graticuleFor(d3, step) {
    return d3.geoGraticule().stepMinor([step, step]).stepMajor([90, 360])();
  }

  /* --- distortion shading ------------------------------------------------ */

  function distortionColorScale(d3, mode) {
    if (mode === "angular") {
      const scale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 60]).clamp(true);
      return { color: (cell) => scale(cell.omega), value: (cell) => cell.omega };
    }
    const scale = d3.scaleDiverging(d3.interpolatePuOr).domain([-2.2, 0, 2.2]).clamp(true);
    return { color: (cell) => scale(Math.log2(cell.area)), value: (cell) => cell.area };
  }

  function drawDistortion(d3, ctx, projection, mode, step, alpha) {
    const sample = global.Distortion.sampleGrid(d3, projection, { step: step });
    if (!sample.cells.length) return sample.stats;
    const scale = distortionColorScale(d3, mode);
    // Bucket the cells by quantised colour so the whole grid needs only a
    // couple of dozen fill calls.
    const buckets = new Map();
    for (const cell of sample.cells) {
      const color = d3.color(scale.color(cell));
      if (!color) continue;
      const key = (Math.round(color.r / 8) * 8) + "," + (Math.round(color.g / 8) * 8) + "," + (Math.round(color.b / 8) * 8);
      let bucket = buckets.get(key);
      if (!bucket) buckets.set(key, (bucket = []));
      bucket.push(cell);
    }
    const path = d3.geoPath(projection, ctx);
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 0.72 : alpha;
    for (const [key, cells] of buckets) {
      ctx.beginPath();
      for (const cell of cells) {
        // Wound so that the interior is the cell itself: d3 treats a
        // spherical ring's left-hand side as the interior, so going east
        // first would describe the whole sphere minus the cell.
        path({
          type: "Polygon",
          coordinates: [[
            [cell.lon0, cell.lat0], [cell.lon0, cell.lat1],
            [cell.lon1, cell.lat1], [cell.lon1, cell.lat0],
            [cell.lon0, cell.lat0],
          ]],
        });
      }
      ctx.fillStyle = "rgb(" + key + ")";
      ctx.fill();
    }
    ctx.restore();
    return sample.stats;
  }

  function drawTissot(d3, ctx, projection, options, theme) {
    const step = options.step || 30;
    const radius = options.radius || 6;
    const circle = d3.geoCircle().radius(radius).precision(4);
    const visible = global.Distortion.visibilityTest(d3, projection);
    const path = d3.geoPath(projection, ctx);
    const limit = 90 - step / 2;
    ctx.beginPath();
    for (let lat = -limit; lat <= limit + 1e-9; lat += step) {
      for (let lon = -180; lon < 180 - 1e-9; lon += step) {
        if (visible && !visible(lon, lat)) continue;
        path(circle.center([lon, lat])());
      }
    }
    ctx.fillStyle = theme.tissotFill;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = theme.tissotStroke;
    ctx.stroke();
  }

  /* --- panel drawing ----------------------------------------------------- */

  function drawMap(d3, ctx, projection, opts) {
    const theme = opts.theme;
    const layers = opts.layers;
    const world = opts.world;
    const path = d3.geoPath(projection, ctx);
    const sphere = { type: "Sphere" };
    const lineScale = opts.lineScale === undefined ? 1 : opts.lineScale;
    const stats = { distortion: null };

    if (layers.ocean) {
      ctx.beginPath();
      path(sphere);
      ctx.fillStyle = opts.oceanColor || theme.ocean;
      ctx.fill();
    }

    if (opts.distortionMode && opts.distortionMode !== "none") {
      // Clip the shading to the sphere so it cannot bleed past the outline.
      ctx.save();
      ctx.beginPath();
      path(sphere);
      ctx.clip();
      stats.distortion = drawDistortion(
        d3, ctx, projection, opts.distortionMode,
        opts.distortionStep || 10, opts.distortionAlpha
      );
      ctx.restore();
    }

    if (layers.graticule) {
      ctx.beginPath();
      path(graticuleFor(d3, opts.graticuleStep || 20));
      ctx.lineWidth = 0.7 * lineScale;
      ctx.strokeStyle = opts.graticuleColor || theme.graticule;
      ctx.stroke();
    }

    if (layers.land && world.land) {
      ctx.beginPath();
      path(world.land);
      ctx.fillStyle = opts.landColor || theme.land;
      ctx.fill();
      if (opts.landStroke) {
        ctx.lineWidth = 0.8 * lineScale;
        ctx.strokeStyle = opts.landStroke;
        ctx.stroke();
      }
    }

    if (layers.borders && world.borders) {
      ctx.beginPath();
      path(world.borders);
      ctx.lineWidth = 0.6 * lineScale;
      ctx.strokeStyle = opts.borderColor || theme.border;
      ctx.stroke();
    }

    if (opts.highlight) {
      ctx.beginPath();
      path(opts.highlight);
      ctx.fillStyle = theme.highlightFill;
      ctx.fill();
      ctx.lineWidth = 1.4 * lineScale;
      ctx.strokeStyle = theme.highlightStroke;
      ctx.stroke();
    }

    if (layers.tissot) {
      drawTissot(d3, ctx, projection, opts.tissot || {}, theme);
    }

    if (layers.sphere) {
      ctx.beginPath();
      path(sphere);
      ctx.lineWidth = 1.1 * lineScale;
      ctx.strokeStyle = opts.sphereColor || theme.sphere;
      ctx.stroke();
    }

    return stats;
  }

  global.Renderer = {
    build: build,
    instantiate: instantiate,
    drawMap: drawMap,
    paramSignature: paramSignature,
    sphereAspect: sphereAspect,
    graticuleFor: graticuleFor,
    distortionColorScale: distortionColorScale,
    clearFitCache: () => fitCache.clear(),
  };
})(window);
