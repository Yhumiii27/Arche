// Subsidiaries, sites, zones (docs/spec/08): the group organisation Arche isolates by, entered by the administrator until
// Matrix owns it (N-22); the reference revenue of each subsidiary, entered by the group CFO (typology, C-5).
import { notFound } from 'next/navigation';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { canSee } from '@/config/screens';
import { NewSiteForm, NewSubsidiaryForm, NewZoneForm, RevenueForm } from '@/features/admin/forms';
import { dataText } from '@/i18n/data-text';
import { organisation } from '@/server/dal/admin';
import { businessToday } from '@/server/clock';
import { getI18n, getViewer } from '@/server/session';

export default async function OrganisationPage() {
  const [{ t, lang }, viewer] = await Promise.all([getI18n(), getViewer()]);
  if (!canSee(viewer.role, 'admin-org')) notFound();
  const [org, today] = await Promise.all([organisation(), businessToday()]);
  const zoneName = new Map(org.zones.map((z) => [z.code, z.name]));
  const admin = viewer.role === 'admin';
  const subs = org.subsidiaries.map((x) => ({ code: x.code, name: dataText(x.name, lang) }));
  return (
    <>
      <PageHeader screen="admin-org" crumbs={['Administration']} />
      <SectionCard title={t('Zones')}>
        <span className="text-muted">{org.zones.map((z) => `${z.code} · ${dataText(z.name, lang)}`).join(' — ')}</span>
        {admin && <NewZoneForm />}
      </SectionCard>
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
        {admin && <NewSubsidiaryForm zones={org.zones.map((z) => ({ code: z.code, name: z.name }))} />}
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
        {admin && <NewSiteForm subsidiaries={subs} />}
      </SectionCard>
      <SectionCard title={t('Reference revenue')} subtitle={t('Entered by the group CFO; used for the typology (20 % threshold).')} scroll>
        {org.revenues.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Subsidiary')}</Th>
                <Th>{t('Fiscal year')}</Th>
                <Th align="right">{t('Revenue (k€)')}</Th>
                <Th>{t('Entered by')}</Th>
                <Th>{t('Source')}</Th>
              </tr>
            </thead>
            <tbody>
              {org.revenues.map((r) => (
                <tr key={`${r.subsidiaryCode}-${r.fiscalYear}`}>
                  <Td>{r.subsidiaryCode}</Td>
                  <Td>{r.fiscalYear}</Td>
                  <Td align="right" numeric>{r.revenueKeur.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')}</Td>
                  <Td tone="secondary">{r.enteredByName}</Td>
                  <Td tone="secondary">{r.sourceNote ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <span className="text-muted">{t('No reference revenue entered yet.')}</span>
        )}
        <RevenueForm subsidiaries={subs} year={+today.slice(0, 4)} />
      </SectionCard>
    </>
  );
}
