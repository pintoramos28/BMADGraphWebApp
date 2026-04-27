import type { WorkspaceSnapshot } from '../../../schemas/workspace';

import { graphDefinitionFixture } from './graph-definition.fixture';

export const workspaceSnapshotFixture = {
  workspaceId: 'ws_2026_04_15_001',
  workspaceFormatVersion: '1.0.0',
  appBuildVersion: '0.1.0',
  schemaVersion: '2026-04-15',
  createdAt: '2026-04-15T14:05:12Z',
  updatedAt: '2026-04-15T14:42:30Z',
  compatibility: {
    minReadableAppBuild: '0.1.0',
    maxTestedAppBuild: '0.1.x',
  },
  datasets: [
    {
      datasetId: 'ds_main',
      displayName: 'battery-cycles.csv',
      datasetContext: {
        description: 'Battery cycle benchmark used for local workspace validation.',
        measurementNotes: 'Capacity retention is measured as a percentage of original capacity.',
        sourceDescription: 'CSV import from local test fixtures.',
      },
      sourceKind: 'csv',
      fingerprint: 'sha256:dataset-main',
      rowCount: 48213,
      columnCount: 14,
      columns: [
        {
          columnId: 'cycleIndex',
          sourceName: 'Cycle',
          label: 'Cycle',
          dataType: 'integer',
          semanticRole: 'x',
          unit: null,
          measurementContext: {
            quantity: 'Cycle index',
            method: 'Imported integer sequence',
          },
          description: 'Battery cycle number.',
          status: 'confirmed',
        },
        {
          columnId: 'capacityRetention',
          sourceName: 'CapacityRetentionPct',
          label: 'Capacity Retention %',
          dataType: 'number',
          semanticRole: 'y',
          unit: '%',
          measurementContext: {
            quantity: 'Capacity retention',
            condition: 'After each cycle',
          },
          description: 'Remaining capacity percentage.',
          status: 'confirmed',
        },
        {
          columnId: 'temperatureBand',
          sourceName: 'TempBand',
          label: 'Temperature Band',
          dataType: 'string',
          semanticRole: 'color',
          unit: null,
          measurementContext: {
            quantity: 'Ambient temperature band',
          },
          description: 'Grouped operating temperature band.',
          status: 'confirmed',
        },
      ],
    },
  ],
  transformPipeline: [
    {
      transformId: 'tf_filter_high_quality',
      kind: 'filter',
      status: 'applied',
      order: 1,
      expression: "qualityFlag == 'PASS'",
      dependencyMetadata: {
        datasetId: 'ds_main',
        dependsOnColumnIds: ['capacityRetention'],
        producesColumnIds: [],
        upstreamTransformIds: [],
      },
    },
  ],
  formulaColumns: [
    {
      formulaId: 'fm_capacity_delta',
      columnId: 'capacityDelta',
      label: 'Capacity Delta',
      expression: 'capacityRetention - lag(capacityRetention)',
      status: 'valid',
      dependsOn: ['capacityRetention'],
    },
  ],
  graphDefinitions: [graphDefinitionFixture],
  activeGraphId: 'graph_capacity_fade',
  referenceGraphId: 'graph_capacity_fade',
  evidence: [
    {
      evidenceId: 'ev_001',
      graphId: 'graph_capacity_fade',
      note: 'Capacity loss accelerates above 45C.',
      provenanceRefs: ['prov_import_001', 'prov_fit_001'],
      status: 'review-ready',
    },
  ],
  issues: [],
  readiness: {
    status: 'warning',
    blockingIssueIds: [],
    warningIssueIds: ['issue_missing_reviewer_note'],
    provenanceCompleteness: 'partial',
  },
  telemetrySnapshot: {
    lastGraphRenderMs: 742,
    offlineQueueDepth: 3,
    status: 'queued',
  },
  exportSummary: {
    lastExportedAt: null,
    includedReferenceGraphId: 'graph_capacity_fade',
    manifestVersion: '1.0.0',
  },
} satisfies WorkspaceSnapshot;
