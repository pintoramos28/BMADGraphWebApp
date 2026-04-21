## Deferred from: code review of 1-7-provide-hosted-shell-bootstrap-metadata-for-local-and-static-delivery.md (2026-04-21)

- Clarify and enforce the `releaseManifest.integrity.manifestSha256` verification contract before treating it as a bootstrap invariant. The placeholder integrity token predates this story, and the current bootstrap validators only enforce token shape rather than a defined verification rule.
