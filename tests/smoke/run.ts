// Smoke test of a running Arche (production build, demo data set): health, the pages of each profile, subsidiary isolation
// over HTTP (a CAPEX of another subsidiary answers 404), the security headers and the French rendering.
//   ARCHE_SMOKE_URL=http://127.0.0.1:3410 npx tsx tests/smoke/run.ts
const BASE = (process.env.ARCHE_SMOKE_URL || 'http://127.0.0.1:3410').replace(/\/+$/, '');

let failures = 0;
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures++;
}

async function get(path: string, role?: string): Promise<{ status: number; body: string; headers: Headers }> {
  const r = await fetch(BASE + path, { headers: role ? { cookie: `arche-role=${role}` } : {}, redirect: 'manual' });
  return { status: r.status, body: await r.text(), headers: r.headers };
}

const codes = (html: string) => [...new Set(html.match(/CPX-[A-Z]{3}-\d{4}-\d{2}/g) ?? [])].sort();

async function main(): Promise<void> {
  const health = await get('/api/health');
  check(health.status === 200 && JSON.parse(health.body).status === 'ok', 'GET /api/health → 200 ok');

  const home = await get('/', 'dir_ig');
  check(home.status === 200 && home.body.includes('Bonjour Claire'), 'Home in French for the group industrial director');
  check(!!home.headers.get('content-security-policy')?.includes("'nonce-"), 'per-request Content-Security-Policy with a nonce');
  check(home.headers.get('x-frame-options') === 'DENY', 'X-Frame-Options: DENY');

  const expected: Record<string, string[]> = {
    ceo: ['CPX-APM-2026-01', 'CPX-APM-2026-02', 'CPX-SAI-2026-01'],
    dir_ig: ['CPX-APM-2026-01', 'CPX-SAI-2026-01'],
    sponsor: ['CPX-APM-2026-01', 'CPX-APM-2026-02'],
    zone_director: ['CPX-APM-2026-01'],
    epc2i_pmo: ['CPX-SAI-2026-01'],
  };
  for (const [role, want] of Object.entries(expected)) {
    const r = await get('/capex', role);
    check(r.status === 200 && JSON.stringify(codes(r.body)) === JSON.stringify(want), `CAPEX register of ${role}: ${want.join(', ')}`);
  }

  check((await get('/capex/CPX-SAI-2026-01', 'sponsor')).status === 404, 'a subsidiary sponsor gets 404 on another subsidiary’s CAPEX');
  check((await get('/capex/CPX-APM-2026-02', 'group_cfo')).status === 404, 'a central function gets 404 on a draft');
  const overview = await get('/capex/CPX-APM-2026-01', 'project_lead');
  check(overview.status === 200 && overview.body.includes('Deuxième ligne d’extrusion'), 'CAPEX overview of the project lead');
  check((await get('/admin/users', 'sponsor')).status === 404, 'administration refused to a sponsor (404)');
  check((await get('/admin/users', 'admin')).status === 200, 'administration open to the administrator');
  check(overview.body.includes('Cycle DIG-PRODI') && overview.body.includes('Budget E10 validé par la DAF groupe'), 'the overview shows the gate the CAPEX faces and its criteria');
  const budget = await get('/capex/CPX-APM-2026-01/budget', 'project_lead');
  check(budget.status === 200 && budget.body.includes('Versions de budget') && budget.body.includes('E30'), 'budget page: lots and versions');
  for (const page of ['risks', 'governance', 'journal']) check((await get(`/capex/CPX-SAI-2026-01/${page}`, 'epc2i_pmo')).status === 200, `CAPEX page ${page} opens for a team member`);
  check((await get('/admin/model', 'admin')).status === 200, 'DIG-PRODI model page for the administrator');
  const gatesPage = await get('/capex/CPX-APM-2026-01/gates', 'project_lead');
  check(gatesPage.status === 200 && gatesPage.body.includes('Sessions précédentes') && gatesPage.body.includes('Avis HSE'), 'gates page: criteria and the G1 circuit of the demo');
  const dossier = await get('/capex/CPX-APM-2026-01/dossiers/business_case', 'dir_ig');
  check(dossier.status === 200 && dossier.body.includes('Intègre') && dossier.body.includes('NOT-CPX-APM-2026-01-001'), 'living dossier: fingerprint checked, Codex references');
  check((await get('/print/capex/CPX-APM-2026-01/dossiers/business_case', 'project_lead')).status === 200, 'print view of a dossier');
  check((await get('/print/capex/CPX-APM-2026-01/dossiers/business_case', 'expert')).status === 404, 'print view outside the scope is not found');
  const inbox = await get('/my/approvals', 'dir_ig');
  check(inbox.status === 200 && inbox.body.includes('MOC-02'), 'my approvals of the group industrial director: the change to decide');
  check((await get('/capex/CPX-SAI-2026-01/changes', 'dir_ig')).status === 200, 'management of change page');
  check((await get('/admin/delegation', 'admin')).status === 200, 'delegation matrix page for the administrator');
  const soon = await get('/capex/CPX-APM-2026-01/machines', 'project_lead');
  check(soon.status === 200 && soon.body.includes('Prévu pour la livraison 4'), 'a screen of a later delivery says when it comes');
  check((await get('/capex/CPX-SAI-2026-01/budget', 'sponsor')).status === 404, 'every page of another subsidiary’s CAPEX is not found');
  check((await get('/nowhere', 'dir_ig')).status === 404, 'an unknown path is not found');

  if (failures) {
    console.error(`${failures} smoke check(s) failed`);
    process.exit(1);
  }
  console.log('All smoke checks passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
