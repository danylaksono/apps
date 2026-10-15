/* Projection Lab — registry of map projections available from d3-geo and
 * d3-geo-projection, with the metadata the UI needs to group, label and
 * configure them.
 *
 * Everything here is descriptive only; the classification of a projection as
 * equal-area / conformal is *not* taken from this table at runtime — it is
 * measured numerically from the projection itself (see metrics.js), so the
 * badges stay honest when parameters change.
 */
(function (global) {
  "use strict";

  // family key -> display name, in the order families should be listed.
  const FAMILIES = [
    ["cylindrical", "Cylindrical"],
    ["pseudocylindrical", "Pseudocylindrical"],
    ["lenticular", "Lenticular & modified azimuthal"],
    ["azimuthal", "Azimuthal (globes)"],
    ["conic", "Conic"],
    ["polyconic", "Polyconic & retroazimuthal"],
    ["quincuncial", "Quincuncial & conformal oddities"],
    ["interrupted", "Interrupted & polyhedral"],
  ];

  // Labels that camel-case splitting would get wrong or render awkwardly.
  const LABEL_OVERRIDES = {
    geoAlbers: "Albers (conic equal-area)",
    geoAzimuthalEqualArea: "Azimuthal equal-area (Lambert)",
    geoAzimuthalEquidistant: "Azimuthal equidistant",
    geoBertin1953: "Bertin 1953",
    geoConicConformal: "Lambert conformal conic",
    geoConicEqualArea: "Conic equal-area",
    geoConicEquidistant: "Conic equidistant",
    geoCylindricalEqualArea: "Cylindrical equal-area",
    geoCylindricalStereographic: "Cylindrical stereographic (Braun)",
    geoEckert1: "Eckert I",
    geoEckert2: "Eckert II",
    geoEckert3: "Eckert III",
    geoEckert4: "Eckert IV",
    geoEckert5: "Eckert V",
    geoEckert6: "Eckert VI",
    geoEqualEarth: "Equal Earth",
    geoFoucautSinusoidal: "Foucaut sinusoidal",
    geoGinzburg4: "Ginzburg IV",
    geoGinzburg5: "Ginzburg V",
    geoGinzburg6: "Ginzburg VI",
    geoGinzburg8: "Ginzburg VIII",
    geoGinzburg9: "Ginzburg IX",
    geoGringortenQuincuncial: "Gringorten quincuncial",
    geoHammerRetroazimuthal: "Hammer retroazimuthal",
    geoHealpix: "HEALPix",
    geoHomolosine: "Goode homolosine",
    geoInterruptedBoggs: "Boggs, interrupted",
    geoInterruptedHomolosine: "Goode homolosine, interrupted",
    geoInterruptedMollweide: "Mollweide, interrupted",
    geoInterruptedMollweideHemispheres: "Mollweide hemispheres",
    geoInterruptedQuarticAuthalic: "Quartic authalic, interrupted",
    geoInterruptedSinuMollweide: "Sinu-Mollweide, interrupted",
    geoInterruptedSinusoidal: "Sinusoidal, interrupted",
    geoKavrayskiy7: "Kavrayskiy VII",
    geoLarrivee: "Larrivée",
    geoMtFlatPolarParabolic: "McBryde–Thomas flat-polar parabolic",
    geoMtFlatPolarQuartic: "McBryde–Thomas flat-polar quartic",
    geoMtFlatPolarSinusoidal: "McBryde–Thomas flat-polar sinusoidal",
    geoNaturalEarth1: "Natural Earth I",
    geoNaturalEarth2: "Natural Earth II",
    geoNellHammer: "Nell–Hammer",
    geoPeirceQuincuncial: "Peirce quincuncial",
    geoPolyhedralButterfly: "Polyhedral butterfly (Cahill)",
    geoPolyhedralCollignon: "Polyhedral Collignon",
    geoPolyhedralWaterman: "Waterman butterfly",
    geoRectangularPolyconic: "Rectangular polyconic",
    geoSinuMollweide: "Sinu-Mollweide",
    geoTransverseMercator: "Transverse Mercator",
    geoVanDerGrinten: "Van der Grinten",
    geoVanDerGrinten2: "Van der Grinten II",
    geoVanDerGrinten3: "Van der Grinten III",
    geoVanDerGrinten4: "Van der Grinten IV",
    geoWagner: "Wagner (generalised)",
    geoWagner4: "Wagner IV",
    geoWagner6: "Wagner VI",
    geoWagner7: "Wagner VII",
    geoWinkel3: "Winkel tripel",
  };

  const FAMILY_OF = {
    // Cylindrical
    geoEquirectangular: "cylindrical",
    geoMercator: "cylindrical",
    geoTransverseMercator: "cylindrical",
    geoMiller: "cylindrical",
    geoCylindricalEqualArea: "cylindrical",
    geoCylindricalStereographic: "cylindrical",
    geoPatterson: "cylindrical",
    geoGilbert: "cylindrical",
    // Pseudocylindrical
    geoMollweide: "pseudocylindrical",
    geoSinusoidal: "pseudocylindrical",
    geoEckert1: "pseudocylindrical",
    geoEckert2: "pseudocylindrical",
    geoEckert3: "pseudocylindrical",
    geoEckert4: "pseudocylindrical",
    geoEckert5: "pseudocylindrical",
    geoEckert6: "pseudocylindrical",
    geoRobinson: "pseudocylindrical",
    geoNaturalEarth1: "pseudocylindrical",
    geoNaturalEarth2: "pseudocylindrical",
    geoEqualEarth: "pseudocylindrical",
    geoKavrayskiy7: "pseudocylindrical",
    geoWagner4: "pseudocylindrical",
    geoWagner6: "pseudocylindrical",
    geoBoggs: "pseudocylindrical",
    geoCraster: "pseudocylindrical",
    geoHomolosine: "pseudocylindrical",
    geoSinuMollweide: "pseudocylindrical",
    geoBaker: "pseudocylindrical",
    geoBromley: "pseudocylindrical",
    geoCollignon: "pseudocylindrical",
    geoFahey: "pseudocylindrical",
    geoFoucaut: "pseudocylindrical",
    geoFoucautSinusoidal: "pseudocylindrical",
    geoGinzburg4: "pseudocylindrical",
    geoGinzburg5: "pseudocylindrical",
    geoGinzburg6: "pseudocylindrical",
    geoGinzburg8: "pseudocylindrical",
    geoGinzburg9: "pseudocylindrical",
    geoMtFlatPolarParabolic: "pseudocylindrical",
    geoMtFlatPolarQuartic: "pseudocylindrical",
    geoMtFlatPolarSinusoidal: "pseudocylindrical",
    geoNellHammer: "pseudocylindrical",
    geoTimes: "pseudocylindrical",
    geoHyperelliptical: "pseudocylindrical",
    geoHufnagel: "pseudocylindrical",
    geoHill: "pseudocylindrical",
    // Lenticular & modified azimuthal
    geoAitoff: "lenticular",
    geoHammer: "lenticular",
    geoWinkel3: "lenticular",
    geoWagner: "lenticular",
    geoWagner7: "lenticular",
    geoVanDerGrinten: "lenticular",
    geoVanDerGrinten2: "lenticular",
    geoVanDerGrinten3: "lenticular",
    geoVanDerGrinten4: "lenticular",
    geoBertin1953: "lenticular",
    geoNicolosi: "lenticular",
    geoLarrivee: "lenticular",
    geoLaskowski: "lenticular",
    geoBottomley: "lenticular",
    geoEisenlohr: "lenticular",
    geoAugust: "lenticular",
    geoGringorten: "lenticular",
    geoBonne: "lenticular",
    geoLoximuthal: "lenticular",
    // Azimuthal
    geoOrthographic: "azimuthal",
    geoStereographic: "azimuthal",
    geoGnomonic: "azimuthal",
    geoAzimuthalEqualArea: "azimuthal",
    geoAzimuthalEquidistant: "azimuthal",
    geoSatellite: "azimuthal",
    geoAiry: "azimuthal",
    geoWiechel: "azimuthal",
    // Conic
    geoAlbers: "conic",
    geoConicEqualArea: "conic",
    geoConicConformal: "conic",
    geoConicEquidistant: "conic",
    // Polyconic & retroazimuthal
    geoPolyconic: "polyconic",
    geoRectangularPolyconic: "polyconic",
    geoArmadillo: "polyconic",
    geoCraig: "polyconic",
    geoHammerRetroazimuthal: "polyconic",
    geoBerghaus: "polyconic",
    geoGingery: "polyconic",
    // Quincuncial & conformal oddities
    geoGuyou: "quincuncial",
    geoPeirceQuincuncial: "quincuncial",
    geoGringortenQuincuncial: "quincuncial",
    geoLittrow: "quincuncial",
    geoLagrange: "quincuncial",
    // Interrupted & polyhedral
    geoInterruptedSinusoidal: "interrupted",
    geoInterruptedMollweide: "interrupted",
    geoInterruptedMollweideHemispheres: "interrupted",
    geoInterruptedBoggs: "interrupted",
    geoInterruptedHomolosine: "interrupted",
    geoInterruptedSinuMollweide: "interrupted",
    geoInterruptedQuarticAuthalic: "interrupted",
    geoPolyhedralButterfly: "interrupted",
    geoPolyhedralCollignon: "interrupted",
    geoPolyhedralWaterman: "interrupted",
    geoHealpix: "interrupted",
  };

  // Projections whose own preclip machinery must not be replaced by a clip
  // circle, and projections that are simply not world maps.
  const NO_CLIP_SLIDER = new Set([
    "geoBerghaus", "geoGingery", "geoHealpix",
    "geoPolyhedralButterfly", "geoPolyhedralCollignon", "geoPolyhedralWaterman",
    "geoPeirceQuincuncial", "geoGringortenQuincuncial",
  ]);

  // geoIdentity and geoAlbersUsa are not world projections. Region-specific
  // projections such as Chamberlin Africa or the modified stereographics are
  // dropped automatically further down: they expose no rotate() accessor, so
  // the shared orientation controls could not drive them.
  const EXCLUDED = new Set(["geoIdentity", "geoAlbersUsa", "geoTransform"]);

  // Named parameters we know how to render a control for. `kind` drives the
  // widget; `min`/`max`/`step` bound it.
  const PARAM_SPECS = {
    parallels: { label: "Standard parallels", kind: "pair", min: -89, max: 89, step: 0.5, unit: "°" },
    parallel: { label: "Reference parallel", kind: "number", min: -89, max: 89, step: 0.5, unit: "°" },
    coefficient: { label: "Coefficient", kind: "number", min: 1, max: 6, step: 0.05 },
    distance: { label: "Viewpoint distance", kind: "number", min: 1.02, max: 12, step: 0.02, unit: "×R" },
    tilt: { label: "Tilt", kind: "number", min: -80, max: 80, step: 1, unit: "°" },
    spacing: { label: "Spacing", kind: "number", min: 0.05, max: 1, step: 0.01 },
    ratio: { label: "Ratio", kind: "number", min: 0.05, max: 400, step: 0.05 },
    fraction: { label: "Fraction", kind: "number", min: 0.05, max: 1, step: 0.01 },
    radius: { label: "Radius", kind: "number", min: 5, max: 175, step: 1, unit: "°" },
    lobes: { label: "Lobes", kind: "integer", min: 2, max: 8, step: 1 },
    alpha: { label: "Alpha", kind: "number", min: 0, max: 1, step: 0.01 },
    k: { label: "k", kind: "number", min: 1, max: 5, step: 0.05 },
    gamma: { label: "Gamma", kind: "number", min: 0.4, max: 2.5, step: 0.01 },
  };

  // Per-projection ranges that differ from the generic ones above.
  const PARAM_RANGE_OVERRIDES = {
    geoHufnagel: { ratio: { min: 0, max: 4, step: 0.02 } },
    geoHill: { ratio: { min: 0, max: 4, step: 0.02 } },
    geoWagner: { ratio: { min: 20, max: 400, step: 1 }, parallels: { kind: "number", min: 0, max: 89, step: 0.5, unit: "°" } },
    geoWagner7: { ratio: { min: 20, max: 400, step: 1 }, parallels: { kind: "number", min: 0, max: 89, step: 0.5, unit: "°" } },
    geoHealpix: { lobes: { min: 1, max: 8, step: 1 } },
    geoGingery: { lobes: { min: 3, max: 9, step: 1 }, radius: { min: 10, max: 60, step: 1 } },
    geoBerghaus: { lobes: { min: 3, max: 9, step: 1 } },
    geoAiry: { radius: { min: 30, max: 175, step: 1 } },
  };

  const PARAM_ORDER = Object.keys(PARAM_SPECS);

  function humanLabel(id) {
    if (LABEL_OVERRIDES[id]) return LABEL_OVERRIDES[id];
    return id
      .replace(/^geo/, "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/^./, (c) => c.toUpperCase());
  }

  /* Builds the registry by asking the loaded d3 bundles what they actually
   * provide, so the app never offers a projection the libraries lack. */
  function buildRegistry(d3) {
    const byId = new Map();

    for (const id of Object.keys(d3)) {
      if (!/^geo[A-Z]/.test(id) || EXCLUDED.has(id)) continue;
      const factory = d3[id];
      if (typeof factory !== "function") continue;

      let probe;
      try {
        probe = factory();
      } catch (err) {
        continue;
      }
      if (!probe || typeof probe.stream !== "function" || typeof probe.scale !== "function") continue;
      if (typeof probe.rotate !== "function") continue;

      // A world map needs a sphere outline; anything that throws on one is not
      // usable here (e.g. composite projections).
      try {
        probe.fitExtent([[0, 0], [200, 150]], { type: "Sphere" });
        if (!isFinite(probe.scale())) continue;
      } catch (err) {
        continue;
      }

      const fresh = factory();
      const params = [];
      for (const name of PARAM_ORDER) {
        if (typeof fresh[name] !== "function") continue;
        let value;
        try {
          value = fresh[name]();
        } catch (err) {
          continue;
        }
        if (value === undefined || value === null) continue;
        const base = PARAM_SPECS[name];
        const override = (PARAM_RANGE_OVERRIDES[id] || {})[name] || {};
        const spec = Object.assign({ name: name }, base, override);
        // `parallels` is a pair on conics but a single angle on Wagner.
        if (Array.isArray(value)) {
          if (value.length !== 2 || typeof value[0] !== "number") continue; // lobes tables etc.
          spec.kind = "pair";
        } else if (typeof value === "number") {
          if (spec.kind === "pair") spec.kind = "number";
        } else {
          continue;
        }
        spec.default = value;
        params.push(spec);
      }

      const clipDefault = typeof fresh.clipAngle === "function" ? fresh.clipAngle() : 0;
      const hasAngle = typeof fresh.angle === "function";

      byId.set(id, {
        id: id,
        label: humanLabel(id),
        family: FAMILY_OF[id] || "lenticular",
        params: params,
        clippable: !NO_CLIP_SLIDER.has(id) && clipDefault > 0,
        clipDefault: clipDefault > 0 ? clipDefault : 0,
        angle: hasAngle,
        angleDefault: hasAngle ? fresh.angle() : 0,
      });
    }

    const list = Array.from(byId.values());
    const familyRank = new Map(FAMILIES.map((f, i) => [f[0], i]));
    list.sort((a, b) => {
      const fa = familyRank.get(a.family) ?? 99;
      const fb = familyRank.get(b.family) ?? 99;
      return fa - fb || a.label.localeCompare(b.label);
    });

    return {
      list: list,
      byId: byId,
      families: FAMILIES.filter((f) => list.some((p) => p.family === f[0])),
      get: (id) => byId.get(id),
      has: (id) => byId.has(id),
    };
  }

  global.ProjectionRegistry = { build: buildRegistry, families: FAMILIES };
})(window);
