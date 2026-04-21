import { createStore } from 'zustand/vanilla';

import type { ImportBenchmarkTimingEvent } from './benchmark-timing';
import type { ImportPreviewDataset, ImportSourceKind } from './preview-model';

export interface ImportPreviewProgress {
  phase: 'loading' | 'parsing' | 'normalizing';
  message: string;
}

export interface ImportPreviewError {
  code: string;
  title: string;
  detail: string;
  retryable: boolean;
}

export interface ImportPreviewStateData {
  status: 'idle' | 'parsing' | 'ready' | 'error';
  activeCorrelationId: string | null;
  activeSourceKind: ImportSourceKind | null;
  preview: ImportPreviewDataset | null;
  preservedPreview: ImportPreviewDataset | null;
  progress: ImportPreviewProgress | null;
  error: ImportPreviewError | null;
  budgetExceeded: boolean;
  lastTimingEvent: ImportBenchmarkTimingEvent | null;
}

export interface ImportPreviewStateCommands {
  beginImport(correlationId: string, sourceKind: ImportSourceKind): void;
  cancelImport(correlationId?: string): void;
  updateProgress(progress: ImportPreviewProgress, correlationId?: string): void;
  markBudgetExceeded(): void;
  resolveImport(preview: ImportPreviewDataset, timingEvent: ImportBenchmarkTimingEvent | null, correlationId?: string): void;
  failImport(error: ImportPreviewError, correlationId?: string): void;
  reset(): void;
}

export interface ImportPreviewStateSelectors {
  status(): ImportPreviewStateData['status'];
  preview(): ImportPreviewDataset | null;
  budgetExceeded(): boolean;
}

export interface ImportPreviewStateStore {
  commands: ImportPreviewStateCommands;
  selectors: ImportPreviewStateSelectors;
}

export type ImportPreviewState = ImportPreviewStateData & ImportPreviewStateStore;

function shouldIgnoreCorrelation(state: ImportPreviewStateData, correlationId?: string) {
  return correlationId !== undefined && state.activeCorrelationId !== correlationId;
}

export function createImportPreviewStore() {
  return createStore<ImportPreviewState>((set, get) => ({
    status: 'idle',
    activeCorrelationId: null,
    activeSourceKind: null,
    preview: null,
    preservedPreview: null,
    progress: null,
    error: null,
    budgetExceeded: false,
    lastTimingEvent: null,
    commands: {
      beginImport(correlationId, sourceKind) {
        set((state) => ({
          ...state,
          status: 'parsing',
          activeCorrelationId: correlationId,
          activeSourceKind: sourceKind,
          preview: null,
          preservedPreview: state.preview ?? state.preservedPreview,
          progress: {
            phase: 'loading',
            message: 'Preparing the local preview workspace.',
          },
          error: null,
          budgetExceeded: false,
        }));
      },
      cancelImport(correlationId) {
        set((state) => {
          if (shouldIgnoreCorrelation(state, correlationId)) {
            return state;
          }

          const preview = state.preservedPreview;

          return {
            ...state,
            status: preview ? 'ready' : 'idle',
            activeCorrelationId: null,
            activeSourceKind: null,
            preview,
            preservedPreview: null,
            progress: null,
            error: null,
            budgetExceeded: preview?.timing.exceededBudget ?? false,
          };
        });
      },
      updateProgress(progress, correlationId) {
        set((state) => {
          if (shouldIgnoreCorrelation(state, correlationId)) {
            return state;
          }

          return {
            ...state,
            progress,
          };
        });
      },
      markBudgetExceeded() {
        set((state) => ({
          ...state,
          budgetExceeded: true,
        }));
      },
      resolveImport(preview, timingEvent, correlationId) {
        set((state) => {
          if (shouldIgnoreCorrelation(state, correlationId)) {
            return state;
          }

          return {
            ...state,
            status: 'ready',
            activeCorrelationId: null,
            activeSourceKind: null,
            preview,
            preservedPreview: null,
            progress: null,
            error: null,
            budgetExceeded: preview.timing.exceededBudget || state.budgetExceeded,
            lastTimingEvent: timingEvent,
          };
        });
      },
      failImport(error, correlationId) {
        set((state) => {
          if (shouldIgnoreCorrelation(state, correlationId)) {
            return state;
          }

          return {
            ...state,
            status: 'error',
            activeCorrelationId: null,
            activeSourceKind: null,
            progress: null,
            preview: null,
            preservedPreview: null,
            error,
          };
        });
      },
      reset() {
        set({
          status: 'idle',
          activeCorrelationId: null,
          activeSourceKind: null,
          preview: null,
          preservedPreview: null,
          progress: null,
          error: null,
          budgetExceeded: false,
          lastTimingEvent: null,
        });
      },
    },
    selectors: {
      status() {
        return get().status;
      },
      preview() {
        return get().preview;
      },
      budgetExceeded() {
        return get().budgetExceeded;
      },
    },
  }));
}
