'use client';
// Benefits realised and post-audit forms (AR-046). The Server Functions check everything again.
import { ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Select, Textarea } from '@/components/ds/Field';
import { POST_AUDIT_CONCLUSIONS, POST_AUDIT_CONCLUSION_LABEL } from '@/domain/benefits';
import { useI18n } from '@/i18n/client';
import { recordPostAuditAction, saveBenefitAction } from './actions';

export function BenefitForm({ code, years }: { code: string; years: { year: number; revenue: number | null; opex: number | null }[] }) {
  const { t } = useI18n();
  return (
    <Folded summary="Enter the benefits of a year">
      <ActionForm action={(p, fd) => saveBenefitAction(code, p, fd)} submit="Save the year" done="Saved">
        <Field label={t('Year of the business plan')} htmlFor="bf-year" required>
          <Select id="bf-year" name="year" options={years.map((y) => ({ value: String(y.year), label: `${t('Year')} ${y.year}` }))} />
        </Field>
        <Field label={t('Revenue (k€)')} htmlFor="bf-rev" required><Input id="bf-rev" name="revenueKeur" inputMode="decimal" required /></Field>
        <Field label={t('Operating costs (k€)')} htmlFor="bf-opex" required><Input id="bf-opex" name="opexKeur" inputMode="decimal" required /></Field>
        <Field label={t('Note')} htmlFor="bf-note" span="full"><Textarea id="bf-note" name="note" rows={2} /></Field>
      </ActionForm>
    </Folded>
  );
}

export function PostAuditForm({ code, milestones, today }: { code: string; milestones: number[]; today: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Record a post-audit">
      <ActionForm action={(p, fd) => recordPostAuditAction(code, p, fd)} submit="Record the post-audit" done="Recorded">
        <Field label={t('Post-audit')} htmlFor="pa-m" required>
          <Select id="pa-m" name="milestone" options={milestones.map((m) => ({ value: String(m), label: `M+${m}` }))} />
        </Field>
        <Field label={t('Held on')} htmlFor="pa-on" required><Input id="pa-on" name="heldOn" type="date" max={today} defaultValue={today} required /></Field>
        <Field label={t('Conclusion')} htmlFor="pa-c" required>
          <Select id="pa-c" name="conclusion" options={POST_AUDIT_CONCLUSIONS.map((c) => ({ value: c, label: t(POST_AUDIT_CONCLUSION_LABEL[c]) }))} />
        </Field>
        <Field label={t('Codex reference of the report')} htmlFor="pa-ref"><Input id="pa-ref" name="codexRef" /></Field>
        <Field label={t('Report')} htmlFor="pa-sum" required span="full"><Textarea id="pa-sum" name="summary" rows={4} required /></Field>
      </ActionForm>
    </Folded>
  );
}
