// Read-only Supabase probes and one synthetic Groq request. Never prints credentials.
import { writeFile } from 'node:fs/promises';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Load .env.local before running this script.');
const results = [];
async function probe(name, path, options = {}) {
  try {
    const response = await fetch(`${url}${path}`, { ...options, headers: { apikey: key, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    const result = { name, status: response.status, code: body.code ?? null };
    if (name === 'auth') result.settings = { signupEnabled: !body.disable_signup, emailEnabled: body.external?.email, emailConfirmationRequired: !body.mailer_autoconfirm };
    if (name === 'community_policy' && response.ok) result.policy = body;
    results.push(result);
  } catch (error) { results.push({ name, error: error.cause?.code ?? error.message }); }
}
await probe('auth', '/auth/v1/settings');
await probe('community_policy', '/rest/v1/community_policy?select=version,enabled,support_email,media_prefix');
for (const table of ['goals', 'study_sessions', 'question_attempts', 'social_posts', 'community_reports', 'question_sets', 'question_runs']) {
  await probe(table, `/rest/v1/${table}?select=id&limit=0`);
}
// OPTIONS inspects endpoint availability without invoking any mutating RPC.
for (const rpc of ['get_study_data', 'get_entitlement', 'community_moderation_queue', 'consume_studify_usage', 'activate_study_goal']) {
  try {
    const response = await fetch(`${url}/rest/v1/rpc/${rpc}`, { method: 'OPTIONS', headers: { apikey: key }, signal: AbortSignal.timeout(15000) });
    results.push({ name: rpc, status: response.status, note: 'OPTIONS only; does not prove authenticated execution or deployed migration version.' });
  } catch (error) { results.push({ name: rpc, error: error.cause?.code ?? error.message }); }
}
if (process.env.GROQ_API_KEY) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b', temperature: 0, reasoning_effort: 'low', messages: [{ role: 'system', content: 'Explain the supplied study priority in Portuguese in one sentence. Do not invent numbers. Return the exact subjectId.' }, { role: 'user', content: JSON.stringify({ subjectId: 'validation', subject: 'Português', reason: 'Revisão atrasada' }) }], response_format: { type: 'json_schema', json_schema: { name: 'validation', strict: true, schema: { type: 'object', properties: { subjectId: { type: 'string', enum: ['validation'] }, explanation: { type: 'string' } }, required: ['subjectId', 'explanation'], additionalProperties: false } } } }),
    });
    const body = await response.json();
    let valid = false;
    try { const output = JSON.parse(body.choices?.[0]?.message?.content ?? ''); valid = output.subjectId === 'validation' && typeof output.explanation === 'string' && output.explanation.length > 0 && !/[\d%]/.test(output.explanation); } catch {}
    results.push({ name: 'groq_synthetic', status: response.status, valid, model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b', errorType: body.error?.type ?? null });
  } catch (error) { results.push({ name: 'groq_synthetic', error: error.cause?.code ?? error.message }); }
}
const report = { checkedAt: new Date().toISOString(), scope: 'Anonymous read-only Supabase probes; synthetic provider request; no authenticated user flow.', results };
await writeFile('/tmp/studify-services-validation.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
