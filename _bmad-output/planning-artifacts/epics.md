---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
inputDocuments:
  - /home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md
  - /home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/ux-design-specification.md
  - /home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md
  - /home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/product-brief-BMADGraphWebApp-2026-03-24.md
  - /home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md
  - /home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/index.md
---

# BMADGraphWebApp - Epic Breakdown

## Overview

Note: These epics were regenerated on 2026-04-15 from the locked implementation kickoff baseline and updated on 2026-04-16 after the implementation-readiness course correction. They remain the sequencing layer for delivery, but implementation must not begin from `epics.md` alone. Each epic requires an ordered story breakdown with BDD-style acceptance criteria, dependency-safe sequencing, and explicit testability before development starts.

## Story Artifacts

The approved story layer for this epic set is maintained in companion planning artifacts:

- `epic-1-stories.md`
- `epic-2-stories.md`
- `epic-3-stories.md`
- `epic-4-stories.md`
- `epic-5-stories.md`
- `epic-6-stories.md`

## Re-Baselined Implementation Constraints

- Primary graph runtime is Vega-Lite 6.x authored specs compiled to Vega 6.x at runtime; Apache ECharts 6.0.0 remains the fallback behind the same adapter seam.
- BMAD owns one graph-definition contract; renderer specs are derived artifacts and must not become the persisted workspace source of truth.
- Contract-first implementation is mandatory for `WorkspaceSnapshot`, workspace ledger, issue record, telemetry batch, and release/support boundaries before broad feature UI expansion.
- Canonical routes are fixed at `/`, `/workspace`, `/workspace/:workspaceId`, `/review/:workspaceId`, and `/unsupported`.
- The service worker is shell infrastructure only: asset caching, release/support metadata caching, and update detection stay inside the shell boundary; datasets, workspaces, formulas, telemetry queue state, and graph persistence stay out of the service worker.
- The reference graph is a first-class domain entity distinct from the active exploratory graph; Evidence Rail, Mission Log, Repair Card, Handoff Readiness, and export context follow the reference graph.
- The hosted shell remains thin and operational only. User datasets, transforms, formulas, evidence, and saved workspaces remain local-first and browser-local.
- Epics are sequenced to reduce multi-agent drift: contracts and runtime seams first, then trusted intake, then reproducible prep, then graph authoring, then review/export, then operational hardening.

## Epic List

### Epic 1: Hosted Workspace Entry, Save/Reopen Trust, and Shell Readiness

Users can open BMADGraphWebApp in a supported browser, start or reopen a local workspace, see offline and support status clearly, and continue analysis with valid work preserved even when issues are detected.

**FRs covered:** FR7, FR43, FR44, FR45, FR46, FR47, FR48, FR49, FR59, FR60, FR62

**Primary NFR alignment:** NFR4, NFR6, NFR7, NFR8, NFR9, NFR10, NFR15, NFR16, NFR18, NFR19, NFR20, NFR22, NFR24

**Implementation emphasis:**
- Author shared schema baselines first: graph definition, workspace snapshot, workspace ledger, issue record, telemetry envelope, worker message envelopes, and release/support metadata.
- Stand up the `WorkspaceKernel` with explicit separation between canonical persisted state and ephemeral view state.
- Lock canonical routes and route helpers before route-owned screens diverge.
- Implement hosted-shell bootstrap, environment gating, release-manifest loading, and service-worker registration at the shell layer only.
- Add benchmark fixtures and runtime seam tests early so later graph work lands against the locked adapter boundary instead of renderer-specific shortcuts.

**Why this epic is first:**
- It creates the first trustworthy user entry point into the hosted shell and workspace lifecycle while still locking the contracts that later feature teams depend on.

### Epic 2: Trusted Import, Semantic Activation, and Guided Onboarding

Users can bring local data into the workspace, preview and repair messy intake, confirm semantics and metadata, and reach a trustworthy graph-ready starting point without specialist help.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR50, FR51, FR52, FR58

**Primary NFR alignment:** NFR1, NFR7, NFR11, NFR12, NFR13, NFR14, NFR17

**Implementation emphasis:**
- Build import preview and commit flows against the shared issue-record contract rather than ad hoc error banners.
- Lock semantic-role, data-type, units, and measurement-context editing into the canonical workspace model so later graphs, stats, and exports consume one source of truth.
- Establish the first guided-help and repair patterns in import and semantic correction, since those flows are the lowest-risk place to define recovery UX and accessibility patterns that later epics will reuse.
- Ensure intake, uncertainty confirmation, and semantic overrides emit canonical ledger events instead of local-only component history.

### Epic 3: Reproducible Preparation, Derived Logic, and Repairable State Changes

Users can transform data, create derived fields, inspect ordered analytical changes, and recover from formula or transform failures without losing the valid remainder of the workspace.

**FRs covered:** FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26

**Primary NFR alignment:** NFR3, NFR6, NFR7, NFR8, NFR9, NFR11, NFR12, NFR14

**Implementation emphasis:**
- Implement transform, filter, subset, and formula worker contracts against the canonical snapshot and ledger shapes rather than feature-local state.
- Use the issue-record contract and repair actions as the only recovery path for failed formulas, invalid transforms, and drift-induced breakage.
- Make ordered transformation history and undo land on the append-only ledger plus canonical state transitions, not on UI-local stacks that bypass reproducibility.
- Preserve valid unaffected state whenever one transform or formula fails.

### Epic 4: BMAD Graph Authoring Runtime and Reference-Graph Workflow

Users can build graphs through BMAD-owned role assignment, render them through the locked adapter boundary, and promote one graph into the reference graph that drives trust surfaces and later handoff.

**FRs covered:** FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37, FR38, FR57

**Primary NFR alignment:** NFR2, NFR5, NFR11, NFR12, NFR13, NFR14, NFR17

**Implementation emphasis:**
- Build the Semantic Role Dock and graph-workspace flows on the BMAD graph-definition contract, not on raw Vega-Lite or raw ECharts payloads.
- Keep renderer execution inside one `graph-runtime` seam that compiles BMAD graph definitions to Vega-Lite first and Vega by exception.
- Treat ECharts as a fallback implementation path behind the same adapter only if benchmark evidence fails the locked performance thresholds.
- Make reference-graph promotion a structural domain event that immediately realigns Evidence Rail, Mission Log, readiness, and export context.
- Preserve the distinction between active exploratory graph and reference graph in state, routing, and UI.

### Epic 5: Statistical Context, Evidence, Review, and Handoff Readiness

Users and reviewers can inspect statistical context, evidence, provenance, mission history, and handoff blockers around the reference graph before approving exports or downstream use.

**FRs covered:** FR39, FR40, FR41, FR42, FR53, FR54, FR55, FR56

**Primary NFR alignment:** NFR6, NFR7, NFR9, NFR11, NFR12, NFR13, NFR14

**Implementation emphasis:**
- Build statistical outputs so they remain graph-state-aware and subset-aware rather than detached from the current analytical context.
- Use Evidence Rail, Mission Log, Handoff Readiness, Repair Card, and Workspace Snapshot Export Card as domain-backed trust surfaces that all consume shared selectors.
- Make export readiness depend on provenance completeness, unresolved issue state, telemetry snapshot, and reference-graph identity rather than a final-screen-only check.
- Keep review and handoff centered on the promoted reference graph so the product stays aligned with the UX trust model and the architecture's persistence model.

### Epic 6: Operational Trust, Telemetry Transparency, and Release Confidence

Users can understand offline readiness, update state, support status, and privacy-preserving telemetry behavior clearly enough to trust BMADGraphWebApp during serious analytical work.

**FRs covered:** FR61

**Primary NFR alignment:** NFR2, NFR3, NFR4, NFR5, NFR15, NFR16, NFR17, NFR18, NFR19, NFR20, NFR21, NFR22, NFR23, NFR24

**Implementation emphasis:**
- Finalize the telemetry batch contract, local queue behavior, redaction tests, and flush/retry behavior in application services rather than the service worker.
- Harden release manifest, support-matrix delivery, update prompts, and integrity checks as shell concerns.
- Validate performance and reopen behavior against benchmark datasets and saved workspaces as release-shaping gates, not late QA nice-to-haves.
- Add the accessibility, offline-ready, queue-age, service-worker upgrade, and benchmark regression coverage needed to keep the hosted-shell model trustworthy in production.

## FR Coverage Map

- FR1-FR6 -> Epic 2
- FR7 -> Epic 1
- FR8-FR14 -> Epic 2
- FR15-FR26 -> Epic 3
- FR27-FR38 -> Epic 4
- FR39-FR42 -> Epic 5
- FR43-FR49 -> Epic 1
- FR50-FR52 -> Epic 2
- FR53-FR56 -> Epic 5
- FR57 -> Epic 4
- FR58 -> Epic 2
- FR59-FR60 -> Epic 1
- FR61 -> Epic 6
- FR62 -> Epic 1

## Sequencing Notes

- Epic 1 leads with user-visible shell entry, save/reopen trust, and readiness cues while still locking the contract seams that later feature work must honor.
- Epic 2 begins end-user workflow breadth only after the workspace kernel, shell boundary, and persistence contracts exist.
- Epic 3 extends the same contract set into transforms, formulas, ledger history, and repair.
- Epic 4 is the first place broad graph-authoring UX should expand, because it depends on the already-locked graph-definition and renderer boundary.
- Epic 5 adds the trust surfaces that depend on reference-graph identity, issue contracts, ledger history, and stable export/readiness rules.
- Epic 6 turns shell hardening and telemetry behavior into user-visible trust outcomes once the analytical workflow is in place, without moving product state into operational infrastructure.

## Clarified Decisions Before Story Creation

- Story artifacts are now mandatory before implementation starts; epics alone are not implementation-ready.
- The canonical reviewer workflow is local and in-app: a reviewer imports or reopens a workspace in BMADGraphWebApp review mode on their own machine.
- Provenance and mission-log identity are modeled as origin labels for a single-user/local-review MVP, not as live multi-user presence.
- Advanced graph behaviors such as dual-axis comparison, ridgeline small multiples, broad template-gallery depth, and KPI-card-heavy overlays are not assumed to be locked MVP scope unless the PRD says so explicitly.
