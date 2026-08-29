import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CaretDown,
  CaretLeft,
  CloudFog,
  Fire,
  MagnifyingGlass,
  MapPin,
  MapTrifold,
  Plant,
  PlugsConnected,
  ShieldCheck,
  Trash,
  Tree,
  TreeEvergreen,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import FireFilters from "./FireFilters";
import LayerInfoPopup from "./LayerInfoPopup";
import AboutButton from "./AboutButton";
import AddLayerButton from "./AddLayerButton";
import { getMapRef } from "../lib/mapRef";
import { loadKabKota, type PolyFC } from "../lib/geo";
import { searchAdmin, searchGeocoder, type PlaceHit } from "../lib/geocode";
import type {
  LayerDescriptor,
  LayerGroup,
  LegendItem,
} from "../layers/registry";
import { LAYERS } from "../layers/registry";
import { layerInfo } from "../layers/datasetInfo";
import { buildCustomLayer } from "../layers/custom";
import { useLayersStore } from "../store/layers";

const GROUP_META: Record<LayerGroup, { label: string; icon: typeof Fire }> = {
  fire: { label: "Fire", icon: Fire },
  haze: { label: "Haze", icon: CloudFog },
  population: { label: "Population", icon: UsersThree },
  boundaries: { label: "Boundaries", icon: MapTrifold },
  peatland: { label: "Peatland", icon: Tree },
  forest: { label: "Forest estate (KLHK)", icon: TreeEvergreen },
  concessions: { label: "Concessions", icon: Plant },
  protection: { label: "Protection status", icon: ShieldCheck },
  custom: { label: "Your layers", icon: PlugsConnected },
};

function LayerRow({
  d,
  infoOpen,
  onOpenInfo,
  onCloseInfo,
}: {
  d: LayerDescriptor;
  infoOpen: boolean;
  onOpenInfo: () => void;
  onCloseInfo: () => void;
}) {
  const visible = useLayersStore((s) => Boolean(s.visibility[d.id]));
  const opacity = useLayersStore((s) => s.opacity[d.id] ?? d.defaultOpacity);
  const availability = useLayersStore((s) => s.availability[d.id]);
  const reason = useLayersStore((s) => s.availabilityReason[d.id]);
  const toggleLayer = useLayersStore((s) => s.toggleLayer);
  const setOpacity = useLayersStore((s) => s.setOpacity);
  const mode = useLayersStore((s) => s.layerMode[d.id]);
  const setMode = useLayersStore((s) => s.setLayerMode);
  const unavailable = availability === "unavailable";

  // Provenance is independent of whether the layer is drawn: the reason to
  // open it is often to decide whether to switch the layer on at all, so the
  // (i) stays available even when the source is down.
  const info = layerInfo(d);

  // A server-rendered layer carries its symbology in the tiles, so its legend
  // has to be fetched. Done here rather than at add time so it costs nothing
  // until the layer is actually switched on, and is never persisted — the
  // swatches are base64 PNGs and would bloat localStorage.
  const [fetched, setFetched] = useState<LegendItem[] | null>(null);
  useEffect(() => {
    if (!visible || !d.asyncLegend || fetched) return;
    let cancelled = false;
    d.asyncLegend()
      .then((items) => !cancelled && setFetched(items))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [visible, d, fetched]);
  const legend = d.legend ?? fetched ?? undefined;

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
          className={`min-w-0 flex-1 truncate text-sm font-medium ${
            unavailable ? "text-ink-400 line-through" : "text-ink-100"
          }`}
        >
          {d.label}
        </span>
        {info && (
          <LayerInfoPopup
            info={info}
            label={d.label}
            open={infoOpen}
            onOpen={onOpenInfo}
            onClose={onCloseInfo}
          />
        )}
        {d.group === "custom" && (
          <button
            type="button"
            onClick={() => useLayersStore.getState().removeCustomLayer(d.id)}
            aria-label={`Remove ${d.label}`}
            title="Remove this layer"
            className="shrink-0 rounded p-0.5 text-ink-500 hover:bg-ink-700/50 hover:text-fire-300"
          >
            <Trash size={12} weight="bold" />
          </button>
        )}
        {(unavailable || (visible && reason)) && (
          <span
            className={`flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-wide ${
              unavailable ? "text-fire-300" : "text-ink-400"
            }`}
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
          {d.modes && d.modes.length > 1 && (
            <div
              role="group"
              aria-label={`${d.label} mode`}
              className="mb-1.5 flex gap-0.5 rounded-md bg-ink-850 p-0.5"
            >
              {d.modes.map((m) => {
                const on = (mode ?? d.modes![0].value) === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setMode(d.id, m.value)}
                    className={`flex-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      on
                        ? "bg-fire-400/20 text-fire-300"
                        : "text-ink-400 hover:text-ink-200"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-2">
            {d.sliderLabel && (
              <span className="w-[46px] shrink-0 text-[9px] uppercase tracking-widest text-ink-400">
                {d.sliderLabel}
              </span>
            )}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(d.id, Number(e.target.value))}
              className="agni-slider flex-1"
              aria-label={`${d.label} ${d.sliderLabel ?? "opacity"}`}
            />
          </div>
          {legend && legend.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {legend.map((l) => (
                <span
                  key={l.label}
                  className="flex items-center gap-1 text-[10px] text-ink-300"
                >
                  {l.swatch ? (
                    <img
                      src={l.swatch}
                      alt=""
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] object-cover"
                    />
                  ) : (
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: l.color }}
                    />
                  )}
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

/** Groups open on load. The rest collapse: 27 layers in one flat scroll buries
 *  the fire and haze layers people actually came for. "Your layers" is open
 *  because someone who added one wants to see it, not find it. */
const OPEN_BY_DEFAULT: LayerGroup[] = ["fire", "haze", "custom"];

export default function LayerPanel() {
  const open = useLayersStore((s) => s.layersOpen);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<LayerGroup>>(
    () =>
      new Set(
        (Object.keys(GROUP_META) as LayerGroup[]).filter(
          (g) => !OPEN_BY_DEFAULT.includes(g),
        ),
      ),
  );

  const q = query.trim().toLowerCase();

  // Which row's provenance popup is showing. Held here rather than per row so
  // opening one closes the last: they float over the panel, and two at once
  // would overlap into nonsense.
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  // Stable, so the popup's reposition listeners are not torn down and rebuilt
  // on every render of the panel.
  const closeInfo = useCallback(() => setOpenInfo(null), []);

  // The kab/kota polygons are already fetched to clip the fire layer, so this
  // is a cache read rather than a second download.
  const [kab, setKab] = useState<PolyFC | null>(null);
  useEffect(() => {
    loadKabKota()
      .then((fc: PolyFC) => setKab(fc))
      .catch(() => setKab(null));
  }, []);

  const adminHits = useMemo(() => searchAdmin(query, kab), [query, kab]);
  const [remote, setRemote] = useState<{ q: string; hits: PlaceHit[] }>({
    q: "",
    hits: [],
  });

  // Debounced, and aborted on the next keystroke: typing "ketapang" should
  // cost one request at the end, not eight along the way.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchGeocoder(term, ctrl.signal)
        .then((hits) => setRemote({ q: term, hits }))
        .catch(() => undefined);
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const places = useMemo(() => {
    // Dedupe by position, not by name: Indonesia reuses place names heavily —
    // there is a Ketapang in West Kalimantan and another in East Java — so
    // dropping every remote hit that shares a name with a local one would hide
    // the very places the geocoder is there to find. A remote hit is only a
    // duplicate if it falls inside the admin area of the same name.
    const inside = (h: PlaceHit) =>
      adminHits.some(
        (a) =>
          a.name.toLowerCase() === h.name.toLowerCase() &&
          a.bounds &&
          h.center[0] >= a.bounds[0] &&
          h.center[0] <= a.bounds[2] &&
          h.center[1] >= a.bounds[1] &&
          h.center[1] <= a.bounds[3],
      );
    const extra =
      remote.q === query.trim() ? remote.hits.filter((h) => !inside(h)) : [];
    return [...adminHits, ...extra].slice(0, 8);
  }, [adminHits, remote, query]);

  const goTo = (hit: PlaceHit) => {
    const map = getMapRef();
    if (!map) return;
    if (hit.bounds) map.fitBounds(hit.bounds, { padding: 60, duration: 800 });
    else map.flyTo({ center: hit.center, zoom: 11, duration: 800 });
    setQuery("");
  };
  // Built from the store's copy of the custom specs rather than from
  // `allLayers()`, which reads a module-level array the panel cannot subscribe
  // to — a layer added at runtime would not appear until something else forced
  // a re-render.
  const custom = useLayersStore((s) => s.customLayers);
  const groups = useMemo(() => {
    const out: { group: LayerGroup; layers: LayerDescriptor[] }[] = [];
    for (const d of [...LAYERS, ...custom.map(buildCustomLayer)]) {
      if (
        q &&
        !d.label.toLowerCase().includes(q) &&
        !d.description.toLowerCase().includes(q) &&
        !GROUP_META[d.group].label.toLowerCase().includes(q)
      ) {
        continue;
      }
      const found = out.find((g) => g.group === d.group);
      if (found) found.layers.push(d);
      else out.push({ group: d.group, layers: [d] });
    }
    return out;
  }, [q, custom]);

  const toggleGroup = (g: LayerGroup) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  return (
    <aside
      className={`agni-scroll absolute z-20 overflow-y-auto border border-ink-700/60 bg-ink-900/95 shadow-2xl backdrop-blur md:bg-ink-900/85
        inset-x-2 bottom-[3.75rem] max-h-[62svh] rounded-xl
        md:inset-x-auto md:bottom-auto md:left-3 md:top-3 md:max-h-[calc(100%-120px)] md:w-72
        ${open ? "" : "hidden"}`}
    >
      <div className="flex items-start justify-between border-b border-ink-700/60 px-3 py-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="flex">
              {/* BASE_URL, not "/agni.svg": the app is served from /apps/agni/
                  in production. The file pads the wordmark symmetrically
                  inside a 3000x2000 canvas, so the box is set to the
                  artwork's own aspect and object-cover crops the dead
                  space — otherwise the mark floats at half height. */}
              <img
                src={`${import.meta.env.BASE_URL}agni.svg`}
                alt="AGNI"
                className="aspect-[2883/1138] h-[18px] object-cover"
              />
            </h1>
            <AboutButton />
          </div>
          <p className="text-[10px] uppercase tracking-widest text-ink-400">
            Indonesia fire &amp; haze
          </p>
        </div>
        <button
          type="button"
          onClick={() => useLayersStore.getState().setLayersOpen(false)}
          aria-label="Close layers"
          className="hidden rounded p-0.5 text-ink-400 hover:bg-ink-700/50 hover:text-ink-100 md:block"
        >
          <CaretLeft size={14} weight="bold" />
        </button>
      </div>
      <div className="border-b border-ink-700/40 px-3 py-2">
        <div className="flex items-center gap-1.5 rounded-md bg-ink-850 px-2 py-1">
          <MagnifyingGlass size={12} className="shrink-0 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Enter goes to the top place, which is what a search box is
            // expected to do. Escape clears rather than leaving a stale term
            // filtering the layer list.
            onKeyDown={(e) => {
              if (e.key === "Enter" && places[0]) goTo(places[0]);
              else if (e.key === "Escape") setQuery("");
            }}
            placeholder="Search layers or places"
            aria-label="Search layers or places"
            className="w-full bg-transparent text-[11px] text-ink-100 placeholder:text-ink-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="shrink-0 text-[11px] text-ink-400 hover:text-ink-100"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {q && places.length > 0 && (
        <section className="border-b border-ink-700/40 py-1.5">
          <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-ink-300">
            Places
          </p>
          <ul>
            {places.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => goTo(hit)}
                  className="flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-ink-700/40"
                >
                  <MapPin
                    size={12}
                    weight={hit.source === "admin" ? "fill" : "regular"}
                    className="mt-0.5 shrink-0 text-fire-400"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] text-ink-100">
                      {hit.name}
                    </span>
                    <span className="block truncate text-[10px] text-ink-400">
                      {hit.context}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.map(({ group, layers }) => {
        const Icon = GROUP_META[group].icon;
        // A search always shows what it matched, whatever the collapse state.
        const shut = collapsed.has(group) && !q;
        return (
          <section key={group} className="border-b border-ink-700/40 py-1.5">
            <button
              type="button"
              onClick={() => toggleGroup(group)}
              aria-expanded={!shut}
              className="flex w-full items-center gap-1.5 px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-ink-300 hover:text-ink-100"
            >
              <Icon size={13} weight="duotone" className="text-fire-400" />
              {GROUP_META[group].label}
              <span className="ml-auto flex items-center gap-1.5 font-normal normal-case tracking-normal text-ink-400">
                {shut && <span className="text-[10px]">{layers.length}</span>}
                <CaretDown
                  size={11}
                  weight="bold"
                  className={`transition-transform ${shut ? "-rotate-90" : ""}`}
                />
              </span>
            </button>
            {!shut && (
              <>
                {group === "fire" && <FireFilters />}
                {layers.map((d) => (
                  <LayerRow
                    key={d.id}
                    d={d}
                    infoOpen={openInfo === d.id}
                    onOpenInfo={() => setOpenInfo(d.id)}
                    onCloseInfo={closeInfo}
                  />
                ))}
              </>
            )}
          </section>
        );
      })}

      {!q && (
        <div className="px-3 py-2.5">
          <AddLayerButton />
        </div>
      )}

      {groups.length === 0 && places.length === 0 && (
        <p className="px-3 py-4 text-center text-[11px] text-ink-400">
          Nothing matches “{query}”.
        </p>
      )}
    </aside>
  );
}
