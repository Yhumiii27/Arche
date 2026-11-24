// Matrix defines, applies and owns the pub_ views (decision M-18, Norma §5): a migration after the last one that created a
// view (0024_share_capex_currency, applied before M-18) never creates, replaces, alters, comments or drops a pub_ view, and
// never grants anything to another tool's role. A new publication or column is asked of Matrix (its REQUESTS.md).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DRIZZLE = path.join(process.cwd(), 'drizzle');
const LAST_WITH_VIEWS = 24;

const migrations = fs
  .readdirSync(DRIZZLE)
  .filter((f) => /^\d{4}_.+\.sql$/.test(f))
  .sort();

describe('pub_ views belong to Matrix (M-18)', () => {
  it('finds the migrations', () => {
    expect(migrations.length).toBeGreaterThan(LAST_WITH_VIEWS);
  });

  it('no migration after 0024 touches a pub_ view or grants to another role', () => {
    const offending: string[] = [];
    for (const f of migrations.filter((m) => Number(m.slice(0, 4)) > LAST_WITH_VIEWS)) {
      const sql = fs.readFileSync(path.join(DRIZZLE, f), 'utf8').replace(/--.*$/gm, '');
      if (/\b(CREATE|ALTER|DROP|COMMENT\s+ON)\s+(OR\s+REPLACE\s+)?(MATERIALIZED\s+)?VIEW\b[^;]*\bpub_/i.test(sql)) offending.push(`${f}: pub_ view`);
      for (const m of sql.matchAll(/\bGRANT\b[^;]*\bTO\s+("?)(\w+)\1/gi)) if (m[2] !== 'arche_app') offending.push(`${f}: GRANT … TO ${m[2]}`);
    }
    expect(offending).toEqual([]);
  });
});
