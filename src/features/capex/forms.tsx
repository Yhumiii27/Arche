'use client';
// CAPEX forms (client islands of the CAPEX pages, delivery 2). They collect the input; the Server Functions of ./actions.ts
// check the rights and the input again.
import { Plus } from '@phosphor-icons/react/dist/ssr';
import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';
import { ActionButton, ActionForm, Folded, Result, type ActionResult } from '@/components/app/ActionForm';
import { Button } from '@/components/ds/Button';
import { Dialog } from '@/components/ds/Dialog';
import styles from './forms.module.css';
import { Field, Input, Select, Textarea } from '@/components/ds/Field';
import { ESTIMATE_CLASSES } from '@/domain/budget';
import { DECISION_BODIES, DECISION_BODY_LABEL, INVESTMENT_TYPES, LOT_KINDS, LOT_KIND_LABEL, RISK_CATEGORIES, RISK_CATEGORY_LABEL, RISK_STATUSES, RISK_STATUS_LABEL, TEAM_ROLES, TEAM_ROLE_LABEL } from '@/domain/capex';
import { INVESTMENT_TYPE_LABEL } from '@/domain/capex-labels';
import { useI18n } from '@/i18n/client';
import {
  addDecisionAction, addLotAction, addMemberAction, confirmTypologyAction, createCapexAction, deleteDraftVersionAction, forceTypologyAction,
  openCapexAction, removeLotAction, saveBusinessPlanAction, validateBusinessPlanAction, removeMemberAction, reviewVersionAction, saveBudgetVersionAction, saveRiskAction, submitVersionAction, suspendAction,
  updateSheetAction,
} from './actions';

type Opt = { value: string; label: string };

function useOptions() {
  const { t } = useI18n();
  return {
    investment: INVESTMENT_TYPES.map((v) => ({ value: v, label: t(INVESTMENT_TYPE_LABEL[v]) })),
    lotKinds: LOT_KINDS.map((v) => ({ value: v, label: t(LOT_KIND_LABEL[v]) })),
    classes: ESTIMATE_CLASSES.map((v) => ({ value: v, label: v })),
  };
}

// ── Draft and identity sheet ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * "New CAPEX": the page's main action, a dialog with the identity of the draft (title, subsidiary, site, investment type,
 * need date, description and, for a sponsor, the project lead) and the code it will get; once created, its overview opens.
 */
export function NewCapexButton({ subsidiaries, sites, leads }: {
  subsidiaries: (Opt & { nextCode: string })[];
  sites: (Opt & { subsidiary: string })[];
  /** People a sponsor may name project lead (empty: the creator is the lead, or none). */
  leads: (Opt & { subsidiary: string | null })[];
}) {
  const { t } = useI18n();
  const o = useOptions();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState(subsidiaries[0]?.value ?? '');
  const [state, run, pending] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const r = await createCapexAction(prev, fd);
    if (r.ok && r.code) {
      setOpen(false);
      router.push(`/capex/${encodeURIComponent(r.code)}`);
    }
    return r;
  }, null);
  const next = subsidiaries.find((x) => x.value === sub)?.nextCode;
  return (
    <>
      <Button variant="primary" icon={Plus} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {t('New CAPEX')}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('New CAPEX')} subtitle={t('Created as a draft in your subsidiary. The sponsor opens it once the project lead is named.')}>
        <form action={run} className={styles.dialogForm}>
          <Field label={t('Title')} htmlFor="nc-title" required span="full">
            <Input id="nc-title" name="title" required minLength={3} />
          </Field>
          <Field label={t('Subsidiary')} htmlFor="nc-sub" required>
            <Select id="nc-sub" name="subsidiaryCode" value={sub} onChange={(e) => setSub(e.target.value)} options={subsidiaries.map(({ value, label }) => ({ value, label }))} />
          </Field>
          <Field label={t('Site')} htmlFor="nc-site">
            <Select id="nc-site" name="siteId" options={[{ value: '', label: '—' }, ...sites.filter((x) => x.subsidiary === sub)]} />
          </Field>
          <Field label={t('Investment type')} htmlFor="nc-type" required>
            <Select id="nc-type" name="investmentType" options={o.investment} />
          </Field>
          <Field label={t('Need date')} htmlFor="nc-need">
            <Input id="nc-need" name="needDate" type="date" />
          </Field>
          {leads.length > 0 && (
            <Field label={t('Project lead')} htmlFor="nc-lead" span="full" hint={t('Needed to open the CAPEX')}>
              <Select id="nc-lead" name="leadUserId" options={[{ value: '', label: t('To name later') }, ...leads.filter((x) => !x.subsidiary || x.subsidiary === sub)]} />
            </Field>
          )}
          <Field label={t('Description')} htmlFor="nc-desc" span="full">
            <Textarea id="nc-desc" name="description" rows={3} />
          </Field>
          {next && <div className={styles.dialogNote}>{t(`Code given when saved: ${next}`)}</div>}
          <div className={styles.dialogActions}>
            <Result state={state?.ok ? null : state} done="Draft created" />
            <Button onClick={() => setOpen(false)}>{t('Cancel')}</Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {t('Create the draft')}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export interface SheetValues {
  title: string;
  description: string | null;
  investmentType: string;
  siteId: string | null;
  needDate: string | null;
}

export function SheetForm({ code, sheet, sites }: { code: string; sheet: SheetValues; sites: Opt[] }) {
  const { t } = useI18n();
  const o = useOptions();
  return (
    <Folded summary="Edit the identity sheet">
      <ActionForm action={(p, fd) => updateSheetAction(code, p, fd)} submit="Save" done="Saved">
        <Field label={t('Title')} htmlFor="sh-title" required>
          <Input id="sh-title" name="title" defaultValue={sheet.title} required />
        </Field>
        <Field label={t('Investment type')} htmlFor="sh-type" required>
          <Select id="sh-type" name="investmentType" defaultValue={sheet.investmentType} options={o.investment} />
        </Field>
        <Field label={t('Site')} htmlFor="sh-site">
          <Select id="sh-site" name="siteId" defaultValue={sheet.siteId ?? ''} options={[{ value: '', label: '—' }, ...sites]} />
        </Field>
        <Field label={t('Need date')} htmlFor="sh-need">
          <Input id="sh-need" name="needDate" type="date" defaultValue={sheet.needDate ?? ''} />
        </Field>
        <Field label={t('Description')} htmlFor="sh-desc" span="full">
          <Textarea id="sh-desc" name="description" rows={3} defaultValue={sheet.description ?? ''} />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function OpenCapexButton({ code }: { code: string }) {
  return <ActionButton run={() => openCapexAction(code)} label="Open the CAPEX (phase 1)" done="CAPEX opened" variant="primary" />;
}

// ── Cycle ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function SuspendForm({ code, outcome }: { code: string; outcome: 'suspend' | 'resume' }) {
  const { t } = useI18n();
  return (
    <Folded summary={outcome === 'suspend' ? 'Suspend the CAPEX' : 'Resume the CAPEX'}>
      <ActionForm action={async (_p, fd) => suspendAction(code, outcome, String(fd.get('reason') ?? ''))} submit={outcome === 'suspend' ? 'Suspend' : 'Resume'} done="Saved" variant="secondary">
        <Field label={t('Reason')} htmlFor={`sus-${outcome}`} required>
          <Input id={`sus-${outcome}`} name="reason" required />
        </Field>
      </ActionForm>
    </Folded>
  );
}

// ── Lots and budget ───────────────────────────────────────────────────────────────────────────────────────────────────

export function LotForm({ code }: { code: string }) {
  const { t } = useI18n();
  const o = useOptions();
  return (
    <Folded summary="Add a lot">
      <ActionForm action={(p, fd) => addLotAction(code, p, fd)} submit="Add the lot" done="Lot added">
        <Field label={t('Kind')} htmlFor="lot-kind" required>
          <Select id="lot-kind" name="kind" options={o.lotKinds} />
        </Field>
        <Field label={t('Title')} htmlFor="lot-title" required>
          <Input id="lot-title" name="title" required />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function RemoveLotButton({ code, lotId }: { code: string; lotId: string }) {
  return <ActionButton run={() => removeLotAction(code, lotId)} label="Remove" done="Removed" variant="ghost" />;
}

export function VersionForm({ code, lots, version }: {
  code: string;
  lots: { id: string; number: number; title: string }[];
  version?: { id: string; number: number; estimateClass: string; basis: string | null; lines: Record<string, number> };
}) {
  const { t } = useI18n();
  const o = useOptions();
  const id = version?.id ?? 'new';
  return (
    <Folded summary={version ? `Edit version ${version.number}` : 'New budget version'}>
      <ActionForm action={(p, fd) => saveBudgetVersionAction(code, version?.id ?? null, p, fd)} submit={version ? 'Save the version' : 'Create the version'} done="Saved">
        <Field label={t('Estimate class')} htmlFor={`bv-${id}-cls`} required>
          <Select id={`bv-${id}-cls`} name="estimateClass" defaultValue={version?.estimateClass ?? 'E50'} options={o.classes} />
        </Field>
        <Field label={t('Basis of the estimate')} htmlFor={`bv-${id}-basis`}>
          <Input id={`bv-${id}-basis`} name="basis" defaultValue={version?.basis ?? ''} />
        </Field>
        {lots.map((l) => (
          <Field key={l.id} label={`${l.number} · ${l.title} (k€)`} htmlFor={`bv-${id}-${l.id}`}>
            <Input id={`bv-${id}-${l.id}`} name={`lot:${l.id}`} inputMode="decimal" defaultValue={version?.lines[l.id] != null ? String(version.lines[l.id]) : ''} />
          </Field>
        ))}
      </ActionForm>
    </Folded>
  );
}

export function VersionActions({ code, id, submit, review, remove }: { code: string; id: string; submit: boolean; review: boolean; remove: boolean }) {
  const { t } = useI18n();
  return (
    <>
      {submit && <ActionButton run={() => submitVersionAction(code, id)} label="Submit" done="Submitted" />}
      {remove && <ActionButton run={() => deleteDraftVersionAction(code, id)} label="Delete" done="Deleted" variant="ghost" />}
      {review && (
        <>
          <ActionButton run={() => reviewVersionAction(code, id, 'validate')} label="Validate" done="Validated" variant="primary" />
          <ActionForm inline variant="ghost" action={async (_p, fd) => reviewVersionAction(code, id, 'return', String(fd.get('reason') ?? ''))} submit="Return" done="Returned">
            <Input size="inline" name="reason" placeholder={t('Reason for the return')} aria-label={t('Reason for the return')} />
          </ActionForm>
        </>
      )}
    </>
  );
}

// ── Typology and team ─────────────────────────────────────────────────────────────────────────────────────────────────

export function ConfirmTypologyButton({ code }: { code: string }) {
  return <ActionButton run={() => confirmTypologyAction(code)} label="Confirm the new typology" done="Typology confirmed" variant="primary" />;
}

export function ForceTypologyForm({ code }: { code: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Force the typology">
      <ActionForm action={(p, fd) => forceTypologyAction(code, p, fd)} submit="Force" done="Typology forced" variant="secondary">
        <Field label={t('Typology')} htmlFor="ft-typ" required>
          <Select id="ft-typ" name="typology" options={[{ value: 'light', label: t('Light') }, { value: 'strategic', label: t('Strategic') }]} />
        </Field>
        <Field label={t('Reason')} htmlFor="ft-reason" required>
          <Input id="ft-reason" name="reason" required />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function MemberForm({ code, candidates }: { code: string; candidates: Opt[] }) {
  const { t } = useI18n();
  return (
    <Folded summary="Name a team member">
      <ActionForm action={(p, fd) => addMemberAction(code, p, fd)} submit="Add to the team" done="Added">
        <Field label={t('Person')} htmlFor="tm-user" required>
          <Select id="tm-user" name="userId" options={candidates} />
        </Field>
        <Field label={t('Role in the team')} htmlFor="tm-role" required>
          <Select id="tm-role" name="capexRole" options={TEAM_ROLES.map((r) => ({ value: r, label: t(TEAM_ROLE_LABEL[r]) }))} />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function RemoveMemberButton({ code, memberId }: { code: string; memberId: string }) {
  return <ActionButton run={() => removeMemberAction(code, memberId)} label="Remove" done="Removed" variant="ghost" />;
}

// ── Risks and decisions ───────────────────────────────────────────────────────────────────────────────────────────────

export interface RiskValues {
  id: string;
  number: number;
  title: string;
  category: string;
  probability: number;
  impact: number;
  ownerUserId: string | null;
  response: string | null;
  status: string;
  dueOn: string | null;
}

export function RiskForm({ code, people, risk }: { code: string; people: Opt[]; risk?: RiskValues }) {
  const { t } = useI18n();
  const id = risk?.id ?? 'new';
  const scale = [1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }));
  return (
    <Folded summary={risk ? 'Edit' : 'Add a risk'}>
      <ActionForm action={(p, fd) => saveRiskAction(code, risk?.id ?? null, p, fd)} submit={risk ? 'Save' : 'Add the risk'} done="Saved">
        <Field label={t('Risk')} htmlFor={`rk-${id}-title`} required span="full">
          <Input id={`rk-${id}-title`} name="title" defaultValue={risk?.title} required />
        </Field>
        <Field label={t('Category')} htmlFor={`rk-${id}-cat`} required>
          <Select id={`rk-${id}-cat`} name="category" defaultValue={risk?.category} options={RISK_CATEGORIES.map((c) => ({ value: c, label: t(RISK_CATEGORY_LABEL[c]) }))} />
        </Field>
        <Field label={t('Probability (1–4)')} htmlFor={`rk-${id}-p`} required>
          <Select id={`rk-${id}-p`} name="probability" defaultValue={String(risk?.probability ?? 2)} options={scale} />
        </Field>
        <Field label={t('Impact (1–4)')} htmlFor={`rk-${id}-i`} required>
          <Select id={`rk-${id}-i`} name="impact" defaultValue={String(risk?.impact ?? 2)} options={scale} />
        </Field>
        <Field label={t('Owner')} htmlFor={`rk-${id}-owner`}>
          <Select id={`rk-${id}-owner`} name="ownerUserId" defaultValue={risk?.ownerUserId ?? ''} options={[{ value: '', label: '—' }, ...people]} />
        </Field>
        <Field label={t('Status')} htmlFor={`rk-${id}-st`}>
          <Select id={`rk-${id}-st`} name="status" defaultValue={risk?.status ?? 'open'} options={RISK_STATUSES.map((s) => ({ value: s, label: t(RISK_STATUS_LABEL[s]) }))} />
        </Field>
        <Field label={t('Due date')} htmlFor={`rk-${id}-due`}>
          <Input id={`rk-${id}-due`} name="dueOn" type="date" defaultValue={risk?.dueOn ?? ''} />
        </Field>
        <Field label={t('Response')} htmlFor={`rk-${id}-resp`} span="full">
          <Input id={`rk-${id}-resp`} name="response" defaultValue={risk?.response ?? ''} />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function DecisionForm({ code, today }: { code: string; today: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Record a decision">
      <ActionForm action={(p, fd) => addDecisionAction(code, p, fd)} submit="Record" done="Decision recorded">
        <Field label={t('Date')} htmlFor="dc-on" required>
          <Input id="dc-on" name="takenOn" type="date" defaultValue={today} max={today} required />
        </Field>
        <Field label={t('Decided by')} htmlFor="dc-body" required>
          <Select id="dc-body" name="body" options={DECISION_BODIES.map((b) => ({ value: b, label: t(DECISION_BODY_LABEL[b]) }))} />
        </Field>
        <Field label={t('Decision')} htmlFor="dc-text" required span="full">
          <Textarea id="dc-text" name="text" rows={2} required />
        </Field>
      </ActionForm>
    </Folded>
  );
}

// ── Business plan ─────────────────────────────────────────────────────────────────────────────────────────────────────

export function BusinessPlanForm({ code, horizon, rate, flows }: { code: string; horizon: number; rate: number | null; flows: { year: number; capexKeur: number; opexKeur: number; revenueKeur: number }[] }) {
  const { t } = useI18n();
  const at = (y: number) => flows.find((f) => f.year === y);
  const cell = (k: 'capex' | 'opex' | 'revenue', y: number, v: number | undefined) => (
    <Input key={`${k}:${y}`} size="cell" name={`${k}:${y}`} inputMode="decimal" aria-label={`${k} ${y}`} defaultValue={v ? String(v) : ''} />
  );
  return (
    <Folded summary={flows.length ? 'Edit the business plan' : 'Enter the business plan'}>
      <ActionForm action={(p, fd) => saveBusinessPlanAction(code, p, fd)} submit="Save the business plan" done="Saved">
        <Field label={t('Discount rate (%)')} htmlFor="bp-rate" required>
          <Input id="bp-rate" name="discountRatePct" inputMode="decimal" defaultValue={rate != null ? String(rate) : ''} required />
        </Field>
        <div style={{ gridColumn: '1 / -1', overflowX: 'auto' }}>
          <table style={{ borderSpacing: 4 }}>
            <thead>
              <tr>
                <th />
                {Array.from({ length: horizon }, (_, y) => (
                  <th key={y} style={{ fontSize: 11, fontWeight: 500 }}>{`${t('Year')} ${y}`}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['capex', 'opex', 'revenue'] as const).map((k) => (
                <tr key={k}>
                  <th style={{ fontSize: 11.5, fontWeight: 500, textAlign: 'left', whiteSpace: 'nowrap' }}>{t(k === 'capex' ? 'CAPEX (k€)' : k === 'opex' ? 'OPEX (k€)' : 'Revenue (k€)')}</th>
                  {Array.from({ length: horizon }, (_, y) => (
                    <td key={y}>{cell(k, y, at(y)?.[`${k}Keur`])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ActionForm>
    </Folded>
  );
}

export function ValidateBusinessPlanButton({ code }: { code: string }) {
  return <ActionButton run={() => validateBusinessPlanAction(code)} label="Validate the business plan" done="Validated" variant="primary" />;
}
