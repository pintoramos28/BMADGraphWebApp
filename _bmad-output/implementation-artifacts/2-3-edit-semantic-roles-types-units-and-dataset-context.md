# Story 2.3: Edit Semantic Roles, Types, Units, and Dataset Context

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to inspect and adjust each imported column's meaning,
so that downstream graphs, stats, and exports use the correct analytical semantics.

## Acceptance Criteria

1. Given an imported dataset is active, when the user inspects a column, then type, role, label, units, and measurement context are visible and editable.
2. Given a semantic edit is committed, when downstream analytical state recalculates, then active graph and summary consumers use the updated semantics without requiring re-import.
3. Given the dataset is graph-ready, when the user views the working context, then the active semantic choices are summarized clearly before graphing begins.

## Dependencies

- Story 2.2: Resolve Import Uncertainty and Data-Quality Issues Before Commit.
- Existing confirmed-import path through `WorkspaceKernel`, IndexedDB persistence, dataset file-handle metadata, and canonical `WorkspaceSnapshot` validation.
- Foundational contract decisions from implementation kickoff ADRs: workspace snapshot v1, append-only ledger, shared issue record, benchmark gates, and BMAD graph-definition boundary.

## Contract Boundaries

- In scope: canonical semantic metadata for confirmed datasets; editable column type, analytical role, display label, units, measurement context, and dataset context; graph-ready semantic summary; semantic edit persistence/reopen; readiness/issue integration for invalid or incomplete semantics; keyboard-accessible semantic editing UI.
- Out of scope: import parsing and data-quality repair beyond consuming the confirmed dataset; broad guided onboarding/recovery copy owned by Story 2.4; transform/formula authoring owned by Epic 3; graph generation/role dock rendering owned by Epic 4; review/export/handoff flows owned by later epics; any server-side dataset or workspace API.
- Owning paths: `src/features/semantics/**` (new), `src/schemas/workspace/**`, `src/stores/workspace-kernel/**`, `src/domain/trust/**`, `src/domain/readiness/**` if needed, `src/app/router/shell-routes.tsx`, `src/features/import/confirm-import.ts`, `tests/e2e/import.spec.ts`, and colocated unit/component specs.
- Downstream consumers after completion: Story 2.4 layers guidance onto the semantic correction surface; Epic 3 transforms and formulas consume the canonical dataset semantics; Epic 4 graph authoring consumes semantic role/type/label/unit metadata for first graph generation and graph validation; Epic 5 review/export surfaces consume the same metadata for defensibility.

## Tasks / Subtasks

- [ ] Extend canonical workspace semantic contracts. (AC: 1, 2, 3)
  - [ ] Update `src/schemas/workspace/workspace-snapshot.ts` (or add an adjacent exported schema file) so dataset columns include immutable `sourceName` plus editable `label`, `dataType`, `semanticRole`, `unit`, `measurementContext`, optional `description`, and existing `status`.
  - [ ] Keep `sourceName` as provenance from import; use `label` as the user-editable display name that future graphs, summaries, and exports consume.
  - [ ] Add dataset-level context metadata without duplicating `displayName`: keep `displayName` as the dataset title and add a `datasetContext` (or equivalent) object for description, measurement-context notes, and graph-ready context summary inputs.
  - [ ] Seed defaults in `src/features/import/confirm-import.ts`: `label = sourceName`, `semanticRole = 'unassigned'`, `unit = null`, `measurementContext = null`, `description = null` or omitted, and existing inferred `dataType`.
  - [ ] Update bootstrap, recovery, fixtures, and reopen/backfill paths so new required semantic fields do not break existing saved workspaces or Story 2.2 persisted import workspaces.
- [ ] Add WorkspaceKernel semantic mutation commands. (AC: 2)
  - [ ] Add typed inputs/commands in `src/stores/workspace-kernel/types.ts` for column semantic edits and dataset context edits, including `KernelMutationMeta`.
  - [ ] Implement reducers in `src/stores/workspace-kernel/reducers.ts` that immutably update only the targeted dataset/column/context, validate through `workspaceSnapshotSchema`, append compact ledger entries, and preserve rows, source file metadata, `datasetFileHandles`, graph definitions, and existing issues unless explicitly reconciled.
  - [ ] Wire commands through `src/stores/workspace-kernel/store.ts` and add selectors in `src/stores/workspace-kernel/selectors.ts` for active dataset, dataset columns, and graph-ready semantic summary if the UI needs them.
  - [ ] Use event names as dotted, past-tense facts such as `dataset.column-semantics.updated` and `dataset.context.updated`.
  - [ ] When semantic validation creates or resolves issues, reconcile only `semantics.*` issues for the targeted dataset/column/context and preserve import, reopen, graph, persistence, and unrelated repair issues.
- [ ] Build the semantic editing feature surface. (AC: 1, 3)
  - [ ] Create `src/features/semantics/` with a `WorkspaceSemanticsPanel` (or equivalent) and barrel export from `src/features/semantics/index.ts`.
  - [ ] Render the panel from `src/app/router/shell-routes.tsx` within the existing `/workspace` and `/workspace/:workspaceId` flow after the kernel store has hydrated; do not add new routes unless architecture is updated.
  - [ ] Show all confirmed dataset columns with editable type, semantic role, label, unit, and measurement context; include the active dataset-level context editor.
  - [ ] Provide a clear graph-ready summary that lists active semantic choices before graphing begins, including unresolved missing roles/context and any confirmed units/labels.
  - [ ] Keep import preview/repair state separate. The semantic panel edits only confirmed canonical datasets, not unconfirmed previews.
- [ ] Add semantic validation, readiness, and issue integration. (AC: 1, 2, 3)
  - [ ] Validate data type, role, label, unit, and measurement context locally before commit; invalid or incomplete graph-ready state should create/update shared `IssueRecord`s, not ad hoc UI-only errors.
  - [ ] Reuse `contextRef.routeKey = 'workspaceDetail'` and route issues to exact dataset/column context. If `IssueRecord.contextRef` is not extended, use `source.entityType = 'dataset-column'`, `source.entityId = <columnId>`, and include `datasetId`, `columnId`, and field name in diagnostics/repair action args.
  - [ ] Add `dataset-column` and dataset-context scope labels to `src/domain/trust/selectors.ts` so repair/readiness surfaces do not show generic or misleading scope labels.
  - [ ] Ensure readiness summaries and repair entry points reflect unresolved semantic issues through existing issue/readiness selectors.
  - [ ] Do not block all exploration on incomplete optional metadata; distinguish blocking graph-readiness conflicts from warnings for missing optional context.
- [ ] Propagate semantic edits to graph/readiness consumers. (AC: 2)
  - [ ] Revalidate existing `graphDefinitions` that reference edited columns using the existing graph catalog validation path (`src/features/workspace-persistence/graph-catalog.ts`) or an equivalent shared helper.
  - [ ] If a data type or semantic role edit makes an existing graph composition invalid, preserve the last valid graph definition, mark the graph stale or attach a graph/readiness `IssueRecord`, and keep valid unaffected state usable.
  - [ ] Keep graph role assignments by stable `columnId`; do not rewrite assignments to labels or source names.
  - [ ] Ensure the semantic summary and any active graph/readiness selectors read the committed semantic fields immediately after commit without requiring re-import.
- [ ] Preserve schema evolution and reopen compatibility. (AC: 2)
  - [ ] Update `src/features/workspace-persistence/reopen-workspace.ts`, recovery dataset/graph creation, workspace fixtures, and reopen tests to backfill defaults for legacy columns missing new semantic fields.
  - [ ] Ensure `createImportWorkspaceSnapshot()` bootstrap data and any recovery dataset satisfy the expanded workspace schema.
  - [ ] Add reopen/migration tests proving Story 2.2 saved workspaces and benchmark workspace fixtures hydrate successfully after the semantic schema expansion.
- [ ] Persist semantic commits and preserve reopen behavior. (AC: 2)
  - [ ] Save committed semantic edits through the existing workspace persistence boundary, not by writing directly to IndexedDB or local storage from UI components.
  - [ ] On persistence failure, keep the user informed and avoid presenting the edit as durable; preserve prior valid canonical state and file handles.
  - [ ] Verify reload/reopen restores edited type, role, label, unit, measurement context, dataset context, and graph-ready summary from the canonical workspace.
- [ ] Add unit, component, integration, and e2e coverage. (AC: 1, 2, 3)
  - [ ] Add schema tests proving new semantic fields parse, reject invalid data, and preserve backward-compatible confirmed-import defaults.
  - [ ] Add kernel tests proving semantic reducers update one column/context, append ledger entries, preserve source file handles and imported rows, and reconcile issue/readiness state.
  - [ ] Add component tests for keyboard-editable semantic controls, accessible labels/helper/error text, and graph-ready summary updates.
  - [ ] Extend `tests/e2e/import.spec.ts` to confirm an import, edit semantics, reload/reopen, assert persistence, and prove no re-import is required for the semantic summary to update.
  - [ ] Preserve existing Story 2.1/2.2 clean and dirty import acceptance coverage.

## Dev Notes

### Story Foundation

- Epic 2 goal: users can bring local data into the workspace, repair messy intake, confirm semantics and metadata, and reach a trustworthy graph-ready starting point without specialist help. [Source: `_bmad-output/planning-artifacts/epic-2-stories.md#Epic 2 Stories`; `_bmad-output/planning-artifacts/epics.md#Epic 2`]
- Story 2.3 covers FR8-FR14 and FR58: inspect/change data type, analytical role, active semantics, label, units, measurement context, descriptive metadata, and downstream semantic propagation. [Source: `_bmad-output/planning-artifacts/prd.md#Semantic Interpretation & Dataset Management`; `_bmad-output/planning-artifacts/prd.md#Guidance, Review, and Output`]
- Primary NFRs: semantic correction must be keyboard-operable, WCAG 2.1 AA aligned, have text alternatives for analytical meaning, and preserve focus order/accessible names. [Source: `_bmad-output/planning-artifacts/prd.md#Accessibility`]

### Current Code State and Required Updates

- `src/features/import/confirm-import.ts` currently creates canonical dataset columns from confirmed previews and hard-codes `semanticRole: 'unassigned'`, `unit: null`, and `status: 'confirmed'`. Extend this seeding path; do not bypass the confirmed dataset requirement.
- `src/schemas/workspace/workspace-snapshot.ts` currently models dataset columns with `columnId`, `sourceName`, `dataType`, `semanticRole`, `unit`, and `status`. It lacks editable `label`, structured `measurementContext`, and dataset-level context; Story 2.3 should add those canonical fields.
- `src/stores/workspace-kernel/reducers.ts` owns ledgered canonical mutation through validated snapshots. Add dedicated semantic reducers instead of using `replaceSnapshot()` casually; `replaceSnapshot()` can reset `datasetFileHandles` if handles are not passed.
- `src/features/import/store.ts` owns preview-only state and must not become a semantic editing store. Semantic edits belong in `WorkspaceKernel`.
- `src/features/import/workspace-import-route.tsx` is already large and owns import/repair/confirm races. Prefer creating `src/features/semantics/**` and mounting it from the route shell rather than expanding import-route responsibilities further.
- `src/app/router/shell-routes.tsx` hydrates/reuses cached `WorkspaceKernelStore`s for `/workspace` and `/workspace/:workspaceId`. Preserve hydration abort, persistence, and route gate behavior when adding the semantics panel.
- `src/features/workspace-persistence/reopen-workspace.ts` validates saved datasets/graphs and creates recovery datasets/graphs. Any new required semantic fields must be backfilled there and in fixtures so existing saved Story 2.2 workspaces do not fail reopen validation.
- `src/features/workspace-persistence/graph-catalog.ts` validates graph compositions against current dataset column `dataType` and role assignments. Semantic edits that change `dataType` or role compatibility must reuse or mirror this validation so active graphs do not silently become stale.

### Canonical Data Model Guidance

Recommended minimal v1 shape for `WorkspaceSnapshot.datasets[].columns[]`:

```ts
{
  columnId: string;
  sourceName: string; // immutable imported header/provenance
  label: string; // editable graph/stat/export display label
  dataType: 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'datetime';
  semanticRole: 'unassigned' | 'x' | 'y' | 'color' | 'size' | 'facetRow' | 'facetColumn';
  unit: string | null;
  measurementContext: {
    quantity?: string;
    method?: string;
    condition?: string;
    notes?: string;
  } | null;
  description?: string | null;
  status: 'inferred' | 'confirmed' | 'rejected';
}
```

Use this as guidance, not a license to overbuild. If implementation chooses a slightly different field split, it must still satisfy AC1 and keep `sourceName` immutable while exposing editable label, units, and measurement context.

Dataset-level context guidance:

```ts
{
  displayName: string; // existing dataset title
  datasetContext: {
    description?: string;
    measurementNotes?: string;
    sourceDescription?: string;
  } | null;
}
```

`displayName` should remain the title used by existing import/persistence code. `datasetContext` should carry explanatory metadata; default it to `null` or an empty optional object consistently in confirm, bootstrap, recovery, and reopen-backfill paths.

### Architecture Compliance

- Browser-local `WorkspaceSnapshot` remains the system of record; no server API may accept datasets, workspace snapshots, formulas, semantic metadata, or graph payloads. [Source: `_bmad-output/planning-artifacts/architecture.md#Data Architecture`; `_bmad-output/planning-artifacts/architecture.md#Architectural Boundaries`]
- `WorkspaceKernel` owns canonical analytical state. UI-only state may track draft form inputs, but committed semantic changes must flow through named kernel commands and validated reducers. [Source: `_bmad-output/planning-artifacts/architecture.md#State management`; `_bmad-output/planning-artifacts/architecture.md#State management patterns`]
- Append-only ledger entries are required for committed semantic changes; events are facts, not commands. [Source: `_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-06-workspace-ledger-event-taxonomy.md`]
- Semantic issues must use the shared `IssueRecord` contract so Repair Card, readiness, and future export gates consume the same facts. [Source: `_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-07-issue-record-contract.md`]
- Keep graph state BMAD-owned and renderer-free. Semantic edits may prepare graph role/default metadata, but must not persist raw Vega-Lite, Vega, or ECharts artifacts. [Source: `_bmad-output/planning-artifacts/implementation-kickoff-decisions.md#Graphing / rendering library decision`; `_bmad-output/planning-artifacts/core-graph-catalog.md#BMAD Graph Definition Implications`]

### UX Requirements

- Semantic correction should be a confidence-first, inline workflow. Avoid modal-heavy correction for routine editable fields. [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Feedback Patterns`; `_bmad-output/planning-artifacts/ux-design-specification.md#Form Patterns`]
- Forms require explicit labels, helper text, inline validation adjacent to the field, early local validation, visible focus, and keyboard completion. [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Form Patterns`; `_bmad-output/planning-artifacts/ux-design-specification.md#Accessibility Strategy`]
- Semantic role assignment must have full keyboard alternatives; drag-and-drop cannot be required. [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Semantic Role Dock`; `_bmad-output/planning-artifacts/prd.md#Accessibility`]
- Feedback must answer what happened, why it matters, and what can be done next. Semantic conflicts should appear inline next to the affected column/context. [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Feedback rules`]
- The graph-ready summary should support David's guided workflow and Priya's dense inspection workflow without creating separate state models. [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Core User Experience`; `_bmad-output/planning-artifacts/ux-design-specification.md#Component Strategy`]

### Performance and Privacy Guardrails

- Semantic overrides that affect active graph/summary consumers should meet the NFR2 1-second target on approved benchmark datasets or show visible in-progress feedback if future recomputation becomes expensive. [Source: `_bmad-output/planning-artifacts/prd.md#Performance`; `_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-11-benchmark-fixture-inventory-and-graph-performance-gates.md`]
- Do not log raw dataset values, formulas, or workspace blobs in telemetry or console diagnostics. [Source: `_bmad-output/planning-artifacts/architecture.md#Data protection rules`; `_bmad-output/planning-artifacts/prd.md#Security & Data Handling`]
- Do not introduce a `semantics.worker.ts` unless validation or recomputation becomes demonstrably expensive; simple metadata edits can remain kernel-owned and synchronous. If a worker is added, use correlation IDs and workspace version stamps.

### Previous Story Intelligence

- Story 2.1 established preview-only import state, worker parsing, stale-message protections, picker cancellation handling, partial-preview signaling, and clean benchmark ownership verification. Do not regress these when adding semantic UI to the workspace route.
- Story 2.2 established the preview-to-confirm boundary, dirty repair selections, confirm/reject UI, persistence rollback on failed confirm, source-file handle validation, and canonical import ledger events. Build semantic edits on confirmed canonical datasets only.
- Repeated Story 2.2 review loops found race failures around stale callbacks, route unmounts, confirm/reject concurrency, hydration retries, file-handle provenance, and persistence rollback. Treat those as regression hotspots.
- Current worktree contains unrelated BMAD skill/workflow modifications. Do not touch or revert `.agents/**`, `_bmad/custom/**`, or the deleted `Zone.Identifier` file while implementing this story unless explicitly instructed.

### Git Intelligence

- Recent commits show Story 2.2 was completed after many targeted review-finding passes; implementation should be incremental, well-tested, and avoid broad rewrites of import or persistence seams.
- Recent app code changed heavily around `src/features/import/**`, `src/features/workspace-persistence/**`, `src/app/router/shell-routes.tsx`, and `src/stores/workspace-kernel/**`. Read these files before editing; the latest behavior is more important than older planning assumptions.
- Commit history also shows BMAD workflow updates; keep story implementation scoped to app/source/tests/story artifacts.

### Library and Framework Requirements

- Stay on the repo's current dependency baseline unless a blocking defect forces a separately approved change: React 19.2.5, React Router 7.14.1, Zustand 5.0.12, Zod 4.3.6, Vite 8.0.8, Vitest 4.1.4, Playwright 1.59.1, Node >=24. [Source: `package.json`]
- Use the existing vanilla Zustand store pattern (`createStore` from `zustand/vanilla`) and immutable updates. Zustand v5.0.12 docs show replacing nested objects/arrays with new objects and using `subscribe`/selectors rather than mutating in place. [Source: Context7 `/pmndrs/zustand/v5.0.12` docs for `create-store`]
- Do not add a second state-management library or React Query for this story. Architecture downgraded React Query from baseline and uses direct service calls plus local store coordination. [Source: `_bmad-output/planning-artifacts/architecture.md#Validation Refinements from Critical Review`]
- Use Zod schemas as the boundary for persisted semantic contract changes and update tests with every schema expansion.

### File Structure Requirements

- Prefer new semantic feature files under `src/features/semantics/`:
  - `index.ts`
  - `WorkspaceSemanticsPanel.tsx`
  - `semantic-model.ts` or `semantic-options.ts`
  - `semantic-validation.ts`
  - colocated `*.spec.ts` / `*.spec.tsx`
- Update existing canonical infrastructure only where needed:
  - `src/schemas/workspace/workspace-snapshot.ts`
  - `src/schemas/workspace/index.ts`
  - `src/stores/workspace-kernel/types.ts`
  - `src/stores/workspace-kernel/reducers.ts`
  - `src/stores/workspace-kernel/store.ts`
  - `src/stores/workspace-kernel/selectors.ts`
  - `src/domain/trust/selectors.ts`
  - `src/app/router/shell-routes.tsx`
  - `src/features/import/confirm-import.ts`
- Do not place generated/exported runtime artifacts beside source code.
- Do not create new top-level routes unless an architecture update explicitly expands the canonical route inventory.

### Testing Requirements

- Run all Node-family commands through the Linux Node wrapper: `bash ./scripts/with-node.sh ...`. [Source: `project-context.md#Node Runtime Policy`]
- Minimum targeted tests before broad validation:
  - `bash ./scripts/with-node.sh npm test -- src/stores/workspace-kernel/workspace-kernel.spec.ts`
  - `bash ./scripts/with-node.sh npm test -- src/features/semantics` (or exact new semantic spec files)
  - `bash ./scripts/with-node.sh npm test -- src/app/router/shell-routes.spec.tsx src/app/router/shell-routes-hydration.spec.ts`
  - `bash ./scripts/with-node.sh npm test -- src/features/import/workspace-import-route.spec.ts`
- Full validation expected before marking implementation complete:
  - `bash ./scripts/with-node.sh npm run typecheck`
  - `bash ./scripts/with-node.sh npm test`
  - `bash ./scripts/with-node.sh npm run lint`
  - `bash ./scripts/with-node.sh npm run build`
  - `bash ./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts`
- Existing Playwright config is constrained for WSL stability; do not increase worker count as part of this story.

### Regression Traps to Prevent

- Do not mutate an unconfirmed preview into canonical state.
- Do not store committed semantic changes only in React component state or the import preview store.
- Do not overwrite `sourceName` when the user edits the label.
- Do not drop `dataset.sourceFile` or `datasetFileHandles` during semantic updates.
- Do not use `replaceSnapshot()` for semantic edits unless existing file handles are explicitly preserved.
- Do not remove or rewrite import-confirmed issues unless semantic validation intentionally reconciles them.
- Do not require re-import after semantic edits.
- Do not persist renderer specs or graph-library payloads as semantic metadata.
- Do not classify semantic incompleteness as success if the graph-ready summary should warn or block.

### References

- `_bmad-output/planning-artifacts/epic-2-stories.md` - Story 2.3 scope, acceptance criteria, and dependencies.
- `_bmad-output/planning-artifacts/epics.md` - Epic 2 objective and implementation emphasis.
- `_bmad-output/planning-artifacts/prd.md` - FR8-FR14, FR58, NFR11-NFR14, privacy and performance constraints.
- `_bmad-output/planning-artifacts/architecture.md` - canonical workspace, state management, module boundaries, worker, testing, and route constraints.
- `_bmad-output/planning-artifacts/ux-design-specification.md` - semantic chips, form patterns, feedback patterns, accessibility, and graph-ready workflow expectations.
- `_bmad-output/planning-artifacts/implementation-kickoff-decisions.md` - graph runtime boundary, route constants, workspace snapshot, ledger, issue, and telemetry contracts.
- `_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-05-workspace-snapshot-schema-v1.md` - canonical snapshot requirements.
- `_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-06-workspace-ledger-event-taxonomy.md` - ledger event invariants.
- `_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-07-issue-record-contract.md` - shared issue schema requirements.
- `_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-11-benchmark-fixture-inventory-and-graph-performance-gates.md` - benchmark scenario names and NFR gates.
- `_bmad-output/planning-artifacts/core-graph-catalog.md` - graph role vocabulary, MVP families, and blocked combinations.
- `_bmad-output/implementation-artifacts/2-1-import-csv-excel-and-pasted-data-into-a-preview-workspace.md` - preview/import guardrails and review learnings.
- `_bmad-output/implementation-artifacts/2-2-resolve-import-uncertainty-and-data-quality-issues-before-commit.md` - confirmed-import contract, dirty repair flow, persistence, and file-handle guardrails.
- `project-context.md` - Linux Node wrapper policy.
- `package.json` - current dependency and script baseline.
- `src/features/import/confirm-import.ts` - current confirmed dataset seeding.
- `src/features/import/workspace-import-route.tsx` - current workspace import route and confirm/persistence orchestration.
- `src/schemas/workspace/workspace-snapshot.ts` - current canonical workspace schema.
- `src/stores/workspace-kernel/reducers.ts` - current ledgered kernel mutation patterns.
- `src/app/router/shell-routes.tsx` - workspace hydration and route mounting.
- `src/features/workspace-persistence/reopen-workspace.ts` - saved workspace validation, recovery dataset/graph creation, and reopen issue generation.
- `src/features/workspace-persistence/graph-catalog.ts` - current graph composition validation against dataset column types and role assignments.

## Checklist Validation Notes

- Prevents wheel reinvention by requiring reuse of `WorkspaceKernel`, `IssueRecord`, existing route hydration, and existing persistence boundaries.
- Prevents wrong libraries by retaining the existing React/Zustand/Zod/Vite baseline and explicitly disallowing new state/query libraries.
- Prevents wrong file locations by defining `src/features/semantics/**` plus exact canonical UPDATE files.
- Prevents regressions by documenting Story 2.1/2.2 race, persistence, source-handle, and preview/confirm traps.
- Prevents UX omissions by carrying semantic form, feedback, graph-ready summary, and keyboard/WCAG requirements directly into tasks.
- Prevents vague implementation by defining minimum canonical fields, commands, reducer behavior, issue semantics, and test expectations.

## Residual Assumptions / Saved Questions

- No user clarification is required before implementation. The exact `measurementContext` nested field names may be refined during implementation as long as AC1/FR58 are satisfied and persisted canonically.
- The recommended `semanticRole` enum follows current planning/example graph-role vocabulary. If the team wants broader analytical roles such as `measure`, `dimension`, or `identifier`, update schema/tests deliberately and preserve graph-role compatibility for Epic 4.

## Story Completion Status

Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
