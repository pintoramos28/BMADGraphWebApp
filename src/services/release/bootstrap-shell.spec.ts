import { describe, expect, it, vi } from 'vitest';

import { releaseManifestFixture } from '../../test/fixtures/api/release-manifest.fixture';
import { supportMatrixFixture } from '../../test/fixtures/api/support-matrix.fixture';

const mocks = vi.hoisted(() => ({
  loadReleaseManifest: vi.fn(),
  loadSupportMatrix: vi.fn(),
  detectBrowserEnvironment: vi.fn(),
  evaluateShellEnvironment: vi.fn(),
  disableServiceWorker: vi.fn(),
  registerServiceWorker: vi.fn(),
}));

vi.mock('./load-release-manifest', () => ({
  loadReleaseManifest: mocks.loadReleaseManifest,
}));

vi.mock('./load-support-matrix', () => ({
  loadSupportMatrix: mocks.loadSupportMatrix,
}));

vi.mock('./detect-environment', () => ({
  detectBrowserEnvironment: mocks.detectBrowserEnvironment,
  evaluateShellEnvironment: mocks.evaluateShellEnvironment,
}));

vi.mock('./register-service-worker', () => ({
  disableServiceWorker: mocks.disableServiceWorker,
  registerServiceWorker: mocks.registerServiceWorker,
}));

import { bootstrapShell } from './bootstrap-shell';

describe('bootstrapShell', () => {
  it('disables the service worker on the Vite dev server instead of registering it', async () => {
    const unavailableStatus = {
      cacheStatus: 'not-available' as const,
      offlineReady: false,
      offlineReadyElapsedMs: null,
      updateAvailable: false,
      scope: null,
    };

    mocks.loadReleaseManifest.mockResolvedValue(releaseManifestFixture);
    mocks.loadSupportMatrix.mockResolvedValue(supportMatrixFixture);
    mocks.detectBrowserEnvironment.mockReturnValue({
      family: 'chrome',
      majorVersion: 126,
      isDesktop: true,
      secureContext: true,
      userAgent: 'Mozilla/5.0 Chrome/126.0.0.0',
    });
    mocks.evaluateShellEnvironment.mockReturnValue({
      lifecycle: 'ready',
      browserStatus: 'supported',
      workspaceStatus: 'unchecked',
      secureContext: true,
      supportMatrixVersion: supportMatrixFixture.version,
      releaseNotes: releaseManifestFixture.releaseNotes,
      updatePromptMode: 'soft-refresh',
      cacheScope: '/',
      offlineReadyTimeoutMs: 5000,
      reasons: [],
      shouldRouteToUnsupported: false,
    });
    mocks.disableServiceWorker.mockResolvedValue(unavailableStatus);

    await expect(
      bootstrapShell({
        window: {
          isSecureContext: true,
          __vite_plugin_react_preamble_installed__: true,
        } as Window & { __vite_plugin_react_preamble_installed__: boolean },
        navigator: {} as Navigator,
      }),
    ).resolves.toMatchObject({
      serviceWorker: unavailableStatus,
    });

    expect(mocks.disableServiceWorker).toHaveBeenCalledOnce();
    expect(mocks.registerServiceWorker).not.toHaveBeenCalled();
  });

  it('rejects a support matrix whose version does not match the manifest pin', async () => {
    mocks.loadReleaseManifest.mockResolvedValue(releaseManifestFixture);
    mocks.loadSupportMatrix.mockResolvedValue({
      ...supportMatrixFixture,
      version: '2026-04-16',
    });

    await expect(bootstrapShell()).rejects.toThrow(
      'Support matrix version mismatch: manifest expects 2026-04-15 but received 2026-04-16.',
    );
    expect(mocks.registerServiceWorker).not.toHaveBeenCalled();
  });

  it('forwards service worker update callbacks so shell status can refresh after bootstrap', async () => {
    const serviceWorkerStatus = {
      cacheStatus: 'cached' as const,
      offlineReady: true,
      offlineReadyElapsedMs: 42,
      updateAvailable: false,
      scope: '/',
    };

    const updateAvailable = vi.fn();

    mocks.loadReleaseManifest.mockResolvedValue(releaseManifestFixture);
    mocks.loadSupportMatrix.mockResolvedValue(supportMatrixFixture);
    mocks.detectBrowserEnvironment.mockReturnValue({
      family: 'chrome',
      majorVersion: 126,
      isDesktop: true,
      secureContext: true,
      userAgent: 'Mozilla/5.0 Chrome/126.0.0.0',
    });
    mocks.evaluateShellEnvironment.mockReturnValue({
      lifecycle: 'ready',
      browserStatus: 'supported',
      workspaceStatus: 'unchecked',
      secureContext: true,
      supportMatrixVersion: supportMatrixFixture.version,
      releaseNotes: releaseManifestFixture.releaseNotes,
      updatePromptMode: 'soft-refresh',
      cacheScope: '/',
      offlineReadyTimeoutMs: 5000,
      reasons: [],
      shouldRouteToUnsupported: false,
    });
    mocks.disableServiceWorker.mockReset();
    mocks.registerServiceWorker.mockImplementation(async (input) => {
      input.onUpdateAvailable?.({} as ServiceWorkerRegistration, releaseManifestFixture.releaseNotes, 'soft-refresh');
      return serviceWorkerStatus;
    });

    const result = await bootstrapShell({
      browser: {
        family: 'chrome',
        majorVersion: 126,
        isDesktop: true,
        secureContext: true,
        userAgent: 'Mozilla/5.0 Chrome/126.0.0.0',
      },
      navigator: {} as Navigator,
      window: { isSecureContext: true } as Window,
      workspaceCompatibility: {
        workspaceFormatVersion: '1.0.0',
      },
      onUpdateAvailable: updateAvailable,
    });

    expect(mocks.registerServiceWorker).toHaveBeenCalledOnce();
    expect(mocks.registerServiceWorker.mock.calls[0]?.[0].onUpdateAvailable).toBe(updateAvailable);
    expect(result.serviceWorker).toEqual(serviceWorkerStatus);
    expect(updateAvailable).toHaveBeenCalledOnce();
  });

  it('degrades cache and offline-ready status when service-worker registration fails', async () => {
    mocks.loadReleaseManifest.mockResolvedValue(releaseManifestFixture);
    mocks.loadSupportMatrix.mockResolvedValue(supportMatrixFixture);
    mocks.detectBrowserEnvironment.mockReturnValue({
      family: 'chrome',
      majorVersion: 126,
      isDesktop: true,
      secureContext: true,
      userAgent: 'Mozilla/5.0 Chrome/126.0.0.0',
    });
    mocks.evaluateShellEnvironment.mockReturnValue({
      lifecycle: 'ready',
      browserStatus: 'supported',
      workspaceStatus: 'unchecked',
      secureContext: true,
      supportMatrixVersion: supportMatrixFixture.version,
      releaseNotes: releaseManifestFixture.releaseNotes,
      updatePromptMode: 'soft-refresh',
      cacheScope: '/',
      offlineReadyTimeoutMs: 5000,
      reasons: [],
      shouldRouteToUnsupported: false,
    });
    mocks.disableServiceWorker.mockReset();
    mocks.registerServiceWorker.mockRejectedValue(new Error('registration failed'));

    await expect(
      bootstrapShell({
        browser: {
          family: 'chrome',
          majorVersion: 126,
          isDesktop: true,
          secureContext: true,
          userAgent: 'Mozilla/5.0 Chrome/126.0.0.0',
        },
      }),
    ).resolves.toMatchObject({
      environment: {
        lifecycle: 'ready',
        browserStatus: 'supported',
        shouldRouteToUnsupported: false,
      },
      serviceWorker: {
        cacheStatus: 'not-available',
        offlineReady: false,
        offlineReadyElapsedMs: null,
        updateAvailable: false,
        scope: null,
      },
    });
  });
});
