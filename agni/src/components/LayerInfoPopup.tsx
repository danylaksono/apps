/** The (i) beside a layer name, and the provenance popup behind it.
 *
 *  The popup is portalled to `document.body` and positioned `fixed`. It has to
 *  be: the layer panel is `overflow-y-auto`, so anything absolutely positioned
 *  inside a row is clipped at the panel's edge, and the card is taller than most
 *  rows. Escaping the panel means the position has to be computed by hand
 *  against the anchor's viewport rect, and re-computed whenever the panel
 *  scrolls or the window resizes — that is what the layout effect below does.
 *
 *  Only one can be open at a time, which is why `open` is controlled: the panel
 *  holds the id of the row whose popup is showing. Two of these floating over
 *  each other would be unreadable, and neither would be dismissable by the
 *  outside-click rule without closing the other. */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ArrowSquareOut, Info, X } from "@phosphor-icons/react";
import type { LayerInfo } from "../layers/registry";

/** Field order is the reading order: what it is, how fine, how fresh, how much
 *  of the country, then how it arrives. The caveat is last and styled apart —
 *  it is the part that changes what you are allowed to conclude. */
const FIELDS: { key: keyof LayerInfo; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "resolution", label: "Resolution" },
  { key: "updated", label: "Updated" },
  { key: "coverage", label: "Coverage" },
  { key: "api", label: "Access" },
  { key: "format", label: "Format" },
];

/** Breathing room from the anchor and from every viewport edge. */
const GAP = 8;
const WIDTH = 320;

/** Strip the scheme so a long endpoint reads as a hostname and path. */
function linkLabel(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

interface Placement {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

export default function LayerInfoPopup({
  info,
  label,
  open,
  onOpen,
  onClose,
}: {
  info: LayerInfo;
  label: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={open ? onClose : onOpen}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`About the ${label} dataset`}
        title="About this dataset"
        className={`shrink-0 rounded p-0.5 transition-colors hover:bg-ink-700/50 hover:text-ink-100 ${
          open ? "text-fire-300" : "text-ink-500"
        }`}
      >
        <Info size={13} weight={open ? "fill" : "regular"} />
      </button>
      {open && (
        <Popup
          id={panelId}
          info={info}
          label={label}
          anchorRef={anchorRef}
          onClose={onClose}
        />
      )}
    </>
  );
}

function Popup({
  id,
  info,
  label,
  anchorRef,
  onClose,
}: {
  id: string;
  info: LayerInfo;
  label: string;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Placement | null>(null);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const el = ref.current;
    if (!anchor || !el) return;
    const a = anchor.getBoundingClientRect();
    // The anchor lives in a scrolling panel. Once it has scrolled out of the
    // viewport the popup is pointing at nothing, so it goes with it.
    if (a.bottom < 0 || a.top > window.innerHeight) {
      onClose();
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(WIDTH, vw - 2 * GAP);
    const maxHeight = vh - 2 * GAP;

    // Horizontally it clears the whole panel, not just the (i): measuring from
    // the button would leave the card sitting on the panel's right border,
    // since the button is inset from it. Vertically it still tracks the row.
    const host = (anchor.closest("aside") ?? anchor).getBoundingClientRect();

    // Beside the panel by preference, flipped to its other side when that
    // would run off. On a phone both fail and it lands flush against the left
    // edge at nearly full width, which is the right answer there anyway.
    let left = host.right + GAP;
    if (left + width > vw - GAP) left = host.left - GAP - width;
    left = Math.max(GAP, Math.min(left, vw - GAP - width));

    // Top-aligned to its row, then pulled back inside the viewport.
    const height = Math.min(el.offsetHeight, maxHeight);
    const top = Math.max(GAP, Math.min(a.top - GAP, vh - GAP - height));

    // Returning `prev` unchanged is what keeps this safe to call from an effect
    // that re-runs on every render: React bails out of a state update that
    // changes nothing, so there is no loop even if `onClose` is not stable.
    setPlace((prev) =>
      prev &&
      prev.left === left &&
      prev.top === top &&
      prev.width === width &&
      prev.maxHeight === maxHeight
        ? prev
        : { left, top, width, maxHeight },
    );
  }, [anchorRef, onClose]);

  useLayoutEffect(() => {
    // Twice: the first pass measures the card at its default width with no
    // height cap, and applying the real width and maxHeight changes how tall it
    // is. The second pass places the card that is actually on screen.
    reposition();
    const settle = requestAnimationFrame(reposition);
    // Capture phase, so the layer panel's own scroll is caught as well as the
    // window's — a scroll event on an inner element does not bubble.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      cancelAnimationFrame(settle);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [reposition]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      // The anchor toggles itself; closing here too would immediately reopen.
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [anchorRef, onClose]);

  // Focus moves in so Escape and Tab land somewhere sensible, and returns to
  // the (i) on close — but only if it is still inside the popup, so a click
  // that opened something else is not yanked back.
  useEffect(() => {
    const el = ref.current;
    const anchor = anchorRef.current;
    el?.focus({ preventScroll: true });
    return () => {
      if (el?.contains(document.activeElement)) {
        anchor?.focus({ preventScroll: true });
      }
    };
  }, [anchorRef]);

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-label={`${label} — dataset details`}
      tabIndex={-1}
      style={{
        left: place?.left ?? -9999,
        top: place?.top ?? 0,
        width: place?.width ?? WIDTH,
        maxHeight: place?.maxHeight,
      }}
      className="agni-scroll fixed z-40 overflow-y-auto rounded-xl border border-ink-700/60 bg-ink-900/95 shadow-2xl backdrop-blur focus:outline-none"
    >
      <div className="flex items-start gap-2 border-b border-ink-700/60 px-3 py-2">
        <p className="min-w-0 flex-1 text-[11px] font-semibold leading-snug text-ink-100">
          {label}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dataset details"
          className="shrink-0 rounded p-0.5 text-ink-400 hover:bg-ink-700/50 hover:text-ink-100"
        >
          <X size={12} weight="bold" />
        </button>
      </div>
      <div className="px-3 py-2.5">
        <dl className="space-y-1.5">
          {FIELDS.map(({ key, label: fieldLabel }) => {
            const value = info[key];
            if (!value) return null;
            return (
              <div key={key}>
                <dt className="text-[9px] uppercase tracking-widest text-ink-400">
                  {fieldLabel}
                </dt>
                <dd className="text-[11px] leading-snug text-ink-200">
                  {value}
                </dd>
                {/* The request itself, under the prose that explains it.
                    Monospaced and selectable so it can be copied and run;
                    `break-all` because these are long and unbroken, and the
                    card must not widen to fit one. */}
                {key === "api" && info.endpoint && (
                  <dd className="mt-1 select-all break-all rounded bg-ink-950/60 px-1.5 py-1 font-mono text-[10px] leading-relaxed text-ink-300">
                    {info.endpoint}
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
        {info.caveat && (
          <p className="mt-2 border-t border-ink-700/60 pt-2 text-[11px] leading-snug text-fire-200/80">
            {info.caveat}
          </p>
        )}
        {info.link && (
          <a
            href={info.link}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 flex items-center gap-1 break-all text-[10px] text-ink-400 hover:text-fire-300"
          >
            <ArrowSquareOut size={11} weight="bold" className="shrink-0" />
            {linkLabel(info.link)}
          </a>
        )}
      </div>
    </div>,
    document.body,
  );
}
