# Story 1.5: Localize Reopen Errors and Provide Repair Entry Points

Status: done

## Story

As a user,
I want reopen problems to be isolated and repairable,
so that one broken element does not invalidate the whole workspace.

## Acceptance Criteria

1. Given a reopened workspace contains a stale formula, invalid saved graph selection, saved issue-record or ledger drift, missing file handle, or another currently deterministically detectable localized reopen failure, when validation completes, then each broken element or failure surface is listed explicitly with scope and impact.
2. Given at least one issue is detected, when the user continues into the workspace, then valid data, graphs, and controls remain available while repair entry points stay attached to the broken items.
3. Given a repair is deferred, when the workspace remains open, then the unresolved issue persists in trust state and handoff readiness rather than disappearing from view.

## Dependencies

- Story 1.2: Author Canonical Workspace and Trust Contracts
- Story 1.3: Create, Open, and Reopen Local Workspaces
- Story 1.4: Surface Shell Readiness, Support, and Update Status

## Contract Boundaries

- In scope: reopen-time drift analysis for currently deterministically detectable localized failures, issue-record localization for stale formulas, invalid saved graph selections, saved issue-record or ledger drift, missing file handles, repair-entry selectors and UI hooks, unresolved-issue persistence in trust/readiness state, and reopen-focused integration coverage.
- Out of scope: semantic transform reopen validation that requires dependency metadata, incompatible graph-composition, layer, or overlay reopen validation, full transform/formula repair execution flows, review-mode evidence tooling, export gating, and broad graph-authoring remediation UX beyond the first repair entry points.
- Owning paths: `src/services/persistence/**`, `src/features/workspace-persistence/**`, `src/features/workspace-repair/**`, `src/domain/trust/**`, `src/domain/readiness/**`, and `tests/integration/workspace-reopen.test.ts`.
- Downstream consumers after completion: Repair Card surfaces, review-mode unresolved issue callouts, handoff readiness checks, and later export gating in Epic 5.

## Tasks / Subtasks

- [x] Extend reopen validation to emit structured issue records for stale formulas, invalid saved graph selections, saved issue-record or ledger drift, missing file handles, and similar currently deterministically detectable localized failures. (AC: 1)
- [x] Keep valid unaffected state available after reopen while attaching repair entry points to the flagged elements and selectors that summarize scope/impact. (AC: 1, 2)
- [x] Persist unresolved issue state in trust/readiness selectors so deferred repairs remain visible through continued work and later handoff flows. (AC: 2, 3)
- [x] Add integration tests for partially valid reopened workspaces, explicit scope/impact reporting, and deferred-repair persistence. (AC: 1, 2, 3)

### Review Findings

- [x] [Review][Patch] Sanitize localized entity ids before writing issue records [/home/pin81845/repo/BMADGraphWebApp/src/features/workspace-persistence/reopen-workspace.ts:198]
- [x] [Review][Patch] Sanitize invalid saved graph selection ids before emitting reopen issues [/home/pin81845/repo/BMADGraphWebApp/src/features/workspace-persistence/reopen-workspace.ts:700]
- [x] [Review][Patch] Add explicit repair scope labels for ledger and saved issue-record failures [/home/pin81845/repo/BMADGraphWebApp/src/domain/trust/selectors.ts:43]
- [x] [Review][Patch] Normalize `sprint-status.yaml` line endings to avoid trailing-whitespace churn [/home/pin81845/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/sprint-status.yaml:1]
- [x] [Review][Patch] Resolved reopen issues still remain in readiness counts [/home/pinto/repo/BMADGraphWebApp/src/stores/workspace-kernel/reducers.ts:64]
- [x] [Review][Patch] Invalid graph-selection issues collapse selection-slot provenance into graph ids or placeholder tokens [/home/pinto/repo/BMADGraphWebApp/src/features/workspace-persistence/reopen-workspace.ts:218]
- [x] [Review][Patch] Graph invalid-selection repair actions deep-link to the replacement graph [/home/pinto/repo/BMADGraphWebApp/src/features/workspace-persistence/reopen-workspace.ts:250]
- [x] [Review][Patch] Normalization-only invalid-selection warnings misreport fallback selection [/home/pinto/repo/BMADGraphWebApp/src/features/workspace-persistence/reopen-workspace.ts:733]
- [x] [Review][Patch] Add integration coverage for invalid-selection and scope-label reopen paths [/home/pinto/repo/BMADGraphWebApp/tests/integration/workspace-reopen.test.ts:98]
- [x] [Review][Patch] `with-node.sh` retries install for activation failures and hides the real error [/home/pinto/repo/BMADGraphWebApp/scripts/with-node.sh:21]
- [x] [Review][Decision] Defer semantic transform reopen validation that needs snapshot dependency metadata to Story 1.6; Story 1.5 is narrowed to currently deterministically detectable reopen failures.
- [x] [Review][Decision] Defer incompatible graph-composition, layer, and overlay reopen validation contract definition to Story 1.6; Story 1.5 is narrowed to currently deterministically detectable reopen failures.
- [x] [Review][Patch] Reopen readiness reconciliation drops explicit readiness-owned blocked or warning state when saved issue ids are filtered or resolved [/home/pinto/repo/BMADGraphWebApp/src/features/workspace-persistence/reopen-workspace.ts:1014]
- [x] [Review][Patch] `replaceIssues` drops explicit readiness-owned blocked or warning state once issue-derived readiness ids clear [/home/pinto/repo/BMADGraphWebApp/src/stores/workspace-kernel/reducers.ts:64]
- [x] [Review][Patch] Deferred-repair integration coverage does not prove the deferred issue still contributes to readiness persistence [/home/pinto/repo/BMADGraphWebApp/tests/integration/workspace-reopen.test.ts:247]
- [x] [Review][Decision] Missing file-handle reopen failures remain in the narrowed Story 1.5 contract, but the persisted workspace schema and reopen path have no file-handle metadata or validation branch to localize them; decide whether to extend the persistence contract in Story 1.5 or explicitly defer this case with the other Story 1.6 reopen-contract work [/home/pinto/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-5-localize-reopen-errors-and-provide-repair-entry-points.md:13]
- [x] [Review][Patch] Persisted dataset file handles break the default in-memory workspace storage because the record is `structuredClone`d with live handle methods [/home/pinto/repo/BMADGraphWebApp/src/services/persistence/repositories/workspace-repository.ts:143]
- [x] [Review][Patch] Reopened workspaces drop dataset file handles on the next save because the reopen session does not preserve or return them, so a reopen-save-reopen cycle will falsely emit missing-file-handle issues [/home/pinto/repo/BMADGraphWebApp/src/features/workspace-persistence/reopen-workspace.ts:1201]
- [x] [Review][Patch] Refresh the generated Story 1.5 review prompt and frozen diff artifacts so they cover the full current in-scope file set and latest working-tree delta [/home/pinto/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-5-review-acceptance-auditor-prompt.md:31]
- [x] [Review][Patch] Reopen treats a stale dataset file-handle record as valid when only the token matches, so mismatched dataset/file metadata suppresses the localized missing-file-handle issue [/home/pinto/repo/BMADGraphWebApp/src/features/workspace-persistence/reopen-workspace.ts:554]
- [x] [Review][Patch] Refreshed Story 1.5 review artifacts still exclude the intentionally in-scope `epic-1-stories.md` planning diff, so the frozen comparison set remains incomplete [/home/pinto/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-5-review-acceptance-auditor-prompt.md:104]
- [x] [Review][Patch] `replaceSnapshot` preserves dataset file handles from the previous kernel session, so replacing the snapshot for a different reopened workspace can save stale handles and suppress or mislocalize later missing-file-handle diagnostics [/home/pinto/repo/BMADGraphWebApp/src/stores/workspace-kernel/reducers.ts:122]
- [x] [Review][Patch] Explicit dataset handle replacements do not keep snapshot source-file metadata in sync, so relinking a dataset to a differently named file will save an incompatible snapshot/handle pair and falsely reopen as `workspace.reopen.dataset.missing-file-handle` [/home/pinto/repo/BMADGraphWebApp/src/stores/workspace-kernel/reducers.ts:138]
- [x] [Review][Patch] `replaceSnapshot` still installs explicit dataset file handles without synchronizing the incoming snapshot `sourceFile` metadata, so any later save from that kernel can persist an incompatible snapshot/handle pair and falsely reopen as `workspace.reopen.dataset.missing-file-handle` [/home/pinto/repo/BMADGraphWebApp/src/stores/workspace-kernel/reducers.ts:123]
- [x] [Review][Patch] The refreshed Story 1.5 review prompts and frozen diff artifacts still omit `src/stores/workspace-kernel/dataset-file-handle-metadata.ts`, so the required full-file-list comparison set remains incomplete for fresh review passes [/home/pinto/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-5-review-acceptance-auditor-prompt.md:32]
- [x] [Review][Patch] `saveWorkspaceKernel` persists stale dataset `sourceFile` metadata when retained handles already exist in kernel state, so a save-reopen cycle can emit a false `workspace.reopen.dataset.missing-file-handle` warning [/home/pinto/repo/BMADGraphWebApp/src/features/workspace-persistence/save-workspace.ts:15]

## Dev Notes

### Architecture Alignment

- Save/reopen fidelity depends on the snapshot-plus-ledger model preserving valid state while surfacing invalid elements as repairable issue records.
- Currently deterministically detectable localized failures such as stale formulas, missing file handles, invalid saved graph selections, and saved issue-record or ledger drift must stay attached to the reopened workspace rather than being dropped silently.
- Trust surfaces, readiness, and unresolved issue state must be shared selectors over canonical state, not feature-local warnings.
- Semantic transform reopen validation and incompatible graph-composition or layer reopen validation remain deferred to Story 1.6 until the contract gap is closed.

### Project Structure Notes

- Reuse the shared issue-record contract and trust selectors introduced earlier in Epic 1; do not invent a second reopen-error format.
- Keep reopen repair concerns connected to the persistence/reopen path rather than scattering them into feature-local graph or transform modules.
- This story establishes the first repair-entry points only for currently deterministically detectable reopen failures; Story 1.6 owns semantic transform reopen validation and incompatible graph-composition or layer reopen validation.

### Testing

- Add failure-path reopen tests for deterministically detectable localized reopen failures where unrelated valid state remains usable.
- Verify that unresolved issues survive continued workspace activity until a repair or explicit dismissal path updates canonical state.
- Include scope/impact assertions so reopened failures are understandable rather than generic error banners.

### Residual Assumptions

- Repair entry points may begin as focused callouts or links into the relevant panel as long as they remain attached to the broken analytical elements and preserve valid workspace access.

### References

- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md` - FR46, FR47, FR52, NFR7 through NFR10
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md` - Snapshot-plus-ledger reopen model, issue records, trust/readiness selectors, workspace reopen integration tests
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/ux-design-specification.md` - Workspace continuity, drift warnings, repair cards, trust-critical reopen behavior
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-07-issue-record-contract.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-09-release-manifest-and-compatibility-envelope.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Epic 1 story artifact normalized to the approved 2026-04-16 plan.
- `./scripts/with-node.sh npm test -- src/features/workspace-persistence/reopen-workspace.spec.ts`
- `./scripts/with-node.sh npm test -- src/features/workspace-persistence/reopen-workspace.spec.ts tests/integration/workspace-reopen.test.ts`
- `./scripts/with-node.sh npm test -- src/features/workspace-persistence/reopen-workspace.spec.ts src/domain/trust/selectors.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts tests/integration/workspace-reopen.test.ts`
- `./scripts/with-node.sh npm test`
- `./scripts/with-node.sh npm run lint`
- `./scripts/with-node.sh npm run typecheck`
- `bash -lc 'source "$HOME/.nvm/nvm.sh" && nvm use --delete-prefix "$(tr -d "[:space:]" < .nvmrc)" >/dev/null && npm ci'`
- `bash -lc 'source "$HOME/.nvm/nvm.sh" && nvm use --delete-prefix "$(tr -d "[:space:]" < .nvmrc)" >/dev/null && npm test -- src/features/workspace-persistence/reopen-workspace.spec.ts src/domain/trust/selectors.spec.ts'`
- `bash -lc 'source "$HOME/.nvm/nvm.sh" && nvm use --delete-prefix "$(tr -d "[:space:]" < .nvmrc)" >/dev/null && npm test -- src/features/workspace-persistence/reopen-workspace.spec.ts src/domain/trust/selectors.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts tests/integration/workspace-reopen.test.ts'`
- `bash -lc 'source "$HOME/.nvm/nvm.sh" && nvm use --delete-prefix "$(tr -d "[:space:]" < .nvmrc)" >/dev/null && npm test'`
- `bash -lc 'source "$HOME/.nvm/nvm.sh" && nvm use --delete-prefix "$(tr -d "[:space:]" < .nvmrc)" >/dev/null && npm run lint'`
- `bash -lc 'source "$HOME/.nvm/nvm.sh" && nvm use --delete-prefix "$(tr -d "[:space:]" < .nvmrc)" >/dev/null && npm run typecheck'`
- `./scripts/with-node.sh npm test -- src/features/workspace-persistence/reopen-workspace.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts tests/integration/workspace-reopen.test.ts`
- `./scripts/with-node.sh npm test`
- `./scripts/with-node.sh npm run lint`
- `./scripts/with-node.sh npm run typecheck`
- `bash -lc 'tmpdir="$(mktemp -d)"; printf ... >"$tmpdir/nvm.sh"; NVM_DIR="$tmpdir" ./scripts/with-node.sh true'`
- `./scripts/with-node.sh npm test -- src/services/persistence/repositories/workspace-repository.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts tests/integration/workspace-reopen.test.ts`
- `./scripts/with-node.sh npm test`
- `./scripts/with-node.sh npm run lint`
- `./scripts/with-node.sh npm run typecheck`
- `./scripts/with-node.sh npm test -- src/services/persistence/repositories/workspace-repository.spec.ts`
- `./scripts/with-node.sh npm test -- src/services/persistence/repositories/workspace-repository.spec.ts tests/integration/workspace-reopen.test.ts`
- `./scripts/with-node.sh npm test`
- `./scripts/with-node.sh npm run lint`
- `./scripts/with-node.sh npm run typecheck`
- `./scripts/with-node.sh npm test -- src/stores/workspace-kernel/workspace-kernel.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts src/services/persistence/repositories/workspace-repository.spec.ts tests/integration/workspace-reopen.test.ts`
- `./scripts/with-node.sh npm run typecheck`
- `./scripts/with-node.sh npm run lint`
- `./scripts/with-node.sh npm test`
- `./scripts/with-node.sh npm run lint`
- `./scripts/with-node.sh npm run typecheck`
- `bash -lc 'tmp="$(mktemp)"; git diff -- _bmad-output/implementation-artifacts/1-5-localize-reopen-errors-and-provide-repair-entry-points.md _bmad-output/implementation-artifacts/sprint-status.yaml scripts/with-node.sh src/domain/trust/selectors.ts src/features/workspace-persistence/reopen-workspace.spec.ts src/features/workspace-persistence/reopen-workspace.ts src/features/workspace-persistence/save-workspace.ts src/schemas/workspace/workspace-snapshot.ts src/services/persistence/repositories/workspace-repository.spec.ts src/services/persistence/repositories/workspace-repository.ts src/stores/workspace-kernel/reducers.ts src/stores/workspace-kernel/selectors.ts src/stores/workspace-kernel/store.ts src/stores/workspace-kernel/types.ts src/stores/workspace-kernel/workspace-kernel.spec.ts tests/integration/workspace-reopen.test.ts > "$tmp"; for file in _bmad-output/implementation-artifacts/1-5-review-acceptance-auditor-prompt.md _bmad-output/implementation-artifacts/1-5-review-blind-hunter-prompt.md _bmad-output/implementation-artifacts/1-5-review-edge-case-hunter-prompt.md _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-19-story-1-5-scope-correction.md; do git diff --no-index -- /dev/null "$file" >> "$tmp" || true; done; mv "$tmp" _bmad-output/implementation-artifacts/1-5-review-diff-working-tree.patch'`
- `./scripts/with-node.sh npm test -- src/features/workspace-persistence/reopen-workspace.spec.ts tests/integration/workspace-reopen.test.ts`
- `./scripts/with-node.sh npm test`
- `./scripts/with-node.sh npm run lint`
- `./scripts/with-node.sh npm run typecheck`
- `./scripts/with-node.sh npm test -- src/stores/workspace-kernel/workspace-kernel.spec.ts tests/integration/workspace-reopen.test.ts`
- `./scripts/with-node.sh npm run lint`
- `./scripts/with-node.sh npm run typecheck`
- `./scripts/with-node.sh npm test`
- `bash -lc 'tmp="$(mktemp)"; git diff -- _bmad-output/implementation-artifacts/1-5-localize-reopen-errors-and-provide-repair-entry-points.md _bmad-output/implementation-artifacts/sprint-status.yaml scripts/with-node.sh src/domain/trust/selectors.ts src/features/workspace-persistence/reopen-workspace.spec.ts src/features/workspace-persistence/reopen-workspace.ts src/features/workspace-persistence/save-workspace.ts src/schemas/workspace/workspace-snapshot.ts src/services/persistence/repositories/workspace-repository.spec.ts src/services/persistence/repositories/workspace-repository.ts src/stores/workspace-kernel/reducers.ts src/stores/workspace-kernel/selectors.ts src/stores/workspace-kernel/store.ts src/stores/workspace-kernel/types.ts src/stores/workspace-kernel/workspace-kernel.spec.ts tests/integration/workspace-reopen.test.ts _bmad-output/planning-artifacts/epic-1-stories.md > "$tmp"; for file in _bmad-output/implementation-artifacts/1-5-review-acceptance-auditor-prompt.md _bmad-output/implementation-artifacts/1-5-review-blind-hunter-prompt.md _bmad-output/implementation-artifacts/1-5-review-edge-case-hunter-prompt.md _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-19-story-1-5-scope-correction.md; do git diff --no-index -- /dev/null "$file" >> "$tmp" || true; done; mv "$tmp" _bmad-output/implementation-artifacts/1-5-review-diff-working-tree.patch'`
- `./scripts/with-node.sh npm test -- src/stores/workspace-kernel/workspace-kernel.spec.ts`
- `./scripts/with-node.sh npm run typecheck`
- `./scripts/with-node.sh npm run lint`
- `./scripts/with-node.sh npm test -- src/stores/workspace-kernel/workspace-kernel.spec.ts tests/integration/workspace-reopen.test.ts`
- `bash -lc 'tmp="$(mktemp)"; git diff -- _bmad-output/implementation-artifacts/1-5-localize-reopen-errors-and-provide-repair-entry-points.md _bmad-output/implementation-artifacts/sprint-status.yaml scripts/with-node.sh src/domain/trust/selectors.ts src/features/workspace-persistence/reopen-workspace.spec.ts src/features/workspace-persistence/reopen-workspace.ts src/features/workspace-persistence/save-workspace.ts src/schemas/workspace/workspace-snapshot.ts src/services/persistence/repositories/workspace-repository.spec.ts src/services/persistence/repositories/workspace-repository.ts src/stores/workspace-kernel/reducers.ts src/stores/workspace-kernel/selectors.ts src/stores/workspace-kernel/store.ts src/stores/workspace-kernel/types.ts src/stores/workspace-kernel/workspace-kernel.spec.ts tests/integration/workspace-reopen.test.ts _bmad-output/planning-artifacts/epic-1-stories.md > "$tmp"; for file in _bmad-output/implementation-artifacts/1-5-review-acceptance-auditor-prompt.md _bmad-output/implementation-artifacts/1-5-review-blind-hunter-prompt.md _bmad-output/implementation-artifacts/1-5-review-edge-case-hunter-prompt.md _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-19-story-1-5-scope-correction.md src/stores/workspace-kernel/dataset-file-handle-metadata.ts; do git diff --no-index -- /dev/null "$file" >> "$tmp" || true; done; mv "$tmp" _bmad-output/implementation-artifacts/1-5-review-diff-working-tree.patch'`
- `./scripts/with-node.sh npm test`
- `./scripts/with-node.sh npm run lint`
- `./scripts/with-node.sh npm run typecheck`

### Implementation Plan

- Add failing reopen and selector tests for localized repair entry points, scope/impact summaries, and deferred issue persistence.
- Extend reopen issue construction to populate stable repair actions and entity-linked diagnostics without dropping unaffected workspace state.
- Expose reopen repair summaries through shared trust/readiness selectors so deferred issues remain visible after reopen and later issue updates.
- Extend the persistence contract with dataset source-file metadata and persisted dataset file-handle references so reopen can localize missing file-handle failures without dropping valid datasets.
- Reuse one dataset file-handle compatibility predicate across reopen warning emission and retained-handle hydration, and keep the frozen review comparison set aligned with the current narrowed story scope.

### Completion Notes List

- This story converts currently deterministically detectable reopen drift handling into explicit localized issue records plus first repair-entry hooks.
- Unresolved issues remain visible in trust/readiness state so later review and handoff flows inherit the same problem signals.
- Reopen issue creation now localizes stale formulas, saved graph-selection drift, saved issue-record drift, ledger failures, and other currently deterministically detectable reopen failures to the affected scope and assigns stable repair commands for repair-card entry points.
- Shared trust and kernel selectors now expose repair-entry summaries with scope and impact labels so deferred reopen issues remain visible without dropping unaffected workspace state.
- Added unit and integration coverage for localized reopen repair actions, selector summaries, and deferred-issue persistence after reopen.
- Semantic transform reopen validation and incompatible graph-composition or layer reopen validation are explicitly deferred to Story 1.6 by the approved sprint correction.
- Resolved the reopen review follow-up by sanitizing invalid persisted entity ids before issue-record parsing and covering the regression with a focused reopen spec.
- Linux `node_modules` were installed with `npm ci` under the repo-pinned Node runtime so validation could run in WSL after the local runtime bootstrap exposed a missing dependency install.
- Resolved the remaining reopen review follow-up by sanitizing invalid saved active/reference graph selection ids before issue emission and routing the repair entry point to the valid graph selected during reopen.
- Resolved the remaining reopen review follow-up by adding explicit `Ledger entry` and `Saved issue record` scope labels in trust repair selectors.
- Malformed-but-normalizable saved active/reference graph selections now remain explicit `workspace.reopen.graph.invalid-selection` issues even when normalization resolves to a valid reopened graph, with focused reopen coverage for both selection paths.
- Resolved the remaining reopen review follow-up by preserving active/reference graph-selection provenance in reopen issue records, keeping repair actions targeted to the replacement graph, and differentiating normalization-only warnings from true fallback selections.
- Resolved the remaining reopen review follow-up by dropping resolved reopen issues from readiness reconciliation while preserving explicit non-issue warning/block states during reopen and later kernel issue updates.
- Added integration coverage for graph-selection scope labels plus saved issue-record and ledger reopen scope labels, and hardened `scripts/with-node.sh` so activation failures surface directly instead of retrying `nvm install`.
- Resolved the final narrowed Story 1.5 review item by persisting dataset source-file metadata plus dataset file-handle references, localizing missing file handles as dataset-scoped reopen issues, and covering the contract with repository, reopen, integration, full Vitest, lint, and typecheck validation.
- Corrected the dataset file-handle persistence path so the default `InMemoryWorkspaceStorage` no longer `structuredClone`s live handle methods, and added repository plus integration coverage that exercises the real default save/reopen path.
- Reopened kernel sessions now retain persisted dataset file handles for subsequent saves, and the save path reuses that preserved handle state so reopen-save-reopen no longer reintroduces false missing-file-handle warnings.
- Refreshed the Story 1.5 reviewer prompts and regenerated the frozen working-tree diff artifact so the review set now reflects the current save/schema/repository/kernel scope and latest in-scope working-tree delta.
- Reopen now requires `datasetId`, `fileName`, and `fileHandleToken` to agree before a persisted dataset file handle suppresses a missing-handle warning, and focused unit plus integration coverage exercises the token-collision mismatch path.
- Refreshed the Story 1.5 reviewer prompts and frozen working-tree diff artifact to keep the intentionally in-scope `epic-1-stories.md` planning delta inside the current review comparison set.
- `replaceSnapshot` now clears dataset file handles by default and can atomically install replacement handles with the incoming snapshot, preventing stale-handle leakage across reopened workspaces and later save cycles.
- Explicit dataset handle replacements now synchronize canonical dataset `sourceFile` metadata before save and in kernel state, so relinked datasets with renamed source files round-trip cleanly through save and reopen without false missing-file-handle issues.
- `replaceSnapshot` now also normalizes the incoming replacement snapshot against explicit replacement dataset handles before that snapshot becomes canonical kernel state, preventing later implicit saves from persisting stale dataset `sourceFile` metadata.
- Refreshed Story 1.5 review prompts and the frozen working-tree diff artifact to explicitly include `src/stores/workspace-kernel/dataset-file-handle-metadata.ts` in the required review comparison set.
- `saveWorkspaceKernel` now normalizes snapshot dataset `sourceFile` metadata against whichever dataset handles are actually being persisted, including implicit retained-handle saves, and integration coverage proves the save -> reopen -> implicit save -> reopen path no longer emits a false missing-handle warning.

### File List

- `_bmad-output/implementation-artifacts/1-5-localize-reopen-errors-and-provide-repair-entry-points.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-5-review-acceptance-auditor-prompt.md`
- `_bmad-output/implementation-artifacts/1-5-review-blind-hunter-prompt.md`
- `_bmad-output/implementation-artifacts/1-5-review-diff-f888a1d-to-6ae38f1.patch`
- `_bmad-output/implementation-artifacts/1-5-review-diff-working-tree.patch`
- `_bmad-output/implementation-artifacts/1-5-review-edge-case-hunter-prompt.md`
- `_bmad-output/planning-artifacts/epic-1-stories.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-19-story-1-5-scope-correction.md`
- `src/domain/trust/selectors.spec.ts`
- `src/domain/trust/selectors.ts`
- `src/features/workspace-persistence/reopen-workspace.spec.ts`
- `src/features/workspace-persistence/reopen-workspace.ts`
- `src/features/workspace-persistence/save-workspace.ts`
- `src/schemas/workspace/workspace-snapshot.ts`
- `src/services/persistence/repositories/workspace-repository.spec.ts`
- `src/services/persistence/repositories/workspace-repository.ts`
- `src/stores/workspace-kernel/dataset-file-handle-metadata.ts`
- `src/stores/workspace-kernel/reducers.ts`
- `src/stores/workspace-kernel/selectors.ts`
- `src/stores/workspace-kernel/store.ts`
- `src/stores/workspace-kernel/types.ts`
- `src/stores/workspace-kernel/workspace-kernel.spec.ts`
- `scripts/with-node.sh`
- `tests/integration/workspace-reopen.test.ts`

### Change Log

- 2026-04-17: Story moved to in-progress for implementation.
- 2026-04-17: Added localized reopen repair actions, trust/kernel repair-entry selectors, and deferred-repair persistence coverage; validated with targeted tests, full Vitest, lint, and typecheck.
- 2026-04-17: Addressed code review findings - 1 item resolved; sanitized localized entity ids before writing reopen issue records and revalidated with reopen spec, full Vitest, lint, and typecheck.
- 2026-04-19: Addressed the remaining code review findings - 3 items resolved; sanitized invalid saved graph selection ids, added explicit ledger/issue-record scope labels, normalized `sprint-status.yaml` line endings while promoting the story to review, and revalidated with focused reopen tests, full Vitest, lint, and typecheck.
- 2026-04-19: Addressed a follow-up reopen selection regression; normalization drift in saved active/reference graph selections now emits `workspace.reopen.graph.invalid-selection` even when reopen can normalize to a valid graph, revalidated with focused reopen tests, integration reopen coverage, lint, and typecheck while keeping the story in review.
- 2026-04-19: Addressed the final 6 review follow-ups; fixed readiness reconciliation for resolved reopen issues, preserved graph-selection provenance with accurate normalization/fallback messaging, added integration coverage for invalid-selection and scope labels, hardened `with-node.sh` activation handling, and revalidated with focused tests, full Vitest, lint, typecheck, and an activation-failure smoke check.
- 2026-04-19: Narrowed Story 1.5 scope to currently deterministically detectable reopen failures for a fresh review pass and explicitly deferred semantic transform and incompatible graph-composition or layer reopen validation to Story 1.6 while keeping the story in review.
- 2026-04-19: Addressed the remaining review item by extending the persistence/reopen contract for dataset source-file handles, localizing missing file handles on reopen, and revalidating with focused repository/reopen/integration tests plus full Vitest, lint, and typecheck before promoting the story back to review.
- 2026-04-19: Corrected the default in-memory persistence path for live dataset file handles, replaced the masked repository stub coverage with the real adapter, added save/reopen integration coverage, reran full Vitest, lint, and typecheck, and promoted the story back to review.
- 2026-04-19: Fresh review pass found a remaining save-path regression: reopened sessions do not preserve dataset file handles for a later save, so the story moved back to in-progress pending another implementation pass.
- 2026-04-19: Preserved dataset file handles in reopened kernel sessions, taught the save path to reuse retained handles automatically, added explicit reopen-save-reopen coverage plus kernel-state coverage, reran focused tests, lint, and typecheck, and moved the story back to review.
- 2026-04-19: Fresh review pass found the generated Story 1.5 review prompt/diff artifacts are stale for the current scope and working tree, so the story moved back to in-progress pending artifact refresh.
- 2026-04-19: Refreshed the Story 1.5 reviewer prompts to enumerate the full current comparison set, regenerated the frozen working-tree diff artifact against the current in-scope files, reran full Vitest, lint, and typecheck, and returned the story to review.
- 2026-04-19: Fresh review pass found a remaining reopen validation gap for mismatched persisted dataset file-handle metadata and confirmed the regenerated review artifacts still exclude the intentionally in-scope `epic-1-stories.md` planning diff, so the story moved back to in-progress pending another implementation pass.
- 2026-04-19: Addressed the final 2 review follow-ups; aligned missing-file-handle reopen compatibility with retained-handle validation, added focused mismatch regression coverage, expanded the reviewer comparison set to include `epic-1-stories.md`, reran focused reopen tests plus full Vitest, lint, and typecheck, and returned the story to review.
- 2026-04-19: Fresh review pass found a remaining kernel-state regression: `replaceSnapshot` keeps the previous session's dataset file handles attached to the replacement snapshot, so Story 1.5 moved back to in-progress pending another implementation pass.
- 2026-04-19: Cleared dataset file handles as part of kernel snapshot replacement, added regression coverage for both default clearing and explicit replacement handles, reran the focused kernel test plus lint and typecheck, and returned the story to review.
- 2026-04-19: Fresh review pass found a remaining dataset relink regression: explicit dataset file-handle replacements can persist a new handle filename without updating the canonical snapshot source-file metadata, so a later save/reopen cycle will falsely relocalize the dataset as missing its file handle. Story moved back to in-progress pending another implementation pass.
- 2026-04-19: Synchronized canonical dataset source-file metadata with explicit handle replacements in the kernel and save path, added kernel plus save/reopen relink regression coverage, reran focused tests, full Vitest, lint, and typecheck, and returned the story to review.
- 2026-04-19: Fresh review pass found 2 remaining follow-ups: `replaceSnapshot` still does not synchronize incoming snapshot source-file metadata when replacement dataset handles are supplied, and the regenerated Story 1.5 review prompts/diff artifacts still omit `src/stores/workspace-kernel/dataset-file-handle-metadata.ts`, so the story moved back to in-progress pending another implementation pass.
- 2026-04-19: Addressed the final 2 review follow-ups; synchronized replacement snapshots against explicit replacement dataset handles before they become canonical kernel state, added kernel plus save/reopen regression coverage for the later implicit-save path, refreshed the reviewer prompts and frozen working-tree diff to explicitly cover `src/stores/workspace-kernel/dataset-file-handle-metadata.ts`, reran full Vitest, lint, and typecheck, and returned the story to review.
- 2026-04-19: Fresh review pass found 1 remaining follow-up: `saveWorkspaceKernel` still persists stale dataset `sourceFile` metadata when retained kernel dataset handles are reused implicitly, so Story 1.5 moved back to in-progress pending another implementation pass.
- 2026-04-20: Addressed the final review follow-up by synchronizing implicit retained-handle saves against the persisted handle metadata, added integration coverage for the stale-snapshot implicit-save regression, reran focused reopen tests plus full Vitest, lint, and typecheck, and returned the story to review.
- 2026-04-20: Fresh review pass found no remaining Story 1.5 action items after full in-scope file coverage, targeted Vitest validation, and typecheck confirmation, so the story moved to done.
