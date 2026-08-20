/** Copernicus Land Monitoring Service burnt area (300 m, daily, v4).
 *
 *  Served as WMTS from land.copernicus.eu — keyless, `Access-Control-Allow-
 *  Origin: *`, and it publishes PopularWebMercator tile matrix sets, so it
 *  drops straight into MapLibre. (The other two routes to this product do not:
 *  VITO's globalland host refuses the TLS handshake, and the Copernicus Data
 *  Space collection is behind an OAuth token.)
 *
 *  Two things about the tiles shape how they are used here.
 *
 *  1. They are pre-styled, and the "no burn" class is *opaque*: every land
 *     pixel with a burned fraction of zero comes back as #fcfdbf, the pale end
 *     of the ramp. Drawn as-is the layer is a sheet of pale yellow over every
 *     landmass with the actual burns lost inside it, so the protocol below
 *     drops that one colour to transparent.
 *  2. A single day of 300 m burnt area is genuinely sparse — sampled over
 *     Central Kalimantan at the height of the 2025 season, a z8 tile held one
 *     burn pixel. That is the product behaving correctly, not a fault: burn
 *     scars accumulate. It is why this layer ships with the date slider, and
 *     why the layer description says so. */

/** Burned fraction. The service also exposes DOB (date of burn), CP and LFP;
 *  BF is the one that reads as a map. */
export const CLMS_BA_WMTS =
  "https://land.copernicus.eu/cdse/ba_global_300m_daily_v4";

/** The opaque "nothing burned here" fill, dropped in the decoder. */
const NO_BURN: [number, number, number] = [252, 253, 191];

export const CLMS_BA_PROTOCOL = "clmsba";

/** clmsba://{date}/{z}/{x}/{y} */
export function clmsBurntAreaTiles(date: string): string {
  return `${CLMS_BA_PROTOCOL}://${date}/{z}/{x}/{y}`;
}

function upstreamUrl(date: string, z: string, x: string, y: string): string {
  const params = new URLSearchParams({
    SERVICE: "WMTS",
    REQUEST: "GetTile",
    VERSION: "1.0.0",
    LAYER: "BF",
    STYLE: "default",
    FORMAT: "image/png",
    TILEMATRIXSET: "PopularWebMercator256",
    TILEMATRIX: z,
    TILEROW: y,
    TILECOL: x,
    TIME: date,
  });
  return `${CLMS_BA_WMTS}?${params}`;
}

async function decodeTile(
  url: string,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`CLMS burnt area ${res.status}`);
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
    if (
      d[i] === NO_BURN[0] &&
      d[i + 1] === NO_BURN[1] &&
      d[i + 2] === NO_BURN[2]
    ) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.convertToBlob({ type: "image/png" }).then((b) => b.arrayBuffer());
}

export function clmsBurntAreaProtocol(
  params: { url: string },
  abortController: AbortController,
): Promise<{ data: ArrayBuffer }> {
  const path = params.url.replace(`${CLMS_BA_PROTOCOL}://`, "");
  const [date, z, x, y] = path.split("/");
  return decodeTile(upstreamUrl(date, z, x, y), abortController.signal).then(
    (data) => ({ data }),
  );
}
