# Epic 3 Stories

Epic 3: Reproducible Preparation, Derived Logic, and Repairable State Changes

Goal: Deliver reproducible workspace editing so users can filter, subset, transform, derive, inspect, and repair analytical state changes without losing the valid remainder of the workspace.

## Story 3.1: Filter, Sort, and Subset the Active Analytical View

As a user,
I want to filter, sort, and subset the active dataset,
so that tables, graphs, and statistics stay aligned to the analytical question I am exploring.

Dependencies: Story 2.3
Requirements: FR16, FR17, NFR3, NFR6

**Acceptance Criteria**

1. Given a committed dataset exists, when the user applies a filter, sort, or subset, then the active table, graph consumers, and statistics all reflect the same analytical view.
2. Given a benchmark working dataset, when a single filter or subset change is applied, then recomputation completes within the transform latency target or shows a visible in-progress state.
3. Given subset state changes, when the user saves and reopens the workspace, then the selected analytical view is preserved faithfully.

## Story 3.2: Preview and Commit Structured Data Transformations

As a user,
I want to preview the effect of a transformation before it changes canonical state,
so that I can prepare the dataset without introducing blind edits.

Dependencies: Story 3.1
Requirements: FR15, FR18, FR20, FR25

**Acceptance Criteria**

1. Given a transformation or recode is being authored, when preview mode runs, then the user sees the expected effect before the committed workspace changes.
2. Given the user commits the transformation, when the workspace ledger updates, then the ordered transform sequence records the new step in a reproducible order.
3. Given the user cancels or abandons the preview, when they return to the active workspace, then canonical state remains unchanged.

## Story 3.3: Create and Inspect Derived Columns

As a user,
I want to create formula-derived fields and inspect how they are built,
so that I can extend the dataset analytically without losing traceability.

Dependencies: Story 3.2
Requirements: FR19, FR21, FR22, NFR3, NFR6

**Acceptance Criteria**

1. Given a formula is authored successfully, when it is committed, then the derived column is clearly distinguished from directly imported fields.
2. Given a derived field exists, when the user inspects it, then the formula definition and direct input columns are visible.
3. Given a saved workspace is reopened, when derived fields are restored, then the formula-derived status and dependency metadata are preserved.

## Story 3.4: Repair Failed Transformations and Support Undo

As a user,
I want failed analytical steps to be localized and reversible,
so that iterative exploration remains safe even when a transform or formula breaks.

Dependencies: Stories 3.1-3.3
Requirements: FR23, FR24, FR25, FR26, NFR7-NFR9

**Acceptance Criteria**

1. Given a transform or formula step fails, when validation completes, then the failure is localized to the affected step and unrelated workspace state remains valid.
2. Given a failed step exists, when the user inspects it, then a repair path or revision path is available without requiring the rest of the workspace to be rebuilt.
3. Given the user undoes a recent analytical change, when undo is applied, then the ledger and canonical state roll back consistently and remain reopen-safe.
