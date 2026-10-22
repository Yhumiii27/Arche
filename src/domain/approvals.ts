// "My approvals" (docs/spec/05 §6): the unified inbox of what waits on the viewer — circuit steps (opinions, visas,
// decisions, signatures, countersignatures, discharges, attestations), budget versions to validate, typologies to confirm,
// changes to decide. Pure: the item shape the server builds and the inbox figures. EN strings.

export type ApprovalKind = 'step' | 'budget' | 'typology' | 'change';
export const APPROVAL_KIND_LABEL: Record<ApprovalKind, string> = {
  step: 'Gate circuit', budget: 'Budget version', typology: 'Typology to confirm', change: 'Change to decide',
};

export interface ApprovalItem {
  kind: ApprovalKind;
  /** CAPEX code (typed reference, never translated). */
  capexCode: string;
  /** EN source string ("HSE opinion"). */
  title: string;
  /** Codes shown as they are ("G1 · session 1", "V2 · E10", "MOC-03"). */
  detail: string;
  /** Typed data shown as typed (CAPEX title, change title). */
  subject: string;
  /** Since when it waits (ISO date). */
  since: string;
  /** Deadline (ISO date), null when none. */
  due: string | null;
  href: string;
}

export interface InboxFigures {
  pending: number;
  late: number;
  /** ISO date of the oldest item, null when empty. */
  oldest: string | null;
}

/** Pending, late (deadline before today) and the oldest. */
export function inboxFigures(items: readonly ApprovalItem[], today: string): InboxFigures {
  return {
    pending: items.length,
    late: items.filter((i) => i.due && i.due < today).length,
    oldest: items.reduce<string | null>((m, i) => (!m || i.since < m ? i.since : m), null),
  };
}

/** Late first, then by deadline, then oldest. */
export function sortInbox(items: readonly ApprovalItem[]): ApprovalItem[] {
  return [...items].sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.since.localeCompare(b.since));
}
