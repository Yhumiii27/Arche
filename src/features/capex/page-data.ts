import 'server-only';
// What every CAPEX page needs: the viewer, the CAPEX through the visibility filter (outside it: 404), its full row and the
// write rights of the active role (src/domain/capex.ts).
import { notFound } from 'next/navigation';
import { canDo, type CapexAction } from '@/domain/capex';
import { getDb } from '@/server/db/client';
import { capexForViewer } from '@/server/dal/capex';
import { capexRow } from '@/server/dal/cycle';
import { getI18n, getViewer } from '@/server/session';

export async function loadCapexPage(params: Promise<{ code: string }>) {
  const { code } = await params;
  const [i18n, viewer] = await Promise.all([getI18n(), getViewer()]);
  const seen = await capexForViewer(viewer, decodeURIComponent(code));
  if (!seen) notFound();
  const db = await getDb();
  const row = await capexRow(db, seen.id);
  if (!row) notFound();
  const can = (a: CapexAction) => canDo(a, viewer.role, viewer.assignments, row);
  return { ...i18n, viewer, db, c: { ...seen, ...row }, can };
}
