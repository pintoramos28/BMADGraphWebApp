import { describe, expect, it, vi } from 'vitest';

import { createImportBenchmarkTimingEvent, dispatchImportBenchmarkTimingEvent } from './benchmark-timing';

const previewFixture = {
  previewId: 'preview_fixture',
  source: {
    sourceKind: 'csv-file' as const,
    sourceLabel: 'Local CSV file',
    fileName: 'fixture.csv',
    mimeType: 'text/csv',
    sheetName: null,
    benchmarkScenario: 'import.clean.csv-preview' as const,
  },
  rowCount: 12,
  columnCount: 4,
  columns: [],
  sampleRows: [],
  assumptions: [],
  uncertainties: [],
  timing: {
    durationMs: 1234,
    budgetMs: 5000,
    exceededBudget: false,
  },
};

describe('import benchmark timing hooks', () => {
  it('creates a redacted timing payload without raw row data', () => {
    const event = createImportBenchmarkTimingEvent(previewFixture, () => '2026-04-20T10:30:00.000Z');

    expect(event).toEqual({
      scenario: 'import.clean.csv-preview',
      sourceKind: 'csv-file',
      durationMs: 1234,
      budgetMs: 5000,
      exceededBudget: false,
      rowCount: 12,
      columnCount: 4,
      capturedAt: '2026-04-20T10:30:00.000Z',
    });
    expect(event).not.toHaveProperty('sampleRows');
    expect(event).not.toHaveProperty('columns');
  });

  it('dispatches the benchmark timing event when an event target is available', () => {
    const dispatchEvent = vi.fn();

    const event = dispatchImportBenchmarkTimingEvent(previewFixture, {
      dispatchEvent,
    });

    expect(event.scenario).toBe('import.clean.csv-preview');
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });
});
