import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateAnalysis, makePrompt, stages } from './lib/guide.mjs';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
async function body(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 7_000_000) { const e = new Error('사진이 너무 커요. 더 작은 사진을 선택해 주세요.'); e.status = 413; throw e; }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { const e = new Error('요청 형식이 올바르지 않습니다.'); e.status = 400; throw e; }
}
let activeAnalysis = 0;
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/status' && req.method === 'GET') return json(res, 200, { configured: !!process.env.GEMINI_API_KEY });
  if (url.pathname === '/api/analyze' && req.method === 'POST') {
    if (!process.env.GEMINI_API_KEY) return json(res, 503, { error: '실제 사진 분석을 사용하려면 서버의 GEMINI_API_KEY 설정이 필요해요. 지금은 시연 모드를 이용해 주세요.' });
    if (activeAnalysis >= 2) return json(res, 429, { error: '다른 사진을 확인하고 있어요. 잠시 후 다시 시도해 주세요.' });
    activeAnalysis++;
    try {
      const data = await body(req);
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(data.mimeType) || typeof data.image !== 'string' || data.image.length < 20 || !/^[A-Za-z0-9+/]+=*$/.test(data.image)) return json(res, 400, { error: '올바른 사진 파일을 선택해 주세요.' });
      const settings = data.settings;
      if (!settings || !['포장', '매장 식사'].includes(settings.place) || !['햄버거', '카페', '기타'].includes(settings.store) || typeof settings.category !== 'string' || !settings.category.trim() || settings.category.length > 100 || !['카드 (삼성페이 포함)', '모바일 상품권/쿠폰', '간편결제 (네이버·카카오페이)'].includes(settings.payment) || !stages.includes(data.previousStage)) return json(res, 400, { error: '주문 설정을 다시 확인해 주세요.' });
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('모델 설정을 확인해 주세요.');
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: makePrompt(settings, data.previousStage) }, { inlineData: { mimeType: data.mimeType, data: data.image } }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } }), signal: AbortSignal.timeout(55_000)
      });
      if (!response.ok) throw new Error(response.status === 429 ? '분석 요청이 많아요. 잠시 후 다시 시도해 주세요.' : '사진 분석에 연결하지 못했어요. 서버의 API 키와 모델 설정을 확인해 주세요.');
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.filter(p => p.text).map(p => p.text).join('');
      let parsed; try { parsed = JSON.parse(text); } catch { throw new Error('화면을 읽지 못했어요. 정면에서 다시 촬영해 주세요.'); }
      return json(res, 200, validateAnalysis(parsed));
    } catch (error) { return json(res, error.status || 502, { error: error.name === 'TimeoutError' ? '분석 시간이 길어지고 있어요. 다시 시도해 주세요.' : error.message }); }
    finally { activeAnalysis--; }
  }
  if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: '지원하지 않는 요청입니다.' });
  const routes = new Set(['/', '/index.html', '/styles.css', '/app.js', '/demo.js']);
  if (!routes.has(url.pathname)) return json(res, 404, { error: '페이지를 찾을 수 없습니다.' });
  try {
    const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { json(res, 404, { error: '페이지를 찾을 수 없습니다.' }); }
});
server.listen(Number(process.env.PORT) || 3000, process.env.HOST || '127.0.0.1', () => console.log(`EasyView: http://localhost:${server.address().port}`));
