// Run with node --env-file=.env.local scripts/configure-asaas-webhook.mjs
// Secrets and provider response bodies are deliberately never logged.
const base = process.env.ASAAS_BASE_URL?.replace(/\/$/, '');
if (process.env.ASAAS_ENV?.toLowerCase() !== 'sandbox' || base !== 'https://api-sandbox.asaas.com/v3') throw Error('Only Sandbox is allowed.');
const token = process.env.ASAAS_WEBHOOK_TOKEN;
if (!token || token.length < 32 || token === process.env.ASAAS_API_KEY) throw Error('Configure an independent ASAAS_WEBHOOK_TOKEN with at least 32 characters.');
const origin = new URL(process.env.STUDIFY_APP_URL || 'http://localhost:3000');
if (origin.protocol !== 'https:') throw Error('STUDIFY_APP_URL must be a public HTTPS origin accessible to Asaas.');
if (!process.env.ASAAS_WEBHOOK_EMAIL) throw Error('Configure ASAAS_WEBHOOK_EMAIL for operational notifications.');
const url = `${origin.origin}/api/asaas/webhook`;
async function api(path, method = 'GET', data) {
  const response = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(30_000), headers: { access_token: process.env.ASAAS_API_KEY, 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) });
  if (!response.ok) throw Error(`Asaas returned HTTP ${response.status}`);
  return response.json();
}
const matching = [];
for (let offset = 0; ; offset += 100) {
  const list = await api(`/webhooks?limit=100&offset=${offset}`);
  matching.push(...list.data.filter(item => item.url === url));
  if (!list.hasMore) break;
}
if (matching.length > 1) throw Error('Multiple matching webhooks; reconcile them before proceeding.');
const events = ['CHECKOUT_CREATED','CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED','SUBSCRIPTION_CREATED','SUBSCRIPTION_UPDATED','SUBSCRIPTION_INACTIVATED','SUBSCRIPTION_DELETED','PAYMENT_CREATED','PAYMENT_UPDATED','PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_OVERDUE','PAYMENT_DELETED','PAYMENT_RESTORED','PAYMENT_REFUNDED','PAYMENT_REFUND_IN_PROGRESS','PAYMENT_PARTIALLY_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE','PAYMENT_AWAITING_CHARGEBACK_REVERSAL','PAYMENT_CREDIT_CARD_CAPTURE_REFUSED'];
await api(matching[0] ? `/webhooks/${encodeURIComponent(matching[0].id)}` : '/webhooks', matching[0] ? 'PUT' : 'POST', { name: 'Studify Sandbox', url, email: process.env.ASAAS_WEBHOOK_EMAIL, enabled: true, interrupted: false, apiVersion: 3, authToken: token, sendType: 'SEQUENTIALLY', events });
console.log('Studify Sandbox webhook configured. Validate delivery in the Asaas dashboard.');
