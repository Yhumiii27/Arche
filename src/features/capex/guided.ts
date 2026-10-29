'use server';
// Guided opening of a CAPEX (owner, 24 Oct 2026): one Server Function for the whole wizard. It checks the viewer's right to
// create in the subsidiary (a sponsor or a project lead), validates every answer with the pure rules (src/domain/guided.ts)
// and writes everything in one transaction — the draft, its lead, lots, indicative E50 budget (a draft version), team,
// risks, the draft of the dossier of its phase — then, for a sponsor, opens it in phase 1 or takes it over in its phase
// (N-20). Each element is audited as on its own page.
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { creatableSubsidiaries, nextCapexCode, refOf, ROLE_OF_TEAM_ROLE } from '@/domain/capex';
import { completeness, DOSSIER_LABEL, emptyContent } from '@/domain/dossiers';
import { checkGuided, type GuidedRaw } from '@/domain/guided';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { recordActivity, writeAudit } from '@/server/db/helpers';
import { budgetLines, budgetVersions, capex, capexLots, capexMembers, dossierVersions, risks, roleAssignments, sites } from '@/server/db/schema';
import { applyOpen, applyTakeover } from '@/server/capex/cycle-writes';
import { auditOf, type ActionResult } from '@/server/capex/write';
import { capexRow, teamCandidates } from '@/server/dal/cycle';
import { computedFacts, ensureDossier } from '@/server/dal/dossiers';
import { currentSections } from '@/server/dal/designs';
import { getViewer } from '@/server/session';

export async function openGuidedAction(subsidiaryCode: string, raw: GuidedRaw): Promise<ActionResult> {
  const v = await getViewer();
  const allowed = creatableSubsidiaries(v.role, v.assignments, v.subsidiaryCode);
  const sub = String(subsidiaryCode ?? '').toUpperCase();
  if (!allowed.includes(sub) || (v.role !== 'sponsor' && v.role !== 'project_lead')) return { ok: false, error: 'You cannot create a CAPEX in this subsidiary' };
  const db = await getDb();
  const today = await businessToday();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const subSites = new Set((await tx.select({ id: sites.id }).from(sites).where(eq(sites.subsidiaryCode, sub))).map((x) => x.id));
    const people = new Set((await teamCandidates(tx, sub)).map((p) => p.id));
    const sponsorUserId = v.role === 'sponsor' ? v.userId : null;
    const ch = checkGuided(raw ?? {}, { today, role: v.role as 'sponsor' | 'project_lead', userId: v.userId, sites: subSites, people, sponsorUserId });
    if (!ch.ok) return ch;
    const g = ch.value;
    const taken = (await tx.select({ code: capex.code }).from(capex).where(eq(capex.subsidiaryCode, sub))).map((x) => x.code);
    const code = nextCapexCode(sub, Number(today.slice(0, 4)), taken);
    const [row] = await tx.insert(capex).values({ code, subsidiaryCode: sub, ...g.sheet, status: 'draft', phase: 'cadrage', sponsorUserId, leadUserId: g.leadUserId }).returning();
    await writeAudit(tx, auditOf(v, row, 'CAPEX created (draft, guided opening)', { entityType: 'capex', entityId: row.id, after: { ...g.sheet, subsidiaryCode: sub } }));
    const named = async (userId: string, capexRole: (typeof g.team)[number]['capexRole'] | 'lead') => {
      const [m] = await tx.insert(capexMembers).values({ capexId: row.id, userId, capexRole }).returning({ id: capexMembers.id });
      const scoped = ROLE_OF_TEAM_ROLE[capexRole];
      if (scoped) {
        const held = await tx.select({ id: roleAssignments.id }).from(roleAssignments).where(and(eq(roleAssignments.userId, userId), eq(roleAssignments.role, scoped), eq(roleAssignments.scopeRef, code)));
        if (!held.length) await tx.insert(roleAssignments).values({ userId, role: scoped, scopeKind: 'capex', scopeRef: code, createdByName: v.name });
      }
      await writeAudit(tx, auditOf(v, row, `team: member added as ${capexRole}`, { entityType: 'capex_member', entityId: m.id, after: { userId } }));
    };
    if (g.leadUserId) await named(g.leadUserId, 'lead');
    for (const m of g.team) await named(m.userId, m.capexRole);
    const lotIds: string[] = [];
    for (const [i, l] of g.lots.entries()) {
      const [x] = await tx.insert(capexLots).values({ capexId: row.id, number: i + 1, ...l }).returning({ id: capexLots.id });
      lotIds.push(x.id);
      await writeAudit(tx, auditOf(v, row, `lot ${i + 1} added: ${l.title}`, { entityType: 'lot', entityId: x.id, after: { ...l } }));
    }
    for (const [i, rk] of g.risks.entries()) {
      const [x] = await tx.insert(risks).values({ capexId: row.id, number: i + 1, ...rk }).returning({ id: risks.id });
      await writeAudit(tx, auditOf(v, row, `risk ${refOf('R', i + 1)} added: ${rk.title}`, { entityType: 'risk', entityId: x.id, after: { ...rk } }));
    }
    if (g.budget) {
      const [bv] = await tx.insert(budgetVersions).values({ capexId: row.id, number: 1, estimateClass: 'E50', status: 'draft', basis: g.budget.basis, createdByName: v.name }).returning({ id: budgetVersions.id });
      await tx.insert(budgetLines).values(g.budget.amounts.map((amountKeur, i) => ({ budgetVersionId: bv.id, lotId: lotIds[i], amountKeur })));
      await writeAudit(tx, auditOf(v, row, 'budget version 1 created (E50, draft)', { entityType: 'budget_version', entityId: bv.id, after: { amounts: g.budget.amounts } }));
    }
    if (g.sections.length) {
      const dossierId = await ensureDossier(tx, row.id, g.dossier);
      // The sections of the published template (AR-052); a section it no longer has is left out.
      const tpl = await currentSections(tx, g.dossier);
      const content = emptyContent(g.dossier, tpl.sections);
      for (const s of g.sections) if (content.sections[s.key]) content.sections[s.key].text = s.text;
      const pct = completeness(g.dossier, content, await computedFacts(tx, { id: row.id, leadUserId: g.leadUserId }), tpl.sections).pct;
      const [d] = await tx.insert(dossierVersions).values({ dossierId, number: 1, state: 'draft', content: content as never, completenessPct: pct, createdByName: v.name, templateVersion: tpl.version }).returning({ id: dossierVersions.id });
      await writeAudit(tx, auditOf(v, row, `${DOSSIER_LABEL[g.dossier]}: version 1 started (${g.sections.length} section(s))`, { entityType: 'dossier_version', entityId: d.id }));
    }
    await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'capex.created', text: `${code} created`, capexId: row.id });
    const c = (await capexRow(tx, row.id))!;
    if (g.finish === 'open') {
      const o = await applyOpen(tx, c, v, today);
      if (!o.ok) return o;
    } else if (g.finish === 'takeover' && g.takeover) {
      const t = { ...g.takeover, budget: { ...g.takeover.budget, lines: g.takeover.budget.lines.map((l) => ({ lotId: lotIds[Number(l.lotId)], amountKeur: l.amountKeur })) } };
      await applyTakeover(tx, c, v, t, today);
    }
    return { ok: true, code };
  });
  if (r.ok) revalidatePath('/', 'layout');
  return r;
}
