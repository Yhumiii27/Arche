import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Tests run on PostgreSQL (src/test/db.ts: one fresh database per file on ARCHE_TEST_ADMIN_URL's server). DATABASE_URL is a
// placeholder the configuration requires; the tests point getDb() at their own database. ARCHE_AUTH empty: demo mode (the
// Entra tests set it themselves). ARCHE_CLOCK pinned to the demo data set's date, Thu 22 Oct 2026 (unset is the real clock).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: { DATABASE_URL: 'postgres://arche_app:unused@127.0.0.1:5432/arche_unused', ARCHE_AUTH: '', ARCHE_CLOCK: '2026-10-22', ARCHE_SEED: '' },
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src'), 'server-only': path.resolve(__dirname, 'src/test/server-only-stub.ts') } },
});
