import { useEffect, useMemo, useState } from "react";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { computeKpi } from "../lib/kpi";
import { loadKabKota } from "../lib/geo";
import { applyFireFilters, latestTimestamp } from "../lib/analytics";
import { getPeatExtent } from "../lib/remoteLayers";
import { useLayersStore } from "../store/layers";

const fmt = new Intl.NumberFormat("en-US");

function value(v: number | null): string {
  return v === null ? "—" : fmt.format(v);
}

export default function KpiBar() {
  const allFires = useLayersStore((s) => s.firesGeojson);
  const firesStatus = useLayersStore((s) => s.firesStatus);
  const filters = useLayersStore((s) => s.fireFilters);

  // The KPI cards count exactly what the map draws and the charts plot. FIRMS
  // now returns the full 5-day window, so without this the headline number
  // would be five days of fires under a "last 24 h" label.
  const latest = useMemo(
    () => (allFires ? latestTimestamp(allFires) : 0),
    [allFires],
  );
  const fires = useMemo(
    () => (allFires ? applyFireFilters(allFires, filters, latest) : null),
    [allFires, filters, latest],
  );
  const [kab, setKab] = useState<FeatureCollection<
    Polygon | MultiPolygon
  > | null>(null);

  useEffect(() => {
    if (firesStatus !== "ok" || kab) return;
    let cancelled = false;
    // Already resolved by the time fires land — the clip fetches the same
    // promise — so this is a cache read, not a second download.
    loadKabKota()
      .then((fc: FeatureCollection<Polygon | MultiPolygon>) => {
        if (!cancelled) setKab(fc);
      })
      .catch((err: unknown) =>
        console.warn("[agni] kab/kota load failed", err),
      );
    return () => {
      cancelled = true;
    };
  }, [firesStatus, kab]);

  // peatFeatureCount changes when the peat polygons finish loading; that is
  // the signal to recompute, since getPeatExtent() itself is not reactive.
  const peatCount = useLayersStore((s) => s.peatFeatureCount);
  const kpi = useMemo(
    () => computeKpi(fires, kab, peatCount > 0 ? getPeatExtent() : null),
    [fires, kab, peatCount],
  );

  const cards: { label: string; value: string; hint: string }[] = [
    {
      label: "Active fires",
      value: firesStatus === "loading" ? "…" : value(kpi.fires),
      hint: `VIIRS SNPP · ${
        filters.day ? filters.day : `${filters.hours} h`
      } · Indonesia`,
    },
    {
      label: "Total FRP",
      value: kpi.frpMw === null ? "—" : `${value(kpi.frpMw)} MW`,
      hint: "radiative power",
    },
    {
      label: "Kabupaten affected",
      value:
        kpi.affectedKabKota === null
          ? "—"
          : `${value(kpi.affectedKabKota)} / 514`,
      hint: "with ≥1 detection",
    },
    {
      // BIG publishes peat for Kalimantan only — 146 polygons nationally, all
      // of them on Borneo. The share is therefore taken over Kalimantan
      // detections, not national ones, or it would shrink for no reason as the
      // rest of the country burns.
      label: "Fires on peat",
      value:
        kpi.peatFires === null
          ? "…"
          : `${value(kpi.peatFires)}${
              kpi.kalimantanFires
                ? ` · ${Math.round(
                    (kpi.peatFires / kpi.kalimantanFires) * 100,
                  )}%`
                : ""
            }`,
      hint: peatCount ? "of Kalimantan fires (BIG)" : "loading peat map…",
    },
  ];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[4.75rem] flex justify-center md:bottom-3">
      <div className="agni-scroll pointer-events-auto flex max-w-[calc(100%-1rem)] gap-2 overflow-x-auto rounded-xl border border-ink-700/60 bg-ink-900/85 p-2 shadow-2xl backdrop-blur">
        {cards.map((c) => (
          <div
            key={c.label}
            className="min-w-24 shrink-0 rounded-lg bg-ink-850/70 px-3 py-2 md:min-w-28"
          >
            <p className="text-[9px] font-semibold uppercase tracking-widest text-ink-400">
              {c.label}
            </p>
            <p className="font-display text-lg font-bold leading-tight text-ink-100">
              {c.value}
            </p>
            <p className="text-[9px] text-ink-400">{c.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
