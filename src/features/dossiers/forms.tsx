'use client';
// Living dossier forms (client islands of the dossier page): a section's text, its Codex references, the deposit of a file in
// Codex (CX-03), freezing and the deposit of the frozen version's PDF.
import { ActionButton, ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Select, Textarea } from '@/components/ds/Field';
import { SECTION_BASE_FIELD } from '@/domain/concurrency';
import { CODEX_CONF_LEVELS } from '@/domain/dossiers';
import { useI18n } from '@/i18n/client';
import { addReferenceAction, depositFrozenVersionAction, depositReferenceAction, freezeVersionAction, removeReferenceAction, saveSectionAction } from './actions';

export function SectionForm({ code, kind, section, text }: { code: string; kind: string; section: string; text: string }) {
  const { t } = useI18n();
  return (
    <ActionForm action={(p, fd) => saveSectionAction(code, kind, section, p, fd)} submit="Save the section" done="Saved" variant="secondary">
      <input type="hidden" name={SECTION_BASE_FIELD} value={text} readOnly />
      <Field label={t('Text')} htmlFor={`sec-${section}`} span="full">
        <Textarea id={`sec-${section}`} name="text" rows={4} defaultValue={text} />
      </Field>
    </ActionForm>
  );
}

export function ReferenceForm({ code, kind, section }: { code: string; kind: string; section: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Attach a Codex document">
      <ActionForm action={(p, fd) => addReferenceAction(code, kind, section, p, fd)} submit="Attach" done="Attached" variant="secondary">
        <Field label={t('Codex identifier')} htmlFor={`ref-${section}`} required hint={t('TYPE-CONTEXT-SEQ, e.g. PID-CPX-APM-2026-01-003')}>
          <Input id={`ref-${section}`} name="codexId" required />
        </Field>
        <Field label={t('Revision')} htmlFor={`rev-${section}`}>
          <Input id={`rev-${section}`} name="revision" placeholder="A" />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function RemoveReferenceButton({ code, kind, section, refId }: { code: string; kind: string; section: string; refId: string }) {
  return <ActionButton run={() => removeReferenceAction(code, kind, section, refId)} label="Detach" done="Detached" variant="ghost" />;
}

export function FreezeButton({ code, kind }: { code: string; kind: string }) {
  return <ActionButton run={() => freezeVersionAction(code, kind)} label="Freeze this version" done="Version frozen" variant="primary" />;
}

const CONF_LABEL: Record<(typeof CODEX_CONF_LEVELS)[number], string> = {
  restreint: 'Restricted', interne: 'Internal', confidentiel: 'Confidential', tres_confidentiel: 'Highly confidential',
};

/** Codex metadata of a deposit: type, owner's department, owner, confidentiality, and the file. */
function DepositFields({ id, typeHint, pdf }: { id: string; typeHint?: string; pdf: boolean }) {
  const { t } = useI18n();
  return (
    <>
      <Field label={t('Codex document type')} htmlFor={`type-${id}`} required hint={typeHint ?? t('Code of the Codex registry, e.g. NOT, PID, AUT')}>
        <Input id={`type-${id}`} name="typeCode" required />
      </Field>
      <Field label={t('Department in Codex')} htmlFor={`dep-${id}`} required hint={t('3 letters, e.g. DIR')}>
        <Input id={`dep-${id}`} name="department" required maxLength={3} />
      </Field>
      <Field label={t('Owner in Codex')} htmlFor={`own-${id}`} required hint={t('Matricule (EMP-…) or Codex identifier; the owner submits the draft to a circuit in Codex')}>
        <Input id={`own-${id}`} name="owner" required />
      </Field>
      <Field label={t('Confidentiality')} htmlFor={`conf-${id}`}>
        <Select id={`conf-${id}`} name="conf" defaultValue="interne" options={CODEX_CONF_LEVELS.map((c) => ({ value: c, label: t(CONF_LABEL[c]) }))} />
      </Field>
      <Field label={t(pdf ? 'PDF of the print view' : 'File')} htmlFor={`file-${id}`} required span="full">
        <Input id={`file-${id}`} name="file" type="file" required accept={pdf ? 'application/pdf,.pdf' : undefined} />
      </Field>
    </>
  );
}

export function DepositReferenceForm({ code, kind, section, codexTypes }: { code: string; kind: string; section: string; codexTypes?: string[] }) {
  const { t } = useI18n();
  return (
    <Folded summary="Deposit a file in Codex">
      <ActionForm action={(p, fd) => depositReferenceAction(code, kind, section, p, fd)} submit="Deposit and attach" done="Deposited in Codex and attached" variant="secondary">
        <Field label={t('Title')} htmlFor={`title-${section}`} required span="full">
          <Input id={`title-${section}`} name="title" required maxLength={300} />
        </Field>
        <DepositFields id={section} typeHint={codexTypes?.length ? t(`Expected types: ${codexTypes.join(', ')}`) : undefined} pdf={false} />
      </ActionForm>
    </Folded>
  );
}

export function DepositVersionForm({ code, kind, version }: { code: string; kind: string; version: number }) {
  const { t } = useI18n();
  return (
    <Folded summary="Deposit this version in Codex">
      <ActionForm action={(p, fd) => depositFrozenVersionAction(code, kind, p, fd)} submit="Deposit in Codex" done="Deposited in Codex" variant="secondary">
        <Field label={t('Title')} htmlFor={`title-v${version}`} span="full" hint={t('Empty: the CAPEX code, the dossier and the version')}>
          <Input id={`title-v${version}`} name="title" maxLength={300} />
        </Field>
        <DepositFields id={`v${version}`} pdf />
      </ActionForm>
    </Folded>
  );
}
