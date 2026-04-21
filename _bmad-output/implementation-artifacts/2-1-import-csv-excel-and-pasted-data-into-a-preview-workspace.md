# Story 2.1: Import CSV, Excel, and Pasted Data into a Preview Workspace

Status: review

## Story

As a user,
I want to import local tabular data into a preview state,
so that I can inspect what BMADGraphWebApp understood before committing it to analysis.

## Acceptance Criteria

1. Given a CSV, Excel file, or pasted table, when the user starts import, then the system creates a preview state without mutating the committed workspace yet.
2. Given import parsing runs, when preview is shown, then delimiter, header, date, numeric, and uncertainty assumptions are visible to the user before commit.
3. Given benchmark clean files are imported, when preview completes, then preview readiness meets the import performance target or shows a visible in-progress state if the threshold is exceeded.

## Dependencies

- Story 1.3: Create, Open, and Reopen Local Workspaces

## Contract Boundaries

- In scope: local CSV, Excel, and pasted-table intake; preview-only normalization; worker-based parsing; parse-assumption surfacing; clean benchmark fixture scaffolding; and accessible workspace-route UI for an uncommitted preview.
- Out of scope: repairing dirty imports beyond surfacing uncertainty, editable semantic correction beyond inferred preview display, final commit or reject persistence flows, graph recommendation, and guided onboarding or recovery copy systems owned by Stories 2.2 through 2.4.
- Owning paths: `src/features/import/**`, `src/workers/import.worker.ts`, `src/schemas/worker/import-messages.ts`, `src/services/persistence/fs-access/**`, `src/stores/view-state/**`, `src/app/router/shell-routes.tsx`, `tests/e2e/import.spec.ts`, and `_bmad-output/benchmarks/benchmark_set_clean/**`.
- Downstream consumers after completion: Story 2.2 uses the preview assumptions and uncertainty model for repair, Story 2.3 uses the normalized preview dataset and inferred semantics as the basis for editable semantic confirmation, and Story 2.4 layers guided onboarding and recovery copy onto the same intake surface.

## Tasks / Subtasks

- [x] Establish import preview contracts and source models. (AC: 1, 2)
  - [x] Add typed worker request, progress, success, and failure schemas under `src/schemas/worker/` for import preview flows.
  - [x] Define a BMAD-owned preview dataset model plus parse-assumption and uncertainty metadata instead of leaking parser-native objects into feature state.
  - [x] Standardize source identifiers for `csv-file`, `excel-file`, and `pasted-table` inputs and codify assumption categories for delimiter, header, numeric and date inference, and uncertainty.
- [x] Implement local-only ingestion adapters and worker parsing. (AC: 1, 2, 3)
  - [x] Add a local source-file access wrapper under `src/services/persistence/fs-access/` or an equivalent persistence-owned boundary instead of calling file pickers directly from route components.
  - [x] Create `src/workers/import.worker.ts` as a Vite module worker and keep parser execution off the main thread.
  - [x] Parse CSV and pasted tables with Papa Parse preview support and parse Excel workbooks with SheetJS CE from `ArrayBuffer`, then normalize both into BMAD preview rows, columns, and assumption summaries.
- [x] Build the import-first workspace surface without mutating committed workspace state. (AC: 1, 2)
  - [x] Replace the current workspace placeholder route with an intake panel that accepts CSV, Excel, and paste entrypoints while preserving the existing shell compatibility gate.
  - [x] Render a preview state with sample rows, column inventory, source details, and clearly labeled "not yet committed" status before any analytical commit occurs.
  - [x] Keep the flow keyboard-operable and screen-reader friendly, with explicit focus order, visible focus, and text equivalents for status and uncertainty.
- [x] Surface parsing assumptions, uncertainty, and performance state. (AC: 2, 3)
  - [x] Display delimiter, header, numeric, date, and uncertainty assumptions directly in the preview summary rather than burying them in logs or dev tooling.
  - [x] Show a visible in-progress state whenever preview readiness exceeds the NFR1 budget instead of blocking silently.
  - [x] Add redacted timing hooks for `import.clean.csv-preview`, `import.clean.excel-preview`, and `import.clean.paste-preview` without logging raw file contents or parsed rows.
- [x] Add fixtures and test coverage for clean import preview flows. (AC: 1, 2, 3)
  - [x] Create clean benchmark fixture scaffolding under `_bmad-output/benchmarks/benchmark_set_clean/` for CSV, Excel, and pasted-table scenarios, including a short metadata note for each fixture.
  - [x] Add unit coverage for worker contracts, normalization rules, and assumption detection, plus route or state tests proving preview does not mutate committed workspace state.
  - [x] Add Playwright coverage for CSV, Excel, and pasted preview flows on supported desktop browsers.

### Review Follow-ups (AI)

- [x] [AI-Review][High] Restrict benchmark scenario tagging to the owned clean benchmark fixtures instead of deriving `import.clean.*` from `sourceKind` alone, so arbitrary CSV, Excel, and pasted imports do not contaminate AC3 timing telemetry or falsely render the benchmark hook as a clean fixture. (AC: 3)
- [x] [AI-Review][Medium] Reject imports that normalize to zero previewable body rows instead of surfacing a ready empty preview when only a header row or other non-previewable rows remain after normalization. (AC: 1, 2)
- [x] [AI-Review][Medium] Apply the delimited preview cap after excluding non-previewable rows so leading delimiter-only rows cannot consume the Papa Parse sample window and hide later valid data without a partial-preview signal. (AC: 1, 2)
- [x] [AI-Review][Medium] Keep scanning sampled workbook rows until the Excel preview window contains previewable data rows, or flag the truncation explicitly, so leading empty-string cell rows do not suppress later real workbook data. (AC: 1, 2)
- [x] [AI-Review][High] Store the end-to-end benchmark duration back into the resolved preview timing so the ready-state "prepared in ..." summary reflects actual preview readiness latency instead of worker-only parse time. (AC: 3)

### Review Findings

- [x] [Review][Patch] Ignore stale worker messages after a newer import starts or the preview is cleared [src/features/import/workspace-import-route.tsx:77]
- [x] [Review][Patch] Treat native file-picker cancellation as a no-op instead of surfacing an import error [src/features/import/workspace-import-route.tsx:162]
- [x] [Review][Patch] Start correlation and budget tracking before awaiting local file reads so a slower earlier selection cannot overwrite a newer import and over-budget reads still surface the required in-progress state [src/features/import/workspace-import-route.tsx:154]
- [x] [Review][Patch] Resolve hidden-input fallback file-picker cancellation as a no-op instead of leaving the import promise hanging on browsers without `showOpenFilePicker()` [src/services/persistence/fs-access/local-import-files.ts:96]
- [x] [Review][Patch] Use Papa Parse preview support for CSV and pasted-table intake instead of parsing the full text payload every time [src/features/import/parse-import-preview.ts:32]
- [x] [Review][Patch] Clear the previous preview when a new import starts so stale dataset details and the `Clear preview` action do not remain interactive while a different import is parsing [src/features/import/store.ts:67]
- [x] [Review][Patch] Keep empty pasted-table validation local to the paste form instead of routing it through `failImport()`, which currently clears an existing preview even though no new import started [src/features/import/workspace-import-route.tsx:231]
- [x] [Review][Patch] Delay hidden-input cancellation long enough to distinguish a real cancel from a successful file selection whose `change` event lands just after window focus returns [src/services/persistence/fs-access/local-import-files.ts:129]
- [x] [Review][Patch] Do not present Papa Parse's sampled CSV/paste prefix as the full preview dataset; row counts and inference summaries need a partial-preview flag or equivalent UI signal once parsing is capped to `IMPORT_PREVIEW_ROW_LIMIT` rows [src/features/import/parse-import-preview.ts:35]
- [x] [Review][Patch] Add Playwright acceptance coverage for the clean pasted benchmark scenario instead of only asserting a mixed pasted-table path that still labels itself `import.clean.paste-preview` [tests/e2e/import.spec.ts:82]
- [x] [Review][Patch] Terminate or replace the active worker before posting a newer import so obsolete parsing cannot keep the shared worker busy and delay the current preview [src/features/import/workspace-import-route.tsx:89]
- [x] [Review][Patch] Separate correlation tracking from the over-budget timer so leaving the file chooser open does not trip the AC3 in-progress state before parsing actually starts [src/features/import/workspace-import-route.tsx:137]
- [x] [Review][Patch] Catch pasted-table worker startup and `postMessage()` failures so the route surfaces an import error instead of remaining stuck in `parsing` [src/features/import/workspace-import-route.tsx:233]
- [x] [Review][Patch] Advertise legacy `.xls` files under `application/vnd.ms-excel` in the native picker so supported workbooks remain selectable [src/services/persistence/fs-access/local-import-files.ts:87]
- [x] [Review][Patch] Apply the preview row cap before SheetJS materializes workbook rows so Excel imports follow the same bounded-preview performance model as CSV and pasted data [src/features/import/parse-import-preview.ts:56]
- [x] [Review][Patch] Add AC3 acceptance coverage for the import budget path so the suite proves either timely readiness or the visible in-progress state when the threshold is exceeded [tests/e2e/import.spec.ts:63]
- [x] [Review][Patch] Start the AC3 budget timer before awaiting `file.text()` or `file.arrayBuffer()` so slow local file reads can still surface the visible in-progress state [src/features/import/workspace-import-route.tsx:225]
- [x] [Review][Patch] Use workbook-specific partial-preview copy for Excel imports instead of labeling every capped preview as a delimited import [src/features/import/workspace-import-route.tsx:464]
- [x] [Review][Patch] Avoid the fixed 150 ms hidden-input cancellation race that can drop a legitimate delayed file selection on slower browsers or filesystems [src/services/persistence/fs-access/local-import-files.ts:141]
- [x] [Review][Patch] Detect capped Excel previews by populated preview rows rather than the first physical row window so sparse workbooks still set `isPartialPreview` when later data is truncated [src/features/import/parse-import-preview.ts:74]
- [x] [Review][Patch] Add AC3 acceptance proof for the clean benchmark fixtures themselves instead of relying only on the synthetic slow-worker budget-path test [tests/e2e/import.spec.ts:63]
- [x] [Review][Patch] Iterate Excel previews over populated worksheet rows instead of scanning every physical row in `!ref`, so sparse or inflated workbooks stay bounded by `IMPORT_PREVIEW_ROW_LIMIT` [src/features/import/parse-import-preview.ts:70]
- [x] [Review][Patch] Reject blank or non-previewable first worksheets instead of surfacing a successful zero-row preview [src/features/import/parse-import-preview.ts:152]
- [x] [Review][Patch] Add Playwright coverage for the native Chromium `showOpenFilePicker()` path instead of forcing the hidden-input fallback in every acceptance test [tests/e2e/import.spec.ts:78]
- [x] [Review][Patch] Mark the route as disposed during unmount so a pending picker or file-read continuation cannot recreate the worker and emit benchmark activity after the import screen is gone [src/features/import/workspace-import-route.tsx:120]
- [x] [Review][Patch] Advertise tab-delimited local imports in both picker paths so supported `.tsv` files are selectable from the CSV intake [src/services/persistence/fs-access/local-import-files.ts:50]
- [x] [Review][Patch] Bound Excel preview columns to the sampled populated column indexes instead of expanding from the minimum to maximum index, so one far-right cell cannot inflate the preview into thousands of blank columns [src/features/import/parse-import-preview.ts:156]
- [x] [Review][Patch] Include local file-read time in the benchmark timing payload so AC3 readiness telemetry reflects end-to-end preview latency instead of worker parse time only [src/features/import/workspace-import-route.tsx:221]
- [x] [Review][Patch] Verify clean CSV and Excel benchmark ownership with owned fixture content instead of filename-only matching [src/features/import/workspace-import-route.tsx:98]
- [x] [Review][Patch] Replace the delimiter-count heuristic with quote-aware detection for sampled delimited previews [src/features/import/parse-import-preview.ts:41]
- [x] [Review][Patch] Restore quote-aware delimiter detection across quoted multiline delimited fields so continuation lines cannot bias delimiter selection and corrupt preview assumptions [src/features/import/parse-import-preview.ts:67]
- [x] [Review][Patch] Move owned benchmark detection off the pre-worker critical path or budget that hashing work too, so large Excel fixture verification cannot exceed AC3 without surfacing the required visible in-progress state [src/features/import/workspace-import-route.tsx:459]
- [x] [Review][Patch] Keep AC3 budget visibility active while CSV and pasted benchmark ownership detection runs, including the pasted-table path that still awaits ownership detection before the worker starts [src/features/import/workspace-import-route.tsx:291]
- [x] [Review][Patch] Limit Excel preview columns to the rows that will actually be shown so a far-right cell just beyond the visible cutoff cannot add an all-empty preview column [src/features/import/parse-import-preview.ts:325]
- [x] [Review][Patch] Require stronger repeated-line evidence before overriding Papa Parse delimiter autodetection so leading prose punctuation does not collapse short tables into the wrong delimiter [src/features/import/parse-import-preview.ts:116]
- [x] [Review][Patch] Ignore Papa Parse `UndetectableDelimiter` warnings when stepping valid single-column delimited input [src/features/import/parse-import-preview.ts:192]
- [x] [Review][Patch] Limit no-header workbook preview columns to the rows that can actually render so the hidden lookahead row cannot add an all-empty visible column [src/features/import/parse-import-preview.ts:348]
- [x] [Review][Patch] Catch Excel benchmark hash failures and fall back to non-benchmark import classification so a rejected `crypto.subtle.digest()` call cannot fail the entire Excel preview [src/features/import/workspace-import-route.tsx:123]
- [x] [Review][Patch] Normalize lone-CR line endings during clean CSV and pasted benchmark detection so owned fixtures imported with `\r` newlines still keep their AC3 benchmark classification [src/features/import/workspace-import-route.tsx:94]
- [x] [Review][Patch] Provide a BMAD-owned non-test ownership signal for clean CSV and pasted benchmark fixtures so `import.clean.csv-preview` and `import.clean.paste-preview` remain reachable outside the private trusted-hint global [src/features/import/workspace-import-route.tsx:120]
- [x] [Review][Patch] Keep `import.clean.csv-preview` and `import.clean.paste-preview` reachable through the supported CSV-file and pasted-table import flows instead of only through the BMAD shortcut buttons [src/features/import/workspace-import-route.tsx:150]
- [x] [Review][Patch] Arm the local-read AC3 budget before invoking `file.text()` or `file.arrayBuffer()` so any synchronous browser work inside those APIs is still covered by the visible in-progress threshold [src/features/import/workspace-import-route.tsx:347]
- [x] [Review][Patch] Ignore delimiter-only sampled records when overriding Papa Parse autodetection so leading separator-only lines cannot force the wrong delimiter for later real data [src/features/import/parse-import-preview.ts:122]
- [x] [Review][Patch] Catch hidden-input `input.click()` startup failures and tear down fallback timers/listeners before rethrowing so the file-selection promise does not hang on picker-start errors [src/services/persistence/fs-access/local-import-files.ts:215]
- [x] [Review][Patch] Keep Excel preview row budgeting aligned with the final header inference so `parseWorkbookRows()` does not drop one real data row or lose the truncation lookahead row when its local header heuristic disagrees with `buildImportPreviewDataset()` [src/features/import/parse-import-preview.ts:443]
- [x] [Review][Patch] Terminate the active worker when `Clear preview` resets the route so clearing an in-flight import actually cancels background parsing work instead of only clearing UI state [src/features/import/workspace-import-route.tsx:974]
- [x] [Review][Patch] Separate picker-start failures from file-read and benchmark-detection failures so `handleFileImport()` does not report every exception as `import.preview.selection-failed` / "File selection could not start" [src/features/import/workspace-import-route.tsx:578]
- [x] [Review][Patch] Stop recovering `import.clean.csv-preview` and `import.clean.paste-preview` from normalized preview rows alone, because `applyRecoveredOwnedImportBenchmarkScenario()` can still relabel ordinary user imports as owned benchmark telemetry [src/features/import/workspace-import-route.tsx:178]
- [x] [Review][Patch] Treat rows whose cells contain only literal delimiter symbols as previewable data instead of dropping them through `hasPreviewableValues()` as non-previewable [src/features/import/parse-import-preview.ts:380]
- [x] [Review][Patch] Preserve AC3 over-budget feedback when a budgeted read or benchmark check rejects after synchronous over-budget work, instead of clearing the timer before `markBudgetExceeded()` can fire [src/features/import/workspace-import-route.tsx:241]

## Dev Notes

### Architecture Alignment

- The architecture requires local-first import, semantic inference, and preview work to remain in the browser and off the main thread.
- `services/persistence` is the only approved boundary for browser file-access APIs. Import should reuse that boundary instead of introducing ad hoc picker calls in feature code.
- Feature code owns the workflow and user experience, but worker entrypoints own heavy parsing and inference work.
- No operational API may accept uploaded datasets, preview payloads, workbook contents, or parser diagnostics in MVP.

### Critical Guardrails

- Do not represent an unconfirmed import preview as a partially valid `WorkspaceSnapshot`. The current schema requires committed `datasets`, at least one `graphDefinitions` entry, plus `activeGraphId` and `referenceGraphId`, so a preview-only import should live in import-specific state or a separate draft model until confirm semantics exist.
- Do not call `replaceSnapshot`, `saveCanonicalWorkspace`, or any reopen or persistence path on raw preview selection. Story 2.1 is preview-only.
- Do not push import parsing, preview caching, or telemetry queue ownership into the service worker. The service worker remains shell infrastructure only.
- Do not let Papa Parse or SheetJS result objects leak into persisted domain contracts. Normalize them into BMAD-owned shapes first.

### Existing Repo Intelligence

- `src/app/router/shell-routes.tsx` currently renders a workspace placeholder. Story 2.1 can replace that placeholder with the initial intake surface as long as the route gate and unsupported-environment behavior remain intact.
- `src/stores/workspace-kernel/*` already codifies canonical committed-state mutation and async worker envelope patterns. If preview state needs async orchestration, mirror those conventions carefully or keep preview state outside the committed kernel until a later confirm flow lands.
- `src/services/persistence/fs-access/portable-workspace-files.ts` already shows the repo's browser API wrapper pattern. Mirror that style for source-file selection instead of reaching directly to `window.showOpenFilePicker()` or file input handling from route code.
- Story 1.3 already established `services/persistence` as the only browser-local file and storage boundary and introduced reopen integration tests. Story 2.1 should extend those conventions rather than invent a separate upload or import API service.

### Library and Framework Requirements

- Runtime baseline already in repo: React 19.2, React Router 7, Zustand 5, Zod 4, Vite 8, Node 24.
- Create the import worker with Vite's recommended module-worker syntax: `new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' })`.
- Use Papa Parse for CSV and pasted-table parsing because its current docs support local `File` input, `preview`, and `worker` mode. Favor fast preview rendering over full-file blocking reads.
- Use SheetJS CE for Excel workbook ingestion from `ArrayBuffer` inside the worker, then normalize workbook rows and headers into BMAD preview data structures.
- If the import UI needs dialog, popover, menu, or combobox primitives, prefer `@base-ui/react` wrappers consistent with the architecture instead of bespoke focus-management logic.

### UX Requirements

- The import entrypoint must make CSV, Excel, and paste equally obvious from the workspace route.
- The preview must clearly show what was inferred before commit: delimiter handling, header detection, numeric and date inference, and uncertainty markers.
- If parsing exceeds the clean-import performance threshold, the UI must show visible progress or in-progress state instead of appearing frozen.
- Keyboard-only import must be viable end to end, including source selection, paste handling, preview navigation, and cancel or continue actions.
- The preview surface should keep the calm, confidence-first tone from the UX spec rather than looking like a developer console or raw parser dump.

### Testing

- Add unit coverage around import worker schemas, parser normalization, and assumption detection.
- Add a state-level test proving preview does not mutate the committed workspace snapshot or ledger.
- Add Playwright flows for `import.clean.csv-preview`, `import.clean.excel-preview`, and `import.clean.paste-preview`.
- Create or seed `_bmad-output/benchmarks/benchmark_set_clean/` so Story 2.1 has concrete fixture ownership instead of leaving NFR1 validation abstract.
- Keep tests routed through supported desktop-browser assumptions from the support matrix. Do not write Story 2.1 around Safari behavior.

### Residual Assumptions

- Dirty-data correction, explicit repair choices, and reject-or-confirm flows are intentionally expanded in Story 2.2.
- Rich semantic editing remains Story 2.3. Story 2.1 only needs enough inferred semantics to preview structure and assumptions before commit.
- The benchmark fixture directories do not exist yet in the repo. Story 2.1 should create the clean import set and minimal metadata notes as part of acceptance proof.
- If the team chooses a different parser stack than Papa Parse plus SheetJS CE, the replacement must still preserve worker-first execution, local-only data handling, benchmark coverage, and the same assumption surfaces.

### References

- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epic-2-stories.md` - Story 2.1 scope, acceptance criteria, and downstream Story 2.2 through 2.4 dependencies
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md` - FR1 through FR6, FR8 through FR14, FR51 through FR52, NFR1, NFR11 through NFR14, NFR19 through NFR24
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md` - worker-first import boundary, `features/import` structure, `services/persistence` ownership, and local-only data rules
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/ux-design-specification.md` - confidence-first intake UX, semantic-chip expectations, progress feedback, and keyboard-accessible import guidance
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md` - graph-runtime and implementation-boundary decisions that constrain follow-on graph and preview work
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-11-benchmark-fixture-inventory-and-graph-performance-gates.md` - required benchmark directories and clean-import scenario names
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-3-create-open-and-reopen-local-workspaces.md` - established persistence and file-access boundary patterns
- `/home/pinto/repo/BMADGraphWebApp/project-context.md` - Linux Node wrapper policy for local tooling and test execution
- `/home/pinto/repo/BMADGraphWebApp/package.json` - current runtime and test stack
- `/home/pinto/repo/BMADGraphWebApp/src/app/router/shell-routes.tsx` - current workspace route placeholder and shell route-gate behavior
- `/home/pinto/repo/BMADGraphWebApp/src/stores/workspace-kernel/store.ts` - canonical committed-state store shape and selector patterns
- `/home/pinto/repo/BMADGraphWebApp/src/stores/workspace-kernel/reducers.ts` - ledgered mutation model and async worker request handling
- `/home/pinto/repo/BMADGraphWebApp/src/schemas/workspace/workspace-snapshot.ts` - committed workspace constraints that make preview-only state a separate concern
- `/home/pinto/repo/BMADGraphWebApp/src/services/persistence/fs-access/portable-workspace-files.ts` - current browser file-access wrapper pattern
- `https://vite.dev/guide/features.html` - Vite 8 worker guidance
- `https://developer.mozilla.org/en-US/docs/Web/API/File_System_API` - secure-context and worker availability notes for file-system APIs
- `https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent/clipboardData` - paste-event clipboard access guidance
- `https://www.papaparse.com/docs` - CSV preview, local-file parsing, and worker-mode documentation
- `https://docs.sheetjs.com/docs/getting-started/examples/import/` - browser import and `ArrayBuffer`-based workbook parsing examples
- `https://base-ui.com/react/overview/quick-start` - `@base-ui/react` install and usage guidance

## Senior Developer Review (AI)

### Review Date

2026-04-20

### Outcome

Changes Requested

### Summary

- Reviewed the Story 2.1 file list against the full uncommitted diff from `HEAD 73975473df8b1093083e4e01d8014851e18b8d57`, including relevant untracked benchmark fixtures plus `src/features/import/workspace-import-route.spec.ts` and `src/types/papaparse.d.ts`.
- Triaged the supplied Blind Hunter, Edge Case Hunter, and Acceptance Auditor outputs against the current code. Five findings remain actionable; no `decision_needed` items remain unresolved.
- Targeted verification passed with `npm test -- src/features/import/normalize-preview.spec.ts src/features/import/parse-import-preview.spec.ts src/features/import/workspace-import-route.spec.ts` under a direct `nvm` bootstrap because the dirty-worktree copy of `scripts/with-node.sh` is not runnable with its current line endings.

### Severity Breakdown

- High: 2
- Medium: 3
- Low: 0

### Action Items

- [x] [High] Restrict benchmark scenario tagging to owned clean benchmark fixtures instead of deriving `import.clean.*` from `sourceKind` alone. Evidence: `benchmarkScenarioForSource()` in `src/features/import/normalize-preview.ts` and the schema/tests in `src/features/import/preview-model.ts`, `src/features/import/normalize-preview.spec.ts`, `src/features/import/parse-import-preview.spec.ts`, and `tests/e2e/import.spec.ts` still treat every import as a clean benchmark scenario.
- [x] [Medium] Reject zero-row normalized previews instead of surfacing them as ready. Evidence: `buildImportPreviewDataset()` in `src/features/import/normalize-preview.ts` computes `bodyRows` and `previewRows` but never errors when `bodyRows.length === 0`.
- [x] [Medium] Apply the delimited preview cap after removing non-previewable rows. Evidence: `parseDelimitedRows()` in `src/features/import/parse-import-preview.ts` relies on Papa Parse `preview` before row filtering, so delimiter-only rows can consume the sample window before valid data appears.
- [x] [Medium] Prevent leading empty-string workbook rows from consuming the Excel preview window. Evidence: `parseWorkbookRows()` in `src/features/import/parse-import-preview.ts` slices `listPopulatedWorksheetRows(sheet)` before filtering out rows without previewable values.
- [x] [High] Persist end-to-end preview readiness timing into the resolved preview shown by the UI. Evidence: `workspace-import-route.tsx` computes `benchmarkDurationMs` for telemetry, but `resolveImport()` still receives the original worker preview payload, so the ready-state summary renders `preview.timing.durationMs` from worker parse time only.

### Follow-up Review (R5)

#### Review Date

2026-04-20

#### Outcome

Changes Requested

#### Summary

- Reviewed the Story 2.1 file list against the full uncommitted diff from `HEAD 73975473df8b1093083e4e01d8014851e18b8d57`, including staged, unstaged, and relevant untracked files in scope.
- Validated the supplied Blind Hunter, Edge Case Hunter, and Acceptance Auditor outputs against the current patch. Two `patch` findings remain actionable, and no unresolved `decision_needed` findings remain.
- Dismissed the hidden-input fallback timeout concern for this pass because the current 2-second cutoff is a deliberate bounded-wait tradeoff, not a clear regression against the story or acceptance criteria.

#### Severity Breakdown

- High: 1
- Medium: 1
- Low: 0

#### Action Items

- [x] [High] Restrict clean CSV and Excel benchmark tagging to files proven to be the owned benchmark fixtures rather than any upload whose basename matches the fixture filename. Evidence: `detectOwnedImportBenchmarkScenario()` in `src/features/import/workspace-import-route.tsx` still returns `import.clean.csv-preview` or `import.clean.excel-preview` from `fileName` equality alone, so renamed user uploads contaminate AC3 telemetry and benchmark labeling.
- [x] [Medium] Restore quote-aware delimiter detection for sampled delimited previews. Evidence: `detectDelimitedPreviewDelimiter()` in `src/features/import/parse-import-preview.ts` counts raw delimiter characters with `split()`, so quoted commas, tabs, semicolons, or pipes in the first non-empty line can force the wrong delimiter and corrupt otherwise valid previews.

### Follow-up Review (R6)

#### Review Date

2026-04-20

#### Outcome

Changes Requested

#### Summary

- Reviewed the Story 2.1 file list against the full uncommitted diff from `HEAD`, including staged, unstaged, and relevant untracked files in scope.
- Triaged the supplied Blind Hunter, Edge Case Hunter, and Acceptance Auditor outputs against the current patch. Two `patch` findings remain actionable, and no unresolved `decision_needed` findings remain.
- Confirmed the quoted-multiline delimiter case and the benchmark-detection timing gap by direct inspection of `src/features/import/parse-import-preview.ts` and `src/features/import/workspace-import-route.tsx`.

#### Severity Breakdown

- High: 1
- Medium: 1
- Low: 0

#### Action Items

- [x] [Medium] Keep delimiter detection stable when quoted fields span physical lines. Evidence: `detectDelimitedPreviewDelimiter()` in `src/features/import/parse-import-preview.ts` splits on physical newlines and resets quote state per line, so quoted continuation lines can count commas, tabs, semicolons, or pipes that are still inside the same logical cell.
- [x] [High] Surface AC3 over-budget state while owned benchmark detection is still running for large local files. Evidence: `handleFileImport()` in `src/features/import/workspace-import-route.tsx` awaits `detectOwnedImportBenchmarkScenario()` before `postWorkerImport()` starts the worker budget timer, leaving the Excel SHA-256 path outside both the read budget threshold and the parse budget timer.

### Follow-up Review (R7)

#### Review Date

2026-04-20

#### Outcome

Changes Requested

#### Summary

- Reviewed the Story 2.1 file list against the current uncommitted diff from `HEAD`, limited to the Story 2.1 implementation and review artifacts in scope.
- Triaged the supplied Blind Hunter, Edge Case Hunter, and Acceptance Auditor outputs against the current patch. Three `patch` findings remain actionable, and no unresolved `decision_needed` findings remain.
- Dismissed the row-limit/header-warning edge-case claim for this pass because the current `previewTargetRowCount = IMPORT_PREVIEW_ROW_LIMIT + 2` flow still surfaces `isPartialPreview` for truly truncated imports; the reported consequence depends on a header false positive without actual truncation.

#### Severity Breakdown

- High: 1
- Medium: 2
- Low: 0

#### Action Items

- [x] [High] Start AC3 budget tracking before synchronous owned-benchmark detection for CSV and pasted imports. Evidence: `resolveBenchmarkScenarioWithBudget()` in `src/features/import/workspace-import-route.tsx` receives `detectOwnedImportBenchmarkScenario(detectionInput)` as an already-created promise, so CSV text normalization begins before the threshold timer is armed, and `handlePasteImport()` still awaits ownership detection directly before `postWorkerImport()`.
- [x] [Medium] Limit Excel preview columns to the rows that can actually render in the preview. Evidence: `parseWorkbookRows()` in `src/features/import/parse-import-preview.ts` unions `previewColumnIndexes` across every probed row in `previewableWorksheetRows`, including the extra truncation-detection rows beyond the first 200 displayed body rows, so a far-right cell just past the visible cutoff can materialize as an all-empty preview column.
- [x] [Medium] Require stronger evidence before replacing Papa Parse autodetection with a sampled delimiter guess. Evidence: `detectDelimitedPreviewDelimiter()` in `src/features/import/parse-import-preview.ts` promotes any non-zero candidate without a minimum repeated-line guard, so leading prose lines with incidental punctuation can outweigh a short real table and collapse the preview into the wrong delimiter.

### Follow-up Review (R8)

#### Review Date

2026-04-20

#### Outcome

Changes Requested

#### Summary

- Reviewed the Story 2.1 file list against the current uncommitted diff from `HEAD`, limited to the Story 2.1 implementation and review artifacts in scope.
- Triaged the supplied Blind Hunter, Edge Case Hunter, and Acceptance Auditor outputs against the current patch. Two `patch` findings remain actionable, and no unresolved `decision_needed` findings remain.
- Confirmed the single-column delimited regression by reproducing Papa Parse's `UndetectableDelimiter` warning on valid one-column input, and confirmed the hidden workbook lookahead-column regression by direct inspection of `parseWorkbookRows()` and `buildImportPreviewDataset()`.

#### Severity Breakdown

- High: 0
- Medium: 2
- Low: 0

#### Action Items

- [x] [Medium] Ignore Papa Parse `UndetectableDelimiter` warnings when stepping valid single-column CSV or pasted-table input. Evidence: `parseDelimitedRows()` in `src/features/import/parse-import-preview.ts` aborts on any `result.errors.length > 0`, but Papa emits an `UndetectableDelimiter` warning on the first stepped row for valid one-column input before continuing with the default comma delimiter.
- [x] [Medium] Limit no-header workbook preview columns to rows that can actually render in the visible preview. Evidence: `parseWorkbookRows()` in `src/features/import/parse-import-preview.ts` builds `previewColumnIndexes` from the first `IMPORT_PREVIEW_ROW_LIMIT + 1` previewable worksheet rows before header detection, so a no-header workbook can still leak a column that appears only on the hidden lookahead row into the visible 200-row preview.

### Follow-up Review (R9)

#### Review Date

2026-04-20

#### Outcome

Changes Requested

#### Summary

- Reviewed the current uncommitted Story 2.1 diff against the supplied Blind Hunter, Edge Case Hunter, and Acceptance Auditor outputs, limited to the Story 2.1 implementation and review artifacts in scope.
- Two `patch` findings remain actionable, no unresolved `decision_needed` findings remain, and one supplied finding was dismissed as noise after targeted verification.
- Dismissed the Blind Hunter `__dirname` concern for this pass because `npm test -- src/features/import/workspace-import-route.spec.ts` passes in the current repo despite `"type": "module"`, so this spec is not failing before fixture load in the present Vitest environment.

#### Severity Breakdown

- High: 1
- Medium: 1
- Low: 0

#### Action Items

- [x] [High] Catch Excel benchmark hash failures and fall back to non-benchmark import classification. Evidence: `detectOwnedImportBenchmarkScenario()` in `src/features/import/workspace-import-route.tsx` awaits `sha256Hex(binaryContent)` without a local fallback, so a rejected `crypto.subtle.digest()` bubbles out of benchmark ownership detection and currently fails the entire Excel preview instead of degrading to `null`.
- [x] [Medium] Normalize lone-CR line endings during clean CSV and pasted benchmark detection. Evidence: `normalizeBenchmarkText()` in `src/features/import/workspace-import-route.tsx` replaces `\r\n` only, so owned clean CSV or pasted benchmark content with lone `\r` line endings no longer matches the canonical clean-fixture text and loses AC3 timing classification.

### Follow-up Review (R10)

#### Review Date

2026-04-20

#### Outcome

Changes Requested

#### Summary

- Reviewed the current uncommitted Story 2.1 diff against the supplied Blind Hunter and Edge Case Hunter outputs, limited to the Story 2.1 implementation and review artifacts in scope.
- Three `patch` findings remain actionable, no unresolved `decision_needed` findings remain, and four supplied findings were dismissed as noise or already-handled behavior.
- This pass relied on direct code inspection against the current patch; no new validation commands were run.

#### Severity Breakdown

- High: 0
- Medium: 3
- Low: 0

#### Action Items

- [x] [Medium] Remove the fixed 2-second hidden-input cancel cutoff so delayed successful selections are not discarded. Evidence: `pollForSelection()` in `src/services/persistence/fs-access/local-import-files.ts` settles to `null` once `Date.now() - focusReturnedAt >= HIDDEN_INPUT_CANCEL_MAX_WAIT_MS`, so a legitimate delayed `change` event that lands after that window is silently dropped.
- [x] [Medium] Ensure the hidden-input fallback eventually settles when the picker closes without firing `cancel` or returning focus. Evidence: `openLocalImportFile()` only starts cancellation polling from `handleFocus()` in `src/services/persistence/fs-access/local-import-files.ts`, so a fallback picker close that emits neither event leaves the promise unresolved and the import route stuck in `parsing`.
- [x] [Medium] Require stronger competing-evidence checks before sampled delimiter override replaces Papa Parse autodetection on prose-prefixed short tables. Evidence: `detectDelimitedPreviewDelimiter()` in `src/features/import/parse-import-preview.ts` still promotes the strongest repeated delimiter candidate once `modeCount >= 2` unless the result is an exact tie or the winner is exactly a `2/2` signal, so three comma-bearing prose records ahead of a two-record tabular sample can still force the wrong delimiter.

### Follow-up Review (R1)

#### Review Date

2026-04-20

#### Outcome

Changes Requested

#### Summary

- Reviewed the current uncommitted Story 2.1 diff against the supplied Blind Hunter, Edge Case Hunter, and Acceptance Auditor outputs, limited to the Story 2.1 implementation and review artifacts in scope.
- Three `patch` findings remain actionable, no unresolved `decision_needed` findings remain, and one supplied edge-case report was dismissed after targeted verification.
- Targeted verification passed with `npm test -- src/services/persistence/fs-access/local-import-files.spec.ts src/features/import/workspace-import-route.spec.ts src/features/import/parse-import-preview.spec.ts`.

#### Severity Breakdown

- High: 1
- Medium: 2
- Low: 0

#### Action Items

- [x] [High] Restore prompt hidden-input cancellation once the picker closes without a file on browsers that do not emit `cancel`. Evidence: `openLocalImportFile()` in `src/services/persistence/fs-access/local-import-files.ts` starts polling `input.files` immediately and only settles to `null` from the `cancel` event or the 60-second stale timeout, so canceling the fallback chooser on browsers that omit `cancel` leaves the import route in `parsing` for up to a minute instead of behaving like the native-picker no-op path.
- [x] [Medium] Require stronger ownership proof before tagging CSV and pasted imports as clean benchmark scenarios. Evidence: `detectOwnedImportBenchmarkScenario()` in `src/features/import/workspace-import-route.tsx` still emits `import.clean.csv-preview` and `import.clean.paste-preview` from raw content equality alone, so an ordinary user import or paste that matches the published three-row sample is still classified as benchmark telemetry.
- [x] [Medium] Preserve workbook truncation signaling when the hidden Excel lookahead row only populates columns outside the visible preview window. Evidence: `parseWorkbookRows()` in `src/features/import/parse-import-preview.ts` projects every sampled row onto `previewColumnIndexes` derived only from the visible rows, so a sampled lookahead row that is populated only in hidden columns becomes all-empty before normalization and can drop out, causing `buildImportPreviewDataset()` to miss the extra sampled row and report a truncated workbook as complete.

### Follow-up Review (R2)

#### Review Date

2026-04-20

#### Outcome

Changes Requested

#### Summary

- Reviewed the provided Story 2.1 scoped diff against the supplied Blind Hunter, Edge Case Hunter, and Acceptance Auditor outputs, including direct inspection of scoped files that were not part of the tracked diff plus the relevant untracked benchmark fixtures.
- One merged `patch` finding remains actionable, no unresolved `decision_needed` findings remain, and four supplied findings were dismissed as noise or no longer true for this scoped patch.
- The remaining gap is that clean CSV and pasted benchmark tagging still depends on a private trusted-hint global that is only injected from tests in this scope, so those AC3 benchmark scenarios are not reachable through any BMAD-owned non-test path yet.

#### Severity Breakdown

- High: 1
- Medium: 0
- Low: 0

#### Action Items

- [x] [High] Provide a BMAD-owned non-test ownership signal for clean CSV and pasted benchmark fixtures instead of depending on `__BMAD_TRUSTED_IMPORT_BENCHMARK_HINTS__` injected only by tests. Evidence: `resolveTrustedOwnedImportBenchmarkHint()` and `detectOwnedImportBenchmarkScenario()` in `src/features/import/workspace-import-route.tsx` require that private global before returning `import.clean.csv-preview` or `import.clean.paste-preview`, while `tests/e2e/import.spec.ts` is the only scoped code that sets it.

### Follow-up Review (R3)

#### Review Date

2026-04-20

#### Outcome

Changes Requested

#### Summary

- Reviewed the provided Story 2.1 scoped diff, the full scope file list, and the supplied Blind Hunter, Edge Case Hunter, and Acceptance Auditor outputs without expanding beyond the assigned story scope.
- Four merged `patch` findings remain actionable after deduplication, no unresolved `decision_needed` findings remain, and no additional findings were dismissed as noise in this pass.
- This pass relied on direct inspection of the scoped implementation, tests, and benchmark assets; no new validation commands were run.

#### Severity Breakdown

- High: 2
- Medium: 2
- Low: 0

#### Action Items

- [x] [High] Keep `import.clean.csv-preview` and `import.clean.paste-preview` reachable through the supported CSV-file and pasted-table import flows instead of only through the BMAD shortcut buttons. Evidence: `detectOwnedImportBenchmarkScenario()` in `src/features/import/workspace-import-route.tsx` now returns `null` for CSV and pasted data unless `trustedOwnershipHint` is present (`src/features/import/workspace-import-route.tsx:150-170`), while `handleFileImport()` and `handlePasteImport()` only pass the private hint-global result (`src/features/import/workspace-import-route.tsx:555-570`, `src/features/import/workspace-import-route.tsx:614-619`) and the acceptance tests explicitly expect the canonical clean CSV fixture imported through `Choose CSV file` to render `Not a clean benchmark fixture` (`tests/e2e/import.spec.ts:96-124`). This leaves the published clean CSV/paste assets outside the main supported import flows and misses AC3's "benchmark clean files are imported" path.
- [x] [High] Arm the local-read AC3 budget before invoking `file.text()` or `file.arrayBuffer()` so any synchronous browser work inside those APIs is still covered by the visible in-progress threshold. Evidence: `readLocalFileWithBudget()` takes an already-created promise and passes `operation: () => readOperation` into `awaitImportBudgetThreshold()` (`src/features/import/workspace-import-route.tsx:347-357`), while the call sites invoke `readFileArrayBuffer(file)` and `readFileText(file)` before the helper starts the timer (`src/features/import/workspace-import-route.tsx:537-557`). Any synchronous work performed when those browser APIs are invoked therefore occurs before the AC3 timer is armed.
- [x] [Medium] Ignore delimiter-only sampled records when overriding Papa Parse autodetection so leading separator-only lines cannot force the wrong delimiter for later real data. Evidence: `sampleDelimitedPreviewRecords()` currently records any non-whitespace sampled row, including lines that consist only of delimiters such as `,,,` or `;;;`, because `flushRecord()` only checks `currentContent.trim().length > 0` before pushing the record (`src/features/import/parse-import-preview.ts:122-127`). Those rows then contribute structure scores in `detectDelimitedPreviewDelimiter()` (`src/features/import/parse-import-preview.ts:174-223`) even though `parseDelimitedRows()` later discards them as non-previewable, which can bias the sampled delimiter override away from the real table that follows.
- [x] [Medium] Catch hidden-input `input.click()` startup failures and tear down fallback timers/listeners before rethrowing so the file-selection promise does not hang on picker-start errors. Evidence: after appending the hidden input and registering polling plus focus listeners, `openLocalImportFile()` calls `input.click()` directly with no surrounding cleanup path (`src/services/persistence/fs-access/local-import-files.ts:215-221`). If that click throws before any `change`, `cancel`, or focus-return event fires, the promise never settles and the polling/fallback timers remain live.

### Follow-up Review (R4)

#### Review Date

2026-04-20

#### Outcome

Changes Requested

#### Summary

- Reviewed the provided Story 2.1 scoped diff, scope file list, and the supplied Blind Hunter, Edge Case Hunter, and Acceptance Auditor outputs without expanding beyond the assigned story scope.
- Six `patch` findings remain actionable after direct inspection of the current code, and no unresolved `decision_needed` findings remain.
- This pass relied on direct code inspection against the scoped uncommitted diff and in-scope files; no new validation commands were run.

#### Severity Breakdown

- High: 2
- Medium: 4
- Low: 0

#### Action Items

- [x] [High] Keep Excel preview row budgeting aligned with the final header inference. Evidence: `parseWorkbookRows()` decides `visiblePreviewRowCount` from its own `detectHeader(headerProbeRows)` result before projecting rows into `previewColumnIndexes` (`src/features/import/parse-import-preview.ts:443-450`), while `buildImportPreviewDataset()` reruns header detection after that projection. When the added empty projected columns change the header outcome near the 200-row boundary, the parser can reserve the wrong number of rows and either drop one real data row or lose the extra lookahead row needed for correct `isPartialPreview` signaling.
- [x] [Medium] Terminate the active worker when `Clear preview` resets the route. Evidence: the `Clear preview` handler clears benchmark state, clears the budget timer, and resets the store (`src/features/import/workspace-import-route.tsx:974-978`) but never calls `disposeWorker()`, so an in-flight parse keeps running in the background until it finishes or another import replaces the worker.
- [x] [Medium] Separate picker-start failures from downstream read and benchmark-detection failures in `handleFileImport()`. Evidence: `handleFileImport()` wraps picker launch, local file reads, and benchmark ownership detection in one `try` (`src/features/import/workspace-import-route.tsx:578-630`), and the shared `catch` always emits `import.preview.selection-failed` / `File selection could not start` (`src/features/import/workspace-import-route.tsx:631-642`), which misclassifies later failures and points users toward the wrong remediation.
- [x] [High] Stop recovering clean CSV and pasted benchmark scenarios from normalized preview rows alone. Evidence: `recoverOwnedImportBenchmarkScenario()` reclassifies previews as `import.clean.csv-preview` or `import.clean.paste-preview` whenever the normalized preview matches the published sample rows plus loose source hints (`src/features/import/workspace-import-route.tsx:178-199`), so ordinary user uploads or pasted data that normalize to the same sample can still contaminate AC3 telemetry.
- [x] [Medium] Treat rows whose cells contain only literal delimiter symbols as previewable data. Evidence: `hasPreviewableValues()` now requires `hasNonDelimiterOnlyContent(value)` for at least one cell (`src/features/import/parse-import-preview.ts:380-381`), so rows composed of literal commas, tabs, semicolons, or pipes are dropped from both delimited and workbook previews even when those symbols are the intended cell values.
- [x] [Medium] Preserve AC3 over-budget feedback when budgeted operations reject after synchronous over-budget work. Evidence: `awaitImportBudgetThreshold()` races `operationResult.then(...)` against the budget signal (`src/features/import/workspace-import-route.tsx:289-292`) but does not catch rejected operations before the race settles, so a rejection that occurs after blocking past the budget threshold can clear the timer and surface the error without ever calling `markBudgetExceeded()`.

### Follow-up Review (R5 - Pass 15)

#### Review Date

2026-04-20

#### Outcome

Changes Requested

#### Summary

- Reviewed the provided Story 2.1 scoped diff, scope file list, and the direct contents of all in-scope files that were outside the unified diff.
- Triaged the supplied Blind Hunter, Edge Case Hunter, and Acceptance Auditor outputs against the current patch. Five `patch` findings remain actionable, and no unresolved `decision_needed` findings remain.
- This pass relied on direct code and test inspection against the assigned story scope; no new validation commands were run.

#### Severity Breakdown

- High: 2
- Medium: 3
- Low: 0

#### Action Items

- [x] [High] Ignore stale route-side preparation failures before clearing timers or terminating the worker. Evidence: `failImportFromRoute()` clears benchmark state, clears the AC3 timer, and calls `disposeWorker()` before the correlation-aware store rejection runs (`src/features/import/workspace-import-route.tsx:474-478`), so an older file-read or benchmark-detection failure that arrives after a newer import starts can terminate the current worker and leave the active preview hanging.
- [x] [High] Require BMAD-owned provenance before classifying standard CSV and pasted imports as clean benchmark scenarios. Evidence: `detectOwnedImportBenchmarkScenario()` still promotes CSV and pasted imports to `import.clean.*` from normalized payload equality alone (`src/features/import/workspace-import-route.tsx:117-143`), and the current route/unit/e2e expectations still treat those standard flows as benchmark-tagged when the content matches the published sample (`src/features/import/workspace-import-route.spec.ts:253-337`, `tests/e2e/import.spec.ts:110-124`, `tests/e2e/import.spec.ts:331-342`).
- [x] [Medium] Treat repeated literal delimiter-symbol cells as previewable data instead of dropping them. Evidence: `hasPreviewableValues()` now returns true only when some populated value has non-delimiter content or every populated value has length `1` (`src/features/import/parse-import-preview.ts:380-391`), so valid cells such as `\",,\"` and `\"||\"` still disappear from previews. The added regression test covers only one-character symbol cells (`src/features/import/parse-import-preview.spec.ts:379-393`).
- [x] [Medium] Fall back to the hidden-input picker when `showOpenFilePicker()` fails with a non-cancellation error. Evidence: `openLocalImportFile()` rethrows every native picker error that is not an `AbortError` (`src/services/persistence/fs-access/local-import-files.ts:81-112`), even though the same wrapper already has a working hidden-input fallback immediately below; that leaves import dead on browsers where the native picker exists but fails before file selection.
- [x] [Medium] Start AC3 worker-budget tracking before `worker.postMessage()` so synchronous structured-clone work counts toward the visible in-progress threshold. Evidence: `postWorkerImport()` posts the full payload first and only arms `ensureBudgetTimer(correlationId)` afterward (`src/features/import/workspace-import-route.tsx:577-593`), leaving one last main-thread readiness path outside the AC3 visibility budget for large CSV and pasted imports.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Preserve the existing worker-first import flow and complete Story 2.1 by closing validation gaps instead of replacing the import architecture already present in the repo.
- Add the missing clean benchmark fixture inventory, repair TypeScript strictness issues in import-route, parser, and file-access code, and make Playwright exercise the supported workspace-preview entrypoint.
- Close the final findings pass by bounding Excel workbook previews to populated worksheet rows, rejecting blank first-sheet imports, and splitting native-picker coverage from hidden-input fallback coverage at the route level.
- Validate completion with production build, full unit suite, lint, and full Playwright coverage before advancing the story to review.

### Debug Log References

- Story created on 2026-04-20 from the first backlog entry in `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- No product implementation was executed during story creation; this file is the implementation brief for the next `dev-story` run.
- 2026-04-20: Updated sprint tracking to `in-progress` for Story 2.1 before continuing implementation.
- 2026-04-20: Installed missing Linux Node dependencies, rebuilt the app, and resolved strict TypeScript errors in import parsing, preview typing, and local file-access fallback code.
- 2026-04-20: Validated Story 2.1 with `npm run build`, `npm test`, `npm run lint`, and `npm run test:e2e` under Linux Node via `nvm`.
- 2026-04-20: Added regression coverage for stale worker envelopes and native picker cancellation, patched correlation-aware preview state handling, and re-ran build, lint, unit, and e2e validation.
- 2026-04-20: Completed the implementation-of-findings pass for the remaining import review items by starting route correlation before local file reads, resolving hidden-input cancellation as a null no-op, enabling Papa Parse preview limits for delimited imports, and revalidating build, lint, unit, and e2e coverage.
- 2026-04-20: Completed the second implementation-of-findings pass by clearing active previews during new imports, localizing empty-paste validation, delaying hidden-input cancel detection, surfacing partial-preview state for sampled delimited imports, and extending pasted benchmark acceptance coverage; revalidated build, lint, unit, and e2e coverage.
- 2026-04-20: Completed the third implementation-of-findings pass by replacing the active import worker per import attempt, starting the AC3 budget timer only when worker parsing begins, surfacing worker startup failures for pasted and file imports, capping workbook materialization to the preview row window, widening native picker `.xls` MIME coverage, and adding Playwright AC3 budget-state acceptance coverage; revalidated with targeted Vitest, TypeScript, Playwright, and production build checks under Linux Node via `nvm`.
- 2026-04-20: Completed the fourth implementation-of-findings pass by adding a dedicated file-read budget threshold helper for local AC3 visibility, switching the remaining clean-fixture AC3 proof to deterministic route-budget unit coverage, restoring workbook-specific partial-preview copy coverage through a pure helper, and revalidating build, lint, unit, and Playwright import acceptance coverage.
- 2026-04-20: Completed the fifth implementation-of-findings pass by iterating Excel previews over populated worksheet rows, rejecting blank first worksheets as import failures, adding native `showOpenFilePicker()` route coverage alongside explicit fallback coverage, and revalidating targeted plus full build, lint, unit, and e2e checks under Linux Node via sourced `nvm`.
- 2026-04-20: Completed the sixth implementation-of-findings pass by disposing route activity on unmount, surfacing TSV files in both picker paths, compacting sparse Excel preview columns to sampled populated indexes, extending benchmark telemetry to include local file-read latency, and revalidating targeted and full build, lint, unit, and e2e checks under Linux Node via sourced `nvm`.
- 2026-04-20: Completed the seventh implementation-of-findings pass by restricting clean benchmark tagging to owned fixtures, rejecting zero-row normalized previews, scanning past non-previewable leading CSV and workbook rows, writing end-to-end ready timing back into the resolved preview, and revalidating targeted Vitest coverage plus `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e` under Linux Node via sourced `nvm`.
- 2026-04-20: Completed the eighth implementation-of-findings pass by proving clean CSV/Excel benchmark ownership from fixture content, restoring quote-aware sampled delimiter detection, and revalidating targeted Vitest coverage plus `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e` under Linux Node via sourced `nvm`.
- 2026-04-20: Completed the ninth implementation-of-findings pass by making delimiter detection sample logical quoted records across embedded newlines, extending the AC3 budget-threshold helper to cover owned benchmark verification before worker post, and revalidating targeted Vitest coverage plus `npm run lint`, `npm run typecheck`, `npm test`, and `npm run test:e2e` under Linux Node via sourced `nvm` because `scripts/with-node.sh` still fails with CRLF line endings.
- 2026-04-20: Completed the tenth implementation-of-findings pass by arming AC3 budget tracking before synchronous text benchmark verification, applying the same budget helper to pasted-table ownership detection, limiting Excel preview columns to rows that can actually render, and strengthening sampled delimiter override evidence before revalidating targeted and full coverage under Linux Node via sourced `nvm`.
- 2026-04-20: Completed the eleventh implementation-of-findings pass by ignoring Papa Parse `UndetectableDelimiter` warnings for valid single-column delimited inputs, limiting no-header workbook preview columns to the visible render window after header detection, and revalidating targeted and full coverage under Linux Node via sourced `nvm`.
- 2026-04-20: Completed the twelfth implementation-of-findings pass by normalizing lone-CR clean benchmark text matching, degrading rejected Excel SHA-256 verification to non-benchmark classification, and revalidating targeted plus full coverage under Linux Node via sourced `nvm`.
- 2026-04-20: Completed the fourteenth implementation-of-findings pass by restoring prompt fallback-picker cancellation after focus return, requiring a trusted ownership hint for CSV/paste benchmark classification, preserving Excel truncation signaling from hidden lookahead rows, and revalidating targeted Vitest, typecheck, lint, and Playwright import coverage.
- 2026-04-20: Completed the fifteenth implementation-of-findings pass by adding BMAD-owned clean CSV and pasted benchmark entrypoints, routing benchmark ownership through production fixture metadata instead of the private test hint path, and revalidating targeted plus full unit, build, lint, and Playwright coverage under Linux Node via `bash ./scripts/with-node.sh`.
- 2026-04-20: Completed the sixteenth implementation-of-findings pass by restoring clean CSV/paste benchmark reachability in the standard import flows, starting file-read budget tracking before browser file APIs are invoked, ignoring delimiter-only sampled records, cleaning up hidden-input picker-start failures, and revalidating the targeted plus full import validation stack.
- 2026-04-20: Completed the seventeenth implementation-of-findings pass by aligning Excel workbook row budgeting with final header inference, removing preview-content benchmark recovery, separating file-selection/read/benchmark failures, preserving AC3 over-budget rejection feedback, terminating the worker on preview clear, and revalidating targeted plus full validation under Linux Node via sourced `nvm`.
- 2026-04-20: Completed the eighteenth implementation-of-findings pass by ignoring stale route-side failures before teardown, removing standard CSV/paste benchmark self-classification, preserving repeated delimiter-symbol cells, recovering native picker errors to the hidden-input fallback, starting AC3 worker-budget tracking before `postMessage()`, and revalidating targeted plus full validation under Linux Node via sourced `nvm`.

### Completion Notes List

- Story context synthesized from Epic 2, PRD, architecture, UX, implementation ADRs, current code structure, and current official docs for Vite workers, File System API, Clipboard paste handling, Papa Parse, SheetJS, and Base UI.
- Sprint tracking advanced to `ready-for-dev` for Story 2.1 and `in-progress` for Epic 2.
- Completed the preview-workspace implementation pass by preserving the committed workspace boundary, keeping parsing in a module worker, and verifying the route renders preview-only state for CSV, Excel, and pasted-table sources.
- Added the missing clean benchmark fixture inventory under `_bmad-output/benchmarks/benchmark_set_clean/`, including CSV, Excel, and pasted-table assets plus short metadata notes for each scenario.
- Fixed Story 2.1 type-safety gaps that had prevented a production rebuild, including exact-optional-property handling, typed Papa Parse declarations, workbook row normalization typing, and the local file-picker fallback.
- Hardened Playwright coverage so the import tests stub shell bootstrap endpoints, use the workspace-preview route instead of a persisted-workspace reopen path, and deterministically exercise the hidden-input file-picker flow.
- Validation passed: `npm run build`, `npm test`, `npm run lint`, and `npm run test:e2e`.
- Resolved the review follow-up that stale worker progress, success, and failure envelopes could overwrite a newer import or a cleared preview by dropping non-active correlation ids in the route and preview store.
- Resolved the review follow-up that canceling `showOpenFilePicker()` surfaced a user-visible error by normalizing native picker `AbortError` results to the same `null` no-op contract as the hidden-input fallback.
- Added focused regression tests covering stale worker message handling and native file-picker cancellation, then revalidated the full suite before returning Story 2.1 to review.
- ✅ Resolved review finding: route-level correlation still starts before local file selection, but the AC3 budget timer now starts only when a worker request is successfully posted, so leaving the chooser open does not falsely trip the visible in-progress state.
- ✅ Resolved review finding: the hidden-input file-picker fallback now resolves cancellation as `null` via `cancel` and focus-return handling instead of leaving the import promise pending on browsers without `showOpenFilePicker()`.
- ✅ Resolved review finding: CSV and pasted-table parsing now uses Papa Parse `preview` mode with a bounded row window, and regression tests assert the preview limit instead of parsing the full delimited payload every time.
- ✅ Resolved review finding: starting a new import now clears the interactive preview surface immediately while preserving the previous ready preview only for explicit picker-cancel recovery.
- ✅ Resolved review finding: empty pasted-table submissions now stay local to the paste form and no longer route through `failImport()`, so an existing preview remains visible.
- ✅ Resolved review finding: the hidden-input picker now waits briefly after focus returns before treating the interaction as canceled, allowing a delayed `change` event from a successful selection to win.
- ✅ Resolved review finding: delimited imports now carry an `isPartialPreview` flag plus a UI callout so sampled CSV and pasted previews are not presented as full datasets.
- ✅ Resolved review finding: Playwright now covers the clean pasted benchmark fixture and the empty-paste regression alongside the mixed pasted uncertainty path.
- ✅ Resolved review finding: every new import attempt now disposes the previous worker before a new request is posted, so obsolete parsing cannot keep the shared worker busy or delay the current preview.
- ✅ Resolved review finding: pasted-table and file imports now catch worker construction and `postMessage()` failures and surface a retryable import error instead of remaining stuck in `parsing`.
- ✅ Resolved review finding: Excel native picker options now advertise both `.xlsx` and legacy `.xls` MIME types, and workbook parsing now applies the preview row cap before SheetJS materializes rows so Excel follows the same bounded-preview model as CSV and pasted data.
- ✅ Resolved review finding: Playwright now proves the AC3 over-budget path by asserting the visible in-progress banner before a delayed preview resolves.
- Validation passed for the third findings pass: `npx vitest run src/features/import/parse-import-preview.spec.ts src/services/persistence/fs-access/local-import-files.spec.ts`, `npx tsc --noEmit`, `npx playwright test tests/e2e/import.spec.ts`, and `npm run build`.
- Validation passed again after the findings pass: `npm run build`, `npm run lint`, `npm test`, and `npm run test:e2e`.
- ✅ Resolved review finding: slow local CSV and Excel file reads now cross a dedicated route-level AC3 budget threshold before the worker request is posted, so the import surface can mark the visible in-progress state without reintroducing chooser-open false positives.
- ✅ Resolved review finding: workbook partial-preview copy now comes from a dedicated helper with unit coverage, so Excel previews no longer reuse the delimited-import wording.
- ✅ Resolved review finding: sparse workbook previews now detect truncation from populated preview rows rather than the first physical row window, and regression coverage proves later sparse data still flips `isPartialPreview`.
- ✅ Resolved review finding: the hidden-input cancellation regression remains covered after the polling-based fallback change, including delayed-selection protection on slower filesystems.
- ✅ Resolved review finding: AC3 clean benchmark proof now includes deterministic route-budget tests over the owned clean CSV and Excel fixtures, while Playwright continues to cover the supported import preview flows and the worker-budget path.
- Validation passed for the fourth findings pass: `npx vitest run src/features/import/parse-import-preview.spec.ts src/features/import/workspace-import-route.spec.ts src/services/persistence/fs-access/local-import-files.spec.ts src/features/import/store.spec.ts`, `npx playwright test tests/e2e/import.spec.ts`, `npm run build`, `npm run lint`, and `npm test`.
- ✅ Resolved review finding: Excel preview parsing now walks populated worksheet rows and sampled column bounds instead of every physical row in `!ref`, so sparse or inflated first-sheet ranges stay bounded by preview work rather than blank-range scan cost.
- ✅ Resolved review finding: blank or non-previewable first worksheets now fail preview parsing with an explicit import error instead of surfacing a successful zero-row workbook preview.
- ✅ Resolved review finding: Playwright now acceptance-covers the native `showOpenFilePicker()` route path while still forcing the hidden-input fallback only in the tests that need that branch.
- Validation passed for the fifth findings pass: `npx vitest run src/features/import/parse-import-preview.spec.ts`, `npx playwright test tests/e2e/import.spec.ts`, `npm run build`, `npm run lint`, `npm test`, and `npm run test:e2e`.
- ✅ Resolved review finding: route activity now marks itself disposed on unmount, so pending picker and file-read continuations cannot recreate the worker or emit late benchmark activity after the screen is gone.
- ✅ Resolved review finding: the CSV intake now advertises `.tsv` files in both the native picker and hidden-input fallback, keeping supported tab-delimited imports selectable.
- ✅ Resolved review finding: sparse Excel previews now compact sampled populated columns instead of spanning the full minimum-to-maximum column range, preventing thousands of blank preview columns from a far-right cell.
- ✅ Resolved review finding: import benchmark telemetry now measures end-to-end preview readiness from local file read through worker completion, so AC3 timing no longer underreports slow local reads.
- Validation passed for the sixth findings pass: `npx vitest run src/features/import/parse-import-preview.spec.ts src/services/persistence/fs-access/local-import-files.spec.ts src/features/import/benchmark-timing.spec.ts src/features/import/workspace-import-route.spec.ts`, `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`.
- ✅ Resolved review finding [High]: benchmark scenario ownership now flows from explicit clean-fixture detection in the route and worker payload instead of defaulting every import to an `import.clean.*` hook, so arbitrary CSV, Excel, and pasted previews stay out of AC3 telemetry and show a neutral benchmark label in the UI.
- ✅ Resolved review finding [Medium]: zero-row normalized previews now fail fast after header/body normalization, preventing header-only or otherwise non-previewable imports from surfacing as ready previews.
- ✅ Resolved review finding [Medium]: delimited import sampling now steps row-by-row and stops only after collecting previewable rows, so leading delimiter-only rows no longer exhaust the CSV preview window before real data appears.
- ✅ Resolved review finding [Medium]: workbook import sampling now skips leading rows whose cells normalize to empty strings, so the Excel preview window continues until it contains previewable data rows or exhausts the sheet.
- ✅ Resolved review finding [High]: the route now writes end-to-end readiness timing back into the resolved preview before rendering, so the visible ready-state duration matches local-read-plus-worker latency rather than worker-only parse time.
- Validation passed for the seventh findings pass: `npx vitest run src/features/import/normalize-preview.spec.ts src/features/import/parse-import-preview.spec.ts src/features/import/workspace-import-route.spec.ts src/features/import/benchmark-timing.spec.ts src/features/import/store.spec.ts src/schemas/worker/import-preview.spec.ts`, `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`.
- ✅ Resolved review finding [High]: clean CSV and Excel benchmark tagging now requires owned fixture content verification, so renamed or mimicked uploads no longer inherit the `import.clean.*` scenario unless their payload matches the benchmark asset.
- ✅ Resolved review finding [Medium]: sampled delimiter detection now counts only unquoted candidate separators across the first non-empty lines, so quoted commas no longer override valid TSV, pipe, or semicolon previews.
- Validation passed for the eighth findings pass: `npm test -- src/features/import/workspace-import-route.spec.ts src/features/import/parse-import-preview.spec.ts`, `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`.
- ✅ Resolved review finding [Medium]: delimited preview sampling now preserves quote state across logical records, so quoted multiline cells no longer let continuation lines bias delimiter inference toward commas, tabs, semicolons, or pipes inside the same field.
- ✅ Resolved review finding [High]: owned benchmark verification now runs through the same AC3 budget-threshold helper as local file reads, so slow fixture hashing can surface the visible over-budget state before the worker starts.
- Validation passed for the ninth findings pass: `npm test -- src/features/import/parse-import-preview.spec.ts src/features/import/workspace-import-route.spec.ts`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run test:e2e`.
- ✅ Resolved review finding [High]: AC3 budget tracking now arms before synchronous CSV benchmark verification work begins and the pasted-table path now uses the same budget helper, so pre-worker ownership detection can surface the visible over-budget state without waiting for worker start.
- ✅ Resolved review finding [Medium]: Excel preview columns now union only across the rows that can actually render in the preview, so truncation-detection rows just past the visible cutoff cannot add all-empty columns.
- ✅ Resolved review finding [Medium]: sampled delimiter override now requires stronger repeated-line evidence and falls back to Papa Parse autodetection when short punctuation-only prose competes with another delimiter signal.
- Validation passed for the tenth findings pass: `npm test -- src/features/import/parse-import-preview.spec.ts src/features/import/workspace-import-route.spec.ts`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`.
- ✅ Resolved review finding [Medium]: `parseDelimitedRows()` now ignores Papa Parse `UndetectableDelimiter` warnings, so valid single-column CSV and pasted-table previews no longer abort during stepped parsing.
- ✅ Resolved review finding [Medium]: workbook preview column sampling now decides the visible row window after header detection, so no-header previews cannot inherit an all-empty column from the hidden lookahead row.
- Validation passed for the eleventh findings pass: `npm test -- src/features/import/parse-import-preview.spec.ts`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e`.
- ✅ Resolved review finding [High]: Excel benchmark ownership verification now treats rejected `crypto.subtle.digest()` calls as a safe `null` classification, so digest failures no longer abort the preview route before the worker can run.
- ✅ Resolved review finding [Medium]: clean CSV and pasted benchmark matching now normalizes lone `\r` line endings to `\n`, preserving owned-fixture AC3 classification for CR-only fixture text.
- Validation passed for the twelfth findings pass: `npm test -- src/features/import/workspace-import-route.spec.ts`, `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`.
- ✅ Resolved review finding [Medium]: the hidden-input fallback now keeps polling for a delayed `change` event instead of treating focus return as an immediate cancel path, so slower selections are not discarded by a fixed 2-second cutoff.
- ✅ Resolved review finding [Medium]: the hidden-input fallback now starts polling immediately and carries a long stale-picker fail-safe, so browsers that emit neither `cancel` nor focus-return still settle back to `null` instead of leaving the route stuck in `parsing`.
- ✅ Resolved review finding [Medium]: sampled delimiter override now scores repeated delimiter patterns by structural row shape, so short prose prefixes no longer outrank a plausible competing table delimiter just because punctuation appears on more lines.
- Validation passed for the thirteenth findings pass: `npm test -- src/services/persistence/fs-access/local-import-files.spec.ts src/features/import/parse-import-preview.spec.ts`, `npm test`, `npm run lint`, `npm run build`, and `npx playwright test tests/e2e/import.spec.ts`.
- ✅ Resolved review finding [High]: the hidden-input fallback now treats focus return as a prompt cancellation signal with a short grace window, so browsers that omit the `cancel` event no longer hang until the stale timeout before restoring the route to idle.
- ✅ Resolved review finding [Medium]: CSV and pasted benchmark detection now requires a trusted ownership hint in addition to matching the clean sample payload, so user-owned copies of the published sample rows no longer classify as `import.clean.*` telemetry by content alone.
- ✅ Resolved review finding [Medium]: workbook parsing now carries explicit row-overflow state from sampled worksheet rows, so truncation remains visible even when the hidden lookahead row only populates columns outside the rendered preview window.
- Validation passed for the fourteenth findings pass: `npm test -- src/services/persistence/fs-access/local-import-files.spec.ts src/features/import/workspace-import-route.spec.ts src/features/import/parse-import-preview.spec.ts`, `npm run typecheck`, `npm run lint`, and `npx playwright test tests/e2e/import.spec.ts`.
- ✅ Resolved review finding [High]: the import route now exposes BMAD-owned clean CSV and pasted benchmark entrypoints backed by canonical fixture content, so `import.clean.csv-preview` and `import.clean.paste-preview` stay reachable through a production-owned path instead of the private test-only hint global.
- Validation passed for the fifteenth findings pass: `npm test -- src/features/import/owned-import-benchmarks.spec.ts src/features/import/workspace-import-route.spec.ts`, `npm run typecheck`, `npm run build`, `npm test`, `npm run lint`, and `npm run test:e2e`.
- ✅ Resolved review finding [High]: the standard CSV-file and pasted-table import flows now recover the owned clean benchmark scenarios, and Playwright covers those canonical paths in addition to the dedicated BMAD shortcut buttons.
- ✅ Resolved review finding [High]: the local-read AC3 helper now accepts a thunk and starts the budget wrapper before `file.text()` and `file.arrayBuffer()` are invoked, so synchronous browser read work still contributes to the visible in-progress threshold.
- ✅ Resolved review finding [Medium]: delimiter-only sampled records are now excluded from delimiter override scoring and previewable-row detection, so separator-only lead-ins cannot bias later real table structure.
- ✅ Resolved review finding [Medium]: hidden-input `input.click()` startup failures now clear timers, remove listeners, and reject cleanly instead of leaking the fallback picker promise.
- Validation passed for the sixteenth findings pass: `npm test -- src/features/import/workspace-import-route.spec.ts src/features/import/parse-import-preview.spec.ts src/services/persistence/fs-access/local-import-files.spec.ts`, `npm test -- src/features/import/benchmark-timing.spec.ts src/features/import/normalize-preview.spec.ts src/features/import/owned-import-benchmarks.spec.ts src/features/import/parse-import-preview.spec.ts src/features/import/store.spec.ts src/features/import/workspace-import-route.spec.ts src/services/persistence/fs-access/local-import-files.spec.ts src/schemas/worker/import-preview.spec.ts`, `npx eslint src/features/import/workspace-import-route.tsx src/features/import/parse-import-preview.ts src/services/persistence/fs-access/local-import-files.ts tests/e2e/import.spec.ts src/features/import/workspace-import-route.spec.ts src/features/import/parse-import-preview.spec.ts src/services/persistence/fs-access/local-import-files.spec.ts`, `npm run build`, and `CI=1 npm run test:e2e -- tests/e2e/import.spec.ts`.
- ✅ Resolved review finding [High]: workbook preview sampling now recomputes the visible Excel row window against the same projected columns that the final dataset builder uses, so header inference and truncation lookahead stay aligned at the preview boundary.
- ✅ Resolved review finding [Medium]: clearing the preview now tears down the active import worker in addition to resetting UI state, so background parsing stops immediately when the route is cleared.
- ✅ Resolved review finding [Medium]: file-import preparation now reports picker startup, local read, and benchmark-verification failures through distinct retryable error states instead of collapsing them into `import.preview.selection-failed`.
- ✅ Resolved review finding [High]: displayed benchmark hooks now come only from verified upstream classification, so matching preview rows alone can no longer relabel ordinary CSV or pasted imports as BMAD-owned clean fixtures.
- ✅ Resolved review finding [Medium]: rows containing only literal delimiter symbols now remain previewable when the cells themselves are the intended data, while repeated delimiter-only placeholder rows still stay out of sampled previews.
- ✅ Resolved review finding [Medium]: the AC3 budget-threshold helper now preserves visible over-budget feedback even when a synchronous over-budget read or benchmark check rejects before the timer callback can run.
- Validation passed for the seventeenth findings pass: `npm test -- src/features/import/parse-import-preview.spec.ts src/features/import/workspace-import-route.spec.ts src/features/import/store.spec.ts`, `npm run typecheck`, `npm test`, and `npm run lint`.
- ✅ Resolved review finding [High]: stale route-side file-read and benchmark-detection failures now no-op before any timer or worker teardown unless their correlation still owns the active import, so older async failures cannot terminate the current worker.
- ✅ Resolved review finding [High]: standard CSV and pasted-table flows no longer promote matching sample content into `import.clean.*` benchmark hooks, while the explicit BMAD benchmark entrypoints still surface the owned CSV and pasted benchmark scenarios.
- ✅ Resolved review finding [Medium]: repeated literal delimiter-symbol cell values now remain previewable in sampled delimited imports without reintroducing separator-only placeholder rows into the preview window.
- ✅ Resolved review finding [Medium]: `showOpenFilePicker()` startup failures now recover to the hidden-input fallback when the browser-local fallback path exists, instead of failing the import immediately.
- ✅ Resolved review finding [Medium]: worker-budget tracking now arms before `worker.postMessage()` and marks synchronous structured-clone overruns immediately, so AC3 visibility includes the final pre-worker main-thread readiness path.
- Validation passed for the eighteenth findings pass: `npm exec -- vitest run src/features/import/workspace-import-route.spec.ts src/features/import/parse-import-preview.spec.ts src/services/persistence/fs-access/local-import-files.spec.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `CI=1 npm run test:e2e -- tests/e2e/import.spec.ts`, and `npm test`.

### File List

- _bmad-output/benchmarks/benchmark_set_clean/README.md
- _bmad-output/benchmarks/benchmark_set_clean/csv/import.clean.csv-preview.csv
- _bmad-output/benchmarks/benchmark_set_clean/csv/import.clean.csv-preview.md
- _bmad-output/benchmarks/benchmark_set_clean/excel/import.clean.excel-preview.md
- _bmad-output/benchmarks/benchmark_set_clean/excel/import.clean.excel-preview.xlsx
- _bmad-output/benchmarks/benchmark_set_clean/paste/import.clean.paste-preview.md
- _bmad-output/benchmarks/benchmark_set_clean/paste/import.clean.paste-preview.txt
- _bmad-output/implementation-artifacts/2-1-import-csv-excel-and-pasted-data-into-a-preview-workspace.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- package-lock.json
- src/app/router/shell-routes.tsx
- src/features/import/benchmark-timing.ts
- src/features/import/benchmark-timing.spec.ts
- src/features/import/index.ts
- src/features/import/normalize-preview.ts
- src/features/import/normalize-preview.spec.ts
- src/features/import/owned-import-benchmarks.spec.ts
- src/features/import/owned-import-benchmarks.ts
- src/features/import/parse-import-preview.ts
- src/features/import/parse-import-preview.spec.ts
- src/features/import/preview-model.ts
- src/features/import/store.spec.ts
- src/features/import/store.ts
- src/features/import/workspace-import-route.tsx
- src/features/import/workspace-import-route.spec.ts
- src/schemas/worker/import-preview.ts
- src/schemas/worker/import-preview.spec.ts
- src/services/persistence/fs-access/local-import-files.spec.ts
- src/services/persistence/fs-access/local-import-files.ts
- src/types/papaparse.d.ts
- tests/e2e/import.spec.ts

### Change Log

- 2026-04-20: Created ready-for-dev story context for Story 2.1 and advanced sprint tracking.
- 2026-04-20: Completed Story 2.1 implementation, added clean benchmark fixtures, repaired strict TypeScript and e2e validation gaps, and advanced the story to review.
- 2026-04-20: Addressed review follow-up findings for stale import worker envelopes and native file-picker cancellation, then revalidated the full build, lint, unit, and e2e suite.
- 2026-04-20: Addressed the remaining review follow-up findings for early import correlation tracking, hidden-input cancellation fallback handling, and Papa Parse preview limits, then revalidated build, lint, unit, and e2e coverage.
- 2026-04-20: Addressed the second findings pass for preview clearing, local paste validation, delayed hidden-input cancel handling, partial-preview signaling, and clean pasted benchmark acceptance coverage, then revalidated build, lint, unit, and e2e coverage.
- 2026-04-20: Addressed the third findings pass for worker replacement, parse-start budget timing, pasted/file worker startup failures, native `.xls` picker coverage, bounded Excel workbook preview materialization, and AC3 budget-path acceptance coverage; revalidated targeted Vitest, `tsc --noEmit`, Playwright import acceptance, and the production build.
- 2026-04-20: Addressed the fourth findings pass for local file-read AC3 visibility, workbook-specific partial-preview copy extraction, sparse-workbook truncation regression coverage, and clean benchmark route-budget acceptance proof; revalidated targeted Vitest, Playwright import acceptance, the production build, lint, and the full unit suite.
- 2026-04-20: Addressed the fifth findings pass for populated-row-bounded Excel preview scanning, blank first-sheet rejection, and native Chromium picker acceptance coverage; revalidated targeted parser and import acceptance coverage plus the full build, lint, unit, and e2e suites, and advanced the story to review.
- 2026-04-20: Addressed the sixth findings pass for route disposal invalidation, TSV picker visibility, sparse-column Excel preview compaction, and end-to-end benchmark timing; revalidated targeted Vitest coverage plus the full build, lint, unit, and e2e suites, and advanced the story to review.
- 2026-04-20: Fresh review pass found 5 remaining Story 2.1 patch follow-ups in benchmark scenario ownership, zero-row normalization handling, delimited sampling, sparse workbook sampling, and visible end-to-end timing; story moved back to in-progress pending another implementation pass.
- 2026-04-20: Addressed the seventh findings pass for benchmark scenario ownership, zero-row normalization rejection, non-previewable leading CSV and workbook row sampling, and resolved ready-state timing; revalidated targeted Vitest coverage plus the full build, lint, unit, and e2e suites, and advanced the story to review.
- 2026-04-20: Addressed the eighth findings pass for content-verified clean CSV/Excel benchmark ownership and quote-aware sampled delimiter detection; revalidated targeted Vitest coverage plus the full build, lint, unit, and e2e suites, and advanced the story to review.
- 2026-04-20: R6 review found 2 remaining patch findings in quoted-multiline delimiter detection and pre-worker benchmark-verification timing, left them as action items, and moved the story back to in-progress.
- 2026-04-20: Addressed the ninth findings pass for multiline-quoted delimiter detection and pre-worker benchmark-verification budget visibility; revalidated targeted Vitest coverage plus lint, typecheck, the full unit suite, and full Playwright coverage, and advanced the story to review.
- 2026-04-20: R7 review found 3 remaining patch findings in text benchmark-detection timing, Excel preview-column sampling past the visible cutoff, and low-confidence delimiter overrides; left them as action items and moved the story back to in-progress.
- 2026-04-20: Addressed the tenth findings pass for synchronous text benchmark-detection AC3 visibility, render-bounded Excel preview columns, and stronger sampled delimiter override evidence; revalidated targeted Vitest coverage plus lint, typecheck, the full unit suite, build, and full Playwright coverage, and advanced the story to review.
- 2026-04-20: R8 review found 2 remaining patch findings in single-column Papa delimiter warnings and no-header workbook lookahead-column leakage, left them as action items, and moved the story back to in-progress.
- 2026-04-20: Addressed the thirteenth findings pass for delayed hidden-input file selection handling, fallback picker stale-settle protection, and stronger competing-evidence delimiter scoring; revalidated targeted Vitest coverage plus `npm test`, `npm run lint`, `npm run build`, and `npx playwright test tests/e2e/import.spec.ts`, and advanced the story to review.
- 2026-04-20: Addressed the eleventh findings pass for single-column Papa delimiter warnings and no-header workbook lookahead-column leakage; revalidated targeted Vitest coverage plus typecheck, lint, the full unit suite, build, and full Playwright coverage, and advanced the story to review.
- 2026-04-20: R9 review found 2 remaining patch findings in Excel benchmark hash-failure handling and lone-CR benchmark-text normalization, dismissed the `__dirname` spec concern after targeted Vitest verification, left the findings as action items, and moved the story back to in-progress.
- 2026-04-20: Addressed code review findings - 2 items resolved (twelfth findings pass).
- 2026-04-20: R10 review triaged the supplied reviewer outputs against the current patch, left 3 patch findings as action items in hidden-input cancellation handling and short-table delimiter detection, dismissed 4 stale findings, and moved the story back to in-progress.
- 2026-04-20: R1 review triaged the supplied reviewer outputs against the current patch, left 3 patch findings as action items in hidden-input cancellation handling, CSV/paste benchmark ownership proof, and Excel lookahead truncation signaling, dismissed the `getFile()` rejection edge case after targeted Vitest verification, and moved the story back to in-progress.
- 2026-04-20: Addressed code review findings - 3 items resolved (fourteenth findings pass).
- 2026-04-20: R2 review triaged the supplied reviewer outputs against the current patch, left 1 high-severity patch finding as an action item for CSV/paste benchmark ownership signaling, dismissed 4 supplied findings as stale or non-blocking, and moved the story back to in-progress.
- 2026-04-20: Addressed code review findings - 1 item resolved (fifteenth findings pass).
- 2026-04-20: R3 review triaged the supplied reviewer outputs against the current patch, left 4 patch findings as action items in benchmark-flow reachability, pre-read AC3 timing coverage, delimiter-only sampled-record handling, and hidden-input picker-start cleanup, and moved the story back to in-progress.
- 2026-04-20: Addressed code review findings - 4 items resolved (sixteenth findings pass).
- 2026-04-20: R4 review triaged the supplied reviewer outputs against the current patch, left 6 patch findings as action items in Excel header/row budgeting, clear-preview worker disposal, file-import failure classification, benchmark scenario recovery, symbol-only row handling, and budget-threshold rejection feedback, and moved the story back to in-progress.
- 2026-04-20: Addressed code review findings - 6 items resolved (seventeenth findings pass).
- 2026-04-20: R5 review triaged the supplied reviewer outputs against the current patch, left 5 patch findings as action items in stale route-side failure handling, CSV/paste benchmark provenance, repeated delimiter-symbol previewability, native-picker fallback recovery, and postMessage AC3 timing visibility, and moved the story back to in-progress.
- 2026-04-20: Addressed code review findings - 5 items resolved (eighteenth findings pass).
