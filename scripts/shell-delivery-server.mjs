#!/usr/bin/env node

import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createShellDeliveryFailureResponse,
  decodeRequestPathname,
  hasDotSegmentPathAlias,
  hasPathSeparatorAlias,
  isCanonicalShellRouteRequestPath,
  isShellRoutePathname,
  loadDeployedShellBootstrapMetadata,
  loadDeployedShellHealthPayload,
  resolveRequestPathname,
} from './shell-bootstrap-metadata.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const distRoot = path.join(repoRoot, 'dist');
const failureMode = process.env.BMAD_SHELL_DELIVERY_FAILURE_MODE ?? 'none';

function parseCliArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === '--host' && next) {
      options.host = next;
      index += 1;
      continue;
    }

    if (current === '--port' && next) {
      options.port = Number.parseInt(next, 10);
      index += 1;
    }
  }

  return options;
}

const cliOptions = parseCliArgs(process.argv.slice(2));
const host = cliOptions.host ?? process.env.HOST ?? '127.0.0.1';
const port = cliOptions.port ?? Number.parseInt(process.env.PORT ?? '4173', 10);

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

const genericServerFailureMessage = 'Unexpected server failure.';

function isShellOwnedRoutePrefixPathname(pathname) {
  return (
    pathname === '/' ||
    pathname === '/workspace' ||
    pathname.startsWith('/workspace/') ||
    pathname === '/review' ||
    pathname.startsWith('/review/') ||
    pathname === '/unsupported' ||
    pathname.startsWith('/unsupported/')
  );
}

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

async function resolveStaticFile(urlPathname) {
  const requestedPath = urlPathname === '/' ? '/index.html' : urlPathname;
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
  console.error('Expected a built app at dist/. Run `bash ./scripts/with-node.sh npm run build` first.');
  process.exit(1);
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendText(response, 'Missing request URL.', 400);
    return;
  }

  try {
    const { rawPathname, isAbsoluteForm } = resolveRequestPathname(request.url);
    const pathname = decodeRequestPathname(rawPathname);
    const isCanonicalShellApiRequest = !isAbsoluteForm && (rawPathname === '/api' || rawPathname.startsWith('/api/'));
    const isEncodedShellApiRequest = pathname === '/api' || pathname.startsWith('/api/');
    const isCanonicalShellRouteRequest = !isAbsoluteForm && isCanonicalShellRouteRequestPath(rawPathname);
    const isShellOwnedRouteRequest = isShellRoutePathname(pathname) || isShellOwnedRoutePrefixPathname(pathname);
    const failureResponse = createShellDeliveryFailureResponse(pathname, failureMode);

    if (hasDotSegmentPathAlias(rawPathname)) {
      sendText(response, 'Not found.', 404);
      return;
    }

    if (hasPathSeparatorAlias(rawPathname)) {
      sendText(response, 'Not found.', 404);
      return;
    }

    if (!isCanonicalShellApiRequest && isEncodedShellApiRequest) {
      sendJson(response, { status: 'not-found' }, 404);
      return;
    }

    if (!isCanonicalShellRouteRequest && isShellOwnedRouteRequest) {
      sendText(response, 'Not found.', 404);
      return;
    }

    if ((request.method ?? 'GET') !== 'GET') {
      sendText(response, 'Method not allowed.', 405);
      return;
    }

    if (pathname === '/api/release-manifest') {
      if (failureResponse) {
        sendJson(response, failureResponse.payload, failureResponse.statusCode);
        return;
      }

      const metadata = await loadDeployedShellBootstrapMetadata({ distRoot });

      sendJson(response, metadata.releaseManifest);
      return;
    }

    if (pathname === '/api/support-matrix') {
      if (failureResponse) {
        sendJson(response, failureResponse.payload, failureResponse.statusCode);
        return;
      }

      const metadata = await loadDeployedShellBootstrapMetadata({ distRoot });

      sendJson(response, metadata.supportMatrix);
      return;
    }

    if (pathname === '/api/health') {
      if (failureResponse) {
        sendJson(response, failureResponse.payload, failureResponse.statusCode);
        return;
      }

      await loadDeployedShellBootstrapMetadata({ distRoot });
      const healthPayload = await loadDeployedShellHealthPayload({ distRoot });
      sendJson(response, healthPayload);
      return;
    }

    if (isCanonicalShellApiRequest) {
      sendJson(response, { status: 'not-found' }, 404);
      return;
    }

    const staticFilePath = await resolveStaticFile(pathname);

    if (staticFilePath) {
      await streamFile(response, staticFilePath);
      return;
    }

    if (isCanonicalShellRouteRequest && isShellRoutePathname(pathname)) {
      await streamIndexHtml(response);
      return;
    }

    sendText(response, 'Not found.', 404);
  } catch (error) {
    if (error instanceof URIError) {
      sendText(response, 'Malformed request path.', 400);
      return;
    }

    console.error(error);
    sendText(response, genericServerFailureMessage, 500);
  }
});

server.listen(port, host, () => {
  const address = server.address();
  const resolvedPort = typeof address === 'object' && address ? address.port : port;

  console.log(`Hosted shell delivery server ready at http://${host}:${resolvedPort}`);
  console.log('Operational routes: /api/release-manifest, /api/support-matrix, /api/health');
  console.log('SPA fallback covers /, /workspace, /workspace/:workspaceId, /review/:workspaceId, and /unsupported.');
});
