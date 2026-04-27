import type {
  GraphCatalogOverlayId,
  GraphDefinition,
  GraphFamily,
  GraphOverlay,
  GraphTemplateId,
  WorkspaceSnapshot,
} from '../../schemas/workspace';

const familyByTemplateId: Record<GraphTemplateId, GraphFamily> = {
  tpl_scatter_regression: 'scatter',
  tpl_line_trend: 'line',
  tpl_bar_grouped_compare: 'bar',
  tpl_histogram_distribution: 'histogram',
  tpl_boxplot_by_category: 'boxplot',
};

const templateByFamily: Partial<Record<GraphFamily, GraphTemplateId>> = {
  scatter: 'tpl_scatter_regression',
  line: 'tpl_line_trend',
  bar: 'tpl_bar_grouped_compare',
  histogram: 'tpl_histogram_distribution',
  boxplot: 'tpl_boxplot_by_category',
};

const allowedOverlayIdsByFamily: Record<GraphFamily, GraphCatalogOverlayId[]> = {
  scatter: ['regression_linear', 'reference_line', 'threshold_band'],
  line: ['regression_linear', 'reference_line', 'threshold_band'],
  bar: ['reference_line', 'threshold_band'],
  histogram: ['reference_line', 'threshold_band'],
  boxplot: ['reference_line', 'threshold_band'],
};

const allowedMarksByFamily: Record<GraphFamily, string[]> = {
  scatter: ['point', 'line'],
  line: ['line', 'point'],
  bar: ['bar'],
  histogram: ['bar', 'binned-bar'],
  boxplot: ['box', 'boxplot'],
};

interface GraphCompositionBlockedDiagnostic {
  reason: string;
  affectedColumnIds: string[];
  semanticCatalogReason: boolean;
}

function isQuantitative(dataType: WorkspaceSnapshot['datasets'][number]['columns'][number]['dataType']) {
  return dataType === 'number' || dataType === 'integer';
}

function isTemporalOrQuantitative(dataType: WorkspaceSnapshot['datasets'][number]['columns'][number]['dataType']) {
  return isQuantitative(dataType) || dataType === 'date' || dataType === 'datetime';
}

function assignedColumnsForRole(
  graph: GraphDefinition,
  role: keyof GraphDefinition['roleAssignments'],
  columnById: Map<string, WorkspaceSnapshot['datasets'][number]['columns'][number]>,
) {
  return graph.roleAssignments[role].map((columnId) => columnById.get(columnId)).filter(Boolean);
}

function normalizeCatalogOverlayId(overlay: GraphOverlay): GraphCatalogOverlayId | null {
  if (overlay.kind === 'regression' && overlay.method === 'linear') {
    return 'regression_linear';
  }

  if (overlay.kind === 'reference' && overlay.method === 'line') {
    return 'reference_line';
  }

  if (overlay.kind === 'threshold' && overlay.method === 'band') {
    return 'threshold_band';
  }

  return null;
}

function inferFamily(graph: GraphDefinition): GraphFamily | null {
  if (graph.family) {
    return graph.family;
  }

  if (graph.templateId) {
    return familyByTemplateId[graph.templateId];
  }

  const overlayIds = graph.overlays
    .map((overlay) => normalizeCatalogOverlayId(overlay))
    .filter((overlayId): overlayId is GraphCatalogOverlayId => overlayId !== null);

  if (graph.marks.includes('box') || graph.marks.includes('boxplot')) {
    return 'boxplot';
  }

  if (graph.marks.includes('binned-bar')) {
    return 'histogram';
  }

  if (graph.marks.includes('bar')) {
    if ((graph.roleAssignments.x.length === 0) !== (graph.roleAssignments.y.length === 0)) {
      return 'histogram';
    }

    return 'bar';
  }

  if (graph.marks.includes('point') && overlayIds.includes('regression_linear')) {
    return 'scatter';
  }

  if (graph.marks.includes('point')) {
    return 'scatter';
  }

  if (graph.marks.includes('line')) {
    return 'line';
  }

  return null;
}

function inferTemplateId(graph: GraphDefinition, family: GraphFamily): GraphTemplateId | null {
  if (graph.templateId !== undefined) {
    return graph.templateId;
  }

  return templateByFamily[family] ?? null;
}

export function normalizeGraphCatalogMetadata(graph: GraphDefinition): GraphDefinition {
  const family = inferFamily(graph);
  const normalizedOverlays = graph.overlays.map((overlay) => {
    const catalogOverlayId = normalizeCatalogOverlayId(overlay);

    if (catalogOverlayId) {
      return {
        ...overlay,
        catalogOverlayId,
      };
    }

    if (!overlay.catalogOverlayId) {
      return overlay;
    }

    const overlayWithoutCatalogId = { ...overlay };
    delete overlayWithoutCatalogId.catalogOverlayId;
    return overlayWithoutCatalogId;
  });

  if (!family) {
    return {
      ...graph,
      overlays: normalizedOverlays,
    };
  }

  return {
    ...graph,
    family,
    templateId: inferTemplateId(graph, family),
    overlays: normalizedOverlays,
  };
}

export function validateGraphComposition(input: {
  graph: GraphDefinition;
  dataset: WorkspaceSnapshot['datasets'][number];
}) {
  const graph = normalizeGraphCatalogMetadata(input.graph);
  const blockedReasons: string[] = [];
  const blockedDiagnostics: GraphCompositionBlockedDiagnostic[] = [];
  const affectedColumnIds = new Set<string>();
  const family = graph.family;
  const columnById = new Map(input.dataset.columns.map((column) => [column.columnId, column]));
  const assignedColumnIds = Object.values(graph.roleAssignments).flat();

  const flagAssignedColumns = (columnIds: string[]) => {
    columnIds.forEach((columnId) => {
      if (columnById.has(columnId)) {
        affectedColumnIds.add(columnId);
      }
    });
  };

  const existingColumnIds = (columnIds: string[]) => columnIds.filter((columnId) => columnById.has(columnId));

  const addBlockedReason = (reason: string, reasonAffectedColumnIds: string[] = [], semanticCatalogReason = false) => {
    blockedReasons.push(reason);
    reasonAffectedColumnIds.forEach((columnId) => {
      if (columnById.has(columnId)) {
        affectedColumnIds.add(columnId);
      }
    });
    blockedDiagnostics.push({
      reason,
      affectedColumnIds: existingColumnIds(reasonAffectedColumnIds),
      semanticCatalogReason,
    });
  };

  const flagColumnsMatching = (
    role: keyof GraphDefinition['roleAssignments'],
    predicate: (column: WorkspaceSnapshot['datasets'][number]['columns'][number]) => boolean,
  ) => {
    graph.roleAssignments[role].forEach((columnId) => {
      const column = columnById.get(columnId);

      if (column && predicate(column)) {
        affectedColumnIds.add(columnId);
      }
    });
  };

  if (!family) {
    addBlockedReason('Saved graph family could not be matched to the locked MVP graph catalog.');
  }

  if (family && graph.templateId && familyByTemplateId[graph.templateId] !== family) {
    addBlockedReason(
      `Template "${graph.templateId}" is not allowed for graph family "${family}".`,
    );
  }

  if (family && graph.marks.some((mark) => !allowedMarksByFamily[family].includes(mark))) {
    addBlockedReason(
      `Marks ${graph.marks.join(', ')} are not allowed for graph family "${family}".`,
      assignedColumnIds,
    );
    flagAssignedColumns(assignedColumnIds);
  }

  if (assignedColumnIds.length > 4) {
    addBlockedReason('Locked MVP graph compositions cannot exceed four assigned analytical variables.');
  }

  if (family && family !== 'scatter' && graph.roleAssignments.size.length > 0) {
    addBlockedReason(`Size encoding is not allowed for graph family "${family}".`, graph.roleAssignments.size);
    flagAssignedColumns(graph.roleAssignments.size);
  }

  const overlayIds = graph.overlays.map((overlay) => ({
    overlay,
    overlayId: normalizeCatalogOverlayId(overlay),
  }));

  overlayIds.forEach(({ overlay, overlayId }) => {
    if (!overlayId) {
      addBlockedReason(
        `Overlay "${overlay.overlayId}" could not be matched to the locked MVP overlay catalog.`,
      );
      return;
    }

    if (family && !allowedOverlayIdsByFamily[family].includes(overlayId)) {
      addBlockedReason(`Overlay "${overlayId}" is not allowed for graph family "${family}".`);
    }
  });

  if (family === 'scatter' || family === 'line' || family === 'bar') {
    if (graph.roleAssignments.x.length === 0 || graph.roleAssignments.y.length === 0) {
      addBlockedReason(`Graph family "${family}" requires both x and y role assignments.`);
    }
  }

  if (family === 'scatter') {
    const xColumns = assignedColumnsForRole(graph, 'x', columnById);
    const yColumns = assignedColumnsForRole(graph, 'y', columnById);
    const sizeColumns = assignedColumnsForRole(graph, 'size', columnById);

    if (![...xColumns, ...yColumns].every((column) => column && isQuantitative(column.dataType))) {
      const reasonAffectedColumnIds = [
        ...graph.roleAssignments.x.filter((columnId) => {
          const column = columnById.get(columnId);

          return column && !isQuantitative(column.dataType);
        }),
        ...graph.roleAssignments.y.filter((columnId) => {
          const column = columnById.get(columnId);

          return column && !isQuantitative(column.dataType);
        }),
      ];

      addBlockedReason('Scatter compositions require quantitative columns for x and y roles.', reasonAffectedColumnIds, true);
      flagColumnsMatching('x', (column) => !isQuantitative(column.dataType));
      flagColumnsMatching('y', (column) => !isQuantitative(column.dataType));
    }

    if (sizeColumns.length > 0 && !sizeColumns.every((column) => column && isQuantitative(column.dataType))) {
      const reasonAffectedColumnIds = graph.roleAssignments.size.filter((columnId) => {
        const column = columnById.get(columnId);

        return column && !isQuantitative(column.dataType);
      });

      addBlockedReason('Scatter size encodings require quantitative columns.', reasonAffectedColumnIds, true);
      flagColumnsMatching('size', (column) => !isQuantitative(column.dataType));
    }
  }

  if (family === 'line') {
    const xColumns = assignedColumnsForRole(graph, 'x', columnById);
    const yColumns = assignedColumnsForRole(graph, 'y', columnById);

    if (!xColumns.every((column) => column && isTemporalOrQuantitative(column.dataType))) {
      const reasonAffectedColumnIds = graph.roleAssignments.x.filter((columnId) => {
        const column = columnById.get(columnId);

        return column && !isTemporalOrQuantitative(column.dataType);
      });

      addBlockedReason('Line compositions require temporal or quantitative columns for the x role.', reasonAffectedColumnIds, true);
      flagColumnsMatching('x', (column) => !isTemporalOrQuantitative(column.dataType));
    }

    if (!yColumns.every((column) => column && isQuantitative(column.dataType))) {
      const reasonAffectedColumnIds = graph.roleAssignments.y.filter((columnId) => {
        const column = columnById.get(columnId);

        return column && !isQuantitative(column.dataType);
      });

      addBlockedReason('Line compositions require quantitative columns for the y role.', reasonAffectedColumnIds, true);
      flagColumnsMatching('y', (column) => !isQuantitative(column.dataType));
    }
  }

  if (family === 'bar') {
    const yColumns = assignedColumnsForRole(graph, 'y', columnById);

    if (!yColumns.every((column) => column && isQuantitative(column.dataType))) {
      const reasonAffectedColumnIds = graph.roleAssignments.y.filter((columnId) => {
        const column = columnById.get(columnId);

        return column && !isQuantitative(column.dataType);
      });

      addBlockedReason('Bar compositions require quantitative columns for the y role.', reasonAffectedColumnIds, true);
      flagColumnsMatching('y', (column) => !isQuantitative(column.dataType));
    }
  }

  if (family === 'histogram') {
    const xColumns = graph.roleAssignments.x.map((columnId) => columnById.get(columnId)).filter(Boolean);
    const yColumns = graph.roleAssignments.y.map((columnId) => columnById.get(columnId)).filter(Boolean);
    const singleAxisAssigned =
      (graph.roleAssignments.x.length > 0 && graph.roleAssignments.y.length === 0)
      || (graph.roleAssignments.y.length > 0 && graph.roleAssignments.x.length === 0);

    if (graph.roleAssignments.facetRow.length > 0 || graph.roleAssignments.facetColumn.length > 0) {
      addBlockedReason(
        'Histogram compositions cannot use row or column faceting in the locked MVP catalog.',
        [...graph.roleAssignments.facetRow, ...graph.roleAssignments.facetColumn],
      );
      flagAssignedColumns([...graph.roleAssignments.facetRow, ...graph.roleAssignments.facetColumn]);
    }

    if (!singleAxisAssigned) {
      addBlockedReason('Histogram compositions must assign exactly one quantitative measure to x or y.');
    }

    if (![...xColumns, ...yColumns].every((column) => column && isQuantitative(column.dataType))) {
      const reasonAffectedColumnIds = [
        ...graph.roleAssignments.x.filter((columnId) => {
          const column = columnById.get(columnId);

          return column && !isQuantitative(column.dataType);
        }),
        ...graph.roleAssignments.y.filter((columnId) => {
          const column = columnById.get(columnId);

          return column && !isQuantitative(column.dataType);
        }),
      ];

      addBlockedReason('Histogram compositions require quantitative columns on the populated axis.', reasonAffectedColumnIds, true);
      flagColumnsMatching('x', (column) => !isQuantitative(column.dataType));
      flagColumnsMatching('y', (column) => !isQuantitative(column.dataType));
    }
  }

  if (family === 'boxplot') {
    const assignedColumns = assignedColumnIds
      .map((columnId) => columnById.get(columnId))
      .filter((column): column is NonNullable<typeof column> => Boolean(column));
    const quantitativeCount = assignedColumns.filter((column) => isQuantitative(column.dataType)).length;
    const groupingCount = assignedColumns.length - quantitativeCount;

    if (quantitativeCount === 0 || groupingCount === 0) {
      addBlockedReason('Boxplot compositions require both a quantitative measure and a grouping field.', assignedColumnIds, true);
      flagAssignedColumns(assignedColumnIds);
    }
  }

  return {
    graph,
    blockedReasons,
    affectedColumnIds: [...affectedColumnIds],
    blockedDiagnostics,
  };
}

export function selectSemanticGraphCatalogDiagnostics(validation: ReturnType<typeof validateGraphComposition>) {
  const semanticDiagnostics = validation.blockedDiagnostics.filter((diagnostic) => diagnostic.semanticCatalogReason);

  return {
    blockedReasons: semanticDiagnostics.map((diagnostic) => diagnostic.reason),
    affectedColumnIds: [...new Set(semanticDiagnostics.flatMap((diagnostic) => diagnostic.affectedColumnIds))],
  };
}
