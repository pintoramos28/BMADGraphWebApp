import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, createBrowserRouter, useLocation, useParams } from 'react-router';
import type { StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';

import { routePath, ROUTES } from './routes';
import { WorkspaceImportRoute } from '../../features/import';
import { WorkspaceSemanticsPanel } from '../../features/semantics';
import {
  parsePersistedDatasetFileHandles,
  retainDatasetFileHandlesForSnapshot,
  sanitizePersistedDatasetFileHandlesForHydration,
} from '../../features/workspace-persistence/persisted-dataset-file-handles';
import { reopenPersistedWorkspaceRecord, type WorkspaceCompatibilityEnvelope } from '../../features/workspace-persistence/reopen-workspace';
import {
  getPersistedWorkspaceKernelVersion,
  markWorkspaceKernelStorePersisted,
} from '../../features/workspace-persistence/workspace-kernel-persistence-state';
import { IndexedDbWorkspaceStorage, createWorkspaceRepository, type PersistedDatasetFileHandle, type PersistedWorkspaceRecord } from '../../services/persistence';
import { createImportWorkspaceSnapshot, createWorkspaceKernelStore, type WorkspaceKernelStore } from '../../stores/workspace-kernel';
import { synchronizeDatasetSourceFileMetadata } from '../../stores/workspace-kernel/dataset-file-handle-metadata';
import type { ShellStatusStoreState } from '../../stores/shell-status';

function useShellStore<T>(store: StoreApi<ShellStatusStoreState>, selector: (state: ShellStatusStoreState) => T) {
  return useStore(store, selector);
}

export function resolveShellStatusMessage(
  lifecycle: ShellStatusStoreState['lifecycle'],
  environment: ShellStatusStoreState['environment'],
) {
  if (lifecycle === 'error') {
    return 'The shell could not load release metadata and support facts.';
  }

  if (!environment) {
    return lifecycle === 'loading'
      ? 'Checking environment support, cache readiness, and update state.'
      : 'No blocking environment issues detected.';
  }

  if (environment.reasons[0]) {
    return environment.reasons[0];
  }

  if (environment.shouldRouteToUnsupported) {
    return 'The shell blocked this environment before analytical work could begin.';
  }

  return 'No blocking environment issues detected.';
}

export function resolveShellSupportMetric(
  lifecycle: ShellStatusStoreState['lifecycle'],
  environment: ShellStatusStoreState['environment'],
) {
  if (lifecycle === 'error') {
    return 'error';
  }

  if (!environment) {
    return lifecycle === 'loading' ? 'checking' : 'unknown';
  }

  if (!environment.secureContext) {
    return 'secure-context-required';
  }

  if (environment.workspaceStatus === 'unsupported') {
    return 'workspace-blocked';
  }

  if (environment.browserStatus === 'unsupported') {
    return 'browser-blocked';
  }

  if (environment.browserStatus === 'unknown') {
    return 'browser-unknown';
  }

  if (environment.lifecycle === 'degraded' || environment.browserStatus === 'secondary') {
    return 'secondary';
  }

  return 'supported';
}

export function resolveOfflineReadyMetric(serviceWorker: ShellStatusStoreState['serviceWorker']) {
  if (serviceWorker.cacheStatus === 'not-available') {
    return 'not-available';
  }

  return serviceWorker.offlineReady ? 'ready' : 'waiting';
}

function ShellFrame({ store }: { store: StoreApi<ShellStatusStoreState> }) {
  const lifecycle = useShellStore(store, (state) => state.selectors.lifecycle());
  const releaseManifest = useShellStore(store, (state) => state.selectors.releaseManifest());
  const releaseNotes = useShellStore(store, (state) => state.selectors.releaseNotes());
  const supportMatrix = useShellStore(store, (state) => state.selectors.supportMatrix());
  const environment = useShellStore(store, (state) => state.selectors.environment());
  const serviceWorker = useShellStore(store, (state) => state.selectors.serviceWorker());
  const updatePromptVisible = useShellStore(store, (state) => state.selectors.updatePromptVisible());
  const updatePromptMode = useShellStore(store, (state) => state.selectors.updatePromptMode());

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 'clamp(1.25rem, 2vw, 2rem)',
        background:
          'radial-gradient(circle at top left, rgba(227, 177, 104, 0.18), transparent 32%), linear-gradient(180deg, #f4efe7 0%, #dee7eb 100%)',
        color: '#1f2a36',
        fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
      }}
    >
      <section
        style={{
          margin: '0 auto',
          maxWidth: '72rem',
          padding: 'clamp(1.25rem, 2vw, 2rem)',
          borderRadius: '1.5rem',
          background: 'rgba(255, 255, 255, 0.86)',
          border: '1px solid rgba(31, 42, 54, 0.12)',
          boxShadow: '0 24px 80px rgba(31, 42, 54, 0.12)',
        }}
      >
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: '1rem',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#6f5b45',
              }}
            >
              Hosted Shell Readiness
            </p>
            <h1 style={{ margin: '0.6rem 0 0', fontSize: 'clamp(2rem, 4.5vw, 3.5rem)', lineHeight: 0.95 }}>
              BMADGraphWebApp
            </h1>
          </div>

          <div
            style={{
              display: 'grid',
              gap: '0.5rem',
              minWidth: '18rem',
              padding: '1rem 1.1rem',
              borderRadius: '1rem',
              background: '#f7f4ef',
              border: '1px solid rgba(31, 42, 54, 0.1)',
            }}
          >
            <strong style={{ fontSize: '0.95rem' }}>Shell Status</strong>
            <span>{lifecycle}</span>
            <span>{resolveShellStatusMessage(lifecycle, environment)}</span>
          </div>
        </header>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
            gap: '0.75rem',
            marginTop: '1.5rem',
          }}
        >
          <ShellMetric label="Support" value={resolveShellSupportMetric(lifecycle, environment)} />
          <ShellMetric label="Cache" value={serviceWorker.cacheStatus} />
          <ShellMetric label="Offline ready" value={resolveOfflineReadyMetric(serviceWorker)} />
          <ShellMetric label="Update" value={updatePromptVisible ? (updatePromptMode ?? 'prompted') : 'idle'} />
        </section>

        {releaseManifest ? (
          <section
            style={{
              marginTop: '1.5rem',
              display: 'grid',
              gap: '1rem',
            }}
          >
            <ShellNotice
              title={updatePromptVisible ? `Update available (${updatePromptMode ?? 'pending'})` : `Release ${releaseManifest.appBuildVersion}`}
              body={`Release notes: ${releaseNotes?.title ?? releaseManifest.releaseNotes.title}`}
              detail={releaseNotes?.url ?? releaseManifest.releaseNotes.url}
            />
            <ShellNotice
              title={`Support matrix ${supportMatrix?.version ?? 'unknown'}`}
              body={`Standard zoom: ${supportMatrix?.standardZoom ?? 'n/a'}`}
              detail={releaseManifest.supportMatrixUrl}
            />
          </section>
        ) : null}

        <nav
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginTop: '1.5rem',
          }}
        >
          <Link to={ROUTES.home}>Home</Link>
          <Link to={routePath.workspace('workspace_demo')}>Workspace</Link>
          <Link to={routePath.review('workspace_demo')}>Review</Link>
          <Link to={ROUTES.unsupported}>Unsupported</Link>
        </nav>

        <div style={{ marginTop: '1.5rem' }}>
          <Outlet />
        </div>
      </section>
    </main>
  );
}

function ShellMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '1rem',
        borderRadius: '1rem',
        background: '#f7f4ef',
        border: '1px solid rgba(31, 42, 54, 0.1)',
      }}
    >
      <div style={{ textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.14em', color: '#6f5b45' }}>
        {label}
      </div>
      <div style={{ marginTop: '0.35rem', fontSize: '1rem', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function ShellNotice({ title, body, detail }: { title: string; body: string; detail: string }) {
  return (
    <article
      style={{
        padding: '1rem 1.1rem',
        borderRadius: '1rem',
        background: 'rgba(216, 225, 232, 0.45)',
        border: '1px solid rgba(31, 42, 54, 0.08)',
      }}
    >
      <h2 style={{ margin: 0, fontSize: '1rem' }}>{title}</h2>
      <p style={{ margin: '0.4rem 0 0', lineHeight: 1.5 }}>{body}</p>
      <small style={{ display: 'block', marginTop: '0.4rem', opacity: 0.8 }}>{detail}</small>
    </article>
  );
}

function ShellHomeRoute({ store }: { store: StoreApi<ShellStatusStoreState> }) {
  const environment = useShellStore(store, (state) => state.selectors.environment());

  return (
    <section>
      <h2 style={{ marginTop: 0 }}>Shell readiness</h2>
      <p style={{ lineHeight: 1.6 }}>
        The shell now loads release metadata, evaluates the browser and workspace support envelope, and surfaces shell
        status before analytical work begins.
      </p>
      <p style={{ lineHeight: 1.6 }}>
        Current support state: <strong>{environment?.lifecycle ?? 'loading'}</strong>
      </p>
    </section>
  );
}

export const IMPORT_PREVIEW_WORKSPACE_ID = 'workspace_import_preview';

interface CachedWorkspaceKernelStore {
  hydratedFromPersistence: boolean;
  hydrationAbortController: AbortController | null;
  hydrationConsumerCount: number;
  hydrationPromise: Promise<void> | null;
  lastAccessedAt: number;
  store: WorkspaceKernelStore;
}

const workspaceKernelStores = new Map<string, CachedWorkspaceKernelStore>();
export const MAX_CACHED_WORKSPACE_KERNEL_STORES = 8;
export const WORKSPACE_HYDRATION_RECORD_LOAD_TIMEOUT_MS = 5_000;

export function resetWorkspaceKernelStoresForTest() {
  workspaceKernelStores.clear();
}

function createBootstrapKernelStore(workspaceId: string) {
  const store = createWorkspaceKernelStore({
    snapshot: createImportWorkspaceSnapshot(workspaceId),
    ledger: [],
  });

  markWorkspaceKernelStorePersisted(store);

  return store;
}

async function loadWorkspaceRecordFromPersistence(
  workspaceId: string,
  options: { signal?: AbortSignal | undefined } = {},
) {
  if (typeof indexedDB === 'undefined') {
    return null;
  }

  const repository = createWorkspaceRepository(new IndexedDbWorkspaceStorage());
  return repository.loadWorkspaceRecord(workspaceId, {
    abortSignal: options.signal,
  });
}

async function parsePersistedWorkspaceForHydration(
  record: PersistedWorkspaceRecord,
  workspaceId: string,
  options: { signal?: AbortSignal | undefined } = {},
) {
  if (record.workspaceId !== workspaceId) {
    throw new Error(`Persisted workspace "${record.workspaceId}" does not match requested workspace "${workspaceId}".`);
  }

  const persistedSnapshotWorkspaceId = record.snapshot && typeof record.snapshot === 'object'
    ? (record.snapshot as { workspaceId?: unknown }).workspaceId
    : undefined;

  if (persistedSnapshotWorkspaceId !== workspaceId) {
    throw new Error(`Persisted snapshot "${String(persistedSnapshotWorkspaceId)}" does not match requested workspace "${workspaceId}".`);
  }

  const bootstrapSnapshot = createImportWorkspaceSnapshot(workspaceId);
  const compatibilityEnvelope = {
    currentAppBuildVersion: bootstrapSnapshot.appBuildVersion,
    minimumReadableWorkspaceFormat: bootstrapSnapshot.workspaceFormatVersion,
    maximumReadableWorkspaceFormat: `${bootstrapSnapshot.workspaceFormatVersion.split('.')[0] ?? '1'}.x`,
    migrationPolicy: 'migrate-on-open',
  } satisfies WorkspaceCompatibilityEnvelope;

  const initialReport = reopenPersistedWorkspaceRecord(record, {
    compatibilityEnvelope,
  });
  const parsedDatasetFileHandles = parsePersistedDatasetFileHandles(record.datasetFileHandles ?? []);

  const retainedDatasetFileHandlesForAcceptedSnapshot = retainDatasetFileHandlesForSnapshot(
    initialReport.snapshot,
    parsedDatasetFileHandles,
  );

  const sanitizedDatasetFileHandles = await sanitizePersistedDatasetFileHandlesForHydration(
    retainedDatasetFileHandlesForAcceptedSnapshot,
    options,
  );
  const report = reopenPersistedWorkspaceRecord({
    ...record,
    datasetFileHandles: sanitizedDatasetFileHandles,
  }, {
    compatibilityEnvelope,
  });
  let snapshot = report.snapshot;

  if (snapshot.workspaceId !== workspaceId) {
    throw new Error(`Persisted snapshot "${snapshot.workspaceId}" does not match requested workspace "${workspaceId}".`);
  }

  const datasetFileHandles = retainDatasetFileHandlesForSnapshot(
    snapshot,
    sanitizedDatasetFileHandles,
  );
  snapshot = synchronizeDatasetSourceFileMetadata(snapshot, datasetFileHandles);

  return {
    snapshot,
    ledger: report.ledger,
    ...(datasetFileHandles.length > 0 ? { datasetFileHandles } : {}),
  } satisfies {
    snapshot: typeof report.snapshot;
    ledger: typeof report.ledger;
    datasetFileHandles?: PersistedDatasetFileHandle[];
  };
}

function replaceStoreWithPersistedWorkspace(
  store: WorkspaceKernelStore,
  record: Awaited<ReturnType<typeof parsePersistedWorkspaceForHydration>>,
) {
  store.getState().commands.replaceSnapshot({
    snapshot: record.snapshot,
    ledger: record.ledger,
    ...(record.datasetFileHandles ? { datasetFileHandles: record.datasetFileHandles } : {}),
  });
}

function touchCachedWorkspaceKernelStore(cachedStore: CachedWorkspaceKernelStore) {
  cachedStore.lastAccessedAt = Date.now();
}

function evictLeastRecentlyUsedWorkspaceKernelStores() {
  if (workspaceKernelStores.size <= MAX_CACHED_WORKSPACE_KERNEL_STORES) {
    return;
  }

  const entriesByAccessTime = Array.from(workspaceKernelStores.entries())
    .filter(
      ([, cachedStore]) =>
        cachedStore.store.getState().workspaceVersion === getPersistedWorkspaceKernelVersion(cachedStore.store),
    )
    .sort(
    ([, left], [, right]) => left.lastAccessedAt - right.lastAccessedAt,
    );

  while (workspaceKernelStores.size > MAX_CACHED_WORKSPACE_KERNEL_STORES) {
    const oldestEntry = entriesByAccessTime.shift();

    if (!oldestEntry) {
      return;
    }

    workspaceKernelStores.delete(oldestEntry[0]);
  }
}

function getOrCreateCachedWorkspaceKernelStore(workspaceId: string) {
  const cachedStore = workspaceKernelStores.get(workspaceId);

  if (cachedStore) {
    touchCachedWorkspaceKernelStore(cachedStore);
    return cachedStore;
  }

  const store = createBootstrapKernelStore(workspaceId);
  const createdStore = {
    hydratedFromPersistence: false,
    hydrationAbortController: null,
    hydrationConsumerCount: 0,
    hydrationPromise: null,
    lastAccessedAt: Date.now(),
    store,
  } satisfies CachedWorkspaceKernelStore;

  workspaceKernelStores.set(workspaceId, createdStore);
  evictLeastRecentlyUsedWorkspaceKernelStores();

  return createdStore;
}

function getAbortReason(signal: AbortSignal) {
  return signal.reason instanceof Error ? signal.reason : new Error('Workspace hydration was canceled.');
}

function assertHydrationSignalActive(signal: AbortSignal) {
  if (signal.aborted) {
    throw getAbortReason(signal);
  }
}

function createHydrationRecordLoadTimeoutError(workspaceId: string) {
  return new Error(`Workspace persistence did not respond while loading "${workspaceId}". Try reopening the workspace again.`);
}

function createChildHydrationSignal(
  parentSignal: AbortSignal,
  timeoutMs: number,
  timeoutError: Error,
) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const abortFromParent = () => {
    controller.abort(getAbortReason(parentSignal));
  };

  if (parentSignal.aborted) {
    abortFromParent();
  } else {
    parentSignal.addEventListener('abort', abortFromParent, { once: true });
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        controller.abort(timeoutError);
      }, timeoutMs);
    }
  }

  return {
    signal: controller.signal,
    cleanup() {
      parentSignal.removeEventListener('abort', abortFromParent);
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    },
  };
}

async function awaitHydrationRecordLoad<T>(
  operation: Promise<T>,
  signal: AbortSignal,
) {
  assertHydrationSignalActive(signal);

  let cleanup = () => {};
  const cancellation = new Promise<never>((_, reject) => {
    const rejectIfAborted = () => reject(getAbortReason(signal));

    signal.addEventListener('abort', rejectIfAborted, { once: true });
    cleanup = () => signal.removeEventListener('abort', rejectIfAborted);
  });

  try {
    return await Promise.race([operation, cancellation]);
  } finally {
    cleanup();
  }
}

async function loadWorkspaceRecordForHydration(
  loadWorkspaceRecord: (
    workspaceId: string,
    options?: { signal?: AbortSignal | undefined },
  ) => Promise<PersistedWorkspaceRecord | null>,
  workspaceId: string,
  sharedHydrationSignal: AbortSignal,
) {
  const childSignal = createChildHydrationSignal(
    sharedHydrationSignal,
    WORKSPACE_HYDRATION_RECORD_LOAD_TIMEOUT_MS,
    createHydrationRecordLoadTimeoutError(workspaceId),
  );

  try {
    assertHydrationSignalActive(childSignal.signal);

    return await awaitHydrationRecordLoad(
      loadWorkspaceRecord(workspaceId, { signal: childSignal.signal }),
      childSignal.signal,
    );
  } finally {
    childSignal.cleanup();
  }
}

function clearAbortedSharedHydrationAttempt(cachedStore: CachedWorkspaceKernelStore) {
  if (
    cachedStore.hydrationPromise
    && cachedStore.hydrationAbortController?.signal.aborted
    && !cachedStore.hydratedFromPersistence
  ) {
    cachedStore.hydrationPromise.catch(() => {
      // The aborted attempt is intentionally abandoned so a remount can start
      // a fresh shared hydration attempt instead of inheriting the prior route's
      // cancellation.
    });
    cachedStore.hydrationPromise = null;
    cachedStore.hydrationAbortController = null;
    cachedStore.hydrationConsumerCount = 0;
  }
}

function registerHydrationConsumer(
  cachedStore: CachedWorkspaceKernelStore,
  signal: AbortSignal | undefined,
) {
  let released = false;
  let rejectAbortPromise: ((reason: Error) => void) | null = null;
  const abortPromise = signal
    ? new Promise<never>((_, reject) => {
        rejectAbortPromise = reject;
      })
    : null;
  const release = (abortReason?: Error | undefined) => {
    if (released) {
      return;
    }

    released = true;
    cachedStore.hydrationConsumerCount = Math.max(0, cachedStore.hydrationConsumerCount - 1);

    if (signal) {
      signal.removeEventListener('abort', onAbort);
    }

    if (
      abortReason
      && cachedStore.hydrationConsumerCount === 0
      && cachedStore.hydrationAbortController
      && !cachedStore.hydrationAbortController.signal.aborted
      && !cachedStore.hydratedFromPersistence
    ) {
      cachedStore.hydrationAbortController.abort(abortReason);
    }
  };
  const onAbort = () => {
    const reason = signal ? getAbortReason(signal) : new Error('Workspace hydration was canceled.');
    release(reason);
    rejectAbortPromise?.(reason);
  };

  if (signal?.aborted) {
    const reason = getAbortReason(signal);

    if (
      cachedStore.hydrationConsumerCount === 0
      && cachedStore.hydrationAbortController
      && !cachedStore.hydrationAbortController.signal.aborted
      && !cachedStore.hydratedFromPersistence
    ) {
      cachedStore.hydrationAbortController.abort(reason);
    }

    return {
      abortPromise: Promise.reject(reason) as Promise<never>,
      release: () => {},
    };
  }

  cachedStore.hydrationConsumerCount += 1;
  signal?.addEventListener('abort', onAbort, { once: true });

  return {
    abortPromise,
    release,
  };
}

async function hydrateWorkspaceKernelStore(
  cachedStore: CachedWorkspaceKernelStore,
  workspaceId: string,
  loadWorkspaceRecord: (
    workspaceId: string,
    options?: { signal?: AbortSignal | undefined },
  ) => Promise<PersistedWorkspaceRecord | null>,
  options: { signal?: AbortSignal | undefined } = {},
) {
  if (cachedStore.hydratedFromPersistence) {
    return cachedStore.store;
  }

  clearAbortedSharedHydrationAttempt(cachedStore);

  if (!cachedStore.hydrationPromise) {
    cachedStore.hydrationAbortController = new AbortController();
    const sharedHydrationSignal = cachedStore.hydrationAbortController.signal;

    const hydrationPromise = (async () => {
      let record: PersistedWorkspaceRecord | null;

      try {
        record = await loadWorkspaceRecordForHydration(loadWorkspaceRecord, workspaceId, sharedHydrationSignal);
        assertHydrationSignalActive(sharedHydrationSignal);
      } catch (error) {
        console.error(`Workspace hydration failed for "${workspaceId}".`, error);
        throw error;
      }

      if (!record) {
        assertHydrationSignalActive(sharedHydrationSignal);
        cachedStore.hydratedFromPersistence = true;
        markWorkspaceKernelStorePersisted(cachedStore.store);
        return;
      }

      try {
        replaceStoreWithPersistedWorkspace(
          cachedStore.store,
          await parsePersistedWorkspaceForHydration(record, workspaceId, {
            signal: sharedHydrationSignal,
          }),
        );
      } catch (error) {
        console.error(`Workspace hydration failed for "${workspaceId}".`, error);
        throw error;
      }

      assertHydrationSignalActive(sharedHydrationSignal);
      cachedStore.hydratedFromPersistence = true;
      markWorkspaceKernelStorePersisted(cachedStore.store);
    })().finally(() => {
      if (cachedStore.hydrationPromise === hydrationPromise) {
        cachedStore.hydrationPromise = null;
        cachedStore.hydrationAbortController = null;
      }
    });

    cachedStore.hydrationPromise = hydrationPromise;
  }

  const consumer = registerHydrationConsumer(cachedStore, options.signal);

  try {
    if (consumer.abortPromise) {
      await Promise.race([cachedStore.hydrationPromise, consumer.abortPromise]);
    } else {
      await cachedStore.hydrationPromise;
    }
  } finally {
    consumer.release();
  }

  return cachedStore.store;
}

export async function resolveWorkspaceKernelStore(
  workspaceId?: string | undefined,
  options?: {
    loadWorkspaceRecord?: ((
      workspaceId: string,
      options?: { signal?: AbortSignal | undefined },
    ) => Promise<PersistedWorkspaceRecord | null>) | undefined;
    signal?: AbortSignal | undefined;
  },
) {
  const resolvedWorkspaceId = workspaceId ?? IMPORT_PREVIEW_WORKSPACE_ID;
  const cachedStore = getOrCreateCachedWorkspaceKernelStore(resolvedWorkspaceId);
  const loadWorkspaceRecord = options?.loadWorkspaceRecord ?? loadWorkspaceRecordFromPersistence;
  return hydrateWorkspaceKernelStore(cachedStore, resolvedWorkspaceId, loadWorkspaceRecord, {
    ...(options?.signal ? { signal: options.signal } : {}),
  });
}

function ShellWorkspaceRoute({ workspaceId }: { workspaceId?: string | undefined }) {
  const resolvedWorkspaceId = workspaceId ?? IMPORT_PREVIEW_WORKSPACE_ID;
  const [kernelStore, setKernelStore] = useState<WorkspaceKernelStore | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hydrationAbortController = new AbortController();

    setKernelStore(null);
    setLoadError(null);

    void resolveWorkspaceKernelStore(resolvedWorkspaceId, {
      signal: hydrationAbortController.signal,
    })
      .then((resolvedStore) => {
        if (cancelled) {
          return;
        }

        setKernelStore(resolvedStore);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : 'The workspace state could not be restored from local persistence.');
      });

    return () => {
      cancelled = true;
      hydrationAbortController.abort(new Error('Workspace route unmounted.'));
    };
  }, [resolvedWorkspaceId]);

  if (loadError) {
    return (
      <section>
        <h2 style={{ marginTop: 0 }}>Workspace state could not load</h2>
        <p style={{ lineHeight: 1.6 }}>
          The import route could not hydrate the canonical workspace state for {resolvedWorkspaceId}.
        </p>
        <p style={{ lineHeight: 1.6 }}>{loadError}</p>
      </section>
    );
  }

  if (!kernelStore) {
    return (
      <section>
        <h2 style={{ marginTop: 0 }}>Loading workspace state</h2>
        <p style={{ lineHeight: 1.6 }}>
          Restoring the canonical workspace snapshot for {resolvedWorkspaceId} before import and confirmation actions open.
        </p>
      </section>
    );
  }

  return (
    <>
      <WorkspaceImportRoute key={resolvedWorkspaceId} workspaceId={resolvedWorkspaceId} kernelStore={kernelStore} />
      <WorkspaceSemanticsPanel workspaceId={resolvedWorkspaceId} kernelStore={kernelStore} />
    </>
  );
}

function ShellReviewRoute({ workspaceId }: { workspaceId: string | undefined }) {
  return (
    <section>
      <h2 style={{ marginTop: 0 }}>Review shell route</h2>
      <p style={{ lineHeight: 1.6 }}>Review shell placeholder for {workspaceId ?? 'unknown workspace'}.</p>
    </section>
  );
}

function UnsupportedRoute({ store }: { store: StoreApi<ShellStatusStoreState> }) {
  const environment = useShellStore(store, (state) => state.selectors.environment());
  const supportMatrix = useShellStore(store, (state) => state.selectors.supportMatrix());

  return (
    <section>
      <h2 style={{ marginTop: 0 }}>Unsupported environment</h2>
      <p style={{ lineHeight: 1.6 }}>
        This shell is blocked before import or reopen work can begin. Please switch to a supported desktop browser or
        use a workspace configuration that matches the published compatibility envelope.
      </p>
      <p style={{ lineHeight: 1.6 }}>
        {environment?.reasons.length ? environment.reasons[0] : 'The shell could not validate the current environment.'}
      </p>
      <p style={{ lineHeight: 1.6 }}>
        Published support matrix: {supportMatrix?.version ?? 'unavailable'}
      </p>
    </section>
  );
}

function ShellRoutePending({ pathname }: { pathname: string }) {
  return (
    <section>
      <h2 style={{ marginTop: 0 }}>Checking shell compatibility</h2>
      <p style={{ lineHeight: 1.6 }}>
        The shell is still evaluating whether {pathname} can open in this browser and workspace configuration.
      </p>
      <p style={{ lineHeight: 1.6 }}>
        Protected routes stay paused until support is confirmed or the shell redirects to the unsupported route.
      </p>
    </section>
  );
}

function ShellRouteError({ pathname }: { pathname: string }) {
  return (
    <section>
      <h2 style={{ marginTop: 0 }}>Shell bootstrap failed</h2>
      <p style={{ lineHeight: 1.6 }}>
        The shell could not finish its compatibility checks for {pathname}. Protected routes stay closed until the
        shell can load release metadata and support facts.
      </p>
      <p style={{ lineHeight: 1.6 }}>
        Use the shell status card above to confirm the error state before retrying.
      </p>
    </section>
  );
}

function isProtectedShellPath(pathname: string) {
  return pathname === ROUTES.workspaceIndex || pathname.startsWith('/workspace/') || pathname.startsWith('/review/');
}

export function resolveShellRouteAccess(
  lifecycle: ShellStatusStoreState['lifecycle'],
  environment: ShellStatusStoreState['environment'],
  pathname: string,
) {
  if (environment?.shouldRouteToUnsupported && pathname !== ROUTES.unsupported) {
    return 'redirect';
  }

  if (isProtectedShellPath(pathname)) {
    if (lifecycle === 'error') {
      return 'error';
    }

    if (!environment) {
      return 'pending';
    }
  }

  return 'allow';
}

function RouteGate({ store }: { store: StoreApi<ShellStatusStoreState> }) {
  const location = useLocation();
  const lifecycle = useShellStore(store, (state) => state.selectors.lifecycle());
  const environment = useShellStore(store, (state) => state.selectors.environment());
  const routeAccess = resolveShellRouteAccess(lifecycle, environment, location.pathname);

  if (routeAccess === 'redirect') {
    return <Navigate replace to={ROUTES.unsupported} />;
  }

  if (routeAccess === 'error') {
    return <ShellRouteError pathname={location.pathname} />;
  }

  if (routeAccess === 'pending') {
    return <ShellRoutePending pathname={location.pathname} />;
  }

  return <Outlet />;
}

export function resolveShellRouteRedirect(shouldRouteToUnsupported: boolean, pathname: string) {
  return shouldRouteToUnsupported && pathname !== ROUTES.unsupported;
}

export function createShellRouter(store: StoreApi<ShellStatusStoreState>) {
  return createBrowserRouter(createShellRouteObjects(store));
}

export function createShellRouteObjects(store: StoreApi<ShellStatusStoreState>) {
  return [
    {
      path: ROUTES.home,
      element: <ShellFrame store={store} />,
      children: [
        {
          element: <RouteGate store={store} />,
          children: [
            {
              index: true,
              element: <ShellHomeRoute store={store} />,
            },
            {
              path: 'workspace',
              element: <ShellWorkspaceRoute workspaceId={undefined} />,
            },
            {
              path: 'workspace/:workspaceId',
              element: <ShellWorkspaceRouteWithParams />,
            },
            {
              path: 'review/:workspaceId',
              element: <ShellReviewRouteWithParams />,
            },
            {
              path: 'unsupported',
              element: <UnsupportedRoute store={store} />,
            },
          ],
        },
      ],
    },
  ];
}

function ShellWorkspaceRouteWithParams() {
  const params = useParams();

  return <ShellWorkspaceRoute workspaceId={params.workspaceId} />;
}

function ShellReviewRouteWithParams() {
  const params = useParams();

  return <ShellReviewRoute workspaceId={params.workspaceId} />;
}
