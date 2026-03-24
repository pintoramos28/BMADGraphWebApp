---
stepsCompleted: [1, 2, 3]
inputDocuments: []
session_topic: 'Browser-based JMP Graph Builder analogue informed by the essential-graphing PDF'
session_goals: 'Design a fully functional web application that reproduces JMP Graph Builder capabilities, supports multi-format table import, column data type changes, computed columns with custom formulas, and surfaces missing or non-obvious features required for a credible product.'
selected_approach: 'progressive-flow'
techniques_used: ['Question Storming', 'Mind Mapping', 'Morphological Analysis', 'Decision Tree Mapping']
ideas_generated: []
context_file: ''
session_continued: true
continuation_date: '2026-03-24'
---

# Brainstorming Session Results

**Facilitator:** Pinto
**Date:** 2026-03-19 18:40:50 EDT

## Session Overview

**Topic:** Browser-based JMP Graph Builder analogue informed by the `essential-graphing` PDF
**Goals:** Design a fully functional web application that reproduces JMP Graph Builder capabilities, supports multi-format table import, column data type changes, computed columns with custom formulas, and surfaces missing or non-obvious features required for a credible product.

### Session Setup

The session is centered on building a browser-native graph builder and data table workflow that feels credible to users familiar with JMP Graph Builder. In addition to feature parity planning, the session will explicitly probe for overlooked capabilities, workflow gaps, power-user expectations, and edge cases that should shape the product definition.

## Technique Selection

**Approach:** Progressive Technique Flow
**Journey Design:** Systematic development from exploration to action

**Progressive Techniques:**

- **Phase 1 - Exploration:** `Question Storming` to surface missing requirements, hidden workflows, and neglected problem areas before solutioning
- **Phase 2 - Pattern Recognition:** `Mind Mapping` to organize discoveries into coherent product domains and relationship clusters
- **Phase 3 - Development:** `Morphological Analysis` to turn major domains into well-formed feature and system combinations
- **Phase 4 - Action Planning:** `Decision Tree Mapping` to define sequencing, dependencies, and implementation paths

**Journey Rationale:** This sequence is designed to prevent premature fixation on only the visible graph-builder UI. It widens the search space first, then structures the result, then develops product concepts, and only after that turns them into execution decisions.

## Technique Execution Results

**Phase 1 - Question Storming: Wave 1**

**Interactive Focus:** credibility of the browser-based graph builder, exploratory analysis speed, data editing and formula workflows, performance at scale, graph customization, error handling, and import/export usability

**Questions Generated:**

1. Can I create high quality data visualizations from various file formats?
2. Is it intuitive to create the visualizations for exploratory data analysis?
3. Can I gain insights into the data quickly through visualizations and data summaries?
4. Can I edit the data after importing in order to correct errors in the data or modify formats?
5. Can I create new columns calculated from existing columns in order to identify new patterns or insights?
6. Can the application handle extremely large datasets (1 million rows)?
7. Can I import or export data visualizations or workspaces in order to quickly share or recreate data visualizations?
8. Can I gain statistical insights from the data (for example linear regressions and summary statistics)?
9. Can I customize my graphs to tell the story I am looking for?
10. Is the application fast enough to work effectively?
11. Does the application tell me in a straightforward manner what errors occurred and how I could potentially correct them?
12. Does the application handle errors in the data intuitively?

**Emerging Themes:**

- visualization quality and exploratory usability
- data preparation and correction workflows
- calculated columns and statistical insight generation
- large-scale performance and responsiveness
- workspace portability and graph sharing
- clear, actionable error handling

**Facilitation Note:** After twelve questions, the next exploration wave should pivot into orthogonal domains that are less obvious at first glance, especially reproducibility, governance, collaboration, extensibility, and semantic correctness.

**Phase 1 - Question Storming: Wave 2**

**Interactive Focus:** reproducibility, workspace persistence, formula provenance, undo safety, statistical interpretability, and advanced transformation support

**Questions Generated:**

13. Can I save my workspace, including dataset, transformations, and visualization layers, to reopen later?
14. Can I export only the data visualization structure so the same visualization can be reproduced with different datasets?
15. Are added formula columns clearly marked as formula columns?
16. If I make a mistake while modifying my workspace, can I undo recent changes?
17. Will statistical analyses clearly indicate what they mean so users with basic statistics knowledge can still gain insight?
18. For standard datasets requiring more complex analyses, can more complicated data transforms be defined and executed in simple steps to generate a post-processing dataset?

**Emerging Themes:**

- workspace persistence and reproducibility
- distinction between data, formulas, and visualization definitions
- safety nets for iterative exploratory work
- accessible interpretation of statistical output
- higher-order transformation pipelines for advanced users

**Facilitation Note:** The next domain pivot should move away from trust and governance into semantics, interaction design, ecosystem integration, and expert workflow acceleration.

**Phase 1 - Question Storming: Wave 3**

**Interactive Focus:** semantic typing, graph defaults, interaction quality, layer compatibility, data issue handling, and high-speed expert workflows

**Questions Generated:**

19. Does the app automatically interpret data column types and semantic roles correctly, such as datetimes, strings, numbers, and continuous, nominal, or ordinal variables?
20. Are the differentiating factors in visualizations distinct and clear, such as colors, shapes, and sizes?
21. Do graph defaults produce professional-quality graphs without requiring advanced modifications?
22. Is graph interactivity, such as hover tooltips and zooming, intuitive and simple without overloading the user?
23. Does the application prevent users from generating extremely confusing or incompatible graph layer combinations, with a warning that explains why the combination is being blocked?
24. Are all actions within the application fast, particularly visualization updates?
25. Are there multiple intuitive ways to handle issues in imported datasets, such as changing column types, handling missing values, and adding unit types for automatic labeling, while still providing sensible defaults?
26. Can I quickly modify visualizations to highlight complex interactions?

**Emerging Themes:**

- semantic correctness and automatic data-role inference
- strong default visual design without excessive tuning
- interaction simplicity and expert-speed editing
- guardrails against invalid or misleading chart compositions
- robust dataset issue handling with intuitive defaults

**Facilitation Note:** The next pivot should leave the single-user interaction layer and probe team workflow, ecosystem integration, automation, and operational realism.

**Phase 1 - Question Storming: Wave 4**

**Interactive Focus:** downstream workflow fit, onboarding speed, data-system connectivity, and repeatable analysis on refreshed data

**Questions Generated:**

27. Can outputs feed reports, presentations, or downstream workflows cleanly?
28. Can users onboard quickly without reading a manual?
29. Can the tool connect to broader data systems instead of only local files?
30. Can analyses be repeated on refreshed data without manual rebuilding?

**Emerging Themes:**

- whether the product integrates into a broader analytics workflow
- whether the experience is discoverable enough for first-use success
- whether the tool supports connected data rather than only file-based usage
- whether analytical work is reusable instead of disposable

**Facilitation Note:** After thirty questions, the next productive pivot is into black-swan and operational failure modes: what would make a serious team reject the product even if core features look good in a demo.

**Phase 1 - Question Storming: Wave 5**

**Interactive Focus:** adoption failure, usability overreach, restrictive plotting behavior, compatibility problems, reproducibility burden, performance breakdown, and confusing incompatibilities

**Questions Generated:**

31. Is the tool too complex to use for simple plots?
32. Is the tool too restricting when making plots?
33. Does the tool have too many compatibility issues?
34. Is it too much work to reproduce plots?
35. Is the tool too slow?
36. Can the tool handle 1 million rows of data?
37. Are incompatibilities too confusing for a user to correct?

**Emerging Themes:**

- balance between power and simplicity
- over-constraint versus flexible graph composition
- operational compatibility and browser reliability
- reproducibility effort and performance ceilings
- confusing failure states that would drive abandonment

**Facilitation Note:** This wave surfaces real rejection criteria, but several questions overlap with earlier performance and scale concerns. The next pivot should sharpen into higher-risk failures that were not yet probed deeply enough: security, collaboration conflicts, auditability, and defensible statistical interpretation.

**Phase 1 - Question Storming: Wave 6**

**Interactive Focus:** interpretability of statistical output, resilience when reopening broken workspaces, and cross-source connectivity

**Questions Generated:**

38. Are statistical outputs extremely clear as to what they are?
39. When loading workspaces with errors, are the errors handled as well as possible or does the import fail entirely?
40. Is it possible to easily connect different data sources?

**Emerging Themes:**

- clarity and defensibility of statistical output
- robustness and graceful degradation when reopening saved work
- practical data connectivity beyond single-file workflows

**Facilitation Note:** The next useful prompts should target the still-underexplored blockers: permissions and privacy, multi-user edit conflicts, transform lineage, and workspace version drift.

**Phase 1 - Question Storming: Wave 7**

**Interactive Focus:** clarified scope boundaries and reduced lineage visibility for formula columns

**Scope Constraints Confirmed:**

- permissions, privacy, and compliance are out of scope
- there are no multi-user collaboration requirements
- application version drift should preserve backward compatibility for saved data, workspaces, and templates

**Questions Generated:**

41. Does the app show the reduced lineage of formula columns, meaning the formula definition and its direct dependencies?

**Emerging Themes:**

- intentionally single-user workflow design
- backward compatibility as a hard product requirement
- lightweight but inspectable provenance for derived columns

**Facilitation Note:** The remaining useful pressure points are schema evolution, formula dependency breakage, and saved-workspace portability across app versions.

**Phase 1 - Question Storming: Wave 8**

**Interactive Focus:** schema evolution, formula dependency failures, backward compatibility, and portability of saved artifacts

**Questions Generated:**

42. Does the app show the formula definition and direct input columns for each formula column?
43. When loading an older workspace, does the app preserve behavior or clearly explain any compatibility adjustments?
44. Can I save workspaces, templates, and visualization details to files to load with different instances of the app?
45. Do broken formula dependencies cause the column to yield an error?

**Emerging Themes:**

- inspectability of derived columns
- graceful handling of schema and version drift
- portability of saved analytical artifacts across app instances
- explicit failure behavior for broken formula graphs

**Facilitation Note:** Question Storming now has strong coverage of core graph-builder capability, data workflow, trust, reproducibility, semantic correctness, adoption risks, and backward-compatible persistence. The next choice is whether to push for another orthogonal batch or move into pattern recognition.

**Question Storming Completion Summary**

- **Questions generated:** 45
- **Creative Breakthroughs:** The session moved well beyond "can it draw charts" into reproducibility, formula inspectability, statistical clarity, semantic correctness, graph guardrails, backward compatibility, and portability of saved analytical artifacts.
- **Scope Clarifications Captured:** permissions, privacy, compliance, and multi-user collaboration are out of scope; backward compatibility for saved data, workspaces, and templates is in scope.
- **Transition Rationale:** The question set is now broad enough that further divergence would likely repeat existing themes. The next useful move is to organize the space into product domains and identify the strongest clusters.

**Phase Transition:** Moving from `Question Storming` to `Mind Mapping` for pattern recognition and domain clustering.

**Phase 2 - Mind Mapping: Structural Correction**

**User Insight:** The original branch list underweighted the core value of the product by collapsing the visualization system into a single branch. Since the primary purpose of the application is the graph-building and visualization experience, the mind map should treat visualization as the dominant branch with explicit sub-branches rather than as one peer among many.

**Mapping Adjustment:** Reframe the map so the visualization system is the primary product branch, with data import, data prep, formulas, persistence, performance, and workflow integration as supporting branches around it.

**Phase 2 - Mind Mapping: Revised Top-Level Branches Accepted**

**Accepted Structure:**

1. **Visualization System**
   - primary product branch
   - includes graph types, layering, role assignment, encodings, axes/scales, interaction, defaults, guardrails, comparison views, and visual export

2. **Data Import and Table Semantics**
3. **Data Preparation and Formula Workflow**
4. **Statistical Insight Layer**
5. **Persistence and Reproducibility**
6. **Performance and Scale**
7. **Usability and Guardrails**
8. **Workflow Integration**

**Interpretation:** Branch 1 is the product. Branches 2 through 8 are the supporting systems that determine whether the visualization system is credible in real use.

**Phase 2 - Mind Mapping: Visualization System Sub-Branches Accepted**

**Accepted Visualization System Structure:**

1. **Graph Type and Mark Library**
2. **Builder Interaction Model**
3. **Encoding and Role Mapping**
4. **Layering and Composition**
5. **Axes, Scales, Legends, and Faceting**
6. **Interactive Exploration**
7. **Default Quality and Storytelling Control**
8. **Visual Output and Reuse**

**User Assessment:** all eight branches were accepted as-is, with no missing first-level visualization branches identified at this stage.

**Phase 2 - Mind Mapping: Visualization System Priority Classification**

**Critical:**

1. **Graph Type and Mark Library**
2. **Builder Interaction Model**
3. **Encoding and Role Mapping**
4. **Layering and Composition**
5. **Axes, Scales, Legends, and Faceting**
6. **Interactive Exploration**
7. **Default Quality and Storytelling Control**

**Important:**

8. **Visual Output and Reuse**

**Interpretive Insight:** The user sees the product's credibility as primarily determined by the live visualization-building experience itself rather than by downstream packaging. Export and reuse matter, but they are not what defines whether the application feels like a true JMP Graph Builder analogue.

**Phase 2 - Mind Mapping: Critical Visualization Branches Grouped**

**Foundational Core**

- Builder Interaction Model
- Encoding and Role Mapping
- Layering and Composition

**Core Capability Breadth**

- Graph Type and Mark Library
- Axes, Scales, Legends, and Faceting

**Core Quality Multipliers**

- Interactive Exploration
- Default Quality and Storytelling Control

**User Assessment:** accepted as a correct decomposition of the critical visualization branches.

**Phase 2 - Mind Mapping: Foundational Core Capability Prioritization**

**Must-Have for MVP**

1. Drag variables into roles without friction
2. Add, remove, and reorder graph layers directly
3. Modify a chart incrementally instead of rebuilding from scratch
4. See immediate visual feedback while editing
5. Keep the builder understandable even as complexity increases
6. Assign variables to semantic roles clearly
8. Make role changes easy and reversible
9. Support multiple simultaneous encodings without confusion
10. Prevent invalid or misleading role assignments
11. Add multiple compatible layers to the same view
12. Explain why incompatible layer combinations are blocked
13. Support layered comparison without visual chaos
14. Let users inspect and edit each layer independently
15. Preserve clarity as compositions become more complex

**Needed Soon After**

7. Let the app suggest sensible defaults from data types and roles

**Interpretive Insight:** The MVP can rely on strong manual control so long as the builder is fast, legible, and compositionally robust. Intelligent default suggestions improve usability, but the user does not see them as necessary to prove the product's core graph-builder value.

**Phase 2 - Mind Mapping: Graph Type and Mark Library Prioritization**

**Must-Have for MVP**

1. **Core analytical plots**
3. **Relationship and multivariate views**

**Needed Soon After**

5. **Aggregation and summary overlays**
6. **Specialized layers**

**Later**

2. **Distribution and density views**
4. **Categorical comparison views**

**Interpretive Insight:** The user prioritizes analytical and multivariate graphing breadth over category-heavy and density-heavy breadth for the initial product. This suggests the MVP should prove serious exploratory analysis capability first, then expand into richer overlays and finally into broader chart-family coverage.

**Phase 2 - Mind Mapping: Axes, Scales, Legends, and Faceting Prioritization**

**Must-Have for MVP**

1. automatic axis generation that is usually correct
2. manual axis control when defaults are wrong
3. legend generation and legend editing
5. scale transforms and range control
7. label formatting and units-aware labeling

**Needed Soon After**

4. faceting and small multiples
6. reference lines, thresholds, and guides

**Interpretive Insight:** The MVP needs trustworthy defaults and enough manual control to correct them. Comparative layout and analytical guide features matter, but the user sees them as secondary to getting axes, legends, scales, and labels consistently right.

**Phase 2 - Mind Mapping: Interactive Exploration Prioritization**

**Must-Have for MVP**

1. hover tooltips that reveal useful values and context
2. zoom and pan without breaking the chart
6. reset or undo exploration state easily
7. preserve interaction clarity as charts become layered or dense

**Needed Soon After**

3. select or brush subsets directly on the graph
4. linked selection between graph and data table or other views
5. filter data from graph interactions

**Interpretive Insight:** The MVP must support safe, readable exploration rather than full cross-view analytical choreography. Basic interaction quality, reversibility, and clarity matter first; selection-driven workflows can arrive soon after.

**Phase 2 - Mind Mapping: Default Quality and Storytelling Control Prioritization**

**Must-Have for MVP**

1. visually professional defaults without manual tuning
2. clear color choices and distinguishable encodings
3. sane typography, spacing, and layout
6. easy relabeling and title or subtitle editing

**Needed Soon After**

4. easy control over emphasis and de-emphasis
5. annotation support

**Later**

7. protection against misleading or cluttered presentations

**Interpretive Insight:** The MVP must look professional by default and allow lightweight narrative framing, but more advanced presentation-shaping features can follow. The user values baseline visual quality and editability first, ahead of more opinionated safeguards against misleading presentation.

**Phase 2 - Mind Mapping: Next Supporting Branch Selected**

**Selected Branch:** Data Import and Table Semantics

**Rationale:** The user selected this as the next branch to decompose, indicating that correct ingestion and semantic interpretation of data are seen as the most important supporting system after the visualization core.

**Phase 2 - Mind Mapping: Data Import and Table Semantics Structure Accepted**

**Accepted Branch Structure:**

1. **Source and Format Support**
2. **Parsing and Schema Detection**
3. **Column Typing and Semantic Inference**
4. **Import Preview and Correction Workflow**
5. **Missing, Invalid, and Ambiguous Data Handling**
6. **Metadata Preservation and Labeling**
7. **Multi-Source Connectivity and Table Combination**
8. **Refresh and Schema Drift Handling**

**User Assessment:** all eight import and semantics sub-branches were accepted as-is, with no missing first-level branches identified at this stage.

**Phase 2 - Mind Mapping: Data Import and Table Semantics Priority Classification**

**Critical**

1. **Source and Format Support**
2. **Parsing and Schema Detection**
3. **Column Typing and Semantic Inference**
4. **Import Preview and Correction Workflow**
5. **Missing, Invalid, and Ambiguous Data Handling**

**Important**

6. **Metadata Preservation and Labeling**
8. **Refresh and Schema Drift Handling**

**Later**

7. **Multi-Source Connectivity and Table Combination**

**Interpretive Insight:** The product will be judged first on whether it can ingest real files correctly, interpret them sensibly, and let the user fix import mistakes before analysis begins. Metadata continuity and schema-refresh robustness matter next, while multi-source combination is useful but not necessary to prove baseline credibility.

**Phase 2 - Mind Mapping: Critical Import Sub-Branch Selected**

**Selected Sub-Branch:** Column Typing and Semantic Inference

**Rationale:** This was selected as the next decomposition target because incorrect typing and semantic-role inference would undermine visualization defaults, statistical behavior, and user trust across the whole product.

**Phase 2 - Mind Mapping: Data Import and Table Semantics Priority Classification**

**Critical**

1. **Source and Format Support**
2. **Parsing and Schema Detection**
3. **Column Typing and Semantic Inference**
4. **Import Preview and Correction Workflow**
5. **Missing, Invalid, and Ambiguous Data Handling**
6. **Metadata Preservation and Labeling**

**Important**

8. **Refresh and Schema Drift Handling**

**Later**

7. **Multi-Source Connectivity and Table Combination**

**Interpretive Insight:** The user considers trustworthy ingestion of a single dataset, plus correct semantic interpretation and repairability, to be essential for credibility. Multi-source combination is valuable but not required to prove the core product, while schema-drift handling matters mainly once saved workflows and refresh patterns become central.

**Phase 2 - Mind Mapping: Column Typing and Semantic Inference Structure Accepted**

**Accepted Sub-Branch Structure:**

1. **Primitive Type Inference**
2. **Analytical Role Inference**
3. **Visible Type and Role State**
4. **Manual Override**
5. **Ambiguity and Mixed-Data Detection**
6. **Downstream Behavior Propagation**
7. **Persistence of Typing Decisions**

**User Assessment:** all seven semantic-inference sub-branches were accepted as-is, with no missing first-level capabilities identified at this stage.

**Phase 2 - Mind Mapping: Column Typing and Semantic Inference Prioritization**

**Must-Have for MVP**

1. **Primitive Type Inference**
2. **Analytical Role Inference**
3. **Visible Type and Role State**
4. **Manual Override**
5. **Ambiguity and Mixed-Data Detection**
6. **Downstream Behavior Propagation**
7. **Persistence of Typing Decisions**

**Interpretive Insight:** The MVP must infer, expose, and let the user correct semantic meaning in-session, with those decisions immediately affecting the visualization system and surviving saved-workspace flows. This makes semantic correctness part of both live analysis behavior and reproducible persistence.

**Phase 2 - Mind Mapping: Inference Engine Structure Accepted**

**Accepted Inference Engine Structure:**

1. numeric detection
2. datetime detection
3. string or text detection
4. boolean or logical detection
5. continuous versus categorical distinction for numerics
6. ordinal recognition where relevant
7. mixed-type and uncertainty detection

**User Assessment:** all seven inference-engine capabilities were accepted as-is, with no missing first-level capabilities identified at this stage.

**Phase 2 - Mind Mapping: Inference Engine Prioritization**

**Must-Have for MVP**

1. numeric detection
2. datetime detection
3. string or text detection
5. continuous versus categorical distinction for numerics
7. mixed-type and uncertainty detection

**Needed Soon After**

4. boolean or logical detection
6. ordinal recognition where relevant

**Interpretive Insight:** The MVP must correctly identify the dominant analytical data types and, just as importantly, recognize when certainty is not warranted. Boolean and ordinal nuance matter, but the user sees them as secondary to getting numeric, datetime, text, and ambiguity handling right for exploratory graph building.

**Phase 2 - Mind Mapping: Next Semantic-Inference Focus Selected**

**Selected Focus:** User control and visibility

**Rationale:** The user selected this as the next decomposition target, indicating that semantic correctness must be observable and correctable in the UI, not merely inferred behind the scenes.

**Phase 2 - Mind Mapping: User Control and Visibility Structure Accepted**

**Accepted Structure:**

1. visible primitive type indicator per column
2. visible analytical role indicator per column
3. fast inline override controls
4. bulk override for multiple selected columns in importer preview only
5. reset a column back to inferred defaults
6. warn when an override changes graph or statistical behavior
7. show immediate downstream effects after an override

**User Assessment:** the structure was accepted with one refinement: bulk override is desired only in the importer preview, not as a general-purpose cross-application control.

**Phase 2 - Mind Mapping: User Control and Visibility Prioritization**

**Must-Have for MVP**

1. visible primitive type indicator per column
2. visible analytical role indicator per column
3. fast inline override controls
7. show immediate downstream effects after an override

**Needed Soon After**

4. bulk override for multiple selected columns in importer preview only
5. reset a column back to inferred defaults
6. warn when an override changes graph or statistical behavior

**Interpretive Insight:** The MVP must make semantic state legible, editable, and visibly consequential. Users do not need the full safety-and-batch-control layer on day one, but they do need to understand what a column is, change it quickly, and see the effect immediately.

**Phase 2 - Mind Mapping: Next Import Focus Selected**

**Selected Focus:** Import Preview and Correction Workflow

**Rationale:** This was selected as the next decomposition target because it is the point where users validate parsing decisions, repair import issues, and prevent bad data semantics from flowing into the visualization system.

**Phase 2 - Mind Mapping: Import Preview and Correction Workflow Structure Accepted**

**Accepted Structure:**

1. preview rows before final import
2. preview detected column names, types, and semantic roles
3. fix parsing issues in preview, such as delimiter, header row, date parsing, and encoding assumptions
4. correct column types and roles directly in preview
5. inspect missing, invalid, or ambiguous values during preview
6. see a clear summary of detected import issues before committing
7. import only after explicit confirmation
8. re-open import settings and retry without starting from scratch

**User Assessment:** all eight preview and correction workflow capabilities were accepted as-is, with no missing first-level capabilities identified at this stage.

**Phase 2 - Mind Mapping: Import Preview and Correction Workflow Prioritization**

**Must-Have for MVP**

1. preview rows before final import
2. preview detected column names, types, and semantic roles
3. fix parsing issues in preview, such as delimiter, header row, date parsing, and encoding assumptions
4. correct column types and roles directly in preview
6. see a clear summary of detected import issues before committing
7. import only after explicit confirmation

**Needed Soon After**

5. inspect missing, invalid, or ambiguous values during preview
8. re-open import settings and retry without starting from scratch

**Interpretive Insight:** The MVP import flow must let users validate and correct the major structure of an incoming dataset before it enters analysis. Deeper issue inspection and smoother recovery loops matter, but the first credibility threshold is a preview that exposes core parsing and typing decisions and requires explicit user confirmation.

**Phase 2 - Mind Mapping: Parsing and Schema Detection Structure Accepted**

**Accepted Structure:**

1. delimiter and header-row detection
2. text encoding and locale-sensitive parsing
3. quoted text and escaped-character handling
4. date and time parsing rules
5. numeric format parsing, including decimal and thousands separators
6. row-width and column-consistency detection
7. malformed-row handling and recovery behavior
8. user override of parsing assumptions before import

**User Assessment:** all eight parsing and schema-detection capabilities were accepted as-is, with no missing first-level capabilities identified at this stage.

**Phase 2 - Mind Mapping: Parsing and Schema Detection Prioritization**

**Must-Have for MVP**

1. delimiter and header-row detection
3. quoted text and escaped-character handling
4. date and time parsing rules
5. numeric format parsing, including decimal and thousands separators
8. user override of parsing assumptions before import

**Needed Soon After**

2. text encoding and locale-sensitive parsing
6. row-width and column-consistency detection
7. malformed-row handling and recovery behavior

**Interpretive Insight:** The MVP parser must correctly recover the structural and numerical meaning of common tabular files and let users override core assumptions before import. Encoding nuance and malformed-row resilience matter, but the first credibility threshold is getting ordinary delimited files, quoted values, dates, and numeric formats right.

**Phase 2 - Mind Mapping: Next Import Branch Selected**

**Selected Branch:** Missing, Invalid, and Ambiguous Data Handling

**Rationale:** This was selected as the next decomposition target because real datasets are rarely clean, and the product's credibility depends on whether users can understand, inspect, and recover from imperfect data without losing trust in the workflow.

**Phase 2 - Mind Mapping: Missing, Invalid, and Ambiguous Data Handling Structure Accepted**

**Accepted Structure:**

1. detect missing values consistently across common representations
2. distinguish truly missing values from invalid parse failures
3. surface ambiguous values that could be interpreted multiple ways
4. show counts and locations of missing or invalid values by column
5. let users choose handling rules during or after import
6. preserve raw source values when parsed values are invalid or uncertain
7. ensure downstream graphs and stats respond predictably to missing or invalid data
8. explain clearly why values were treated as missing, invalid, or ambiguous

**User Assessment:** all eight missing/invalid/ambiguous-data handling capabilities were accepted as-is, with no missing first-level capabilities identified at this stage.

**Phase 2 - Mind Mapping: Missing, Invalid, and Ambiguous Data Handling Prioritization**

**Must-Have for MVP**

1. detect missing values consistently across common representations
2. distinguish truly missing values from invalid parse failures
4. show counts and locations of missing or invalid values by column
5. let users choose handling rules during or after import
6. preserve raw source values when parsed values are invalid or uncertain
7. ensure downstream graphs and stats respond predictably to missing or invalid data

**Needed Soon After**

3. surface ambiguous values that could be interpreted multiple ways
8. explain clearly why values were treated as missing, invalid, or ambiguous

**Interpretive Insight:** The MVP must let users detect dirty data, understand its extent, preserve recoverable source values, choose handling behavior, and trust that graphs and statistics react consistently. Richer ambiguity surfacing and explanatory messaging matter, but they are secondary to basic recoverability and predictability.

**Phase 2 - Mind Mapping: Remaining Critical Import Branch Selected**

**Selected Branch:** Source and Format Support

**Rationale:** This was selected as the next decomposition target to make the MVP import claim concrete: which file and source types are supported initially, and which are explicitly deferred.

**Phase 2 - Mind Mapping: Source and Format Support Structure Accepted**

**Accepted Structure:**

1. CSV and delimited text files
2. Excel workbooks
3. clipboard or pasted tabular data
4. app-native workspace or template files
5. local file import as the primary source model
6. connected data sources as a later source model
7. export or import compatibility for saved visualization definitions

**User Assessment:** all seven source and format support capabilities were accepted as-is, with no missing first-level capabilities identified at this stage.

**Phase 2 - Mind Mapping: Source and Format Support Prioritization**

**Must-Have for MVP**

1. CSV and delimited text files
2. Excel workbooks
3. clipboard or pasted tabular data
4. app-native workspace or template files
5. local file import as the primary source model

**Needed Soon After**

7. export or import compatibility for saved visualization definitions

**Later**

6. connected data sources as a later source model

**Interpretive Insight:** The MVP import promise is centered on local analytical workflows: common tabular files, Excel, pasted data, and native saved artifacts. Connected data systems matter, but they are explicitly not part of the first credibility threshold.

**Phase 2 - Mind Mapping: Next Supporting Branch Selected**

**Selected Branch:** Data Preparation and Formula Workflow

**Rationale:** This was selected as the next decomposition target because, after visualization and import, the product's analytical credibility depends on whether users can clean data, derive new fields, and build reusable transformations inside the application.

**Phase 2 - Mind Mapping: Data Preparation and Formula Workflow Structure Accepted**

**Accepted Structure:**

1. **Direct Data Editing**
2. **Type Conversion and Recoding**
3. **Row-Level Table Operations**
4. **Derived and Formula Columns**
5. **Multi-Step Transformation Pipeline**
6. **Formula Inspection and Dependency Visibility**
7. **Transformation and Formula Error Handling**
8. **Persistence and Reuse of Data-Prep Logic**

**User Assessment:** all eight data-preparation and formula-workflow branches were accepted as-is, with no missing first-level branches identified at this stage.

**Phase 2 - Mind Mapping: Data Preparation and Formula Workflow Priority Classification**

**Critical**

2. **Type Conversion and Recoding**
3. **Row-Level Table Operations**
4. **Derived and Formula Columns**
5. **Multi-Step Transformation Pipeline**
6. **Formula Inspection and Dependency Visibility**
7. **Transformation and Formula Error Handling**

**Important**

1. **Direct Data Editing**
8. **Persistence and Reuse of Data-Prep Logic**

**Interpretive Insight:** The user sees the core analytical value in structured transformation, formula creation, inspectability, and recoverable error behavior rather than in spreadsheet-like cell editing. Persistence matters, but proving credible in-session data-shaping workflows matters more than long-term reuse at this stage.

**Phase 2 - Mind Mapping: Next Data-Prep Focus Selected**

**Selected Focus:** Derived and Formula Columns

**Rationale:** This was selected as the next decomposition target because derived fields are one of the clearest product-defining features separating the application from a simpler visualization tool.

**Phase 2 - Mind Mapping: Derived and Formula Columns Structure Accepted**

**Accepted Structure:**

1. create a new column from one or more existing columns
2. formula editor with operators, functions, and references to other columns
3. row-wise calculations
4. aggregate or summary-based calculations
5. preview formula results before committing
6. visibly mark formula columns in the table
7. show formula dependencies on source columns
8. recompute formula results when upstream data changes

**User Assessment:** all eight derived-column and formula capabilities were accepted as-is, with no missing first-level capabilities identified at this stage.

**Phase 2 - Mind Mapping: Derived and Formula Columns Priority Classification**

**Critical**

1. create a new column from one or more existing columns
2. formula editor with operators, functions, and references to other columns
3. row-wise calculations
5. preview formula results before committing
6. visibly mark formula columns in the table
8. recompute formula results when upstream data changes

**Important**

4. aggregate or summary-based calculations
7. show formula dependencies on source columns

**Interpretive Insight:** The MVP formula workflow must support direct derived-column creation for row-level analysis, make formula columns visibly distinct, preview results before commit, and keep them synchronized as upstream data changes. Aggregate-style formulas and richer dependency introspection increase power, but they do not define the first credible release.

**Phase 2 - Mind Mapping: Next Data-Prep Focus Selected**

**Selected Focus:** Multi-Step Transformation Pipeline

**Rationale:** This was selected as the next decomposition target because the product's analytical credibility depends not only on individual operations, but on whether those operations can be composed into an ordered, inspectable workflow.

**Phase 2 - Mind Mapping: Multi-Step Transformation Pipeline Structure Accepted**

**Accepted Structure:**

1. represent transformations as an ordered list of steps
2. show the current resulting table after each step
3. let users add new steps without rebuilding the pipeline
4. let users edit or remove an existing step
5. re-run downstream steps when an earlier step changes
6. identify which step caused an error or invalid result
7. preserve the pipeline as part of the saved workspace
8. support reapplying the same pipeline to refreshed data

**User Assessment:** all eight transformation-pipeline capabilities were accepted as-is, with no missing first-level capabilities identified at this stage.

**Phase 2 - Mind Mapping: Multi-Step Transformation Pipeline Priority Classification**

**Critical**

1. represent transformations as an ordered list of steps
2. show the current resulting table after each step
3. let users add new steps without rebuilding the pipeline
4. let users edit or remove an existing step
5. re-run downstream steps when an earlier step changes
6. identify which step caused an error or invalid result

**Important**

7. preserve the pipeline as part of the saved workspace
8. support reapplying the same pipeline to refreshed data

**Interpretive Insight:** The MVP must behave like a real in-session transformation workflow editor: ordered, editable, recomputable, and debuggable. Persistence and reuse across sessions matter, but the first credibility threshold is whether users can build and repair a multi-step pipeline while actively analyzing data.

**Phase 2 - Mind Mapping: Next Data-Prep Focus Selected**

**Selected Focus:** Type Conversion and Recoding

**Rationale:** This was selected as the next decomposition target because type correction and value recoding are foundational operations that directly affect visualization semantics, transformation logic, and downstream analytical correctness.

**Phase 2 - Mind Mapping: Type Conversion and Recoding Structure Accepted**

**Accepted Structure:**

1. convert primitive column types, such as text to numeric or text to datetime
2. change analytical roles, such as continuous to nominal or ordinal
3. recode category values, such as merging or renaming levels
4. normalize inconsistent values and formats within a column
5. preview conversion or recoding results before committing
6. preserve original values when conversion fails or is partial
7. apply conversions or recodes as explicit transformation steps in the pipeline
8. show downstream analytical impact of conversions and recodes

**User Assessment:** all eight type-conversion and recoding capabilities were accepted as-is, with no missing first-level capabilities identified at this stage.

**Phase 2 - Mind Mapping: Type Conversion and Recoding Priority Classification**

**Critical**

1. convert primitive column types, such as text to numeric or text to datetime
2. change analytical roles, such as continuous to nominal or ordinal
3. recode category values, such as merging or renaming levels
5. preview conversion or recoding results before committing
6. preserve original values when conversion fails or is partial
7. apply conversions or recodes as explicit transformation steps in the pipeline
8. show downstream analytical impact of conversions and recodes

**Important**

4. normalize inconsistent values and formats within a column

**Interpretive Insight:** The user wants conversion and recoding to behave as explicit analytical operations, not quiet cleanup utilities. Previewability, recoverability, pipeline integration, and visible downstream impact are core to credibility, while broader normalization support can follow.

**Phase 2 - Mind Mapping: Next Data-Prep Focus Selected**

**Selected Focus:** Row-Level Table Operations

**Rationale:** This was selected as the next decomposition target because row filtering, sorting, and subsetting determine which records actually drive graphs, formulas, and statistical results.

**Phase 2 - Mind Mapping: Row-Level Table Operations Structure Refined**

**Accepted Structure:**

1. filter rows by one or more conditions
2. sort rows by one or more columns
4. include or exclude rows without deleting source data
5. preview row-operation effects before committing
7. represent row operations as explicit steps in the pipeline
8. make row-operation effects visible in downstream graphs, formulas, and stats

**Excluded from First-Level Structure:**

3. subset rows into a derived working table

**User Assessment:** row-level operations should focus on filtering, sorting, inclusion or exclusion, preview, pipeline representation, and visible downstream effects. A distinct derived-working-table concept is not required as a first-level row operation here.

**Phase 2 - Mind Mapping: Row-Level Table Operations Priority Classification**

**Critical**

1. filter rows by one or more conditions
2. sort rows by one or more columns
4. include or exclude rows without deleting source data
5. preview row-operation effects before committing
7. represent row operations as explicit steps in the pipeline
8. make row-operation effects visible in downstream graphs, formulas, and stats

**Interpretive Insight:** All retained row-level operations are treated as core to the product. The user expects row shaping to be explicit, previewable, pipeline-aware, and analytically consequential from the first credible release.

**Phase 2 - Mind Mapping: Next Data-Prep Focus Selected**

**Selected Focus:** Transformation and Formula Error Handling

**Rationale:** This was selected as the next decomposition target because real analytical workflows inevitably encounter broken formulas, invalid conversions, and failed pipeline steps, and the product must remain recoverable and understandable when that happens.

**Phase 2 - Mind Mapping: Transformation and Formula Error Handling Structure Accepted**

**Accepted Structure:**

1. identify which transformation or formula step failed
2. show a clear error message tied to the failing step
3. preserve the rest of the pipeline or workspace when one step fails
4. mark affected columns or outputs as invalid without silently dropping them
5. let users edit and retry the failing step
6. keep source data or prior valid state available for recovery
7. show downstream objects affected by the failure
8. prevent hidden propagation of broken results into graphs or stats

**User Assessment:** all eight transformation and formula error-handling capabilities were accepted as-is, with no missing first-level capabilities identified at this stage.

**Phase 2 - Mind Mapping: Transformation and Formula Error Handling Priority Classification**

**Critical**

1. identify which transformation or formula step failed
2. show a clear error message tied to the failing step
3. preserve the rest of the pipeline or workspace when one step fails
4. mark affected columns or outputs as invalid without silently dropping them
5. let users edit and retry the failing step
8. prevent hidden propagation of broken results into graphs or stats

**Important**

6. keep source data or prior valid state available for recovery
7. show downstream objects affected by the failure

**Interpretive Insight:** The MVP must make failures local, visible, recoverable, and non-silent. The core requirement is not sophisticated diagnostics; it is preventing broken transformations or formulas from corrupting analysis while still letting users repair the workflow in place.

**Phase 2 - Mind Mapping: Final Data-Prep Focus Selected**

**Selected Focus:** Formula Inspection and Dependency Visibility

**Rationale:** This was selected to close out the remaining data-preparation branch, because trust in derived columns depends on being able to inspect how they were defined and what upstream data they depend on.

**Phase 2 - Mind Mapping: Formula Inspection and Dependency Visibility Structure Refined**

**Accepted Structure:**

1. show the formula definition for each derived column
2. show direct input columns used by the formula
4. mark formulas that are broken because an input changed or disappeared
8. preserve inspection details when saving and reopening a workspace

**Excluded from First-Level Structure:**

3. indicate whether a formula depends on another derived column
5. let users jump from a formula column to its referenced inputs
6. show where a formula column is used in downstream graphs, stats, or transforms
7. distinguish row-wise formulas from aggregate or summary-based formulas

**User Assessment:** formula inspection should stay lightweight and practical. The core requirement is direct inspectability and broken-reference awareness, not a full dependency-navigation or usage-tracing system.

**Phase 2 - Mind Mapping: Formula Inspection and Dependency Visibility Priority Classification**

**Critical**

1. show the formula definition for each derived column
2. show direct input columns used by the formula
4. mark formulas that are broken because an input changed or disappeared

**Important**

8. preserve inspection details when saving and reopening a workspace

**Interpretive Insight:** The MVP formula-inspection bar is pragmatic: users must be able to read the formula, see its direct inputs, and know when it has broken. Persistence of that inspectability across save or reopen matters, but it is secondary to in-session trust and debuggability.

**Phase 2 - Mind Mapping: Next Supporting Branch Selected**

**Selected Branch:** Persistence and Reproducibility

**Rationale:** This was selected as the next decomposition target because the product's credibility depends on whether analytical work can be saved, reopened, reproduced, and carried forward across sessions and application versions.

**Phase 2 - Mind Mapping: Persistence and Reproducibility Structure Accepted**

**Accepted Structure:**

1. save and reopen full workspaces
2. save and reopen visualization definitions separately from full workspaces
3. preserve imported data, transformation steps, formulas, and graph state together when needed
4. support templates that can be reused with new datasets
5. preserve semantic typing and formula inspection details across save or reopen
6. maintain backward compatibility with older saved workspaces and templates
7. clearly explain compatibility adjustments when old artifacts are loaded
8. allow the same saved analytical setup to be rerun on refreshed data

**User Assessment:** all eight persistence and reproducibility capabilities were accepted as-is, with no missing first-level capabilities identified at this stage.

**Phase 2 - Mind Mapping: Persistence and Reproducibility Priority Classification**

**Critical**

1. save and reopen full workspaces
3. preserve imported data, transformation steps, formulas, and graph state together when needed
5. preserve semantic typing and formula inspection details across save or reopen
6. maintain backward compatibility with older saved workspaces and templates

**Important**

2. save and reopen visualization definitions separately from full workspaces
4. support templates that can be reused with new datasets
7. clearly explain compatibility adjustments when old artifacts are loaded
8. allow the same saved analytical setup to be rerun on refreshed data

**Interpretive Insight:** The MVP persistence bar is centered on trustworthy reopening of full analytical state and on long-lived compatibility of saved artifacts. Reusable templates, detached visualization definitions, compatibility explanations, and rerunning saved setups matter, but they build on the more fundamental requirement that saved work must reopen accurately across versions.

**Phase 2 - Mind Mapping: Next Supporting Branch Selected**

**Selected Branch:** Performance and Scale

**Rationale:** This was selected as the next decomposition target because performance limits determine whether the graph builder, transformation workflow, and large-dataset claims remain credible under realistic workloads.

**Phase 2 - Mind Mapping: Performance and Scale Structure Accepted**

**Accepted Structure:**

1. interactive graph updates remain responsive during normal editing
2. large dataset loading remains practical for local workflows
3. transformations and formula recomputation complete in acceptable time
4. row filtering, sorting, and recoding remain usable on large tables
5. visual interactions such as zoom, hover, and selection remain smooth on dense charts
6. the app degrades gracefully when data or charts exceed practical limits
7. users are told clearly when performance tradeoffs or limits are being hit
8. saved workspaces reopen in acceptable time even with substantial state

**User Assessment:** all eight performance and scale capabilities were accepted as-is, with no missing first-level capabilities identified at this stage.

**Phase 2 - Mind Mapping: Performance and Scale Priority Classification**

**Critical**

1. interactive graph updates remain responsive during normal editing
2. large dataset loading remains practical for local workflows
3. transformations and formula recomputation complete in acceptable time
4. row filtering, sorting, and recoding remain usable on large tables
5. visual interactions such as zoom, hover, and selection remain smooth on dense charts
6. the app degrades gracefully when data or charts exceed practical limits

**Important**

7. users are told clearly when performance tradeoffs or limits are being hit
8. saved workspaces reopen in acceptable time even with substantial state

**Interpretive Insight:** The MVP performance bar is high: responsiveness, operational usability on large tables, and graceful degradation are all treated as core product qualities rather than later optimization work. Explicit limit messaging and fast reopening of large saved state matter, but they build on the baseline requirement that the live system must remain usable under meaningful load.

**Phase 2 - Mind Mapping: Next Supporting Branch Selected**

**Selected Branch:** Usability and Guardrails

**Rationale:** This was selected as the next decomposition target because the product must balance analytical power with approachability, and it must prevent users from creating confusing or invalid states without becoming overly restrictive.

**Phase 2 - Mind Mapping: Usability and Guardrails Structure Accepted**

**Accepted Structure:**

1. simple tasks should feel easy, not buried under expert controls
2. advanced tasks should remain possible without fighting the UI
3. the app should prevent clearly incompatible graph-layer combinations
4. warnings should explain why an action is blocked or risky
5. undo or step-back behavior should exist for common mistakes
6. key workflow states should be visible, such as active filters, transformations, and derived columns
7. users should be able to recover from mistakes without rebuilding work
8. the interface should stay understandable as the workspace becomes more complex

**User Assessment:** all eight usability and guardrail capabilities were accepted as-is, with no missing first-level capabilities identified at this stage.

**Phase 2 - Mind Mapping: Usability and Guardrails Priority Classification**

**Critical**

1. simple tasks should feel easy, not buried under expert controls
2. advanced tasks should remain possible without fighting the UI
3. the app should prevent clearly incompatible graph-layer combinations
5. undo or step-back behavior should exist for common mistakes
6. key workflow states should be visible, such as active filters, transformations, and derived columns
7. users should be able to recover from mistakes without rebuilding work
8. the interface should stay understandable as the workspace becomes more complex

**Important**

4. warnings should explain why an action is blocked or risky

**Interpretive Insight:** The MVP usability bar is high: the application must stay approachable for simple work, powerful for advanced work, recoverable under mistakes, and legible as complexity grows. Explanatory warning text matters, but it is secondary to the broader requirement that the system prevent confusion without becoming restrictive.

**Phase 2 - Mind Mapping: Next Supporting Branch Selected**

**Selected Branch:** Statistical Insight Layer

**Rationale:** This was selected as the next decomposition target because the product is expected to provide more than visualization alone; it must also expose useful statistical summaries and models in a way that remains interpretable to non-specialist users.

**Phase 2 - Mind Mapping: Statistical Insight Layer Structure Accepted**

**Accepted Structure:**

1. descriptive summaries for columns and selections
2. common analytical overlays tied to graphs, such as fit lines or summary bands
3. simple regression-style analyses
4. results presented in plain language, not only statistical jargon
5. statistical outputs linked clearly to the data subset or graph state that produced them
6. enough context to avoid obvious misreading of results
7. updates to statistical outputs when filters, roles, or transformations change
8. clear boundaries between exploratory guidance and formal statistical claims

**User Assessment:** all eight statistical-insight capabilities were accepted as-is, with no missing first-level capabilities identified at this stage.

**Phase 2 - Mind Mapping: Statistical Insight Layer Priority Classification**

**Critical**

1. descriptive summaries for columns and selections
2. common analytical overlays tied to graphs, such as fit lines or summary bands
3. simple regression-style analyses
4. results presented in plain language, not only statistical jargon
5. statistical outputs linked clearly to the data subset or graph state that produced them
7. updates to statistical outputs when filters, roles, or transformations change

**Important**

6. enough context to avoid obvious misreading of results
8. clear boundaries between exploratory guidance and formal statistical claims

**Interpretive Insight:** The MVP statistical layer should provide useful descriptive and regression-style insight, tie results directly to the current analytical state, and present those results in accessible language. Stronger safeguards against misreading and sharper separation between exploratory and formal inference matter, but they build on the baseline requirement that the app produce understandable, context-aware statistical output.

**Phase 2 - Mind Mapping: Final Supporting Branch Selected**

**Selected Branch:** Workflow Integration

**Rationale:** This was selected to complete the final top-level branch, because the product must fit into broader reporting, reuse, and repeat-analysis workflows rather than becoming a closed exploratory dead end.

**Phase 2 - Mind Mapping: Workflow Integration Structure Accepted**

**Accepted Structure:**

1. export visuals cleanly for reports or presentations
2. export data or transformed subsets for downstream use
3. reuse saved visualization definitions with new datasets
4. reuse templates or analytical setups across repeated analyses
5. rerun saved analytical workflows on refreshed data
6. preserve enough metadata so exported or reused artifacts still make sense
7. avoid locking results inside opaque app-only state
8. keep reused workflows understandable when reopened later

**User Assessment:** all eight workflow-integration capabilities were accepted as-is, with no missing first-level capabilities identified at this stage.

**Phase 2 - Mind Mapping: Workflow Integration Priority Classification**

**Critical**

1. export visuals cleanly for reports or presentations
3. reuse saved visualization definitions with new datasets
6. preserve enough metadata so exported or reused artifacts still make sense
7. avoid locking results inside opaque app-only state

**Important**

2. export data or transformed subsets for downstream use
4. reuse templates or analytical setups across repeated analyses
5. rerun saved analytical workflows on refreshed data
8. keep reused workflows understandable when reopened later

**Interpretive Insight:** The MVP workflow-integration bar is centered on clean visual export, reusable visualization structures, meaningful metadata preservation, and avoiding app-only lock-in. Broader export of transformed data and repeat-analysis workflows matter, but they build on the more basic requirement that outputs remain portable and interpretable outside the immediate session.

**Phase 2 - Mind Mapping Completion Summary**

**What the map now says about the product:**

- The core product is the **Visualization System**, supported by import semantics, data preparation, persistence, performance, usability, statistics, and workflow integration.
- The **MVP credibility threshold** is unusually high for a web app: responsive graph building, explicit semantic control, strong local-file import, pipeline-based data prep, formula columns, backward-compatible workspace reopening, graceful performance degradation, and usable statistical summaries are all treated as core.
- The product is explicitly **single-user and local-first** in its first serious version. Permissions, privacy, compliance, and multi-user collaboration are out of scope. Connected data sources are later.
- The user consistently favors **direct manipulation, inspectability, and recoverability** over opaque automation. Smart defaults matter, but explicit control and visible consequences matter more.
- The analytical workflow should behave like a **real stateful workspace**, not a charting front-end: transformations are stepwise, errors are localized, formula columns are inspectable, and semantic decisions persist across save or reopen.

**Open leverage points for the next technique:**

- define concrete product configurations that satisfy the critical branches without overbuilding
- decide which combinations of visualization depth, import breadth, data-prep power, and persistence guarantees belong in an MVP versus later phases
- expose where tradeoffs are tightest, especially around large-scale performance, backward compatibility, and analytical power

**Technique Transition: Mind Mapping to Morphological Analysis**

**What we discovered so far:**

- the product's center of gravity is a direct-manipulation visualization system, not a generic charting surface
- local-first import, explicit semantic control, pipeline-based data prep, formula columns, and backward-compatible persistence are all part of the MVP credibility threshold
- the user consistently favors inspectability, recoverability, and visible consequences over hidden automation
- performance and graceful degradation are treated as first-order product requirements, not post-MVP tuning

**Creative Breakthroughs:**

- clarified that the application is a **stateful analytical workspace** rather than a reporting-only graph tool
- established that many "supporting" systems are actually core to credibility because they preserve trust in the visualization system
- separated true MVP-defining capabilities from later breadth, especially in chart family coverage, connected data sources, and deeper dependency navigation

**Transition Rationale:** The map is now broad enough and structured enough that the next valuable move is combinatorial design. Morphological Analysis will turn these branches into concrete product configurations and expose which combinations belong in an MVP versus later phases.

## Phase 3 - Morphological Analysis

**Technique Initialization**

- **Focus:** turn the mapped product branches into a small set of product-defining dimensions that can be combined into concrete configurations
- **Working Principle:** each dimension should independently change the shape of the product rather than merely restate another branch

**Accepted Morphology Dimensions:**

1. **Visualization Depth**
2. **Import and Semantic Robustness**
3. **Data-Prep Power**
4. **Persistence Rigor**
5. **Statistical Depth**
6. **Performance Envelope**
7. **Workflow Portability**

**Interpretive Insight:** All seven dimensions were retained because each one changes the product's character in a substantively different way. The product is broad enough that reducing the matrix prematurely would hide real design tradeoffs rather than clarify them.

**Morphology Dimension 1: Visualization Depth**

**Accepted States:**

1. **Core Analytical Builder**
   - strong essential graph builder with core plots, layering, encodings, axes, interaction, and good defaults
2. **Expanded Analytical Builder**
   - broader analytical graphing with richer overlays, more comparison modes, more chart families, and stronger faceting
3. **Near-Parity Graph Platform**
   - a much wider graph-builder surface approaching JMP breadth, with deep composition and fewer intentional omissions

**User Assessment:** all three visualization-depth states were accepted as-is, with no missing levels identified at this stage.

**Morphology Dimension 2: Import and Semantic Robustness**

**Accepted States:**

1. **Practical Local Import**
   - reliable CSV, Excel, and pasted-data import with core parsing, basic type inference, preview correction, and local-first workflow support
2. **Trustworthy Analytical Import**
   - strong preview-and-correction flow, semantic role visibility and override, missing or invalid handling, and import behavior users can inspect and trust
3. **Robust Reproducible Import Layer**
   - high-confidence semantic persistence, stronger schema-drift resilience, and import behavior that remains reliable across saved or reopened workspaces and version changes

**User Assessment:** all three import-and-semantic robustness states were accepted as-is, with no missing levels identified at this stage.

**Morphology Dimension 3: Data-Prep Power**

**Accepted States:**

1. **Light Analytical Prep**
   - type changes, basic recoding, filtering, sorting, and row-wise formula columns with visible effects
2. **Structured Prep Workspace**
   - explicit stepwise pipeline, editable transforms, formula preview, error localization, row shaping, and practical inspectability across the workflow
3. **Heavy Analytical Prep System**
   - broader transformation depth, richer dependency behavior, more reusable prep logic, and a stronger sense of the app as a full data-shaping workspace rather than only a graph builder with prep features

**User Assessment:** all three data-prep power states were accepted as-is, with no missing levels identified at this stage.

**Morphology Dimension 4: Persistence Rigor**

**Accepted States:**

1. **Basic Session Persistence**
   - save and reopen current work in a practical way, but with limited guarantees around portability and long-term compatibility
2. **Reliable Analytical Persistence**
   - full workspaces reopen with semantic state, transforms, formulas, and graph state intact, and users can trust saved work for normal reuse
3. **Long-Lived Reproducible Persistence**
   - backward-compatible saved artifacts, stronger portability of analytical state, and higher confidence that old work remains meaningful across versions and reused contexts

**User Assessment:** all three persistence-rigor states were accepted as-is, with no missing levels identified at this stage.

**Morphology Dimension 5: Statistical Depth**

**Accepted States:**

1. **Descriptive Statistical Support**
   - context-aware summaries for columns, filters, and selections, with light graph-tied analytical cues
2. **Integrated Exploratory Statistics**
   - descriptive summaries plus common overlays and simple regression-style analysis that update with the current analytical state
3. **Broader Analytical Statistics Layer**
   - a stronger statistics surface with wider model or overlay breadth and more analytical depth, while still tied closely to the graph-building workflow

**User Assessment:** all three statistical-depth states were accepted as-is, with no missing levels identified at this stage.

**Morphology Dimension 6: Performance Envelope**

**Accepted States:**

1. **Comfortable Moderate Scale**
   - smooth work for ordinary exploratory use on moderate datasets, with some limits visible at higher scale
2. **Serious Analytical Scale**
   - strong responsiveness for large local tables and dense charts, with practical support for the larger workloads the user cares about
3. **Aggressive High-Scale Envelope**
   - a product shape that pushes hard on very large local datasets and heavier analytical state, with stronger architectural demands and less room for inefficiency

**User Assessment:** all three performance-envelope states were accepted as-is, with no missing levels identified at this stage.

**Morphology Dimension 7: Workflow Portability**

**Accepted States:**

1. **Presentation-Oriented Portability**
   - clean visual export and enough metadata to make outputs useful outside the app
2. **Reusable Analytical Portability**
   - reusable visualization definitions, templates, and artifacts that can be reapplied in similar analytical workflows
3. **Repeatable Workflow Portability**
   - stronger reuse of analytical setups across refreshed data and repeated runs, with more emphasis on portability of the workflow itself rather than only its outputs

**User Assessment:** all three workflow-portability states were accepted as-is, with no missing levels identified at this stage.

**Morphological Product Configurations**

**Configuration A: Focused Analytical Builder**

- Visualization Depth: **Core Analytical Builder**
- Import and Semantic Robustness: **Trustworthy Analytical Import**
- Data-Prep Power: **Structured Prep Workspace**
- Persistence Rigor: **Reliable Analytical Persistence**
- Statistical Depth: **Integrated Exploratory Statistics**
- Performance Envelope: **Serious Analytical Scale**
- Workflow Portability: **Presentation-Oriented Portability**

**Configuration B: Reusable Analytical Workspace**

- Visualization Depth: **Expanded Analytical Builder**
- Import and Semantic Robustness: **Trustworthy Analytical Import**
- Data-Prep Power: **Structured Prep Workspace**
- Persistence Rigor: **Long-Lived Reproducible Persistence**
- Statistical Depth: **Integrated Exploratory Statistics**
- Performance Envelope: **Serious Analytical Scale**
- Workflow Portability: **Reusable Analytical Portability**

**Configuration C: Ambitious Near-Parity Platform**

- Visualization Depth: **Near-Parity Graph Platform**
- Import and Semantic Robustness: **Robust Reproducible Import Layer**
- Data-Prep Power: **Heavy Analytical Prep System**
- Persistence Rigor: **Long-Lived Reproducible Persistence**
- Statistical Depth: **Broader Analytical Statistics Layer**
- Performance Envelope: **Aggressive High-Scale Envelope**
- Workflow Portability: **Repeatable Workflow Portability**

**User Selection and Release Ladder**

- **Best candidate for MVP:** Configuration A
- **Best candidate for a serious v1:** Configuration B
- **Roadmap vision:** Configuration C

**Interpretive Insight:** The user favors a staged product strategy rather than a maximal first release. Configuration A is considered the most believable MVP because it already satisfies a high credibility threshold without overcommitting on broader portability and parity breadth. Configuration B is the intended serious version once the core is proven. Configuration C is explicitly treated as future roadmap territory rather than an initial build target.

**A-to-B Upgrade Priority**

1. **Persistence Rigor**
2. **Visualization Depth**
3. **Workflow Portability**

**Interpretive Insight:** The jump from MVP to serious v1 is defined first by stronger long-term trust in saved analytical state, second by broader graph-builder depth, and third by more reusable workflow artifacts. This indicates that the product earns "serious" status less by breadth alone and more by whether analytical work remains dependable and reusable over time.

**A-to-B Upgrade Detail: Draft Capability Delta**

**Persistence Rigor**

- persist the full modified workspace rather than only the immediate view state
- preserve derived columns across save or reopen
- preserve graph states and layer configurations across save or reopen
- preserve dataset modifications such as titles and data-format changes across save or reopen

**Workflow Portability**

- export data transformations for reuse outside the immediate workspace
- export derived-column definitions for reuse with new datasets
- export graph layer details and structural definitions for import into later analyses
- support applying exported analytical structures to new datasets in a reusable way

**Visualization Depth**

- add faceting and small-multiple views for stronger comparison workflows
- add richer analytical overlays such as fit lines, summary bands, and reference lines
- expand the analytical plot family beyond the MVP core
- support stronger layered comparison modes that remain readable under more complex compositions
- provide better comparison-oriented visualization controls for subset and interaction analysis

**Interpretive Insight:** The A-to-B visualization upgrade is not just "more chart types." It is specifically about stronger comparison workflows, richer analytical overlays, broader analytical plot coverage, and more capable layered reasoning inside the graph builder.

**A-versus-B Boundary Decisions**

1. **Faceting and small multiples** -> **A**
2. **Analytical overlays such as fit lines, summary bands, and reference lines** -> **A**
3. **Broader analytical plot family beyond the MVP core** -> **B**
4. **Reusable visualization definitions applicable to new datasets** -> **A**
5. **Exportable transformations and derived-column definitions** -> **B**
6. **Backward-compatible reopening of older saved workspaces or templates across versions** -> **B**

**Interpretive Insight:** The MVP is stronger than a minimal builder. It already includes comparison-oriented visualization support, analytical overlays, and reusable visualization definitions. The jump to serious v1 is therefore less about basic analytical credibility and more about broadening plot-family coverage, exporting deeper analytical logic, and guaranteeing long-term compatibility of saved artifacts.

**A Schedule-Pressure Test**

1. **Faceting and small multiples** -> **Stretch for A, can slip to B if needed**
2. **Analytical overlays such as fit lines and reference lines** -> **Stretch for A, can slip to B if needed**
3. **Reusable visualization definitions for new datasets** -> **Stretch for A, can slip to B if needed**
4. **Serious analytical scale performance** -> **Locked in A**

**Interpretive Insight:** Under delivery pressure, the non-negotiable part of the MVP is not visual breadth or portability polish, but analytical responsiveness at meaningful scale. Comparison-oriented visualization features and reusable visualization structures are desirable in A, but the user is willing to treat them as slip candidates if they threaten delivery of the core performance and analytical workflow promises.

**Rescue Priority Under Schedule Pressure**

- **If one stretch capability is rescued into A:** Reusable visualization definitions for new datasets

**Interpretive Insight:** If schedule allows only one upgrade beyond the irreducible MVP core, the user prefers artifact reuse over additional comparison depth or overlay sophistication. This reinforces that even the MVP should lean toward portable analytical value, not only in-session exploration.

**Morphological Analysis Completion Summary**

- **Core product shape chosen:** A fast, trustworthy analytical builder as MVP, a more reusable and durable analytical workspace as serious v1, and a near-parity platform as future roadmap
- **MVP identity clarified:** local-first, single-user, serious-scale analytical performance is non-negotiable
- **A-to-B delta clarified:** stronger long-term persistence guarantees, broader graph-builder depth, and more reusable workflow artifacts
- **Schedule-pressure insight:** serious analytical scale stays locked in A; comparison depth and reusable visualization structures are the main slip candidates, with reusable visualization definitions being the first stretch item worth rescuing

**Phase Transition:** Moving from `Morphological Analysis` to `Decision Tree Mapping` for implementation-focused action planning.

## Phase 4 - Decision Tree Mapping

**Technique Initialization**

- **Focus:** turn Configuration A into a delivery path that preserves the chosen MVP identity under real schedule and implementation pressure
- **Working Principle:** sequence work so that analytical trust, state coherence, and serious-scale responsiveness are protected before feature breadth

**Configuration A Action-Planning Goal**

Turn the selected MVP configuration into a concrete implementation path that answers four questions:

1. what must be built first so later work does not collapse into rework
2. what end-to-end slice proves the MVP is real rather than merely demoable
3. which capabilities are true release gates versus stretch additions
4. what must slip first if delivery pressure appears

**Decision Tree Root: Where should Configuration A begin?**

**Option 1: Visualization-first path**

- prioritize the builder UI and chart output first
- defer deeper workspace, persistence, and transformation coherence until later

**Option 2: Analytical-workspace-first path**

- establish the shared state model for data, semantics, transforms, formulas, graph state, statistics, and persistence first
- then build the graph-builder surface on top of that coherent analytical core

**Selected Path:** **Analytical-workspace-first**

**Reasoning:** Configuration A is not a lightweight charting MVP. Its credibility depends on semantic overrides, stepwise transforms, formula recomputation, graph edits, statistics, and saved workspaces all remaining mutually consistent. A UI-first path would likely create attractive demos but expensive rework once persistence, error handling, and large-scale performance are introduced.

**Interpretive Insight:** The true foundation of the MVP is not the first rendered chart. It is the first trustworthy analytical workspace state that can survive editing, recomputation, and reopening without losing meaning.

**Decision Tree Branch 1: Is a unified workspace kernel required before broader feature work?**

**Decision Question:** Can Configuration A be built safely without first defining a canonical workspace model?

**Rejected Path:** build import, graphing, transforms, and persistence as loosely connected features

- faster local progress in the short term
- high risk of semantic drift across the table, graph, and saved-state layers
- high likelihood that performance fixes arrive too late and require architectural reversal

**Selected Path:** define a canonical workspace kernel first

**Kernel Requirements for Configuration A**

1. a typed table model with visible primitive types and analytical roles
2. an ordered transformation-step model with localized error states
3. a formula-column model with preview, recomputation, and direct dependency references
4. a graph-spec model covering layers, encodings, axes, legends, and interaction state
5. a subset or filter state that can drive charts, table views, and statistics consistently
6. a workspace serialization model that preserves semantic state, transforms, formulas, and graph state together

**Gate 0 Exit Criteria**

1. a single imported dataset can be represented with semantic metadata rather than raw columns only
2. a transformation or formula step can change downstream state without corrupting prior steps
3. the same analytical state can drive both a graph and a statistical summary
4. the workspace can be saved and reopened without losing semantic meaning or graph configuration

**Interpretive Insight:** Configuration A rises or falls on whether the app behaves like one analytical system rather than a collection of adjacent tools. The workspace kernel is therefore a release-enabling prerequisite, not invisible infrastructure polish.

**Decision Tree Branch 2: What is the first proving slice of the MVP?**

**Decision Question:** Should the first end-to-end slice prove only graph rendering, or prove the full analytical loop?

**Rejected Slice:** import data and render a basic chart

- useful for a superficial demo
- fails to prove the product's distinctiveness versus ordinary web charting tools
- does not validate semantic overrides, transforms, formulas, persistence, or graph-tied statistics

**Selected Slice:** prove the full analytical loop in one constrained vertical slice

**Minimum Proving Slice**

1. import CSV, Excel, and pasted tabular data through a preview-and-correction flow
2. expose inferred primitive types and analytical roles, and allow inline override before analysis
3. create and iteratively modify a core analytical chart with immediate feedback
4. apply at least one transformation step and one row-wise formula column
5. show descriptive summaries and one simple graph-tied regression or fit-line path
6. save and reopen the full workspace with the analytical state intact

**Why This Slice Was Chosen:** If this slice works, the product proves that it is a serious analytical builder. If it does not work, adding more chart breadth or workflow portability would only hide a weak core.

**Interpretive Insight:** The MVP should first demonstrate coherence, not breadth. A thinner slice would prove chart output; this slice proves analytical trust.

**Decision Tree Branch 3: How early must performance and scale be treated as hard requirements?**

**Decision Question:** Should serious analytical scale be treated as later optimization or as a parallel workstream from the start?

**Selected Path:** treat performance as a parallel gating workstream beginning with the first proving slice

**Locked Performance Gates for Configuration A**

1. large local table loading remains practical
2. graph updates remain responsive during ordinary editing
3. filtering, sorting, recoding, and formula recomputation remain usable on large tables
4. hover, zoom, and pan remain smooth on dense views
5. the system degrades gracefully when data or chart density exceeds practical limits

**Rejected Alternative:** delay serious-scale work until feature completeness is achieved

- directly conflicts with the earlier locked-in MVP decision
- would encourage architecture that only works at demo scale
- creates a late-stage risk that the selected MVP identity is unattainable without scope reset

**Interpretive Insight:** Configuration A is defined partly by performance, not merely accompanied by it. Serious analytical scale is therefore a shaping constraint on architecture, interaction design, and sequencing from the beginning.

**Decision Tree Branch 4: What belongs in the irreducible MVP core versus the stretch zone?**

**Irreducible Configuration A Core**

1. trustworthy local import with preview correction
2. visible and editable semantic typing and analytical roles
3. direct-manipulation graph building with layering, role changes, and immediate visual feedback
4. structured transformation workflow with editable ordered steps
5. row-wise formula columns with preview, visible distinction, and recomputation
6. descriptive summaries plus simple graph-tied exploratory statistics
7. reliable save and reopen of the full analytical workspace
8. serious-scale responsiveness with graceful degradation

**Stretch Zone Still Associated with A**

1. faceting and small multiples
2. analytical overlays such as fit lines, summary bands, and reference lines beyond the minimum proving path
3. reusable visualization definitions applicable to new datasets

**Interpretive Insight:** The MVP core is already demanding. The stretch zone is not trivial, but it is explicitly separated so Configuration A can remain believable under delivery pressure rather than silently mutating into Configuration B.

**Decision Tree Branch 5: If schedule pressure appears, what slips first?**

**Decision Rule:** preserve coherence, performance, import trust, and workspace persistence before preserving additional comparison depth or artifact reuse polish

**Slip Order Under Pressure**

1. faceting and small multiples slip first
2. broader analytical overlays slip next
3. reusable visualization definitions slip last among the stretch items

**Rescue Rule**

- if only one stretch capability survives into A, preserve **reusable visualization definitions for new datasets**

**Reasoning:** Comparison depth and overlay richness are valuable, but reusable visualization definitions preserve portable analytical value and reduce the risk that the MVP feels like a dead-end exploratory surface.

**Interpretive Insight:** Under pressure, the product should sacrifice breadth before it sacrifices reuse, and sacrifice reuse before it sacrifices trust or responsiveness.

**Decision Tree Branch 6: What implementation sequence best protects Configuration A?**

**Selected Build Sequence**

1. **Workspace Kernel**
   - define the canonical analytical state model
   - establish transform, formula, graph, subset, and persistence primitives
2. **Trustworthy Import and Semantics**
   - build preview, parsing correction, type inference, role visibility, and overrides
3. **Core Analytical Builder**
   - add role assignment, editable layers, immediate graph updates, and strong axis or legend defaults
4. **Structured Prep Workspace**
   - add ordered transform steps, formula preview, recomputation, and localized failure handling
5. **Graph-Tied Statistical Layer**
   - add descriptive summaries and simple exploratory regression-style output tied to the active analytical state
6. **Reliable Persistence**
   - save and reopen full workspace state without semantic or graph drift
7. **Stretch Pack for A**
   - add faceting, additional overlays, and reusable visualization definitions only if the earlier gates are stable

**Interpretive Insight:** This sequence intentionally delays breadth-expansion decisions until the stateful analytical loop is already real. It minimizes the risk of building an impressive UI atop a brittle analytical core.

**Decision Tree Branch 7: What are the release gates for Configuration A?**

**Configuration A should be considered MVP-ready only if all of the following are true:**

1. users can import real local data, inspect parsing decisions, correct them, and confirm import explicitly
2. users can see and change column types and analytical roles, and the consequences are immediate and understandable
3. users can build and iteratively modify core analytical charts without rebuilding from scratch
4. users can perform structured data prep and row-wise formula work without losing debuggability
5. users can obtain descriptive and simple exploratory statistical output tied to the current graph or subset state
6. users can save and reopen complete analytical workspaces with graph, transform, formula, and semantic state intact
7. users can work at meaningful local analytical scale without the product collapsing into unusable latency

**Interpretive Insight:** Configuration A is not complete when the feature list exists. It is complete when a user can perform a full analytical session with trust, speed, and recoverability.

**Configuration A Immediate Action Plan**

**Immediate Next Steps**

1. convert Configuration A into a formal scope artifact with explicit in-scope, stretch, and out-of-scope boundaries
2. define the workspace kernel and persistence model before detailed UI decomposition
3. select representative benchmark datasets, including at least one serious-scale local dataset, to keep performance claims honest
4. break the MVP into vertical-slice implementation epics based on the selected build sequence
5. define release-gate tests for import trust, semantic propagation, transform recomputation, workspace reopening, and responsive graph editing

**Resource Requirements**

1. representative local datasets covering clean, dirty, and large-scale cases
2. a reference inventory from the `essential-graphing` material for the specific MVP graph-builder behaviors being preserved
3. a concrete workspace-state and serialization design
4. explicit benchmark scenarios for chart editing, transform recomputation, and reopen performance

**Potential Obstacles**

1. semantic state drifting between table, graph, and saved workspace representations
2. formula and transform recomputation becoming too expensive at realistic scale
3. persistence behaving like a snapshot of UI state rather than a faithful analytical workspace
4. silent scope creep from Configuration A into Configuration B

**Success Indicators**

1. the minimum proving slice works end to end on representative datasets
2. type or role overrides immediately and correctly affect graphs and statistics
3. transform and formula failures remain localized and repairable
4. saved workspaces reopen without meaningful loss of analytical state
5. performance gates remain within the team's acceptable responsiveness thresholds on serious local workloads

**Decision Tree Mapping Completion Summary**

- **Implementation starting point chosen:** analytical-workspace-first rather than visualization-first
- **Core proving slice chosen:** import, semantic correction, direct graph editing, structured prep, simple stats, and full workspace reopen
- **Locked MVP gates reaffirmed:** serious analytical scale, trustworthy import semantics, structured prep, and reliable persistence
- **Pressure-response rule clarified:** slip comparison depth first, then overlay breadth, and preserve reusable visualization definitions if only one stretch capability remains

**Recommended Next Artifact:** turn this Configuration A action plan into a formal product brief or PRD scope section, then produce an architecture document centered on the workspace kernel, performance strategy, and persistence model.

**Decision Tree Mapping Validation**

- The user reviewed the proposed Configuration A decision-tree assumptions and accepted them without change.
- The analytical-workspace-first path, minimum proving slice, release gates, and schedule-pressure slip order stand as the confirmed action-planning baseline for the MVP.
