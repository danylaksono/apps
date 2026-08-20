import { useEffect, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "@phosphor-icons/react";
import { CAMS_LAYER_IDS, CAMS_SOURCES } from "../layers/cams";
import { camsImageUrl, camsTimeSteps, prefetchCamsFrame } from "../lib/cams";
import { CAMS_LAYERS } from "../lib/config";
import { useLayersStore } from "../store/layers";

/** Minimum time a frame stays on screen once it is ready. The data is
 *  3-hourly, so this is about legibility, not smoothness. */
const MIN_FRAME_MS = 450;

/** Stop waiting on a frame that is taking too long and show the next one
 *  anyway, so one slow render cannot wedge playback. */
const FRAME_WAIT_MS = 6000;

/** How many frames to render ahead of the one on screen. ECMWF renders on
 *  demand at well over a second a frame, so without a lookahead playback can
 *  never beat that; with three in flight the queue stays ahead of MIN_FRAME_MS
 *  and the run plays at a steady rate. */
const LOOKAHEAD = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const stamp = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  // Indonesia spans WIB/WITA/WIT. One reference clock is far easier to read
  // than three on a national timeline, so use WIB and label it — the same
  // convention BMKG uses for national products.
  timeZone: "Asia/Jakarta",
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
      .catch((err) => console.warn("[agni] CAMS time steps failed", err));
    return () => {
      cancelled = true;
    };
  }, [active, steps.length, setCamsSteps]);

  // Playback, gated on the frame actually being ready rather than on a timer:
  // see prefetchCamsFrame for why a plain interval cancels most of its frames.
  const visibleKey = CAMS_LAYER_IDS.filter((id) => visibility[id]).join(",");
  useEffect(() => {
    if (!playing || !active || steps.length < 2) return;
    let cancelled = false;

    const framesAt = (time: string | undefined) =>
      time
        ? CAMS_LAYER_IDS.filter((id) => CAMS_SOURCES[id])
            .filter((id) => useLayersStore.getState().visibility[id])
            .map((id) =>
              camsImageUrl(
                CAMS_SOURCES[id].layer,
                CAMS_SOURCES[id].style,
                time,
              ),
            )
        : [];
    const warm = (time: string | undefined) =>
      Promise.all(framesAt(time).map(prefetchCamsFrame));

    void (async () => {
      while (!cancelled) {
        const { camsIndex, camsSteps } = useLayersStore.getState();
        const next = (camsIndex + 1) % camsSteps.length;
        await Promise.race([warm(camsSteps[next]), sleep(FRAME_WAIT_MS)]);
        if (cancelled) return;

        useLayersStore.getState().setCamsIndex(next);
        // keep the queue full while this frame is on screen
        for (let i = 1; i <= LOOKAHEAD; i++) {
          void warm(camsSteps[(next + i) % camsSteps.length]);
        }
        await sleep(MIN_FRAME_MS);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playing, active, steps.length, visibleKey]);

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
          className="agni-slider flex-1"
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
