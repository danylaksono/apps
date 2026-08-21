/** "Add a layer": paste a remote URL, get a layer.
 *
 *  The registry covers the layers this app is *about*. This covers the long
 *  tail — BIG alone publishes seven public MapServers and the app hard-codes
 *  layers from two of them, and the same dialog takes any keyless ArcGIS
 *  service, XYZ tile template or GeoJSON URL.
 *
 *  Portalled to the body for the same reason the About dialog is: the layer
 *  panel carries `backdrop-blur`, which establishes a containing block and
 *  clips even `position: fixed` children. */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  CaretRight,
  Folder,
  Plus,
  Stack,
  X,
} from "@phosphor-icons/react";
import {
  RemoteBlockedError,
  probeArcgis,
  type ArcgisProbe,
  type ArcgisService,
  type ArcgisSublayer,
} from "../lib/arcgis";
import {
  customLayerId,
  nextCustomColor,
  type CustomKind,
  type CustomLayerSpec,
} from "../layers/custom";
import { useLayersStore } from "../store/layers";

/** BIG's public folder, offered as one click each. These are the same host,
 *  the same grammar and the same keyless CORS policy as the layers already
 *  wired in — the app just never had a reason to hard-code them. */
const SUGGESTIONS: { label: string; url: string }[] = [
  {
    label: "Perizinan & pertanahan",
    url: "https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/PERIZINAN_DAN_PERTANAHAN/MapServer",
  },
  {
    label: "Perencanaan ruang",
    url: "https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/PERENCANAAN_RUANG/MapServer",
  },
  {
    label: "Sarana & prasarana",
    url: "https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/SARANA_PRASARANA/MapServer",
  },
  {
    label: "All BIG public services",
    url: "https://kspservices.big.go.id/satupeta/rest/services/PUBLIK",
  },
];

/** What the URL looks like it is, before anything is fetched. ArcGIS is the
 *  only kind that needs a round trip to be useful, because it holds many
 *  layers behind one URL. */
function sniff(url: string): "arcgis" | "xyz" | "geojson" | null {
  const u = url.trim();
  if (!/^https:\/\//i.test(u)) return null;
  if (/\{z\}/i.test(u) && /\{x\}/i.test(u) && /\{y\}/i.test(u)) return "xyz";
  if (/\/(Map|Feature|Image)Server(\/\d+)?\/?$/i.test(u) || /\/rest\/services/i.test(u)) {
    return "arcgis";
  }
  if (/\.(geo)?json($|\?)/i.test(u)) return "geojson";
  return null;
}

function LayerRow({
  layer,
  service,
  named,
  onAdd,
}: {
  layer: ArcgisSublayer;
  service: ArcgisService;
  /** the layer the pasted URL pointed at, if it named one */
  named: boolean;
  onAdd: (layer: ArcgisSublayer, kind: CustomKind) => void;
}) {
  // A group layer has no geometry of its own and a raster layer has no features
  // at all; both render through `export` and neither can be paged as GeoJSON.
  const canVector = Boolean(layer.geometry) && !layer.isGroup;
  return (
    <li
      className={`border-b border-ink-700/40 px-1 py-1.5 last:border-b-0 ${
        named ? "-mx-1 rounded bg-fire-400/10 px-2" : ""
      }`}
    >
      <p className="text-[11px] leading-snug text-ink-100">{layer.name}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="mr-auto text-[9px] uppercase tracking-widest text-ink-400">
          {layer.isGroup ? "group" : (layer.geometry ?? "raster")}
        </span>
        <button
          type="button"
          disabled={!service.supportsExport}
          onClick={() => onAdd(layer, "arcgis-image")}
          title={
            service.supportsExport
              ? "Rendered by the server as tiles. Works at any size, but cannot be clicked."
              : "Only a MapServer can render images; this is a FeatureServer"
          }
          className="rounded bg-ink-700/60 px-1.5 py-0.5 text-[10px] font-medium text-ink-200 hover:bg-ink-700 disabled:cursor-not-allowed disabled:bg-ink-700/40 disabled:text-ink-500"
        >
          Add as image
        </button>
        <button
          type="button"
          disabled={!canVector}
          onClick={() => onAdd(layer, "arcgis-vector")}
          title={
            canVector
              ? `Downloaded as features (max ${service.maxRecordCount} per page, capped at 20,000). Clickable.`
              : "No feature geometry — image only"
          }
          className="rounded bg-fire-400/15 px-1.5 py-0.5 text-[10px] font-medium text-fire-300 hover:bg-fire-400/25 disabled:cursor-not-allowed disabled:bg-ink-700/40 disabled:text-ink-500"
        >
          Add as data
        </button>
      </div>
    </li>
  );
}

function Dialog({ onClose }: { onClose: () => void }) {
  const existing = useLayersStore((s) => s.customLayers);
  const addCustomLayer = useLayersStore((s) => s.addCustomLayer);

  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; blocked: boolean } | null>(
    null,
  );
  const [probe, setProbe] = useState<ArcgisProbe | null>(null);
  /** Folder URLs walked into, so Back returns rather than starting over. */
  const [trail, setTrail] = useState<string[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const kind = useMemo(() => sniff(url), [url]);

  const go = async (target: string, push: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const result = await probeArcgis(target);
      if (push && probe) setTrail((t) => [...t, urlOf(probe)]);
      setProbe(result);
      setUrl(target);
    } catch (err) {
      setProbe(null);
      setError({
        message: err instanceof Error ? err.message : "could not read that URL",
        blocked: err instanceof RemoteBlockedError,
      });
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    const prev = trail[trail.length - 1];
    if (!prev) {
      setProbe(null);
      return;
    }
    setTrail((t) => t.slice(0, -1));
    void go(prev, false);
  };

  const add = (spec: Omit<CustomLayerSpec, "id" | "color">) => {
    addCustomLayer({
      ...spec,
      id: customLayerId(spec.label),
      color: nextCustomColor(existing),
    });
    onClose();
  };

  const addArcgis = (layer: ArcgisSublayer, k: CustomKind) => {
    if (probe?.kind !== "service") return;
    const svc = probe.service;
    add({
      label: layer.name,
      kind: k,
      url: svc.url,
      layerId: layer.id,
      geometry: layer.geometry ?? undefined,
      pageSize: svc.maxRecordCount,
      description:
        k === "arcgis-image"
          ? `Server-rendered tiles from ${svc.name}. Not clickable and not counted — the map draws an image, not features.`
          : `Fetched as features from ${svc.name}, clipped to the Indonesia envelope and capped at 20,000.`,
    });
  };

  const addDirect = () => {
    if (!kind || kind === "arcgis") return;
    const label = name.trim() || (kind === "xyz" ? "Tile layer" : "GeoJSON layer");
    add({
      label,
      kind: kind === "xyz" ? "xyz" : "geojson",
      url: url.trim(),
      geometry: kind === "geojson" ? "polygon" : undefined,
      description:
        kind === "xyz"
          ? "Raster tiles added by URL. Not clickable."
          : "GeoJSON added by URL. Drawn as polygons; switch the source if it is points or lines.",
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a remote layer"
        onClick={(e) => e.stopPropagation()}
        className="agni-scroll max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-xl border border-ink-700/60 bg-ink-900 p-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-sm font-bold text-ink-100">
              Add a remote layer
            </p>
            <p className="text-[10px] uppercase tracking-widest text-ink-400">
              ArcGIS · XYZ tiles · GeoJSON
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add layer"
            className="shrink-0 rounded p-0.5 text-ink-400 hover:bg-ink-700/50 hover:text-ink-100"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        <form
          className="mt-3 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (kind === "arcgis") void go(url.trim(), false);
            else addDirect();
          }}
        >
          <input
            value={url}
            // Clearing the error here is not cosmetic: the name field and the
            // suggestions are hidden while one is showing, so a failed ArcGIS
            // attempt would otherwise block the XYZ URL typed next.
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            placeholder="https://…/rest/services/…/MapServer"
            aria-label="Layer URL"
            className="min-w-0 flex-1 rounded-md bg-ink-850 px-2 py-1.5 text-[11px] text-ink-100 placeholder:text-ink-500 focus:outline-none focus:ring-1 focus:ring-fire-400/50"
          />
          <button
            type="submit"
            disabled={!kind || busy}
            className="shrink-0 rounded-md bg-fire-400/20 px-2.5 py-1.5 text-[11px] font-semibold text-fire-300 hover:bg-fire-400/30 disabled:cursor-not-allowed disabled:bg-ink-700/40 disabled:text-ink-500"
          >
            {busy ? "…" : kind === "arcgis" ? "Browse" : "Add"}
          </button>
        </form>

        {url.trim() && !kind && (
          <p className="mt-1.5 text-[10px] text-ink-400">
            Expecting an https ArcGIS service, an XYZ template with{" "}
            <code className="text-ink-300">{"{z}/{x}/{y}"}</code>, or a .geojson
            URL.
          </p>
        )}
        {error && (
          <p className="mt-1.5 text-[10px] leading-snug text-fire-300">
            {error.message}
            {error.blocked ? (
              <>
                . It must be reachable and send CORS headers — most{" "}
                <code>.go.id</code> hosts other than BIG send neither.
              </>
            ) : (
              "."
            )}
          </p>
        )}

        {(kind === "xyz" || kind === "geojson") && !error && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name it (optional)"
            aria-label="Layer name"
            className="mt-1.5 w-full rounded-md bg-ink-850 px-2 py-1.5 text-[11px] text-ink-100 placeholder:text-ink-500 focus:outline-none"
          />
        )}

        {busy && (
          <p className="mt-3 text-[10px] text-ink-400">Reading service…</p>
        )}

        {!probe && !busy && (
          <>
            <p className="mt-3 text-[9px] font-semibold uppercase tracking-widest text-ink-400">
              Try one of these
            </p>
            <ul className="mt-1.5 space-y-1">
              {SUGGESTIONS.map((s) => (
                <li key={s.url}>
                  <button
                    type="button"
                    onClick={() => void go(s.url, false)}
                    className="flex w-full items-center gap-1.5 rounded-md bg-ink-850/70 px-2 py-1.5 text-left text-[11px] text-ink-200 hover:bg-ink-700/50"
                  >
                    <Folder size={12} className="shrink-0 text-fire-400" />
                    {s.label}
                    <CaretRight size={11} className="ml-auto text-ink-500" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {probe && (
          <div className="mt-3">
            <div className="flex items-center gap-1.5">
              {(trail.length > 0 || probe.kind === "service") && (
                <button
                  type="button"
                  onClick={back}
                  className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-ink-400 hover:bg-ink-700/50 hover:text-ink-100"
                >
                  <ArrowLeft size={11} weight="bold" /> Back
                </button>
              )}
              <p className="ml-auto truncate text-[10px] text-ink-500">
                {probe.kind === "service"
                  ? `${probe.service.layers.length} layers`
                  : `${probe.folder.folders.length + probe.folder.services.length} entries`}
              </p>
            </div>

            {probe.kind === "folder" ? (
              <ul className="mt-1.5 space-y-1">
                {[
                  ...probe.folder.folders.map((f) => ({ ...f, folder: true })),
                  ...probe.folder.services.map((f) => ({ ...f, folder: false })),
                ].map((entry) => (
                  <li key={entry.url}>
                    <button
                      type="button"
                      onClick={() => void go(entry.url, true)}
                      className="flex w-full items-center gap-1.5 rounded-md bg-ink-850/70 px-2 py-1.5 text-left text-[11px] text-ink-200 hover:bg-ink-700/50"
                    >
                      {entry.folder ? (
                        <Folder size={12} className="shrink-0 text-ink-400" />
                      ) : (
                        <Stack size={12} className="shrink-0 text-fire-400" />
                      )}
                      <span className="truncate">
                        {entry.name.replace(/_/g, " ")}
                      </span>
                      <CaretRight size={11} className="ml-auto text-ink-500" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                {probe.service.description && (
                  <p className="mt-1 text-[10px] leading-snug text-ink-400">
                    {probe.service.description}
                  </p>
                )}
                <ul className="mt-1.5 rounded-md bg-ink-850/60 px-1.5">
                  {/* A URL that named a layer (".../MapServer/6") floats it to
                      the top rather than filtering — the neighbours are usually
                      what you want next. */}
                  {[...probe.service.layers]
                    .sort(
                      (a, b) =>
                        Number(b.id === probe.service.preselect) -
                        Number(a.id === probe.service.preselect),
                    )
                    .map((l) => (
                      <LayerRow
                        key={l.id}
                        layer={l}
                        service={probe.service}
                        named={l.id === probe.service.preselect}
                        onAdd={addArcgis}
                      />
                    ))}
                </ul>
                <p className="mt-2 text-[10px] leading-snug text-ink-400">
                  <strong className="text-ink-300">Image</strong> is safe for any
                  layer — the server draws it on demand, so size does not matter,
                  but it is pixels and the popup cannot read it.{" "}
                  <strong className="text-ink-300">Data</strong> downloads the
                  features, which is slower and capped, and is what makes a layer
                  clickable.
                </p>
              </>
            )}
          </div>
        )}

        <p className="mt-3 border-t border-ink-700/40 pt-2 text-[10px] leading-snug text-ink-500">
          Layers you add are kept in this browser only. Nothing is uploaded, and
          the app has no server to upload it to.
        </p>
      </div>
    </div>,
    document.body,
  );
}

function urlOf(p: ArcgisProbe): string {
  return p.kind === "service" ? p.service.url : p.folder.url;
}

export default function AddLayerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-700 px-3 py-2 text-[11px] font-medium text-ink-400 hover:border-fire-400/50 hover:text-fire-300"
      >
        <Plus size={12} weight="bold" />
        Add a remote layer
      </button>
      {open && <Dialog onClose={() => setOpen(false)} />}
    </>
  );
}
