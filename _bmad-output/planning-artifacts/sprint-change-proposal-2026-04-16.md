---
date: 2026-04-16
project: BMADGraphWebApp
source_report: /home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-16.md
mode: batch
change_trigger: Implementation readiness assessment found planning artifacts are not implementation-ready.
scope_classification: Moderate
status: approved
approval_date: 2026-04-16
approval_note: User approved the sprint change proposal in-chat.
---

# Sprint Change Proposal

## 1. Issue Summary

The current planning set is **not ready for implementation**. The readiness assessment found that the project has strong PRD, architecture, UX, and epic-level coverage, but the artifact set still breaks the implementation workflow in four ways:

1. There is **no story layer**, so nothing is implementation-ready at the slice level.
2. **Epic 1** and **Epic 6** are still framed as technical milestones rather than user-value increments.
3. The **UX spec is more specific than the PRD and architecture** about graph-template depth, which creates scope drift risk before story writing.
4. The **provenance and review model is ambiguous** across UX and architecture, especially around actor identity and whether review is in-app or external.

This issue was discovered during the pre-implementation readiness gate, before story creation and before coding started. No rollback of implemented software is required because the gap is in planning artifacts rather than shipped code.

### Evidence

- The epics artifact explicitly says stories are omitted: [epics.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epics.md:18)
- The readiness report marks the story gap as a blocking issue: [implementation-readiness-report-2026-04-16.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-16.md:262)
- The readiness report flags Epic 1 and Epic 6 as technical-milestone epics: [implementation-readiness-report-2026-04-16.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-16.md:263)
- The UX spec introduces template and review behaviors that are not locked in the PRD/architecture: [ux-design-specification.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/ux-design-specification.md:244), [ux-design-specification.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/ux-design-specification.md:266)
- The architecture already fixes a canonical in-app review route and starter template baseline that do not yet have story-level execution artifacts: [architecture.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md:94), [architecture.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md:827)

## 2. Checklist Status

| ID | Status | Notes |
| --- | --- | --- |
| 1.1 | [N/A] | No triggering story exists yet; the trigger is the readiness gate itself. |
| 1.2 | [x] Done | Core problem is a planning-readiness failure caused by missing stories, milestone-shaped epics, and unresolved artifact ambiguity. |
| 1.3 | [x] Done | Evidence captured from readiness report, epics, UX, and architecture artifacts. |
| 2.1 | [!] Action-needed | Epic 1 cannot remain as currently framed if implementation is to start from user-value slices. |
| 2.2 | [x] Done | Epic 1 and Epic 6 need reframing; no new epic is strictly required. |
| 2.3 | [x] Done | Epics 2-5 remain viable but require story decomposition and dependency-safe ordering. |
| 2.4 | [x] Done | No future epic is invalidated; new stories are required instead of new epics. |
| 2.5 | [x] Done | Epic order can remain broadly intact, but story sequencing must be added before implementation. |
| 3.1 | [!] Action-needed | PRD needs MVP graph-scope clarification and reviewer-flow wording to prevent story drift. |
| 3.2 | [!] Action-needed | Architecture needs explicit provenance identity rules and one canonical reviewer-flow statement. |
| 3.3 | [!] Action-needed | UX needs scope narrowing for advanced graph patterns and provenance/reviewer terminology aligned to single-user MVP reality. |
| 3.4 | [!] Action-needed | A story artifact set must be created; readiness should be rerun after artifact updates. |
| 4.1 | [x] Viable | Direct adjustment is the lowest-risk path; medium effort, low-to-medium risk. |
| 4.2 | [x] Not viable | No implementation rollback is justified because the issue exists before coding. |
| 4.3 | [x] Viable | Limited PRD MVP clarification is viable, but full MVP reduction is not required. |
| 4.4 | [x] Done | Recommended path is a hybrid: direct adjustment plus targeted MVP clarification. |
| 5.1 | [x] Done | Issue summary defined in Section 1. |
| 5.2 | [x] Done | Epic and artifact impacts are documented in Section 3. |
| 5.3 | [x] Done | Recommended path and rationale are documented in Section 4. |
| 5.4 | [x] Done | MVP impact and action plan are documented in Sections 3 and 4. |
| 5.5 | [x] Done | Handoff plan is documented in Section 6. |
| 6.1 | [x] Done | Applicable checklist items have been covered. |
| 6.2 | [x] Done | Proposal is internally consistent and actionable. |
| 6.3 | [!] Action-needed | User approval is still required. |
| 6.4 | [N/A] | `sprint-status.yaml` was not found; update only after approved epic/story changes exist. |

## 3. Impact Analysis

### Epic Impact

- **Epic 1 requires reframing.** It currently centers contracts, routing, and shell mechanics. It should instead center the user outcome of entering the hosted shell, starting or reopening a workspace, and trusting save/reopen and offline/support signals.
- **Epic 6 requires reframing.** It currently reads as an operational hardening bucket. It should instead center the user-visible outcome of trustworthy offline/update/support/telemetry behavior. The hardening work belongs in stories beneath that outcome.
- **Epics 2-5 remain structurally valid.** Their main course correction is not replacement; it is decomposition into ordered, independently testable stories.
- **Epic order can remain mostly unchanged.** The required change is at the story layer: implementation must begin with a bootstrap/setup story and then proceed through vertical slices instead of treating epics as implementation tickets.

### Story Impact

- A new story layer is mandatory before implementation starts.
- Every story must be independently completable, include BDD-style acceptance criteria, avoid forward dependencies, and clearly identify testability and failure handling.
- The first story must cover the Vite/React bootstrap and shell baseline already mandated by architecture.

### PRD Impact

The PRD is fundamentally sound, but it needs two clarifications:

1. **MVP graph-pattern scope clarification**
   - The PRD should explicitly distinguish mandatory MVP graph behaviors from illustrative or stretch UX patterns.
   - Minimum locked MVP scope should cover:
     - template-assisted first graph generation
     - supported graph families needed for FR27-FR38
     - at least one graph-tied fit/regression path for FR40
     - four-variable encoding within performance guardrails for FR35
   - Advanced patterns such as dual-axis comparison, ridgeline small multiples, broad template ribbons, and KPI-card-heavy graph embellishments should be labeled as either:
     - explicitly in MVP, or
     - post-MVP / stretch, not assumed by default

2. **Canonical reviewer workflow clarification**
   - The PRD should state that MVP review is **local and single-user**.
   - Review happens inside BMADGraphWebApp after the reviewer imports or reopens a workspace on their own machine.
   - MVP does **not** include shared live review, collaborative presence, or approval by another concurrently connected actor.

### Architecture Impact

The architecture needs clarification rather than redesign:

1. **Provenance identity model**
   - Add an explicit `eventSource` / `originType` vocabulary for mission-log and provenance records.
   - Recommended MVP values:
     - `user_action`
     - `system_inference`
     - `repair_action`
     - `workspace_import`
     - `migration_or_version_check`
   - Do not imply multi-user identity, reviewer presence, or distributed authorship in MVP.

2. **Canonical reviewer flow**
   - Clarify that `/review/:workspaceId` is the in-app local review route used after a workspace is imported or reopened on the reviewer's machine.
   - This preserves the architecture's review route without implying cloud-hosted or multi-user review.

3. **Implementation kickoff traceability**
   - The architecture already defines the starter command and early contracts.
   - The course correction is to require a story that executes that baseline rather than leaving it as architecture-only guidance.

### UX Impact

The UX document needs narrowing and terminology cleanup:

1. **Graph pattern scope**
   - Recommended templates, dual-axis comparison, ridgeline small multiples, KPI cards, and broad template ribbons should be marked as:
     - locked MVP requirements,
     - optional MVP stretch, or
     - future inspiration
   - Until that is explicit, story authors will overbuild graph breadth.

2. **Provenance identity language**
   - Replace "who changed what and when" with wording that matches single-user provenance:
     - "what changed, when, and what initiated the change"
   - Replace "reviewer markers" with local annotations or review notes that can be added by whoever opens the workspace in review mode.

3. **Reviewer workflow**
   - Replace ambiguous "own review environment" wording with:
     - "reopens the workspace in BMADGraphWebApp review mode on her own machine"
   - This aligns Elena's flow with the architecture's local review route.

### Secondary Artifact Impact

- Create a planning-artifact story set before implementation begins.
- Rerun implementation readiness after story creation and artifact clarifications.
- Create `sprint-status.yaml` only after approved epic/story changes exist; there is nothing authoritative to update yet.

## 4. Recommended Approach

### Option Evaluation

| Option | Viability | Effort | Risk | Assessment |
| --- | --- | --- | --- | --- |
| Direct Adjustment | Viable | Medium | Low-Medium | Best path. The product direction is still valid; artifacts need correction and decomposition. |
| Potential Rollback | Not viable | Low | Low | No meaningful implementation exists to roll back. |
| PRD MVP Review | Viable | Low-Medium | Low | Needed only as targeted clarification, not as a major scope reduction. |

### Selected Path

**Hybrid: Option 1 (Direct Adjustment) + targeted Option 3 (PRD MVP clarification)**

### Rationale

- The planning set is close to usable; replacing it wholesale would lose momentum without solving the actual ambiguity.
- The readiness report does **not** show a broken product strategy. It shows an incomplete implementation package.
- The fastest safe correction is to:
  1. clarify the few scope ambiguities,
  2. reframe the milestone-shaped epics,
  3. create ordered implementation stories,
  4. rerun readiness.

### Timeline and Risk

- **Timeline impact:** Moderate. This adds a planning pass before story implementation starts.
- **Technical risk:** Low if corrections are made now; high if story creation proceeds without them.
- **Maintainability risk:** Reduced substantially by clarifying provenance, reviewer flow, and graph-scope boundaries before code lands.

## 5. Detailed Change Proposals

### A. Epics Artifact

#### Proposal A1: Remove the "epics only" implementation assumption

**Artifact:** [epics.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epics.md:18)

**OLD**

> Note: These epics were regenerated on 2026-04-15 from the locked implementation kickoff baseline. They replace any older epic assumptions and are intentionally sequenced for contract-first implementation before story creation. Stories are intentionally omitted from this document.

**NEW**

> Note: These epics are the sequencing layer only. Implementation must not begin from `epics.md` alone. Each epic requires an ordered story breakdown with BDD-style acceptance criteria, dependency-safe sequencing, and explicit testability before implementation starts.

**Rationale:** This removes the single largest readiness blocker and aligns the artifact with the workflow standard.

#### Proposal A2: Reframe Epic 1 as a user-outcome epic

**Artifact:** [epics.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epics.md:33)

**OLD**

- Title: `Epic 1: Contract-First Workspace Kernel and Shell Foundations`
- Summary: `Users can enter a supported BMAD hosted shell, create or reopen a contract-valid local workspace, and rely on stable persistence, routing, and shell boundaries before feature breadth expands.`

**NEW**

- Title: `Epic 1: Hosted Workspace Entry, Save/Reopen Trust, and Shell Readiness`
- Summary: `Users can open BMADGraphWebApp in a supported browser, start or reopen a local workspace, see offline and support status clearly, and continue analysis with valid work preserved even when issues are detected.`

**Rationale:** Keeps the same FR/NFR coverage while turning the epic into a user outcome rather than an infrastructure milestone.

#### Proposal A3: Reframe Epic 6 as a user-visible trust epic

**Artifact:** [epics.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epics.md:108)

**OLD**

- Title: `Epic 6: Operational Telemetry, Release Integrity, and Support-Matrix Hardening`
- Summary: `Users can rely on BMADGraphWebApp to remain offline-ready, privacy-preserving, support-matrix-aware, and operationally observable without leaking analytical content off the local machine.`

**NEW**

- Title: `Epic 6: Operational Trust, Telemetry Transparency, and Release Confidence`
- Summary: `Users can understand offline readiness, update state, support status, and privacy-preserving telemetry behavior clearly enough to trust BMADGraphWebApp during serious analytical work.`

**Rationale:** Preserves the operational requirement set while making the epic about observable user value. Hardening and regression work move into stories within this epic.

#### Proposal A4: Add mandatory story decomposition rules

**NEW artifact or appendix section**

- Every epic must have ordered stories before implementation begins.
- Every story must:
  - deliver a user-observable increment or an enabling slice directly tied to one
  - include BDD-style acceptance criteria
  - state dependencies explicitly
  - cover error handling, accessibility, and testability where applicable
  - avoid forward references to undefined stories

**Rationale:** This is the minimum control needed to keep story creation from recreating the same ambiguity.

### B. Story Creation Proposal

#### Proposal B1: Add a starter-template setup story immediately

**Why:** The architecture already requires a Vite/React bootstrap, but no story currently owns it.

**Proposed first story**

- **Story 1.1: Bootstrap hosted shell baseline**
  - Initialize the Vite React TypeScript app from the selected starter.
  - Establish route constants for `/`, `/workspace`, `/workspace/:workspaceId`, `/review/:workspaceId`, and `/unsupported`.
  - Add the initial shell layout, environment gate placeholder, and service-worker registration ownership boundary.
  - Add baseline lint/test/build scripts and a minimal smoke test proving the shell boots.

**Minimum acceptance criteria**

- Given a fresh clone, when the project is installed and started, then the hosted shell loads successfully.
- Given the canonical route constants are imported by screens, when route generation occurs, then only the approved route inventory is used.
- Given service worker support is present, when the shell bootstraps, then registration is owned by the shell layer rather than feature modules.
- Given a CI build runs, when lint, typecheck, and basic test commands execute, then the starter baseline passes.

#### Proposal B2: Define the first Epic 1 story set before any feature implementation

**Recommended minimum Epic 1 story sequence**

1. Story 1.1 Bootstrap hosted shell baseline
2. Story 1.2 Author canonical workspace, issue, provenance, and telemetry contracts
3. Story 1.3 Implement new/open/reopen workspace flow with valid-state preservation
4. Story 1.4 Implement shell readiness surfaces: offline-ready, unsupported environment, update prompt
5. Story 1.5 Implement broken-element detection and localized repair entry points on reopen

**Rationale:** This converts the contract-first baseline into implementable vertical slices without pretending the epic itself is the implementation unit.

### C. PRD Clarification Proposal

#### Proposal C1: Add an explicit MVP graph-scope subsection

**Artifact target:** `prd.md` under MVP scope and graph-building requirements

**OLD**

- No explicit distinction exists between required MVP graph patterns and illustrative UX patterns.

**NEW**

- Add a short subsection named `MVP Graph Pattern Scope`:
  - Required in MVP:
    - template-assisted first graph creation
    - core graph families needed to satisfy FR27-FR38
    - at least one graph-tied fit/regression result
    - four-variable encoding with guardrails
  - Not assumed by default unless separately approved:
    - dual-axis comparison
    - ridgeline small multiples
    - broad template gallery breadth
    - KPI-card-heavy analytical overlays beyond the minimum evidence workflow

**Rationale:** Prevents the UX spec from being interpreted as a mandatory graph-breadth commitment.

#### Proposal C2: Add a canonical reviewer-mode statement

**NEW**

- Add one statement in the review/trust requirement area:
  - `In MVP, reviewer inspection is a local in-app workflow. A reviewer opens or imports a workspace into BMADGraphWebApp on their own machine and uses review surfaces there. Shared live review, concurrent presence, and cloud approval workflows are out of scope.`

**Rationale:** Removes ambiguity without changing the product model.

### D. Architecture Clarification Proposal

#### Proposal D1: Add provenance origin rules

**Artifact target:** `architecture.md` in provenance/domain contracts

**NEW**

- Define an MVP provenance origin model:
  - `user_action`
  - `system_inference`
  - `repair_action`
  - `workspace_import`
  - `migration_or_version_check`
- State explicitly that MVP provenance does not model multiple concurrent human identities inside one live workspace session.

**Rationale:** Keeps Mission Log and provenance state implementable without accidentally creating collaboration requirements.

#### Proposal D2: Clarify review route semantics

**Artifact target:** `architecture.md` near canonical routes and review modules

**NEW**

- `The canonical review flow is local and in-app. /review/:workspaceId represents the review-mode presentation of a workspace that has been reopened or imported on the current machine; it does not imply a shared remote review service.`

**Rationale:** Resolves the UX/architecture mismatch while preserving the route inventory already locked by architecture.

### E. UX Clarification Proposal

#### Proposal E1: Narrow advanced graph behaviors to explicit scope labels

**Artifact targets:** `ux-design-specification.md` sections 2.1-2.5

**OLD**

- The UX currently speaks as though recommended templates, dual-axis flows, ridgelines, KPI cards, and broad template switching are all part of the core signature moment.

**NEW**

- Label each graph behavior as one of:
  - `Locked MVP`
  - `Optional MVP stretch`
  - `Future inspiration`

**Rationale:** Lets UX stay aspirational without silently becoming the implementation backlog.

#### Proposal E2: Align provenance language to single-user MVP

**Artifact targets:** `ux-design-specification.md` reviewer readiness, Evidence Rail, Mission Log

**OLD**

- `who changed what and when`
- `reviewer markers`
- `actor/source label`

**NEW**

- `what changed, when, and what initiated the change`
- `review annotations`
- `origin label`

**Rationale:** Preserves trust UX while removing accidental multi-user implications.

#### Proposal E3: Align Elena's workflow to local in-app review

**Artifact targets:** persona description and review flow language

**OLD**

- Elena re-imports a workspace into her own review environment.

**NEW**

- Elena reopens or imports a workspace into BMADGraphWebApp review mode on her own machine.

**Rationale:** Matches architecture and keeps the MVP single-user/local-first model intact.

## 6. Implementation Handoff

### Scope Classification

**Moderate**

This change does not require product strategy replacement or code rollback, but it does require coordinated planning updates before implementation can start safely.

### Handoff Recipients

- **Product Owner / PM**
  - approve the course correction path
  - update epic framing
  - approve the MVP graph-scope clarification
- **Architect**
  - add provenance origin rules
  - clarify local in-app review semantics
  - ensure the setup story reflects architecture baseline decisions
- **UX Designer**
  - label advanced graph patterns by scope tier
  - revise provenance and reviewer terminology
  - align Elena's review flow wording
- **Developer / Story Author**
  - create the ordered story set
  - add BDD-style acceptance criteria
  - ensure Story 1.1 owns starter bootstrap and shell baseline

### Success Criteria for Handoff Completion

- A story layer exists and covers the epics with ordered, testable slices.
- Epic 1 and Epic 6 read as user-value epics, not milestone buckets.
- PRD, architecture, and UX all agree on:
  - MVP graph scope
  - provenance origin model
  - canonical reviewer workflow
- The implementation readiness assessment is rerun and no longer fails on missing stories or artifact ambiguity.

## 7. Proposed Immediate Action Plan

1. Approve this proposal.
2. Update `epics.md` framing and add story-decomposition rules.
3. Create the story breakdown, starting with Story 1.1 bootstrap and the rest of Epic 1.
4. Apply the PRD, architecture, and UX clarifications.
5. Rerun implementation readiness.

## 8. Workflow Summary

- **Issue addressed:** implementation readiness failure in planning artifacts
- **Change scope:** Moderate
- **Artifacts requiring modification:** epics, stories, PRD clarifications, architecture clarifications, UX clarifications
- **Routed to:** Product Owner / PM, Architect, UX Designer, Developer / Story Author
