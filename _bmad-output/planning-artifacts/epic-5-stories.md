# Epic 5 Stories

Epic 5: Statistical Context, Evidence, Review, and Handoff Readiness

Goal: Deliver the review and trust workflow so users can inspect graph-tied statistical context, provenance, and handoff blockers around the reference graph before export or downstream use.

## Story 5.1: Generate Graph-Tied Statistical Context

As a user,
I want descriptive summaries and one supported fit or regression path tied to the current graph,
so that the analytical context stays attached to the visual I am interpreting.

Dependencies: Story 4.2
Requirements: FR39-FR42, NFR13

**Acceptance Criteria**

1. Given a graph or active analytical view exists, when the user requests statistical context, then descriptive summaries reflect the current subset and graph state rather than detached raw input alone.
2. Given the supported fit or regression path is used, when the result is shown, then it is labeled in plain language with the data context and exploratory framing.
3. Given graph or subset state changes, when statistics are recalculated, then the visible output stays synchronized with the current analytical state.

## Story 5.2: Attach Evidence and Mission History to the Reference Graph

As a user,
I want evidence and mission-log history to follow the reference graph,
so that the reasoning behind the working analytical conclusion remains inspectable.

Dependencies: Story 4.4 and Story 3.4
Requirements: FR53, FR54, reference-graph and provenance architecture rules

**Acceptance Criteria**

1. Given a reference graph is selected, when the Evidence Rail is opened, then notes, transform summary, provenance, overlays, and unresolved issues follow that graph rather than the frontmost exploratory tab.
2. Given meaningful analytical events occur, when the Mission Log updates, then each entry records the graph association, timestamp, origin label, and telemetry snapshot when relevant.
3. Given a repair or drift resolution occurs, when the user later reviews the workspace, then the event history shows what changed, when it changed, and what initiated the change.

## Story 5.3: Review a Workspace in Local In-App Review Mode

As a reviewer,
I want to inspect a workspace in BMADGraphWebApp review mode on my own machine,
so that I can evaluate graph credibility without needing shared live collaboration features.

Dependencies: Stories 5.1-5.2 and Story 1.5
Requirements: FR53, FR54, canonical local review workflow

**Acceptance Criteria**

1. Given a reviewer imports or reopens a workspace locally, when review mode is entered, then the app uses the canonical `/review/:workspaceId` presentation without implying shared remote state.
2. Given review mode is active, when the reviewer inspects the workspace, then derived fields, semantic choices, provenance, unresolved issues, and telemetry trust state are accessible without returning to authoring mode.
3. Given evidence is incomplete or integrity checks fail, when the reviewer evaluates the workspace, then the system blocks approval clearly and preserves the reason in review-facing trust state.

## Story 5.4: Gate Export on Handoff Readiness

As a user,
I want export and handoff to reflect readiness rules tied to the reference graph,
so that downstream consumers receive a credible workspace package rather than an ambiguous snapshot.

Dependencies: Stories 5.1-5.3
Requirements: FR55, FR56, handoff readiness and export integrity requirements

**Acceptance Criteria**

1. Given the user prepares export, when handoff readiness is evaluated, then provenance completeness, unresolved issue state, telemetry health snapshot, and reference-graph identity are checked together.
2. Given export is allowed, when the package is produced, then the output includes the expected graph, transformed data or subset where requested, and the evidence needed by the current handoff rules.
3. Given export is blocked, when the user reviews the blockers, then the system identifies the missing evidence or unresolved state rather than failing silently.
