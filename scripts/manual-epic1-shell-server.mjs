#!/usr/bin/env node

import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const shellDeliveryServerPath = path.join(__dirname, 'shell-delivery-server.mjs');
const host = process.env.HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.PORT ?? '4175', 10);

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
  response.writeHead(204, { 'cache-control': 'no-cache' });
  response.end();
}

async function startShellDeliveryServer() {
  const child = spawn(process.execPath, [shellDeliveryServerPath, '--host', host, '--port', '0'], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const baseUrl = await new Promise((resolve, reject) => {
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Timed out waiting for shell delivery server startup.\n${stderrBuffer}`));
      }
    }, 10_000);

    const resolveReadyUrl = (chunk) => {
      stdoutBuffer += chunk;
      const match = stdoutBuffer.match(/Hosted shell delivery server ready at (http:\/\/[^\s]+)/u);

      if (match?.[1] && !settled) {
        settled = true;
        clearTimeout(timeout);
        resolve(match[1]);
      }
    };

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', resolveReadyUrl);
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk) => {
      stderrBuffer += chunk;
    });
    child.once('error', (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(error);
      }
    });
    child.once('exit', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Shell delivery server exited early with code ${code ?? 'unknown'}.\n${stderrBuffer}`));
      }
    });
  });

  return {
    baseUrl: new URL(baseUrl),
    child,
  };
}

function createProxyRequestOptions(request, upstreamBaseUrl) {
  return {
    headers: {
      ...request.headers,
      host: upstreamBaseUrl.host,
    },
    host: upstreamBaseUrl.hostname,
    method: request.method,
    path: request.url ?? '/',
    port: upstreamBaseUrl.port ? Number.parseInt(upstreamBaseUrl.port, 10) : 80,
  };
}

const { baseUrl: upstreamBaseUrl, child: deliveryServerProcess } = await startShellDeliveryServer();

const server = http.createServer((request, response) => {
  if (!request.url) {
    sendText(response, 'Missing request URL.', 400);
    return;
  }

  if ((request.method ?? 'GET') !== 'GET') {
    sendText(response, 'Method not allowed.', 405);
    return;
  }

  const pathname = new URL(request.url, `http://${host}:${port}`).pathname;

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

  const upstreamRequest = http.request(createProxyRequestOptions(request, upstreamBaseUrl), (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });

  upstreamRequest.on('error', (error) => {
    console.error(error);
    sendText(response, 'Failed to reach shell delivery server.', 502);
  });
  upstreamRequest.end();
});

function shutdown(exitCode = 0) {
  server.close(() => {
    if (deliveryServerProcess.exitCode === null && !deliveryServerProcess.killed) {
      deliveryServerProcess.kill('SIGTERM');
    }
    process.exit(exitCode);
  });
}

deliveryServerProcess.once('exit', (code) => {
  if (server.listening) {
    console.error(`shell-delivery-server exited unexpectedly with code ${code ?? 'unknown'}.`);
    shutdown(1);
  }
});

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));

console.warn(
  'scripts/manual-epic1-shell-server.mjs is deprecated. Proxying to scripts/shell-delivery-server.mjs while preserving compatibility-only legacy routes.',
);

server.listen(port, host, () => {
  console.log(`Epic 1 manual test server ready at http://${host}:${port}`);
  console.log('Routes: /, /workspace?workspaceFormatVersion=1.0.0, /workspace?workspaceFormatVersion=2.0.0');
  console.log('Compatibility routes preserved: /api/telemetry, /release-notes/0.1.0');
});
