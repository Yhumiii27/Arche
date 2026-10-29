'use client';
// No-code designer forms (AR-052): the draft of a dossier's sections or of a gate's circuit, edited row by row; start, publish,
// discard. The Server Functions check everything again (src/domain/designer.ts).
import { ActionButton, ActionForm } from '@/components/app/ActionForm';
import { Field, Input, Select } from '@/components/ds/Field';
import { EXPERT_SPECIALITIES, ROLE_KEYS, ROLE_LABEL, SPECIALITY_LABEL } from '@/config/roles';
import { STEP_KIND_LABEL, type StepKind, type StepTemplate } from '@/domain/circuits';
import type { SectionDef } from '@/domain/dossiers';
import { useI18n } from '@/i18n/client';
import { discardDesignAction, publishDesignAction, saveDesignAction, startDesignAction } from './actions';

const cell = { padding: '4px 6px', verticalAlign: 'top' } as const;

/** A text left as shown (the French of a built-in English source string) is saved as its source string, so that it stays
 * translated; a text changed is saved as typed. */
function keepSources(fd: FormData, t: (s: string) => string, fields: readonly string[]) {
  for (const [k, v] of [...fd.entries()]) {
    const m = /^src-(\w+):(\d+)$/.exec(k);
    if (!m || !fields.includes(m[1]) || typeof v !== 'string') continue;
    const shown = fd.get(`${m[1]}:${m[2]}`);
    if (typeof shown === 'string' && shown.trim() === t(v)) fd.set(`${m[1]}:${m[2]}`, v);
    fd.delete(k);
  }
}
const box = { gridColumn: '1 / -1', overflowX: 'auto' } as const;

export function StartDesignButton({ kind, target }: { kind: 'dossier' | 'circuit'; target: string }) {
  return <ActionButton run={() => startDesignAction(kind, target)} label="Start a draft" done="Draft started" />;
}
export function PublishDesignButton({ kind, target }: { kind: 'dossier' | 'circuit'; target: string }) {
  return <ActionButton run={() => publishDesignAction(kind, target)} label="Publish the draft" done="Published" />;
}
export function DiscardDesignButton({ kind, target }: { kind: 'dossier' | 'circuit'; target: string }) {
  return <ActionButton run={() => discardDesignAction(kind, target)} label="Discard the draft" done="Discarded" />;
}

export function DossierDesignForm({ target, sections, note }: { target: string; sections: readonly SectionDef[]; note: string | null }) {
  const { t } = useI18n();
  const modes = [{ value: 'text', label: t('Required') }, { value: 'optional', label: t('Optional') }];
  return (
    <ActionForm action={(p, fd) => { keepSources(fd, t, ['title', 'hint']); return saveDesignAction('dossier', target, p, fd); }} submit="Save the draft" done="Saved">
      <div style={box}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={cell}>{t('Order')}</th><th style={cell}>{t('Title')}</th><th style={cell}>{t('What it holds')}</th><th style={cell}>{t('Section')}</th><th style={cell}>{t('Remove')}</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((s, i) => {
              const locked = s.mode === 'computed' || s.mode === 'circuit';
              return (
                <tr key={s.key}>
                  <td style={cell}>
                    <input type="hidden" name={`key:${i}`} value={s.key} />
                    <input type="hidden" name={`src-title:${i}`} value={s.title} />
                    <input type="hidden" name={`src-hint:${i}`} value={s.hint} />
                    <Input name={`order:${i}`} type="number" defaultValue={i + 1} style={{ width: 64 }} aria-label={t('Order')} />
                  </td>
                  <td style={cell}><Input name={`title:${i}`} defaultValue={t(s.title)} required aria-label={t('Title')} /></td>
                  <td style={cell}><Input name={`hint:${i}`} defaultValue={t(s.hint)} aria-label={t('What it holds')} /></td>
                  <td style={cell}>
                    {locked
                      ? <span className="text-muted">{t(s.mode === 'computed' ? 'Computed by Arche' : 'Filled by the circuit')}</span>
                      : <Select name={`mode:${i}`} defaultValue={s.mode} options={modes} aria-label={t('Section')} />}
                  </td>
                  <td style={cell}>{!locked && <input type="checkbox" name={`remove:${i}`} aria-label={t('Remove')} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Field label={t('New section')} htmlFor="ds-new-title"><Input id="ds-new-title" name="new:title" /></Field>
      <Field label={t('What it holds')} htmlFor="ds-new-hint"><Input id="ds-new-hint" name="new:hint" /></Field>
      <Field label={t('Section')} htmlFor="ds-new-mode"><Select id="ds-new-mode" name="new:mode" options={modes} /></Field>
      <Field label={t('Note of the version')} htmlFor="ds-note" span="full"><Input id="ds-note" name="note" defaultValue={note ?? ''} /></Field>
    </ActionForm>
  );
}

export function CircuitDesignForm({ target, steps, note }: { target: string; steps: readonly StepTemplate[]; note: string | null }) {
  const { t } = useI18n();
  const kinds = (Object.keys(STEP_KIND_LABEL) as StepKind[]).map((k) => ({ value: k, label: t(STEP_KIND_LABEL[k]) }));
  const actors = [...ROLE_KEYS.filter((r) => r !== 'admin').map((r) => ({ value: r, label: t(ROLE_LABEL[r]) })), { value: 'internal_client', label: t('Internal client') }];
  const specs = [{ value: '', label: '—' }, ...EXPERT_SPECIALITIES.map((s) => ({ value: s, label: t(SPECIALITY_LABEL[s]) }))];
  const row = (p: (f: string) => string, s?: StepTemplate, i?: number) => (
    <tr key={i ?? 'new'}>
      <td style={cell}><Input name={p('group')} type="number" min={1} max={9} defaultValue={s?.group ?? ''} style={{ width: 56 }} aria-label={t('Group')} /></td>
      <td style={cell}>
        <Input name={p('label')} defaultValue={s ? t(s.label) : ''} aria-label={t('Step')} />
        {s && <input type="hidden" name={`src-label:${i}`} value={s.label} />}
      </td>
      <td style={cell}><Select name={p('kind')} defaultValue={s?.kind ?? 'opinion'} options={kinds} aria-label={t('Kind')} /></td>
      <td style={cell}><Select name={p('actor')} defaultValue={s?.actor ?? 'expert'} options={actors} aria-label={t('Who acts')} /></td>
      <td style={cell}><Select name={p('speciality')} defaultValue={s?.speciality ?? ''} options={specs} aria-label={t('Speciality')} /></td>
      <td style={cell}><input type="checkbox" name={p('optional')} defaultChecked={!!s?.optional} aria-label={t('Optional')} /></td>
      <td style={cell}><input type="checkbox" name={p('strategicOnly')} defaultChecked={!!s?.strategicOnly} aria-label={t('Strategic only')} /></td>
      <td style={cell}><input type="radio" name="decides-choice" value={i ?? 'new'} defaultChecked={!!s?.decides} aria-label={t('Decides')} /></td>
      <td style={cell}>{s && <input type="checkbox" name={`remove:${i}`} aria-label={t('Remove')} />}</td>
    </tr>
  );
  return (
    <ActionForm
      action={(p, fd) => {
        // The deciding step is one radio button: it becomes the `decides` field of its row.
        keepSources(fd, t, ['label']);
        const d = fd.get('decides-choice');
        if (d != null) fd.set(d === 'new' ? 'new:decides' : `decides:${d}`, 'on');
        return saveDesignAction('circuit', target, p, fd);
      }}
      submit="Save the draft"
      done="Saved"
    >
      <div style={box}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={cell}>{t('Group')}</th><th style={cell}>{t('Step')}</th><th style={cell}>{t('Kind')}</th><th style={cell}>{t('Who acts')}</th><th style={cell}>{t('Speciality')}</th>
              <th style={cell}>{t('Optional')}</th><th style={cell}>{t('Strategic only')}</th><th style={cell}>{t('Decides')}</th><th style={cell}>{t('Remove')}</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => row((f) => `${f}:${i}`, s, i))}
            {row((f) => `new:${f}`)}
          </tbody>
        </table>
      </div>
      <Field label={t('Note of the version')} htmlFor="cd-note" span="full"><Input id="cd-note" name="note" defaultValue={note ?? ''} /></Field>
    </ActionForm>
  );
}
