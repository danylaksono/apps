import { useEffect, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "@phosphor-icons/react";
import { CAMS_LAYER_IDS } from "../layers/cams";
import { camsTimeSteps } from "../lib/cams";
import { CAMS_LAYERS } from "../lib/config";
import { useLayersStore } from "../store/layers";

/** ms per frame while playing — slow enough that each render can arrive. */
const FRAME_MS = 900;

const stamp = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Pontianak", // WIB — local time for Kalimantan
});

export default function CamsTimeline() {
  const visibility = useLayersStore((s) => s.visibility);
  const steps = useLayersStore((s) => s.camsSteps);
  const index = useLayersStore((s) => s.camsIndex);
  const playing = useLayersStore((s) => s.camsPlaying);
  const setCamsSteps = useLayersStore((s) => s.setCamsSteps);
  const setCamsIndex = useLayersStore((s) => s.setCamsIndex);
  const setCamsPlaying = useLayersStore((s) => s.setCamsPlaying);

  const active = CAMS_LAYER_IDS.some((id) => visibility[id]);
  // Captured when the steps arrive rather than read during render: the
  // analysis/forecast boundary is fixed for a given CAMS run.
  const [forecastFrom, setForecastFrom] = useState<number | null>(null);

  // load the time dimension the first time a CAMS layer is switched on
  useEffect(() => {
    if (!active || steps.length) return;
    let cancelled = false;
    camsTimeSteps(CAMS_LAYERS.bbaod.layer)
      .then((s) => {
        if (cancelled || !s.length) return;
        setCamsSteps(s);
        const now = Date.now();
        const boundary = s.findIndex((t) => Date.parse(t) > now);
        setForecastFrom(boundary === -1 ? s.length : boundary);
      })
      .catch((err) => console.warn("[hazer] CAMS time steps failed", err));
    return () => {
      cancelled = true;
    };
  }, [active, steps.length, setCamsSteps]);

  // playback
  useEffect(() => {
    if (!playing || !active || steps.length < 2) return;
    const t = setInterval(() => {
      const s = useLayersStore.getState();
      s.setCamsIndex((s.camsIndex + 1) % s.camsSteps.length);
    }, FRAME_MS);
    return () => clearInterval(t);
  }, [playing, active, steps.length]);

  // stop playing when the layers are switched off
  useEffect(() => {
    if (!active && playing) setCamsPlaying(false);
  }, [active, playing, setCamsPlaying]);

  if (!active) return null;

  const current = steps[index];
  const isForecast = forecastFrom !== null && index >= forecastFrom;

  return (
    <div className="pointer-events-auto absolute bottom-28 left-1/2 w-[min(560px,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-ink-700/60 bg-ink-900/85 px-3 py-2 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Step back"
          disabled={!steps.length}
          onClick={() =>
            setCamsIndex((index - 1 + steps.length) % steps.length)
          }
          className="rounded-md p-1 text-ink-300 hover:bg-ink-700/50 hover:text-ink-100 disabled:opacity-30"
        >
          <SkipBack size={14} weight="fill" />
        </button>
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          disabled={steps.length < 2}
          onClick={() => setCamsPlaying(!playing)}
          className="rounded-md bg-fire-400/15 p-1 text-fire-300 hover:bg-fire-400/25 disabled:opacity-30"
        >
          {playing ? (
            <Pause size={14} weight="fill" />
          ) : (
            <Play size={14} weight="fill" />
          )}
        </button>
        <button
          type="button"
          aria-label="Step forward"
          disabled={!steps.length}
          onClick={() => setCamsIndex((index + 1) % steps.length)}
          className="rounded-md p-1 text-ink-300 hover:bg-ink-700/50 hover:text-ink-100 disabled:opacity-30"
        >
          <SkipForward size={14} weight="fill" />
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(0, steps.length - 1)}
          step={1}
          value={index}
          disabled={!steps.length}
          onChange={(e) => setCamsIndex(Number(e.target.value))}
          className="hazer-slider flex-1"
          aria-label="CAMS forecast time"
        />
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="font-display text-xs font-semibold text-ink-100">
          {current ? `${stamp.format(new Date(current))} WIB` : "loading CAMS…"}
        </span>
        <span
          className={`text-[10px] uppercase tracking-widest ${
            isForecast ? "text-fire-300" : "text-ink-400"
          }`}
        >
          {steps.length
            ? isForecast
              ? "forecast"
              : "analysis"
            : "fetching time steps"}
        </span>
      </div>
    </div>
  );
}
