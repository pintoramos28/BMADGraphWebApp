import { createStore } from 'zustand/vanilla';

import type { ReleaseManifest } from '../../schemas/api';
import type { SupportMatrix } from '../../schemas/api/support-matrix';
import type { BootstrapShellResult } from '../../services/release';
import type { ShellEnvironmentDecision } from '../../services/release';
import type { ServiceWorkerStatus } from '../../services/release';

export type ShellLifecycleStatus = 'idle' | 'loading' | 'ready' | 'degraded' | 'blocked' | 'error';

export interface ShellStatusState {
  lifecycle: ShellLifecycleStatus;
  releaseManifest: ReleaseManifest | null;
  supportMatrix: SupportMatrix | null;
  environment: ShellEnvironmentDecision | null;
  releaseNotes: ReleaseManifest['releaseNotes'] | null;
  updatePromptMode: ReleaseManifest['serviceWorker']['updatePromptMode'] | null;
  serviceWorker: ServiceWorkerStatus;
  updatePromptVisible: boolean;
}

export interface ShellUpdateAvailableInput {
  releaseNotes: ReleaseManifest['releaseNotes'];
  updatePromptMode: ReleaseManifest['serviceWorker']['updatePromptMode'];
}

export interface ShellStatusCommands {
  beginLoading(): void;
  applyBootstrapResult(result: BootstrapShellResult): void;
  markUpdateAvailable(input: ShellUpdateAvailableInput): void;
  setError(): void;
  dismissUpdatePrompt(): void;
}

export interface ShellStatusSelectors {
  lifecycle(): ShellLifecycleStatus;
  releaseManifest(): ReleaseManifest | null;
  supportMatrix(): SupportMatrix | null;
  environment(): ShellEnvironmentDecision | null;
  releaseNotes(): ReleaseManifest['releaseNotes'] | null;
  updatePromptMode(): ReleaseManifest['serviceWorker']['updatePromptMode'] | null;
  serviceWorker(): ServiceWorkerStatus;
  updatePromptVisible(): boolean;
}

export interface ShellStatusStore {
  commands: ShellStatusCommands;
  selectors: ShellStatusSelectors;
}

export type ShellStatusStoreState = ShellStatusState & ShellStatusStore;

const defaultServiceWorkerStatus: ServiceWorkerStatus = {
  cacheStatus: 'not-available',
  offlineReady: false,
  offlineReadyElapsedMs: null,
  updateAvailable: false,
  scope: null,
};

export function createShellStatusStore() {
  return createStore<ShellStatusStoreState>((set, get) => ({
    lifecycle: 'idle',
    releaseManifest: null,
    supportMatrix: null,
    environment: null,
    releaseNotes: null,
    updatePromptMode: null,
    serviceWorker: defaultServiceWorkerStatus,
    updatePromptVisible: false,
    commands: {
      beginLoading() {
        set({
          lifecycle: 'loading',
          updatePromptVisible: false,
        });
      },
      applyBootstrapResult(result) {
        set({
          releaseManifest: result.releaseManifest,
          supportMatrix: result.supportMatrix,
          environment: result.environment,
          releaseNotes: result.environment.releaseNotes,
          updatePromptMode: result.environment.updatePromptMode,
          serviceWorker: result.serviceWorker,
          lifecycle: result.environment.lifecycle,
          updatePromptVisible: result.serviceWorker.updateAvailable,
        });
      },
      markUpdateAvailable(input) {
        set((state) => ({
          releaseNotes: input.releaseNotes,
          updatePromptMode: input.updatePromptMode,
          serviceWorker: {
            ...state.serviceWorker,
            updateAvailable: true,
          },
          updatePromptVisible: true,
        }));
      },
      setError() {
        set({
          lifecycle: 'error',
        });
      },
      dismissUpdatePrompt() {
        set({
          updatePromptVisible: false,
        });
      },
    },
    selectors: {
      lifecycle() {
        return get().lifecycle;
      },
      releaseManifest() {
        return get().releaseManifest;
      },
      supportMatrix() {
        return get().supportMatrix;
      },
      environment() {
        return get().environment;
      },
      releaseNotes() {
        return get().releaseNotes;
      },
      updatePromptMode() {
        return get().updatePromptMode;
      },
      serviceWorker() {
        return get().serviceWorker;
      },
      updatePromptVisible() {
        return get().updatePromptVisible;
      },
    },
  }));
}
