# IK-ADR-09: Release Manifest And Compatibility Envelope

Status: Proposed
Date: 2026-04-15
Decision owners: Implementation kickoff

## Context

The hosted shell needs one compatibility-aware source of truth for shell bootstrap, update prompts, service-worker lifecycle coordination, support-matrix delivery, and workspace reopen compatibility. The implementation kickoff baseline already defines the required release-manifest shape in example form, but story creation still needs it promoted into a formal ADR.

Without a locked release manifest decision:

- shell bootstrap and update-prompt stories may drift
- support-gating logic may duplicate compatibility rules in multiple places
- reopen and migration expectations may remain implied rather than contract-backed

## Decision

Adopt a **small, compatibility-aware release manifest** as the hosted shell source of truth.

Required manifest fields:

- `schemaVersion`
- `appBuildVersion`
- `releaseDate`
- `channel`
- `supportMatrixVersion`
- `supportMatrixUrl`
- `workspaceCompatibility`
- `serviceWorker`
- `telemetry`
- `releaseNotes`
- `integrity`

Required compatibility envelope:

- minimum readable workspace format
- maximum readable workspace format range
- explicit migration policy used at workspace open

Required service-worker section:

- service-worker version
- scope
- offline-ready timeout
- update-prompt mode

## Rationale

- Shell bootstrap, support gating, and update behavior need one operational contract instead of scattered constants.
- Compatibility rules belong to the hosted shell boundary, not to feature-local code.
- A narrow manifest preserves the architecture's separation between analytical runtime and operational shell concerns.

## Consequences

Positive:

- environment gating, update prompts, and reopen compatibility can all read from one manifest
- support-matrix and release-note delivery stay aligned with the shell model
- story authors gain one clear contract for shell lifecycle behavior

Negative:

- the manifest becomes a high-signal shell contract and must be versioned carefully
- teams may be tempted to add unrelated operational details unless the boundary is enforced

## Hard Invariants

- the release manifest remains operational and compatibility-focused, not a general backend contract
- workspace compatibility is read from the manifest, not inferred ad hoc in feature code
- update-prompt behavior is shell-owned
- manifest integrity must be verifiable

## Recommended Defaults

- Keep the manifest small and additive.
- Read support-matrix and compatibility-envelope facts during shell bootstrap before meaningful analytical work begins.
- Use migrate-on-open as the default workspace compatibility policy unless a later ADR revises it.
- Keep release notes linked from the manifest rather than embedding broad content directly.

## Deferred Details

- the exact asset-manifest internals
- release-notes content structure
- non-compatibility operational metadata that does not affect the shell contract

## Example

See the release manifest example in [implementation-kickoff-decisions.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md).

## References

- [architecture.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md)
- [implementation-kickoff-decisions.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md)
- [IK-ADR-10 Browser Support Matrix And Safari Stance](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-10-browser-support-matrix-and-safari-stance.md)
