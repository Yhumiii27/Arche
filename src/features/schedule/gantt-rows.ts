// Rows of the Gantts (owner's pilot feedback, 24 Oct 2026): the Gantt of one CAPEX (summary, lots and their tasks, tasks of
// the CAPEX, one summary bar per EPC2i project, cycle milestones) and the Gantt of a portfolio (one summary bar per CAPEX,
// no detail). Translated labels; typed names shown as typed.
import type { CapexGanttProps, GanttRow } from '@/components/charts/capex-gantt';
import { screenHref } from '@/config/screens';
import { refOf } from '@/domain/capex';
import { barOf, dayLeft, ganttWindow, windowMonths, type GanttWindow, type Span } from '@/domain/schedule';
import { dataText } from '@/i18n/data-text';
import type { Lang } from '@/i18n/translate';
import type { CapexSchedule } from '@/server/dal/schedule';

type T = (s: string) => string;

/** Month labels: "janv. 26" on short windows; on long ones the initial of the month, and the year on January and the first. */
function monthLabels(w: GanttWindow, lang: Lang): string[] {
  const loc = lang === 'fr' ? 'fr-FR' : 'en-GB';
  return windowMonths(w).map((m, i) => {
    const d = new Date(`${m}-01T12:00:00Z`);
    if (w.months <= 14) return d.toLocaleDateString(loc, { month: 'short', year: '2-digit', timeZone: 'UTC' });
    return i === 0 || m.endsWith('-01') ? `’${m.slice(2, 4)}` : d.toLocaleDateString(loc, { month: 'narrow', timeZone: 'UTC' });
  });
}
const spanRow = (w: GanttWindow, s: Span | null) => (s ? { bar: barOf(s.start, s.end, w), pctText: `${s.progressPct} %`, fill: `${s.progressPct}%` } : { bar: null, pctText: '—' });
const labelsOf = (t: T) => ({ name: t('WBS'), done: t('Done'), milestones: t('Milestones'), today: t('Today') });

export function capexGantt(sched: CapexSchedule, title: string, today: string, lang: Lang, t: T): CapexGanttProps & { window: GanttWindow } {
  const dates = [
    sched.summary?.start, sched.summary?.end,
    ...sched.lots.flatMap((l) => [l.span?.start, l.span?.end, ...l.tasks.flatMap((x) => [x.start, x.end])]),
    ...sched.general.flatMap((x) => [x.start, x.end]), ...sched.epc2i.flatMap((p) => [p.span?.start, p.span?.end]), ...sched.milestones.map((m) => m.on),
  ];
  const w = ganttWindow(dates, today);
  const task = (x: CapexSchedule['general'][number], level: 1 | 2): GanttRow => ({
    key: x.id, name: dataText(x.name, lang), sub: [refOf('T', x.number), x.ownerName].filter(Boolean).join(' · '), level, kind: 'task',
    ...(x.milestone ? { bar: null, pctText: `${x.progressPct} %`, diamond: dayLeft(x.start, w), title: dataText(x.name, lang) } : spanRow(w, x)),
  });
  const rows: GanttRow[] = [
    { key: 'capex', name: title, level: 0, kind: 'summary', ...spanRow(w, sched.summary) },
    ...sched.general.map((x) => task(x, 1)),
    ...sched.lots.flatMap((l): GanttRow[] => [
      { key: l.id, name: `${l.number}. ${dataText(l.title, lang)}`, sub: l.tasks.length ? `${l.tasks.length} ${t('task(s)')}` : l.span ? t('Planned months of the lot') : t('No dates yet'), level: 1, kind: 'lot', ...spanRow(w, l.span) },
      ...l.tasks.map((x) => task(x, 2)),
    ]),
    ...sched.epc2i.map((p): GanttRow => ({ key: p.code, name: `${p.code} · ${dataText(p.name, lang)}`, sub: t('EPC2i project · summary from Keystone'), level: 1, kind: 'epc2i', ...spanRow(w, p.span) })),
  ];
  return {
    window: w,
    months: monthLabels(w, lang),
    rows,
    milestones: sched.milestones.map((m) => ({ left: dayLeft(m.on, w), label: m.label === 'Need date' ? t('Need date') : m.label, done: m.done })),
    todayL: dayLeft(today, w),
    labels: labelsOf(t),
  };
}

/** Portfolio Gantt: one summary bar per CAPEX (its duration and progress), linking to its WBS & Gantt page. */
export function portfolioGantt(rows: readonly { code: string; title: string; sub: string; summary: Span | null }[], today: string, lang: Lang, t: T): CapexGanttProps {
  const w = ganttWindow(rows.flatMap((r) => [r.summary?.start, r.summary?.end]), today);
  return {
    months: monthLabels(w, lang),
    rows: rows.map((r) => ({ key: r.code, name: `${r.code} · ${r.title}`, sub: r.sub, href: screenHref('capex-schedule', { code: r.code }), level: 0, kind: 'summary', ...spanRow(w, r.summary) })),
    milestones: [],
    todayL: dayLeft(today, w),
    labels: { ...labelsOf(t), name: t('CAPEX') },
  };
}
