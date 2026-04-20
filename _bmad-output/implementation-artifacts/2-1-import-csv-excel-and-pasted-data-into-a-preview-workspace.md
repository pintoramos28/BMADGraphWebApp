# Story 2.1: Import CSV, Excel, and Pasted Data into a Preview Workspace

Status: ready-for-dev

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

- [ ] Establish import preview contracts and source models. (AC: 1, 2)
  - [ ] Add typed worker request, progress, success, and failure schemas under `src/schemas/worker/` for import preview flows.
  - [ ] Define a BMAD-owned preview dataset model plus parse-assumption and uncertainty metadata instead of leaking parser-native objects into feature state.
  - [ ] Standardize source identifiers for `csv-file`, `excel-file`, and `pasted-table` inputs and codify assumption categories for delimiter, header, numeric and date inference, and uncertainty.
- [ ] Implement local-only ingestion adapters and worker parsing. (AC: 1, 2, 3)
  - [ ] Add a local source-file access wrapper under `src/services/persistence/fs-access/` or an equivalent persistence-owned boundary instead of calling file pickers directly from route components.
  - [ ] Create `src/workers/import.worker.ts` as a Vite module worker and keep parser execution off the main thread.
  - [ ] Parse CSV and pasted tables with Papa Parse preview support and parse Excel workbooks with SheetJS CE from `ArrayBuffer`, then normalize both into BMAD preview rows, columns, and assumption summaries.
- [ ] Build the import-first workspace surface without mutating committed workspace state. (AC: 1, 2)
  - [ ] Replace the current workspace placeholder route with an intake panel that accepts CSV, Excel, and paste entrypoints while preserving the existing shell compatibility gate.
  - [ ] Render a preview state with sample rows, column inventory, source details, and clearly labeled "not yet committed" status before any analytical commit occurs.
  - [ ] Keep the flow keyboard-operable and screen-reader friendly, with explicit focus order, visible focus, and text equivalents for status and uncertainty.
- [ ] Surface parsing assumptions, uncertainty, and performance state. (AC: 2, 3)
  - [ ] Display delimiter, header, numeric, date, and uncertainty assumptions directly in the preview summary rather than burying them in logs or dev tooling.
  - [ ] Show a visible in-progress state whenever preview readiness exceeds the NFR1 budget instead of blocking silently.
  - [ ] Add redacted timing hooks for `import.clean.csv-preview`, `import.clean.excel-preview`, and `import.clean.paste-preview` without logging raw file contents or parsed rows.
- [ ] Add fixtures and test coverage for clean import preview flows. (AC: 1, 2, 3)
  - [ ] Create clean benchmark fixture scaffolding under `_bmad-output/benchmarks/benchmark_set_clean/` for CSV, Excel, and pasted-table scenarios, including a short metadata note for each fixture.
  - [ ] Add unit coverage for worker contracts, normalization rules, and assumption detection, plus route or state tests proving preview does not mutate committed workspace state.
  - [ ] Add Playwright coverage for CSV, Excel, and pasted preview flows on supported desktop browsers.

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

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story created on 2026-04-20 from the first backlog entry in `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- No product implementation was executed during story creation; this file is the implementation brief for the next `dev-story` run.

### Completion Notes List

- Story context synthesized from Epic 2, PRD, architecture, UX, implementation ADRs, current code structure, and current official docs for Vite workers, File System API, Clipboard paste handling, Papa Parse, SheetJS, and Base UI.
- Sprint tracking advanced to `ready-for-dev` for Story 2.1 and `in-progress` for Epic 2.

### File List

- _bmad-output/implementation-artifacts/2-1-import-csv-excel-and-pasted-data-into-a-preview-workspace.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-04-20: Created ready-for-dev story context for Story 2.1 and advanced sprint tracking.
