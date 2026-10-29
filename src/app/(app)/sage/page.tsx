// Sage import (AR-047, DECISIONS.md §5) for the subsidiary chosen in the sidebar: the Sage analytic code of each lot outside
// EPC2i, the extraction files imported (uploaded, from the planned extraction or the demonstration one) and the lines rejected.
// Orders are the commitments, invoices and credit notes the actuals; the controller's manual entry and CSV template stay.
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { canSee } from '@/config/screens';
import { holdsOn } from '@/domain/capex';
import { DemoSageButton, SageCodeForm, SageImportForm } from '@/features/sage/forms';
import { dataText } from '@/i18n/data-text';
import { fmtInstant } from '@/lib/format';
import { getConfig } from '@/server/config';
import { getDb } from '@/server/db/client';
import { capexLots } from '@/server/db/schema';
import { databaseSeedMode } from '@/server/db/seed/mode';
import { visibleCapex } from '@/server/dal/capex';
import { subsidiaryChoice } from '@/server/dal/portfolio';
import { sageImportsOf } from '@/server/integrations/sage/import';
import { getI18n, getSubsidiaryCookie, getViewer } from '@/server/session';
import { asc, inArray } from 'drizzle-orm';

const SOURCE: Record<string, string> = { upload: 'Uploaded', folder: 'Planned extraction', demo: 'Demonstration' };

export default async function SagePage() {
  const [{ t, lang }, viewer, cookie] = await Promise.all([getI18n(), getViewer(), getSubsidiaryCookie()]);
  if (!canSee(viewer.role, 'sage')) notFound();
  const choice = await subsidiaryChoice(viewer, cookie);
  const sub = choice.current;
  const db = await getDb();
  const writer = !!sub && (viewer.role === 'controller' || viewer.role === 'group_cfo') && holdsOn(viewer.assignments, viewer.role, { code: '', subsidiaryCode: sub, status: 'active' });
  const seen = sub ? (await visibleCapex(viewer)).filter((c) => c.subsidiaryCode === sub && c.status !== 'abandoned') : [];
  const lots = seen.length ? await db.select().from(capexLots).where(inArray(capexLots.capexId, seen.map((c) => c.id))).orderBy(asc(capexLots.number)) : [];
  const imports = sub ? await sageImportsOf(db, sub) : [];
  const last = imports[0] ?? null;
  const demo = (await databaseSeedMode(db)) === 'demo' && sub === 'SAI';
  const folder = getConfig().sageDir;
  const subName = choice.options.find((o) => o.code === sub)?.name ?? null;
  return (
    <>
      <PageHeader screen="sage" crumbs={['Subsidiary portfolio']} primary={writer && sub ? <SageImportForm subsidiaryCode={sub} /> : undefined} actions={writer && demo ? <DemoSageButton subsidiaryCode={sub!} /> : undefined} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Tag tone="outline" size="sm">{`${sub ?? '—'} · ${dataText(subName, lang) ?? ''}`}</Tag>
        <Tag tone="outline" size="sm">{folder ? `${t('Planned extraction')}: ${folder}` : t('No planned extraction: files are uploaded here (Sage access by the DSI: N-14)')}</Tag>
      </div>
      <KpiGrid>
        <KpiTile label={t('Lots with a Sage code')} value={`${lots.filter((l) => !l.epc2i && l.sageCode).length} / ${lots.filter((l) => !l.epc2i).length}`} sub={t('lots outside EPC2i')} />
        <KpiTile label={t('Last import')} value={last ? fmtInstant(last.importedAt, lang) : '—'} sub={last ? `${t(SOURCE[last.source])} · ${last.importedByName}` : undefined} />
        <KpiTile label={t('Lines kept')} value={last?.accepted ?? '—'} sub={last ? `${last.duplicates} ${t('already imported')}` : undefined} />
        <KpiTile label={t('Lines rejected')} value={last?.rejected ?? '—'} tone={last?.rejected ? 'alert' : 'default'} />
      </KpiGrid>
      <SectionCard title={t('Lots and their Sage code')} hint={t('The extraction’s lines with a lot’s analytic code go to that lot; EPC2i lots come from Keystone')} scroll>
        {lots.length ? (
          <Table>
            <thead><tr><Th>CAPEX</Th><Th>{t('Lot')}</Th><Th>{t('Sage analytic code')}</Th>{writer && <Th />}</tr></thead>
            <tbody>
              {[...lots].sort((a, b) => seen.find((x) => x.id === a.capexId)!.code.localeCompare(seen.find((x) => x.id === b.capexId)!.code) || a.number - b.number).map((l) => {
                const c = seen.find((x) => x.id === l.capexId)!;
                return (
                  <tr key={l.id}>
                    <Td nowrap>{c.code}</Td>
                    <Td>{`${l.number} · ${dataText(l.title, lang)}`}</Td>
                    <Td>{l.epc2i ? <Tag tone="outline" size="xs">EPC2i</Tag> : l.sageCode ?? '—'}</Td>
                    {writer && <Td align="right">{!l.epc2i && <SageCodeForm code={c.code} lotId={l.id} value={l.sageCode} label={`${c.code} · ${l.number} · ${dataText(l.title, lang)}`} />}</Td>}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No CAPEX in this subsidiary.')}</EmptyState>
        )}
      </SectionCard>
      <SectionCard title={t('Imports')} scroll>
        {imports.length ? (
          <Table>
            <thead><tr><Th>{t('Date')}</Th><Th>{t('Source')}</Th><Th>{t('File')}</Th><Th align="right">{t('Lines')}</Th><Th align="right">{t('Lines kept')}</Th><Th align="right">{t('Already imported')}</Th><Th align="right">{t('Lines rejected')}</Th><Th>{t('By')}</Th></tr></thead>
            <tbody>
              {imports.map((i) => (
                <tr key={i.id}>
                  <Td nowrap>{fmtInstant(i.importedAt, lang)}</Td>
                  <Td>{t(SOURCE[i.source])}</Td>
                  <Td tone="secondary">{i.fileName ?? '—'}</Td>
                  <Td align="right" numeric>{i.lines}</Td>
                  <Td align="right" numeric>{i.accepted}</Td>
                  <Td align="right" numeric>{i.duplicates}</Td>
                  <Td align="right" numeric>{i.rejected ? <Tag tone="accent" size="sm">{String(i.rejected)}</Tag> : 0}</Td>
                  <Td tone="secondary">{i.importedByName}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No import yet.')}</EmptyState>
        )}
      </SectionCard>
      {last && last.rejects.length > 0 && (
        <SectionCard title={t('Lines rejected by the last import')} scroll>
          <Table>
            <thead><tr><Th align="right">{t('Line')}</Th><Th>{t('Reason')}</Th><Th>{t('Content')}</Th></tr></thead>
            <tbody>
              {last.rejects.map((r) => (
                <tr key={r.id}><Td align="right" numeric>{r.lineNo}</Td><Td>{t(r.reason)}</Td><Td tone="secondary">{r.raw}</Td></tr>
              ))}
            </tbody>
          </Table>
        </SectionCard>
      )}
    </>
  );
}
