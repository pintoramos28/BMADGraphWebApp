import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const shellDeliveryServerPath = path.join(repoRoot, 'scripts', 'shell-delivery-server.mjs');

async function waitForServer(url: string, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);

      if (response.ok) {
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

    expect(notFoundResponse.status()).toBe(404);
    expect(await notFoundResponse.json()).toEqual({ status: 'not-found' });

    const headHealthResponse = await request.fetch('/api/health', { method: 'HEAD' });

    expect(headHealthResponse.status()).toBe(405);
    expect(headHealthResponse.headers()['content-type']).toContain('text/plain');
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
    await expect(page.getByText('Browser support and workspace compatibility requirements were not met.')).toBeVisible();
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

  test('serves hosted-shell bootstrap metadata through the documented npm run dev flow', async ({ page, request }) => {
    const { baseUrl, serverProcess } = await startViteDevServer();

    try {
      const healthResponse = await request.get(new URL('/api/health', baseUrl).toString());
      const rootApiResponse = await request.get(new URL('/api', baseUrl).toString());
      const unknownApiResponse = await request.get(new URL('/api/missing-endpoint', baseUrl).toString());
      const headHealthResponse = await request.fetch(new URL('/api/health', baseUrl).toString(), { method: 'HEAD' });

      expect(healthResponse.ok()).toBe(true);
      expect(await healthResponse.json()).toMatchObject({
        status: 'ok',
        releaseManifestVersion: '0.1.0',
        supportMatrixVersion: '2026-04-15',
      });
      expect(rootApiResponse.status()).toBe(404);
      expect(await rootApiResponse.json()).toEqual({ status: 'not-found' });
      expect(unknownApiResponse.status()).toBe(404);
      expect(await unknownApiResponse.json()).toEqual({ status: 'not-found' });
      expect(headHealthResponse.status()).toBe(405);
      expect(headHealthResponse.headers()['content-type']).toContain('text/plain');

      await page.goto(new URL('/workspace/?workspaceFormatVersion=1.0.0', baseUrl).toString());

      await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();
      await expect(page).not.toHaveURL(/\/unsupported\/?$/);
    } finally {
      await stopShellDeliveryServer(serverProcess);
    }
  });
});
