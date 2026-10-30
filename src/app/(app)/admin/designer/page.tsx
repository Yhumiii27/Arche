// Dossiers and circuits designer (AR-052, DECISIONS.md §5): one template per living dossier and per gate; the published
// version (or the built-in one) applies to the dossier versions and gate sessions started afterwards. The administrator and
// the group industrial director start a draft, change it row by row, preview it and publish it; the versions are kept.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/app/EmptyState';
import { KeyValueList } from '@/components/app/KeyValueList';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { ROLE_LABEL, SPECIALITY_LABEL, isRoleKey, type ExpertSpeciality } from '@/config/roles';
import { canSee } from '@/config/screens';
import { STEP_KIND_LABEL, type StepTemplate } from '@/domain/circuits';
import { builtInCircuit, builtInDossier, DESIGN_STATE_LABEL, readCircuitDesign, readDossierDesign } from '@/domain/designer';
import { DOSSIER_KINDS, DOSSIER_LABEL, type DossierKind, type SectionDef } from '@/domain/dossiers';
import { GATE_LABEL, GATES, type GateCode } from '@/domain/lifecycle';
import { CircuitDesignForm, DiscardDesignButton, DossierDesignForm, PublishDesignButton, StartDesignButton } from '@/features/designer/forms';
import { fmtInstant } from '@/lib/format';
import { getDb } from '@/server/db/client';
import { designsOf } from '@/server/dal/designs';
import { getI18n, getViewer } from '@/server/session';

type Target = { kind: 'dossier'; target: DossierKind } | { kind: 'circuit'; target: GateCode };
const TARGETS: Target[] = [...DOSSIER_KINDS.map((k) => ({ kind: 'dossier' as const, target: k })), ...GATES.map((g) => ({ kind: 'circuit' as const, target: g }))];

export default async function DesignerPage({ searchParams }: PageProps<'/admin/designer'>) {
  const [{ t, lang }, viewer, sp] = await Promise.all([getI18n(), getViewer(), searchParams]);
  if (!canSee(viewer.role, 'admin-designer')) notFound();
  const chosen = TARGETS.find((x) => `${x.kind}:${x.target}` === sp.t) ?? TARGETS[0];
  const { kind, target } = chosen;
  const db = await getDb();
  const versions = await designsOf(db, kind, target);
  const draft = versions.find((v) => v.state === 'draft') ?? null;
  const published = versions.find((v) => v.state === 'published') ?? null;
  const label = (x: Target) => (x.kind === 'dossier' ? t(DOSSIER_LABEL[x.target]) : `${t('Circuit')} ${x.target}`);
  const sections = (def: unknown) => (def === null ? builtInDossier(target as DossierKind) : readDossierDesign(target as DossierKind, def)).sections;
  const steps = (def: unknown) => (def === null ? builtInCircuit(target as GateCode) : readCircuitDesign(target as GateCode, def)).steps;
  const current = published?.definition ?? null;
  const mode = (s: SectionDef) => t(s.mode === 'text' ? 'Required' : s.mode === 'optional' ? 'Optional' : s.mode === 'computed' ? 'Computed by Arche' : 'Filled by the circuit');
  const actor = (s: StepTemplate) => (s.actor === 'internal_client' ? t('Internal client') : s.actor === 'expert' && s.speciality ? `${t('Expert')} ${t(SPECIALITY_LABEL[s.speciality as ExpertSpeciality])}` : isRoleKey(s.actor) ? t(ROLE_LABEL[s.actor]) : s.actor);

  // The preview: the dossier's sections, or the circuit's steps by group, as the CAPEX pages will show them.
  const preview = (def: unknown) =>
    kind === 'dossier' ? (
      <Table>
        <thead><tr><Th>{t('Section')}</Th><Th>{t('What it holds')}</Th><Th>{t('Kind')}</Th></tr></thead>
        <tbody>
          {sections(def).map((s) => (
            <tr key={s.key}><Td>{t(s.title)}</Td><Td tone="secondary">{t(s.hint)}</Td><Td><Tag tone={s.mode === 'text' ? 'neutral' : 'outline'} size="xs">{mode(s)}</Tag></Td></tr>
          ))}
        </tbody>
      </Table>
    ) : (
      <Table>
        <thead><tr><Th>{t('Group')}</Th><Th>{t('Step')}</Th><Th>{t('Kind')}</Th><Th>{t('Who acts')}</Th><Th /></tr></thead>
        <tbody>
          {steps(def).map((s, i) => (
            <tr key={i}>
              <Td>{s.group}</Td>
              <Td>{t(s.label)}</Td>
              <Td>{t(STEP_KIND_LABEL[s.kind])}</Td>
              <Td>{actor(s)}</Td>
              <Td>
                {s.decides && <Tag tone="accent" size="xs">{t('Decides')}</Tag>} {s.optional && <Tag tone="outline" size="xs">{t('Optional')}</Tag>} {s.strategicOnly && <Tag tone="outline" size="xs">{t('Strategic only')}</Tag>}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    );

  return (
    <>
      <PageHeader screen="admin-designer" crumbs={['Administration']} actions={!draft ? <StartDesignButton kind={kind} target={target} /> : [<PublishDesignButton key="p" kind={kind} target={target} />, <DiscardDesignButton key="d" kind={kind} target={target} />]} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TARGETS.map((x) => (
          <Link key={`${x.kind}:${x.target}`} href={`/admin/designer?t=${x.kind}:${x.target}`}>
            <Tag tone={x === chosen ? 'accent' : 'outline'} size="sm">{label(x)}</Tag>
          </Link>
        ))}
      </div>
      <SectionCard title={label(chosen)} subtitle={kind === 'circuit' ? t(GATE_LABEL[target as GateCode]) : undefined}>
        <KeyValueList
          items={[
            { k: t('In force'), v: published ? `v${published.version} · ${published.publishedByName ?? ''}${published.publishedAt ? ` · ${fmtInstant(published.publishedAt, lang)}` : ''}` : t('Built-in (version 0)') },
            { k: t('Applies to'), v: t(kind === 'dossier' ? 'The dossier versions started after its publication; a version started before keeps its sections' : 'The gate sessions submitted after its publication; a running circuit keeps its steps') },
            { k: t('Locked'), v: t(kind === 'dossier' ? 'The sections computed by Arche and those filled by the circuit stay; their title and order may change' : 'One deciding step, in the last group; G1 keeps the sponsor’s visa, G3 the PSSR discharge by the group HSE') },
          ]}
        />
      </SectionCard>
      {draft && (
        <SectionCard title={`${t('Draft')} v${draft.version}`} hint={`${draft.createdByName} · ${fmtInstant(draft.updatedAt, lang)}`} scroll>
          {kind === 'dossier'
            ? <DossierDesignForm target={target} sections={sections(draft.definition)} note={draft.note} />
            : <CircuitDesignForm target={target} steps={steps(draft.definition)} note={draft.note} />}
        </SectionCard>
      )}
      <SectionCard title={draft ? `${t('Preview of the draft')} v${draft.version}` : t('Template in force')} scroll>
        {preview(draft ? draft.definition : current)}
      </SectionCard>
      <SectionCard title={t('Versions')} scroll>
        {versions.length ? (
          <Table>
            <thead><tr><Th>{t('Version')}</Th><Th>{t('State')}</Th><Th>{t('Note')}</Th><Th>{t('Created by')}</Th><Th>{t('Published')}</Th></tr></thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <Td>{`v${v.version}`}</Td>
                  <Td><Tag tone={v.state === 'published' ? 'accent' : 'outline'} size="xs">{t(DESIGN_STATE_LABEL[v.state])}</Tag></Td>
                  <Td tone="secondary">{v.note ?? ''}</Td>
                  <Td>{v.createdByName}</Td>
                  <Td>{v.publishedAt ? `${v.publishedByName ?? ''} · ${fmtInstant(v.publishedAt, lang)}` : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No version yet: the built-in template is in force.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
