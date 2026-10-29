import 'server-only';
// Sage's planned extraction (AR-047): the files dropped in ARCHE_SAGE_DIR — named after the subsidiary (`SAI_2026-10.csv`) —
// imported one by one by the job `sage-import`, then moved to `done/` (or `rejected/` when the file is unreadable).
import { mkdir, readdir, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { subsidiaries } from '@/server/db/schema';
import type { DB } from '@/server/db/types';
import { importSage } from './import';

export async function importSageFolder(db: DB, dir: string, today: string): Promise<string> {
  const subs = (await db.select({ code: subsidiaries.code }).from(subsidiaries)).map((s) => s.code);
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.toLowerCase().endsWith('.csv')).sort();
  const out: string[] = [];
  for (const f of files) {
    const sub = subs.find((s) => f.toUpperCase().startsWith(s));
    const target = async (folder: string) => {
      await mkdir(path.join(dir, folder), { recursive: true });
      await rename(path.join(dir, f), path.join(dir, folder, f));
    };
    if (!sub) {
      await target('rejected');
      out.push(`${f}: no subsidiary`);
      continue;
    }
    const csv = await readFile(path.join(dir, f), 'utf8');
    const r = await db.transaction((tx) => importSage(tx, { subsidiaryCode: sub, csv, source: 'folder', fileName: f, byName: 'Sage (planned extraction)', byUserId: null, today }));
    await target(r.ok ? 'done' : 'rejected');
    out.push(r.ok ? `${f}: ${r.accepted} kept, ${r.duplicates} already imported, ${r.rejected} rejected` : `${f}: ${r.error}`);
  }
  return out.length ? out.join('; ') : 'no file';
}
