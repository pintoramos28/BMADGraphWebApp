# Story 2.2: Resolve Import Uncertainty and Data-Quality Issues Before Commit

Status: done

## Story

As a user,
I want to fix parsing and missing-value issues before import is finalized,
so that I can trust the dataset I commit into the workspace.

## Acceptance Criteria

1. Given the system is uncertain about parsing or inferred meaning, when the preview is displayed, then the user can explicitly confirm or correct the uncertain assumptions before continuing.
2. Given missing, invalid, or malformed values are detected, when the user reviews the preview, then the user can choose how those values should be handled in the active analysis.
3. Given the user rejects the preview, when import is canceled, then no partial dataset is committed into the canonical workspace.

## Dependencies

- Story 2.1: Import CSV, Excel, and Pasted Data into a Preview Workspace
- Foundational contracts from Stories 1.2 and 1.3 remain mandatory for canonical workspace mutation, issue handling, and persistence boundaries.

## Contract Boundaries

- In scope: import-assumption confirmation and correction; missing-value and malformed-value handling choices; inline repair surfaces; confirm and reject flows; dirty import benchmark fixtures; worker-backed reparse loops; and the preview-to-active-analysis handoff contract.
- Out of scope: general transform authoring, formula editing, broad semantic-role editing, graph authoring UI, review-mode workflows, telemetry transport changes, and any server-side dataset handling.
- Owning paths: `src/features/import/**`, `src/workers/import.worker.ts`, `src/schemas/worker/import-preview.ts`, `src/schemas/workspace/**` only if a minimal confirmed-import contract needs a schema update, `src/stores/workspace-kernel/**` for canonical commit wiring, `tests/e2e/import.spec.ts`, and `_bmad-output/benchmarks/benchmark_set_dirty/**`.
- Downstream consumers after completion: Story 2.3 uses the confirmed dataset, issue state, and import-repair decisions as the basis for semantic editing; Story 2.4 layers onboarding and recovery copy onto the same repair-capable intake surface.

## Tasks / Subtasks

- [x] Extend the import repair contract and worker reparse path. (AC: 1, 2)
  - [x] Add BMAD-owned types for repair selections such as delimiter override, header interpretation, ambiguous type confirmation, and missing-value handling so the route, store, and worker share one contract instead of parallel UI-only shapes.
  - [x] Update `src/schemas/worker/import-preview.ts`, `src/features/import/preview-model.ts`, and `src/workers/import.worker.ts` so the import worker can rerun preview normalization from explicit user overrides while preserving correlation IDs, budget tracking, and stale-message protection.
  - [x] Promote uncertainty and data-quality findings into structured issue-backed repair inputs rather than free-form preview strings only, so inline repair UI can distinguish informational, warning, and blocking states consistently.
- [x] Build the import repair and confirmation UI on the existing workspace route. (AC: 1, 2, 3)
  - [x] Extend `src/features/import/store.ts` and `src/features/import/workspace-import-route.tsx` so users can confirm or correct uncertain assumptions, select how missing or malformed values should be handled, and see which issues still block confirmation.
  - [x] Keep feedback inline and keyboard-complete, following the Repair Card and feedback patterns from the UX spec instead of introducing modal-heavy correction flows for recoverable issues.
  - [x] Replace the Story 2.1 "commit intentionally unavailable" affordance with explicit Confirm Import and Reject Import actions that explain their impact on canonical state.
- [x] Define and implement the preview-to-active-analysis boundary without violating workspace contracts. (AC: 2, 3)
  - [x] Translate a confirmed, repaired import into the BMAD-owned active-analysis path through `WorkspaceKernel` and the locked snapshot/issue contracts instead of persisting preview-only state directly.
  - [x] If confirmation needs a graph-free bootstrap state, document and implement a minimal BMAD-owned placeholder graph/reference contract consistent with Story 1.2 rather than bypassing `WorkspaceSnapshot` invariants or persisting renderer-specific artifacts.
  - [x] Ensure reject and cancel leave the canonical workspace unchanged, clear repair state safely, and preserve unaffected prior context or preview state where appropriate.
- [x] Add dirty benchmark fixtures and verification coverage. (AC: 1, 2, 3)
  - [x] Create `_bmad-output/benchmarks/benchmark_set_dirty/` metadata-backed fixtures for delimiter, header, type-ambiguity, and missing-value repair scenarios using the ADR-approved scenario names.
  - [x] Add unit and state coverage for repair selection reducers, issue generation, missing-value policy application, confirm transitions, and reject-no-commit behavior.
  - [x] Extend Playwright import acceptance flows to prove delimiter repair, header repair, type repair, missing-value repair, and reject behavior through supported browser paths without regressing the clean import paths from Story 2.1.

## Dev Notes

### Architecture Alignment

- Keep the workflow local-first. No import preview, repair selection, dataset rows, or workbook fragments may cross the operational API boundary.
- Continue to treat worker execution as mandatory for reparsing and normalization. Components orchestrate; workers parse and normalize.
- `WorkspaceKernel` remains the only canonical analytical state owner. Import-specific UI or route state may not become a second persisted workspace source of truth.
- All recoverable analytical failures should reuse the shared issue-record contract or map directly into it so later Repair Card, readiness, and trust surfaces can consume the same underlying facts.
- `services/persistence` stays the only route to File System Access and related browser storage APIs.

### Critical Guardrails

- Do not mutate the canonical workspace on source selection alone. Explicit user confirmation is the only valid transition point into active analysis.
- Do not invent a second import-specific error schema that duplicates `IssueRecord` semantics once repair actions and blocking state exist.
- Do not broaden this story into Story 2.3 semantic-role editing, Story 3 transform authoring, or Story 4 graph generation. Repair only what is necessary to trust the imported dataset.
- Do not regress the Story 2.1 protections around stale worker messages, budget visibility, fallback picker cancellation, partial-preview signaling, or benchmark ownership verification.
- Do not persist Papa Parse result objects, SheetJS workbook objects, raw `File` objects, or renderer artifacts into canonical workspace state.
- If a placeholder graph is required to satisfy `WorkspaceSnapshot` invariants on confirmation, keep it BMAD-owned, minimal, and explicitly non-authoritative until graph stories replace it with a real authored graph.

### Existing Repo Intelligence

- `src/features/import/workspace-import-route.tsx` already exposes a preview-only flow and explicitly states that commit, repair, and semantic confirmation are deferred beyond Story 2.1. Extend this route instead of replacing it.
- `src/features/import/store.ts` already preserves preview state independently from canonical workspace state and supports cancel, progress, and stale-correlation protection. Build the repair state into this store rather than introducing a parallel route-only state machine.
- `src/features/import/preview-model.ts` currently models assumptions and uncertainties but does not yet represent user confirmations, repair selections, or missing-value policies. Extend it or add adjacent BMAD-owned import models instead of ad hoc component-only types.
- `src/services/persistence/fs-access/local-import-files.ts` already owns native picker and hidden-input fallback behavior. Keep file access inside this boundary.
- `src/stores/workspace-kernel/store.ts` and `src/stores/workspace-kernel/reducers.ts` already codify canonical mutation, issue replacement, and stale worker-envelope rejection. Reuse those seams for confirmation rather than mutating snapshot-shaped objects in components.
- `src/schemas/workspace/workspace-snapshot.ts` currently requires `datasets`, at least one `graphDefinitions` entry, `activeGraphId`, and `referenceGraphId`. Story 2.2 must define the first valid import-confirmation handoff instead of bypassing these invariants.
- `tests/e2e/import.spec.ts` already covers clean preview flows, benchmark visibility, and over-budget states. Extend the same acceptance surface for dirty repair scenarios rather than creating an unrelated end-to-end harness.
- `_bmad-output/benchmarks/benchmark_set_clean/**` exists today, but `_bmad-output/benchmarks/benchmark_set_dirty/**` does not. Story 2.2 should create that missing benchmark family.

### Library and Framework Requirements

- Stay on the repo's current runtime baseline unless a blocking defect forces change: React 19.2.5, React Router 7.14.1, Zustand 5.0.12, Zod 4.3.6, Vite 8.0.8, Papa Parse 5.5.3, and SheetJS CE 0.18.5. No package upgrades are part of this story by default. [Source: `/home/pinto/repo/BMADGraphWebApp/package.json`]
- Reuse Papa Parse for delimiter, header, and typing repair loops instead of introducing a second delimited-data parser. The official docs support auto-detected or explicit `delimiter`, `header`, `dynamicTyping`, `preview`, `worker`, and streaming hooks such as `step` and `chunk`, which are the right primitives for repairable reparse flows. [Source: `https://www.papaparse.com/docs`]
- Keep workbook repair on the existing SheetJS-based import path. Story 2.2 should adjust BMAD-owned normalization and interpretation choices, not replace the workbook ingestion stack introduced in Story 2.1. [Source: `/home/pinto/repo/BMADGraphWebApp/src/features/import/parse-import-preview.ts`, `https://docs.sheetjs.com/docs/getting-started/examples/import/`]
- Where confirmation or repair rerenders large preview surfaces, prefer React 19 transitions for the UI state swap so repair controls stay responsive while worker-backed recalculation completes. React's official guidance still requires wrapping post-`await` updates in another `startTransition` call if they should remain non-blocking. [Source: `https://react.dev/reference/react/startTransition`]
- For accessibility, keep routine status updates polite and reserve assertive announcements for blocking integrity failures or actions that prevent continuation. [Source: `https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live`]

### UX Requirements

- Use the Repair Card pattern for ambiguity, malformed values, and missing-value choices: concise explanation, recommended action, secondary actions, and optional details, all inline or docked rather than modal by default.
- Follow the feedback rules from the UX spec: every repair surface must answer what happened, why it matters, and what the user can do next.
- Keep the flow confidence-first. Successful repair copy should confirm preserved analytical value, not just system completion.
- Make Confirm Import and Reject Import consequences explicit in the UI so non-technical users understand whether the canonical workspace will change.
- Maintain keyboard parity across source selection, repair controls, confirmation, rejection, and any inspection details.

### Testing

- Add schema and unit coverage wherever repair selections or worker contracts change.
- Add state-level tests proving confirmation mutates canonical state only through the approved kernel path and rejection leaves the canonical workspace unchanged.
- Add route tests around blocking-vs-non-blocking issue presentation, repair affordances, and confirm/reject button behavior.
- Extend end-to-end coverage for the ADR-approved dirty scenarios:
  - `import.dirty.delimiter-repair`
  - `import.dirty.header-repair`
  - `import.dirty.type-repair`
  - `import.dirty.missing-value-repair`
- Preserve the existing Story 2.1 acceptance coverage for clean CSV, Excel, and pasted preview flows, benchmark labeling, budget behavior, and picker-path behavior.

### Previous Story Intelligence

- Story 2.1 deliberately stopped at preview-only state because an unconfirmed import could not be represented as a valid `WorkspaceSnapshot` without a defined confirm boundary.
- Story 2.1 review history shows the import surface is highly sensitive to stale worker callbacks, file-picker cancellation races, pre-worker budget timing, benchmark ownership verification, and partial-preview messaging. Treat those as regression hotspots.
- The clean benchmark labels now rely on content verification and, for Excel, digest verification. Story 2.2 must not weaken those ownership checks when adding dirty benchmark handling.
- The import route already exposes both native picker and fallback picker paths plus a pasted-table path. Dirty repair flows should work across all supported intake modes, not only a benchmark-only shortcut.

### Git Intelligence

- Recent commit history shows Story 2.1 required repeated corrective passes, and the repo recently added a runtime-focused reviewer workflow. Keep Story 2.2 changes incremental, heavily tested, and centered on the existing import seams instead of a broad rewrite.
- The current worktree already contains in-flight import-related edits. Any Story 2.2 implementation should read those changes carefully before touching the same files so repair work layers onto the latest route and store behavior instead of reverting it.

### Latest Technical Information

- Papa Parse still documents explicit delimiter override, `header`, `dynamicTyping`, `preview`, worker parsing, and streaming callbacks as the supported browser-side control surface for repairable CSV parsing. Favor these supported parser controls over custom post-parse coercion when user corrections can be expressed directly in parser config. [Source: `https://www.papaparse.com/docs`]
- React's `startTransition` remains the official mechanism for backgrounding non-urgent UI updates, but it does not automatically make text inputs transition-safe and must be re-applied after awaited work. Use it selectively around preview-state swaps, not around every form field update. [Source: `https://react.dev/reference/react/startTransition`]
- `aria-live` still distinguishes routine polite announcements from interruptive assertive ones. Use that distinction to keep import repair informative without overwhelming screen-reader users. [Source: `https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live`]

### Residual Assumptions

- Unless a stronger import-confirmation contract is introduced during implementation, Story 2.2 should commit through `WorkspaceKernel` into a valid minimal workspace state rather than keep "confirmed" data in an undefined side store.
- Missing-value handling should stay intentionally narrow in this story. If implementation starts drifting into general-purpose fill, transform, or imputation tooling, that scope belongs in later preparation stories.
- Dirty benchmark metadata can mirror the clean benchmark note pattern from Story 2.1 unless a stronger fixture schema is introduced.

### References

- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epic-2-stories.md` - Story 2.2 scope, acceptance criteria, and downstream Story 2.3/2.4 dependencies
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epics.md` - Epic 2 objective and graph-ready intake goal
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md` - FR4, FR5, FR6, FR52, NFR7, NFR12, and the import-repair user journey
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md` - Data Architecture, API & Communication Patterns, Frontend Architecture, Structure Patterns, and Requirements to Structure Mapping
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/ux-design-specification.md` - David/Priya user journeys, Repair Card, Feedback Patterns, Form Patterns, and keyboard/accessibility rules
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md` - issue-record and contract-first implementation guidance
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-07-issue-record-contract.md` - shared issue-record contract for repair/readiness flows
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-11-benchmark-fixture-inventory-and-graph-performance-gates.md` - required dirty benchmark inventory and scenario names
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/2-1-import-csv-excel-and-pasted-data-into-a-preview-workspace.md` - prior-story guardrails, review learnings, and current import-owned file list
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-2-author-canonical-workspace-and-trust-contracts.md` - placeholder graph allowance and canonical kernel boundaries
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/epic-1-retro-2026-04-21.md` - explicit need to define the preview-workspace and commit boundary before import expands further
- `/home/pinto/repo/BMADGraphWebApp/package.json` - locked runtime and dependency baseline
- `/home/pinto/repo/BMADGraphWebApp/src/features/import/workspace-import-route.tsx` - current preview-only route and deferred commit messaging
- `/home/pinto/repo/BMADGraphWebApp/src/features/import/store.ts` - import preview state machine and cancel/resolve/fail behavior
- `/home/pinto/repo/BMADGraphWebApp/src/features/import/preview-model.ts` - current preview dataset contract
- `/home/pinto/repo/BMADGraphWebApp/src/schemas/worker/import-preview.ts` - current worker contract baseline
- `/home/pinto/repo/BMADGraphWebApp/src/schemas/workspace/workspace-snapshot.ts` - canonical workspace invariants that constrain confirm behavior
- `/home/pinto/repo/BMADGraphWebApp/src/schemas/workspace/issue-record.ts` - structured repair issue contract
- `/home/pinto/repo/BMADGraphWebApp/src/stores/workspace-kernel/store.ts` - canonical mutation and selector boundary
- `/home/pinto/repo/BMADGraphWebApp/src/stores/workspace-kernel/reducers.ts` - issue replacement and mutation patterns
- `/home/pinto/repo/BMADGraphWebApp/tests/e2e/import.spec.ts` - existing import acceptance coverage surface
- `https://www.papaparse.com/docs` - parser controls for delimiter, header, typing, worker mode, and preview limits
- `https://react.dev/reference/react/startTransition` - React 19 transition guidance for non-blocking repair rerenders
- `https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live` - live-region behavior for status and blocking announcements
- `https://docs.sheetjs.com/docs/getting-started/examples/import/` - browser workbook import guidance

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Reproduce the three remaining findings with focused regressions before changing runtime behavior.
- Promote true CSV delimiter ambiguity into the same confirmation path used by the dirty benchmark without reblocking ordinary high-confidence delimited imports.
- Keep hydration retryable when persisted parsing/install fails, and realign drop-invalid preview rendering to visible rows that still survive in the confirmed dataset.

### Debug Log References

- Loaded the create-story workflow, config, template, and checklist from `.agents/skills/bmad-create-story/`.
- Analyzed Epic 2, PRD, architecture, UX, implementation ADRs, project context, current import code, previous Story 2.1 notes, benchmark fixtures, and recent git history before writing this story.
- Verified current package/runtime versions locally and cross-checked the repair-relevant external guidance against official documentation.
- Continued the in-flight Story 2.2 import changes already present in the worktree without reverting unrelated edits, then closed the remaining strict typecheck, lint, and acceptance-test gaps.
- Ran `./scripts/with-node.sh npm run typecheck`, targeted Vitest coverage for import and workspace-kernel seams, `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run test:e2e`.
- Ran `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm test -- src/features/import/normalize-preview.spec.ts src/features/import/workspace-import-route.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts`, and `./scripts/with-node.sh npx playwright test tests/e2e/import.spec.ts` after resolving the remaining review findings.
- Ran `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run test:e2e` after the final canonical-store, delimiter-confirmation, and navigation-persistence fixes.
- Ran `./scripts/with-node.sh npm run typecheck`, targeted Vitest for shell-route/import/kernel/store seams, `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts` after closing the latest unresolved review findings.
- Ran `./scripts/with-node.sh npm test -- src/app/router/shell-routes-hydration.spec.ts src/features/import/workspace-import-route.spec.ts`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts` after the persisted-hydration and confirm-persistence rollback fixes.
- Ran `./scripts/with-node.sh npm test -- src/features/import/normalize-preview.spec.ts src/features/import/parse-import-preview.spec.ts src/app/router/shell-routes.spec.tsx src/stores/workspace-kernel/workspace-kernel.spec.ts`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts` after the pass-5 review-finding fixes.
- Ran `./scripts/with-node.sh npm test -- src/features/import/normalize-preview.spec.ts src/features/import/parse-import-preview.spec.ts src/features/import/workspace-import-route.spec.ts src/services/persistence/fs-access/local-import-files.spec.ts`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts` after the user-scoped confirm-contract and provenance fixes.
- Ran `./scripts/with-node.sh npm test -- src/features/import/normalize-preview.spec.ts src/features/import/parse-import-preview.spec.ts src/app/router/shell-routes-hydration.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm run lint`, `./scripts/with-node.sh npm test`, and `./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts` after closing the remaining preview/full-dataset, delimiter-confidence, hydration-fallback, and workspace-cache findings.
- Ran `./scripts/with-node.sh npm test -- src/features/import/normalize-preview.spec.ts src/features/import/workspace-import-route.spec.ts src/app/router/shell-routes-hydration.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts` during the Story 2.2 findings-only pass to revalidate confirm fail-closed behavior, preview identity, persisted hydration retry/reopen validation, late-column acknowledgement, and repair replay memory handling.
- Ran `./scripts/with-node.sh npm test -- src/features/import/parse-import-preview.spec.ts`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm run lint`, `./scripts/with-node.sh npm test`, and `./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts` after splitting import preview sampling from full confirmed-row materialization for CSV and workbook sources.
- Ran `./scripts/with-node.sh npm test -- src/features/import/parse-import-preview.spec.ts src/features/import/normalize-preview.spec.ts src/app/router/shell-routes-hydration.spec.ts`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm run lint`, `./scripts/with-node.sh npm test`, and `./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts` after closing the remaining delimiter-ambiguity, hydration-retry, and drop-invalid preview-alignment findings.
- Ran `./scripts/with-node.sh npm test -- src/features/import/normalize-preview.spec.ts src/features/import/parse-import-preview.spec.ts src/features/import/store.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm run lint`, `./scripts/with-node.sh npm test`, and `./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts` after closing the current normalize/parser/store/kernel review findings pass.
- Ran `./scripts/with-node.sh npm test -- src/features/import/normalize-preview.spec.ts src/features/import/parse-import-preview.spec.ts src/app/router/shell-routes-hydration.spec.ts`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts` during the user-scoped blocking-findings closure pass to confirm the live tree already closes the remaining delimiter-ambiguity, hydration-retry, and drop-invalid preview-backfill findings before returning the story to review.
- Ran `./scripts/with-node.sh npm test -- src/features/import/store.spec.ts`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts` during the repair-selection drift findings pass to prove restored previews also restore preview-aligned repair controls after canceled or failed repair replays.
- Ran `./scripts/with-node.sh npm test -- src/features/import/parse-import-preview.spec.ts src/features/import/workspace-import-route.spec.ts src/app/router/shell-routes-hydration.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts` after the remaining replay-source, confirm-materialization, concurrent-rollback, workspace-cache, and persisted-handle findings pass.
- Ran `./scripts/with-node.sh npm test -- src/features/import/normalize-preview.spec.ts src/app/router/shell-routes-hydration.spec.ts src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm test -- tests/integration/workspace-reopen.test.ts`, `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts` during the R4 blocking-findings closure pass for cache cleanliness, post-policy type gating, single-row header recovery, and persisted-handle sanitation.
- Ran `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts` during the completion-path workflow pass to confirm the live tree still satisfies Story 2.2 after the R4 blocking fixes and before advancing the story back to review.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts src/features/workspace-persistence/save-workspace.spec.ts src/services/persistence/repositories/workspace-repository.spec.ts src/features/import/parse-import-preview.spec.ts src/features/import/workspace-import-route.spec.ts` red/green for the R9 stale-preview, required-handle, digest provenance, repository verification, and sparse-workbook regressions.
- Ran `bash ./scripts/with-node.sh npm test -- tests/integration/workspace-reopen.test.ts src/app/router/shell-routes-hydration.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts --grep "persists native-picker file handles"` after closing the R9 findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/app/router/shell-routes-hydration.spec.ts src/features/import/parse-import-preview.spec.ts`, `bash ./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts --grep "persists native-picker file handles"`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R10 hydration-order, dense sparse-workbook, and native-picker persistence-coverage findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/app/router/shell-routes-hydration.spec.ts src/features/workspace-persistence/save-workspace.spec.ts src/features/import/parse-import-preview.spec.ts src/features/import/workspace-import-route.spec.ts`, `bash ./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts --grep "persists native-picker file handles"`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R11 hydration-handle filtering, source-backed confirm, dense sparse-workbook, exact-boundary row-count, and native-picker hydrated-kernel coverage findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/import/parse-import-preview.spec.ts src/features/workspace-persistence/save-workspace.spec.ts src/services/persistence/fs-access/local-import-files.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R12 dense-workbook materialization, final repository handle verification, workbook row-count, source-validation memory, and stale confirm-error findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/import/parse-import-preview.spec.ts src/services/persistence/repositories/workspace-repository.spec.ts src/features/workspace-persistence/save-workspace.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R13 dense-workbook partial-preview, serialized repository verification, source metadata synchronization, and story file-list findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/workspace-persistence/save-workspace.spec.ts src/features/import/parse-import-preview.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R14 concurrent-save guard, dense fallback partial-preview, and story-loop artifact scoping findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/workspace-persistence/save-workspace.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts src/features/import/parse-import-preview.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R15 stale async-save, direct reopen sanitation-order, handle-provenance concurrency, dense fallback own-row, and safe P3 workbook row-count findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/import/parse-import-preview.spec.ts src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts`, `bash ./.story-loop/adapter.sh review-scope "_bmad-output/implementation-artifacts/2-2-resolve-import-uncertainty-and-data-quality-issues-before-commit.md" HEAD`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R16 workbook-gap, sparse-workbook, direct-reopen, shared-handle, story-loop-scope, exact-count, and confirm-materialization findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/import/parse-import-preview.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts src/features/workspace-persistence/save-workspace.spec.ts src/features/import/workspace-import-route.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R17 sparse/dense workbook preview, direct reopen sanitation, handle-identity concurrency, and confirm-materialization cancellation findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/import/parse-import-preview.spec.ts src/services/persistence/fs-access/local-import-files.spec.ts src/features/import/workspace-import-route.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R18 sparse workbook preview bounds, dense own-row access, unsafe sparse-address, and source-validation cancellation findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/import/parse-import-preview.spec.ts`, `bash ./.story-loop/adapter.sh review-scope "_bmad-output/implementation-artifacts/2-2-resolve-import-uncertainty-and-data-quality-issues-before-commit.md" HEAD`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R19 sparse workbook gap/prototype findings and Git-quoted deleted-path review-scope follow-up.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/import/parse-import-preview.spec.ts src/features/import/workspace-import-route.spec.ts src/features/workspace-persistence/save-workspace.spec.ts src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R21 dense/sparse workbook blank-gap, confirm-time materialization recovery, stale save preparation, and source-validation abort-controller findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/import/workspace-import-route.spec.ts src/features/import/parse-import-preview.spec.ts src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts src/services/persistence/repositories/workspace-repository.spec.ts`, `bash ./.story-loop/adapter.sh review-scope "_bmad-output/implementation-artifacts/2-2-resolve-import-uncertainty-and-data-quality-issues-before-commit.md" HEAD`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R22 reject-during-persistence, sparse/dense fallback budget, source-handle cancellation, repository verification cancellation, and rename/copy scope findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/services/persistence/fs-access/local-import-files.spec.ts src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts src/services/persistence/indexed-db/workspace-storage.spec.ts src/features/import/parse-import-preview.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R23 abort-aware validation, hydration timeout, IndexedDB-open cancellation, sparse own-cell ordering, and wide sparse `!ref` column-probing findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/import/parse-import-preview.spec.ts src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts src/features/workspace-persistence/save-workspace.spec.ts src/services/persistence/indexed-db/workspace-storage.spec.ts`, `bash ./.story-loop/adapter.sh review-scope "_bmad-output/implementation-artifacts/2-2-resolve-import-uncertainty-and-data-quality-issues-before-commit.md" HEAD`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R24 sparse-fallback, duplicate hydration, confirm-persistence timeout, IndexedDB-open cache, and exact status-path findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts src/features/workspace-persistence/save-workspace.spec.ts src/services/persistence/indexed-db/workspace-storage.spec.ts src/features/import/parse-import-preview.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R25 duplicate-handle hydration, non-cooperative confirm-persistence timeout, post-commit IndexedDB abort, and malformed sparse-key fallback findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/import/parse-import-preview.spec.ts src/services/persistence/fs-access/local-import-files.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R26 sparse own-cell ordering, leading styled-row, source-validation timeout, and non-canonical sparse-key findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/import/parse-import-preview.spec.ts src/features/workspace-persistence/save-workspace.spec.ts src/services/persistence/repositories/workspace-repository.spec.ts src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts src/services/persistence/fs-access/local-import-files.spec.ts`, `bash ./.story-loop/adapter.sh review-scope "_bmad-output/implementation-artifacts/2-2-resolve-import-uncertainty-and-data-quality-issues-before-commit.md" HEAD`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R27 sparse fallback, required source provenance, aggregate hydration/source-validation deadline, and rename/copy source-scope findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/import/parse-import-preview.spec.ts src/features/workspace-persistence/save-workspace.spec.ts src/features/import/workspace-import-route.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./.story-loop/adapter.sh review-scope "_bmad-output/implementation-artifacts/2-2-resolve-import-uncertainty-and-data-quality-issues-before-commit.md" HEAD` after closing the R28 sparse workbook materialization/fallback, post-commit save, reject-race, sparse-key hardening, and rename/copy paired-endpoint findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/import/workspace-import-route.spec.ts src/features/workspace-persistence/save-workspace.spec.ts src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts src/services/persistence/indexed-db/workspace-storage.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R29 import-entrypoint persistence guard, confirm-time sparse workbook acknowledgement, stale-save abort race, hydration sanitation continuation, IndexedDB late-open cleanup, and stale historical P3 story-artifact findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/import/parse-import-preview.spec.ts src/features/import/workspace-import-route.spec.ts` red/green, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R30 malformed sparse own-key budget and import-entrypoint persistence-pending message findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/import/parse-import-preview.spec.ts src/features/import/workspace-import-route.spec.ts src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts` red/green, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R31 sparse-workbook fallback, confirm-time import-entrypoint locking, and hydration timeout-share findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts src/features/import/parse-import-preview.spec.ts` red/green for the R32 duplicate-handle hydration, sparse styled-leading fallback, and sparse fallback partial-marker regressions.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/workspace-persistence/save-workspace.spec.ts src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after moving persisted handle byte verification behind the persistence service boundary and closing the R32 findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts src/features/import/parse-import-preview.spec.ts src/services/persistence/fs-access/portable-workspace-files.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R33 duplicate-hydration budgeting and safe P3 cancellation/partial-preview findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R34 shared-handle timeout cache finding.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts src/app/router/shell-routes-hydration.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R35 persisted-handle hydration backfill, duplicate-budget, aggregate-deadline, and route-unmount cancellation findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts src/app/router/shell-routes-hydration.spec.ts src/features/import/parse-import-preview.spec.ts` red/green, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R36 shared-handle hydration budgeting, cached route-hydration abort, raw persisted-handle grouping, sparse worksheet descriptor-read, and review-tooling scope findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts src/app/router/shell-routes-hydration.spec.ts src/features/workspace-persistence/save-workspace.spec.ts src/services/persistence/repositories/workspace-repository.spec.ts` red/green, `bash ./scripts/with-node.sh npm test -- tests/integration/workspace-reopen.test.ts src/features/workspace-persistence/save-workspace.spec.ts src/services/persistence/repositories/workspace-repository.spec.ts src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts src/app/router/shell-routes-hydration.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R37 persisted-handle parse cap, aborted cached hydration retry, and duplicate same-dataset provenance findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/services/persistence/indexed-db/workspace-storage.spec.ts src/app/router/shell-routes-hydration.spec.ts src/features/workspace-persistence/save-workspace.spec.ts src/services/persistence/repositories/workspace-repository.spec.ts`, `bash ./.story-loop/adapter.sh review-scope "_bmad-output/implementation-artifacts/2-2-resolve-import-uncertainty-and-data-quality-issues-before-commit.md" HEAD`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R38 untracked-directory scope, abortable hydration load, and handleless-dataset provenance findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/services/persistence/indexed-db/workspace-storage.spec.ts src/features/workspace-persistence/save-workspace.spec.ts src/services/persistence/repositories/workspace-repository.spec.ts` red/green for the R39 shared IndexedDB-open and stale same-dataset source-handle regressions.
- Ran `bash ./scripts/with-node.sh npm test -- tests/integration/workspace-reopen.test.ts src/services/persistence/indexed-db/workspace-storage.spec.ts src/features/workspace-persistence/save-workspace.spec.ts src/services/persistence/repositories/workspace-repository.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R39 P2 findings.
- Ran `bash ./scripts/with-node.sh npm test -- src/services/persistence/indexed-db/workspace-storage.spec.ts` red/green for the R40 shared IndexedDB-open list-records waiter regression, then ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after closing the R40 P2 finding.

### Completion Notes List

- Story 2.2 now explicitly owns the preview-to-confirm boundary that Story 2.1 deferred.
- The story context directs the developer to reuse existing import route/store/worker seams, not replace them.
- Dirty benchmark inventory and shared issue-record reuse are now part of the story contract instead of implied follow-up work.
- The commit path is constrained to real workspace contracts; schema bypasses and fake renderer persistence are explicitly disallowed.
- Completed the repair contract by carrying repair selections, issue-backed repair cards, and worker reparse inputs through the preview model, worker schema, import store, and route orchestration.
- Completed the confirm/reject workflow by committing confirmed imports through `WorkspaceKernel`, bootstrapping the minimal placeholder graph contract, and keeping rejected previews out of canonical state.
- Added the missing dirty benchmark fixture family plus Playwright acceptance coverage for delimiter, header, type, missing-value, and reject flows without regressing the clean intake paths.
- Closed the review pass by moving canonical kernel ownership into the shell route, preserving repair decisions in the confirm ledger payload, cloning Excel buffers before worker transfer, requiring explicit repair confirmation selections, hardening preview-id idempotence, recognizing dirty CSV benchmarks through the normal import path, fixing bootstrap/readiness kernel consistency, and extending dirty-path E2E coverage to native-picker and pasted intake flows.
- Resolved the final review continuation pass by persisting workspace kernel stores across route unmounts, clearing fresh-import repair carryover, merging confirmed imports into existing canonical state with unique dataset/graph IDs, remounting workspace routes on workspace switches, restoring real issue detection timestamps, narrowing delimiter confirmation to benchmark CSV and pasted repair flows, and hiding Reject Import after confirmation.
- Revalidated the full regression suite after the final patch set: typecheck, full Vitest, lint, and full Playwright all passed.
- Closed the remaining review findings by hydrating named import workspaces from persisted canonical state, latching confirmation and locking repair controls after commit, carrying full repaired-import metadata into the confirmed dataset contract, restoring committed-preview markers after canceled imports, reattaching confirmed issues to the imported dataset entity, and persisting confirmed preview workspaces for hard-reload reopen flows.
- Revalidated the final findings pass with typecheck, full Vitest, lint, and the import Playwright suite including hard-reload reopen coverage.
- Closed the last persisted-state review pass by rolling back failed confirm saves before the preview locks, hydrating each workspace kernel from persistence only once, rejecting cross-workspace hydration records, sanitizing persisted dataset file handles through the reopen path before install, and falling back to a clean bootstrap store when persisted hydration payloads are corrupt.
- Revalidated the persisted-state fixes with focused hydration/confirm unit coverage, full typecheck, full Vitest, lint, and the import Playwright suite.
- Closed the pass-5 review findings by aligning confirmed import metadata to bounded preview semantics, requiring explicit non-comma CSV delimiter confirmation while keeping ordinary pasted-table imports unblocked, forcing duplicate-header review for the dirty header fixture, and converting the drop-all invalid-row repair into an inline blocking issue instead of a thrown import failure.
- Removed whole-source preview row materialization from the delimited import path, reduced Excel repair replays to a single retained workbook-buffer copy, sanitized preview-only repair actions and route targets out of committed canonical issues, and hardened workspace hydration to fall back cleanly when persisted reads reject.
- Revalidated the final pass with focused normalize/parse/shell-route/kernel coverage, full typecheck, full Vitest, lint, and the import Playwright suite.
- Closed the user-scoped review continuation findings by committing repaired row bodies into the canonical dataset contract, preserving native local-file handle provenance on confirmed imports, unblocking ordinary unambiguous non-comma CSV files from delimiter confirmation, and failing confirmation closed when durable browser persistence is unavailable.
- Left the story status `in-progress` because the latest review section still contains the separate `workspaceKernelStores` eviction finding that was explicitly out of scope for this pass.
- Revalidated this pass with focused import/persistence Vitest coverage, full typecheck, full Vitest, lint, and the import Playwright suite.
- Closed the remaining review findings by aligning repair gating to the full confirmed dataset while keeping preview rendering bounded, promoting ordinary non-comma delimiter assumptions to high confidence unless the dirty delimiter benchmark explicitly requires confirmation, preserving inline empty-result handling for drop-invalid repairs, falling back cleanly from transient hydration read failures, and evicting least-recently-used workspace kernel stores.
- Revalidated the closing pass with focused normalize/parse/hydration/kernel coverage, full typecheck, full Vitest, lint, and the import Playwright suite.
- Revalidated the user-scoped findings pass and confirmed the current tree already closes the confirm fail-closed, preview-identity, hydration retry, reopen-validation, late-column acknowledgement, and repair replay-memory findings without further code changes.
- Left the story status `in-progress` because `src/features/import/parse-import-preview.ts` still materializes full confirmed rows before the preview boundary, so the separate large-file preview-budget regression review item remains unresolved.
- Closed the final preview-budget review finding by establishing the CSV and workbook preview boundary before replaying full confirmed-row materialization, and added parser regressions that fail if late rows are read before the bounded preview window is known.
- Revalidated the closing pass with targeted parse-preview coverage, full typecheck, full Vitest, lint, and the import Playwright suite, and returned the story to review.
- Closed the remaining findings by requiring explicit confirmation for truly ambiguous CSV delimiter detection, leaving persisted workspace hydration retryable after parse/install failures, and backfilling the visible preview from surviving confirmed rows when drop-invalid removes the initial preview slice.
- Revalidated the final findings pass with focused import/hydration regressions, full typecheck, full Vitest, lint, and the import Playwright suite, and returned the story to review.
- Closed the current findings-only pass by counting trailing missing and malformed cells across the confirmed schema, indexing additional-column acknowledgements against the full confirmed layout, clearing inherited committed-preview markers on fresh reimports, restoring the last valid preview after repair replay failures, failing kernel confirmation closed when blocking issues remain, and keeping ambiguous CSV and pasted-table delimiter detection behind the repair gate even when auto-detection collapses to one column.
- Revalidated the pass with focused normalize/parse/store/kernel regressions, full typecheck, full Vitest, lint, and the import Playwright suite, and kept the story `in-progress` because the earlier hydration/preview persistence and Playwright-worker findings in the preceding review section remain open for a later scoped pass.
- Revalidated the remaining blocking findings and confirmed the current Story 2.2 tree already closes the non-benchmark delimiter-ambiguity gate, persisted-hydration retry after parse/install failures, and drop-invalid preview backfill behavior without additional runtime edits.
- Returned the story to `review` after rerunning focused regressions, full typecheck, full Vitest, lint, and the import Playwright suite; the remaining native-picker persistence and Playwright worker follow-ups stay open as non-blocking P3 items.
- Closed the remaining blocking review finding by restoring preview-owned repair selections whenever a preserved preview is brought back after cancel or repair replay failure, so the visible repair cards cannot drift away from the restored preview state.
- Revalidated the closing pass with focused store regressions, full typecheck, full Vitest, lint, and the import Playwright suite, and returned the story to `review` while leaving the non-blocking P3 follow-ups open.
- Closed the remaining technical review findings by restoring per-preview replay/file-handle context after failed follow-on imports, deferring full confirmed-dataset materialization to an explicit confirm-time worker pass, switching failed confirm rollback to a concurrent-safe compensating kernel mutation when newer mutations land first, guarding workspace-kernel LRU eviction against dirty live stores, and rejecting persisted dataset file handles whose handle objects do not match the dataset source file metadata.
- Revalidated the findings-closure pass with focused parser/import/hydration/reopen regressions, full typecheck, full Vitest, lint, and the import Playwright suite, and returned the story to `review` while leaving only the explicitly out-of-scope non-blocking P3 follow-ups open.
- Closed the remaining R4 blocking findings by marking successfully persisted kernel stores clean for LRU eviction, recomputing mixed-type confirmation from the post-policy confirmed dataset, keeping explicit single-row header selections in a recoverable blocking preview state, and verifying persisted file handles against live file metadata during save and reopen hydration.
- Added focused regressions for the new cache, normalization, persisted-handle, and reopen-save-reopen paths, then revalidated with targeted Vitest, full typecheck, full Vitest, lint, and the import Playwright suite.
- Left the story status `in-progress` for this implementation-only pass because the non-blocking R4 P3 follow-ups remain open and this worker was scoped only to the blocking findings.
- Revalidated the completion-path workflow without additional code changes, confirmed the latest R4 section leaves only non-blocking P3 follow-ups open, and advanced the story status back to `review`.
- Closed the R6 implementation pass by hardening story-loop review-scope extraction, schema-valid blocker/completion report contracts, failed-lane gating, gating-priority deferral rules, acceptance source normalization, story-loop mode preservation, and decision-needed status validation.
- Preserved the import preview boundary by keeping CSV and workbook preview parsing on bounded sample rows until explicit confirm-time materialization, while retaining full confirmed-dataset materialization only for confirmation.
- Applied the user decisions by failing closed on stale local-file provenance before confirm/save and failing closed on persisted hydration load/parse failures before exposing a writable workspace route.
- Restored source-backed repair visibility by sanitizing persisted file handles before reopen issue localization, clearing stale dataset `sourceFile` metadata when no usable handle survives save/reopen, and pruning stale preview replay contexts.
- Revalidated the R6 pass with focused regressions, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint`; all passed.
- Closed the R7 gating findings by comparing source handles to previewed file bytes before confirmation, preserving actionable stale-source errors, surfacing confirm-time materialization blockers as updated repair-card preview issues, limiting story-loop review scope to story-listed files, persisting explicit empty dataset-file-handle lists when save sanitation drops every handle, bounding workbook preview-only row metadata collection, and rejecting blocked/failed review reports that claim done status.
- Revalidated the R7 pass with focused regressions plus full typecheck, full Vitest, and lint; all passed. The story is back in `review` with only non-gating P3 follow-up disposition remaining.
- Closed the R8 gating findings by moving local-file byte identity checks behind the File System Access service boundary, carrying validated source digests into save-time handle preparation, failing required source-backed saves closed when bytes drift before persistence, caching confirm-time blocker preview replay context, reporting unreadable source bytes as source-reselection failures, validating persisted snapshot identity before handle sanitation, and allowing decision-needed-only P3 action-item report validation.
- Revalidated the R8 pass with focused import/router/persistence regressions, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and a direct story-loop validator probe; all passed.
- Closed the R9 gating findings by checking the visible preview before surfacing confirm-time blockers, failing required source-backed saves when no verified handles remain, rejecting digest-less persisted handles on save and hydration, and forcing repository saves to reread and verify live handle bytes before persisting supplied provenance.
- Addressed the safe R9 P3 follow-ups by avoiding inflated sparse-workbook blank range scans during preview collection and adding OPFS-backed native-picker handle persistence coverage through confirm, reload, and reopen sanitation.
- Revalidated the R9 pass with targeted regressions, full typecheck, full Vitest, lint, and targeted native-handle Playwright coverage; all passed and the story is ready for review.
- Closed the R10 gating hydration finding by validating persisted workspace records through the reopen contract before any persisted dataset file-handle byte reads, then rerunning sanitation for accepted workspaces.
- Addressed the safe R10 P3 follow-ups by bounding dense sparse-workbook preview scans across high row-index gaps and strengthening the native-picker persistence E2E to reload/reopen without invoking the picker again.
- Revalidated the R10 pass with targeted regressions, targeted native-handle Playwright coverage, full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R11 gating findings by filtering persisted file-handle records to the reopened snapshot before hydration byte reads and requiring only the newly confirmed source-backed dataset handle while allowing unrelated stale prior handles to be dropped and stripped on save.
- Addressed the safe R11 P3 follow-ups by tightening dense sparse-workbook present-empty-row scanning and key fallback bounds, avoiding exact-boundary delimited preview row-count inflation, and extending the native-picker E2E to prove hydrated-kernel handle retention through a post-reload save without rerunning the picker.
- Revalidated the R11 pass with focused router/save/parser/import regressions, targeted native-handle Playwright coverage, full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R12 findings by materializing dense workbook rows after present-empty gaps during confirm, making repository final-byte verification fail required source-backed saves closed, reporting workbook exact-boundary preview counts without inflation, serializing source-byte validation reads, and suppressing stale confirm-time errors after preview changes.
- Revalidated the R12 pass with focused parser/save/source-validation regressions plus full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R13 findings by marking dense workbook previews partial when present-empty gaps stop bounded preview scanning before later rows, serializing repository final file-handle verification reads, synchronizing live and persisted dataset `sourceFile` metadata after handle sanitation/final verification drops, and adding the runtime-review/Zone.Identifier artifacts to story accounting.
- Revalidated the R13 pass with focused parser/repository/save regressions plus full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R14 findings by saving workspace snapshots and ledgers from one captured kernel version, refusing to mark newer concurrent mutations clean, correcting dense-workbook partial flags after sparse fallback exhaustion, and ignoring generated story-loop active-run/log/report artifacts without deleting current orchestration state.
- Revalidated the R14 pass with focused parser/save regressions plus full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R15 findings by aborting stale repository/storage writes when kernel state changes mid-save, extending the save guard to live dataset-file-handle and source-file metadata signatures, sanitizing and snapshot-filtering persisted file handles before direct reopen issue localization, limiting dense worksheet fallback enumeration to own row keys, and addressing safe dense-workbook P3 row-count/partial-preview cases.
- Revalidated the R15 pass with focused save/reopen/parser regressions plus full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R16 findings by preserving later dense workbook rows across present-empty gaps, bounding sparse workbook preview collection before confirmation, validating direct reopen records before persisted handle byte reads, retaining shared source-handle provenance for multiple datasets, parsing annotated story file-list paths in story-loop scope, reporting exact workbook sample-boundary counts, and canceling stale confirm-time materialization workers.
- Revalidated the R16 pass with focused parser/persisted-handle/reopen regressions, story-loop scope parsing, full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R17 findings by making sparse workbook preview sampling deterministic for out-of-order sparse cell keys, removing dense preview fallback dependence on all-key sorting, tolerating malformed direct-reopen dataset-handle entries before hydration sanitation, treating same-metadata handle-object swaps as stale save provenance, and cancel-guarding confirm-time source reads before worker creation.
- Revalidated the R17 pass with focused parser/reopen/save/import-route regressions plus full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R18 findings by scanning sparse workbook previews through bounded `!ref` row/column probes instead of full key collection before confirmation, switching the primary dense preview loop to own row descriptors, rejecting unsafe sparse cell columns, and cancel-guarding confirm-time source validation before subsequent byte reads.
- Revalidated the R18 pass with focused parser/source-validation/import-route regressions plus full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R19 findings by counting present-empty sparse rows toward preview blank-gap bounds, recovering leading-blank sparse `!ref` workbooks through the bounded own-cell preview sampler, scoping sparse cell reads away from inherited dense-row properties, and dequoting Git status paths for story-loop review scope.
- Revalidated the R19 pass with focused parser regressions, story-loop review-scope output, full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R20 findings by recovering sparse workbooks with leading present-empty rows, bounding sparse and dense workbook fallback processing before confirmation, synchronizing direct-reopen dataset `sourceFile` metadata to surviving handles, cancel/staleness-checking repository final handle verification, and strengthening the native-picker persistence E2E guard.
- Revalidated the R20 pass with focused parser/reopen/repository regressions, targeted native-picker Playwright coverage, full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R21 findings by counting dense rows with blank cell objects toward the preview blank-gap bound, counting sparse fallback leading empty rows instead of cells, timing out hung confirm-time materialization workers while keeping Reject Import available as recovery, passing save abort/staleness checks into source-handle preparation, and guarding source-validation abort-controller cleanup against stale confirm flows.
- Revalidated the R21 pass with focused parser/import-route/save/persisted-handle regressions plus full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R22 findings by hiding Reject Import only during confirm persistence, keeping sparse fallback budgets from being exhausted by malformed keys or leading present-empty cells, making file-handle save/repository byte work cancellation-aware, skipping pre-gap dense fallback row keys, and parsing rename/copy status in either porcelain status column.
- Revalidated the R22 pass with focused parser/import-route/persistence/repository regressions, story-loop review-scope probing, full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R23 findings by making confirm-time source validation abort-aware during file and digest reads, adding timeout/abort protection to hydration handle sanitation, aborting stale IndexedDB saves while database open is pending, making sparse own-cell fallback row ordering deterministic before scan caps, and switching wide sparse `!ref` previews to bounded own-cell probing.
- Revalidated the R23 pass with focused regressions plus full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R24 findings by bounding sparse own-cell fallback work without collecting/sorting every sparse key, deduplicating invalid persisted handle hydration attempts before timeout-prone validation, timing out hung confirm-time persistence, clearing aborted IndexedDB-open cache promises, and preserving exact `git status -z` paths in story-loop scope parsing.
- Revalidated the R24 pass with focused regressions, story-loop review-scope probing, full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R25 findings by accepting later valid duplicate persisted file-handle entries after earlier invalid attempts, racing confirm-time repository persistence against the abort/timeout signal even for non-cooperative saves, treating completed IndexedDB transactions as committed despite late abort signals, and ignoring malformed sparse worksheet keys for the own-cell fallback scan cap.
- Revalidated the R25 pass with focused regressions plus full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R26 findings by deterministically selecting sparse fallback row candidates before applying own-cell read caps, counting leading styled/blank sparse gaps by row rather than cell, timing out non-cooperative confirm-time source validation reads, and rejecting non-canonical sparse cell keys consistently with canonical cell reads.
- Revalidated the R26 pass with focused parser/source-validation regressions plus full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R27 findings by adding bounded sparse own-cell fallback probing before any own-key scan, recovering stale short `!ref` sparse workbooks through the same bounded fallback, enforcing required source-backed saves against the dataset's current source-file token/name, using aggregate deadlines for persisted-handle hydration and confirm-time source validation, and preserving rename/copy source paths in story-loop review scope.
- Revalidated the R27 pass with focused parser/save/repository/hydration/source-validation regressions plus full typecheck, full Vitest, lint, and story-loop scope probing; all passed and the story is ready for review.
- Closed the R28 findings by materializing confirmed sparse workbook rows from all validated own cells, retrying own-key fallback after empty leading grid probes, avoiding sparse malformed/accessor key hazards, keeping post-commit stale saves successful without marking newer live state clean, synchronously blocking stale Reject handlers during persistence, and preserving both rename/copy endpoints when either side is story-scoped.
- Revalidated the R28 pass with focused parser/save/import-route regressions plus full typecheck, full Vitest, lint, and story-loop scope probing; all passed and the story is ready for review.
- Closed the R29 findings by synchronously blocking all import entrypoints during confirm persistence, requiring a fresh acknowledgement pass when confirm-time workbook materialization expands a previously complete preview, racing stale save aborts for non-cooperative repositories without regressing completed saves, continuing hydration sanitation past slow invalid handles within a bounded aggregate budget, closing late-success IndexedDB open connections after abort, and reconciling stale historical P3 review checkboxes.
- Revalidated the R29 pass with focused regressions plus full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R30 findings by charging malformed sparse worksheet own keys against the fallback scan budget before address parsing and rendering visible persistence-pending guidance beside disabled import entrypoints.
- Revalidated the R30 pass with focused parser/route regressions plus full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R31 findings by allowing the sparse own-key fallback to run after small styled/empty leading grid probes, locking import entrypoints for the entire confirm validation/materialization/save window, and sizing hydration validation timeouts from validatable handle entries instead of malformed raw entries.
- Revalidated the R31 pass with focused parser/route/hydration regressions plus full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R32 findings by grouping persisted handle hydration attempts by source entry before timeout budgeting, fairly round-robining duplicate stale entries so later usable handles can be validated, moving persisted-handle live byte/digest checks into `services/persistence`, and letting sparse own-key fallback recover styled/blank-leading workbooks without stale partial markers after full fallback exhaustion.
- Revalidated the R32 pass with focused parser/persisted-handle/save regressions plus full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R33 findings by splitting same-source duplicate hydration budgets across duplicate candidates, clearing sparse leading-grid partial markers when a declared small range is fully captured, and checking workspace handle validation cancellation before starting native handle reads.
- Revalidated the R33 pass with focused persisted-handle/parser/portable-file regressions plus full typecheck, full Vitest, and lint; all passed and the story is ready for review.
- Closed the R34 persisted-handle hydration finding by scoping failed validation caching to the current dataset/source entry while keeping successful shared-handle validations reusable for compatible entries.
- Added regression coverage proving a timed-out shared handle does not poison later compatible hydration entries that can validate within their own budget, then reran focused and full validation; all passed and the story is ready for review.
- Closed the R35 persisted-handle hydration findings by immediately backfilling compatible shared-handle entries after a later validation succeeds, budgeting duplicate candidates by unique validation attempts instead of raw duplicates, enforcing one aggregate handle-validation timeout across getFile/arrayBuffer/digest phases, and aborting route-driven hydration sanitation on unmount.
- Added focused regressions for shared-handle backfill, duplicate-candidate timeout fairness, aggregate phase deadlines, and hydration cancellation, then reran focused and full validation; all passed and the story is ready for review.
- Closed the R36 findings by weighting a shared handle's validation budget by the compatible entries it can backfill, bounding raw persisted-handle grouping before validation, decoupling each route caller's abort from the shared cached hydration promise, using descriptor-based sparse worksheet cell reads after own-property checks, and documenting the review-tooling scope expansion as intentional governance/support work carried in Story 2.2's existing File List.
- Added regressions for shared-handle backfill budgeting, raw malformed handle grouping bounds, active remount hydration after a prior route abort, and accessor-backed sparse worksheet cells; full typecheck, Vitest, and lint validation passed, and the story is ready for review.
- Closed the R37 P2 gating findings by capping raw persisted handle parsing before hydration sanitation, discarding aborted cached hydration attempts so fast remounts start fresh, and filtering same-dataset handle lists against the current required source before save/repository source metadata synchronization.
- Added regressions for parse-time handle caps, remount after an already-aborted shared hydration attempt, and duplicate same-dataset provenance preservation; full typecheck, Vitest, and lint validation passed, and the story is ready for review with the R37 P3 items left open.
- Closed the R38 P2 gating findings by enumerating untracked child files in story-loop review scope, adding abort/timeout bounds to persisted workspace record loading during hydration, and dropping stale dataset-file-handle entries for datasets that no longer declare source-file metadata before save/repository synchronization.
- Added regressions for abortable IndexedDB loads, bounded/retryable route hydration, and handleless dataset provenance sanitation; targeted coverage, story-loop scope probing, full typecheck, full Vitest, and lint validation passed, and the story is ready for review with non-gating P3 items left open.
- Closed the R39 P2 gating findings by retaining shared pending IndexedDB opens when only one caller aborts, while still closing a late open when no other caller is waiting, and by dropping optional same-dataset handles unless they match the dataset's current source-file metadata.
- Added focused IndexedDB, save-helper, repository, and reopen integration regressions for the R39 fixes; full typecheck, Vitest, and lint validation passed, and the story is ready for review with R39 P3 items left open.
- Closed the R40 P2 gating finding by counting `listRecords()` calls as waiters on the shared IndexedDB open promise, preventing aborting concurrent callers from clearing or closing a late-opened database while list enumeration still needs it.
- Added focused IndexedDB regression coverage for the `listRecords()` shared-open race; full typecheck, Vitest, and lint validation passed, and the story is ready for review with the non-gating R40 P3 console-noise follow-up left open.
- Review pass R41/pass 34 found no unresolved P0/P1/P2 or decision-needed findings after fresh four-lane story-loop review; full typecheck, Vitest, lint, and build validation passed; the remaining route-unmount console-noise P3 is deferred as non-gating/out of adjacent scope.

### File List

- `src/app/router/shell-routes.tsx`
- `src/app/router/shell-routes.spec.tsx`
- `src/app/router/shell-routes-hydration.spec.ts`
- `.agents/skills/bmad-code-review/steps/step-01-gather-context.md`
- `.agents/skills/bmad-code-review/steps/step-02-review.md`
- `.agents/skills/bmad-code-review/steps/step-03-triage.md`
- `.agents/skills/bmad-code-review/steps/step-04-present.md`
- `.agents/skills/bmad-review-runtime-integration-auditor/SKILL.md`
- `.agents/skills/mermaid-expert/SKILL.mdZone.Identifier` (deleted)
- `.gitignore`
- `.agents/skills/bmad-story-loop-orchestrator/scripts/validate_story_loop_json.py`
- `.story-loop/adapter.sh`
- `_bmad-output/benchmarks/benchmark_set_dirty/README.md`
- `_bmad-output/benchmarks/benchmark_set_dirty/csv/import.dirty.delimiter-repair.csv`
- `_bmad-output/benchmarks/benchmark_set_dirty/csv/import.dirty.delimiter-repair.md`
- `_bmad-output/benchmarks/benchmark_set_dirty/csv/import.dirty.header-repair.csv`
- `_bmad-output/benchmarks/benchmark_set_dirty/csv/import.dirty.header-repair.md`
- `_bmad-output/benchmarks/benchmark_set_dirty/csv/import.dirty.missing-value-repair.csv`
- `_bmad-output/benchmarks/benchmark_set_dirty/csv/import.dirty.missing-value-repair.md`
- `_bmad-output/benchmarks/benchmark_set_dirty/csv/import.dirty.type-repair.csv`
- `_bmad-output/benchmarks/benchmark_set_dirty/csv/import.dirty.type-repair.md`
- `_bmad-output/implementation-artifacts/2-2-resolve-import-uncertainty-and-data-quality-issues-before-commit.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/features/import/benchmark-timing.spec.ts`
- `src/features/import/confirm-import.ts`
- `src/features/import/normalize-preview.spec.ts`
- `src/features/import/normalize-preview.ts`
- `src/features/import/owned-import-benchmarks.ts`
- `src/features/import/parse-import-preview.ts`
- `src/features/import/parse-import-preview.spec.ts`
- `src/features/import/preview-model.ts`
- `src/features/import/store.spec.ts`
- `src/features/import/store.ts`
- `src/features/import/workspace-import-route.spec.ts`
- `src/features/import/workspace-import-route.tsx`
- `src/schemas/workspace/workspace-snapshot.ts`
- `src/features/workspace-persistence/persisted-dataset-file-handles.ts`
- `src/features/workspace-persistence/persisted-dataset-file-handles.spec.ts`
- `src/features/workspace-persistence/reopen-workspace.spec.ts`
- `src/features/workspace-persistence/reopen-workspace.ts`
- `src/features/workspace-persistence/save-workspace.ts`
- `src/features/workspace-persistence/save-workspace.spec.ts`
- `src/features/workspace-persistence/workspace-kernel-persistence-state.ts`
- `src/services/persistence/fs-access/local-import-files.spec.ts`
- `src/services/persistence/fs-access/local-import-files.ts`
- `src/services/persistence/fs-access/portable-workspace-files.spec.ts`
- `src/services/persistence/fs-access/portable-workspace-files.ts`
- `src/services/persistence/indexed-db/workspace-storage.spec.ts`
- `src/services/persistence/indexed-db/workspace-storage.ts`
- `src/services/persistence/repositories/workspace-repository.ts`
- `src/services/persistence/repositories/workspace-repository.spec.ts`
- `src/schemas/worker/import-preview.spec.ts`
- `src/schemas/worker/import-preview.ts`
- `src/stores/workspace-kernel/bootstrap.ts`
- `src/stores/workspace-kernel/dataset-file-handle-metadata.ts`
- `src/stores/workspace-kernel/index.ts`
- `src/stores/workspace-kernel/reducers.ts`
- `src/stores/workspace-kernel/store.ts`
- `src/stores/workspace-kernel/types.ts`
- `src/stores/workspace-kernel/workspace-kernel.spec.ts`
- `tests/e2e/import.spec.ts`
- `tests/integration/workspace-reopen.test.ts`

### Change Log

- 2026-04-22: Created ready-for-dev story context for Story 2.2 and advanced sprint tracking.
- 2026-04-22: Completed Story 2.2 import repair, confirm/reject, dirty benchmark, and verification coverage work; advanced the story to review.
- 2026-04-22: Resolved the remaining review findings, reran targeted verification plus the import E2E suite, and returned the story to review.
- 2026-04-22: Addressed the final review continuation findings, reran the full regression suite, and returned the story to review.
- 2026-04-23: Addressed the remaining R4 blocking P2 findings, reran targeted regressions plus full validation, and kept the story in progress because only non-blocking follow-ups remain in the current review section.
- 2026-04-22: Closed the last unresolved review findings around persisted workspace hydration, confirm idempotence, full repaired-import metadata, canceled-preview commit state restoration, confirmed issue entity linkage, and hard-reload reopen persistence; reran typecheck, full Vitest, lint, and the import Playwright suite.
- 2026-04-22: Addressed the final persisted-state review findings around confirm-save rollback, one-time workspace hydration, cross-workspace hydration rejection, dataset-file-handle sanitization, and corrupt-record bootstrap fallback; reran focused regression coverage, typecheck, full Vitest, lint, and the import Playwright suite.
- 2026-04-22: Closed the remaining delimiter-ambiguity, hydration-retry, and drop-invalid preview-alignment findings; reran focused regressions, typecheck, full Vitest, lint, and the import Playwright suite; advanced the story back to review.
- 2026-04-22: Addressed the pass-5 review findings around bounded preview semantics, delimiter/header confirmation gates, inline empty-result repair handling, canonical issue sanitization, hydration fallback on persistence rejection, workbook replay buffer retention, and updated import acceptance coverage; reran typecheck, full Vitest, lint, and the import Playwright suite.
- 2026-04-22: Review pass 6 found unresolved confirmed-import handoff, local-file provenance, delimiter-confirmation, non-persistent confirm, and workspace-cache findings; returned the story to in-progress.
- 2026-04-22: Addressed the user-scoped review-continuation findings around confirmed dataset row-body persistence, native local-file provenance retention, ordinary non-comma CSV delimiter gating, and fail-closed confirm persistence; reran focused Vitest coverage, full typecheck, full Vitest, lint, and the import Playwright suite while keeping the story in-progress for the remaining out-of-scope workspace-cache finding.
- 2026-04-22: Closed the remaining review-continuation findings around full-dataset repair gating, bounded preview parsing, transient hydration fallback, delimiter-confidence signaling, and workspace kernel store eviction; reran focused Vitest coverage, full typecheck, full Vitest, lint, and the import Playwright suite, and returned the story to review.
- 2026-04-22: Revalidated the requested findings-only pass, marked the already-resolved confirm/preview/hydration/replay review items complete in the story record, and kept the story in-progress for the remaining preview-budget materialization finding in `src/features/import/parse-import-preview.ts`.
- 2026-04-22: Split CSV and workbook preview sampling from full confirmed-row materialization in `src/features/import/parse-import-preview.ts`, added regression coverage for the bounded preview boundary, reran targeted and full validations, and returned the story to review.
- 2026-04-22: Review pass R1 revalidated the full story scope against the current uncommitted tree, found unresolved import repair/confirmation gaps in the preview store, normalization, parser, and kernel reducer seams, left them as action items, and returned the story to in-progress.
- 2026-04-22: Closed the current normalize/parser/store/kernel findings pass around trailing missing-value handling, additional-column acknowledgement stability, fresh re-import commit state, repair replay recovery, kernel confirm blocking invariants, and ambiguous CSV/pasted delimiter gating; reran focused regressions, full typecheck, full Vitest, lint, and the import Playwright suite; kept the story in-progress for the earlier unresolved hydration/preview persistence and Playwright-worker findings.
- 2026-04-22: Revalidated the remaining blocking review findings against the live tree, confirmed the delimiter-ambiguity, hydration-retry, and drop-invalid preview-backfill fixes were already in place, reran focused and full validations, and returned the story to review while leaving the non-blocking P3 follow-ups open.
- 2026-04-22: Closed the remaining blocking repair-replay control-drift finding in the import preview store, reran focused and full validations, and returned the story to review while leaving the non-blocking P3 follow-ups open.
- 2026-04-23: Closed the remaining replay-source, confirm-materialization, concurrent-rollback, workspace-cache dirty-guard, and persisted-file-handle sanitation findings; reran focused regressions, full typecheck, full Vitest, lint, and the import Playwright suite; and returned the story to review.
- 2026-04-23: Review pass R4 revalidated the full uncommitted Story 2.2 tree plus targeted runtime probes, resolved the prior governance questions by user clarification, left four P2 and two P3 action items open, and returned the story to in-progress.
- 2026-04-23: Ran the completion-path workflow pass with full validation, confirmed the R4 P0/P1/P2 items are closed and only the two non-blocking P3 follow-ups remain, and advanced the story back to review.
- 2026-04-25: Closed the R6 story-loop contract, preview-boundary, fail-closed provenance/hydration, persisted-handle warning, stale source metadata, and replay-context pruning findings; reran typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-25: Closed the R7 P1/P2 gating findings for byte-identity source validation, confirm-time repair surfacing, story-loop scope, explicit empty handle persistence, bounded workbook preview metadata, and blocked/failed report validation; reran focused regressions, typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-25: Closed the R8 source-byte identity, replay-context, source-error, persistence-boundary, hydration-order, and decision-needed P3 validator findings; reran focused regressions, typecheck, full Vitest, lint, and the validator probe; advanced the story back to review.
- 2026-04-25: Closed the R9 stale confirm-time blocker, required source-handle, digest-less provenance, repository verification, sparse workbook scan, and native-picker persistence coverage findings; reran targeted regressions plus full typecheck, full Vitest, lint, and targeted Playwright; advanced the story back to review.
- 2026-04-25: Closed the R10 persisted-hydration validation-order finding and safe P3 follow-ups for dense sparse-workbook scanning and native-picker persistence coverage; reran targeted regressions plus full typecheck, full Vitest, lint, and targeted Playwright; advanced the story back to review.
- 2026-04-25: Closed the R11 persisted-handle hydration filtering and source-backed confirm findings plus safe P3 parser and native-picker coverage follow-ups; reran focused regressions, targeted Playwright, full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-25: Closed the R12 dense-workbook confirm materialization, required repository handle verification, workbook exact-boundary count, source-validation memory, and stale confirm-error findings; reran focused regressions plus full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R13 dense-workbook partial-preview gating finding plus safe P3 follow-ups for serialized repository verification, source-file metadata synchronization, and story file-list accounting; reran focused regressions plus full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R14 concurrent save, story-loop artifact scoping, and dense-workbook fallback partial-preview findings; reran focused regressions plus full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-25: Closed the R15 stale async-save, direct reopen sanitation-order, handle-provenance concurrency, dense fallback own-row, and safe P3 workbook row-count findings; reran focused regressions plus full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R16 dense-workbook, sparse-workbook, reopen-validation, shared-handle, story-loop-scope, workbook row-count, and confirm-materialization findings; reran focused regressions plus full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R17 sparse sampling determinism, dense fallback enumeration, direct-reopen tolerance, handle-provenance, and confirm-time cancellation follow-ups; reran focused regressions plus full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R18 sparse preview bounds, primary dense own-row access, unsafe sparse-address, and confirm-time source-validation cancellation findings; reran focused regressions plus full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R19 sparse `!ref` preview gap, leading-blank sparse workbook recovery, sparse-read prototype pollution, R17 change-log accounting, and Git-quoted deleted-path review-scope findings; reran focused parser regressions, story-loop review-scope output, full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R20 sparse-workbook leading-present-empty, bounded fallback enumeration, direct-reopen source metadata, repository cancellation, and native-picker guard findings; reran focused regressions, targeted native-picker Playwright, full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R21 dense/sparse workbook blank-gap, confirm-time materialization recovery, save preparation cancellation, and source-validation abort-controller findings; reran focused regressions plus full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R22 reject-during-persistence, sparse/dense fallback budget, source-handle cancellation, repository verification cancellation, and rename/copy scope findings; reran focused regressions, story-loop scope probing, full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R23 abort-aware source validation, hydration sanitation timeout, IndexedDB-open cancellation, sparse own-cell ordering, and wide sparse `!ref` column-probing findings; reran focused regressions, full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R24 sparse fallback, duplicate hydration, confirm-persistence timeout, IndexedDB-open cache, and exact path parsing findings; reran focused regressions, story-loop scope probing, full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R25 duplicate-handle hydration, non-cooperative confirm-persistence timeout, post-commit IndexedDB abort, and malformed sparse-key fallback findings; reran focused regressions, full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R26 sparse own-cell fallback ordering, leading styled-row scan-cap, source-validation timeout, and non-canonical sparse-key findings; reran focused regressions plus full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R27 sparse fallback key-scan, same-dataset source provenance, aggregate hydration budget, stale short `!ref`, wide styled sparse row, aggregate source-validation deadline, and rename/copy source-scope findings; reran focused regressions, story-loop scope probing, full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R28 sparse workbook materialization/fallback, post-commit save, reject-persistence race, sparse-key hardening, and rename/copy paired-endpoint findings; reran focused regressions, story-loop scope probing, full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R29 import-entrypoint persistence guard, confirm-time sparse workbook acknowledgement, stale-save abort race, hydration sanitation continuation, IndexedDB late-open cleanup, and stale historical P3 artifact findings; reran focused regressions, full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R30 malformed sparse own-key budget finding and safe persistence-pending entrypoint-message follow-up; reran focused regressions plus full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R31 sparse workbook own-key fallback, confirm-time import-entrypoint guard, and persisted-handle hydration starvation findings; reran focused regressions plus full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R32 duplicate persisted-handle hydration, sparse styled-leading workbook fallback, persistence-boundary, and safe sparse partial-marker findings; reran focused regressions plus full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Review pass R33 found one remaining P2 duplicate-handle hydration budgeting issue plus two P3 follow-ups after fresh four-lane story-loop review and full validation; returned the story to in-progress.
- 2026-04-26: Closed the R33 duplicate same-source hydration budgeting issue and safe P3 follow-ups for sparse leading-grid partial markers and pre-read cancellation; reran focused regressions plus full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R34 shared-handle timeout cache finding; reran focused persisted-handle coverage plus full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R35 persisted-handle hydration findings and safe P3 route-cancellation/cache-disposition follow-ups; reran focused regressions, full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R36 shared-handle hydration budgeting, cached hydration abort, malformed grouping, sparse descriptor-read, and review-tooling scope findings; reran focused regressions plus full typecheck, full Vitest, and lint; advanced the story back to review.
- 2026-04-26: Closed the R37 P2 persisted-handle parse cap, aborted cached hydration retry, and duplicate same-dataset provenance findings; reran focused regressions plus full typecheck, full Vitest, and lint; advanced the story back to review while leaving the non-gating R37 P3 items open.
- 2026-04-26: Closed the R38 P2 untracked-directory review-scope, bounded hydration load, and handleless-dataset provenance findings; reran targeted regressions, story-loop scope probing, full typecheck, full Vitest, and lint; advanced the story back to review while leaving non-gating P3 items open.
- 2026-04-26: Closed the R39 P2 shared IndexedDB-open and stale same-dataset handle provenance findings; reran targeted regressions plus full typecheck, full Vitest, and lint; advanced the story back to review while leaving non-gating R39 P3 items open.
- 2026-04-26: Review pass R40 found one remaining P2 shared IndexedDB-open waiter-count issue plus one P3 console-noise follow-up after fresh four-lane story-loop review and full validation; returned the story to in-progress.
- 2026-04-26: Closed the R40 P2 shared IndexedDB-open list-records waiter-count finding; reran focused IndexedDB coverage plus full typecheck, full Vitest, and lint; advanced the story back to review while leaving the non-gating R40 P3 console-noise follow-up open.
- 2026-04-26: Review pass R41/pass 34 completed fresh four-lane story-loop review and full validation; no gating findings remained, and the route-unmount console-noise P3 was deferred as non-gating; advanced the story to done.

### Review Findings

- [x] [Review][Patch] Confirm Import writes into a route-local workspace kernel store instead of the app's canonical workspace state [src/features/import/workspace-import-route.tsx:680]
- [x] [Review][Patch] Repair selects render unresolved detected defaults as already selected, so users cannot explicitly confirm the suggested delimiter, header handling, column type, or missing-value policy without first changing to a different option [src/features/import/workspace-import-route.tsx:1487]
- [x] [Review][Patch] Excel repair replays reuse the transferred workbook `ArrayBuffer` from `sourceRequest`, so the second worker post can send a detached buffer and fail the repair path [src/features/import/workspace-import-route.tsx:960]
- [x] [Review][Patch] Confirmed imports do not persist the chosen repair decisions anywhere in the kernel confirm contract or `import.confirmed` ledger entry, despite Story 2.2 requiring downstream consumers to inherit those decisions [src/features/import/confirm-import.ts:4]
- [x] [Review][Patch] Committed-preview tracking is not idempotent because `previewId` only keys off source kind and row/column counts while Confirm Import stays clickable after success, allowing duplicate or mislabeled confirmed imports [src/features/import/normalize-preview.ts:685]
- [x] [Review][Patch] Dirty CSV benchmark fixtures are never recognized through normal CSV imports because benchmark detection only matches the clean fixture payload [src/features/import/owned-import-benchmarks.ts:61]
- [x] [Review][Patch] The import bootstrap snapshot seeds a placeholder graph that references a dataset ID not present in `datasets`, creating an internally inconsistent canonical snapshot before confirmation [src/stores/workspace-kernel/bootstrap.ts:19]
- [x] [Review][Patch] `confirmImportReducer()` derives readiness from the pre-import snapshot instead of the snapshot being committed, so readiness can be computed from stale dataset and graph state [src/stores/workspace-kernel/reducers.ts:261]
- [x] [Review][Patch] Dirty import end-to-end coverage only exercises the fallback CSV chooser path, leaving native-picker and non-benchmark intake coverage short of the story's supported-path requirement [tests/e2e/import.spec.ts:422]

### Review Findings

- [x] [Review][Patch] Confirmed imports are stored in a route-local kernel store that is recreated when the workspace route unmounts, so ordinary navigation drops the canonical dataset state instead of preserving it [src/app/router/shell-routes.tsx:268]
- [x] [Review][Patch] Fresh imports can inherit stale repair selections from the previous preview because `postWorkerImport()` falls back to the component's captured `repairSelections` immediately after `beginImport()` resets the preview store [src/features/import/workspace-import-route.tsx:972]
- [x] [Review][Patch] `confirmImportReducer()` replaces the entire canonical snapshot with only the imported dataset and placeholder graph, discarding any existing datasets, transforms, formulas, evidence, and graphs in a non-empty workspace [src/stores/workspace-kernel/reducers.ts:227]
- [x] [Review][Patch] Switching `workspaceId` reuses the previous route's preview store and worker state because `WorkspaceImportRoute` never resets its local refs when the `kernelStore` and `workspaceId` props change [src/features/import/workspace-import-route.tsx:690]
- [x] [Review][Patch] Import repair issues hard-code `detectedAt` to `2026-04-22T00:00:00.000Z`, so every issue reports the same false detection timestamp instead of when the problem was actually found [src/features/import/normalize-preview.ts:46]

### Review Findings

- [x] [Review][Patch] Confirmed imports can silently change schema and validation outcomes from rows outside the visible preview because preview repair gating is computed from `bodyRows`, but the committed dataset is built from `fullBodyRows` [src/features/import/normalize-preview.ts:693]
- [x] [Review][Patch] Ordinary non-comma CSV imports still advertise medium-confidence delimiter detection but never open a confirmation repair card, so users can continue without explicitly confirming the parsing uncertainty [src/features/import/normalize-preview.ts:334]
- [x] [Review][Patch] CSV and workbook preview parsing materialize the full source before enforcing the preview row window, which regresses the large-file latency and memory protections that the preview budget is supposed to preserve [src/features/import/parse-import-preview.ts:278]
- [x] [Review][Patch] Selecting `drop-invalid-rows` can collapse the dataset to zero rows and surface only the generic "did not contain any previewable data rows" failure instead of an inline repair-state explanation [src/features/import/normalize-preview.ts:703]
- [x] [Review][Patch] Confirmed canonical issues keep preview-only `repairActions` and the `import-preview` context metadata after import confirmation, so downstream repair entry points can route committed dataset issues back to preview-only commands and UI [src/stores/workspace-kernel/reducers.ts:229]
- [x] [Review][Patch] A transient persistence read failure still hard-fails the workspace route because `loadWorkspaceRecord()` rejects before the bootstrap fallback logic runs [src/app/router/shell-routes.tsx:369]
- [x] [Review][Patch] Every non-comma delimited text import is forced through delimiter confirmation even when parsing is already unambiguous, regressing valid TSV, semicolon, and pipe files into blocking repair flows [src/features/import/normalize-preview.ts:261]
- [x] [Review][Patch] Confirmed imports always reuse `dataset_import_active` and `graph_import_placeholder`, so multiple confirmations collapse onto the same canonical IDs and ambiguous ledger/entity references [src/features/import/confirm-import.ts:4]
- [x] [Review][Patch] After confirmation, the UI still exposes `Reject Import`, but that button only clears the preview surface and does not undo the committed dataset, so its label no longer matches its effect [src/features/import/workspace-import-route.tsx:1409]

### Review Findings

- [x] [Review][Patch] `resolveWorkspaceKernelStore()` always seeds a fresh import bootstrap snapshot for each `workspaceId`, so confirming into a named workspace never hydrates or merges the real canonical workspace state and can overwrite prior datasets/graphs with a synthetic empty baseline [src/app/router/shell-routes.tsx:269]
- [x] [Review][Patch] `confirmImport()` has no in-flight confirmation latch, so a rapid double-click can dispatch two confirmed imports before `previewCommitted` disables the button and create duplicate canonical datasets/graphs [src/features/import/workspace-import-route.tsx:1271]
- [x] [Review][Patch] Repair controls stay interactive after confirmation, so changing an informational repair card reparses only the preview, clears the committed guard, and enables a second confirm that creates another dataset instead of updating the already committed import [src/features/import/workspace-import-route.tsx:1492]
- [x] [Review][Patch] `createImportedDatasetFromPreview()` persists canonical dataset metadata from the bounded preview sample (`previewId`, `rowCount`, `columnCount`) instead of the full repaired import, so partial previews commit incorrect active-analysis metadata and violate the Story 2.2 handoff contract [src/features/import/confirm-import.ts:4]
- [x] [Review][Patch] `cancelImport()` restores the preserved preview but does not restore `lastCommittedPreviewId`, so canceling a new import can make an already confirmed preview look unconfirmed and importable again [src/features/import/store.ts:108]
- [x] [Review][Patch] `confirmImportReducer()` rewrites each confirmed issue so `source.entityId` points at the synthetic issue id while `entityType` stays `import-preview`, leaving confirmed issues detached from any real workspace entity and breaking downstream repair-entry-point semantics [src/stores/workspace-kernel/reducers.ts:227]

### Review Findings

- [x] [Review][Patch] `confirmImport()` still marks the preview committed after `saveWorkspaceKernel()` fails, so the UI reports success even though a reopen or hard reload can lose the confirmed dataset [src/features/import/workspace-import-route.tsx:1335]
- [x] [Review][Patch] `resolveWorkspaceKernelStore()` rehydrates the cached kernel from IndexedDB on every call, so stale persisted state can overwrite newer in-memory canonical state on remount [src/app/router/shell-routes.tsx:315]
- [x] [Review][Patch] `resolveWorkspaceKernelStore()` trusts any loaded record without checking that the record and snapshot belong to the requested workspace, allowing cross-workspace hydration into the active route [src/app/router/shell-routes.tsx:290]
- [x] [Review][Patch] `replaceStoreWithPersistedWorkspace()` blindly casts `datasetFileHandles` instead of validating them through the existing reopen sanitization path, so corrupt handle metadata can enter the live kernel [src/app/router/shell-routes.tsx:294]
- [x] [Review][Patch] A persisted-hydration parse failure leaves the import route on a dead-end error view with no retry or clean-bootstrap fallback, so one corrupt saved record can block the workspace entirely [src/app/router/shell-routes.tsx:357]

### Review Findings

- [x] [Review][Patch] Confirmed imports still commit only catalog metadata plus repair selections, so the repaired dataset body never enters the canonical active-analysis contract despite Story 2.2 requiring downstream consumers to inherit the confirmed import result [src/features/import/confirm-import.ts:4]
- [x] [Review][Patch] Confirmed local-file imports drop `sourceFile` provenance, so the persisted dataset-file-handle reopen path cannot relink newly imported CSV/Excel datasets after confirmation [src/features/import/confirm-import.ts:11]
- [x] [Review][Patch] Ordinary non-comma CSV files are still forced through delimiter confirmation because `buildDelimiterIssue()` blocks every detected delimiter other than `,`, even when parsing is already unambiguous [src/features/import/normalize-preview.ts:355]
- [x] [Review][Patch] `commitConfirmedImportToKernel()` returns success whenever `indexedDB` is unavailable, so the route marks the preview confirmed even though the canonical import disappears on reload [src/features/import/workspace-import-route.tsx:96]
- [x] [Review][Patch] `workspaceKernelStores` never evicts old entries, so a long-lived session accumulates one live kernel store per visited workspace ID [src/app/router/shell-routes.tsx:340]

### Review Findings

- [x] [Review][Patch] [P1] Confirm Import still falls back to preview-sample columns and rows when `confirmedDataset` is absent, so confirmation can commit preview-only data instead of the fully repaired dataset [src/features/import/confirm-import.ts:18]
- [x] [Review][Patch] [P1] Preview identity still ignores row-body changes outside the visible preview slice, so a large reimport can stay marked committed and keep confirmation locked while the canonical dataset is stale [src/features/import/normalize-preview.ts:73]
- [x] [Review][Patch] [P1] A transient persisted-workspace read failure still marks hydration complete on the cached bootstrap store, preventing later successful reads from restoring the real workspace until reload or cache eviction [src/app/router/shell-routes.tsx:396]
- [x] [Review][Patch] [P2] Hard-reload hydration still bypasses the reopen-validation contract and installs schema-valid persisted state directly, so reopen-invalid records never get normalized into blocked recovery state [src/app/router/shell-routes.tsx:303]
- [x] [Review][Patch] [P2] Preview columns are still derived from the preview-limited slice while the confirmed dataset is built from all rows, so late-appearing columns can be committed without any preview acknowledgement [src/features/import/normalize-preview.ts:742]
- [x] [Review][Patch] [P2] Import repair reruns still retain the full raw source payload in Zustand and clone workbook buffers before every worker post, creating a large-import memory regression across repeated repairs [src/features/import/workspace-import-route.tsx:1103]

### Review Findings

- [x] [Review][Patch] [P1] Gate real delimiter ambiguity for non-benchmark uploads instead of only the dirty delimiter benchmark scenario [src/features/import/normalize-preview.ts:372]
- [x] [Review][Patch] [P2] Retry persisted-workspace hydration after parse/install failures instead of latching the bootstrap cache as hydrated [src/app/router/shell-routes.tsx:421]
- [x] [Review][Patch] [P2] Keep the preview populated when the visible slice is fully dropped but later rows still survive the selected missing-value policy [src/features/import/normalize-preview.ts:835]
- [x] [Review][Patch] [P3] Add end-to-end coverage for native-picker file-handle persistence through confirm and reopen flows [tests/e2e/import.spec.ts:136]
- [x] [Review][Patch] [P3] Remove or scope the repo-wide `workers: 1` Playwright override [playwright.config.ts:6]

### Review Findings

- [x] [Review][Patch] [P1] `drop-invalid-rows` ignores trailing missing cells because `applyMissingValuePolicy()` only visits existing row entries, so rows that are short relative to the confirmed schema can survive even when required trailing cells are absent [src/features/import/normalize-preview.ts:583]
- [x] [Review][Patch] [P1] Additional-column acknowledgement assumes new columns are only appended, so a column introduced ahead of already-previewed columns can produce the wrong acknowledgement token and still commit unseen schema changes [src/features/import/normalize-preview.ts:734]
- [x] [Review][Patch] [P2] Fresh re-imports of identical data inherit the prior `lastCommittedPreviewId`, so the new preview is treated as already committed and Confirm Import stays locked without a new confirmation [src/features/import/store.ts:164]
- [x] [Review][Patch] [P2] Failed repair replays clear both `preview` and `preservedPreview`, so a worker or file-read failure while applying a repair discards the last valid preview instead of leaving the user on a recoverable state [src/features/import/store.ts:169]
- [x] [Review][Patch] [P2] `confirmImportReducer()` does not enforce the no-blocking-issues invariant, so any caller that bypasses the route guard can still commit an import the story contract says must remain blocked [src/stores/workspace-kernel/reducers.ts:227]
- [x] [Review][Patch] [P2] CSV delimiter auto-detection only requires confirmation when the resulting parse already has multiple columns, so a genuinely ambiguous file can silently fall through as a one-column import with no repair gate [src/features/import/parse-import-preview.ts:379]
- [x] [Review][Patch] [P2] Pasted-table imports discard `requiresDelimiterConfirmation`, so ambiguous pasted text bypasses the parsing-confirmation gate even though AC1 requires uncertain parsing assumptions to be confirmed before import [src/features/import/parse-import-preview.ts:682]
- [x] [Review][Patch] [P3] Value-quality diagnostics stop scanning a row after the first problem, so missing and malformed cell counts under-report multi-error rows and misstate the data-quality repair scope [src/features/import/normalize-preview.ts:528]

### Review Findings

- [x] [Review][Patch] [P1] Repair replay failures restore the previous preview but leave the optimistic repair-control state in place, so the repair cards can show selections that do not match the visible preview after a worker or file-read failure [src/features/import/store.ts:168]
- [x] [Review][Patch] [P3] Hydration fallback coverage still exercises only mocked loader paths, so the shell-route reopen fallback is not yet acceptance-proven against the real persistence boundary [src/app/router/shell-routes-hydration.spec.ts:151]

### Review Findings

- [x] [Review][Decision] Story 2.2 is formally allowed to include router and persistence-layer changes — resolved by user clarification on 2026-04-23 for this review pass.
- [x] [Review][Decision] Repo-wide serial Playwright execution is acceptable for Story 2.2 — resolved by user clarification on 2026-04-23 for this review pass.
- [x] [Review][Patch] [P1] Restored previews can lose their replay source and later repairs can reparse the wrong file [src/features/import/workspace-import-route.tsx:1217]
- [x] [Review][Patch] [P2] Restored previews can inherit a failed import's file-handle provenance into a later confirm [src/features/import/workspace-import-route.tsx:1271]
- [x] [Review][Patch] [P1] Preview parsing still materializes the full confirmed dataset before confirm, regressing the preview boundary for large inputs [src/features/import/parse-import-preview.ts:309]
- [x] [Review][Patch] [P2] Failed confirm rollback replaces the whole kernel snapshot and can erase concurrent workspace mutations [src/features/import/workspace-import-route.tsx:129]
- [x] [Review][Patch] [P2] LRU eviction drops live workspace kernel stores without any dirty-state guard [src/app/router/shell-routes.tsx:355]
- [x] [Review][Patch] [P2] Reopen sanitation still trusts a mismatched persisted file handle object when its metadata matches the dataset [src/features/workspace-persistence/persisted-dataset-file-handles.ts:8]

### Follow-up Review (R4)

#### Review Date

2026-04-23

#### Outcome

Changes Requested

#### Summary

- Reviewed the supplied Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor outputs against the full uncommitted diff versus `HEAD`, the relevant untracked files, and every entry in the Story 2.2 File List.
- Revalidated runtime-sensitive paths with `./scripts/with-node.sh npm test -- src/features/import/normalize-preview.spec.ts src/app/router/shell-routes-hydration.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts src/features/import/workspace-import-route.spec.ts` and `./scripts/with-node.sh npx playwright test tests/e2e/import.spec.ts --grep "native-picker|reopen|persist|confirm"`; both passed in this review pass.
- Treated the earlier router/persistence-scope and repo-wide Playwright serialization governance questions as resolved by the explicit user clarification for this run, so they are not blockers.
- Dismissed the preview-only confirmed-dataset materialization reports as stale after verifying `parseImportPreview()` now defers `confirmedDataset` materialization to the explicit confirm-time path and the parser regressions cover that boundary.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 4
- P3: 2
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch] [P2] Mark cached workspace kernel stores clean again after successful persistence so saved workspaces can re-enter the LRU eviction pool instead of remaining permanently non-evictable after the first save [src/app/router/shell-routes.tsx:362]
- [x] [Review][Patch] [P2] Compute mixed-type repair gating from the post-policy confirmed dataset instead of the pre-policy rows so repairs that remove the mixed values also clear the blocking type-confirmation card [src/features/import/normalize-preview.ts:838]
- [x] [Review][Patch] [P2] Keep single-row sources in an inline recoverable repair state when the user selects first-row-header mode instead of throwing the preview into a hard failure with no repair path [src/features/import/normalize-preview.ts:828]
- [x] [Review][Patch] [P2] Harden persisted dataset-file-handle sanitation against same-name foreign handles instead of trusting copied metadata plus `handle.name` alone during reopen hydration [src/features/workspace-persistence/persisted-dataset-file-handles.ts:23]
- [x] [Review][Patch] [P3] Prune stale preview replay contexts across repeated previews and rejects so the route does not accumulate per-preview replay state indefinitely [src/features/import/workspace-import-route.tsx:1231]
- [x] [Review][Patch] [P3] Add end-to-end coverage that exercises native-picker file-handle persistence through confirm and reopen flows with a real handle-shaped path instead of a file-only mock [tests/e2e/import.spec.ts:136]

### Follow-up Review (R5)

#### Review Date

2026-04-23

#### Outcome

Blocked - Decision Needed

#### Summary

- Reviewed the supplied Blind Hunter 5, Edge Case Hunter 5, Runtime Integration Auditor 5, and Acceptance Auditor 5 outputs against the full uncommitted diff versus `HEAD`, the relevant untracked files, and every entry in the Story 2.2 File List.
- Revalidated the cited parser, handle-sanitization, reopen, save, and confirm seams in the live tree. The earlier pass that dismissed preview-time confirmed-dataset materialization is stale: both the CSV and workbook preview paths still traverse full confirmed-row state before confirm whenever the preview boundary overflows.
- No reviewer layers failed in this pass.

#### Severity Breakdown

- P0: 0
- P1: 2
- P2: 3
- P3: 2
- Decision Needed: 2

#### Decision Needed

- [x] [Review][Decision] [P1] Decide whether confirm/save must fail closed or strip local-file provenance when the live handle no longer matches the previewed bytes, because `confirmImport()` currently reuses any same-name pending handle for a preview that is replayed from the older captured `File` object [src/features/import/workspace-import-route.tsx:1727]
- [x] [Review][Decision] [P1] Decide whether hydration failure must fail closed or may fall back to bootstrap only if confirm/save is blocked until hydration succeeds, because `hydrateWorkspaceKernelStore()` currently returns a writable bootstrap store after transient load or parse failures [src/app/router/shell-routes.tsx:427]

#### Action Items

- [x] [Review][Patch] [P2] Preview parsing still materializes full-source row data before confirm for both CSV and workbook sources once the preview boundary is exceeded, which keeps the preview path on the full-dataset memory and latency path this story is supposed to defer to confirmation [src/features/import/parse-import-preview.ts:390]
- [x] [Review][Patch] [P2] Reopened datasets can silently lose source-backed repair capability because hydration deduplicates persisted handles by raw handle object while missing-handle localization still inspects the unsanitized persisted entries, so repeated imports of the same local file can drop the live handle without emitting the warning issue [src/features/workspace-persistence/persisted-dataset-file-handles.ts:98]
- [x] [Review][Patch] [P2] Saving after a handle drop can persist orphaned `sourceFile` metadata because the save path only rewrites dataset source metadata when at least one prepared handle survives and otherwise leaves stale `sourceFile` fields intact in the snapshot being written [src/features/workspace-persistence/save-workspace.ts:21]
- [x] [Review][Patch] [P3] Preview replay contexts still accumulate indefinitely across repeated previews and rejects because every resolved preview is cached in `previewReplayContextRef` and nothing prunes stale entries [src/features/import/workspace-import-route.tsx:1231]
- [x] [Review][Patch] [P3] The story artifact remains internally inconsistent about review state because the story header still says `Status: review` while unresolved decision blockers and action items remain open in the review history [/home/pinto/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/2-2-resolve-import-uncertainty-and-data-quality-issues-before-commit.md:3]

### Follow-up Review (R6)

#### Review Date

2026-04-25

#### Outcome

Blocked - Decision Needed

#### Summary

- Ran Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor as fresh nested OpenCode reviewer lanes in story-loop mode.
- Reviewed the full uncommitted diff versus `HEAD`, relevant untracked files, the Story 2.2 story/spec context, and every Story 2.2 File List entry, including files absent from the default diff.
- Runtime Integration Auditor ran targeted live probes, including focused import/persistence Vitest coverage and story-loop report validation probes.

#### Severity Breakdown

- P0: 0
- P1: 5
- P2: 10
- P3: 3
- Decision Needed: 2

#### Decision Needed

- [x] [Review][Decision] [P1] Decide whether confirm/save must fail closed, strip local-file provenance, or require source reselection when the live handle no longer matches the previewed bytes, because `confirmImport()` can reuse same-name pending handle provenance for a preview materialized from an older captured `File` object [src/features/import/workspace-import-route.tsx:1727]
- [x] [Review][Decision] [P1] Decide whether persisted hydration failures must fail closed or may fall back to bootstrap only with confirm/save blocked until hydration succeeds, because `hydrateWorkspaceKernelStore()` currently exposes a writable bootstrap store after transient load or parse/install failures [src/app/router/shell-routes.tsx:426]

#### Action Items

- [x] [Review][Patch][P1] Fix story-loop adapter review-scope extraction so Story File List parsing stops before review history and reports real scoped changed/untracked files instead of nonpath bullets [`.story-loop/adapter.sh:165-213`] - current Story 2.2 review-scope output contains review-history text and reports empty tracked/untracked scope despite the live uncommitted diff.
- [x] [Review][Patch][P1] Gate story-loop completion on all required reviewer lanes completing successfully [`.agents/skills/bmad-code-review/steps/step-02-review.md:34`, `.agents/skills/bmad-story-loop-orchestrator/scripts/validate_story_loop_json.py:292`] - failed or empty lanes can still produce a clean/done report, leaving required review coverage incomplete.
- [x] [Review][Patch][P1] Prevent P0/P1/P2 findings from being deferred or converted into a done story-loop outcome [`.agents/skills/bmad-code-review/steps/step-04-present.md:21`] - the current defer path checks off findings by category without explicitly forbidding gating-priority deferral.
- [x] [Review][Patch][P2] Emit schema-valid `ORCHESTRATOR_REPORT` blocks for story-loop blocker paths [`.agents/skills/bmad-code-review/steps/step-01-gather-context.md:51`, `.agents/skills/bmad-code-review/steps/step-02-review.md:23`] - missing target/spec/fanout blocker halts can otherwise leave the orchestrator without a parseable terminal report.
- [x] [Review][Patch][P2] Specify and validate the nested `ORCHESTRATOR_REPORT` shapes used by story-loop review workers [`.agents/skills/bmad-code-review/steps/step-04-present.md:136`] - the workflow lists top-level fields but not required nested object shapes or enum values, increasing schema-invalid terminal report risk.
- [x] [Review][Patch][P2] Include synthetic diffs or direct scoped inspection for untracked files in orchestrated reviews [`.agents/skills/bmad-code-review/steps/step-01-gather-context.md:58`] - untracked story files can be omitted from reviewer lanes even when they are part of the requested scope.
- [x] [Review][Patch][P2] Map Acceptance Auditor findings to the report schema source value `acceptance` instead of internal `auditor` naming [`.agents/skills/bmad-code-review/steps/step-03-triage.md:21`] - strict story-loop report validation rejects unsupported finding source enums.
- [x] [Review][Patch][P2] Preserve caller-provided `orchestration_mode` across step files instead of reinitializing `interactive` defaults per step [`.agents/skills/bmad-code-review/steps/step-01-gather-context.md:6`, `.agents/skills/bmad-code-review/steps/step-02-review.md:3`, `.agents/skills/bmad-code-review/steps/step-04-present.md:3`] - story-loop safeguards can silently disable if step frontmatter resets runtime state.
- [x] [Review][Patch][P2] Require decision-needed reports to sync story and sprint status to `in-progress` [`.agents/skills/bmad-story-loop-orchestrator/scripts/validate_story_loop_json.py:307`] - validator currently accepts `decision_needed` reports that leave status as `review`, causing repeated blocked review selection.
- [x] [Review][Patch][P2] Keep preview parsing bounded until explicit confirmation for both CSV and workbook sources [src/features/import/parse-import-preview.ts:310, src/features/import/parse-import-preview.ts:623, src/features/import/normalize-preview.ts:1063] - preview paths still materialize full-source confirmed rows before confirm when the preview boundary is exceeded.
- [x] [Review][Patch][P2] Ensure missing or invalid persisted file handles generate source-handle recovery issues after hydration sanitation [src/features/workspace-persistence/reopen-workspace.ts:558, src/features/workspace-persistence/persisted-dataset-file-handles.ts:96] - unsanitized compatible entries can suppress the warning even when live handle validation fails.
- [x] [Review][Patch][P2] Strip stale `sourceFile` metadata when save/reopen handle preparation drops all usable handles [src/features/workspace-persistence/save-workspace.ts:21, src/features/workspace-persistence/reopen-workspace.ts:560] - datasets can remain marked source-backed after the source handle is unavailable.
- [x] [Review][Patch][P3] Clarify non-interactive large-diff handling for story-loop mode [`.agents/skills/bmad-code-review/steps/step-01-gather-context.md:76`] - the primary wording still says to offer chunking even though story-loop must not wait for human chunking decisions.
- [x] [Review][Patch][P3] Synthesize missing priority rationales during triage when reviewer lanes omit them [`.agents/skills/bmad-code-review/steps/step-03-triage.md:21`] - the workflow requires priority rationale in persisted findings but does not say how to handle missing lane rationales.
- [x] [Review][Patch][P3] Prune stale preview replay contexts across repeated previews and rejects [src/features/import/workspace-import-route.tsx:1223] - the route retains per-preview replay contexts in an unbounded map until unmount; non-gating because it is session-scoped and does not directly violate acceptance criteria.

### Follow-up Review (R7)

#### Review Date

2026-04-25

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the scoped uncommitted Story 2.2 diff and Story File List.
- Blind, Runtime, and Acceptance lanes completed; the Edge Case Hunter lane returned an empty result and was treated as a failed lane.
- Runtime probes included the story-loop adapter review-scope command, focused import/router/kernel Vitest coverage, and story-loop report validator probes. The review worker also ran the required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.

#### Severity Breakdown

- P0: 0
- P1: 3
- P2: 4
- P3: 1
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P1] Verify local-file handle provenance by byte identity before confirming or persisting source-backed imports [src/features/import/workspace-import-route.tsx:251] — metadata-only name/size/mtime checks can accept same-name files whose bytes changed, preserving stale provenance for a dataset materialized from older preview bytes.
- [x] [Review][Patch][P1] Surface confirm-time materialization blocking issues as repairable preview issues instead of generic persistence failure [src/features/import/workspace-import-route.tsx:1778] — late full-dataset missing/malformed/type/schema issues can be discovered after the visible preview check, then `confirmImportReducer()` rejects them while the route only shows a storage-oriented error, violating the repair-choice flow.
- [x] [Review][Patch][P1] Keep story-loop adapter `scope` limited to story-scoped files instead of re-adding all repository changes [`.story-loop/adapter.sh:225`] — the consumer-facing scope currently includes unrelated tracked/untracked/deleted paths after computing filtered fields, which can invalidate automated story-scoped review results.
- [x] [Review][Patch][P2] Preserve stale-source validation error messages separately from persistence failures during Confirm Import [src/features/import/workspace-import-route.tsx:1795] — actionable reselect/source-changed failures are masked as “Restore local workspace storage,” sending users to the wrong recovery path.
- [x] [Review][Patch][P2] Persist an explicit empty `datasetFileHandles` list when save preparation drops all handles [src/features/workspace-persistence/save-workspace.ts:26] — omitting the field after sanitizing handles to `[]` can leave stale persisted handle records instead of clearing them.
- [x] [Review][Patch][P2] Keep workbook preview parsing bounded before confirm instead of scanning all populated worksheet row metadata [src/features/import/parse-import-preview.ts:564] — `listPopulatedWorksheetRows(sheet)` still walks full workbook rows/cells before the preview boundary, preserving large-workbook latency and memory risk.
- [x] [Review][Patch][P2] Reject blocked or failed story-loop review reports that mark story or sprint status done [`.agents/skills/bmad-story-loop-orchestrator/scripts/validate_story_loop_json.py:303`] — validator invariants cover clean, P3-only, changes-requested, and decision-needed outcomes but still accept inconsistent blocked/failed completion statuses.
- [x] [Review][Patch][P3] Clarify P3 disposition rules for decision-needed-only review rounds [`.agents/skills/bmad-story-loop-orchestrator/scripts/validate_story_loop_json.py:329`] — current validation only permits P3 action items when gating findings exist, while workflow text does not clearly define whether decision-needed-only rounds must defer or action-item P3 findings.

### Follow-up Review (R8)

#### Review Date

2026-04-25

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the scoped uncommitted Story 2.2 diff and Story File List.
- All four reviewer lanes completed. Runtime probes included focused import/router/kernel and persistence Vitest coverage; the review worker also ran the required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found new P1/P2 gating issues, so the story returns to `in-progress`; the P3 disposition follow-up remains an unchecked action item with the rest of this round.

#### Severity Breakdown

- P0: 0
- P1: 1
- P2: 4
- P3: 1
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P1] Close the byte-identity validation TOCTOU gap before saving source-backed imports [src/features/import/workspace-import-route.tsx:1795-1822, src/features/workspace-persistence/save-workspace.ts:18-27] — the live handle is byte-checked before confirm materialization, but save preparation can read the same handle again after the file changes, preserving stale provenance for a dataset materialized from older preview bytes.
- [x] [Review][Patch][P2] Cache confirm-time blocking previews in the replay-context map before surfacing their repair cards [src/features/import/workspace-import-route.tsx:1807-1810, src/features/import/workspace-import-route.tsx:1280-1323] — a full-dataset blocker installs a new preview id without `rememberReplayContextForPreview`, so a subsequent repair/read failure can clear the source replay context and strand the recoverable preview.
- [x] [Review][Patch][P2] Report unreadable source bytes as source-reselection failures instead of storage failures [src/features/import/workspace-import-route.tsx:282-284, src/features/import/workspace-import-route.tsx:1824-1829] — `File.arrayBuffer()` rejection during byte validation bypasses `isSourceValidationError`, so users get persistence recovery copy for an unreadable or stale source file.
- [x] [Review][Patch][P2] Move local-file byte validation behind the persistence/File System Access boundary [src/features/import/workspace-import-route.tsx:251-296] — the route now calls `FileSystemFileHandle.getFile()` directly even though the story guardrail keeps File System Access and browser storage APIs under `services/persistence`.
- [x] [Review][Patch][P2] Validate persisted workspace identity before sanitizing and reading persisted file handles [src/app/router/shell-routes.tsx:327-337] — hydration now sanitizes handle entries before proving the record belongs to the requested workspace, so a wrong-workspace or corrupt record can touch local handles before being rejected.
- [x] [Review][Patch][P3] Clarify P3 disposition rules for decision-needed-only review rounds [`.agents/skills/bmad-story-loop-orchestrator/scripts/validate_story_loop_json.py:332-335`] — current validation still rejects P3 action items whenever no gating findings exist, while the workflow does not define the decision-needed-only disposition; non-gating because it is workflow/reporting consistency and does not affect Story 2.2 import correctness.

### Follow-up Review (R9)

#### Review Date

2026-04-25

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the scoped uncommitted Story 2.2 diff, the synthetic untracked `save-workspace.spec.ts` diff, and Story File List context where permitted.
- All four reviewer lanes completed. The Runtime Integration Auditor used Chrome DevTools for targeted route/import/confirm/reload, console, and IndexedDB probes; it did not run a native OS picker persistence probe because the available browser automation could not exercise a real structured-cloneable `FileSystemFileHandle` through the OS picker.
- Required validation commands passed: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 4
- P3: 2
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Guard confirm-time blocking previews with the same stale-preview check used by successful confirmation before replacing the visible preview [src/features/import/workspace-import-route.tsx:1805-1813] — a late full-dataset blocker can call `resolveImport(confirmedPreview, null)` after the user has started or restored a newer preview, overwriting visible repair state and replay context with an obsolete source.
- [x] [Review][Patch][P2] Fail required source-backed saves when the required handle set is empty [src/features/workspace-persistence/save-workspace.ts:18-24] — `requireDatasetFileHandles` only compares prepared and requested lengths, so an explicit empty handle list satisfies the fail-closed provenance contract even though no required source handle will be persisted.
- [x] [Review][Patch][P2] Reject digest-less persisted dataset file handles instead of rebaselining or trusting same-metadata bytes on save and hydration [src/features/workspace-persistence/persisted-dataset-file-handles.ts:82-118, src/features/workspace-persistence/persisted-dataset-file-handles.ts:121-163] — legacy or preserved handles without `fileSha256` can be accepted by name/size/mtime and written forward with newly read bytes, allowing same-metadata source substitution to become trusted provenance.
- [x] [Review][Patch][P2] Verify live handle bytes in `WorkspaceRepository` even when callers supply complete file metadata and digest fields [src/services/persistence/repositories/workspace-repository.ts:88-121] — the repository save path returns prefilled provenance without calling `getFile()`, so direct or future callers can persist stale caller-supplied digest metadata outside the higher-level save helper.
- [x] [Review][Patch][P3] Bound sparse workbook preview scanning before the preview row window even when `!ref` or dense sheet length spans huge blank ranges [src/features/import/parse-import-preview.ts:465-724] — preview-only parsing no longer enumerates all populated row metadata first, but sparse sheets with inflated ranges can still iterate large blank row/cell spans before reaching the preview boundary; non-gating because it is a performance hardening gap, not a current acceptance/data-integrity failure.
- [x] [Review][Patch][P3] Add native-picker file-handle persistence coverage with a real handle-shaped browser path through confirm, save, reload, and reopen sanitation [tests/e2e/import.spec.ts:136] — unit coverage and Chrome fallback-path probes passed, but the real File System Access handle persistence path remains unproven end-to-end; non-gating because this is a coverage gap and not a demonstrated runtime failure.

### Follow-up Review (R10)

#### Review Date

2026-04-25

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, the synthetic untracked `src/features/workspace-persistence/save-workspace.spec.ts` diff, and the Story 2.2 File List context where permitted.
- All four reviewer lanes completed. The Runtime Integration Auditor used Playwright CLI for targeted OPFS/native-picker IndexedDB confirm/reload/reopen probes plus focused persistence/router specs; Chrome DevTools was not used because Playwright was the better scripted file-picker/storage probe path.
- Required validation commands passed: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`.
- The round found one unresolved P2 gating issue, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating finding.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 1
- P3: 2
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Validate the full persisted workspace record before reading persisted dataset file handles during route hydration [src/app/router/shell-routes.tsx:315-341] — `parsePersistedWorkspaceForHydration()` checks only the record/snapshot workspace IDs before calling `sanitizePersistedDatasetFileHandlesForHydration()`, so a same-workspace but corrupt or incompatible persisted payload can invoke local handle `getFile()`/byte reads before `reopenPersistedWorkspaceRecord()` accepts the workspace. This leaves hostile persisted browser state able to touch local source handles before the reopen-validation contract runs.
- [x] [Review][Patch][P3] Bound dense sparse-workbook preview scanning over high row-index gaps [src/features/import/parse-import-preview.ts:493-520] — the dense-sheet preview path still loops from `0` to `denseSheet.length` while skipping holes, so a sheet with only a few populated rows at very high indexes can burn preview-time work before the preview boundary is reached; non-gating because it is performance hardening rather than a current data-integrity failure.
- [x] [Review][Patch][P3] Strengthen the native-picker persistence E2E so reload/reopen assertions prove persisted handle reuse instead of re-running the picker [tests/e2e/import.spec.ts:260-270] — the new test verifies a handle-shaped record after confirm, but then clicks `Choose CSV file` after reload and reopen, which can repopulate the OPFS handle and pass even if hydration sanitation did not reuse the saved handle; non-gating because it is a coverage gap, not a demonstrated runtime failure.

### Follow-up Review (R11)

#### Review Date

2026-04-25

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, synthetic untracked coverage for `src/features/workspace-persistence/save-workspace.spec.ts`, and the Story 2.2 File List context where permitted.
- All four reviewer lanes completed. The Runtime Integration Auditor used Playwright for the targeted OPFS/native-picker IndexedDB confirm/reload/reopen probe and focused hydration/parser/save checks; Chrome DevTools was not used because Playwright was the better scripted persisted-storage/file-handle probe path.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 2
- P3: 3
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Filter persisted dataset file handles to the reopened snapshot before hydration sanitation reads local handle bytes [src/app/router/shell-routes.tsx:336-356] — `parsePersistedWorkspaceForHydration()` validates the record, then calls `sanitizePersistedDatasetFileHandlesForHydration(record.datasetFileHandles ?? [])` before `retainDatasetFileHandlesForSnapshot(...)`, so an accepted same-workspace record with extra handle entries can still invoke `getFile()`/SHA-256 reads for datasets that are not part of the reopened snapshot.
- [x] [Review][Patch][P2] Do not fail a new source-backed confirm because an unrelated existing dataset handle went stale [src/features/import/workspace-import-route.tsx:161-174, src/features/workspace-persistence/save-workspace.ts:18-25] — `commitConfirmedImportToKernel()` passes all prior dataset handles plus the new validated handle while `requireDatasetFileHandles` requires every supplied handle to survive save preparation, so stale provenance for an older dataset can block an otherwise valid new import instead of dropping/stripping only the stale old handle.
- [x] [Review][Patch][P3] Tighten dense sparse-workbook preview scanning so blank present rows and post-gap key sorting stay bounded [src/features/import/parse-import-preview.ts:499-546] — the dense-sheet path still scans present-but-empty rows without increasing the blank-gap guard and falls back to sorting all numeric row keys after a gap, so unusual workbook shapes can keep preview parsing on a larger-than-needed row enumeration path.
- [x] [Review][Patch][P3] Report the exact previewable row count when a delimited preview lands exactly on the sample boundary [src/features/import/parse-import-preview.ts:381-390] — `boundedTotalPreviewableRowCount` reports `previewRows.length + 1` whenever the parser aborts at the preview boundary, even when no additional row was observed, which can overstate the preview by one row.
- [x] [Review][Patch][P3] Prove native-picker handle reuse through the hydrated kernel, not only IndexedDB persistence [tests/e2e/import.spec.ts:235-286] — the E2E confirms the handle-shaped record remains in IndexedDB after reload/reopen and the picker is not re-run, but it does not assert that route hydration installed and retained the sanitized handle in the live workspace kernel.

### Follow-up Review (R12)

#### Review Date

2026-04-25

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and the Story 2.2 File List context where permitted.
- All four reviewer lanes completed. The Runtime Integration Auditor used targeted bash probes, focused Vitest persistence/parser specs, and the Playwright CLI native-picker handle E2E; Chrome DevTools was not used because Playwright was the better scripted path for file-handle/IndexedDB/reload coverage.
- The round found unresolved P1/P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 1
- P2: 1
- P3: 3
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P1] Preserve later populated dense-workbook rows after present-empty row gaps during confirm-time materialization [src/features/import/parse-import-preview.ts:519-541, src/features/import/parse-import-preview.ts:739-741] — `collectPreviewableWorksheetRowsForPreview()` stops after present-but-empty dense rows and suppresses the fallback enumeration, so confirm-time full materialization can keep only rows before the gap and silently omit later valid workbook data from the canonical dataset.
- [x] [Review][Patch][P2] Fail required source-backed saves if the repository drops the required handle during its final live-byte verification [src/features/workspace-persistence/save-workspace.ts:30-50, src/services/persistence/repositories/workspace-repository.ts:264-270] — `saveWorkspaceKernel()` checks the required handle before calling the repository, but `saveCanonicalWorkspace()` can re-read and filter the handle to `[]` afterward while the route still reports a successful source-backed save.
- [x] [Review][Patch][P3] Report exact workbook preview row counts at the sample boundary [src/features/import/parse-import-preview.ts:491-493, src/features/import/parse-import-preview.ts:750-752] — workbook preview-only parsing marks the boundary as reached as soon as the sample limit is filled and then reports `sampledPreviewableWorksheetRows.length + 1`, overstating exact-boundary workbooks by one row.
- [x] [Review][Patch][P3] Avoid double-reading large local-file bytes during confirm-time source validation [src/services/persistence/fs-access/local-import-files.ts:92-110] — `validateLocalImportFileHandleMatchesPreview()` concurrently reads the live handle and captured preview `File` into memory and then hashes live bytes before confirm materialization reads the source again, increasing large-import memory pressure.
- [x] [Review][Patch][P3] Suppress stale confirm-time source/storage errors after the visible preview changes [src/features/import/workspace-import-route.tsx:1815-1855] — successful confirm and blocking-preview paths check preview identity, but errors thrown before that check can still set action-error copy on an unrelated newer preview.

### Follow-up Review (R13)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked `src/features/workspace-persistence/save-workspace.spec.ts`, and the Story 2.2 File List context where permitted.
- All four reviewer lanes completed. The Runtime Integration Auditor reported targeted Vitest and Playwright/native-handle probe coverage; Chrome DevTools was not used because Playwright was the better scripted path for file-handle/IndexedDB/reload coverage.
- Required validation commands passed: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`.
- The round found one unresolved P2 gating issue, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating finding.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 1
- P3: 3
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Mark dense-workbook previews partial when preview scanning stops at present-empty gaps before later populated rows [src/features/import/parse-import-preview.ts:759-768] — preview-only parsing records `stoppedBeforeEnd` but reports `hasAdditionalPreviewableRows` from the truncated sampled rows unless `reachedPreviewBoundary` is true, while confirm-time materialization later enumerates and commits the hidden rows.
- [x] [Review][Patch][P3] Serialize repository final verification of persisted dataset file handles [src/services/persistence/repositories/workspace-repository.ts:265-270] — `saveCanonicalWorkspace()` still uses `Promise.all` over handle byte verification, so multi-source saves can concurrently read and hash large local files despite the R12 source-validation memory hardening.
- [x] [Review][Patch][P3] Keep live and persisted `sourceFile` metadata synchronized after handle sanitation/final verification [src/features/workspace-persistence/save-workspace.ts:39-55, src/services/persistence/repositories/workspace-repository.ts:289-300] — the save helper persists a synchronized snapshot and may replace handle records without installing the synchronized dataset metadata back into the live kernel, and repository-level final handle drops can still persist a snapshot with stale optional source provenance.
- [x] [Review][Patch][P3] Add the changed runtime-review skill artifact and deleted Zone.Identifier artifact to the story file list or explicitly exclude them from Story 2.2 scope [`.agents/skills/bmad-review-runtime-integration-auditor/SKILL.md`, `.agents/skills/mermaid-expert/SKILL.mdZone.Identifier`] — the full diff includes these workflow/file-system changes, but the Story File List omits them, making future story-scoped reviews and accounting incomplete.

### Follow-up Review (R14)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- All four reviewer lanes completed. The Runtime Integration Auditor ran focused Vitest, full typecheck/test/lint/build, and targeted Playwright native-picker handle persistence/reload/reopen probes; Chrome DevTools was not used because Playwright was the better scripted file-handle, IndexedDB, and reload/reopen probe path.
- The review worker also ran the required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 2
- P3: 2
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Guard async `saveWorkspaceKernel()` against concurrent kernel mutations before marking the latest store version persisted [src/features/workspace-persistence/save-workspace.ts:17-63] — `saveWorkspaceKernel()` captures `state` before awaited handle preparation, later calls selectors that read the current snapshot, but saves `state.ledger` from the older captured state and finally calls `markWorkspaceKernelStorePersisted(input.kernelStore)` with the latest workspace version by default. A save that overlaps a newer import/kernel mutation can persist a mismatched snapshot/ledger and mark unsaved work clean.
- [x] [Review][Patch][P2] Remove, ignore, or clearly scope stale untracked story-loop active-run artifacts before completion [`.story-loop/active-run-story-loop-20260426T012911Z.json`, `.story-loop/active-run-story-loop-20260425T144851Z.json`] — the untracked working tree contains active-run snapshots with `state: "running"`/`state: "blocked"` and absolute local ledger paths, so story-loop tooling or a later broad add can inherit stale local orchestration state.
- [x] [Review][Patch][P3] Avoid marking dense workbook previews partial after sparse fallback enumeration has exhausted all later populated dense row keys [src/features/import/parse-import-preview.ts:546-584] — `collectPreviewableWorksheetRowsForPreview()` falls back to `iterateDenseNumericRowIndexes(denseSheet)` after a non-present row gap, but still returns `stoppedBeforeEnd: stoppedAfterDenseGap && rowIndex < denseSheet.length`; when fallback finds no hidden previewable rows, complete previews can still look partial and report an inflated row count.
- [x] [Review][Patch][P3] Keep generated story-loop ledger/report artifacts out of story completion scope unless they are intentionally owned deliverables [`.story-loop/run-story-loop-20260426T012911Z.jsonl`, `.story-loop/run-story-loop-20260425T144851Z.jsonl`, `.story-loop/*report-story-loop-20260425*.md`] — the untracked run logs and reports are local orchestration byproducts with absolute paths and prior pass state; non-gating by itself, but they should be ignored, removed, or explicitly accounted for before a clean story handoff.

### Follow-up Review (R15)

#### Review Date

2026-04-25

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- All four reviewer lanes completed. Runtime Integration Auditor used Playwright for targeted OPFS/native-picker handle persistence/reload/reopen coverage and a story-loop report validator probe; Chrome DevTools was not used because Playwright was the better scripted file-handle, IndexedDB, and reload/reopen probe path.
- The round found unresolved P1/P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 1
- P2: 3
- P3: 2
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P1] Prevent stale async saves from writing older workspace records before the post-save version guard fires [src/features/workspace-persistence/save-workspace.ts:17-65] — `saveWorkspaceKernel()` captures snapshot and ledger, awaits `repository.saveCanonicalWorkspace(...)`, and only then checks whether `workspaceVersion` changed. If a newer kernel mutation lands while the repository write is in flight, the stale snapshot/ledger can already be persisted before the function throws, so reload can resurrect older canonical state despite the fail-closed error.
- [x] [Review][Patch][P2] Apply the same validate/filter/sanitize ordering in direct reopen flows before reading persisted file handles [src/features/workspace-persistence/reopen-workspace.ts:1393-1420] — `reopenWorkspaceKernel()` calls `reopenPersistedWorkspaceRecord(record)` and only then sanitizes `record.datasetFileHandles`, while issue localization inside `reopenPersistedWorkspaceRecord` still inspects parsed-but-unsanitized persisted handles. Digest-invalid or extra handles can suppress missing-handle warnings and can still be read even when they do not belong to the reopened snapshot.
- [x] [Review][Patch][P2] Include dataset-file-handle/source-metadata changes in the save concurrency guard [src/features/workspace-persistence/save-workspace.ts:17-76, src/stores/workspace-kernel/reducers.ts:147-155] — `replaceDatasetFileHandlesReducer()` can change live handle provenance and synchronized `sourceFile` metadata without incrementing `workspaceVersion`, so a save that overlaps handle replacement can persist stale provenance and then mark the captured version clean.
- [x] [Review][Patch][P2] Restrict dense-sheet fallback row enumeration to own row properties [src/features/import/parse-import-preview.ts:562-568, src/features/import/parse-import-preview.ts:550-579] — `iterateDenseNumericRowIndexes()` uses `for...in`, which includes enumerable inherited numeric properties. Hostile or polluted browser runtime state can therefore be treated as real workbook rows during preview fallback, contaminating imported data or causing unexpected preview work.
- [x] [Review][Patch][P3] Avoid false partial-preview messaging for dense workbooks that stop only on present-but-empty rows with no later populated rows [src/features/import/parse-import-preview.ts:525-587, src/features/import/parse-import-preview.ts:762-768] — present-but-empty dense gaps suppress fallback enumeration but still set `stoppedBeforeEnd` from array length alone, so a workbook with trailing empty dense rows and no later data can be reported as partial with an inflated row count. Non-gating because it is misleading preview copy/counting, not confirmed data loss.
- [x] [Review][Patch][P3] Probe or count one additional workbook row before reporting exact-boundary preview totals [src/features/import/parse-import-preview.ts:497-499, src/features/import/parse-import-preview.ts:762-768] — dense workbook preview collection marks the boundary when the sample limit is filled, not when an additional previewable row is observed, so exact-boundary and over-boundary workbooks can get ambiguous total row counts. Non-gating because partial state remains visible, but the count can mislead users and tests.

### Follow-up Review (R16)

#### Review Date

2026-04-25

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- All four reviewer lanes completed. Runtime Integration Auditor ran targeted Playwright/OPFS-style persistence probes and focused runtime analysis; Chrome DevTools was not used because Playwright was the more relevant scripted storage/file-handle path for this diff.
- The review worker ran the required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found unresolved P1/P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 1
- P2: 4
- P3: 2
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P1] Preserve dense workbook rows after present-empty gaps before confirm and preview rejection paths [src/features/import/parse-import-preview.ts:568-589, src/features/import/parse-import-preview.ts:758-777] — `denseGapIncludesPresentEmptyRows` probes only the first later populated row and breaks without adding it or continuing, so styled/blank dense gaps can either reject a valid workbook with later data or let confirm-time materialization silently omit later valid rows.
- [x] [Review][Patch][P2] Keep sparse workbook preview parsing bounded before confirmation [src/features/import/parse-import-preview.ts:438-479, src/features/import/parse-import-preview.ts:599] — sparse SheetJS worksheets still enumerate and sort every populated cell key through `listPopulatedWorksheetRows(sheet)` before applying the preview row limit, preserving the large-workbook latency/memory path that Story 2.2 is meant to defer until explicit confirmation.
- [x] [Review][Patch][P2] Validate direct reopen records through the full reopen contract before reading persisted file handles [src/features/workspace-persistence/reopen-workspace.ts:1394-1430, src/features/workspace-persistence/persisted-dataset-file-handles.ts:141-155] — `reopenWorkspaceKernel()` sanitizes persisted handles, including `handle.getFile()` and byte hashing, before `reopenPersistedWorkspaceRecord()` accepts/localizes the record, so hostile or corrupt persisted browser state can touch local handles before the reopen-validation boundary completes.
- [x] [Review][Patch][P2] Preserve valid shared source handles for multiple datasets instead of deduplicating by handle object alone [src/features/workspace-persistence/persisted-dataset-file-handles.ts:126-165] — `sanitizePersistedDatasetFileHandlesForHydration()` drops the second compatible entry whenever two datasets reference the same `FileSystemFileHandle` object, so legitimate shared-source datasets can reopen without their source-backed repair provenance.
- [x] [Review][Patch][P2] Parse annotated Story File List entries in story-loop review scope [`.story-loop/adapter.sh:176-182`] — the scope extractor only accepts a whole-line backticked path with no trailing annotation, so entries like a deleted `Zone.Identifier` artifact can be omitted from automated story-loop review scope despite being listed in the story file.
- [x] [Review][Patch][P3] Report exact workbook preview row counts at the sample boundary [src/features/import/parse-import-preview.ts:501-503, src/features/import/parse-import-preview.ts:773-777] — workbook preview collection marks the boundary when the sample limit is filled rather than after observing an additional row, so exact-boundary previews can still be overreported by one row.
- [x] [Review][Patch][P3] Cancel or quiesce confirm-time materialization workers on route unmount or superseding preview [src/features/import/workspace-import-route.tsx:1356] — stale commits are guarded, but large confirm-time materialization can continue after navigation or preview replacement and waste CPU/memory.

### Follow-up Review (R17)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- All four reviewer lanes completed. Runtime Integration Auditor ran focused runtime analysis and reported targeted Vitest/story-loop/Playwright probes; Chrome DevTools was not used because Playwright was the more relevant scripted file-handle, storage, reload, and reopen probe path for this diff.
- The review worker ran the required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 3
- P3: 2
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Make sparse workbook preview sampling deterministic before applying the preview boundary [src/features/import/parse-import-preview.ts:492-518] — `collectSparsePreviewableWorksheetRowsForPreview()` iterates sparse SheetJS cell keys in object insertion order and can return once `rowMap.size >= rowLimit + 1`, so out-of-order cell keys can cause the preview to sample later rows before earlier rows or miss remaining cells for sampled rows.
- [x] [Review][Patch][P2] Avoid unbounded dense workbook row-key enumeration before confirmation [src/features/import/parse-import-preview.ts:430-432, src/features/import/parse-import-preview.ts:601-625] — after a dense blank/present-empty gap, preview parsing falls back to `toSortedNumericKeys(denseSheet)`, which enumerates and sorts every own row key before the user confirms the import, preserving the large-workbook preview-time latency/memory path this story is meant to defer.
- [x] [Review][Patch][P2] Tolerate malformed persisted dataset-handle entries during direct reopen filtering instead of failing before sanitation [src/features/workspace-persistence/reopen-workspace.ts:1394-1429] — `retainRawDatasetFileHandlesForAcceptedSnapshot()` reparses the whole persisted workspace record before calling the per-entry tolerant handle parser, so one corrupt `datasetFileHandles` entry can block reopening an otherwise accepted workspace instead of being dropped by the sanitation path.
- [x] [Review][Patch][P3] Treat same-metadata dataset-handle object swaps during save as a stale provenance change or document why semantic equality is sufficient [src/features/workspace-persistence/save-workspace.ts:17-34, src/features/workspace-persistence/save-workspace.ts:60-67] — the save concurrency signature records handle metadata and `handle.name` but not handle-object identity, so a concurrent replacement with another same-name/same-digest handle is not detected; non-gating because repository byte verification still protects persisted dataset contents.
- [x] [Review][Patch][P3] Cancel or guard confirm-time source reads before the materialization worker is created [src/features/import/workspace-import-route.tsx:684-726, src/features/import/workspace-import-route.tsx:1362-1372] — `cancelConfirmationMaterialization()` only reaches the worker after `createWorkerPayloadFromReplayableSourceRequest()` finishes, so a large local-file read can continue after navigation or preview replacement; non-gating because later preview checks prevent stale commit.

### Follow-up Review (R18)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- All four reviewer lanes completed. Runtime Integration Auditor used targeted source/runtime analysis and preserved that Playwright/OPFS-style focused probes were the relevant live-probe path for these file-handle, storage, workbook, and worker-cancellation surfaces; Chrome DevTools was not used because the surfaced failures are source/worker/storage boundary conditions rather than route console/network issues.
- The review worker ran the required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 finding remains an unchecked action item with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 3
- P3: 1
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Bound sparse workbook preview parsing before confirmation instead of collecting every sparse cell key first [src/features/import/parse-import-preview.ts:521-551] — `collectSparsePreviewableWorksheetRowsForPreview()` still iterates all own worksheet keys into `rowMap` and sorts the full map before `rowLimit` is applied, so large sparse workbooks can still hit full-source preview-time work despite the bounded preview/confirm boundary.
- [x] [Review][Patch][P2] Use own-property dense row access in the primary dense preview scan [src/features/import/parse-import-preview.ts:598-612] — the initial dense worksheet loop still uses `rowIndex in denseSheet` and `denseSheet[rowIndex]`, so inherited numeric properties in hostile browser/runtime state can be treated as real workbook rows even though the fallback path now uses own-property access.
- [x] [Review][Patch][P2] Reject or bound malformed sparse cell addresses with unsafe column indexes before preview materialization [src/features/import/parse-import-preview.ts:446-469] — `parseSparseCellAddress()` accepts arbitrarily long column labels and can produce unsafe or enormous column indexes that later flow into column sorting and `XLSX.utils.encode_cell(...)`, allowing malformed workbook input to crash or exhaust preview handling instead of remaining recoverable.
- [x] [Review][Patch][P3] Make confirm-time source validation reads abortable or re-check cancellation before large byte reads [src/features/import/workspace-import-route.tsx:1888-1901, src/services/persistence/fs-access/local-import-files.ts:120-138] — stale commits are guarded, but `validateSourceFileHandleMatchesPreview()` still performs `getFile()` plus live and preview `arrayBuffer()` reads before the route can observe preview replacement or navigation, so large local-file reads can continue after the user has canceled or superseded the confirm flow.

### Review Findings

- [x] [Review][Patch][P2] Sparse workbook `!ref` preview scans can still run through present-empty ranges before confirmation [src/features/import/parse-import-preview.ts:583] — Rows that have own sparse cell objects but no previewable values do not increment the blank-gap guard when `addRowIfPreviewable()` returns `false`, so styled/empty sparse ranges can scan the entire decoded range before confirm and violate the bounded-preview contract.
- [x] [Review][Patch][P2] Sparse workbooks with leading blank gaps can reject later valid rows [src/features/import/parse-import-preview.ts:576] — The `!ref` path breaks after `MAX_SPARSE_PREVIEW_BLANK_GAP_SCAN` blank rows with no preview rows and `parseWorkbookRows()` then throws, so valid data after a bounded leading gap cannot reach partial-preview or confirm handling.
- [x] [Review][Patch][P2] Sparse workbook cell reads can be polluted by inherited dense-row properties [src/features/import/parse-import-preview.ts:883] — `readCellValue()` indexes `sheet[rowIndex]` before sparse address lookup even when the sheet is not a dense array, allowing prototype-polluted numeric properties to contaminate imported workbook values; dense row access should be own-property and dense-array scoped.
- [x] [Review][Patch][P3] Story Change Log omits the R17 closure entry [_bmad-output/implementation-artifacts/2-2-resolve-import-uncertainty-and-data-quality-issues-before-commit.md:367] — Non-gating story accounting issue: the Change Log jumps from R16 to R18 even though R17 implementation and review sections were added.
- [x] [Review][Patch][P3] Story-loop review scope misclassifies Git-quoted deleted paths [.story-loop/adapter.sh:209] — Non-gating tooling issue: `git status --short` parsing does not dequote C-style paths, so the deleted `Zone.Identifier` story file can appear in `all_deleted` but not `deleted`, risking missed deletion-specific review context for consumers that rely on the narrower fields.

### Review Findings

- [x] [Review][Patch][P2] Sparse workbooks with leading present-empty rows can still reject later valid data [src/features/import/parse-import-preview.ts:662-678] — valid sparse Excel workbooks that begin with styled/empty cells before later real rows can exit the bounded `!ref` scan without invoking the own-cell fallback, leaving no previewable rows and blocking the import before repair/confirm.
- [x] [Review][Patch][P2] Workbook preview fallback can still enumerate full worksheet key sets before confirmation [src/features/import/parse-import-preview.ts:536-582, src/features/import/parse-import-preview.ts:784-808] — sparse leading-blank fallback iterates all own worksheet keys and dense fallback iterates every own dense row key after a gap, regressing the bounded-preview contract for large or hostile workbook shapes.
- [x] [Review][Patch][P2] Direct reopen retains stale dataset `sourceFile` provenance when all persisted handles are dropped [src/features/workspace-persistence/reopen-workspace.ts:1436-1459] — `reopenWorkspaceKernel()` builds the live kernel from `report.snapshot` without synchronizing dataset source metadata to the sanitized handle list, so reopened canonical state can still claim source-backed provenance after verification removed every usable handle.
- [x] [Review][Patch][P3] Repository final handle verification does not stop expensive file reads after save cancellation [src/services/persistence/repositories/workspace-repository.ts:106-225] — stale writes are guarded, but multi-handle saves can keep reading and hashing later local files after a concurrent mutation aborts the save; non-gating because persisted correctness is protected while runtime IO/CPU can be wasted.
- [x] [Review][Patch][P3] Native-picker persistence E2E guard is order-dependent and does not prove the picker cannot be rerun after reload [tests/e2e/import.spec.ts:114-286] — multiple `addInitScript` overrides can reset the call counter or replace the throwing picker guard on reload, and the test checks persisted handle shape without exercising the guarded picker path; non-gating because this is coverage reliability rather than demonstrated user-visible failure.

### Follow-up Review (R21)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- Runtime Integration Auditor used a targeted Chrome DevTools route/confirm-worker probe plus focused source/runtime analysis. The review worker also ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 3
- P3: 2
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Present-empty dense workbook rows bypass blank-gap bounds before confirmation [src/features/import/parse-import-preview.ts:796-815] — the primary dense preview loop resets `blankGapScanCount` before checking whether a row with own blank cell objects is actually previewable, so styled/empty dense rows never trip the bounded blank-gap guard and can scan the full dense sheet before the user confirms import.
- [x] [Review][Patch][P2] Sparse leading present-empty fallback can reject valid normal-width workbooks before later data [src/features/import/parse-import-preview.ts:590-597, src/features/import/parse-import-preview.ts:715-724, src/features/import/parse-import-preview.ts:987-989] — after the bounded `!ref` scan stops on leading present-empty rows, the own-cell fallback counts empty cells instead of empty rows; a workbook with ordinary styled empty rows across several columns can exceed `MAX_SPARSE_FALLBACK_LEADING_EMPTY_CELL_SCAN`, return no previewable rows, and throw instead of surfacing the later valid data for preview/repair.
- [x] [Review][Patch][P2] Nonresponsive confirm-time materialization workers leave the import locked with no recovery path [src/features/import/workspace-import-route.tsx:1386-1495, src/features/import/workspace-import-route.tsx:2096-2125] — `materializeConfirmedPreviewForImport()` waits indefinitely for a worker message/error and the UI hides Reject Import while `previewCommitLocked` is true, so a hung worker can strand the active preview without a visible retry/reject path.
- [x] [Review][Patch][P3] Pre-repository source-handle preparation cannot observe save abort/staleness during expensive file hashing [src/features/workspace-persistence/save-workspace.ts:90-106, src/features/workspace-persistence/persisted-dataset-file-handles.ts:83-123] — `saveWorkspaceKernel()` creates an abort controller and stale-version assertion but does not pass either into `preparePersistedDatasetFileHandlesForSave()`, so a stale save can continue reading and hashing local files before the later correctness guard fires.
- [x] [Review][Patch][P3] A stale confirm flow can clear a newer source-validation abort controller [src/features/import/workspace-import-route.tsx:1896-1906, src/features/import/workspace-import-route.tsx:1958-1960] — the source-validation controller is conditionally cleared after validation but then unconditionally nulled in `finally`, so an older confirm finishing after a newer confirm starts can remove the newer abort handle and waste large-file IO after cancel, navigation, or preview replacement.

### Follow-up Review (R22)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- Runtime Integration Auditor used targeted Playwright native-picker confirm/reload/reopen E2E, story-loop review-scope adapter probing, and focused parser/import-route/save Vitest specs; no additional Chrome DevTools probe was needed because Playwright was the better scripted storage/file-handle path for this pass.
- The review worker ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found unresolved P1/P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 1
- P2: 1
- P3: 3
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P1] Disable or abort-safe Reject Import while confirm persistence is in flight, or make reject rollback/cancel the in-flight canonical mutation before reporting that canonical state is untouched [src/features/import/workspace-import-route.tsx:83, src/features/import/workspace-import-route.tsx:1971-1977, src/features/import/workspace-import-route.tsx:2135-2156] — `shouldShowRejectImportAction()` keeps Reject Import visible for any uncommitted preview, and the handler resets preview state while `commitConfirmedImportToKernel()` may already have mutated the kernel and started persistence; AC3 is violated if users can reject during the save phase and still end up with a committed dataset.
- [x] [Review][Patch][P2] Count sparse fallback leading blank rows and malformed own keys without exhausting the own-cell scan budget before later valid workbook data can be sampled [src/features/import/parse-import-preview.ts:539-615] — `collectSparsePreviewableWorksheetRowsFromOwnCells()` still increments the global own-cell cap before discarding invalid or present-empty cells, so wide styled leading rows or malformed own keys can hit the fallback limit and reject a workbook that has valid data just after the bounded leading-gap allowance.
- [x] [Review][Patch][P3] Make source-handle save preparation and repository verification observe abort/staleness while file byte reads or SHA-256 digest work is pending [src/features/workspace-persistence/persisted-dataset-file-handles.ts:116-133, src/services/persistence/repositories/workspace-repository.ts:152-158] — later staleness checks protect persisted correctness, but a stale save can still wait on hostile or long-running local file reads before cancellation is observed.
- [x] [Review][Patch][P3] Avoid spending dense workbook fallback scan budget on row keys already known to precede the gap [src/features/import/parse-import-preview.ts:430-615] — large styled or blank prefixes can consume the bounded fallback row-key budget before later valid dense rows are considered, creating misleading partial/rejection behavior without current data-integrity loss.
- [x] [Review][Patch][P3] Parse rename/copy status records in either porcelain status column when building story-loop review scope [`.story-loop/adapter.sh:217-224`] — rename/copy records with `R` or `C` in the second status column can leave the source path in the stream and produce bogus scoped paths, confusing review accounting.

### Follow-up Review (R23)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- Runtime Integration Auditor used Chrome DevTools for targeted route, console/network, pasted confirm/reload, IndexedDB, mocked native-picker/OPFS, and hostile file-handle probes; it reproduced a stale pending confirm latch after Reject plus same-file reselect.
- The review worker ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 finding remains an unchecked action item with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 4
- P3: 1
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Make confirm-time local source validation abort-aware while byte reads or digest work are pending [src/services/persistence/fs-access/local-import-files.ts:152-154] — `validateLocalImportFileHandleMatchesPreview()` checks `signal.aborted` only before and after `File.arrayBuffer()`/SHA-256 work, so a hostile or stalled file-handle read can leave Confirm Import pending; the runtime probe reproduced Reject plus same-file reselect leaving that source unconfirmable until reload.
- [x] [Review][Patch][P2] Add cancellation or timeout protection to persisted dataset file-handle hydration sanitation [src/features/workspace-persistence/persisted-dataset-file-handles.ts:219-265] — `sanitizePersistedDatasetFileHandlesForHydration()` awaits `handle.getFile()`, `file.arrayBuffer()`, and digest work without a signal or timeout, so hostile persisted browser state can keep workspace hydration stuck on the loading path.
- [x] [Review][Patch][P2] Make IndexedDB open abort-aware before starting save transactions [src/services/persistence/indexed-db/workspace-storage.ts:41-49] — `putRecord()` awaits `#openDatabase()` before checking the abort signal or registering the transaction abort hook, so a stale save can remain pending if the database open is blocked while the kernel has already moved on.
- [x] [Review][Patch][P2] Make sparse workbook own-cell fallback row-order deterministic before applying scan caps [src/features/import/parse-import-preview.ts:558-610] — `collectSparsePreviewableWorksheetRowsFromOwnCells()` counts previewable own cell keys in object iteration order and can break before lower/header rows are ever sorted into the preview set, so unusual sparse workbook key order can reject or preview the wrong rows before confirmation.
- [x] [Review][Patch][P3] Bound sparse `!ref` column probing before confirmation [src/features/import/parse-import-preview.ts:658-681] — the sparse decoded-range path can still probe every column through an inflated range up to `MAX_SAFE_WORKSHEET_COLUMN_INDEX` for each scanned row, leaving a preview-time performance hardening gap for wide hostile workbook ranges.

### Follow-up Review (R24)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, appended synthetic diffs for untracked files, and every Story 2.2 File List entry.
- Runtime Integration Auditor used focused Vitest regressions, the native-picker Playwright persistence E2E, Chrome DevTools route/confirm/reload console/network/IndexedDB probes, and story-loop review-scope probing; those probes passed, but the sparse workbook key-volume risk remains unprobed.
- Acceptance Auditor reported no acceptance-criteria findings.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 3
- P3: 2
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Bound sparse workbook own-cell fallback before enumerating/sorting all keys and count blank/styled own cells against the preview budget [src/features/import/parse-import-preview.ts:550-608] — the fallback still builds and sorts `Object.keys(sheet)` before any cap applies, then increments the scan cap only for previewable cells; hostile sparse workbooks can still burn preview-time memory/latency before confirmation.
- [x] [Review][Patch][P2] Cap hydration sanitation attempts for duplicate invalid persisted dataset handles before spending one timeout per duplicate [src/features/workspace-persistence/persisted-dataset-file-handles.ts:267-319] — duplicate entries are only marked seen after successful validation, so hostile persisted state with many equivalent invalid handle objects can keep workspace hydration on repeated timeout cycles.
- [x] [Review][Patch][P2] Add bounded timeout/abort recovery to confirm-time persistence after `markConfirmationPersistencePending()` [src/features/import/workspace-import-route.tsx:1995-2007; src/features/workspace-persistence/save-workspace.ts:104-142; src/services/persistence/indexed-db/workspace-storage.ts:73-76] — file-handle save verification and IndexedDB open can still hang without a stale mutation, while Reject Import is hidden during persistence pending.
- [x] [Review][Patch][P3] Clear or replace a storage instance's cached IndexedDB open promise after an abort rejects a pending open [src/services/persistence/indexed-db/workspace-storage.ts:127-147] — `putRecord()` now rejects promptly on abort, but the same storage instance can keep reusing the original pending `#databasePromise`.
- [x] [Review][Patch][P3] Preserve exact `git status -z` path bytes in story-loop scope parsing [`.story-loop/adapter.sh`] — `-z` porcelain already preserves exact paths, but stripping decoded paths can corrupt legitimate filenames with leading or trailing whitespace.

### Follow-up Review (R25)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- Runtime Integration Auditor used focused Vitest, Playwright native-picker persistence/reload/reopen E2E, and story-loop review-scope adapter probes; Chrome DevTools was not used because Playwright was the more reproducible browser file-handle/IndexedDB path for this pass.
- The review worker ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 finding remains an unchecked action item with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 3
- P3: 1
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Valid duplicate persisted file handles can be skipped after an earlier invalid duplicate [src/features/workspace-persistence/persisted-dataset-file-handles.ts:267] — Source-backed reopen provenance can be lost even when a usable later handle entry exists, because `seenEntries` is marked before validation succeeds.
- [x] [Review][Patch][P2] Confirm persistence timeout can still hang if the repository save promise does not settle after abort [src/features/workspace-persistence/save-workspace.ts:139] — The safety timeout aborts the signal but then still awaits `saveCanonicalWorkspace`, so a non-cooperative storage/repository path can keep Confirm Import locked without rollback or retry.
- [x] [Review][Patch][P2] IndexedDB save aborts after transaction completion can roll back live state while the persisted record remains committed [src/services/persistence/indexed-db/workspace-storage.ts:107] — `putRecord()` checks abort after `transactionToPromise(transaction)` resolves, so a late abort can make callers treat persistence as failed even though IndexedDB already committed the record.
- [x] [Review][Patch][P3] Malformed sparse worksheet keys still consume the own-cell fallback scan cap before valid cells are considered [src/features/import/parse-import-preview.ts:559] — Hostile or malformed workbook keys can exhaust the bounded fallback budget before later valid sparse cells are sampled; non-gating because this is a hostile-shape hardening gap rather than a demonstrated normal import failure.

### Follow-up Review (R26)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- Runtime Integration Auditor used focused Vitest persistence/parser probes plus the Playwright native-picker persistence/reload/reopen E2E; Chrome DevTools was not used because Playwright was the more reproducible file-handle/IndexedDB route for this pass.
- The review worker ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 2
- P3: 2
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Apply sparse own-cell fallback scan caps after deterministic row ordering or otherwise guarantee lower/header rows cannot be skipped by hostile key insertion order [src/features/import/parse-import-preview.ts:559-611] — Object-key iteration can process more than `MAX_SPARSE_FALLBACK_OWN_CELL_SCAN` high-row previewable cells before lower rows are observed; sorting happens only after the cap, so sparse workbooks can preview/reject the wrong rows before confirmation.
- [x] [Review][Patch][P2] Count leading styled/blank sparse rows without letting wide empty cells exhaust the own-cell cap before later valid rows [src/features/import/parse-import-preview.ts:582-597] — Present-but-empty sparse cells increment the global own-cell cap before the leading-empty-row guard can bound by row, so wide styled leading rows can consume the fallback budget and reject valid later workbook data.
- [x] [Review][Patch][P3] Add timeout or bounded retry/recovery semantics to confirm-time local source validation before materialization starts [src/services/persistence/fs-access/local-import-files.ts:96-184; src/features/import/workspace-import-route.tsx:1958-1975] — Source validation is abort-aware and Reject Import remains available, but a non-cooperative handle read can keep confirmation pending until the user manually rejects because the materialization/persistence timeout starts later.
- [x] [Review][Patch][P3] Canonicalize or reject non-canonical sparse cell keys consistently between discovery and reads [src/features/import/parse-import-preview.ts:452-488; src/features/import/parse-import-preview.ts:981-989] — Discovery accepts lowercase or absolute-style addresses, but `readCellValue()` looks up canonical `XLSX.utils.encode_cell(...)` keys only, so hostile sparse keys can create false previewable rows that later materialize as blank.

### Follow-up Review (R27)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- Runtime Integration Auditor used focused Vitest, targeted native-picker Playwright persistence/reload/reopen E2E, and story-loop review-scope adapter probes; all reported passing. Chrome DevTools was not used by the runtime lane because Playwright and focused tests were the more reproducible file-handle/IndexedDB/workbook path for this pass.
- The implementation-reported validation commands were `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 3
- P3: 4
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Bound sparse workbook own-cell fallback before scanning every worksheet key during preview [src/features/import/parse-import-preview.ts:633-646] — `collectSparsePreviewableWorksheetRowsFromOwnCells()` caps retained candidate rows, but it still iterates every own worksheet key and parses each sparse address before ordered candidates are evaluated, so large or hostile sparse workbooks can keep preview-time work proportional to all sparse cells before explicit confirmation.
- [x] [Review][Patch][P2] Require source-backed saves to match the dataset's current source-file token and name, not only the dataset id [src/features/workspace-persistence/save-workspace.ts:161-176; src/services/persistence/repositories/workspace-repository.ts:431-448] — the required-handle checks accept any prepared handle for the same dataset id, and metadata synchronization then rewrites `sourceFile` from that handle, allowing stale or foreign same-dataset handles to satisfy fail-closed provenance and persist wrong source metadata.
- [x] [Review][Patch][P2] Add an aggregate budget for persisted dataset file-handle hydration sanitation [src/features/workspace-persistence/persisted-dataset-file-handles.ts:243-322; src/features/workspace-persistence/reopen-workspace.ts:1481-1483] — hydration applies the timeout per unique handle validation and awaits the full loop, so hostile persisted state with many unique timeout-prone handles can keep workspace reopen blocked for many timeout windows instead of reaching recovery promptly.
- [x] [Review][Patch][P3] Consider own-cell fallback when a stale short sparse workbook `!ref` omits later real cells [src/features/import/parse-import-preview.ts:696-777] — if the decoded `!ref` scans cleanly but valid sparse own cells exist outside that range, the own-cell fallback is not invoked and the workbook can preview as empty even though recoverable data is present.
- [x] [Review][Patch][P3] Count wide leading styled sparse rows against an explicit fallback work budget [src/features/import/parse-import-preview.ts:581-609] — leading rows with many styled/blank cells are bounded by row count, but their columns are read before contributing to `MAX_SPARSE_FALLBACK_OWN_CELL_SCAN`, leaving a pathological workbook preview-latency hardening gap.
- [x] [Review][Patch][P3] Use a single aggregate deadline for confirm-time source validation phases [src/services/persistence/fs-access/local-import-files.ts:98-200] — each `getFile()`, byte-read, and digest phase gets a fresh timeout, so a non-cooperative handle can exceed the advertised validation timeout across phases even though the flow eventually fails closed.
- [x] [Review][Patch][P3] Preserve story-listed source paths when review-scope parsing handles rename/copy records [`.story-loop/adapter.sh:221-224`] — porcelain `-z` rename/copy handling skips the source path and scopes only the destination, so a listed source renamed outside story scope may be omitted from deleted/changed accounting.

### Follow-up Review (R28)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- Runtime Integration Auditor used Chrome DevTools for live route/snapshot/console probing and Playwright for targeted native-picker persistence, confirm, reload, and reopen probes; those probes increased route/persistence confidence but did not invalidate the source/test-evidence findings.
- The review worker ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found unresolved P1/P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 2
- P2: 3
- P3: 2
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P1] Confirmed sparse workbook materialization can omit valid cells outside a stale short `!ref` when the stale range already yields preview rows [src/features/import/parse-import-preview.ts:821-837, src/features/import/parse-import-preview.ts:1144-1148] — the own-cell fallback only runs when the decoded range produces zero previewable rows, so a workbook with early rows inside `!ref` and later real rows outside it can confirm only the stale-range rows and silently drop valid data from the canonical dataset.
- [x] [Review][Patch][P1] A committed IndexedDB save can still be reported as stale and rolled back in live kernel state [src/features/workspace-persistence/save-workspace.ts:193-239, src/services/persistence/indexed-db/workspace-storage.ts:104-108, src/features/import/workspace-import-route.tsx:231-265] — if a concurrent mutation aborts after the IndexedDB transaction commits but before the repository/save promise settles, `commitConfirmedImportToKernel()` rolls back live state while durable storage can reopen with the older confirmed snapshot.
- [x] [Review][Patch][P2] Reject Import can still race with confirm persistence from the stale visible button/handler window [src/features/import/workspace-import-route.tsx:1997-2008, src/features/import/workspace-import-route.tsx:2167-2193] — `markConfirmationPersistencePending()` updates React state but the already-rendered Reject handler has no synchronous persistence-pending guard, so a user can clear the preview after canonical mutation/save has started and still end up with committed data.
- [x] [Review][Patch][P2] Sparse own-cell fallback can return before scanning own keys when valid data is outside the leading grid probe [src/features/import/parse-import-preview.ts:667-687] — after the bounded grid probe sets `stoppedBeforeEnd`, the fallback exits with no rows instead of trying the bounded own-key scan, so recoverable sparse cells outside that grid can be rejected as an empty workbook.
- [x] [Review][Patch][P2] Story-loop rename/copy scope can omit the paired endpoint when only one side is story-scoped [`.story-loop/adapter.sh:221-249`] — rename/copy parsing preserves a source path only when that source path independently matches `keep_path`, so a story-scoped destination can still lose source-side review context needed to audit the move/copy boundary.
- [x] [Review][Patch][P3] Sparse workbook row discovery reads own sparse cell values before validating the cell address [src/features/import/parse-import-preview.ts:517-528] — accessor-backed or hostile sparse worksheet properties can execute before malformed/noncanonical keys are rejected; non-gating because normal SheetJS parses produce plain cell objects and later import correctness guards still apply.
- [x] [Review][Patch][P3] Malformed sparse worksheet keys can consume the own-key fallback cap before valid cells are considered [src/features/import/parse-import-preview.ts:691-704] — the cap increments before address parsing, so hostile key ordering can hide recoverable sparse data within the fallback budget; non-gating because this is hostile-shape hardening beyond the demonstrated stale-`!ref` data-loss case.

### Follow-up Review (R29)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- Runtime Integration Auditor reported targeted Chrome DevTools route/confirm/IndexedDB/console probes and focused runtime-adjacent tests passed; Playwright CLI was considered but not separately run because the active Chrome DevTools target covered the relevant OPFS/file-handle persistence path for this pass.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 3
- P3: 3
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Block or abort-safe all import entrypoints while confirm persistence is pending, not only Reject Import [src/features/import/workspace-import-route.tsx:1374-1382, src/features/import/workspace-import-route.tsx:1591-1602, src/features/import/workspace-import-route.tsx:2076-2119] — users can start a new CSV/Excel/paste/benchmark import during the persistence-pending window; the old confirmed import can still persist and then mark the old preview committed after the visible preview has moved on.
- [x] [Review][Patch][P2] Re-present or block confirmation when confirm-time sparse workbook materialization discovers late rows after a non-partial preview [src/features/import/parse-import-preview.ts:1149-1166, src/features/import/workspace-import-route.tsx:1992-2023] — R28 now materializes validated own cells outside stale short refs, but confirm can commit those newly discovered rows without first surfacing the updated partial/expanded preview for user acknowledgement.
- [x] [Review][Patch][P2] Race stale-save aborts against non-cooperative repository persistence, not only the timeout signal [src/features/workspace-persistence/save-workspace.ts:204-217] — `saveWorkspaceKernel()` passes stale aborts into the repository but the outer await only races the timeout controller, so a custom or non-cooperative persistence path that ignores `abortSignal`/`assertNotStale` can still resolve a stale save as successful.
- [x] [Review][Patch][P3] Continue hydration sanitation after a slow invalid persisted file handle when time remains or account for skipped later handles explicitly [src/features/workspace-persistence/persisted-dataset-file-handles.ts:274-350] — a single slow or bad handle can consume the aggregate hydration deadline and `break` the loop, so later valid handles are never attempted and may lose source-file provenance unnecessarily.
- [x] [Review][Patch][P3] Close or clear late-success IndexedDB connections after an aborted open [src/services/persistence/indexed-db/workspace-storage.ts:77-84, src/services/persistence/indexed-db/workspace-storage.ts:137-154] — `putRecord()` clears the cached promise when abort wins, but a previously started `indexedDB.open()` can still succeed later and leave a stale database connection open.
- [x] [Review][Patch][P3] Resolve, close, or explicitly defer stale historical P3 review action items before final story completion [_bmad-output/implementation-artifacts/2-2-resolve-import-uncertainty-and-data-quality-issues-before-commit.md:490-552] — older unchecked P3 items remain in the story artifact despite later review/change-log entries saying the current safe P3 follow-ups were closed or non-gating.

### Follow-up Review (R30)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- Runtime Integration Auditor used Chrome DevTools route/import/confirm/reload/IndexedDB/console smoke plus targeted Playwright native-picker persistence E2E and focused persistence Vitest probes; no runtime findings remained from that lane.
- Dismissed one Blind Hunter provenance report as a false positive because preserving an existing CSV dataset handle after confirming an additional pasted dataset is expected for the prior source-backed dataset, not stale provenance on the pasted dataset.
- The round found one unresolved P2 gating issue, so the story returns to `in-progress`; this round's P3 finding remains an unchecked action item with the gating finding.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 1
- P3: 1
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Count malformed sparse worksheet own keys toward the fallback scan budget before address parsing [src/features/import/parse-import-preview.ts:696-704] — hostile or malformed workbook keys can bypass `MAX_SPARSE_FALLBACK_OWN_KEY_SCAN` because `processedOwnKeys` increments only after `parseSparseCellAddress(key)` succeeds, leaving preview-time workbook work proportional to malformed key count before explicit confirmation.
- [x] [Review][Patch][P3] Surface an immediate visible persistence-pending message when import entrypoints are disabled [src/features/import/workspace-import-route.tsx:1143-1148, src/features/import/workspace-import-route.tsx:2170-2213] — disabled buttons and textareas cannot trigger the handler that sets `CONFIRMATION_PERSISTENCE_IMPORT_ENTRYPOINT_BLOCKED_MESSAGE`, so keyboard users can briefly see a locked import surface without explanatory feedback while Confirm Import persistence is pending.

### Follow-up Review (R31)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- Runtime Integration Auditor used targeted Playwright/native-picker OPFS persistence E2E and focused runtime-sensitive Vitest probes; Chrome DevTools was considered but not used because the Playwright probe covered the browser-native picker/OPFS/IndexedDB path more directly for this review scope.
- Dismissed the raw-handle hydration report because `persistedWorkspaceRecordSchema` treats `datasetFileHandles` as `unknown[]`, so initial reopen parsing is not blocked by malformed handle entries before sanitation.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 finding remains an unchecked action item with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 2
- P3: 1
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Let sparse workbook own-key fallback run when the leading bounded grid sees only styled or empty cells before later valid data [src/features/import/parse-import-preview.ts:626-688] — the early return for `previewableRows.length === 0 && stoppedBeforeEnd && rowMap.size > 0` can reject a sparse workbook as empty when the bounded leading probe finds only non-previewable cells and skips the own-key fallback that could discover valid later rows.
- [x] [Review][Patch][P2] Block or abort-safe import entrypoints while confirm-time source validation/materialization is pending, not only during persistence [src/features/import/workspace-import-route.tsx:1156-1161, src/features/import/workspace-import-route.tsx:1415-1433, src/features/import/workspace-import-route.tsx:1884-1900] — local file selection can open while a confirmed import is still validating/materializing; because `beginImport()` is not reached until after the picker resolves, the previous confirmation can still proceed and persist the old preview while the user is already replacing the source.
- [x] [Review][Patch][P3] Avoid starving later valid persisted dataset file handles when malformed or slow invalid entries consume the aggregate hydration budget [src/features/workspace-persistence/persisted-dataset-file-handles.ts:253-349] — the per-entry timeout is divided across all raw entries and the loop breaks when the aggregate deadline expires, so hostile or legacy handle lists can unnecessarily drop later valid source handles and force relinking even though canonical data remains available.

### Follow-up Review (R32)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, synthetic untracked-file diffs, and every Story 2.2 File List entry.
- Runtime Integration Auditor used Playwright CLI targeted native-picker/OPFS persistence E2E, focused parser/import-route/persisted-handle Vitest probes, and Chrome DevTools route/console/network/storage/IndexedDB smoke probes; no runtime findings remained from that lane.
- Dismissed one Blind Hunter report about the confirm-pending ref because the live route does set `confirmationPendingPreviewIdRef.current` in `markConfirmationPending()` before confirm validation/materialization begins.
- The review worker ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 finding remains an unchecked action item with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 3
- P3: 1
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Deduplicate or otherwise fairly budget valid-shaped duplicate persisted handle entries before slicing the hydration timeout [src/features/workspace-persistence/persisted-dataset-file-handles.ts:257-280] — many valid-shaped stale duplicates can shrink every validation slice and consume the aggregate deadline before a later usable handle is attempted, dropping source-backed provenance after reopen.
- [x] [Review][Patch][P2] Let sparse own-key fallback run after the leading grid finds the configured number of styled/empty rows but no previewable data [src/features/import/parse-import-preview.ts:683-688] — sparse workbook templates with many styled/blank leading rows can still return an empty preview before the bounded own-key fallback sees later valid cells, blocking a recoverable workbook.
- [x] [Review][Patch][P2] Move persisted dataset file-handle byte reads behind the `services/persistence` boundary or document an approved exception [src/features/workspace-persistence/persisted-dataset-file-handles.ts:112-123, src/features/workspace-persistence/persisted-dataset-file-handles.ts:216-219, src/features/workspace-persistence/persisted-dataset-file-handles.ts:334-338] — the story guardrail says File System Access/browser storage APIs stay under `services/persistence`, but feature-layer hydration/save helpers still dereference handles and read local file bytes directly.
- [x] [Review][Patch][P3] Clear the sparse fallback partial marker when own-key fallback fully exhausts after a small styled/empty leading probe [src/features/import/parse-import-preview.ts:668-727] — a fully scanned sparse workbook can still report an inflated partial-preview row count after the initial bounded grid probe set `stoppedBeforeEnd`; non-gating because canonical data is not lost, but preview copy/counts can be misleading.

### Follow-up Review (R33)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, synthetic untracked-file diffs, and every Story 2.2 File List entry.
- Runtime Integration Auditor used focused Vitest coverage plus targeted Playwright native-picker/OPFS persistence E2E. Chrome DevTools was not used because Playwright covered the browser file-handle, storage, reload, and reopen path more directly for this pass.
- The review worker ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found one unresolved P2 gating issue, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating finding.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 1
- P3: 2
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Fairly budget duplicate same-source hydration candidates so one stale candidate cannot consume the entire source group deadline [src/features/workspace-persistence/persisted-dataset-file-handles.ts:163-245] — Duplicate persisted handles are grouped by dataset/source key, but `perEntryTimeoutMs` is divided only by unique keys and each duplicate candidate is still tried sequentially. With one key and many stale duplicates, the first timeout-prone candidate can consume the aggregate deadline before a later usable handle is attempted, dropping source-backed provenance on reopen despite the R32 fairness goal.
- [x] [Review][Patch][P3] Avoid false partial-preview markers when the sparse leading-grid probe already captured a complete small workbook [src/features/import/parse-import-preview.ts:674-686] — The leading-grid path returns `stoppedBeforeEnd: true` whenever it finds previewable rows with at least two columns, even if the workbook is small and fully represented by those candidates. Non-gating because confirm materialization preserves data integrity, but preview copy/counts can remain misleading.
- [x] [Review][Patch][P3] Check cancellation before starting workspace file-handle validation reads [src/services/persistence/fs-access/portable-workspace-files.ts:138-156] — `validateWorkspaceFileHandleSnapshot()` starts `handle.getFile()`/`arrayBuffer()` before the cancellation wrapper can reject an already-aborted validation. Non-gating because callers still fail closed, but hostile or stale file handles can consume runtime work after cancellation.

### Follow-up Review (R34)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- Runtime Integration Auditor considered targeted live probes and did not use Chrome DevTools/Playwright in this pass because the surfaced issue is a source-level hydration timeout/cache edge case; it identified one non-gating late-rejection concern that was dismissed during triage because `Promise.race` observes the raced operation's eventual rejection.
- The review worker ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found one unresolved P2 gating issue, so the story returns to `in-progress`.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 1
- P3: 0
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Do not cache a timed-out shared handle validation as permanently invalid for later compatible hydration entries [src/features/workspace-persistence/persisted-dataset-file-handles.ts:224-237] — `sanitizePersistedDatasetFileHandlesForHydration()` caches `Boolean(validatedFile)` by handle object plus file metadata, so a valid shared handle that times out under a small duplicate-candidate budget can poison the validation cache and be skipped for later compatible dataset/source entries that could have validated within their own remaining budget, silently dropping source-backed provenance after reopen.

### Follow-up Review (R35)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, untracked changes, and every Story 2.2 File List entry.
- Runtime Integration Auditor used targeted Playwright native-picker persistence coverage and focused persisted-handle coverage; Chrome DevTools was not used because Playwright covered the browser file-handle, IndexedDB, reload, and reopen path more directly for this pass.
- Implementation-reported validation passed for `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 3
- P3: 2
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Backfill or retry earlier compatible shared-handle hydration entries after a later validation succeeds [src/features/workspace-persistence/persisted-dataset-file-handles.ts:216-263] — the R34 regression validates the second compatible entry after the first timed out, but only the currently processed entry is accepted. The earlier dataset/source entry remains dropped even though the same handle, file metadata, and digest were later proven valid, silently losing source-backed provenance for one dataset after reopen.
- [x] [Review][Patch][P2] Prevent duplicate candidate counts from shrinking valid-handle validation slices until usable handles are starved [src/features/workspace-persistence/persisted-dataset-file-handles.ts:164-245] — `perCandidateTimeoutMs` is derived from the raw duplicate candidate count, so many stale valid-shaped duplicates can leave a later usable handle with an unrealistically tiny timeout and still strip source-backed provenance from reopened workspaces.
- [x] [Review][Patch][P2] Enforce one aggregate validation deadline across `getFile()`, `arrayBuffer()`, and digest phases [src/features/workspace-persistence/persisted-dataset-file-handles.ts:175-187; src/services/persistence/fs-access/portable-workspace-files.ts:58-127] — each validation phase can receive a fresh timeout, so a slow or hostile file handle can exceed the intended hydration budget before failing closed and keep workspace recovery blocked longer than the story's fail-closed local persistence boundary allows.
- [x] [Review][Patch][P3] Abort persisted-handle hydration validation work when the workspace route unmounts [src/app/router/shell-routes.tsx:347-349; src/app/router/shell-routes.tsx:506-530] — the route suppresses stale UI updates on unmount, but it does not pass an abort signal into local file-handle sanitation, so source-handle reads can continue after the user leaves the workspace. Non-gating because correctness still fails closed, but runtime work can outlive the active route.
- [x] [Review][Patch][P3] Decide whether successful shared-handle validation cache reuse needs a same-hydration revalidation guard [src/features/workspace-persistence/persisted-dataset-file-handles.ts:135-136; src/features/workspace-persistence/persisted-dataset-file-handles.ts:216-263] — successful validations are reused by handle object plus file metadata/digest without another byte read for later entries. Non-gating because this is a narrow same-pass TOCTOU window, but the source-integrity boundary may need an explicit accepted-risk comment or guard.

### Follow-up Review (R36)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, synthetic untracked-file diffs, and every Story 2.2 File List entry.
- Runtime Integration Auditor used targeted Playwright native-picker persistence coverage plus focused persisted-handle/hydration regressions through the repo Node wrapper; Chrome DevTools was not used because Playwright was the better scripted path for file-handle, IndexedDB, reload/reopen, and persisted-storage surfaces.
- Implementation-reported validation passed for `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 2
- P3: 3
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Avoid shrinking a shared handle's only validation slice by every compatible entry it can backfill [src/features/workspace-persistence/persisted-dataset-file-handles.ts:199-218] — `perEntryTimeoutMs` divides the aggregate hydration budget by every dataset/source entry before shared-handle backfill can prove them all with one read, so a valid but moderately slow source handle shared by many datasets can time out under an artificially tiny slice and strip source-backed provenance on reopen.
- [x] [Review][Patch][P2] Decouple route-unmount aborts from the cached shared hydration promise used by later mounts [src/app/router/shell-routes.tsx:456-490; src/app/router/shell-routes.tsx:515-542] — the first caller's abort signal is captured inside `cachedStore.hydrationPromise`; if the route unmounts while another mount reuses the in-flight promise, the active remount can receive the prior route's `Workspace route unmounted` failure instead of continuing hydration.
- [x] [Review][Patch][P3] Bound malformed or duplicate persisted handle grouping work before validation begins [src/features/workspace-persistence/persisted-dataset-file-handles.ts:165-183] — sanitation parses and groups every raw candidate before timeout/cancellation is checked, so hostile or corrupt persisted state with massive duplicate/malformed handle arrays can burn CPU and memory before the fail-closed hydration guards run.
- [x] [Review][Patch][P3] Use descriptor-based sparse worksheet reads consistently after own-property checks [src/features/import/parse-import-preview.ts:827; src/features/import/parse-import-preview.ts:1124-1132] — several sparse workbook paths still read `sheet[address]`/`sheet[sparseCellAddress]` directly after `hasOwnProperty`, leaving accessor-backed worksheet properties able to execute or throw during preview/materialization despite adjacent hardened descriptor reads.
- [x] [Review][Patch][P3] Reconcile or document Story 2.2 review-tooling changes outside the original owning-path boundary [.agents/skills/bmad-code-review/steps/step-02-review.md; .agents/skills/bmad-review-runtime-integration-auditor/SKILL.md; .agents/skills/bmad-story-loop-orchestrator/scripts/validate_story_loop_json.py; .story-loop/adapter.sh] — this does not directly violate AC1-AC3 import behavior, but the diff still carries review/orchestration tooling changes outside the story's initial Contract Boundaries, so completion should either document the intentional scope expansion or move those changes to an appropriate governance story.

### Follow-up Review (R37)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, synthetic/direct untracked-file coverage, and every Story 2.2 File List entry.
- Runtime Integration Auditor used targeted Playwright native-picker persistence coverage plus focused runtime-sensitive Vitest probes; Chrome DevTools was not used because Playwright was the better scripted path for file-handle, IndexedDB, reload/reopen, and persisted-storage surfaces.
- The review worker ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 3
- P3: 4
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Cap persisted handle parsing before bounded hydration sanitation [src/app/router/shell-routes.tsx:343-356; src/features/workspace-persistence/persisted-dataset-file-handles.ts:72-83] — hostile persisted browser state can feed a huge `datasetFileHandles` array through unbounded `parsePersistedDatasetFileHandles()` before the later sanitation cap/timeout applies, keeping workspace hydration from reaching fail-closed recovery promptly.
- [x] [Review][Patch][P2] Start a fresh shared hydration attempt when the cached hydration signal was already aborted [src/app/router/shell-routes.tsx:477-485; src/app/router/shell-routes.tsx:530-567] — a route unmount can abort the shared hydration controller while its promise is still cached; a fast remount can then reuse the doomed promise and observe the previous route's cancellation instead of continuing active hydration.
- [x] [Review][Patch][P2] Prevent duplicate same-dataset handles from rewriting required source provenance after the required-handle check passes [src/features/workspace-persistence/save-workspace.ts:193-207; src/services/persistence/repositories/workspace-repository.ts:241-249] — a handle list containing the expected source handle plus a later valid foreign handle for the same dataset can satisfy the required-source check, then last-write-wins source metadata synchronization can persist the foreign provenance.
- [ ] [Review][Patch][P3] Clear false sparse-workbook partial state after own-key fallback fully scans one-column sparse workbooks [src/features/import/parse-import-preview.ts:702-768] — complete one-column sparse sheets can keep `stoppedBeforeEnd` from the leading-grid probe even after bounded own-key fallback exhausts all keys, yielding misleading partial-preview copy/counts without losing canonical data.
- [ ] [Review][Patch][P3] Validate persisted `fileSha256` as a bounded SHA-256 token instead of any non-empty string [src/features/workspace-persistence/persisted-dataset-file-handles.ts:20-40; src/services/persistence/repositories/workspace-repository.ts:82] — malformed or very large digest strings can survive parsing and inflate hydration cache/key work before byte validation fails.
- [ ] [Review][Patch][P3] Ignore or explicitly account for U+F03A Zone.Identifier artifacts [`.gitignore:11`] — `.gitignore` covers colon-form `*:Zone.Identifier` but not the U+F03A variant currently represented by the deleted story-listed artifact, so future same-shape local artifacts can re-enter diffs and review scope.
- [ ] [Review][Patch][P3] Preserve exact story file-list path text instead of stripping legitimate edge whitespace [`.story-loop/adapter.sh:177-185`] — story-loop scope parsing strips captured paths, so story-listed files whose names legitimately start or end with whitespace may not match exact `git status -z` paths.

### Follow-up Review (R38)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, relevant untracked files, the deleted Zone.Identifier artifact, and every Story 2.2 File List entry.
- Runtime-sensitive review included IndexedDB hydration, file-handle provenance, import confirmation/materialization cancellation, sparse workbook parsing, and story-loop scope/report tooling. The review worker also ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 3
- P3: 5
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Expand story-loop review scope collection so untracked directories are enumerated to child files before matching or synthetic diff generation [`.story-loop/adapter.sh:196-242`] — `git status --porcelain=v1 -z` can report a whole untracked directory such as `_bmad-output/benchmarks/benchmark_set_error_handling/` instead of the fixture files inside it, so relevant untracked story artifacts can be omitted from scoped review and synthetic diffs.
- [x] [Review][Patch][P2] Make IndexedDB workspace record loads abortable or bounded during route hydration [src/services/persistence/indexed-db/workspace-storage.ts:119-127; src/app/router/shell-routes.tsx:543-567] — `hydrateWorkspaceKernelStore()` checks the shared abort signal only after `loadWorkspaceRecord()` returns, while `IndexedDbWorkspaceStorage.getRecord()` awaits database open/read/transaction completion with no signal or timeout, so blocked browser storage can leave the workspace route stuck loading instead of reaching fail-closed recovery.
- [x] [Review][Patch][P2] Drop dataset-file-handle entries for datasets that no longer declare `sourceFile` metadata before save/repository synchronization [src/features/workspace-persistence/save-workspace.ts:141-168; src/services/persistence/repositories/workspace-repository.ts:410-441] — both retain helpers keep handles when `!dataset.sourceFile`, and later source-metadata synchronization can reattach stale or foreign provenance to a handleless dataset instead of preserving the fail-closed source boundary.
- [ ] [Review][Patch][P3] Clear false sparse-workbook partial state after own-key fallback fully scans one-column sparse workbooks [src/features/import/parse-import-preview.ts:702-768] — complete one-column sparse sheets can keep `stoppedBeforeEnd` from the leading-grid probe even after bounded own-key fallback exhausts all keys, yielding misleading partial-preview copy/counts without losing canonical data.
- [ ] [Review][Patch][P3] Validate persisted `fileSha256` as a bounded SHA-256 token instead of any non-empty string [src/features/workspace-persistence/persisted-dataset-file-handles.ts:20-40; src/services/persistence/repositories/workspace-repository.ts:82] — malformed or very large digest strings can survive parsing and inflate hydration cache/key work before byte validation fails.
- [ ] [Review][Patch][P3] Ignore or explicitly account for U+F03A Zone.Identifier artifacts [`.gitignore:11`] — `.gitignore` covers colon-form `*:Zone.Identifier` but not the U+F03A variant currently represented by the deleted story-listed artifact, so future same-shape local artifacts can re-enter diffs and review scope.
- [ ] [Review][Patch][P3] Preserve exact story file-list path text instead of stripping legitimate edge whitespace [`.story-loop/adapter.sh:177-185`] — story-loop scope parsing strips captured paths, so story-listed files whose names legitimately start or end with whitespace may not match exact `git status -z` paths.
- [ ] [Review][Patch][P3] Make confirm-time replay source reads abort-aware while a local file is being read before worker materialization [src/features/import/workspace-import-route.tsx:767-802] — cancellation is checked before and after `readTextFile`/`readBinaryFile`, but the read itself receives no signal, so rejected or superseded previews can continue large file reads after the confirm flow has been canceled; non-gating because stale commits are guarded.

### Follow-up Review (R39)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, staged and unstaged changes, relevant untracked files/synthetic coverage, and every Story 2.2 File List entry.
- Verified the story-loop adapter now enumerates relevant untracked Story 2.2 child files (`save-workspace.spec.ts`, `portable-workspace-files.spec.ts`, and `workspace-storage.spec.ts`) while still surfacing broader untracked benchmark children in `all_untracked`.
- Runtime-sensitive review covered IndexedDB hydration aborts, file-handle/source provenance sanitation, import-confirm source-read cancellation, sparse workbook partial-preview state, persisted digest parsing, and story-loop scope parsing.
- The review worker ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found unresolved P2 gating issues, so the story returns to `in-progress`; this round's P3 findings remain unchecked action items with the gating findings.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 2
- P3: 5
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Avoid closing a shared IndexedDB open result after one caller aborts while other callers may still use it [src/services/persistence/indexed-db/workspace-storage.ts:76-84; src/services/persistence/indexed-db/workspace-storage.ts:122-130] — aborted `putRecord()`/`getRecord()` calls clear the shared `#databasePromise` and close the late database returned by that same promise, so concurrent non-aborted loads/saves awaiting the shared open can receive or continue with a database connection that another caller has just closed.
- [x] [Review][Patch][P2] Drop same-dataset stale handles when no handle matches the dataset's current `sourceFile` metadata [src/features/workspace-persistence/save-workspace.ts:156-167; src/services/persistence/repositories/workspace-repository.ts:429-440] — both retain helpers keep any handle for a dataset when the current source handle is missing, then source-metadata synchronization can rewrite the snapshot to stale/foreign provenance instead of preserving the existing source boundary or dropping the handle.
- [ ] [Review][Patch][P3] Include surfaced untracked directory children in story-loop `scope` when they are intentionally relevant to the story review [`.story-loop/adapter.sh:193-194; .story-loop/adapter.sh:239-253`] — the adapter exposes untracked benchmark children in `all_untracked`, but they do not enter `scope` unless they exactly match the File List, so downstream story-loop consumers that rely on `scope` can still miss synthetic diffs for unlisted but relevant story artifacts.
- [ ] [Review][Patch][P3] Make confirm-time replay source reads abort-aware while a local file is being read before worker materialization [src/features/import/workspace-import-route.tsx:786-802] — cancellation is checked around `readTextFile`/`readBinaryFile`, but the read itself receives no signal, so canceled or superseded confirm flows can keep consuming large-file IO after correctness has already been guarded by stale checks.
- [ ] [Review][Patch][P3] Validate persisted `fileSha256` as a bounded SHA-256 token instead of any non-empty string [src/features/workspace-persistence/persisted-dataset-file-handles.ts:14-41; src/services/persistence/repositories/workspace-repository.ts:76-83] — hostile persisted records can carry oversized malformed digest strings into hydration/repository cache-key work before byte validation fails closed.
- [ ] [Review][Patch][P3] Preserve exact story file-list path text instead of stripping legitimate edge whitespace [`.story-loop/adapter.sh:177-185`] — story-loop scope parsing strips captured backticked paths, so a story-listed path whose actual filename begins or ends with whitespace would not match exact `git status -z` output.
- [ ] [Review][Patch][P3] Clear false sparse-workbook partial state after own-key fallback fully scans one-column sparse workbooks [src/features/import/parse-import-preview.ts:702-768] — complete one-column sparse sheets can retain `stoppedBeforeEnd` from the leading-grid probe after bounded own-key fallback exhausts all keys, producing misleading partial-preview copy without losing canonical data.

### Follow-up Review (R40)

#### Review Date

2026-04-26

#### Outcome

Changes Requested

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, staged and unstaged changes, relevant untracked files/synthetic coverage, and every Story 2.2 File List entry.
- Runtime-sensitive review covered IndexedDB open/abort sharing, route hydration and persisted file-handle sanitation, workspace save/repository provenance, and reopen integration behavior. Runtime probes included focused Vitest coverage and Chrome DevTools live IndexedDB/route probes from the runtime lane.
- The review worker ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The round found one unresolved P2 gating issue, so the story returns to `in-progress`; this round's P3 finding remains an unchecked action item with the gating finding.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 1
- P3: 1
- Decision Needed: 0

#### Action Items

- [x] [Review][Patch][P2] Count `listRecords()` callers as shared IndexedDB-open waiters before any abortable caller can clear or close the cached pending open [src/services/persistence/indexed-db/workspace-storage.ts:77-99; src/services/persistence/indexed-db/workspace-storage.ts:130-152; src/services/persistence/indexed-db/workspace-storage.ts:182-183] — `putRecord()` and `getRecord()` increment `#databaseOpenWaiterCount` around `#openDatabase()`, but `listRecords()` awaits the same cached promise without incrementing. If `listRecords()` is waiting on a pending open and a concurrent abortable `putRecord()` or `getRecord()` aborts, the aborting caller can see waiter count `1`, clear `#databasePromise`, and close the late-opened database even though `listRecords()` still expects to use it.
- [ ] [Review][Patch][P3] Suppress expected route-unmount hydration cancellations from error-level console logging [src/app/router/shell-routes.tsx:655-660] — runtime probing observed successful workspace hydration alongside `Workspace hydration failed ... Workspace route unmounted` console errors for expected cancellation paths. Non-gating because the UI recovered and rendered the workspace, but the noise can pollute console/error monitoring.

### Follow-up Review (R41/pass 34)

#### Review Date

2026-04-26

#### Outcome

P3 Only - Deferred; Story Done

#### Summary

- Ran fresh nested Blind Hunter, Edge Case Hunter, Runtime Integration Auditor, and Acceptance Auditor lanes in story-loop mode against the full uncommitted diff versus `HEAD`, staged and unstaged changes, relevant untracked files/synthetic coverage, and every Story 2.2 File List entry.
- Focused the pass-34 review on `src/services/persistence/indexed-db/workspace-storage.ts`, `src/services/persistence/indexed-db/workspace-storage.spec.ts`, this story file, and sprint status. The R40 P2 shared-open/list-records waiter-count fix is covered and no remaining P0/P1/P2 findings were accepted after triage.
- Dismissed one Blind Hunter report about route hydration using raw persisted handle metadata in an initial reopen pass: the first pass does not read local handles or shape canonical acceptance from byte trust, and the second pass reruns reopen after sanitation for the user-visible snapshot/issues.
- The review worker ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`; all passed.
- The only remaining finding is the known route-unmount hydration console-noise P3, deferred as non-gating/out of adjacent scope.

#### Severity Breakdown

- P0: 0
- P1: 0
- P2: 0
- P3: 1
- Decision Needed: 0

#### Deferred Work

- [x] [Review][Defer][P3] Suppress expected route-unmount hydration cancellations from error-level console logging [src/app/router/shell-routes.tsx:655-660] — deferred, non-gating console/error-monitoring noise; UI recovers and the issue is outside the adjacent R40 P2 IndexedDB shared-open fix.
