// Exports (AR-042) on a fresh database with the demo data set ("View as"): each table follows the viewer's visibility (a
// project lead of APM never gets a SAI CAPEX; a CAPEX outside the scope is a 404), the Excel workbook and the server PDF of the
// Copil report and of a dossier.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined), set: () => undefined }),
  headers: async () => new Headers(),
}));

import { testDatabase, type TestDatabase } from '@/test/db';
import { GET as exportGet } from '@/app/export/[dataset]/route';
import { GET as reportPdf } from '@/app/print/capex/[code]/report/pdf/route';
import { GET as dossierPdf } from '@/app/print/capex/[code]/dossiers/[kind]/pdf/route';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());
beforeEach(() => {
  jar.clear();
  jar.set('arche-lang', 'fr');
});

const run = (dataset: string, query = '') => exportGet(new Request(`http://arche.test/export/${dataset}?${query}`), { params: Promise.resolve({ dataset }) });

describe('exports (AR-042)', () => {
  it('the register as CSV for the viewer: the CAPEX of their scope only', async () => {
    jar.set('arche-role', 'project_lead');
    const r = await run('register', 'format=csv');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(r.headers.get('content-disposition')).toMatch(/^attachment; filename="arche-registre-des-capex-\d{4}-\d{2}-\d{2}\.csv"$/);
    const csv = await r.text();
    expect(csv.split('\r\n')[0]).toBe('Code;Intitulé;Filiale;Zone;Site;Statut;Phase;Typologie;Chef de projet;Budget validé (k€);Classe d’estimation;Prochain jalon');
    expect(csv).toContain('CPX-APM-2026-01;');
    expect(csv).not.toContain('CPX-SAI-');
  });

  it('the group portfolio for Excel, the alerts, a CAPEX’s committed and spent; outside the scope: 404', async () => {
    jar.set('arche-role', 'ceo');
    const x = await run('portfolio-group', 'format=xlsx');
    expect(x.headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const bytes = Buffer.from(await x.arrayBuffer());
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    expect(bytes.toString('utf8')).toContain('CPX-SAI-2026-01');
    expect(await (await run('alerts', 'format=csv')).text()).toContain('CPX-SAI-2026-01');
    const exec = await (await run('execution', 'format=csv&capex=CPX-SAI-2026-01')).text();
    expect(exec.split('\r\n')[0]).toContain('Engagé (k€)');
    expect(exec.split('\r\n').length).toBeGreaterThan(3);
    jar.set('arche-role', 'project_lead');
    expect((await run('execution', 'format=csv&capex=CPX-SAI-2026-01')).status).toBe(404);
    expect((await run('unknown')).status).toBe(404);
  });

  it('the Copil report and a dossier as PDF written by the server; outside the scope: 404', async () => {
    jar.set('arche-role', 'project_lead');
    const r = await reportPdf(new Request('http://arche.test/x'), { params: Promise.resolve({ code: 'CPX-APM-2026-01' }) });
    expect(r.headers.get('content-type')).toBe('application/pdf');
    expect(Buffer.from(await r.arrayBuffer()).subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
    const d = await dossierPdf(new Request('http://arche.test/x'), { params: Promise.resolve({ code: 'CPX-APM-2026-01', kind: 'business_case' }) });
    expect(d.status).toBe(200);
    expect(d.headers.get('content-disposition')).toMatch(/\.pdf"$/);
    expect((await reportPdf(new Request('http://arche.test/x'), { params: Promise.resolve({ code: 'CPX-SAI-2026-01' }) })).status).toBe(404);
  });
});
