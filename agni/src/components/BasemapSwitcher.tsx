import { Globe } from "@phosphor-icons/react";
import { BASEMAPS } from "../layers/basemaps";
import { useLayersStore } from "../store/layers";

export default function BasemapSwitcher() {
  const basemap = useLayersStore((s) => s.basemap);
  const setBasemap = useLayersStore((s) => s.setBasemap);

  return (
    <div className="absolute right-2 top-2 md:right-3 md:top-3 flex items-center gap-1 rounded-xl border border-ink-700/60 bg-ink-900/85 p-1 shadow-2xl backdrop-blur">
      <Globe size={14} className="mx-1.5 text-ink-300" weight="duotone" />
      {BASEMAPS.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => setBasemap(b.id)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            basemap === b.id
              ? "bg-fire-400/15 text-fire-300"
              : "text-ink-300 hover:bg-ink-700/50 hover:text-ink-100"
          }`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
