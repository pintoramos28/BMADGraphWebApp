/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

type FetchEventHandler = (event: {
  request: { method: string; url: string };
  respondWith(promise: Promise<unknown>): void;
}) => void;

function createServiceWorkerHarness() {
  const handlers = new Map<string, EventListener>();
  const cache = {
    put: vi.fn(async (): Promise<void> => undefined),
    addAll: vi.fn(async (): Promise<void> => undefined),
  };
  const caches = {
    open: vi.fn(async (): Promise<typeof cache> => cache),
    match: vi.fn(async (): Promise<Response | undefined> => undefined),
  };
  const fetch = vi.fn(async (): Promise<Response> => new Response('fresh shell response', { status: 200 }));
  const script = readFileSync(resolve(process.cwd(), 'public/service-worker.js'), 'utf8');

  vm.runInNewContext(
    script,
    {
      caches,
      clients: {
        claim: vi.fn(async () => undefined),
      },
      fetch,
      self: {
        addEventListener(type: string, handler: EventListener) {
          handlers.set(type, handler);
        },
        skipWaiting: vi.fn(),
        location: {
          origin: 'https://shell.example',
        },
      },
      URL,
      Response,
    },
    {
      filename: 'public/service-worker.js',
    },
  );

  const fetchHandler = handlers.get('fetch') as FetchEventHandler | undefined;

  if (!fetchHandler) {
    throw new Error('service worker fetch handler did not register');
  }

  return {
    cache,
    caches,
    fetch,
    fetchHandler,
  };
}

async function runFetch(handler: FetchEventHandler, request: { method: string; url: string }) {
  let responsePromise: Promise<unknown> | null = null;

  handler({
    request,
    respondWith(promise) {
      responsePromise = promise;
    },
  });

  if (!responsePromise) {
    throw new Error('service worker fetch handler did not call respondWith');
  }

  return responsePromise;
}

describe('public/service-worker.js', () => {
  it('bypasses the cache for shell metadata API requests', async () => {
    const harness = createServiceWorkerHarness();
    const request = {
      method: 'GET',
      url: 'https://shell.example/api/release-manifest',
    };

    harness.caches.match.mockResolvedValueOnce(new Response('stale metadata', { status: 200 }));

    const response = (await runFetch(harness.fetchHandler, request)) as Response;

    expect(response.status).toBe(200);
    expect(harness.fetch).toHaveBeenCalledOnce();
    expect(harness.caches.match).not.toHaveBeenCalled();
    expect(harness.cache.put).not.toHaveBeenCalled();
  });

  it('bypasses the cache for Vite dev modules and worker assets', async () => {
    const harness = createServiceWorkerHarness();
    const requests = [
      {
        method: 'GET',
        url: 'https://shell.example/src/workers/import.worker.ts?worker_file&type=module',
      },
      {
        method: 'GET',
        url: 'https://shell.example/@vite/client',
      },
      {
        method: 'GET',
        url: 'https://shell.example/node_modules/.vite/deps/react.js?v=123',
      },
    ];

    for (const request of requests) {
      harness.caches.match.mockClear();
      harness.cache.put.mockClear();
      harness.fetch.mockClear();

      const response = (await runFetch(harness.fetchHandler, request)) as Response;

      expect(response.status).toBe(200);
      expect(harness.fetch).toHaveBeenCalledOnce();
      expect(harness.caches.match).not.toHaveBeenCalled();
      expect(harness.cache.put).not.toHaveBeenCalled();
    }
  });

  it('still caches non-API shell assets', async () => {
    const harness = createServiceWorkerHarness();
    const request = {
      method: 'GET',
      url: 'https://shell.example/assets/app.js',
    };

    harness.caches.match.mockResolvedValueOnce(undefined);

    const response = (await runFetch(harness.fetchHandler, request)) as Response;

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(response.status).toBe(200);
    expect(harness.fetch).toHaveBeenCalledOnce();
    expect(harness.caches.match).toHaveBeenCalledOnce();
    expect(harness.cache.put).toHaveBeenCalledOnce();
  });
});
