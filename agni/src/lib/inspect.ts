/** Click-to-inspect: what is burning here, and on whose land?
 *
 *  The context layers only pay off if you can interrogate a point. Clicking
 *  the map queries every visible layer at that pixel and reports the stack:
 *  fire detection, peat, concession holder, protection status, admin unit. */

import type { MapGeoJSONFeature, Map as MaplibreMap } from "maplibre-gl";
import { LAYERS } from "../layers/registry";
import { GFW_POPUP_FIELDS } from "../layers/gfw";
import { forestClassMeta, forestClassOf } from "./forest";

const NUM = new Intl.NumberFormat("en-US");

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Layer ids to query, in the order they should appear in the popup. */
function queryableLayerIds(map: MaplibreMap): string[] {
  const ids: string[] = [];
  for (const d of LAYERS) {
    // fill layers carry the attributes; the -line twin would just duplicate
    const candidate = d.id;
    if (map.getLayer(candidate)) ids.push(candidate);
  }
  return ids;
}

function firstProp(
  f: MapGeoJSONFeature,
  keys: (string | undefined)[],
): string | null {
  for (const k of keys) {
    if (!k) continue;
    const v = f.properties?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v);
    }
  }
  return null;
}

function row(label: string, value: string, sub?: string | null): string {
  return `<div class="hz-row">
    <div class="hz-label">${esc(label)}</div>
    <div class="hz-value">${esc(value)}</div>
    ${sub ? `<div class="hz-sub">${esc(sub)}</div>` : ""}
  </div>`;
}

/** FIRMS reports acq_time as HHMM without padding: 650 -> "06:50". */
function acqTime(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const padded = digits.padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
}

/** The `satellite` column is a one-character platform code. */
const SATELLITE: Record<string, string> = {
  N: "Suomi-NPP",
  "1": "NOAA-20",
  "2": "NOAA-21",
  T: "Terra",
  A: "Aqua",
};

function describeFire(f: MapGeoJSONFeature): string {
  const p = f.properties ?? {};
  const conf =
    { h: "high", n: "nominal", l: "low" }[String(p.confidence)] ??
    String(p.confidence ?? "—");
  const frp = Number(p.frp);
  const time = acqTime(p.acq_time);
  const sat = SATELLITE[String(p.satellite)] ?? String(p.satellite ?? "VIIRS");
  const when = [p.acq_date, time].filter(Boolean).join(" ");
  return row(
    "Active fire",
    `${Number.isFinite(frp) ? `${frp.toFixed(1)} MW FRP` : "detection"} · ${conf} confidence`,
    when ? `${when} UTC · ${sat}` : sat,
  );
}

/** Build popup HTML for the features under a click, or null if nothing hit. */
export function buildInspectHtml(
  map: MaplibreMap,
  features: MapGeoJSONFeature[],
): string | null {
  if (!features.length) return null;

  const order = queryableLayerIds(map);
  const byLayer = new Map<string, MapGeoJSONFeature>();
  for (const f of features) {
    if (!byLayer.has(f.layer.id)) byLayer.set(f.layer.id, f);
  }

  const parts: string[] = [];
  for (const layerId of order) {
    const f = byLayer.get(layerId);
    if (!f) continue;
    const d = LAYERS.find((l) => l.id === layerId);
    if (!d) continue;

    if (d.group === "fire") {
      parts.push(describeFire(f));
      continue;
    }

    if (d.group === "boundaries") {
      const name = firstProp(f, ["name", "kecamatan_name", "kab_kota_name"]);
      if (name) parts.push(row(d.label, name));
      continue;
    }

    if (d.group === "population") {
      const pop = Number(f.properties?.population);
      if (Number.isFinite(pop)) {
        parts.push(row("Population (hex)", `${NUM.format(Math.round(pop))}`));
      }
      continue;
    }

    // The gazetted estate carries its class as a bare KUGI code and "-" in
    // namobj, so the generic name lookup below would render it as "yes".
    if (layerId === "forest-estate") {
      const meta = forestClassMeta(forestClassOf(f.properties?.fungsitap));
      const sk = firstProp(f, ["nosktap"]);
      parts.push(
        row(
          "Kawasan hutan",
          meta?.label ?? "kawasan hutan",
          [firstProp(f, ["nkws"]), sk].filter(Boolean).join(" · "),
        ),
      );
      continue;
    }

    const fields = GFW_POPUP_FIELDS[layerId];
    const name = firstProp(f, [
      fields?.name,
      "conc_name",
      "name",
      "company",
      // KLHK social forestry: the permit holder is the village institution or
      // the farmer group, not a `name` column.
      "nama_ld",
      "nama_kelompok",
      "namobj",
    ]);
    const sub = firstProp(f, [
      fields?.sub,
      "company",
      "comp_group",
      "nama_kab",
      "nama_desa",
    ]);
    const areaRaw = Number(f.properties?.[fields?.area ?? "gfw_area__ha"]);
    const area = Number.isFinite(areaRaw)
      ? `${NUM.format(Math.round(areaRaw))} ha`
      : null;
    parts.push(
      row(d.label, name ?? "yes", [sub, area].filter(Boolean).join(" · ")),
    );
  }

  if (!parts.length) return null;
  return `<div class="hz-popup">${parts.join("")}</div>`;
}
