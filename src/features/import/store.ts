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
  progress: ImportPreviewProgress | null;
  error: ImportPreviewError | null;
  budgetExceeded: boolean;
  lastTimingEvent: ImportBenchmarkTimingEvent | null;
}

export interface ImportPreviewStateCommands {
  beginImport(correlationId: string, sourceKind: ImportSourceKind): void;
  updateProgress(progress: ImportPreviewProgress): void;
  markBudgetExceeded(): void;
  resolveImport(preview: ImportPreviewDataset, timingEvent: ImportBenchmarkTimingEvent): void;
  failImport(error: ImportPreviewError): void;
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

export function createImportPreviewStore() {
  return createStore<ImportPreviewState>((set, get) => ({
    status: 'idle',
    activeCorrelationId: null,
    activeSourceKind: null,
    preview: null,
    progress: null,
    error: null,
    budgetExceeded: false,
    lastTimingEvent: null,
    commands: {
      beginImport(correlationId, sourceKind) {
        set({
          status: 'parsing',
          activeCorrelationId: correlationId,
          activeSourceKind: sourceKind,
          preview: null,
          progress: {
            phase: 'loading',
            message: 'Preparing the local preview workspace.',
          },
          error: null,
          budgetExceeded: false,
        });
      },
      updateProgress(progress) {
        set((state) => ({
          ...state,
          progress,
        }));
      },
      markBudgetExceeded() {
        set((state) => ({
          ...state,
          budgetExceeded: true,
        }));
      },
      resolveImport(preview, timingEvent) {
        set((state) => ({
          ...state,
          status: 'ready',
          preview,
          progress: null,
          error: null,
          budgetExceeded: preview.timing.exceededBudget || state.budgetExceeded,
          lastTimingEvent: timingEvent,
        }));
      },
      failImport(error) {
        set((state) => ({
          ...state,
          status: 'error',
          progress: null,
          preview: null,
          error,
        }));
      },
      reset() {
        set({
          status: 'idle',
          activeCorrelationId: null,
          activeSourceKind: null,
          preview: null,
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
