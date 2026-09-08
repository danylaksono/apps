/* Projection Lab — state, controls and panel orchestration. */
(function () {
  "use strict";

  const d3 = window.d3;
  const topojson = window.topojson;
  const registry = window.ProjectionRegistry.build(d3);
  const versor = window.versor;

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const ZOOM_MIN = 0.15;
  const ZOOM_MAX = 60;

  /* ------------------------------------------------------------------ theme */

  const THEMES = {
    dark: {
      ocean: "#112239",
      land: "#4a6b8c",
      landStroke: "rgba(220,240,255,0.16)",
      landOutline: "rgba(236,246,255,0.75)",
      border: "rgba(8,14,24,0.6)",
      graticule: "rgba(124,219,255,0.16)",
      sphere: "rgba(124,219,255,0.5)",
      tissotFill: "rgba(255,209,102,0.16)",
      tissotStroke: "rgba(255,209,102,0.8)",
      highlightFill: "rgba(255,209,102,0.6)",
      highlightStroke: "#ffd166",
      accentA: "#7cdbff",
      accentB: "#ff9ec4",
      panelBg: "#0e1524",
      exportBg: "#0b0f1b",
      exportText: "#e6eef7",
      overlayComposite: "lighter",
    },
    light: {
      ocean: "#e9f1f8",
      land: "#aebfd0",
      landStroke: "rgba(255,255,255,0.85)",
      landOutline: "rgba(18,38,66,0.75)",
      border: "rgba(255,255,255,0.9)",
      graticule: "rgba(23,58,94,0.14)",
      sphere: "rgba(23,58,94,0.4)",
      tissotFill: "rgba(196,110,20,0.14)",
      tissotStroke: "rgba(154,84,10,0.8)",
      highlightFill: "rgba(230,140,30,0.55)",
      highlightStroke: "#b4600f",
      accentA: "#1f7ca8",
      accentB: "#c2185b",
      panelBg: "#ffffff",
      exportBg: "#f6f7fb",
      exportText: "#16233a",
      overlayComposite: "multiply",
    },
  };

  /* ------------------------------------------------------------------ state */

  const PRESET_SETS = {
    popular: ["geoEquirectangular", "geoMercator", "geoRobinson", "geoWinkel3", "geoNaturalEarth1",
      "geoEqualEarth", "geoMollweide", "geoEckert4", "geoVanDerGrinten", "geoMiller",
      "geoKavrayskiy7", "geoPatterson"],
    equalArea: ["geoCylindricalEqualArea", "geoMollweide", "geoSinusoidal", "geoEckert4", "geoEckert6",
      "geoEqualEarth", "geoHammer", "geoBoggs", "geoHomolosine", "geoMtFlatPolarQuartic",
      "geoAzimuthalEqualArea", "geoConicEqualArea", "geoCollignon", "geoWagner4"],
    conformal: ["geoMercator", "geoTransverseMercator", "geoConicConformal", "geoStereographic",
      "geoGuyou", "geoPeirceQuincuncial", "geoAugust", "geoEisenlohr", "geoLagrange", "geoLittrow"],
    compromise: ["geoRobinson", "geoWinkel3", "geoNaturalEarth1", "geoNaturalEarth2", "geoKavrayskiy7",
      "geoMiller", "geoPatterson", "geoVanDerGrinten", "geoWagner6", "geoTimes", "geoBaker",
      "geoGinzburg9"],
    globes: ["geoOrthographic", "geoAzimuthalEqualArea", "geoAzimuthalEquidistant", "geoStereographic",
      "geoGnomonic", "geoSatellite", "geoAiry", "geoWiechel"],
    conic: ["geoAlbers", "geoConicConformal", "geoConicEquidistant", "geoBonne", "geoPolyconic",
      "geoRectangularPolyconic", "geoArmadillo", "geoCraig"],
    interrupted: ["geoInterruptedSinusoidal", "geoInterruptedMollweide", "geoInterruptedMollweideHemispheres",
      "geoInterruptedBoggs", "geoInterruptedHomolosine", "geoInterruptedSinuMollweide",
      "geoInterruptedQuarticAuthalic", "geoPolyhedralButterfly", "geoPolyhedralWaterman",
      "geoPolyhedralCollignon", "geoHealpix", "geoBerghaus"],
  };

  const VIEW_PRESETS = {
    atlantic: { label: "Atlantic (0°)", rotate: [0, 0, 0] },
    pacific: { label: "Pacific-centred", rotate: [-150, 0, 0] },
    americas: { label: "Americas", rotate: [90, -10, 0] },
    europeAfrica: { label: "Europe & Africa", rotate: [-15, -15, 0] },
    asia: { label: "Asia", rotate: [-100, -25, 0] },
    oceania: { label: "Oceania", rotate: [-145, 20, 0] },
    north: { label: "North pole", rotate: [0, -90, 0] },
    south: { label: "South pole", rotate: [0, 90, 0] },
    transverse: { label: "Transverse (roll 90°)", rotate: [0, 0, 90] },
  };

  function defaultParamsFor(id) {
    const entry = registry.get(id);
    const params = { rotate: [0, 0, 0] };
    if (!entry) return params;
    for (const spec of entry.params) {
      params[spec.name] = Array.isArray(spec.default) ? spec.default.slice() : spec.default;
    }
    if (entry.clippable) params.clipAngle = entry.clipDefault;
    if (entry.angle) params.angle = entry.angleDefault;
    return params;
  }

  const state = {
    mode: "side",
    splitOrientation: "auto",
    a: "geoEquirectangular",
    b: "geoMercator",
    link: true,
    params: { a: defaultParamsFor("geoEquirectangular"), b: defaultParamsFor("geoMercator") },
    editing: "a",
    view: { zoom: 1, x: 0, y: 0 },
    dragMode: "rotate",
    lockRoll: true,
    fitMode: "fit",
    spin: false,
    spinSpeed: 8,
    overlay: { style: "blend", opacity: 0.55, wipe: 0.5 },
    multiples: { set: PRESET_SETS.popular.slice(), cols: 0 },
    layers: { ocean: true, graticule: true, land: true, borders: true, sphere: true, tissot: false },
    graticuleStep: 20,
    tissot: { step: 30, radius: 6 },
    distortion: { mode: "none", step: 10, alpha: 0.72 },
    detail: "110m",
    showLabels: true,
    showMetrics: true,
    highlight: null,
    theme: "dark",
  };

  /* --------------------------------------------------------------- world data */

  const worldCache = {};
  let world = null;

  function prepareWorld(topo) {
    const countries = topojson.feature(topo, topo.objects.countries);
    return {
      land: topojson.feature(topo, topo.objects.land),
      borders: topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b),
      countries: countries.features.filter((f) => f.geometry),
    };
  }

  function setDetail(detail) {
    state.detail = detail;
    if (worldCache[detail]) {
      world = worldCache[detail];
      requestRender();
      return;
    }
    if (detail === "110m") {
      worldCache["110m"] = prepareWorld(window.PROJECTION_LAB_WORLD_110M);
      world = worldCache["110m"];
      requestRender();
      return;
    }
    setStatus("Loading 1:50m coastlines…");
    fetch("data/countries-50m.json")
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((topo) => {
        worldCache["50m"] = prepareWorld(topo);
        if (state.detail === "50m") world = worldCache["50m"];
        setStatus("");
        requestRender();
      })
      .catch(() => {
        state.detail = "110m";
        const input = $('input[name="detail"][value="110m"]');
        if (input) input.checked = true;
        setStatus("Could not load the 1:50m file — staying on 1:110m. (Serve the folder over HTTP to enable it.)", true);
      });
  }

  /* ------------------------------------------------------------------ panels */

  const stage = $("#stage");
  const tooltip = $("#tooltip");
  let panels = [];
  let panelSignature = "";

  function activeParams(slot) {
    if (state.mode === "multiples") return state.params.a;
    if (state.link) return state.params.a;
    return state.params[slot] || state.params.a;
  }

  /* Parameters for a projection in small-multiples mode: the shared
   * orientation, but each projection keeps its own intrinsic defaults unless
   * the reference projection has the same named parameter. */
  function paramsForId(id) {
    const base = state.params.a;
    const entry = registry.get(id);
    const merged = defaultParamsFor(id);
    merged.rotate = (base.rotate || [0, 0, 0]).slice();
    if (!entry) return merged;
    if (entry.angle && base.angle !== undefined) merged.angle = base.angle;
    for (const spec of entry.params) {
      const shared = base[spec.name];
      if (shared === undefined) continue;
      if (Array.isArray(shared) !== Array.isArray(merged[spec.name])) continue;
      merged[spec.name] = Array.isArray(shared) ? shared.slice() : shared;
    }
    return merged;
  }

  /* Which way to split the stage in side-by-side mode. "auto" picks whichever
   * gives the two maps more room, which for 2:1 world maps on a laptop screen
   * is usually stacked rows rather than narrow columns. */
  function effectiveSplit() {
    if (state.splitOrientation !== "auto") return state.splitOrientation;
    const rect = stage.getBoundingClientRect();
    const w = rect.width || 900;
    const h = rect.height || 600;
    const gap = 10;
    const entryA = registry.get(state.a);
    const entryB = registry.get(state.b);
    const aspects = [];
    if (entryA) aspects.push(window.Renderer.sphereAspect(d3, entryA, activeParams("a")));
    if (entryB) aspects.push(window.Renderer.sphereAspect(d3, entryB, state.link ? activeParams("a") : activeParams("b")));
    const aspect = aspects.length ? aspects.reduce((a, b) => a + b, 0) / aspects.length : 2;
    const columnsScore = Math.min((w - gap) / 2 / aspect, h);
    const rowsScore = Math.min(w / aspect, (h - gap) / 2);
    return columnsScore >= rowsScore ? "columns" : "rows";
  }

  function panelPlan() {
    if (state.mode === "overlay") {
      return [{ key: "overlay", kind: "overlay" }];
    }
    if (state.mode === "multiples") {
      const ids = state.multiples.set.filter((id) => registry.has(id));
      return ids.map((id) => ({ key: "m:" + id, kind: "single", id: id, slot: "m" }));
    }
    return [
      { key: "a:" + state.a, kind: "single", id: state.a, slot: "a" },
      { key: "b:" + state.b, kind: "single", id: state.b, slot: "b" },
    ];
  }

  function buildPanels() {
    const plan = panelPlan();
    const split = state.mode === "side" ? effectiveSplit() : "";
    const signature = [
      state.mode, split, state.multiples.cols, state.showLabels,
      plan.map((p) => p.key).join(","),
    ].join("|");
    if (signature === panelSignature) {
      plan.forEach((p, i) => {
        if (panels[i]) panels[i].plan = p;
      });
      return;
    }
    panelSignature = signature;
    stage.innerHTML = "";
    panels = plan.map((p) => createPanel(p));
    stage.className = "stage mode-" + state.mode + (split ? " split-" + split : "");
    if (state.mode === "multiples") {
      const cols = state.multiples.cols || Math.max(1, Math.round(Math.sqrt(Math.max(1, plan.length) * 1.6)));
      stage.style.setProperty("--cols", cols);
    } else {
      stage.style.removeProperty("--cols");
    }
    if (!plan.length) {
      stage.innerHTML = '<p class="empty">No projections selected — pick some in the projection browser.</p>';
    }
    measurePanels();
  }

  function createPanel(plan) {
    const el = document.createElement("div");
    el.className = "panel";
    el.innerHTML =
      "<canvas></canvas>" +
      '<div class="panel-head">' +
      '<div class="panel-titles"><span class="panel-title"></span><span class="panel-sub"></span></div>' +
      '<div class="panel-badges"></div>' +
      '<div class="panel-actions"></div>' +
      "</div>";
    stage.appendChild(el);

    const canvas = $("canvas", el);
    const panel = {
      plan: plan,
      el: el,
      canvas: canvas,
      ctx: canvas.getContext("2d"),
      head: $(".panel-head", el),
      title: $(".panel-title", el),
      sub: $(".panel-sub", el),
      badges: $(".panel-badges", el),
      actions: $(".panel-actions", el),
      width: 300,
      height: 200,
      dpr: 1,
      projection: null,
      projectionB: null,
    };

    if (plan.kind === "single" && plan.slot === "m") {
      const mkBtn = (slot, label, title) => {
        const button = document.createElement("button");
        button.className = "slot-btn";
        button.type = "button";
        button.textContent = label;
        button.title = title;
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          state[slot] = plan.id;
          const fresh = defaultParamsFor(plan.id);
          fresh.rotate = state.params.a.rotate.slice();
          state.params[slot] = fresh;
          syncControls();
          requestRender();
        });
        return button;
      };
      panel.actions.appendChild(mkBtn("a", "A", "Use as projection A"));
      panel.actions.appendChild(mkBtn("b", "B", "Use as projection B"));
    }

    if (plan.kind === "overlay") {
      const handle = document.createElement("div");
      handle.className = "wipe-handle";
      handle.innerHTML = '<span class="wipe-grip"></span>';
      el.appendChild(handle);
      panel.wipeHandle = handle;
      attachWipeDrag(panel, handle);
    }

    attachInteraction(panel);
    return panel;
  }

  function measurePanels() {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    for (const panel of panels) {
      const rect = panel.canvas.getBoundingClientRect();
      const w = Math.max(80, Math.round(rect.width));
      const h = Math.max(80, Math.round(rect.height));
      panel.width = w;
      panel.height = h;
      panel.dpr = dpr;
      // Narrow panels put the badges on their own line so the projection name
      // is never truncated to make room for them.
      panel.el.classList.toggle("is-compact", w < 380);
      if (panel.canvas.width !== Math.round(w * dpr) || panel.canvas.height !== Math.round(h * dpr)) {
        panel.canvas.width = Math.round(w * dpr);
        panel.canvas.height = Math.round(h * dpr);
      }
    }
  }

  /* ------------------------------------------------------------------ render */

  let renderQueued = false;
  let interacting = false;
  let metricsTimer = null;
  const metricsCache = new Map();

  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(render);
  }

  function precisionForRender(panelCount) {
    if (interacting) return panelCount > 6 ? 1.6 : 0.9;
    return panelCount > 12 ? 0.7 : 0.4;
  }

  function highlightFeature() {
    if (state.highlight === null || state.highlight === undefined || !world) return null;
    return world.countries.find((f) => String(f.id) === String(state.highlight)) || null;
  }

  function render() {
    renderQueued = false;
    if (!world) return;
    buildPanels();
    const theme = THEMES[state.theme];
    const precision = precisionForRender(panels.length);
    const highlight = highlightFeature();
    const lineScale = panels.length > 12 ? 0.8 : 1;

    for (const panel of panels) {
      const ctx = panel.ctx;
      ctx.save();
      ctx.setTransform(panel.dpr, 0, 0, panel.dpr, 0, 0);
      ctx.clearRect(0, 0, panel.width, panel.height);
      if (panel.plan.kind === "overlay") {
        renderOverlayPanel(panel, ctx, theme, precision, highlight, lineScale);
      } else {
        renderSinglePanel(panel, ctx, theme, precision, highlight, lineScale);
      }
      ctx.restore();
    }

    updateWipeHandle();
    scheduleMetrics();
    updateLegend();
    scheduleHashUpdate();
  }

  function geometryFor(panel, precision) {
    return {
      width: panel.width,
      height: panel.height,
      view: state.view,
      fitMode: state.fitMode,
      precision: precision,
    };
  }

  function renderSinglePanel(panel, ctx, theme, precision, highlight, lineScale) {
    const id = panel.plan.id;
    const entry = registry.get(id);
    if (!entry) return;
    const params = panel.plan.slot === "m" ? paramsForId(id) : activeParams(panel.plan.slot);
    const projection = window.Renderer.build(d3, entry, params, geometryFor(panel, precision));
    panel.projection = projection;
    panel.projectionB = null;
    panel.entry = entry;
    panel.params = params;

    const showDistortion = state.distortion.mode !== "none" && !(interacting && panels.length > 4);
    window.Renderer.drawMap(d3, ctx, projection, Object.assign({
      theme: theme,
      layers: state.layers,
      world: world,
      highlight: highlight,
      graticuleStep: state.graticuleStep,
      tissot: state.tissot,
      distortionMode: showDistortion ? state.distortion.mode : "none",
      distortionStep: state.distortion.step,
      distortionAlpha: state.distortion.alpha,
      landStroke: state.layers.borders ? null : theme.landStroke,
      lineScale: lineScale,
    }, showDistortion ? outlineLandStyle(theme) : null));

    const accent = panel.plan.slot === "b" ? theme.accentB : theme.accentA;
    panel.el.style.setProperty("--accent", state.mode === "side" ? accent : "transparent");
    setPanelLabel(panel, entry, params);
  }

  function renderOverlayPanel(panel, ctx, theme, precision, highlight, lineScale) {
    const entryA = registry.get(state.a);
    const entryB = registry.get(state.b);
    if (!entryA || !entryB) return;
    const paramsA = activeParams("a");
    const paramsB = state.link ? activeParams("a") : activeParams("b");
    const geometry = geometryFor(panel, precision);
    const projA = window.Renderer.build(d3, entryA, paramsA, geometry);
    const projB = window.Renderer.build(d3, entryB, paramsB, geometry);
    panel.projection = projA;
    panel.projectionB = projB;
    panel.entry = entryA;
    panel.params = paramsA;
    panel.el.style.setProperty("--accent", "transparent");

    const showDistortion = state.distortion.mode !== "none";

    if (state.overlay.style === "wipe") {
      const split = clamp(state.overlay.wipe, 0.02, 0.98) * panel.width;
      const halves = [
        { projection: projA, x0: 0, x1: split },
        { projection: projB, x0: split, x1: panel.width },
      ];
      for (const half of halves) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(half.x0, 0, half.x1 - half.x0, panel.height);
        ctx.clip();
        window.Renderer.drawMap(d3, ctx, half.projection, Object.assign({
          theme: theme,
          layers: state.layers,
          world: world,
          highlight: highlight,
          graticuleStep: state.graticuleStep,
          tissot: state.tissot,
          distortionMode: showDistortion ? state.distortion.mode : "none",
          distortionStep: state.distortion.step,
          distortionAlpha: state.distortion.alpha,
          lineScale: lineScale,
        }, showDistortion ? outlineLandStyle(theme) : null));
        ctx.restore();
      }
      ctx.beginPath();
      ctx.moveTo(split, 0);
      ctx.lineTo(split, panel.height);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = state.theme === "dark" ? "rgba(255,255,255,0.6)" : "rgba(20,40,70,0.5)";
      ctx.stroke();
    } else {
      window.Renderer.drawMap(d3, ctx, projA, {
        theme: theme,
        layers: { ocean: state.layers.ocean, graticule: false, land: false, borders: false, sphere: false, tissot: false },
        world: world,
        lineScale: lineScale,
      });
      const pairs = [
        { projection: projA, accent: theme.accentA },
        { projection: projB, accent: theme.accentB },
      ];
      ctx.save();
      ctx.globalCompositeOperation = theme.overlayComposite;
      for (const pair of pairs) {
        window.Renderer.drawMap(d3, ctx, pair.projection, {
          theme: theme,
          layers: {
            ocean: false,
            graticule: state.layers.graticule,
            land: state.layers.land,
            borders: false,
            sphere: state.layers.sphere,
            tissot: state.layers.tissot,
          },
          world: world,
          graticuleStep: state.graticuleStep,
          tissot: state.tissot,
          landColor: withOpacity(d3, pair.accent, state.overlay.opacity),
          landStroke: pair.accent,
          sphereColor: pair.accent,
          graticuleColor: withOpacity(d3, pair.accent, 0.22),
          lineScale: lineScale,
        });
      }
      ctx.restore();
      if (highlight) {
        for (const pair of pairs) {
          const path = d3.geoPath(pair.projection, ctx);
          ctx.beginPath();
          path(highlight);
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = theme.highlightStroke;
          ctx.stroke();
        }
      }
    }

    setPanelLabel(panel, entryA, paramsA, entryB);
  }

  /* With distortion shading on, the coastlines become outlines so the colours
   * underneath stay readable over land as well as sea. */
  function outlineLandStyle(theme) {
    return { landColor: "rgba(0,0,0,0)", landStroke: theme.landOutline };
  }

  function withOpacity(lib, color, opacity) {
    const c = lib.color(color);
    if (!c) return color;
    c.opacity = opacity;
    return c + "";
  }

  function familyLabel(family) {
    const found = window.ProjectionRegistry.families.find((f) => f[0] === family);
    return found ? found[1] : family;
  }

  function setPanelLabel(panel, entry, params, entryB) {
    if (!state.showLabels) {
      panel.head.classList.add("is-hidden");
      return;
    }
    panel.head.classList.remove("is-hidden");
    if (entryB) {
      panel.title.innerHTML =
        '<span class="dot dot-a"></span>' + escapeHtml(entry.label) +
        ' <span class="vs">vs</span> <span class="dot dot-b"></span>' + escapeHtml(entryB.label);
      panel.sub.textContent = familyLabel(entry.family) + " · " + familyLabel(entryB.family);
    } else {
      const prefix = state.mode === "side"
        ? '<span class="dot dot-' + panel.plan.slot + '"></span>'
        : "";
      panel.title.innerHTML = prefix + escapeHtml(entry.label);
      panel.sub.textContent = familyLabel(entry.family);
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ----------------------------------------------------------------- metrics */

  function scheduleMetrics() {
    if (metricsTimer) clearTimeout(metricsTimer);
    if (!state.showMetrics) {
      for (const panel of panels) panel.badges.innerHTML = "";
      return;
    }
    metricsTimer = setTimeout(computeMetrics, interacting ? 400 : 160);
  }

  function metricsKey(entry, params) {
    return entry.id + "#" + window.Renderer.paramSignature(entry, params) + "#" +
      (params.rotate || [0, 0, 0]).map((v) => Math.round(v)).join(",");
  }

  function statsFor(entry, params, projection) {
    const key = metricsKey(entry, params);
    if (metricsCache.has(key)) return metricsCache.get(key);
    const sample = window.Distortion.sampleGrid(d3, projection, { step: 12 });
    if (metricsCache.size > 400) metricsCache.clear();
    metricsCache.set(key, sample.stats);
    return sample.stats;
  }

  function computeMetrics() {
    metricsTimer = null;
    if (!state.showMetrics) return;
    // Measuring a projection means thousands of evaluations, so walk the
    // panels a few at a time and let the browser breathe in between.
    const queue = panels.slice();
    const pump = () => {
      const batch = queue.splice(0, 4);
      if (!batch.length) return;
      measureBatch(batch);
      if (queue.length) setTimeout(pump, 0);
    };
    pump();
  }

  function measureBatch(batch) {
    for (const panel of batch) {
      const targets = [];
      if (panel.plan.kind === "overlay") {
        if (panel.projection && panel.projectionB) {
          targets.push({ entry: registry.get(state.a), params: activeParams("a"), projection: panel.projection, cls: "badge-a" });
          targets.push({
            entry: registry.get(state.b),
            params: state.link ? activeParams("a") : activeParams("b"),
            projection: panel.projectionB,
            cls: "badge-b",
          });
        }
      } else if (panel.entry && panel.projection) {
        targets.push({ entry: panel.entry, params: panel.params, projection: panel.projection, cls: "" });
      }

      const html = [];
      for (const target of targets) {
        if (!target.entry) continue;
        const stats = statsFor(target.entry, target.params, target.projection);
        if (!stats) continue;
        if (stats.equalArea) html.push('<span class="badge good ' + target.cls + '">equal-area</span>');
        if (stats.conformal) html.push('<span class="badge good ' + target.cls + '">conformal</span>');
        if (!stats.equalArea) {
          html.push('<span class="badge ' + target.cls +
            '" title="Ratio between the 98th and 2nd percentile of local area scale across the map">area spread ×' +
            formatNumber(stats.areaSpread) + "</span>");
        }
        if (!stats.conformal) {
          html.push('<span class="badge ' + target.cls +
            '" title="Median and 98th-percentile angular distortion (Tissot ω)">shape ' +
            Math.round(stats.omegaMedian) + "° / " + Math.round(stats.omegaHi) + "°</span>");
        }
      }
      panel.badges.innerHTML = html.join("");
    }
  }

  function formatNumber(v) {
    if (!isFinite(v)) return "∞";
    if (v >= 1000) return d3.format(".2s")(v);
    if (v >= 10) return v.toFixed(0);
    return v.toFixed(1);
  }

  /* ------------------------------------------------------------- interaction */

  function effectiveDragMode(event) {
    if (state.dragMode === "pan") return event.shiftKey ? "rotate" : "pan";
    return event.shiftKey ? "pan" : "rotate";
  }

  function attachInteraction(panel) {
    const canvas = panel.canvas;
    const pointers = new Map();
    let drag = null;
    let pinch = null;
    let suppressClick = false;

    const localPoint = (event) => {
      const rect = canvas.getBoundingClientRect();
      return [event.clientX - rect.left, event.clientY - rect.top];
    };

    canvas.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, localPoint(event));
      hideTooltip();
      if (pointers.size === 1) {
        drag = startDrag(panel, localPoint(event), effectiveDragMode(event));
        pinch = null;
        canvas.classList.add("is-dragging");
      } else if (pointers.size === 2) {
        drag = null;
        const pts = Array.from(pointers.values());
        pinch = { distance: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) || 1 };
      }
      interacting = true;
    });

    canvas.addEventListener("pointermove", (event) => {
      const point = localPoint(event);
      if (pointers.has(event.pointerId)) pointers.set(event.pointerId, point);

      if (pinch && pointers.size >= 2) {
        const pts = Array.from(pointers.values());
        const distance = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) || 1;
        const mid = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
        zoomAbout(panel, mid, distance / pinch.distance);
        pinch.distance = distance;
        requestRender();
        return;
      }

      if (drag) {
        moveDrag(panel, drag, point);
        requestRender();
        return;
      }

      showTooltip(panel, point, event);
    });

    const endPointer = (event) => {
      pointers.delete(event.pointerId);
      if (pointers.size === 0) {
        if (drag && drag.moved) suppressClick = true;
        drag = null;
        pinch = null;
        canvas.classList.remove("is-dragging");
        interacting = false;
        requestRender();
        syncOrientationControls();
      } else if (pointers.size === 1) {
        pinch = null;
        drag = startDrag(panel, Array.from(pointers.values())[0], state.dragMode);
      }
    };
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("pointerleave", hideTooltip);

    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const factor = Math.pow(2, -event.deltaY * (event.deltaMode === 1 ? 0.06 : 0.002));
      zoomAbout(panel, localPoint(event), factor);
      requestRender();
      syncOrientationControls();
    }, { passive: false });

    canvas.addEventListener("click", (event) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      const geo = invertPoint(panel.projection, localPoint(event));
      if (!geo) {
        state.highlight = null;
        requestRender();
        return;
      }
      const found = world.countries.find((f) => d3.geoContains(f, geo));
      state.highlight = found && String(found.id) !== String(state.highlight) ? found.id : null;
      requestRender();
    });

    canvas.addEventListener("dblclick", (event) => {
      event.preventDefault();
      zoomAbout(panel, localPoint(event), event.altKey || event.shiftKey ? 0.5 : 2);
      requestRender();
      syncOrientationControls();
    });
  }

  function dragSlot(panel) {
    return state.mode === "side" && !state.link ? panel.plan.slot : null;
  }

  function startDrag(panel, point, mode) {
    const slot = dragSlot(panel);
    const rotate = ((slot ? state.params[slot] : state.params.a).rotate || [0, 0, 0]).slice();
    if (mode === "pan") {
      return { kind: "pan", start: point, viewX: state.view.x, viewY: state.view.y, moved: false };
    }
    const projection = panel.projection;
    const geo = projection ? invertPoint(projection, point) : null;
    if (geo && versor) {
      return {
        kind: "versor",
        projection: projection,
        v0: versor.cartesian(geo),
        q0: versor(rotate),
        r0: rotate,
        start: point,
        moved: false,
      };
    }
    return { kind: "sensitivity", start: point, r0: rotate, moved: false };
  }

  /* Falls back to plain per-pixel rotation. Needed where the grabbed point is
   * a singularity of the projection (the whole middle of a conformal conic is
   * one pole) or where the pointer has left the projected sphere. */
  function degradeToSensitivity(panel, drag, point) {
    const slot = dragSlot(panel);
    drag.kind = "sensitivity";
    drag.start = point;
    drag.r0 = ((slot ? state.params[slot] : state.params.a).rotate || [0, 0, 0]).slice();
  }

  function moveDrag(panel, drag, point) {
    if (Math.abs(point[0] - drag.start[0]) + Math.abs(point[1] - drag.start[1]) > 2) drag.moved = true;

    if (drag.kind === "pan") {
      state.view.x = drag.viewX + (point[0] - drag.start[0]);
      state.view.y = drag.viewY + (point[1] - drag.start[1]);
      return;
    }

    if (drag.kind === "versor") {
      const travelled = Math.hypot(point[0] - drag.start[0], point[1] - drag.start[1]);
      const geo = invertPoint(drag.projection.rotate(drag.r0), point);
      const candidate = geo
        ? versor.rotation(versor.multiply(drag.q0, versor.delta(drag.v0, versor.cartesian(geo))))
        : null;
      const usable = candidate && candidate.every((v) => isFinite(v));
      const turned = usable
        ? Math.abs(candidate[0] - drag.r0[0]) + Math.abs(candidate[1] - drag.r0[1]) + Math.abs(candidate[2] - drag.r0[2])
        : 0;
      if (usable && (turned > 0.02 || travelled < 4)) {
        const rotate = state.lockRoll ? [candidate[0], candidate[1], drag.r0[2]] : candidate;
        setRotate([normaliseLongitude(rotate[0]), clamp(rotate[1], -90, 90), rotate[2]], dragSlot(panel));
        return;
      }
      if (travelled < 4) return;
      degradeToSensitivity(panel, drag, point);
      return;
    }

    // Dragging the shorter side of the panel turns the globe by 180°, damped
    // as you zoom in so fine adjustments stay possible.
    const span = Math.max(160, Math.min(panel.width, panel.height));
    const k = 180 / span / Math.max(1, Math.sqrt(state.view.zoom));
    setRotate([
      normaliseLongitude(drag.r0[0] + (point[0] - drag.start[0]) * k),
      clamp(drag.r0[1] - (point[1] - drag.start[1]) * k, -90, 90),
      drag.r0[2],
    ], dragSlot(panel));
  }

  function normaliseLongitude(v) {
    let x = v % 360;
    if (x > 180) x -= 360;
    if (x < -180) x += 360;
    return x;
  }

  function setRotate(rotate, onlySlot) {
    if (!rotate.every((v) => isFinite(v))) return;
    if (onlySlot) {
      state.params[onlySlot].rotate = rotate.slice();
    } else {
      state.params.a.rotate = rotate.slice();
      state.params.b.rotate = rotate.slice();
    }
  }

  function invertPoint(projection, point) {
    if (!projection || typeof projection.invert !== "function") return null;
    let geo;
    try {
      geo = projection.invert(point);
    } catch (err) {
      return null;
    }
    if (!geo || !isFinite(geo[0]) || !isFinite(geo[1]) || Math.abs(geo[1]) > 90.0001) return null;
    // Reject points outside the projected sphere: the round trip must return.
    let back;
    try {
      back = projection(geo);
    } catch (err) {
      return null;
    }
    if (!back || !isFinite(back[0]) || !isFinite(back[1])) return null;
    if (Math.hypot(back[0] - point[0], back[1] - point[1]) > 1) return null;
    return geo;
  }

  function zoomAbout(panel, point, factor) {
    const z1 = state.view.zoom;
    const z2 = clamp(z1 * factor, ZOOM_MIN, ZOOM_MAX);
    if (z2 === z1) return;
    const cx = panel.width / 2;
    const cy = panel.height / 2;
    const ratio = z2 / z1;
    state.view.x = point[0] - cx - ratio * (point[0] - cx - state.view.x);
    state.view.y = point[1] - cy - ratio * (point[1] - cy - state.view.y);
    state.view.zoom = z2;
  }

  function attachWipeDrag(panel, handle) {
    let dragging = false;
    handle.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      event.preventDefault();
      dragging = true;
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const rect = panel.canvas.getBoundingClientRect();
      state.overlay.wipe = clamp((event.clientX - rect.left) / rect.width, 0.02, 0.98);
      requestRender();
    });
    const stop = () => { dragging = false; };
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  function updateWipeHandle() {
    for (const panel of panels) {
      if (!panel.wipeHandle) continue;
      const show = state.mode === "overlay" && state.overlay.style === "wipe";
      panel.wipeHandle.style.display = show ? "block" : "none";
      panel.wipeHandle.style.left = (clamp(state.overlay.wipe, 0.02, 0.98) * 100).toFixed(2) + "%";
    }
  }

  /* ----------------------------------------------------------------- tooltip */

  function showTooltip(panel, point, event) {
    const projection = panel.projection;
    const geo = invertPoint(projection, point);
    if (!geo) {
      hideTooltip();
      return;
    }
    const parts = [];
    const country = world.countries.find((f) => d3.geoContains(f, geo));
    if (country) parts.push("<strong>" + escapeHtml(country.properties.name) + "</strong>");
    parts.push(formatCoord(geo));
    if (state.distortion.mode !== "none" || state.layers.tissot) {
      const local = window.Distortion.point(projection, geo[0], geo[1]);
      if (local) {
        parts.push('<span class="tip-metric">area ×' + local.area.toFixed(2) +
          " · shape " + local.omega.toFixed(1) + "°</span>");
      }
    }
    tooltip.innerHTML = parts.join("<br>");
    tooltip.style.display = "block";
    const pad = 14;
    const box = tooltip.getBoundingClientRect();
    let x = event.clientX + pad;
    let y = event.clientY + pad;
    if (x + box.width > window.innerWidth - 8) x = event.clientX - box.width - pad;
    if (y + box.height > window.innerHeight - 8) y = event.clientY - box.height - pad;
    tooltip.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
  }

  function hideTooltip() {
    tooltip.style.display = "none";
  }

  function formatCoord(geo) {
    const lon = geo[0];
    const lat = geo[1];
    return Math.abs(lat).toFixed(1) + "° " + (lat >= 0 ? "N" : "S") + ", " +
      Math.abs(lon).toFixed(1) + "° " + (lon >= 0 ? "E" : "W");
  }

  /* ------------------------------------------------------------------ legend */

  function updateLegend() {
    const legend = $("#legend");
    if (state.distortion.mode === "none") {
      legend.hidden = true;
      return;
    }
    legend.hidden = false;
    const angular = state.distortion.mode === "angular";
    const scale = window.Renderer.distortionColorScale(d3, state.distortion.mode);
    const stops = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const cell = angular ? { omega: t * 60 } : { area: Math.pow(2, -2.2 + t * 4.4) };
      stops.push(scale.color(cell) + " " + (t * 100).toFixed(0) + "%");
    }
    $("#legend-title").textContent = angular ? "Angular distortion (Tissot ω)" : "Area scale vs. true area";
    $("#legend-bar").style.background = "linear-gradient(90deg," + stops.join(",") + ")";
    const ticks = angular ? ["0°", "15°", "30°", "45°", "60°+"] : ["×0.22", "×0.5", "×1", "×2", "×4.6"];
    $("#legend-ticks").innerHTML = ticks.map((t) => "<span>" + t + "</span>").join("");
  }

  /* ---------------------------------------------------------------- controls */

  function optionGroupsHtml(selectedId) {
    let html = "";
    for (const [key, label] of window.ProjectionRegistry.families) {
      const items = registry.list.filter((p) => p.family === key);
      if (!items.length) continue;
      html += '<optgroup label="' + escapeHtml(label) + '">';
      for (const item of items) {
        html += '<option value="' + item.id + '"' + (item.id === selectedId ? " selected" : "") + ">" +
          escapeHtml(item.label) + "</option>";
      }
      html += "</optgroup>";
    }
    return html;
  }

  function buildProjectionSelects() {
    const selectA = $("#select-a");
    const selectB = $("#select-b");
    selectA.innerHTML = optionGroupsHtml(state.a);
    selectB.innerHTML = optionGroupsHtml(state.b);
    selectA.addEventListener("change", () => {
      state.a = selectA.value;
      state.params.a = mergeParams(state.a, state.params.a);
      syncControls();
      requestRender();
    });
    selectB.addEventListener("change", () => {
      state.b = selectB.value;
      state.params.b = mergeParams(state.b, state.params.b);
      syncControls();
      requestRender();
    });
  }

  /* Keeps the shared orientation but resets projection-specific parameters to
   * the new projection's own defaults. */
  function mergeParams(id, previous) {
    const next = defaultParamsFor(id);
    if (previous && previous.rotate) next.rotate = previous.rotate.slice();
    return next;
  }

  function buildBrowser() {
    const list = $("#browser-list");
    let html = "";
    for (const [key, label] of window.ProjectionRegistry.families) {
      const items = registry.list.filter((p) => p.family === key);
      if (!items.length) continue;
      html += '<div class="browser-group" data-family="' + key + '">' +
        '<div class="browser-group-head"><span>' + escapeHtml(label) + "</span>" +
        '<button type="button" class="mini" data-family-toggle="' + key + '">toggle all</button></div>';
      for (const item of items) {
        html += '<label class="browser-row" data-id="' + item.id + '" data-label="' +
          escapeHtml(item.label.toLowerCase()) + '">' +
          '<input type="checkbox" data-multiple="' + item.id + '">' +
          '<span class="browser-name">' + escapeHtml(item.label) + "</span>" +
          '<span class="browser-slots">' +
          '<button type="button" class="slot-btn" data-set-a="' + item.id + '" title="Use as projection A">A</button>' +
          '<button type="button" class="slot-btn" data-set-b="' + item.id + '" title="Use as projection B">B</button>' +
          "</span></label>";
      }
      html += "</div>";
    }
    list.innerHTML = html;

    list.addEventListener("change", (event) => {
      const id = event.target.getAttribute && event.target.getAttribute("data-multiple");
      if (!id) return;
      const set = new Set(state.multiples.set);
      if (event.target.checked) set.add(id);
      else set.delete(id);
      state.multiples.set = registry.list.filter((p) => set.has(p.id)).map((p) => p.id);
      updateMultipleCount();
      if (state.mode === "multiples") requestRender();
    });

    list.addEventListener("click", (event) => {
      const button = event.target.closest ? event.target.closest("button") : null;
      if (!button) return;
      event.preventDefault();
      const family = button.getAttribute("data-family-toggle");
      if (family) {
        const items = registry.list.filter((p) => p.family === family);
        const set = new Set(state.multiples.set);
        const allOn = items.every((p) => set.has(p.id));
        for (const item of items) {
          if (allOn) set.delete(item.id);
          else set.add(item.id);
        }
        state.multiples.set = registry.list.filter((p) => set.has(p.id)).map((p) => p.id);
        syncBrowserChecks();
        updateMultipleCount();
        if (state.mode === "multiples") requestRender();
        return;
      }
      const setA = button.getAttribute("data-set-a");
      const setB = button.getAttribute("data-set-b");
      if (setA) {
        state.a = setA;
        state.params.a = mergeParams(setA, state.params.a);
      } else if (setB) {
        state.b = setB;
        state.params.b = mergeParams(setB, state.params.b);
      } else {
        return;
      }
      if (state.mode === "multiples") state.mode = "side";
      syncControls();
      requestRender();
    });

    $("#browser-search").addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      for (const row of $$(".browser-row", list)) {
        row.hidden = !!query && row.getAttribute("data-label").indexOf(query) === -1;
      }
      for (const group of $$(".browser-group", list)) {
        group.hidden = !$$(".browser-row", group).some((r) => !r.hidden);
      }
    });

    $("#preset-select").addEventListener("change", (event) => {
      const value = event.target.value;
      if (!value) return;
      state.multiples.set = value === "all"
        ? registry.list.map((p) => p.id)
        : (PRESET_SETS[value] || []).filter((id) => registry.has(id));
      state.mode = "multiples";
      syncControls();
      requestRender();
      event.target.value = "";
    });

    $("#browser-clear").addEventListener("click", () => {
      state.multiples.set = [];
      syncBrowserChecks();
      updateMultipleCount();
      if (state.mode === "multiples") requestRender();
    });
  }

  function syncBrowserChecks() {
    const set = new Set(state.multiples.set);
    for (const input of $$("#browser-list input[data-multiple]")) {
      input.checked = set.has(input.getAttribute("data-multiple"));
    }
    for (const row of $$("#browser-list .browser-row")) {
      const id = row.getAttribute("data-id");
      row.classList.toggle("is-a", id === state.a);
      row.classList.toggle("is-b", id === state.b);
    }
  }

  function updateMultipleCount() {
    $("#multiple-count").textContent = state.multiples.set.length + " selected";
  }

  /* Projection-specific parameter controls, rebuilt whenever the projection or
   * the edit target changes. */
  function buildParamControls() {
    const host = $("#param-controls");
    const slot = state.mode === "multiples" || state.link ? "a" : state.editing;
    const id = slot === "b" ? state.b : state.a;
    const entry = registry.get(id);
    host.innerHTML = "";
    if (!entry) return;

    const params = state.params[slot];
    const specs = entry.params.slice();
    if (entry.clippable) {
      specs.push({ name: "clipAngle", label: "Clip angle", kind: "number", min: 5, max: 179.9, step: 0.5, unit: "°" });
    }
    if (entry.angle) {
      specs.push({ name: "angle", label: "Plane rotation", kind: "number", min: -180, max: 180, step: 1, unit: "°" });
    }

    const heading = document.createElement("p");
    heading.className = "hint";
    heading.innerHTML = "Editing <strong>" + escapeHtml(entry.label) + "</strong>" +
      (specs.length ? "" : " — this projection has no extra parameters of its own.");
    host.appendChild(heading);

    for (const spec of specs) {
      if (spec.kind === "pair") {
        host.appendChild(sliderRow(spec.label + " ①", params[spec.name][0], spec, (v) => {
          params[spec.name] = [v, params[spec.name][1]];
        }));
        host.appendChild(sliderRow(spec.label + " ②", params[spec.name][1], spec, (v) => {
          params[spec.name] = [params[spec.name][0], v];
        }));
      } else {
        host.appendChild(sliderRow(spec.label, params[spec.name], spec, (v) => {
          params[spec.name] = spec.kind === "integer" ? Math.round(v) : v;
        }));
      }
    }

    if (specs.length) {
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "ghost full";
      reset.textContent = "Reset these parameters";
      reset.addEventListener("click", () => {
        const fresh = defaultParamsFor(id);
        fresh.rotate = params.rotate.slice();
        state.params[slot] = fresh;
        buildParamControls();
        requestRender();
      });
      host.appendChild(reset);
    }
  }

  let rowSeq = 0;
  function sliderRow(label, value, spec, apply) {
    const row = document.createElement("div");
    row.className = "control";
    const inputId = "param-" + (rowSeq++);
    row.innerHTML =
      '<label for="' + inputId + '">' + escapeHtml(label) +
      "<output>" + formatParam(value, spec) + "</output></label>" +
      '<input id="' + inputId + '" type="range" min="' + spec.min + '" max="' + spec.max +
      '" step="' + spec.step + '" value="' + value + '">';
    const input = $("input", row);
    const output = $("output", row);
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      output.textContent = formatParam(v, spec);
      apply(v);
      requestRender();
    });
    return row;
  }

  function formatParam(value, spec) {
    const v = Number(value);
    const text = Number.isInteger(v) || Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2);
    return text + (spec.unit || "");
  }

  function buildControls() {
    buildProjectionSelects();
    buildBrowser();

    for (const button of $$("[data-mode]")) {
      button.addEventListener("click", () => {
        state.mode = button.getAttribute("data-mode");
        syncControls();
        requestRender();
      });
    }

    $("#swap").addEventListener("click", () => {
      const a = state.a;
      state.a = state.b;
      state.b = a;
      const pa = state.params.a;
      state.params.a = state.params.b;
      state.params.b = pa;
      syncControls();
      requestRender();
    });

    bindRange("#rot-lambda", (v) => {
      const target = orientationTarget();
      target.rotate = [v, target.rotate[1], target.rotate[2]];
      mirrorRotate(target);
    });
    bindRange("#rot-phi", (v) => {
      const target = orientationTarget();
      target.rotate = [target.rotate[0], v, target.rotate[2]];
      mirrorRotate(target);
    });
    bindRange("#rot-gamma", (v) => {
      const target = orientationTarget();
      target.rotate = [target.rotate[0], target.rotate[1], v];
      mirrorRotate(target);
    });
    bindRange("#zoom", (v) => {
      state.view.zoom = clamp(Math.pow(2, v), ZOOM_MIN, ZOOM_MAX);
    }, () => "×" + state.view.zoom.toFixed(2));

    $("#zoom-in").addEventListener("click", () => nudgeZoom(1.4));
    $("#zoom-out").addEventListener("click", () => nudgeZoom(1 / 1.4));
    $("#reset-view").addEventListener("click", resetView);

    const viewPreset = $("#view-preset");
    viewPreset.innerHTML = '<option value="">Jump to…</option>' +
      Object.keys(VIEW_PRESETS).map((k) => '<option value="' + k + '">' + VIEW_PRESETS[k].label + "</option>").join("");
    viewPreset.addEventListener("change", (event) => {
      const preset = VIEW_PRESETS[event.target.value];
      if (preset) {
        setRotate(preset.rotate.slice(), null);
        syncOrientationControls();
        requestRender();
      }
      event.target.value = "";
    });

    bindRadio("drag-mode", (v) => { state.dragMode = v; });
    bindRadio("fit-mode", (v) => { state.fitMode = v; requestRender(); });
    bindRadio("detail", (v) => setDetail(v));
    bindRadio("overlay-style", (v) => { state.overlay.style = v; requestRender(); });
    bindRadio("split-orientation", (v) => { state.splitOrientation = v; requestRender(); });
    bindRadio("distortion", (v) => { state.distortion.mode = v; requestRender(); });
    bindRadio("editing", (v) => { state.editing = v; buildParamControls(); });

    bindCheck("#lock-roll", (v) => { state.lockRoll = v; });
    bindCheck("#link-params", (v) => {
      state.link = v;
      if (v) state.params.b.rotate = state.params.a.rotate.slice();
      syncControls();
    });
    bindCheck("#spin", (v) => {
      state.spin = v;
      if (v) startSpin();
    });
    bindRange("#spin-speed", (v) => { state.spinSpeed = v; }, (v) => v.toFixed(0) + "°/s");
    bindRange("#overlay-opacity", (v) => { state.overlay.opacity = v; });
    bindRange("#graticule-step", (v) => { state.graticuleStep = v; }, (v) => v.toFixed(0) + "°");
    bindRange("#tissot-step", (v) => { state.tissot.step = v; }, (v) => v.toFixed(0) + "°");
    bindRange("#tissot-radius", (v) => { state.tissot.radius = v; }, (v) => v.toFixed(1) + "°");
    bindRange("#distortion-step", (v) => { state.distortion.step = v; }, (v) => v.toFixed(0) + "°");
    bindRange("#distortion-alpha", (v) => { state.distortion.alpha = v; });
    bindRange("#multiple-cols", (v) => { state.multiples.cols = Math.round(v); }, (v) => (v ? Math.round(v) + " cols" : "auto"));

    for (const key of ["ocean", "graticule", "land", "borders", "sphere", "tissot"]) {
      bindCheck("#layer-" + key, (v) => { state.layers[key] = v; });
    }
    bindCheck("#show-labels", (v) => { state.showLabels = v; });
    bindCheck("#show-metrics", (v) => {
      state.showMetrics = v;
      scheduleMetrics();
    });

    $("#theme-toggle").addEventListener("click", () => {
      state.theme = state.theme === "dark" ? "light" : "dark";
      applyTheme();
      requestRender();
    });
    $("#copy-link").addEventListener("click", copyLink);
    $("#export-png").addEventListener("click", exportPng);
    $("#sidebar-toggle").addEventListener("click", () => {
      document.body.classList.toggle("sidebar-hidden");
      setTimeout(() => {
        measurePanels();
        requestRender();
      }, 220);
    });
    $("#clear-highlight").addEventListener("click", () => {
      state.highlight = null;
      requestRender();
    });
  }

  function resetView() {
    state.view = { zoom: 1, x: 0, y: 0 };
    setRotate([0, 0, 0], null);
    syncOrientationControls();
    requestRender();
  }

  function orientationTarget() {
    if (state.mode === "side" && !state.link) return state.params[state.editing];
    return state.params.a;
  }

  function mirrorRotate(target) {
    if (state.link || state.mode !== "side") {
      state.params.a.rotate = target.rotate.slice();
      state.params.b.rotate = target.rotate.slice();
    }
  }

  function bindRadio(name, apply) {
    for (const input of $$('input[name="' + name + '"]')) {
      input.addEventListener("change", () => {
        if (input.checked) apply(input.value);
      });
    }
  }

  function bindRange(selector, apply, format) {
    const input = $(selector);
    if (!input) return;
    const output = input.parentElement.querySelector("output");
    input.__format = format;
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      apply(v);
      if (output) output.textContent = format ? format(v) : formatRange(input, v);
      requestRender();
    });
  }

  function formatRange(input, v) {
    const unit = input.getAttribute("data-unit") || "";
    const digits = parseFloat(input.step) < 1 ? 2 : 0;
    return v.toFixed(digits) + unit;
  }

  function bindCheck(selector, apply) {
    const input = $(selector);
    if (!input) return;
    input.addEventListener("change", () => {
      apply(input.checked);
      requestRender();
    });
  }

  function nudgeZoom(factor) {
    const panel = panels[0];
    if (panel) zoomAbout(panel, [panel.width / 2, panel.height / 2], factor);
    else state.view.zoom = clamp(state.view.zoom * factor, ZOOM_MIN, ZOOM_MAX);
    syncOrientationControls();
    requestRender();
  }

  function setControlValue(selector, value, format) {
    const input = $(selector);
    if (!input) return;
    input.value = value;
    const output = input.parentElement.querySelector("output");
    if (!output) return;
    const fn = format || input.__format;
    output.textContent = fn ? fn(parseFloat(value)) : formatRange(input, parseFloat(value));
  }

  function syncOrientationControls() {
    const rotate = orientationTarget().rotate;
    setControlValue("#rot-lambda", rotate[0].toFixed(1), (v) => v.toFixed(0) + "°");
    setControlValue("#rot-phi", rotate[1].toFixed(1), (v) => v.toFixed(0) + "°");
    setControlValue("#rot-gamma", rotate[2].toFixed(1), (v) => v.toFixed(0) + "°");
    setControlValue("#zoom", Math.log2(state.view.zoom).toFixed(3), () => "×" + state.view.zoom.toFixed(2));
  }

  function syncControls() {
    $("#select-a").value = state.a;
    $("#select-b").value = state.b;
    for (const button of $$("[data-mode]")) {
      button.classList.toggle("is-active", button.getAttribute("data-mode") === state.mode);
    }
    document.body.classList.toggle("is-overlay", state.mode === "overlay");
    document.body.classList.toggle("is-multiples", state.mode === "multiples");
    document.body.classList.toggle("is-side", state.mode === "side");
    document.body.classList.toggle("params-unlinked", !state.link && state.mode !== "multiples");

    $("#link-params").checked = state.link;
    $("#lock-roll").checked = state.lockRoll;
    $("#spin").checked = state.spin;
    for (const key of ["ocean", "graticule", "land", "borders", "sphere", "tissot"]) {
      const el = $("#layer-" + key);
      if (el) el.checked = state.layers[key];
    }
    $("#show-labels").checked = state.showLabels;
    $("#show-metrics").checked = state.showMetrics;
    checkRadio("drag-mode", state.dragMode);
    checkRadio("fit-mode", state.fitMode);
    checkRadio("detail", state.detail);
    checkRadio("overlay-style", state.overlay.style);
    checkRadio("split-orientation", state.splitOrientation);
    checkRadio("distortion", state.distortion.mode);
    checkRadio("editing", state.editing);

    setControlValue("#spin-speed", state.spinSpeed);
    setControlValue("#overlay-opacity", state.overlay.opacity);
    setControlValue("#graticule-step", state.graticuleStep);
    setControlValue("#tissot-step", state.tissot.step);
    setControlValue("#tissot-radius", state.tissot.radius);
    setControlValue("#distortion-step", state.distortion.step);
    setControlValue("#distortion-alpha", state.distortion.alpha);
    setControlValue("#multiple-cols", state.multiples.cols);

    const entryA = registry.get(state.a);
    const entryB = registry.get(state.b);
    $("#editing-label-a").textContent = entryA ? entryA.label : state.a;
    $("#editing-label-b").textContent = entryB ? entryB.label : state.b;

    syncOrientationControls();
    syncBrowserChecks();
    updateMultipleCount();
    buildParamControls();
  }

  function checkRadio(name, value) {
    const input = $('input[name="' + name + '"][value="' + value + '"]');
    if (input) input.checked = true;
  }

  function applyTheme() {
    document.body.setAttribute("data-theme", state.theme);
    const button = $("#theme-toggle");
    button.textContent = state.theme === "dark" ? "☾" : "☀";
    button.title = state.theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  }

  /* -------------------------------------------------------------------- spin */

  let spinFrame = null;
  let spinLast = 0;

  function startSpin() {
    if (spinFrame) return;
    spinLast = performance.now();
    const step = (now) => {
      if (!state.spin) {
        spinFrame = null;
        return;
      }
      const dt = Math.min(0.1, (now - spinLast) / 1000);
      spinLast = now;
      const target = orientationTarget();
      const rotate = target.rotate.slice();
      rotate[0] = normaliseLongitude(rotate[0] + state.spinSpeed * dt);
      target.rotate = rotate;
      mirrorRotate(target);
      syncOrientationControls();
      render();
      spinFrame = requestAnimationFrame(step);
    };
    spinFrame = requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------ export & url */

  function exportPng() {
    if (!panels.length) return;
    const scale = 2;
    const gap = 10;
    const theme = THEMES[state.theme];
    const cols = state.mode === "multiples"
      ? (state.multiples.cols || Math.max(1, Math.round(Math.sqrt(panels.length * 1.6))))
      : (state.mode === "side" && effectiveSplit() === "columns" ? 2 : 1);
    const rows = Math.ceil(panels.length / cols);
    const cw = panels[0].width;
    const ch = panels[0].height;
    const headroom = state.showLabels ? 24 : 0;

    const out = document.createElement("canvas");
    out.width = (cols * cw + (cols + 1) * gap) * scale;
    out.height = (rows * (ch + headroom) + (rows + 1) * gap) * scale;
    const ctx = out.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = theme.exportBg;
    ctx.fillRect(0, 0, out.width / scale, out.height / scale);

    panels.forEach((panel, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gap + col * (cw + gap);
      const y = gap + row * (ch + headroom + gap);
      if (headroom) {
        ctx.fillStyle = theme.exportText;
        ctx.font = '600 13px system-ui, -apple-system, "Segoe UI", sans-serif';
        ctx.textBaseline = "top";
        ctx.fillText(panel.title.textContent || "", x + 2, y + 4);
      }
      ctx.drawImage(panel.canvas, x, y + headroom, cw, ch);
    });

    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "projection-lab-" + state.mode + ".png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setStatus("PNG exported.");
    });
  }

  let hashTimer = null;
  let suppressHash = false;

  function scheduleHashUpdate() {
    if (hashTimer) return;
    hashTimer = setTimeout(() => {
      hashTimer = null;
      suppressHash = true;
      const encoded = encodeState();
      try {
        history.replaceState(null, "", encoded ? "#" + encoded : location.pathname + location.search);
      } catch (err) { /* file:// can refuse history writes */ }
      setTimeout(() => { suppressHash = false; }, 0);
    }, 500);
  }

  function encodeState() {
    const round = (v) => Math.round(v * 100) / 100;
    const payload = {
      m: state.mode,
      a: state.a,
      b: state.b,
      r: state.params.a.rotate.map(round),
      z: round(state.view.zoom),
      p: [round(state.view.x), round(state.view.y)],
      f: state.fitMode,
      t: state.theme,
      d: state.distortion.mode,
      g: state.graticuleStep,
      l: Object.keys(state.layers).filter((k) => state.layers[k]).join(","),
      o: state.overlay.style,
      lk: state.link ? 1 : 0,
      det: state.detail,
    };
    if (state.mode === "multiples") payload.set = state.multiples.set.map((id) => id.replace(/^geo/, ""));
    if (!state.link) payload.rb = state.params.b.rotate.map(round);
    const specific = {};
    for (const slot of ["a", "b"]) {
      const entry = registry.get(slot === "a" ? state.a : state.b);
      if (!entry) continue;
      const defaults = defaultParamsFor(entry.id);
      const diff = {};
      for (const key of Object.keys(state.params[slot])) {
        if (key === "rotate") continue;
        if (JSON.stringify(state.params[slot][key]) !== JSON.stringify(defaults[key])) {
          diff[key] = state.params[slot][key];
        }
      }
      if (Object.keys(diff).length) specific[slot] = diff;
    }
    if (Object.keys(specific).length) payload.pp = specific;
    try {
      return encodeURIComponent(JSON.stringify(payload));
    } catch (err) {
      return "";
    }
  }

  function decodeState(hash) {
    if (!hash) return;
    let payload;
    try {
      payload = JSON.parse(decodeURIComponent(hash));
    } catch (err) {
      return;
    }
    if (!payload || typeof payload !== "object") return;
    if (payload.a && registry.has(payload.a)) state.a = payload.a;
    if (payload.b && registry.has(payload.b)) state.b = payload.b;
    state.params.a = defaultParamsFor(state.a);
    state.params.b = defaultParamsFor(state.b);
    if (["side", "overlay", "multiples"].indexOf(payload.m) >= 0) state.mode = payload.m;
    if (Array.isArray(payload.r) && payload.r.length === 3) {
      state.params.a.rotate = payload.r.map(Number);
      state.params.b.rotate = payload.r.map(Number);
    }
    if (Array.isArray(payload.rb) && payload.rb.length === 3) state.params.b.rotate = payload.rb.map(Number);
    if (isFinite(payload.z)) state.view.zoom = clamp(Number(payload.z), ZOOM_MIN, ZOOM_MAX);
    if (Array.isArray(payload.p)) {
      state.view.x = Number(payload.p[0]) || 0;
      state.view.y = Number(payload.p[1]) || 0;
    }
    if (payload.f === "fit" || payload.f === "equal") state.fitMode = payload.f;
    if (payload.t === "dark" || payload.t === "light") state.theme = payload.t;
    if (["none", "area", "angular"].indexOf(payload.d) >= 0) state.distortion.mode = payload.d;
    if (isFinite(payload.g)) state.graticuleStep = Number(payload.g);
    if (typeof payload.l === "string") {
      const on = payload.l.split(",");
      for (const key of Object.keys(state.layers)) state.layers[key] = on.indexOf(key) >= 0;
    }
    if (payload.o === "blend" || payload.o === "wipe") state.overlay.style = payload.o;
    if (payload.lk !== undefined) state.link = !!Number(payload.lk);
    if (payload.det === "110m" || payload.det === "50m") state.detail = payload.det;
    if (Array.isArray(payload.set)) {
      const ids = payload.set.map((s) => "geo" + s).filter((id) => registry.has(id));
      if (ids.length) state.multiples.set = ids;
    }
    if (payload.pp) {
      for (const slot of ["a", "b"]) {
        const diff = payload.pp[slot];
        if (!diff) continue;
        for (const key of Object.keys(diff)) {
          if (key in state.params[slot]) state.params[slot][key] = diff[key];
        }
      }
    }
  }

  function copyLink() {
    const url = location.origin + location.pathname + location.search + "#" + encodeState();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        () => setStatus("Link copied — it restores this exact view."),
        () => setStatus("Copy failed; the link is in the address bar.")
      );
    } else {
      setStatus("The link is in the address bar.");
    }
  }

  let statusTimer = null;
  function setStatus(message, sticky) {
    const el = $("#status");
    el.textContent = message || "";
    el.classList.toggle("is-visible", !!message);
    if (statusTimer) clearTimeout(statusTimer);
    if (message && !sticky) statusTimer = setTimeout(() => setStatus(""), 3600);
  }

  /* ---------------------------------------------------------------- keyboard */

  function attachKeyboard() {
    document.addEventListener("keydown", (event) => {
      const tag = (event.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case "+": case "=": event.preventDefault(); nudgeZoom(1.4); return;
        case "-": case "_": event.preventDefault(); nudgeZoom(1 / 1.4); return;
        case "0": case "r": event.preventDefault(); resetView(); return;
        case "1": state.mode = "side"; syncControls(); requestRender(); return;
        case "2": state.mode = "overlay"; syncControls(); requestRender(); return;
        case "3": state.mode = "multiples"; syncControls(); requestRender(); return;
        case "g": state.layers.graticule = !state.layers.graticule; syncControls(); requestRender(); return;
        case "t": state.layers.tissot = !state.layers.tissot; syncControls(); requestRender(); return;
        case "d": {
          const order = ["none", "area", "angular"];
          state.distortion.mode = order[(order.indexOf(state.distortion.mode) + 1) % order.length];
          syncControls();
          requestRender();
          return;
        }
        case "s": state.spin = !state.spin; syncControls(); if (state.spin) startSpin(); return;
        case "x": state.highlight = null; requestRender(); return;
        default: break;
      }

      const step = event.shiftKey ? 15 : 5;
      const target = orientationTarget();
      const rotate = target.rotate.slice();
      if (event.key === "ArrowLeft") rotate[0] = normaliseLongitude(rotate[0] - step);
      else if (event.key === "ArrowRight") rotate[0] = normaliseLongitude(rotate[0] + step);
      else if (event.key === "ArrowUp") rotate[1] = clamp(rotate[1] - step, -90, 90);
      else if (event.key === "ArrowDown") rotate[1] = clamp(rotate[1] + step, -90, 90);
      else return;
      event.preventDefault();
      target.rotate = rotate;
      mirrorRotate(target);
      syncOrientationControls();
      requestRender();
    });
  }

  /* -------------------------------------------------------------------- boot */

  function boot() {
    decodeState(location.hash.replace(/^#/, ""));
    applyTheme();
    buildControls();
    attachKeyboard();
    syncControls();
    setDetail(state.detail);
    requestRender();

    const resize = () => {
      measurePanels();
      requestRender();
    };
    window.addEventListener("resize", resize);
    if (window.ResizeObserver) {
      new ResizeObserver(resize).observe(stage);
    }
    window.addEventListener("hashchange", () => {
      if (suppressHash) return;
      decodeState(location.hash.replace(/^#/, ""));
      applyTheme();
      syncControls();
      panelSignature = "";
      requestRender();
    });
    if (state.spin) startSpin();
    $("#projection-total").textContent = registry.list.length;
  }

  boot();
})();
