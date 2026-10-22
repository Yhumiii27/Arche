// Delegation matrix (docs/spec/05 §5; C-4): the ceilings of the project steering committee and of the group industrial
// director, by typology; above them, the CEO. Dated: a new matrix is in force from the day it is saved; a change is judged with
// the matrix in force when it was submitted.
import { notFound } from 'next/navigation';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { canSee } from '@/config/screens';
import { DelegationMatrixForm } from '@/features/admin/forms';
import { fmtDate } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { matrixHistory, matrixInForce } from '@/server/dal/dossiers';
import { getI18n, getViewer } from '@/server/session';

export default async function DelegationPage() {
  const [{ t, lang }, viewer] = await Promise.all([getI18n(), getViewer()]);
  if (!canSee(viewer.role, 'admin-delegation')) notFound();
  const db = await getDb();
  const [{ validFrom, matrix }, history] = await Promise.all([matrixInForce(db, await businessToday()), matrixHistory(db)]);
  return (
    <>
      <PageHeader screen="admin-delegation" crumbs={['Administration']} />
      <SectionCard title={t('Matrix in force')} subtitle={validFrom ? `${t('In force since')} ${fmtDate(validFrom, lang)}` : t('Seed values of the specification (to replace with the group’s matrix)')}>
        <DelegationMatrixForm matrix={matrix} />
      </SectionCard>
      {history.length > 0 && (
        <SectionCard title={t('History')}>
          <Table>
            <thead>
              <tr>
                <Th>{t('In force from')}</Th>
                <Th>{t('By')}</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.validFrom}>
                  <Td>{fmtDate(h.validFrom, lang)}</Td>
                  <Td tone="secondary">{h.updatedByName}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </SectionCard>
      )}
    </>
  );
}
