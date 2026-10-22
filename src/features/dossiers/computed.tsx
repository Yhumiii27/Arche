// Values Arche computes for a dossier section (budget, risks, team and typology, business plan), shown live on a draft and as
// frozen on a frozen version. Server component; typed data shown as typed.
import { KeyValueList } from '@/components/app/KeyValueList';
import { refOf, TEAM_ROLE_LABEL } from '@/domain/capex';
import { TYPOLOGY_LABEL, labelOf } from '@/domain/capex-labels';
import type { ComputedNeed } from '@/domain/dossiers';
import { dataText } from '@/i18n/data-text';
import type { Lang, T } from '@/i18n/translate';
import { fmtKeur, fmtNum } from '@/lib/format';
import type { computedSnapshot } from '@/server/dal/dossiers';

export type Snapshot = Awaited<ReturnType<typeof computedSnapshot>>;

/** A stored snapshot read safely (a missing part reads as empty). */
export function readSnapshot(raw: unknown): Snapshot {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<Snapshot>;
  return {
    budget: o.budget ?? null,
    risks: Array.isArray(o.risks) ? o.risks : [],
    team: Array.isArray(o.team) ? o.team : [],
    typology: o.typology ?? { value: null, source: null },
    businessPlan: o.businessPlan ?? null,
  };
}

export function ComputedValues({ need, snap, t, lang }: { need: ComputedNeed; snap: Snapshot; t: T; lang: Lang }) {
  if (need === 'budget_e50' || need === 'budget_e10') {
    if (!snap.budget) return <span className="text-muted">{t('No validated budget version yet')}</span>;
    return (
      <KeyValueList
        items={[
          { id: 'b', k: `${t('Validated budget')} (V${snap.budget.version} · ${snap.budget.estimateClass})`, v: fmtKeur(snap.budget.centralKeur, lang) },
          ...snap.budget.lots.map((l) => ({ id: `l${l.number}`, k: `${l.number} · ${dataText(l.title, lang)}`, v: fmtKeur(l.amountKeur, lang) })),
          ...(snap.businessPlan ? [{ id: 'npv', k: t('NPV'), v: fmtKeur(snap.businessPlan.npvKeur, lang) }] : []),
        ]}
      />
    );
  }
  if (need === 'business_plan' || need === 'business_plan_validated') {
    const bp = snap.businessPlan;
    if (!bp) return <span className="text-muted">{t('No business plan yet')}</span>;
    return (
      <KeyValueList
        items={[
          { id: 'r', k: t('Discount rate'), v: `${fmtNum(bp.discountRatePct, lang)} %` },
          { id: 'n', k: t('NPV'), v: fmtKeur(bp.npvKeur, lang) },
          { id: 'i', k: t('IRR'), v: bp.irrPct != null ? `${fmtNum(bp.irrPct, lang)} %` : '—' },
          { id: 'p', k: t('Payback (years)'), v: fmtNum(bp.paybackYears, lang) },
          { id: 'v', k: t('Validated by the group CFO'), v: bp.validated ? t('Yes') : t('No') },
        ]}
      />
    );
  }
  if (need === 'risks') {
    if (!snap.risks.length) return <span className="text-muted">{t('No risk recorded.')}</span>;
    return <KeyValueList items={snap.risks.map((r) => ({ id: `r${r.number}`, k: `${refOf('R', r.number)} · ${r.probability} × ${r.impact}`, v: dataText(r.title, lang) }))} />;
  }
  return (
    <KeyValueList
      items={[
        { id: 'typ', k: t('Typology'), v: snap.typology.value ? `${t(labelOf(TYPOLOGY_LABEL, snap.typology.value))}${snap.typology.source === 'forced' ? ` (${t('forced')})` : ''}` : t('To be determined') },
        ...snap.team.map((m, i) => ({ id: `m${i}`, k: t(TEAM_ROLE_LABEL[m.role]), v: m.name })),
      ]}
    />
  );
}
