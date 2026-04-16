# IK-ADR-02: Graph Definition And Renderer Adapter Boundary

Status: Proposed
Date: 2026-04-15
Decision owners: Implementation kickoff

## Context

The architecture requires `graph views`, `activeGraphId`, `referenceGraphId`, Evidence Rail, Mission Log, readiness, and export to remain coherent. That coherence breaks quickly if feature code persists raw renderer configuration or calls render libraries directly.

Graph runtime selection alone is not enough. The implementation also needs a hard boundary between:

- BMAD-owned graph semantics
- renderer compilation
- renderer execution

## Decision

Persist and manipulate a **BMAD-native graph definition** as the canonical graph contract.

Required boundary:

- `features/*` and `stores/*` work only with BMAD graph definitions.
- `schemas/workspace/*` store BMAD graph definitions.
- `graph-runtime/*` compiles BMAD graph definitions into runtime-specific specs.
- only `graph-runtime/*` may call Vega/Vega-Lite APIs directly.
- `graph-runtime/*` compiles to Vega-Lite by default and may emit raw Vega only under the approved exception policy below.

Minimum BMAD graph-definition sections:

- graph identity and lifecycle status
- dataset reference
- role assignments
- mark/layer declarations
- overlay declarations
- presentation settings
- issue references
- evidence references

## Rationale

- This keeps persistence stable if the renderer changes.
- It makes graph state inspectable in Mission Log, readiness, and repair flows.
- It prevents renderer-specific shapes from leaking into the saved workspace contract.
- It gives Codex/BMAD agents one contract to implement against instead of several chart-library idioms.

## Consequences

Positive:

- Renderer replacement becomes possible without workspace-format collapse.
- Review flows can reason about graph intent rather than vendor-specific config.
- Validation and migration can run at the BMAD graph-definition level.

Negative:

- The adapter layer becomes a critical implementation seam and needs tests early.
- Some renderer capabilities may not map one-to-one and will need explicit BMAD semantics.

## Hard Invariants

- Canonical graph definitions are BMAD-owned.
- Renderer-specific specs are derived artifacts.
- Feature code does not import renderer packages directly.
- `activeGraphId` and `referenceGraphId` remain separate in domain state and persistence.
- Raw Vega may be used only inside `graph-runtime/*`, never in feature or store code.
- Raw Vega is not a convenience path, a persistence shortcut, or a substitute for missing BMAD graph-definition semantics.

## Recommended Defaults

- Route all renderer execution through one `graph-runtime` seam.
- Keep the minimum BMAD graph-definition sections listed in this ADR even if the exact shape evolves.
- Use Vega-Lite first for all MVP graph families unless an approved raw-Vega exception applies.

## Raw Vega Exception Policy

Raw Vega is allowed only when **Vega-Lite cannot express the chart or overlay cleanly enough** without weakening the BMAD graph-definition contract or creating fragile adapter logic.

MVP-approved exception families:

- ridgeline or ridgeline-adjacent distribution views
- advanced annotation or overlay compositions that Vega-Lite cannot express cleanly

Approval conditions:

- the input remains the BMAD graph-definition contract
- the raw-Vega path is implemented only inside `graph-runtime/*`
- the adapter documents why Vega-Lite is insufficient for that case
- the rendered result remains compatible with reference-graph, evidence, readiness, export, and review flows

Non-approved reasons:

- developer preference
- implementation convenience
- avoiding adapter work
- preserving renderer-specific payloads in workspace state

Escalation rule:

- If the same raw-Vega exception pattern begins to repeat across graph families, the team must revisit either the BMAD graph-definition contract or the ECharts fallback decision rather than continue adding ad hoc exceptions.

## Deferred Details

- exact module path names for `graph-runtime/*`
- the full graph-definition field list beyond the minimum contract sections

## Example Shape

```json
{
  "graphId": "graph_capacity_fade",
  "title": "Capacity Fade vs Cycle",
  "status": "reference",
  "datasetId": "ds_main",
  "roleAssignments": {
    "x": ["cycleIndex"],
    "y": ["capacityRetention"],
    "color": ["temperatureBand"],
    "size": [],
    "facetRow": [],
    "facetColumn": ["temperatureBand"]
  },
  "marks": ["point", "line"],
  "overlays": [
    {
      "overlayId": "ov_linear_fit",
      "kind": "regression",
      "method": "linear",
      "status": "ready"
    }
  ],
  "presentation": {
    "legendPosition": "right"
  },
  "issueIds": [],
  "evidenceIds": ["ev_001"]
}
```

## References

- [Implementation kickoff decisions artifact](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md)
- [architecture.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md)
