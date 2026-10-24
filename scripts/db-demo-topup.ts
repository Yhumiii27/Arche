// npm run db:demo-topup — completes an existing demonstration database with what later lots added to the data set (sites and
// their coordinates, CAPEX, COPIL GPI, lessons learned, action plans, WBS), in one transaction, without changing or removing
// anything (src/server/db/seed/demo-topup.ts). Refused on a database not seeded with the demonstration data set. Run it once
// on a server whose demo database predates those lots (Coolify: Terminal of the app container). docs/EXPLOITATION.md §4.5.
//   npx tsx --conditions=react-server scripts/db-demo-topup.ts
import { loadEnvFiles } from '@/server/config/env-files';

async function main(): Promise<void> {
  loadEnvFiles(process.cwd());
  const { assertValidConfig } = await import('@/server/config');
  const { openPostgres } = await import('@/server/db/postgres');
  const { topUpDemo, unlocatedSites } = await import('@/server/db/seed/demo-topup');
  const { config } = assertValidConfig({ strict: true });
  if (!config.database) throw new Error('DATABASE_URL is not set');
  const h = await openPostgres({ url: config.database.url, poolMax: 1, applicationName: 'arche-demo-topup' });
  try {
    const { r, left } = await h.db.transaction(async (tx) => ({ r: await topUpDemo(tx), left: await unlocatedSites(tx) }));
    console.log([
      'Demonstration data set completed:',
      `  people added: ${r.people}, roles added: ${r.roles}`,
      `  sites added: ${r.sites}, sites located: ${r.located}${left ? ` (${left} other site(s) still without coordinates: Administration › Subsidiaries, sites, zones)` : ''}`,
      `  CAPEX added: ${r.capex.length ? r.capex.join(', ') : 'none'}${r.copil ? ' (G1 of CPX-SAI-2026-02 in front of the COPIL GPI)' : ''}`,
      `  lessons learned added: ${r.rex}`,
      `  action plans: ${r.actions.length ? r.actions.join(', ') : 'already there'}`,
      `  WBS: ${r.wbs.length ? r.wbs.join(', ') : 'already there'}`,
    ].join('\n'));
  } finally {
    await h.close().catch(() => null);
  }
}

main().then(() => process.exit(0), (e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
