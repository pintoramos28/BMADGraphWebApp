---
stepsCompleted:
  - step-01-init.md
  - step-02-discovery.md
  - step-02b-vision.md
  - step-02c-executive-summary.md
  - step-03-success.md
  - step-04-journeys.md
  - step-05-domain.md
  - step-06-innovation.md
  - step-07-project-type.md
  - step-08-scoping.md
  - step-09-functional.md
  - step-10-nonfunctional.md
  - step-11-polish.md
  - step-12-complete.md
  - step-e-01-discovery.md
  - step-e-02-review.md
  - step-e-03-edit.md
inputDocuments:
  - /home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/product-brief-BMADGraphWebApp-2026-03-24.md
  - /home/pinto/repo/BMADGraphWebApp/_bmad-output/brainstorming/brainstorming-session-2026-03-19-183532.md
  - /home/pinto/repo/BMADGraphWebApp/docs/essential-graphing.pdf
  - /home/pinto/repo/BMADGraphWebApp/docs/essential-graphing.parsed.txt
documentCounts:
  briefCount: 1
  researchCount: 0
  brainstormingCount: 1
  projectDocsCount: 2
workflowType: 'prd'
date: 2026-03-24
lastEdited: 2026-04-08
editHistory:
  - date: 2026-04-08
    changes: Aligned hosted-shell references and traceability with sprint-change-proposal-2026-04-08
author: Pinto
classification:
  projectType: web_app
  domain: scientific
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document - BMADGraphWebApp

**Author:** Pinto
**Date:** 2026-03-24

## Executive Summary

BMADGraphWebApp is a greenfield scientific web application focused on helping engineers move from raw data to publication-ready graphs and meaningful visual insight with minimal friction. It is designed for users who need serious exploratory graphing and high-quality output for reports and presentations, but who are poorly served by current options. Excel is accessible but weak for credible exploratory graphing and polished output. JMP is powerful but too broad and difficult for many users to adopt independently. BMADGraphWebApp is intended to close that gap with a browser-native workflow that is easier to learn, faster to use, and still credible for technical analytical work.

The product's core value is workflow quality. Users should be able to import raw data, correct semantics, perform lightweight preparation, build and refine graphs, and reproduce that work later without unnecessary complexity. The primary success condition is that non-technical users feel comfortable exploring data visually and producing strong graphs on their own without coordinating with technical users or investing in specialized training. Future versions can expand toward more of the JMP Graph Builder capability set, but the MVP is intentionally narrower and optimized around intuitive, reproducible graph creation and exploratory analysis.

### What Makes This Special

BMADGraphWebApp is differentiated by making high-quality, reproducible graph creation and data exploration easy enough for non-technical users to do independently. The real market gap is not simply missing chart types or missing analytical power. The deeper gap is the absence of a user-friendly workflow for serious graphing. BMADGraphWebApp addresses that gap with an intuitive interface, streamlined end-to-end flow, and a focused product surface that emphasizes speed, clarity, and high-quality defaults over platform breadth.

Users should choose this product because it enables them to create publication-ready graphs and get deep data insight without learning to code, taking a course on specialized analytics software, or relying on expert intermediaries. Its differentiator is the combination of usability, output quality, exploratory power, and reproducibility within a focused analytical product rather than a heavyweight statistical platform.

## Project Classification

BMADGraphWebApp is classified as a greenfield web application in the scientific domain with medium complexity. The complexity level reflects a product that must balance approachable workflow design with analytically credible behavior, including data import, semantic correctness, graphing, reproducibility, and user trust, without the regulatory or multi-party constraints that define higher-complexity domains.

## Success Criteria

### User Success

BMADGraphWebApp succeeds for users when non-technical engineers can move from raw data to a publication-ready graph quickly, independently, and with confidence. The primary user success condition is that users no longer feel blocked by tool complexity or forced to rely on technical specialists for routine graphing work. Success means first-use tasks feel easy, advanced analytical work remains available without switching tools or fighting the interface, and the workspace stays understandable as analytical complexity grows.

For more technical users, success means the product remains analytically credible. They must be able to inspect data, correct semantics, create derived columns, explore multiple graph views, and preserve work for later reuse without feeling constrained by an oversimplified tool. The user-level "aha" moment is when a user completes their first raw-data-to-graph workflow with minimal friction and sees that the output is strong enough for a real report or presentation.

### Business Success

Business success is defined by meaningful internal adoption and visible replacement of current inefficient workflows. In the near term, the product should prove that it solves a real workplace problem by becoming the preferred tool for non-technical graphing tasks while also earning enough trust from technical users to be seen as credible rather than lightweight.

At the 3-month mark, success means achieving strong usage among the core non-technical audience and measurable initial traction among more technical users. At the 12-month mark, success means materially reducing dependence on JMP and establishing BMADGraphWebApp as the standard workflow for this class of exploratory graphing and presentation-oriented analysis inside the target environment.

### Technical Success

Technical success is defined by whether the product can deliver its usability promise without sacrificing analytical reliability. Import workflows must correctly handle common local data formats, support semantic correction, and recover gracefully from common parsing or data-quality issues. Graph creation and editing must feel responsive enough that users can explore data interactively without losing flow. Saved workspaces must reopen reliably with preserved analytical state so users can trust the product for repeat use rather than one-off chart creation.

The product must also remain credible on representative engineering datasets. That means handling serious local dataset sizes, preserving graph fidelity, supporting lightweight transformation and formula workflows, and maintaining reproducibility across sessions. Technical success is the combination of correctness, responsiveness, continuity, and trust required for users to replace existing tools with this workflow.

### Measurable Outcomes

The primary measurable user outcome is that a non-technical user can produce a graph they would actually use in a report or presentation within 10 minutes of opening the product. Import and semantic correction should be independently completed without assistance for 100% of benchmark clean datasets and for 50% of representative error-containing datasets.

Business success should be measured by 80% adoption among non-technical target users and 20% adoption among technical target users within 3 months of launch. By 12 months, the product should reduce JMP-dependent workflows by more than 50% and become the default workflow for the majority of target exploratory graphing and reporting use cases.

Technical success should be measured by reliable save-and-reopen behavior for full analytical workspaces, responsive graph interactions on representative large local datasets, and preservation of reproducible graphing workflows across sessions and compatible app versions.

### Measurement & Telemetry Plan

To keep the success criteria enforceable, the MVP will maintain a lightweight measurement framework that downstream teams can extend as fidelity grows:

- **Benchmark datasets and scripts** — Maintain two canonical suites under `_bmad-output/benchmarks/`: `benchmark_set_clean` (CSV, Excel, pasted table) and `benchmark_set_dirty` (delimiter, header, type, and missing-value faults). Automation scripts will exercise FR1–FR26 against these suites to capture “time to first graph” and “independent import” evidence.
- **User task instrumentation** — UX and engineering instrument the core loop (import → semantic correction → first saved graph) with timers and anonymized outcome events so telemetry can segment results by persona (non-technical vs. technical) and prove the ≤10 minute KPI.
- **Adoption & displacement tracking** — During rollout, PM/Analytics will maintain a manually curated KPI sheet that tallies weekly active unique users by persona and records observed “legacy workflow” usage (e.g., JMP exports gathered via interviews or lightweight forms). These adoption/JMP figures are intentionally gathered outside of in-app telemetry; the product must not enforce or gate behavior based on application-generated metrics for this goal.
- **Workspace reliability probes** — CI runs save/reopen regression tests on `benchmark_workspace_local`, emitting latency metrics and failure counts tied to NFR1–NFR10 so reliability promises remain verifiable.
- **Executive reporting cadence** — PM/Analytics publish a quarterly “Graph Flow KPI” memo summarizing telemetry, benchmark runs, and qualitative signals so validation, UX, and readiness reviews can trace decisions back to the same measurements.

This measurement layer gives UX, architecture, and QA explicit artifacts to maintain and clear proof paths for each KPI before downstream workflows proceed.

## Product Scope

### MVP - Minimum Viable Product

The MVP must prove that a focused browser-native graphing workflow can replace a meaningful portion of current Excel- and JMP-based work for the target users. That requires local import for common formats, semantic correction, lightweight data preparation, derived columns, interactive graph building, high-quality defaults, simple statistical support, and reliable workspace save and reopen. The MVP must be strong enough that non-technical users can independently create credible report-ready graphs and technical users still recognize the tool as analytically serious.

### Growth Features (Post-MVP)

Post-MVP growth should expand the product toward greater analytical depth and broader workflow coverage without losing the focused usability advantage. This includes introducing more graph-builder capabilities inspired by JMP, expanding transformation depth, improving reusable templates and workflow portability, broadening statistical and analytical options, and increasing support for more advanced exploratory scenarios. Growth features should make the product more competitive for technical users while preserving the approachable experience that differentiates it.

### Vision (Future)

The long-term vision is a broader analytical graphing platform that keeps the intuitive workflow foundation of the MVP while extending into a richer ecosystem of reusable workflows, templates, integrations, and advanced graphing capabilities. Over time, the product can evolve toward a more complete browser-native alternative for exploratory graphing and analytical presentation work, incorporating more of the broader Graph Builder capability set while remaining substantially easier to learn and use than traditional expert-first tools.

## User Journeys

### Journey 1: David Mercer Creates His First Report-Ready Graph

David Mercer is a senior domain engineer who understands the product deeply but avoids heavyweight analytics tools whenever possible. He has a report due later that day and needs a graph that clearly shows product behavior for an internal review and a customer-facing discussion. Today, that usually means struggling through Excel or waiting for a more technical teammate to help him in JMP.

He opens BMADGraphWebApp with a raw local dataset and is met with a calm, guided interface instead of a dense expert surface. The import flow previews the data, identifies likely types, and makes the next step obvious. David corrects a column role, drags variables into a graph, and sees a professional-looking chart take shape quickly. He adjusts a few settings, understands what the chart is saying, and reaches a version he would actually place in a report.

The turning point is not just that the graph looks good. It is that David got there himself without feeling lost, blocked, or dependent on a specialist. By the end of the session, he saves the workspace knowing he can reopen it later instead of rebuilding from memory. His new reality is that graphing no longer feels like a task that requires permission, training, or escalation.

This journey reveals requirements for guided onboarding, clear import preview, semantic role editing, intuitive drag-and-drop graph construction, high-quality visual defaults, low-friction refinement, and reliable workspace save and reopen.

### Journey 2: David Mercer Recovers from a Messy Import Without Asking for Help

A week later, David receives a more difficult dataset shortly before a presentation review. The file has parsing issues, a date column is misread, and several values are missing. In his current workflow, this is the point where confidence collapses and he either gives up on the graph quality or asks a technical teammate to take over.

In BMADGraphWebApp, the import preview does not fail silently or force him into trial and error. It surfaces likely delimiter and type issues, shows what looks wrong, and gives him straightforward correction paths. David fixes the parsing choice, reclassifies a date field, and chooses a sensible missing-value handling option. When he tries a graph combination that would be misleading or confusing, the product blocks it clearly and explains why.

The climax of this journey is that David stays in control even when the data is imperfect. He does not need to understand advanced analytics software to recover from a realistic error case. The resolution is emotional as much as functional: instead of feeling embarrassed or dependent, he feels capable. That confidence is necessary if the product is going to replace current workplace habits rather than just demo well.

This journey reveals requirements for import diagnostics, parsing correction, semantic correction after import, missing-value handling, guardrails against incompatible graph configurations, clear recovery messaging, and undo-safe iterative workflow.

### Journey 3: Priya Raman Investigates a Failure Pattern and Preserves the Analysis

Priya Raman is a technically stronger R&D engineer using visualization as part of investigation work rather than only reporting. She is trying to understand an unexpected product behavior and needs to move quickly across several views of the same dataset. She does not want a beginner-only tool. She wants one that is streamlined but still analytically serious.

She imports a representative dataset, confirms or corrects semantic roles, creates derived columns, and begins switching between graph views to test different hypotheses. She compares variables, adds a simple fit where it helps, and uses the graphing surface as an active investigation tool rather than a final-output formatter. The product stays responsive enough that she remains in exploratory flow instead of waiting on the interface.

The critical moment comes when Priya realizes she can preserve the entire analytical state rather than just the final image. She saves the workspace with its graph setup, transformation choices, and intermediate reasoning intact, then reopens it later to continue without reconstruction. The product has succeeded for her when it feels fast and credible enough to support real technical thinking, not just simplified chart creation.

This journey reveals requirements for formula and derived-column workflows, multiple graph types and transitions, responsive interaction on serious datasets, simple statistical overlays or summaries, preservation of analytical state, and reproducibility across sessions.

### Journey 4: Elena Brooks Verifies That a Graph Can Be Trusted Before It Enters a Quality Discussion

Elena Brooks is a quality engineer who is not the primary graph author, but she cares whether graphs in reports are traceable and defensible. She receives a workspace tied to a product-quality discussion and needs to confirm that the visual, the data interpretation, and any derived values are understandable before the graph is used in a decision-making setting.

She opens the saved workspace and expects to see more than a pretty picture. She needs enough visibility into the underlying dataset, semantic choices, formula-derived fields, and attached statistical summaries to determine whether the output is credible. If something in the workspace is broken or no longer valid, she needs the product to fail clearly rather than hide the problem behind a polished chart.

The climactic value moment is trust. Elena can see how the graph was produced, what assumptions were applied, and whether the current state is still valid. That allows the graph to move from "someone made this" to "this is defensible enough to use." The product becomes organizationally valuable not only because it is easy to use, but because its outputs can be reviewed and trusted.

This journey reveals requirements for reliable workspace reopen, clear error handling on reopened work, inspectability of formula columns and direct dependencies, understandable labeling of statistical outputs, and enough provenance visibility to support review and quality confidence.

### Journey Requirements Summary

Across these journeys, BMADGraphWebApp must support four capability groups. First, it needs a guided but efficient first-run workflow so non-technical users can import data, correct semantics, and create strong graphs without specialist help. Second, it needs resilient error recovery so common parsing issues, missing values, and invalid graph combinations do not break confidence or force escalation. Third, it needs technically credible exploratory power through derived columns, multiple graph views, simple statistical support, and responsive interaction on representative datasets. Fourth, it needs trust and continuity features such as reliable save and reopen, clear recovery on broken workspaces, inspectable derived logic, and review-friendly analytical transparency.

These journeys also clarify what is not yet central to the MVP. There is no separate multi-user admin workflow or API-consumer journey in the current product definition because, even though the analytical shell is centrally hosted for convenience, every workspace remains a single-user, local-first experience with no shared server data. If that changes later, those journey classes should be added before functional requirements are finalized.

## Domain-Specific Requirements

### Compliance & Regulatory

BMADGraphWebApp does not currently operate in a heavily regulated scientific subdomain such as clinical or safety-certified software, so the primary domain burden is not statutory compliance. Instead, the product must satisfy scientific-workflow expectations around reproducibility, defensibility, and reviewability. Outputs must be credible enough to support technical reports, internal investigations, and customer-facing explanations without behaving like disposable presentation graphics.

The product should therefore treat reproducibility and analytical transparency as domain-level obligations. Saved workspaces, derived columns, semantic overrides, and graph states must remain understandable and stable enough that another technically informed reviewer can inspect how a result was produced. Where statistical output is included, it must be labeled clearly enough that users and reviewers can understand what was computed and avoid overclaiming what the result means.

### Technical Constraints

The core scientific-domain constraint is analytical coherence. The application must behave like one consistent analytical workspace rather than a loose set of adjacent features. Semantic typing, transformations, formula recomputation, graph layers, statistics, filters, and saved state must stay synchronized so that users can trust the meaning of what they are seeing.

Performance is also a domain requirement, not just a usability enhancement. The product must remain responsive on representative large local engineering datasets, because scientific users will reject a tool that appears correct in a small demo but degrades under realistic workloads. Accuracy of derived values, stability of graph updates after semantic changes, and reliable reopen of saved workspaces are all domain-critical technical requirements.

### Integration Requirements

The MVP does not require deep scientific-system integration such as LIMS, ELN, remote compute clusters, or external data platforms. The immediate integration requirement is strong interoperability with common local analytical inputs and outputs: CSV, Excel, pasted tabular data, and portable saved workspaces. Import must preserve enough structure and allow enough correction that users can move real data into a trustworthy analytical state without hidden corruption or semantic drift.

A second integration requirement is compatibility across time. Saved workspaces and reusable analytical artifacts should be designed so the product can evolve without making prior work unreadable or misleading. Even if full backward-compatibility guarantees expand after MVP, the domain expectation is that saved analytical work should not become fragile or opaque as the product matures.

### Risk Mitigations

The highest domain-specific risk is false confidence: a graph that looks polished but is based on incorrect semantics, broken formula logic, invalid analytical combinations, or stale saved state. This risk should be mitigated through explicit semantic visibility, graph guardrails, localized transform and formula error states, understandable statistical labeling, and reopen behavior that fails clearly when something can no longer be trusted.

A second major risk is scientific irreproducibility. If users cannot reopen a workspace with its analytical meaning intact, or cannot understand how a derived field or graph was produced, the tool will fail its scientific credibility test. This should be mitigated with a canonical workspace model that preserves semantic state, transformations, formulas, graph configuration, and relevant analytical context together rather than as disconnected UI fragments.

A third risk is performance-driven rejection. If import correction, formula recomputation, graph interaction, or workspace reopening becomes slow on serious local datasets, users will abandon the workflow before trust can form. This should be mitigated by treating representative benchmark datasets and responsiveness gates as release-shaping requirements rather than late optimization tasks.

### Scientific Trust Callouts

- **Reproducibility obligations:** FR43–FR49 and NFR6–NFR10 codify that saved workspaces, derived logic, and reopen flows must stay intact so reviewers can reproduce results without ambiguity.
- **Semantic transparency:** FR8–FR26 ensure users can inspect types, roles, units, and transformation chains so scientific meaning is never hidden behind UI conveniences.
- **Scientific review signals:** FR50–FR58 require guidance, provenance, and reviewer-focused context so Elena-style reviewers can validate outputs before they influence decisions.
- **Hosted shell delivery & offline guarantees:** FR59–FR62 along with NFR19 and NFR22–NFR24 ensure the centrally hosted shell remains convenient, offline-ready, and privacy-preserving without moving datasets or workspaces off the local machine.
- **Performance credibility:** NFR1–NFR5 bind the product to serious engineering datasets so scientific trust is not lost to lag or fragile interactions.

### Domain Traceability Map

- **Reproducibility & audit trail →** FR43–FR49, FR58, NFR6–NFR10
- **Semantic correctness & units →** FR8–FR24, FR58
- **Reviewer defensibility →** FR53–FR58
- **Hosted shell delivery & telemetry boundaries →** FR59–FR62, NFR19, NFR22–NFR24
- **Scientific performance expectations →** NFR1–NFR5, Performance Targets section

## Web App Specific Requirements

### Project-Type Overview

BMADGraphWebApp should be implemented as a desktop-first browser-native analytical workspace rather than a navigation-heavy content web application or a general-purpose mobile experience. Its value depends on preserving coherent interactive state across import, semantic correction, graph editing, transformations, formulas, statistical overlays, and workspace persistence. The interaction model must keep simple tasks easy, preserve advanced analytical control, and remain understandable as layers, transforms, and derived logic accumulate.

### Technical Architecture Considerations

The architecture should be designed around a canonical analytical workspace state that can drive table views, graph configuration, formulas, filters, statistics, and persistence consistently. Frontend interaction logic should not treat graphing, data preparation, and workspace save and reopen as separate feature silos. For this product type, browser architecture is part of product correctness because state drift between table, graph, and saved workspace would directly undermine trust.

The frontend should also assume high interaction density. Drag-and-drop graph construction, semantic editing, formula workflows, and graph updates must remain responsive under ordinary analytical use. That implies careful state management, incremental recomputation where possible, and a rendering strategy that does not collapse under large local datasets or graph edits. If browser-side computation becomes a bottleneck, the architecture should leave room for heavier local processing strategies without breaking the workspace model.

### Browser Matrix

The MVP should explicitly target modern desktop browsers used in engineering and internal workplace environments. Primary support should cover current Chromium-based browsers, especially Chrome and Edge. Firefox should be supported if feasible because it remains a realistic browser in technical organizations. Mobile browsers are not a target environment for the analytical workspace experience.

Safari support should be treated as an explicit compatibility decision rather than assumed implicitly. If the target user environment includes macOS-heavy engineering teams, Safari support should move into the primary support matrix. If not, it can be treated as a secondary compatibility goal after the core interaction model is stable. In all cases, the product should document the supported browser matrix clearly so users know the expected environment for reliable analytical work.

### Responsive Design

Responsive design for this product should mean adaptable desktop layouts, not full mobile feature parity. The interface should scale cleanly across common laptop and desktop resolutions, with enough flexibility to support smaller laptop screens without hiding critical analytical controls. Panels, inspectors, tables, and graph surfaces should resize intelligently so the core workflow remains usable on realistic engineering workstations.

Phone-first layouts should not drive the design. On very small screens, the product can degrade gracefully or restrict the experience rather than pretending the full graph-building workflow is practical. If tablet support is considered, it should be evaluated against actual analytical tasks rather than treated as automatic just because the product is browser-based.

### Performance Targets

For this web application, performance must be defined around interaction quality rather than page-load vanity metrics alone. Initial load should be fast enough that users can begin work without friction, but the more important targets are import responsiveness, graph update latency, formula recomputation behavior, filtering and sorting responsiveness, and workspace reopen time on representative large local datasets.

The product should establish benchmark scenarios early and use them as release gates. At minimum, the team should measure time to usable import preview, time to first editable graph, latency for ordinary graph edits, latency for semantic changes that propagate into graphs and statistics, and time to reopen a saved workspace with meaningful analytical state intact. Performance targets should be anchored to serious analytical usage, not toy datasets.

### SEO Strategy

SEO is not a primary product requirement for the MVP analytical workspace. BMADGraphWebApp is not being positioned as a content-discovery product whose value depends on search traffic to application surfaces. The product's core value is in the authenticated or internal browser workspace itself, so technical SEO should not distort core application architecture decisions.

The product should still maintain sane web fundamentals such as metadata, shareable documentation pages if applicable, and clean handling of app shell routes. However, SEO optimization beyond those basics should remain secondary to analytical interaction quality, workspace correctness, and browser reliability.

### Accessibility Level

Accessibility should be treated as a real product requirement even though this is a dense analytical interface. Core workflows such as import, semantic correction, panel navigation, settings changes, formula editing, and workspace save and reopen should be operable without forcing mouse-only interaction. The application should support keyboard navigation, visible focus states, readable labeling, and accessible status and error messaging throughout the analytical flow.

Graph-heavy interaction introduces harder accessibility challenges, especially where visual encoding, drag-and-drop, or canvas-style interaction is central. The requirement should therefore be twofold: first, make all surrounding workflow controls accessible; second, ensure that critical analytical meaning shown visually is also available through inspectable textual or tabular alternatives where practical. Accessibility cannot be an afterthought added only to simple forms while the core workflow remains opaque.

### Implementation Considerations

Implementation should prioritize workspace coherence, responsive interaction, and clear support boundaries over broad platform ambition. The product should avoid prematurely optimizing for mobile, SEO-heavy routing, or real-time collaboration, because those would dilute the requirements that determine whether the workspace is credible.

The implementation path should remain analytical-workspace-first: establish the browser-side workspace model, define supported browser targets, build adaptive desktop layouts, set concrete interaction performance gates, and enforce accessibility expectations for core flows before broader platform expansion.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP with a high credibility threshold. The goal of the first release is not to demonstrate isolated chart rendering or a polished shell. It is to prove that a browser-native analytical workspace can reliably carry a user from raw local data to a credible, publication-ready graph through one coherent workflow.

**Resource Requirements:** The minimum credible delivery shape is a small cross-functional team that can cover product and design judgment, browser-based workspace architecture, graph and rendering interaction, data import and transformation logic, and focused QA on analytical correctness and performance. A practical MVP team would likely require one product and design owner, two to three engineers with strong frontend and state-modeling capability, and dedicated validation attention on import trust, persistence behavior, and performance gates.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**  
The MVP must fully support David's first report-ready graph journey, David's messy-import recovery journey, and Priya's exploratory investigation journey. It should also support the essential trust slice of Elena's reviewer journey through reliable workspace reopen, inspectable derived logic, and understandable statistical context. If these journeys do not work end to end, the product has not yet proven its core value.

**Must-Have Capabilities:**  
- local import for CSV, Excel, and pasted tabular data with preview and correction before commit  
- explicit semantic typing and analytical role visibility with user overrides  
- lightweight structured data preparation and row-wise formula columns  
- direct-manipulation graph building with strong defaults and credible report-ready output  
- simple graph-tied statistical summaries and one basic fit or regression path  
- reliable save and reopen of full analytical workspace state  
- responsive interaction on representative serious local datasets  
- localized, recoverable handling of parsing, transform, and formula failures  
- enough inspectability and transparency to support user trust and technical review

### MVP Graph Pattern Scope

The MVP must distinguish between graph behaviors that are locked scope and graph patterns that remain optional or post-MVP. This keeps the implementation backlog aligned with the analytical loop the product is actually trying to prove.

The exact locked MVP family inventory, template IDs, overlay rules, and blocked combinations are defined in [core-graph-catalog.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/core-graph-catalog.md).

**Locked MVP graph scope:**  
- template-assisted first-graph creation that accelerates the role-assignment workflow without replacing it  
- core graph families and direct-manipulation editing needed to satisfy FR27-FR38  
- at least one graph-tied fit or regression path satisfying FR40  
- four-variable encoding with explicit performance guardrails satisfying FR35  

**Optional MVP stretch only if delivery capacity permits:**  
- dual-axis comparison flows  
- ridgeline small multiples  
- broad template-gallery depth beyond the minimum first-graph workflow  
- KPI-card-heavy overlays beyond the minimum trust and evidence workflow  

**Not assumed by default for MVP:**  
- broad chart-type parity with expert-first analytics tools  
- extensive template catalogs or reusable chart libraries  
- decorative analytical overlays that do not materially strengthen the core trust workflow  

The MVP should remain intentionally narrow in breadth even while being demanding in depth. It does not need near-parity chart coverage, connected data sources, multi-user collaboration, or enterprise governance features to prove the concept. It does need one trustworthy analytical loop that users can actually rely on.

**Reviewer workflow boundary:**  
In MVP, reviewer inspection is a local in-app workflow. A reviewer imports or reopens a workspace into BMADGraphWebApp on their own machine and evaluates it through the application's review surfaces. Shared live review, concurrent presence, and cloud approval workflows are out of scope.

### Post-MVP Features

**Phase 2 (Post-MVP):**  
Phase 2 should turn the MVP from a credible focused builder into a more durable and competitive analytical workspace. The priorities are broader analytical plot coverage, richer comparison workflows, stronger overlay depth, more reusable visualization artifacts, improved long-term compatibility of saved workspaces, and deeper durability of analytical state across sessions and versions. If stretch capabilities do not fit in MVP, the first ones worth reclaiming are reusable visualization definitions and selected comparison-oriented graph features.

**Phase 3 (Expansion):**  
Phase 3 should extend the product beyond the initial focused workspace into a broader analytical platform. This includes connected data sources, richer template and artifact reuse, broader statistical and graph-builder depth, sharing and reuse mechanisms across teams, and expansion toward a more complete browser-native alternative for exploratory graphing and analytical presentation work. This is also the phase where broader market expansion beyond the initial internal engineering audience becomes realistic.

### Risk Mitigation Strategy

**Technical Risks:**  
The largest technical risks are state incoherence, performance collapse under real datasets, and persistence that behaves like UI snapshotting rather than faithful analytical-state preservation. These should be mitigated by establishing a canonical workspace kernel early, treating performance as a release-shaping constraint from the first vertical slice, and defining release gates around semantic propagation, formula recomputation, graph responsiveness, and workspace reopen fidelity.

**Market Risks:**  
The main market risk is failing both ends of the intended user spectrum: the product could remain too intimidating for non-technical users while also feeling too shallow for technical users. The MVP addresses this by proving the full analytical loop for both David and Priya rather than optimizing only for a beginner demo. Success should be validated through time-to-first-report-ready-graph, independent import completion, and early adoption within the intended internal user base.

**Resource Risks:**  
The biggest resource risk is scope creep from Configuration A into Configuration B before the core is stable. The mitigation is an explicit slip order. If delivery pressure emerges, faceting and small multiples slip first, broader analytical overlay richness slips next, and reusable visualization definitions should be protected as long as possible among stretch items. The team should preserve import trust, semantic correctness, structured prep, persistence, and serious-scale responsiveness ahead of any breadth expansion.

## Functional Requirements

### Data Import & Intake

- FR1: Users can import local tabular data from CSV files, Excel files, and pasted tabular input into the analytical workspace.
- FR2: Users can preview imported data before committing it into analysis.
- FR3: Users can review parsing, structure, and semantic-inference assumptions such as delimiter handling, header interpretation, detected date or numeric formats, and uncertainty indicators before import is finalized.
- FR4: Users can identify when the system is uncertain about an import or semantic interpretation and explicitly confirm or correct that uncertainty before continuing.
- FR5: Users can confirm or reject an import after reviewing the previewed dataset state.
- FR6: Users can identify missing, invalid, or malformed values in imported datasets and choose how those values should be handled in the active analysis.
- FR7: Users can reopen previously saved analytical workspaces as input artifacts for continued analysis.

### Semantic Interpretation & Dataset Management

- FR8: Users can inspect the inferred data type and analytical role of each imported column.
- FR9: Users can change a column's data type when the inferred type is incorrect or unsuitable for analysis.
- FR10: Users can change a column's analytical role when the inferred role is incorrect or unsuitable for graphing or statistics.
- FR11: Users can see which semantic choices are currently active for a dataset before graphing begins.
- FR12: Users can see semantic changes immediately affect downstream graphs and analytical summaries.
- FR13: Users can inspect the active dataset structure and working analytical context while building or reviewing a graph.
- FR14: Users can inspect and edit field labels and units used in graphs and analytical summaries.

### Data Preparation & Derived Logic

- FR15: Users can perform lightweight structured data preparation within the analytical workspace.
- FR16: Users can filter and sort data within the active analysis.
- FR17: Users can define analytical subsets that consistently affect the active table, graph, and statistical outputs.
- FR18: Users can recode or correct data values needed to make the dataset analytically usable.
- FR19: Users can create derived columns using formula-based logic.
- FR20: Users can preview the effect of a formula or transformation before committing it to the analytical workspace.
- FR21: Users can see which columns are formula-derived rather than directly imported.
- FR22: Users can inspect the formula definition and direct input columns for a derived field.
- FR23: Users can identify when a transformation or formula step has failed without corrupting the rest of the analytical workflow.
- FR24: Users can repair or revise failed transformation and formula steps within the workspace.
- FR25: Users can inspect and edit the ordered sequence of transformation steps applied in the analytical workspace.
- FR26: Users can undo recent analytical changes during iterative exploration.

### Graph Building & Visual Analysis

- FR27: Users can create graphs by assigning dataset fields to supported analytical roles within a graph-building workflow.
- FR28: Users can build graphs through direct manipulation rather than requiring code or scripting.
- FR29: Users can generate an initial graph from selected fields using supported default encodings and presentation settings.
- FR30: Users can choose from graph types that support exploratory analysis, relationship analysis, multivariate analysis, and report-ready communication.
- FR31: Users can modify graph structure by changing assigned variables, analytical roles, and supported graph elements.
- FR32: Users can add, remove, reorder, and inspect compatible graph layers within a single graph.
- FR33: Users can refine graph presentation through supported controls for labels, legends, scales, axes, titles, subtitles, and other presentation-relevant visual settings including readable spacing and typography.
- FR34: Users can interact with graphs through hover, zoom, pan, and related inspection controls to inspect values, patterns, and anomalies in the current analytical view, and can reset transient exploration state without rebuilding the graph.
- FR35: Users can assign at least four variables simultaneously across the X/Y axes and supported layers (such as color, size, or facets) when comparing analytical relationships. If a user attempts to add more than four variables, the system either accepts the combination while maintaining the performance guarantees in the NFRs or displays a warning explaining the limit.
- FR36: Users can add supported analytical overlays and visual references to graphs to aid interpretation of the current analysis.
- FR37: Users can create graphs that reflect the current filtered, transformed, and semantically interpreted analytical state.
- FR38: Users can be prevented from creating unsupported or misleading graph combinations and receive an explanation when a requested composition is blocked.

### Statistical Insight

- FR39: Users can generate descriptive analytical summaries from the current dataset or active analytical view.
- FR40: Users can generate at least one basic graph-tied fit or regression-style analytical result within the supported workflow.
- FR41: Users can see statistical output that reflects the current graph, subset, and analytical state rather than detached raw input alone.
- FR42: Users can inspect statistical outputs with plain-language labels or descriptions that clarify what result is being shown, what data subset or graph state produced it, and whether the result is exploratory guidance rather than a formal claim.

### Workspace Persistence & Reproducibility

- FR43: Users can save the full analytical workspace as a reusable local artifact for later continuation.
- FR44: Users can reopen a saved workspace with its dataset semantics, transformations, derived columns, graph state, and relevant analytical context preserved.
- FR45: Users can continue editing a reopened workspace without rebuilding the prior analysis from scratch.
- FR46: Users can detect when a reopened workspace contains broken, incompatible, or no-longer-valid analytical elements.
- FR47: Users can continue working with the valid portions of a reopened workspace while repairing flagged broken or incompatible analytical elements.
- FR48: Users can preserve graph definitions, derived fields, and transformation state as part of saved analytical work rather than only saving final output images.
- FR49: Users can rely on the workspace as the system of record for an analytical session, not only as a temporary graph editor.

### Guidance, Review, and Output

For FR53-FR57, "review" means local in-app review of an imported or reopened workspace, not a shared multi-user session.

- FR50: First-time or non-technical users can access guided help during the core workflow.
- FR51: Users can receive contextual guidance during import, semantic correction, and graph creation.
- FR52: Users can receive clear recovery guidance when import, formula, transformation, or graphing issues occur.
- FR53: Reviewers can inspect a saved workspace well enough to understand how a graph was produced and what assumptions were applied.
- FR54: Reviewers can inspect derived fields, semantic decisions, and attached analytical context when evaluating graph credibility.
- FR55: Users can produce graph outputs suitable for use in reports, presentations, and customer-facing communication.
- FR56: Users can export graph outputs, transformed data, or active analytical subsets from the workspace for use outside the application.
- FR57: Users can distinguish exploratory analytical work from final communication output without leaving the same end-to-end workflow.
- FR58: Users can inspect and update per-column units, measurement context, and descriptive metadata so that scientific meaning is explicit in tables, graphs, and exports.
- FR59: Users can launch BMADGraphWebApp through a centrally hosted browser shell without installing local binaries or managing manual updates.
- FR60: After the hosted shell loads once, the analytical experience continues offline by relying on cached assets and local workspace state.
- FR61: Telemetry metrics such as performance timings and error events are transmitted to the hosted shell when connectivity exists, queue locally when offline, and flush automatically without interrupting the user’s analysis.
- FR62: The hosted shell surfaces environment checks, update prompts, and release notes without transmitting user datasets, transformations, or workspaces off the local machine.

## Non-Functional Requirements

### Performance

- Performance thresholds below are measured against the team-approved benchmark import files, working datasets, and saved workspaces documented in the MVP validation plan.
- NFR1: Import preview must become available within 5 seconds for team-approved benchmark CSV and Excel import files documented in the MVP validation plan.
- NFR2: Ordinary graph edits, semantic overrides, and presentation changes must update the active graph within 1 second for team-approved benchmark working datasets documented in the MVP validation plan.
- NFR3: Filtering, sorting, subset changes, and single-step formula or transformation recomputation must complete within 2 seconds for the same benchmark dataset set; if an operation exceeds that threshold, the product must show a visible in-progress state.
- NFR4: A team-approved benchmark saved workspace must reopen to a usable analytical state, including restored dataset context, graph configuration, and primary editing controls, within 10 seconds.
- NFR5: The product must remain operationally usable on at least one team-approved serious-scale benchmark dataset documented in the MVP validation plan, with visible warning or progress feedback and graceful degradation rather than silent failure when limits are approached.

### Reliability & Data Integrity

- NFR6: Save and reopen within the same released MVP version must preserve dataset semantics, transformations, subsets, formulas, graph state, and analytical context without meaningful drift.
- NFR7: Import, transformation, formula, and reopen failures must remain localized and must not corrupt unrelated workspace state.
- NFR8: The product must not discard unsaved analytical changes without an explicit user acknowledgment or recovery path.
- NFR9: If a saved workspace contains broken or unsupported analytical elements, the product must identify those elements explicitly while preserving the remaining valid analytical state.
- NFR10: Released MVP builds must reopen workspace artifacts created by the same released build and any explicitly supported patch release within the same MVP release line.

### Accessibility

- NFR11: Core workflows including import, semantic correction, transformation editing, formula editing, save and reopen, and export must be operable using keyboard navigation alone.
- NFR12: Core controls, status messages, errors, and guidance content in supported desktop browser and workspace configurations defined in the published support matrix must conform to WCAG 2.1 AA.
- NFR13: Critical analytical meaning shown visually in graphs must also be available through inspectable labels, values, or tabular or text alternatives where practical.
- NFR14: Focus order, visible focus states, and accessible naming for interactive controls must remain intact throughout the core workflow.

### Browser Compatibility & Workspace Environment

- NFR15: The published MVP support matrix must include the current major desktop versions of Chrome and Edge, and the product must be fully validated against those supported configurations before release.
- NFR16: Before release, the product must publish an explicit browser and workspace support matrix covering supported browsers, minimum supported workspace configuration, and standard zoom assumptions, and validate each supported configuration against the core analytical workflow.
- NFR17: The analytical workspace must remain usable across every supported configuration in that matrix without hiding critical controls or requiring horizontal browser scrolling during the core analytical workflow.
- NFR18: Unsupported browsers or unsupported workspace configurations must be communicated before users begin import, reopen, or other workflows that could lead to meaningful analytical work.

### Security & Data Handling

- NFR19: Standard analytical operations may rely on a centrally hosted shell for asset delivery and telemetry, but imported datasets, derived formulas, and saved workspaces must remain on the local machine unless the user explicitly exports them.
- NFR20: Any outbound transfer of dataset or workspace content must be initiated by an explicit user action.
- NFR21: Operational telemetry and diagnostics must exclude raw dataset values, formula definitions, and saved workspace contents by default.
- NFR22: After the hosted shell loads once, it must enter an offline-ready state within 5 seconds so users can continue their analysis without an active network connection.
- NFR23: Telemetry buffering and flush behavior must never block or degrade the analytical workflow; queued metrics must retry automatically when connectivity returns.
- NFR24: The hosted shell delivery service must maintain at least 99.5% availability during business hours, with monitoring that alerts the team if cache invalidation or asset refresh failures threaten that target.
