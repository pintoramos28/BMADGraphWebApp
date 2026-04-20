import type { ImportPreviewDataset } from './preview-model';

export const IMPORT_PREVIEW_BUDGET_MS = 5_000;

export interface ImportBenchmarkTimingEvent {
  scenario: ImportPreviewDataset['source']['benchmarkScenario'];
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
): ImportBenchmarkTimingEvent {
  return {
    scenario: preview.source.benchmarkScenario,
    sourceKind: preview.source.sourceKind,
    durationMs: preview.timing.durationMs,
    budgetMs: preview.timing.budgetMs,
    exceededBudget: preview.timing.exceededBudget,
    rowCount: preview.rowCount,
    columnCount: preview.columnCount,
    capturedAt: now(),
  };
}

export function dispatchImportBenchmarkTimingEvent(
  preview: ImportPreviewDataset,
  target: EventTargetLike = globalThis as typeof globalThis & EventTargetLike,
) {
  const detail = createImportBenchmarkTimingEvent(preview);

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
