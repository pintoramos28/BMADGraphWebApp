import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const shellDeliveryServerPath = path.join(repoRoot, 'scripts', 'shell-delivery-server.mjs');
const previewBaseUrl = 'http://127.0.0.1:4173';
const releaseManifestFixture = JSON.parse(
  readFileSync(path.join(repoRoot, 'src', 'test', 'fixtures', 'api', 'release-manifest.fixture.json'), 'utf8'),
) as {
  appBuildVersion: string;
  supportMatrixUrl: string;
  supportMatrixVersion: string;
};
const supportMatrixFixture = JSON.parse(
  readFileSync(path.join(repoRoot, 'src', 'test', 'fixtures', 'api', 'support-matrix.fixture.json'), 'utf8'),
) as {
  version: string;
  workspaceCompatibility: {
    maximumReadableFormat: string;
    minimumReadableFormat: string;
  };
};

async function requestRawPath(baseUrl: string, rawPath: string, method = 'GET') {
  const url = new URL(baseUrl);

  return new Promise<{ body: string; headers: http.IncomingHttpHeaders; statusCode: number }>((resolve, reject) => {
    const request = http.request(
      {
        host: url.hostname,
        method,
        path: rawPath,
        port: url.port ? Number.parseInt(url.port, 10) : undefined,
      },
      (response) => {
        let body = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          resolve({
            body,
            headers: response.headers,
            statusCode: response.statusCode ?? 0,
          });
        });
      },
    );

    request.on('error', reject);
    request.end();
  });
}

function extractFirstBuiltAssetPath(html: string) {
  const match = html.match(/(?:src|href)="(\/assets\/[^"]+)"/u);

  if (!match?.[1]) {
    throw new Error('Expected preview HTML to reference at least one built /assets/ path.');
  }

  return match[1];
}

async function waitForServer(url: string, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);

      if (response.status >= 100) {
        return;
      }
    } catch {
      // Server has not started accepting connections yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for shell delivery server at ${url}.`);
}

async function startShellDeliveryServer(
  env: NodeJS.ProcessEnv = {},
): Promise<{ baseUrl: string; serverProcess: ChildProcess }> {
  const serverProcess = spawn(process.execPath, [shellDeliveryServerPath, '--host', '127.0.0.1', '--port', '0'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const baseUrl = await new Promise<string>((resolve, reject) => {
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Timed out waiting for shell delivery server startup.\n${stderrBuffer}`));
      }
    }, 10_000);

    const resolveReadyUrl = (chunk: string) => {
      stdoutBuffer += chunk;
      const match = stdoutBuffer.match(/Hosted shell delivery server ready at (http:\/\/[^\s]+)/);

      if (match?.[1] && !settled) {
        settled = true;
        clearTimeout(timeout);
        resolve(match[1]);
      }
    };

    serverProcess.stdout?.setEncoding('utf8');
    serverProcess.stdout?.on('data', resolveReadyUrl);
    serverProcess.stderr?.setEncoding('utf8');
    serverProcess.stderr?.on('data', (chunk) => {
      stderrBuffer += chunk;
    });
    serverProcess.once('error', (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(error);
      }
    });
    serverProcess.once('exit', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Shell delivery server exited early with code ${code ?? 'unknown'}.\n${stderrBuffer}`));
      }
    });
  });

  await waitForServer(new URL('/api/health', baseUrl).toString());

  return {
    baseUrl,
    serverProcess,
  };
}

async function startViteDevServer(): Promise<{ baseUrl: string; serverProcess: ChildProcess }> {
  const serverProcess = spawn('bash', ['./scripts/with-node.sh', 'npm', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '0'], {
    cwd: repoRoot,
    env: {
      ...process.env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const baseUrl = await new Promise<string>((resolve, reject) => {
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Timed out waiting for Vite dev server startup.\n${stderrBuffer}`));
      }
    }, 15_000);

    const resolveReadyUrl = (chunk: string) => {
      stdoutBuffer += chunk;
      const match = stdoutBuffer.match(/Local:\s+(http:\/\/[^\s]+)/);

      if (match?.[1] && !settled) {
        settled = true;
        clearTimeout(timeout);
        resolve(match[1]);
      }
    };

    serverProcess.stdout?.setEncoding('utf8');
    serverProcess.stdout?.on('data', resolveReadyUrl);
    serverProcess.stderr?.setEncoding('utf8');
    serverProcess.stderr?.on('data', (chunk) => {
      stderrBuffer += chunk;
    });
    serverProcess.once('error', (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(error);
      }
    });
    serverProcess.once('exit', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Vite dev server exited early with code ${code ?? 'unknown'}.\n${stderrBuffer}`));
      }
    });
  });

  await waitForServer(new URL('/api/health', baseUrl).toString());

  return {
    baseUrl,
    serverProcess,
  };
}

async function stopShellDeliveryServer(serverProcess: ChildProcess) {
  if (serverProcess.exitCode !== null || serverProcess.killed) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 5_000);

    serverProcess.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    serverProcess.kill('SIGTERM');
  });
}

test.describe('hosted shell delivery', () => {
  test('fails closed for unknown shell API routes and non-GET health probes in preview delivery', async ({ request }) => {
    const notFoundResponse = await request.get('/api/missing-endpoint');
    const aliasedApiResponse = await requestRawPath(previewBaseUrl, '/foo/%2e%2e/api/health');
    const aliasedShellPathResponse = await requestRawPath(previewBaseUrl, '/assets/%2e%2e/index.html');
    const encodedSeparatorApiResponse = await requestRawPath(previewBaseUrl, '/foo%2F..%2Fapi%2Fhealth');
    const encodedSeparatorShellPathResponse = await requestRawPath(previewBaseUrl, '/assets%2F..%2Findex.html');
    const encodedBackslashApiResponse = await requestRawPath(previewBaseUrl, '/foo%5C..%5Capi%5Chealth');
    const encodedBackslashShellPathResponse = await requestRawPath(previewBaseUrl, '/assets%5C..%5Cindex.html');

    expect(notFoundResponse.status()).toBe(404);
    expect(await notFoundResponse.json()).toEqual({ status: 'not-found' });
    expect(aliasedApiResponse.statusCode).toBe(404);
    expect(aliasedApiResponse.headers['content-type']).toContain('text/plain');
    expect(aliasedShellPathResponse.statusCode).toBe(404);
    expect(aliasedShellPathResponse.headers['content-type']).toContain('text/plain');
    expect(encodedSeparatorApiResponse.statusCode).toBe(404);
    expect(encodedSeparatorApiResponse.headers['content-type']).toContain('text/plain');
    expect(encodedSeparatorShellPathResponse.statusCode).toBe(404);
    expect(encodedSeparatorShellPathResponse.headers['content-type']).toContain('text/plain');
    expect(encodedBackslashApiResponse.statusCode).toBe(404);
    expect(encodedBackslashApiResponse.headers['content-type']).toContain('text/plain');
    expect(encodedBackslashShellPathResponse.statusCode).toBe(404);
    expect(encodedBackslashShellPathResponse.headers['content-type']).toContain('text/plain');

    const malformedApiResponse = await request.get('/api/%E0%A4%A');

    expect(malformedApiResponse.status()).toBe(400);
    expect(malformedApiResponse.headers()['content-type']).toContain('text/plain');

    const headHealthResponse = await request.fetch('/api/health', { method: 'HEAD' });

    expect(headHealthResponse.status()).toBe(405);
    expect(headHealthResponse.headers()['content-type']).toContain('text/plain');
  });

  test('rejects encoded backslash asset aliases in preview delivery before resolving dist assets', async ({ request }) => {
    const indexHtmlResponse = await request.get('/');
    const builtAssetPath = extractFirstBuiltAssetPath(await indexHtmlResponse.text());
    const encodedBackslashAssetResponse = await requestRawPath(
      previewBaseUrl,
      builtAssetPath.replace('/assets/', '/assets%5C'),
    );

    expect(encodedBackslashAssetResponse.statusCode).toBe(404);
    expect(encodedBackslashAssetResponse.headers['content-type']).toContain('text/plain');
  });

  test('loads the hosted shell home route with real bootstrap metadata delivery', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'BMADGraphWebApp' })).toBeVisible();
    await expect(page.getByText('Release 0.1.0')).toBeVisible();
    await expect(page.getByText('Support matrix 2026-04-15')).toBeVisible();
    await expect(page.getByText('No blocking environment issues detected.')).toBeVisible();
  });

  test('allows readable workspace-format routes through the hosted shell gate', async ({ page }) => {
    await page.goto('/workspace?workspaceFormatVersion=1.0.0');

    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();
    await expect(page).not.toHaveURL(/\/unsupported$/);
  });

  test('blocks unreadable workspace-format routes through the unsupported shell route', async ({ page }) => {
    await page.goto('/workspace?workspaceFormatVersion=2.0.0');

    await expect(page).toHaveURL(/\/unsupported$/);
    await expect(page.getByRole('heading', { name: 'Unsupported environment' })).toBeVisible();
    await expect(
      page
        .getByRole('paragraph')
        .filter({ hasText: 'Workspace format 2.0.0 is outside the readable range 1.0.0 to 1.x.' }),
    ).toBeVisible();
  });

  test('serves the unsupported route through hosted-shell SPA fallback', async ({ page }) => {
    await page.goto('/unsupported');

    await expect(page).toHaveURL(/\/unsupported\/?$/);
    await expect(page.getByRole('heading', { name: 'Unsupported environment' })).toBeVisible();
    await expect(
      page.getByText(
        'This shell is blocked before import or reopen work can begin. Please switch to a supported desktop browser or use a workspace configuration that matches the published compatibility envelope.',
      ),
    ).toBeVisible();
    await expect(page.getByText(`Published support matrix: ${supportMatrixFixture.version}`)).toBeVisible();
  });

  test('fails closed for protected workspace and review detail routes without a readable saved snapshot', async ({ page }) => {
    await page.goto('/workspace/workspace_demo');
    await expect(page).toHaveURL(/\/unsupported$/);
    await expect(
      page
        .getByRole('paragraph')
        .filter({
          hasText: 'The shell could not load a saved compatibility snapshot for workspace workspace_demo before reopening it.',
        }),
    ).toBeVisible();

    await page.goto('/review/workspace_demo');
    await expect(page).toHaveURL(/\/unsupported$/);
    await expect(
      page
        .getByRole('paragraph')
        .filter({
          hasText: 'The shell could not load a saved compatibility snapshot for workspace workspace_demo before reopening it.',
        }),
    ).toBeVisible();
  });

  test('does not rewrite encoded protected-route separator aliases to the hosted shell', async () => {
    const absoluteFormWorkspaceResponse = await requestRawPath(
      previewBaseUrl,
      new URL('/workspace/workspace_demo', previewBaseUrl).toString(),
    );
    const absoluteFormReviewResponse = await requestRawPath(
      previewBaseUrl,
      new URL('/review/workspace_demo', previewBaseUrl).toString(),
    );
    const workspaceAliasResponse = await requestRawPath(previewBaseUrl, '/workspace%2Fworkspace_demo');
    const reviewAliasResponse = await requestRawPath(previewBaseUrl, '/review%2Fworkspace_demo');
    const workspaceBackslashAliasResponse = await requestRawPath(previewBaseUrl, '/workspace%5Cworkspace_demo');
    const reviewBackslashAliasResponse = await requestRawPath(previewBaseUrl, '/review%5Cworkspace_demo');
    const headWorkspaceAliasResponse = await requestRawPath(previewBaseUrl, '/workspace%2Fworkspace_demo', 'HEAD');
    const optionsReviewAliasResponse = await requestRawPath(previewBaseUrl, '/review%5Cworkspace_demo', 'OPTIONS');

    expect(absoluteFormWorkspaceResponse.statusCode).toBe(404);
    expect(absoluteFormWorkspaceResponse.headers['content-type']).toContain('text/plain');
    expect(absoluteFormReviewResponse.statusCode).toBe(404);
    expect(absoluteFormReviewResponse.headers['content-type']).toContain('text/plain');
    expect(workspaceAliasResponse.statusCode).toBe(404);
    expect(workspaceAliasResponse.headers['content-type']).toContain('text/plain');
    expect(reviewAliasResponse.statusCode).toBe(404);
    expect(reviewAliasResponse.headers['content-type']).toContain('text/plain');
    expect(workspaceBackslashAliasResponse.statusCode).toBe(404);
    expect(workspaceBackslashAliasResponse.headers['content-type']).toContain('text/plain');
    expect(reviewBackslashAliasResponse.statusCode).toBe(404);
    expect(reviewBackslashAliasResponse.headers['content-type']).toContain('text/plain');
    expect(headWorkspaceAliasResponse.statusCode).toBe(404);
    expect(headWorkspaceAliasResponse.headers['content-type']).toContain('text/plain');
    expect(optionsReviewAliasResponse.statusCode).toBe(404);
    expect(optionsReviewAliasResponse.headers['content-type']).toContain('text/plain');
  });

  test('returns 404 for missing asset paths instead of rewriting them to index.html', async ({ request }) => {
    const response = await request.get('/assets/missing-shell-chunk.js');

    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('text/plain');
  });

  test('treats malformed percent-encoded request paths as client errors', async ({ request }) => {
    const response = await request.get('/workspace/%E0%A4%A');

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('text/plain');
  });

  test('surfaces delivery/setup failures before protected routes continue loading', async ({ page }) => {
    const { baseUrl: brokenBaseUrl, serverProcess } = await startShellDeliveryServer({
      BMAD_SHELL_DELIVERY_FAILURE_MODE: 'support-matrix-unavailable',
    });

    try {
      await page.goto(new URL('/workspace?workspaceFormatVersion=1.0.0', brokenBaseUrl).toString());

      await expect(page.getByRole('heading', { name: 'Shell bootstrap failed' })).toBeVisible();
      await expect(page.getByText('The shell could not load release metadata and support facts.')).toBeVisible();
    } finally {
      await stopShellDeliveryServer(serverProcess);
    }
  });

  test('surfaces release-manifest delivery failures before protected routes continue loading', async ({ page }) => {
    const { baseUrl: brokenBaseUrl, serverProcess } = await startShellDeliveryServer({
      BMAD_SHELL_DELIVERY_FAILURE_MODE: 'release-manifest-unavailable',
    });

    try {
      await page.goto(new URL('/workspace?workspaceFormatVersion=1.0.0', brokenBaseUrl).toString());

      await expect(page.getByRole('heading', { name: 'Shell bootstrap failed' })).toBeVisible();
      await expect(page.getByText('The shell could not load release metadata and support facts.')).toBeVisible();
    } finally {
      await stopShellDeliveryServer(serverProcess);
    }
  });

  test('serves preview bootstrap contract endpoints directly on the happy path', async ({ request }) => {
    const releaseManifestResponse = await request.get('/api/release-manifest');
    const supportMatrixResponse = await request.get('/api/support-matrix');
    const healthResponse = await request.get('/api/health');

    expect(releaseManifestResponse.ok()).toBe(true);
    expect(await releaseManifestResponse.json()).toEqual(releaseManifestFixture);
    expect(supportMatrixResponse.ok()).toBe(true);
    expect(await supportMatrixResponse.json()).toEqual(supportMatrixFixture);
    expect(healthResponse.ok()).toBe(true);
    expect(await healthResponse.json()).toMatchObject({
      status: 'ok',
      releaseManifestVersion: releaseManifestFixture.appBuildVersion,
      supportMatrixVersion: supportMatrixFixture.version,
    });
  });

  test('fails preview health probes closed when bootstrap support metadata is unavailable', async ({ request }) => {
    const { baseUrl: brokenBaseUrl, serverProcess } = await startShellDeliveryServer({
      BMAD_SHELL_DELIVERY_FAILURE_MODE: 'support-matrix-unavailable',
    });

    try {
      const healthResponse = await request.get(new URL('/api/health', brokenBaseUrl).toString());

      expect(healthResponse.status()).toBe(503);
      expect(await healthResponse.json()).toEqual({
        status: 'error',
        message: 'support matrix unavailable',
      });
    } finally {
      await stopShellDeliveryServer(serverProcess);
    }
  });

  test('fails preview release/support endpoints closed when bootstrap support metadata is unavailable', async ({ request }) => {
    const { baseUrl: brokenBaseUrl, serverProcess } = await startShellDeliveryServer({
      BMAD_SHELL_DELIVERY_FAILURE_MODE: 'support-matrix-unavailable',
    });

    try {
      const releaseManifestResponse = await request.get(new URL('/api/release-manifest', brokenBaseUrl).toString());
      const supportMatrixResponse = await request.get(new URL('/api/support-matrix', brokenBaseUrl).toString());

      expect(releaseManifestResponse.ok()).toBe(true);
      expect(await releaseManifestResponse.json()).toEqual(releaseManifestFixture);
      expect(supportMatrixResponse.status()).toBe(503);
      expect(await supportMatrixResponse.json()).toEqual({
        status: 'error',
        message: 'support matrix unavailable',
      });
    } finally {
      await stopShellDeliveryServer(serverProcess);
    }
  });

  test('fails preview health probes closed when bootstrap release metadata is unavailable', async ({ request }) => {
    const { baseUrl: brokenBaseUrl, serverProcess } = await startShellDeliveryServer({
      BMAD_SHELL_DELIVERY_FAILURE_MODE: 'release-manifest-unavailable',
    });

    try {
      const healthResponse = await request.get(new URL('/api/health', brokenBaseUrl).toString());

      expect(healthResponse.status()).toBe(503);
      expect(await healthResponse.json()).toEqual({
        status: 'error',
        message: 'release manifest unavailable',
      });
    } finally {
      await stopShellDeliveryServer(serverProcess);
    }
  });

  test('fails preview release/support endpoints closed when bootstrap release metadata is unavailable', async ({ request }) => {
    const { baseUrl: brokenBaseUrl, serverProcess } = await startShellDeliveryServer({
      BMAD_SHELL_DELIVERY_FAILURE_MODE: 'release-manifest-unavailable',
    });

    try {
      const releaseManifestResponse = await request.get(new URL('/api/release-manifest', brokenBaseUrl).toString());
      const supportMatrixResponse = await request.get(new URL('/api/support-matrix', brokenBaseUrl).toString());

      expect(releaseManifestResponse.status()).toBe(503);
      expect(await releaseManifestResponse.json()).toEqual({
        status: 'error',
        message: 'release manifest unavailable',
      });
      expect(supportMatrixResponse.ok()).toBe(true);
      expect(await supportMatrixResponse.json()).toEqual(supportMatrixFixture);
    } finally {
      await stopShellDeliveryServer(serverProcess);
    }
  });

  test('serves hosted-shell bootstrap metadata through the documented npm run dev flow', async ({ page, request }) => {
    const { baseUrl, serverProcess } = await startViteDevServer();

    try {
      const releaseManifestResponse = await request.get(new URL('/api/release-manifest', baseUrl).toString());
      const supportMatrixResponse = await request.get(new URL('/api/support-matrix', baseUrl).toString());
      const healthResponse = await request.get(new URL('/api/health', baseUrl).toString());
      const rootApiResponse = await request.get(new URL('/api', baseUrl).toString());
      const unknownApiResponse = await request.get(new URL('/api/missing-endpoint', baseUrl).toString());
      const encodedApiResponse = await request.get(new URL('/api%2Fhealth', baseUrl).toString());
      const absoluteFormApiResponse = await requestRawPath(baseUrl, new URL('/api/health', baseUrl).toString());
      const absoluteFormWorkspaceResponse = await requestRawPath(
        baseUrl,
        new URL('/workspace/workspace_demo', baseUrl).toString(),
      );
      const absoluteFormReviewResponse = await requestRawPath(
        baseUrl,
        new URL('/review/workspace_demo', baseUrl).toString(),
      );
      const encodedLeadingSlashApiResponse = await requestRawPath(baseUrl, '/%2Fapi%2Fhealth');
      const aliasedApiResponse = await requestRawPath(baseUrl, '/foo/%2e%2e/api/health');
      const aliasedShellPathResponse = await requestRawPath(baseUrl, '/assets/%2e%2e/index.html');
      const encodedSeparatorApiResponse = await requestRawPath(baseUrl, '/foo%2F..%2Fapi%2Fhealth');
      const encodedSeparatorShellPathResponse = await requestRawPath(baseUrl, '/assets%2F..%2Findex.html');
      const encodedBackslashApiResponse = await requestRawPath(baseUrl, '/foo%5C..%5Capi%5Chealth');
      const encodedBackslashShellPathResponse = await requestRawPath(baseUrl, '/assets%5C..%5Cindex.html');
      const workspaceAliasResponse = await requestRawPath(baseUrl, '/workspace%2Fworkspace_demo');
      const reviewAliasResponse = await requestRawPath(baseUrl, '/review%2Fworkspace_demo');
      const workspaceBackslashAliasResponse = await requestRawPath(baseUrl, '/workspace%5Cworkspace_demo');
      const reviewBackslashAliasResponse = await requestRawPath(baseUrl, '/review%5Cworkspace_demo');
      const workspaceExtraAliasResponse = await requestRawPath(baseUrl, '/workspace%2Fworkspace_demo%2Fextra');
      const reviewExtraBackslashAliasResponse = await requestRawPath(baseUrl, '/review%5Cworkspace_demo%5Cextra');
      const absoluteFormWorkspaceExtraResponse = await requestRawPath(
        baseUrl,
        new URL('/workspace/workspace_demo/extra', baseUrl).toString(),
      );
      const optionsTransformedAssetResponse = await requestRawPath(baseUrl, '/src/main.tsx', 'OPTIONS');
      const headWorkspaceAliasResponse = await requestRawPath(baseUrl, '/workspace%2Fworkspace_demo', 'HEAD');
      const optionsReviewAliasResponse = await requestRawPath(baseUrl, '/review%5Cworkspace_demo', 'OPTIONS');
      const headHealthResponse = await request.fetch(new URL('/api/health', baseUrl).toString(), { method: 'HEAD' });

      expect(releaseManifestResponse.ok()).toBe(true);
      expect(await releaseManifestResponse.json()).toEqual(releaseManifestFixture);
      expect(supportMatrixResponse.ok()).toBe(true);
      expect(await supportMatrixResponse.json()).toEqual(supportMatrixFixture);
      expect(healthResponse.ok()).toBe(true);
      expect(await healthResponse.json()).toMatchObject({
        status: 'ok',
        releaseManifestVersion: releaseManifestFixture.appBuildVersion,
        supportMatrixVersion: supportMatrixFixture.version,
      });
      expect(rootApiResponse.status()).toBe(404);
      expect(await rootApiResponse.json()).toEqual({ status: 'not-found' });
      expect(unknownApiResponse.status()).toBe(404);
      expect(await unknownApiResponse.json()).toEqual({ status: 'not-found' });
      expect(encodedApiResponse.status()).toBe(404);
      expect(await encodedApiResponse.json()).toEqual({ status: 'not-found' });
      expect(absoluteFormApiResponse.statusCode).toBe(404);
      expect(JSON.parse(absoluteFormApiResponse.body)).toEqual({ status: 'not-found' });
      expect(absoluteFormWorkspaceResponse.statusCode).toBe(404);
      expect(JSON.parse(absoluteFormWorkspaceResponse.body)).toEqual({ status: 'not-found' });
      expect(absoluteFormReviewResponse.statusCode).toBe(404);
      expect(JSON.parse(absoluteFormReviewResponse.body)).toEqual({ status: 'not-found' });
      expect(encodedLeadingSlashApiResponse.statusCode).toBe(404);
      expect(JSON.parse(encodedLeadingSlashApiResponse.body)).toEqual({ status: 'not-found' });
      expect(aliasedApiResponse.statusCode).toBe(404);
      expect(JSON.parse(aliasedApiResponse.body)).toEqual({ status: 'not-found' });
      expect(aliasedShellPathResponse.statusCode).toBe(404);
      expect(JSON.parse(aliasedShellPathResponse.body)).toEqual({ status: 'not-found' });
      expect(encodedSeparatorApiResponse.statusCode).toBe(404);
      expect(JSON.parse(encodedSeparatorApiResponse.body)).toEqual({ status: 'not-found' });
      expect(encodedSeparatorShellPathResponse.statusCode).toBe(404);
      expect(JSON.parse(encodedSeparatorShellPathResponse.body)).toEqual({ status: 'not-found' });
      expect(encodedBackslashApiResponse.statusCode).toBe(404);
      expect(JSON.parse(encodedBackslashApiResponse.body)).toEqual({ status: 'not-found' });
      expect(encodedBackslashShellPathResponse.statusCode).toBe(404);
      expect(JSON.parse(encodedBackslashShellPathResponse.body)).toEqual({ status: 'not-found' });
      expect(workspaceAliasResponse.statusCode).toBe(404);
      expect(JSON.parse(workspaceAliasResponse.body)).toEqual({ status: 'not-found' });
      expect(reviewAliasResponse.statusCode).toBe(404);
      expect(JSON.parse(reviewAliasResponse.body)).toEqual({ status: 'not-found' });
      expect(workspaceBackslashAliasResponse.statusCode).toBe(404);
      expect(JSON.parse(workspaceBackslashAliasResponse.body)).toEqual({ status: 'not-found' });
      expect(reviewBackslashAliasResponse.statusCode).toBe(404);
      expect(JSON.parse(reviewBackslashAliasResponse.body)).toEqual({ status: 'not-found' });
      expect(workspaceExtraAliasResponse.statusCode).toBe(404);
      expect(JSON.parse(workspaceExtraAliasResponse.body)).toEqual({ status: 'not-found' });
      expect(reviewExtraBackslashAliasResponse.statusCode).toBe(404);
      expect(JSON.parse(reviewExtraBackslashAliasResponse.body)).toEqual({ status: 'not-found' });
      expect(absoluteFormWorkspaceExtraResponse.statusCode).toBe(404);
      expect(JSON.parse(absoluteFormWorkspaceExtraResponse.body)).toEqual({ status: 'not-found' });
      expect(optionsTransformedAssetResponse.statusCode).toBe(204);
      expect(headWorkspaceAliasResponse.statusCode).toBe(404);
      expect(headWorkspaceAliasResponse.headers['content-type']).toContain('application/json');
      expect(optionsReviewAliasResponse.statusCode).toBe(404);
      expect(optionsReviewAliasResponse.headers['content-type']).toContain('application/json');
      expect(headHealthResponse.status()).toBe(405);
      expect(headHealthResponse.headers()['content-type']).toContain('text/plain');

      await page.goto(new URL('/', baseUrl).toString());

      await expect(page.getByRole('heading', { name: 'BMADGraphWebApp' })).toBeVisible();
      await expect(page.getByText(`Release ${releaseManifestFixture.appBuildVersion}`)).toBeVisible();
      await expect(page.getByText(`Support matrix ${supportMatrixFixture.version}`)).toBeVisible();

      await page.goto(new URL('/workspace/?workspaceFormatVersion=1.0.0', baseUrl).toString());

      await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();
      await expect(page).not.toHaveURL(/\/unsupported\/?$/);

      await page.goto(new URL('/workspace/workspace_demo', baseUrl).toString());

      await expect(page).toHaveURL(/\/unsupported\/?$/);
      await expect(
        page
          .getByRole('paragraph')
          .filter({
            hasText: 'The shell could not load a saved compatibility snapshot for workspace workspace_demo before reopening it.',
          }),
      ).toBeVisible();

      await page.goto(new URL('/review/workspace_demo', baseUrl).toString());

      await expect(page).toHaveURL(/\/unsupported\/?$/);
      await expect(
        page
          .getByRole('paragraph')
          .filter({
            hasText: 'The shell could not load a saved compatibility snapshot for workspace workspace_demo before reopening it.',
          }),
      ).toBeVisible();

      await page.goto(new URL('/unsupported', baseUrl).toString());

      await expect(page).toHaveURL(/\/unsupported\/?$/);
      await expect(page.getByRole('heading', { name: 'Unsupported environment' })).toBeVisible();
      await expect(
        page.getByText(
          'This shell is blocked before import or reopen work can begin. Please switch to a supported desktop browser or use a workspace configuration that matches the published compatibility envelope.',
        ),
      ).toBeVisible();
      await expect(page.getByText(`Published support matrix: ${supportMatrixFixture.version}`)).toBeVisible();
    } finally {
      await stopShellDeliveryServer(serverProcess);
    }
  });
});
