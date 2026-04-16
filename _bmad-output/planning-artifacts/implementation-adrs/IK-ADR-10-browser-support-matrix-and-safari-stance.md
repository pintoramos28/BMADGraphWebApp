# IK-ADR-10: Browser Support Matrix And Safari Stance

Status: Proposed
Date: 2026-04-15
Decision owners: Implementation kickoff

## Context

The PRD requires an explicit browser support matrix and says Safari support must be a deliberate decision rather than an assumption. The architecture also requires environment gating before users begin meaningful analytical work, and that gating is tightly coupled to secure-context browser capabilities, the service worker boundary, local persistence, accessibility validation, and desktop-first UX density.

Without a locked browser support decision:

- environment-gating stories will drift
- Safari constraints may distort MVP implementation before the core workflow is stable
- QA scope will widen without a product-level justification

## Decision

Adopt the following MVP browser support matrix:

- Primary supported browsers: current major desktop versions of **Chrome** and **Edge**
- Secondary compatibility target: **Firefox** when feasible, but not release-blocking unless explicitly promoted later
- **Safari is unsupported for MVP**
- Tablet and mobile browsers are unsupported for MVP authoring workflows

Environment gating must block unsupported browsers, including Safari, before users begin import, reopen, or other meaningful analytical work.

## Rationale

- Chrome and Edge align with the architecture's current desktop-first baseline and minimize early capability drift.
- The hosted-shell model, service worker behavior, local persistence boundary, and accessibility QA are easier to stabilize first on a narrow Chromium desktop matrix.
- Treating Firefox as secondary preserves optional validation room without making it a release-shaping requirement prematurely.
- Explicitly excluding Safari from MVP avoids back-solving the core product around an unconstrained compatibility assumption.

## Consequences

Positive:

- shell bootstrap and unsupported-environment UX can use one clear rule set
- MVP QA scope stays aligned to the most likely engineering workplace browsers
- story creation can treat Safari as blocked instead of partially supported

Negative:

- macOS users who default to Safari will need to switch browsers for MVP use
- Firefox validation may remain shallower unless it is later promoted into the primary support matrix
- future Safari support will require a deliberate follow-up decision and validation pass

## Hard Invariants

- Chrome and Edge desktop support are release-blocking for MVP
- Safari is not assumed supported anywhere in MVP implementation
- unsupported-browser messaging must appear before meaningful analytical work begins
- tablet and mobile are not supported authoring environments in MVP

## Recommended Defaults

- Publish the support matrix through the hosted-shell release/support metadata path.
- Treat Firefox as best-effort compatibility until a later ADR or release decision promotes it.
- Keep tablet and mobile limited to future inspection/review discussions rather than partial authoring promises.

## Deferred Details

- the exact major-version floor for Chrome and Edge
- whether Firefox becomes release-blocking in a later phase
- whether a limited tablet review mode is worth formalizing post-MVP

## References

- [prd.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md)
- [architecture.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md)
- [ux-design-specification.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/ux-design-specification.md)
- [implementation-kickoff-decisions.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md)
