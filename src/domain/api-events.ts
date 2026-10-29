// The events of Arche's webhooks (AR-048, docs/API.md); client-safe (the forms list them).
export const WEBHOOK_EVENTS = ['capex.opened', 'gate.decided', 'alert.raised'] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
export const isWebhookEvent = (v: string): v is WebhookEvent => (WEBHOOK_EVENTS as readonly string[]).includes(v);
