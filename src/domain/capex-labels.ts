// Labels of the CAPEX codes (EN source strings, translated through t()). Codes are stored, never labels.
import type { CapexPhase, CapexStatus, InvestmentType, Typology } from '@/server/db/schema/capex';

export const STATUS_LABEL: Record<CapexStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  on_hold: 'On hold',
  closed: 'Closed',
  abandoned: 'Abandoned',
};

/** DIG-PRODI phases (docs/spec/03 §1). */
export const PHASE_LABEL: Record<CapexPhase, string> = {
  cadrage: '1 · Scoping & opportunities',
  avant_projet: '2 · Front-end engineering',
  execution: '3 · Execution',
  demarrage: '4 · Start-up, ramp-up & transfer',
};

export const TYPOLOGY_LABEL: Record<Typology, string> = {
  light: 'Light',
  strategic: 'Strategic',
};

export const INVESTMENT_TYPE_LABEL: Record<InvestmentType, string> = {
  new_plant: 'New plant',
  new_line: 'New line',
  extension: 'Extension',
  other: 'Other investment',
};

export const labelOf = <K extends string>(table: Record<K, string>, code: string | null | undefined): string => (code && code in table ? table[code as K] : '—');
