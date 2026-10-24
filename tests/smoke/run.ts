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

// The CAPEX a page links to (the register's rows and the sidebar's switcher; not the code a creation dialog announces).
const codes = (html: string) => [...new Set([...html.matchAll(/href="\/capex\/(CPX-[A-Z]{3}-\d{4}-\d{2})"/g)].map((m) => m[1]))].sort();

async function main(): Promise<void> {
  const health = await get('/api/health');
  check(health.status === 200 && JSON.parse(health.body).status === 'ok', 'GET /api/health → 200 ok');

  const home = await get('/', 'dir_ig');
  check(home.status === 200 && home.body.includes('Bonjour Claire'), 'Home in French for the group industrial director');
  check(!!home.headers.get('content-security-policy')?.includes("'nonce-"), 'per-request Content-Security-Policy with a nonce');
  check(home.headers.get('x-frame-options') === 'DENY', 'X-Frame-Options: DENY');

  const expected: Record<string, string[]> = {
    ceo: ['CPX-APM-2025-01', 'CPX-APM-2026-01', 'CPX-APM-2026-02', 'CPX-SAI-2026-01', 'CPX-SAI-2026-02', 'CPX-SAI-2026-03'],
    dir_ig: ['CPX-APM-2025-01', 'CPX-APM-2026-01', 'CPX-SAI-2026-01', 'CPX-SAI-2026-02', 'CPX-SAI-2026-03'],
    sponsor: ['CPX-APM-2025-01', 'CPX-APM-2026-01', 'CPX-APM-2026-02'],
    zone_director: ['CPX-APM-2025-01', 'CPX-APM-2026-01'],
    epc2i_pmo: ['CPX-SAI-2026-01'],
  };
  for (const [role, want] of Object.entries(expected)) {
    const r = await get('/portfolio', role);
    check(r.status === 200 && JSON.stringify(codes(r.body)) === JSON.stringify(want), `group portfolio of ${role}: ${want.join(', ')}`);
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
  const machines = await get('/capex/CPX-APM-2026-01/machines', 'project_lead');
  check(machines.status === 200 && machines.body.includes('CPX-APM-2026-01/B02') && machines.body.includes('Offre ferme'), 'machine needs: the latest answer of EPC2i (simulation)');
  const epc2i = await get('/capex/CPX-SAI-2026-01/machines', 'epc2i_pmo');
  check(epc2i.status === 200 && epc2i.body.includes('SAI-26011') && epc2i.body.includes('Fin des études'), 'machine needs: the EPC2i projects and their milestones');
  check((await get('/admin/connectors', 'admin')).status === 200, 'connectors page for the administrator');
  const register = await get('/capex', 'sponsor');
  check(register.status === 200 && register.body.includes('Ouvrir un CAPEX') && register.body.includes('Atlas Process Maroc') && !register.body.includes('href="/capex/CPX-SAI-'), 'register of the subsidiary chosen, with "Open a CAPEX", for a sponsor');
  const sub = await fetch(BASE + '/capex', { headers: { cookie: 'arche-role=dir_ig; arche-subsidiary=SAI' } }).then((x) => x.text());
  check(sub.includes('href="/capex/CPX-SAI-2026-02"') && !sub.includes('href="/capex/CPX-APM-2026-01"'), 'the subsidiary selector filters the register');
  const open = await get('/open', 'sponsor');
  check(open.status === 200 && open.body.includes('Reprendre un CAPEX en cours') && open.body.includes('Récapitulatif'), 'guided opening of a CAPEX for a sponsor');
  check((await get('/', 'sponsor')).body.includes('Ouvrir un CAPEX'), '"Open a CAPEX" on the home page of a sponsor');
  check((await get('/', 'dir_ig')).body.includes('>FR<'), 'language toggle in the page header');
  const map = await get('/map', 'dir_ig');
  check(map.status === 200 && map.body.includes('Carte des CAPEX') && map.body.includes('Kénitra'), 'CAPEX map with the sites of the CAPEX');
  const adminMap = await get('/map', 'admin');
  check(adminMap.status === 200 && adminMap.body.includes('Kénitra') && !adminMap.body.includes('Lecture seule'), 'the administrator reads the CAPEX map (owner, 24 Oct 2026)');
  const adminDraft = await get('/capex/CPX-APM-2026-02', 'admin');
  check(adminDraft.status === 200 && !adminDraft.body.includes('Nouvelle action'), 'the administrator reads a draft CAPEX, without any business action');
  const overview2 = await get('/capex/CPX-APM-2026-01', 'project_lead');
  check(overview2.status === 200 && overview2.body.includes('Prochaine étape') && overview2.body.includes('Soumettre au jalon G2'), 'CAPEX overview: next step and gate action');
  const exec = await get('/capex/CPX-SAI-2026-01/execution', 'dir_ig');
  check(exec.status === 200 && exec.body.includes('Courbe en S') && exec.body.includes('Valeur acquise'), 'execution: S-curve and earned value');
  const safety = await get('/capex/CPX-SAI-2026-01/safety', 'group_hse');
  check(safety.status === 200 && safety.body.includes('HS 4 contrôle chantier') && safety.body.includes('Déclarer'), 'safety milestones declared by the group HSE');
  const permits = await get('/capex/CPX-APM-2026-01/permits', 'project_lead');
  check(permits.status === 200 && permits.body.includes('Échéance proche') && permits.body.includes('Ajouter une autorisation'), 'permits register: a decision due soon, the add action');
  const pack = await get('/capex/CPX-APM-2026-01/pack', 'project_lead');
  check(pack.status === 200 && pack.body.includes('Pack pondéré') && pack.body.includes('60'), 'engineering pack: weighted %');
  const portfolio = await get('/portfolio', 'dir_ig');
  check(portfolio.status === 200 && portfolio.body.includes('Maturité des études') && portfolio.body.includes('CPX-SAI-2026-01'), 'portfolio: maturity of the studies and the CAPEX of the group');
  check((await get('/portfolio', 'zone_director')).body.includes('CPX-SAI-2026-01') === false, 'the zone portfolio stays within the zone');
  const copil = await get('/copil', 'copil_member');
  check(copil.status === 200 && copil.body.includes('Ordre du jour'), 'COPIL GPI agenda');
  const report = await get('/print/capex/CPX-SAI-2026-01/report', 'dir_ig');
  check(report.status === 200 && report.body.includes('Rapport Copil') && report.body.includes('Risques principaux'), 'printable Copil report');
  const homeAlerts = await get('/', 'dir_ig');
  check(homeAlerts.body.includes('Alertes') && homeAlerts.body.includes('Prochains jalons'), 'home: alerts and next gates');
  const rampup = await get('/capex/CPX-APM-2025-01/rampup', 'project_lead');
  check(rampup.status === 200 && rampup.body.includes('Four de vieillissement') && rampup.body.includes('Saisir un jour'), 'ramp-up: the line of the demo CAPEX in start-up and the daily entry');
  const rex = await get('/rex', 'sponsor');
  check(rex.status === 200 && rex.body.includes('Associer le directeur d’usine dès le cadrage'), 'lessons learned library');
  check((await get('/rex', 'epc2i_pmo')).body.includes('Associer le directeur d’usine') === false, 'the library follows the subsidiary isolation');
  const copilAgendaPage = await get('/copil', 'dir_ig');
  check(copilAgendaPage.status === 200 && copilAgendaPage.body.includes('CPX-SAI-2026-02') && copilAgendaPage.body.includes('CPX-SAI-2026-03'), 'COPIL GPI: a G1 in review and a recent G1 decision');
  check((await get('/rex', 'dir_ig')).body.includes('Séparer les accès chantier'), 'lessons learned of several CAPEX in the library');
  const plan = await get('/capex/CPX-APM-2026-01/actions', 'project_lead');
  check(plan.status === 200 && plan.body.includes('Plan d’actions') && plan.body.includes('Commander l’étude de sol') && plan.body.includes('En retard'), 'action plan of a CAPEX: open and late actions');
  check((await get('/capex/CPX-APM-2026-01/risks', 'project_lead')).body.includes('Nouvelle action'), '"New action" in the header of a CAPEX page');
  check((await get('/', 'project_lead')).body.includes('Mes actions'), 'my actions on the home page');
  const wbs = await get('/capex/CPX-SAI-2026-01/schedule', 'dir_ig');
  check(wbs.status === 200 && wbs.body.includes('Gantt du CAPEX') && wbs.body.includes('Terrassements') && wbs.body.includes('Projet EPC2i'), 'WBS & Gantt of a CAPEX with an EPC2i summary bar');
  check((await get('/portfolio', 'dir_ig')).body.includes('Planning des CAPEX'), 'group portfolio: one summary bar per CAPEX');
  const kpi = await get('/kpi', 'dir_ig');
  check(kpi.status === 200 && kpi.body.includes('Objectifs DIG-PRODI') && kpi.body.includes('Délai de validation du G1') && kpi.body.includes('Saisir la référence'), 'DIG-PRODI objectives: indicators and the reference form of the group industrial director');
  check((await get('/kpi', 'ceo')).body.includes('Saisir la référence') === false, 'only the group industrial director enters the references');
  const draft = await get('/capex/CPX-APM-2026-02', 'sponsor');
  check(draft.status === 200 && draft.body.includes('Reprendre un CAPEX en cours'), 'a draft can be taken over in progress by its sponsor (N-20)');
  const closing = await get('/capex/CPX-APM-2025-01', 'controller');
  check(closing.status === 200 && closing.body.includes('Saisir la déclaration de clôture'), 'overview of a CAPEX in start-up: next step is the accounting closure');
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
