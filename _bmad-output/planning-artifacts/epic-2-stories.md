# Epic 2 Stories

Epic 2: Trusted Import, Semantic Activation, and Guided Onboarding

Goal: Deliver the graph-ready intake flow so users can import local data, correct uncertainty, confirm semantics and metadata, and reach the first trustworthy analytical state without specialist help.

## Story 2.1: Import CSV, Excel, and Pasted Data into a Preview Workspace

As a user,
I want to import local tabular data into a preview state,
so that I can inspect what BMADGraphWebApp understood before committing it to analysis.

Dependencies: Story 1.3
Requirements: FR1, FR2, FR3, NFR1, NFR7

**Acceptance Criteria**

1. Given a CSV, Excel file, or pasted table, when the user starts import, then the system creates a preview state without mutating the committed workspace yet.
2. Given import parsing runs, when preview is shown, then delimiter, header, date, numeric, and uncertainty assumptions are visible to the user before commit.
3. Given benchmark clean files are imported, when preview completes, then preview readiness meets the import performance target or shows a visible in-progress state if the threshold is exceeded.

## Story 2.2: Resolve Import Uncertainty and Data-Quality Issues Before Commit

As a user,
I want to fix parsing and missing-value issues before import is finalized,
so that I can trust the dataset I commit into the workspace.

Dependencies: Story 2.1
Requirements: FR4, FR5, FR6, FR52, NFR7, NFR12

**Acceptance Criteria**

1. Given the system is uncertain about parsing or inferred meaning, when the preview is displayed, then the user can explicitly confirm or correct the uncertain assumptions before continuing.
2. Given missing, invalid, or malformed values are detected, when the user reviews the preview, then the user can choose how those values should be handled in the active analysis.
3. Given the user rejects the preview, when import is canceled, then no partial dataset is committed into the canonical workspace.

## Story 2.3: Edit Semantic Roles, Types, Units, and Dataset Context

As a user,
I want to inspect and adjust each imported column's meaning,
so that downstream graphs, stats, and exports use the correct analytical semantics.

Dependencies: Story 2.2
Requirements: FR8-FR14, FR58, NFR11-NFR14

**Acceptance Criteria**

1. Given an imported dataset is active, when the user inspects a column, then type, role, label, units, and measurement context are visible and editable.
2. Given the user selects or changes a column data type after import, when the semantic edit is validated, then the selected type is checked against the column's actual committed values and incompatible selections are surfaced as issue-backed semantic validation feedback before the choice is treated as graph-ready.
3. Given a semantic edit is committed, when downstream analytical state recalculates, then active graph and summary consumers use the updated semantics without requiring re-import.
4. Given the dataset is graph-ready, when the user views the working context, then the active semantic choices are summarized clearly before graphing begins.

## Story 2.4: Deliver Guided Onboarding and Recovery Through Intake

As a non-technical user,
I want contextual guidance during import and semantic correction,
so that I can complete the first trustworthy dataset setup without escalating to a specialist.

Dependencies: Stories 2.1-2.3
Requirements: FR50, FR51, FR52, NFR11-NFR14, UX onboarding patterns

**Acceptance Criteria**

1. Given a first-run or low-confidence workflow, when the user enters import or semantic correction, then contextual guidance explains the next safe action without blocking expert flow.
2. Given an import or semantic issue occurs, when the system surfaces recovery guidance, then the explanation includes what happened, what the user can do next, and what analytical state is still valid.
3. Given keyboard-only navigation is used, when guidance and repair UI are accessed, then all core actions remain operable without drag-only or pointer-only interaction.
