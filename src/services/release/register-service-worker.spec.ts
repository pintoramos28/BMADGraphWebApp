import { describe, expect, it, vi } from 'vitest';

import { disableServiceWorker, registerServiceWorker } from './register-service-worker';

describe('registerServiceWorker', () => {
  it('returns an unavailable status when service workers are not supported', async () => {
    const status = await registerServiceWorker({
      offlineReadyTimeoutMs: 100,
      updatePromptMode: 'soft-refresh',
      releaseNotes: {
        title: 'Release notes',
        url: '/release-notes/0.1.0',
      },
      navigator: {} as Navigator,
      window: { isSecureContext: true } as Window,
    });

    expect(status).toMatchObject({
      cacheStatus: 'not-available',
      offlineReady: false,
      updateAvailable: false,
    });
  });

  it('marks offline-ready when registration resolves before the timeout', async () => {
    const ready = Promise.resolve();
    const register = vi.fn(async () => ({
      active: {} as ServiceWorker,
      waiting: null,
      installing: null,
      scope: '/',
      addEventListener: vi.fn(),
    })) as unknown as ServiceWorkerContainer['register'];

    const navigatorStub = {
      serviceWorker: {
        register,
        ready,
        controller: {} as ServiceWorker,
      },
    } as unknown as Navigator;

    const status = await registerServiceWorker({
      offlineReadyTimeoutMs: 100,
      updatePromptMode: 'soft-refresh',
      releaseNotes: {
        title: 'Release notes',
        url: '/release-notes/0.1.0',
      },
      navigator: navigatorStub,
      window: {
        isSecureContext: true,
        setTimeout: globalThis.setTimeout,
      } as unknown as Window,
      nowMs: (() => {
        const samples = [1000, 1035];
        return () => samples.shift() ?? 1035;
      })(),
    });

    expect(register).toHaveBeenCalledOnce();
    expect(status.offlineReady).toBe(true);
    expect(status.cacheStatus).toBe('cached');
  });

  it('refreshes update metadata before surfacing an available update', async () => {
    const onUpdateAvailable = vi.fn();

    await registerServiceWorker({
      offlineReadyTimeoutMs: 100,
      updatePromptMode: 'soft-refresh',
      releaseNotes: {
        title: 'Initial release notes',
        url: '/release-notes/0.1.0',
      },
      loadUpdateMetadata: vi.fn(async () => ({
        releaseNotes: {
          title: 'Hotfix release notes',
          url: '/release-notes/0.1.1',
        },
        updatePromptMode: 'hard-refresh' as const,
      })),
      onUpdateAvailable,
      navigator: {
        serviceWorker: {
          register: vi.fn(async () => ({
            active: {} as ServiceWorker,
            waiting: {} as ServiceWorker,
            installing: null,
            scope: '/',
            addEventListener: vi.fn(),
          })),
          ready: Promise.resolve(),
          controller: {} as ServiceWorker,
        },
      } as unknown as Navigator,
      window: {
        isSecureContext: true,
        setTimeout: globalThis.setTimeout,
      } as unknown as Window,
    });

    expect(onUpdateAvailable).toHaveBeenCalledWith(
      expect.anything(),
      {
        title: 'Hotfix release notes',
        url: '/release-notes/0.1.1',
      },
      'hard-refresh',
    );
  });
});

describe('disableServiceWorker', () => {
  it('unregisters active service workers, clears caches, and reloads once when the page is controlled', async () => {
    const unregister = vi.fn(async () => true);
    const reload = vi.fn();
    const sessionStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    } as unknown as Storage;
    const cacheStorage = {
      keys: vi.fn(async () => ['bmad-shell-v1']),
      delete: vi.fn(async () => true),
    } as unknown as CacheStorage;

    const status = await disableServiceWorker({
      navigator: {
        serviceWorker: {
          controller: {} as ServiceWorker,
          getRegistrations: vi.fn(async () => [
            {
              unregister,
            } as unknown as ServiceWorkerRegistration,
          ]),
        },
      } as unknown as Navigator,
      window: {
        isSecureContext: true,
        location: {
          reload,
        },
      } as unknown as Window,
      cacheStorage,
      sessionStorage,
    });

    expect(unregister).toHaveBeenCalledOnce();
    expect(cacheStorage.keys).toHaveBeenCalledOnce();
    expect(cacheStorage.delete).toHaveBeenCalledWith('bmad-shell-v1');
    expect(sessionStorage.setItem).toHaveBeenCalledWith('bmad:disable-service-worker:reloaded', 'true');
    expect(reload).toHaveBeenCalledOnce();
    expect(status).toMatchObject({
      cacheStatus: 'not-available',
      offlineReady: false,
      updateAvailable: false,
    });
  });

  it('clears the one-time reload flag after a clean dev load without an active controller', async () => {
    const removeItem = vi.fn();

    await disableServiceWorker({
      navigator: {
        serviceWorker: {
          controller: null,
          getRegistrations: vi.fn(async () => []),
        },
      } as unknown as Navigator,
      window: {
        isSecureContext: true,
        location: {
          reload: vi.fn(),
        },
      } as unknown as Window,
      cacheStorage: {
        keys: vi.fn(async () => []),
        delete: vi.fn(async () => true),
      } as unknown as CacheStorage,
      sessionStorage: {
        getItem: vi.fn(() => 'true'),
        setItem: vi.fn(),
        removeItem,
      } as unknown as Storage,
    });

    expect(removeItem).toHaveBeenCalledWith('bmad:disable-service-worker:reloaded');
  });
});
