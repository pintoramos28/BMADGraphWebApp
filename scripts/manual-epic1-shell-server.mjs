#!/usr/bin/env node

import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const distRoot = path.join(repoRoot, 'dist');
const host = process.env.HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.PORT ?? '4175', 10);

const releaseManifest = {
  schemaVersion: '1.0.0',
  appBuildVersion: '0.1.0',
  releaseDate: '2026-04-15T00:00:00Z',
  channel: 'internal-stable',
  supportMatrixVersion: '2026-04-15',
  supportMatrixUrl: '/api/support-matrix',
  workspaceCompatibility: {
    minReadableFormat: '1.0.0',
    maxReadableFormat: '1.x',
    migrationPolicy: 'migrate-on-open',
  },
  serviceWorker: {
    version: 'sw-0.1.0',
    scope: '/',
    offlineReadyTimeoutMs: 5000,
    updatePromptMode: 'soft-refresh',
  },
  telemetry: {
    endpoint: '/api/telemetry',
    schemaVersion: '1.0.0',
  },
  releaseNotes: {
    title: 'Initial internal preview',
    url: '/release-notes/0.1.0',
  },
  integrity: {
    manifestSha256: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  },
};

const supportMatrix = {
  version: '2026-04-15',
  publishedAt: '2026-04-16T00:00:00Z',
  standardZoom: '100%',
  supportedBrowsers: [
    {
      family: 'chrome',
      supportLevel: 'supported',
      minimumMajorVersion: 125,
      desktopOnly: true,
      notes: 'Current major desktop Chrome is release-blocking.',
    },
    {
      family: 'edge',
      supportLevel: 'supported',
      minimumMajorVersion: 125,
      desktopOnly: true,
      notes: 'Current major desktop Edge is release-blocking.',
    },
    {
      family: 'firefox',
      supportLevel: 'secondary',
      minimumMajorVersion: 126,
      desktopOnly: true,
      notes: 'Best-effort secondary compatibility target.',
    },
    {
      family: 'safari',
      supportLevel: 'unsupported',
      desktopOnly: true,
      notes: 'Safari is unsupported for the MVP shell.',
    },
  ],
  workspaceCompatibility: {
    minimumReadableFormat: '1.0.0',
    maximumReadableFormat: '1.x',
  },
};

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function sendJson(response, payload, statusCode = 200) {
  const body = Buffer.from(JSON.stringify(payload));

  response.writeHead(statusCode, {
    'cache-control': 'no-cache',
    'content-length': body.length,
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(body);
}

function sendText(response, text, statusCode = 200) {
  const body = Buffer.from(text);

  response.writeHead(statusCode, {
    'cache-control': 'no-cache',
    'content-length': body.length,
    'content-type': 'text/plain; charset=utf-8',
  });
  response.end(body);
}

function sendNoContent(response) {
  response.writeHead(204, {
    'cache-control': 'no-cache',
  });
  response.end();
}

async function resolveStaticFile(urlPathname) {
  const normalizedPathname = decodeURIComponent(urlPathname);
  const requestedPath = normalizedPathname === '/' ? '/index.html' : normalizedPathname;
  const filePath = path.normalize(path.join(distRoot, requestedPath));
  const relativePath = path.relative(distRoot, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      return null;
    }

    return filePath;
  } catch {
    return null;
  }
}

async function streamFile(response, filePath) {
  const fileStat = await stat(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes.get(extension) ?? 'application/octet-stream';

  response.writeHead(200, {
    'content-length': fileStat.size,
    'content-type': contentType,
  });

  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);

    stream.on('error', reject);
    stream.on('close', resolve);
    stream.pipe(response);
  });
}

async function streamIndexHtml(response) {
  const indexPath = path.join(distRoot, 'index.html');
  const html = await readFile(indexPath);

  response.writeHead(200, {
    'cache-control': 'no-cache',
    'content-length': html.length,
    'content-type': 'text/html; charset=utf-8',
  });
  response.end(html);
}

if (!existsSync(distRoot)) {
  console.error('Expected a built app at dist/. Run `./scripts/with-node.sh npm run build` first.');
  process.exit(1);
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendText(response, 'Missing request URL.', 400);
    return;
  }

  if ((request.method ?? 'GET') !== 'GET') {
    sendText(response, 'Method not allowed.', 405);
    return;
  }

  const requestUrl = new URL(request.url, `http://${host}:${port}`);
  const { pathname } = requestUrl;

  try {
    if (pathname === '/api/release-manifest') {
      sendJson(response, releaseManifest);
      return;
    }

    if (pathname === '/api/support-matrix') {
      sendJson(response, supportMatrix);
      return;
    }

    if (pathname === '/api/telemetry') {
      sendJson(response, { status: 'ok' });
      return;
    }

    if (pathname === '/release-notes/0.1.0') {
      sendText(response, 'Initial internal preview');
      return;
    }

    if (pathname === '/favicon.ico') {
      sendNoContent(response);
      return;
    }

    const staticFilePath = await resolveStaticFile(pathname);

    if (staticFilePath) {
      await streamFile(response, staticFilePath);
      return;
    }

    await streamIndexHtml(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server failure.';
    sendText(response, message, 500);
  }
});

server.listen(port, host, () => {
  console.log(`Epic 1 manual test server ready at http://${host}:${port}`);
  console.log('Routes: /, /workspace?workspaceFormatVersion=1.0.0, /workspace?workspaceFormatVersion=2.0.0');
  console.log('Canonical protected routes fail closed until a compatible saved workspace exists in IndexedDB.');
});

