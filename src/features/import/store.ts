import { createStore } from 'zustand/vanilla';

import type { ImportBenchmarkTimingEvent } from './benchmark-timing';
import {
  createDefaultImportRepairSelections,
  type ImportPreviewDataset,
  type ImportRepairSelections,
  type ImportSourceKind,
} from './preview-model';
import type { ImportPreviewRequestPayload } from '../../schemas/worker';

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
  repairSelections: ImportRepairSelections;
  sourceRequest: ImportPreviewRequestPayload | null;
  lastCommittedPreviewId: string | null;
}

export interface ImportPreviewStateCommands {
  beginImport(correlationId: string, sourceKind: ImportSourceKind, options?: { preserveRepairSelections?: boolean }): void;
  cancelImport(correlationId?: string): void;
  updateProgress(progress: ImportPreviewProgress, correlationId?: string): void;
  markBudgetExceeded(): void;
  resolveImport(preview: ImportPreviewDataset, timingEvent: ImportBenchmarkTimingEvent | null, correlationId?: string): void;
  failImport(error: ImportPreviewError, correlationId?: string): void;
  setRepairSelections(repairSelections: ImportRepairSelections): void;
  setSourceRequest(sourceRequest: ImportPreviewRequestPayload): void;
  markCommitted(previewId: string): void;
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

function shouldPreservePreviewOnUncorrelatedFailure(state: ImportPreviewStateData, correlationId?: string) {
  return correlationId === undefined && state.activeCorrelationId === null && state.preview !== null;
}

function restoreRepairSelectionsForVisiblePreview(
  preview: ImportPreviewDataset | null,
  fallbackRepairSelections: ImportRepairSelections,
) {
  return preview?.repairSelections ?? fallbackRepairSelections;
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
    repairSelections: createDefaultImportRepairSelections(),
    sourceRequest: null,
    lastCommittedPreviewId: null,
    commands: {
      beginImport(correlationId, sourceKind, options) {
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
          repairSelections:
            options?.preserveRepairSelections === true ? state.repairSelections : createDefaultImportRepairSelections(),
          lastCommittedPreviewId: state.lastCommittedPreviewId,
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
            repairSelections: restoreRepairSelectionsForVisiblePreview(preview, state.repairSelections),
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
            repairSelections: preview.repairSelections,
            lastCommittedPreviewId: null,
          };
        });
      },
      failImport(error, correlationId) {
        set((state) => {
          if (shouldIgnoreCorrelation(state, correlationId)) {
            return state;
          }

          const preservedVisiblePreview = shouldPreservePreviewOnUncorrelatedFailure(state, correlationId)
            ? state.preview
            : state.preservedPreview;

          return {
            ...state,
            status: 'error',
            activeCorrelationId: null,
            activeSourceKind: null,
            progress: null,
            preview: preservedVisiblePreview,
            preservedPreview: null,
            repairSelections: restoreRepairSelectionsForVisiblePreview(
              preservedVisiblePreview,
              state.repairSelections,
            ),
            error,
          };
        });
      },
      setRepairSelections(repairSelections) {
        set((state) => ({
          ...state,
          repairSelections,
        }));
      },
      setSourceRequest(sourceRequest) {
        set((state) => ({
          ...state,
          sourceRequest,
        }));
      },
      markCommitted(previewId) {
        set((state) => ({
          ...state,
          lastCommittedPreviewId: previewId,
        }));
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
          repairSelections: createDefaultImportRepairSelections(),
          sourceRequest: null,
          lastCommittedPreviewId: null,
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
