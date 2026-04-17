import { describe, expect, it } from 'vitest';

import { releaseManifestFixture } from '../../test/fixtures/api/release-manifest.fixture';
import { supportMatrixFixture } from '../../test/fixtures/api/support-matrix.fixture';
import { createShellStatusStore } from './store';

describe('createShellStatusStore', () => {
  it('re-opens the update prompt when a later service-worker update is detected', () => {
    const store = createShellStatusStore();

    store.getState().commands.applyBootstrapResult({
      releaseManifest: releaseManifestFixture,
      supportMatrix: supportMatrixFixture,
      environment: {
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
      },
      serviceWorker: {
        cacheStatus: 'cached',
        offlineReady: true,
        offlineReadyElapsedMs: 25,
        updateAvailable: false,
        scope: '/',
      },
    });

    store.getState().commands.dismissUpdatePrompt();
    store.getState().commands.markUpdateAvailable({
      releaseNotes: {
        title: 'Hotfix release',
        url: '/release-notes/0.1.1',
      },
      updatePromptMode: 'hard-refresh',
    });

    expect(store.getState().selectors.updatePromptVisible()).toBe(true);
    expect(store.getState().selectors.releaseNotes()).toEqual({
      title: 'Hotfix release',
      url: '/release-notes/0.1.1',
    });
    expect(store.getState().selectors.updatePromptMode()).toBe('hard-refresh');
    expect(store.getState().selectors.serviceWorker()).toMatchObject({
      updateAvailable: true,
      cacheStatus: 'cached',
      offlineReady: true,
    });
  });
});
