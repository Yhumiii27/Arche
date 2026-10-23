// Ramp-up of a production line (docs/spec/06 §6): one bar per day, the output as a share of the nominal daily capacity, the
// conforming days in accent (output ≥ the required share and scrap ≤ the target), the others in neutral, planned stops as a
// short outlined bar; the required share as a dashed line. Server-compatible: the page passes the days already evaluated
// and the formatters. Each bar has a hover title; the page shows the table view under it.
const W = 760;
const H = 200;
const L = 44;
const R = 12;
const T_ = 12;
const B = 26;
const fx = (n: number) => n.toFixed(1);

export interface RampupBar {
  day: string;
  sharePct: number | null;
  state: 'conforming' | 'not_conforming' | 'neutral';
  title: string;
}

export function RampupChart({ bars, requiredPct, dayLabel, label }: { bars: RampupBar[]; requiredPct: number; dayLabel: (d: string) => string; label: string }) {
  if (!bars.length) return null;
  const ymax = Math.max(120, ...bars.map((b) => b.sharePct ?? 0)) * 1.05;
  const n = bars.length;
  const slot = (W - L - R) / n;
  const bw = Math.max(1.5, slot - 2);
  const y = (v: number) => T_ + (1 - v / ymax) * (H - T_ - B);
  const every = Math.ceil(n / 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={label}>
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={fx(y(v))} y2={fx(y(v))} style={{ stroke: 'var(--color-neutral-900)' }} />
          <text x={L - 6} y={fx(y(v) + 4)} style={{ fill: 'var(--color-neutral-500)', fontSize: 11, textAnchor: 'end' }}>{`${v} %`}</text>
        </g>
      ))}
      {bars.map((b, i) => {
        const x = L + i * slot + (slot - bw) / 2;
        if (b.state === 'neutral') {
          return (
            <rect key={b.day} x={fx(x)} y={fx(y(8))} width={fx(bw)} height={fx(y(0) - y(8))} rx="1" style={{ fill: 'none', stroke: 'var(--color-neutral-600)', strokeWidth: 1 }}>
              <title>{b.title}</title>
            </rect>
          );
        }
        const v = Math.max(0, b.sharePct ?? 0);
        return (
          <rect key={b.day} x={fx(x)} y={fx(y(v))} width={fx(bw)} height={fx(Math.max(1, y(0) - y(v)))} rx="1" style={{ fill: b.state === 'conforming' ? 'var(--color-accent)' : 'var(--color-neutral-600)' }}>
            <title>{b.title}</title>
          </rect>
        );
      })}
      <line x1={L} x2={W - R} y1={fx(y(requiredPct))} y2={fx(y(requiredPct))} style={{ stroke: 'var(--color-accent-300)', strokeDasharray: '5 4' }} />
      {bars.map((b, i) => (i % every === 0 ? <text key={b.day} x={fx(L + i * slot + slot / 2)} y={H - 8} style={{ fill: 'var(--color-neutral-500)', fontSize: 11, textAnchor: 'middle' }}>{dayLabel(b.day)}</text> : null))}
    </svg>
  );
}

export function RampupLegend({ t }: { t: (s: string) => string }) {
  const sw = (fill: string, stroke?: string) => <svg width="12" height="12" aria-hidden><rect x="1" y="1" width="10" height="10" rx="1" style={{ fill, stroke, strokeWidth: stroke ? 1 : 0 }} /></svg>;
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--color-neutral-300)' }}>
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{sw('var(--color-accent)')}{t('Conforming day')}</span>
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{sw('var(--color-neutral-600)')}{t('Non-conforming day')}</span>
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{sw('none', 'var(--color-neutral-600)')}{t('Planned stop')}</span>
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><svg width="22" height="8" aria-hidden><line x1="0" x2="22" y1="4" y2="4" style={{ stroke: 'var(--color-accent-300)', strokeDasharray: '5 4' }} /></svg>{t('Required capacity')}</span>
    </div>
  );
}
