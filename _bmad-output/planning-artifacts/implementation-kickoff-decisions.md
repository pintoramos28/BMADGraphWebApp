# Implementation Kickoff Decisions

Date: 2026-04-15
Project: BMADGraphWebApp
Scope: Pre-implementation decision pass only. This artifact closes implementation-shaping gaps that remain after architecture completion. It does not create epics, stories, or sprint plans.

## 1. Current unresolved decisions

The architecture is complete, but a number of implementation-shaping contracts are still not locked tightly enough for multi-agent execution. The open items below are the ones most likely to cause drift, duplicate work, or incompatible schemas if implementation starts without closure.

| Decision area | Why it is still open | Why it matters now | Recommendation in this artifact |
| --- | --- | --- | --- |
| Graphing/rendering stack | The architecture names graph-heavy requirements, but no chart runtime has been selected yet. | This affects graph-spec design, performance strategy, export path, accessibility approach, test fixtures, and how drag-to-role interactions compile to renderable charts. | Lock a primary graph runtime now. Recommendation: Vega-Lite + Vega. Fallback: Apache ECharts. |
| Graph definition boundary | The docs define `graph views`, `referenceGraphId`, and trust surfaces, but they do not yet say whether persisted graph state is raw library config or BMAD-owned domain state. | If agents persist raw library configs, changing libraries or upgrading specs later becomes much harder. | Lock a BMAD-native graph definition and renderer adapter boundary now. |
| Canonical routes as code constants | Architecture fixed route inventory, but not the constant names or path helpers. | Router drift is a common early-agent failure mode and creates broken deep links from repair/readiness surfaces. | Lock route constants and helper functions before screen work starts. |
| Service worker ownership model | Architecture clarified ownership at a high level, but not as an implementation contract. | Without a narrow boundary, feature code will try to push app concerns into the service worker. | Lock shell-only service-worker ownership now. |
| Workspace snapshot example shape | Architecture requires a canonical `WorkspaceSnapshot`, but there is no worked example. | Persistence, reopen, migration, export, and trust surfaces all depend on the same shape. | Lock a v1 example now. |
| Workspace ledger example shape | Architecture requires an append-only ledger, but there is no event payload contract. | Mission Log, drift repair, and readiness auditing need consistent event taxonomy. | Lock a v1 ledger shape now. |
| Issue record example shape | Repair Card depends on structured issue records, but the payload is not defined. | Feature teams will otherwise invent local error shapes that do not aggregate. | Lock a single issue record contract now. |
| Telemetry payload example shape | PRD and architecture define telemetry boundaries, but not the payload structure. | This impacts privacy guarantees, offline queueing, and KPI instrumentation. | Lock a redacted payload example now. |
| Release manifest example shape | Architecture names release metadata and support matrix, but not the manifest contract. | Shell boot, update prompts, compatibility gates, and reopen migration all depend on this. | Lock a v1 release manifest shape now. |
| Browser support matrix and Safari stance | PRD explicitly says Safari is an explicit decision, not an assumption. The architecture does not close it. | Browser capability gating is coupled to the hosted shell, service worker, File System APIs, and accessibility QA. | Keep flexible for one short follow-up ADR, but do not let implementation assume Safari support. |
| Benchmark dataset thresholds | NFRs name benchmark gates, but the actual benchmark data volumes and complexity slices are not yet fixed in code. | Graph runtime selection cannot be validated honestly without agreed benchmark fixtures. | Lock benchmark fixture inventory immediately after graph-runtime decision. |
| Export surface scope | The docs require export readiness and release integrity, but the exact MVP export set is still implied rather than explicit. | Export scope affects graph runtime, evidence inclusion, manifest integrity, and review expectations. | Keep file-format breadth flexible, but lock the export manifest and integrity contract now. |

Ambiguities that remain explicit even after this artifact:

- Safari support is still a product/environment decision, not an engineering assumption.
- Exact benchmark dataset sizes are still to be defined in code and fixtures, even though performance gates are already defined in the PRD.
- This artifact recommends a graph runtime and adapter boundary, but it intentionally does not lock every future chart type into MVP.
- Service worker tooling remains flexible. Ownership is locked; implementation mechanism is not.

## 2. Graphing library recommendation matrix

### Decision framing

BMADGraphWebApp is not choosing a charting library for generic dashboards. It needs a graph runtime that can survive five product-specific pressures at once:

1. A drag-to-role builder modeled more after JMP Graph Builder than a static dashboard library.
2. Strong analytical coverage for scatter, line, dual-axis, small multiples, faceting, overlays, and regression-style presentation.
3. A serious desktop analytical UX where charts live inside a richer workspace with Evidence Rail, Mission Log, Repair Card, Handoff Readiness, and Telemetry Status.
4. Local-first persistence, provenance, drift review, and handoff, which favor inspectable and serializable chart definitions.
5. A multi-agent Codex/BMAD implementation process, which punishes ambiguous runtime boundaries and rewards contract-driven rendering.

### Matrix

| Option | Current official status | Drag-to-role builder fit | Analytical coverage | Large local dataset responsiveness | Accessibility implications | Provenance / reference-graph fit | Customization burden | Maintainability for BMAD/Codex | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Vega-Lite + Vega** | Active. Vega-Lite repo shows 6.3.1 latest on 2025-09-10; Vega site shows 6.1.2. Official docs cover layering, faceting, regression, and View API export. | High. The role-builder can compile naturally to declarative encodings and view-composition operators. | High. Scatter, line, dual-axis, layered overlays, faceting, density, and regression are first-class. Ridgeline is realistic via Vega escape hatch. | Medium. Good enough for serious desktop datasets if the product samples, aggregates, and uses workers; weaker headroom than ECharts for extreme-scale interaction. | Medium-High. Vega supports SVG or Canvas renderers, export APIs, and ARIA description config, but app-level textual alternatives still remain BMAD's job. | Very high. Declarative JSON specs map cleanly to saved state, diffing, provenance, and review. | Medium. Vega-Lite covers most needs; raw Vega is the escape hatch for exceptions. | Very high. Spec-first rendering sharply reduces agent drift and simplifies testing and migrations. | **Recommended primary runtime.** |
| **Apache ECharts** | Active. Apache repo shows 6.0.0 latest on 2025-07-30; official site advertises dataset, transforms, custom series, Canvas/SVG switching, progressive rendering, and accessibility features. | High. BMAD can own the builder and map roles into `dataset` + `encode`, with custom series available for missing forms. | High. Scatter, line, multi-axis layouts, overlays, and custom series are credible; ridgeline is feasible but more bespoke. | Very high. ECharts is the strongest candidate here. Official docs emphasize progressive rendering and large data support. | High. Official ARIA descriptions and decal patterns are useful, though still not a substitute for BMAD textual review surfaces. | Medium-High. Possible, but raw ECharts option trees are less semantically stable than a grammar-based spec. | Medium-High. Powerful, but custom compositions will push more logic into adapter code. | High if wrapped carefully; lower than Vega-Lite if raw options leak into persistence. | **Recommended fallback.** |
| **Plotly.js** | Active. Plotly repo shows v3.3.1 latest on 2025-12-12; official docs cover multiple axes, subplots, events, shapes, and WebGL traces. | Medium. BMAD can build a role UI on top, but the library does not naturally model a Graph Builder workflow. | High. Very strong for scatter/line/scientific chart types and annotations; faceting/small multiples are more manual than Vega-Lite. | Medium. WebGL helps, but official docs note browser WebGL-context limits and only a small number of WebGL figures per page. | Medium-Low. Official docs are weaker on accessibility guarantees than ECharts and Vega. | Medium. Plotly figures are serializable, but they are less naturally aligned to provenance-first graph grammars than Vega-Lite. | Medium. Straightforward for a single figure, but multi-view analytical builder logic becomes more manual. | Medium. Strong library, but less clean for a contract-first BMAD implementation path. | Credible, but not recommended. |
| **visx + d3 primitives** | Active. visx repo describes reusable low-level visualization components; releases page shows v3.12.0 latest on 2024-11-07. | Medium-Low. You can build exactly the right builder, but only by implementing almost everything yourself. | Medium. Anything is possible, but almost nothing product-specific comes pre-resolved. | Medium-High if engineered carefully, but BMAD owns nearly all rendering and performance complexity. | Medium. Accessibility can be excellent, but only if the team builds it explicitly. | Medium. Provenance can be made first-class, but only through BMAD-owned contracts. | Very high. This is the most expensive option by far. | Low-Medium. Too much room for drift and inconsistent chart implementations across agents. | Not suitable for kickoff. |
| **Graphic Walker** | Active. Official repo describes an embeddable React component, drag-and-drop visual analysis UI, worker-based computation, and a Vega-Lite foundation. | Very high. This is the closest off-the-shelf match to drag-to-role exploration. | Medium-High. Good exploratory coverage and faceting semantics. | Medium. Good enough for exploration, but not clearly superior to Vega/ECharts for BMAD's benchmarked analytical desktop needs. | Medium. Accessibility story is acceptable but not the main strength. | Low-Medium. The problem is not raw capability; it is ownership. Graphic Walker wants to own too much of the interaction model that BMAD Mission Control needs to own itself. | Medium-Low for embedding, high for deep product-specific reshaping. | Medium-Low. Too opinionated as a core app foundation for this product's trust surfaces and reference-graph workflow. | Useful reference implementation, not the foundation. |

### Product-specific assessment notes

#### Vega-Lite + Vega

Why it fits BMADGraphWebApp:

- The product already wants trust, provenance, drift, and review to be first-class. Declarative specs are materially easier to diff, validate, migrate, and discuss in a Mission Log than imperative rendering code.
- Faceting, layering, dual-axis composition, density transforms, and regression transforms all exist in the official grammar instead of needing BMAD-specific reinvention.
- The Vega escape hatch is important. It keeps the stack in one family when BMAD needs a specialized chart form, rather than forcing a second library for ridgeline or advanced annotation cases.
- A graph-builder UI can compile role assignments into a stable graph-definition object first and then into Vega-Lite. That keeps the domain model BMAD-owned while still taking advantage of the grammar.

Product-specific risks:

- Very large local datasets may need benchmark-driven sampling, aggregation, or reduced-detail rendering earlier than with ECharts.
- Some advanced charts are easier in raw Vega than Vega-Lite, so the team needs an explicit rule for when the escape hatch is allowed.
- The rendering lifecycle is not React-native by default; the app needs a single adapter layer rather than ad hoc embed calls from feature modules.

#### Apache ECharts

Why it is the best fallback:

- If benchmark prototypes show Vega missing NFR2 or NFR3 on representative datasets, ECharts gives the strongest official performance headroom and the best "custom chart but still one library" path.
- `dataset`, `encode`, transforms, events, and custom series map reasonably well to a BMAD-owned graph-builder layer.
- ECharts 6's official custom-series path is especially relevant if BMAD ends up needing bespoke analytical marks.

Product-specific risks:

- ECharts option objects are more implementation-shaped and less domain-readable than Vega/Vega-Lite specs.
- The farther BMAD leans into custom series, the more rendering semantics move into adapter code and away from inspectable domain contracts.
- To preserve migration flexibility, BMAD must not persist raw ECharts options as the system-of-record graph contract.

#### Plotly.js

Why it remains credible:

- Plotly is analytically serious and already has strong scientific expectations around scatter, multi-axis, violin, contour, annotation, and interaction events.
- It would likely produce report-friendly graphs quickly.

Why it is not the best fit here:

- The official WebGL guidance is a warning sign for a workspace that may show multiple figures, reference graphs, and review states at once.
- BMAD still has to build the drag-to-role model, trust surfaces, and provenance semantics itself, so Plotly's strengths do not reduce enough product-specific work.
- Plotly feels more like "embed a charting engine" than "adopt a durable graph grammar for a local-first analytical workspace."

#### visx + d3 primitives

Why it is not right for kickoff:

- It optimizes for total control, but BMADGraphWebApp is not blocked on lack of visual control. It is blocked on narrowing semantics and reducing drift.
- The builder, layering, statistics, small multiples, accessibility, and provenance semantics would all become custom code.
- This would be a good fit only if BMAD later proves that available grammars cannot support the product's core graph model.

#### Graphic Walker

Why it is worth naming explicitly:

- It is the only credible option in this set that already thinks in drag-and-drop visual analytics terms.
- It proves that a browser-local exploratory builder on top of a grammar-driven stack is viable.

Why it still should not be the core foundation:

- BMADGraphWebApp needs Evidence Rail, Mission Log, Handoff Readiness, reference-graph promotion, and provenance-heavy trust semantics to be the product core, not an add-on beside an embedded exploration tool.
- Embedding Graphic Walker would save some builder time up front, but would create much stronger long-term ownership conflicts.

### Final graph-runtime recommendation criteria

Use the following acceptance criteria for the chosen runtime:

1. The graph builder must be able to express `x`, `y`, `color`, `size`, and `facet` roles without leaking raw renderer config into feature modules.
2. A saved workspace must persist BMAD graph definitions, not raw renderer artifacts.
3. Reference-graph promotion must update graph state, evidence state, mission-log state, and readiness state through the same domain event path.
4. The runtime must support at least these prototype charts before epics/stories start:
   - scatter + regression overlay
   - dual-axis line
   - faceted small-multiple comparison
   - density or ridgeline-adjacent distribution view
5. The runtime must pass a benchmark spike against the approved representative datasets before graph-heavy implementation begins.

### Official sources used

Primary sources consulted for the comparison above:

- Apache ECharts official site and docs:
  - [Apache ECharts home](https://echarts.apache.org/)
  - [Apache ECharts GitHub repo](https://github.com/apache/echarts)
  - [Dataset](https://echarts.apache.org/handbook/en/concepts/dataset/)
  - [Data Transform](https://echarts.apache.org/handbook/en/concepts/data-transform/)
  - [Custom Series](https://echarts.apache.org/handbook/en/how-to/custom-series/)
  - [Canvas vs. SVG](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/)
  - [Aria / accessibility](https://echarts.apache.org/handbook/en/best-practices/aria/)
  - [Event and Action](https://echarts.apache.org/handbook/en/concepts/event/)
  - [Security Guidelines](https://echarts.apache.org/handbook/en/best-practices/security/)
- Plotly official docs and repo:
  - [plotly.js GitHub repo](https://github.com/plotly/plotly.js)
  - [Multiple axes](https://plotly.com/javascript/multiple-axes/)
  - [Subplots](https://plotly.com/javascript/subplots/)
  - [JavaScript figure reference](https://plotly.com/javascript/reference/)
  - [Event handlers](https://plotly.com/javascript/plotlyjs-events)
  - [WebGL vs SVG](https://plotly.com/javascript/webgl-vs-svg/)
  - [Shapes](https://plotly.com/javascript/shapes/)
  - [Violin](https://plotly.com/javascript/violin/)
  - [Security policy](https://github.com/plotly/plotly.js/security)
- visx official repo:
  - [visx GitHub repo](https://github.com/airbnb/visx)
  - [visx releases](https://github.com/airbnb/visx/releases)
- Vega / Vega-Lite official docs and repos:
  - [Vega-Lite home](https://vega.github.io/vega-lite/)
  - [Vega-Lite docs overview](https://vega.github.io/vega-lite/docs/)
  - [Vega-Lite releases](https://github.com/vega/vega-lite/releases)
  - [Layering views](https://vega.github.io/vega-lite/docs/layer.html)
  - [Facet](https://vega.github.io/vega-lite/docs/facet.html)
  - [Regression](https://vega.github.io/vega-lite/docs/regression.html)
  - [Layered dual-axis example](https://vega.github.io/vega-lite/examples/layer_dual_axis.html)
  - [Density transform](https://vega.github.io/vega-lite/docs/density.html)
  - [Vega home](https://vega.github.io/vega/)
  - [Vega docs](https://vega.github.io/vega/docs/)
  - [Vega View API](https://vega.github.io/vega/docs/api/view/)
  - [Vega config / aria description](https://vega.github.io/vega/docs/config/)
  - [Ridgeline example in Vega](https://vega.github.io/vega/examples/u-district-cuisine/)
- Graphic Walker official repo:
  - [Graphic Walker GitHub repo](https://github.com/Kanaries/graphic-walker)

Notes on current-version claims:

- The version/date references above come from official project sites or official GitHub repo/release pages as observed during research on 2026-04-15.
- Where the recommendation discusses requirement fit beyond explicit documentation, that is an inference from the official capabilities and BMADGraphWebApp's product constraints, not a direct vendor claim.

## 3. Final recommendation and fallback

### Primary recommendation

Adopt **Vega-Lite 6.x as the default authored graph grammar, compiled to Vega 6.x for runtime rendering**, with BMAD owning a thin `graph-runtime` adapter layer.

Implementation interpretation:

- BMAD persists a **BMAD-native graph definition**, not raw Vega-Lite JSON and not raw renderer output.
- The adapter compiles that graph definition into Vega-Lite whenever the chart is expressible there.
- If a chart is not cleanly expressible in Vega-Lite, the adapter may emit raw Vega while keeping the same BMAD graph-definition wrapper.
- Feature modules never talk directly to `vega-embed` or `vega.View`; only the graph-runtime module does.

Why this is the right default:

- It best matches the product's trust/provenance/reopen requirements.
- It gives the cleanest contract surface for multi-agent implementation.
- It keeps graph behavior inspectable and reviewable.
- It supports the required analytical chart families without locking the product into a heavyweight embedded builder UI that BMAD does not control.

### Fallback recommendation

Use **Apache ECharts 6.0.0** as the fallback if the benchmark spike shows that the recommended Vega-Lite/Vega runtime cannot meet graph-edit or recompute targets on representative datasets after reasonable optimization.

Fallback trigger conditions:

1. The prototype misses NFR2 or NFR3 on two or more approved benchmark scenarios after worker offloading and spec-level optimization.
2. Ridgeline or overlay requirements force repeated raw-Vega special cases that materially increase graph-runtime complexity.
3. The team finds that reference-graph interactions need large-data responsiveness that Vega cannot deliver without degrading core exploratory flow.

Fallback interpretation:

- Keep the BMAD graph-definition contract.
- Replace only the renderer adapter.
- Do not rewrite the workspace schema around ECharts option objects.

## 4. Kickoff contract decisions

### 4.1 Graphing / rendering library decision

**Decision**

- Primary runtime: Vega-Lite 6.x authored specs compiled to Vega 6.x.
- Escape hatch: raw Vega only when Vega-Lite cannot express the chart cleanly enough.
- Persistence boundary: store BMAD graph definitions, not raw Vega/Vega-Lite specs as the canonical workspace record.
- Fallback runtime: Apache ECharts 6.0.0 behind the same adapter boundary if benchmark evidence forces a switch.

**Rationale**

- This keeps graph state inspectable, testable, and migration-friendly.
- It aligns with the reference-graph-centered workflow because graph definitions can be diffed and reasoned about as data, not as opaque view code.
- It reduces agent drift because rendering logic becomes compile-time translation from one BMAD contract rather than many feature-local chart configs.

**Risks / tradeoffs**

- Vega will need benchmark validation on realistic local datasets.
- The team must resist the temptation to persist raw renderer specs.
- Raw Vega escape hatches can become a dumping ground if not governed.

**What must be locked now**

- One graph-runtime adapter module owns all renderer calls.
- One BMAD graph-definition contract exists and is the only persistence contract.
- Escape-hatch rules are explicit: Vega-Lite first, Vega only by exception.
- Fallback path is documented but not implemented until benchmark evidence requires it.

**What can remain flexible**

- Whether the adapter uses `vega-embed` or a direct `vega.View` wrapper internally.
- Exact MVP graph inventory beyond the required prototype set.
- Whether static export uses SVG-first or PNG-first as long as the manifest contract remains stable.

### 4.2 Canonical route constants

**Decision**

Lock the canonical route inventory from architecture into one constants module and one helper module:

```ts
export const ROUTES = {
  home: '/',
  workspaceIndex: '/workspace',
  workspaceDetail: '/workspace/:workspaceId',
  reviewDetail: '/review/:workspaceId',
  unsupported: '/unsupported',
} as const;

export const routePath = {
  workspace: (workspaceId: string) => `/workspace/${workspaceId}`,
  review: (workspaceId: string) => `/review/${workspaceId}`,
} as const;
```

**Rationale**

- Repair Card, Mission Log, Handoff Readiness, and environment-gating flows all need durable deep links.
- Route drift is a high-probability early implementation failure in multi-agent work.

**Risks / tradeoffs**

- The route set is intentionally narrow, so future convenience routes will require review instead of being added ad hoc.

**What must be locked now**

- Constant names.
- Route helper names.
- Param name: `workspaceId`.
- Only the five architecture-approved routes exist at kickoff.

**What can remain flexible**

- Query-string conventions.
- Nested layout implementation details.
- Whether route guards live in loaders, boot logic, or wrappers.

### 4.3 Service worker ownership model

**Decision**

The service worker is a **shell infrastructure component**, not a feature runtime.

Ownership split:

- `src/app/boot/registerServiceWorker.ts` owns registration and update-listener wiring.
- The service worker owns shell-asset caching, release-manifest caching, support-matrix caching, and update detection.
- Telemetry queueing stays in application/service code.
- IndexedDB, workspace files, formulas, datasets, and graph snapshots stay out of the service worker.
- Status display belongs to shell status surfaces such as Telemetry Status Rail or shell-level banners, not to feature-local code.

**Rationale**

- This preserves the strict local-only analytical boundary.
- It prevents feature teams from turning the service worker into an accidental second application runtime.
- It matches the architecture's hosted-shell model cleanly.

**Risks / tradeoffs**

- Offline logic is split across shell and app layers, so the boundary must be documented and tested.
- Teams may initially want to push telemetry or workspace recovery logic into the service worker for convenience.

**What must be locked now**

- SW scope is limited to shell assets and operational metadata.
- Telemetry queue remains outside the SW.
- No workspace or dataset reads/writes in the SW.
- Update prompts are shell-owned.

**What can remain flexible**

- Workbox vs hand-written Vite service worker.
- Cache names and cache invalidation internals.
- BroadcastChannel vs postMessage for shell update notifications.

### 4.4 Workspace snapshot example shape

**Decision**

Lock a v1 `WorkspaceSnapshot` example with explicit support for datasets, semantics, transforms, formulas, graph definitions, reference-graph state, evidence, issues, readiness, and export metadata.

**Rationale**

- This is the most important persistence contract in the product.
- It must be stable enough for save/reopen, migration, drift analysis, and export.
- The example needs to be domain-shaped rather than renderer-shaped.

**Risks / tradeoffs**

- If the example is too broad, it becomes a pseudo-architecture document.
- If it is too renderer-specific, it will block library changes.

**What must be locked now**

- Top-level sections and version fields.
- Separate `activeGraphId` and `referenceGraphId`.
- Domain-owned `graphDefinitions`.
- Explicit issue, evidence, readiness, and export sections.

**What can remain flexible**

- Internal field ordering.
- Exact derived-stat payload details.
- Optional metadata fields that do not change meaning.

**Example**

```json
{
  "workspaceId": "ws_2026_04_15_001",
  "workspaceFormatVersion": "1.0.0",
  "appBuildVersion": "0.1.0",
  "schemaVersion": "2026-04-15",
  "createdAt": "2026-04-15T14:05:12Z",
  "updatedAt": "2026-04-15T14:42:30Z",
  "compatibility": {
    "minReadableAppBuild": "0.1.0",
    "maxTestedAppBuild": "0.1.x"
  },
  "datasets": [
    {
      "datasetId": "ds_main",
      "displayName": "battery-cycles.csv",
      "sourceKind": "csv",
      "fingerprint": "sha256:dataset-main",
      "rowCount": 48213,
      "columnCount": 14,
      "columns": [
        {
          "columnId": "cycleIndex",
          "sourceName": "Cycle",
          "dataType": "integer",
          "semanticRole": "x",
          "unit": null,
          "status": "confirmed"
        },
        {
          "columnId": "capacityRetention",
          "sourceName": "CapacityRetentionPct",
          "dataType": "number",
          "semanticRole": "y",
          "unit": "%",
          "status": "confirmed"
        },
        {
          "columnId": "temperatureBand",
          "sourceName": "TempBand",
          "dataType": "string",
          "semanticRole": "color",
          "unit": null,
          "status": "confirmed"
        }
      ]
    }
  ],
  "transformPipeline": [
    {
      "transformId": "tf_filter_high_quality",
      "kind": "filter",
      "status": "applied",
      "order": 1,
      "expression": "qualityFlag == 'PASS'"
    }
  ],
  "formulaColumns": [
    {
      "formulaId": "fm_capacity_delta",
      "columnId": "capacityDelta",
      "label": "Capacity Delta",
      "expression": "capacityRetention - lag(capacityRetention)",
      "status": "valid",
      "dependsOn": ["capacityRetention"]
    }
  ],
  "graphDefinitions": [
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
        "xAxisLabel": "Cycle",
        "yAxisLabel": "Capacity Retention (%)",
        "legendPosition": "right"
      },
      "renderer": {
        "family": "vega-lite",
        "mode": "svg"
      },
      "issueIds": [],
      "evidenceIds": ["ev_001"]
    }
  ],
  "activeGraphId": "graph_capacity_fade",
  "referenceGraphId": "graph_capacity_fade",
  "evidence": [
    {
      "evidenceId": "ev_001",
      "graphId": "graph_capacity_fade",
      "note": "Capacity loss accelerates above 45C.",
      "provenanceRefs": ["prov_import_001", "prov_fit_001"],
      "status": "review-ready"
    }
  ],
  "issues": [],
  "readiness": {
    "status": "warning",
    "blockingIssueIds": [],
    "warningIssueIds": ["issue_missing_reviewer_note"],
    "provenanceCompleteness": "partial"
  },
  "telemetrySnapshot": {
    "lastGraphRenderMs": 742,
    "offlineQueueDepth": 3,
    "status": "queued"
  },
  "exportSummary": {
    "lastExportedAt": null,
    "includedReferenceGraphId": "graph_capacity_fade",
    "manifestVersion": "1.0.0"
  }
}
```

### 4.5 Workspace ledger example shape

**Decision**

Lock the ledger as an append-only ordered event stream with durable sequence numbers and causality context.

**Rationale**

- Mission Log, repair history, drift replay, and readiness explanations all depend on the same event language.
- Without sequence and causality fields, replay and debugging become ambiguous.

**Risks / tradeoffs**

- If the team makes ledger payloads too large, the ledger becomes a second snapshot.
- If event names are too generic, they become useless for review and replay.

**What must be locked now**

- `sequence`.
- `type`.
- `occurredAt`.
- `actor`.
- `entityRefs`.
- `correlationId`.
- `workspaceVersion`.
- Optional `trustImpact`.

**What can remain flexible**

- Diagnostic detail shape.
- Whether payloads store diffs, summaries, or both for each event type.

**Example**

```json
[
  {
    "ledgerEntryId": "led_001",
    "sequence": 17,
    "occurredAt": "2026-04-15T14:12:02Z",
    "type": "graph.created",
    "actor": {
      "kind": "user",
      "id": "local-user"
    },
    "workspaceVersion": 17,
    "entityRefs": {
      "workspaceId": "ws_2026_04_15_001",
      "graphId": "graph_capacity_fade"
    },
    "payload": {
      "title": "Capacity Fade vs Cycle",
      "datasetId": "ds_main",
      "marks": ["point", "line"]
    },
    "correlationId": "cmd_2026_04_15_017"
  },
  {
    "ledgerEntryId": "led_002",
    "sequence": 18,
    "occurredAt": "2026-04-15T14:14:41Z",
    "type": "graph.promoted",
    "actor": {
      "kind": "user",
      "id": "local-user"
    },
    "workspaceVersion": 18,
    "entityRefs": {
      "workspaceId": "ws_2026_04_15_001",
      "graphId": "graph_capacity_fade",
      "previousReferenceGraphId": "graph_scatter_exploratory"
    },
    "payload": {
      "reason": "Selected for review after linear fit validation."
    },
    "trustImpact": {
      "readinessBefore": "warning",
      "readinessAfter": "warning"
    },
    "correlationId": "cmd_2026_04_15_018"
  }
]
```

### 4.6 Issue record example shape

**Decision**

Lock one issue-record contract that can power Repair Card, Handoff Readiness, and export blocking without translation layers.

**Rationale**

- The architecture already defines structured issue records as the error and recovery backbone.
- A single shape keeps issue aggregation and repair routing coherent.

**Risks / tradeoffs**

- Rich issue payloads can become mini feature-specific schemas if they are not disciplined.
- Too-generic issue payloads will not support direct repair actions.

**What must be locked now**

- Severity and status enums.
- Source entity references.
- User-facing summary plus machine-readable diagnostics.
- Repair actions with stable command identifiers.

**What can remain flexible**

- Exact command arguments per issue kind.
- Additional diagnostic fields for specific workers.

**Example**

```json
{
  "issueId": "issue_color_role_quantitative",
  "kind": "graph.validation.incompatible-role",
  "severity": "blocking",
  "status": "open",
  "detectedAt": "2026-04-15T14:20:01Z",
  "source": {
    "module": "graph-runtime",
    "entityType": "graph",
    "entityId": "graph_capacity_fade"
  },
  "title": "Color role requires a categorical field",
  "detail": "The selected palette mode is categorical, but the requested field is quantitative.",
  "userMessage": "Choose a categorical field for Color or switch the graph to a continuous color scale.",
  "contextRef": {
    "routeKey": "workspaceDetail",
    "workspaceId": "ws_2026_04_15_001",
    "graphId": "graph_capacity_fade",
    "panel": "repair"
  },
  "repairActions": [
    {
      "actionId": "graph.clearRole",
      "label": "Clear color role",
      "command": "graph.clearRole",
      "args": {
        "graphId": "graph_capacity_fade",
        "role": "color"
      }
    },
    {
      "actionId": "graph.setColorScaleMode",
      "label": "Use continuous color scale",
      "command": "graph.setColorScaleMode",
      "args": {
        "graphId": "graph_capacity_fade",
        "mode": "continuous"
      }
    }
  ],
  "diagnostics": {
    "rendererFamily": "vega-lite",
    "requestedFieldId": "capacityRetention",
    "requestedRole": "color"
  }
}
```

### 4.7 Telemetry payload example shape

**Decision**

Lock telemetry as a redacted batch envelope with event-level metrics only. No dataset rows, formulas, evidence text, workspace blobs, or imported file contents leave the machine.

**Rationale**

- The PRD and architecture are explicit about privacy boundaries.
- A stable telemetry contract is required for KPI instrumentation and offline queueing.

**Risks / tradeoffs**

- If event dimensions are too rich, telemetry will slowly violate the local-only boundary.
- If they are too thin, KPI and performance gates become unmeasurable.

**What must be locked now**

- Batch envelope fields.
- Event taxonomy for the first KPI loop.
- Privacy flags.
- Offline queue semantics.

**What can remain flexible**

- Exact persona segmentation field naming.
- Operational dimensions that do not widen privacy scope.
- Which additional non-sensitive events are added later.

**Example**

```json
{
  "schemaVersion": "1.0.0",
  "batchId": "telemetry_batch_001",
  "sentAt": "2026-04-15T14:45:00Z",
  "appBuildVersion": "0.1.0",
  "sessionId": "sess_2026_04_15_a1",
  "queueState": {
    "status": "queued",
    "queuedCountBeforeFlush": 3
  },
  "environment": {
    "browserName": "Chrome",
    "browserVersion": "136",
    "osFamily": "Windows",
    "online": false,
    "supportedEnvironment": true,
    "viewportWidth": 1440,
    "viewportHeight": 900
  },
  "privacy": {
    "containsDatasetRows": false,
    "containsFormulas": false,
    "containsWorkspaceBlob": false,
    "containsEvidenceText": false
  },
  "events": [
    {
      "eventId": "evt_001",
      "type": "graph.render.completed",
      "occurredAt": "2026-04-15T14:44:52Z",
      "workspaceRef": "local-hash:ws_01",
      "graphId": "graph_capacity_fade",
      "metrics": {
        "durationMs": 742,
        "datasetRowCount": 48213,
        "seriesCount": 3
      },
      "dimensions": {
        "rendererFamily": "vega-lite",
        "renderMode": "svg",
        "personaHint": "technical",
        "offlineState": "queued"
      },
      "outcome": "success"
    },
    {
      "eventId": "evt_002",
      "type": "workspace.reopen.completed",
      "occurredAt": "2026-04-15T14:44:58Z",
      "workspaceRef": "local-hash:ws_01",
      "metrics": {
        "durationMs": 3310,
        "issueCount": 1
      },
      "dimensions": {
        "migrationApplied": false,
        "readinessStatus": "warning"
      },
      "outcome": "success"
    }
  ]
}
```

### 4.8 Release manifest example shape

**Decision**

Lock a release manifest that is operationally small but compatibility-aware.

**Rationale**

- Shell bootstrap, update prompts, support gating, and workspace compatibility need one source of truth.
- A minimal manifest also preserves the architecture's separation between analytical runtime and operational shell concerns.

**Risks / tradeoffs**

- If the manifest becomes too broad, it becomes an accidental backend contract.
- If it is too thin, support gating and migrations become fragmented.

**What must be locked now**

- Build version.
- Release date.
- Support matrix version.
- Workspace compatibility envelope.
- Service worker version.
- Update prompt policy.

**What can remain flexible**

- Asset-manifest internals.
- Release-notes format.
- Operational metadata that does not affect client compatibility.

**Example**

```json
{
  "schemaVersion": "1.0.0",
  "appBuildVersion": "0.1.0",
  "releaseDate": "2026-04-15T00:00:00Z",
  "channel": "internal-stable",
  "supportMatrixVersion": "2026-04-15",
  "supportMatrixUrl": "/api/support-matrix",
  "workspaceCompatibility": {
    "minReadableFormat": "1.0.0",
    "maxReadableFormat": "1.x",
    "migrationPolicy": "migrate-on-open"
  },
  "serviceWorker": {
    "version": "sw-0.1.0",
    "scope": "/",
    "offlineReadyTimeoutMs": 5000,
    "updatePromptMode": "soft-refresh"
  },
  "telemetry": {
    "endpoint": "/api/telemetry",
    "schemaVersion": "1.0.0"
  },
  "releaseNotes": {
    "title": "Initial internal preview",
    "url": "/release-notes/0.1.0"
  },
  "integrity": {
    "manifestSha256": "sha256:release-manifest-001"
  }
}
```

## 5. Proposed ADR list

The architecture already contains ADR-style decisions using `ADR-*` numbering. To avoid collisions, the implementation kickoff ADR set should use an `IK-ADR-*` prefix.

| ADR | Title | Why it should exist |
| --- | --- | --- |
| IK-ADR-01 | Graph runtime selection: Vega-Lite/Vega primary, ECharts fallback | This is the main unresolved implementation-shaping decision. |
| IK-ADR-02 | BMAD graph-definition contract and renderer adapter boundary | Prevents raw renderer config from leaking into persistence and feature code. |
| IK-ADR-03 | Canonical route inventory and route helper policy | Prevents routing drift and broken trust-surface deep links. |
| IK-ADR-04 | Service worker ownership and cache boundary | Keeps shell concerns separate from analytical concerns. |
| IK-ADR-05 | Workspace snapshot schema v1 | Defines the canonical persistence contract for save/reopen. |
| IK-ADR-06 | Workspace ledger event taxonomy and append-only guarantees | Gives Mission Log and drift replay a stable language. |
| IK-ADR-07 | Issue record contract and repair-action linking | Keeps Repair Card and readiness blockers coherent. |
| IK-ADR-08 | Telemetry privacy boundary and offline batch contract | Prevents accidental privacy drift while supporting KPI instrumentation. |
| IK-ADR-09 | Release manifest and compatibility envelope | Keeps shell bootstrap, updates, and reopen compatibility aligned. |
| IK-ADR-10 | Browser support matrix and Safari stance | The PRD explicitly leaves Safari as an explicit decision, not an assumption. |
| IK-ADR-11 | Benchmark fixture inventory and graph-performance gates | Converts NFR thresholds into executable validation assets. |
| IK-ADR-12 | Export manifest and integrity policy | Aligns handoff/export with provenance and review expectations. |

Recommended ADR writing order:

1. IK-ADR-01 Graph runtime selection.
2. IK-ADR-02 Graph-definition contract and renderer adapter.
3. IK-ADR-05 Workspace snapshot schema v1.
4. IK-ADR-06 Workspace ledger taxonomy.
5. IK-ADR-07 Issue record contract.
6. IK-ADR-08 Telemetry privacy boundary.
7. IK-ADR-03 Canonical routes.
8. IK-ADR-04 Service worker ownership.
9. IK-ADR-09 Release manifest and compatibility envelope.
10. IK-ADR-10 Browser support matrix and Safari stance.
11. IK-ADR-11 Benchmark fixtures and graph performance gates.
12. IK-ADR-12 Export manifest and integrity policy.

## 6. Immediate next actions before epics/stories

1. Write IK-ADR-01 and IK-ADR-02 immediately so implementation does not start with competing chart-runtime assumptions.
2. Turn the example contracts in Section 4 into shared schema files under `src/schemas/` before any feature UI work starts.
3. Build a graph-runtime spike with the recommended stack for exactly four prototype views:
   - scatter + regression overlay
   - dual-axis line
   - faceted small multiples
   - density or ridgeline-adjacent distribution chart
4. Run the spike against the first benchmark datasets and decide whether the ECharts fallback must be activated.
5. Implement route constants and shell boot wiring before adding feature routes or readiness links.
6. Implement service worker registration and shell-status plumbing, but keep telemetry queue ownership in application services.
7. Draft the browser support matrix ADR, especially the Safari decision, before environment-gating UI is finalized.
8. Add redaction tests for telemetry and export manifest generation before any operational endpoint work expands.

Bottom line:

- The highest-priority unresolved decision is now closed in recommendation form: **Vega-Lite + Vega primary, Apache ECharts fallback**.
- The next most important work is not UI construction. It is **contract writing**: graph-definition boundary, snapshot/ledger/issue/telemetry/release shapes, and their shared schemas.
- If those contracts are locked first, BMAD/Codex implementation can proceed with much lower drift risk.

## Addendum: Strictness Guidance

The contracts in this document and the `IK-ADR-*` set should be interpreted with three levels of force:

### Hard invariants

These should be treated as implementation constraints because drift here would be expensive:

- BMAD owns the graph-definition contract; renderer specs are derived artifacts.
- `activeGraphId` and `referenceGraphId` remain separate in state and persistence.
- One shared issue-record contract powers repair/readiness/export blocking.
- Telemetry must not include dataset rows, formulas, workspace blobs, or evidence text.
- The service worker is shell infrastructure, not a workspace/data runtime.

### Recommended defaults

These are the starting shapes and patterns the implementation should use unless the first spike proves they are wrong:

- The example snapshot, ledger, issue, telemetry, and release shapes in this document.
- Vega-Lite first, Vega by exception.
- One graph-runtime seam that owns renderer execution.
- The route constant set and helper pattern described in this document.

### Deferred details

These should not be treated as frozen too early:

- Exact nested payload details inside snapshot and ledger records.
- Exact telemetry dimension names.
- Internal module path names.
- Full benchmark fixture inventory details.
- Final release-manifest breadth.
- Safari support stance until environment gating is being built.
