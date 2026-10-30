'use server';
// Sage connector Server Functions (AR-047): the subsidiary's controller or the group CFO imports an extraction file, sets the
// Sage analytic code of a lot, and — on the demonstration data set only — loads the demonstration extraction. Each one checks
// the role and the scope server-side; the import audits itself (src/server/integrations/sage/import.ts).
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { holdsOn } from '@/domain/capex';
import { checkSageCode, demoSageCsv } from '@/domain/sage';
import { monthOf } from '@/domain/execution';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { capexLots } from '@/server/db/schema';
import { databaseSeedMode } from '@/server/db/seed/mode';
import { auditOf, onCapex, REFUSED, type ActionResult } from '@/server/capex/write';
import { importSage, setSageCode } from '@/server/integrations/sage/import';
import { getViewer, type Viewer } from '@/server/session';

const REFUSED_SUB: ActionResult = { ok: false, error: 'Reserved to the controller of the subsidiary and the group CFO' };
const may = (v: Viewer, subsidiaryCode: string) =>
  (v.role === 'controller' || v.role === 'group_cfo') && holdsOn(v.assignments, v.role, { code: '', subsidiaryCode, status: 'active' });

const done = (r: Awaited<ReturnType<typeof importSage>>): ActionResult => {
  revalidatePath('/sage');
  return r.ok ? { ok: true } : r;
};

export async function importSageAction(subsidiaryCode: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await getViewer();
  if (!may(v, subsidiaryCode)) return REFUSED_SUB;
  const file = fd.get('file');
  if (!(file instanceof File) || !file.size) return { ok: false, error: 'Choose the extraction file' };
  if (file.size > 5_000_000) return { ok: false, error: 'The file is too large' };
  const csv = await file.text();
  const db = await getDb();
  const today = await businessToday(db);
  return done(await db.transaction((tx) => importSage(tx, { subsidiaryCode, csv, source: 'upload', fileName: file.name.slice(0, 200), byName: v.name, byUserId: v.userId, today })));
}

/** The demonstration extraction of SAI (Sage simulated, demo data set only). */
export async function loadDemoSageAction(subsidiaryCode: string): Promise<ActionResult> {
  const v = await getViewer();
  if (!may(v, subsidiaryCode)) return REFUSED_SUB;
  const db = await getDb();
  if ((await databaseSeedMode(db)) !== 'demo' || subsidiaryCode !== 'SAI') return { ok: false, error: 'The demonstration extraction is for SAI on the demonstration data set' };
  const today = await businessToday(db);
  return done(await db.transaction((tx) => importSage(tx, { subsidiaryCode, csv: demoSageCsv(monthOf(today)), source: 'demo', fileName: null, byName: v.name, byUserId: v.userId, today })));
}

/** The Sage analytic code of a lot outside EPC2i (unique in the subsidiary; empty: none). */
export async function setSageCodeAction(code: string, lotId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, null, async (tx, c, v) => {
    if (!may(v, c.subsidiaryCode)) return REFUSED;
    const [lot] = await tx.select().from(capexLots).where(eq(capexLots.id, lotId));
    if (!lot || lot.capexId !== c.id) return { ok: false, error: 'Unknown lot' };
    if (lot.epc2i) return { ok: false, error: 'EPC2i lots come from Keystone' };
    const ch = checkSageCode(fd.get('sageCode'));
    if (!ch.ok) return ch;
    const r = await setSageCode(tx, lot.id, c.subsidiaryCode, ch.value);
    if (!r.ok) return r;
    await writeAudit(tx, auditOf(v, c, `lot ${lot.number}: Sage code ${ch.value ?? 'removed'}`, { entityType: 'lot', entityId: lot.id, before: { sageCode: lot.sageCode }, after: { sageCode: ch.value } }));
    revalidatePath('/sage');
    return { ok: true };
  });
}
