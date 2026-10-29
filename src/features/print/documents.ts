import 'server-only';
// The printable documents of a CAPEX (AR-042): a dossier version (docs/spec/04 §1: sections, values as frozen, Codex
// references, fingerprint) and the Copil report (docs/spec/06 §2: summary, gates, S-curve, main risks, changes, decisions to
// take). Built once from the data, shown as the HTML print page (./print-view.tsx) or written as a PDF by the server
// (src/lib/export/pdf.ts). The caller has read the CAPEX through the visibility filter.
import { DOSSIER_LABEL, readContent, SECTIONS, VERSION_STATE_LABEL, type DossierKind } from '@/domain/dossiers';
import { isMajorRisk, refOf, riskScore, TEAM_ROLE_LABEL } from '@/domain/capex';
import { PHASE_LABEL, TYPOLOGY_LABEL, labelOf } from '@/domain/capex-labels';
import { DECISION_LABEL, GATE_LABEL } from '@/domain/lifecycle';
import { REVIEW_KIND_LABEL } from '@/domain/governance';
import { HS_LABEL } from '@/domain/safety';
import { readSnapshot } from '@/features/dossiers/computed';
import { alertDetail } from '@/features/governance/alert-detail';
import { dataText } from '@/i18n/data-text';
import type { Lang, T } from '@/i18n/translate';
import type { PrintBlock, PrintDoc } from '@/lib/export/print-doc';
import { fmtDate, fmtInstant, fmtKeur, fmtNum, fmtRatio } from '@/lib/format';
import { businessToday } from '@/server/clock';
import type { DB } from '@/server/db/types';
import { gatesOf, risksOf } from '@/server/dal/cycle';
import { changesOf, computedSnapshot, dossierVersionsOf } from '@/server/dal/dossiers';
import { capexDashboard } from '@/server/dal/governance';

export interface PrintCtx {
  t: T;
  lang: Lang;
  db: DB;
  c: { id: string; code: string; title: string; subsidiaryName: string; subsidiaryCode: string; phase: string; status: string; typology: string | null; typologySource: string | null; typologyProposed: string | null; openedAt: Date | null };
}

/** A dossier version (`number`; the latest when omitted), or null when the dossier has none. */
export async function dossierDoc({ t, lang, db, c }: PrintCtx, kind: DossierKind, number?: number): Promise<PrintDoc | null> {
  const versions = await dossierVersionsOf(db, c.id, kind);
  const v = (number != null ? versions.find((x) => x.number === number) : versions[0]) ?? null;
  if (!v) return null;
  const content = readContent(kind, v.content);
  const snap = v.state === 'draft' ? await computedSnapshot(db, c) : readSnapshot(v.computed);
  const blocks: PrintBlock[] = [];
  for (const sec of SECTIONS[kind]) {
    const x = content.sections[sec.key];
    blocks.push({ kind: 'h2', text: t(sec.title) });
    if ((sec.need === 'budget_e50' || sec.need === 'budget_e10') && snap.budget) {
      blocks.push({ kind: 'table', rows: [
        ...snap.budget.lots.map((l) => [`${l.number} · ${dataText(l.title, lang)}`, fmtKeur(l.amountKeur, lang)]),
        [`${t('Total (central)')} · ${snap.budget.estimateClass}`, fmtKeur(snap.budget.centralKeur, lang)],
      ] });
    }
    if (sec.need?.startsWith('business_plan') && snap.businessPlan) {
      blocks.push({ kind: 'p', text: `${t('NPV')} ${fmtKeur(snap.businessPlan.npvKeur, lang)} · ${t('IRR')} ${snap.businessPlan.irrPct ?? '—'} % · ${t('Payback (years)')} ${snap.businessPlan.paybackYears ?? '—'}` });
    }
    if (sec.need === 'risks') blocks.push({ kind: 'table', rows: snap.risks.map((r) => [refOf('R', r.number), dataText(r.title, lang) ?? '', `${r.probability} × ${r.impact}`]) });
    if (sec.need === 'team') blocks.push({ kind: 'p', text: snap.team.map((m) => `${t(TEAM_ROLE_LABEL[m.role])} — ${m.name}`).join(' · ') });
    if (x.text) blocks.push({ kind: 'p', text: dataText(x.text, lang) ?? '' });
    if (x.refs.length) blocks.push({ kind: 'table', rows: x.refs.map((r) => [r.id, r.revision ?? '—', r.title ?? '—']) });
  }
  return {
    title: `${t(DOSSIER_LABEL[kind])} — ${dataText(c.title, lang)}`,
    meta: [
      `${c.code} · ${dataText(c.subsidiaryName, lang)} · v${v.number} · ${t(VERSION_STATE_LABEL[v.state])} · ${v.completenessPct} %`,
      ...(v.contentHash ? [`SHA-256 ${v.contentHash} · ${t('Frozen by')} ${v.frozenByName ?? '—'} · ${v.frozenAt ? fmtInstant(v.frozenAt, lang) : ''}`] : []),
    ],
    blocks,
  };
}

const CHANGE_STATUS: Record<string, string> = { submitted: 'Submitted', approved: 'Approved', rejected: 'Rejected' };

/** The Copil report of a CAPEX, prepared today. */
export async function copilReportDoc({ t, lang, db, c }: PrintCtx): Promise<PrintDoc> {
  const today = await businessToday(db);
  const [d, gs, rs, chs] = await Promise.all([capexDashboard(db, c, today), gatesOf(db, c.id), risksOf(db, c.id), changesOf(db, c.id)]);
  const k = (n: number | null | undefined) => fmtKeur(n, lang);
  const i = d.indicators;
  const risks = rs.filter((r) => r.status !== 'closed').sort((a, b) => riskScore(b.probability, b.impact) - riskScore(a.probability, a.impact)).slice(0, 5);
  const pending = chs.filter((x) => x.status === 'submitted');
  const lastMonths = d.curve.filter((p) => p.actual != null).slice(-6);
  const month = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const blocks: PrintBlock[] = [
    { kind: 'h2', text: t('Summary') },
    { kind: 'table', rows: [
      [t('Next gate'), d.nextGate ? `${d.nextGate} · ${t(GATE_LABEL[d.nextGate])}${d.running ? ` · ${t('submitted on')} ${fmtDate(d.running.submittedOn, lang)}` : ''}` : '—'],
      [t('Budget at completion'), `${k(i.bacKeur)}${d.g2Keur ? ` · ${t('G2 budget')} ${k(d.g2Keur)}` : ''}`],
      [`${t('Earned value')} / ${t('Actual cost')}`, `${k(i.evKeur)} / ${k(i.acKeur)}`],
      [`SPI / CPI / ${t('EAC')}`, `${fmtRatio(i.spi, lang)} / ${fmtRatio(i.cpi, lang)} / ${k(i.eacKeur)}`],
      [t('Weighted pack'), d.pack.pct == null ? '—' : `${fmtNum(d.pack.pct, lang)} %`],
      [t('Safety milestones'), `${d.hs.passed} / ${d.hs.total}${d.hs.next ? ` · ${t('next')} ${t(HS_LABEL[d.hs.next.code])}` : ''}`],
      [t('Last review'), d.lastReview ? `${fmtDate(d.lastReview.heldOn, lang)} · ${t(REVIEW_KIND_LABEL[d.lastReview.kind])}` : '—'],
    ] },
    { kind: 'h2', text: t('Gates') },
    { kind: 'table', rows: gs.length ? gs.map((g) => [`${g.code} · ${t('session')} ${g.session}`, g.decision ? `${t(DECISION_LABEL[g.decision])} · ${fmtDate(g.decidedAt, lang)}` : t('In progress')]) : [[t('No gate session yet.')]] },
    ...(lastMonths.length ? [
      { kind: 'h2', text: t('S-curve') },
      { kind: 'table', head: [t('Month'), t('Planned'), t('Earned value'), t('Actual cost')], rows: lastMonths.map((p) => [month(p.month), k(p.planned), k(p.earned), k(p.actual)]) },
    ] satisfies PrintBlock[] : []),
    { kind: 'h2', text: t('Main risks') },
    { kind: 'table', rows: risks.length ? risks.map((r) => [`${refOf('R', r.number)}${isMajorRisk(r.probability, r.impact) ? ` · ${t('Major')}` : ''}`, dataText(r.title, lang) ?? '', `${r.probability} × ${r.impact}`, dataText(r.response, lang) ?? '—']) : [[t('No open risk.')]] },
    { kind: 'h2', text: t('Management of change') },
    { kind: 'table', rows: chs.length ? chs.map((x) => [refOf('MOC', x.number), dataText(x.title, lang) ?? '', x.amountKeur != null ? k(x.amountKeur) : '—', t(CHANGE_STATUS[x.status] ?? x.status)]) : [[t('No change recorded.')]] },
    { kind: 'h2', text: t('Decisions to take') },
    { kind: 'list', items: [
      ...pending.map((x) => `${refOf('MOC', x.number)} — ${dataText(x.title, lang) ?? ''}`),
      ...d.alerts.map((a) => `${t(a.text)}${a.detail ? ` — ${alertDetail(a.detail, t, lang)}` : ''}`),
      ...(!pending.length && !d.alerts.length ? [t('Nothing pending.')] : []),
    ] },
  ];
  return {
    title: `${t('Copil report')} — ${dataText(c.title, lang)}`,
    meta: [`${c.code} · ${dataText(c.subsidiaryName, lang)} · ${t(labelOf(PHASE_LABEL, c.phase))} · ${c.typology ? t(labelOf(TYPOLOGY_LABEL, c.typology)) : t('To be determined')} · ${t('Prepared on')} ${fmtDate(today, lang)}`],
    blocks,
  };
}

/** The context of a document route (no 404 page: null when the CAPEX does not exist for the viewer). */
export async function printCtxOf(code: string): Promise<PrintCtx | null> {
  const [{ getI18n, getViewer }, { capexForViewer }, { capexRow }, { getDb }] = await Promise.all([
    import('@/server/session'), import('@/server/dal/capex'), import('@/server/dal/cycle'), import('@/server/db/client'),
  ]);
  const [i18n, viewer] = await Promise.all([getI18n(), getViewer()]);
  const seen = await capexForViewer(viewer, code);
  if (!seen) return null;
  const db = await getDb();
  const row = await capexRow(db, seen.id);
  return row ? { ...i18n, db, c: { ...seen, ...row } } : null;
}

/** A PDF download response (never cached: the document follows the data). */
export function pdfResponse(bytes: Uint8Array, stem: string): Response {
  return new Response(Buffer.from(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${stem}.pdf"`, 'Cache-Control': 'no-store' },
  });
}
