// Copil report of a CAPEX (docs/spec/06 §2): printable page prepared for a project review — summary, gates, budget and
// S-curve figures, main risks, changes, decisions to take and alerts. Same visibility as the CAPEX (outside the scope: 404).
// The report is printed or saved as PDF by the user and filed in Codex (Arche stores no file).
import { DECISION_LABEL, GATE_LABEL } from '@/domain/lifecycle';
import { isMajorRisk, refOf, riskScore } from '@/domain/capex';
import { PHASE_LABEL, TYPOLOGY_LABEL, labelOf } from '@/domain/capex-labels';
import { REVIEW_KIND_LABEL } from '@/domain/governance';
import { HS_LABEL } from '@/domain/safety';
import { loadCapexPage } from '@/features/capex/page-data';
import { alertDetail } from '@/features/governance/alert-detail';
import { dataText } from '@/i18n/data-text';
import { fmtDate, fmtKeur, fmtNum, fmtRatio } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { gatesOf, risksOf } from '@/server/dal/cycle';
import { changesOf } from '@/server/dal/dossiers';
import { capexDashboard } from '@/server/dal/governance';
import s from '../dossiers/[kind]/print.module.css';

const CHANGE_STATUS: Record<string, string> = { submitted: 'Submitted', approved: 'Approved', rejected: 'Rejected' };

export default async function CopilReportPage({ params }: PageProps<'/print/capex/[code]/report'>) {
  const { t, lang, db, c } = await loadCapexPage(params);
  const today = await businessToday(db);
  const [d, gs, rs, chs] = await Promise.all([capexDashboard(db, c, today), gatesOf(db, c.id), risksOf(db, c.id), changesOf(db, c.id)]);
  const k = (n: number | null | undefined) => fmtKeur(n, lang);
  const i = d.indicators;
  const risks = rs.filter((r) => r.status !== 'closed').sort((a, b) => riskScore(b.probability, b.impact) - riskScore(a.probability, a.impact)).slice(0, 5);
  const pending = chs.filter((x) => x.status === 'submitted');
  const lastMonths = d.curve.filter((p) => p.actual != null).slice(-6);
  return (
    <main className={s.page}>
      <h1>{`${t('Copil report')} — ${dataText(c.title, lang)}`}</h1>
      <div className={s.meta}>
        {`${c.code} · ${dataText(c.subsidiaryName, lang)} · ${t(labelOf(PHASE_LABEL, c.phase))} · ${c.typology ? t(labelOf(TYPOLOGY_LABEL, c.typology)) : t('To be determined')} · ${t('Prepared on')} ${fmtDate(today, lang)}`}
      </div>

      <h2>{t('Summary')}</h2>
      <table>
        <tbody>
          <tr><td>{t('Next gate')}</td><td>{d.nextGate ? `${d.nextGate} · ${t(GATE_LABEL[d.nextGate])}${d.running ? ` · ${t('submitted on')} ${fmtDate(d.running.submittedOn, lang)}` : ''}` : '—'}</td></tr>
          <tr><td>{t('Budget at completion')}</td><td>{`${k(i.bacKeur)}${d.g2Keur ? ` · ${t('G2 budget')} ${k(d.g2Keur)}` : ''}`}</td></tr>
          <tr><td>{t('Earned value')} / {t('Actual cost')}</td><td>{`${k(i.evKeur)} / ${k(i.acKeur)}`}</td></tr>
          <tr><td>SPI / CPI / {t('EAC')}</td><td>{`${fmtRatio(i.spi, lang)} / ${fmtRatio(i.cpi, lang)} / ${k(i.eacKeur)}`}</td></tr>
          <tr><td>{t('Weighted pack')}</td><td>{d.pack.pct == null ? '—' : `${fmtNum(d.pack.pct, lang)} %`}</td></tr>
          <tr><td>{t('Safety milestones')}</td><td>{`${d.hs.passed} / ${d.hs.total}${d.hs.next ? ` · ${t('next')} ${t(HS_LABEL[d.hs.next.code])}` : ''}`}</td></tr>
          <tr><td>{t('Last review')}</td><td>{d.lastReview ? `${fmtDate(d.lastReview.heldOn, lang)} · ${t(REVIEW_KIND_LABEL[d.lastReview.kind])}` : '—'}</td></tr>
        </tbody>
      </table>

      <h2>{t('Gates')}</h2>
      <table>
        <tbody>
          {gs.length ? gs.map((g) => (
            <tr key={g.id}><td>{`${g.code} · ${t('session')} ${g.session}`}</td><td>{g.decision ? `${t(DECISION_LABEL[g.decision])} · ${fmtDate(g.decidedAt, lang)}` : t('In progress')}</td></tr>
          )) : <tr><td>{t('No gate session yet.')}</td></tr>}
        </tbody>
      </table>

      {lastMonths.length > 0 && (
        <>
          <h2>{t('S-curve')}</h2>
          <table>
            <thead><tr><th>{t('Month')}</th><th>{t('Planned')}</th><th>{t('Earned value')}</th><th>{t('Actual cost')}</th></tr></thead>
            <tbody>
              {lastMonths.map((p) => <tr key={p.month}><td>{new Date(`${p.month}-15T12:00:00Z`).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</td><td>{k(p.planned)}</td><td>{k(p.earned)}</td><td>{k(p.actual)}</td></tr>)}
            </tbody>
          </table>
        </>
      )}

      <h2>{t('Main risks')}</h2>
      <table>
        <tbody>
          {risks.length ? risks.map((r) => (
            <tr key={r.id}><td>{`${refOf('R', r.number)}${isMajorRisk(r.probability, r.impact) ? ` · ${t('Major')}` : ''}`}</td><td>{dataText(r.title, lang)}</td><td>{`${r.probability} × ${r.impact}`}</td><td>{dataText(r.response, lang) ?? '—'}</td></tr>
          )) : <tr><td>{t('No open risk.')}</td></tr>}
        </tbody>
      </table>

      <h2>{t('Management of change')}</h2>
      <table>
        <tbody>
          {chs.length ? chs.map((x) => (
            <tr key={x.id}><td>{refOf('MOC', x.number)}</td><td>{dataText(x.title, lang)}</td><td>{x.amountKeur != null ? k(x.amountKeur) : '—'}</td><td>{t(CHANGE_STATUS[x.status] ?? x.status)}</td></tr>
          )) : <tr><td>{t('No change recorded.')}</td></tr>}
        </tbody>
      </table>

      <h2>{t('Decisions to take')}</h2>
      <ul>
        {pending.map((x) => <li key={x.id}>{`${refOf('MOC', x.number)} — `}{dataText(x.title, lang)}</li>)}
        {d.alerts.map((a, n) => <li key={n}>{`${t(a.text)}${a.detail ? ` — ${alertDetail(a.detail, t, lang)}` : ''}`}</li>)}
        {!pending.length && !d.alerts.length && <li>{t('Nothing pending.')}</li>}
      </ul>
    </main>
  );
}
