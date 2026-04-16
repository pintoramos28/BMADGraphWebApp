# Epic 4 Stories

Epic 4: BMAD Graph Authoring Runtime and Reference-Graph Workflow

Goal: Deliver the direct-manipulation graph workflow so users can assign roles, generate default graphs, refine structure and presentation, and promote one graph to the reference graph that drives trust and handoff surfaces.

## Story 4.1: Generate the First Graph from Semantic Role Assignment

As a user,
I want to assign fields to analytical roles and get a credible default graph quickly,
so that I can move from graph-ready data to first visual insight without code.

Dependencies: Story 2.3
Requirements: FR27-FR31, FR37, UX template-assisted first graph scope, core graph catalog

**Acceptance Criteria**

1. Given a graph-ready dataset, when the user assigns fields to supported analytical roles, then the system generates a default graph without requiring scripting.
2. Given default graph generation runs, when the canvas updates, then it reflects the current filtered, transformed, and semantically interpreted analytical state.
3. Given the first-graph flow is used, when supported guidance is enabled, then template-assisted suggestions come only from the locked template IDs in [core-graph-catalog.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/core-graph-catalog.md) and do not obscure the core role-assignment model.

## Story 4.2: Refine Graph Type, Structure, and Presentation Controls

As a user,
I want to change graph structure and presentation details directly,
so that the graph can support both exploration and report-ready communication.

Dependencies: Story 4.1
Requirements: FR30-FR35, NFR2, NFR5, core graph catalog

**Acceptance Criteria**

1. Given a graph exists, when the user changes graph type, assigned variables, or supported elements, then the graph updates in place without losing compatible analytical context and only to graph families allowed by [core-graph-catalog.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/core-graph-catalog.md).
2. Given the user edits labels, legends, scales, axes, titles, subtitles, spacing, or typography, when the update is applied, then the rendered graph reflects the presentation change within the graph-edit latency target.
3. Given the user attempts a four-variable or greater comparison, when the requested encoding exceeds supported performance or compatibility limits, then the system preserves the guarantee by warning or constraining the request clearly.

## Story 4.3: Add Layers, Overlays, and Guardrails for Invalid Compositions

As a user,
I want to add compatible layers and overlays while being protected from misleading graph combinations,
so that the graph remains analytically credible as it becomes more expressive.

Dependencies: Story 4.2
Requirements: FR32, FR36, FR38, NFR2, NFR13, core graph catalog

**Acceptance Criteria**

1. Given a graph is active, when the user adds, removes, reorders, or inspects compatible layers, then the layer structure remains visible and editable.
2. Given the user adds a supported analytical overlay or visual reference, when it is rendered, then it remains tied to the current graph and analytical state and only uses overlay kinds allowed for that family by the locked graph catalog.
3. Given the user requests an unsupported or misleading graph composition, when compatibility rules reject it, then the system explains why the request was blocked and preserves the last valid graph in line with the blocked-combination rules from the locked graph catalog.

## Story 4.4: Promote and Track the Reference Graph

As a user,
I want to distinguish exploratory views from the graph that represents my current analytical conclusion,
so that review, evidence, and export flows follow the right graph.

Dependencies: Stories 4.1-4.3
Requirements: FR57, reference-graph architecture decisions, UX reference-graph rules

**Acceptance Criteria**

1. Given multiple graph views exist, when the user promotes one to reference graph status, then `activeGraphId` and `referenceGraphId` remain distinct and visible.
2. Given the reference graph changes, when promotion succeeds, then Evidence Rail, Mission Log, Handoff Readiness, and export context realign to the promoted graph.
3. Given a graph remains exploratory, when the user navigates the workspace, then it is never visually conflated with the current reference graph.
