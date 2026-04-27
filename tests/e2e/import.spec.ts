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
const delimiterRepairFixture = path.join(
  repoRoot,
  '_bmad-output',
  'benchmarks',
  'benchmark_set_dirty',
  'csv',
  'import.dirty.delimiter-repair.csv',
);
const headerRepairFixture = path.join(
  repoRoot,
  '_bmad-output',
  'benchmarks',
  'benchmark_set_dirty',
  'csv',
  'import.dirty.header-repair.csv',
);
const typeRepairFixture = path.join(
  repoRoot,
  '_bmad-output',
  'benchmarks',
  'benchmark_set_dirty',
  'csv',
  'import.dirty.type-repair.csv',
);
const missingValueRepairFixture = path.join(
  repoRoot,
  '_bmad-output',
  'benchmarks',
  'benchmark_set_dirty',
  'csv',
  'import.dirty.missing-value-repair.csv',
);
const cleanCsvFixtureText = fs.readFileSync(csvFixture, 'utf8');
const typeRepairFixtureText = fs.readFileSync(typeRepairFixture, 'utf8');
const ac3SlackMs = 2_000;
const previewReadyMessage = 'Preview ready. Repair any blocking issues, then confirm or reject the import.';
const previewConfirmedMessage = 'Preview confirmed. The canonical workspace now reflects this imported dataset.';

async function expectAc3Outcome(page: Page) {
  const readyMessage = page.getByText(previewReadyMessage);
  const budgetMessage = page.getByText('This preview crossed the 5s target, so the in-progress state stays visible until parsing finishes.');

  await Promise.any([
    readyMessage.waitFor({ state: 'visible', timeout: IMPORT_PREVIEW_BUDGET_MS }),
    budgetMessage.waitFor({ state: 'visible', timeout: IMPORT_PREVIEW_BUDGET_MS + ac3SlackMs }),
  ]);
}

async function chooseCsvFixture(page: Page, fixturePath: string) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose CSV file' }).click();
  await (await chooser).setFiles(fixturePath);
}

async function disableNativeFilePicker(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: undefined,
    });
  });
}

async function mockNativeCsvPicker(page: Page, input: { fileName: string; textContent: string }) {
  await page.addInitScript(({ fileName, textContent }) => {
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
              return new File([textContent], fileName, {
                type: 'text/csv',
              });
            },
          },
        ];
      },
    });
  }, input);
}

async function mockNativeCsvPickerWithOpfsHandle(page: Page, input: { fileName: string; textContent: string }) {
  await page.addInitScript(({ fileName, textContent }) => {
    const host = window as typeof window & {
      __nativePickerCallCount?: number;
    };
    const readCallCount = () => Number(window.sessionStorage.getItem('__nativePickerCallCount') ?? '0');
    const writeCallCount = (value: number) => {
      window.sessionStorage.setItem('__nativePickerCallCount', String(value));
      host.__nativePickerCallCount = value;
    };

    host.__nativePickerCallCount = readCallCount();

    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: async () => {
        if (window.sessionStorage.getItem('__nativePickerReuseGuard') === 'armed') {
          throw new Error('Native picker should not be re-run after persisted handle confirmation.');
        }

        const storageManager = navigator.storage as StorageManager & {
          getDirectory?: () => Promise<{
            getFileHandle: (name: string, options?: { create?: boolean }) => Promise<{
              name: string;
              getFile: () => Promise<File>;
              createWritable: () => Promise<{
                write: (data: string) => Promise<void>;
                close: () => Promise<void>;
              }>;
            }>;
          }>;
        };
        const directory = await storageManager.getDirectory?.();

        if (!directory) {
          throw new Error('OPFS file handles are unavailable in this browser context.');
        }

        const handle = await directory.getFileHandle(fileName, { create: true });
        const writable = await handle.createWritable();
        await writable.write(textContent);
        await writable.close();
        writeCallCount(readCallCount() + 1);

        return [handle];
      },
    });
  }, input);
}

async function readPersistedWorkspaceHandleSummary(page: Page) {
  return page.evaluate(async () => {
    const requestToPromise = <T,>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
    });
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bmad-graph-web-app', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'));
    });
    const transaction = database.transaction('workspaceRecords', 'readonly');
    const record = await requestToPromise(transaction.objectStore('workspaceRecords').get('workspace_import_preview')) as {
      datasetFileHandles?: Array<{
        fileName?: string;
        fileSha256?: string;
        handle?: {
          name?: string;
          getFile?: unknown;
          createWritable?: unknown;
        };
      }>;
    } | undefined;

    database.close();

    return (record?.datasetFileHandles ?? []).map((entry) => ({
      fileName: entry.fileName,
      fileSha256: entry.fileSha256,
      handleName: entry.handle?.name,
      canReadHandle: typeof entry.handle?.getFile === 'function',
      canWriteHandle: typeof entry.handle?.createWritable === 'function',
    }));
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

  test('previews a local CSV file through the persistence wrapper native-picker path when available', async ({ page }) => {
    await mockNativeCsvPicker(page, {
      fileName: 'import.clean.csv-preview.csv',
      textContent: cleanCsvFixtureText,
    });

    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await page.getByRole('button', { name: 'Choose CSV file' }).click();

    await expectAc3Outcome(page);
    await expect
      .poll(() =>
        page.evaluate(() => (window as typeof window & { __nativePickerCallCount?: number }).__nativePickerCallCount ?? 0),
      )
      .toBe(1);
    await expect(page.getByText(previewReadyMessage)).toBeVisible();
    await expect(page.getByText('Confirm or reject this import')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeEnabled();
    await expect(page.getByText('import.clean.csv-preview', { exact: true })).toBeVisible();
  });

  test('persists native-picker file handles through confirm, reload, and reopen sanitation', async ({ page }) => {
    await mockNativeCsvPickerWithOpfsHandle(page, {
      fileName: 'import.clean.csv-preview.csv',
      textContent: cleanCsvFixtureText,
    });

    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await page.getByRole('button', { name: 'Choose CSV file' }).click();

    await expectAc3Outcome(page);
    await page.getByRole('button', { name: 'Confirm Import' }).click();
    await expect(page.getByText(previewConfirmedMessage)).toBeVisible();

    await expect.poll(() => readPersistedWorkspaceHandleSummary(page)).toEqual([
      expect.objectContaining({
        fileName: 'import.clean.csv-preview.csv',
        fileSha256: expect.any(String),
        handleName: 'import.clean.csv-preview.csv',
        canReadHandle: true,
        canWriteHandle: true,
      }),
    ]);

    await page.evaluate(() => {
      window.sessionStorage.setItem('__nativePickerReuseGuard', 'armed');
    });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();
    await expect.poll(() => readPersistedWorkspaceHandleSummary(page)).toEqual([
      expect.objectContaining({
        fileName: 'import.clean.csv-preview.csv',
        fileSha256: expect.any(String),
        handleName: 'import.clean.csv-preview.csv',
        canReadHandle: true,
        canWriteHandle: true,
      }),
    ]);
    await page.getByLabel('Paste tabular data').fill('Sample\tReading\nB-1\t45.2');
    await page.getByRole('button', { name: 'Preview pasted table' }).click();
    await expectAc3Outcome(page);
    await page.getByRole('button', { name: 'Confirm Import' }).click();
    await expect(page.getByText(previewConfirmedMessage)).toBeVisible();
    await expect.poll(() => readPersistedWorkspaceHandleSummary(page)).toEqual([
      expect.objectContaining({
        fileName: 'import.clean.csv-preview.csv',
        fileSha256: expect.any(String),
        handleName: 'import.clean.csv-preview.csv',
        canReadHandle: true,
        canWriteHandle: true,
      }),
    ]);
    await expect
      .poll(() =>
        page.evaluate(() => Number(window.sessionStorage.getItem('__nativePickerCallCount') ?? '0')),
      )
      .toBe(1);

    await page.goto('/workspace/workspace_import_preview');
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();
    await expect.poll(() => readPersistedWorkspaceHandleSummary(page)).toEqual([
      expect.objectContaining({
        fileName: 'import.clean.csv-preview.csv',
        fileSha256: expect.any(String),
        handleName: 'import.clean.csv-preview.csv',
        canReadHandle: true,
        canWriteHandle: true,
      }),
    ]);
  });

  test('repairs a dirty CSV import through the native-picker path', async ({ page }) => {
    await mockNativeCsvPicker(page, {
      fileName: 'import.dirty.type-repair.csv',
      textContent: typeRepairFixtureText,
    });
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await page.getByRole('button', { name: 'Choose CSV file' }).click();

    await expectAc3Outcome(page);
    await expect(page.getByText('Confirm the data type for Reading')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeDisabled();

    await page.getByLabel('Confirmed type for Reading').selectOption({ label: 'Text' });

    await expectAc3Outcome(page);
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeEnabled();
    await expect(page.getByText('import.dirty.type-repair', { exact: true })).toBeVisible();
  });

  test('previews the owned clean CSV fixture through the supported fallback file flow', async ({ page }) => {
    await disableNativeFilePicker(page);
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await chooseCsvFixture(page, csvFixture);

    await expectAc3Outcome(page);
    await expect(page.getByText(previewReadyMessage)).toBeVisible();
    await expect(page.getByText('Confirm or reject this import')).toBeVisible();
    await expect(page.getByText('Delimiter handling')).toBeVisible();
    await expect(page.getByText('Comma (,)')).toBeVisible();
    await expect(page.getByText('import.clean.csv-preview', { exact: true })).toBeVisible();
  });

  test('previews the BMAD clean CSV benchmark fixture without a test-only hint path', async ({ page }) => {
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await page.getByRole('button', { name: 'Preview BMAD clean CSV benchmark' }).click();

    await expectAc3Outcome(page);
    await expect(page.getByText(previewReadyMessage)).toBeVisible();
    await expect(page.getByText('import.clean.csv-preview', { exact: true })).toBeVisible();
    await expect(page.getByText('Confirm or reject this import')).toBeVisible();
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
            issues: [],
            repairSelections: {
              delimiter: null,
              headerSelection: null,
              columnTypeOverrides: {},
              missingValuePolicy: null,
            },
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
    await expect(page.getByText(previewReadyMessage)).toBeVisible();
  });

  test('previews a local Excel workbook and shows workbook-specific source details', async ({ page }) => {
    await disableNativeFilePicker(page);
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose Excel file' }).click();
    await (await chooser).setFiles(excelFixture);

    await expectAc3Outcome(page);
    await expect(page.getByText(previewReadyMessage)).toBeVisible();
    await expect(page.getByText('Workbook cells do not rely on a delimiter')).toBeVisible();
    await expect(page.getByText('import.clean.excel-preview', { exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'MeasuredAt' })).toBeVisible();
  });

  test('previews the BMAD clean pasted benchmark fixture without a test-only hint path', async ({ page }) => {
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await page.getByRole('button', { name: 'Preview BMAD clean pasted benchmark' }).click();

    await expectAc3Outcome(page);
    await expect(page.getByText(previewReadyMessage)).toBeVisible();
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
    await expect(page.getByText(previewReadyMessage)).toBeVisible();
    await expect(page.getByText('Not a clean benchmark fixture')).toBeVisible();
  });

  test('supports dirty repair through pasted non-benchmark intake', async ({ page }) => {
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await page
      .getByLabel('Paste tabular data')
      .fill('Sample\tReading\nA-1\t42.5\nA-2\t\nA-3\t44.1');
    await page.getByRole('button', { name: 'Preview pasted table' }).click();

    await expectAc3Outcome(page);
    await expect(page.getByText('Choose how missing or malformed values should be handled')).toBeVisible();
    await expect(page.getByText('Not a clean benchmark fixture')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeDisabled();

    await page
      .getByLabel('Missing-value handling')
      .selectOption({ label: 'Keep rows and mark missing or malformed cells as empty' });

    await expectAc3Outcome(page);
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeEnabled();
  });

  test('keeps empty pasted-table validation local to the paste form', async ({ page }) => {
    await disableNativeFilePicker(page);
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await chooseCsvFixture(page, csvFixture);

    await expect(page.getByText('Confirm or reject this import')).toBeVisible();

    await page.getByLabel('Paste tabular data').fill('');
    await page.getByRole('button', { name: 'Preview pasted table' }).click();

    await expect(page.getByText('Paste some tabular data first')).toBeVisible();
    await expect(page.getByText('Confirm or reject this import')).toBeVisible();
  });

  test('surfaces uncertainty summaries for mixed pasted tables', async ({ page }) => {
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await page.getByLabel('Paste tabular data').fill(
      'Sample\tReading\tMeasuredAt\nA-1\t42.5\t2026-04-18\nA-2\t41.1\t2026-04-19\nA-3\tuncertain\t2026-04-20',
    );
    await page.getByRole('button', { name: 'Preview pasted table' }).click();

    await expect(page.getByText(previewReadyMessage)).toBeVisible();
    await expect(page.getByText('Not a clean benchmark fixture')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Uncertainty' })).toBeVisible();
    await expect(page.getByText(/mixes multiple value patterns and must be confirmed before import/i)).toBeVisible();
  });

  test('requires delimiter confirmation before a dirty delimiter repair import can be confirmed', async ({ page }) => {
    await disableNativeFilePicker(page);
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await chooseCsvFixture(page, delimiterRepairFixture);

    await expectAc3Outcome(page);
    await expect(page.getByText('Confirm the delimiter before import')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeDisabled();

    await page.getByLabel('Delimiter choice').selectOption({ label: 'Semicolon (;)' });

    await expectAc3Outcome(page);
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeEnabled();

    await page.getByRole('button', { name: 'Confirm Import' }).click();

    await expect(page.getByText(previewConfirmedMessage)).toBeVisible();
    await expect(page.getByText('Canonical workspace updated')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Reject Import' })).toHaveCount(0);
  });

  test('requires first-row confirmation before a dirty header repair import can be confirmed', async ({ page }) => {
    await disableNativeFilePicker(page);
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await chooseCsvFixture(page, headerRepairFixture);

    await expectAc3Outcome(page);
    await expect(page.getByText('Confirm how the first row should be interpreted')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeDisabled();

    await page.getByLabel('First-row handling').selectOption({ label: 'Treat the first row as headers' });

    await expectAc3Outcome(page);
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeEnabled();

    await page.getByRole('button', { name: 'Confirm Import' }).click();

    await expect(page.getByText(previewConfirmedMessage)).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Value' }).first()).toBeVisible();
  });

  test('requires explicit column type confirmation before a dirty type repair import can be confirmed', async ({ page }) => {
    await disableNativeFilePicker(page);
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await chooseCsvFixture(page, typeRepairFixture);

    await expectAc3Outcome(page);
    await expect(page.getByText('Confirm the data type for Reading')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeDisabled();

    await page.getByLabel('Confirmed type for Reading').selectOption({ label: 'Text' });

    await expectAc3Outcome(page);
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeEnabled();

    await page.getByRole('button', { name: 'Confirm Import' }).click();

    await expect(page.getByText(previewConfirmedMessage)).toBeVisible();
    await expect(page.getByText('Canonical workspace updated')).toBeVisible();
  });

  test('requires a missing-value policy before a dirty missing-value repair import can be confirmed', async ({ page }) => {
    await disableNativeFilePicker(page);
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await chooseCsvFixture(page, missingValueRepairFixture);

    await expectAc3Outcome(page);
    await expect(page.getByText('Choose how missing or malformed values should be handled')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeDisabled();

    await page
      .getByLabel('Missing-value handling')
      .selectOption({ label: 'Exclude rows with missing or malformed values' });

    await expectAc3Outcome(page);
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeEnabled();
    await expect(page.getByText('Missing-value handling is configured')).toBeVisible();

    await page.getByRole('button', { name: 'Confirm Import' }).click();

    await expect(page.getByText(previewConfirmedMessage)).toBeVisible();
    await expect(page.getByText(/Showing the first 2 preview rows and 2 columns, prepared in/i)).toBeVisible();
    await expect(page.getByText(/This delimited import is showing the first 2 rows only/i)).toBeVisible();
  });

  test('rejecting a preview leaves the canonical workspace unchanged', async ({ page }) => {
    await disableNativeFilePicker(page);
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await chooseCsvFixture(page, csvFixture);

    await expectAc3Outcome(page);
    await expect(page.locator('article').filter({ hasText: 'Canonical datasets' })).toContainText('0');

    await page.getByRole('button', { name: 'Reject Import' }).click();

    await expect(page.getByText(previewReadyMessage)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reject Import' })).toHaveCount(0);

    await chooseCsvFixture(page, csvFixture);

    await expectAc3Outcome(page);
    await expect(page.locator('article').filter({ hasText: 'Canonical datasets' })).toContainText('0');
  });

  test('confirmed imports persist after in-app navigation away from and back to the workspace route', async ({ page }) => {
    await disableNativeFilePicker(page);
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await chooseCsvFixture(page, csvFixture);

    await expectAc3Outcome(page);
    await page.getByRole('button', { name: 'Confirm Import' }).click();

    await expect(page.getByText(previewConfirmedMessage)).toBeVisible();
    await expect(page.locator('article').filter({ hasText: 'Canonical datasets' })).toContainText('1');

    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('heading', { name: 'Shell readiness' })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();
    await chooseCsvFixture(page, csvFixture);
    await expectAc3Outcome(page);
    await expect(page.locator('article').filter({ hasText: 'Canonical datasets' })).toContainText('1');
  });

  test('confirmed imports reopen through the persisted preview workspace route after a hard reload', async ({ page }) => {
    await disableNativeFilePicker(page);
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await chooseCsvFixture(page, csvFixture);

    await expectAc3Outcome(page);
    await page.getByRole('button', { name: 'Confirm Import' }).click();

    await expect(page.getByText(previewConfirmedMessage)).toBeVisible();

    await page.goto('/workspace/workspace_import_preview');
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await chooseCsvFixture(page, csvFixture);
    await expectAc3Outcome(page);
    await expect(page.locator('article').filter({ hasText: 'Canonical datasets' })).toContainText('1');
  });

  test('persists semantic edits and updates the graph-ready summary without re-import', async ({ page }) => {
    await disableNativeFilePicker(page);
    await page.goto(workspacePreviewRoute);
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await chooseCsvFixture(page, csvFixture);

    await expectAc3Outcome(page);
    await page.getByRole('button', { name: 'Confirm Import' }).click();
    await expect(page.getByText(previewConfirmedMessage)).toBeVisible();

    await expect(page.getByRole('region', { name: 'Workspace semantics' })).toBeVisible();
    await page.getByLabel('Semantic role for Reading').selectOption('y');
    await page.getByLabel('Unit for Reading').fill('ms');
    await page.getByLabel('Measurement context for Reading').fill('Instrument reading captured after stabilization.');
    await page.getByLabel('Label for Reading').fill('Observed Reading');
    await page.getByRole('button', { name: 'Save semantics for Observed Reading' }).click();

    await expect(page.getByText('Saved semantic choices for Observed Reading.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Graph-ready semantic summary' })).toBeVisible();
    await expect(page.getByText('y: Observed Reading')).toBeVisible();

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();
    await expect(page.getByLabel('Label for Observed Reading')).toHaveValue('Observed Reading');
    await expect(page.getByText('y: Observed Reading')).toBeVisible();
    await expect(page.getByText('Confirm or reject this import')).toHaveCount(0);
  });
});
