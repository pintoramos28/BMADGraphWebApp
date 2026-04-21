- `src/features/import/workspace-import-route.tsx`: `beginImport()` now starts before the user has picked a file, so the NFR timer measures dialog dwell time and local `File` reads, not just worker parsing. A user who spends a few seconds in the picker can be shown an over-budget import even when the actual preview generation is fast.

- `src/features/import/store.ts` and `src/features/import/workspace-import-route.tsx`: `beginImport()` no longer clears `preview`, but the route still renders the preview section whenever `preview` is non-null. Starting a second import therefore leaves the previous dataset, assumptions, sample rows, and “not yet committed” banner on screen while a different import is parsing.

- `src/features/import/workspace-import-route.tsx`: Because that stale preview stays mounted, the visible `Clear preview` button is still clickable during a new import. Pressing it calls `reset()` and clears the timer, which silently discards the in-flight import once its worker reply arrives and gets treated as stale.

- `src/features/import/workspace-import-route.tsx`: `handlePasteImport()` still calls `failImport(...)` without a correlation id for the empty-paste case. If the user hits “Preview pasted table” with empty input while another import is active, that unconditional error path can wipe out the active correlation and flip the store to `error`.

- `src/features/import/workspace-import-route.tsx`: Ignoring stale worker envelopes is not the same as cancelling stale work. When a user starts a new import or clears the preview, the old worker job keeps running to completion in the background, which means large parses still burn CPU and memory even though their results are thrown away.

- `src/features/import/parse-import-preview.ts` and `src/features/import/normalize-preview.ts`: Adding Papa Parse `preview` mode caps CSV/paste parsing to the first ~200 rows, but the resulting dataset still reports `rowCount` from that truncated sample with no “partial preview” flag. On larger files the UI will present sampled counts and assumptions as if they describe the full import.

- `src/features/import/parse-import-preview.ts`: The new row cap only exists for delimited text. Excel still runs `sheet_to_json()` over the entire first worksheet, so the story’s performance fix is inconsistent and the workbook path remains the easiest way to blow past the preview budget.

- `src/services/persistence/fs-access/local-import-files.ts`: The hidden-input fallback now treats cancellation as a no-op only if the browser fires `cancel` or the top-level window regains `focus`. Browsers that suppress both events for file dialogs still leave the promise unresolved, which strands the route in `parsing`.

- `tests/e2e/import.spec.ts`: Every Playwright test forces `window.showOpenFilePicker` to `undefined`, so the browser suite never exercises the native picker path that this patch specifically changed. The most important regression here is only covered by unit mocks, not by a real browser flow.

- `_bmad-output/implementation-artifacts/2-1-import-csv-excel-and-pasted-data-into-a-preview-workspace.md` and `src/features/import/workspace-import-route.tsx`: The story still claims keyboard-only import is viable end to end with cancel/continue actions, but the route exposes no explicit in-app cancel control for an active parse. Once the worker starts, the only “cancel” behavior is the accidental `Clear preview` reset described above, which is not a real accessible cancellation affordance.
