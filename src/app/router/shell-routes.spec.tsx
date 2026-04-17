import { describe, expect, it } from 'vitest';

import type { ShellEnvironmentDecision } from '../../services/release';
import { releaseManifestFixture } from '../../test/fixtures/api/release-manifest.fixture';
import { supportMatrixFixture } from '../../test/fixtures/api/support-matrix.fixture';
import { createShellStatusStore } from '../../stores/shell-status';
import {
  createShellRouteObjects,
  resolveOfflineReadyMetric,
  resolveShellRouteAccess,
  resolveShellRouteRedirect,
  resolveShellStatusMessage,
  resolveShellSupportMetric,
} from './shell-routes';

describe('shell routes', () => {
  it('redirects unsupported environments to the unsupported route', () => {
    expect(resolveShellRouteRedirect(true, '/workspace/demo-workspace')).toBe(true);
    expect(resolveShellRouteRedirect(true, '/unsupported')).toBe(false);
    expect(resolveShellRouteRedirect(false, '/workspace/demo-workspace')).toBe(false);
  });

  it('holds protected routes until compatibility is known', () => {
    expect(resolveShellRouteAccess('loading', null, '/workspace')).toBe('pending');
    expect(resolveShellRouteAccess('loading', null, '/workspace/demo-workspace')).toBe('pending');
    expect(resolveShellRouteAccess('loading', null, '/review/demo-workspace')).toBe('pending');
    expect(resolveShellRouteAccess('loading', null, '/')).toBe('allow');
  });

  it('surfaces shell errors for protected routes instead of leaving them pending forever', () => {
    expect(resolveShellRouteAccess('error', null, '/workspace/demo-workspace')).toBe('error');
    expect(resolveShellRouteAccess('error', null, '/review/demo-workspace')).toBe('error');
    expect(resolveShellRouteAccess('error', null, '/')).toBe('allow');
  });

  it('keeps unsupported route reachable while redirecting other routes after a blocked decision', () => {
    const blockedEnvironment: ShellEnvironmentDecision = {
      lifecycle: 'blocked',
      browserStatus: 'unsupported',
      workspaceStatus: 'unchecked',
      secureContext: true,
      supportMatrixVersion: supportMatrixFixture.version,
      releaseNotes: releaseManifestFixture.releaseNotes,
      updatePromptMode: 'soft-refresh',
      cacheScope: '/',
      offlineReadyTimeoutMs: 5000,
      reasons: ['Blocked'],
      shouldRouteToUnsupported: true,
    };

    expect(resolveShellRouteAccess('blocked', blockedEnvironment, '/workspace/demo-workspace')).toBe('redirect');
    expect(resolveShellRouteAccess('blocked', blockedEnvironment, '/unsupported')).toBe('allow');
  });

  it('reports combined shell blocking states in the support metric', () => {
    expect(
      resolveShellSupportMetric('blocked', {
        lifecycle: 'blocked',
        browserStatus: 'supported',
        workspaceStatus: 'unsupported',
        secureContext: true,
        supportMatrixVersion: supportMatrixFixture.version,
        releaseNotes: releaseManifestFixture.releaseNotes,
        updatePromptMode: 'soft-refresh',
        cacheScope: '/',
        offlineReadyTimeoutMs: 5000,
        reasons: ['Workspace format is unreadable.'],
        shouldRouteToUnsupported: true,
      }),
    ).toBe('workspace-blocked');

    expect(
      resolveShellSupportMetric('blocked', {
        lifecycle: 'blocked',
        browserStatus: 'supported',
        workspaceStatus: 'supported',
        secureContext: false,
        supportMatrixVersion: supportMatrixFixture.version,
        releaseNotes: releaseManifestFixture.releaseNotes,
        updatePromptMode: 'soft-refresh',
        cacheScope: '/',
        offlineReadyTimeoutMs: 5000,
        reasons: ['The hosted shell requires a secure context.'],
        shouldRouteToUnsupported: true,
      }),
    ).toBe('secure-context-required');
  });

  it('surfaces bootstrap errors in the shell status message instead of claiming there are no blockers', () => {
    expect(resolveShellStatusMessage('error', null)).toBe('The shell could not load release metadata and support facts.');
    expect(resolveShellSupportMetric('error', null)).toBe('error');
  });

  it('reports offline readiness as unavailable when service workers cannot run', () => {
    expect(
      resolveOfflineReadyMetric({
        cacheStatus: 'not-available',
        offlineReady: false,
        offlineReadyElapsedMs: null,
        updateAvailable: false,
        scope: null,
      }),
    ).toBe('not-available');

    expect(
      resolveOfflineReadyMetric({
        cacheStatus: 'installing',
        offlineReady: false,
        offlineReadyElapsedMs: null,
        updateAvailable: false,
        scope: '/',
      }),
    ).toBe('waiting');
  });

  it('creates the workspace and review route paths', () => {
    expect(createShellRouteObjects(createShellStatusStore())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/',
        }),
      ]),
    );
  });

  it('stores shell readiness state for a supported boot result', () => {
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
        offlineReadyElapsedMs: 50,
        updateAvailable: false,
        scope: '/',
      },
    });

    expect(store.getState().selectors.lifecycle()).toBe('ready');
    expect(store.getState().selectors.serviceWorker()).toMatchObject({
      cacheStatus: 'cached',
      offlineReady: true,
      updateAvailable: false,
    });
  });
});
