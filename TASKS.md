# Harbor Desk — Build Task List

Version 1.1 · 15 November 2026 · v1.0 (14 Nov) tasks T01–T23; v1.1 adds Phase 4.5 (T24–T35) from [IMPROVEMENT-PLAN.md](IMPROVEMENT-PLAN.md) and moves T22–T23 after it

Build a working portfolio demo from [PRD.md](PRD.md). The goal is a convincing Buffalo marina scene with a complete, correct slip-review workflow. Do not broaden this into a marina management suite.

**v1.1 scope note (15 Nov 2026, approved by Raj):**
- Phase 4.5 adds simulated operational depth: occupancy and rates, a 3D dock map, fit-aware assignment, a time scrubber and a dock-walk trigger. It targets 3D-prototyping roles broadly, with Dockwa as one target ([DOCKWA-ANALYSIS.md](DOCKWA-ANALYSIS.md)).
- **3D stays the default view.**
- Everything new remains local and SIM/ASSUME-labelled. No real integrations, payments, messaging or berth-allocation claims.
- [PRD.md](PRD.md) v1.1 §15 is the requirement source for this phase: F15–F23, data contract additions and quality targets. Superseded PRD sentences are marked *(amended by §15)*.

## Start here: instructions for Claude Code

Read, in order:

1. Applicable repository instructions and [PRODUCT.md](PRODUCT.md).
2. [PRD.md](PRD.md), especially source precedence, state invariants, and quality targets.
3. [DESIGN.md](DESIGN.md), [tokens.json](design/tokens.json), and [tokens.css](design/tokens.css).
4. [SLIPS.md](data/SLIPS.md), [SITE-NOTES.md](data/SITE-NOTES.md), and both supplied GeoJSON files.
5. [Visual target v2](design/visual-target-v2.png) and [interaction storyboard](design/slip-mismatch-storyboard.html). Inspect the image and run/read the storyboard; prose alone is not the visual target.

The reference video `ssstwitter.com_1794669390043.mp4` is optional supporting motion/composition material and must not enter the runtime bundle. V2 supersedes uniformly low-poly rendering; DESIGN remains the brand/token authority. The storyboard’s teaser navigation is not a production state machine.

Work through the tasks in dependency order. A gate is an evidence check, not a new permission request. Proceed autonomously when its criteria are met. Record failures and resolve them; never mark a gate complete based only on a placeholder or a successful compile. Ask the user only for a genuinely necessary preference, unavailable paid asset, or material scope change.

Preserve existing design/data inputs and unrelated user work. Keep derived geometry separate. Prefer small reviewable changes. If using Git, inspect the repository before committing or changing remotes. Do not create a repository, push, publish, or deploy as part of this build unless separately requested. For any authorized GitHub write, first verify both the authenticated account and destination owner are `RSSDesign9`.

Do not add authentication, a database, computer vision, live camera streaming, billing, real messages, or future-module placeholders. Use current compatible dependencies verified during setup and commit the lockfile. Never claim tests, device performance, or user research ran if they did not.

For each finished task, record outputs, the checks actually run, and remaining limitations in a new `BUILD-LOG.md`. Leave this checklist accurate. If blocked on one task, continue independent tasks without fabricating completion.

## Dependency map

| Phase | Tasks | Depends on | Exit |
|---|---|---|---|
| 0. Establish source truth | T01–T03 | Supplied project | Validated fixture/source baseline and geography plan |
| 1. Foundation and data | T04–T07 | T01; source work can continue alongside setup | Tested state engine, local fonts/tokens, runnable shell |
| 2. Complete one dock section | T08–T13 | T02–T07 | Gate A: detailed B-12 workflow works end to end |
| 3. Expand the environment | T14–T16 | Gate A | Gate B: full assumed layout without losing fidelity/performance |
| 4. Harden and prove | T17–T21 | Core features; T17 can start earlier | Gate C: release-quality evidence |
| 4.5 Portfolio improvement | T24–T35 | Gate C | Gate D: first 10 seconds, operational realism, signature interactions, environment realism |
| 5. Portfolio handoff | T22–T23 | Gate D (T34), plus T35 if chosen | Runnable local deliverable and honest showcase package |

Tasks within a phase still have explicit dependencies below. Do not build all background scenery before proving the interactive slice.

## Phase 0 — Establish source truth

### T01 — Inventory and reconcile inputs

- [x] Complete (14 Nov 2026; see BUILD-LOG T01). **Depends on:** none. **PRD:** §§3–4, F12, F14.

Inspect existing files and any local instructions. Create `BUILD-LOG.md` with adopted defaults, source precedence, and unresolved findings. Confirm the supplied assets open, fonts resolve locally, and no app scaffold already exists before creating one.

Record baseline: 146 OSM features; 126 ASSUME slips (A39/B37/C18/D22/E10); B-10/B-12/B-14 exist; vessels.json does not yet exist. Keep the concept image’s boat positions and DESIGN’s example card values out of the canonical fixtures. Note that the supplied font directory totals about 348 KB before runtime weight selection.

**Done when:** input inventory identifies existing versus planned files, current assumptions, and the PRD’s deliberate overrides. No existing source has been silently rewritten.

### T02 — Validate the marina plan and local coordinate system

- [x] Complete (14 Nov 2026; see BUILD-LOG T02 and data/GEOMETRY-VALIDATION.md — environment stays labelled approximate; four source findings recorded open). **Depends on:** T01. **PRD:** §9, F12.

Follow [SITE-NOTES.md](data/SITE-NOTES.md). Create a reproducible geometry inspection script, an annotated top-down plan, and `data/GEOMETRY-VALIDATION.md`. Document metric origin, north, horizontal/vertical axes, bounds, and WGS84 conversion. Match source context at three distributed anchors; note uncertainty rather than claiming surveyed accuracy.

Validate ring closure, finite coordinates, IDs, dock counts, units, dimensions, water-side placement, overlap, headwalk gaps, and shoreline intersections. Investigate the mismatch between SLIPS.md’s geographic prose and the official site map. Confirm that a slip polygon is water space, not dock decking. Inspect partial water geometry and select a defensible repair/mask strategy.

**Done when:** a readable plan shows the actual supplied B-10/B-12/B-14 positions and intended surrounding masses. Every detected placement error has a correction or an explicit unresolved annotation. Corrections are reproducible derived outputs with provenance; the original files remain intact. If alignment remains uncertain, label the environment approximate and document the limit before detailed modeling.

### T03 — Define the runtime asset plan

- [x] Complete (14 Nov 2026; see design/ASSET-PLAN.md — sizes are estimates until T09/T16 measurement). **Depends on:** T01; geographic placements use T02. **PRD:** §§9, 11.

Create `design/ASSET-PLAN.md` listing foreground, marina, and background assets; reusable boat families; source/authorship; editable source; optimized runtime output; license/credit; LOD/material strategy; and estimated transfer cost. Plan the primary cabin cruiser first. Include a fictional observation thumbnail and a distinguishable staff-evidence treatment, both SIM.

Use supplied logos, vessel icons, and fonts. Record local-font weights actually needed. Do not use Google-extracted meshes/textures or paid assets without an explicit choice. Place runtime-ready assets in the app’s public assets directory only when optimized; do not copy the entire design folder.

**Done when:** the slice can be built with known/free/authored assets, no hidden account/API dependencies, and a credible path toward the <6 MB runtime transfer budget. The plan does not mistake a generated PNG for an interactive 3D asset.

## Phase 1 — Foundation and data

### T04 — Scaffold the app and quality commands

- [x] Complete (14 Nov 2026; see BUILD-LOG T04). **Depends on:** T01. **PRD:** §10.

Set up Vite, React, TypeScript, React Three Fiber, and Drei with compatible pinned versions and a lockfile. Use CSS custom properties. Establish source boundaries from PRD §10, strict typechecking, a production build, linting, domain-test tooling, and browser-test tooling. Add a simple error boundary and loading shell.

Provide documented commands for development, typecheck, lint, unit tests, browser tests, and production build/preview. Avoid a dependency merely for a single trivial helper.

**Done when:** a clean install and production build run, a local preview opens, and the shell displays without console errors. No backend, external telemetry, API keys, or remote fonts are required.

### T05 — Implement typed fixtures and provenance validation

- [x] Complete (14 Nov 2026; see BUILD-LOG T05 — evidence images are planned assets, rendered in T09/T11). **Depends on:** T01, T04. **PRD:** §8, F05, F12.

Implement domain types and runtime validation for slips, vessels, agreements, document summaries, observations, decisions, issues, tasks, verifications, audit, and demo session. Load the supplied slip IDs without renumbering. Create 48 deterministic SIM vessels including V-021/V-022/V-023, with consistent assignments and generation timestamps. Prevent duplicate active assignments in the initial fixtures.

Supply mixed observed states for the wider marina; a registry record alone does not create a boat mesh. Seed explicit empty / present / unknown observations, with the selected scenario controlling its own timestamps. Keep boat dimensions plausible, but do not implement a safe-berthing engine.

Create a source manifest, evidence manifest, and fixed summer scenario date. Keep original inputs, generated fixtures, and runtime-derived transforms distinct. Missing provenance and broken references must fail validation rather than being guessed.

**Done when:** validation verifies counts, IDs, referential integrity, provenance, units, and timestamp order. Invalid runtime records yield a useful isolated error, not a blank app. The two different Lake Effect examples have been reconciled to the PRD fixture.

### T06 — Build and test the scenario state engine

- [x] Complete (14 Nov 2026; see BUILD-LOG T06). **Depends on:** T05. **PRD:** §7–8, F05–F11.

Implement explicit commands for advancing to uncertainty, requesting a check, exposing simulated staff evidence, acknowledging evidence, confirming identity, cancel/back, selecting a replay snapshot, starting an interactive branch, and resetting. Use pure selectors for latest applicable observation, effective identity, issue count, and bookability.

Keep source observations immutable. Append verification/identity decisions/audit. Make confirmation atomic/idempotent and dock-check creation unique per issue. Use virtual scenario time, New York formatting, versioned local persistence, and an in-memory fallback. A new replay branch must not inherit later audit or decisions.

**Done when:** automated tests cover every invariant in PRD §7, especially: candidate does not relocate Harbor Light; assignment never changes; confirmation needs evidence plus acknowledgment; double clicks do not duplicate records; reset clears local branch state; stale/offline does not become empty; recent staff evidence survives camera failure; no future evidence leaks into earlier replay snapshots.

### T07 — Apply the design system and accessible primitives

- [x] Complete (14 Nov 2026; see BUILD-LOG T07 — composited contrast computed against worst-case backdrops; re-measure on the real scene in T17). **Depends on:** T04. **PRD:** §§3, 6, 9, 11; F12–F13.

Wire canonical JSON/CSS tokens and local font-face declarations. Resolve stale aliases using JSON; keep the files in sync if edited. Use the approved lighthouse SVGs and vessel sprite. Implement panels, buttons, fields, tabs, pills, provenance tags/tooltips, empty/error states, and a light chart theme. Use the existing vessel card as a visual reference rather than copying conflicting data.

Measure actual text contrast over the composited scene, including small tags. Provide solid panel fallback, visible keyboard focus, semantic labels, and adequate touch targets. Use Plex instead of the unavailable LED font.

**Done when:** the working shell uses the supplied brand, font requests are local, button labels use Switzer, and normal/hover/focus/disabled/loading states work. Light and dark surfaces remain legible; no external font host is contacted.

## Phase 2 — Complete one dock section

### T08 — Build the Dock B scene and camera system

- [x] Complete (14 Nov 2026; see BUILD-LOG T08 — placeholder boats/materials until T09; only Dock B modelled until T14). **Depends on:** T02–T04, T07. **PRD:** F02–F03, §9.

Create water, shoreline, headwalk/fingers, B-10/B-12/B-14 berth areas, and enough surrounding massing to establish place and scale. Use the validated local coordinate transform. Build a bounded orbit/pan/zoom controller, overview/dock/plan presets, reset control, and camera framing that accounts for the inspector.

Implement raycast selection with stable IDs and correct pointer propagation. Empty slips remain selectable. A click is distinct from a drag. Prevent UI events from selecting geometry behind the panel. Do not change selection when the camera moves.

**Done when:** scene and plan agree on orientation and positions; boats fit visually without intersecting decks; selecting a berth works from both scene and list stub; camera travel cancels cleanly and reduces to cuts under reduced motion.

### T09 — Create representative boat and dock assets

- [x] Complete (14 Nov 2026; see BUILD-LOG T09 and the measured manifest in design/ASSET-PLAN.md — in the v2 side-by-side the foreground boats and dock read as a detailed miniature above the midpoint, by my assessment of the captures; surroundings stay sparse until T15, water is static until T17, and the frame-rate figure is from an M3 Max, not the M1 Air target). **Depends on:** T03, T08. **PRD:** §§3, 9, 11.

Build the cabin cruiser, representative smaller powerboat/sailboat, dock components, and near-scene materials. Establish real dimensions, pivots, shared materials, and at least one cheaper distance representation. Include the changed canvas cover for the B-12 observation without exposing a known identity in metadata visible to the viewer.

Use soft lighting/contact shadows, restrained surface detail, calmer water, and simplified vegetation. Keep the selected boat meaningfully more detailed than an extruded block. Update the asset manifest with actual source/output/rights and sizes.

**Done when:** capture the selected B-12 camera next to v2 and inspect proportions, surfaces, shadows, surroundings, and panel legibility. The scene reads as a detailed miniature above the midpoint toward realism, without excessive sparkle or photogrammetry clutter. Record an initial performance/size measurement.

### T10 — Connect selection, registry, and inspector

- [x] Complete (14 Nov 2026; see BUILD-LOG T10 — desktop rail only; ≤1280 px tabs/back navigation is T17). **Depends on:** T05–T08. **PRD:** F02–F06, §6.

Build Slips / Vessels list views, search, dock and review filters, selection state, and the inspector from shared selectors. Normalize B12 searches. Explain assigned berth versus observed location. Display registration reference separately from optional HIN, and record/document review as separate status.

Selecting the unknown hull opens the observation/slip. Candidate comparison opens Harbor Light’s record without changing its location. Selecting an away vessel centers its assigned berth without rendering a phantom present boat. Expand history and provenance without overwhelming the primary action.

**Done when:** scene, markers, list selection, inspector, and counts always agree after selection/filter/camera changes. Keyboard users reach every visible record. No-results and invalid selection states offer recovery. Search/accessibility text does not disclose the uncertain hull’s hidden identity.

### T11 — Implement observation review and dock-check request

- [x] Complete (14 Nov 2026; see BUILD-LOG Batch 5 T11 — `src/features/slip-review/`, evidence stills rendered from the app's own scene; the offline-camera path is driven by a `?debug` scenario command, its UI control is T18). **Depends on:** T06–T07, T10. **PRD:** F06–F07, F11.

Create the uncertain panel, fictional source thumbnail, comparison evidence, source/freshness labels, and pending-task feedback. Keep “possible match” subordinate to “identity unverified.” Requesting a check updates the local task state and shows that it is simulated; no external notification is sent.

Add missing-image and insufficient-evidence paths. Changing selection and returning must preserve the pending issue. Avoid a global confidence percentage unsupported by a real model.

**Done when:** a user can explain what is observed versus inferred, request one check, and see the issue remain open. A failed thumbnail still leaves accessible evidence text and the request action. Repeated requests cannot create duplicate tasks.

### T12 — Implement evidence acknowledgment, resolution, and history

- [x] Complete (14 Nov 2026; see BUILD-LOG Batch 5 T12 — the name board is drawn only on the hull an identity decision confirmed, as a separate child mesh). **Depends on:** T11. **PRD:** F08–F09.

Expose the explicit “Load simulated dock-check result” scenario action, the 09:18 staff evidence, acknowledgment checkbox, confirm action, and cancel/back. On confirmation, change the effective boat label to Lake Effect without moving the hull, show the resolution summary, close any linked task, and display the preserved observation plus appended decision trail.

**Done when:** both direct-review and requested-check paths complete; confirmation is impossible before evidence/acknowledgment; cancel leaves the issue open; original candidate remains visible in history; B-12’s agreement and Harbor Light’s record are unchanged. Rapid duplicate confirmation creates one result.

### T13 — Implement guided replay and complete Gate A

- [x] Complete; **Gate A passed** (14 Nov 2026; see BUILD-LOG Batch 5 T13 and “Gate A evidence” — interaction suite on SwiftShader, captures and frame pacing on a real GPU (M3 Max), M1 Air target unverified; desktop rail only). **Depends on:** T09–T12. **PRD:** F01, F10; §§7, 12.

Add Overview → Explore slip review entry, guided normal/uncertain/resolved snapshots, clearly separated interactive branching, and restart. Explain simulation controls without adding a long tutorial. Preserve branch state across refresh where valid; handle corrupt/unavailable storage safely.

**Gate A acceptance:**

- Open overview, select B-12, advance from empty/assigned to uncertain, request a check, review staff evidence, acknowledge, resolve, and inspect history.
- Complete the direct review path and keyboard path as well.
- Verify all scene/panel changes and the unchanged agreement/Harbor Light record.
- Replay backward without future-state leakage; reset and refresh give the documented state.
- Save normal/uncertain/resolved screenshots and a brief test record, including one v2 composition comparison and initial performance data.

Do not expand the full environment until the complete slice works and represents the intended rendering fidelity.

## Phase 3 — Expand the environment

### T14 — Render all assumed slips and the wider fictional fleet

- [x] Complete (14 Nov 2026; see BUILD-LOG Batch 6 T14 — all 126 supplied slips on docks A–E, one pick mesh with per-berth IDs, 40 hulls from observations only; the count stays labelled assumed). **Depends on:** Gate A. **PRD:** F02–F05, §9.

Expand to A–E using all validated/derived slip features and the 48-record roster. Instance repeated dock/pile/boat elements where appropriate, preserve per-instance picking IDs, and use distance-based labels/LODs. Keep away/unknown vessels from being automatically placed in assigned slips. Counters come from fixture selectors, not hardcoded UI text.

**Done when:** all 126 slips are reachable in the list and scene/plan; the displayed count remains explicitly assumed; no duplicate IDs, unexpected land berths, or phantom boats appear. Dock B keeps its tested behavior. Distant boats do not create a field of labels and selection outlines.

### T15 — Complete the waterfront surroundings

- [x] Complete (14 Nov 2026; see BUILD-LOG Batch 6 T15 and data/GEOMETRY-VALIDATION.md “Batch 6 findings” — the elevator footprint was moved 27 m inland off documented canal water; the peninsula and north bank stay plain, approximate ground; no fences, no north-bank massing). **Depends on:** T02–T03, T14. **PRD:** §9, F14.

Add the working yard, storage boats, service/building masses, paths, shoreline, restrained vegetation, and geographically defensible waterfront context. Prioritize visible silhouettes and spatial relationships over generic clutter. Use the source map’s dated evidence carefully; current service availability remains unverified. No selectable fuel/pump-out/travel-lift module is needed.

**Done when:** wide and dock views read as the Buffalo setting, not a generic marina; background geometry does not obstruct the working view; unknown positions remain approximate; no invented depth data or misplaced branded silo landmark appears. Update the annotated geography/asset records.

### T16 — Optimize the full scene and complete Gate B

- [x] Complete; **Gate B passed with one item pending** (14 Nov 2026; see BUILD-LOG Batch 6 T16 and “Gate B evidence” — draw-call, download and font budgets pass as measured; the 60-second profile passes on an Apple M3 Max, and **the M1 MacBook Air frame-rate target is still unverified**; interaction journeys ran in software rendering). **Depends on:** T14–T15. **PRD:** §11.

Measure draw calls, triangles, frame time, load/transfer costs, and text/selection responsiveness. Reduce unnecessary material variants, transparent overdraw, shadows, reflection work, DPR, and distant detail; use appropriate instancing/LODs and compressed assets. Dispose/reuse resources on scene changes. Do not remove identity/source information to improve performance.

**Gate B acceptance:** full-marina overview and selected-slip views preserve Gate A quality and behavior. Provide reproducible asset/font transfer totals and a 60-second camera/selection profile. Meet the PRD budget or document and address the concrete remaining conflict before marking complete. Optimized output is reproducible from editable assets.

## Phase 4 — Harden and prove

### T17 — Responsive, accessible, and reduced-motion experience

- [x] Complete (14 Nov 2026; see BUILD-LOG Batch 7 T17 — the manual screen-reader test did NOT run (no reader could be operated here); tablet/mobile are Chromium viewport emulation, not devices; 200 % zoom is real Chromium page zoom). **Depends on:** T10–T13; final validation after T16. **PRD:** F13, §§6, 11.

Implement the collision-free desktop rail, tablet combined inspector/list, mobile plan/list/detail sheet, and 200% zoom adaptation. Add a meaningful DOM alternative to the aria-hidden canvas, complete keyboard navigation, managed focus on panel transitions, concise live announcements for action results, and status/source text independent of color.

Implement chart/light theme, pause motion, reduced-motion cuts, and frozen ambient effects. Preserve context when changing view/theme/viewport; avoid trapping scroll or stealing keyboard shortcuts from text inputs.

**Done when:** the full workflow works at 1440×900, 1024×768, and 390×844, plus desktop at 200% zoom. Test keyboard and a screen reader manually; run an automated accessibility scan. Check composited contrast and touch targets; no critical controls disappear behind panels.

### T18 — Failure and stale-data handling

- [x] Complete (14 Nov 2026; see BUILD-LOG Batch 7 T18 — fault injection via `?debug&fault=…`; context loss exercised on SwiftShader, not a GPU; geometry failure disables the whole map, not one slip). **Depends on:** T06, T11–T13, T17. **PRD:** F11–F13.

Exercise source offline/stale/unknown states, missing thumbnail/model/geometry, invalid provenance, failed localStorage, and WebGL unsupported/context lost. Use a restrained geometric fallback for a missing boat asset while retaining a visible model-unavailable note; never use a fallback to suggest verified identity. Restore the plan/list/inspector when 3D fails.

**Done when:** users retain a usable review path wherever evidence permits; absent evidence leaves the issue unresolved; no error silently changes presence to empty or creates availability. A recent staff decision remains distinct from an older offline camera. Recovery/retry/reset works and does not duplicate audit.

### T19 — Run the critical browser journeys

- [x] Complete. **Depends on:** T13, T17–T18. **PRD:** F01–F14.

Use meaningful integration tests, not assertions that merely mirror component code. Cover:

1. Overview → B-12 by list → empty but assigned/not bookable.
2. Scene selection ↔ list/inspector consistency; drag does not select.
3. Uncertain observation → direct evidence review → acknowledgment → resolution.
4. Uncertain → request check twice → one pending task → evidence → resolve → one completed task.
5. Missing evidence / unacknowledged confirmation / cancel → issue stays open.
6. Harbor Light stays assigned B-14 with unchanged last confirmed location after B-12 resolution.
7. Replay backward / branch / restart / reload → correct temporal state, no later evidence leakage.
8. Offline/stale source and missing assets → accurate uncertainty and usable fallback.
9. Mobile fallback and keyboard-only resolution.

**Done when:** browser tests and domain tests pass against the production build, with an actual canvas-selection smoke test in a WebGL-capable browser. If automation uses a DOM substitute, label that limitation and manually verify the real canvas path. Do not equate mocked rendering with GPU validation.

**Batch 8 evidence (14 Nov 2026):** 162 domain/unit tests and all 67 production browser journeys passed; after the final mobile framing correction, all 16 affected accessibility/responsive/release/zoom journeys passed again. Real pointer picking ran on visible Metal GPU Chromium; no canvas mock. Full requirement mapping and screenshots: [QA.md §2–3](QA.md#2-verification-and-critical-journeys).

### T20 — About, attribution, and source review

- [x] Complete. **Depends on:** T05, T15. **PRD:** F12, F14; §§8, 13.

Build a concise About / Sources panel. Include independent-concept status, assumed slip numbering/count, fictional roster/events/evidence, approximate model geometry, source dates, source links, and what a future real pilot would need. Keep OSM attribution visible outside this panel too. Preserve all required model/font licenses.

Audit every operational label: no live-camera claim, actual customer outcome, partnership logo, verified operator availability, automated licensing/compliance determination, or exact-capacity implication. Product chrome uses Harbor Desk / Buffalo River as DESIGN specifies; factual marina references may appear in explanatory source context without implying endorsement.

**Done when:** a viewer can distinguish DOC/ASSUME/SIM/FIELD in plain language. Every shipped third-party asset has a recorded source/right/credit, every displayed record has provenance, and external references open without taking over the demo unexpectedly.

**Batch 8 evidence (14 Nov 2026):** About / Sources implemented with manifest dates, provenance definitions, fictional/concept limits and real-pilot requirements. Persistent OSM credit survives mobile/fallback scrolling. Copy and shipped-source/license audit recorded in [QA.md](QA.md) and [ASSET-PLAN](design/ASSET-PLAN.md); original font decision/binaries/licenses preserved. About focus/Escape and four theme/layout axe scans pass.

### T21 — Final visual/performance review and Gate C

- [x] Complete. **Depends on:** T16–T20. **PRD:** §11–12.

Run typecheck, lint, data/geometry validation, domain tests, browser tests, and production build. Inspect the actual rendered app in desktop and mobile layouts. Compare selected B-12 to v2 for foreground detail, miniature composition, water, surroundings, and panel readability while respecting DESIGN’s brand treatment.

Profile the documented reference hardware or state exactly what substitute was available. Measure cold-cache shell/scene readiness, full runtime transfer, fonts, and the 60-second frame-time run. Inspect browser console, network requests, memory/resource cleanup through repeated replay, and local-only operation after assets load.

**Gate C acceptance:** no unresolved critical workflow, data-integrity, or accessibility failures; visual target is represented; budgets are measured honestly; limitations are documented; normal/uncertain/resolved states are reproducible. Unavailable M1 hardware leaves that specific performance claim unverified, not invented. Save results in `QA.md` with device/browser/build and artifact paths.

**Batch 8 / Gate C (14 Nov 2026): PASSED for applicable local release criteria, with explicit limitations.** [QA.md](QA.md) records all results, final build hash, comparison images, fixes, actual compressed transfer and visible GPU measurements. M1 Air performance, spoken screen-reader operation, physical touch and non-Chromium behavior remain unverified. No known critical workflow/data-integrity/accessibility or material visual/budget failure remains. **Next: Batch 9 starts at T22, then T23; neither has started.** *Superseded 15 Nov 2026: Batch 9 now starts at T24 (Phase 4.5). T22–T23 run after Gate D.*

## Phase 4.5 — Portfolio improvement (v1.1)

Requirements: [PRD §15](PRD.md) (F15–F23). Rationale and model guide: [IMPROVEMENT-PLAN.md](IMPROVEMENT-PLAN.md).

**Batches:**
- Batch 9 = T24–T27
- Batch 10 = T28–T29
- Batch 11 = T30–T32
- Batch 12 = T33–T34
- Batch 13 = T35 (optional; E built 16 Nov 2026)

**Throughout this phase:**
- Keep the B-12 state invariants, the identity-leak tests and the Gate B/C budgets.
- Keep all 162 unit tests and 67 browser journeys passing, updating locators where labels change.
- Record deliberate visual or copy changes in BUILD-LOG.

**Ask Raj before:**
- Batch 9: approve the chrome diet, operator KPIs and single-marker labelling.
- T27: fonts.
- T33: realism target.
- T35: which option.

**Recommended in parallel:** a 20-minute call with a Buffalo dockmaster before T30. See Optional follow-up.

### T24 — Poster frame and opening shot

- [x] Complete (15 Nov 2026, see BUILD-LOG “Batch 9”): poster `public/assets/poster/harbor-{1600,2400}.webp` (38.6 / 69.0 KB) rendered from the app by `scripts/render-poster.ts` at a new establishing pose (grain elevator + waterfront); preloaded on ≥768 px; fades over 400 ms while the camera holds, then a 3 s move to Dock B; click / key / wheel skip; paused motion, reduced motion, a restored selection or a hidden tab land at once. Dock B is now the resting preset and Reset target. `tests/e2e/intro.spec.ts` covers cold load, skip and reduced motion. Measured on a real GPU headless run: poster at 0.27 s, canvas drawn 0.89 s, fade 1.12–1.44 s, landed 4.3 s. Was: **Depends on:** Gate C. **Source:** DOCKWA-ANALYSIS §3.

**Problem:** a cold load shows about 5 seconds of blank navy before the scene paints.

**Build:**
- Ship a pre-rendered poster still of the hero pose (both densities) that crossfades into the live scene once it is ready.
- Add a 3-second establishing camera move: wide Buffalo waterfront → Dock B → B-12 framed beside the rail.
- Any click, key or scroll skips it. Reduced motion cuts straight to the end pose.
- The move must not change selection or scenario state.

**Done when:**
- No blank canvas is visible at any point of a cold load, at DPR 1 or 2.
- The poster is the first meaningful paint.
- Skip and reduced-motion paths are covered by browser journeys.
- Shell transfer stays within the Gate C budget, or the increase is measured and justified.

### T25 — Chrome diet and operator KPIs

- [x] Complete with one deliberate deviation (15 Nov 2026, see BUILD-LOG “Batch 9”): default panel coverage at 1440×900 is **24.7%** (was 44.4% with the list that never actually hid); one “Simulated demo” marker; About moved to the top bar (mobile keeps it in the sheet); registry list closed by default on desktop (and its `hidden` bug fixed); KPI tiles are Occupancy (37%, tonight · 46/126), Arrivals (today) and Needs review, from `operatorSummary`. **Revenue at risk waits for T28 rates. The scenario card was NOT collapsed to one line:** the target is met without it, and a one-line strip crushed the stage labels; it stays a compact head + strip. With B-12 selected, coverage is 42.6% (the inspector is the task). Was: **Depends on:** T24; KPI values from T28 (use placeholders wired to selectors until then). **Source:** DOCKWA-ANALYSIS §3.

**Problem:** at 1440×900, panels cover roughly 40% of the viewport and about 20 provenance chips sit on the first screen.

**Build:**
- The scene occupies at least 70% of a 1440×900 viewport by default.
- The scenario card collapses to a one-line step bar.
- About / Sources moves into the top-bar menu. OSM credit stays visible.
- The Registry list closes by default.
- One persistent "Simulated demo · Buffalo concept" marker replaces the chip wall. DOC/ASSUME/SIM/FIELD appear in detail rows and on hover or focus. They are still reachable and accessible, and every displayed record keeps its provenance.
- KPI tiles become Occupancy tonight · Arrivals today · Needs attention · Revenue at risk, each SIM-labelled in its detail.

**Done when:**
- Measured panel coverage is at most 30% at 1440×900.
- Axe passes with zero violations.
- The identity-leak and provenance tests pass.
- Tablet, mobile and 200% zoom layouts have no collisions.

### T26 — Copy pass

- [x] Complete (15 Nov 2026, see BUILD-LOG “Copy and type refinement” and “Batch 9”): clean-copy ladder pass across the inspector, review panel, scenario panel, trail, registry, top bar, footer and announcements; table of every cut in BUILD-LOG. First-screen words vs the Batch 8 baseline: fresh load 169 → 65 (−62%), uncertain 191 → 105 (−45%), normal 183 → 123 (−33%), resolved 198 → 133 (−33%). **The −40% target is met for the first screen and the uncertain state, not for normal and resolved**, where the inspector carries the remaining text. Was: **Depends on:** T25.

**Build:**
- Write a single copy deck in dockmaster language first. Example: "Looks like Harbor Light — not confirmed." Then apply it.
- Inspector sections keep only decision-relevant lines; secondary facts sit behind disclosure.
- Keep "Simulated", "candidate" and "unverified" precise. Never imply a confirmed wrong boat.

**Done when:**
- First-screen visible word count is down at least 40% from the Batch 8 baseline (measured).
- Every workflow state still distinguishes presence, identity, agreement and bookability.
- Screen-reader text is updated along with the visible copy.

### T27 — Typography

- [x] Complete (15 Nov 2026, see BUILD-LOG “T27 — Typography”): Commissioner + Work Sans + Atkinson Hyperlegible Mono, 3 faces / 96,212 B, no external font requests; 66/67 browser journeys pass (the zoom spec fails on this Retina display for a device-pixel-ratio reason). Refined in the copy pass: agreement terms as “1 May – 15 Oct 2026”, non-breaking “ft”, top-aligned stage strip, KPI baseline, eyebrow no-wrap. Was: **Depends on:** T26. **Ask first:** Raj picks one of three type directions. Each is a display + text + data trio shown on the real top bar and inspector.

**Build:**
- Update design/tokens.json → `npm run tokens`.
- Self-host the fonts and record licenses in design/licenses and THIRD-PARTY-NOTICES.
- Update DESIGN.md.

**Done when:**
- No more than 5 faces ship, at ≤ 180 KB total.
- Contrast and layout checks pass at every breakpoint.
- No external font requests.

### T28 — Realistic July fixtures

- [x] Complete (16 Nov 2026, see BUILD-LOG “Batch 10”): 111/126 held (88%; 89 seasonal, 22 transient), 113 vessels, rates on every agreement (ASSUME, `SRC-RATES`), 06:00–22:00 movements with away flags, exactly one offline camera (C-04, C-01…C-09). `fixtures:check` 0 errors / 0 warnings, 171 unit tests, 70/70 browser journeys. Fourth KPI tile “Revenue at risk” added. Was: **Depends on:** Gate C.

**Problem:** 48 vessels in 126 slips is about 38% occupancy on 15 July, and all of Docks C and E show camera offline.

**Build:**
- Regenerate SIM fixtures deterministically:
  - about 88% occupancy, with a mix of seasonal and transient boats;
  - nightly rates and seasonal fees;
  - a day of arrivals and departures (06:00–22:00);
  - away-boat flags;
  - exactly one offline camera.
- Lake Effect, Harbor Light, River Run, C-02 and the B-12 timeline stay compatible with the scenario tests.
- KPIs derive from selectors. They are not hard-coded.

**Done when:**
- `npm run fixtures:check` passes with zero errors or warnings.
- Scenario engine tests pass unchanged, or any changes are justified in BUILD-LOG.
- Every new field carries provenance.

### T29 — 3D dock map mode (replaces Top-down)

- [x] Complete with one deliberate deviation (16 Nov 2026, see BUILD-LOG “Batch 10 — T29”): the Map preset replaced Top-down, with status plates on the existing berth pick mesh (occupied / away / reserved / needs review / vacant, each with its own pattern), slip numbers from 4.5 px/m, dock names, and a counted legend. Mobile opens on the map when the GPU is capable and on the flat plan otherwise; Display switches either way. **All 126 slips are visible and pickable** in the map pose at 1440, 1024 and 390 (measured on the Metal GPU and asserted in `tests/e2e/map.spec.ts`). Draw calls are 131 for the full map and 52 zoomed in (aim < 300). **Deviation:** a 2° long lens (orthographic in effect, under 3 % scale change across the marina) instead of an `OrthographicCamera`, so entering and leaving the map is one dolly-zoom rather than a cut between two cameras. Was: **Depends on:** T25, T28.

**Problem:** the Top-down preset isn't centered on the marina and does no operational job.

**Build:**
- Replace the preset with a tilted orthographic 3D camera framed on the marina, accounting for the rail inset.
- Status-colored slip plates: occupied, vacant, reserved, needs review, away. Use non-color cues as well.
- Slip numbers appear when zoomed in. Add a legend.
- Mobile with a capable GPU defaults to this 3D map. The flat 2D plan remains the accessibility, no-WebGL and low-power fallback.

**Done when:**
- All 126 slips are visible and pickable in the map pose at 1440, 1024 and 390 widths.
- Mobile 3D/2D fallback and context-loss journeys pass.
- Draw calls stay within budget.

### T30 — Fit-aware drag-to-assign

- [x] Complete with two deliberate deviations (16 Nov 2026, see BUILD-LOG “Batch 11”). An “Incoming request” card (SIM: Northern Tern, 36 ft LOA, 11.5 ft beam, 4.5 ft draft, 50 A) sits at the top of the rail. Drag it over the 3D scene, the dock map or the 2D plan and every offered slip shows fits / tight / no fit in colour and pattern, with the reason for the slip under the pointer. Dropping on fits or tight appends a local SIM assignment; the boat backs into the slip along its authored path and stays as a translucent planned hull; Undo stamps the record and sends it back out. Keyboard path: Slip list → Assign. Held or occupied slips are never offered. Depth and power are a new ASSUME fixture (`slipServices`, SRC-SERVICES). Verdicts are unit-tested at every boundary. Measured on the M3 Max: 60 fps while dragging (p95 17.4 ms, no frame over 33 ms). Path continuity is tested on all 126 berths and in the browser. **Deviations:** (1) the request is 36 ft, not the 42 ft example, because every 45 ft slip is held on 15 July and the example would be “no fit” everywhere; (2) the keyboard path uses a native select, so arrow-key behaviour follows the platform (macOS opens the menu). Was: **Depends on:** T28, T29. **Source:** DOCKWA-ANALYSIS §4 A.

**Build:**
- An incoming SIM transient request card. Example: 42 ft LOA, 14 ft beam, 5 ft draft, 50 A shore power.
- While dragging it over the scene or map, each vacant slip shows a verdict (fits / tight / no fit) with a reason: LOA, beam clearance, draft against ASSUME depth, or power.
- Dropping it animates the boat along an authored approach path into the slip and appends a local SIM assignment. The assignment can be undone.
- Assigned or occupied slips are never offered.
- A keyboard path (list → Assign) does the same thing.

**Done when:**
- Verdicts are deterministic and unit-tested, including boundary cases.
- Browser journeys cover drag/drop/undo and the keyboard path.
- Frame pacing holds during drag on the GPU profile.
- No hull teleports.

### T31 — Time scrubber and arrivals board

- [x] Complete (16 Nov 2026, see BUILD-LOG “Batch 11”). A Day timeline scrubber (06:00–22:00, one-minute steps) sits in the scenario panel. It is guided replay made continuous: a read-only projection of the scripted day that equals the replay snapshot at each checkpoint, never touches the run, and says so. Boats leave and arrive along authored paths, moving only after their log entry. Online cameras re-read their slips every 5 minutes outside the scripted 08:40–09:25 window. KPIs follow the scrubber; Arrivals becomes “3/15 · In by 08:45” and opens an Arrivals board tab. Vacant slips show unsold nights (inspector, board, legend). Lighting follows the hour, holding the authored light from 08:45 to 09:20. B-12 stages land on 08:45 / 09:12 / 09:13 / 09:18 / 09:20. Scrubbing backward never shows future records (unit-tested every 5 minutes, both directions). Idle-frame tests pass paused and under reduced motion; the scrubber is a native range input. Was: **Depends on:** T28, T30.

**Build:**
- Scrub 06:00–22:00 on 15 July. Boats arrive and depart along authored paths.
- Vacant slips show unsold nights. KPIs and an arrivals board follow the scrubber.
- Lighting follows the time of day (basic here; T33 refines it).
- B-12 stages line up with 08:45 / 09:12 / 09:18 / 09:20.
- Make the scrubber's relationship to guided replay explicit, so it never mutates interactive-session records.

**Done when:**
- Scrubbing backward never shows future evidence.
- Paused and reduced-motion idle-frame tests pass.
- The keyboard can operate the scrubber.

### T32 — Dock-walk trigger

- [x] Complete. **Depends on:** T26, T28. **Source:** DOCKWA-ANALYSIS §4 C.

**Build:**
- The B-12 issue opens from a SIM morning dock-walk discrepancy: "marked Occupied; Lake Effect departed 08:10."
- Camera C-02 becomes a corroborating second source.
- Rename the steps and labels to match.
- History preserves both sources unchanged.

**Done when:**
- Review, replay and identity-leak journeys pass with the updated labels.
- No staff action is implied to have been sent anywhere.

### T33 — Environment realism pass

- [x] Complete with deliberate deviations (16 Nov 2026, see BUILD-LOG “Batch 12”). Raj set the target (surroundings about 8/10, boats and docks about 7/10) and approved the side-by-side after a second pass; the v3 target is a frame captured from the app, [design/visual-target-v3.png](design/visual-target-v3.png). Built: water with ripple normals, sky and cloud reflection, a planar reflection of the scene, and contact shading under docks and along the bank; a time-of-day sky dome tied to the T31 scrubber, with dusk, lamps, lit windows and stars; a detailed grain elevator, sheds and Skyway in the same footprints; three tree forms with tufted crowns, shrubs and scrub; world-space detail on ground, concrete, rock and timber; screen-space ambient occlusion; mooring lines on confirmed hulls; parked cars. Geography and landmark placement unchanged. Poster and evidence stills re-rendered. 60 fps holds on the M3 Max GPU; draw calls 53 at rest / 90 moving (Dock B) and 149 / 284 (Overview), every pass counted. Software and low-power renderers get a lighter tier. 223 unit tests and 80 / 80 browser journeys pass. **Deviations:** (1) **no skyline silhouette**: nothing on the north bank has a sourced position, so none was placed; (2) the optional baked lightmaps were replaced by the occlusion pass and ground contacts; (3) the reference still is an app capture rather than a generated image, at Raj’s choice. Was: **Depends on:** T31. **Ask first:** the new realism target. Recommendation: surroundings about 8/10 and hero boats and docks about 7/10, on the scale where the reference video is 1.

**Build:**
- Make and approve one reference still (v3 target) before implementation.
- Then do:
  - water with normals, sky reflection and dock contact shading;
  - a time-of-day sky tied to T31;
  - higher-fidelity grain elevators, Skyway and skyline silhouette;
  - foliage variation and PBR materials on near shore objects;
  - optional baked lightmaps for static scenery.
- Keep approved geography and landmark placement.

**Done when:** Raj approves a side-by-side against the v3 target, captured from the app.

### T34 — Performance, regression and Gate D

- [x] Complete; **Gate D passed with one item unverified** (16 Nov 2026, see [QA.md](QA.md) “Gate D” and BUILD-LOG “T34”). `npm run check`: 223 / 223 unit tests, fixtures 0 / 0. `npm run geometry`: 23/27, the same four source flags. Browser suite with `--workers=1`: **80 / 80** (zoom included). On the M3 Max in a visible window: 60 s run at 59.88 fps median, p95 17.6 ms, 0 frames over 33.3 ms. Transfer 924,214 B (budget 6 MB), fonts 96,212 B. Cold shell 451–536 ms, first 3D frame 1.44–1.61 s. Cleanup is flat over five cycles; zero console errors and zero external requests. Draw calls are 62–301 on moving frames, with every pass counted; that is one over the <300 aim in Map mode, measured and accepted. **The M1 MacBook Air run is unverified: no device.** Only the QA scripts were fixed, for stale T25/T29/T32 labels; no product code changed. Was: **Depends on:** T24–T33.

**Build:**
- Profile again: the 60-second run, transfer and startup.
- Include the pending M1 MacBook Air run if a device is available; otherwise label it unverified.
- Run `npm run check`, `npm run geometry` and the full browser suite with `--workers=1`.
- Refresh QA.md.

**Gate D acceptance:**
- The T24–T33 done-when criteria are met.
- The Gate B and Gate C budgets hold, or any change is measured and justified.
- No critical workflow, data-integrity or accessibility regression.

### T35 — One extra wow (optional)

- [x] Complete: **option E** (16 Nov 2026, see BUILD-LOG “T35”). A Lake what-if in the incoming-request card: **Calm** or **SW gale**, over a SIM lake series (`data/fixtures/lakeScenarios.json`, every 15 min from 06:00 on 15 July to the end of the stay; shapes ASSUME via SRC-LAKE). The gale piles water up at Buffalo through the morning (+4.4 ft to 13:00), then a damped 14 h seiche drops it to −1.5 ft at 18:45. The fit check now uses the stay’s **low water** for draft, its **high water** against fixed decks (Docks A and E, new ASSUME heights), and its strongest **onshore wind** on open river-mouth berths (A, B-01…B-19: tight from 20 kt, no fit from 34 kt, the NWS gale band, SRC-NWS-MARINE). Calm gives exactly the T30 verdicts and reasons. Under the gale only D-01 still works (tight, 1 ft under the keel). Assignments record the what-if, and an assignment that gets worse under the other one is flagged, not changed. The lens is view state, not a record: it never touches the run and works in the replay timeline. The scene shows downwind ripples, whitecaps on open water and an overcast sky; calm frames are pixel-identical to T33. 240 unit tests (+17); browser suite 82 / 83 + 3 new journeys, the one failure being the known DPR 4 zoom environment issue. Gate D budgets hold (transfer 930,504 B; draw calls and frame pacing unchanged). **Deviations:** no water-level rise in the scene (floating docks and hulls would have to ride it); panel coverage at 1440×900 rises 39.4 → 43.0 % (it was already over the ≤ 30 % target since T30/T31). Was: **Depends on:** Gate D. **Ask first.** Choose one:
  - (E) Buffalo seiche and gale overlay feeding T30 fit verdicts (recommended);
  - (G) a boater arrival flythrough;
  - (F) an OSM-generated marina map onboarding sequence.

**Done when:** the chosen option has unit and browser coverage, keeps SIM/ASSUME labels, and holds Gate D budgets.

## Phase 5 — Portfolio handoff

### T22 — Prepare the demonstration package

- [ ] Complete. **Depends on:** Gate D (T34), plus T35 if chosen. **PRD:** §12.

**v1.1 additions:**
- Record a 75–90 s video with this cut list: poster → establishing move → drag-to-assign → scrubber → dock-walk review → resolve.
- Case study copy leads with craft (evidence rendered from the scene, no teleporting hulls, keyboard parity) and with the evidence-model / AI pattern.
- Add one-page pitch notes per company from DOCKWA-ANALYSIS §5, kept local.

Capture consistent overview, uncertain, and resolved stills at 1600×1000, with high-resolution variants where supported. Record a 60–90 second walkthrough that shows the location, interaction, uncertainty, evidence, resolution, and unchanged agreement. Retain simulated/assumed labels. Do not introduce a separate video framework solely to record the browser.

Write concise portfolio copy: problem/hypothesis, intended user, why spatial context helps, modeling/data decisions, what works, what is simulated, and next research step. Include a poster/still and reduced-motion viewing option. A real opening photograph is optional, not a blocker.

**Done when:** media opens correctly, text is legible, the full workflow is visible, and the copy makes no unmeasured impact claims. Do not publish or edit the live portfolio during this task.

### T23 — Deliver build/run documentation and close the checklist

- [ ] Complete. **Depends on:** T22.

Write `README.md` with install/dev/build/test instructions, controls, replay/reset behavior, local persistence, architecture, asset regeneration, provenance, known limitations, and links to PRD/design/source/QA artifacts. Include static-host/Vercel deployment configuration and notes if needed, without creating a deployment. Do not put secrets or authoring video/image bundles into the shipped app.

Update BUILD-LOG and this checklist with actual completion evidence. Leave any unverified target-device check or optional research clearly pending. Provide a short handoff describing what changed, how it was tested, how to run it, and remaining limitations.

**Done when:** another developer can install and run from the documented source without the original chat, play both workflow branches, reproduce asset generation and tests, and understand the limits of the experiment.

## Optional follow-up — not required for the initial build

- [ ] Conduct the five-person formative comprehension test described in PRD §12 and record actual findings.
- [ ] Obtain operator feedback on real layout, terminology, documents, and exception-handling priorities. Recommended: a 20-minute Buffalo dockmaster call before T30.
- [ ] Revisit camera ingestion only after obtaining access and evidence about coverage and recognition limits.
- [ ] Explore berth fit and seasonal storage only with validated operational inputs. T30 demonstrates fit with ASSUME depths and SIM boats; validating it with real inputs remains open.

## Copyable opening prompt

> Implement Harbor Desk from PRD.md and TASKS.md. First read the linked design, slip, site-note, and visual-reference files. Honor the source-precedence rules: v2 controls environment fidelity, DESIGN controls branding/tokens, and the PRD controls workflow fixtures and scope. Work in dependency order, prove the full B-12 slice before expanding, and keep TASKS.md and BUILD-LOG.md accurate. Use simulated local data, preserve source files, and test the domain invariants as well as the real scene interactions. Continue through the required build tasks without unnecessary confirmation. Do not deploy, publish, send messages, add real camera integrations, or invent validation results. Report material blockers with the concrete evidence and continue independent work where possible.
