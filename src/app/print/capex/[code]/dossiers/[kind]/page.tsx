// Print view of a dossier version (docs/spec/04 §1): A4, black on white, the sections, the values as frozen, the Codex
// references and the fingerprint. Same visibility as the dossier page (outside the viewer's scope: 404). The frozen and signed
// version is deposited in Codex by the user until Codex offers a deposit API (CX-03, CX-07).
import { notFound } from 'next/navigation';
import { DOSSIER_LABEL, isDossierKind, readContent, SECTIONS, VERSION_STATE_LABEL } from '@/domain/dossiers';
import { refOf, TEAM_ROLE_LABEL } from '@/domain/capex';
import { readSnapshot } from '@/features/dossiers/computed';
import { loadCapexPage } from '@/features/capex/page-data';
import { dataText } from '@/i18n/data-text';
import { fmtInstant, fmtKeur } from '@/lib/format';
import { computedSnapshot, dossierVersionsOf } from '@/server/dal/dossiers';
import s from './print.module.css';

export default async function DossierPrintPage({ params, searchParams }: PageProps<'/print/capex/[code]/dossiers/[kind]'>) {
  const { kind } = await params;
  if (!isDossierKind(kind)) notFound();
  const { t, lang, db, c } = await loadCapexPage(params);
  const sp = await searchParams;
  const versions = await dossierVersionsOf(db, c.id, kind);
  const v = (typeof sp.v === 'string' ? versions.find((x) => x.number === Number(sp.v)) : versions[0]) ?? null;
  if (!v) notFound();
  const content = readContent(kind, v.content);
  const snap = v.state === 'draft' ? await computedSnapshot(db, c) : readSnapshot(v.computed);
  return (
    <main className={s.page}>
      <h1>{`${t(DOSSIER_LABEL[kind])} — ${dataText(c.title, lang)}`}</h1>
      <div className={s.meta}>
        {`${c.code} · ${dataText(c.subsidiaryName, lang)} · v${v.number} · ${t(VERSION_STATE_LABEL[v.state])} · ${v.completenessPct} %`}
        {v.contentHash && <div>{`SHA-256 ${v.contentHash} · ${t('Frozen by')} ${v.frozenByName ?? '—'} · ${v.frozenAt ? fmtInstant(v.frozenAt, lang) : ''}`}</div>}
      </div>
      {SECTIONS[kind].map((sec) => {
        const x = content.sections[sec.key];
        return (
          <section key={sec.key}>
            <h2>{t(sec.title)}</h2>
            {sec.need && (sec.need === 'budget_e50' || sec.need === 'budget_e10') && snap.budget && (
              <table>
                <tbody>
                  {snap.budget.lots.map((l) => (
                    <tr key={l.number}><td>{`${l.number} · ${dataText(l.title, lang)}`}</td><td>{fmtKeur(l.amountKeur, lang)}</td></tr>
                  ))}
                  <tr><th>{`${t('Total (central)')} · ${snap.budget.estimateClass}`}</th><th>{fmtKeur(snap.budget.centralKeur, lang)}</th></tr>
                </tbody>
              </table>
            )}
            {sec.need?.startsWith('business_plan') && snap.businessPlan && (
              <p>{`${t('NPV')} ${fmtKeur(snap.businessPlan.npvKeur, lang)} · ${t('IRR')} ${snap.businessPlan.irrPct ?? '—'} % · ${t('Payback (years)')} ${snap.businessPlan.paybackYears ?? '—'}`}</p>
            )}
            {sec.need === 'risks' && (
              <table>
                <tbody>
                  {snap.risks.map((r) => (
                    <tr key={r.number}><td>{refOf('R', r.number)}</td><td>{dataText(r.title, lang)}</td><td>{`${r.probability} × ${r.impact}`}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            {sec.need === 'team' && <p>{snap.team.map((m) => `${t(TEAM_ROLE_LABEL[m.role])} — ${m.name}`).join(' · ')}</p>}
            {x.text && <p className={s.text}>{dataText(x.text, lang)}</p>}
            {x.refs.length > 0 && (
              <table>
                <tbody>
                  {x.refs.map((r) => (
                    <tr key={r.id}><td>{r.id}</td><td>{r.revision ?? '—'}</td><td>{r.title ?? '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </main>
  );
}
