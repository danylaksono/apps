/** Introspection for arbitrary ArcGIS REST services.
 *
 *  `lib/big.ts` knows how to *read* one specific ArcGIS service; this module
 *  knows how to *discover* any of them, so a user can paste a URL and get a
 *  layer without anyone editing the registry. BIG alone publishes seven public
 *  MapServers and the app hard-codes layers from two of them.
 *
 *  Three shapes of URL are worth resolving, and they are distinguished by what
 *  `?f=json` returns rather than by pattern-matching the path — ArcGIS installs
 *  differ in where `/rest/services` sits:
 *
 *    - a **service** answers with a `layers` array   -> pick a layer
 *    - a **folder** answers with `services`/`folders` -> drill down
 *    - anything else is not an ArcGIS endpoint
 *
 *  Everything here is a plain GET with no credentials. A service that needs a
 *  token answers 499/403 and is reported as such rather than retried. */

/** A layer inside a MapServer/FeatureServer. */
export interface ArcgisSublayer {
  id: number;
  name: string;
  /** absent on group layers and raster layers — those are image-only */
  geometry: "point" | "line" | "polygon" | null;
  isGroup: boolean;
}

export interface ArcgisService {
  /** service URL, without a trailing layer index */
  url: string;
  name: string;
  description: string;
  layers: ArcgisSublayer[];
  /** the service's own paging cap; assuming 1000 against a service that caps
   *  lower makes a short page look like the end of the data */
  maxRecordCount: number;
  /** set when the pasted URL already named a layer (".../MapServer/6") */
  preselect: number | null;
  /** Whether `export` will work. Only MapServer draws images; a FeatureServer
   *  serves features and nothing else, so offering "add as image" there would
   *  produce a layer of 400s. */
  supportsExport: boolean;
}

export interface ArcgisEntry {
  name: string;
  url: string;
}

export interface ArcgisFolder {
  url: string;
  folders: ArcgisEntry[];
  services: ArcgisEntry[];
}

export type ArcgisProbe =
  | { kind: "service"; service: ArcgisService }
  | { kind: "folder"; folder: ArcgisFolder };

const GEOMETRY: Record<string, ArcgisSublayer["geometry"]> = {
  esriGeometryPoint: "point",
  esriGeometryMultipoint: "point",
  esriGeometryPolyline: "line",
  esriGeometryPolygon: "polygon",
};

/** Strip the query string, any trailing slash, and a trailing layer index. */
function normalise(raw: string): { base: string; preselect: number | null } {
  let url = raw.trim().split("?")[0].split("#")[0].replace(/\/+$/, "");
  let preselect: number | null = null;
  const tail = /\/(\d+)$/.exec(url);
  if (tail && /(MapServer|FeatureServer)\/\d+$/.test(url)) {
    preselect = Number(tail[1]);
    url = url.slice(0, -tail[0].length);
  }
  return { base: url, preselect };
}

/** Everything up to and including `/rest/services`, which is what folder and
 *  service names below it are relative to. */
function servicesRoot(url: string): string {
  const at = url.toLowerCase().indexOf("/rest/services");
  return at === -1 ? url : url.slice(0, at + "/rest/services".length);
}

interface ServiceJson {
  error?: { code?: number; message?: string };
  layers?: {
    id: number;
    name: string;
    geometryType?: string;
    type?: string;
    subLayerIds?: number[] | null;
  }[];
  folders?: string[];
  services?: { name: string; type: string }[];
  mapName?: string;
  serviceDescription?: string;
  description?: string;
  maxRecordCount?: number;
}

/** The failure that needs its own explanation: the browser never got an answer.
 *  From a page this is almost always a missing `Access-Control-Allow-Origin`
 *  rather than a dead host, and the two are indistinguishable to `fetch` — so
 *  the dialog says both rather than guessing. */
export class RemoteBlockedError extends Error {
  constructor() {
    super("no answer from that host");
  }
}

async function getJson(url: string, signal?: AbortSignal): Promise<ServiceJson> {
  let res: Response;
  try {
    res = await fetch(`${url}?f=json`, { signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new RemoteBlockedError();
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as ServiceJson;
  if (json.error) {
    // 499/403 mean a token is required — worth saying plainly, because it is
    // the single most common reason an ArcGIS URL found on the web fails here.
    const code = json.error.code;
    throw new Error(
      code === 499 || code === 403
        ? "this service requires a token"
        : (json.error.message ?? "service error"),
    );
  }
  return json;
}

export async function probeArcgis(
  raw: string,
  signal?: AbortSignal,
): Promise<ArcgisProbe> {
  const { base, preselect } = normalise(raw);
  if (!/^https:\/\//i.test(base)) {
    throw new Error("needs an https:// URL");
  }
  const json = await getJson(base, signal);

  if (Array.isArray(json.layers)) {
    return {
      kind: "service",
      service: {
        url: base,
        name: decodeURIComponent(base.split("/").slice(-2, -1)[0] ?? base),
        description: json.serviceDescription || json.description || "",
        maxRecordCount: json.maxRecordCount || 1000,
        preselect,
        supportsExport: /\/MapServer$/i.test(base),
        layers: json.layers.map((l) => ({
          id: l.id,
          name: l.name,
          geometry: GEOMETRY[l.geometryType ?? ""] ?? null,
          isGroup: l.type === "Group Layer" || Boolean(l.subLayerIds?.length),
        })),
      },
    };
  }

  if (Array.isArray(json.services) || Array.isArray(json.folders)) {
    const root = servicesRoot(base);
    return {
      kind: "folder",
      folder: {
        url: base,
        folders: (json.folders ?? []).map((name) => ({
          name,
          url: `${root}/${name}`,
        })),
        // `name` comes back folder-qualified ("PUBLIK/KEHUTANAN"), so it is
        // joined to the services root, not to the folder we asked about.
        services: (json.services ?? []).map((s) => ({
          name: s.name.split("/").pop() ?? s.name,
          url: `${root}/${s.name}/${s.type}`,
        })),
      },
    };
  }

  throw new Error("not an ArcGIS service or folder");
}

/** Raster tile template that renders one sublayer on demand.
 *
 *  MapServer's `export` takes a bbox and hands back an image, which is exactly
 *  the WMS-shaped request MapLibre's `{bbox-epsg-3857}` token was built for. It
 *  is the escape hatch for layers too large to page as GeoJSON — BIG's rawan
 *  erosi is 306,265 features and unusable any other way. */
export function arcgisExportTiles(service: string, layerId: number): string {
  const params = new URLSearchParams({
    bbox: "{bbox-epsg-3857}",
    bboxSR: "3857",
    imageSR: "3857",
    size: "256,256",
    dpi: "96",
    format: "png32",
    transparent: "true",
    layers: `show:${layerId}`,
    f: "image",
  });
  // URLSearchParams percent-encodes the braces; MapLibre matches on the literal
  // token, so put it back.
  return `${service}/export?${params}`.replace(
    "%7Bbbox-epsg-3857%7D",
    "{bbox-epsg-3857}",
  );
}

/** Legend swatches for one sublayer, as data URIs.
 *
 *  An `export`-rendered layer arrives already symbolised by the server, so
 *  without this it is a set of colours with no stated meaning — decorative
 *  rather than readable. `/legend` is the only way to recover what they say:
 *  ArcGIS returns each class as a base64 PNG plus its label.
 *
 *  Cached per service because one request covers every sublayer. */
export interface LegendSwatch {
  label: string;
  /** data: URI, ready for an <img src> */
  swatch: string;
}

interface LegendJson {
  layers?: {
    layerId: number;
    legend?: { label?: string; imageData?: string; contentType?: string }[];
  }[];
}

const legendCache = new Map<string, Promise<LegendJson>>();

export async function arcgisLegend(
  service: string,
  layerId: number,
): Promise<LegendSwatch[]> {
  let task = legendCache.get(service);
  if (!task) {
    task = fetch(`${service}/legend?f=json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<LegendJson>;
    });
    legendCache.set(service, task);
    task.catch(() => legendCache.delete(service));
  }
  const json = await task;
  const hit = json.layers?.find((l) => l.layerId === layerId);
  return (hit?.legend ?? [])
    .filter((e) => e.imageData)
    .map((e, i) => ({
      // A single-class layer legends itself with an empty label; naming it
      // after nothing is worse than naming it after the layer.
      label: e.label?.trim() || (i === 0 ? "shown" : `class ${i + 1}`),
      swatch: `data:${e.contentType ?? "image/png"};base64,${e.imageData}`,
    }));
}
