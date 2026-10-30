// CAPEX Gantt (owner's pilot feedback, 24 Oct 2026) — adapted from Keystone's project Gantt (src/components/charts/
// project-gantt.tsx, origin commit 5b425d5): a div grid — name · done · monthly timeline — whose positions are percentages of
// the window (src/domain/schedule.ts). Rows: a summary bar (a CAPEX, an EPC2i project), a lot, a task (indented) or a
// milestone (diamond); a milestones row with the cycle's dates and a today line. Server-compatible, no interaction (native
// `title` tooltips, rows may link). Labels arrive translated.
import Link from 'next/link';
import { cx } from '@/components/ds/cx';
import s from './capex-gantt.module.css';

export interface GanttRow {
  key: string;
  name: string;
  sub?: string;
  href?: string;
  /** 0: summary, 1: lot, 2: task. */
  level: 0 | 1 | 2;
  kind: 'summary' | 'lot' | 'task' | 'epc2i';
  pctText: string;
  bar: { left: string; width: string; clipped?: boolean } | null;
  fill?: string;
  /** A milestone task: a diamond at this left. */
  diamond?: string;
  title?: string;
}

export interface CapexGanttProps {
  months: string[];
  rows: GanttRow[];
  milestones: { left: string; label: string; done: boolean }[];
  todayL: string;
  labels: { name: string; done: string; milestones: string; today: string };
  className?: string;
}

export function CapexGantt({ months, rows, milestones, todayL, labels, className }: CapexGanttProps) {
  const today = <div className={s.today} style={{ left: todayL }} aria-hidden />;
  const cols = { '--months': months.length } as React.CSSProperties;
  return (
    <div className={cx(s.grid, className)} style={cols}>
      <div className={s.row}>
        <div className={s.th}>{labels.name}</div>
        <div className={cx(s.th, s.thRight)}>{labels.done}</div>
        <div className={s.months}>
          {months.map((m, i) => (
            <div key={i} className={s.month}>{m}</div>
          ))}
        </div>
      </div>
      {rows.map((r) => {
        const name = (
          <span className={cx(s.name, r.level === 0 && s.nameStrong)}>
            {r.name}
          </span>
        );
        return (
          <div key={r.key} className={s.row}>
            <div className={cx(s.nameCell, r.level === 1 && s.indent1, r.level === 2 && s.indent2)}>
              {r.href ? <Link href={r.href} className={s.link}>{name}</Link> : name}
              {r.sub && <span className={s.sub}>{r.sub}</span>}
            </div>
            <div className={s.num}>{r.pctText}</div>
            <div className={cx(s.track, s.trackRow)}>
              {r.diamond && <div title={r.title} className={s.msForecast} style={{ left: r.diamond }} />}
              {r.bar && (
                <div title={r.title} className={cx(s.bar, s[r.kind], r.bar.clipped && s.clipped)} style={{ left: r.bar.left, width: r.bar.width }}>
                  <div className={s.fill} style={{ width: r.fill ?? r.pctText }} />
                </div>
              )}
              {today}
            </div>
          </div>
        );
      })}
      <div className={cx(s.row, !milestones.length && s.msNone)}>
        <div className={s.msLabel}>{milestones.length ? labels.milestones : ''}</div>
        <div />
        <div className={s.track}>
          {milestones.map((m, i) => (
            <div key={i} className={s.msWrap} style={{ left: m.left }}>
              <div title={m.label} className={cx(s.msForecast, !m.done && s.msPlanned)} />
              <span className={s.msText}>{m.label}</span>
            </div>
          ))}
          {today}
          <div className={s.todayChip} style={{ left: todayL }}>{labels.today}</div>
        </div>
      </div>
    </div>
  );
}
