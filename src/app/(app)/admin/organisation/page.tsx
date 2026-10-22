// Subsidiaries, sites, zones (docs/spec/08): the group organisation Arche isolates by. Read-only in delivery 1 (the demo data
// set or the administrator's later entry; Matrix may own it, N-22).
import { notFound } from 'next/navigation';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { canSee } from '@/config/screens';
import { dataText } from '@/i18n/data-text';
import { organisation } from '@/server/dal/admin';
import { getI18n, getViewer } from '@/server/session';

export default async function OrganisationPage() {
  const [{ t, lang }, viewer] = await Promise.all([getI18n(), getViewer()]);
  if (!canSee(viewer.role, 'admin-org')) notFound();
  const org = await organisation();
  const zoneName = new Map(org.zones.map((z) => [z.code, z.name]));
  return (
    <>
      <PageHeader screen="admin-org" crumbs={['Administration']} />
      <SectionCard title={t('Subsidiaries')} scroll>
        <Table>
          <thead>
            <tr>
              <Th>{t('Code')}</Th>
              <Th>{t('Name')}</Th>
              <Th>{t('Country')}</Th>
              <Th>{t('Zone')}</Th>
              <Th>{t('Currency')}</Th>
            </tr>
          </thead>
          <tbody>
            {org.subsidiaries.map((s) => (
              <tr key={s.code}>
                <Td>{s.code}</Td>
                <Td>{dataText(s.name, lang)}</Td>
                <Td>{s.countryIso2}</Td>
                <Td>{dataText(zoneName.get(s.zoneCode) ?? s.zoneCode, lang)}</Td>
                <Td>{s.currency}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </SectionCard>
      <SectionCard title={t('Sites')} scroll>
        <Table>
          <thead>
            <tr>
              <Th>{t('Subsidiary')}</Th>
              <Th>{t('Name')}</Th>
              <Th>{t('City')}</Th>
            </tr>
          </thead>
          <tbody>
            {org.sites.map((s) => (
              <tr key={s.id}>
                <Td>{s.subsidiaryCode}</Td>
                <Td>{dataText(s.name, lang)}</Td>
                <Td>{s.city ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </SectionCard>
      <SectionCard title={t('Reference revenue')} subtitle={t('Entered by the group CFO; used for the typology (20 % threshold).')}>
        {org.revenues.length ? null : <span className="text-muted">{t('No reference revenue entered yet.')}</span>}
      </SectionCard>
    </>
  );
}
