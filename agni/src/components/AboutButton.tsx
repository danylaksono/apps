/** About: what this is, where the data comes from, who made it.
 *
 *  A centred dialog rather than a popover under the button. The button sits in
 *  the layer panel, which scrolls and carries `backdrop-blur` — that clips an
 *  absolutely positioned child, and because a backdrop filter establishes a
 *  containing block it would clip a `position: fixed` one too. So the dialog is
 *  portalled to the body, out of that context entirely, which also gives it
 *  somewhere sensible to go on a phone. */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GithubLogo, Info, Warning, X } from "@phosphor-icons/react";

/** Bumped when the disclaimer changes materially, so returning readers are
 *  shown it again rather than silently kept on the old wording. */
const SEEN_KEY = "agni.about.seen.v1";

/** localStorage throws in private mode and when storage is blocked, and a
 *  dialog that has been read is not worth breaking the app over. */
function seenBefore(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* nothing to do — it just opens again next time */
  }
}

const SOURCES = [
  ["Active fires", "NASA FIRMS (VIIRS SNPP)"],
  ["Haze & forecast", "Copernicus CAMS via ECMWF"],
  ["Imagery & aerosol", "NASA GIBS"],
  ["Burnt area", "Copernicus Land Monitoring Service"],
  ["Deforestation", "Hansen/UMD via Global Forest Watch"],
  ["Peat & fire hazard", "BIG SatuPeta"],
  ["Population", "Kontur"],
  ["Boundaries", "Batas Indikatif BIG"],
];

function Dialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="About Agni"
        // Stop the backdrop's dismiss handler firing for clicks inside.
        onClick={(e) => e.stopPropagation()}
        className="agni-scroll max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-xl border border-ink-700/60 bg-ink-900 p-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-sm font-bold text-ink-100">
              Agni — Indonesia fire &amp; haze
            </p>
            <p className="text-[10px] uppercase tracking-widest text-ink-400">
              Situation room
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close about"
            className="shrink-0 rounded p-0.5 text-ink-400 hover:bg-ink-700/50 hover:text-ink-100"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        <p className="mt-2.5 text-[11px] leading-relaxed text-ink-300">
          A situational map of forest and peatland fire: active detections, haze
          forecasts, burnt area, peat, population exposure and the land-tenure
          context behind them. Everything is fetched live from public, keyless
          APIs; there is no server and no database.
        </p>

        <div className="mt-3 rounded-lg border border-fire-400/25 bg-fire-400/10 p-2.5">
          <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-widest text-fire-300">
            <Warning size={12} weight="fill" />
            On accuracy
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-200">
            Fire detections are satellite <em>hotspots</em>, not confirmed
            fires. FIRMS reports thermal anomalies in near real time; confidence
            is exposed through the point styling and the filters, but nothing
            here is ground-truthed, and a detection can be a flare, a furnace or
            a false alarm.
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-200">
            Haze is model output, not measurement. A concession outline says
            where a permit applies, never who lit a fire. Treat everything here
            as a question worth asking rather than an answer.
          </p>
        </div>

        <p className="mt-3 text-[9px] font-semibold uppercase tracking-widest text-ink-400">
          Sources
        </p>
        <ul className="mt-1.5 space-y-1">
          {SOURCES.map(([what, who]) => (
            <li key={what} className="flex gap-2 text-[11px] leading-snug">
              <span className="w-[94px] shrink-0 text-ink-400">{what}</span>
              <span className="text-ink-200">{who}</span>
            </li>
          ))}
        </ul>

        <a
          href="https://github.com/danylaksono"
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3.5 flex items-center gap-2 rounded-md bg-ink-850 px-2.5 py-2 text-[11px] font-medium text-ink-200 hover:bg-ink-800 hover:text-ink-100"
        >
          <GithubLogo size={15} weight="fill" className="text-fire-400" />
          github.com/danylaksono
        </a>
      </div>
    </div>,
    document.body,
  );
}

export default function AboutButton() {
  // Opens itself on a first visit so the accuracy note is read once, then
  // never again unaided. Resolved during the first render rather than in an
  // effect: opening on a second pass makes the dialog flash in after the map.
  const [open, setOpen] = useState(() => !seenBefore());

  const close = () => {
    markSeen();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="About Agni"
        aria-expanded={open}
        className={`rounded p-0.5 transition-colors ${
          open ? "text-fire-300" : "text-ink-400 hover:text-ink-100"
        }`}
      >
        <Info size={14} weight="bold" />
      </button>
      {open && <Dialog onClose={close} />}
    </>
  );
}
