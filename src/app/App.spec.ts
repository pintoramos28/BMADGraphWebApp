import { describe, expect, it } from 'vitest';

import { mergeBootstrapResultWithPendingUpdate } from './App';
import { releaseManifestFixture } from '../test/fixtures/api/release-manifest.fixture';
import { supportMatrixFixture } from '../test/fixtures/api/support-matrix.fixture';

describe('mergeBootstrapResultWithPendingUpdate', () => {
  it('preserves fresher update metadata that arrives before bootstrap resolves', () => {
    const result = mergeBootstrapResultWithPendingUpdate(
      {
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
          offlineReadyElapsedMs: 40,
          updateAvailable: false,
          scope: '/',
        },
      },
      {
        releaseNotes: {
          title: 'Hotfix release notes',
          url: '/release-notes/0.1.1',
        },
        updatePromptMode: 'hard-refresh',
      },
    );

    expect(result.environment.releaseNotes).toEqual({
      title: 'Hotfix release notes',
      url: '/release-notes/0.1.1',
    });
    expect(result.environment.updatePromptMode).toBe('hard-refresh');
    expect(result.serviceWorker.updateAvailable).toBe(true);
  });
});
