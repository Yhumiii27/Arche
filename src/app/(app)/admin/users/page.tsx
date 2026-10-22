// Users & roles (docs/spec/08): accounts and their role assignments with their scope. Read-only in delivery 1.
import { notFound } from 'next/navigation';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { ROLE_LABEL } from '@/config/roles';
import { canSee } from '@/config/screens';
import { usersWithAssignments } from '@/server/dal/admin';
import { getI18n, getViewer } from '@/server/session';

export default async function UsersPage() {
  const [{ t }, viewer] = await Promise.all([getI18n(), getViewer()]);
  if (!canSee(viewer.role, 'admin-users')) notFound();
  const rows = await usersWithAssignments();
  return (
    <>
      <PageHeader screen="admin-users" crumbs={['Administration']} />
      <SectionCard title={t('Accounts')} hint={String(rows.length)} scroll>
        <Table>
          <thead>
            <tr>
              <Th>{t('Name')}</Th>
              <Th>{t('E-mail')}</Th>
              <Th>{t('Subsidiary')}</Th>
              <Th>{t('Roles and scopes')}</Th>
              <Th>{t('Status')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <Td>{u.displayName}</Td>
                <Td tone="secondary">{u.email}</Td>
                <Td>{u.subsidiaryCode ?? '—'}</Td>
                <Td>{u.assignments.map((a) => `${t(ROLE_LABEL[a.role])}${a.scopeRef ? ` · ${a.scopeRef}` : ''}`).join(' ; ') || '—'}</Td>
                <Td>{u.active ? t('Active') : t('Deactivated')}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </SectionCard>
    </>
  );
}
