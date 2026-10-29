'use client';
// Living dossier forms (client islands of the dossier page): a section's text, its Codex references, freezing.
import { ActionButton, ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Textarea } from '@/components/ds/Field';
import { SECTION_BASE_FIELD } from '@/domain/concurrency';
import { useI18n } from '@/i18n/client';
import { addReferenceAction, freezeVersionAction, removeReferenceAction, saveSectionAction } from './actions';

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
