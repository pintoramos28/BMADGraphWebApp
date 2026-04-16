# IK-ADR-11: Benchmark Fixture Inventory And Graph-Performance Gates

Status: Proposed
Date: 2026-04-15
Decision owners: Implementation kickoff

## Context

The PRD defines hard performance thresholds in NFR1 through NFR5 and requires canonical benchmark suites under `_bmad-output/benchmarks/`. The graph-runtime fallback decision is already locked against approved benchmark scenarios, but the inventory of those scenarios has not yet been authored in the workspace. That means the current fallback trigger and performance gates cannot be enforced honestly.

Without a locked benchmark inventory:

- performance stories will optimize against toy datasets
- Vega-to-ECharts fallback decisions will remain subjective
- CI and local validation will have no shared source of truth for graph, transform, and reopen budgets

## Decision

Adopt one required benchmark inventory rooted at:

- `_bmad-output/benchmarks/benchmark_set_clean/`
- `_bmad-output/benchmarks/benchmark_set_dirty/`
- `_bmad-output/benchmarks/benchmark_workspace_local/`

The benchmark inventory must cover three fixture families:

1. **Clean import fixtures**
   - CSV fixture
   - Excel fixture
   - pasted-table fixture
   - intended for independent import success and time-to-first-graph measurement
2. **Dirty import fixtures**
   - delimiter fault fixture
   - header/column-shape fault fixture
   - type inference ambiguity fixture
   - missing-value fault fixture
   - intended for import repair, semantic correction, and resilience measurement
3. **Working dataset and reopen fixtures**
   - one moderate graph-working dataset used for NFR2 and NFR3 checks
   - one serious-scale graph-working dataset used for NFR5 degradation checks
   - one saved local workspace fixture used for NFR4 and NFR6-NFR10 reopen checks

## Required Benchmark Scenarios

Approved scenarios for graph-runtime and workflow validation:

- `import.clean.csv-preview`
- `import.clean.excel-preview`
- `import.clean.paste-preview`
- `import.dirty.delimiter-repair`
- `import.dirty.header-repair`
- `import.dirty.type-repair`
- `import.dirty.missing-value-repair`
- `graph.edit.reference-update`
- `graph.edit.semantic-override`
- `graph.edit.presentation-change`
- `analysis.filter-change`
- `analysis.sort-change`
- `analysis.subset-change`
- `analysis.formula-recompute`
- `workspace.reopen.benchmark-local`
- `graph.serious-scale.degradation`

## Performance Gates

The inventory above operationalizes the following release-shaping gates:

- `NFR1`: clean CSV and Excel preview must become usable within 5 seconds
- `NFR2`: ordinary graph edits, semantic overrides, and presentation changes must update the active graph within 1 second on approved benchmark working datasets
- `NFR3`: filtering, sorting, subset changes, and single-step formula or transformation recompute must complete within 2 seconds on the same benchmark working datasets, or surface visible in-progress feedback if longer
- `NFR4`: the benchmark saved workspace must reopen to a usable analytical state within 10 seconds
- `NFR5`: at least one serious-scale benchmark dataset must remain operationally usable with visible progress or degradation feedback rather than silent failure

## Acceptance Rules

- The Vega-to-ECharts fallback trigger uses only approved benchmark scenarios from this ADR.
- A single failing edge case outside this inventory does not activate fallback.
- Benchmark runs must be captured against supported MVP browsers only.
- Benchmark validation must exercise the BMAD graph-definition contract, not renderer-specific persistence shortcuts.

## Rationale

- The PRD already names the benchmark suites; this ADR turns them into executable planning assets.
- The graph-runtime decision depends on repeatable graph-edit and recompute evidence, not anecdotal local testing.
- Reopen and trust-critical flows need their own benchmark artifact because performance failure there is a product-correctness issue, not only a UX issue.

## Consequences

Positive:

- stories can target concrete fixtures and scenario names
- CI, local performance validation, and runtime-fallback decisions share one inventory
- import, graph, and reopen budgets stay anchored to the same serious analytical baseline

Negative:

- the team must now create and maintain the benchmark directory structure instead of deferring it
- fixture curation becomes a planning artifact that needs version discipline

## Hard Invariants

- `_bmad-output/benchmarks/` is a required implementation artifact, not an optional convenience folder
- approved performance gates are evaluated only on the named benchmark scenarios
- benchmark fixtures must remain local and must not require remote services
- benchmark validation must include at least one reopen fixture and one serious-scale working dataset

## Recommended Defaults

- Keep benchmark fixtures representative of real engineering analytical workflows, not synthetic toy tables.
- Pair each fixture with a short metadata note describing source kind, scale, expected repair pattern, and target scenarios.
- Run benchmark checks in CI for reopen and at least one graph-edit/recompute slice; run the fuller spike locally or in dedicated validation automation.
- Reuse the same benchmark inventory for telemetry KPI baselining where privacy boundaries allow aggregate timing capture.

## Deferred Details

- the exact row counts and workbook sizes for each benchmark fixture
- the exact moderate versus serious-scale thresholds
- the final script layout for benchmark automation

## References

- [prd.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md)
- [architecture.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md)
- [implementation-kickoff-decisions.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md)
- [IK-ADR-01 Graph Runtime Selection](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-01-graph-runtime-selection.md)
