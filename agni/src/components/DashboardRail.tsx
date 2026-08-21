/** Collapsible right-hand rail: the charts that read the same slice the map is
 *  showing.
 *
 *  The map stays the hero. Everything here is derived from data already
 *  fetched, except the CAMS probe, which asks the WMS for numbers behind the
 *  pixels it is already drawing. */

import { useEffect, useMemo, useState } from "react";
import {
  CaretRight,
  ChartLine,
  Crosshair,
  Funnel,
  TreeEvergreen,
} from "@phosphor-icons/react";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { CAMS_LAYERS } from "../lib/config";
import { boundsOf, loadKabKota } from "../lib/geo";
import {
  applyFireFilters,
  dailyTrend,
  latestTimestamp,
  rollupByArea,
} from "../lib/analytics";
import { firesAreTagged, forestClassMeta, rollupByForest } from "../lib/forest";
import { probeCamsSeries, type ProbePoint as Series } from "../lib/camsProbe";
import { camsTimeSteps } from "../lib/cams";
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

  const areas = useMemo(() => (scoped ? rollupByArea(scoped) : null), [scoped]);

  // --- forest status --------------------------------------------------------
  // Only meaningful once the KLHK estate has been fetched and the detections
  // carry a `kawasan` tag; until then there is nothing honest to draw, so the
  // section offers to load it instead of showing an empty chart.
  const forestReady = useLayersStore((st) => st.forestFeatureCount) > 0;
  const forestOn = useLayersStore((st) => Boolean(st.visibility["forest-estate"]));
  const forestStatus = useLayersStore((st) => st.availability["forest-estate"]);
  const toggleLayer = useLayersStore((st) => st.toggleLayer);
  // Tagging is checked on the store's set, not on `scoped`: applyFireFilters
  // hands back a fresh array of the same feature objects, and the guard is
  // keyed on the array.
  const tagged = firesAreTagged(fires) && forestReady;
  // Scoped by everything *except* the forest filter, the way the trend chart
  // ignores the time window: a facet that filtered itself would collapse to the
  // one bar you just clicked, leaving no way to move to another class and no
  // denominator for the percentage above it.
  const forest = useMemo(
    () =>
      fires && tagged
        ? rollupByForest(
            applyFireFilters(fires, { ...filters, forest: null }, latest),
          )
        : null,
    [fires, tagged, filters, latest],
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
  const camsIndex = useLayersStore((s) => s.camsIndex);
  const setCamsSteps = useLayersStore((s) => s.setCamsSteps);

  // The forecast charts need the time dimension whether or not a CAMS *layer*
  // is switched on. Leaving that to CamsTimeline — which only fetches while one
  // is visible — meant clicking the map with the haze layers off left both
  // charts saying "loading…" forever, because the probe had no steps to walk.
  //
  // Fetched when the rail mounts rather than on the click that needs it: the
  // capabilities document is 600 kB of XML, and paying for it inside the click
  // put ~4 s in front of the first line being drawn. It is cached in lib/cams,
  // so CamsTimeline shares this one fetch.
  useEffect(() => {
    if (camsSteps.length) return;
    let cancelled = false;
    camsTimeSteps(CAMS_LAYERS.bbaod.layer)
      .then((steps) => {
        if (!cancelled && steps.length) setCamsSteps(steps);
      })
      .catch((err) => console.warn("[agni] CAMS time steps failed", err));
    return () => {
      cancelled = true;
    };
  }, [camsSteps.length, setCamsSteps]);

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
    const PM = CAMS_LAYERS.pm25.layer;
    const BB = CAMS_LAYERS.bbaod.layer;
    const apply = (r: Record<string, Series[]>, done: boolean) => {
      if (cancelled) return;
      setSeries({ key: probeKey, pm25: r[PM] ?? [], smoke: r[BB] ?? [], done });
    };
    void probeCamsSeries(
      [PM, BB],
      probe.lon,
      probe.lat,
      camsSteps,
      // start at the step on screen, so the part being looked at fills first
      camsIndex,
      (r) => apply(r, false),
    ).then((r) => apply(r, true));
    return () => {
      cancelled = true;
    };
    // camsIndex only picks the starting point; re-probing as it scrubs would
    // restart the queue on every animation frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probe, camsSteps, probeKey]);

  // A result carries the point it was probed for, so a series left over from
  // the previous click is ignored rather than shown against the new one.
  const current = series?.key === probeKey ? series : null;
  const pm25 = current?.pm25 ?? [];
  const smoke = current?.smoke ?? [];
  const probing = !current?.done;

  const forecastFrom = useLayersStore((s) => s.camsForecastFrom);

  const setFilters = useLayersStore((s) => s.setFireFilters);

  /** Clicking a ranked bar both scopes the whole dashboard to that area and
   *  flies to it — the two together are what makes the chart a control rather
   *  than a readout. Clicking the active one again clears the scope. */
  const selectArea = (level: "provinsi" | "kabkota", name: string) => {
    const active = filters.area?.level === level && filters.area.name === name;
    setFilters({ area: active ? null : { level, name } });
    if (active) return;
    const map = getMapRef();
    if (!map || !kab) return;
    const b = boundsOf(
      kab,
      level === "provinsi" ? "provinsi_name" : "name",
      name,
    );
    if (b) map.fitBounds(b, { padding: 60, duration: 700 });
  };

  const scopeLabel = filters.day
    ? dayLabel.format(new Date(`${filters.day}T00:00:00Z`))
    : `Last ${filters.hours} h`;

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
        className="absolute right-3 top-14 z-10 hidden items-center gap-1.5 rounded-lg border border-ink-700/60 bg-ink-900/85 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-300 shadow-2xl backdrop-blur hover:text-ink-100 md:flex"
      >
        <ChartLine size={13} weight="duotone" className="text-fire-400" />
        Dashboard
      </button>
    );
  }

  return (
    <aside
      className="agni-scroll absolute z-20 space-y-2 overflow-y-auto border border-ink-700/60 bg-ink-900/95 p-2.5 shadow-2xl backdrop-blur md:bg-ink-900/85
        inset-x-2 bottom-[3.75rem] max-h-[62svh] rounded-xl
        md:inset-x-auto md:bottom-auto md:right-3 md:top-14 md:max-h-[calc(100%-140px)] md:w-80"
    >
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

      {(filters.area || filters.day || filters.forest !== null) && (
        <button
          type="button"
          onClick={() => setFilters({ area: null, day: null, forest: null })}
          className="flex w-full items-center gap-1.5 rounded-lg bg-fire-400/15 px-2.5 py-1.5 text-left text-[10px] text-fire-300 hover:bg-fire-400/25"
        >
          <Funnel size={12} weight="fill" className="shrink-0" />
          <span className="truncate font-medium">
            {[
              filters.area?.name,
              filters.day
                ? dayLabel.format(new Date(`${filters.day}T00:00:00Z`))
                : null,
              filters.forest === null
                ? null
                : (forestClassMeta(filters.forest)?.label ??
                  "Di luar kawasan hutan"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="ml-auto shrink-0 text-ink-300">clear ×</span>
        </button>
      )}

      <StatTile
        label="People near active fire"
        value={
          exposed === null
            ? "…"
            : exposed >= 1e6
              ? `${(exposed / 1e6).toFixed(1)} M`
              : exposed.toLocaleString()
        }
        definition={`Kontur population within ~${EXPOSURE_KM} km of a detection, over the ${
          filters.day ? "day" : `${filters.hours} h`
        } shown. A wider radius or window multiplies this several times over.`}
        tone={SERIES.fire}
      />

      {trend.length > 1 && (
        <LineChart
          title="Detections per day"
          subtitle={
            filters.day
              ? "Pinned to one day · click again to release"
              : `VIIRS SNPP, ${trend.length} days · click a day to pin it`
          }
          points={trend.map((d) => ({
            key: d.date,
            t: Date.parse(`${d.date}T00:00:00Z`),
            value: d.detections,
            label: dayLabel.format(new Date(`${d.date}T00:00:00Z`)),
          }))}
          color={SERIES.fire}
          unit="detections"
          height={140}
          // Fitted, not zero-anchored: the daily totals sit in a narrow band
          // well above zero, and anchoring flattens the very trend this chart
          // exists to show.
          baseline="fit"
          activeKey={filters.day}
          onSelect={(p) =>
            setFilters({ day: filters.day === p.key ? null : (p.key ?? null) })
          }
        />
      )}

      {areas && areas.provinces.length > 0 && (
        <BarChart
          title="Provinces by detections"
          subtitle={
            areas.unattributed
              ? `${scopeLabel} · ${areas.unattributed} offshore or unattributed`
              : scopeLabel
          }
          rows={areas.provinces.slice(0, 8).map((p) => ({
            name: p.name,
            value: p.detections,
            sub: `${p.frpMw.toLocaleString()} MW`,
          }))}
          color={SERIES.fire}
          unit="detections"
          onSelect={(row) => selectArea("provinsi", row.name)}
          activeName={filters.area?.level === "provinsi" ? filters.area.name : undefined}
        />
      )}

      {areas && areas.kabkota.length > 0 && (
        <BarChart
          title="Kabupaten by detections"
          subtitle={`${scopeLabel} · top 8 of ${areas.kabkota.length}`}
          rows={areas.kabkota.slice(0, 8).map((k) => ({
            name: k.name,
            province: k.province,
            value: k.detections,
            sub: k.province,
          }))}
          color={SERIES.fire}
          unit="detections"
          onSelect={(row) => selectArea("kabkota", row.name)}
          activeName={filters.area?.level === "kabkota" ? filters.area.name : undefined}
        />
      )}

      {forest && forest.rows.length > 0 ? (
        <>
          <StatTile
            label="Inside the forest estate"
            value={`${Math.round(
              (forest.inside / Math.max(1, forest.inside + forest.outside)) * 100,
            )} %`}
            definition={`${forest.inside.toLocaleString()} of ${(
              forest.inside + forest.outside
            ).toLocaleString()} detections fall inside gazetted kawasan hutan (KLHK penetapan). Land designated but not yet gazetted counts as outside.`}
            tone={SERIES.fire}
          />
          <BarChart
            title="Fires by forest status"
            subtitle={`${scopeLabel} · click a class to scope`}
            rows={forest.rows.map((r) => ({
              key: r.key,
              name: r.label,
              value: r.detections,
              sub: `${r.frpMw.toLocaleString()} MW`,
              color: r.color,
            }))}
            color={SERIES.fire}
            unit="detections"
            onSelect={(row) =>
              setFilters({
                forest:
                  filters.forest === (row.key ?? null) ? null : (row.key ?? null),
              })
            }
            activeName={filters.forest ?? undefined}
          />
        </>
      ) : (
        <div className="rounded-lg bg-ink-850/70 p-2.5">
          <p className="flex items-start gap-1.5 text-[10px] leading-snug text-ink-400">
            <TreeEvergreen size={13} className="mt-px shrink-0 text-fire-400" />
            Break the fires down by forest status — lindung, konservasi,
            produksi, or outside kawasan hutan altogether.
          </p>
          <button
            type="button"
            disabled={forestOn}
            onClick={() => toggleLayer("forest-estate")}
            className="mt-2 w-full rounded-md bg-fire-400/15 px-2 py-1.5 text-[10px] font-semibold text-fire-300 hover:bg-fire-400/25 disabled:cursor-progress disabled:text-ink-400"
          >
            {forestStatus === "unavailable"
              ? "KLHK service unreachable"
              : forestOn
                ? "Loading KLHK forest estate…"
                : "Load KLHK forest estate (12.9 MB)"}
          </button>
        </div>
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
