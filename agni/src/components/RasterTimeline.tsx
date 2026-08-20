/** Date slider for the dated raster layers.
 *
 *  MODIS true colour and MODIS Aqua AOD are daily products, and Copernicus
 *  burnt area is daily too — all three carry a date in their tile URL, so one
 *  slider steps them together rather than each growing its own control.
 *
 *  It only appears while one of those layers is on, the same way the CAMS
 *  timeline appears with the haze layers. The two sit at different heights so
 *  both can be open at once. */

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useLayersStore } from "../store/layers";

/** Layers whose tiles are dated and follow this slider. Night lights is a
 *  static 2016 composite and deliberately not among them. */
const DATED_LAYERS = ["haze-aod", "haze-smoke", "burnt-area"];

/** How far back the slider reaches. MODIS true colour keeps roughly nine
 *  months and AOD several years, but a fire dashboard is asking "what did this
 *  look like last week", and a longer track makes single days hard to hit. */
const MAX_DAYS = 30;

const stamp = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

export default function RasterTimeline() {
  const visibility = useLayersStore((s) => s.visibility);
  const offset = useLayersStore((s) => s.rasterDayOffset);
  const setOffset = useLayersStore((s) => s.setRasterDayOffset);
  const camsActive = useLayersStore(
    (s) => s.visibility["haze-cams-smoke"] || s.visibility["haze-cams-pm25"],
  );

  const active = DATED_LAYERS.some((id) => visibility[id]);
  if (!active) return null;

  const day = new Date();
  day.setUTCDate(day.getUTCDate() - offset);

  return (
    <div
      className={`pointer-events-auto absolute left-1/2 z-10 w-[min(560px,calc(100%-1rem))] -translate-x-1/2 rounded-xl border border-ink-700/60 bg-ink-900/85 px-3 py-2 shadow-2xl backdrop-blur ${
        // clear the CAMS timeline when both are showing
        camsActive ? "bottom-[15rem] md:bottom-44" : "bottom-[11rem] md:bottom-28"
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous day"
          disabled={offset >= MAX_DAYS}
          onClick={() => setOffset(offset + 1)}
          className="rounded-md p-1 text-ink-300 hover:bg-ink-700/50 hover:text-ink-100 disabled:opacity-30"
        >
          <CaretLeft size={14} weight="bold" />
        </button>
        <button
          type="button"
          aria-label="Next day"
          disabled={offset <= 0}
          onClick={() => setOffset(offset - 1)}
          className="rounded-md p-1 text-ink-300 hover:bg-ink-700/50 hover:text-ink-100 disabled:opacity-30"
        >
          <CaretRight size={14} weight="bold" />
        </button>
        {/* Reversed: dragging right moves forward in time, which is what the
            left-to-right track implies. */}
        <input
          type="range"
          min={0}
          max={MAX_DAYS}
          step={1}
          value={MAX_DAYS - offset}
          onChange={(e) => setOffset(MAX_DAYS - Number(e.target.value))}
          className="agni-slider flex-1"
          aria-label="Imagery date"
        />
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="font-display text-xs font-semibold text-ink-100">
          {stamp.format(day)} UTC
        </span>
        <span className="text-[10px] uppercase tracking-widest text-ink-400">
          {offset === 0 ? "latest" : `${offset} d ago`}
        </span>
      </div>
    </div>
  );
}
