import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError } from './request.mjs';

export const frontendRoot = fileURLToPath(new URL('../../../frontend/dist/', import.meta.url));
const routes = new Set(['/', '/index.html', '/setup', '/setup/', '/guide', '/guide/']);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2' };

export async function serveFrontend(req, res, pathname, root) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { throw new ApiError(400, 'INVALID_PATH', '올바르지 않은 주소입니다.'); }
  if (decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').some(part => part.startsWith('.'))) throw new ApiError(404, 'NOT_FOUND', '페이지를 찾을 수 없어요.');
  const name = routes.has(decoded) ? 'index.html' : decoded.replace(/^\/+/, '');
  const type = types[path.extname(name).toLowerCase()];
  if (!type) throw new ApiError(404, 'NOT_FOUND', '페이지를 찾을 수 없어요.');
  let content;
  try {
    const base = await realpath(root);
    const target = await realpath(path.resolve(base, name));
    const relative = path.relative(base, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new ApiError(404, 'NOT_FOUND', '페이지를 찾을 수 없어요.');
    content = await readFile(target);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) throw new ApiError(name === 'index.html' ? 503 : 404, name === 'index.html' ? 'FRONTEND_NOT_BUILT' : 'NOT_FOUND', name === 'index.html' ? '화면 빌드가 필요합니다. npm run build:frontend를 실행해 주세요.' : '파일을 찾을 수 없어요.');
    throw error;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': content.length, 'Cache-Control': 'no-cache' });
  res.end(req.method === 'HEAD' ? undefined : content);
}
