---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - /home/pinto/repo/BMADGraphWebApp/_bmad-output/brainstorming/brainstorming-session-2026-03-19-183532.md
  - /home/pinto/repo/BMADGraphWebApp/docs/essential-graphing.pdf
  - /home/pinto/repo/BMADGraphWebApp/docs/essential-graphing.parsed.txt
date: 2026-03-24
author: Pinto
---

# Product Brief: BMADGraphWebApp

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

BMADGraphWebApp is a local-first, single-user analytical workspace for engineers who need to explore product data quickly and create high-quality graphs for reports, presentations, and customer conversations without depending on expert tool users. Today, these users are caught between Excel, which is easy to access but weak for serious exploratory graphing, and JMP, which is powerful but too difficult for many engineers to use independently.

The product is designed around a focused analytical workflow: import real datasets, correct semantics, make lightweight structured transformations, build interactive graphs through direct manipulation, generate simple statistical insight, and reopen the full workspace later with the analytical state intact. Its core value is not maximum breadth. Its value is making serious exploratory visualization intuitive while preserving graph quality, reproducibility, and enough advanced capability to remain credible for technical work.

The confirmed MVP baseline is Configuration A, "Focused Analytical Builder". That means the first release is intentionally local-first, single-user, and analytical-workspace-first, with serious analytical scale treated as non-negotiable. The core proving slice is import, semantic correction, graph editing, structured prep, simple stats, and reliable workspace reopen.

---

## Core Vision

### Problem Statement

Engineers who create reports and communicate with non-technical customers struggle to explore datasets quickly and turn findings into high-quality visualizations using current tools. Excel is widely accessible but produces weak graphs and slows analysis. More advanced platforms such as JMP provide strong customization, reproducibility, and automation, but their learning curve is too steep for many engineers to use efficiently and independently.

### Problem Impact

When this problem remains unsolved, teams become inefficient at exploring datasets, identifying failures or anomalies, and producing visuals for reports and presentations. Analytical work slows down, graph quality suffers, and more technical team members are pulled into repetitive data-processing and visualization tasks instead of spending time on higher-value investigative or innovative work.

### Why Existing Solutions Fall Short

Existing solutions split into two weak extremes for this user. Excel is approachable but poor at exploratory graphing and presentation-quality output. JMP is much closer to the desired analytical power, but advanced, reproducible plotting is bundled into a much broader platform with a steep learning curve. As a result, less technical engineers cannot use it independently and often depend on more technical users to process data, build automations, or create the final graphs for them.

### Proposed Solution

BMADGraphWebApp provides a tighter, more focused workflow centered on exploratory visualization and high-quality graph production. The experience begins with fast local import across common data types, including prompts for likely errors and correction paths. Users can inspect and correct inferred data semantics, make simple edits and derived columns, and perform lightweight structured transformations before graphing.

Graph creation is based on an intuitive drag-and-drop builder with interactive exploration, strong defaults, and optional depth. Beginners benefit from tutorial-style guidance, helper bubbles, and consistent default behaviors, while technical users retain customization and automation paths where they matter. The product treats exploratory analysis and final communication as one connected workflow rather than two separate activities. Workflows covering import, processing, transforms, and plots should be reusable so users can reproduce analysis in later sessions with different datasets.

### Key Differentiators

- A focused product surface optimized for exploratory visualization and high-quality plotting rather than broad statistical-platform coverage.
- High-quality defaults and in-product guidance for beginners, with enough control and automation for technical users.
- A workflow that unifies exploration and final-report graphing instead of forcing users to choose between rough analysis charts and polished presentation outputs.
- Local-first, single-user analytical workspace behavior with structured prep, simple statistical support, and reliable reopen of saved work.
- Reproducible graphing and lightweight transformation workflows without requiring users to adopt a programming-heavy model.
- A cleaner, more consistent user experience that prioritizes intuition and speed over maximum breadth of features.

## Target Users

### Primary Users

#### Primary Persona 1: Non-Technical Domain Engineer

**Persona:** David Mercer is a senior engineer with deep product and domain knowledge but limited familiarity with programming, scripting, or advanced analytics platforms. He regularly contributes to technical reports, customer presentations, and internal reviews, where he needs credible graphs that clearly explain product behavior. He is comfortable reasoning about engineering systems, but not comfortable navigating complex analytical software.

**Context and Goals:** David works with product datasets that help him identify obvious outliers, failures, and behavior patterns. He wants to move from raw data to a professional graph quickly, with minimal setup friction and without needing help from a more technical teammate. A major goal is repeatability: once he has a graph that works, he wants to apply the same layout and process to new datasets without rebuilding it manually.

**Current Pain:** Today, David is mostly limited to Excel, which slows him down and produces weak visual output, or he depends on more technical users to work in JMP on his behalf. He finds advanced platforms intimidating, hard to learn efficiently, and too large in scope for the job he is actually trying to get done.

**Success Vision:** Success for David means being able to import a familiar dataset, make a small correction, create a polished graph with strong defaults, and reuse that process later without feeling overwhelmed. He should feel capable and independent, not blocked by the tool.

#### Primary Persona 2: Technical R&D Engineer

**Persona:** Priya Raman is a technically stronger engineer working in an R&D or investigation-oriented role. She uses data visualization as a core exploratory tool to investigate failures, understand unexpected product behavior, compare datasets, and identify deeper patterns. She is more comfortable with structured analysis, formulas, and more advanced graphing workflows.

**Context and Goals:** Priya wants to move quickly through an exploratory loop: import data, correct semantics, add formula columns, try multiple views, compare variables, and save the full workspace so she can continue later. She values reproducibility, speed, and enough control to build more detailed or automation-friendly analytical workflows without paying the cost of an overly broad platform.

**Current Pain:** This segment is less blocked than the non-technical user, but still experiences friction. JMP is closer to what Priya needs, yet its learning curve and cost remain barriers. The overhead of a larger platform can also be disproportionate when the immediate need is focused exploratory graphing and lightweight reproducible analysis.

**Success Vision:** Success for Priya means being able to investigate data quickly, derive new columns, compare several graph types in one session, preserve the analytical context, and reuse or extend the work later without losing momentum.

### Secondary Users

Secondary users and stakeholders are important because they influence whether the product's outputs are trusted and useful, even if they are not the primary operators of the tool.

**Customers:** Customers are downstream consumers of reports and presentation visuals. They benefit when graphs are clear, professional, and easy to interpret. They also influence product success because customer-facing output must look credible and communicate findings without unnecessary technical complexity.

**Quality Engineers:** Quality engineers are likely stakeholders in traceability and trust. They care that the reported graphs and conclusions can be connected back to the underlying data and workflow, especially when the output is used in investigations or product-quality discussions.

**Managers:** Managers consume reports and summaries to make decisions, monitor issues, and understand findings quickly. They value clarity, consistency, and the ability to trust that the visual output is based on a repeatable process rather than one-off manual graph assembly.

### User Journey

#### Non-Technical Domain Engineer Journey

**Discovery:** The non-technical engineer most likely discovers BMADGraphWebApp through an internal recommendation or by seeing a coworker use it successfully to create the kind of graph they need.

**Onboarding:** Their first experience should feel guided, calm, and low-risk. Tutorial-style helper bubbles, clear prompts, strong defaults, and obvious next steps should make the workflow feel approachable rather than intimidating.

**Core Usage:** They import a familiar product dataset, correct a small issue, perform light data preparation, and create a polished graph for a report, presentation, or internal review.

**Aha Moment:** The key moment is when they create their first high-quality graph that communicates what they need without feeling overwhelmed by a steep learning curve or a large platform surface.

**Long-Term Routine:** Over time, the product becomes their default way to turn recurring product datasets into reproducible, presentation-ready visuals without having to rely on technical specialists for everyday reporting work.

#### Technical R&D Engineer Journey

**Discovery:** The technical user adopts BMADGraphWebApp after recognizing that it can support most of their exploratory graphing workflow without the weight, cost, or learning overhead of a broader platform.

**Onboarding:** Their first session should demonstrate that the product is not just simplified, but still analytically credible. They need to see semantic control, formula support, interactive plotting, and workspace continuity early.

**Core Usage:** They import a product dataset, correct semantics, add formula columns, test several different plot types across variables, inspect patterns and anomalies, and save the workspace to continue the investigation later.

**Aha Moment:** The key moment is when they quickly add formula columns, generate several different plot types from the same dataset, and save the workspace so the analytical process can continue without rebuilding the session.

**Long-Term Routine:** Over time, the product becomes part of their standard workflow for exploratory investigations, pattern analysis across datasets, and creation of reusable analytical setups that can be rerun on similar product data over time.

## Success Metrics

Success for BMADGraphWebApp should be measured primarily by whether it helps users create high-quality graphs quickly, independently, and repeatably. The most important user-level signal is whether the product reduces the time and friction required to go from raw dataset to credible analytical output.

### User Success Metrics

**Time to first high-quality graph**
The primary user-success metric for the MVP is that a non-technical user can go from opening the product to producing a graph they would actually use in a technical report or customer presentation within **10 minutes**.

**Independent import and semantic correction**
A second key metric is whether users can bring data into a correct analytical state without needing help from technical teammates. This should be measured against a representative benchmark set of import tasks:
- import a clean local CSV and confirm inferred column types and roles
- import an Excel workbook and correct at least one misclassified type or analytical role
- import a file with a parsing issue such as delimiter, header-row, or date-format detection and fix it in preview
- import a dataset with missing or invalid values and choose an appropriate handling rule without help
- import pasted tabular data and complete semantic correction before moving into graphing

The MVP target is:
- **100% successful completion without assistance for non-error-containing datasets**
- **50% successful completion without assistance for error-containing datasets**

These metrics reflect the product's promise of guided usability, trustworthy import, and reduced dependence on expert intervention.

### Business Objectives

**3-month business objective**
Within three months of launch, the product should achieve:
- **80% adoption among non-technical users**
- **20% adoption among technical users**

This would indicate that the product is solving the accessibility problem for its core audience while also proving credible enough to attract at least moderate usage from more technical users.

**12-month business objective**
Within twelve months, the product should:
- **reduce JMP dependency by more than 50%**
- become the **standard workflow across the company** for this category of exploratory graphing and reporting work

For this product brief, "standard workflow" means that most reporting and exploratory graphing work in this problem space is performed in BMADGraphWebApp rather than in Excel, JMP, or ad hoc alternatives.

### Key Performance Indicators

- **Median time to first report-ready graph for non-technical users:** target `<= 10 minutes`
- **Independent completion rate for clean import tasks:** target `100%`
- **Independent completion rate for error-containing import tasks:** target `50%`
- **3-month non-technical user adoption rate:** target `80%`
- **3-month technical user adoption rate:** target `20%`
- **12-month reduction in JMP-dependent workflow usage:** target `> 50%`
- **12-month share of target reporting and exploratory graphing workflows completed in BMADGraphWebApp:** target `majority of workflows`

## MVP Scope

### Core Features

The MVP for BMADGraphWebApp is a local-first, single-user analytical workspace focused on helping users move from raw product data to credible, report-ready visualizations without depending on expert tool users.

The core feature set includes:

- Local file and pasted-data import for CSV, Excel, and direct table paste, with preview, parsing fixes, and semantic correction support
- Lightweight data preparation including filtering, sorting, type correction, recoding, and simple derived or formula-based columns
- A direct-manipulation graph builder with a focused but serious analytical chart set, interactive exploration, and strong defaults
- Sufficient graph control to produce presentation-ready output rather than rough exploratory-only visuals
- Simple graph-tied statistical support, including descriptive summaries and one basic fit or regression path
- Reliable save and reopen of the full analytical workspace so users can continue work without rebuilding state
- Guided onboarding, helper bubbles, and in-product support for first-time or non-technical users
- Credible performance on serious local datasets representative of real engineering and analytical work

This scope is intentionally shaped around the core analytical loop: import data, correct semantics, perform light preparation, build and refine graphs, generate simple statistical insight, and reopen the full workspace later with continuity intact. That is the minimum product that can solve the central usability and graph-quality problem described in this brief.

### Out of Scope for MVP

To keep the MVP focused and achievable, the following are explicitly out of scope:

- Multi-user collaboration
- Connected data sources beyond local files and pasted data
- Broad advanced statistical-platform breadth
- Deep per-cell spreadsheet-style editing and customization
- Near-parity chart breadth with JMP
- Heavy workflow export portability beyond the confirmed reusable slice
- Permissions, privacy, and compliance features

These exclusions are deliberate. The MVP is meant to prove that a focused analytical workspace can help non-technical and technical users create strong graphs quickly and independently, not to replicate a full analytical platform in version one.

### MVP Success Criteria

The MVP will be considered successful if it proves both user value and product credibility in the core workflow.

Key success criteria are:

- Non-technical users can independently complete the core loop and produce a report-ready graph within 10 minutes
- Adoption targets are met within 3 months, with 80% adoption among non-technical users and 20% adoption among technical users
- Workspace continuity is validated through reliable save and reopen of the full analytical state
- Performance is credible on representative large local datasets used in real engineering and analytical contexts

These criteria confirm that the product is not only usable, but meaningfully replacing current friction-filled workflows.

### Future Vision

If BMADGraphWebApp is highly successful, it evolves from a focused local analytical workspace into a broader platform for engineers and data analysts to create high-quality visualizations and reusable analytical workflows.

Over a 2-3 year horizon, the product expands in several directions:

- An extensible platform model with support for extensions and a growing ecosystem of add-on capabilities
- Data-source connectivity through APIs so users can work with more than local files while preserving a clear analytical workflow
- A repository of reusable templates created by users for data transformations, visualizations, and statistical analyses
- Sharing and reuse mechanisms that allow proven templates and analytical patterns to spread across teams and use cases
- Expansion beyond the original core audience into a wider platform serving both engineers and dedicated data analysts

In that future state, the MVP becomes the foundation rather than the full ambition. The initial local-first workspace proves the core loop, while later versions extend the platform through connectivity, reusability, and community-created analytical assets.
