// Subsidiaries, sites, zones (docs/spec/08): the group organisation Arche isolates by, entered by the administrator until
// Matrix owns it (N-22); the reference revenue of each subsidiary, entered by the group CFO (typology, C-5), and the group's
// reference exchange rates, by month or fiscal year (AR-039: amounts typed in a subsidiary's currency are converted with them).
import { notFound } from 'next/navigation';
import { SectionCard } from '@/components/app/SectionCard';
import { Folded } from '@/components/app/ActionForm';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { canSee } from '@/config/screens';
import { NewSiteForm, NewSubsidiaryForm, NewZoneForm, RateForm, RevenueForm } from '@/features/admin/forms';
import { getDb } from '@/server/db/client';
import { ratesOf } from '@/server/dal/currency';
import { assetClassesOf } from '@/server/dal/finance';
import { AssetClassForm } from '@/features/finance/forms';
import { LOT_KINDS, LOT_KIND_LABEL, type LotKind } from '@/domain/capex';
import { dataText } from '@/i18n/data-text';
import { organisation } from '@/server/dal/admin';
import { businessToday } from '@/server/clock';
import { getI18n, getViewer } from '@/server/session';

export default async function OrganisationPage() {
  const [{ t, lang }, viewer] = await Promise.all([getI18n(), getViewer()]);
  if (!canSee(viewer.role, 'admin-org')) notFound();
  const [org, today, rates, classes] = await Promise.all([organisation(), businessToday(), getDb().then((db) => ratesOf(db)), getDb().then((db) => assetClassesOf(db))]);
  const kinds = LOT_KINDS.map((k) => ({ value: k, label: t(LOT_KIND_LABEL[k]) }));
  const cfo = viewer.role === 'group_cfo';
  const currencies = [...new Set(org.subsidiaries.map((x) => x.currency).filter((c) => c !== 'EUR'))].sort();
  const zoneName = new Map(org.zones.map((z) => [z.code, z.name]));
  const admin = viewer.role === 'admin';
  const subs = org.subsidiaries.map((x) => ({ code: x.code, name: dataText(x.name, lang) }));
  return (
    <>
      <PageHeader
        screen="admin-org"
        crumbs={['Administration']}
        actions={
          <>
            {admin && <Folded summary="Add a site"><NewSiteForm subsidiaries={subs} /></Folded>}
            {admin && <Folded summary="Add a subsidiary"><NewSubsidiaryForm zones={org.zones.map((z) => ({ code: z.code, name: z.name }))} /></Folded>}
            {admin && <Folded summary="Add a zone"><NewZoneForm /></Folded>}
            <Folded summary="Enter the reference revenue"><RevenueForm subsidiaries={subs} year={+today.slice(0, 4)} /></Folded>
            {currencies.length > 0 && <Folded summary="Enter an exchange rate"><RateForm currencies={currencies} month={today.slice(0, 7)} /></Folded>}
            {cfo && <AssetClassForm kinds={kinds} />}
          </>
        }
      />
      <SectionCard title={t('Zones')}>
        <span className="text-muted">{org.zones.map((z) => `${z.code} · ${dataText(z.name, lang)}`).join(' — ')}</span>
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
      </SectionCard>
      <SectionCard title={t('Exchange rates')} subtitle={t('Units of the currency for one euro; the month’s rate, else the fiscal year’s, converts the amounts typed in a subsidiary’s currency.')} scroll>
        {rates.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Currency')}</Th>
                <Th>{t('Month or fiscal year')}</Th>
                <Th align="right">{t('Units for one euro')}</Th>
                <Th>{t('Entered by')}</Th>
                <Th>{t('Source')}</Th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={`${r.currency}-${r.period}`}>
                  <Td>{r.currency}</Td>
                  <Td>{r.period}</Td>
                  <Td align="right" numeric>{r.unitsPerEur.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 6 })}</Td>
                  <Td tone="secondary">{r.enteredByName}</Td>
                  <Td tone="secondary">{dataText(r.note, lang) ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <span className="text-muted">{t('No exchange rate entered yet.')}</span>
        )}
      </SectionCard>
      <SectionCard title={t('Asset classes')} subtitle={t('Useful life and method of the fixed assets; each lot takes the class chosen for it, else the class of its kind.')} scroll>
        {classes.length ? (
          <Table>
            <thead>
              <tr><Th>{t('Code')}</Th><Th>{t('Label')}</Th><Th align="right">{t('Useful life (years)')}</Th><Th>{t('Method')}</Th><Th>{t('Default class of the lots of kind')}</Th>{cfo && <Th />}</tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.code}>
                  <Td>{c.code}</Td>
                  <Td>{dataText(c.label, lang)}</Td>
                  <Td align="right" numeric>{c.lifeYears}</Td>
                  <Td>{c.method === 'declining' ? `${t('Declining balance')} × ${c.factor}` : t('Straight line')}</Td>
                  <Td tone="secondary">{c.lotKinds.map((k) => t(LOT_KIND_LABEL[k as LotKind] ?? k)).join(', ') || '—'}</Td>
                  {cfo && <Td align="right"><AssetClassForm kinds={kinds} value={c} /></Td>}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <span className="text-muted">{t('No asset class yet.')}</span>
        )}
      </SectionCard>
    </>
  );
}
