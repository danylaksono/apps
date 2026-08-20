import { useMemo } from "react";
import {
  CloudFog,
  Fire,
  MapTrifold,
  Plant,
  ShieldCheck,
  Tree,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import type { LayerDescriptor, LayerGroup } from "../layers/registry";
import { LAYERS } from "../layers/registry";
import { useLayersStore } from "../store/layers";

const GROUP_META: Record<LayerGroup, { label: string; icon: typeof Fire }> = {
  fire: { label: "Fire", icon: Fire },
  haze: { label: "Haze", icon: CloudFog },
  population: { label: "Population", icon: UsersThree },
  boundaries: { label: "Boundaries", icon: MapTrifold },
  peatland: { label: "Peatland", icon: Tree },
  concessions: { label: "Concessions", icon: Plant },
  protection: { label: "Protection status", icon: ShieldCheck },
};

function LayerRow({ d }: { d: LayerDescriptor }) {
  const visible = useLayersStore((s) => Boolean(s.visibility[d.id]));
  const opacity = useLayersStore((s) => s.opacity[d.id] ?? d.defaultOpacity);
  const availability = useLayersStore((s) => s.availability[d.id]);
  const reason = useLayersStore((s) => s.availabilityReason[d.id]);
  const toggleLayer = useLayersStore((s) => s.toggleLayer);
  const setOpacity = useLayersStore((s) => s.setOpacity);
  const unavailable = availability === "unavailable";

  return (
    <div className="group px-3 py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={visible}
          aria-label={d.label}
          disabled={unavailable}
          onClick={() => toggleLayer(d.id)}
          className={`h-4 w-7 shrink-0 rounded-full transition-colors ${
            visible && !unavailable ? "bg-fire-400" : "bg-ink-700"
          } relative disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <span
            className={`absolute top-0.5 h-3 w-3 rounded-full bg-ink-100 transition-all ${
              visible && !unavailable ? "left-3.5" : "left-0.5"
            }`}
          />
        </button>
        <span
          className={`text-sm font-medium ${
            unavailable ? "text-ink-400 line-through" : "text-ink-100"
          }`}
        >
          {d.label}
        </span>
        {unavailable && (
          <span
            className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-wide text-fire-300"
            title={reason}
          >
            <WarningCircle size={12} weight="fill" /> {reason ?? "unavailable"}
          </span>
        )}
      </div>
      <p className="mt-0.5 pl-9 text-[11px] leading-snug text-ink-400">
        {d.description}
      </p>
      {visible && !unavailable && (
        <div className="mt-1.5 pl-9">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(d.id, Number(e.target.value))}
            className="hazer-slider w-full"
            aria-label={`${d.label} opacity`}
          />
          {d.legend && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {d.legend.map((l) => (
                <span
                  key={l.label}
                  className="flex items-center gap-1 text-[10px] text-ink-300"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: l.color }}
                  />
                  {l.label}
                </span>
              ))}
            </div>
          )}
          {d.gradientLegend && (
            <div className="mt-1.5">
              <div
                className="h-1.5 w-full rounded-full"
                style={{ background: d.gradientLegend.css }}
              />
              <div className="mt-0.5 flex justify-between text-[10px] text-ink-400">
                <span>{d.gradientLegend.min}</span>
                <span>{d.gradientLegend.max}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LayerPanel() {
  const groups = useMemo(() => {
    const out: { group: LayerGroup; layers: LayerDescriptor[] }[] = [];
    for (const d of LAYERS) {
      const found = out.find((g) => g.group === d.group);
      if (found) found.layers.push(d);
      else out.push({ group: d.group, layers: [d] });
    }
    return out;
  }, []);

  return (
    <aside className="hazer-scroll absolute left-3 top-3 max-h-[calc(100%-120px)] w-72 overflow-y-auto rounded-xl border border-ink-700/60 bg-ink-900/85 shadow-2xl backdrop-blur">
      <div className="border-b border-ink-700/60 px-3 py-2.5">
        <h1 className="font-display text-sm font-bold tracking-wide text-ink-100">
          HAZER
        </h1>
        <p className="text-[10px] uppercase tracking-widest text-ink-400">
          Kalimantan fire & haze
        </p>
      </div>
      {groups.map(({ group, layers }) => {
        const Icon = GROUP_META[group].icon;
        return (
          <section key={group} className="border-b border-ink-700/40 py-1.5">
            <header className="flex items-center gap-1.5 px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-ink-300">
              <Icon size={13} weight="duotone" className="text-fire-400" />
              {GROUP_META[group].label}
            </header>
            {layers.map((d) => (
              <LayerRow key={d.id} d={d} />
            ))}
          </section>
        );
      })}
    </aside>
  );
}
