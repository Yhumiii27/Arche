// Benefits realised and post-audits (AR-046, DECISIONS.md §5): after the start of commissioning, the subsidiary controller or
// the sponsor enters, year by year of the business plan, the revenue and the operating costs actually observed; they are set
// against the validated business plan, and NPV / IRR are recomputed on the realised flows (actuals where entered, the plan
// elsewhere; the investment at its final cost once closed). Post-audits fall 6, 12 and 24 months after the start of
// commissioning; the group industrial director holds them and records the conclusion. Pure.
import { addMonths as addMonthsIso } from './governance';
import { irr, netOf, npv, type BpYear } from './bp';
import { parseKeur, round1 } from './budget';

export const POST_AUDIT_MONTHS = [6, 12, 24] as const;
export type PostAuditMonth = (typeof POST_AUDIT_MONTHS)[number];
export const POST_AUDIT_CONCLUSIONS = ['above', 'on_track', 'below'] as const;
export type PostAuditConclusion = (typeof POST_AUDIT_CONCLUSIONS)[number];
export const POST_AUDIT_CONCLUSION_LABEL: Record<PostAuditConclusion, string> = { above: 'Above the business plan', on_track: 'In line with the business plan', below: 'Below the business plan' };

export interface BenefitActual {
  year: number;
  revenueKeur: number;
  opexKeur: number;
}

/** Year by year of the plan (from year 1): the planned and the realised operating gain (revenue − OPEX), the gap. */
export function benefitRows(plan: readonly BpYear[], actuals: readonly BenefitActual[]) {
  let cumPlan = 0;
  let cumActual = 0;
  return plan.filter((y) => y.year >= 1).map((y) => {
    const a = actuals.find((x) => x.year === y.year) ?? null;
    const planned = round1(y.revenueKeur - y.opexKeur);
    const actual = a ? round1(a.revenueKeur - a.opexKeur) : null;
    cumPlan = round1(cumPlan + planned);
    if (actual != null) cumActual = round1(cumActual + actual);
    return { year: y.year, planned, plannedRevenue: y.revenueKeur, plannedOpex: y.opexKeur, actual, actualRevenue: a?.revenueKeur ?? null, actualOpex: a?.opexKeur ?? null, gap: actual == null ? null : round1(actual - planned), cumPlan, cumActual: actual == null ? null : cumActual };
  });
}

/** The realised flows: actual revenue and OPEX where entered; the investment scaled to its final cost when known. */
export function realisedFlows(plan: readonly BpYear[], actuals: readonly BenefitActual[], finalCostKeur: number | null): BpYear[] {
  const planCapex = plan.reduce((s, y) => s + y.capexKeur, 0);
  const k = finalCostKeur != null && planCapex > 0 ? finalCostKeur / planCapex : 1;
  return plan.map((y) => {
    const a = actuals.find((x) => x.year === y.year);
    return { year: y.year, capexKeur: round1(y.capexKeur * k), opexKeur: a ? a.opexKeur : y.opexKeur, revenueKeur: a ? a.revenueKeur : y.revenueKeur };
  });
}

/** NPV and IRR of the plan and of the realised flows. */
export function returnsOf(ratePct: number, plan: readonly BpYear[], realised: readonly BpYear[]) {
  return { planNpv: npv(ratePct, plan), planIrr: irr(plan), realNpv: npv(ratePct, realised), realIrr: irr(realised), realNet: round1(realised.reduce((s, y) => s + netOf(y), 0)) };
}

export type PostAuditState = 'held' | 'upcoming' | 'due' | 'late';

/** The post-audits of a CAPEX commissioned on `mesStartedOn`: due date, held or not; late a month after it falls due. */
export function postAuditsOf(mesStartedOn: string | null, held: readonly { milestone: number; heldOn: string }[], today: string) {
  if (!mesStartedOn) return [];
  return POST_AUDIT_MONTHS.map((m) => {
    const dueOn = addMonthsIso(mesStartedOn, m);
    const h = held.find((x) => x.milestone === m) ?? null;
    const state: PostAuditState = h ? 'held' : today < dueOn ? 'upcoming' : today <= addMonthsIso(dueOn, 1) ? 'due' : 'late';
    return { milestone: m, dueOn, state, heldOn: h?.heldOn ?? null };
  });
}

type Check<T> = { ok: true; value: T } | { ok: false; error: string };
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** A year of realised benefits: a year of the plan (1 to its horizon), revenue and OPEX in k€, a note. */
export function checkBenefit(raw: Record<string, unknown>, horizon: number): Check<BenefitActual & { note: string | null }> {
  const year = Number(text(raw.year));
  if (!Number.isInteger(year) || year < 1 || year > horizon) return { ok: false, error: 'Choose a year of the business plan' };
  const revenue = parseKeur(raw.revenueKeur);
  const opex = parseKeur(raw.opexKeur);
  if (revenue == null || opex == null || revenue < 0 || opex < 0) return { ok: false, error: 'Give the revenue and the operating costs in k€' };
  return { ok: true, value: { year, revenueKeur: revenue, opexKeur: opex, note: text(raw.note).slice(0, 1000) || null } };
}

/** A post-audit held: one not yet held of those that fell due, its date (not in the future), a conclusion and a report. */
export function checkPostAudit(raw: Record<string, unknown>, open: readonly number[], today: string): Check<{ milestone: PostAuditMonth; heldOn: string; conclusion: PostAuditConclusion; summary: string; codexRef: string | null }> {
  const milestone = Number(text(raw.milestone)) as PostAuditMonth;
  if (!open.includes(milestone)) return { ok: false, error: 'This post-audit is not due or already held' };
  const heldOn = text(raw.heldOn);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(heldOn) || heldOn > today) return { ok: false, error: 'Give the day the post-audit was held' };
  const conclusion = text(raw.conclusion) as PostAuditConclusion;
  if (!POST_AUDIT_CONCLUSIONS.includes(conclusion)) return { ok: false, error: 'Choose the conclusion' };
  const summary = text(raw.summary);
  if (summary.length < 10 || summary.length > 4000) return { ok: false, error: 'Write the report of the post-audit' };
  const codexRef = text(raw.codexRef).toUpperCase() || null;
  return { ok: true, value: { milestone, heldOn, conclusion, summary, codexRef } };
}
