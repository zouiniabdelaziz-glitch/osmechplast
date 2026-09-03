import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { enableLocalPreview } from './preview-mode.mjs';

// Fail closed before touching the filesystem or starting a listener.
enableLocalPreview();
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--port' || !/^\d+$/.test(args[1]))) {
  throw new Error('Only --port NUMBER is supported; host and output cannot be overridden.');
}
const port = args.length ? Number(args[1]) : 8080;
if (port > 65535) throw new Error('Invalid preview port');
const output = path.resolve('_preview');
rmSync(output, { recursive: true, force: true });
const { default: Eleventy } = await import('@11ty/eleventy');
const eleventy = new Eleventy('content', '_preview');
await eleventy.init();
await eleventy.watch();
const root = await realpath(output);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};
const server = createServer(async (request, response) => {
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  // Reject nonlocal Host headers (including DNS rebinding requests).
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(request.headers.host || '')) {
    response.writeHead(403).end('Localhost only'); return;
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405).end('Read-only preview'); return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.includes('\\') || pathname.split('/').some((part) => part.startsWith('.'))) {
      response.writeHead(404).end('Not found'); return;
    }
    let file = path.resolve(root, `.${pathname}`);
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    file = await realpath(file);
    if (!file.startsWith(`${root}${path.sep}`)) {
      response.writeHead(404).end('Not found'); return;
    }
    const body = await readFile(file);
    response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    response.writeHead(200).end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
server.on('error', async (error) => {
  console.error(error.message);
  await eleventy.stopWatch();
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  const actual = server.address();
  console.log(`Local draft preview: http://localhost:${actual.port}/entwuerfe/`);
  console.log('ENTWURF – NICHT VERÖFFENTLICHT. Stoppen: Strg+C.');
  process.send?.({ host: actual.address, port: actual.port });
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await eleventy.stopWatch();
  server.closeAllConnections();
  server.close(() => process.exit(0));
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('message', (message) => { if (message === 'stop') stop(); });
