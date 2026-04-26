# Story 2.2: Resolve Import Uncertainty and Data-Quality Issues Before Commit

Status: review

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

### File List

- `src/app/router/shell-routes.tsx`
- `src/app/router/shell-routes.spec.tsx`
- `src/app/router/shell-routes-hydration.spec.ts`
- `.agents/skills/bmad-code-review/steps/step-01-gather-context.md`
- `.agents/skills/bmad-code-review/steps/step-02-review.md`
- `.agents/skills/bmad-code-review/steps/step-03-triage.md`
- `.agents/skills/bmad-code-review/steps/step-04-present.md`
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
- `src/features/workspace-persistence/workspace-kernel-persistence-state.ts`
- `src/services/persistence/fs-access/local-import-files.spec.ts`
- `src/services/persistence/fs-access/local-import-files.ts`
- `src/services/persistence/repositories/workspace-repository.ts`
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
- [ ] [Review][Patch] [P3] Add end-to-end coverage for native-picker file-handle persistence through confirm and reopen flows [tests/e2e/import.spec.ts:136]
- [ ] [Review][Patch] [P3] Remove or scope the repo-wide `workers: 1` Playwright override [playwright.config.ts:6]

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
- [ ] [Review][Patch] [P3] Hydration fallback coverage still exercises only mocked loader paths, so the shell-route reopen fallback is not yet acceptance-proven against the real persistence boundary [src/app/router/shell-routes-hydration.spec.ts:151]

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
- [ ] [Review][Patch] [P3] Prune stale preview replay contexts across repeated previews and rejects so the route does not accumulate per-preview replay state indefinitely [src/features/import/workspace-import-route.tsx:1231]
- [ ] [Review][Patch] [P3] Add end-to-end coverage that exercises native-picker file-handle persistence through confirm and reopen flows with a real handle-shaped path instead of a file-only mock [tests/e2e/import.spec.ts:136]

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
- [ ] [Review][Patch][P3] Clarify P3 disposition rules for decision-needed-only review rounds [`.agents/skills/bmad-story-loop-orchestrator/scripts/validate_story_loop_json.py:329`] — current validation only permits P3 action items when gating findings exist, while workflow text does not clearly define whether decision-needed-only rounds must defer or action-item P3 findings.
