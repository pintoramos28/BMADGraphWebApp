import type { WorkspaceSnapshot } from '../../schemas/workspace';

export const IMPORT_BOOTSTRAP_DATASET_ID = 'dataset_import_placeholder';
export const IMPORT_BOOTSTRAP_GRAPH_ID = 'graph_import_placeholder';

export function createImportWorkspaceSnapshot(workspaceId: string): WorkspaceSnapshot {
  const timestamp = new Date().toISOString();

  return {
    workspaceId,
    workspaceFormatVersion: '1.0.0',
    appBuildVersion: '0.1.0',
    schemaVersion: '2026-04-15',
    createdAt: timestamp,
    updatedAt: timestamp,
    compatibility: {
      minReadableAppBuild: '0.1.0',
      maxTestedAppBuild: '0.1.x',
    },
    datasets: [
      {
        datasetId: IMPORT_BOOTSTRAP_DATASET_ID,
        displayName: 'Import preview placeholder dataset',
        sourceKind: 'import-preview',
        fingerprint: `preview:${workspaceId}:bootstrap`,
        rowCount: 0,
        columnCount: 0,
        columns: [],
      },
    ],
    transformPipeline: [],
    formulaColumns: [],
    graphDefinitions: [
      {
        graphId: IMPORT_BOOTSTRAP_GRAPH_ID,
        title: 'Import placeholder graph',
        status: 'reference',
        datasetId: IMPORT_BOOTSTRAP_DATASET_ID,
        roleAssignments: {
          x: [],
          y: [],
          color: [],
          size: [],
          facetRow: [],
          facetColumn: [],
        },
        marks: ['point'],
        overlays: [],
        presentation: {},
        issueIds: [],
        evidenceIds: [],
      },
    ],
    activeGraphId: IMPORT_BOOTSTRAP_GRAPH_ID,
    referenceGraphId: IMPORT_BOOTSTRAP_GRAPH_ID,
    evidence: [],
    issues: [],
    readiness: {
      status: 'warning',
      blockingIssueIds: [],
      warningIssueIds: [],
      provenanceCompleteness: 'none',
    },
    telemetrySnapshot: {
      lastGraphRenderMs: 0,
      offlineQueueDepth: 0,
      status: 'idle',
    },
    exportSummary: {
      lastExportedAt: null,
      includedReferenceGraphId: IMPORT_BOOTSTRAP_GRAPH_ID,
      manifestVersion: '1.0.0',
    },
  };
}
