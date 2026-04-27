# Story 2.3: Edit Semantic Roles, Types, Units, and Dataset Context

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to inspect and adjust each imported column's meaning,
so that downstream graphs, stats, and exports use the correct analytical semantics.

## Acceptance Criteria

1. Given an imported dataset is active, when the user inspects a column, then type, role, label, units, and measurement context are visible and editable.
2. Given the user selects or changes a column data type after import, when the semantic edit is validated, then the selected type is checked against the column's actual committed values and incompatible selections are surfaced as issue-backed semantic validation feedback before the choice is treated as graph-ready.
3. Given a semantic edit is committed, when downstream analytical state recalculates, then active graph and summary consumers use the updated semantics without requiring re-import.
4. Given the dataset is graph-ready, when the user views the working context, then the active semantic choices are summarized clearly before graphing begins.

## Dependencies

- Story 2.2: Resolve Import Uncertainty and Data-Quality Issues Before Commit.
- Existing confirmed-import path through `WorkspaceKernel`, IndexedDB persistence, dataset file-handle metadata, and canonical `WorkspaceSnapshot` validation.
- Foundational contract decisions from implementation kickoff ADRs: workspace snapshot v1, append-only ledger, shared issue record, benchmark gates, and BMAD graph-definition boundary.

## Contract Boundaries

- In scope: canonical semantic metadata for confirmed datasets; editable column type, analytical role, display label, units, measurement context, and dataset context; graph-ready semantic summary; semantic edit persistence/reopen; readiness/issue integration for invalid or incomplete semantics; value-backed validation that checks post-import semantic data type selections against committed column values; keyboard-accessible semantic editing UI.
- Out of scope: import parsing and data-quality repair beyond consuming the confirmed dataset; broad guided onboarding/recovery copy owned by Story 2.4; transform/formula authoring owned by Epic 3; graph generation/role dock rendering owned by Epic 4; review/export/handoff flows owned by later epics; any server-side dataset or workspace API.
- Owning paths: `src/features/semantics/**` (new), `src/schemas/workspace/**`, `src/stores/workspace-kernel/**`, `src/domain/trust/**`, `src/domain/readiness/**` if needed, `src/app/router/shell-routes.tsx`, `src/features/import/confirm-import.ts`, `tests/e2e/import.spec.ts`, and colocated unit/component specs.
- Downstream consumers after completion: Story 2.4 layers guidance onto semantic correction and data-type mismatch recovery surfaces; Epic 3 transforms and formulas consume the canonical dataset semantics; Epic 4 graph authoring consumes semantic role/type/label/unit metadata for first graph generation and graph validation; Epic 5 review/export surfaces consume the same metadata for defensibility.

## Tasks / Subtasks

- [x] Extend canonical workspace semantic contracts. (AC: 1, 3, 4)
  - [x] Update `src/schemas/workspace/workspace-snapshot.ts` (or add an adjacent exported schema file) so dataset columns include immutable `sourceName` plus editable `label`, `dataType`, `semanticRole`, `unit`, `measurementContext`, optional `description`, and existing `status`.
  - [x] Keep `sourceName` as provenance from import; use `label` as the user-editable display name that future graphs, summaries, and exports consume.
  - [x] Add dataset-level context metadata without duplicating `displayName`: keep `displayName` as the dataset title and add a `datasetContext` (or equivalent) object for description, measurement-context notes, and graph-ready context summary inputs.
  - [x] Seed defaults in `src/features/import/confirm-import.ts`: `label = sourceName`, `semanticRole = 'unassigned'`, `unit = null`, `measurementContext = null`, `description = null` or omitted, and existing inferred `dataType`.
  - [x] Update bootstrap, recovery, fixtures, and reopen/backfill paths so new required semantic fields do not break existing saved workspaces or Story 2.2 persisted import workspaces.
- [x] Add WorkspaceKernel semantic mutation commands. (AC: 3)
  - [x] Add typed inputs/commands in `src/stores/workspace-kernel/types.ts` for column semantic edits and dataset context edits, including `KernelMutationMeta`.
  - [x] Implement reducers in `src/stores/workspace-kernel/reducers.ts` that immutably update only the targeted dataset/column/context, validate through `workspaceSnapshotSchema`, append compact ledger entries, and preserve rows, source file metadata, `datasetFileHandles`, graph definitions, and existing issues unless explicitly reconciled.
  - [x] Wire commands through `src/stores/workspace-kernel/store.ts` and add selectors in `src/stores/workspace-kernel/selectors.ts` for active dataset, dataset columns, and graph-ready semantic summary if the UI needs them.
  - [x] Use event names as dotted, past-tense facts such as `dataset.column-semantics.updated` and `dataset.context.updated`.
  - [x] When semantic validation creates or resolves issues, reconcile only `semantics.*` issues for the targeted dataset/column/context and preserve import, reopen, graph, persistence, and unrelated repair issues.
- [x] Build the semantic editing feature surface. (AC: 1, 4)
  - [x] Create `src/features/semantics/` with a `WorkspaceSemanticsPanel` (or equivalent) and barrel export from `src/features/semantics/index.ts`.
  - [x] Render the panel from `src/app/router/shell-routes.tsx` within the existing `/workspace` and `/workspace/:workspaceId` flow after the kernel store has hydrated; do not add new routes unless architecture is updated.
  - [x] Show all confirmed dataset columns with editable type, semantic role, label, unit, and measurement context; include the active dataset-level context editor.
  - [x] Provide a clear graph-ready summary that lists active semantic choices before graphing begins, including unresolved missing roles/context and any confirmed units/labels.
  - [x] Keep import preview/repair state separate. The semantic panel edits only confirmed canonical datasets, not unconfirmed previews.
- [x] Add baseline semantic validation, readiness, and issue integration. (AC: 1, 3, 4)
  - [x] Validate enum-supported data type/role, label, unit, and measurement context locally before commit; invalid or incomplete graph-ready state should create/update shared `IssueRecord`s, not ad hoc UI-only errors.
  - [x] Reuse `contextRef.routeKey = 'workspaceDetail'` and route issues to exact dataset/column context. If `IssueRecord.contextRef` is not extended, use `source.entityType = 'dataset-column'`, `source.entityId = <columnId>`, and include `datasetId`, `columnId`, and field name in diagnostics/repair action args.
  - [x] Add `dataset-column` and dataset-context scope labels to `src/domain/trust/selectors.ts` so repair/readiness surfaces do not show generic or misleading scope labels.
  - [x] Ensure readiness summaries and repair entry points reflect unresolved semantic issues through existing issue/readiness selectors.
  - [x] Do not block all exploration on incomplete optional metadata; distinguish blocking graph-readiness conflicts from warnings for missing optional context.
- [x] Propagate semantic edits to graph/readiness consumers. (AC: 3)
  - [x] Revalidate existing `graphDefinitions` that reference edited columns using the existing graph catalog validation path (`src/features/workspace-persistence/graph-catalog.ts`) or an equivalent shared helper.
  - [x] If a data type or semantic role edit makes an existing graph composition invalid, preserve the last valid graph definition, mark the graph stale or attach a graph/readiness `IssueRecord`, and keep valid unaffected state usable.
  - [x] Keep graph role assignments by stable `columnId`; do not rewrite assignments to labels or source names.
  - [x] Ensure the semantic summary and any active graph/readiness selectors read the committed semantic fields immediately after commit without requiring re-import.
- [x] Preserve schema evolution and reopen compatibility. (AC: 3)
  - [x] Update `src/features/workspace-persistence/reopen-workspace.ts`, recovery dataset/graph creation, workspace fixtures, and reopen tests to backfill defaults for legacy columns missing new semantic fields.
  - [x] Ensure `createImportWorkspaceSnapshot()` bootstrap data and any recovery dataset satisfy the expanded workspace schema.
  - [x] Add reopen/migration tests proving Story 2.2 saved workspaces and benchmark workspace fixtures hydrate successfully after the semantic schema expansion.
- [x] Persist semantic commits and preserve reopen behavior. (AC: 3)
  - [x] Save committed semantic edits through the existing workspace persistence boundary, not by writing directly to IndexedDB or local storage from UI components.
  - [x] On persistence failure, keep the user informed and avoid presenting the edit as durable; preserve prior valid canonical state and file handles.
  - [x] Verify reload/reopen restores edited type, role, label, unit, measurement context, dataset context, and graph-ready summary from the canonical workspace.
- [ ] Add value-backed semantic data type validation against committed column values. (AC: 2)
  - [ ] Define a shared validator that checks a proposed semantic `dataType` against the confirmed dataset's committed rows for the target column, reusing Story 2.2 import typing/repair semantics where possible rather than relying only on enum membership.
  - [ ] For incompatible selections, create or update a shared semantic `IssueRecord` scoped to the exact dataset column with diagnostics that include the proposed type, incompatible value count or sample references, and a repair action that returns the user to that column's data type control.
  - [ ] Keep valid prior canonical semantics and downstream graph/readiness state usable when a proposed type is incompatible; do not mark the column graph-ready solely because the selected value is one of the allowed enum options.
  - [ ] Reflect type/value incompatibility in the semantic panel and graph-ready summary before downstream graphing begins, with accessible error/warning text that distinguishes incompatible data values from optional missing context.
  - [ ] Preserve reload/reopen behavior so existing value-backed type mismatch issues are regenerated or reconciled from committed rows and do not disappear after persistence round-trips.
  - [ ] Add unit, component, integration, and e2e coverage proving invalid post-import data type selections are rejected or issue-backed, valid selections persist, and existing Story 2.1/2.2 import repair behavior remains unchanged.
- [x] Add unit, component, integration, and e2e coverage. (AC: 1, 3, 4)
  - [x] Add schema tests proving new semantic fields parse, reject invalid data, and preserve backward-compatible confirmed-import defaults.
  - [x] Add kernel tests proving semantic reducers update one column/context, append ledger entries, preserve source file handles and imported rows, and reconcile issue/readiness state.
  - [x] Add component tests for keyboard-editable semantic controls, accessible labels/helper/error text, and graph-ready summary updates.
  - [x] Extend `tests/e2e/import.spec.ts` to confirm an import, edit semantics, reload/reopen, assert persistence, and prove no re-import is required for the semantic summary to update.
  - [x] Preserve existing Story 2.1/2.2 clean and dirty import acceptance coverage.

### Review Follow-ups (AI)

- [ ] [Requirements-Correction][P2] Validate semantic data type selections against committed column values — `src/features/semantics/**`, `src/stores/workspace-kernel/**`, `src/features/import/**`, `src/features/workspace-persistence/**` — Story 2.3 should have required value-backed validation for post-import data type edits; the current implementation only validates enum membership, so users can select `date`, `number`, etc. for columns whose committed values cannot support that semantic type.
- [x] [AI-Review][P2] Guard rebased semantic rollback graph restoration to graphs carrying semantic issues — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — `rebuildGraphSemanticRollbackState()` can restore any same-dataset stale graph with no nonsemantic issue IDs to `reference`/`candidate` during failed semantic-save rollback even when the graph was stale for an external issue-free reason, bypassing the prior-pass semantic-issue guard.
- [x] [AI-Review][P3] Recheck reopen graph status after orphan issue IDs are filtered — `src/features/workspace-persistence/reopen-workspace.ts` — Reopen semantic-clear restoration can skip candidate/reference recovery when a legacy graph has orphan nonsemantic issue IDs, then final issue filtering removes those IDs and leaves an issue-free stale graph with no repair path.
- [x] [AI-Review][P2] Restore graph status when semantic conflicts are cleared — `src/stores/workspace-kernel/reducers.ts`, `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Semantic graph revalidation removes semantic issue IDs when blocked reasons clear, but returns the existing graph status; a graph previously marked `stale` by a semantic conflict can remain stale with no remaining semantic issue or repair path after the user fixes the semantics.
- [x] [AI-Review][P3] Keep graph-ready semantic summary selectors scoped to confirmed datasets — `src/stores/workspace-kernel/selectors.ts` — The public `graphReadySemanticSummary()` selector passes the active dataset directly to `createSemanticSummary()`, so non-panel consumers can surface import-preview placeholder semantics despite the confirmed-dataset boundary.
- [x] [AI-Review][P3] Exclude recovery placeholder datasets from semantic issue/editing flows — `src/features/workspace-persistence/reopen-workspace.ts`, `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Reopen semantic generation and the panel treat any non-import-preview dataset, including `sourceKind: 'recovery'`, as semantic-editable, allowing recovery placeholders to receive semantic missing-context issues and appear as confirmed canonical data.
- [x] [AI-Review][P2] Avoid over-promoting unrelated stale graphs when semantic conflicts clear — `src/stores/workspace-kernel/reducers.ts` — `restoreGraphStatusAfterSemanticClear()` restores any stale graph with no non-semantic issue IDs to `reference`/`candidate`; a graph that was stale for an external issue-free reason can be silently made graph-ready by an unrelated semantic edit.
- [x] [AI-Review][P2] Restore reopen graph status after regenerated semantic conflicts clear — `src/features/workspace-persistence/reopen-workspace.ts` — `createReopenSemanticState()` strips semantic issue IDs when reopened graph semantic validation has no blocked reasons, but returns the validated graph status without restoring stale candidate/reference state, leaving an issue-free stale graph and no semantic repair path.
- [x] [AI-Review][P3] Preserve a generic repair issue for recovery-dataset graph catalog failures — `src/features/workspace-persistence/reopen-workspace.ts` — Reopen diverts semantic catalog failures for every non-`import-preview` dataset, including `sourceKind: 'recovery'`, but later semantic issue generation excludes recovery datasets, so a recovery placeholder graph can become stale without a generic reopen repair issue.
- [x] [AI-Review][P3] Allow immediate column save before draft hydration uses the rendered fallback draft — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — The render path displays a fallback `createColumnSemanticDraft(column)` while `saveColumn()` reads only `columnDrafts[columnId]`, so a fast save before the effect seeds drafts reports “Column semantics are not ready to save.”
- [x] [AI-Review][P3] Remove unrelated Zone.Identifier deletion from the story diff — `.agents/skills/mermaid-expert/SKILL.mdZone.Identifier` — The working tree includes a tracked deletion outside the story File List and explicitly out of scope per Dev Notes.
- [x] [AI-Review][P2] Preserve failed-save rollback semantics for later partial same-column commands — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/stores/workspace-kernel/reducers.ts` — Column semantic ledger payloads record full next-column state, so rollback can mistake a later partial same-column command for deliberate retention of unrelated failed optimistic fields and keep non-durable values live after persistence failure.
- [x] [AI-Review][P3] Avoid replaceSnapshot rollback side effects when overlapping semantic ownership is rejected before mutation — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/features/workspace-persistence/workspace-kernel-persistence-state.ts` — A remounted/second panel correctly cannot overwrite the first pending semantic-save owner, but the catch path still runs rollback despite no mutation being applied, which can reset kernel ephemeral state such as pending worker requests.
- [x] [AI-Review][P3] Preserve a generic reopen repair issue for import-preview graph catalog failures — `src/features/workspace-persistence/reopen-workspace.ts` — Import-preview datasets are correctly skipped for semantic issue regeneration, but a preview graph with semantic-catalog type failures can be marked stale with no generic repair issue, leaving the placeholder graph state harder to recover.
- [x] [AI-Review][P2] Guard overlapping semantic owner saves from persisting rolled-back optimistic edits — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/features/workspace-persistence/workspace-kernel-persistence-state.ts`, `src/features/workspace-persistence/save-workspace.ts` — Store-level pending semantic ownership can be overwritten by a second semantic save owner from another panel instance/remount, allowing the second save to persist a snapshot that still contains the first failed optimistic semantic mutation before rollback completes.
- [x] [AI-Review][P3] Show missing semantic summary gaps with column names instead of counts/raw IDs — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/features/semantics/semantic-model.ts` — The graph-ready summary lists assigned roles but reports missing roles/context as counts and raw semantic issue IDs, making unresolved pre-graph gaps less clear than AC3 intends.
- [x] [AI-Review][P2] Skip import-preview datasets during reopen graph semantic regeneration — `src/features/workspace-persistence/reopen-workspace.ts` — `createReopenSemanticState()` filters preview datasets for column/context semantic issues, but graph semantic regeneration builds `datasetById` from all datasets and can still attach `semantics.graph.composition-invalid` to graphs referencing import-preview placeholder datasets.
- [x] [AI-Review][P3] Preserve later all-blank dataset-context clears during failed-save rollback — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — The dataset-context rollback rebase detects later retained clears only when another field changed or the later previous value differed; a later durable no-op/all-blank context mutation can still have the old context value restored.
- [x] [AI-Review][P3] Surface missing optional semantic context as warning-level readiness feedback — `src/stores/workspace-kernel/reducers.ts`, `src/features/workspace-persistence/reopen-workspace.ts`, `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Missing column/dataset context issues are emitted with `severity: 'info'`, so optional-context warnings may not appear in readiness warning counts even though the story calls for warning/non-blocking context feedback.
- [x] [AI-Review][P2] Rebase failed dataset-context rollback over later context mutations — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Intervening-version rollback rebases column semantic saves, but dataset-context rollback restores `previousDataset.datasetContext` wholesale and can erase a later valid dataset context mutation.
- [x] [AI-Review][P3] Preserve rollback-regenerated graph semantic issue state only when diagnostics still match — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — The rollback graph regeneration path preserves existing graph semantic issue `status` and `detectedAt` by issue ID without comparing regenerated blocked reasons or affected columns.
- [x] [AI-Review][P3] Preserve nonsemantic catalog diagnostics when reopen has mixed graph failures — `src/features/workspace-persistence/reopen-workspace.ts` — Reopen diverts mixed semantic data-type and catalog graph failures into semantic regeneration, then filters to quantitative/temporal reasons and can drop simultaneous nonsemantic catalog reasons.
- [x] [AI-Review][P3] Preserve later deliberate same-column reapplication of failed values during rollback — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Same-column rollback preserves a failed value only when the later mutation's previous value was already the failed value, so a later change away and back to that value can still be reverted.
- [x] [AI-Review][P2] Preserve handleless source-file provenance in mixed-handle semantic save and rollback — `src/features/workspace-persistence/save-workspace.ts`, `src/services/persistence/repositories/workspace-repository.ts`, `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/stores/workspace-kernel/reducers.ts`, `src/stores/workspace-kernel/dataset-file-handle-metadata.ts` — When any live file handle exists, semantic save/rollback can pass a partial handle list into source-file synchronization and remove `dataset.sourceFile` from reopened datasets that retain source metadata but have no live handle.
- [x] [AI-Review][P2] Route data-type graph invalidation issues to affected columns — `src/features/workspace-persistence/graph-catalog.ts`, `src/stores/workspace-kernel/reducers.ts`, `src/stores/workspace-kernel/workspace-kernel.spec.ts` — Data-type graph validation returns only blocked reason strings, so semantic data-type conflicts create graph-only repair actions/diagnostics instead of exact dataset-column semantic repair scope.
- [x] [AI-Review][P2] Flag every conflicting graph role for multi-role column assignments — `src/stores/workspace-kernel/reducers.ts`, `src/features/workspace-persistence/reopen-workspace.ts` — Graph semantic validation groups assignments by column and accepts the column if its semantic role appears anywhere in the assigned roles, leaving another role on the same column unflagged.
- [x] [AI-Review][P2] Rebase failed semantic-save rollback without clobbering intervening same-column edits — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Rollback after an intervening workspace-version change replaces the entire target column with the pre-save column, which can erase a later valid semantic mutation to that same column.
- [x] [AI-Review][P3] Preserve current unresolved semantic issue repair state on reopen — `src/features/workspace-persistence/reopen-workspace.ts` — Filtering all persisted `semantics.*` issues prevents stale/resolved issue resurrection, but also resets current open/deferred status and `detectedAt` for still-current semantic issues on reopen.
- [x] [AI-Review][P2] Reconcile regenerated reopen semantic issues instead of preserving stale/resolved persisted ones — `src/features/workspace-persistence/reopen-workspace.ts` — Reopen currently deduplicates by existing issue ID and appends regenerated semantic issues, which can suppress current gaps when a persisted issue is resolved and can leave stale/old-format semantic issue IDs visible or readiness-blocking after migration.
- [x] [AI-Review][P2] Preserve newer same-graph semantic conflicts during failed-save rollback — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/stores/workspace-kernel/reducers.ts` — Graph semantic issue IDs are shared per dataset/graph, so rollback for column A can remove a later issue that also contains column B and restore only the previous target-owned state.
- [x] [AI-Review][P2] Preserve handleless source-file provenance during exact-version semantic rollback — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/stores/workspace-kernel/reducers.ts`, `src/stores/workspace-kernel/dataset-file-handle-metadata.ts` — Failed semantic saves with no intervening workspace-version change pass the current empty handle list into `replaceSnapshot`, causing synchronization to delete reopened `dataset.sourceFile` metadata.
- [x] [AI-Review][P2] Invalidate incompatible graph compositions after data-type semantic edits — `src/stores/workspace-kernel/reducers.ts`, `src/features/workspace-persistence/graph-catalog.ts` — Data type edits revalidate graphs, but scatter/line/bar catalog validation only checks role presence, so a graph-assigned quantitative column changed to string can remain non-stale and issue-free.
- [x] [AI-Review][P2] Rebase failed semantic-save rollback without deleting later same-dataset graph semantic state — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — `isTargetRollbackIssue()` treats all dataset graph semantic issues as part of the failed save target, so rollback after an intervening same-dataset semantic/graph mutation can erase newer graph/readiness issues.
- [x] [AI-Review][P2] Preserve source-file provenance during semantic saves after reopen with missing handles — `src/features/workspace-persistence/save-workspace.ts`, `src/features/semantics/WorkspaceSemanticsPanel.tsx` — A semantic save can synchronize `dataset.sourceFile` to `null` when a reopened workspace still has source metadata but no live persisted file handle.
- [x] [AI-Review][P2] Generate semantic readiness issues for legacy semantic backfill on reopen — `src/features/workspace-persistence/reopen-workspace.ts`, `src/stores/workspace-kernel/reducers.ts` — Unsupported legacy roles/context are normalized to `unassigned`/`null`, but reopen does not reconcile semantic issues/readiness for those graph-readiness gaps.
- [x] [AI-Review][P2] Route graph semantic repair actions to the affected semantic/graph scope — `src/stores/workspace-kernel/reducers.ts` — Graph semantic issues caused by column role conflicts currently receive an “Edit dataset context” repair action before the graph inspection action, which can misdirect readiness repair.
- [x] [AI-Review][P3] Preserve version-neutral file-handle refreshes when exact-version semantic rollback runs — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/stores/workspace-kernel/reducers.ts` — If dataset file handles are refreshed while a semantic save is pending but `workspaceVersion` is unchanged, failed-save rollback restores the older handle list.
- [x] [AI-Review][P1] Preserve structured measurement context on column saves — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/features/semantics/semantic-model.ts` — Saving an unrelated semantic field can collapse structured measurement metadata into a single notes string.
- [x] [AI-Review][P1] Invalidate graph assignments when semantic roles conflict — `src/stores/workspace-kernel/reducers.ts` — Non-`unassigned` role mismatches can leave active graph/readiness consumers valid after a semantic role edit.
- [x] [AI-Review][P2] Create semantic issues immediately after confirmed import — `src/features/import/confirm-import.ts`, `src/stores/workspace-kernel/reducers.ts` — Initial unassigned roles and missing context are not represented in shared readiness/repair issues until a later semantic edit.
- [x] [AI-Review][P2] Include confirmed units in the graph-ready summary — `src/features/semantics/semantic-model.ts`, `src/features/semantics/WorkspaceSemanticsPanel.tsx` — The summary lists roles and labels but omits confirmed units required by AC3.
- [x] [AI-Review][P2] Normalize legacy semantic roles during reopen backfill — `src/features/workspace-persistence/reopen-workspace.ts`, `src/schemas/workspace/workspace-snapshot.ts` — Persisted roles accepted by the old non-empty-string contract can fail the new enum schema.
- [x] [AI-Review][P2] Serialize or guard overlapping semantic saves and rollbacks — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Double-click/repeated save can produce stale persistence failures and apparent success that reverts after reload.
- [x] [AI-Review][P2] Route semantic persistence through the existing boundary instead of constructing IndexedDB in the UI — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — The panel directly creates `IndexedDbWorkspaceStorage` despite the story persistence-boundary constraint.
- [x] [AI-Review][P2] Reconcile only targeted semantic issues plus directly affected graph issues — `src/stores/workspace-kernel/reducers.ts` — Any semantic edit removes/recreates all dataset semantic issues, resetting unrelated statuses/timestamps.
- [x] [AI-Review][P3] Treat empty context objects consistently — `src/schemas/workspace/workspace-snapshot.ts`, `src/stores/workspace-kernel/reducers.ts` — Empty context objects can suppress missing-context warnings without meaningful context.
- [x] [AI-Review][P3] Filter graph-ready summary issue IDs to semantic issues — `src/features/semantics/semantic-model.ts` — Non-semantic dataset issues can appear under “Open semantic issue IDs.”
- [x] [AI-Review][P3] Avoid resetting unsaved drafts on unrelated snapshot object changes — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Drafts reset when the confirmed dataset object identity changes.
- [x] [AI-Review][P3] Strengthen semantic ledger correlation IDs — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Timestamp-only correlation IDs can collide on rapid saves.
- [x] [AI-Review][P2] Report failed semantic saves when durable persistence is unavailable — `src/features/workspace-persistence/save-workspace.ts`, `src/features/semantics/WorkspaceSemanticsPanel.tsx` — `saveWorkspaceKernelToIndexedDb()` returns successfully when `indexedDB` is unavailable, allowing the panel to show saved messages even though no durable write occurred.
- [x] [AI-Review][P2] Preserve durability semantics when a semantic save aborts after an intervening mutation — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/features/workspace-persistence/save-workspace.ts` — If another kernel mutation changes the workspace version while semantic persistence is pending, rollback is skipped and the non-durable optimistic semantic edit can remain in live state until reload.
- [x] [AI-Review][P3] Reopen regenerated graph semantic issues when blocking reasons change — `src/stores/workspace-kernel/reducers.ts` — Stable graph issue IDs preserve deferred status/detectedAt even when a later semantic edit generates a different graph-blocking reason.
- [x] [AI-Review][P3] Normalize legacy semantic context shapes before strict reopen validation — `src/features/workspace-persistence/reopen-workspace.ts`, `src/schemas/workspace/workspace-snapshot.ts` — Backfill preserves unknown-but-nonempty context objects that the strict semantic context schema then rejects instead of whitelisting supported keys or coercing safely.
- [x] [AI-Review][P3] Use unambiguous semantic issue IDs for dotted identifiers — `src/stores/workspace-kernel/reducers.ts` — `semanticIssueId()` joins dotted dataset/column/graph identifiers with dots, which can collide for different valid identifier segment combinations.
- [x] [AI-Review][P2] Regenerate data-type graph semantic issues during reopen — `src/features/workspace-persistence/reopen-workspace.ts`, `src/features/workspace-persistence/graph-catalog.ts` — Reopen filters persisted `semantics.*` issues and converts catalog/data-type graph failures into generic `workspace.reopen.graph.incompatible-composition` issues, losing semantic issue IDs, affected-column repair actions, and graph-ready semantic routing after reload.
- [x] [AI-Review][P2] Rebase failed semantic rollback over later same-column edits that retain failed values — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/stores/workspace-kernel/reducers.ts` — Rollback compares each field only to the failed payload's next value, so a later same-column mutation can leave a failed value in place while changing another semantic field and still have that retained value reverted.
- [x] [AI-Review][P2] Remove generated semantic issues when confirm-import rollback is rebased after an intervening mutation — `src/features/import/workspace-import-route.tsx`, `src/stores/workspace-kernel/reducers.ts` — Confirm import now creates semantic issues, but the stale-save rollback path removes only canonicalized preview issue IDs, leaving orphaned semantic column/dataset/graph issues for a removed dataset.
- [x] [AI-Review][P3] Preserve graph semantic issue state only when regenerated diagnostics still match — `src/stores/workspace-kernel/reducers.ts`, `src/features/workspace-persistence/reopen-workspace.ts` — Stable graph semantic issue IDs can preserve deferred status/detectedAt when blocked reasons or affected columns change, hiding a new graph repair target behind old unresolved state.
- [x] [AI-Review][P2] Restore cleared dataset-context fields during rebased persistence rollback — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/features/semantics/semantic-model.ts`, `src/stores/workspace-kernel/reducers.ts` — When a failed dataset-context save clears a field or saves `null` and a later mutation advances `workspaceVersion`, rollback only iterates fields present in `payload.next`; omitted cleared fields are not restored from the prior durable context.
- [x] [AI-Review][P2] Regenerate rebased column semantic issues instead of restoring stale prior issues — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Rebased column rollback updates field values but then appends `previousTargetIssues` unchanged, so later same-column valid reapplications can retain stale missing-role or missing-context issues/readiness.
- [x] [AI-Review][P2] Skip restoring semantic rollback issues when the target dataset no longer exists — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/app/router/shell-routes.tsx` — If a semantic save fails after an intervening confirm-import rollback removes the dataset, rollback can append prior target semantic issues for the removed dataset and repollute readiness with orphan issues.
- [x] [AI-Review][P3] Preserve newer same-graph semantic repair state during rollback regeneration — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — `existingGraphIssuesById` can prefer older previous target graph issues over current same-ID graph issues, resetting newer matching status or `detectedAt`.
- [x] [AI-Review][P2] Preserve later deliberate dataset-context clears during failed-save rollback — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Rebased dataset-context rollback restores a prior field value when a later valid context mutation intentionally keeps that field cleared/omitted while changing another context field.
- [x] [AI-Review][P2] Keep nonsemantic graph catalog failures out of semantic graph issue regeneration — `src/stores/workspace-kernel/reducers.ts`, `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/features/workspace-persistence/graph-catalog.ts` — Live semantic graph revalidation merges all catalog blocked reasons into `semantics.graph.composition-invalid`, which can relabel unrelated graph/catalog repair failures as semantic repair issues.
- [x] [AI-Review][P3] Skip semantic reopen issue generation for import-preview placeholder datasets — `src/features/workspace-persistence/reopen-workspace.ts`, `src/stores/workspace-kernel/bootstrap.ts` — Reopen semantic diagnostics iterate all datasets and can create semantic context issues for preview placeholders instead of confirmed canonical datasets only.
- [x] [AI-Review][P3] Preserve unsaved column drafts when saving dataset context — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — The panel resets all column drafts when the dataset-context sync key changes, so saving dataset context can wipe unrelated in-progress column edits.
- [x] [AI-Review][P2] Prevent concurrent workspace saves from persisting a failed optimistic semantic edit — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/features/workspace-persistence/save-workspace.ts`, `src/features/import/workspace-import-route.tsx` — A non-semantic workspace save can start after a semantic optimistic mutation and persist that snapshot before the semantic save rolls back as stale, so reload can resurrect the semantic edit after the UI reported failure.
- [x] [AI-Review][P3] Guard kernel semantic reducers against import-preview datasets — `src/stores/workspace-kernel/reducers.ts` — The semantics panel filters preview datasets, but public kernel semantic commands still accept any dataset/column ID and can mutate import-preview placeholders if called by another consumer.

## Senior Developer Review (AI)

Outcome: Changes requested. Story and sprint status set to `in-progress` for implementation follow-up.

Review date: 2026-04-27

Severity counts: P2 = 1, P3 = 1, P1 = 0, P0 = 0. Dismissed = 0.

Reviewer-lane summary:
- Blind Hunter: completed; reviewed diff-only scope, verified requested prior-pass fixes where visible, and raised the rebased semantic rollback graph over-promotion gap.
- Edge Case Hunter: completed; inspected diff, story File List, and edge rollback/reopen paths, raised the same P2 rollback over-promotion gap plus a non-gating orphan-issue reopen caveat.
- Runtime Integration Auditor: completed; targeted semantics/kernel/reopen/save/import tests, typecheck, e2e semantic persistence probe, and browser reload probe passed with no findings.
- Acceptance Auditor: completed; AC1/AC2/AC3 coverage verified, with the P2 rollback over-promotion gap blocking AC2/downstream graph correctness.
- Required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build` all passed on 2026-04-27 during this review pass.

### Action Items

- [x] [AI-Review][P2] Guard rebased semantic rollback graph restoration to graphs carrying semantic issues — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — `rebuildGraphSemanticRollbackState()` can restore any same-dataset stale graph with no nonsemantic issue IDs to `reference`/`candidate` during failed semantic-save rollback even when the graph was stale for an external issue-free reason, bypassing the prior-pass semantic-issue guard.
- [x] [AI-Review][P3] Recheck reopen graph status after orphan issue IDs are filtered — `src/features/workspace-persistence/reopen-workspace.ts` — Reopen semantic-clear restoration can skip candidate/reference recovery when a legacy graph has orphan nonsemantic issue IDs, then final issue filtering removes those IDs and leaves an issue-free stale graph with no repair path.

---

Outcome: Changes requested. Story and sprint status set to `in-progress` for implementation follow-up.

Review date: 2026-04-27

Severity counts: P2 = 2, P3 = 3, P1 = 0, P0 = 0. Dismissed = 0.

Reviewer-lane summary:
- Blind Hunter: completed; verified requested prior-pass fixes where visible and raised live graph-status over-promotion plus reopen stale-status gaps.
- Edge Case Hunter: completed; verified requested prior-pass fixes and raised reopen stale-status, recovery graph repair, and fast-save draft hydration edge cases.
- Runtime Integration Auditor: completed; targeted tests, typecheck, e2e, and browser persistence probes passed with no findings.
- Acceptance Auditor: completed; AC1/AC2/AC3 coverage and requested prior-pass fixes verified, with one non-gating scope hygiene finding.
- Required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build` all passed on 2026-04-27 during this review pass.

### Action Items

- [x] [AI-Review][P2] Avoid over-promoting unrelated stale graphs when semantic conflicts clear — `src/stores/workspace-kernel/reducers.ts` — `restoreGraphStatusAfterSemanticClear()` restores any stale graph with no non-semantic issue IDs to `reference`/`candidate`; a graph that was stale for an external issue-free reason can be silently made graph-ready by an unrelated semantic edit.
- [x] [AI-Review][P2] Restore reopen graph status after regenerated semantic conflicts clear — `src/features/workspace-persistence/reopen-workspace.ts` — `createReopenSemanticState()` strips semantic issue IDs when reopened graph semantic validation has no blocked reasons, but returns the validated graph status without restoring stale candidate/reference state, leaving an issue-free stale graph and no semantic repair path.
- [x] [AI-Review][P3] Preserve a generic repair issue for recovery-dataset graph catalog failures — `src/features/workspace-persistence/reopen-workspace.ts` — Reopen diverts semantic catalog failures for every non-`import-preview` dataset, including `sourceKind: 'recovery'`, but later semantic issue generation excludes recovery datasets, so a recovery placeholder graph can become stale without a generic reopen repair issue.
- [x] [AI-Review][P3] Allow immediate column save before draft hydration uses the rendered fallback draft — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — The render path displays a fallback `createColumnSemanticDraft(column)` while `saveColumn()` reads only `columnDrafts[columnId]`, so a fast save before the effect seeds drafts reports “Column semantics are not ready to save.”
- [x] [AI-Review][P3] Remove unrelated Zone.Identifier deletion from the story diff — `.agents/skills/mermaid-expert/SKILL.mdZone.Identifier` — The working tree includes a tracked deletion outside the story File List and explicitly out of scope per Dev Notes.

---

Outcome: Changes requested. Story and sprint status set to `in-progress` for implementation follow-up.

Review date: 2026-04-27

Severity counts: P2 = 1, P3 = 2, P1 = 0, P0 = 0. Dismissed = 0.

Reviewer-lane summary:
- Blind Hunter: completed; verified requested prior-pass fixes and raised a gating graph-status restoration gap after semantic conflicts clear.
- Edge Case Hunter: completed; verified requested prior-pass fixes and raised two non-gating confirmed-dataset boundary edge cases for selectors and recovery placeholders.
- Runtime Integration Auditor: completed; targeted semantics, save, reopen, kernel, e2e, typecheck, and browser smoke probes passed with no findings.
- Acceptance Auditor: completed; AC1/AC2/AC3 and requested prior-pass fixes verified with no findings.
- Required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build` all passed on 2026-04-27 during this review pass.

### Action Items

- [x] [AI-Review][P2] Restore graph status when semantic conflicts are cleared — `src/stores/workspace-kernel/reducers.ts`, `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Semantic graph revalidation removes semantic issue IDs when blocked reasons clear, but returns the existing graph status; a graph previously marked `stale` by a semantic conflict can remain stale with no remaining semantic issue or repair path after the user fixes the semantics.
- [x] [AI-Review][P3] Keep graph-ready semantic summary selectors scoped to confirmed datasets — `src/stores/workspace-kernel/selectors.ts` — The public `graphReadySemanticSummary()` selector passes the active dataset directly to `createSemanticSummary()`, so non-panel consumers can surface import-preview placeholder semantics despite the confirmed-dataset boundary.
- [x] [AI-Review][P3] Exclude recovery placeholder datasets from semantic issue/editing flows — `src/features/workspace-persistence/reopen-workspace.ts`, `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Reopen semantic generation and the panel treat any non-import-preview dataset, including `sourceKind: 'recovery'`, as semantic-editable, allowing recovery placeholders to receive semantic missing-context issues and appear as confirmed canonical data.

---

Outcome: Changes requested. Story and sprint status set to `in-progress` for implementation follow-up.

Review date: 2026-04-27

Severity counts: P2 = 1, P3 = 2, P1 = 0, P0 = 0. Dismissed = 0.

Reviewer-lane summary:
- Blind Hunter: completed; verified requested prior-pass ownership and summary fixes, raised a gating rollback-rebase gap for later partial same-column commands and a remount pending-save UX/rollback side-effect concern.
- Edge Case Hunter: completed; verified non-overwritable owner guard and raised P3 edge cases for rejected-overlap rollback side effects and import-preview graph reopen repair coverage.
- Runtime Integration Auditor: completed; targeted semantics, save, reopen, kernel, browser persistence, and summary probes passed with no findings.
- Acceptance Auditor: completed; AC1/AC2/AC3 and requested prior-pass fixes verified with no findings.
- Required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build` all passed on 2026-04-27 during this review pass.

### Action Items

- [x] [AI-Review][P2] Preserve failed-save rollback semantics for later partial same-column commands — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/stores/workspace-kernel/reducers.ts` — Column semantic ledger payloads record full next-column state, so rollback can mistake a later partial same-column command for deliberate retention of unrelated failed optimistic fields and keep non-durable values live after persistence failure.
- [x] [AI-Review][P3] Avoid replaceSnapshot rollback side effects when overlapping semantic ownership is rejected before mutation — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/features/workspace-persistence/workspace-kernel-persistence-state.ts` — A remounted/second panel correctly cannot overwrite the first pending semantic-save owner, but the catch path still runs rollback despite no mutation being applied, which can reset kernel ephemeral state such as pending worker requests.
- [x] [AI-Review][P3] Preserve a generic reopen repair issue for import-preview graph catalog failures — `src/features/workspace-persistence/reopen-workspace.ts` — Import-preview datasets are correctly skipped for semantic issue regeneration, but a preview graph with semantic-catalog type failures can be marked stale with no generic repair issue, leaving the placeholder graph state harder to recover.

---

Outcome: Changes requested. Story and sprint status set to `in-progress` for implementation follow-up.

Review date: 2026-04-27

Severity counts: P2 = 1, P3 = 2, P1 = 0, P0 = 0. Dismissed = 0.

Reviewer-lane summary:
- Blind Hunter: completed; verified the requested prior-pass fixes from diff where visible and raised a P2 import-preview graph semantic regeneration gap.
- Edge Case Hunter: completed; targeted semantic rollback/reopen edge paths, verified requested prior-pass fixes, and raised a P3 all-blank dataset-context rollback edge case.
- Runtime Integration Auditor: completed; targeted semantic/reopen/save/kernel/router tests, typecheck, e2e probe, and browser draft-preservation probe passed with no findings.
- Acceptance Auditor: completed; AC1/AC2/AC3 broadly satisfied, verified requested prior-pass fixes, and raised a P3 warning-level readiness feedback mismatch for missing optional semantic context.
- Required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build` all passed on 2026-04-27 during this review pass.

### Action Items

- [x] [AI-Review][P2] Skip import-preview datasets during reopen graph semantic regeneration — `src/features/workspace-persistence/reopen-workspace.ts` — `createReopenSemanticState()` filters preview datasets for column/context semantic issues, but graph semantic regeneration builds `datasetById` from all datasets and can still attach `semantics.graph.composition-invalid` to graphs referencing import-preview placeholder datasets.
- [x] [AI-Review][P3] Preserve later all-blank dataset-context clears during failed-save rollback — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — The dataset-context rollback rebase detects later retained clears only when another field changed or the later previous value differed; a later durable no-op/all-blank context mutation can still have the old context value restored.
- [x] [AI-Review][P3] Surface missing optional semantic context as warning-level readiness feedback — `src/stores/workspace-kernel/reducers.ts`, `src/features/workspace-persistence/reopen-workspace.ts`, `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Missing column/dataset context issues are emitted with `severity: 'info'`, so optional-context warnings may not appear in readiness warning counts even though the story calls for warning/non-blocking context feedback.

---

Outcome: Changes requested. Story and sprint status set to `in-progress` for implementation follow-up.

Review date: 2026-04-27

Severity counts: P2 = 2, P3 = 2, P1 = 0, P0 = 0. Dismissed = 1.

Reviewer-lane summary:
- Blind Hunter: completed; verified prior pass fixes from the diff, raised live semantic graph revalidation/catalog diagnostic routing and a non-gating import-preview reopen semantic issue concern; one malformed-datasets reopen concern was dismissed because envelope validation/backfill already handles that path.
- Edge Case Hunter: completed; verified prior pass fixes except the dataset-context retained-clear branch, and raised the P2 retained-clear rollback gap.
- Runtime Integration Auditor: completed; targeted semantic/kernel/reopen/import tests and browser probes passed, verified prior pass fixes, and raised a P3 unsaved-draft reset on dataset-context save.
- Acceptance Auditor: completed; AC1/AC3 remain covered, AC2 rollback behavior remains partially blocked by the retained-clear dataset-context rollback gap.
- Required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build` all passed on 2026-04-27 during this review pass.

### Action Items

- [x] [AI-Review][P2] Preserve later deliberate dataset-context clears during failed-save rollback — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Rebased dataset-context rollback restores a prior field value when a later valid context mutation intentionally keeps that field cleared/omitted while changing another context field.
- [x] [AI-Review][P2] Keep nonsemantic graph catalog failures out of semantic graph issue regeneration — `src/stores/workspace-kernel/reducers.ts`, `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/features/workspace-persistence/graph-catalog.ts` — Live semantic graph revalidation merges all catalog blocked reasons into `semantics.graph.composition-invalid`, which can relabel unrelated graph/catalog repair failures as semantic repair issues.
- [x] [AI-Review][P3] Skip semantic reopen issue generation for import-preview placeholder datasets — `src/features/workspace-persistence/reopen-workspace.ts`, `src/stores/workspace-kernel/bootstrap.ts` — Reopen semantic diagnostics iterate all datasets and can create semantic context issues for preview placeholders instead of confirmed canonical datasets only.
- [x] [AI-Review][P3] Preserve unsaved column drafts when saving dataset context — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — The panel resets all column drafts when the dataset-context sync key changes, so saving dataset context can wipe unrelated in-progress column edits.

---

Outcome: Changes requested. Story and sprint status set to `in-progress` for implementation follow-up.

Review date: 2026-04-27

Severity counts: P2 = 3, P3 = 1, P1 = 0, P0 = 0. Dismissed = 0.

Reviewer-lane summary:
- Blind Hunter: completed; raised orphan semantic issue restoration when target dataset is removed before semantic save failure rollback.
- Edge Case Hunter: completed; raised dataset-context cleared-field rollback, stale rebased column semantic issues, and same-graph repair-state reset.
- Runtime Integration Auditor: completed; targeted semantic/reopen/save/kernel/router/integration/e2e probes passed and verified prior pass fixes with no findings.
- Acceptance Auditor: completed; raised dataset-context cleared-field rollback against AC2 persistence rollback requirements.
- Required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build` all passed on 2026-04-27 during this review pass.

### Action Items

- [x] [AI-Review][P2] Restore cleared dataset-context fields during rebased persistence rollback — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/features/semantics/semantic-model.ts`, `src/stores/workspace-kernel/reducers.ts` — When a failed dataset-context save clears a field or saves `null` and a later mutation advances `workspaceVersion`, rollback only iterates fields present in `payload.next`; omitted cleared fields are not restored from the prior durable context.
- [x] [AI-Review][P2] Regenerate rebased column semantic issues instead of restoring stale prior issues — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Rebased column rollback updates field values but then appends `previousTargetIssues` unchanged, so later same-column valid reapplications can retain stale missing-role or missing-context issues/readiness.
- [x] [AI-Review][P2] Skip restoring semantic rollback issues when the target dataset no longer exists — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/app/router/shell-routes.tsx` — If a semantic save fails after an intervening confirm-import rollback removes the dataset, rollback can append prior target semantic issues for the removed dataset and repollute readiness with orphan issues.
- [x] [AI-Review][P3] Preserve newer same-graph semantic repair state during rollback regeneration — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — `existingGraphIssuesById` can prefer older previous target graph issues over current same-ID graph issues, resetting newer matching status or `detectedAt`.

---

Outcome: Changes requested. Story and sprint status remain `in-progress` for implementation follow-up.

Review date: 2026-04-27

Severity counts: P2 = 1, P3 = 3, P1 = 0, P0 = 0. Dismissed = 0.

Reviewer-lane summary:
- Blind Hunter: completed; verified R1, R3, and R4 from the diff where visible, could not verify the UI rollback R2 diff completely, and raised the mixed reopen graph-failure diagnostic gap.
- Edge Case Hunter: completed; verified R1/R3, raised a P2 dataset-context rollback rebase gap, and raised P3 rollback/reopen edge cases.
- Runtime Integration Auditor: completed; targeted semantic/kernel/reopen/import tests, typecheck, and a reload probe passed; raised P3 dataset-context and graph rollback diagnostic-state concerns.
- Acceptance Auditor: completed; AC1/AC3 remained satisfied, R1/R2/R3 verified, and R4 remains partial because the UI rollback graph-regeneration path lacks diagnostic matching.
- Required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build` all passed on 2026-04-27 during this review pass.

### Action Items

- [x] [AI-Review][P2] Rebase failed dataset-context rollback over later context mutations — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Intervening-version rollback rebases column semantic saves, but dataset-context rollback restores `previousDataset.datasetContext` wholesale and can erase a later valid dataset context mutation.
- [x] [AI-Review][P3] Preserve rollback-regenerated graph semantic issue state only when diagnostics still match — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — The rollback graph regeneration path preserves existing graph semantic issue `status` and `detectedAt` by issue ID without comparing regenerated blocked reasons or affected columns.
- [x] [AI-Review][P3] Preserve nonsemantic catalog diagnostics when reopen has mixed graph failures — `src/features/workspace-persistence/reopen-workspace.ts` — Reopen diverts mixed semantic data-type and catalog graph failures into semantic regeneration, then filters to quantitative/temporal reasons and can drop simultaneous nonsemantic catalog reasons.
- [x] [AI-Review][P3] Preserve later deliberate same-column reapplication of failed values during rollback — `src/features/semantics/WorkspaceSemanticsPanel.tsx` — Same-column rollback preserves a failed value only when the later mutation's previous value was already the failed value, so a later change away and back to that value can still be reverted.

---

Outcome: Changes requested. Story and sprint status set to `in-progress` for implementation follow-up.

Review date: 2026-04-27

Severity counts: P2 = 1, P3 = 1, P1 = 0, P0 = 0. Dismissed = 1.

Reviewer-lane summary:
- Blind Hunter: completed; verified the requested prior-pass fixes and raised one dataset-backfill concern that was dismissed because envelope validation guarantees `datasets` is an array before collection parsing.
- Edge Case Hunter: completed; verified the requested prior-pass fixes and raised one P2 concurrent-save durability gap plus one P3 kernel preview-dataset guard gap.
- Runtime Integration Auditor: completed; targeted runtime/typecheck/semantic/reopen/e2e probes passed with no findings.
- Acceptance Auditor: completed; AC1/AC2/AC3 coverage and requested prior-pass fixes verified with no findings.
- Required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build` all passed on 2026-04-27 during this review pass.

### Action Items

- [x] [AI-Review][P2] Prevent concurrent workspace saves from persisting a failed optimistic semantic edit — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/features/workspace-persistence/save-workspace.ts`, `src/features/import/workspace-import-route.tsx` — A non-semantic workspace save can start after a semantic optimistic mutation and persist that snapshot before the semantic save rolls back as stale, so reload can resurrect the semantic edit after the UI reported failure.
- [x] [AI-Review][P3] Guard kernel semantic reducers against import-preview datasets — `src/stores/workspace-kernel/reducers.ts` — The semantics panel filters preview datasets, but public kernel semantic commands still accept any dataset/column ID and can mutate import-preview placeholders if called by another consumer.

---

Outcome: Changes requested. Story and sprint status set to `in-progress` for implementation follow-up.

Review date: 2026-04-27

Severity counts: P2 = 1, P3 = 1, P1 = 0, P0 = 0. Dismissed = 0.

Reviewer-lane summary:
- Blind Hunter: completed; verified pending semantic-save ownership rejects non-owning workspace saves and semantic reducers reject import-preview datasets; no findings.
- Edge Case Hunter: completed; verified requested prior-pass fixes and raised the overlapping semantic owner save durability gap.
- Runtime Integration Auditor: completed; targeted runtime/typecheck/semantic/reopen/e2e probes passed and verified requested prior-pass fixes; no findings.
- Acceptance Auditor: completed; AC1/AC2 coverage and requested prior-pass fixes verified; raised one non-gating AC3 clarity issue for missing-gap summary copy.
- Required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build` all passed on 2026-04-27 during this review pass.

### Action Items

- [x] [AI-Review][P2] Guard overlapping semantic owner saves from persisting rolled-back optimistic edits — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/features/workspace-persistence/workspace-kernel-persistence-state.ts`, `src/features/workspace-persistence/save-workspace.ts` — Store-level pending semantic ownership can be overwritten by a second semantic save owner from another panel instance/remount, allowing the second save to persist a snapshot that still contains the first failed optimistic semantic mutation before rollback completes.
- [x] [AI-Review][P3] Show missing semantic summary gaps with column names instead of counts/raw IDs — `src/features/semantics/WorkspaceSemanticsPanel.tsx`, `src/features/semantics/semantic-model.ts` — The graph-ready summary lists assigned roles but reports missing roles/context as counts and raw semantic issue IDs, making unresolved pre-graph gaps less clear than AC3 intends.

---

Outcome: P3-only deferred. Story and sprint status set to `done`; no implementation follow-up is gating completion.

Review date: 2026-04-27

Severity counts: P3 = 2, P2 = 0, P1 = 0, P0 = 0. Dismissed = 0.

Reviewer-lane summary:
- Blind Hunter: completed; verified pass 16 P2/P3 fixes and raised one non-gating live orphan-issue hardening item.
- Edge Case Hunter: completed; verified pass 16 P2/P3 fixes and raised two non-gating orphan/resolved issue-ID hardening items, one overlapping with Blind Hunter.
- Runtime Integration Auditor: completed; targeted semantic/reopen tests, typecheck, and live browser reload/persistence probe passed with no findings.
- Acceptance Auditor: completed; AC1/AC2/AC3 and pass 16 fixes verified with no findings.
- Required validation commands: `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build` all passed on 2026-04-27 during this review pass.

P3 findings were deferred to `_bmad-output/implementation-artifacts/deferred-work.md` because they require orphan or resolved nonsemantic graph issue IDs to persist in graph definitions after semantic issues clear; this is defensive cleanup for inconsistent legacy/internal state, not a normal accepted flow, data-integrity failure, security issue, critical accessibility issue, or current AC violation.

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

GPT-5.5

### Debug Log References

- `bash ./scripts/with-node.sh npm test -- src/features/semantics/semantic-model.spec.ts src/schemas/contracts.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts`
- `bash ./scripts/with-node.sh npm run typecheck`
- `bash ./scripts/with-node.sh npm test`
- `bash ./scripts/with-node.sh npm run lint`
- `bash ./scripts/with-node.sh npm test -- src/features/workspace-persistence/save-workspace.spec.ts src/features/semantics/semantic-model.spec.ts src/features/semantics/WorkspaceSemanticsPanel.spec.ts`
- `bash ./scripts/with-node.sh npm run typecheck`
- `bash ./scripts/with-node.sh npm test`
- `bash ./scripts/with-node.sh npm run lint`
- `bash ./scripts/with-node.sh npm test -- src/features/workspace-persistence/save-workspace.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts`
- `bash ./scripts/with-node.sh npm test -- src/features/workspace-persistence/save-workspace.spec.ts src/features/semantics/WorkspaceSemanticsPanel.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts src/features/import/workspace-import-route.spec.ts`
- `bash ./scripts/with-node.sh npm run typecheck`
- `bash ./scripts/with-node.sh npm run lint`
- `bash ./scripts/with-node.sh npm test`
- `bash ./scripts/with-node.sh npm test -- src/features/semantics/WorkspaceSemanticsPanel.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts`
- `bash ./scripts/with-node.sh npm run typecheck`
- `bash ./scripts/with-node.sh npm test`
- `bash ./scripts/with-node.sh npm run lint`
- `bash ./scripts/with-node.sh npm run build`
- `bash ./scripts/with-node.sh npm test -- src/stores/workspace-kernel/workspace-kernel.spec.ts src/features/semantics/WorkspaceSemanticsPanel.spec.ts src/features/workspace-persistence/save-workspace.spec.ts src/services/persistence/repositories/workspace-repository.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts`
- `bash ./scripts/with-node.sh npm run typecheck`
- `bash ./scripts/with-node.sh npm test`
- `bash ./scripts/with-node.sh npm run lint`
- `bash ./scripts/with-node.sh npm run typecheck`
- `bash ./scripts/with-node.sh npm run build`
- `bash ./scripts/with-node.sh npm run test:e2e -- tests/e2e/import.spec.ts`
- `bash ./scripts/with-node.sh npm test -- src/features/semantics src/stores/workspace-kernel/workspace-kernel.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts src/schemas/contracts.spec.ts`
- `bash ./scripts/with-node.sh npm run typecheck && bash ./scripts/with-node.sh npm test && bash ./scripts/with-node.sh npm run lint && bash ./scripts/with-node.sh npm run build`
- `bash ./scripts/with-node.sh npm test -- src/features/workspace-persistence/save-workspace.spec.ts src/features/semantics/WorkspaceSemanticsPanel.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts src/schemas/contracts.spec.ts`
- `bash ./scripts/with-node.sh npm run typecheck`
- `bash ./scripts/with-node.sh npm test`
- `bash ./scripts/with-node.sh npm run lint`
- `bash ./scripts/with-node.sh npm test -- src/features/semantics/WorkspaceSemanticsPanel.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts src/features/workspace-persistence/save-workspace.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts`
- `bash ./scripts/with-node.sh npm run typecheck`
- `bash ./scripts/with-node.sh npm test`
- `bash ./scripts/with-node.sh npm run lint`
- `bash ./scripts/with-node.sh npm test -- src/features/semantics/WorkspaceSemanticsPanel.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts`
- `bash ./scripts/with-node.sh npm run typecheck`
- `bash ./scripts/with-node.sh npm test`
- `bash ./scripts/with-node.sh npm run lint`
- `bash ./scripts/with-node.sh npm test -- src/features/semantics/WorkspaceSemanticsPanel.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts src/features/import/workspace-import-route.spec.ts`
- `bash ./scripts/with-node.sh npm run typecheck`
- `bash ./scripts/with-node.sh npm test`
- `bash ./scripts/with-node.sh npm run lint`
- `bash ./scripts/with-node.sh npm test -- src/features/semantics/WorkspaceSemanticsPanel.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts`
- `bash ./scripts/with-node.sh npm run typecheck`
- `bash ./scripts/with-node.sh npm test`
- `bash ./scripts/with-node.sh npm run lint`
- `bash ./scripts/with-node.sh npm test -- src/features/semantics/WorkspaceSemanticsPanel.spec.ts`
- `bash ./scripts/with-node.sh npm test -- src/stores/workspace-kernel/workspace-kernel.spec.ts src/features/semantics/WorkspaceSemanticsPanel.spec.ts src/features/import/workspace-import-route.spec.ts`
- `bash ./scripts/with-node.sh npm run typecheck`
- `bash ./scripts/with-node.sh npm test`
- `bash ./scripts/with-node.sh npm run lint`
- `bash ./scripts/with-node.sh npm test -- src/features/workspace-persistence/reopen-workspace.spec.ts src/features/semantics/WorkspaceSemanticsPanel.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts src/features/semantics/semantic-model.spec.ts`
- `bash ./scripts/with-node.sh npm run typecheck`
- `bash ./scripts/with-node.sh npm test`
- `bash ./scripts/with-node.sh npm run lint`
- `bash ./scripts/with-node.sh npm test -- src/features/semantics/WorkspaceSemanticsPanel.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts`
- `bash ./scripts/with-node.sh npm run typecheck`
- `bash ./scripts/with-node.sh npm test`
- `bash ./scripts/with-node.sh npm run lint`
- `bash ./scripts/with-node.sh npm test -- src/stores/workspace-kernel/workspace-kernel.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts src/features/semantics/WorkspaceSemanticsPanel.spec.ts`
- `bash ./scripts/with-node.sh npm run typecheck`
- `bash ./scripts/with-node.sh npm test`
- `bash ./scripts/with-node.sh npm run lint`
- `bash ./scripts/with-node.sh npm test -- src/features/semantics/WorkspaceSemanticsPanel.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts`
- `bash ./scripts/with-node.sh npm run typecheck`
- `bash ./scripts/with-node.sh npm test`
- `bash ./scripts/with-node.sh npm run lint`

### Completion Notes List

- Expanded the canonical workspace dataset schema with editable labels, semantic role enum, measurement context, optional descriptions, and dataset-level context while preserving imported `sourceName` provenance.
- Added ledgered WorkspaceKernel commands for column semantic and dataset context edits, including semantic issue/readiness reconciliation and graph composition revalidation.
- Added the keyboard-accessible `WorkspaceSemanticsPanel` to hydrated workspace routes, keeping preview import state separate from confirmed canonical dataset edits.
- Added schema, semantic-model, kernel, and import e2e coverage for semantic persistence, reload/reopen, and summary updates without re-import.
- Resolved all 12 AI review follow-ups by preserving structured measurement context, tightening graph semantic invalidation, seeding initial semantic readiness issues, moving IndexedDB construction behind the persistence boundary, serializing semantic saves, targeting semantic issue reconciliation, normalizing legacy roles, enforcing meaningful contexts, filtering summary issue IDs, preserving unsaved drafts, displaying units, and strengthening correlation IDs.
- Resolved the follow-up persistence findings by failing closed when IndexedDB durability is unavailable and rebasing failed semantic-save rollbacks over intervening kernel mutations so non-durable semantic edits do not remain live.
- Resolved same-round P3 findings by reopening graph semantic issues when blocking reasons change, normalizing legacy context objects to strict supported shapes during reopen, and length-prefixing semantic issue ID segments to avoid dotted-identifier collisions.
- Resolved the remaining review findings by scoping semantic rollback to the affected column/graph issues, preserving handleless source-file provenance on save/reopen, generating semantic readiness issues during legacy reopen backfill, routing graph semantic repairs to affected column and graph scopes, and preserving version-neutral handle refreshes during exact-version rollback.
- Resolved the 4 gating review findings by regenerating current semantic issues on reopen, rebasing graph semantic rollback over newer same-graph conflicts, preserving handleless source-file provenance during exact-version rollback, and validating scatter/line/bar data-type requirements after semantic edits.
- Resolved the remaining review findings by preserving handleless source provenance across mixed-handle saves/rollbacks, routing catalog data-type conflicts to affected columns, flagging each conflicting multi-role assignment, rebasing failed-save rollbacks over later same-column edits, and preserving unresolved semantic issue state during reopen.
- Resolved the final review findings by regenerating data-type graph issues as semantic reopen diagnostics, rebasing failed semantic rollbacks over later same-column retained values, removing generated semantic issues during stale confirm-import rollback, and preserving graph semantic issue state only when regenerated diagnostics still match.
- Resolved the latest review findings by rebasing dataset-context rollback field-by-field over later context mutations, preserving rollback-regenerated graph issue state only for matching diagnostics, retaining mixed nonsemantic reopen catalog diagnostics alongside regenerated semantic graph issues, and preserving later deliberate same-column reapplications of failed rollback values.
- Resolved the current review findings by restoring cleared dataset-context fields during rebased rollback, regenerating current target semantic issues after column rollback, avoiding orphan issue restoration when the target dataset is gone, and preserving newer same-graph repair state when regenerated diagnostics still match.
- Resolved the latest review findings by preserving later deliberate dataset-context clears during rollback, routing only semantic graph catalog diagnostics into semantic graph issues, skipping import-preview placeholder datasets during reopen semantic generation, and decoupling dataset-context draft sync from unsaved column drafts.
- Resolved the current review findings by excluding import-preview datasets from reopen graph semantic regeneration, preserving later all-blank dataset-context clears during failed-save rollback, and surfacing optional missing semantic context as warning-level readiness feedback.
- Resolved the current review findings by registering optimistic semantic-save ownership so non-semantic workspace saves fail closed while semantic persistence is pending, then guarding kernel semantic reducers from mutating import-preview placeholder datasets.
- Resolved the latest review findings by making pending semantic-save ownership non-overwritable across remounted panel instances and rendering graph-ready missing semantic gaps with column names and readable issue summaries instead of counts/raw IDs.
- Resolved the current review findings by compacting column semantic ledger payloads for partial-command rollback rebasing, skipping replaceSnapshot rollback when semantic save ownership is rejected before mutation, and preserving generic reopen repair issues for import-preview graph catalog failures.
- Resolved the current review findings by restoring graph status after semantic conflicts clear, scoping graph-ready semantic summaries to confirmed datasets only, and excluding recovery placeholder datasets from semantic issue generation and editing surfaces.
- Resolved the latest review findings by restoring only graphs that actually carried semantic issues, restoring candidate/reference status during reopen semantic clear, preserving generic recovery-dataset graph catalog repair issues, using rendered fallback drafts for immediate column saves, and removing the unrelated Zone.Identifier deletion from scope.
- Resolved the current review findings by guarding rebased rollback graph-status restoration to graphs carrying semantic issue IDs and by restoring reopened graph status when only orphan nonsemantic issue IDs blocked semantic-clear recovery before final issue filtering.

### File List

- `src/app/router/shell-routes.tsx`
- `src/app/router/shell-routes-hydration.spec.ts`
- `src/domain/trust/selectors.ts`
- `src/features/import/confirm-import.ts`
- `src/features/import/workspace-import-route.spec.ts`
- `src/features/semantics/WorkspaceSemanticsPanel.tsx`
- `src/features/semantics/WorkspaceSemanticsPanel.spec.ts`
- `src/features/semantics/index.ts`
- `src/features/semantics/semantic-model.spec.ts`
- `src/features/semantics/semantic-model.ts`
- `src/features/workspace-persistence/graph-catalog.ts`
- `src/features/workspace-persistence/reopen-workspace.ts`
- `src/features/workspace-persistence/reopen-workspace.spec.ts`
- `src/features/workspace-persistence/save-workspace.ts`
- `src/features/workspace-persistence/save-workspace.spec.ts`
- `src/features/workspace-persistence/workspace-kernel-persistence-state.ts`
- `src/services/persistence/repositories/workspace-repository.ts`
- `src/services/persistence/repositories/workspace-repository.spec.ts`
- `src/schemas/contracts.spec.ts`
- `src/schemas/workspace/workspace-snapshot.ts`
- `src/stores/workspace-kernel/bootstrap.ts`
- `src/stores/workspace-kernel/dataset-file-handle-metadata.ts`
- `src/stores/workspace-kernel/reducers.ts`
- `src/stores/workspace-kernel/selectors.ts`
- `src/stores/workspace-kernel/store.ts`
- `src/stores/workspace-kernel/types.ts`
- `src/stores/workspace-kernel/workspace-kernel.spec.ts`
- `src/test/fixtures/workspace/workspace-snapshot.fixture.ts`
- `tests/integration/workspace-reopen.test.ts`
- `tests/e2e/import.spec.ts`
- `_bmad-output/implementation-artifacts/2-3-edit-semantic-roles-types-units-and-dataset-context.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-27: Implemented Story 2.3 semantic editing, canonical schema expansion, kernel mutation commands, UI surface, persistence/reopen compatibility, and validation coverage.
- 2026-04-27: Addressed 12 AI review findings for semantic context preservation, graph invalidation, initial readiness issues, persistence boundary handling, overlapping-save guards, targeted issue reconciliation, legacy reopen role normalization, summary/unit display, and regression coverage.
- 2026-04-27: Addressed 5 additional review findings for semantic persistence failure reporting, stale-save rollback durability, graph issue reopening, legacy context normalization, and dotted identifier-safe semantic issue IDs.
- 2026-04-27: Addressed final 5 review findings for targeted semantic rollback, handleless source provenance preservation, legacy reopen semantic readiness, graph repair routing, and exact-version handle-refresh rollback preservation.
- 2026-04-27: Addressed 4 gating review findings for reopen semantic issue regeneration, same-graph rollback conflict preservation, exact-version handleless provenance rollback, and data-type graph invalidation.
- 2026-04-27: Addressed 5 unresolved review findings for mixed-handle source provenance, data-type affected-column routing, multi-role graph conflicts, same-column rollback rebasing, and reopen semantic issue state preservation.
- 2026-04-27: Addressed final 4 review findings for data-type semantic issue regeneration on reopen, same-column retained-value rollback rebasing, confirm-import semantic issue cleanup, and diagnostic-matched graph issue state preservation.
- 2026-04-27: Addressed 4 review findings for dataset-context rollback rebasing, rollback graph diagnostic matching, mixed reopen catalog diagnostics, and deliberate same-column failed-value reapplication.
- 2026-04-27: Addressed 4 review findings for cleared-field dataset-context rollback restoration, regenerated column rollback issues, target-removed rollback issue suppression, and newer same-graph repair-state preservation.
- 2026-04-27: Addressed 4 review findings for deliberate dataset-context clear preservation, semantic-only graph catalog issue regeneration, import-preview reopen semantic issue skipping, and unsaved column draft preservation while saving dataset context.
- 2026-04-27: Addressed 3 review findings for import-preview graph semantic reopen filtering, all-blank dataset-context rollback clear preservation, and warning-level optional context readiness feedback.
- 2026-04-27: Addressed 2 review findings for pending semantic-save durability ownership and import-preview semantic reducer guards.
- 2026-04-27: Addressed 2 review findings for overlapping semantic owner save guarding and column-name-based graph-ready missing gap summaries.
- 2026-04-27: Addressed 3 review findings for partial same-column semantic rollback rebasing, rejected-overlap rollback side-effect prevention, and import-preview graph catalog reopen repair issues.
- 2026-04-27: Addressed 3 review findings for cleared semantic graph status restoration, confirmed-only graph-ready summary selection, and recovery placeholder exclusion from semantic reopen/edit flows.
- 2026-04-27: Addressed 5 review findings for unrelated stale-graph over-promotion prevention, reopen graph status restoration after semantic clears, recovery-dataset graph catalog repair preservation, immediate fallback-draft column saves, and Zone.Identifier scope cleanup.
- 2026-04-27: Addressed 2 review findings for rebased rollback semantic-issue graph restoration guarding and orphan issue filtering during reopen graph status restoration.

### Code Review Findings (2026-04-27)

- [x] **P1: Preserve structured measurement context on column saves.** `WorkspaceSemanticsPanel.tsx` flattens the structured `{ quantity, method, condition, notes }` measurement context into a single textarea draft, and `saveColumn()` persists `parseMeasurementContext()` as `{ notes }`; saving an unrelated label/unit edit can silently collapse canonical structured metadata.
- [x] **P1: Invalidate graph assignments when semantic roles conflict.** `collectGraphSemanticBlockedReasons()` only flags assigned columns whose semantic role is `unassigned`; changing a graph-assigned column from `y` to another non-`y` role can leave the active graph/readiness state valid despite AC2 requiring downstream graph consumers to reflect updated semantics.
- [x] **P2: Create semantic issues immediately after confirmed import.** Confirmed imports seed `semanticRole: 'unassigned'`, `measurementContext: null`, and `datasetContext: null`, but semantic issue reconciliation currently runs only after semantic edit commands, so readiness/repair surfaces can miss initial graph-readiness gaps.
- [x] **P2: Include confirmed units in the graph-ready summary.** The summary data includes `unit`, but `assignedRoles` and the UI render only `role: label`; AC3 and the story task require active semantic choices to include confirmed units/labels before graphing.
- [x] **P2: Normalize legacy semantic roles during reopen backfill.** The schema narrows `semanticRole` to a new enum, while `backfillDatasetSemanticFields()` does not map older non-empty roles to supported values; existing persisted workspaces with legacy role strings can fail reopen instead of backfilling safely.
- [x] **P2: Serialize or guard overlapping semantic saves and rollbacks.** Runtime probing reproduced double-click saves where one persistence call failed as stale and the UI/store appeared updated until reload reverted the edit. Add per-save pending state or version/correlation guards so stale failures cannot roll back or misreport later state.
- [x] **P2: Route semantic persistence through the existing boundary instead of constructing IndexedDB in the UI.** `WorkspaceSemanticsPanel.tsx` directly creates `IndexedDbWorkspaceStorage`; the story requires committed semantic edits to save through the existing workspace persistence boundary, with failure handling that does not present edits as durable when persistence fails.
- [x] **P2: Reconcile only targeted semantic issues plus directly affected graph issues.** `reconcileSemanticIssuesForDataset()` removes and recreates all `semantics.*` issues for the dataset on any column/context edit, which can reset statuses/timestamps for unrelated columns instead of preserving unrelated repair state.
- [x] **P3: Treat empty context objects consistently.** The schemas allow `{}` for measurement and dataset context, while issue generation checks only object truthiness; empty objects can suppress missing-context warnings even though the summary has no meaningful context to show.
- [x] **P3: Filter graph-ready summary issue IDs to semantic issues.** `createSemanticSummary()` includes any unresolved dataset-scoped issue, so reopen/import issues can appear as “Open semantic issue IDs.”
- [x] **P3: Avoid resetting unsaved drafts on unrelated snapshot object changes.** The panel resets drafts whenever `confirmedDataset` object identity changes, which can wipe in-progress user edits after unrelated store updates.
- [x] **P3: Strengthen semantic ledger correlation IDs.** `createMeta()` derives the correlation ID only from an ISO timestamp, so rapid saves in the same millisecond can collide and weaken auditability.
