import { describe, expect, it } from 'vitest';

import { resolveWorkspaceCompatibilityFromLocation } from './resolve-workspace-compatibility';

describe('resolveWorkspaceCompatibilityFromLocation', () => {
  it('extracts workspace compatibility inputs for the workspace entry route from the query string', async () => {
    await expect(
      resolveWorkspaceCompatibilityFromLocation({
        pathname: '/workspace',
        search: '?workspaceFormatVersion=2.0.0&zoomLevel=125%25',
      }),
    ).resolves.toEqual({
      workspaceFormatVersion: '2.0.0',
      zoomLevel: '125%',
    });
  });

  it('ignores compatibility query hints for canonical reopen routes and trusts the persisted workspace snapshot', async () => {
    await expect(
      resolveWorkspaceCompatibilityFromLocation(
        {
          pathname: '/workspace/ws_2026_04_17_001',
          search: '?workspaceFormatVersion=9.9.9&zoomLevel=110%25',
        },
        {
          loadWorkspaceRecord: async (workspaceId) => ({
            workspaceId,
            savedAt: '2026-04-17T00:00:00Z',
            snapshot: {
              workspaceFormatVersion: '2.0.0',
            },
            ledger: [],
          }),
        },
      ),
    ).resolves.toEqual({
      workspaceFormatVersion: '2.0.0',
      zoomLevel: '110%',
    });
  });

  it('loads workspace compatibility from persisted route records when the URL has no query hint', async () => {
    await expect(
      resolveWorkspaceCompatibilityFromLocation(
        {
          pathname: '/review/ws_2026_04_15_001',
          search: '',
        },
        {
          loadWorkspaceRecord: async (workspaceId) => ({
            workspaceId,
            savedAt: '2026-04-17T00:00:00Z',
            snapshot: {
              workspaceFormatVersion: '2.0.0',
            },
            ledger: [],
          }),
        },
      ),
    ).resolves.toEqual({
      workspaceFormatVersion: '2.0.0',
    });
  });

  it('ignores compatibility query parameters for non-workspace routes', async () => {
    await expect(
      resolveWorkspaceCompatibilityFromLocation({
        pathname: '/',
        search: '?workspaceFormatVersion=2.0.0',
      }),
    ).resolves.toBeNull();
  });

  it('fails closed when no persisted workspace record can be resolved for the protected route', async () => {
    await expect(
      resolveWorkspaceCompatibilityFromLocation(
        {
          pathname: '/workspace/ws_missing',
          search: '',
        },
        {
          loadWorkspaceRecord: async () => null,
        },
      ),
    ).resolves.toEqual({
      unresolvedReason:
        'The shell could not load a saved compatibility snapshot for workspace ws_missing before reopening it.',
    });
  });

  it('fails closed when the persisted workspace snapshot cannot be parsed', async () => {
    await expect(
      resolveWorkspaceCompatibilityFromLocation(
        {
          pathname: '/review/ws_invalid',
          search: '',
        },
        {
          loadWorkspaceRecord: async (workspaceId) => ({
            workspaceId,
            savedAt: '2026-04-17T00:00:00Z',
            snapshot: {},
            ledger: [],
          }),
        },
      ),
    ).resolves.toEqual({
      unresolvedReason:
        'The shell could not read the saved compatibility snapshot for workspace ws_invalid before reopening it.',
    });
  });
});
