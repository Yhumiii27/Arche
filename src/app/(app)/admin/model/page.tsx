// DIG-PRODI model (docs/spec/03, 08): the structure of version 4.0 — phases, gates, criteria — shipped with the code, and its
// adjustable values (delays, thresholds), changed by the administrator. The HS table and the staffing and pack templates come
// with delivery 5.
import { notFound } from 'next/navigation';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { canSee } from '@/config/screens';
import { CRITERIA, GATES, GATE_DECIDER, GATE_LABEL, MODEL_VERSION } from '@/domain/lifecycle';
import { ROLE_LABEL } from '@/config/roles';
import { ModelValuesForm } from '@/features/admin/forms';
import { getDb } from '@/server/db/client';
import { modelValues } from '@/server/dal/cycle';
import { getI18n, getViewer } from '@/server/session';

export default async function ModelPage() {
  const [{ t }, viewer] = await Promise.all([getI18n(), getViewer()]);
  if (!canSee(viewer.role, 'admin-model')) notFound();
  const values = await modelValues(await getDb());
  return (
    <>
      <PageHeader screen="admin-model" crumbs={['Administration']} />
      <SectionCard title={`${t('Values of the model')} DIG-PRODI ${MODEL_VERSION}`}>
        {viewer.role === 'admin' ? (
          <ModelValuesForm values={values} />
        ) : (
          <span className="text-muted">{`${t('Strategic from (% of revenue)')}: ${values.strategicRatioPct} · G1: ${values.gateDelayDays.G1} · G2: ${values.gateDelayDays.G2}`}</span>
        )}
      </SectionCard>
      <SectionCard title={t('Gates and criteria')} scroll>
        <Table>
          <thead>
            <tr>
              <Th>{t('Gate')}</Th>
              <Th>{t('Criterion')}</Th>
              <Th>{t('Blocking')}</Th>
              <Th>{t('Delivery')}</Th>
            </tr>
          </thead>
          <tbody>
            {GATES.flatMap((g) =>
              CRITERIA.filter((c) => c.gate === g).map((c, i) => (
                <tr key={c.code}>
                  <Td nowrap>{i === 0 ? `${g} · ${t(GATE_LABEL[g])} (${t(ROLE_LABEL[GATE_DECIDER[g]])})` : ''}</Td>
                  <Td>{t(c.label)}</Td>
                  <Td tone="secondary">{c.blocking ? (c.forcible ? t('Yes') : t('Yes, cannot be forced')) : t('Alert')}</Td>
                  <Td tone="secondary">{c.from}</Td>
                </tr>
              )),
            )}
          </tbody>
        </Table>
      </SectionCard>
    </>
  );
}
