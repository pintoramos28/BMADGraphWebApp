import type { ImportBenchmarkScenario, ImportPreviewDataset } from './preview-model';

export const IMPORT_PREVIEW_BUDGET_MS = 5_000;

export interface ImportBenchmarkTimingEvent {
  scenario: ImportBenchmarkScenario;
  sourceKind: ImportPreviewDataset['source']['sourceKind'];
  durationMs: number;
  budgetMs: number;
  exceededBudget: boolean;
  rowCount: number;
  columnCount: number;
  capturedAt: string;
}

interface EventTargetLike {
  dispatchEvent?(event: Event): boolean;
}

export function createImportBenchmarkTimingEvent(
  preview: ImportPreviewDataset,
  now: () => string = () => new Date().toISOString(),
  durationMsOverride?: number,
): ImportBenchmarkTimingEvent | null {
  if (!preview.source.benchmarkScenario) {
    return null;
  }

  const durationMs = durationMsOverride ?? preview.timing.durationMs;

  return {
    scenario: preview.source.benchmarkScenario,
    sourceKind: preview.source.sourceKind,
    durationMs,
    budgetMs: preview.timing.budgetMs,
    exceededBudget: preview.timing.exceededBudget || durationMs > preview.timing.budgetMs,
    rowCount: preview.rowCount,
    columnCount: preview.columnCount,
    capturedAt: now(),
  };
}

export function dispatchImportBenchmarkTimingEvent(
  preview: ImportPreviewDataset,
  target: EventTargetLike = globalThis as typeof globalThis & EventTargetLike,
  durationMsOverride?: number,
) {
  const detail = createImportBenchmarkTimingEvent(preview, () => new Date().toISOString(), durationMsOverride);

  if (!detail) {
    return null;
  }

  if (typeof CustomEvent === 'undefined' || typeof target.dispatchEvent !== 'function') {
    return detail;
  }

  target.dispatchEvent(
    new CustomEvent<ImportBenchmarkTimingEvent>('bmad:import-benchmark-timing', {
      detail,
    }),
  );

  return detail;
}
