// Permits register of a CAPEX (docs/spec/02 §3 `authorizations`, 03 §3, 06 §7): ICPE, building permit, PLU, ATEX and others,
// with their filing, due and obtained dates and the Codex reference of the file. G2 needs the ICPE and the building permit
// filed (obtained or with a known due date), unless not required. Pure.

export const PERMIT_KINDS = ['icpe', 'building_permit', 'plu', 'atex', 'other'] as const;
export type PermitKind = (typeof PERMIT_KINDS)[number];
export const PERMIT_KIND_LABEL: Record<PermitKind, string> = {
  icpe: 'ICPE (classified installation)', building_permit: 'Building permit', plu: 'Local urban plan (PLU)', atex: 'ATEX', other: 'Other permit',
};

export const PERMIT_STATUSES = ['to_file', 'filed', 'obtained', 'refused', 'not_required'] as const;
export type PermitStatus = (typeof PERMIT_STATUSES)[number];
export const PERMIT_STATUS_LABEL: Record<PermitStatus, string> = { to_file: 'To file', filed: 'Filed', obtained: 'Obtained', refused: 'Refused', not_required: 'Not required' };

export interface PermitInput {
  kind: PermitKind;
  title: string;
  authority: string | null;
  status: PermitStatus;
  filedOn: string | null;
  dueOn: string | null;
  obtainedOn: string | null;
  codexRef: string | null;
  note: string | null;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const isoDay = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(text(v)) ? text(v) : null);

/** A permit line: filed needs the filing date; obtained needs the date obtained; "not required" needs the reason. */
export function checkPermit(raw: Record<string, unknown>, today: string): { ok: true; value: PermitInput } | { ok: false; error: string } {
  const kind = text(raw.kind) as PermitKind;
  if (!PERMIT_KINDS.includes(kind)) return { ok: false, error: 'Choose the kind of permit' };
  const status = text(raw.status) as PermitStatus;
  if (!PERMIT_STATUSES.includes(status)) return { ok: false, error: 'Choose a status' };
  const title = text(raw.title).slice(0, 200);
  if (!title) return { ok: false, error: 'Name the permit' };
  const filedOn = isoDay(raw.filedOn);
  const dueOn = isoDay(raw.dueOn);
  const obtainedOn = isoDay(raw.obtainedOn);
  const note = text(raw.note).slice(0, 2000) || null;
  if ((status === 'filed' || status === 'obtained' || status === 'refused') && !filedOn) return { ok: false, error: 'Give the filing date' };
  if (status === 'obtained' && !obtainedOn) return { ok: false, error: 'Give the date the permit was obtained' };
  if (status === 'not_required' && !note) return { ok: false, error: 'Give the reason the permit is not required' };
  if ((filedOn && filedOn > today) || (obtainedOn && obtainedOn > today)) return { ok: false, error: 'The filing and obtained dates cannot be in the future' };
  if (filedOn && obtainedOn && obtainedOn < filedOn) return { ok: false, error: 'A permit is obtained after it is filed' };
  return {
    ok: true,
    value: {
      kind, title, status, filedOn, dueOn, obtainedOn: status === 'obtained' ? obtainedOn : null, note,
      authority: text(raw.authority).slice(0, 200) || null, codexRef: text(raw.codexRef).slice(0, 120) || null,
    },
  };
}

export interface PermitState {
  kind: PermitKind;
  status: PermitStatus;
  filedOn: string | null;
  dueOn: string | null;
  obtainedOn: string | null;
}

/** Filed and either obtained or with a known due date (spec 03 §3), or not required. */
const settles = (p: PermitState) => p.status === 'not_required' || p.status === 'obtained' || (p.status === 'filed' && !!p.dueOn);

/** G2 criterion: one ICPE and one building permit at least, each settled (a kind recorded as not required counts). */
export function permitsFact(rows: readonly PermitState[]): { met: boolean; value: string } {
  const needed: PermitKind[] = ['icpe', 'building_permit'];
  const ok = needed.filter((k) => rows.some((p) => p.kind === k) && rows.filter((p) => p.kind === k).every(settles));
  return { met: ok.length === needed.length, value: `${ok.length} / ${needed.length}` };
}

/** Permits filed but not obtained whose due date is within `days` (default 30, spec 06 §7) or past. */
export function permitsDue<T extends PermitState>(rows: readonly T[], today: string, days = 30): T[] {
  const limit = new Date(`${today}T12:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + days);
  const until = limit.toISOString().slice(0, 10);
  return rows.filter((p) => p.status === 'filed' && !!p.dueOn && p.dueOn <= until);
}
