export const telemetryBatchFixture = {
  schemaVersion: '1.0.0',
  batchId: 'telemetry_batch_001',
  sentAt: '2026-04-15T14:45:00Z',
  appBuildVersion: '0.1.0',
  sessionId: 'sess_2026_04_15_a1',
  queueState: {
    status: 'queued',
    queuedCountBeforeFlush: 3,
  },
  environment: {
    browserName: 'Chrome',
    browserVersion: '136',
    osFamily: 'Windows',
    online: false,
    supportedEnvironment: true,
    viewportWidth: 1440,
    viewportHeight: 900,
  },
  privacy: {
    containsDatasetRows: false,
    containsFormulas: false,
    containsWorkspaceBlob: false,
    containsEvidenceText: false,
  },
  events: [
    {
      eventId: 'evt_001',
      type: 'graph.render.completed',
      occurredAt: '2026-04-15T14:44:52Z',
      workspaceRef: 'local-hash:ws_01',
      graphId: 'graph_capacity_fade',
      metrics: {
        durationMs: 742,
        datasetRowCount: 48213,
        seriesCount: 3,
      },
      dimensions: {
        rendererFamily: 'vega-lite',
        renderMode: 'svg',
        personaHint: 'technical',
        offlineState: 'queued',
      },
      outcome: 'success',
    },
    {
      eventId: 'evt_002',
      type: 'workspace.reopen.completed',
      occurredAt: '2026-04-15T14:44:58Z',
      workspaceRef: 'local-hash:ws_01',
      metrics: {
        durationMs: 3310,
        issueCount: 1,
      },
      dimensions: {
        migrationApplied: false,
        readinessStatus: 'warning',
      },
      outcome: 'success',
    },
  ],
};
