import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { WorkspaceSnapshot } from '../../schemas/workspace';
import { createWorkspaceKernelStore } from '../../stores/workspace-kernel';
import { graphDefinitionFixture } from '../../test/fixtures/workspace/graph-definition.fixture';
import { workspaceLedgerFixture } from '../../test/fixtures/workspace/workspace-ledger.fixture';
import { workspaceSnapshotFixture } from '../../test/fixtures/workspace/workspace-snapshot.fixture';
import {
  WorkspaceSemanticsPanel,
  createConfirmedDatasetColumnSyncKey,
  handleSemanticPersistenceFailure,
  resolveRenderedColumnSemanticDraft,
  rollbackSemanticPersistenceFailure,
} from './WorkspaceSemanticsPanel';

describe('WorkspaceSemanticsPanel', () => {
  it('server-renders accessible semantic controls and graph-ready summary from canonical dataset state', () => {
    const store = createWorkspaceKernelStore({
      snapshot: workspaceSnapshotFixture,
      ledger: [],
    });

    const markup = renderToStaticMarkup(createElement(WorkspaceSemanticsPanel, {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      kernelStore: store,
    }));

    expect(markup).toContain('role="region"');
    expect(markup).toContain('Workspace semantics');
    expect(markup).toContain('Label for Capacity Retention %');
    expect(markup).toContain('Data type for Capacity Retention %');
    expect(markup).toContain('Semantic role for Capacity Retention %');
    expect(markup).toContain('Unit for Capacity Retention %');
    expect(markup).toContain('Measurement context for Capacity Retention %');
    expect(markup).toContain('Quantity for Capacity Retention %');
    expect(markup).toContain('Condition for Capacity Retention %');
    expect(markup).toContain('Graph-ready semantic summary');
    expect(markup).toContain('y: Capacity Retention % (%)');
  });

  it('uses the rendered fallback column draft before hydration seeds draft state', () => {
    const column = workspaceSnapshotFixture.datasets[0]!.columns.find((candidate) => candidate.columnId === 'capacityRetention')!;

    expect(resolveRenderedColumnSemanticDraft({}, column)).toMatchObject({
      label: 'Capacity Retention %',
      dataType: 'number',
      semanticRole: 'y',
      unit: '%',
      measurementContext: expect.objectContaining({
        quantity: 'Capacity retention',
        condition: 'After each cycle',
      }),
      description: 'Remaining capacity percentage.',
    });
    expect(resolveRenderedColumnSemanticDraft({
      capacityRetention: {
        label: 'Hydrated Draft',
        dataType: 'number',
        semanticRole: 'y',
        unit: 'percent',
        measurementContext: {
          quantity: 'Draft quantity',
          method: '',
          condition: '',
          notes: '',
        },
        description: '',
      },
    }, column)).toMatchObject({
      label: 'Hydrated Draft',
      unit: 'percent',
    });
  });

  it('does not render semantic editors for recovery placeholder datasets', () => {
    const snapshot: WorkspaceSnapshot = {
      ...structuredClone(workspaceSnapshotFixture),
      datasets: [
        {
          ...structuredClone(workspaceSnapshotFixture.datasets[0]!),
          sourceKind: 'recovery',
        },
      ],
    };
    const store = createWorkspaceKernelStore({
      snapshot,
      ledger: [],
    });

    const markup = renderToStaticMarkup(createElement(WorkspaceSemanticsPanel, {
      workspaceId: snapshot.workspaceId,
      kernelStore: store,
    }));

    expect(markup).toContain('Confirm an import before editing canonical dataset semantics.');
    expect(markup).not.toContain('Label for Capacity Retention %');
    expect(markup).not.toContain('Graph-ready semantic summary');
  });

  it('renders graph-ready missing semantic gaps with column names instead of raw ids', () => {
    const snapshot: WorkspaceSnapshot = structuredClone(workspaceSnapshotFixture);
    const dataset = snapshot.datasets[0]!;
    dataset.datasetContext = null;
    dataset.columns = dataset.columns.map((column) => (column.columnId === 'capacityRetention'
      ? {
          ...column,
          semanticRole: 'unassigned' as const,
          measurementContext: null,
        }
      : column));
    snapshot.issues = [{
      issueId: 'semantics.p7:ds_main.p17:capacityRetention.p15:missing-context',
      kind: 'semantics.column.missing-context',
      severity: 'warning' as const,
      status: 'open' as const,
      detectedAt: '2026-04-27T11:00:00Z',
      source: { module: 'workspace-kernel', entityType: 'dataset-column', entityId: 'capacityRetention' },
      title: 'Column measurement context is missing',
      detail: 'Column measurement context is missing.',
      userMessage: 'Add measurement context before graphing begins.',
      contextRef: { routeKey: 'workspaceDetail', workspaceId: snapshot.workspaceId, panel: 'semantics' },
      repairActions: [],
      diagnostics: { datasetId: 'ds_main', columnId: 'capacityRetention', field: 'measurementContext' },
    }];
    const store = createWorkspaceKernelStore({
      snapshot,
      ledger: [],
    });

    const markup = renderToStaticMarkup(createElement(WorkspaceSemanticsPanel, {
      workspaceId: snapshot.workspaceId,
      kernelStore: store,
    }));

    expect(markup).toContain('Missing roles: Capacity Retention %');
    expect(markup).toContain('Missing measurement context: Capacity Retention %');
    expect(markup).toContain('Open semantic gaps:');
    expect(markup).toContain('Capacity Retention %: Add measurement context before graphing begins.');
    expect(markup).not.toContain('Open semantic issue IDs');
    expect(markup).not.toContain('semantics.p7:ds_main.p17:capacityRetention.p15:missing-context');
  });

  it('rolls back a failed semantic save while preserving later kernel mutations', () => {
    const secondaryGraph = {
      ...structuredClone(graphDefinitionFixture),
      graphId: 'graph_semantic_intervening_mutation',
      title: 'Intervening graph mutation',
      status: 'candidate' as const,
      issueIds: [],
      evidenceIds: [],
    };
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        graphDefinitions: [
          ...structuredClone(workspaceSnapshotFixture.graphDefinitions),
          secondaryGraph,
        ],
      },
      ledger: structuredClone(workspaceLedgerFixture),
    });
    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'column' as const,
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      correlationId: 'cmd_semantics_failed_durable_save',
    };

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      label: 'Non-durable label',
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:08:00Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;

    store.getState().commands.promoteReferenceGraph({
      graphId: secondaryGraph.graphId,
      actorId: 'test-worker',
      actorKind: 'test',
      correlationId: 'cmd_intervening_kernel_mutation',
      occurredAt: '2026-04-22T15:08:01Z',
      reason: 'Mutation that lands before semantic persistence fails.',
    });

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    expect(store.getState().snapshot.datasets[0]?.columns.find((column) => column.columnId === target.columnId)).toMatchObject({
      label: 'Capacity Retention %',
    });
    expect(store.getState().snapshot.referenceGraphId).toBe(secondaryGraph.graphId);
    expect(store.getState().ledger.map((entry) => entry.correlationId)).toContain('cmd_intervening_kernel_mutation');
    expect(store.getState().ledger.map((entry) => entry.correlationId)).not.toContain(target.correlationId);
  });

  it('does not promote externally stale graphs during rebased semantic rollback regeneration', () => {
    const externallyStaleGraph = {
      ...structuredClone(graphDefinitionFixture),
      status: 'stale' as const,
      roleAssignments: {
        ...structuredClone(graphDefinitionFixture.roleAssignments),
        facetColumn: [],
      },
      issueIds: [],
      evidenceIds: [],
    };
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        graphDefinitions: [externallyStaleGraph],
        referenceGraphId: externallyStaleGraph.graphId,
        issues: [],
      },
      ledger: structuredClone(workspaceLedgerFixture),
    });
    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'column' as const,
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      correlationId: 'cmd_semantics_failed_external_stale_graph',
    };

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      label: 'Non-durable label',
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:08:10Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;

    store.getState().commands.updateDatasetContext({
      datasetId: target.datasetId,
      datasetContext: {
        description: 'Later durable dataset context.',
        measurementNotes: 'Later durable measurement notes.',
        sourceDescription: 'CSV import from local test fixtures.',
      },
      actorId: 'test-worker',
      correlationId: 'cmd_semantics_later_context_external_stale_graph',
      occurredAt: '2026-04-22T15:08:11Z',
    });

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    expect(store.getState().snapshot.graphDefinitions[0]).toMatchObject({
      status: 'stale',
      issueIds: [],
    });
    expect(store.getState().ledger.map((entry) => entry.correlationId)).toContain(
      'cmd_semantics_later_context_external_stale_graph',
    );
    expect(store.getState().ledger.map((entry) => entry.correlationId)).not.toContain(target.correlationId);
  });

  it('rebases failed semantic-save rollback without deleting later same-dataset graph semantic issues', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });
    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'column' as const,
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      correlationId: 'cmd_semantics_failed_target_only',
    };

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      label: 'Non-durable capacity label',
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:09:00Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;
    const laterGraphSemanticIssue = {
      issueId: 'semantics.p7:ds_main.p19:graph_capacity_fade.p13:graph-invalid',
      kind: 'semantics.graph.composition-invalid',
      severity: 'blocking' as const,
      status: 'open' as const,
      detectedAt: '2026-04-22T15:09:01Z',
      source: {
        module: 'workspace-kernel',
        entityType: 'graph',
        entityId: 'graph_capacity_fade',
      },
      title: 'Graph composition needs semantic review',
      detail: 'Temperature band has a later graph semantic conflict.',
      userMessage: 'A graph that uses this dataset no longer matches the active semantic choices.',
      contextRef: {
        routeKey: 'workspaceDetail' as const,
        workspaceId: workspaceSnapshotFixture.workspaceId,
        graphId: 'graph_capacity_fade',
        panel: 'semantics',
      },
      repairActions: [],
      diagnostics: {
        datasetId: 'ds_main',
        graphId: 'graph_capacity_fade',
        affectedColumnIds: ['temperatureBand'],
      },
    };

    store.getState().commands.replaceIssues([
      ...store.getState().snapshot.issues,
      laterGraphSemanticIssue,
    ]);

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    expect(store.getState().snapshot.datasets[0]?.columns.find((column) => column.columnId === target.columnId)).toMatchObject({
      label: 'Capacity Retention %',
    });
    expect(store.getState().snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: laterGraphSemanticIssue.issueId,
          kind: laterGraphSemanticIssue.kind,
          diagnostics: expect.objectContaining({
            affectedColumnIds: ['temperatureBand'],
          }),
        }),
      ]),
    );
    expect(store.getState().snapshot.readiness.blockingIssueIds).toContain(laterGraphSemanticIssue.issueId);
  });

  it('rebases failed semantic-save rollback without clobbering later same-column edits', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });
    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'column' as const,
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      correlationId: 'cmd_semantics_failed_same_column',
    };

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      label: 'Non-durable capacity label',
      unit: 'ratio',
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:09:10Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      label: 'Later valid capacity label',
      unit: 'percent-reviewed',
      actorId: 'test-worker',
      correlationId: 'cmd_semantics_later_same_column',
      occurredAt: '2026-04-22T15:09:11Z',
    });

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    expect(store.getState().snapshot.datasets[0]?.columns.find((column) => column.columnId === target.columnId)).toMatchObject({
      label: 'Later valid capacity label',
      unit: 'percent-reviewed',
    });
    expect(store.getState().ledger.map((entry) => entry.correlationId)).toContain('cmd_semantics_later_same_column');
    expect(store.getState().ledger.map((entry) => entry.correlationId)).not.toContain(target.correlationId);
  });

  it('rebases failed semantic-save rollback over later same-column edits that retain failed field values', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });
    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'column' as const,
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      correlationId: 'cmd_semantics_failed_same_column_retained_value',
    };

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      label: 'Non-durable capacity label',
      unit: 'ratio',
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:09:12Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      label: 'Non-durable capacity label',
      unit: 'percent-reviewed',
      actorId: 'test-worker',
      correlationId: 'cmd_semantics_later_same_column_retained_value',
      occurredAt: '2026-04-22T15:09:13Z',
    });

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    expect(store.getState().snapshot.datasets[0]?.columns.find((column) => column.columnId === target.columnId)).toMatchObject({
      label: 'Non-durable capacity label',
      unit: 'percent-reviewed',
    });
    expect(store.getState().ledger.map((entry) => entry.correlationId)).toContain('cmd_semantics_later_same_column_retained_value');
    expect(store.getState().ledger.map((entry) => entry.correlationId)).not.toContain(target.correlationId);
  });

  it('rolls back unrelated failed fields when a later same-column command is partial', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });
    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'column' as const,
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      correlationId: 'cmd_semantics_failed_same_column_partial_rebase',
    };

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      label: 'Non-durable capacity label',
      unit: 'ratio',
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:09:13Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      unit: 'percent-reviewed',
      actorId: 'test-worker',
      correlationId: 'cmd_semantics_later_same_column_partial_unit',
      occurredAt: '2026-04-22T15:09:14Z',
    });

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    expect(store.getState().snapshot.datasets[0]?.columns.find((column) => column.columnId === target.columnId)).toMatchObject({
      label: 'Capacity Retention %',
      unit: 'percent-reviewed',
    });
    expect(store.getState().ledger.map((entry) => entry.correlationId)).toContain('cmd_semantics_later_same_column_partial_unit');
    expect(store.getState().ledger.map((entry) => entry.correlationId)).not.toContain(target.correlationId);
  });

  it('does not run replaceSnapshot rollback when semantic ownership is rejected before mutation', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });
    const previousState = store.getState();

    store.getState().commands.queueWorkerRequest({
      type: 'import.preview.parsed',
      correlationId: 'worker_request_survives_rejected_semantic_owner',
    });

    const rollbackApplied = handleSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot: previousState.selectors.persistedWorkspace(),
      previousLedger: structuredClone(previousState.ledger),
      previousDatasetFileHandles: previousState.selectors.datasetFileHandles(),
      expectedWorkspaceVersion: previousState.workspaceVersion + 1,
      target: {
        kind: 'column' as const,
        datasetId: 'ds_main',
        columnId: 'capacityRetention',
        correlationId: 'cmd_semantics_rejected_before_mutation',
      },
      semanticMutationApplied: false,
    });

    expect(rollbackApplied).toBe(false);
    expect(store.getState().pendingWorkerRequests).toHaveProperty('worker_request_survives_rejected_semantic_owner');
    expect(store.getState().ledger).toEqual(previousState.ledger);
  });

  it('preserves later deliberate same-column reapplication of failed values during rollback', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });
    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'column' as const,
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      correlationId: 'cmd_semantics_failed_same_column_reapplied_value',
    };

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      label: 'Non-durable capacity label',
      unit: 'ratio',
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:09:14Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      label: 'Temporary valid capacity label',
      unit: 'percent-reviewed',
      actorId: 'test-worker',
      correlationId: 'cmd_semantics_later_same_column_away_from_failed_value',
      occurredAt: '2026-04-22T15:09:15Z',
    });
    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      label: 'Non-durable capacity label',
      unit: 'percent-reviewed',
      actorId: 'test-worker',
      correlationId: 'cmd_semantics_later_same_column_reapplied_failed_value',
      occurredAt: '2026-04-22T15:09:16Z',
    });

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    expect(store.getState().snapshot.datasets[0]?.columns.find((column) => column.columnId === target.columnId)).toMatchObject({
      label: 'Non-durable capacity label',
      unit: 'percent-reviewed',
    });
    expect(store.getState().ledger.map((entry) => entry.correlationId)).toEqual(
      expect.arrayContaining([
        'cmd_semantics_later_same_column_away_from_failed_value',
        'cmd_semantics_later_same_column_reapplied_failed_value',
      ]),
    );
    expect(store.getState().ledger.map((entry) => entry.correlationId)).not.toContain(target.correlationId);
  });

  it('rebases failed dataset-context rollback over later context mutations', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });
    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'dataset-context' as const,
      datasetId: 'ds_main',
      correlationId: 'cmd_semantics_failed_dataset_context',
    };

    store.getState().commands.updateDatasetContext({
      datasetId: target.datasetId,
      datasetContext: {
        description: 'Non-durable context description',
        measurementNotes: 'Capacity retention is measured as a percentage of original capacity.',
        sourceDescription: 'CSV import from local test fixtures.',
      },
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:12:00Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;

    store.getState().commands.updateDatasetContext({
      datasetId: target.datasetId,
      datasetContext: {
        description: 'Non-durable context description',
        measurementNotes: 'Later durable measurement notes',
        sourceDescription: 'CSV import from local test fixtures.',
      },
      actorId: 'test-worker',
      correlationId: 'cmd_semantics_later_dataset_context',
      occurredAt: '2026-04-22T15:12:01Z',
    });

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    expect(store.getState().snapshot.datasets[0]?.datasetContext).toEqual({
      description: 'Battery cycle benchmark used for local workspace validation.',
      measurementNotes: 'Later durable measurement notes',
      sourceDescription: 'CSV import from local test fixtures.',
    });
    expect(store.getState().ledger.map((entry) => entry.correlationId)).toContain('cmd_semantics_later_dataset_context');
    expect(store.getState().ledger.map((entry) => entry.correlationId)).not.toContain(target.correlationId);
  });

  it('restores cleared dataset-context fields during rebased persistence rollback', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });
    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'dataset-context' as const,
      datasetId: 'ds_main',
      correlationId: 'cmd_semantics_failed_dataset_context_clear_field',
    };

    store.getState().commands.updateDatasetContext({
      datasetId: target.datasetId,
      datasetContext: {
        measurementNotes: 'Capacity retention is measured as a percentage of original capacity.',
        sourceDescription: 'CSV import from local test fixtures.',
      },
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:12:02Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;

    store.getState().commands.replaceIssues(store.getState().snapshot.issues, {
      actorId: 'test-worker',
      actorKind: 'test',
      correlationId: 'cmd_semantics_later_unrelated_mutation_after_clear',
      occurredAt: '2026-04-22T15:12:03Z',
    });

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    expect(store.getState().snapshot.datasets[0]?.datasetContext).toEqual({
      description: 'Battery cycle benchmark used for local workspace validation.',
      measurementNotes: 'Capacity retention is measured as a percentage of original capacity.',
      sourceDescription: 'CSV import from local test fixtures.',
    });
    expect(store.getState().ledger.map((entry) => entry.correlationId)).toContain('cmd_semantics_later_unrelated_mutation_after_clear');
    expect(store.getState().ledger.map((entry) => entry.correlationId)).not.toContain(target.correlationId);
  });

  it('preserves later deliberate dataset-context clears during failed-save rollback', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });
    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'dataset-context' as const,
      datasetId: 'ds_main',
      correlationId: 'cmd_semantics_failed_dataset_context_deliberate_clear',
    };

    store.getState().commands.updateDatasetContext({
      datasetId: target.datasetId,
      datasetContext: {
        measurementNotes: 'Non-durable measurement notes after clearing description.',
        sourceDescription: 'CSV import from local test fixtures.',
      },
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:12:04Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;

    store.getState().commands.updateDatasetContext({
      datasetId: target.datasetId,
      datasetContext: {
        measurementNotes: 'Later durable measurement notes with description intentionally blank.',
        sourceDescription: 'CSV import from local test fixtures.',
      },
      actorId: 'test-worker',
      correlationId: 'cmd_semantics_later_dataset_context_retained_clear',
      occurredAt: '2026-04-22T15:12:05Z',
    });

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    expect(store.getState().snapshot.datasets[0]?.datasetContext).toEqual({
      measurementNotes: 'Later durable measurement notes with description intentionally blank.',
      sourceDescription: 'CSV import from local test fixtures.',
    });
    expect(store.getState().ledger.map((entry) => entry.correlationId)).toContain('cmd_semantics_later_dataset_context_retained_clear');
    expect(store.getState().ledger.map((entry) => entry.correlationId)).not.toContain(target.correlationId);
  });

  it('preserves later all-blank dataset-context clears during failed-save rollback', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });
    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'dataset-context' as const,
      datasetId: 'ds_main',
      correlationId: 'cmd_semantics_failed_dataset_context_all_blank_clear',
    };

    store.getState().commands.updateDatasetContext({
      datasetId: target.datasetId,
      datasetContext: null,
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:12:06Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;

    store.getState().commands.updateDatasetContext({
      datasetId: target.datasetId,
      datasetContext: null,
      actorId: 'test-worker',
      correlationId: 'cmd_semantics_later_dataset_context_all_blank_clear',
      occurredAt: '2026-04-22T15:12:07Z',
    });

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    const missingDatasetContextIssueId = 'semantics.p7:ds_main.p23:missing-dataset-context';

    expect(store.getState().snapshot.datasets[0]?.datasetContext).toBeNull();
    expect(store.getState().snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: missingDatasetContextIssueId,
          kind: 'semantics.dataset.missing-context',
          severity: 'warning',
        }),
      ]),
    );
    expect(store.getState().snapshot.readiness.warningIssueIds).toContain(missingDatasetContextIssueId);
    expect(store.getState().ledger.map((entry) => entry.correlationId)).toContain('cmd_semantics_later_dataset_context_all_blank_clear');
    expect(store.getState().ledger.map((entry) => entry.correlationId)).not.toContain(target.correlationId);
  });

  it('keeps column draft synchronization stable when only dataset context changes', () => {
    const dataset = workspaceSnapshotFixture.datasets[0]!;
    const nextDatasetContextOnly = {
      ...structuredClone(dataset),
      datasetContext: {
        description: 'Updated context without committed column changes.',
      },
    } satisfies WorkspaceSnapshot['datasets'][number];

    expect(createConfirmedDatasetColumnSyncKey(nextDatasetContextOnly)).toBe(
      createConfirmedDatasetColumnSyncKey(dataset),
    );
  });

  it('regenerates rebased column semantic issues instead of restoring stale prior issues', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });

    store.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      semanticRole: 'unassigned',
      actorId: 'test-worker',
      correlationId: 'cmd_semantics_setup_missing_role',
      occurredAt: '2026-04-22T15:12:04Z',
    });

    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'column' as const,
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      correlationId: 'cmd_semantics_failed_column_issue_regeneration',
    };

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      semanticRole: 'x',
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:12:05Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      semanticRole: 'y',
      actorId: 'test-worker',
      correlationId: 'cmd_semantics_later_valid_role',
      occurredAt: '2026-04-22T15:12:06Z',
    });

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    const targetColumn = store.getState().snapshot.datasets[0]?.columns.find((column) => column.columnId === target.columnId);
    const staleMissingRoleIssueId = 'semantics.p7:ds_main.p17:capacityRetention.p12:missing-role';

    expect(targetColumn?.semanticRole).toBe('y');
    expect(store.getState().snapshot.issues.map((issue) => issue.issueId)).not.toContain(staleMissingRoleIssueId);
    expect(store.getState().snapshot.readiness.warningIssueIds).not.toContain(staleMissingRoleIssueId);
    expect(store.getState().ledger.map((entry) => entry.correlationId)).toContain('cmd_semantics_later_valid_role');
    expect(store.getState().ledger.map((entry) => entry.correlationId)).not.toContain(target.correlationId);
  });

  it('skips restoring semantic rollback issues when the target dataset no longer exists', () => {
    const sourceDataset = workspaceSnapshotFixture.datasets[0]!;
    const fallbackDataset: WorkspaceSnapshot['datasets'][number] = {
      ...structuredClone(sourceDataset),
      datasetId: 'ds_fallback',
      displayName: 'Fallback workspace dataset',
      datasetContext: structuredClone(sourceDataset.datasetContext),
      columns: sourceDataset.columns.map((column) => ({
        ...structuredClone(column),
        columnId: `fallback_${column.columnId}`,
      })),
    };
    const fallbackGraph = {
      ...structuredClone(graphDefinitionFixture),
      graphId: 'graph_fallback',
      datasetId: 'ds_fallback',
      roleAssignments: {
        x: [],
        y: [],
        color: [],
        size: [],
        facetRow: [],
        facetColumn: [],
      },
      issueIds: [],
    };
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });

    store.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      semanticRole: 'unassigned',
      actorId: 'test-worker',
      correlationId: 'cmd_semantics_setup_removed_dataset_issue',
      occurredAt: '2026-04-22T15:12:07Z',
    });

    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'column' as const,
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      correlationId: 'cmd_semantics_failed_removed_dataset',
    };

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      label: 'Non-durable removed dataset label',
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:12:08Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;

    store.getState().commands.rollbackConfirmedImport({
      datasetId: target.datasetId,
      graphId: 'graph_capacity_fade',
      issueIds: store.getState().snapshot.issues.map((issue) => issue.issueId),
      previousActiveGraphId: fallbackGraph.graphId,
      previousReferenceGraphId: fallbackGraph.graphId,
      fallbackDatasets: [fallbackDataset],
      fallbackGraphDefinitions: [fallbackGraph],
      actorId: 'test-worker',
      actorKind: 'test',
      correlationId: 'cmd_confirm_import_rollback_removed_dataset',
      occurredAt: '2026-04-22T15:12:09Z',
    });

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    const issueDatasetIds = store.getState().snapshot.issues.map((issue) => (issue.diagnostics as { datasetId?: unknown }).datasetId);

    expect(store.getState().snapshot.datasets.map((dataset) => dataset.datasetId)).not.toContain(target.datasetId);
    expect(issueDatasetIds).not.toContain(target.datasetId);
    expect([
      ...store.getState().snapshot.readiness.blockingIssueIds,
      ...store.getState().snapshot.readiness.warningIssueIds,
    ]).not.toContain('semantics.p7:ds_main.p17:capacityRetention.p12:missing-role');
    expect(store.getState().ledger.map((entry) => entry.correlationId)).toContain('cmd_confirm_import_rollback_removed_dataset');
    expect(store.getState().ledger.map((entry) => entry.correlationId)).not.toContain(target.correlationId);
  });

  it('preserves newer same-graph semantic repair state during rollback regeneration', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });

    store.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      semanticRole: 'unassigned',
      actorId: 'test-worker',
      correlationId: 'cmd_semantics_setup_graph_issue_state',
      occurredAt: '2026-04-22T15:12:10Z',
    });

    const graphIssueId = 'semantics.p7:ds_main.p19:graph_capacity_fade.p13:graph-invalid';
    store.getState().commands.replaceIssues(store.getState().snapshot.issues.map((issue) => issue.issueId === graphIssueId
      ? {
          ...issue,
          status: 'open' as const,
          detectedAt: '2026-04-22T15:12:10Z',
        }
      : issue), {
      actorId: 'test-worker',
      actorKind: 'test',
      correlationId: 'cmd_semantics_setup_old_graph_issue_state',
      occurredAt: '2026-04-22T15:12:11Z',
    });

    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'column' as const,
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      correlationId: 'cmd_semantics_failed_same_graph_repair_state',
    };

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      unit: 'non-durable-unit',
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:12:12Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;

    store.getState().commands.replaceIssues(store.getState().snapshot.issues.map((issue) => issue.issueId === graphIssueId
      ? {
          ...issue,
          status: 'deferred' as const,
          detectedAt: '2026-04-22T15:12:13Z',
        }
      : issue), {
      actorId: 'test-worker',
      actorKind: 'test',
      correlationId: 'cmd_semantics_later_newer_graph_issue_state',
      occurredAt: '2026-04-22T15:12:13Z',
    });

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    expect(store.getState().snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: graphIssueId,
          kind: 'semantics.graph.composition-invalid',
          status: 'deferred',
          detectedAt: '2026-04-22T15:12:13Z',
        }),
      ]),
    );
    expect(store.getState().ledger.map((entry) => entry.correlationId)).toContain('cmd_semantics_later_newer_graph_issue_state');
    expect(store.getState().ledger.map((entry) => entry.correlationId)).not.toContain(target.correlationId);
  });

  it('preserves newer same-graph semantic conflicts during failed-save rollback', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });
    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'column' as const,
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      correlationId: 'cmd_semantics_failed_same_graph_merge',
    };

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      semanticRole: 'unassigned',
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:09:00Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: 'temperatureBand',
      semanticRole: 'x',
      actorId: 'test-worker',
      correlationId: 'cmd_semantics_later_same_graph_conflict',
      occurredAt: '2026-04-22T15:09:01Z',
    });

    expect(store.getState().snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'semantics.graph.composition-invalid',
          diagnostics: expect.objectContaining({
            affectedColumnIds: expect.arrayContaining(['capacityRetention', 'temperatureBand']),
          }),
        }),
      ]),
    );

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    const graphIssue = store.getState().snapshot.issues.find(
      (issue) => issue.kind === 'semantics.graph.composition-invalid',
    );

    expect(graphIssue).toMatchObject({
      issueId: 'semantics.p7:ds_main.p19:graph_capacity_fade.p13:graph-invalid',
      diagnostics: expect.objectContaining({
        affectedColumnIds: ['temperatureBand'],
      }),
      detail: expect.stringContaining('Temperature Band'),
    });
    expect(graphIssue?.detail).not.toContain('Capacity Retention');
    expect(store.getState().snapshot.readiness.blockingIssueIds).toContain(graphIssue?.issueId);
  });

  it('preserves rollback-regenerated graph semantic issue state only when diagnostics still match', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });
    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'column' as const,
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      correlationId: 'cmd_semantics_failed_graph_diagnostic_change',
    };

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      semanticRole: 'unassigned',
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:13:00Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: 'temperatureBand',
      semanticRole: 'x',
      actorId: 'test-worker',
      correlationId: 'cmd_semantics_later_graph_diagnostic_change',
      occurredAt: '2026-04-22T15:13:01Z',
    });

    const graphIssueId = 'semantics.p7:ds_main.p19:graph_capacity_fade.p13:graph-invalid';
    store.getState().commands.replaceIssues(store.getState().snapshot.issues.map((issue) => issue.issueId === graphIssueId
      ? {
          ...issue,
          status: 'deferred' as const,
          detectedAt: '2026-04-22T15:00:00Z',
          diagnostics: {
            ...issue.diagnostics,
            blockedReasons: ['Old mixed graph semantic diagnostics.'],
            affectedColumnIds: ['capacityRetention', 'temperatureBand'],
          },
        }
      : issue));

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    expect(store.getState().snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: graphIssueId,
          kind: 'semantics.graph.composition-invalid',
          status: 'open',
          detectedAt: expect.not.stringMatching('2026-04-22T15:00:00Z'),
          diagnostics: expect.objectContaining({
            affectedColumnIds: ['temperatureBand'],
          }),
        }),
      ]),
    );
  });

  it('preserves version-neutral file-handle refreshes during exact-version semantic rollback', () => {
    const originalHandle = {
      name: 'battery-cycles.csv',
      async getFile() {
        return { name: 'battery-cycles.csv' } as File;
      },
      async createWritable() {
        return { async write() {}, async close() {} };
      },
    };
    const refreshedHandle = {
      name: 'battery-cycles-refresh.csv',
      async getFile() {
        return { name: 'battery-cycles-refresh.csv' } as File;
      },
      async createWritable() {
        return { async write() {}, async close() {} };
      },
    };
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: workspaceSnapshotFixture.datasets.map((dataset) => ({
          ...structuredClone(dataset),
          sourceFile: {
            fileName: 'battery-cycles.csv',
            fileHandleToken: 'dataset.ds_main.source-file',
          },
        })),
      },
      ledger: structuredClone(workspaceLedgerFixture),
      datasetFileHandles: [{
        datasetId: 'ds_main',
        fileName: 'battery-cycles.csv',
        fileHandleToken: 'dataset.ds_main.source-file',
        handle: originalHandle,
      }],
    });
    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'column' as const,
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      correlationId: 'cmd_semantics_failed_with_handle_refresh',
    };

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      label: 'Non-durable capacity label',
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:10:00Z',
    });
    const expectedSemanticMutationVersion = previousState.workspaceVersion + 1;

    store.getState().commands.replaceDatasetFileHandles([{
      datasetId: 'ds_main',
      fileName: 'battery-cycles-refresh.csv',
      fileHandleToken: 'dataset.ds_main.source-file',
      handle: refreshedHandle,
    }]);

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: expectedSemanticMutationVersion,
      target,
    });

    expect(store.getState().selectors.datasetFileHandles()).toEqual([
      expect.objectContaining({
        fileName: 'battery-cycles-refresh.csv',
        handle: refreshedHandle,
      }),
    ]);
    expect(store.getState().snapshot.datasets[0]?.sourceFile).toEqual({
      fileName: 'battery-cycles-refresh.csv',
      fileHandleToken: 'dataset.ds_main.source-file',
    });
  });

  it('preserves handleless source-file provenance during exact-version semantic rollback', () => {
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: workspaceSnapshotFixture.datasets.map((dataset) => ({
          ...structuredClone(dataset),
          sourceFile: {
            fileName: 'battery-cycles.csv',
            fileHandleToken: 'dataset.ds_main.source-file',
          },
        })),
      },
      ledger: structuredClone(workspaceLedgerFixture),
      datasetFileHandles: [],
    });
    const previousState = store.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const target = {
      kind: 'column' as const,
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      correlationId: 'cmd_semantics_failed_handleless_source',
    };

    store.getState().commands.updateColumnSemantics({
      datasetId: target.datasetId,
      columnId: target.columnId,
      label: 'Non-durable capacity label',
      actorId: 'workspace-semantics-panel',
      correlationId: target.correlationId,
      occurredAt: '2026-04-22T15:11:00Z',
    });

    rollbackSemanticPersistenceFailure({
      kernelStore: store,
      previousSnapshot,
      previousLedger,
      previousDatasetFileHandles,
      expectedWorkspaceVersion: previousState.workspaceVersion + 1,
      target,
    });

    expect(store.getState().selectors.datasetFileHandles()).toEqual([]);
    expect(store.getState().snapshot.datasets[0]?.sourceFile).toEqual({
      fileName: 'battery-cycles.csv',
      fileHandleToken: 'dataset.ds_main.source-file',
    });
  });
});
