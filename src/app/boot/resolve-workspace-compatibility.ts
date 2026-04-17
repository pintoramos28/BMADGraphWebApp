import { z } from 'zod';

import type { PersistedWorkspaceRecord } from '../../services/persistence';
import { IndexedDbWorkspaceStorage, createWorkspaceRepository } from '../../services/persistence';
import { semverSchema } from '../../schemas/validation';
import type { WorkspaceCompatibilityInput } from '../../services/release';
import { ROUTES } from '../router/routes';

interface LocationLike {
  pathname: string;
  search: string;
}

interface ResolveWorkspaceCompatibilityOptions {
  loadWorkspaceRecord?(workspaceId: string): Promise<PersistedWorkspaceRecord | null>;
}

type WorkspaceCompatibilityResolution =
  | {
      status: 'resolved';
      input: WorkspaceCompatibilityInput;
    }
  | {
      status: 'unresolved';
      reason: string;
    };

const workspaceCompatibilitySnapshotSchema = z.object({
  workspaceFormatVersion: semverSchema,
});

function isWorkspaceCompatibilityPath(pathname: string) {
  return pathname === ROUTES.workspaceIndex || pathname.startsWith('/workspace/') || pathname.startsWith('/review/');
}

function parseWorkspaceCompatibilitySearch(search: string) {
  const searchParams = new URLSearchParams(search);
  const workspaceFormatVersion = searchParams.get('workspaceFormatVersion')?.trim();
  const zoomLevel = searchParams.get('zoomLevel')?.trim();

  return {
    workspaceFormatVersion,
    zoomLevel,
  };
}

function resolveWorkspaceIdFromPathname(pathname: string) {
  const match = /^\/(?:workspace|review)\/([^/]+)$/.exec(pathname);

  if (!match?.[1]) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

async function loadWorkspaceCompatibilityFromPersistence(
  workspaceId: string,
  options: ResolveWorkspaceCompatibilityOptions,
): Promise<WorkspaceCompatibilityResolution> {
  try {
    const loadWorkspaceRecord =
      options.loadWorkspaceRecord ??
      (async (resolvedWorkspaceId: string) => {
        if (typeof indexedDB === 'undefined') {
          return null;
        }

        const repository = createWorkspaceRepository(new IndexedDbWorkspaceStorage());

        return repository.loadWorkspaceRecord(resolvedWorkspaceId);
      });
    const record = await loadWorkspaceRecord(workspaceId);

    if (!record) {
      return {
        status: 'unresolved',
        reason: `The shell could not load a saved compatibility snapshot for workspace ${workspaceId} before reopening it.`,
      };
    }

    const snapshot = workspaceCompatibilitySnapshotSchema.safeParse(record.snapshot);

    if (!snapshot.success) {
      return {
        status: 'unresolved',
        reason: `The shell could not read the saved compatibility snapshot for workspace ${workspaceId} before reopening it.`,
      };
    }

    return {
      status: 'resolved',
      input: {
        workspaceFormatVersion: snapshot.data.workspaceFormatVersion,
      } satisfies WorkspaceCompatibilityInput,
    };
  } catch {
    return {
      status: 'unresolved',
      reason: `The shell could not load workspace ${workspaceId} before reopening it.`,
    };
  }
}

export async function resolveWorkspaceCompatibilityFromLocation(
  location: LocationLike,
  options: ResolveWorkspaceCompatibilityOptions = {},
): Promise<WorkspaceCompatibilityInput | null> {
  if (!isWorkspaceCompatibilityPath(location.pathname)) {
    return null;
  }

  const { workspaceFormatVersion, zoomLevel } = parseWorkspaceCompatibilitySearch(location.search);
  const workspaceId = resolveWorkspaceIdFromPathname(location.pathname);

  if (workspaceId) {
    const persistedCompatibility = await loadWorkspaceCompatibilityFromPersistence(workspaceId, options);

    if (persistedCompatibility.status === 'unresolved') {
      return {
        unresolvedReason: persistedCompatibility.reason,
        ...(zoomLevel ? { zoomLevel } : {}),
      };
    }

    return {
      ...(persistedCompatibility.input.workspaceFormatVersion
        ? { workspaceFormatVersion: persistedCompatibility.input.workspaceFormatVersion }
        : {}),
      ...(zoomLevel ? { zoomLevel } : {}),
    };
  }

  if (!workspaceFormatVersion) {
    return null;
  }

  return {
    workspaceFormatVersion,
    ...(zoomLevel ? { zoomLevel } : {}),
  };
}
