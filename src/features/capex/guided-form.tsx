'use client';
// Guided opening of a CAPEX (owner, 24 Oct 2026): the steps start → identity → lots → budget → team → initial risks → dossier
// → summary, with the answers kept while moving between steps. Only the title and the investment type are required; the
// summary lists what is left for later. One Server Function writes everything (./guided.ts) and checks it all again.
import { ArrowLeft, ArrowRight, Plus, Trash } from '@phosphor-icons/react/dist/ssr';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ds/Button';
import { Field, Input, Select, Textarea } from '@/components/ds/Field';
import { INVESTMENT_TYPES, LOT_KINDS, LOT_KIND_LABEL, RISK_CATEGORIES, RISK_CATEGORY_LABEL, TEAM_ROLE_LABEL } from '@/domain/capex';
import { INVESTMENT_TYPE_LABEL, PHASE_LABEL } from '@/domain/capex-labels';
import { DOSSIER_LABEL, SECTIONS } from '@/domain/dossiers';
import { dossierOfPhase, GUIDED_STEPS, GUIDED_STEP_LABEL, GUIDED_TEAM_ROLES, textSections, type GuidedStep } from '@/domain/guided';
import type { Phase } from '@/domain/lifecycle';
import { gatesPassedBefore, takeoverClasses, TAKEOVER_PHASES } from '@/domain/takeover';
import { useI18n } from '@/i18n/client';
import { cx } from '@/components/ds/cx';
import { openGuidedAction } from './guided';
import s from './guided.module.css';

type Opt = { value: string; label: string };

export interface GuidedProps {
  role: 'sponsor' | 'project_lead';
  today: string;
  subsidiaries: { code: string; name: string; nextCode: string }[];
  initialSubsidiary: string;
  sites: (Opt & { subsidiary: string })[];
  people: (Opt & { subsidiary: string | null })[];
  /** The retained idea the CAPEX comes from (AR-051): its title, stake and type prefill the sheet. */
  idea?: { id: string; ref: string; subsidiaryCode: string; title: string; stake: string; investmentType: string | null } | null;
}

type Row = Record<string, string>;

export function GuidedOpen({ role, today, subsidiaries, initialSubsidiary, sites, people, idea }: GuidedProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<GuidedStep>('start');
  const [visited, setVisited] = useState<Set<GuidedStep>>(new Set(['start']));
  const [sub, setSub] = useState(initialSubsidiary);
  const [mode, setMode] = useState<'new' | 'takeover'>('new');
  const [sheet, setSheet] = useState<Row>({ title: idea?.title ?? '', investmentType: idea?.investmentType ?? 'new_line', siteId: '', needDate: '', description: idea?.stake ?? '', leadUserId: '' });
  const [lots, setLots] = useState<Row[]>([{ kind: 'civil_works', title: '' }, { kind: 'machines', title: '' }]);
  const [budget, setBudget] = useState<{ basis: string; amounts: string[] }>({ basis: '', amounts: [] });
  const [team, setTeam] = useState<Row[]>([{ userId: '', capexRole: 'controller' }]);
  const [risks, setRisks] = useState<Row[]>([{ title: '', category: 'technical', probability: '2', impact: '2', ownerUserId: '', response: '' }]);
  const [sections, setSections] = useState<Row>({});
  const [takeover, setTakeover] = useState<Row & { phase: Phase }>({ phase: 'avant_projet', openedOn: '', estimateClass: 'E50', validatedOn: '', validatedByName: '', mesStartedOn: '' } as Row & { phase: Phase });
  const [toAmounts, setToAmounts] = useState<string[]>([]);

  const subPeople = people.filter((p) => !p.subsidiary || p.subsidiary === sub);
  const subSites = sites.filter((x) => x.subsidiary === sub);
  const lotRows = lots.filter((l) => l.title.trim());
  const phase: Phase = mode === 'takeover' ? takeover.phase : 'cadrage';
  const dossier = dossierOfPhase(phase);
  const go = (to: GuidedStep) => {
    setError(null);
    setStep(to);
    setVisited((v) => new Set(v).add(to));
  };
  const idx = GUIDED_STEPS.indexOf(step);
  const set = <T extends Row>(list: T[], setList: (v: T[]) => void, i: number, k: string, v: string) => setList(list.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const opt = (o: readonly string[], label: Record<string, string>) => o.map((v) => ({ value: v, label: t(label[v]) }));
  const personName = (id: string) => people.find((p) => p.value === id)?.label ?? '—';

  const submit = (finish: 'draft' | 'open' | 'takeover') =>
    start(async () => {
      setError(null);
      const r = await openGuidedAction(sub, {
        mode, finish,
        sheet,
        lots: lotRows,
        budget: { basis: budget.basis, amounts: lotRows.map((_, i) => budget.amounts[i] ?? '') },
        team, risks, sections,
        takeover: { ...takeover, amounts: lotRows.map((_, i) => toAmounts[i] ?? '') },
      }, idea && idea.subsidiaryCode === sub ? idea.id : undefined);
      if (r.ok && r.code) router.push(`/capex/${encodeURIComponent(r.code)}`);
      else if (!r.ok) setError(t(r.error));
    });

  const gaps = [
    !sheet.title.trim() && t('Title'),
    role === 'sponsor' && !sheet.leadUserId && t('Project lead'),
    !lotRows.length && t('Lots'),
    mode === 'new' && !budget.amounts.some((a) => a?.trim()) && t('Indicative E50 budget'),
    !team.some((m) => m.userId) && t('Team'),
    !risks.some((r) => r.title.trim()) && t('Initial risks'),
    textSections(dossier).some((x) => !sections[x.key]?.trim()) && t('Dossier sections'),
  ].filter(Boolean) as string[];

  return (
    <div className={s.wizard}>
      <nav className={s.steps} aria-label={t('Steps')}>
        {GUIDED_STEPS.map((x, i) => (
          <button key={x} type="button" className={cx(s.step, x === step && s.stepOn)} onClick={() => go(x)} aria-current={x === step ? 'step' : undefined}>
            <span className={cx(s.num, x === step && s.numOn, x !== step && visited.has(x) && s.numDone)}>{i + 1}</span>
            {t(GUIDED_STEP_LABEL[x])}
          </button>
        ))}
      </nav>
      <div className={cx('card', 'elev-sm', s.body)} style={{ padding: 18 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>{t(GUIDED_STEP_LABEL[step])}</h2>

        {step === 'start' && (
          <>
            <p className={s.intro}>{t('Answer what you know now: only the title and the investment type are required. Everything else can be completed later on the CAPEX pages.')}</p>
            {idea && <p className={s.intro}>{`${t('From the idea')} ${idea.ref}: ${idea.title}`}</p>}
            {subsidiaries.length > 1 && (
              <Field label={t('Subsidiary')} htmlFor="go-sub" required>
                <Select id="go-sub" value={sub} onChange={(e) => setSub(e.target.value)} options={subsidiaries.map((x) => ({ value: x.code, label: `${x.code} · ${x.name}` }))} />
              </Field>
            )}
            <div className={s.choices}>
              <button type="button" className={cx(s.choice, mode === 'new' && s.choiceOn)} onClick={() => setMode('new')} aria-pressed={mode === 'new'}>
                <span className={s.choiceTitle}>{t('New CAPEX')}</span>
                <span className={s.choiceSub}>{t('Starts in phase 1 (scoping); the business case is prepared for the G1.')}</span>
              </button>
              {role === 'sponsor' && (
                <button type="button" className={cx(s.choice, mode === 'takeover' && s.choiceOn)} onClick={() => setMode('takeover')} aria-pressed={mode === 'takeover'}>
                  <span className={s.choiceTitle}>{t('Take over a CAPEX in progress')}</span>
                  <span className={s.choiceSub}>{t('Started before Arche: its current phase, the gates already passed and the validated budget.')}</span>
                </button>
              )}
            </div>
            <p className={s.intro}>{t(`Code given when saved: ${subsidiaries.find((x) => x.code === sub)?.nextCode ?? '—'}`)}</p>
          </>
        )}

        {step === 'identity' && (
          <div className={s.grid}>
            <Field label={t('Title')} htmlFor="go-title" required span="full">
              <Input id="go-title" value={sheet.title} onChange={(e) => setSheet({ ...sheet, title: e.target.value })} />
            </Field>
            <Field label={t('Investment type')} htmlFor="go-type" required>
              <Select id="go-type" value={sheet.investmentType} onChange={(e) => setSheet({ ...sheet, investmentType: e.target.value })} options={INVESTMENT_TYPES.map((v) => ({ value: v, label: t(INVESTMENT_TYPE_LABEL[v]) }))} />
            </Field>
            <Field label={t('Site')} htmlFor="go-site">
              <Select id="go-site" value={sheet.siteId} onChange={(e) => setSheet({ ...sheet, siteId: e.target.value })} options={[{ value: '', label: '—' }, ...subSites]} />
            </Field>
            <Field label={t('Need date')} htmlFor="go-need">
              <Input id="go-need" type="date" value={sheet.needDate} onChange={(e) => setSheet({ ...sheet, needDate: e.target.value })} />
            </Field>
            {role === 'sponsor' && (
              <Field label={t('Project lead')} htmlFor="go-lead" hint={t('Needed to open the CAPEX')}>
                <Select id="go-lead" value={sheet.leadUserId} onChange={(e) => setSheet({ ...sheet, leadUserId: e.target.value })} options={[{ value: '', label: '—' }, ...subPeople]} />
              </Field>
            )}
            <Field label={t('Description')} htmlFor="go-desc" span="full" hint={t('Need, product, target capacity, scope')}>
              <Textarea id="go-desc" rows={3} value={sheet.description} onChange={(e) => setSheet({ ...sheet, description: e.target.value })} />
            </Field>
          </div>
        )}

        {step === 'lots' && (
          <>
            <p className={s.intro}>{t('The lots split the budget: works, buildings, utilities, machines (EPC2i)…')}</p>
            <div className={s.rows}>
              {lots.map((l, i) => (
                <div key={i} className={s.row} style={{ gridTemplateColumns: '200px minmax(0, 1fr) auto' }}>
                  <Field label={t('Kind')} htmlFor={`go-lk-${i}`}>
                    <Select id={`go-lk-${i}`} value={l.kind} onChange={(e) => set(lots, setLots, i, 'kind', e.target.value)} options={opt(LOT_KINDS, LOT_KIND_LABEL)} />
                  </Field>
                  <Field label={t('Title')} htmlFor={`go-lt-${i}`}>
                    <Input id={`go-lt-${i}`} value={l.title} onChange={(e) => set(lots, setLots, i, 'title', e.target.value)} />
                  </Field>
                  <Button variant="ghost" icon={Trash} aria-label={t('Remove')} onClick={() => setLots(lots.filter((_, j) => j !== i))} />
                </div>
              ))}
            </div>
            <div><Button icon={Plus} onClick={() => setLots([...lots, { kind: 'other', title: '' }])}>{t('Add a lot')}</Button></div>
          </>
        )}

        {step === 'budget' && mode === 'new' && (
          <>
            <p className={s.intro}>{t('Indicative E50 budget (±50 %), by lot. It is saved as a draft version, submitted later to the controller.')}</p>
            {lotRows.length ? (
              <div className={s.grid}>
                {lotRows.map((l, i) => (
                  <Field key={i} label={`${i + 1}. ${l.title} (k€)`} htmlFor={`go-b-${i}`}>
                    <Input id={`go-b-${i}`} inputMode="decimal" value={budget.amounts[i] ?? ''} onChange={(e) => { const a = [...budget.amounts]; a[i] = e.target.value; setBudget({ ...budget, amounts: a }); }} />
                  </Field>
                ))}
                <Field label={t('Basis of the estimate')} htmlFor="go-basis" span="full">
                  <Input id="go-basis" value={budget.basis} onChange={(e) => setBudget({ ...budget, basis: e.target.value })} placeholder={t('Ratios, EPC2i catalogue prices…')} />
                </Field>
              </div>
            ) : <p className={s.intro}>{t('Add the lots first (step 3).')}</p>}
          </>
        )}

        {step === 'budget' && mode === 'takeover' && (
          <div className={s.grid}>
            <Field label={t('Current phase')} htmlFor="go-ph" required>
              <Select id="go-ph" value={takeover.phase} onChange={(e) => { const p = e.target.value as Phase; setTakeover({ ...takeover, phase: p, estimateClass: takeoverClasses(p)[0] }); }} options={TAKEOVER_PHASES.map((p) => ({ value: p, label: t(PHASE_LABEL[p]) }))} />
            </Field>
            <Field label={t('Opened on')} htmlFor="go-op" required>
              <Input id="go-op" type="date" max={today} value={takeover.openedOn} onChange={(e) => setTakeover({ ...takeover, openedOn: e.target.value })} />
            </Field>
            {gatesPassedBefore(takeover.phase).map((g) => (
              <div key={g} style={{ display: 'contents' }}>
                <Field label={`${g} — ${t('decided on')}`} htmlFor={`go-${g}-on`} required>
                  <Input id={`go-${g}-on`} type="date" max={today} value={takeover[`${g}:on`] ?? ''} onChange={(e) => setTakeover({ ...takeover, [`${g}:on`]: e.target.value })} />
                </Field>
                <Field label={`${g} — ${t('decided by')}`} htmlFor={`go-${g}-by`} required>
                  <Input id={`go-${g}-by`} value={takeover[`${g}:by`] ?? ''} onChange={(e) => setTakeover({ ...takeover, [`${g}:by`]: e.target.value })} />
                </Field>
              </div>
            ))}
            <Field label={t('Class of the validated budget')} htmlFor="go-cls" required>
              <Select id="go-cls" value={takeover.estimateClass} onChange={(e) => setTakeover({ ...takeover, estimateClass: e.target.value })} options={takeoverClasses(takeover.phase).map((c) => ({ value: c, label: c }))} />
            </Field>
            <Field label={t('Budget validated on')} htmlFor="go-von" required>
              <Input id="go-von" type="date" max={today} value={takeover.validatedOn} onChange={(e) => setTakeover({ ...takeover, validatedOn: e.target.value })} />
            </Field>
            <Field label={t('Budget validated by')} htmlFor="go-vby" required span="full">
              <Input id="go-vby" value={takeover.validatedByName} onChange={(e) => setTakeover({ ...takeover, validatedByName: e.target.value })} />
            </Field>
            {lotRows.map((l, i) => (
              <Field key={i} label={`${i + 1}. ${l.title} (k€)`} htmlFor={`go-ta-${i}`} required>
                <Input id={`go-ta-${i}`} inputMode="decimal" value={toAmounts[i] ?? ''} onChange={(e) => { const a = [...toAmounts]; a[i] = e.target.value; setToAmounts(a); }} />
              </Field>
            ))}
            {!lotRows.length && <p className={s.intro}>{t('Add the lots first (step 3).')}</p>}
            {takeover.phase === 'demarrage' && (
              <Field label={t('Start of commissioning')} htmlFor="go-mes" hint={t('If commissioning has started')}>
                <Input id="go-mes" type="date" max={today} value={takeover.mesStartedOn} onChange={(e) => setTakeover({ ...takeover, mesStartedOn: e.target.value })} />
              </Field>
            )}
          </div>
        )}

        {step === 'team' && (
          <>
            <p className={s.intro}>{t('The named team sees the CAPEX. The project lead is chosen on the identity step.')}</p>
            <div className={s.rows}>
              {team.map((m, i) => (
                <div key={i} className={s.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) 220px auto' }}>
                  <Field label={t('Person')} htmlFor={`go-tp-${i}`}>
                    <Select id={`go-tp-${i}`} value={m.userId} onChange={(e) => set(team, setTeam, i, 'userId', e.target.value)} options={[{ value: '', label: '—' }, ...subPeople]} />
                  </Field>
                  <Field label={t('Role in the team')} htmlFor={`go-tr-${i}`}>
                    <Select id={`go-tr-${i}`} value={m.capexRole} onChange={(e) => set(team, setTeam, i, 'capexRole', e.target.value)} options={opt(GUIDED_TEAM_ROLES, TEAM_ROLE_LABEL)} />
                  </Field>
                  <Button variant="ghost" icon={Trash} aria-label={t('Remove')} onClick={() => setTeam(team.filter((_, j) => j !== i))} />
                </div>
              ))}
            </div>
            <div><Button icon={Plus} onClick={() => setTeam([...team, { userId: '', capexRole: 'member' }])}>{t('Add a member')}</Button></div>
          </>
        )}

        {step === 'risks' && (
          <>
            <p className={s.intro}>{t('The main risks known at the framing: probability and impact from 1 to 4.')}</p>
            <div className={s.rows}>
              {risks.map((r, i) => (
                <div key={i} className={s.row} style={{ gridTemplateColumns: 'minmax(0, 2fr) 150px 80px 80px minmax(0, 1fr) auto' }}>
                  <Field label={t('Risk')} htmlFor={`go-rt-${i}`}>
                    <Input id={`go-rt-${i}`} value={r.title} onChange={(e) => set(risks, setRisks, i, 'title', e.target.value)} />
                  </Field>
                  <Field label={t('Category')} htmlFor={`go-rc-${i}`}>
                    <Select id={`go-rc-${i}`} value={r.category} onChange={(e) => set(risks, setRisks, i, 'category', e.target.value)} options={opt(RISK_CATEGORIES, RISK_CATEGORY_LABEL)} />
                  </Field>
                  <Field label="P" htmlFor={`go-rp-${i}`}>
                    <Select id={`go-rp-${i}`} value={r.probability} onChange={(e) => set(risks, setRisks, i, 'probability', e.target.value)} options={['1', '2', '3', '4']} />
                  </Field>
                  <Field label="I" htmlFor={`go-ri-${i}`}>
                    <Select id={`go-ri-${i}`} value={r.impact} onChange={(e) => set(risks, setRisks, i, 'impact', e.target.value)} options={['1', '2', '3', '4']} />
                  </Field>
                  <Field label={t('Owner')} htmlFor={`go-ro-${i}`}>
                    <Select
                      id={`go-ro-${i}`}
                      value={r.ownerUserId}
                      onChange={(e) => set(risks, setRisks, i, 'ownerUserId', e.target.value)}
                      options={[{ value: '', label: '—' }, ...[...new Set([sheet.leadUserId, ...team.map((m) => m.userId)].filter(Boolean))].map((id) => ({ value: id, label: personName(id) }))]}
                    />
                  </Field>
                  <Button variant="ghost" icon={Trash} aria-label={t('Remove')} onClick={() => setRisks(risks.filter((_, j) => j !== i))} />
                </div>
              ))}
            </div>
            <div><Button icon={Plus} onClick={() => setRisks([...risks, { title: '', category: 'technical', probability: '2', impact: '2', ownerUserId: '', response: '' }])}>{t('Add a risk')}</Button></div>
          </>
        )}

        {step === 'dossier' && (
          <>
            <p className={s.intro}>{`${t(DOSSIER_LABEL[dossier])} — ${t('the sections typed now start version 1 (a draft); Codex references are attached on the Living dossiers page.')}`}</p>
            {textSections(dossier).map((x) => (
              <Field key={x.key} label={t(x.title)} htmlFor={`go-s-${x.key}`} hint={t(x.hint)} span="full">
                <Textarea id={`go-s-${x.key}`} rows={3} value={sections[x.key] ?? ''} onChange={(e) => setSections({ ...sections, [x.key]: e.target.value })} />
              </Field>
            ))}
            {SECTIONS[dossier].some((x) => x.mode !== 'text') && <p className={s.intro}>{t('The other sections (budget, risks, team) fill themselves from the CAPEX data.')}</p>}
          </>
        )}

        {step === 'summary' && (
          <>
            <p className={s.intro}>{mode === 'new' ? t('The CAPEX is created as a draft of the subsidiary. The sponsor opens it in phase 1 once the project lead is named.') : t('The CAPEX is opened directly in its phase; the gates passed are recorded as taken over.')}</p>
            {gaps.length > 0 && (
              <>
                <strong style={{ fontSize: 13 }}>{t('To complete later')}</strong>
                <ul className={s.list}>{gaps.map((g) => <li key={g}>{g}</li>)}</ul>
              </>
            )}
            {error && <p className={s.error} role="alert">{error}</p>}
            <div className={s.nav} style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              {mode === 'new' && <Button variant={role === 'sponsor' ? 'secondary' : 'primary'} disabled={pending} onClick={() => submit('draft')}>{t('Create the draft')}</Button>}
              {mode === 'new' && role === 'sponsor' && <Button variant="primary" disabled={pending} onClick={() => submit('open')}>{t('Create and open (phase 1)')}</Button>}
              {mode === 'takeover' && <Button variant="primary" disabled={pending} onClick={() => submit('takeover')}>{t('Create and take over')}</Button>}
            </div>
          </>
        )}

        {step !== 'summary' && error && <p className={s.error} role="alert">{error}</p>}
        <div className={s.nav}>
          <Button icon={ArrowLeft} disabled={idx === 0} onClick={() => go(GUIDED_STEPS[idx - 1])}>{t('Previous')}</Button>
          {step !== 'summary' && <Button variant="primary" iconRight={ArrowRight} onClick={() => go(GUIDED_STEPS[idx + 1])}>{t('Next')}</Button>}
        </div>
      </div>
    </div>
  );
}
