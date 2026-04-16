# IK-ADR-01: Graph Runtime Selection

Status: Proposed
Date: 2026-04-15
Decision owners: Implementation kickoff

## Context

BMADGraphWebApp needs a graph runtime that supports:

- a drag-to-role builder modeled on Graph Builder style workflows
- scatter, line, dual-axis, faceting, small multiples, and regression-style analytical presentation
- serious desktop analytical UX with Evidence Rail, Mission Log, Handoff Readiness, and reference-graph promotion
- local-first persistence, provenance, drift handling, and export readiness
- a multi-agent implementation process where narrow contracts matter more than ad hoc chart convenience

The implementation-kickoff research compared Apache ECharts, Plotly.js, visx + d3 primitives, Vega-Lite / Vega, and Graphic Walker using official documentation and repos.

## Decision

Use **Vega-Lite 6.x as the default authored graph grammar and Vega 6.x as the runtime renderer**.

Fallback:

- If the benchmark spike shows the chosen stack cannot satisfy NFR2 or NFR3 on approved representative datasets after reasonable optimization, the renderer fallback is **Apache ECharts 6.0.0**.
- The fallback is activated only if Vega-Lite/Vega misses NFR2 or NFR3 in **two or more approved benchmark scenarios**.
- A single failing edge case, or a scenario outside the approved benchmark inventory, does not activate fallback by itself.

Non-decisions:

- This ADR does not authorize persisting raw Vega-Lite or Vega specs as the canonical workspace format.
- This ADR does not lock every future chart type into MVP.

## Rationale

- Declarative graph specifications align with provenance, reviewability, migration, and saved-workspace stability better than renderer-specific option trees.
- Vega-Lite has first-class support for layering, faceting, density, regression, and dual-axis composition in official docs.
- Vega provides a same-family escape hatch for charts that are awkward in Vega-Lite but still need to remain in one rendering ecosystem.
- Apache ECharts remains the strongest fallback for high-performance large-data rendering and custom-series flexibility if benchmark evidence requires it.

## Consequences

Positive:

- The graph model can remain BMAD-owned and renderer-agnostic.
- Mission Log and review flows can diff graph definitions as data.
- Multi-agent implementation is less likely to drift into incompatible chart config styles.

Negative:

- Benchmark validation is mandatory before graph-heavy implementation expands.
- Some advanced views may require raw Vega, which creates an escape-hatch governance problem if not controlled.
- React integration must be centralized through one graph-runtime adapter layer.

## Hard Invariants

- The default graph-runtime family is Vega-Lite/Vega.
- The fallback family is ECharts.
- Feature modules may not choose their own chart library.
- The fallback decision is made against approved benchmark scenarios, not subjective local impressions.

## Recommended Defaults

- A benchmark spike should validate the runtime against approved datasets before major graph feature build-out.
- Treat "reasonable optimization" narrowly: worker offloading, spec-level simplification, and dataset-level aggregation or sampling that preserves the BMAD graph-definition contract.
- Use Vega-Lite first and raw Vega only by exception.
- Benchmark validation should cover ordinary graph edits, semantic overrides, presentation changes, filtering, sorting, subset changes, and single-step formula or transformation recompute.

## Deferred Details

- `vega-embed` versus direct `vega.View` integration details
- SVG versus Canvas default mode by chart type
- the exact benchmark fixture inventory and scenario definitions

## References

- [Vega-Lite docs](https://vega.github.io/vega-lite/docs/)
- [Vega-Lite layering](https://vega.github.io/vega-lite/docs/layer.html)
- [Vega-Lite facet](https://vega.github.io/vega-lite/docs/facet.html)
- [Vega-Lite regression](https://vega.github.io/vega-lite/docs/regression.html)
- [Vega-Lite dual-axis example](https://vega.github.io/vega-lite/examples/layer_dual_axis.html)
- [Vega View API](https://vega.github.io/vega/docs/api/view/)
- [Apache ECharts handbook](https://echarts.apache.org/handbook/en/)
- [Apache ECharts Canvas vs. SVG](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/)
- [Implementation kickoff decisions artifact](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md)
