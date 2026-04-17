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
