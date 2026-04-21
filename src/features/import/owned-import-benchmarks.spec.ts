import { describe, expect, it } from 'vitest';

import { getOwnedImportBenchmarkFixture } from './owned-import-benchmarks';

describe('getOwnedImportBenchmarkFixture', () => {
  it('returns the BMAD-owned clean CSV benchmark fixture metadata and content', () => {
    const fixture = getOwnedImportBenchmarkFixture('csv-file');

    expect(fixture).toMatchObject({
      sourceKind: 'csv-file',
      benchmarkScenario: 'import.clean.csv-preview',
      fileName: 'import.clean.csv-preview.csv',
      mimeType: 'text/csv',
    });
    expect(fixture.textContent).toContain('Sample,Reading,MeasuredAt');
  });

  it('returns the BMAD-owned clean pasted benchmark fixture metadata and content', () => {
    const fixture = getOwnedImportBenchmarkFixture('pasted-table');

    expect(fixture).toMatchObject({
      sourceKind: 'pasted-table',
      benchmarkScenario: 'import.clean.paste-preview',
      mimeType: 'text/plain',
    });
    expect(fixture.textContent).toContain('Sample\tReading\tMeasuredAt');
  });
});
