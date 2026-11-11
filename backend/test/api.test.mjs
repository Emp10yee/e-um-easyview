import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.mjs';
import { normalizeRequest } from '../src/lib/request.mjs';
import { validateAnalysis, makePrompt } from '../src/lib/guide.mjs';
import { gatewayEndpoint, parseGatewayResponse } from '../src/lib/gateway.mjs';

const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=';
const input = { image, mimeType: 'image/png', ctx: { dineType: '포장해 갈게요', storeType: '햄버거·패스트푸드', category: '치킨 버거', payment: '모바일 상품권 / 쿠폰' } };
const guidance = { kind: 'guide', stage: 'menu', store: '키오스크', message: '기본 치킨버거를 눌러 주세요.', candidates: [{ label: '롱치킨버거', box: [100, 100, 300, 400] }, { label: '매운 치킨버거', box: [100, 500, 300, 900] }], choices: [] };
const upstream = value => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(value) } }] }), { status: 200 });
async function launch(t, config = {}) {
  const app = createApp({ apiKey: 'test-key-not-real', ...config });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => new Promise(resolve => { app.close(resolve); app.closeAllConnections(); }));
  const base = `http://127.0.0.1:${app.address().port}`;
  return { base, post: (value, headers = {}) => fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof value === 'string' ? value : JSON.stringify(value) }) };
}
test('normalizes React labels and accepts imageBase64 alias', () => {
  const result = normalizeRequest({ ...input, image: undefined, imageBase64: image });
  assert.equal(result.settings.place, '포장'); assert.equal(result.settings.store, '햄버거');
  assert.equal(result.settings.payment, '모바일 상품권/쿠폰'); assert.equal(result.previousStage, 'place');
});
test('canonical settings remain compatible with the demo UI', () => {
  const canonical = normalizeRequest(input);
  assert.deepEqual(normalizeRequest({ ...canonical }).settings, canonical.settings);
});
test('rejects invalid objects, enums, conflicting inputs and mismatched image types', () => {
  for (const value of [null, [], {}, { ...input, mimeType: 'image/jpeg' }, { ...input, image: 'aGVsbG8=' }, { ...input, image: 'data:image/png;base64,' + image }, { ...input, settings: {} }, { ...input, previousStage: 'bad' }, { ...input, ctx: { ...input.ctx, storeType: '__proto__' } }, { ...input, context: { options: 'large' } }, { ...input, context: { clarification: { answer: '차갑게' } } }]) assert.throws(() => normalizeRequest(value), error => error.status === 400);
});
test('explicit kinds reject contradictory completion and uncertain boxes', () => {
  for (const value of [{ ...guidance, kind: undefined }, { ...guidance, kind: 'complete' }, { ...guidance, kind: 'retake' }, { ...guidance, kind: 'ask', candidates: [], choices: [] }, { ...guidance, candidates: [null] }]) assert.throws(() => validateAnalysis(value, { requireKind: true }));
  for (const kind of ['retake', 'wrong', 'ask', 'complete']) {
    const result = validateAnalysis({ ...guidance, kind, stage: kind === 'complete' ? 'complete' : 'menu', candidates: [], choices: kind === 'ask' ? ['차갑게', '따뜻하게'] : [] }, { requireKind: true });
    assert.equal(result.box, null); assert.equal(result.completed, kind === 'complete');
  }
});
test('latest menu, options and clarification are carried in the prompt', () => {
  const context = { selectedMenu: '매운 치킨버거', options: ['단품'], clarification: { question: '맵게 드실까요?', answer: '맵게' } };
  const normalized = normalizeRequest({ ...input, context });
  assert.deepEqual(normalized.context, context);
  const prompt = makePrompt(normalized.settings, 'menu', normalized.context);
  assert.ok(prompt.includes(JSON.stringify(context))); assert.match(prompt, /not proof/);
});
test('HTTP analysis preserves legacy fields and returns alternative targets', async t => {
  let request, endpoint, headers;
  const { post } = await launch(t, { model: 'google/gemma-4-31B-it', fetchImpl: async (url, options) => { endpoint = url; headers = options.headers; request = JSON.parse(options.body); return upstream(guidance); } });
  const res = await post({ ...input, context: { selectedMenu: '매운 치킨버거' } });
  assert.equal(res.status, 200); const result = await res.json();
  assert.equal(result.kind, 'guide'); assert.equal(result.stage, 'menu'); assert.equal(result.candidates.length, 2);
  assert.deepEqual(result.box, guidance.candidates[0].box);
  assert.deepEqual(result.alternatives, ['매운 치킨버거']); assert.deepEqual(result.alternativeTargets, [guidance.candidates[1]]);
  assert.equal(endpoint, 'https://factchat-cloud.mindlogic.ai/v1/gateway/chat/completions/');
  assert.equal(headers.Authorization, 'Bearer test-key-not-real'); assert.equal(headers['x-goog-api-key'], undefined);
  assert.equal(request.model, 'google/gemma-4-31B-it');
  assert.match(request.messages[0].content[0].text, /매운 치킨버거/);
  assert.equal(request.messages[0].content[1].image_url.url, `data:image/png;base64,${image}`);
  assert.equal(request.response_format.json_schema.strict, true);
});
test('HTTP distinguishes retake, ask and complete without inferring from empty candidates', async t => {
  for (const kind of ['retake', 'ask', 'complete']) {
    const { post } = await launch(t, { fetchImpl: async () => upstream({ ...guidance, kind, stage: kind === 'complete' ? 'complete' : 'menu', candidates: [], choices: kind === 'ask' ? ['차갑게', '따뜻하게'] : [] }) });
    const res = await post(input); assert.equal(res.status, 200);
    const result = await res.json(); assert.equal(result.kind, kind); assert.equal(result.completed, kind === 'complete');
  }
});
test('HTTP validates JSON, content type, size and configuration without leaking errors', async t => {
  const { base, post } = await launch(t, { apiKey: '', bodyLimit: 1000 });
  assert.equal((await fetch(`${base}/api/status`)).status, 200);
  assert.equal((await post('{')).status, 400); assert.equal((await post(null)).status, 400);
  assert.equal((await post(input, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post({ ...input, image: 'A'.repeat(1100) })).status, 413);
  const res = await post(input); assert.equal(res.status, 503); assert.equal((await res.json()).code, 'AI_NOT_CONFIGURED');
  assert.equal((await fetch(`${base}/api/analyze`)).status, 405);
  assert.equal((await fetch(`${base}/.env`)).status, 404);
  assert.equal((await fetch(`${base}/`)).status, 200);
});
test('HTTP maps upstream rate limit, network failure, timeout and malformed output', async t => {
  const cases = [
    [async () => new Response('', { status: 429 }), 429, 'AI_RATE_LIMITED'],
    [async () => new Response('', { status: 404 }), 502, 'AI_MODEL_NOT_FOUND'],
    [async () => new Response('', { status: 403 }), 502, 'AI_AUTH_FAILED'],
    [async () => new Response('', { status: 400 }), 502, 'AI_REQUEST_REJECTED'],
    [async () => new Response('', { status: 503 }), 503, 'AI_BUSY'],
    [async () => new Response('', { status: 402 }), 503, 'AI_CREDITS_EXHAUSTED'],
    [async () => { throw new Error('secret upstream details'); }, 502, 'AI_UNAVAILABLE'],
    [async () => { throw new DOMException('slow', 'TimeoutError'); }, 504, 'AI_TIMEOUT'],
    [async () => upstream({ ...guidance, candidates: [{ label: 'bad', box: [0, 0, 1200, 100] }] }), 502, 'AI_INVALID_RESPONSE'],
    [async () => upstream({ ...guidance, kind: undefined }), 502, 'AI_INVALID_RESPONSE']
  ];
  for (const [fetchImpl, status, code] of cases) {
    const { post } = await launch(t, { fetchImpl }); const response = await post(input); assert.equal(response.status, status);
    const result = await response.json(); assert.equal(result.code, code); assert.doesNotMatch(result.error, /secret/);
  }
});

test('Gateway response parser rejects truncation, refusals and provider prose', () => {
  for (const value of [null, { candidates: [] }, { choices: [{ finish_reason: 'length', message: { content: '{}' } }] }, { choices: [{ finish_reason: 'stop', message: { refusal: 'blocked', content: '{}' } }] }, { choices: [{ finish_reason: 'stop', message: { content: 'Here is JSON: {}' } }] }]) assert.throws(() => parseGatewayResponse(value));
  assert.deepEqual(parseGatewayResponse({ choices: [{ finish_reason: 'stop', message: { content: '```json\n{}\n```' } }] }), {});
  assert.deepEqual(parseGatewayResponse({ choices: [{ finish_reason: 'stop', message: { content: [{ type: 'text', text: '{}' }] } }] }), {});
});
test('Gateway endpoint requires HTTPS and does not accept credentials or query strings', () => {
  assert.equal(gatewayEndpoint('https://factchat-cloud.mindlogic.ai/v1/gateway/'), gatewayEndpoint());
  for (const value of ['http://example.com', 'https://key@example.com', 'https://example.com?key=secret', 'https://example.com#fragment']) assert.throws(() => gatewayEndpoint(value));
});
test('CORS allows configured frontend and rejects other origins', async t => {
  const { base } = await launch(t, { allowedOrigins: ['https://localhost:5173'] });
  const allowed = await fetch(`${base}/api/analyze`, { method: 'OPTIONS', headers: { Origin: 'https://localhost:5173', 'Access-Control-Request-Method': 'POST' } });
  assert.equal(allowed.status, 204); assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://localhost:5173');
  const denied = await fetch(`${base}/api/status`, { headers: { Origin: 'https://unlisted.example' } });
  assert.equal(denied.status, 403); assert.equal(denied.headers.get('access-control-allow-origin'), null);
});
test('analysis capacity is released after concurrent requests finish', async t => {
  const pending = [];
  const { post } = await launch(t, { fetchImpl: () => new Promise(resolve => pending.push(resolve)) });
  const first = post(input), second = post(input);
  for (let n = 0; pending.length < 2 && n < 100; n++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(pending.length, 2);
  try { const rejected = await post(input); assert.equal(rejected.status, 429); assert.equal(rejected.headers.get('retry-after'), '5'); }
  finally { for (const resolve of pending.splice(0)) resolve(upstream(guidance)); }
  assert.equal((await first).status, 200); assert.equal((await second).status, 200);
  const next = post(input);
  for (let n = 0; !pending.length && n < 100; n++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(pending.length, 1); pending[0](upstream(guidance)); assert.equal((await next).status, 200);
});
