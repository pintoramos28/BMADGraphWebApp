import cleanCsvBenchmarkText from '../../../_bmad-output/benchmarks/benchmark_set_clean/csv/import.clean.csv-preview.csv?raw';
import cleanPasteBenchmarkText from '../../../_bmad-output/benchmarks/benchmark_set_clean/paste/import.clean.paste-preview.txt?raw';
import dirtyDelimiterRepairText from '../../../_bmad-output/benchmarks/benchmark_set_dirty/csv/import.dirty.delimiter-repair.csv?raw';
import dirtyHeaderRepairText from '../../../_bmad-output/benchmarks/benchmark_set_dirty/csv/import.dirty.header-repair.csv?raw';
import dirtyMissingValueRepairText from '../../../_bmad-output/benchmarks/benchmark_set_dirty/csv/import.dirty.missing-value-repair.csv?raw';
import dirtyTypeRepairText from '../../../_bmad-output/benchmarks/benchmark_set_dirty/csv/import.dirty.type-repair.csv?raw';

import type { ImportBenchmarkScenario, ImportSourceKind } from './preview-model';

type OwnedImportBenchmarkSourceKind = Extract<ImportSourceKind, 'csv-file' | 'pasted-table'>;

type OwnedImportBenchmarkFixture = {
  sourceKind: OwnedImportBenchmarkSourceKind;
  benchmarkScenario: ImportBenchmarkScenario;
  actionLabel: string;
  sourceLabel: string;
  fileName?: string;
  mimeType: string;
  textContent: string;
};

const ownedImportBenchmarkFixtures: Record<OwnedImportBenchmarkSourceKind, OwnedImportBenchmarkFixture> = {
  'csv-file': {
    sourceKind: 'csv-file',
    benchmarkScenario: 'import.clean.csv-preview',
    actionLabel: 'Preview BMAD clean CSV benchmark',
    sourceLabel: 'BMAD clean CSV benchmark',
    fileName: 'import.clean.csv-preview.csv',
    mimeType: 'text/csv',
    textContent: cleanCsvBenchmarkText,
  },
  'pasted-table': {
    sourceKind: 'pasted-table',
    benchmarkScenario: 'import.clean.paste-preview',
    actionLabel: 'Preview BMAD clean pasted benchmark',
    sourceLabel: 'BMAD clean pasted benchmark',
    mimeType: 'text/plain',
    textContent: cleanPasteBenchmarkText,
  },
};

const ownedCsvBenchmarkDetectionFixtures = [
  {
    fileName: 'import.clean.csv-preview.csv',
    benchmarkScenario: 'import.clean.csv-preview' as const,
    textContent: cleanCsvBenchmarkText,
  },
  {
    fileName: 'import.dirty.delimiter-repair.csv',
    benchmarkScenario: 'import.dirty.delimiter-repair' as const,
    textContent: dirtyDelimiterRepairText,
  },
  {
    fileName: 'import.dirty.header-repair.csv',
    benchmarkScenario: 'import.dirty.header-repair' as const,
    textContent: dirtyHeaderRepairText,
  },
  {
    fileName: 'import.dirty.type-repair.csv',
    benchmarkScenario: 'import.dirty.type-repair' as const,
    textContent: dirtyTypeRepairText,
  },
  {
    fileName: 'import.dirty.missing-value-repair.csv',
    benchmarkScenario: 'import.dirty.missing-value-repair' as const,
    textContent: dirtyMissingValueRepairText,
  },
];

function normalizeOwnedBenchmarkText(textContent: string) {
  return textContent.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
}

export function getOwnedImportBenchmarkFixture(sourceKind: OwnedImportBenchmarkSourceKind) {
  return ownedImportBenchmarkFixtures[sourceKind];
}

export function detectOwnedTextImportBenchmarkScenario({
  sourceKind,
  fileName,
  textContent,
}: {
  sourceKind: ImportSourceKind;
  fileName?: string | undefined;
  textContent?: string | null | undefined;
}): ImportBenchmarkScenario | null {
  if (!textContent) {
    return null;
  }

  const normalizedTextContent = normalizeOwnedBenchmarkText(textContent);

  if (sourceKind === 'csv-file') {
    const matchingFixture = ownedCsvBenchmarkDetectionFixtures.find(
      (fixture) =>
        fileName === fixture.fileName && normalizedTextContent === normalizeOwnedBenchmarkText(fixture.textContent),
    );

    return matchingFixture?.benchmarkScenario ?? null;
  }

  if (sourceKind === 'pasted-table') {
    // Standard pasted-table imports do not carry BMAD-owned provenance.
    // Reserve the clean pasted benchmark scenario for explicit BMAD-owned entrypoints only.
    return null;
  }

  return null;
}
