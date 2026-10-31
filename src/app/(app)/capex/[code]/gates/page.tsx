// Gates & circuits (docs/spec/05): the gate the CAPEX faces, its criteria evaluated now, the submission of the gate on the
// frozen dossier, the running circuit — each step, its deadline, its outcome — with the form of the step that is the viewer's,
// the brief of the decision and the comparison with the CAPEX already built (AR-037, rules), and the earlier sessions.
import { and, eq } from 'drizzle-orm';
import Link from 'next/link';
import { EmptyState } from '@/components/app/EmptyState';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { ROLE_LABEL, SPECIALITY_LABEL, isRoleKey, type ExpertSpeciality } from '@/config/roles';
import { canActOn, isSigned, OUTCOMES_OF, OUTCOME_LABEL, STEP_KIND_LABEL, type Outcome, type StepActor, type StepKind } from '@/domain/circuits';
import { DOSSIER_LABEL, DOSSIER_OF_GATE } from '@/domain/dossiers';
import { DECISION_LABEL, GATE_LABEL, currentGate, type CriterionState, type GateDecision } from '@/domain/lifecycle';
import { loadCapexPage } from '@/features/capex/page-data';
import { GateBriefCard, ReferenceCard } from '@/features/decision/aid';
import { StepForm, SubmitGateForm } from '@/features/gates/forms';
import { dataText } from '@/i18n/data-text';
import { fmtDate } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { currentEvaluation } from '@/server/cycle/evaluation';
import { dossierVersions, roleAssignments, users } from '@/server/db/schema';
import { gatesOf, teamOf } from '@/server/dal/cycle';
import { dossierVersionsOf, stepsOf } from '@/server/dal/dossiers';
import { standInFor, standInsOf } from '@/server/dal/absences';
import { circuitFor } from '@/server/dal/designs';
import { decisionAidOf } from '@/server/dal/decision-aid';

const STATE_LABEL: Record<CriterionState, string> = { met: 'Met', unmet: 'Not met', forced: 'Forced', not_evaluated: 'Not evaluated yet' };
const STATUS_LABEL: Record<string, string> = { waiting: 'Waiting', open: 'Open', done: 'Done', cancelled: 'Cancelled' };
const SESSION_LABEL: Record<string, string> = { in_review: 'Circuit running', decided: 'Decided', returned: 'Sent back', open: 'Open', submitted: 'Submitted' };

export default async function GatesPage({ params }: PageProps<'/capex/[code]/gates'>) {
  const { t, lang, viewer, db, c, can } = await loadCapexPage(params);
  const gate = currentGate(c);
  const today = await businessToday();
  const [sessions, ev, team, aid] = await Promise.all([gatesOf(db, c.id), currentEvaluation(db, c), teamOf(db, c.id), gate ? decisionAidOf(db, viewer, c, today) : null]);
  const running = sessions.find((g) => g.status === 'in_review') ?? null;
  const allSteps = await stepsOf(db, sessions.map((g) => g.id));
  const kind = gate ? DOSSIER_OF_GATE[gate] : undefined;
  const [latest] = kind ? await dossierVersionsOf(db, c.id, kind) : [];
  const actor = { role: viewer.role, userId: viewer.userId, assignments: viewer.assignments, internalClient: team.some((m) => m.userId === viewer.userId && m.capexRole === 'internal_client') };

  // Experts the project lead may name per speciality: those holding the speciality on the CAPEX.
  const experts = gate && !running && can('edit')
    ? await Promise.all([...new Set((await circuitFor(db, gate, c.typology as 'light' | 'strategic' | null)).filter((s) => s.kind === 'opinion').map((s) => s.speciality!))].map(async (speciality) => {
        const rows = await db.select({ id: users.id, name: users.displayName }).from(roleAssignments).innerJoin(users, eq(users.id, roleAssignments.userId))
          .where(and(eq(roleAssignments.role, 'expert'), eq(roleAssignments.scopeRef, c.code), eq(roleAssignments.speciality, speciality)));
        return { speciality, label: SPECIALITY_LABEL[speciality as ExpertSpeciality], options: rows.map((r) => ({ value: r.id, label: r.name })) };
      }))
    : [];
  const runningVersion = running?.dossierVersionId ? (await db.select().from(dossierVersions).where(eq(dossierVersions.id, running.dossierVersionId)))[0] ?? null : null;
  const runningSteps = running ? allSteps.filter((s) => s.gateId === running.id) : [];
  const proposed = runningSteps.filter((s) => s.kind === 'opinion' && s.outcome === 'reserved' && s.comment).map((s) => s.comment!).join('\n');
  const forcible = ev ? ev.results.filter((r) => r.state === 'unmet' && r.forcible).map((r) => ({ code: r.code, label: r.label })) : [];
  const actorLabel = (a: string, spec: string | null) => (a === 'internal_client' ? t('Internal client') : a === 'expert' && spec ? `${t('Expert')} ${t(SPECIALITY_LABEL[spec as ExpertSpeciality])}` : isRoleKey(a) ? t(ROLE_LABEL[a]) : a);
  const returnTo = `/capex/${encodeURIComponent(c.code)}/gates`;
  // The circuit steps the viewer may act on now: their forms go in the page header (owner's pilot feedback, 25 Oct 2026).
  // Their own steps, and those of an absent person they stand in for (AR-041).
  const standIns = running ? await standInsOf(db, viewer.userId, today) : [];
  const isMine = (s: (typeof runningSteps)[number]) => s.status === 'open' && (canActOn({ actor: s.actor as StepActor, speciality: s.speciality, assigneeUserId: s.assigneeUserId }, actor, c) || !!standInFor(s, c, standIns));
  const myStepForms = running
    ? runningSteps.filter(isMine).map((s) => (
        <StepForm
          key={s.id}
          code={c.code}
          stepId={s.id}
          rowVersion={s.rowVersion}
          outcomes={OUTCOMES_OF[s.kind as StepKind]}
          signed={isSigned(s.kind as StepKind)}
          statement={`${s.label} — ${c.code}, ${running.code} session ${running.session}${runningVersion ? `, v${runningVersion.number}, SHA-256 ${runningVersion.contentHash}` : ''}`}
          decides={s.decides}
          forcible={forcible}
          proposed={proposed}
          returnTo={returnTo}
        />
      ))
    : [];

  return (
    <>
      <PageHeader
        screen="capex-gates"
        title={dataText(c.title, lang)}
        crumbs={['CAPEX register']}
        crumbData={c.code}
        primary={gate && !running && can('edit') && (!kind || (latest?.state === 'frozen' && latest.completenessPct === 100)) ? <SubmitGateForm code={c.code} gate={gate} experts={experts} /> : null}
        actions={myStepForms}
      />
      <SectionCard title={gate ? `${gate} · ${t(GATE_LABEL[gate])}` : t('No gate to pass')} subtitle={kind ? `${t('Dossier')}${lang === 'fr' ? ' : ' : ': '}${t(DOSSIER_LABEL[kind])} — ${latest ? `v${latest.number} · ${latest.completenessPct} %` : t('Not started')}` : undefined}>
        {kind && <Link href={`/capex/${encodeURIComponent(c.code)}/dossiers/${kind}`}>{t('Open the dossier')}</Link>}
        {ev && (
          <Table>
            <thead>
              <tr>
                <Th>{t('Criterion')}</Th>
                <Th>{t('Blocking')}</Th>
                <Th>{t('State')}</Th>
                <Th>{t('Value')}</Th>
              </tr>
            </thead>
            <tbody>
              {ev.results.map((r) => (
                <tr key={r.code}>
                  <Td>{t(r.label)}</Td>
                  <Td tone="secondary">{r.blocking ? (r.forcible ? t('Yes') : t('Yes, cannot be forced')) : t('Alert')}</Td>
                  <Td nowrap>
                    <Tag tone={r.state === 'unmet' ? 'accent' : r.state === 'met' ? 'neutral' : 'outline'} size="sm">{t(STATE_LABEL[r.state])}</Tag>
                    {r.state === 'not_evaluated' && <span className="text-muted"> {t(`delivery ${r.from.slice(1)}`)}</span>}
                  </Td>
                  <Td tone="secondary">{r.value ? t(r.value) : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {gate && !running && can('edit') && kind && !(latest?.state === 'frozen' && latest.completenessPct === 100) && (
          <span className="text-muted">{t('Freeze the dossier, complete at 100 %, before submitting the gate.')}</span>
        )}
      </SectionCard>

      {aid && <GateBriefCard aid={aid} t={t} lang={lang} />}
      {aid && (gate === 'G1' || gate === 'G2') && <ReferenceCard aid={aid} t={t} lang={lang} />}

      {running && (
        <SectionCard title={`${running.code} · ${t('session')} ${running.session} — ${t(SESSION_LABEL.in_review)}`} subtitle={runningVersion ? `v${runningVersion.number} · SHA-256 ${runningVersion.contentHash}` : undefined} scroll>
          <Table>
            <thead>
              <tr>
                <Th>{t('Step')}</Th>
                <Th>{t('Who')}</Th>
                <Th>{t('Status')}</Th>
                <Th>{t('Due date')}</Th>
                <Th>{t('Outcome')}</Th>
              </tr>
            </thead>
            <tbody>
              {runningSteps.map((s) => {
                const mine = isMine(s);
                const late = s.status === 'open' && s.dueOn && s.dueOn < today;
                return (
                  <tr key={s.id}>
                    <Td>
                      <div>{`${t(s.label)}${s.optional ? ` (${t('optional')})` : ''}`}</div>
                      <div className="text-muted">{t(STEP_KIND_LABEL[s.kind as StepKind])}</div>
                      {mine && <Tag tone="accent" size="xs">{t('Your turn: see the header')}</Tag>}
                    </Td>
                    <Td tone="secondary">{s.assigneeName ?? actorLabel(s.actor, s.speciality)}</Td>
                    <Td nowrap>{late ? <Tag tone="accent" size="sm">{t('Late')}</Tag> : t(STATUS_LABEL[s.status])}</Td>
                    <Td nowrap>{fmtDate(s.dueOn, lang)}</Td>
                    <Td>{s.outcome ? `${t(OUTCOME_LABEL[s.outcome as Outcome])}${s.actedByName ? ` — ${s.actedByName}${s.onBehalfOfName ? ` (${t('on behalf of')} ${s.onBehalfOfName})` : ''}` : ''}${s.comment ? ` · ${s.comment}` : ''}` : '—'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </SectionCard>
      )}

      <SectionCard title={t('Earlier sessions')} scroll>
        {sessions.filter((g) => g.status !== 'in_review').length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Gate')}</Th>
                <Th>{t('Session')}</Th>
                <Th>{t('State')}</Th>
                <Th>{t('Decision')}</Th>
                <Th>{t('Date')}</Th>
                <Th>{t('Steps')}</Th>
              </tr>
            </thead>
            <tbody>
              {sessions.filter((g) => g.status !== 'in_review').reverse().map((g) => (
                <tr key={g.id}>
                  <Td>{g.code}</Td>
                  <Td>{g.session}</Td>
                  <Td>{t(SESSION_LABEL[g.status] ?? g.status)}</Td>
                  <Td>{g.decision ? `${t(DECISION_LABEL[g.decision as GateDecision])}${g.decisionReason ? ` · ${g.decisionReason}` : ''}` : '—'}</Td>
                  <Td nowrap>{fmtDate(g.decidedAt ?? g.updatedAt, lang)}</Td>
                  <Td tone="secondary">
                    {g.takenOver
                      ? <><Tag tone="outline" size="xs">{t('Taken over')}</Tag> {`${t('Decided before Arche by')} ${g.decidedByName ?? '—'}`}</>
                      : allSteps.filter((s) => s.gateId === g.id && s.status === 'done').map((s) => `${t(s.label)}: ${t(OUTCOME_LABEL[s.outcome as Outcome])}`).join(' · ') || '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No earlier session.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
