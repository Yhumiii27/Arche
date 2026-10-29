import { describe, expect, it } from 'vitest';
import { bearerKey, checkApiClient, checkSignature, checkWebhook, checkWebhookUrl, hashKey, inClientScope, newApiKey, nextAttemptIn, signature } from './api';

describe('business API rules (AR-048)', () => {
  it('a key: shown once, its SHA-256 kept, read from the Bearer header', () => {
    const k = newApiKey();
    expect(k.key.startsWith(`${k.prefix}_`)).toBe(true);
    expect(k.hash).toBe(hashKey(k.key));
    expect(bearerKey(`Bearer ${k.key}`)).toBe(k.key);
    expect(bearerKey(`Basic ${k.key}`)).toBeNull();
    expect(bearerKey('Bearer arche_short')).toBeNull();
  });

  it('a signed write: the body and the timestamp, within 5 minutes; several values during a rotation', () => {
    const key = newApiKey().key;
    const body = '{"lot":1}';
    const now = 1_800_000_000;
    const sig = signature(key, now, body);
    expect(checkSignature(key, String(now), sig, body, now + 299)).toEqual({ ok: true, value: sig });
    expect(checkSignature(key, String(now), `v1=${'0'.repeat(64)}, ${sig}`, body, now)).toEqual({ ok: true, value: sig });
    expect(checkSignature(key, String(now), sig, '{"lot":2}', now)).toEqual({ ok: false, reason: 'signature_invalid' });
    expect(checkSignature(key, String(now), sig, body, now + 301)).toEqual({ ok: false, reason: 'signature_expired' });
    expect(checkSignature(key, null, sig, body, now)).toEqual({ ok: false, reason: 'signature_missing' });
  });

  it('retries, webhook addresses, the scope of a client, the forms', () => {
    expect([1, 2, 3, 4, 5, 8].map(nextAttemptIn)).toEqual([1, 5, 15, 60, 240, null]);
    expect(checkWebhookUrl('https://hooks.example.com/a')).toEqual({ ok: true, value: 'https://hooks.example.com/a' });
    expect(checkWebhookUrl('http://localhost:4000/a').ok).toBe(true);
    expect(checkWebhookUrl('http://hooks.example.com/a')).toEqual({ ok: false, error: 'A webhook address uses HTTPS' });
    expect(checkWebhookUrl('https://user:pw@hooks.example.com/a').ok).toBe(false);
    expect(inClientScope([], { subsidiaryCode: 'SAI', status: 'active' })).toBe(true);
    expect(inClientScope(['APM'], { subsidiaryCode: 'SAI', status: 'active' })).toBe(false);
    expect(inClientScope([], { subsidiaryCode: 'SAI', status: 'draft' })).toBe(false);
    expect(checkApiClient({ name: 'Power BI', 'sub:APM': 'on' }, { subsidiaries: new Set(['APM']), takenNames: new Set() })).toEqual({ ok: true, value: { name: 'Power BI', canWrite: false, subsidiaries: ['APM'] } });
    expect(checkApiClient({ name: 'X' }, { subsidiaries: new Set(), takenNames: new Set() }).ok).toBe(false);
    expect(checkWebhook({ clientId: 'c1', url: 'https://h.example.com', 'event:gate.decided': 'on' }, { clients: new Set(['c1']) })).toEqual({ ok: true, value: { clientId: 'c1', url: 'https://h.example.com/', events: ['gate.decided'] } });
  });
});
