/**
 * 本地长期部署用的静态服务器：托管 dist/，零依赖，只监听 127.0.0.1。
 * 用法：node deploy/serve.mjs  （PORT / HOST 环境变量可覆盖）
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(here, '..', 'dist');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.gz': 'application/gzip',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

/** 带哈希的资源可以长缓存；入口、SW、清单必须每次校验，否则更新后拿到旧壳 */
function cacheControl(pathname) {
  if (pathname.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  if (pathname === '/' || pathname.endsWith('.html') || pathname === '/sw.js' || pathname.endsWith('.webmanifest')) return 'no-cache';
  return 'public, max-age=3600';
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

async function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  const target = normalize(join(ROOT, decoded));
  // 防目录穿越：解析后必须仍在 dist 里
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null;
  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      const index = join(target, 'index.html');
      const indexInfo = await stat(index);
      return { file: index, info: indexInfo };
    }
    return { file: target, info };
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });

  const rawPath = (req.url || '/').split('?')[0].split('#')[0];
  if (rawPath === '/__health') return send(res, 200, 'ok');

  let found = await resolveFile(rawPath === '/' ? '/' : rawPath);
  let pathname = rawPath;

  // SPA 兜底：没有扩展名的路径统统交给 index.html（BrowserRouter 直接刷新也能进）
  if (!found && !extname(rawPath)) {
    found = await resolveFile('/');
    pathname = '/';
  }
  if (!found) return send(res, 404, 'Not Found');

  const { file, info } = found;
  const headers = {
    'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': cacheControl(pathname),
    'Last-Modified': info.mtime.toUTCString(),
    'X-Content-Type-Options': 'nosniff',
  };

  const ifModifiedSince = req.headers['if-modified-since'];
  if (ifModifiedSince && new Date(ifModifiedSince).getTime() >= Math.floor(info.mtimeMs / 1000) * 1000) {
    res.writeHead(304, headers);
    return res.end();
  }

  // 音频/大图支持单段 Range，Safari 播 wav 时会先探测
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    const size = info.size;
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start < 0) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` });
      return res.end();
    }
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
    });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file, { start, end }).pipe(res);
  }

  res.writeHead(200, { ...headers, 'Content-Length': info.size, 'Accept-Ranges': 'bytes' });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') console.error(`[serve] 端口 ${PORT} 已被占用，换一个 PORT 再试`);
  else console.error('[serve] 服务启动失败：', error.message);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`[serve] 拾谱已启动：http://${HOST}:${PORT}  静态目录 ${ROOT}`);
});

// 让计划任务停止服务时能干净退出
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
