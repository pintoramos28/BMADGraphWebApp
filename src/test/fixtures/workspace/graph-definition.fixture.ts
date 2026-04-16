export const graphDefinitionFixture = {
  graphId: 'graph_capacity_fade',
  title: 'Capacity Fade vs Cycle',
  status: 'reference',
  datasetId: 'ds_main',
  roleAssignments: {
    x: ['cycleIndex'],
    y: ['capacityRetention'],
    color: ['temperatureBand'],
    size: [],
    facetRow: [],
    facetColumn: ['temperatureBand'],
  },
  marks: ['point', 'line'],
  overlays: [
    {
      overlayId: 'ov_linear_fit',
      kind: 'regression',
      method: 'linear',
      status: 'ready',
    },
  ],
  presentation: {
    xAxisLabel: 'Cycle',
    yAxisLabel: 'Capacity Retention (%)',
    legendPosition: 'right',
  },
  issueIds: [],
  evidenceIds: ['ev_001'],
};
