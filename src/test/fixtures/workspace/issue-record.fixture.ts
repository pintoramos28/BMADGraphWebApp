import type { IssueRecord } from '../../../schemas/workspace';

export const issueRecordFixture = {
  issueId: 'issue_color_role_quantitative',
  kind: 'graph.validation.incompatible-role',
  severity: 'blocking',
  status: 'open',
  detectedAt: '2026-04-15T14:20:01Z',
  source: {
    module: 'graph-runtime',
    entityType: 'graph',
    entityId: 'graph_capacity_fade',
  },
  title: 'Color role requires a categorical field',
  detail: 'The selected palette mode is categorical, but the requested field is quantitative.',
  userMessage: 'Choose a categorical field for Color or switch the graph to a continuous color scale.',
  contextRef: {
    routeKey: 'workspaceDetail',
    workspaceId: 'ws_2026_04_15_001',
    graphId: 'graph_capacity_fade',
    panel: 'repair',
  },
  repairActions: [
    {
      actionId: 'graph.clearRole',
      label: 'Clear color role',
      command: 'graph.clearRole',
      args: {
        graphId: 'graph_capacity_fade',
        role: 'color',
      },
    },
    {
      actionId: 'graph.setColorScaleMode',
      label: 'Use continuous color scale',
      command: 'graph.setColorScaleMode',
      args: {
        graphId: 'graph_capacity_fade',
        mode: 'continuous',
      },
    },
  ],
  diagnostics: {
    rendererFamily: 'vega-lite',
    requestedFieldId: 'capacityRetention',
    requestedRole: 'color',
  },
} satisfies IssueRecord;
