## Deferred from: code review of 1-7-provide-hosted-shell-bootstrap-metadata-for-local-and-static-delivery.md (2026-04-21)

- Clarify and enforce the `releaseManifest.integrity.manifestSha256` verification contract before treating it as a bootstrap invariant. The placeholder integrity token predates this story, and the current bootstrap validators only enforce token shape rather than a defined verification rule.

## Deferred from: code review of 2-2-resolve-import-uncertainty-and-data-quality-issues-before-commit.md (2026-04-26)

- [P3] Suppress expected route-unmount hydration cancellations from error-level console logging in `src/app/router/shell-routes.tsx:655-660`. Deferred as non-gating console/error-monitoring noise; UI recovers and the issue is outside the adjacent R40 P2 IndexedDB shared-open fix.

## Deferred from: code review of 2-3-edit-semantic-roles-types-units-and-dataset-context.md (2026-04-27)

- [P3] Filter orphan nonsemantic graph issue IDs before live semantic-clear rollback/status restoration in `src/features/semantics/WorkspaceSemanticsPanel.tsx:437-446` and `src/stores/workspace-kernel/reducers.ts:93-104`. Deferred as non-gating defensive cleanup because it requires inconsistent orphan graph issue IDs; accepted semantic edit, rollback, reopen, and summary flows passed validation and runtime probes.
- [P3] Ignore resolved nonsemantic graph issue IDs when reopen restores candidate/reference status after semantic issues clear in `src/features/workspace-persistence/reopen-workspace.ts:623-632`. Deferred as non-gating legacy-state hardening because the finding depends on stale graph issue references to resolved issues and does not block current AC1/AC2/AC3 behavior.
