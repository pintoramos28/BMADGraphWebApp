import { expect, test } from '@playwright/test';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..');
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

test.describe('import preview workspace', () => {
  test('previews a local CSV file without claiming it is committed', async ({ page }) => {
    await page.goto('/workspace/workspace_demo');
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose CSV file' }).click();
    await (await chooser).setFiles(csvFixture);

    await expect(page.getByText('Preview ready. The committed workspace is still unchanged.')).toBeVisible();
    await expect(page.getByText('Not yet committed')).toBeVisible();
    await expect(page.getByText('Delimiter handling')).toBeVisible();
    await expect(page.getByText('Comma (,)')).toBeVisible();
    await expect(page.getByText('import.clean.csv-preview')).toBeVisible();
  });

  test('previews a local Excel workbook and shows workbook-specific source details', async ({ page }) => {
    await page.goto('/workspace/workspace_demo');
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose Excel file' }).click();
    await (await chooser).setFiles(excelFixture);

    await expect(page.getByText('Preview ready. The committed workspace is still unchanged.')).toBeVisible();
    await expect(page.getByText('Workbook cells do not rely on a delimiter')).toBeVisible();
    await expect(page.getByText('import.clean.excel-preview')).toBeVisible();
    await expect(page.getByText('MeasuredAt')).toBeVisible();
  });

  test('previews pasted tables and surfaces uncertainty summaries', async ({ page }) => {
    await page.goto('/workspace/workspace_demo');
    await expect(page.getByRole('heading', { name: 'Import preview workspace' })).toBeVisible();

    await page.getByLabel('Paste tabular data').fill(
      'Sample\tReading\tMeasuredAt\nA-1\t42.5\t2026-04-18\nA-2\tuncertain\t2026-04-19',
    );
    await page.getByRole('button', { name: 'Preview pasted table' }).click();

    await expect(page.getByText('Preview ready. The committed workspace is still unchanged.')).toBeVisible();
    await expect(page.getByText('Uncertainty')).toBeVisible();
    await expect(page.getByText('import.clean.paste-preview')).toBeVisible();
    await expect(page.getByText(/mixes numeric\/date-looking values with text/i)).toBeVisible();
  });
});
