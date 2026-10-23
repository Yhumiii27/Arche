// Where to act on each gate criterion (pure): the CAPEX screen that lets the team meet it and the action's label (EN source
// strings). The circuit's own steps point at the gate circuit.
import type { ScreenId } from '@/config/screens';
import type { CriterionState } from '@/domain/lifecycle';

export const CRITERION_ACTION: Record<string, { screen: ScreenId; label: string }> = {
  g1_dossier: { screen: 'capex-dossiers', label: 'Complete the dossier' },
  g2_dossier: { screen: 'capex-dossiers', label: 'Complete the dossier' },
  g1_budget_e50: { screen: 'capex-budget', label: 'New budget version' },
  g2_budget_e10: { screen: 'capex-budget', label: 'New budget version' },
  g1_typology: { screen: 'capex-governance', label: 'Determine the typology' },
  g1_staffing: { screen: 'capex-governance', label: 'Name a team member' },
  g2_staffing: { screen: 'capex-governance', label: 'Name a team member' },
  g1_sponsor_visa: { screen: 'capex-gates', label: 'Open the gate circuit' },
  g1_experts: { screen: 'capex-gates', label: 'Open the gate circuit' },
  g2_experts: { screen: 'capex-gates', label: 'Open the gate circuit' },
  g2_epc2i_offers: { screen: 'capex-machines', label: 'See the machine needs' },
  k3_sat_planned: { screen: 'capex-machines', label: 'See the EPC2i projects' },
  g3_reserves: { screen: 'capex-machines', label: 'See the EPC2i projects' },
  g1_hs2: { screen: 'capex-safety', label: 'See the safety milestones' },
  g2_hs3: { screen: 'capex-safety', label: 'See the safety milestones' },
  k3_hs4: { screen: 'capex-safety', label: 'See the safety milestones' },
  g3_pssr: { screen: 'capex-safety', label: 'See the safety milestones' },
  g3_hs6: { screen: 'capex-safety', label: 'See the safety milestones' },
  g2_pack: { screen: 'capex-pack', label: 'Complete the engineering pack' },
  g2_permits: { screen: 'capex-permits', label: 'Record the permits' },
  k3_works: { screen: 'capex-execution', label: 'Enter the progress of the works' },
  g3_rampup: { screen: 'capex-rampup', label: 'See the ramp-up' },
  g3_mes_delay: { screen: 'capex-rampup', label: 'See the ramp-up' },
  g3_accounts: { screen: 'capex-execution', label: 'Enter the closure statement' },
  g3_rex: { screen: 'capex-governance', label: 'Add a lesson' },
};

/** The first blocking criterion to work on (unmet, in the model's order), or null when none is left. */
export function nextCriterion<T extends { code: string; state: CriterionState; blocking: boolean }>(results: readonly T[]): T | null {
  return results.find((r) => r.blocking && r.state === 'unmet' && CRITERION_ACTION[r.code]) ?? null;
}
