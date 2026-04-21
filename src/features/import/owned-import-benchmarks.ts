import cleanCsvBenchmarkText from '../../../_bmad-output/benchmarks/benchmark_set_clean/csv/import.clean.csv-preview.csv?raw';
import cleanPasteBenchmarkText from '../../../_bmad-output/benchmarks/benchmark_set_clean/paste/import.clean.paste-preview.txt?raw';

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

export function getOwnedImportBenchmarkFixture(sourceKind: OwnedImportBenchmarkSourceKind) {
  return ownedImportBenchmarkFixtures[sourceKind];
}
