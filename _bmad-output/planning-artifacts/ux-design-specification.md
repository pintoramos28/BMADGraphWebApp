---
stepsCompleted:
  - step-01-init.md
  - step-02-discovery.md
  - step-03-core-experience.md
  - step-04-emotional-response.md
  - step-05-inspiration.md
  - step-06-design-system.md
  - step-07-defining-experience.md
  - step-08-visual-foundation.md
  - step-09-design-directions.md
inputDocuments:
  - /home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/product-brief-BMADGraphWebApp-2026-03-24.md
  - /home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md
  - /home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd-validation-report-2026-04-06.md
  - /home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd-validation-report-2026-04-08.md
  - /home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-08.md
  - /home/pin81845/repo/BMADGraphWebApp/docs/essential-graphing.pdf
  - /home/pin81845/repo/BMADGraphWebApp/docs/essential-graphing.parsed.txt
---

# UX Design Specification BMADGraphWebApp

**Author:** Pinto
**Date:** 2026-04-08

---

<!-- UX design content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

### Project Vision
BMADGraphWebApp now proves that engineers can open a centrally hosted browser shell, cache it locally within five seconds, and run the entire analytical loop—import, semantic correction, lightweight prep, graph building, stats, save/reopen—while their datasets, workspaces, and transforms never leave the local machine. The UX must keep this hybrid hosted/offline promise visible: launch through internal hosting with no per-user installs, confirm “Ready for offline use,” and let users resume trustworthy analyses even when the network drops.

### Target Users
- **David Mercer (non-technical domain engineer):** Needs a calm runway that makes the hosted shell feel as approachable as Excel while still guaranteeing offline continuity for travel/offsite reviews. He relies on semantic chips, KPI telemetry, and celebratory “Ready to graph” confirmations to stay confident without expert help.
- **Priya Raman (technical R&D engineer):** Demands investigative flow with dockable panes, derived columns, and rapid graph iteration that stays under the ≤1 s target even as the shell streams telemetry back once connectivity returns.
- **Elena Brooks (quality reviewer):** Trust hinges on provenance overlays, drift warnings, and evidence that travels with a workspace export. She re-imports colleagues’ workspaces into her own review environment rather than approving anything inside BMADGraphWebApp, so authors must keep status signals clear before handing work off.

### Key Design Challenges
1. **Hosted shell transparency:** Communicate caching status, offline readiness, telemetry backlog, and update prompts without interrupting flow.
2. **Performance visibility on hybrid delivery:** Maintain ≤1 s editing latency despite service-worker caching and telemetry queues, and surface timing badges so users believe the KPI.
3. **Trust + provenance in offline/online transitions:** Keep drift alerts, semantic overrides, and handoff evidence aligned after reconnects so the interface never shows stale states even though the data stays local.
4. **Accessibility in dense analytical UI:** Preserve WCAG 2.1 AA focus, keyboard parity, and screen-reader narrations across calm cockpit, investigative dock, and the optional status/history overlays.

### Design Opportunities
1. **Confidence-first hosted onboarding:** Use environment checks, semantic chips, and calm copy to turn “hosted shell + local data” into an obvious benefit (fast updates, no installs, still private).
2. **Offline-aware telemetry storytelling:** Telemetry badges, backlog pills, and “Ready for offline use” confirmations can differentiate the product by showing KPI compliance instead of hiding network complexity.
3. **Status/history + drift repair UX:** A lightweight status panel with repair cards and export-ready provenance can make BMADGraphWebApp the most trustworthy graphing workspace in its class.
4. **Composable investigative canvas:** Responsive dock/pin patterns let Priya and David share one workspace model, reinforcing the “one state, many views” principle without fracturing performance budgets.

## Core User Experience

### Defining Experience
BMADGraphWebApp is an analytical flight deck: import → semantic correction → lightweight prep/derived columns → interactive graph + stats → save/reopen, all within one resilient workspace that never leaves the user’s machine. The hosted browser shell simply delivers and refreshes the cockpit; the experience centers on semantic chips, dockable panes, and telemetry-aware status rails that keep David and Priya in uninterrupted investigative flow. If the drag-and-drop canvas plus status/history panel stay coherent and sub-second, everything else follows.

### Platform Strategy
We target a desktop-class, mouse/keyboard-first web shell that precaches within ≤5 s and runs offline indefinitely; touch gestures are additive but not primary. Service-worker state, cache freshness, and telemetry backlog surface through a low-profile status rail rather than modal interruptions. High-resolution monitors, split panes, and assistive tech are supported by enforcing WCAG 2.1 AA focus order, strong keyboard parity, and predictable docking behavior—even when panes pin, undock, or collapse for offline mode.

### Effortless Interactions
- **Import & Semantics:** Schema issues get auto-diagnosed, with one-click fixes for delimiters, units, and missing data; semantic chips update instantly (<1 s) as fields move.
- **Status Transparency:** “Ready for offline use,” cache freshness, and telemetry backlog live in chips that escalate only when user action is needed, so the canvas stays calm.
- **Workspace Continuity:** Save/reopen is one command that restores graphs, transformations, and status/history settings; any drift or broken formula spawns actionable repair cards.
- **Status & History:** Lightweight provenance overlays stay synchronized with the active workspace and highlight what changed prior to export.

### Critical Success Moments
1. **First Ten Minutes:** David loads a real dataset, fixes a misread column, and sees “Ready to graph” plus a polished chart—all before minute ten.
2. **Messy Data Recovery:** Priya resolves a parsing or drift issue without leaving the workspace, proving the system replaces JMP escalations.
3. **Offline Confidence:** The shell confirms caching, the graphs stay ≤1 s responsive during a network drop, and telemetry queues quietly.
4. **Review Trust:** When Elena later imports a saved workspace into her review tooling, she immediately sees provenance, telemetry, and drift status were clean at the time of handoff, so she doesn’t have to reconstruct context.

### Experience Principles
1. **Hosted Transparency, Local Control** – Status rails communicate cache, updates, and telemetry without ever implying data leaves the device.
2. **Single Workspace, Many Facets** – Docked panes, chips, and the optional status/history panel all draw from the same analytical kernel so intent never fragments.
3. **Guided Independence** – Inline helpers, guardrails, and celebratory confirmations keep non-technical users self-sufficient without slowing experts.
4. **Performance = Trust** – Sub-second graph edits, ≤2 s transforms, and immediate drift alerts prove the workspace is serious-scale and reliable.

## Desired Emotional Response

### Primary Emotional Goals
- **Assured Control:** The workspace feels like a calm cockpit—users know exactly what’s happening and never fear losing their place.
- **Autonomous Mastery:** Priya and David experience self-directed success; the system makes them feel capable without needing expert rescue.
- **Collective Credibility:** Reviewers feel the output earns immediate organizational trust; sharing a workspace strengthens the team’s story.
- **Investigative Momentum:** Priya stays energized and in flow because the workspace keeps pace with her curiosity rather than slowing her down.

### Emotional Journey Mapping
1. **First Launch:** Curious reassurance—status chips confirm the hosted shell is cached, private, and offline-ready.
2. **Import / Prep:** Relief pulse—auto-detected schema fixes dissolve tension before it builds.
3. **Analytical Flow:** Flow-state focus—semantic chips, panes, and telemetry rails stay quiet unless action is truly needed.
4. **Issue Handling:** Predictable recovery—warning chips explain what’s off and how to fix it without panic.
5. **Completion / Save:** Mission acknowledgment—copy confirms “Workspace sealed; provenance current as of HH:MM.”
6. **Review / Reopen:** Collective confidence—status/history chips make it obvious what changed before the workspace was exported, so Elena can align with the author once she opens it elsewhere.
7. **Return Sessions:** Familiar trust—the cockpit looks identical on every reopen, reinforcing continuity.

### Micro-Emotions
- **Confidence over Confusion** when semantic chips update instantly.
- **Relief over Tension** when messy imports auto-correct.
- **Trust over Skepticism** via telemetry cues framed as reassurance.
- **Excitement over Anxiety** through sub-second graph edits even offline.
- **Alignment over Doubt** as the status/history panel captures drift history for later export.
- **Accomplishment over Frustration** when workspace reopen is exact and audit-ready.

### Design Implications
- **Assured Control →** low-noise status rail, mission-log style confirmations, no surprise modals.
- **Autonomous Mastery →** inline repair cards, undo-safe transforms, transparent provenance overlays.
- **Collective Credibility →** status/history chips that show who changed what and when, plus audit-ready timestamps.
- **Investigative Momentum →** focus mode that hides nonessential chrome while keeping telemetry chips visible.
- **Relief Pulse →** micro-copy that explicitly says “Import repaired—delimiter corrected automatically.”
- **Predictable Recovery →** warning chips that pair cause + fix (“Telemetry queued (offline) — will sync on reconnection”).

### Emotional Design Principles
1. **Telemetry as Reassurance:** Status cues exist to prove stability, not to nag.
2. **Proof Beats Hype:** Every delight moment references evidence (performance badges, timestamps).
3. **Resilience at the Surface:** Offline, telemetry, and drift states surface before users worry.
4. **Shared Ownership:** Reviewer rails signal the workspace is a living artifact, encouraging confident collaboration.

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis
1. **Notion**
   - **Core solve:** Modular canvas that keeps complex information approachable through nesting, toggles, and calm typography.
   - **Onboarding:** Progressive disclosure—starter templates plus inline hints keep first-run anxiety low.
   - **Navigation:** Left rail + breadcrumbs reinforce spatial memory; keyboard palette accelerates power users.
   - **Interactions:** Drag-to-reorder blocks and “/” commands give mastery without clutter.
   - **Visual choices:** Muted chrome and generous spacing deliver Assured Control.
   - **Error handling:** Inline warnings and soft toasts keep context intact—our model for non-intrusive telemetry cues.

2. **Figma**
   - **Core solve:** Keeps investigative momentum even with heavy canvases; live cursors build collaboration trust.
   - **Onboarding:** Tutorials embedded directly in starter files demonstrate interactions in situ.
   - **Navigation:** Infinite canvas + page tabs mirror our “one workspace, many views” docking model.
   - **Innovations:** Comment threads, version history, and autosave badges show how evidence rails and mission logs can feel collaborative.
   - **Visual system:** High-contrast chrome with depth cues separates tools from canvas, reducing cognitive load.
   - **Error handling:** Autosave/offline badges live in the toolbar—exactly the telemetry reassurance tone we need.

3. **Linear**
   - **Core solve:** Command palette and ultra-focused task view keep users in flow.
   - **Navigation:** Palette-first navigation plus contextual keyboard hints provide accessible power without clutter.
   - **Interactions:** Focus mode hides chrome during deep work, giving Priya investigative momentum.
   - **Visual choices:** High-contrast, dark-friendly UI supports long sessions while keeping state obvious.
   - **Reliability cues:** Sync indicators sit next to the palette so status is always reachable via keyboard.

4. **Obsidian**
   - **Core solve:** Multi-pane knowledge graph without overwhelming the user.
   - **Navigation:** Collapsible sidebars and pane splitting let Priya dock evidence rails while David keeps a single calm view.
   - **Interactions:** Graph view + backlinks reinforce spatial memory—useful for our workspace mission log.
   - **Visual choices:** Subtle color coding and thin separators keep dense information legible.
   - **Error handling:** Warnings appear inline, preserving flow.

5. **Slack**
   - **Core solve:** Real-time messaging with graceful offline behavior.
   - **Telemetry cues:** “Message will send when you’re back online” banner balances honesty with reassurance.
   - **Visual system:** Status chips adopt the chroma of the channel header, keeping signals visible in light/dark modes.
   - **Interactions:** Command palette + shortcuts provide parity for mouse and keyboard users.

6. **Vercel Deployments / Datadog Notebooks**
   - **Core solve:** Mission log + timeline views that explain exactly what happened and when.
   - **Navigation:** Vertical timeline with filters lets teams audit events without losing context.
   - **Interactions:** Hover reveals precise timestamps and status; comments attach to moments, not generic notes.
   - **Visual choices:** Dark background with bright status pills reinforces “mission control” tone—perfect for our telemetry rail.

7. **JMP Graph Builder**
   - **Core solve:** Serious statistical graphing with rich drag targets.
   - **Onboarding:** Guided recipes and sample data reduce fear of advanced capabilities.
   - **Navigation:** Pill-based role assignments (X, Y, group) echo our semantic chips; seeing assignments reflected immediately reinforces trust.
   - **Interactions:** Instant recomputation and overlay stacking show how to keep investigative flow <1 s even when layering stats.
   - **Visual choices:** Dense but consistent iconography; gridlines and axis handles communicate precision.
   - **Error handling:** Blocking dialogs explain why a configuration is invalid—good reference for our “steady guidance” tone.

### Transferable UX Patterns
- **Navigation**
  - Notion rail + breadcrumbs anchor workspace/project hopping.
  - Figma tabbed pages + Obsidian split panes enable “one state, many views.”
  - Linear command palette ensures every action is keyboard-accessible.
- **Interaction**
  - Notion/Linear palette commands adapt to BMAD verbs (import, semantic fix, telemetry log).
  - Figma/JMP drag-to-role targets reinforce semantic chips with instant previews.
  - Slack-style offline banner copy keeps telemetry chips honest and reassuring.
- **Visual**
  - Calm chrome (Notion) + mission-control badges (Figma/Vercel) balance reassurance with precision.
  - Obsidian pane contrast keeps multi-pane evidence rails legible without overwhelming David.

### Anti-Patterns to Avoid
- **Hidden State Changes:** Silent autosave/offline transitions undermine Assured Control.
- **Palette Commands that Fail Offline:** Any command palette action must degrade gracefully without network.
- **Modal Overload:** Blocking dialogs break investigative momentum—prefer inline repair cards.
- **Over-gamified Celebrations:** Confetti clashes with the mission-control tone; stick to mission acknowledgments.
- **Telemetry Badges that Disappear in Dark Mode:** Status cues need WCAG-compliant contrast everywhere.
- **Unbounded Toolbars:** Dense, always-on expert UI overwhelms David; progressive disclosure only.

### Design Inspiration Strategy
- **Adopt**
  - Notion’s calm chrome + contextual helper copy for onboarding.
  - Figma/Slack autosave + offline badges as telemetry reassurance.
  - Linear’s command palette for fast task switching with keyboard parity.
  - Vercel/Datadog mission logs to anchor the provenance timeline.
  - JMP Graph Builder’s drag-to-role chips and instant recompute loop to prove BMAD can match the proven analytical feel.
- **Adapt**
  - Obsidian split panes into configurable evidence rails (collapsible for David, expandable for Priya).
  - Slack’s offline banner tone into telemetry chips (“Will sync when back online”).
  - Figma comment threads into reviewer presence + drift notes within evidence rails.
- **Avoid**
  - Silent auto-fixes without explanation.
  - Palette actions that require network acknowledgments to complete.
  - Confetti or loud success animations that break the calm cockpit.
  - Dark-mode-only status cues; maintain WCAG contrast in both themes.

## Design System Foundation

### 1.1 Design System Choice
**Base UI + BMAD Mission Control Layer** – we rely exclusively on `@base-ui/react` primitives for behavior/accessibility and layer a custom token library plus component styles that match the “hosted mission control” aesthetic.

### Rationale for Selection
- **Long-term support:** Base UI is now MUI’s primary investment area (v1+), so we inherit an actively maintained accessibility layer without depending on paused projects.
- **Full visual control:** Unstyled primitives mean cockpit chrome, telemetry rails, and offline banners follow our tokens exactly—no upstream material/joy opinions to override.
- **Performance-aware:** Headless components keep bundle size low and make it easy to tree-shake unused interactions so we stay within the ≤5 s caching target.
- **Clear ownership:** Owning the styling layer avoids split-brain “theme pack vs. Base” rules; every BMAD component documents whether it’s a thin wrapper (e.g., combobox) or a bespoke build (e.g., telemetry rail) so contributors know the single source of truth.

### Implementation Approach
1. **Tech stack:** React + Vite (or Next) with TypeScript, importing `@base-ui/react` primitives only; all styling lives in our Mission Control token system (CSS variables + utility classes) defined under `_bmad-output/design-system`.
2. **Component zoning doc:** Maintain a Storybook grid that lists each BMAD component, the Base UI primitive(s) it wraps, and any custom behaviors (telemetry queue indicators, provenance overlays, etc.).
3. **Performance plan:** Keep Base UI imports granular, leverage Suspense/lazy routes, and ensure the service worker precaches only core shells while streaming mission-control components as needed.
4. **Storybook + tokens:** Stand up Storybook early; define the token set (colors, typography, spacing, motion) once and consume it from Base UI wrappers plus bespoke components so the ledger/status rails stay visually consistent.

### Customization Strategy
- **Palette:** Define cockpit tokens (neutrals, telemetry states, drift alerts) inside our Mission Control theme and apply them through CSS variables consumed by Base UI parts.
- **Typography:** Use our own scale derived from Inter + JetBrains Mono (documented below) so headings, chips, and telemetry readouts stay consistent without upstream presets.
- **Component themes:**
  - Telemetry chips: Base UI `Badge` composition + Mission Control tokens for ready/queued/offline states.
  - Evidence rails: Base UI `Tabs`/`Accordion` primitives combined with custom reviewer cards, drift alerts, and provenance metadata panels.
  - Command palette: Base UI `Modal` + keyboard-first focus styles defined in our token set, with offline-safe command feedback baked into the wrapper.
- **Documentation:** Capture mission-control patterns (status rails, evidence rails, command palette) in Storybook with accessibility + offline notes so future engineers extend the custom layer instead of reaching for external themed kits.

## 2. Core User Experience

### 2.1 Defining Experience
BMADGraphWebApp’s signature moment is the five-second graph launch. A dataset lands in the hosted shell, recommended chart templates appear, and semantic chips snap into the X/Y/Color/Facet docks so the canvas instantly displays a trustworthy graph. David can pick a suggested template and get a presentation-ready chart without digging; Priya can swap scatter → dual-axis line → faceted ridgeline while keeping transforms and layers intact; Elena can later re-import the workspace with confidence because provenance badges and telemetry/offline status were pinned beside the canvas at handoff. If we perfect that drag-to-role graph builder—complete with instant template boosts, sub-second updates, statistical overlays, and always-on provenance rails—every other promise follows.

### 2.2 User Mental Model
- **David (Excel mindset):** Expects a direct-manipulation chart builder where whatever he tweaks on screen—axes, colors, labels—is exactly what he’ll export, with obvious axis roles, reusable templates, and guidance when semantics look off. Graphs should feel like “better Excel,” not a new language.
- **Priya (JMP mindset):** Thinks in role pills, layered plots, and rapid context switching between scatter, line, small multiples, and ridgelines without losing derived columns or filters. She assumes statistical overlays, dual axes, and evidence rails stay anchored to the same graph surface even offline.
- **Elena (quality reviewer):** Needs every chart to reveal what fields, filters, and transforms power it, plus drift/telemetry cues before the visual renders so she can trust it once she imports the author’s workspace into her own review flow.
- **Frustrations today:** Excel crumbles under serious data; JMP demands expert rituals. All three personas hate losing a crafted chart when reopening or when the network flickers, so they resort to fragile shortcuts (duplicated sheets, screenshots, multiple tool windows). Hidden recalculations, unclear layer inputs, and modal interruptions derail confidence fastest.

### 2.3 Success Criteria
- **Graph creation speed:** Import → semantic confirm → first template-backed graph in ≤10 minutes for David, with every role or template change rendering in ≤1 s and every transform/facet recompute finishing in ≤2 s—even offline.
- **Layer credibility:** Users can stack at least four encodings (axes + color/size/facet) plus one statistical overlay without frame drops; telemetry badges confirm these edits stay within SLA whether online or cached.
- **Workspace reusability:** Saving the workspace captures dataset semantics, transform stack, derived columns, template choice, layer order, annotations, telemetry state, and reviewer notes; reopening restores that full ledger with highlighted deltas and drift warnings before the graph loads.
- **Feedback transparency:** Status badges pair each graph edit with confidence copy (“Spline fit applied—latency 0.7 s, telemetry queued offline”), and inline repair cards point to misconfigured axes or incompatible templates without hiding the canvas.
- **Reviewer readiness:** Provenance/status signals surface who changed what, when, and why so authors can export a workspace that stands on its own when Elena reviews it later.

### 2.4 Novel UX Patterns
- **Established pieces:** Drag-to-role targets, template ribbons, small-multiple grids, layer toggles, and dockable panes draw from JMP Graph Builder, Tableau, and Obsidian/Figma pane systems so graph aficionados feel instantly oriented.
- **BMAD twists:** Hosted-shell telemetry and offline readiness live directly in the graph toolbar; evidence rails pair reviewer notes with per-layer provenance; template swaps never hide layer context; saving emits a mission-log-style ledger for each chart; reopening highlights delta badges before render.
- **Education plan:** First-run tooltips map each dock to familiar tools (“Color behaves like JMP Group / Excel Series”), explain telemetry chips, and show how reviewer rails track provenance. Palette hints expose keyboard shortcuts for swapping templates, cycling overlays, or opening the ledger so both David and Priya ramp fast.

### 2.5 Experience Mechanics
**Initiation**
- Import panel previews graph-ready schema, flags ambiguous columns, and proposes two or three chart templates (“Scatter with regression,” “Dual-axis comparison,” “Ridgeline small multiples”). Telemetry/offline badge confirms cache readiness before graphing starts.
- Empty canvas shows labeled drop zones plus template thumbnails, nudging David to “click to graph” while Priya can drag fields immediately.

**Interaction**
- Users drag chips or apply a suggested template; chart type ribbon updates live (scatter, line, dual-axis, small multiples, ridgeline). Layer drawer lets Priya toggle fits, confidence bands, annotations, KPI cards; each addition logs telemetry timing and provenance beside the canvas.
- Derived-column composer and filters sit adjacent so formula edits instantly feed new encodings; dockable panes let Priya pin the evidence rail while David collapses it.

**Feedback**
- Inline micro-toasts anchored to the graph frame report latency, template results, or semantic conflicts (“Facet grid ready in 0.9 s,” “Color encoding limited to categorical fields”).
- Telemetry/offline chips pulse quietly when metrics queue, and light-weight status/history badges show what each layer references. Drift or broken formulas trigger alerts before the graph renders so the workspace is trustworthy when Elena eventually inspects it.

**Completion**
- “Save Workspace” seals the graph state, transform stack, template choice, and reviewer notes; confirmation copy references the active chart (“Dual-axis line + spline saved at 14:05—offline-ready, telemetry queued 3 metrics”).
- Reopen flow previews the prior visual, highlights changes (new layer, updated transform), and surfaces drift/telemetry warnings before loading the canvas. Users can jump directly to the graph builder with all encodings intact, ensuring continuity for both David and Priya while making it easy to hand off a self-explanatory workspace for Elena’s later import.

## Visual Design Foundation

### Color System
- **Mission Control Palette:** Cool gray neutrals (#F5F7FB surface, #1F2430 text) keep the cockpit calm, while a saturated teal (#1BB1A8) signals “ready/healthy,” a deep indigo (#3246C5) anchors primary actions, and saffron (#F3A63B) plus crimson (#E24B4B) cover warning/error telemetry. This mirrors the emotional goals—Assured Control and Investigative Momentum—by pairing quiet chrome with confident signals.
- **Semantic Mapping:** Primary actions & graph handles use indigo #3246C5; secondary controls and evidence rail tabs use slate #3C485C; success/ready states use teal #1BB1A8; warning/drift uses saffron #F3A63B; error/telemetry failure uses crimson #E24B4B; backgrounds ladder from surface #F5F7FB to panel #E4E9F4, white canvas #FFFFFF, and a deep mission rail #161B26.
- **State Behavior:** Hover lightens fills by ~6%, pressed darkens by ~8%. Offline telemetry chips use teal outlines with neutral fills; queued state adds a saffron pulse. Disabled elements drop to 30% opacity but still meet contrast.
- **Accessibility:** Primary text/background combos exceed 4.5:1; badges switch to white text when fill is darker than #666, otherwise charcoal text. Semantic colors were checked against WCAG AA for both light and dark surfaces.

### Typography System
- **Primary Typeface:** Inter (variable) for UI chrome, tables, and body content—clean, modern, and aligned with our Mission Control tokens.
- **Secondary Typeface:** JetBrains Mono for telemetry readouts, provenance timestamps, formula editors, and KPI badges, reinforcing the mission-control tone.
- **Type Scale (1.125 modular):** Display 40/48px, H1 32/40px, H2 24/32px, H3 20/28px, Body L 16/24px, Body S 14/20px, Mono 13/20px. Headline spacing: 32px top / 16px bottom; body paragraphs use 8px separations.
- **Tone & Accessibility:** Professional and modern with high legibility in dense analytical contexts; minimum body size 14px, default editable text 16px to keep WCAG readability.

### Spacing & Layout Foundation
- **Base Grid:** 8px spacing system aligned with the Mission Control token set built atop Base UI. Components snap to 8/16/24/32 multiples, ensuring consistent rhythm even in compact analytics mode.
- **Density Modes:** Standard panels use 16px padding; compact analytics mode reduces vertical padding to 12px but retains the 8px grid. Docked evidence/telemetry rails keep widths in 64px increments for predictable docking.
- **Grid Structure:** 12-column responsive grid (72px columns / 24px gutters) on desktop. Mission rail reserves fixed 280px on the left; central canvas spans remaining columns. Overlays respect 40px outer margins on ≥1440px screens.
- **White Space:** Graph canvas includes 24px outer padding; docked panes drop to 16px. Button clusters maintain 8px gaps; template thumbnails rest on 16px cards for scannability.

### Accessibility Considerations
- All semantic pairs meet WCAG 2.1 AA contrast; telemetry badges combine icon + label text so color alone never conveys status.
- Focus states: 2px teal inner ring plus 1px outer halo ensure visibility on light/dark surfaces. Keyboard navigation order mirrors visual layout, and all controls maintain ≥44px touch targets even though desktop-first.
- Motion guidelines cap telemetry pulses/hover animations at 200 ms with reduced-motion fallbacks.
- Dark mode plan: invert neutrals (#0F141C background, #E3E9F5 text) while shifting semantic hues (teal → #2ED7CC, saffron → #FFC472) to preserve status recognition offline.

## Design Direction Decision

### Design Directions Explored
1. **Mission Control Focus** — graph-first cockpit with telemetry/status chips always visible.
2. **Calm Analyst** — airy, template-guided surface for David’s first graphs.
3. **Split Horizon** — dual-column layout emphasizing graph + status/history on widescreens.
4. **Telemetry Stream** — graph plus live telemetry spine when network storytelling matters most.
5. **Template Gallery** — template-first onboarding before entering the cockpit.
6. **Status & History Dock** — lightweight status panel (replaces the old reviewer dock) for handoff context.

### Chosen Direction
Hybrid of Mission Control Focus (core shell), Template Gallery (onboarding/new graph workflow), and Status & History dock. Split Horizon rules inform large-screen layouts so status/history can pin beside the canvas without crowding smaller viewports.

### Design Rationale
- Graph canvas stays primary with mission rail + telemetry chips so Priya and David always see performance/offline readiness.
- Template Gallery shortens David’s path to a KPI-proof first graph (≤1 s edits, ≤2 s transforms surfaced upfront).
- Status & History dock shows only “Last Saved” and “Drift” chips by default, with an optional drawer listing recent events for clean handoff to Elena’s external review tools.
- Saving triggers a mission-log style confirmation so exported workspaces carry the same provenance/status context.

### Implementation Approach
1. Build the Mission Control layout as the default app chrome (dark rail, light canvas, telemetry chips, role rail for advanced layers).
2. Layer the Template Gallery on top of that shell for first-run and “New Graph” flows, reusing the same tokens/components.
3. Implement a collapsible Status & History dock with always-on chips and an optional drawer for recent actions; ensure it’s hidden by default but keyboard accessible.
4. Apply Split Horizon behavior on ≥1440 px screens (status/history can pin beside the graph) while keeping it as a bottom drawer on smaller layouts.
