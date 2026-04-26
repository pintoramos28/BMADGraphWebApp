## Deferred from: code review of 1-7-provide-hosted-shell-bootstrap-metadata-for-local-and-static-delivery.md (2026-04-21)

- Clarify and enforce the `releaseManifest.integrity.manifestSha256` verification contract before treating it as a bootstrap invariant. The placeholder integrity token predates this story, and the current bootstrap validators only enforce token shape rather than a defined verification rule.

## Deferred from: code review of 2-2-resolve-import-uncertainty-and-data-quality-issues-before-commit.md (2026-04-26)

- [P3] Suppress expected route-unmount hydration cancellations from error-level console logging in `src/app/router/shell-routes.tsx:655-660`. Deferred as non-gating console/error-monitoring noise; UI recovers and the issue is outside the adjacent R40 P2 IndexedDB shared-open fix.
