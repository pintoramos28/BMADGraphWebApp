import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';

import { BrowserLocalImportFileAccess } from '../../services/persistence';
import {
  importPreviewFailureMessageSchema,
  importPreviewProgressMessageSchema,
  importPreviewSuccessMessageSchema,
} from '../../schemas/worker';
import { IMPORT_PREVIEW_BUDGET_MS, dispatchImportBenchmarkTimingEvent } from './benchmark-timing';
import { createImportPreviewStore } from './store';
import type { ImportSourceKind } from './preview-model';

function createCorrelationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `import_${Date.now()}`;
}

function formatDuration(durationMs: number) {
  return `${(durationMs / 1000).toFixed(2)}s`;
}

const sectionCardStyle = {
  padding: '1rem 1.1rem',
  borderRadius: '1rem',
  background: '#f9f6f1',
  border: '1px solid rgba(31, 42, 54, 0.1)',
} as const;

export function WorkspaceImportRoute({ workspaceId }: { workspaceId?: string }) {
  const storeRef = useRef(createImportPreviewStore());
  const fileAccessRef = useRef(new BrowserLocalImportFileAccess());
  const workerRef = useRef<Worker | null>(null);
  const budgetTimerRef = useRef<number | null>(null);
  const [pasteText, setPasteText] = useState('');

  const status = useStore(storeRef.current, (state) => state.status);
  const preview = useStore(storeRef.current, (state) => state.preview);
  const progress = useStore(storeRef.current, (state) => state.progress);
  const error = useStore(storeRef.current, (state) => state.error);
  const budgetExceeded = useStore(storeRef.current, (state) => state.budgetExceeded);
  const timingEvent = useStore(storeRef.current, (state) => state.lastTimingEvent);

  useEffect(() => {
    return () => {
      if (budgetTimerRef.current !== null) {
        window.clearTimeout(budgetTimerRef.current);
      }

      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  function clearBudgetTimer() {
    if (budgetTimerRef.current !== null) {
      window.clearTimeout(budgetTimerRef.current);
      budgetTimerRef.current = null;
    }
  }

  function scheduleBudgetTimer() {
    clearBudgetTimer();
    budgetTimerRef.current = window.setTimeout(() => {
      storeRef.current.getState().commands.markBudgetExceeded();
    }, IMPORT_PREVIEW_BUDGET_MS);
  }

  function ensureWorker() {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../../workers/import.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current.onmessage = (event: MessageEvent) => {
        const progressMessage = importPreviewProgressMessageSchema.safeParse(event.data);

        if (progressMessage.success) {
          storeRef.current.getState().commands.updateProgress(progressMessage.data.payload);
          return;
        }

        const successMessage = importPreviewSuccessMessageSchema.safeParse(event.data);

        if (successMessage.success) {
          clearBudgetTimer();
          const benchmarkEvent = dispatchImportBenchmarkTimingEvent(successMessage.data.payload.preview);
          storeRef.current.getState().commands.resolveImport(successMessage.data.payload.preview, benchmarkEvent);
          return;
        }

        const failureMessage = importPreviewFailureMessageSchema.safeParse(event.data);

        if (failureMessage.success) {
          clearBudgetTimer();
          storeRef.current.getState().commands.failImport(failureMessage.data.payload);
        }
      };
    }

    return workerRef.current;
  }

  async function beginWorkerImport(
    sourceKind: ImportSourceKind,
    payload: {
      sourceLabel: string;
      fileName?: string;
      mimeType?: string | null;
      textContent?: string | null;
      binaryContent?: ArrayBuffer | null;
    },
  ) {
    const correlationId = createCorrelationId();
    storeRef.current.getState().commands.beginImport(correlationId, sourceKind);
    scheduleBudgetTimer();

    ensureWorker().postMessage(
      {
        schemaVersion: '1.0.0',
        messageId: `import_preview_${correlationId}`,
        correlationId,
        workspaceVersion: 1,
        type: 'import.preview.request',
        payload: {
          sourceKind,
          ...payload,
        },
      },
      payload.binaryContent ? [payload.binaryContent] : [],
    );
  }

  async function handleFileImport(sourceKind: Extract<ImportSourceKind, 'csv-file' | 'excel-file'>) {
    try {
      const file = await fileAccessRef.current.openLocalImportFile({
        sourceKind,
      });

      if (!file) {
        return;
      }

      if (sourceKind === 'excel-file') {
        await beginWorkerImport(sourceKind, {
          sourceLabel: 'Local Excel workbook',
          fileName: file.name,
          mimeType: file.type || null,
          binaryContent: await file.arrayBuffer(),
        });
        return;
      }

      await beginWorkerImport(sourceKind, {
        sourceLabel: 'Local CSV file',
        fileName: file.name,
        mimeType: file.type || null,
        textContent: await file.text(),
      });
    } catch (caughtError) {
      clearBudgetTimer();
      storeRef.current.getState().commands.failImport({
        code: 'import.preview.selection-failed',
        title: 'File selection could not start',
        detail: caughtError instanceof Error ? caughtError.message : 'The selected file could not be opened.',
        retryable: true,
      });
    }
  }

  async function handlePasteImport() {
    if (pasteText.trim().length === 0) {
      storeRef.current.getState().commands.failImport({
        code: 'import.preview.empty-paste',
        title: 'Paste some tabular data first',
        detail: 'The preview workspace needs at least one row of pasted text before it can infer assumptions.',
        retryable: true,
      });
      return;
    }

    await beginWorkerImport('pasted-table', {
      sourceLabel: 'Pasted table',
      mimeType: 'text/plain',
      textContent: pasteText,
    });
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <header style={{ display: 'grid', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Import preview workspace</h2>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          Start with CSV, Excel, or pasted rows. BMADGraphWebApp prepares a preview-only workspace first so the
          committed workspace stays untouched until later stories add confirmation.
        </p>
        <p style={{ margin: 0, lineHeight: 1.6, color: '#6f5b45' }}>
          Active route workspace: <strong>{workspaceId ?? 'workspace index'}</strong>
        </p>
      </header>

      <section
        aria-label="Import entrypoints"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
          gap: '1rem',
        }}
      >
        <article style={sectionCardStyle}>
          <h3 style={{ marginTop: 0 }}>CSV file</h3>
          <p style={{ lineHeight: 1.6 }}>
            Choose a local comma-, semicolon-, tab-, or pipe-delimited file through the persistence boundary.
          </p>
          <button type="button" onClick={() => void handleFileImport('csv-file')}>
            Choose CSV file
          </button>
        </article>

        <article style={sectionCardStyle}>
          <h3 style={{ marginTop: 0 }}>Excel workbook</h3>
          <p style={{ lineHeight: 1.6 }}>Open a local `.xlsx` or `.xls` workbook and preview the first sheet only.</p>
          <button type="button" onClick={() => void handleFileImport('excel-file')}>
            Choose Excel file
          </button>
        </article>

        <article style={sectionCardStyle}>
          <h3 style={{ marginTop: 0 }}>Pasted table</h3>
          <label htmlFor="pasted-table-input" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
            Paste tabular data
          </label>
          <textarea
            id="pasted-table-input"
            value={pasteText}
            onChange={(event) => setPasteText(event.currentTarget.value)}
            rows={6}
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            placeholder={'Sample\tReading\tMeasuredAt\nA-1\t42.5\t2026-04-18'}
          />
          <div style={{ marginTop: '0.75rem' }}>
            <button type="button" onClick={() => void handlePasteImport()}>
              Preview pasted table
            </button>
          </div>
        </article>
      </section>

      <section aria-live="polite" style={sectionCardStyle}>
        <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Preview status</strong>
        {status === 'idle' ? (
          <span>Pick a source to start a preview-only import.</span>
        ) : null}
        {status === 'parsing' ? (
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span>{progress?.message ?? 'Preparing the local preview workspace.'}</span>
            <span>
              {budgetExceeded
                ? `This preview crossed the ${IMPORT_PREVIEW_BUDGET_MS / 1000}s target, so the in-progress state stays visible until parsing finishes.`
                : 'The preview is running in a worker so the shell stays responsive.'}
            </span>
          </div>
        ) : null}
        {status === 'error' && error ? (
          <div role="alert" style={{ display: 'grid', gap: '0.35rem' }}>
            <span>{error.title}</span>
            <span>{error.detail}</span>
          </div>
        ) : null}
        {status === 'ready' && preview ? (
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Preview ready. The committed workspace is still unchanged.</span>
            <span>
              {preview.rowCount} rows, {preview.columnCount} columns, prepared in {formatDuration(preview.timing.durationMs)}.
            </span>
          </div>
        ) : null}
      </section>

      {preview ? (
        <>
          <section
            style={{
              ...sectionCardStyle,
              background: 'rgba(227, 177, 104, 0.16)',
            }}
          >
            <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Not yet committed</strong>
            <span>
              This preview lives outside the canonical workspace snapshot. Commit, repair, and semantic confirmation are
              intentionally deferred to later stories.
            </span>
          </section>

          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
              gap: '0.75rem',
            }}
          >
            <article style={sectionCardStyle}>
              <strong>Source</strong>
              <div>{preview.source.fileName ?? preview.source.sourceLabel}</div>
            </article>
            <article style={sectionCardStyle}>
              <strong>Rows</strong>
              <div>{preview.rowCount}</div>
            </article>
            <article style={sectionCardStyle}>
              <strong>Columns</strong>
              <div>{preview.columnCount}</div>
            </article>
            <article style={sectionCardStyle}>
              <strong>Benchmark hook</strong>
              <div>{timingEvent?.scenario ?? preview.source.benchmarkScenario}</div>
            </article>
          </section>

          <section style={{ display: 'grid', gap: '0.75rem' }}>
            <h3 style={{ marginBottom: 0 }}>Assumptions</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))',
                gap: '0.75rem',
              }}
            >
              {preview.assumptions.map((assumption) => (
                <article key={assumption.assumptionId} style={sectionCardStyle}>
                  <strong>{assumption.label}</strong>
                  <div style={{ marginTop: '0.35rem' }}>{assumption.value}</div>
                  <div style={{ marginTop: '0.35rem', color: '#6f5b45' }}>Confidence: {assumption.confidence}</div>
                  {assumption.details ? <div style={{ marginTop: '0.35rem' }}>{assumption.details}</div> : null}
                </article>
              ))}
            </div>
          </section>

          <section style={{ display: 'grid', gap: '0.75rem' }}>
            <h3 style={{ marginBottom: 0 }}>Uncertainty</h3>
            {preview.uncertainties.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.6 }}>
                {preview.uncertainties.map((uncertainty) => (
                  <li key={uncertainty.uncertaintyId}>
                    {uncertainty.message}
                    {uncertainty.columnId ? ` (${uncertainty.columnId})` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, lineHeight: 1.6 }}>No column-level uncertainty was detected in the preview sample.</p>
            )}
          </section>

          <section style={{ display: 'grid', gap: '0.75rem' }}>
            <h3 style={{ marginBottom: 0 }}>Column inventory</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th align="left">Column</th>
                    <th align="left">Inference</th>
                    <th align="left">Confidence</th>
                    <th align="left">Sample values</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.columns.map((column) => (
                    <tr key={column.columnId}>
                      <td style={{ padding: '0.45rem 0.25rem' }}>{column.sourceName}</td>
                      <td style={{ padding: '0.45rem 0.25rem' }}>{column.inferredType}</td>
                      <td style={{ padding: '0.45rem 0.25rem' }}>{column.confidence}</td>
                      <td style={{ padding: '0.45rem 0.25rem' }}>{column.sampleValues.join(', ') || 'No sample values'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ display: 'grid', gap: '0.75rem' }}>
            <h3 style={{ marginBottom: 0 }}>Sample rows</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {preview.columns.map((column) => (
                      <th key={column.columnId} align="left">
                        {column.sourceName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.map((row) => (
                    <tr key={row.rowId}>
                      {row.cells.map((cell) => (
                        <td key={`${row.rowId}_${cell.columnId}`} style={{ padding: '0.45rem 0.25rem' }}>
                          {cell.value || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => storeRef.current.getState().commands.reset()}>
              Clear preview
            </button>
            <span style={{ alignSelf: 'center', color: '#6f5b45' }}>
              Commit remains intentionally unavailable in Story 2.1.
            </span>
          </div>
        </>
      ) : null}
    </section>
  );
}
