import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { IMPORT_PREVIEW_BUDGET_MS } from '../../src/features/import/benchmark-timing';
import { releaseManifestFixture } from '../../src/test/fixtures/api/release-manifest.fixture';
import { supportMatrixFixture } from '../../src/test/fixtures/api/support-matrix.fixture';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspacePreviewRoute = '/workspace?workspaceFormatVersion=1.0.0';
const csvFixture = path.join(
  repoRoot,
  '_bmad-output',
  'benchmarks',
  'benchmark_set_clean',
  'csv',
  'import.clean.csv-preview.csv',
);
const excelFixture = path.join(
  repoRoot,
  '_bmad-output',
  'benchmarks',
  'benchmark_set_clean',
  'excel',
  'import.clean.excel-preview.xlsx',
);
const cleanCsvFixtureText = fs.readFileSync(csvFixture, 'utf8');
const ac3SlackMs = 2_000;

async function expectAc3Outcome(page: Page) {
  const readyMessage = page.getByText('Preview ready. The committed workspace is still unchanged.');
  const budgetMessage = page.getByText('This preview crossed the 5s target, so the in-progress state stays visible until parsing finishes.');

  await Promise.any([
    readyMessage.waitFor({ state: 'visible', timeout: IMPORT_PREVIEW_BUDGET_MS }),
    budgetMessage.waitFor({ state: 'visible', timeout: IMPORT_PREVIEW_BUDGET_MS + ac3SlackMs }),
  ]);
}

async function disableNativeFilePicker(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: undefined,
    });
  });
}

test.describe('import preview workspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/release-manifest', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(releaseManifestFixture),
      });
    });

    await page.route('**/api/support-matrix', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(supportMatrixFixture),
      });
    });
  });

test('previews a local CSV file through the native picker path without claiming benchmark ownership', async ({ page }) => {
    await page.addInitScript(({ csvText }) => {
      const host = window as typeof window & {
        __nativePickerCallCount?: number;
      };
      host.__nativePickerCallCount = 0;

      Object.defineProperty(window, 'showOpenFilePicker', {
        configurable: true,
        value: async () => {
          host.__nativePickerCallCount = (host.__nativePickerCallCount ?? 0) + 1;

          return [
            {
              async getFile() {
                return new File([csvText], 'import.clean.csv-preview.csv', {
                  type: 'text/csv',
                });
              },
            },
          ];
        },
      });
    }, { csvText: cleanCsvFixtureText });

    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await page.getByRole('button', { name: 'Choose CSV file' }).click();

    await expectAc3Outcome(page);
    await expect
      .poll(() =>
        page.evaluate(() => (window as typeof window & { __nativePickerCallCount?: number }).__nativePickerCallCount ?? 0),
      )
      .toBe(1);
    await expect(page.getByText('Preview ready. The committed workspace is still unchanged.')).toBeVisible();
    await expect(page.getByText('Not yet committed')).toBeVisible();
    await expect(page.getByText('Not a clean benchmark fixture')).toBeVisible();
  });

  test('previews a local CSV file without claiming benchmark ownership', async ({ page }) => {
    await disableNativeFilePicker(page);
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose CSV file' }).click();
    await (await chooser).setFiles(csvFixture);

    await expectAc3Outcome(page);
    await expect(page.getByText('Preview ready. The committed workspace is still unchanged.')).toBeVisible();
    await expect(page.getByText('Not yet committed')).toBeVisible();
    await expect(page.getByText('Delimiter handling')).toBeVisible();
    await expect(page.getByText('Comma (,)')).toBeVisible();
    await expect(page.getByText('Not a clean benchmark fixture')).toBeVisible();
  });

  test('previews the BMAD clean CSV benchmark fixture without a test-only hint path', async ({ page }) => {
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await page.getByRole('button', { name: 'Preview BMAD clean CSV benchmark' }).click();

    await expectAc3Outcome(page);
    await expect(page.getByText('Preview ready. The committed workspace is still unchanged.')).toBeVisible();
    await expect(page.getByText('import.clean.csv-preview', { exact: true })).toBeVisible();
    await expect(page.getByText('Not yet committed')).toBeVisible();
  });

  test('shows a visible in-progress state when preview readiness crosses the AC3 budget', async ({ page }) => {
    await page.addInitScript(({ budgetMs }) => {
      class SlowImportWorker {
        onmessage: ((event: MessageEvent) => void) | null;
        onerror: ((event: ErrorEvent) => void) | null;
        onmessageerror: ((event: MessageEvent) => void) | null;
        terminated: boolean;

        constructor() {
          this.onmessage = null;
          this.onerror = null;
          this.onmessageerror = null;
          this.terminated = false;
        }

        postMessage(message: {
          correlationId: string;
          messageId: string;
          workspaceVersion: number;
        }) {
          const preview = {
            previewId: 'preview_pasted-table_2_3',
            source: {
              sourceKind: 'pasted-table',
              sourceLabel: 'Pasted table',
              mimeType: 'text/plain',
              sheetName: null,
              benchmarkScenario: 'import.clean.paste-preview',
            },
            rowCount: 2,
            isPartialPreview: false,
            columnCount: 3,
            columns: [
              {
                columnId: 'col_1',
                sourceName: 'Sample',
                sampleValues: ['A-1', 'A-2'],
                inferredType: 'text',
                confidence: 'high',
                nonEmptyCount: 2,
                nullCount: 0,
              },
              {
                columnId: 'col_2',
                sourceName: 'Reading',
                sampleValues: ['42.5', '43.1'],
                inferredType: 'numeric',
                confidence: 'medium',
                nonEmptyCount: 2,
                nullCount: 0,
              },
              {
                columnId: 'col_3',
                sourceName: 'MeasuredAt',
                sampleValues: ['2026-04-18', '2026-04-19'],
                inferredType: 'date',
                confidence: 'medium',
                nonEmptyCount: 2,
                nullCount: 0,
              },
            ],
            sampleRows: [
              {
                rowId: 'row_1',
                cells: [
                  { columnId: 'col_1', value: 'A-1' },
                  { columnId: 'col_2', value: '42.5' },
                  { columnId: 'col_3', value: '2026-04-18' },
                ],
              },
              {
                rowId: 'row_2',
                cells: [
                  { columnId: 'col_1', value: 'A-2' },
                  { columnId: 'col_2', value: '43.1' },
                  { columnId: 'col_3', value: '2026-04-19' },
                ],
              },
            ],
            assumptions: [
              {
                assumptionId: 'assumption_delimiter',
                category: 'delimiter',
                label: 'Delimiter handling',
                value: 'Tab',
                confidence: 'high',
              },
            ],
            uncertainties: [],
            timing: {
              durationMs: budgetMs + 2_500,
              budgetMs,
              exceededBudget: true,
            },
          };

          window.setTimeout(() => {
            if (this.terminated || !this.onmessage) {
              return;
            }

            this.onmessage(
              new MessageEvent('message', {
                data: {
                  schemaVersion: '1.0.0',
                  messageId: `${message.messageId}.parsing`,
                  correlationId: message.correlationId,
                  workspaceVersion: message.workspaceVersion,
                  type: 'import.preview.progress',
                  payload: {
                    phase: 'parsing',
                    message: 'Parsing rows in the import worker.',
                  },
                },
              }),
            );
          }, 0);

          window.setTimeout(() => {
            if (this.terminated || !this.onmessage) {
              return;
            }

            this.onmessage(
              new MessageEvent('message', {
                data: {
                  schemaVersion: '1.0.0',
                  messageId: `${message.messageId}.success`,
                  correlationId: message.correlationId,
                  workspaceVersion: message.workspaceVersion,
                  type: 'import.preview.success',
                  payload: {
                    preview,
                  },
                },
              }),
            );
          }, budgetMs + 2_500);
        }

        terminate() {
          this.terminated = true;
        }
      }

      Object.defineProperty(window, 'Worker', {
        configurable: true,
        value: SlowImportWorker,
      });
    }, { budgetMs: 5_000 });

    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await page.getByLabel('Paste tabular data').fill('Sample\tReading\tMeasuredAt\nA-1\t42.5\t2026-04-18\nA-2\t43.1\t2026-04-19');
    await page.getByRole('button', { name: 'Preview pasted table' }).click();

    await expect(
      page.getByText('This preview crossed the 5s target, so the in-progress state stays visible until parsing finishes.'),
    ).toBeVisible({ timeout: 7_000 });
    await expect(page.getByText('Preview ready. The committed workspace is still unchanged.')).toBeVisible();
  });

  test('previews a local Excel workbook and shows workbook-specific source details', async ({ page }) => {
    await disableNativeFilePicker(page);
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose Excel file' }).click();
    await (await chooser).setFiles(excelFixture);

    await expectAc3Outcome(page);
    await expect(page.getByText('Preview ready. The committed workspace is still unchanged.')).toBeVisible();
    await expect(page.getByText('Workbook cells do not rely on a delimiter')).toBeVisible();
    await expect(page.getByText('import.clean.excel-preview', { exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'MeasuredAt' })).toBeVisible();
  });

  test('previews the BMAD clean pasted benchmark fixture without a test-only hint path', async ({ page }) => {
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await page.getByRole('button', { name: 'Preview BMAD clean pasted benchmark' }).click();

    await expectAc3Outcome(page);
    await expect(page.getByText('Preview ready. The committed workspace is still unchanged.')).toBeVisible();
    await expect(page.getByText('import.clean.paste-preview', { exact: true })).toBeVisible();
    await expect(page.getByText('No column-level uncertainty was detected in the preview sample.')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'MeasuredAt' })).toBeVisible();
  });

  test('keeps the standard paste flow untagged even when the text matches the BMAD benchmark sample', async ({ page }) => {
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await page
      .getByLabel('Paste tabular data')
      .fill('Sample\tReading\tMeasuredAt\nA-1\t42.5\t2026-04-18\nA-2\t44.1\t2026-04-19\nA-3\t43.8\t2026-04-20');
    await page.getByRole('button', { name: 'Preview pasted table' }).click();

    await expectAc3Outcome(page);
    await expect(page.getByText('Preview ready. The committed workspace is still unchanged.')).toBeVisible();
    await expect(page.getByText('Not a clean benchmark fixture')).toBeVisible();
  });

  test('keeps empty pasted-table validation local to the paste form', async ({ page }) => {
    await disableNativeFilePicker(page);
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose CSV file' }).click();
    await (await chooser).setFiles(csvFixture);

    await expect(page.getByText('Not yet committed')).toBeVisible();

    await page.getByLabel('Paste tabular data').fill('');
    await page.getByRole('button', { name: 'Preview pasted table' }).click();

    await expect(page.getByText('Paste some tabular data first')).toBeVisible();
    await expect(page.getByText('Not yet committed')).toBeVisible();
  });

  test('surfaces uncertainty summaries for mixed pasted tables', async ({ page }) => {
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await page.getByLabel('Paste tabular data').fill(
      'Sample\tReading\tMeasuredAt\nA-1\t42.5\t2026-04-18\nA-2\t41.1\t2026-04-19\nA-3\tuncertain\t2026-04-20',
    );
    await page.getByRole('button', { name: 'Preview pasted table' }).click();

    await expect(page.getByText('Preview ready. The committed workspace is still unchanged.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Uncertainty' })).toBeVisible();
    await expect(page.getByText(/mixes numeric\/date-looking values with text/i)).toBeVisible();
  });
});
