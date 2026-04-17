import { useEffect, useRef } from 'react';
import { RouterProvider } from 'react-router';

import { resolveWorkspaceCompatibilityFromLocation } from './boot/resolve-workspace-compatibility';
import { bootstrapShell, type BootstrapShellResult } from '../services/release';
import { createShellStatusStore, type ShellUpdateAvailableInput } from '../stores/shell-status';
import { createShellRouter } from './router/shell-routes';

export function mergeBootstrapResultWithPendingUpdate(
  result: BootstrapShellResult,
  pendingUpdate: ShellUpdateAvailableInput | null,
): BootstrapShellResult {
  if (!pendingUpdate) {
    return result;
  }

  return {
    ...result,
    environment: {
      ...result.environment,
      releaseNotes: pendingUpdate.releaseNotes,
      updatePromptMode: pendingUpdate.updatePromptMode,
    },
    serviceWorker: {
      ...result.serviceWorker,
      updateAvailable: true,
    },
  };
}

export function App() {
  const storeRef = useRef<ReturnType<typeof createShellStatusStore> | null>(null);
  const routerRef = useRef<ReturnType<typeof createShellRouter> | null>(null);
  const pendingUpdateRef = useRef<ShellUpdateAvailableInput | null>(null);

  if (!storeRef.current) {
    storeRef.current = createShellStatusStore();
  }

  if (!routerRef.current) {
    routerRef.current = createShellRouter(storeRef.current);
  }

  useEffect(() => {
    let cancelled = false;

    storeRef.current?.getState().commands.beginLoading();

    resolveWorkspaceCompatibilityFromLocation(window.location)
      .then((workspaceCompatibility) =>
        bootstrapShell({
          window,
          navigator,
          workspaceCompatibility,
          onUpdateAvailable: (_registration, releaseNotes, updatePromptMode) => {
            const update = {
              releaseNotes,
              updatePromptMode,
            } satisfies ShellUpdateAvailableInput;

            pendingUpdateRef.current = update;
            storeRef.current?.getState().commands.markUpdateAvailable(update);
          },
        }),
      )
      .then((result) => {
        if (cancelled) {
          return;
        }

        const nextResult = mergeBootstrapResultWithPendingUpdate(result, pendingUpdateRef.current);

        pendingUpdateRef.current = null;
        storeRef.current?.getState().commands.applyBootstrapResult(nextResult);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        storeRef.current?.getState().commands.setError();
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <RouterProvider router={routerRef.current} />;
}
