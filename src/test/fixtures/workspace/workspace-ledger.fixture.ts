import type { WorkspaceLedgerEntry } from '../../../schemas/workspace';

export const workspaceLedgerFixture = [
  {
    ledgerEntryId: 'led_001',
    sequence: 17,
    occurredAt: '2026-04-15T14:12:02Z',
    type: 'graph.created',
    actor: {
      kind: 'user',
      id: 'local-user',
    },
    workspaceVersion: 17,
    entityRefs: {
      workspaceId: 'ws_2026_04_15_001',
      graphId: 'graph_capacity_fade',
    },
    payload: {
      title: 'Capacity Fade vs Cycle',
      datasetId: 'ds_main',
      marks: ['point', 'line'],
    },
    correlationId: 'cmd_2026_04_15_017',
  },
  {
    ledgerEntryId: 'led_002',
    sequence: 18,
    occurredAt: '2026-04-15T14:14:41Z',
    type: 'graph.promoted',
    actor: {
      kind: 'user',
      id: 'local-user',
    },
    workspaceVersion: 18,
    entityRefs: {
      workspaceId: 'ws_2026_04_15_001',
      graphId: 'graph_capacity_fade',
      previousReferenceGraphId: 'graph_scatter_exploratory',
    },
    payload: {
      reason: 'Selected for review after linear fit validation.',
    },
    trustImpact: {
      readinessBefore: 'warning',
      readinessAfter: 'warning',
    },
    correlationId: 'cmd_2026_04_15_018',
  },
] satisfies WorkspaceLedgerEntry[];
