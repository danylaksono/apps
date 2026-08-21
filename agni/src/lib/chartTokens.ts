/** Chart palette and shared chart types.
 *
 *  Separate from charts.tsx so that file exports components only — mixing
 *  constants into it breaks React Fast Refresh.
 *
 *  These are not the map's tokens reused verbatim. Dark-mode chart marks want
 *  OKLCH lightness in 0.48–0.67; fire-500 (#ff6b1a) and haze-400 (#b8a6f2) sit
 *  above that band and glow against a panel surface. Each colour below was
 *  snapped one step down and then checked — chroma floor, CVD separation,
 *  normal-vision separation and contrast against the #10151c card — rather
 *  than eyeballed. */

export const SERIES = {
  /** detections / FRP — the fire ramp, one step down into the band */
  fire: "#e8590c",
  /** surface PM2.5 — the violet the map's PM2.5 layer is rotated to */
  pm25: "#9b7ee8",
  /** biomass-burning AOD — the magenta the map's smoke plume is rotated to */
  smoke: "#f332a2",
} as const;

export const CHART_SURFACE = "#10151c";
export const CHART_GRID = "#1f2833";
export const CHART_INK_MUTED = "#5b6b7d";
export const CHART_INK = "#d5dce4";

/** Reference line on a value axis — a labelled threshold, not a data series. */
export interface Threshold {
  value: number;
  label: string;
}

export interface LinePoint {
  /** x position, already numeric (epoch ms) */
  t: number;
  value: number | null;
  label: string;
  /** stable id, when the point is selectable */
  key?: string;
}

export interface BarRow {
  name: string;
  value: number;
  /** disambiguates same-named kabupaten in different provinces */
  province?: string;
  sub?: string;
  /** stable id, when the row name is not one — e.g. "" for "outside the
   *  forest estate", which is a real category and not a missing value */
  key?: string;
  /** Overrides the chart colour for this bar. Only for rows whose category
   *  already owns a colour on the map, so the bar and the polygon it counts
   *  read as the same thing. Not a value ramp — see BarChart. */
  color?: string;
}
