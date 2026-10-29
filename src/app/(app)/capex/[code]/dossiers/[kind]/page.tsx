// A living dossier (docs/spec/04): its sections — typed text and Codex references, values computed by Arche —, completeness,
// versions, freezing with the SHA-256 fingerprint and its check, signatures, print view. `?v=N` shows an earlier version.
import { eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KeyValueList } from '@/components/app/KeyValueList';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { ActionLink } from '@/components/app/ActionForm';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { completeness, DOSSIER_LABEL, isDossierKind, readContent, VERSION_STATE_LABEL } from '@/domain/dossiers';
import { ComputedValues, readSnapshot } from '@/features/dossiers/computed';
import { FreezeButton, ReferenceForm, RemoveReferenceButton, SectionForm } from '@/features/dossiers/forms';
import { loadCapexPage } from '@/features/capex/page-data';
import { dataText } from '@/i18n/data-text';
import { fmtInstant } from '@/lib/format';
import { circuitSteps, gates, signatures } from '@/server/db/schema';
import { computedFacts, computedSnapshot, dossierVersionsOf, versionHash } from '@/server/dal/dossiers';
import { currentSections, sectionsFor } from '@/server/dal/designs';
import { codexDocumentUrl } from '@/server/integrations/codex';

export default async function DossierPage({ params, searchParams }: PageProps<'/capex/[code]/dossiers/[kind]'>) {
  const { kind } = await params;
  if (!isDossierKind(kind)) notFound();
  const { t, lang, db, c, can } = await loadCapexPage(params);
  const sp = await searchParams;
  const versions = await dossierVersionsOf(db, c.id, kind);
  const wanted = typeof sp.v === 'string' ? Number(sp.v) : null;
  const v = (wanted ? versions.find((x) => x.number === wanted) : versions[0]) ?? null;
  const draft = !v || v.state === 'draft';
  const edit = can('edit') && (draft || v === versions[0]);
  // The sections of the version's template (AR-052); before any version, the published template.
  const secs = v ? await sectionsFor(db, kind, v.templateVersion) : (await currentSections(db, kind)).sections;
  const content = readContent(kind, v?.content, secs);
  const snap = draft ? await computedSnapshot(db, c) : readSnapshot(v!.computed);
  const facts = await computedFacts(db, c);
  const comp = draft ? completeness(kind, content, facts, secs) : { pct: v!.completenessPct, bySection: completeness(kind, content, facts, secs).bySection };
  const intact = v && !draft && v.contentHash ? versionHash(kind, v.number, content, v.computed) === v.contentHash : null;
  const sessions = v ? await db.select({ id: gates.id, code: gates.code, session: gates.session }).from(gates).where(eq(gates.dossierVersionId, v.id)) : [];
  const sigs = sessions.length
    ? await db.select({ s: signatures, label: circuitSteps.label }).from(signatures).innerJoin(circuitSteps, eq(circuitSteps.id, signatures.circuitStepId)).where(inArray(circuitSteps.gateId, sessions.map((s) => s.id)))
    : [];
  const base = `/capex/${encodeURIComponent(c.code)}/dossiers/${kind}`;
  return (
    <>
      <PageHeader
        screen="capex-dossiers"
        title={`${t(DOSSIER_LABEL[kind])} — ${dataText(c.title, lang)}`}
        crumbs={['CAPEX register']}
        crumbData={c.code}
        actions={
          <>
            {edit && v?.state === 'draft' && <FreezeButton code={c.code} kind={kind} />}
            {v && <ActionLink href={`/print/capex/${encodeURIComponent(c.code)}/dossiers/${kind}?v=${v.number}`} newTab icon="print" label={t('Print view')} />}
            {v && <ActionLink href={`/print/capex/${encodeURIComponent(c.code)}/dossiers/${kind}/pdf?v=${v.number}`} download icon="download" label={t('Download as PDF')} />}
          </>
        }
      />
      <KpiGrid>
        <KpiTile label={t('Version')} value={v ? `v${v.number}` : '—'} sub={v ? t(VERSION_STATE_LABEL[v.state]) : t('Not started')} />
        <KpiTile label={t('Completeness')} value={`${comp.pct} %`} tone={comp.pct < 100 ? 'alert' : 'default'} />
        <KpiTile label={t('Fingerprint')} value={v?.contentHash ? `${v.contentHash.slice(0, 10)}…` : '—'} sub={intact == null ? t('Not frozen') : intact ? t('Intact') : t('Modified since it was frozen')} tone={intact === false ? 'alert' : 'default'} />
      </KpiGrid>
      <SectionCard
        title={t('Versions')}
      >
        <span>
          {versions.length
            ? versions.map((x) => (
                <span key={x.id} style={{ marginRight: 12 }}>
                  <Link href={`${base}?v=${x.number}`}>{`v${x.number}`}</Link> <span className="text-muted">{t(VERSION_STATE_LABEL[x.state])}</span>
                </span>
              ))
            : t('No version yet: the first saved section starts version 1.')}
        </span>
        {v && !draft && <span className="text-muted">{`${t('Frozen by')} ${v.frozenByName ?? '—'} · ${v.frozenAt ? fmtInstant(v.frozenAt, lang) : ''} · SHA-256 ${v.contentHash}`}</span>}
        {edit && v && !draft && <span className="text-muted">{t('Editing a section starts the next version; a circuit running on this version is then cancelled.')}</span>}
      </SectionCard>
      {secs.map((s) => {
        const sec = content.sections[s.key];
        const done = comp.bySection[s.key];
        return (
          <SectionCard
            key={s.key}
            title={t(s.title)}
            subtitle={t(s.hint)}
            actions={done == null ? <Tag tone="outline" size="sm">{t(s.mode === 'circuit' ? 'Filled by the circuit' : 'Optional')}</Tag> : <Tag tone={done ? 'neutral' : 'accent'} size="sm">{t(done ? 'Complete' : 'To complete')}</Tag>}
          >
            {s.mode === 'computed' && <ComputedValues need={s.need!} snap={snap} t={t} lang={lang} />}
            {s.mode !== 'circuit' && (edit ? <SectionForm code={c.code} kind={kind} section={s.key} text={sec.text} /> : sec.text ? <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{dataText(sec.text, lang)}</p> : null)}
            {sec.refs.length > 0 && (
              <Table>
                <thead>
                  <tr>
                    <Th>{t('Codex document')}</Th>
                    <Th>{t('Revision')}</Th>
                    <Th>{t('Title')}</Th>
                    <Th>{t('Verified')}</Th>
                    {edit && <Th />}
                  </tr>
                </thead>
                <tbody>
                  {sec.refs.map((r) => {
                    const href = codexDocumentUrl(r.id, r.revision);
                    return (
                      <tr key={r.id}>
                        <Td nowrap>{href ? <a href={href} target="_blank" rel="noreferrer">{r.id}</a> : r.id}</Td>
                        <Td>{r.revision ?? '—'}</Td>
                        <Td tone="secondary">{dataText(r.title, lang) ?? '—'}</Td>
                        <Td>{r.verified ? t('Found in Codex') : <Tag tone="outline" size="xs">{t('Not verified')}</Tag>}</Td>
                        {edit && <Td align="right"><RemoveReferenceButton code={c.code} kind={kind} section={s.key} refId={r.id} /></Td>}
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
            {edit && s.mode !== 'circuit' && <ReferenceForm code={c.code} kind={kind} section={s.key} />}
          </SectionCard>
        );
      })}
      {sigs.length > 0 && (
        <SectionCard title={t('Signatures of this version')} scroll>
          <KeyValueList
            items={sigs.map(({ s, label }) => ({
              id: s.id,
              k: `${t(label)} — ${s.userName}`,
              v: `${fmtInstant(s.signedAt, lang)} · ${s.contentHash === v?.contentHash ? t('fingerprint matches') : t('fingerprint differs')}`,
            }))}
          />
        </SectionCard>
      )}
    </>
  );
}
