import { describe, expect, it } from 'vitest';

import { reopenWorkspaceKernel, saveWorkspaceKernel, type WorkspaceCompatibilityEnvelope } from '../../src/features/workspace-persistence';
import { InMemoryWorkspaceStorage, createWorkspaceRepository } from '../../src/services/persistence';
import { createWorkspaceKernelStore } from '../../src/stores/workspace-kernel';
import {
  benchmarkWorkspaceLocalLedgerFixture,
  benchmarkWorkspaceLocalSnapshotFixture,
} from '../../src/test/benchmark-workspaces/benchmark-workspace-local.fixture';

const compatibilityEnvelope: WorkspaceCompatibilityEnvelope = {
  currentAppBuildVersion: '0.1.0',
  minimumReadableWorkspaceFormat: '1.0.0',
  maximumReadableWorkspaceFormat: '1.x',
  migrationPolicy: 'migrate-on-open',
};

function createSourceFile(name: string, contents: string, lastModified: number) {
  return new File([contents], name, {
    lastModified,
  });
}

describe('workspace reopen integration', () => {
  it('round-trips a saved workspace and hydrates WorkspaceKernel without collapsing graph identity', async () => {
    const repository = createWorkspaceRepository(new InMemoryWorkspaceStorage());
    const kernelStore = createWorkspaceKernelStore({
      snapshot: benchmarkWorkspaceLocalSnapshotFixture,
      ledger: benchmarkWorkspaceLocalLedgerFixture,
    });

    await saveWorkspaceKernel({
      repository,
      kernelStore,
      savedAt: '2026-04-16T18:40:00Z',
      benchmarkKey: 'benchmark_workspace_local',
    });

    const reopened = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:40:03Z',
      nowMs: (() => {
        const samples = [1000, 1380];
        return () => samples.shift() ?? 1380;
      })(),
    });

    expect(reopened.kernelStore.getState().selectors.activeGraphId()).toBe('graph_scatter_secondary');
    expect(reopened.kernelStore.getState().selectors.referenceGraphId()).toBe('graph_capacity_fade');
    expect(reopened.kernelStore.getState().snapshot.datasets).toEqual(
      benchmarkWorkspaceLocalSnapshotFixture.datasets,
    );
    expect(reopened.kernelStore.getState().snapshot.formulaColumns).toEqual(
      benchmarkWorkspaceLocalSnapshotFixture.formulaColumns,
    );
    expect(reopened.report.benchmark).toMatchObject({
      durationMs: 380,
      migrationApplied: false,
      issueCount: 0,
      benchmarkKey: 'benchmark_workspace_local',
    });
  });

  it('reopens legacy binned-bar histograms through the workspace kernel flow', async () => {
    const repository = createWorkspaceRepository(
      new InMemoryWorkspaceStorage([
        {
          workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
          savedAt: '2026-04-16T18:40:10Z',
          snapshot: {
            ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
            graphDefinitions: [
              ...benchmarkWorkspaceLocalSnapshotFixture.graphDefinitions.map((graph) => ({
                ...structuredClone(graph),
                issueIds: [],
                evidenceIds: [],
              })),
              {
                graphId: 'graph_legacy_histogram',
                title: 'Legacy Histogram',
                status: 'candidate',
                datasetId: 'ds_main',
                roleAssignments: {
                  x: ['capacityRetention'],
                  y: [],
                  color: [],
                  size: [],
                  facetRow: [],
                  facetColumn: [],
                },
                marks: ['binned-bar'],
                overlays: [
                  {
                    overlayId: 'ov_reference_line_histogram',
                    kind: 'reference',
                    method: 'line',
                    status: 'ready',
                  },
                ],
                presentation: {
                  xAxisLabel: 'Capacity Retention (%)',
                  yAxisLabel: 'Count',
                  legendPosition: 'right',
                },
                issueIds: [],
                evidenceIds: [],
              },
            ],
            activeGraphId: 'graph_legacy_histogram',
            referenceGraphId: 'graph_capacity_fade',
          },
          ledger: structuredClone(benchmarkWorkspaceLocalLedgerFixture),
        },
      ]),
    );

    const reopened = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:40:13Z',
      nowMs: (() => {
        const samples = [1410, 1685];
        return () => samples.shift() ?? 1685;
      })(),
    });

    expect(reopened.kernelStore.getState().selectors.activeGraphId()).toBe('graph_legacy_histogram');
    expect(reopened.kernelStore.getState().snapshot.graphDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          graphId: 'graph_legacy_histogram',
          family: 'histogram',
          templateId: 'tpl_histogram_distribution',
          overlays: [
            expect.objectContaining({
              overlayId: 'ov_reference_line_histogram',
              catalogOverlayId: 'reference_line',
            }),
          ],
        }),
      ]),
    );
    expect(reopened.report.localizedIssues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.graph.incompatible-composition',
          source: expect.objectContaining({
            entityType: 'graph',
            entityId: 'graph_legacy_histogram',
          }),
        }),
      ]),
    );
  });

  it('keeps incompatible saved graphs available as stale repair scopes after kernel reopen', async () => {
    const repository = createWorkspaceRepository(
      new InMemoryWorkspaceStorage([
        {
          workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
          savedAt: '2026-04-16T18:40:20Z',
          snapshot: {
            ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
            graphDefinitions: [
              {
                ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture.graphDefinitions[0]),
                issueIds: [],
                evidenceIds: [],
              },
              {
                ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture.graphDefinitions[1]),
                graphId: 'graph_bar_regression',
                title: 'Bar With Regression',
                marks: ['bar'],
                family: 'bar',
                templateId: 'tpl_bar_grouped_compare',
                roleAssignments: {
                  x: ['temperatureBand'],
                  y: ['capacityRetention'],
                  color: [],
                  size: [],
                  facetRow: [],
                  facetColumn: [],
                },
                overlays: [
                  {
                    overlayId: 'ov_linear_fit_bar',
                    kind: 'regression',
                    method: 'linear',
                    status: 'ready',
                    catalogOverlayId: 'regression_linear',
                  },
                ],
                issueIds: [],
                evidenceIds: [],
              },
            ],
            activeGraphId: 'graph_bar_regression',
            referenceGraphId: 'graph_capacity_fade',
          },
          ledger: structuredClone(benchmarkWorkspaceLocalLedgerFixture),
        },
      ]),
    );

    const reopened = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:40:24Z',
      nowMs: (() => {
        const samples = [1700, 1960];
        return () => samples.shift() ?? 1960;
      })(),
    });

    expect(reopened.kernelStore.getState().selectors.activeGraphId()).toBe('graph_capacity_fade');
    expect(reopened.kernelStore.getState().snapshot.graphDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          graphId: 'graph_bar_regression',
          status: 'stale',
        }),
      ]),
    );
    expect(reopened.kernelStore.getState().selectors.repairEntryPoints()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.graph.incompatible-composition',
          entityId: 'graph_bar_regression',
          graphId: 'graph_bar_regression',
          repairActions: expect.arrayContaining([
            expect.objectContaining({
              command: 'repair.focusGraph',
              args: expect.objectContaining({
                graphId: 'graph_bar_regression',
              }),
            }),
          ]),
        }),
      ]),
    );
  });

  it('saves and reopens dataset file handles through the default in-memory storage path', async () => {
    const repository = createWorkspaceRepository(new InMemoryWorkspaceStorage());
    const handle = {
      name: 'battery-cycles.csv',
      async getFile() {
        return createSourceFile('battery-cycles.csv', 'battery-cycles', 1713398400000);
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const kernelStore = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
        datasets: benchmarkWorkspaceLocalSnapshotFixture.datasets.map((dataset) => ({
          ...structuredClone(dataset),
          sourceFile: {
            fileName: dataset.displayName,
            fileHandleToken: `dataset.${dataset.datasetId}.source-file`,
          },
        })),
      },
      ledger: benchmarkWorkspaceLocalLedgerFixture,
    });

    await saveWorkspaceKernel({
      repository,
      kernelStore,
      savedAt: '2026-04-16T18:41:00Z',
      datasetFileHandles: [
        {
          datasetId: 'ds_main',
          fileName: 'battery-cycles.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          handle,
        },
      ],
    });

    const reopened = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:41:03Z',
      nowMs: (() => {
        const samples = [1500, 1715];
        return () => samples.shift() ?? 1715;
      })(),
    });

    expect(reopened.report.localizedIssues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.missing-file-handle',
        }),
      ]),
    );
    expect(reopened.kernelStore.getState().snapshot.datasets).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        sourceFile: {
          fileName: 'battery-cycles.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
        },
      }),
    ]);
  });

  it('preserves dataset file handles across reopen-save-reopen cycles', async () => {
    const repository = createWorkspaceRepository(new InMemoryWorkspaceStorage());
    const handle = {
      name: 'battery-cycles.csv',
      async getFile() {
        return createSourceFile('battery-cycles.csv', 'battery-cycles', 1713398400000);
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const kernelStore = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
        datasets: benchmarkWorkspaceLocalSnapshotFixture.datasets.map((dataset) => ({
          ...structuredClone(dataset),
          sourceFile: {
            fileName: dataset.displayName,
            fileHandleToken: `dataset.${dataset.datasetId}.source-file`,
          },
        })),
      },
      ledger: benchmarkWorkspaceLocalLedgerFixture,
    });

    await saveWorkspaceKernel({
      repository,
      kernelStore,
      savedAt: '2026-04-16T18:42:00Z',
      datasetFileHandles: [
        {
          datasetId: 'ds_main',
          fileName: 'battery-cycles.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          handle,
        },
      ],
    });

    const firstReopen = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:42:04Z',
      nowMs: (() => {
        const samples = [1800, 2010];
        return () => samples.shift() ?? 2010;
      })(),
    });

    expect(firstReopen.kernelStore.getState().selectors.datasetFileHandles()).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        fileHandleToken: 'dataset.ds_main.source-file',
        handle,
      }),
    ]);

    await saveWorkspaceKernel({
      repository,
      kernelStore: firstReopen.kernelStore,
      savedAt: '2026-04-16T18:42:10Z',
    });

    const record = await repository.loadWorkspaceRecord(benchmarkWorkspaceLocalSnapshotFixture.workspaceId);

    expect(record?.datasetFileHandles).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        fileHandleToken: 'dataset.ds_main.source-file',
        handle,
      }),
    ]);

    const secondReopen = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:42:14Z',
      nowMs: (() => {
        const samples = [2100, 2325];
        return () => samples.shift() ?? 2325;
      })(),
    });

    expect(secondReopen.report.localizedIssues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.missing-file-handle',
        }),
      ]),
    );
    expect(secondReopen.kernelStore.getState().selectors.datasetFileHandles()).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        fileHandleToken: 'dataset.ds_main.source-file',
        handle,
      }),
    ]);
  });

  it('round-trips a relinked dataset handle after the source file name changes', async () => {
    const repository = createWorkspaceRepository(new InMemoryWorkspaceStorage());
    const originalHandle = {
      name: 'battery-cycles.csv',
      async getFile() {
        return createSourceFile('battery-cycles.csv', 'battery-cycles', 1713398400000);
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const relinkedHandle = {
      name: 'battery-cycles-relinked.csv',
      async getFile() {
        return createSourceFile('battery-cycles-relinked.csv', 'battery-cycles-relinked', 1713398460000);
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const kernelStore = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
        datasets: benchmarkWorkspaceLocalSnapshotFixture.datasets.map((dataset) => ({
          ...structuredClone(dataset),
          sourceFile: {
            fileName: dataset.displayName,
            fileHandleToken: `dataset.${dataset.datasetId}.source-file`,
          },
        })),
      },
      ledger: benchmarkWorkspaceLocalLedgerFixture,
    });

    await saveWorkspaceKernel({
      repository,
      kernelStore,
      savedAt: '2026-04-16T18:42:20Z',
      datasetFileHandles: [
        {
          datasetId: 'ds_main',
          fileName: 'battery-cycles.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          handle: originalHandle,
        },
      ],
    });

    const reopened = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:42:24Z',
      nowMs: (() => {
        const samples = [2350, 2590];
        return () => samples.shift() ?? 2590;
      })(),
    });

    await saveWorkspaceKernel({
      repository,
      kernelStore: reopened.kernelStore,
      savedAt: '2026-04-16T18:42:30Z',
      datasetFileHandles: [
        {
          datasetId: 'ds_main',
          fileName: 'battery-cycles-relinked.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          handle: relinkedHandle,
        },
      ],
    });

    const record = await repository.loadWorkspaceRecord(benchmarkWorkspaceLocalSnapshotFixture.workspaceId);

    expect(record?.snapshot).toEqual(
      expect.objectContaining({
        datasets: [
          expect.objectContaining({
            datasetId: 'ds_main',
            sourceFile: {
              fileName: 'battery-cycles-relinked.csv',
              fileHandleToken: 'dataset.ds_main.source-file',
            },
          }),
        ],
      }),
    );
    expect(record?.datasetFileHandles).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        fileName: 'battery-cycles-relinked.csv',
        fileHandleToken: 'dataset.ds_main.source-file',
        handle: relinkedHandle,
      }),
    ]);

    const reopenedAfterRelink = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:42:34Z',
      nowMs: (() => {
        const samples = [2610, 2860];
        return () => samples.shift() ?? 2860;
      })(),
    });

    expect(reopenedAfterRelink.report.localizedIssues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.missing-file-handle',
        }),
      ]),
    );
    expect(reopenedAfterRelink.kernelStore.getState().snapshot.datasets).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        sourceFile: {
          fileName: 'battery-cycles-relinked.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
        },
      }),
    ]);
    expect(reopenedAfterRelink.kernelStore.getState().selectors.datasetFileHandles()).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        fileName: 'battery-cycles-relinked.csv',
        fileHandleToken: 'dataset.ds_main.source-file',
        handle: relinkedHandle,
      }),
    ]);
  });

  it('synchronizes stale snapshot dataset metadata when implicit retained handles are reused on save', async () => {
    const repository = createWorkspaceRepository(new InMemoryWorkspaceStorage());
    const originalHandle = {
      name: 'battery-cycles.csv',
      async getFile() {
        return createSourceFile('battery-cycles.csv', 'battery-cycles', 1713398400000);
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const relinkedHandle = {
      name: 'battery-cycles-relinked.csv',
      async getFile() {
        return createSourceFile('battery-cycles-relinked.csv', 'battery-cycles-relinked', 1713398460000);
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const kernelStore = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
        datasets: benchmarkWorkspaceLocalSnapshotFixture.datasets.map((dataset) => ({
          ...structuredClone(dataset),
          sourceFile: {
            fileName: dataset.displayName,
            fileHandleToken: `dataset.${dataset.datasetId}.source-file`,
          },
        })),
      },
      ledger: benchmarkWorkspaceLocalLedgerFixture,
    });

    await saveWorkspaceKernel({
      repository,
      kernelStore,
      savedAt: '2026-04-16T18:42:40Z',
      datasetFileHandles: [
        {
          datasetId: 'ds_main',
          fileName: 'battery-cycles.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          handle: originalHandle,
        },
      ],
    });

    const reopened = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:42:44Z',
      nowMs: (() => {
        const samples = [2880, 3115];
        return () => samples.shift() ?? 3115;
      })(),
    });

    reopened.kernelStore.getState().commands.replaceDatasetFileHandles([
      {
        datasetId: 'ds_main',
        fileName: 'battery-cycles-relinked.csv',
        fileHandleToken: 'dataset.ds_main.source-file',
        handle: relinkedHandle,
      },
    ]);

    reopened.kernelStore.setState((state) => ({
      snapshot: {
        ...state.snapshot,
        datasets: state.snapshot.datasets.map((dataset) =>
          dataset.datasetId === 'ds_main'
            ? {
                ...dataset,
                sourceFile: {
                  fileName: 'battery-cycles.csv',
                  fileHandleToken: 'dataset.ds_main.source-file',
                },
              }
            : dataset,
        ),
      },
    }));

    await saveWorkspaceKernel({
      repository,
      kernelStore: reopened.kernelStore,
      savedAt: '2026-04-16T18:42:50Z',
    });

    const record = await repository.loadWorkspaceRecord(benchmarkWorkspaceLocalSnapshotFixture.workspaceId);

    expect(record?.snapshot).toEqual(
      expect.objectContaining({
        datasets: [
          expect.objectContaining({
            datasetId: 'ds_main',
            sourceFile: {
              fileName: 'battery-cycles-relinked.csv',
              fileHandleToken: 'dataset.ds_main.source-file',
            },
          }),
        ],
      }),
    );
    expect(record?.datasetFileHandles).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        fileName: 'battery-cycles-relinked.csv',
        fileHandleToken: 'dataset.ds_main.source-file',
        handle: relinkedHandle,
      }),
    ]);

    const reopenedAfterImplicitSave = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:42:54Z',
      nowMs: (() => {
        const samples = [3140, 3375];
        return () => samples.shift() ?? 3375;
      })(),
    });

    expect(reopenedAfterImplicitSave.report.localizedIssues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.missing-file-handle',
        }),
      ]),
    );
    expect(reopenedAfterImplicitSave.kernelStore.getState().snapshot.datasets).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        sourceFile: {
          fileName: 'battery-cycles-relinked.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
        },
      }),
    ]);
  });

  it('keeps replacement snapshot dataset metadata aligned with replacement handles before a later save', async () => {
    const repository = createWorkspaceRepository(new InMemoryWorkspaceStorage());
    const relinkedHandle = {
      name: 'battery-cycles-relinked.csv',
      async getFile() {
        return createSourceFile('battery-cycles-relinked.csv', 'battery-cycles-relinked', 1713398460000);
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const kernelStore = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
        datasets: benchmarkWorkspaceLocalSnapshotFixture.datasets.map((dataset) => ({
          ...structuredClone(dataset),
          sourceFile: {
            fileName: 'battery-cycles.csv',
            fileHandleToken: `dataset.${dataset.datasetId}.source-file`,
          },
        })),
      },
      ledger: benchmarkWorkspaceLocalLedgerFixture,
    });

    kernelStore.getState().commands.replaceSnapshot({
      snapshot: {
        ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
        datasets: benchmarkWorkspaceLocalSnapshotFixture.datasets.map((dataset) => ({
          ...structuredClone(dataset),
          sourceFile: {
            fileName: 'battery-cycles.csv',
            fileHandleToken: `dataset.${dataset.datasetId}.source-file`,
          },
        })),
      },
      ledger: structuredClone(benchmarkWorkspaceLocalLedgerFixture),
      datasetFileHandles: [
        {
          datasetId: 'ds_main',
          fileName: 'battery-cycles-relinked.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          handle: relinkedHandle,
        },
      ],
    });

    await saveWorkspaceKernel({
      repository,
      kernelStore,
      savedAt: '2026-04-16T18:42:40Z',
    });

    const record = await repository.loadWorkspaceRecord(benchmarkWorkspaceLocalSnapshotFixture.workspaceId);

    expect(record?.snapshot).toEqual(
      expect.objectContaining({
        datasets: [
          expect.objectContaining({
            datasetId: 'ds_main',
            sourceFile: {
              fileName: 'battery-cycles-relinked.csv',
              fileHandleToken: 'dataset.ds_main.source-file',
            },
          }),
        ],
      }),
    );

    const reopened = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:42:44Z',
      nowMs: (() => {
        const samples = [2890, 3120];
        return () => samples.shift() ?? 3120;
      })(),
    });

    expect(reopened.report.localizedIssues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.missing-file-handle',
        }),
      ]),
    );
    expect(reopened.kernelStore.getState().snapshot.datasets).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        sourceFile: {
          fileName: 'battery-cycles-relinked.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
        },
      }),
    ]);
  });

  it('applies the release compatibility envelope as a blocking reopen issue', async () => {
    const storage = new InMemoryWorkspaceStorage([
      {
        workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
        savedAt: '2026-04-16T18:45:00Z',
        snapshot: {
          ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
          workspaceFormatVersion: '2.0.0',
        },
        ledger: structuredClone(benchmarkWorkspaceLocalLedgerFixture),
      },
    ]);
    const repository = createWorkspaceRepository(storage);

    const reopened = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:45:04Z',
      nowMs: (() => {
        const samples = [2000, 2200];
        return () => samples.shift() ?? 2200;
      })(),
    });

    expect(reopened.report.localizedIssues).toContainEqual(
      expect.objectContaining({
        kind: 'workspace.reopen.compatibility.blocked',
        severity: 'blocking',
      }),
    );
    expect(reopened.kernelStore.getState().selectors.readinessSummary().status).toBe('blocked');
    expect(reopened.kernelStore.getState().selectors.compatibilityState()).toMatchObject({
      isReadable: false,
      isTested: false,
    });
  });

  it('preserves unaffected workspace state while localizing invalid reopened content', async () => {
    const storage = new InMemoryWorkspaceStorage([
      {
        workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
        savedAt: '2026-04-16T18:48:00Z',
        snapshot: {
          ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
          datasets: [
            ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture.datasets),
            {
              datasetId: 'ds_invalid',
              displayName: 'broken.csv',
              sourceKind: 'csv',
              fingerprint: 'sha256:dataset-invalid',
              rowCount: 4,
              columnCount: 1,
              columns: [
                {
                  columnId: '',
                  sourceName: 'Broken',
                  dataType: 'string',
                  semanticRole: 'x',
                  unit: null,
                  status: 'confirmed',
                },
              ],
            },
          ],
          transformPipeline: [
            ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture.transformPipeline),
            {
              transformId: 'tf_missing_column',
              kind: 'filter',
              status: 'applied',
              order: 2,
              expression: "missingColumn == 'PASS'",
            },
          ],
          formulaColumns: [
            ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture.formulaColumns),
            {
              formulaId: 'fm_missing_dependency',
              columnId: 'missingDerived',
              label: 'Missing Derived',
              expression: 'missingColumn * 2',
              status: 'valid',
              dependsOn: ['missingColumn'],
            },
          ],
          graphDefinitions: [
            benchmarkWorkspaceLocalSnapshotFixture.graphDefinitions[0],
            {
              ...benchmarkWorkspaceLocalSnapshotFixture.graphDefinitions[0],
              graphId: 'graph_invalid_role_assignment',
              title: 'Invalid Graph',
              datasetId: 'ds_missing',
              status: 'candidate',
              evidenceIds: [],
              issueIds: [],
            },
            benchmarkWorkspaceLocalSnapshotFixture.graphDefinitions[1],
          ],
          evidence: [
            ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture.evidence),
            {
              evidenceId: 'ev_orphaned',
              graphId: 'graph_invalid_role_assignment',
              note: 'This evidence points at a dropped graph.',
              provenanceRefs: ['prov_orphaned'],
              status: 'review-ready',
            },
          ],
        },
        ledger: [
          ...structuredClone(benchmarkWorkspaceLocalLedgerFixture),
          {
            ...structuredClone(benchmarkWorkspaceLocalLedgerFixture[2]),
            sequence: 18,
            workspaceVersion: 18,
            ledgerEntryId: 'led_004_invalid',
          },
        ],
      },
    ]);
    const repository = createWorkspaceRepository(storage);

    const reopened = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:48:05Z',
      nowMs: (() => {
        const samples = [3000, 3365];
        return () => samples.shift() ?? 3365;
      })(),
    });

    expect(reopened.kernelStore.getState().snapshot.datasets).toEqual(
      benchmarkWorkspaceLocalSnapshotFixture.datasets,
    );
    expect(reopened.kernelStore.getState().snapshot.transformPipeline).toEqual(
      benchmarkWorkspaceLocalSnapshotFixture.transformPipeline,
    );
    expect(reopened.kernelStore.getState().snapshot.formulaColumns).toEqual(
      benchmarkWorkspaceLocalSnapshotFixture.formulaColumns,
    );
    expect(reopened.kernelStore.getState().snapshot.evidence).toEqual(
      benchmarkWorkspaceLocalSnapshotFixture.evidence,
    );
    expect(reopened.kernelStore.getState().snapshot.graphDefinitions.map((graph) => graph.graphId)).toEqual([
      'graph_capacity_fade',
      'graph_scatter_secondary',
    ]);
    expect(reopened.kernelStore.getState().ledger).toHaveLength(3);
    expect(reopened.report.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.graph.missing-dataset',
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.ledger.invalid-order',
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.invalid-contract',
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.transform.dataset-loss',
          source: expect.objectContaining({
            entityType: 'transform',
            entityId: 'tf_missing_column',
          }),
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.formula.missing-dependency',
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.evidence.orphaned-graph',
        }),
      ]),
    );
    expect(reopened.kernelStore.getState().selectors.repairEntryPoints()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'graph',
          entityId: 'graph_invalid_role_assignment',
          scopeLabel: 'Graph graph_invalid_role_assignment',
        }),
        expect.objectContaining({
          entityType: 'formula',
          entityId: 'fm_missing_dependency',
          impactLabel: 'One saved formula references unavailable dependencies and was excluded from reopen state.',
        }),
      ]),
    );

    const deferredIssueId = reopened.kernelStore
      .getState()
      .snapshot.issues.find((issue) => issue.kind === 'workspace.reopen.formula.missing-dependency')?.issueId;

    expect(deferredIssueId).toBeDefined();

    const deferredIssues = reopened.kernelStore
      .getState()
      .snapshot.issues.map((issue) =>
        issue.issueId === deferredIssueId
          ? {
              ...issue,
              status: 'deferred' as const,
            }
          : issue,
      );

    reopened.kernelStore.getState().commands.replaceIssues(deferredIssues, {
      actorId: 'system',
      correlationId: 'cmd_2026_04_16_004',
      occurredAt: '2026-04-16T18:48:06Z',
    });

    expect(reopened.kernelStore.getState().selectors.repairEntryPoints()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: deferredIssueId,
          status: 'deferred',
        }),
      ]),
    );
    expect(reopened.kernelStore.getState().selectors.readinessSummary()).toMatchObject({
      status: 'blocked',
      warningIssueCount: expect.any(Number),
    });
  });

  it('keeps graph-selection provenance and reopen scope labels visible through repair selectors', async () => {
    const repository = createWorkspaceRepository(
      new InMemoryWorkspaceStorage([
        {
          workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
          savedAt: '2026-04-16T18:49:00Z',
          snapshot: {
            ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
            activeGraphId: 'graph invalid/id',
            referenceGraphId: 'graph capacity fade',
            issues: [
              {
                issueId: 'reopen.issue.001',
              },
            ],
          },
          ledger: [
            ...structuredClone(benchmarkWorkspaceLocalLedgerFixture),
            {
              ...structuredClone(benchmarkWorkspaceLocalLedgerFixture[2]),
              sequence: 18,
              workspaceVersion: 18,
              ledgerEntryId: 'led_004_invalid',
            },
          ],
        },
      ]),
    );

    const reopened = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:49:04Z',
      nowMs: (() => {
        const samples = [3400, 3610];
        return () => samples.shift() ?? 3610;
      })(),
    });

    expect(reopened.kernelStore.getState().selectors.activeGraphId()).toBe('graph_scatter_secondary');
    expect(reopened.kernelStore.getState().selectors.referenceGraphId()).toBe('graph_capacity_fade');

    const initialWarningCount = reopened.kernelStore.getState().selectors.readinessSummary().warningIssueCount;
    const repairEntryPoints = reopened.kernelStore.getState().selectors.repairEntryPoints();

    expect(repairEntryPoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'graph-selection',
          entityId: 'active-graph-selection',
          graphId: 'graph_scatter_secondary',
          scopeLabel: 'Active graph selection',
          impactLabel:
            'The saved active graph selection could not be restored. Graph "graph_scatter_secondary" was selected instead.',
          repairActions: expect.arrayContaining([
            expect.objectContaining({
              command: 'repair.focusGraph',
              args: expect.objectContaining({
                graphId: 'graph_scatter_secondary',
              }),
            }),
          ]),
        }),
        expect.objectContaining({
          entityType: 'graph-selection',
          entityId: 'reference-graph-selection',
          graphId: 'graph_capacity_fade',
          scopeLabel: 'Reference graph selection',
          impactLabel: 'The saved reference graph selection was normalized to "graph_capacity_fade" during reopen.',
        }),
        expect.objectContaining({
          entityType: 'ledger',
          entityId: 'led_004_invalid',
          scopeLabel: 'Ledger entry led_004_invalid',
        }),
        expect.objectContaining({
          entityType: 'issue-record',
          entityId: 'reopen.issue.001',
          scopeLabel: 'Saved issue record reopen.issue.001',
        }),
      ]),
    );

    const activeSelectionIssueId = reopened.kernelStore
      .getState()
      .snapshot.issues.find((issue) => issue.source.entityId === 'active-graph-selection')?.issueId;

    expect(activeSelectionIssueId).toBeDefined();

    reopened.kernelStore.getState().commands.replaceIssues(
      reopened.kernelStore.getState().snapshot.issues.map((issue) =>
        issue.issueId === activeSelectionIssueId
          ? {
              ...issue,
              status: 'resolved' as const,
            }
          : issue,
      ),
      {
        actorId: 'system',
        correlationId: 'cmd_2026_04_16_005',
        occurredAt: '2026-04-16T18:49:05Z',
      },
    );

    expect(reopened.kernelStore.getState().selectors.readinessSummary().warningIssueCount).toBe(initialWarningCount - 1);
    expect(reopened.kernelStore.getState().selectors.repairEntryPoints()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: activeSelectionIssueId,
        }),
      ]),
    );
  });

  it('keeps reopened datasets available while localizing missing persisted file handles', async () => {
    const repository = createWorkspaceRepository(
      new InMemoryWorkspaceStorage([
        {
          workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
          savedAt: '2026-04-16T18:49:30Z',
          snapshot: {
            ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
            datasets: benchmarkWorkspaceLocalSnapshotFixture.datasets.map((dataset) => ({
              ...structuredClone(dataset),
              sourceFile: {
                fileName: dataset.displayName,
                fileHandleToken: `dataset.${dataset.datasetId}.source-file`,
              },
            })),
          },
          datasetFileHandles: [],
          ledger: structuredClone(benchmarkWorkspaceLocalLedgerFixture),
        },
      ]),
    );

    const reopened = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:49:34Z',
      nowMs: (() => {
        const samples = [3700, 3915];
        return () => samples.shift() ?? 3915;
      })(),
    });

    expect(reopened.kernelStore.getState().snapshot.datasets).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        displayName: 'battery-cycles.csv',
        sourceFile: {
          fileName: 'battery-cycles.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
        },
      }),
    ]);
    expect(reopened.report.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.missing-file-handle',
          source: expect.objectContaining({
            entityType: 'dataset',
            entityId: 'ds_main',
          }),
        }),
      ]),
    );
    expect(reopened.kernelStore.getState().selectors.repairEntryPoints()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'dataset',
          entityId: 'ds_main',
          scopeLabel: 'Dataset ds_main',
          impactLabel:
            'The source file handle for dataset "battery-cycles.csv" is missing. The dataset remains available, but it may need to be re-linked before source-backed repairs can continue.',
        }),
      ]),
    );
    expect(reopened.kernelStore.getState().selectors.readinessSummary()).toMatchObject({
      status: 'warning',
      warningIssueCount: expect.any(Number),
    });
  });

  it('emits a missing-file-handle issue when only the persisted token matches after dataset metadata drift', async () => {
    const mismatchedHandle = {
      name: 'different-source.csv',
      async getFile() {
        return createSourceFile('different-source.csv', 'different-source', 1713398520000);
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const repository = createWorkspaceRepository(
      new InMemoryWorkspaceStorage([
        {
          workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
          savedAt: '2026-04-16T18:49:40Z',
          snapshot: {
            ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
            datasets: benchmarkWorkspaceLocalSnapshotFixture.datasets.map((dataset) => ({
              ...structuredClone(dataset),
              sourceFile: {
                fileName: dataset.displayName,
                fileHandleToken: `dataset.${dataset.datasetId}.source-file`,
              },
            })),
          },
          datasetFileHandles: [
            {
              datasetId: 'ds_other',
              fileName: 'different-source.csv',
              fileHandleToken: 'dataset.ds_main.source-file',
              handle: mismatchedHandle,
            },
          ],
          ledger: structuredClone(benchmarkWorkspaceLocalLedgerFixture),
        },
      ]),
    );

    const reopened = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:49:44Z',
      nowMs: (() => {
        const samples = [3920, 4145];
        return () => samples.shift() ?? 4145;
      })(),
    });

    expect(reopened.report.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.missing-file-handle',
          source: expect.objectContaining({
            entityType: 'dataset',
            entityId: 'ds_main',
          }),
        }),
      ]),
    );
    expect(reopened.kernelStore.getState().selectors.datasetFileHandles()).toEqual([]);
    expect(reopened.kernelStore.getState().selectors.repairEntryPoints()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'dataset',
          entityId: 'ds_main',
          scopeLabel: 'Dataset ds_main',
        }),
      ]),
    );
  });

  it('does not let saved transient reopen issues block a later compatible reopen', async () => {
    const repository = createWorkspaceRepository(
      new InMemoryWorkspaceStorage([
        {
          workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
          savedAt: '2026-04-16T18:50:00Z',
          snapshot: {
            ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
            workspaceFormatVersion: '2.0.0',
            compatibility: {
              minReadableAppBuild: '0.1.0',
              maxTestedAppBuild: '0.2.x',
            },
          },
          ledger: structuredClone(benchmarkWorkspaceLocalLedgerFixture),
        },
      ]),
    );

    const blockedReopen = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:50:04Z',
      nowMs: (() => {
        const samples = [4000, 4210];
        return () => samples.shift() ?? 4210;
      })(),
    });

    expect(blockedReopen.report.localizedIssues).toContainEqual(
      expect.objectContaining({
        kind: 'workspace.reopen.compatibility.blocked',
      }),
    );

    await saveWorkspaceKernel({
      repository,
      kernelStore: blockedReopen.kernelStore,
      savedAt: '2026-04-16T18:50:10Z',
    });

    const reopenedAfterUpgrade = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope: {
        ...compatibilityEnvelope,
        currentAppBuildVersion: '0.2.0',
        maximumReadableWorkspaceFormat: '2.x',
      },
      now: () => '2026-04-16T18:50:14Z',
      nowMs: (() => {
        const samples = [4300, 4520];
        return () => samples.shift() ?? 4520;
      })(),
    });

    expect(reopenedAfterUpgrade.report.localizedIssues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.compatibility.blocked',
        }),
      ]),
    );
    expect(reopenedAfterUpgrade.kernelStore.getState().snapshot.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.compatibility.blocked',
        }),
      ]),
    );
    expect(reopenedAfterUpgrade.kernelStore.getState().selectors.readinessSummary().status).toBe('warning');
    expect(reopenedAfterUpgrade.kernelStore.getState().selectors.compatibilityState()).toMatchObject({
      appBuildVersion: '0.2.0',
      isReadable: true,
      isTested: true,
    });
  });

  it('persists deferred transform and graph-composition reopen issues across save and clears them after a compatible save', async () => {
    const repository = createWorkspaceRepository(
      new InMemoryWorkspaceStorage([
        {
          workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
          savedAt: '2026-04-16T18:50:20Z',
          snapshot: {
            ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
            transformPipeline: [
              {
                ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture.transformPipeline[0]),
                dependencyMetadata: {
                  datasetId: 'ds_main',
                  dependsOnColumnIds: ['capacityRetention'],
                  producesColumnIds: [],
                  upstreamTransformIds: [],
                },
              },
              {
                transformId: 'tf_missing_dependency',
                kind: 'derive-column',
                status: 'applied',
                order: 2,
                expression: 'missingColumn * 2',
                dependencyMetadata: {
                  datasetId: 'ds_main',
                  dependsOnColumnIds: ['missingColumn'],
                  producesColumnIds: ['missingDerived'],
                  upstreamTransformIds: [],
                },
              },
            ],
            graphDefinitions: [
              {
                ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture.graphDefinitions[0]),
                issueIds: [],
                evidenceIds: [],
              },
              {
                ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture.graphDefinitions[1]),
                graphId: 'graph_bar_regression',
                title: 'Bar With Regression',
                marks: ['bar'],
                family: 'bar',
                templateId: 'tpl_bar_grouped_compare',
                roleAssignments: {
                  x: ['temperatureBand'],
                  y: ['capacityRetention'],
                  color: [],
                  size: [],
                  facetRow: [],
                  facetColumn: [],
                },
                overlays: [
                  {
                    overlayId: 'ov_linear_fit_bar',
                    kind: 'regression',
                    method: 'linear',
                    status: 'ready',
                    catalogOverlayId: 'regression_linear',
                  },
                ],
                issueIds: [],
                evidenceIds: [],
              },
            ],
            activeGraphId: 'graph_bar_regression',
            referenceGraphId: 'graph_capacity_fade',
          },
          ledger: structuredClone(benchmarkWorkspaceLocalLedgerFixture),
        },
      ]),
    );

    const reopened = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:50:24Z',
      nowMs: (() => {
        const samples = [4600, 4820];
        return () => samples.shift() ?? 4820;
      })(),
    });

    const transformIssueId = reopened.kernelStore
      .getState()
      .snapshot.issues.find((issue) => issue.kind === 'workspace.reopen.transform.missing-dependency')?.issueId;
    const graphIssueId = reopened.kernelStore
      .getState()
      .snapshot.issues.find((issue) => issue.kind === 'workspace.reopen.graph.incompatible-composition')?.issueId;

    expect(transformIssueId).toBeDefined();
    expect(graphIssueId).toBeDefined();

    reopened.kernelStore.getState().commands.replaceIssues(
      reopened.kernelStore.getState().snapshot.issues.map((issue) => {
        if (issue.issueId === transformIssueId || issue.issueId === graphIssueId) {
          return {
            ...issue,
            status: 'deferred' as const,
          };
        }

        return issue;
      }),
      {
        actorId: 'system',
        correlationId: 'cmd_2026_04_16_006',
        occurredAt: '2026-04-16T18:50:25Z',
      },
    );

    await saveWorkspaceKernel({
      repository,
      kernelStore: reopened.kernelStore,
      savedAt: '2026-04-16T18:50:30Z',
    });

    const reopenedDeferred = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:50:34Z',
      nowMs: (() => {
        const samples = [4900, 5120];
        return () => samples.shift() ?? 5120;
      })(),
    });

    expect(reopenedDeferred.kernelStore.getState().selectors.repairEntryPoints()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: transformIssueId,
          status: 'deferred',
        }),
        expect.objectContaining({
          issueId: graphIssueId,
          status: 'deferred',
        }),
      ]),
    );

    reopenedDeferred.kernelStore.getState().commands.replaceSnapshot({
      snapshot: {
        ...structuredClone(reopenedDeferred.kernelStore.getState().snapshot),
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
        graphDefinitions: benchmarkWorkspaceLocalSnapshotFixture.graphDefinitions.map((graph) => ({
          ...structuredClone(graph),
          issueIds: [],
          evidenceIds: [],
        })),
        activeGraphId: 'graph_scatter_secondary',
        referenceGraphId: 'graph_capacity_fade',
      },
      ledger: structuredClone(reopenedDeferred.kernelStore.getState().ledger),
      datasetFileHandles: reopenedDeferred.kernelStore.getState().selectors.datasetFileHandles(),
    });
    reopenedDeferred.kernelStore.getState().commands.replaceIssues(
      reopenedDeferred.kernelStore
        .getState()
        .snapshot.issues.filter(
          (issue) => issue.issueId !== transformIssueId && issue.issueId !== graphIssueId,
        ),
      {
        actorId: 'system',
        correlationId: 'cmd_2026_04_16_007',
        occurredAt: '2026-04-16T18:50:36Z',
      },
    );

    await saveWorkspaceKernel({
      repository,
      kernelStore: reopenedDeferred.kernelStore,
      savedAt: '2026-04-16T18:50:40Z',
    });

    const reopenedAfterFix = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:50:44Z',
      nowMs: (() => {
        const samples = [5200, 5420];
        return () => samples.shift() ?? 5420;
      })(),
    });

    expect(reopenedAfterFix.kernelStore.getState().snapshot.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.transform.missing-dependency',
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.graph.incompatible-composition',
        }),
      ]),
    );
    expect(reopenedAfterFix.kernelStore.getState().selectors.repairEntryPoints()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: transformIssueId,
        }),
        expect.objectContaining({
          issueId: graphIssueId,
        }),
      ]),
    );
  });
});
