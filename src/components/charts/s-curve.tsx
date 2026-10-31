// Consolidated S-curve of a CAPEX (docs/spec/06 §3): planned value (baseline spread over the lots' windows), earned value and
// actual cost, cumulative by month, with the budget at completion, today and the EAC. Look of Keystone's EVM S-curve
// (src/components/charts/evm-s-curve.tsx, origin commit 6645cb6), geometry over any number of months. Server-compatible: the
// page passes the formatter and translator. Identity is never colour alone: dash pattern, legend and a direct label; each month
// has a hover title with its three values (the table view is under the chart).
import type { SCurvePoint } from '@/domain/execution';

const W = 760;
const H = 290;
const L = 64;
const R = 72;
const T_ = 16;
const B = 30;
const fx = (n: number) => n.toFixed(1);

const C = {
  grid: 'var(--color-neutral-900)',
  axis: 'var(--color-neutral-500)',
  bac: 'var(--color-neutral-700)',
  bacText: 'var(--color-neutral-400)',
  today: 'var(--color-accent-700)',
  todayText: 'var(--color-accent-400)',
  pv: 'var(--color-neutral-500)',
  ev: 'var(--color-accent)',
  ac: 'var(--color-neutral-200)',
  bg: 'var(--color-bg)',
};

export const SERIES_STYLE = {
  planned: { stroke: C.pv, dash: '5 4', width: 2 },
  earned: { stroke: C.ev, dash: undefined, width: 2.5 },
  actual: { stroke: C.ac, dash: undefined, width: 2 },
} as const;

/** Grid step: the first "round" value giving at most 6 rows. */
function stepOf(ymax: number): number {
  const steps = [1, 2, 2.5, 5].flatMap((s) => [10, 100, 1000, 10000, 100000].map((k) => s * k)).sort((a, b) => a - b);
  return steps.find((s) => ymax / s <= 6) ?? steps.at(-1)!;
}

export interface SCurveProps {
  points: SCurvePoint[];
  bacKeur: number;
  eacKeur: number;
  current: string;
  /** k€ formatter of the viewer's language. */
  fmt: (n: number) => string;
  /** Month label ("oct. 26"). */
  monthLabel: (m: string) => string;
  t: (s: string) => string;
  /** Earned value projected after the current month by rules (AR-037), drawn on the months of the curve. */
  projection?: readonly { month: string; earned: number }[];
}

export function SCurve({ points, bacKeur, eacKeur, current, fmt, monthLabel, t, projection }: SCurveProps) {
  if (points.length < 2) return null;
  const ymax = Math.max(bacKeur, eacKeur, ...points.map((p) => Math.max(p.planned, p.actual ?? 0, p.earned ?? 0)), 1) * 1.12;
  const gstep = stepOf(ymax);
  const n = points.length;
  const x = (i: number) => L + ((i + 1) / n) * (W - L - R);
  const y = (v: number) => T_ + (1 - v / ymax) * (H - T_ - B);
  const path = (vals: (number | null)[]) => {
    const pts = [[-1, 0] as [number, number], ...vals.map((v, i) => [i, v] as [number, number | null])].filter((p): p is [number, number] => p[1] != null);
    return 'M' + pts.map(([i, v]) => `${fx(i < 0 ? L : x(i))} ${fx(y(v))}`).join(' L');
  };
  const grid: number[] = [];
  for (let v = 0; v <= ymax; v += gstep) grid.push(v);
  const ci = points.findIndex((p) => p.month === current);
  const lastPast = ci >= 0 ? ci : points.filter((p) => p.actual != null).length - 1;
  const labelEvery = Math.ceil(n / 12);
  const last = (k: 'planned' | 'earned' | 'actual') => [...points.keys()].reverse().find((i) => points[i][k] != null);
  // Direct label on the planned curve only: earned value and actual cost end at today's line, where the EAC projection starts.
  const direct = (['planned'] as const).map((k) => ({ k, i: last(k) })).filter((d) => d.i != null);
  const LABEL = { planned: 'Planned', earned: 'Earned value', actual: 'Actual cost' } as const;
  const evPath = path(points.map((p) => p.earned));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={t('S-curve')}>
      <defs>
        <linearGradient id="arche-evfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: C.ev, stopOpacity: 0.24 }} />
          <stop offset="1" style={{ stopColor: C.ev, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      {grid.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={fx(y(v))} y2={fx(y(v))} style={{ stroke: C.grid }} />
          <text x={L - 8} y={fx(y(v) + 4)} style={{ fill: C.axis, fontSize: 11, textAnchor: 'end' }}>{v ? fmt(v) : '0'}</text>
        </g>
      ))}
      {points.map((p, i) => (i % labelEvery === 0 ? <text key={p.month} x={fx(x(i))} y={H - 8} style={{ fill: C.axis, fontSize: 11, textAnchor: 'middle' }}>{monthLabel(p.month)}</text> : null))}
      <line x1={L} x2={W - R} y1={fx(y(bacKeur))} y2={fx(y(bacKeur))} style={{ stroke: C.bac, strokeDasharray: '2 4' }} />
      <text x={L + 4} y={fx(y(bacKeur) - 6)} style={{ fill: C.bacText, fontSize: 11 }}>{`${t('Budget at completion')} · ${fmt(bacKeur)}`}</text>
      {lastPast >= 0 && (
        <>
          <line x1={fx(x(lastPast))} x2={fx(x(lastPast))} y1={T_} y2={H - B} style={{ stroke: C.today }} />
          <text x={fx(x(lastPast) + 6)} y={T_ + 10} style={{ fill: C.todayText, fontSize: 11 }}>{t('Today')}</text>
        </>
      )}
      {lastPast >= 0 && <path d={`${evPath} L${fx(x(lastPast))} ${fx(y(0))} L${L} ${fx(y(0))} Z`} fill="url(#arche-evfill)" />}
      {(['planned', 'actual', 'earned'] as const).map((k) => (
        <path key={k} d={path(points.map((p) => p[k]))} fill="none" style={{ stroke: SERIES_STYLE[k].stroke, strokeWidth: SERIES_STYLE[k].width, strokeDasharray: SERIES_STYLE[k].dash }} />
      ))}
      {lastPast >= 0 && (
        <>
          <path d={`M${fx(x(lastPast))} ${fx(y(points[lastPast].actual ?? 0))} L${fx(x(n - 1))} ${fx(y(eacKeur))}`} fill="none" style={{ stroke: C.ac, strokeWidth: 2, strokeDasharray: '1 4', strokeLinecap: 'round' }} />
          <circle cx={fx(x(n - 1))} cy={fx(y(eacKeur))} r="4" style={{ fill: C.bg, stroke: C.ac, strokeWidth: 2 }} />
          <text x={fx(x(n - 1) - 8)} y={fx(y(eacKeur) - 10)} style={{ fill: C.ac, fontSize: 11, textAnchor: 'end' }}>{`${t('EAC')} ${fmt(eacKeur)}`}</text>
        </>
      )}
      {lastPast >= 0 && projection && projection.length > 0 && (() => {
        const pts = projection.map((p) => [points.findIndex((q) => q.month === p.month), p.earned] as const).filter(([i]) => i > lastPast);
        if (!pts.length) return null;
        const d = `M${fx(x(lastPast))} ${fx(y(points[lastPast].earned ?? 0))} ` + pts.map(([i, v]) => `L${fx(x(i))} ${fx(y(v))}`).join(' ');
        return <path d={d} fill="none" style={{ stroke: C.ev, strokeWidth: 2, strokeDasharray: '1 5', strokeLinecap: 'round' }}><title>{t('Earned value projected at the recent pace')}</title></path>;
      })()}
      {direct.map(({ k, i }) => (
        <text key={k} x={fx(x(i!) + 6)} y={fx(y(points[i!][k]!) + 4)} style={{ fill: 'var(--color-neutral-400)', fontSize: 11 }}>{t(LABEL[k])}</text>
      ))}
      {points.map((p, i) => (
        <rect key={p.month} x={fx(x(i) - (W - L - R) / n / 2)} y={T_} width={fx((W - L - R) / n)} height={H - T_ - B} fill="transparent">
          <title>{`${monthLabel(p.month)} · ${t('Planned')} ${fmt(p.planned)}${p.earned != null ? ` · ${t('Earned value')} ${fmt(p.earned)}` : ''}${p.actual != null ? ` · ${t('Actual cost')} ${fmt(p.actual)}` : ''}`}</title>
        </rect>
      ))}
    </svg>
  );
}

/** Legend of the S-curve (always shown: three series). */
export function SCurveLegend({ t }: { t: (s: string) => string }) {
  const items = [['planned', 'Planned'], ['earned', 'Earned value'], ['actual', 'Actual cost']] as const;
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--color-neutral-300)' }}>
      {items.map(([k, label]) => (
        <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="22" height="8" aria-hidden><line x1="0" x2="22" y1="4" y2="4" style={{ stroke: SERIES_STYLE[k].stroke, strokeWidth: SERIES_STYLE[k].width, strokeDasharray: SERIES_STYLE[k].dash }} /></svg>
          {t(label)}
        </span>
      ))}
    </div>
  );
}
