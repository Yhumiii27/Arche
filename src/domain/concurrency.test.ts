import { describe, expect, it } from 'vitest';
import { isStale, sectionChanged } from './concurrency';

describe('optimistic lock (AR-049)', () => {
  it('refuses a form filled on an older version, accepts the current one and a call without the field', () => {
    expect(isStale('3', 4)).toBe(true);
    expect(isStale('4', 4)).toBe(false);
    expect(isStale(undefined, 4)).toBe(false);
    expect(isStale('', 4)).toBe(false);
    expect(isStale('x', 4)).toBe(true);
    expect(isStale('5', 4)).toBe(true);
  });

  it('a dossier section is locked on the text it was shown', () => {
    expect(sectionChanged('Old text', 'Old text')).toBe(false);
    expect(sectionChanged('Old text', 'Text changed by someone else')).toBe(true);
    expect(sectionChanged(null, 'Anything')).toBe(false);
  });
});
