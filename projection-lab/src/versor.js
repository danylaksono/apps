/* Quaternion helpers for "grab the globe" dragging.
 * Port of Mike Bostock's versor.js (ISC), kept local so the app has no
 * network dependencies. */
(function (global) {
  "use strict";

  const acos = Math.acos, asin = Math.asin, atan2 = Math.atan2;
  const cos = Math.cos, sin = Math.sin, sqrt = Math.sqrt;
  const radians = Math.PI / 180, degrees = 180 / Math.PI;

  function versor(e) {
    const l = (e[0] / 2) * radians, sl = sin(l), cl = cos(l);
    const p = (e[1] / 2) * radians, sp = sin(p), cp = cos(p);
    const g = (e[2] / 2) * radians, sg = sin(g), cg = cos(g);
    return [
      cl * cp * cg + sl * sp * sg,
      sl * cp * cg - cl * sp * sg,
      cl * sp * cg + sl * cp * sg,
      cl * cp * sg - sl * sp * cg,
    ];
  }

  // Quaternion -> [lambda, phi, gamma] in degrees.
  versor.rotation = function (q) {
    return [
      atan2(2 * (q[0] * q[1] + q[2] * q[3]), 1 - 2 * (q[1] * q[1] + q[2] * q[2])) * degrees,
      asin(Math.max(-1, Math.min(1, 2 * (q[0] * q[2] - q[3] * q[1])))) * degrees,
      atan2(2 * (q[0] * q[3] + q[1] * q[2]), 1 - 2 * (q[2] * q[2] + q[3] * q[3])) * degrees,
    ];
  };

  // Quaternion taking cartesian point v0 to v1.
  versor.delta = function (v0, v1, alpha) {
    if (alpha === undefined) alpha = 1;
    const w = [
      v0[1] * v1[2] - v0[2] * v1[1],
      v0[2] * v1[0] - v0[0] * v1[2],
      v0[0] * v1[1] - v0[1] * v1[0],
    ];
    const s = sqrt(w[0] * w[0] + w[1] * w[1] + w[2] * w[2]);
    if (!s) return [1, 0, 0, 0];
    const t = alpha * acos(Math.max(-1, Math.min(1, v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2]))) / 2;
    const st = sin(t);
    return [cos(t), (w[2] / s) * st, (-w[1] / s) * st, (w[0] / s) * st];
  };

  versor.multiply = function (q0, q1) {
    return [
      q0[0] * q1[0] - q0[1] * q1[1] - q0[2] * q1[2] - q0[3] * q1[3],
      q0[0] * q1[1] + q0[1] * q1[0] + q0[2] * q1[3] - q0[3] * q1[2],
      q0[0] * q1[2] - q0[1] * q1[3] + q0[2] * q1[0] + q0[3] * q1[1],
      q0[0] * q1[3] + q0[1] * q1[2] - q0[2] * q1[1] + q0[3] * q1[0],
    ];
  };

  // [lon, lat] degrees -> unit cartesian.
  versor.cartesian = function (e) {
    const l = e[0] * radians, p = e[1] * radians, cp = cos(p);
    return [cp * cos(l), cp * sin(l), sin(p)];
  };

  global.versor = versor;
})(window);
