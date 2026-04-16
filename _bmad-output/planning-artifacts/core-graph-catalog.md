# BMADGraphWebApp Core Graph Catalog

Status: approved planning baseline  
Date: 2026-04-16

## Purpose

This artifact locks the **MVP graph family inventory** for BMADGraphWebApp at planning depth. It defines:

- which graph families are in locked MVP scope
- which graph patterns remain optional stretch or future scope
- which first-graph templates are allowed in MVP
- which role assignments, overlays, and major combinations are valid or blocked

This document is the planning source of truth for Epic 4 implementation. It does not replace renderer-level adapter design or UI-detail decisions.

## Scope Boundary

This catalog defines the graph contract at the BMAD planning layer.

- It **does define** MVP graph families, template IDs, supported encodings, overlay availability, and major blocked combinations.
- It **does not define** Vega-Lite spec details, final UI wording, exact control layouts, or advanced renderer exceptions beyond the planning boundary.
- `reference graph` is **not** a graph family. It is a graph lifecycle state that can apply to any supported graph view.

## Locked MVP Graph Families

The locked MVP graph family enum is:

- `scatter`
- `line`
- `bar`
- `histogram`
- `boxplot`

These five families are sufficient to cover the MVP analytical loop across exploratory relationships, trend inspection, categorical comparison, and basic distribution analysis without expanding into expert-tool breadth too early.

## Locked MVP Family Definitions

### 1. `scatter`

**Purpose:** continuous relationship analysis, anomaly inspection, and first-pass multivariate exploration.  
**Primary marks:** point  
**Required role support:** `x`, `y`  
**Optional role support:** `color`, `size`, `facetRow`, `facetColumn`  
**Allowed overlays:** linear regression, reference line, threshold band  
**Locked MVP use cases:** relationship analysis, first graph for two quantitative variables, bubble-style comparison when `size` is used

### 2. `line`

**Purpose:** ordered trend analysis across time or another ordered continuous domain.  
**Primary marks:** line, optional point markers  
**Required role support:** `x`, `y`  
**Optional role support:** `color`, `facetRow`, `facetColumn`  
**Allowed overlays:** linear regression, reference line, threshold band  
**Locked MVP use cases:** trend over time, grouped trend comparison, report-ready trend communication

### 3. `bar`

**Purpose:** categorical comparison and aggregated summary views.  
**Primary marks:** bar  
**Required role support:** `x`, `y`  
**Optional role support:** `color`, `facetRow`, `facetColumn`  
**Allowed overlays:** reference line, threshold band  
**Locked MVP use cases:** category comparison, grouped category comparison, summary output for report-ready communication

### 4. `histogram`

**Purpose:** single-variable distribution inspection.  
**Primary marks:** binned bar  
**Required role support:** one quantitative measure on `x` or `y` depending on orientation  
**Optional role support:** `color` only when it does not create misleading distribution comparisons; no size encoding  
**Allowed overlays:** reference line, threshold band  
**Locked MVP use cases:** shape inspection, spread inspection, missing-value/repair follow-up for one measure

### 5. `boxplot`

**Purpose:** grouped distribution comparison with compact outlier visibility.  
**Primary marks:** box plot  
**Required role support:** one categorical grouping role and one quantitative measure  
**Optional role support:** `color`, `facetRow`, `facetColumn`  
**Allowed overlays:** reference line, threshold band  
**Locked MVP use cases:** grouped spread comparison, outlier-aware summary, review-friendly distribution checks

## Locked MVP Template Set

The allowed MVP `templateId` inventory is:

- `tpl_scatter_regression`
- `tpl_line_trend`
- `tpl_bar_grouped_compare`
- `tpl_histogram_distribution`
- `tpl_boxplot_by_category`

### Template Definitions

#### `tpl_scatter_regression`

- Family: `scatter`
- Intent: first-graph suggestion for two quantitative fields
- Default overlay: one linear regression path
- Notes: this is the canonical “scatter with regression” guided entry point

#### `tpl_line_trend`

- Family: `line`
- Intent: ordered trend over time or sequence
- Default overlay: none required
- Notes: use when one ordered field clearly drives interpretation

#### `tpl_bar_grouped_compare`

- Family: `bar`
- Intent: compare aggregated outcomes across categories
- Default overlay: none required
- Notes: should prefer readable grouped comparison over ornamental variation

#### `tpl_histogram_distribution`

- Family: `histogram`
- Intent: inspect the distribution of a single quantitative field
- Default overlay: none required
- Notes: used as a trust-building exploratory template after import or semantic repair

#### `tpl_boxplot_by_category`

- Family: `boxplot`
- Intent: compare grouped spread and outliers
- Default overlay: none required
- Notes: used when distribution-by-category is the clearer summary than raw scatter density

## Role and Layer Rules

### Common BMAD Role Vocabulary

The planning baseline assumes these BMAD graph-definition roles for MVP:

- `x`
- `y`
- `color`
- `size`
- `facetRow`
- `facetColumn`

### Locked MVP Rules

- Every graph family must support direct role editing through the BMAD role-assignment workflow.
- `scatter` is the only locked MVP family that supports `size`.
- `line`, `bar`, and `boxplot` may use faceting when performance and readability remain within NFR guardrails.
- Faceting is a composition capability, not a separate graph family.
- Only family-compatible overlays may be offered in the UI.
- Layering in MVP is constrained to combinations that preserve readable analytical meaning and adapter simplicity.

## Locked MVP Overlay Rules

The locked MVP overlay enum is:

- `regression_linear`
- `reference_line`
- `threshold_band`

### Overlay Support Matrix

| Overlay | scatter | line | bar | histogram | boxplot |
| --- | --- | --- | --- | --- | --- |
| `regression_linear` | Yes | Yes | No | No | No |
| `reference_line` | Yes | Yes | Yes | Yes | Yes |
| `threshold_band` | Yes | Yes | Yes | Yes | Yes |

Notes:

- The product promise requires at least one graph-tied fit path. MVP standardizes on a **linear regression** overlay only.
- Additional fit methods remain out of scope unless separately approved.

## Major Blocked Combinations

The following are planning-level blocked combinations for MVP:

- dual-axis comparison graphs are **not locked MVP**
- ridgeline or ridgeline-adjacent distribution views are **not locked MVP**
- `regression_linear` on `bar`, `histogram`, or `boxplot`
- `size` encoding on `line`, `histogram`, or `boxplot`
- mixed-family layering that combines incompatible analytical semantics in one view without an approved adapter rule
- graph requests that exceed four-variable encoding without preserving NFR guarantees
- category/measure combinations that would produce misleading or unreadable charts under BMAD guardrails

If a requested composition is blocked, the user must receive a plain-language explanation and the last valid graph must remain intact.

## Optional MVP Stretch

These patterns may be prototyped or implemented only if explicitly approved after the locked MVP families are stable:

- `dual_axis_compare`
- `ridgeline_distribution`
- deeper template-gallery breadth beyond the five locked templates
- KPI-card-heavy graph embellishments not required for the trust workflow

Optional stretch patterns must not be treated as default MVP commitments in stories, benchmarks, or acceptance criteria unless the planning artifacts are updated.

## Future Scope

These remain outside the MVP baseline:

- broad chart parity with JMP Graph Builder or similar expert-first tools
- expansive reusable template catalogs
- advanced custom-series or bespoke composition families with no clear BMAD planning contract

## BMAD Graph Definition Implications

For MVP, each BMAD graph definition should validate against:

- one locked `family` value from this catalog
- one allowed `templateId` or a null template when the user builds manually
- role assignments compatible with the chosen family
- overlays limited to the family support matrix
- blocked-combination rules before renderer compilation

This keeps the catalog enforceable before Vega-Lite compilation and before any raw-Vega exception is considered.

## References

- [prd.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md)
- [ux-design-specification.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/ux-design-specification.md)
- [architecture.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md)
- [epic-4-stories.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epic-4-stories.md)
- [IK-ADR-01-graph-runtime-selection.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-01-graph-runtime-selection.md)
- [IK-ADR-02-graph-definition-and-renderer-adapter-boundary.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-02-graph-definition-and-renderer-adapter-boundary.md)
