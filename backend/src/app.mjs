import http from 'node:http';
import { frontendRoot, serveFrontend } from './lib/static.mjs';
import { validateAnalysis, makePrompt } from './lib/guide.mjs';
import { ApiError, normalizeRequest } from './lib/request.mjs';
import { DEFAULT_GATEWAY_URL, DEFAULT_MODEL, gatewayEndpoint, gatewayRequest, parseGatewayResponse } from './lib/gateway.mjs';

const localOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://localhost:5173', 'https://127.0.0.1:5173'];

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value));
}
async function readBody(req, limit) {
  let size = 0; const chunks = [];
  // Keep the socket alive long enough to return a 413, then drain the request.
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) { req.resume(); throw new ApiError(413, 'PAYLOAD_TOO_LARGE', '사진이 너무 커요. 더 작은 사진을 선택해 주세요.'); }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw new ApiError(400, 'INVALID_JSON', '요청 JSON 형식이 올바르지 않아요.'); }
}

export function createApp({ apiKey = process.env.BAZE_API_KEY, model = process.env.BAZE_MODEL || DEFAULT_MODEL, baseUrl = process.env.BAZE_BASE_URL || DEFAULT_GATEWAY_URL, fetchImpl = fetch, timeoutMs = 55_000, bodyLimit = 7_000_000, staticRoot = frontendRoot, allowedOrigins = [...localOrigins, ...(process.env.FRONTEND_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) ?? []), ...(process.env.RENDER_EXTERNAL_URL ? [process.env.RENDER_EXTERNAL_URL] : [])] } = {}) {
  if (typeof model !== 'string' || !/^[a-zA-Z0-9._/-]+$/.test(model)) throw new Error('BAZE_MODEL 설정을 확인해 주세요.');
  const endpoint = gatewayEndpoint(baseUrl);
  if (allowedOrigins.some(origin => { try { const parsed = new URL(origin); return !['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin; } catch { return true; } })) throw new Error('FRONTEND_ORIGINS에는 경로 없는 정확한 http(s) 출처만 입력해 주세요.');
  let activeAnalysis = 0;
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const url = new URL(req.url, 'http://localhost');
      const isApi = url.pathname.startsWith('/api/');
      if (isApi) {
        res.setHeader('Vary', 'Origin');
        const origin = req.headers.origin;
        const sameOrigin = `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`;
        if (origin && origin !== sameOrigin && !allowedOrigins.includes(origin)) throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', '허용되지 않은 프런트엔드 주소입니다.');
        if (origin && allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
        if (req.method === 'OPTIONS') {
          if (!['/api/status', '/api/analyze'].includes(url.pathname)) throw new ApiError(404, 'NOT_FOUND', 'API를 찾을 수 없어요.');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.writeHead(204); return res.end();
        }
      }
      if (url.pathname === '/api/status') {
        if (req.method !== 'GET') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'GET 요청을 사용해 주세요.');
        return json(res, 200, { configured: !!apiKey, provider: 'baze', model });
      }
      if (url.pathname === '/api/analyze') {
        if (req.method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'POST 요청을 사용해 주세요.');
        if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type을 application/json으로 보내 주세요.');
        const input = normalizeRequest(await readBody(req, bodyLimit));
        if (!apiKey) throw new ApiError(503, 'AI_NOT_CONFIGURED', '실제 사진 분석에는 서버 BAZE_API_KEY 설정이 필요해요. 시연 모드를 이용해 주세요.');
        if (activeAnalysis >= 2) throw new ApiError(429, 'RATE_LIMITED', '다른 사진을 확인하고 있어요. 잠시 후 다시 시도해 주세요.');
        activeAnalysis++;
        try {
          let response;
          try {
            response = await fetchImpl(endpoint, {
              method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify(gatewayRequest(input, makePrompt(input.settings, input.previousStage, input.context), model)), signal: AbortSignal.timeout(timeoutMs)
            });
          } catch (error) {
            if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new ApiError(504, 'AI_TIMEOUT', '분석이 오래 걸려요. 잠시 후 다시 촬영해 주세요.');
            throw new ApiError(502, 'AI_UNAVAILABLE', '사진 분석에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
          }
          if (!response.ok) {
            if (response.status === 429) throw new ApiError(429, 'AI_RATE_LIMITED', '분석 요청이 많아요. 잠시 후 다시 시도해 주세요.');
            if (response.status === 404) throw new ApiError(502, 'AI_MODEL_NOT_FOUND', '학교 Gateway에서 설정한 모델을 찾을 수 없어요. BAZE_MODEL과 계정의 모델 목록을 확인해 주세요.');
            if (response.status === 402) throw new ApiError(503, 'AI_CREDITS_EXHAUSTED', '학교 API 크레딧이 부족해요. SnowChat의 잔액을 확인해 주세요.');
            if (response.status === 401 || response.status === 403) throw new ApiError(502, 'AI_AUTH_FAILED', 'AI 서비스의 인증 또는 접근 권한을 확인해 주세요. 서버의 API 키와 프로젝트 권한 설정이 필요해요.');
            if (response.status === 400) throw new ApiError(502, 'AI_REQUEST_REJECTED', 'AI 서비스가 요청을 거부했어요. API 키의 유효성과 모델의 사진·JSON 입력 지원을 확인해 주세요.');
            if (response.status === 503) throw new ApiError(503, 'AI_BUSY', 'AI 서비스가 일시적으로 혼잡해요. 잠시 후 같은 사진을 다시 선택해 주세요.');
            throw new ApiError(502, 'AI_UNAVAILABLE', '사진 분석에 연결하지 못했어요. 서버의 API 키와 모델 설정을 확인해 주세요.');
          }
          try {
            return json(res, 200, validateAnalysis(parseGatewayResponse(await response.json()), { requireKind: true }));
          } catch (error) {
            if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new ApiError(504, 'AI_TIMEOUT', '분석이 오래 걸려요. 다시 시도해 주세요.');
            throw new ApiError(502, 'AI_INVALID_RESPONSE', '화면을 정확하게 읽지 못했어요. 정면에서 다시 촬영해 주세요.');
          }
        } finally { activeAnalysis--; }
      }
      if (isApi) throw new ApiError(404, 'NOT_FOUND', 'API를 찾을 수 없어요.');
      if (!['GET', 'HEAD'].includes(req.method)) throw new ApiError(405, 'METHOD_NOT_ALLOWED', '지원하지 않는 요청입니다.');
      await serveFrontend(req, res, url.pathname, staticRoot);
    } catch (error) {
      if (res.destroyed || res.writableEnded) return;
      const known = error instanceof ApiError;
      if (known && error.status === 429) res.setHeader('Retry-After', '5');
      json(res, known ? error.status : 500, { error: known ? error.message : '서버에서 요청을 처리하지 못했어요. 다시 시도해 주세요.', code: known ? error.code : 'INTERNAL_ERROR' });
    }
  });
}
