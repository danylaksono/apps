/** Chart primitives for the dashboard rail.
 *
 *  Hand-rolled SVG rather than a charting library: there are three forms here,
 *  the startup bundle is already watched closely, and every spec below is
 *  fixed anyway — 2px lines, hairline solid grid one step off the surface,
 *  bars capped at 24px with a 4px rounded data-end and a 2px surface gap,
 *  markers with a 2px surface ring, values in ink tokens and never in the
 *  series colour.
 *
 *  Series colours are snapped to the dark-mode lightness band (OKLCH L
 *  0.48–0.67) rather than reused straight from the map tokens, which sit above
 *  it and glow on a chart surface. Each was checked for chroma, CVD separation
 *  and contrast against #10151c rather than eyeballed. */

import { useState } from "react";
import {
  CHART_GRID as GRID,
  CHART_INK,
  CHART_INK_MUTED as INK_MUTED,
  CHART_SURFACE as SURFACE,
  type BarRow,
  type LinePoint,
  type Threshold,
} from "../lib/chartTokens";

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = 0; v <= max * 1.0001; v += step) out.push(v);
  return out;
}

const fmt = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${Math.round(n)}`;

function TableToggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => set(!on)}
      aria-pressed={on}
      className="rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-ink-400 hover:bg-ink-700/50 hover:text-ink-200"
    >
      {on ? "chart" : "table"}
    </button>
  );
}

function ChartFrame({
  title,
  subtitle,
  children,
  table,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  table: React.ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="rounded-lg bg-ink-850/70 p-2.5">
      <header className="mb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[11px] font-semibold text-ink-100">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-[9px] leading-snug text-ink-400">
              {subtitle}
            </p>
          )}
        </div>
        <TableToggle on={showTable} set={setShowTable} />
      </header>
      {showTable ? table : children}
    </section>
  );
}

// ------------------------------------------------------------ line chart ---

/** Time series: 2px line, 10% area wash, crosshair + tooltip, labelled
 *  threshold rules. Single series, so no legend — the title names it. */
export function LineChart({
  title,
  subtitle,
  points,
  color,
  unit,
  thresholds = [],
  height = 116,
  /** index where forecast begins; everything from here is drawn dashed-free but
   *  in a lighter wash so analysis and forecast are not read as equal */
  forecastFrom,
}: {
  title: string;
  subtitle?: string;
  points: LinePoint[];
  color: string;
  unit: string;
  thresholds?: Threshold[];
  height?: number;
  forecastFrom?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 268;
  const padL = 30;
  const padR = 8;
  const padT = 6;
  const axisBand = 14; // reserved for x labels, so nothing is clipped
  const plotH = height - axisBand - padT;

  const real = points.filter((p) => p.value !== null) as (LinePoint & {
    value: number;
  })[];
  const maxV = Math.max(
    1,
    ...real.map((p) => p.value),
    ...thresholds.map((t) => t.value * 0.65),
  );
  const ticks = niceTicks(maxV);
  const top = ticks[ticks.length - 1] || maxV;

  const x = (i: number) =>
    padL + (i / Math.max(1, points.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + plotH - (v / top) * plotH;

  const path = points
    .map((p, i) => (p.value === null ? null : `${x(i)},${y(p.value)}`))
    .filter(Boolean) as string[];
  const line = path.length ? `M${path.join("L")}` : "";
  const area = path.length
    ? `M${path[0].split(",")[0]},${padT + plotH}L${path.join("L")}L${
        path[path.length - 1].split(",")[0]
      },${padT + plotH}Z`
    : "";

  // Label the peak only — a number on every point is noise.
  const peak = real.length
    ? real.reduce((a, b) => (b.value > a.value ? b : a))
    : null;
  const peakIdx = peak ? points.indexOf(peak) : -1;
  const hovered = hover !== null ? points[hover] : null;

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      table={
        <div className="agni-scroll max-h-40 overflow-y-auto">
          <table className="w-full text-[10px] tabular-nums">
            <tbody>
              {points.map((p) => (
                <tr key={p.t} className="border-b border-ink-700/40">
                  <td className="py-0.5 text-ink-400">{p.label}</td>
                  <td className="py-0.5 text-right text-ink-100">
                    {p.value === null ? "—" : `${Math.round(p.value)} ${unit}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    >
      <div className="relative">
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${height}`}
          role="img"
          aria-label={title}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const rel = ((e.clientX - box.left) / box.width) * W;
            const i = Math.round(
              ((rel - padL) / (W - padL - padR)) * (points.length - 1),
            );
            setHover(i >= 0 && i < points.length ? i : null);
          }}
        >
          {/* y grid — hairline, solid, one step off surface */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y(t)}
                y2={y(t)}
                stroke={GRID}
                strokeWidth={1}
              />
              <text
                x={padL - 4}
                y={y(t) + 3}
                textAnchor="end"
                className="tabular-nums"
                fontSize={8}
                fill={INK_MUTED}
              >
                {fmt(t)}
              </text>
            </g>
          ))}

          {/* labelled thresholds — reference rules, not a colour scale */}
          {thresholds
            .filter((t) => t.value <= top)
            .map((t) => (
              <g key={t.label}>
                <line
                  x1={padL}
                  x2={W - padR}
                  y1={y(t.value)}
                  y2={y(t.value)}
                  stroke={INK_MUTED}
                  strokeWidth={1}
                  opacity={0.55}
                />
                {/* a surface-coloured backing keeps the label readable where
                    the series crosses it — clipped or illegible text is worse
                    than no label */}
                <rect
                  x={W - padR - t.label.length * 3.9 - 3}
                  y={y(t.value) - 9}
                  width={t.label.length * 3.9 + 3}
                  height={9}
                  fill={SURFACE}
                  opacity={0.85}
                  rx={2}
                />
                <text
                  x={W - padR - 1}
                  y={y(t.value) - 2}
                  textAnchor="end"
                  fontSize={7.5}
                  fill={INK_MUTED}
                >
                  {t.label}
                </text>
              </g>
            ))}

          {/* forecast side gets a fainter ground so it is not read as observed */}
          {forecastFrom !== undefined && forecastFrom < points.length && (
            <rect
              x={x(forecastFrom)}
              y={padT}
              width={W - padR - x(forecastFrom)}
              height={plotH}
              fill={INK_MUTED}
              opacity={0.07}
            />
          )}

          {area && <path d={area} fill={color} opacity={0.1} />}
          {line && (
            <path
              d={line}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* peak marker: >=8px with a 2px surface ring */}
          {peak && peakIdx >= 0 && (
            <>
              <circle
                cx={x(peakIdx)}
                cy={y(peak.value)}
                r={4}
                fill={color}
                stroke={SURFACE}
                strokeWidth={2}
              />
              <text
                x={Math.min(x(peakIdx) + 6, W - padR - 20)}
                y={Math.max(y(peak.value) - 5, padT + 8)}
                fontSize={8.5}
                fill={CHART_INK}
              >
                {fmt(peak.value)}
              </text>
            </>
          )}

          {hovered && hovered.value !== null && (
            <>
              <line
                x1={x(hover!)}
                x2={x(hover!)}
                y1={padT}
                y2={padT + plotH}
                stroke={INK_MUTED}
                strokeWidth={1}
              />
              <circle
                cx={x(hover!)}
                cy={y(hovered.value)}
                r={4}
                fill={color}
                stroke={SURFACE}
                strokeWidth={2}
              />
            </>
          )}

          {/* x labels: first, middle, last only — more collide at this width */}
          {[0, Math.floor(points.length / 2), points.length - 1]
            .filter((i, n, a) => points[i] && a.indexOf(i) === n)
            .map((i) => (
              <text
                key={i}
                x={Math.min(Math.max(x(i), padL + 10), W - padR - 10)}
                y={height - 3}
                textAnchor="middle"
                fontSize={8}
                fill={INK_MUTED}
              >
                {points[i].label}
              </text>
            ))}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-0 rounded bg-ink-950/95 px-1.5 py-1 text-[9px] leading-tight text-ink-100 shadow-lg ring-1 ring-ink-700"
            style={{
              left: `${(x(hover!) / W) * 100}%`,
              transform:
                hover! > points.length / 2
                  ? "translateX(calc(-100% - 6px))"
                  : "translateX(6px)",
            }}
          >
            <div className="text-ink-400">{hovered.label}</div>
            <div className="tabular-nums">
              {hovered.value === null
                ? "no data"
                : `${Math.round(hovered.value)} ${unit}`}
            </div>
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

// ------------------------------------------------------------- bar chart ---

/** Ranked horizontal bars. One colour for every bar: the categories are
 *  nominal, so shading by value would double-encode length as hue. */
export function BarChart({
  title,
  subtitle,
  rows,
  color,
  unit,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  rows: BarRow[];
  color: string;
  unit: string;
  onSelect?: (row: BarRow) => void;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      table={
        <div className="agni-scroll max-h-40 overflow-y-auto">
          <table className="w-full text-[10px] tabular-nums">
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.province ?? ""}-${r.name}`}
                  className="border-b border-ink-700/40"
                >
                  <td className="py-0.5 pr-2 text-ink-300">{r.name}</td>
                  <td className="py-0.5 text-right text-ink-100">
                    {r.value.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    >
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={`${r.province ?? ""}-${r.name}`}>
            <button
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(r)}
              title={r.sub ? `${r.name} · ${r.sub}` : r.name}
              className="group flex w-full items-center gap-2 rounded px-1 py-[3px] text-left enabled:hover:bg-ink-700/40"
            >
              <span className="w-[92px] shrink-0 truncate text-[10px] text-ink-300 group-enabled:group-hover:text-ink-100">
                {r.name}
              </span>
              <span className="relative h-2.5 flex-1 overflow-hidden">
                <span
                  className="absolute inset-y-0 left-0 rounded-r-[4px]"
                  style={{
                    width: `${Math.max(2, (r.value / max) * 100)}%`,
                    background: color,
                  }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-ink-100">
                {fmt(r.value)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-right text-[9px] text-ink-400">{unit}</p>
    </ChartFrame>
  );
}

// ------------------------------------------------------------- stat tile ---

/** The form for a single number. `definition` is not decoration — an exposure
 *  figure without its radius and window is unreadable. */
export function StatTile({
  label,
  value,
  definition,
  tone = "#d5dce4",
}: {
  label: string;
  value: string;
  definition: string;
  tone?: string;
}) {
  return (
    <section className="rounded-lg bg-ink-850/70 p-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-widest text-ink-400">
        {label}
      </p>
      <p
        className="font-display text-2xl font-bold leading-tight"
        style={{ color: tone }}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[9px] leading-snug text-ink-400">{definition}</p>
    </section>
  );
}
