import { useEffect, useMemo, useState } from "react";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { computeKpi, loadKecamatan } from "../lib/kpi";
import { getPeatExtent } from "../lib/peat";
import { useLayersStore } from "../store/layers";

const fmt = new Intl.NumberFormat("en-US");

function value(v: number | null): string {
  return v === null ? "—" : fmt.format(v);
}

export default function KpiBar() {
  const fires = useLayersStore((s) => s.firesGeojson);
  const firesStatus = useLayersStore((s) => s.firesStatus);
  const [kec, setKec] = useState<FeatureCollection<
    Polygon | MultiPolygon
  > | null>(null);

  useEffect(() => {
    if (firesStatus !== "ok" || kec) return;
    let cancelled = false;
    loadKecamatan()
      .then((fc) => {
        if (!cancelled) setKec(fc);
      })
      .catch((err) => console.warn("[agni] kecamatan load failed", err));
    return () => {
      cancelled = true;
    };
  }, [firesStatus, kec]);

  // peatFeatureCount changes when the peat polygons finish loading; that is
  // the signal to recompute, since getPeatExtent() itself is not reactive.
  const peatCount = useLayersStore((s) => s.peatFeatureCount);
  const kpi = useMemo(
    () => computeKpi(fires, kec, peatCount > 0 ? getPeatExtent() : null),
    [fires, kec, peatCount],
  );

  const cards: { label: string; value: string; hint: string }[] = [
    {
      label: "Active fires",
      value: firesStatus === "loading" ? "…" : value(kpi.fires),
      hint: "VIIRS SNPP · 48 h",
    },
    {
      label: "Total FRP",
      value: kpi.frpMw === null ? "—" : `${value(kpi.frpMw)} MW`,
      hint: "radiative power",
    },
    {
      label: "Kecamatan affected",
      value:
        kpi.affectedKecamatan === null
          ? "—"
          : `${value(kpi.affectedKecamatan)} / 628`,
      hint: "with ≥1 detection",
    },
    {
      label: "Fires on peat",
      value:
        kpi.peatFires === null
          ? "…"
          : `${value(kpi.peatFires)}${
              kpi.fires
                ? ` · ${Math.round((kpi.peatFires / kpi.fires) * 100)}%`
                : ""
            }`,
      hint: peatCount ? "on peat soil (BIG)" : "loading peat map…",
    },
  ];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
      <div className="pointer-events-auto flex gap-2 rounded-xl border border-ink-700/60 bg-ink-900/85 p-2 shadow-2xl backdrop-blur">
        {cards.map((c) => (
          <div
            key={c.label}
            className="min-w-28 rounded-lg bg-ink-850/70 px-3 py-2"
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
