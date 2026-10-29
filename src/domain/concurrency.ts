// Optimistic lock (AR-049): a form shows a CAPEX, a budget version, a dossier version or a circuit step at a row version
// (`row_version`, raised by one at every UPDATE by a database trigger) and sends it back in the hidden field `rowVersion`;
// the Server Function refuses the write when the row has changed since — two people editing the same object never silently
// overwrite each other. A call without the field (a button acting on a state already checked, a script) is not refused.
// A dossier is written by several people at once, section by section: its lock is the text of the section as it was shown
// (`base`), so that saving one section never conflicts with someone saving another.

export const ROW_VERSION_FIELD = 'rowVersion';

export const STALE_MSG = 'Someone else changed this in the meantime: reload the page and try again';

/** True when the form was filled on an older version of the row than `current` (a missing field never is). */
export function isStale(sent: unknown, current: number): boolean {
  if (sent == null || sent === '') return false;
  const n = Number(sent);
  return !Number.isInteger(n) || n !== current;
}

export const SECTION_BASE_FIELD = 'base';

/** True when the section's stored text is no longer the one the form was shown (a missing field never is). */
export function sectionChanged(base: unknown, stored: string): boolean {
  return typeof base === 'string' && base !== stored;
}
