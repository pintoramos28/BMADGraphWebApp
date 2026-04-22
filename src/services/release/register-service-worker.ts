export interface RegisterServiceWorkerInput {
  scriptUrl?: string;
  scope?: string;
  offlineReadyTimeoutMs: number;
  updatePromptMode: 'soft-refresh' | 'hard-refresh';
  releaseNotes: {
    title: string;
    url: string;
  };
  loadUpdateMetadata?(): Promise<{
    releaseNotes: {
      title: string;
      url: string;
    };
    updatePromptMode: 'soft-refresh' | 'hard-refresh';
  }>;
  onOfflineReady?(elapsedMs: number, registration: ServiceWorkerRegistration | null): void;
  onUpdateAvailable?(registration: ServiceWorkerRegistration, releaseNotes: { title: string; url: string }, updatePromptMode: 'soft-refresh' | 'hard-refresh'): void;
  nowMs?: () => number;
  navigator?: Navigator;
  window?: Window;
}

export interface DisableServiceWorkerInput {
  navigator?: Navigator;
  window?: Window;
  cacheStorage?: CacheStorage;
  sessionStorage?: Storage;
  reloadFlagKey?: string;
}

export interface ServiceWorkerStatus {
  cacheStatus: 'not-available' | 'installing' | 'cached';
  offlineReady: boolean;
  offlineReadyElapsedMs: number | null;
  updateAvailable: boolean;
  scope: string | null;
}

function createUnavailableStatus(): ServiceWorkerStatus {
  return {
    cacheStatus: 'not-available',
    offlineReady: false,
    offlineReadyElapsedMs: null,
    updateAvailable: false,
    scope: null,
  };
}

export async function disableServiceWorker(input: DisableServiceWorkerInput = {}): Promise<ServiceWorkerStatus> {
  const navigatorObject = input.navigator ?? globalThis.navigator;
  const windowObject = input.window ?? globalThis.window;

  if (!navigatorObject?.serviceWorker || !windowObject?.isSecureContext) {
    return createUnavailableStatus();
  }

  const reloadFlagKey = input.reloadFlagKey ?? 'bmad:disable-service-worker:reloaded';
  const storage = input.sessionStorage ?? globalThis.sessionStorage;
  const cacheStorage = input.cacheStorage ?? globalThis.caches;
  const hadController = Boolean(navigatorObject.serviceWorker.controller);
  const registrations =
    typeof navigatorObject.serviceWorker.getRegistrations === 'function'
      ? await navigatorObject.serviceWorker.getRegistrations()
      : [];

  await Promise.all(
    registrations.map((registration) =>
      registration.unregister().catch(() => false),
    ),
  );

  if (cacheStorage && typeof cacheStorage.keys === 'function' && typeof cacheStorage.delete === 'function') {
    const cacheKeys = await cacheStorage.keys().catch(() => []);

    await Promise.all(cacheKeys.map((cacheKey) => cacheStorage.delete(cacheKey).catch(() => false)));
  }

  if (storage && typeof storage.removeItem === 'function' && !hadController) {
    storage.removeItem(reloadFlagKey);
  }

  if (hadController && windowObject.location && storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
    const hasReloaded = storage.getItem(reloadFlagKey) === 'true';

    if (!hasReloaded) {
      storage.setItem(reloadFlagKey, 'true');
      windowObject.location.reload();
    }
  }

  return createUnavailableStatus();
}

async function resolveUpdateMetadata(input: RegisterServiceWorkerInput) {
  try {
    return (
      (await input.loadUpdateMetadata?.()) ?? {
        releaseNotes: input.releaseNotes,
        updatePromptMode: input.updatePromptMode,
      }
    );
  } catch {
    return {
      releaseNotes: input.releaseNotes,
      updatePromptMode: input.updatePromptMode,
    };
  }
}

async function notifyUpdateAvailable(registration: ServiceWorkerRegistration, input: RegisterServiceWorkerInput) {
  const metadata = await resolveUpdateMetadata(input);

  input.onUpdateAvailable?.(registration, metadata.releaseNotes, metadata.updatePromptMode);
}

export async function registerServiceWorker(input: RegisterServiceWorkerInput): Promise<ServiceWorkerStatus> {
  const navigatorObject = input.navigator ?? globalThis.navigator;
  const windowObject = input.window ?? globalThis.window;

  if (!navigatorObject?.serviceWorker || !windowObject?.isSecureContext) {
    return createUnavailableStatus();
  }

  const startMs = input.nowMs?.() ?? Date.now();
  const registration = await navigatorObject.serviceWorker.register(input.scriptUrl ?? '/service-worker.js', {
    scope: input.scope ?? '/',
  });

  let updateAvailable = Boolean(registration.waiting);

  if (registration.waiting) {
    await notifyUpdateAvailable(registration, input);
  }

  registration.addEventListener('updatefound', () => {
    const installingWorker = registration.installing;

    if (!installingWorker) {
      return;
    }

    installingWorker.addEventListener('statechange', () => {
      if (installingWorker.state === 'installed' && navigatorObject.serviceWorker?.controller) {
        updateAvailable = true;
        void notifyUpdateAvailable(registration, input);
      }
    });
  });

  const offlineReady = await Promise.race([
    navigatorObject.serviceWorker.ready.then(() => true),
    new Promise<boolean>((resolve) => {
      windowObject.setTimeout(() => resolve(false), input.offlineReadyTimeoutMs);
    }),
  ]);

  const elapsedMs = (input.nowMs?.() ?? Date.now()) - startMs;

  if (offlineReady) {
    input.onOfflineReady?.(elapsedMs, registration);
  }

  return {
    cacheStatus: registration.active ? 'cached' : 'installing',
    offlineReady,
    offlineReadyElapsedMs: offlineReady ? elapsedMs : null,
    updateAvailable,
    scope: registration.scope ?? input.scope ?? null,
  };
}
