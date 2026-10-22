import { defineConfig } from 'drizzle-kit';

// Arche's tables live in the schema `arche` (src/server/db/schema/_schema.ts); the journal is arche.__drizzle_migrations.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema/index.ts',
  out: './drizzle',
  schemaFilter: ['arche'],
  migrations: { schema: 'arche', table: '__drizzle_migrations' },
});
