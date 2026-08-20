/** Collapsible right-hand rail: the charts that read the same slice the map is
 *  showing.
 *
 *  The map stays the hero. Everything here is derived from data already
 *  fetched, except the CAMS probe, which asks the WMS for numbers behind the
 *  pixels it is already drawing. */

import { useEffect, useMemo, useState } from "react";
import { CaretRight, ChartLine, Crosshair } from "@phosphor-icons/react";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { CAMS_LAYERS } from "../lib/config";
import { loadKabKota } from "../lib/geo";
import {
  applyFireFilters,
  dailyTrend,
  latestTimestamp,
  rollupByArea,
} from "../lib/analytics";
import { probeCamsSeries, type ProbePoint as Series } from "../lib/camsProbe";
import { exposedPopulation } from "../lib/population";
import { getMapRef } from "../lib/mapRef";
import { useLayersStore } from "../store/layers";
import { BarChart, LineChart, StatTile } from "./charts";
import { SERIES, type LinePoint } from "../lib/chartTokens";

/** Radius used by the exposure figure. Deliberately tight: the same data at
 *  5 km over 5 days reaches 84 M, which says more about Java's density than
 *  about this fire season. The definition is printed on the tile. */
const EXPOSURE_KM = 2;

const dayLabel = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Jakarta",
});
const stepLabel = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  timeZone: "Asia/Jakarta",
});

type PolyFC = FeatureCollection<Polygon | MultiPolygon>;

/** Bounding box of every polygon whose `prop` equals `value`. Provinces are
 *  many kab/kota, so this unions them rather than taking the first hit. */
function boundsOf(
  kab: PolyFC,
  prop: "name" | "provinsi_name",
  value: string,
): [number, number, number, number] | null {
  let w = 180;
  let s = 90;
  let e = -180;
  let n = -90;
  let found = false;
  for (const f of kab.features) {
    if (String((f.properties as Record<string, unknown>)?.[prop]) !== value) {
      continue;
    }
    found = true;
    const g = f.geometry;
    const rings =
      g.type === "Polygon" ? g.coordinates : g.coordinates.flat();
    for (const ring of rings) {
      for (const [lon, lat] of ring) {
        if (lon < w) w = lon;
        if (lon > e) e = lon;
        if (lat < s) s = lat;
        if (lat > n) n = lat;
      }
    }
  }
  return found ? [w, s, e, n] : null;
}

export default function DashboardRail() {
  const open = useLayersStore((s) => s.railOpen);
  const setOpen = useLayersStore((s) => s.setRailOpen);
  const fires = useLayersStore((s) => s.firesGeojson);
  const filters = useLayersStore((s) => s.fireFilters);
  const probe = useLayersStore((s) => s.probePoint);
  const camsSteps = useLayersStore((s) => s.camsSteps);

  const [kab, setKab] = useState<PolyFC | null>(null);
  useEffect(() => {
    loadKabKota()
      .then((fc: PolyFC) => setKab(fc))
      .catch(() => setKab(null));
  }, []);

  const latest = useMemo(() => (fires ? latestTimestamp(fires) : 0), [fires]);

  // The trend is deliberately NOT filtered by the time window — it is the
  // thing that shows the window in context.
  const trend = useMemo(() => (fires ? dailyTrend(fires) : []), [fires]);

  const scoped = useMemo(
    () => (fires ? applyFireFilters(fires, filters, latest) : null),
    [fires, filters, latest],
  );

  const areas = useMemo(
    () => (scoped && kab ? rollupByArea(scoped, kab) : null),
    [scoped, kab],
  );

  // --- exposure -----------------------------------------------------------
  // Results carry the scope they were computed for, so a stale answer is
  // ignored during render rather than cleared by a setState inside the effect.
  const scopeKey = `${latest}|${filters.hours}|${filters.minFrp}|${filters.confidence.join("")}|${filters.daynight.join("")}`;
  const [exposure, setExposure] = useState<{ key: string; value: number } | null>(
    null,
  );
  useEffect(() => {
    if (!scoped) return;
    let cancelled = false;
    exposedPopulation(scoped, EXPOSURE_KM)
      .then((n) => !cancelled && setExposure({ key: scopeKey, value: n }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // scopeKey is what actually identifies the slice; scoped is derived from it
  }, [scoped, scopeKey]);
  const exposed = exposure?.key === scopeKey ? exposure.value : null;

  // --- CAMS probe ---------------------------------------------------------
  const probeKey = probe ? `${probe.lon.toFixed(3)},${probe.lat.toFixed(3)}` : "";
  const [series, setSeries] = useState<{
    key: string;
    pm25: Series[];
    smoke: Series[];
    done: boolean;
  } | null>(null);

  useEffect(() => {
    if (!probe || !camsSteps.length) return;
    let cancelled = false;
    const partial = { pm25: [] as Series[], smoke: [] as Series[] };
    const push = (which: "pm25" | "smoke") => (pts: Series[]) => {
      if (cancelled) return;
      partial[which] = pts;
      setSeries({ key: probeKey, ...partial, done: false });
    };
    void Promise.all([
      probeCamsSeries(
        CAMS_LAYERS.pm25.layer,
        probe.lon,
        probe.lat,
        camsSteps,
        push("pm25"),
      ),
      probeCamsSeries(
        CAMS_LAYERS.bbaod.layer,
        probe.lon,
        probe.lat,
        camsSteps,
        push("smoke"),
      ),
    ]).then(([pm25, smoke]) => {
      if (!cancelled) setSeries({ key: probeKey, pm25, smoke, done: true });
    });
    return () => {
      cancelled = true;
    };
  }, [probe, camsSteps, probeKey]);

  const current = series?.key === probeKey ? series : null;
  const pm25 = current?.pm25 ?? [];
  const smoke = current?.smoke ?? [];
  const probing = !current?.done;

  const forecastFrom = useLayersStore((s) => s.camsForecastFrom);

  const zoomTo = (prop: "name" | "provinsi_name", value: string) => {
    const map = getMapRef();
    if (!map || !kab) return;
    const b = boundsOf(kab, prop, value);
    if (b) map.fitBounds(b, { padding: 60, duration: 700 });
  };

  const toPoints = (rows: Series[]): LinePoint[] =>
    rows.map((r) => ({
      t: Date.parse(r.time),
      value: r.value,
      label: stepLabel.format(new Date(r.time)),
    }));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open dashboard"
        className="absolute right-3 top-14 z-10 flex items-center gap-1.5 rounded-lg border border-ink-700/60 bg-ink-900/85 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-300 shadow-2xl backdrop-blur hover:text-ink-100"
      >
        <ChartLine size={13} weight="duotone" className="text-fire-400" />
        Dashboard
      </button>
    );
  }

  return (
    <aside className="agni-scroll absolute right-3 top-14 z-10 max-h-[calc(100%-140px)] w-80 space-y-2 overflow-y-auto rounded-xl border border-ink-700/60 bg-ink-900/85 p-2.5 shadow-2xl backdrop-blur">
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-300">
          <ChartLine size={13} weight="duotone" className="text-fire-400" />
          Situation
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Collapse dashboard"
          className="rounded p-0.5 text-ink-400 hover:bg-ink-700/50 hover:text-ink-100"
        >
          <CaretRight size={14} weight="bold" />
        </button>
      </header>

      <StatTile
        label="People near active fire"
        value={
          exposed === null
            ? "…"
            : exposed >= 1e6
              ? `${(exposed / 1e6).toFixed(1)} M`
              : exposed.toLocaleString()
        }
        definition={`Kontur population within ~${EXPOSURE_KM} km of a detection, over the ${filters.hours} h shown. A wider radius or window multiplies this several times over.`}
        tone={SERIES.fire}
      />

      {trend.length > 1 && (
        <LineChart
          title="Detections per day"
          subtitle={`VIIRS SNPP, ${trend.length} days · unfiltered, for context`}
          points={trend.map((d) => ({
            t: Date.parse(`${d.date}T00:00:00Z`),
            value: d.detections,
            label: dayLabel.format(new Date(`${d.date}T00:00:00Z`)),
          }))}
          color={SERIES.fire}
          unit="detections"
        />
      )}

      {areas && areas.provinces.length > 0 && (
        <BarChart
          title="Provinces by detections"
          subtitle={
            areas.unattributed
              ? `Last ${filters.hours} h · ${areas.unattributed} offshore or unattributed`
              : `Last ${filters.hours} h`
          }
          rows={areas.provinces.slice(0, 8).map((p) => ({
            name: p.name,
            value: p.detections,
            sub: `${p.frpMw.toLocaleString()} MW`,
          }))}
          color={SERIES.fire}
          unit="detections"
          onSelect={(row) => zoomTo("provinsi_name", row.name)}
        />
      )}

      {areas && areas.kabkota.length > 0 && (
        <BarChart
          title="Kabupaten by detections"
          subtitle={`Last ${filters.hours} h · top 8 of ${areas.kabkota.length}`}
          rows={areas.kabkota.slice(0, 8).map((k) => ({
            name: k.name,
            province: k.province,
            value: k.detections,
            sub: k.province,
          }))}
          color={SERIES.fire}
          unit="detections"
          onSelect={(row) => zoomTo("name", row.name)}
        />
      )}

      {probe ? (
        <>
          <LineChart
            title="Surface PM2.5 forecast"
            subtitle={`CAMS at ${probe.lat.toFixed(2)}, ${probe.lon.toFixed(2)}${
              probing ? " · loading…" : ""
            }`}
            points={toPoints(pm25)}
            color={SERIES.pm25}
            unit="µg/m³"
            forecastFrom={forecastFrom}
            thresholds={[
              { value: 55.4, label: "tidak sehat" },
              { value: 250.4, label: "berbahaya" },
            ]}
          />
          <LineChart
            title="Biomass-burning AOD forecast"
            subtitle="CAMS, same point · column smoke"
            points={toPoints(smoke)}
            color={SERIES.smoke}
            unit="AOD"
            forecastFrom={forecastFrom}
          />
        </>
      ) : (
        <p className="flex items-start gap-1.5 rounded-lg bg-ink-850/70 p-2.5 text-[10px] leading-snug text-ink-400">
          <Crosshair size={13} className="mt-px shrink-0 text-fire-400" />
          Click the map to read the CAMS PM2.5 and smoke forecast for that spot.
        </p>
      )}
    </aside>
  );
}
