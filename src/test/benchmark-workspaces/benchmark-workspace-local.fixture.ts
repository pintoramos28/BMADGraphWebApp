import type { GraphDefinition, WorkspaceLedgerEntry, WorkspaceSnapshot } from '../../schemas/workspace';

import { graphDefinitionFixture } from '../fixtures/workspace/graph-definition.fixture';
import { workspaceLedgerFixture } from '../fixtures/workspace/workspace-ledger.fixture';
import { workspaceSnapshotFixture } from '../fixtures/workspace/workspace-snapshot.fixture';

const secondaryGraphFixture: GraphDefinition = {
  ...graphDefinitionFixture,
  graphId: 'graph_scatter_secondary',
  title: 'Scatter Investigation',
  status: 'candidate',
  evidenceIds: [],
  issueIds: [],
};

export const benchmarkWorkspaceLocalSnapshotFixture: WorkspaceSnapshot = {
  ...structuredClone(workspaceSnapshotFixture),
  graphDefinitions: [graphDefinitionFixture, secondaryGraphFixture],
  activeGraphId: 'graph_scatter_secondary',
  referenceGraphId: 'graph_capacity_fade',
  exportSummary: {
    ...workspaceSnapshotFixture.exportSummary,
    includedReferenceGraphId: 'graph_capacity_fade',
  },
};

export const benchmarkWorkspaceLocalLedgerFixture: WorkspaceLedgerEntry[] = [
  ...structuredClone(workspaceLedgerFixture),
  {
    ledgerEntryId: 'led_003',
    sequence: 19,
    occurredAt: '2026-04-15T14:18:09Z',
    type: 'graph.created',
    actor: {
      kind: 'user',
      id: 'local-user',
    },
    workspaceVersion: 19,
    entityRefs: {
      workspaceId: 'ws_2026_04_15_001',
      graphId: 'graph_scatter_secondary',
    },
    payload: {
      title: 'Scatter Investigation',
      datasetId: 'ds_main',
      marks: ['point'],
    },
    correlationId: 'cmd_2026_04_15_019',
  },
];
