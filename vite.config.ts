import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import {
  createShellHealthPayload,
  decodeRequestPathname,
  emitShellBootstrapMetadataAssets,
  hasDotSegmentPathAlias,
  resolveRequestPathname,
  validateShellBootstrapMetadata,
} from './src/services/release/shell-bootstrap-metadata';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = __dirname;
const releaseManifestPath = path.join(repoRoot, 'src', 'test', 'fixtures', 'api', 'release-manifest.fixture.json');
const supportMatrixPath = path.join(repoRoot, 'src', 'test', 'fixtures', 'api', 'support-matrix.fixture.json');
const shellApiRoutes = new Set(['/api/release-manifest', '/api/support-matrix', '/api/health']);

function createJsonResponse(res: import('node:http').ServerResponse, payload: unknown, statusCode = 200) {
  const body = Buffer.from(JSON.stringify(payload));

  res.writeHead(statusCode, {
    'cache-control': 'no-cache',
    'content-length': body.length,
    'content-type': 'application/json; charset=utf-8',
  });
  res.end(body);
}

function createTextResponse(
  res: import('node:http').ServerResponse,
  statusCode: number,
  text: string,
) {
  const body = Buffer.from(text);

  res.writeHead(statusCode, {
    'cache-control': 'no-cache',
    'content-length': body.length,
    'content-type': 'text/plain; charset=utf-8',
  });
  res.end(body);
}

async function loadCanonicalShellBootstrapMetadata() {
  const [releaseManifest, supportMatrix] = await Promise.all([
    readFile(releaseManifestPath, 'utf8').then((value) => JSON.parse(value)),
    readFile(supportMatrixPath, 'utf8').then((value) => JSON.parse(value)),
  ]);

  return validateShellBootstrapMetadata({ releaseManifest, supportMatrix });
}

function shellBootstrapMetadataPlugin(): Plugin {
  let buildOutputRoot = path.join(repoRoot, 'dist');

  return {
    name: 'shell-bootstrap-metadata',
    configResolved(config) {
      buildOutputRoot = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        try {
          const { rawPathname, isAbsoluteForm } = resolveRequestPathname(req.url);
          const pathname = decodeRequestPathname(rawPathname);
          if (hasDotSegmentPathAlias(rawPathname)) {
            createJsonResponse(res, { status: 'not-found' }, 404);
            return;
          }

          const isCanonicalShellApiRequest = !isAbsoluteForm && (rawPathname === '/api' || rawPathname.startsWith('/api/'));
          const isEncodedShellApiRequest = pathname === '/api' || pathname.startsWith('/api/');

          if (!isCanonicalShellApiRequest && !isEncodedShellApiRequest) {
            next();
            return;
          }

          if ((req.method ?? 'GET') !== 'GET') {
            createTextResponse(res, 405, 'Method not allowed.');
            return;
          }

          if (!isCanonicalShellApiRequest && isEncodedShellApiRequest) {
            createJsonResponse(res, { status: 'not-found' }, 404);
            return;
          }

          if (!shellApiRoutes.has(rawPathname)) {
            createJsonResponse(res, { status: 'not-found' }, 404);
            return;
          }

          try {
            const { releaseManifest, supportMatrix } = await loadCanonicalShellBootstrapMetadata();

            if (rawPathname === '/api/release-manifest') {
              createJsonResponse(res, releaseManifest);
              return;
            }

            if (rawPathname === '/api/support-matrix') {
              createJsonResponse(res, supportMatrix);
              return;
            }

            createJsonResponse(res, createShellHealthPayload({ releaseManifest, supportMatrix }));
          } catch (error) {
            console.error(error);
            createTextResponse(res, 500, 'Failed to load shell bootstrap metadata.');
          }
        } catch (error) {
          if (error instanceof URIError) {
            createTextResponse(res, 400, 'Malformed request path.');
            return;
          }

          throw error;
        }
      });
    },
    async writeBundle() {
      const metadata = await loadCanonicalShellBootstrapMetadata();
      await emitShellBootstrapMetadataAssets({ distRoot: buildOutputRoot, metadata });
    },
  };
}

export default defineConfig({
  plugins: [react(), shellBootstrapMetadataPlugin()],
});
