import type { ReleaseManifest } from '../../schemas/api';
import type { SupportMatrix } from '../../schemas/api/support-matrix';
import { loadReleaseManifest } from './load-release-manifest';
import { loadSupportMatrix } from './load-support-matrix';
import {
  detectBrowserEnvironment,
  evaluateShellEnvironment,
  type BrowserEnvironment,
  type ShellEnvironmentDecision,
  type WorkspaceCompatibilityInput,
} from './detect-environment';
import { disableServiceWorker, registerServiceWorker, type ServiceWorkerStatus } from './register-service-worker';

export interface BootstrapShellInput {
  fetchImpl?: typeof fetch;
  navigator?: Navigator;
  window?: Window;
  browser?: BrowserEnvironment;
  workspaceCompatibility?: WorkspaceCompatibilityInput | null;
  onOfflineReady?(elapsedMs: number, registration: ServiceWorkerRegistration | null): void;
  onUpdateAvailable?(
    registration: ServiceWorkerRegistration,
    releaseNotes: ReleaseManifest['releaseNotes'],
    updatePromptMode: ReleaseManifest['serviceWorker']['updatePromptMode'],
  ): void;
}

export interface BootstrapShellResult {
  releaseManifest: ReleaseManifest;
  supportMatrix: SupportMatrix;
  environment: ShellEnvironmentDecision;
  serviceWorker: ServiceWorkerStatus;
}

function createUnavailableServiceWorkerStatus(): ServiceWorkerStatus {
  return {
    cacheStatus: 'not-available',
    offlineReady: false,
    offlineReadyElapsedMs: null,
    updateAvailable: false,
    scope: null,
  };
}

function assertPinnedSupportMatrixVersion(releaseManifest: ReleaseManifest, supportMatrix: SupportMatrix) {
  if (supportMatrix.version !== releaseManifest.supportMatrixVersion) {
    throw new Error(
      `Support matrix version mismatch: manifest expects ${releaseManifest.supportMatrixVersion} but received ${supportMatrix.version}.`,
    );
  }
}

export async function bootstrapShell(input: BootstrapShellInput = {}): Promise<BootstrapShellResult> {
  const windowWithVitePreamble = (input.window ?? globalThis.window) as (Window & {
    __vite_plugin_react_preamble_installed__?: boolean;
  }) | undefined;
  const isDevServer = Boolean(windowWithVitePreamble?.__vite_plugin_react_preamble_installed__);
  const releaseManifestOptions = input.fetchImpl ? { fetchImpl: input.fetchImpl } : undefined;
  const releaseManifest = await loadReleaseManifest(releaseManifestOptions);
  const supportMatrix = await loadSupportMatrix({
    ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
    url: releaseManifest.supportMatrixUrl,
  });
  assertPinnedSupportMatrixVersion(releaseManifest, supportMatrix);
  const browser = input.browser ?? detectBrowserEnvironment({
    ...(input.window ? { secureContext: input.window.isSecureContext } : {}),
  });
  const environment = evaluateShellEnvironment({
    browser,
    releaseManifest,
    supportMatrix,
    workspaceCompatibility: input.workspaceCompatibility ?? null,
  });

  const serviceWorker =
    environment.shouldRouteToUnsupported && environment.browserStatus === 'unsupported'
      ? createUnavailableServiceWorkerStatus()
      : isDevServer
        ? await disableServiceWorker({
            ...(input.navigator ? { navigator: input.navigator } : {}),
            ...(input.window ? { window: input.window } : {}),
          }).catch(() => createUnavailableServiceWorkerStatus())
      : await registerServiceWorker({
          offlineReadyTimeoutMs: environment.offlineReadyTimeoutMs,
          updatePromptMode: environment.updatePromptMode,
          releaseNotes: environment.releaseNotes,
          loadUpdateMetadata: async () => {
            const latestReleaseManifest = await loadReleaseManifest(releaseManifestOptions);

            return {
              releaseNotes: latestReleaseManifest.releaseNotes,
              updatePromptMode: latestReleaseManifest.serviceWorker.updatePromptMode,
            };
          },
          ...(input.onOfflineReady ? { onOfflineReady: input.onOfflineReady } : {}),
          ...(input.onUpdateAvailable ? { onUpdateAvailable: input.onUpdateAvailable } : {}),
          ...(input.navigator ? { navigator: input.navigator } : {}),
          ...(input.window ? { window: input.window } : {}),
          scope: environment.cacheScope,
        }).catch(() => createUnavailableServiceWorkerStatus());

  return {
    releaseManifest,
    supportMatrix,
    environment,
    serviceWorker,
  };
}
