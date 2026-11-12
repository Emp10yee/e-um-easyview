import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApp } from '../src/app.mjs';

test('production frontend serves SPA routes, assets and HEAD without hiding API or missing files', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'easyview-static-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'assets'));
  await writeFile(path.join(root, 'index.html'), '<!doctype html><div id="root"></div>');
  await writeFile(path.join(root, 'assets', 'index.js'), 'console.log("react");');
  await writeFile(path.join(root, 'assets', 'index.css'), 'body{margin:0}');
  await writeFile(path.join(root, 'logo.png'), Buffer.from([137, 80, 78, 71]));
  const app = createApp({ staticRoot: root, apiKey: '', allowedOrigins: ['https://easyview.onrender.com'] });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => new Promise(resolve => { app.close(resolve); app.closeAllConnections(); }));
  const base = `http://127.0.0.1:${app.address().port}`;
  for (const route of ['/', '/setup', '/guide', '/guide/']) {
    const res = await fetch(base + route); assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/); assert.match(await res.text(), /id="root"/);
  }
  for (const [route, mime] of [['/assets/index.js', /javascript/], ['/assets/index.css', /text\/css/], ['/logo.png', /image\/png/]]) {
    const res = await fetch(base + route); assert.equal(res.status, 200); assert.match(res.headers.get('content-type'), mime);
  }
  const head = await fetch(base + '/guide', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  for (const route of ['/api/missing', '/assets/missing.js', '/.env', '/%2eenv', '/assets/%2e%2e%2f%2eenv', '/unknown']) assert.equal((await fetch(base + route)).status, 404, route);
  assert.equal((await fetch(base + '/api/analyze', { method: 'POST', headers: { Origin: 'https://easyview.onrender.com', 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
  assert.equal((await fetch(base + '/api/status', { headers: { Origin: 'https://evil.example' } })).status, 403);
});

test('missing frontend build returns actionable 503 while health stays available', async t => {
  const app = createApp({ staticRoot: path.join(tmpdir(), 'easyview-missing-build-' + Date.now()), apiKey: '' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => new Promise(resolve => { app.close(resolve); app.closeAllConnections(); }));
  const base = `http://127.0.0.1:${app.address().port}`;
  const res = await fetch(base + '/'); assert.equal(res.status, 503); assert.equal((await res.json()).code, 'FRONTEND_NOT_BUILT');
  assert.equal((await fetch(base + '/api/status')).status, 200);
});
