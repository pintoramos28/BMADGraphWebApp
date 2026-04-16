# Story 1.6: Graph Runtime Seam and Benchmark Scaffolding

Status: ready-for-dev

## Story

As a platform engineer,
I want the graph-runtime seam and benchmark inventory scaffolded before graph-authoring UI expands,
so that later graph work lands against the locked BMAD contract boundary and the Vega-to-ECharts fallback decision stays evidence-driven.

## Acceptance Criteria

1. Given IK-ADR-01 and IK-ADR-02 are locked, when the runtime seam is introduced, then one dedicated graph-runtime module owns renderer integration, consumes BMAD graph definitions as input, compiles to Vega-Lite by default, and keeps all renderer package imports out of feature modules, stores, and persisted workspace schemas.
2. Given the implementation-kickoff baseline requires an early spike, when prototype coverage is added, then the seam supports exactly four proof views for validation: scatter with regression overlay, dual-axis line, faceted small multiples, and a density or ridgeline-adjacent distribution view.
3. Given benchmark evidence must drive runtime decisions, when scaffolding is added, then the approved benchmark inventory exists under `_bmad-output/benchmarks/benchmark_set_clean/`, `_bmad-output/benchmarks/benchmark_set_dirty/`, and `_bmad-output/benchmarks/benchmark_workspace_local/`, with scenario metadata that names the approved validation scenarios from IK-ADR-11.
4. Given the architecture also expects runnable test fixtures, when benchmark scaffolding is implemented, then runtime-consumable fixtures or generated mirrors exist under `src/test/fixtures/` and `src/test/benchmark-workspaces/` without displacing `_bmad-output/benchmarks/` as the planning/source-of-truth inventory.
5. Given fallback remains conditional, when this story is complete, then Apache ECharts is documented only as the seam-compatible fallback path and is not activated as the primary runtime unless approved benchmark evidence later triggers the locked fallback rule.

## Dependencies

- Story 1.1: Shell Scaffold and Shared Contract Baselines

## Contract Boundaries

- In scope: graph-runtime seam scaffolding, prototype compile/render spike coverage, benchmark inventory structure, benchmark metadata, and benchmark-oriented tests/scripts.
- Out of scope: graph-workspace feature UI, reference-graph promotion UX, broad renderer fallback implementation, renderer-specific persistence, and later statistical/export behavior.
- Owning paths: `src/graph-runtime/**` or the architecture-approved equivalent, `_bmad-output/benchmarks/**`, `src/test/fixtures/**`, `src/test/benchmark-workspaces/**`, `scripts/benchmark-workspaces.mjs`, and runtime/benchmark tests.
- Downstream consumers after completion: graph-authoring flows in Epic 4, performance validation automation, and any later runtime-fallback decision review.

## Tasks / Subtasks

- [ ] Introduce the graph-runtime seam that accepts BMAD graph definitions and centralizes all renderer integration. (AC: 1)
- [ ] Add the four required prototype views for runtime validation without expanding into graph-authoring feature UI. (AC: 2)
- [ ] Create the benchmark inventory directories and scenario metadata aligned to IK-ADR-11. (AC: 3)
- [ ] Add test-friendly fixture wiring under `src/test/**` and benchmark scripts/tests that reference the approved scenario names. (AC: 4)
- [ ] Document the fallback rule so ECharts remains a seam-compatible contingency, not an early parallel runtime. (AC: 5)

## Dev Notes

### Architecture Alignment

- The runtime seam is required so BMAD owns one graph-definition contract and renderer specs remain derived artifacts.
- The implementation-kickoff baseline explicitly requires the four prototype views before graph-heavy implementation begins.
- Benchmark gates, not developer preference, govern any Vega-to-ECharts fallback activation.

### Project Structure Notes

- Keep renderer imports centralized under `graph-runtime/*`.
- Preserve `_bmad-output/benchmarks/**` as the approved inventory described by IK-ADR-11.
- Use `src/test/fixtures/**` and `src/test/benchmark-workspaces/**` only for runtime/test execution needs derived from that benchmark inventory.

### Testing

- Add seam tests that prove feature/store modules do not import renderer packages directly.
- Add benchmark-scenario references for the named scenarios in IK-ADR-11, even if precise dataset sizes remain to be filled in later.

### Residual Assumptions

- Exact row counts and workbook sizes remain deferred by the planning baseline. This story should lock directory structure, scenario names, and fixture metadata first, then let later validation refine scale numbers without renaming the inventory.

### References

- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md` - Frontend Architecture, Performance strategy, File Organization Patterns, CI/CD and quality gates
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epics.md` - Epic 1 implementation emphasis, sequencing notes
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md` - Graph runtime recommendation, Immediate next actions before epics/stories, Strictness Guidance
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-01-graph-runtime-selection.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-02-graph-definition-and-renderer-adapter-boundary.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-11-benchmark-fixture-inventory-and-graph-performance-gates.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Locked Epic 1 planning baseline reviewed before story creation.

### Completion Notes List

- This story intentionally stops at seam scaffolding and benchmark evidence setup.
- Graph-authoring breadth remains deferred to Epic 4 even though the renderer boundary is established here.

### File List

- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-6-graph-runtime-seam-and-benchmark-scaffolding.md`
