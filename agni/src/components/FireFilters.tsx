/** The one filter row, sitting above everything it scopes.
 *
 *  Not a per-layer control: this slice drives the map layers, the KPI cards and
 *  every chart in the rail at once, so the three can never disagree about which
 *  detections are in scope. Filtering happens through a MapLibre filter
 *  expression, so the whole five-day set stays loaded and a change is a
 *  repaint, not a refetch. */

import { useLayersStore } from "../store/layers";

const WINDOWS = [6, 12, 24, 48, 120];

function Chip({
  on,
  onClick,
  children,
  title,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
        on
          ? "bg-fire-400/20 text-fire-300"
          : "bg-ink-800 text-ink-400 hover:text-ink-200"
      }`}
    >
      {children}
    </button>
  );
}

export default function FireFilters() {
  const f = useLayersStore((s) => s.fireFilters);
  const set = useLayersStore((s) => s.setFireFilters);

  // Reads the live store rather than the value captured at render: two chips
  // toggled in the same tick would otherwise both compute from the same stale
  // array and the second would undo the first.
  const toggle = (key: "confidence" | "daynight", value: string) => {
    const cur = useLayersStore.getState().fireFilters[key];
    const next = cur.includes(value)
      ? cur.filter((v) => v !== value)
      : [...cur, value];
    // Never let the last class be switched off — an empty set silently blanks
    // the map and every chart with no way to tell why.
    if (next.length) set({ [key]: next });
  };

  return (
    <div className="space-y-1.5 px-3 py-2">
      <div className="flex items-center gap-1">
        <span className="w-[46px] shrink-0 text-[9px] uppercase tracking-widest text-ink-400">
          Window
        </span>
        {WINDOWS.map((h) => (
          <Chip key={h} on={f.hours === h} onClick={() => set({ hours: h })}>
            {h}h
          </Chip>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <span className="w-[46px] shrink-0 text-[9px] uppercase tracking-widest text-ink-400">
          Conf.
        </span>
        <Chip
          on={f.confidence.includes("l")}
          onClick={() => toggle("confidence", "l")}
          title="low confidence"
        >
          low
        </Chip>
        <Chip
          on={f.confidence.includes("n")}
          onClick={() => toggle("confidence", "n")}
          title="nominal confidence"
        >
          nominal
        </Chip>
        <Chip
          on={f.confidence.includes("h")}
          onClick={() => toggle("confidence", "h")}
          title="high confidence"
        >
          high
        </Chip>
        <span className="ml-1 w-px self-stretch bg-ink-700" />
        <Chip
          on={f.daynight.includes("D")}
          onClick={() => toggle("daynight", "D")}
          title="daytime overpass"
        >
          day
        </Chip>
        <Chip
          on={f.daynight.includes("N")}
          onClick={() => toggle("daynight", "N")}
          title="night overpass"
        >
          night
        </Chip>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-[46px] shrink-0 text-[9px] uppercase tracking-widest text-ink-400">
          Min FRP
        </span>
        <input
          type="range"
          min={0}
          max={50}
          step={1}
          value={f.minFrp}
          onChange={(e) => set({ minFrp: Number(e.target.value) })}
          className="agni-slider flex-1"
          aria-label="Minimum fire radiative power"
        />
        <span className="w-11 shrink-0 text-right text-[10px] tabular-nums text-ink-200">
          {f.minFrp} MW
        </span>
      </div>
    </div>
  );
}
