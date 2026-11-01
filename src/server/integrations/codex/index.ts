import 'server-only';
// Codex connector (docs/CONTRATS.md §2.3; N-17: Codex hosts every document of Arche). Arche keeps references only — the
// identifier TYPE-CONTEXT-SEQ, the revision and the deep link — and checks them against `codex.pub_documents` when Codex
// shares its schema with Arche on the EPC2I server (CX-05). Without it (development, tests, before the grant), the
// demonstration data set uses a simulated catalogue and other references stay "not verified". Arche writes to Codex only by
// its deposit API (./deposit.ts, CX-03): a file from a section, the PDF of a frozen version; CX-07 (frozen in Codex) is open.
import { sql } from 'drizzle-orm';
import { databaseSeedMode } from '@/server/db/seed/mode';
import type { DB, Tx } from '@/server/db/types';

export interface CodexDocument {
  id: string;
  title: string;
  typeCode: string;
  /** Revision in force (letter), null before the first approval. */
  revision: string | null;
  status: string;
}

export type CodexLookup = { found: true; source: 'codex' | 'simulation'; doc: CodexDocument } | { found: false; source: 'codex' | 'simulation' | 'unavailable' };

/** Simulated Codex documents of the demonstration CAPEX (the identifiers follow Codex's TYPE-CONTEXT-SEQ). */
export const SIMULATED_DOCUMENTS: readonly CodexDocument[] = [
  { id: 'NOT-CPX-APM-2026-01-001', title: 'Market study — extruded profiles 2027–2031', typeCode: 'NOT', revision: 'B', status: 'in_force' },
  { id: 'NOT-CPX-APM-2026-01-002', title: 'HazID report — second extrusion line', typeCode: 'NOT', revision: 'A', status: 'in_force' },
  { id: 'PID-CPX-APM-2026-01-001', title: 'P&ID — extrusion line and cooling', typeCode: 'PID', revision: 'A', status: 'in_force' },
  { id: 'GA-CPX-APM-2026-01-001', title: 'Layout — hall 2', typeCode: 'GA', revision: 'C', status: 'in_force' },
  { id: 'AUT-CPX-APM-2026-01-001', title: 'ICPE declaration — receipt', typeCode: 'AUT', revision: 'A', status: 'in_force' },
  { id: 'NOT-CPX-SAI-2026-01-001', title: 'Business case — Thiès tomato plant', typeCode: 'NOT', revision: 'D', status: 'in_force' },
];

/** True when the EPC2I server exposes Codex's share view to Arche. */
async function codexShared(q: DB | Tx): Promise<boolean> {
  const r = await q.execute(sql`select to_regclass('codex.pub_documents') is not null and has_table_privilege(current_user, 'codex.pub_documents', 'select') as ok`);
  return !!(r.rows[0] as { ok?: boolean } | undefined)?.ok;
}

/** Looks a document up in Codex (or the simulation of the demonstration data set). */
export async function lookupCodexDocument(q: DB | Tx, id: string): Promise<CodexLookup> {
  if (await codexShared(q)) {
    const r = await q.execute(sql`select id, title, type_code, rev_in_force, status from codex.pub_documents where id = ${id} or ${id} = any(coalesce(aliases, '{}')) limit 1`);
    const row = r.rows[0] as { id: string; title: string; type_code: string; rev_in_force: string | null; status: string } | undefined;
    return row ? { found: true, source: 'codex', doc: { id: row.id, title: row.title, typeCode: row.type_code, revision: row.rev_in_force, status: row.status } } : { found: false, source: 'codex' };
  }
  if ((await databaseSeedMode(q)) === 'demo') {
    const doc = SIMULATED_DOCUMENTS.find((d) => d.id === id);
    return doc ? { found: true, source: 'simulation', doc } : { found: false, source: 'simulation' };
  }
  return { found: false, source: 'unavailable' };
}

/** Deep link to a document in Codex (same form as Keystone's: `/?document=…&revision=…`); null without NEXT_PUBLIC_CODEX_URL. */
export function codexDocumentUrl(id: string, revision?: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_CODEX_URL;
  if (!base) return null;
  const qs = new URLSearchParams({ document: id, ...(revision ? { revision } : {}) });
  return `${base.replace(/\/+$/, '')}/?${qs}`;
}
