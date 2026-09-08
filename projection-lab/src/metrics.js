/* Numerical distortion analysis.
 *
 * Everything is derived from the projection function itself by finite
 * differences, so it works for all 100+ projections and reacts to whatever
 * parameters are currently set. Formulas follow Snyder's treatment of the
 * Tissot indicatrix: h is the scale along the meridian, k the scale along the
 * parallel, theta' the angle between them.
 */
(function (global) {
  "use strict";

  const RADIANS = Math.PI / 180;
  const DEGREES = 180 / Math.PI;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  function finite(p) {
    return p && isFinite(p[0]) && isFinite(p[1]);
  }

  /* Is this point on the visible side of the globe, given the projection's
   * clip circle? Points beyond it are still *returned* by the projection
   * function (it does not clip), but they are mirror images and must not be
   * measured. */
  function visibilityTest(d3, projection) {
    let theta = 0;
    try {
      theta = typeof projection.clipAngle === "function" ? projection.clipAngle() : 0;
    } catch (err) {
      theta = 0;
    }
    if (!(theta > 0) || theta >= 179.9) return null;
    const rotate = projection.rotate();
    const centre = [-rotate[0], -rotate[1]];
    const limit = (theta - 0.35) * RADIANS;
    return (lon, lat) => d3.geoDistance([lon, lat], centre) < limit;
  }

  /* Local distortion at one point. Returns null where the projection is not
   * differentiable there (clip edges, interruption seams, poles). */
  function pointDistortion(projection, lon, lat, step) {
    const R = projection.scale();
    if (!(R > 0)) return null;
    const h = step === undefined ? 0.02 : step;
    const phi = clamp(lat, -88, 88);
    const cosPhi = Math.cos(phi * RADIANS);
    if (cosPhi < 1e-6) return null;

    const pE = projection([lon + h, phi]);
    const pW = projection([lon - h, phi]);
    const pN = projection([lon, Math.min(89.9, phi + h)]);
    const pS = projection([lon, Math.max(-89.9, phi - h)]);
    const p0 = projection([lon, phi]);
    if (!finite(pE) || !finite(pW) || !finite(pN) || !finite(pS) || !finite(p0)) return null;

    const dl = 2 * h * RADIANS;
    const dxdl = (pE[0] - pW[0]) / dl;
    const dydl = (pE[1] - pW[1]) / dl;
    const dxdp = (pN[0] - pS[0]) / dl;
    const dydp = (pN[1] - pS[1]) / dl;

    // Discontinuity guard: a seam makes the one-sided estimates disagree.
    const fwdL = Math.hypot(pE[0] - p0[0], pE[1] - p0[1]);
    const bwdL = Math.hypot(p0[0] - pW[0], p0[1] - pW[1]);
    const fwdP = Math.hypot(pN[0] - p0[0], pN[1] - p0[1]);
    const bwdP = Math.hypot(p0[0] - pS[0], p0[1] - pS[1]);
    const skewL = Math.max(fwdL, bwdL) / Math.max(1e-12, Math.min(fwdL, bwdL));
    const skewP = Math.max(fwdP, bwdP) / Math.max(1e-12, Math.min(fwdP, bwdP));
    if (skewL > 1.35 || skewP > 1.35) return null;

    const mMeridian = Math.hypot(dxdp, dydp);
    const mParallel = Math.hypot(dxdl, dydl);
    if (!(mMeridian > 0) || !(mParallel > 0)) return null;

    const hScale = mMeridian / R;
    const kScale = mParallel / (R * cosPhi);
    if (!isFinite(hScale) || !isFinite(kScale) || hScale > 1e5 || kScale > 1e5) return null;

    const sinTheta = clamp(Math.abs(dxdp * dydl - dydp * dxdl) / (mMeridian * mParallel), 0, 1);
    const sum = Math.sqrt(hScale * hScale + kScale * kScale + 2 * hScale * kScale * sinTheta);
    const diff = Math.sqrt(Math.max(0, hScale * hScale + kScale * kScale - 2 * hScale * kScale * sinTheta));
    const semiMajor = (sum + diff) / 2;
    const semiMinor = (sum - diff) / 2;
    const area = hScale * kScale * sinTheta;
    const omega = 2 * Math.asin(clamp((semiMajor - semiMinor) / Math.max(1e-12, semiMajor + semiMinor), 0, 1)) * DEGREES;

    return {
      h: hScale,
      k: kScale,
      area: area,
      semiMajor: semiMajor,
      semiMinor: semiMinor,
      omega: omega,
    };
  }

  /* Samples a lon/lat grid and returns one record per cell plus summary
   * statistics. Cell records carry the polygon ring so the renderer can fill
   * them directly. */
  function sampleGrid(d3, projection, options) {
    const opts = options || {};
    const step = opts.step || 10;
    const visible = visibilityTest(d3, projection);
    const cells = [];
    const areas = [];
    const omegas = [];
    const latLimit = 90 - step / 2;

    for (let lat = -90; lat < 90 - 1e-9; lat += step) {
      const lat1 = Math.min(90, lat + step);
      const latMid = clamp((lat + lat1) / 2, -latLimit, latLimit);
      for (let lon = -180; lon < 180 - 1e-9; lon += step) {
        const lon1 = Math.min(180, lon + step);
        const lonMid = (lon + lon1) / 2;
        if (visible && !visible(lonMid, latMid)) continue;
        const d = pointDistortion(projection, lonMid, latMid);
        if (!d || !(d.area > 0) || !isFinite(d.area)) continue;
        areas.push(d.area);
        omegas.push(d.omega);
        cells.push({
          lon0: lon, lat0: lat, lon1: lon1, lat1: lat1,
          area: d.area,
          omega: d.omega,
          h: d.h,
          k: d.k,
        });
      }
    }

    if (!areas.length) {
      return { cells: cells, stats: null };
    }

    areas.sort((a, b) => a - b);
    omegas.sort((a, b) => a - b);
    const q = (arr, t) => arr[clamp(Math.round(t * (arr.length - 1)), 0, arr.length - 1)];
    // Ignore the extreme tail: a handful of near-seam cells should not define
    // the headline number.
    const areaLo = q(areas, 0.02);
    const areaHi = q(areas, 0.98);
    const stats = {
      samples: areas.length,
      areaMin: areas[0],
      areaMax: areas[areas.length - 1],
      areaLo: areaLo,
      areaHi: areaHi,
      areaMedian: q(areas, 0.5),
      areaSpread: areaHi / Math.max(1e-12, areaLo),
      omegaMedian: q(omegas, 0.5),
      omegaMax: omegas[omegas.length - 1],
      omegaHi: q(omegas, 0.98),
      equalArea: areas[areas.length - 1] / areas[0] < 1.02,
      conformal: q(omegas, 0.98) < 0.5,
    };
    return { cells: cells, stats: stats };
  }

  global.Distortion = {
    point: pointDistortion,
    sampleGrid: sampleGrid,
    visibilityTest: visibilityTest,
  };
})(window);
