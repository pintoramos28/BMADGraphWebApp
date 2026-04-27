import { describe, expect, it } from 'vitest';

import { workspaceSnapshotFixture } from '../../test/fixtures/workspace/workspace-snapshot.fixture';
import {
  createColumnSemanticDraft,
  createDatasetContextDraft,
  createSemanticSummary,
  parseMeasurementContext,
  toDatasetContext,
  validateColumnSemanticDraft,
} from './semantic-model';

describe('semantic model helpers', () => {
  it('creates editable drafts without mutating canonical provenance', () => {
    const dataset = workspaceSnapshotFixture.datasets[0]!;
    const column = dataset.columns[1]!;
    const draft = createColumnSemanticDraft(column);

    expect(draft).toMatchObject({
      label: 'Capacity Retention %',
      dataType: 'number',
      semanticRole: 'y',
      unit: '%',
    });
    expect(column.sourceName).toBe('CapacityRetentionPct');
  });

  it('validates committed column semantics before reducers receive them', () => {
    expect(validateColumnSemanticDraft({
      label: '',
      dataType: 'number',
      semanticRole: 'x',
      unit: '',
      measurementContext: { quantity: '', method: '', condition: '', notes: '' },
      description: '',
    })).toEqual(['Label is required before semantic edits can be committed.']);
  });

  it('normalizes dataset and measurement context drafts for canonical persistence', () => {
    expect(parseMeasurementContext({ quantity: '', method: '', condition: '', notes: '' })).toBeNull();
    expect(parseMeasurementContext({
      quantity: 'Capacity',
      method: 'Coulomb counting',
      condition: '',
      notes: 'Measured at ambient pressure',
    })).toEqual({
      quantity: 'Capacity',
      method: 'Coulomb counting',
      notes: 'Measured at ambient pressure',
    });
    expect(toDatasetContext({ description: '', measurementNotes: '', sourceDescription: '' })).toBeNull();
    expect(toDatasetContext({ description: 'Lab results', measurementNotes: '', sourceDescription: 'Local CSV' })).toEqual({
      description: 'Lab results',
      sourceDescription: 'Local CSV',
    });
    expect(createDatasetContextDraft(workspaceSnapshotFixture.datasets[0]!)).toMatchObject({
      description: 'Battery cycle benchmark used for local workspace validation.',
    });
  });

  it('summarizes active semantic choices and graph-readiness gaps', () => {
    const dataset = {
      ...workspaceSnapshotFixture.datasets[0]!,
      datasetContext: null,
      columns: [
        workspaceSnapshotFixture.datasets[0]!.columns[0]!,
        {
          ...workspaceSnapshotFixture.datasets[0]!.columns[1]!,
          semanticRole: 'unassigned' as const,
          measurementContext: null,
        },
      ],
    };

    const summary = createSemanticSummary(dataset, []);

    expect(summary).toMatchObject({
      datasetId: 'ds_main',
      datasetTitle: 'battery-cycles.csv',
      assignedRoles: ['x: Cycle'],
      missingRoleColumnIds: ['capacityRetention'],
      missingRoleColumnNames: ['Capacity Retention %'],
      missingContextColumnIds: ['capacityRetention'],
      missingContextColumnNames: ['Capacity Retention %'],
      datasetContextMissing: true,
    });
  });

  it('filters graph-ready issue ids to unresolved semantic issues for the dataset', () => {
    const dataset = workspaceSnapshotFixture.datasets[0]!;
    const summary = createSemanticSummary(dataset, [
      {
        issueId: 'semantics.ds_main.capacityRetention.missing-context',
        kind: 'semantics.column.missing-context',
        severity: 'warning',
        status: 'open',
        detectedAt: '2026-04-22T15:00:00Z',
        source: { module: 'workspace-kernel', entityType: 'dataset-column', entityId: 'capacityRetention' },
        title: 'Missing context',
        detail: 'Missing context',
        userMessage: 'Missing context',
        contextRef: { routeKey: 'workspaceDetail', workspaceId: workspaceSnapshotFixture.workspaceId, panel: 'semantics' },
        repairActions: [],
        diagnostics: { datasetId: 'ds_main', columnId: 'capacityRetention' },
      },
      {
        issueId: 'workspace.reopen.010',
        kind: 'workspace.reopen.dataset.missing-file-handle',
        severity: 'warning',
        status: 'open',
        detectedAt: '2026-04-22T15:00:00Z',
        source: { module: 'workspace-persistence', entityType: 'dataset', entityId: 'ds_main' },
        title: 'Missing handle',
        detail: 'Missing handle',
        userMessage: 'Missing handle',
        contextRef: { routeKey: 'workspaceDetail', workspaceId: workspaceSnapshotFixture.workspaceId, panel: 'repair' },
        repairActions: [],
        diagnostics: { datasetId: 'ds_main' },
      },
    ]);

    expect(summary?.issueIds).toEqual(['semantics.ds_main.capacityRetention.missing-context']);
    expect(summary?.issueSummaries).toEqual(['Capacity Retention %: Missing context']);
  });
});
