/** Decoding Global Forest Watch's encoded raster tiles.
 *
 *  GFW does not serve styled tree-cover-loss tiles — it serves *data* in the
 *  pixels and expects the client to colour them in a shader. Measured on
 *  umd_tree_cover_loss v1.13 (tcd_30):
 *
 *    R = intensity (1..255)   G = unused (always 0)
 *    B = year - 2000 (0..25)  A = 255 where loss, 0 elsewhere
 *
 *  Drawn raw that is a near-black smear, because the year sits in the blue
 *  channel at values under 26. Mapbox GL v3 has `raster-color` for exactly this
 *  case; MapLibre 6 does not, so the decode happens here instead: a custom
 *  protocol fetches the upstream tile, recolours it on a canvas, and hands
 *  MapLibre an ordinary PNG. Same mechanism the app already uses for PMTiles.
 *
 *  Cost is one canvas pass per 512px tile, which is nothing next to the fetch. */

import { GFW_TILES } from "./config";

/** Loss year -> colour, oldest to newest, as an ordinal ramp: one hue, with
 *  lightness carrying recency so the last few seasons read first. Validated for
 *  monotone lightness and step separation against the map's near-black ground. */
const YEAR_RAMP: [number, number, number][] = [
  [0x36, 0x53, 0x14],
  [0x4d, 0x7c, 0x0f],
  [0x84, 0xcc, 0x16],
  [0xbe, 0xf2, 0x64],
];

export const LOSS_FIRST_YEAR = 2001;
/** Anything at or after this is drawn in the brightest step. */
export const LOSS_RECENT_YEAR = 2022;

/** The protocol prefix registered with MapLibre. */
export const GFW_LOSS_PROTOCOL = "gfwloss";

export function gfwLossTileUrl(version: string): string {
  return `${GFW_LOSS_PROTOCOL}://${version}/{z}/{x}/{y}`;
}

function rampColour(year: number): [number, number, number] {
  const span = LOSS_RECENT_YEAR - LOSS_FIRST_YEAR;
  const t = Math.max(0, Math.min(1, (year - LOSS_FIRST_YEAR) / span));
  const pos = t * (YEAR_RAMP.length - 1);
  const i = Math.min(YEAR_RAMP.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = YEAR_RAMP[i];
  const b = YEAR_RAMP[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/** Precomputed colour per encoded blue value, so the pixel loop is a lookup. */
const LUT: ([number, number, number] | null)[] = Array.from(
  { length: 256 },
  (_, b) => (b === 0 ? null : rampColour(2000 + b)),
);

async function decodeLossTile(
  url: string,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`GFW loss tile ${res.status}`);
  const bmp = await createImageBitmap(await res.blob());
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bmp, 0, 0);
  bmp.close();

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const colour = LUT[d[i + 2]];
    if (!colour) {
      d[i + 3] = 0; // year 0 is "no loss" however the alpha reads
      continue;
    }
    // Intensity is tree-cover density at the time of loss; carry it as opacity
    // so sparse edges stay faint and solid clearances read hard.
    const intensity = d[i];
    d[i] = colour[0];
    d[i + 1] = colour[1];
    d[i + 2] = colour[2];
    d[i + 3] = Math.min(255, 90 + intensity);
  }
  ctx.putImageData(img, 0, 0);
  return canvas.convertToBlob({ type: "image/png" }).then((b) => b.arrayBuffer());
}

/** MapLibre protocol handler: gfwloss://{version}/{z}/{x}/{y} */
export function gfwLossProtocol(
  params: { url: string },
  abortController: AbortController,
): Promise<{ data: ArrayBuffer }> {
  const path = params.url.replace(`${GFW_LOSS_PROTOCOL}://`, "");
  const [version, z, x, y] = path.split("/");
  const upstream = `${GFW_TILES}/umd_tree_cover_loss/${version}/tcd_30/${z}/${x}/${y}.png`;
  return decodeLossTile(upstream, abortController.signal).then((data) => ({
    data,
  }));
}
