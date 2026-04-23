import { describe, expect, it } from 'vitest';

import {
  importPreviewFailureMessageSchema,
  importPreviewProgressMessageSchema,
  importPreviewRequestMessageSchema,
  importPreviewSuccessMessageSchema,
} from './import-preview';

describe('import preview worker schemas', () => {
  it('accepts request, progress, success, and failure envelopes for preview imports', () => {
    const request = {
      schemaVersion: '1.0.0',
      messageId: 'import_msg_001',
      correlationId: 'import_corr_001',
      workspaceVersion: 1,
      type: 'import.preview.request',
      payload: {
        sourceKind: 'csv-file',
        sourceLabel: 'Local CSV file',
        fileName: 'clean.csv',
        mimeType: 'text/csv',
        textContent: 'a,b\\n1,2',
        repairSelections: {
          delimiter: null,
          headerSelection: null,
          columnTypeOverrides: {},
          missingValuePolicy: null,
        },
      },
    };
    const progress = {
      schemaVersion: '1.0.0',
      messageId: 'import_msg_001.progress',
      correlationId: 'import_corr_001',
      workspaceVersion: 1,
      type: 'import.preview.progress',
      payload: {
        phase: 'parsing',
        message: 'Parsing rows in the import worker.',
      },
    };
    const success = {
      schemaVersion: '1.0.0',
      messageId: 'import_msg_001.success',
      correlationId: 'import_corr_001',
      workspaceVersion: 1,
      type: 'import.preview.success',
      payload: {
        preview: {
          previewId: 'preview_csv',
          source: {
            sourceKind: 'csv-file',
            sourceLabel: 'Local CSV file',
            fileName: 'clean.csv',
            mimeType: 'text/csv',
            sheetName: null,
            benchmarkScenario: 'import.clean.csv-preview',
          },
          rowCount: 1,
          isPartialPreview: false,
          columnCount: 2,
          columns: [
            {
              columnId: 'col_1',
              sourceName: 'a',
              sampleValues: ['1'],
              inferredType: 'numeric',
              confidence: 'high',
              nonEmptyCount: 1,
              nullCount: 0,
            },
            {
              columnId: 'col_2',
              sourceName: 'b',
              sampleValues: ['2'],
              inferredType: 'numeric',
              confidence: 'high',
              nonEmptyCount: 1,
              nullCount: 0,
            },
          ],
          sampleRows: [
            {
              rowId: 'row_1',
              cells: [
                {
                  columnId: 'col_1',
                  value: '1',
                },
                {
                  columnId: 'col_2',
                  value: '2',
                },
              ],
            },
          ],
          assumptions: [
            {
              assumptionId: 'assumption_delimiter',
              category: 'delimiter',
              label: 'Delimiter handling',
              value: 'Comma (,)',
              confidence: 'high',
            },
          ],
          uncertainties: [],
          issues: [],
          repairSelections: {
            delimiter: null,
            headerSelection: null,
            columnTypeOverrides: {},
            missingValuePolicy: null,
          },
          timing: {
            durationMs: 12,
            budgetMs: 5000,
            exceededBudget: false,
          },
        },
      },
    };
    const failure = {
      schemaVersion: '1.0.0',
      messageId: 'import_msg_001.failure',
      correlationId: 'import_corr_001',
      workspaceVersion: 1,
      type: 'import.preview.failure',
      payload: {
        code: 'import.preview.failed',
        title: 'Preview could not be prepared',
        detail: 'The workbook could not be read.',
        retryable: true,
      },
    };

    expect(importPreviewRequestMessageSchema.parse(request)).toEqual(request);
    expect(importPreviewProgressMessageSchema.parse(progress)).toEqual(progress);
    expect(importPreviewSuccessMessageSchema.parse(success)).toEqual(success);
    expect(importPreviewFailureMessageSchema.parse(failure)).toEqual(failure);
  });
});
