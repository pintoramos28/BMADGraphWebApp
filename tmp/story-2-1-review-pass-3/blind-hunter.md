- [high] `src/features/import/workspace-import-route.tsx` (`beginImport` / `scheduleBudgetTimer`): file imports now enter `parsing` and arm the 5s budget before the user has selected a file. Leaving the chooser open is enough to trip the over-budget banner even when parsing is instantaneous, so the performance signal is now measuring chooser dwell time as import latency.

- [high] `src/features/import/workspace-import-route.tsx` (`beginImport` / `postWorkerImport`): starting a newer import only ignores stale worker messages; it never cancels the older worker job. A large stale parse will keep burning CPU in the shared worker and can slow the active import even though its result is thrown away.

- [high] `src/features/import/workspace-import-route.tsx` (`handlePasteImport`): unlike the file paths, the paste path has no `try/catch` around worker creation/posting. If `new Worker(...)` or `postMessage(...)` throws, the store stays in `parsing` forever with no failure state.

- [high] `src/services/persistence/fs-access/local-import-files.ts` (`showOpenFilePicker` options): the native Excel picker advertises both `.xlsx` and `.xls` under the OOXML MIME only. Browsers that enforce MIME/extension pairing can hide or reject legacy `.xls` files, which contradicts the story’s `.xlsx`/`.xls` support claim.

- [medium] `src/features/import/normalize-preview.ts` (`maxColumnCount` from `previewRows`): once the row cap is active, columns that first appear after row 200 disappear from the preview entirely. The partial-preview treatment now samples not just counts and inference but the schema itself, so ragged files can look structurally valid when they are not.

- [medium] `src/features/import/parse-import-preview.ts` (`parseWorkbookRows`): the new sampling strategy only applies to delimited text. Excel still materializes the full first sheet with `sheet_to_json()` before normalization, so large workbooks keep the worst-case memory/latency profile that this pass removed for CSV/paste.

- [medium] `src/features/import/workspace-import-route.tsx` (partial-preview messaging/cards): the UI says only “row counts and inference summaries” reflect the sample, but it also renders sampled `columnCount`, sampled sample values, and sampled null/non-empty counts as if they were global facts. The copy still overstates how complete the preview is.

- [medium] `tests/e2e/import.spec.ts` / `src/features/import/store.spec.ts`: there is no coverage for the new “chooser open longer than budget” path, so the false over-budget behavior introduced by arming the timer before selection is untested.

- [medium] `tests/e2e/import.spec.ts` / `src/services/persistence/fs-access/local-import-files.spec.ts`: all browser tests force the hidden-input fallback, and the native-picker unit tests never assert the Excel accept map. The `.xls` regression in the native `showOpenFilePicker` path can ship unnoticed.

- [medium] `src/features/import/normalize-preview.spec.ts` / `src/features/import/parse-import-preview.spec.ts`: the new partial-preview tests only use uniform two-column data. There is still no regression coverage for schema drift after the 200-row window, which is exactly where the capped preview can now under-report columns and mixed-type uncertainties.
