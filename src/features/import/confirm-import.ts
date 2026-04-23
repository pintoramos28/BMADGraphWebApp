import type { IssueRecord, WorkspaceSnapshot } from '../../schemas/workspace';
import type { ImportPreviewDataset, ImportRepairSelections } from './preview-model';

export function createImportedDatasetFromPreview(
  preview: ImportPreviewDataset,
  importToken: string,
  options: {
    sourceFile?: WorkspaceSnapshot['datasets'][number]['sourceFile'];
  } = {},
): WorkspaceSnapshot['datasets'][number] {
  const datasetId = `dataset_import_${importToken}`;
  const confirmedDataset = preview.confirmedDataset;

  if (!confirmedDataset) {
    throw new Error('Confirmed import dataset metadata is required before committing the import.');
  }

  return {
    datasetId,
    displayName: preview.source.fileName ?? preview.source.sourceLabel,
    sourceKind: preview.source.sourceKind,
    fingerprint: confirmedDataset.fingerprint,
    rowCount: confirmedDataset.rowCount,
    columnCount: confirmedDataset.columnCount,
    columns: confirmedDataset.columns.map((column) => ({
      columnId: column.columnId,
      sourceName: column.sourceName,
      dataType: column.dataType,
    })).map((column) => ({
      ...column,
      semanticRole: 'unassigned',
      unit: null,
      status: 'confirmed',
    })),
    rows: confirmedDataset.rows,
    ...(options.sourceFile ? { sourceFile: options.sourceFile } : {}),
  };
}

export function createImportedGraphId(importToken: string) {
  return `graph_import_${importToken}`;
}

export function createConfirmedImportSource(
  preview: ImportPreviewDataset,
): {
  sourceKind: ImportPreviewDataset['source']['sourceKind'];
  sourceLabel: string;
  fileName?: string | undefined;
  benchmarkScenario: ImportPreviewDataset['source']['benchmarkScenario'];
} {
  return {
    sourceKind: preview.source.sourceKind,
    sourceLabel: preview.source.sourceLabel,
    ...(preview.source.fileName ? { fileName: preview.source.fileName } : {}),
    benchmarkScenario: preview.source.benchmarkScenario,
  };
}

export function createConfirmedImportRepairSelections(preview: ImportPreviewDataset): ImportRepairSelections {
  return {
    delimiter: preview.repairSelections.delimiter,
    headerSelection: preview.repairSelections.headerSelection,
    columnTypeOverrides: { ...preview.repairSelections.columnTypeOverrides },
    missingValuePolicy: preview.repairSelections.missingValuePolicy,
    additionalColumnsAcknowledgement: preview.repairSelections.additionalColumnsAcknowledgement ?? null,
  };
}

export function summarizeImportIssues(issues: IssueRecord[]) {
  return {
    blocking: issues.filter((issue) => issue.status !== 'resolved' && issue.severity === 'blocking').length,
    warning: issues.filter((issue) => issue.status !== 'resolved' && issue.severity === 'warning').length,
    info: issues.filter((issue) => issue.status !== 'resolved' && issue.severity === 'info').length,
  };
}
