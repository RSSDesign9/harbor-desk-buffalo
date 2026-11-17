# Harbor Desk — Product Requirements

Version 1.1 · 15 November 2026 · Implementation handoff

**v1.1 amendment (15 Nov 2026, approved by Raj):** §15 adds simulated operational depth and first-impression work (TASKS Phase 4.5, T24–T35). Where §15 conflicts with earlier sections, §15 wins, and each conflicting sentence below is marked *(amended by §15)*. The v1.0 workflow, state invariants and provenance model are unchanged unless §15 says otherwise.

## 1. Product decision

Harbor Desk is an independent, browser-based portfolio experiment: a recognizable Buffalo waterfront rendered as a detailed miniature, connected to a usable vessel registry and one complete marina operations workflow.

The central question is: **“Does the vessel observed in this slip match the vessel assigned to it, and what evidence is needed to resolve uncertainty?”** The 3D view explains where the issue is. The inspector explains what is known, what is uncertain, and what the operator can do next.

This release demonstrates product judgment, spatial interaction design, rendering craft, and a credible information model. It does not claim an operator deployment, customer validation, live monitoring, or measured business benefit.

The user has approved the slip-mismatch concept, visual target v2, and writing this PRD and task list. Implementation has not started. Technical choices and quantitative targets below are implementation defaults, not claims of validated feasibility.

## 2. Audience and outcome

| Audience | Need | Design consequence |
|---|---|---|
| Primary operational persona: marina manager / dockmaster | Compare assignment records with physical observations and resolve exceptions | Observation, registry, verification, and history remain distinct |
| Supporting persona: dock staff | Receive a clear dock-check request and record identity evidence | One local simulated task with a concrete slip and reason |
| Secondary operational audience: owner / oversight stakeholder | Understand records and why an issue was closed | Readable history and explicit source provenance; no separate dashboard in v1 |
| Primary portfolio audience: hiring team | Understand the project quickly, then inspect depth | Immediate interactive scene, visible scenario entry point, 60–90 second guided workflow |
| v1.1 portfolio audience: 3D-prototyping hiring teams broadly; marina-software teams (Dockwa first) as one target | See distinctive 3D craft within 10 seconds; see operator understanding within 90 seconds | §15: poster and opening shot, chrome diet, operator KPIs, 3D dock map, fit-aware assignment, time scrubber |

These are proposed personas, not interview findings. Dale’s Marine Service and ECHDC are intended research audiences from the original brief, not partners or users of this prototype.

Success hypothesis: a viewer can explain why an empty assigned slip is not available, why an uncertain observation is not a confirmed identity, and how staff evidence resolves the discrepancy without changing the berth agreement.

## 3. Source precedence and reconciliation

Read this document with [TASKS.md](TASKS.md), [DESIGN.md](DESIGN.md), [data/SLIPS.md](data/SLIPS.md), and [PRODUCT.md](PRODUCT.md).

| Topic | Authority for this release | Reconciliation |
|---|---|---|
| Product scope and workflow | Latest user approval, then this PRD | Supersedes stale “awaiting approval” notes in earlier artifacts |
| v1.1 scope | §15, then [TASKS.md](TASKS.md) Phase 4.5 | Rationale lives in [DOCKWA-ANALYSIS.md](DOCKWA-ANALYSIS.md) and [IMPROVEMENT-PLAN.md](IMPROVEMENT-PLAN.md); those files are context, not requirements |
| Environment appearance | [Approved target v3](design/visual-target-v3.png), a frame captured from the app and approved in T33 on 16 Nov 2026; it replaces [v2](design/visual-target-v2.png) *(amended by §15)* | Surroundings about 8/10, hero boats and docks about 7/10, between the reference video (1) and hyperrealism (10); was about 6.5 under v2. Supersedes DESIGN §5’s uniformly flat-shaded, 400–1,200-triangle treatment |
| Brand, logo, typography, tokens, component behavior | DESIGN.md and [tokens.json](design/tokens.json) | Keep Harbor Desk, approved lighthouse logo, General Sans, Switzer, Plex Mono, orange actions/selection, and dark marine chrome. Generated image typography and teal buttons are illustrative |
| Interaction story | [Storyboard](design/slip-mismatch-storyboard.html), refined here | Storyboard navigation is a preview, not authorization to mutate application records |
| Source geometry | Supplied GeoJSON plus source review | OSM provenance documents a source, not current survey accuracy or site ownership |
| Slip plan | SLIPS.md and slips.geojson | Preserve 126 assumed slips and IDs unless a documented geometry correction is needed; never present as real marina capacity |
| Geography discrepancies | [Site notes](data/SITE-NOTES.md) and dated official map | Validate placement before detailed modeling; do not repeat the bridge description as established fact |
| Example vessel data | Canonical scenario in §7 | Lake Effect is V-021, 29 ft, assigned B-12. DESIGN’s illustrative 32 ft / B-14 card is not a fixture specification |

DESIGN contains a larger component vocabulary than the MVP needs. Services tabs, Fuel preset, winter mode, full print layouts, route animation, and all status-pill variants are not mandatory v1 screens. Keep the sources intact; record deliberate deviations here or in a build decision log.

## 4. Scope

### Required in v1

- A standalone desktop-first web app, suitable for linking from the portfolio’s Experiments page.
- A recognizable, reference-informed Buffalo marina environment, including boats, docks, water, shore, yard, buildings, and distant context.
- Overview, Dock B focus, and top-down plan presets; bounded orbit, pan, zoom, reset, and reduced-motion operation *(amended by §15 F19: the Map preset, a 3D dock map, replaces top-down)*.
- All 126 supplied assumed slips selectable through the scene or an accessible list; 48 fictional vessel records, with presence driven by fixtures rather than every record rendered as docked.
- Linked slip / boat inspector, search, a small set of useful filters, and an issue entry point.
- Normal, uncertain, pending dock check, staff verification, and resolved workflow states.
- Deterministic simulated observations, a simulated evidence thumbnail, local task creation, immutable source observations, and an appended activity trail.
- Clearly visible independent-concept, simulated-data, assumed-layout, and source-attribution labels.
- Responsive tablet presentation and a usable mobile / unsupported-WebGL plan-and-list fallback.
- A reproducible demo, technical handoff, still captures, and a short portfolio recording.

### Outside v1

Real cameras, computer vision/OCR, AIS integrations, real-time networking, logins/roles, shared databases, tenant portals, payments, messaging, file uploads, actual registration verification, berth allocation changes (v1.1 allows only the local SIM transient assignment in §15) *(amended by §15)*, safe-navigation/depth advice (v1.1 fit verdicts are labelled ASSUME illustrations, not advice), maintenance management, winter storage, live weather, full reporting/printing, and a public launch performed by the coding agent without a publishing request.

Do not add empty navigation for future modules. The local dock-check request does not send an email, SMS, or staff notification.

## 5. Functional requirements

| ID | Requirement | Observable acceptance |
|---|---|---|
| F01 | Enter the demo without account setup | Overview loads with “Simulated data,” “Assumed slip layout,” and a visible “Explore slip review” action; no modal blocks first use *(amended by §15 F16–F17: one simulated-demo marker)* |
| F02 | Keep scene and records synchronized | Selecting B-12 or its observed object opens B-12; selecting Lake Effect opens its registry and assignment context; list, outline, marker, and inspector agree |
| F03 | Navigate without losing context | Camera movement never changes selection. New fly-to cancels the prior one. Plan view and returning to overview retain selection |
| F04 | Browse the registry | Search names, vessel IDs, and slip IDs; normalize B12 to B-12. Filters: dock and needs review. Clear empty-state recovery; 44 px list rows |
| F05 | Separate assignment from presence | Inspector shows assigned vessel, agreement, latest observation, identity state, source/time, and bookability independently. Assigned B-12 remains unavailable in every scenario state |
| F06 | Review an uncertain observation | Display “Vessel present · identity unverified,” source C-02, 09:12, simulated evidence, possible Harbor Light match, and the reason for doubt. Never call this a confirmed wrong boat |
| F07 | Request a dock check | One click creates one local pending task. Duplicate requests return the existing task. Issue remains open; no identity or agreement mutation |
| F08 | Verify and resolve | Review simulated 09:18 evidence, explicitly acknowledge the identity check, then confirm. Disabled / rejected without evidence and acknowledgment. Resolution atomically appends verification/audit and closes any linked task |
| F09 | Preserve history | Original observation and candidate remain available after resolution. An appended identity decision links the observation to Lake Effect; no historical rewrite or Harbor Light relocation |
| F10 | Replay deterministically | Guided replay and interactive session are distinct. Reset restores seed state, tasks, audit, clock, and selection predictably. No future verification evidence appears in earlier snapshots |
| F11 | Handle unavailable evidence | Stale, offline, unknown, failed evidence, and loading have distinct labels; none silently means empty. A recent staff verification can remain valid when the camera is offline |
| F12 | Explain provenance | Meaningful records/fields carry DOC, ASSUME, SIM, or FIELD with plain-language definitions. Missing provenance is rejected by validation; runtime quarantine/error UI preserves the rest of the app |
| F13 | Work beyond the canvas | Keyboard/list operation completes the same workflow; mobile, WebGL failure, and context loss expose a usable plan/list/inspector |
| F14 | Make the experiment understandable | About / Sources explains independent concept, approximate environment, assumed slips, fictional observations, dated sources, and future camera limitations |

## 6. Screen composition and information hierarchy

### Desktop, target 1440 × 900

Full-bleed 3D scene. A compact top bar contains the Harbor Desk lockup, “Buffalo River · Independent concept,” search, and a clearly labeled simulation time. There is no “Live” badge or real-time clock masquerading as telemetry.

Use DESIGN’s floating zones, with collision rules: one right rail contains a scrollable inspector and a collapsible Slips / Vessels list; the inspector never overlaps an independently positioned list. Start at approximately 360 px wide. Keep the selected boat visible in the remaining scene area using camera framing offsets. At 1280 px and below, combine list and details as tabs/back navigation.

Top-left summary: “126 assumed slips,” “48 simulated vessels,” and “Needs review” count derived from current state. These are dataset summaries, not live occupancy or utilization claims. *(Amended by §15: operator KPIs replace these tiles.)* Collapse them while reviewing evidence if they compete with the task.

Bottom-left activity strip appears for the selected issue, including while stationary. It shows observation → verification → resolution. This is a deliberate extension of DESIGN’s underway-only timeline rule. Keep it clear of attribution and camera controls.

Inspector sections, in order:

1. Slip ID and issue state.
2. Assigned vessel and agreement.
3. Latest observation, source timestamp/freshness, and identity uncertainty.
4. Primary action, secondary dock-check action, or resolution summary.
5. Compact presence / agreement / bookability facts and expandable registry/history.

The vessel registry detail includes name, ID, type, LOA, beam, draft, fictional owner/entity, assignment, registration/documentation reference, document-review status, and last confirmed activity. Unknown values show “Not recorded,” not zero. Use “Registration” for a registration identifier; HIN is a separate optional field. Document badges mean recorded/reviewed in the demo, not legally compliant.

### Tablet and mobile

At 768–1279 px use one 320 px rail; allow it to collapse for scene inspection. Below 768 px default to a lightweight top-down plan and list with a detail sheet *(amended by §15: a capable GPU defaults to the 3D dock map; the flat plan remains the fallback)*. A user may opt into 3D on a capable device, but all required actions work without it. At 200% zoom use the compact layout rather than clipping controls. Show attribution in every view.

### Selection semantics

Selecting an observed, unidentified hull selects its observation/slip, not the speculative candidate’s registry record. At B-12, “Possible match: Harbor Light” is a secondary link to comparison details, not the boat’s assigned label. Selecting an away vessel centers its assigned berth and labels it “Assigned berth · last confirmed away”; do not draw it there as present.

The orange selection outline is independent of issue status. Uncertainty uses text, an icon, and a non-orange semantic treatment. A dashed secondary contour/tag denotes simulated objects at useful zoom levels. Avoid outlining every distant boat or revealing the hidden identity through hover text, accessibility labels, asset names shown to users, or search results.

## 7. Canonical scenario and state transitions

All entities, identities, images, observations, and staff activity in this section are SIM. Slip IDs/geometry are ASSUME. Use a summer demo date, **15 July 2026**, so summer boats do not imply a verified November operating layout. Store timestamps with offset or UTC; display in `America/New_York`. `generated_at` records fixture creation, not event time.

| Record | Fixed fixture |
|---|---|
| Lake Effect | V-021; 29 ft cabin cruiser; assigned B-12; registration display ending 42 AB; seasonal agreement; documents reviewed in simulation |
| Harbor Light | V-022; 27 ft cabin cruiser; assigned B-14; departure logged 08:30; no subsequent verified location in this scenario |
| River Run | V-023; 24 ft center console; assigned B-10; staff observation present at 08:40 |
| Observation source | C-02; simulated camera identifier, not an installed camera or validated field of view |
| Demo actor | “Demo dockmaster”; fictional staff identity, no real headshot |

Additional dimensions and records must be deterministic, explicitly SIM, and physically plausible within the assumed geometry. Slip classes are layout assumptions, not berth-fit or safety guarantees.

| Stage | Spatial view | Inspector / action | Data consequence |
|---|---|---|---|
| Normal, 08:45 | B-12 empty; selection traces berth | Lake Effect departed at 08:10; camera observation empty at 08:45; agreement assigned; bookable No | No open issue; no boat drawn at B-12 |
| Uncertain, 09:12 | One generic observed hull at B-12 with changed canvas cover; B-14 remains without a known present boat | Vessel present; identity unverified; candidate Harbor Light; name obscured / cover differs | New immutable observation + open review issue; neither vessel record is relocated |
| Pending check, 09:13 | Same observed hull and selection | Dock check requested; task pending; review remains available | One task appended; issue stays open; not resolved by waiting |
| Verification review, 09:18 | Same scene; no success styling yet | Simulated staff note: name and registration suffix match Lake Effect; new cover explains ambiguity; acknowledgment checkbox | Evidence becomes available for review; no closure until confirmation |
| Resolved, 09:20 | Same hull becomes labeled Lake Effect, without teleporting; review marker clears | Lake Effect confirmed at B-12; staff source/time; agreement unchanged; bookable No | Append identity decision and audit; close issue and linked task if present; retain original candidate and observation |

Allowed paths:

- `normal → uncertain → verification review → resolved`
- `normal → uncertain → pending check → verification review → resolved`
- Back/cancel from verification returns to the preceding unresolved state without mutation.
- Insufficient evidence leaves the issue open. A camera-only candidate cannot resolve it.

“Review observation” opens the evidence comparison. “Load simulated dock-check result” advances the demo to 09:18; it is labeled as a scenario control rather than a production camera capability. “Confirm identity & resolve” is enabled only after the supplied staff evidence is available and acknowledged.

### State invariants

1. Presence, identity, agreement, issue status, and document review are independent fields.
2. Empty + assigned does not imply available. The B-12 workflow creates no booking or allocation changes. *(Amended by §15: T30 may create only a local, appended, undoable SIM assignment of a transient to a vacant slip with no agreement. It can never target an assigned slip.)*
3. Possible match is a candidate, never a confirmed identity or location update.
4. Harbor Light’s assignment and last confirmed location are unchanged by every B-12 action.
5. Resolution retains the source observation, candidate, and evidence timestamps; the effective identity is derived from an appended decision.
6. Confirmation is atomic and idempotent. Repeated clicks cannot duplicate audit, identity decisions, or task closure.
7. A pending check cannot auto-resolve with a timer, reload, or selection change.
8. Replay snapshots cannot expose later evidence/audit or mutate an interactive run. “Try this state” starts a fresh isolated branch. “Restart demo” clears that branch.
9. A source’s stale/offline status does not prove absence. Retain last reported presence with its timestamp separately from current confidence.
10. Opaque observation IDs and generic model metadata avoid disclosing the resolved identity early.

## 8. Data contract and provenance

Keep simulation logic separate from rendering. The 3D view, DOM panels, filters, counters, and audit read the same selectors; they do not maintain competing copies of vessel state.

| Entity | Minimum fields / rule |
|---|---|
| Source | `id`, `kind`, title, source URL/path, date/access date, provenance, caveats |
| Slip | Existing GeoJSON fields preserved: `id`, `dock`, `number`, `length_ft`, `width_ft`, `dock_kind`, `headwalk_osm_way`, `provenance`, `basis`; derived world transform separate |
| Vessel | `id`, name, type, model asset key, LOA/beam/draft with units, fictional owner/entity, optional registration/documentation/HIN fields, provenance, generated_at |
| Agreement | `id`, vesselId, slipId, seasonal/transient type, start/end, status; never inferred from a camera |
| DocumentSummary | vesselId, document type, masked reference, review state, review/expiry dates if seeded, provenance; metadata only, no uploads |
| Observation | `id`, slipId, sourceId, observedAt, receivedAt, presence (`present/empty/unknown`), candidateVesselIds, reason, evidenceAssetId, provenance; immutable |
| IdentityDecision | observationId, confirmedVesselId, verificationId, actorId, decidedAt; appended on resolution |
| ReviewIssue | id, slipId, observationId, state (`open/pending_check/resolved`), reason, createdAt, resolvedAt; no “confirmed mismatch” claim |
| DockCheckTask | id, issueId, slipId, requestedAt, status (`pending/completed`), completedAt, verificationId; at most one per issue |
| Verification | id, slipId, verifiedVesselId, checkedAt, actorId, method, evidence summary, provenance |
| AuditEvent | id, issueId, event type, actorId, eventAt, source/evidence IDs, before/after decision references; append-only per session |
| DemoSession | schemaVersion, scenarioVersion, seed, virtual time, mode (`interactive/replay`), cursor, selections, local decisions/tasks; safely reset on incompatible version |

Normalize feet to meters (`1 ft = 0.3048 m`) at the scene boundary; retain feet for marina-facing UI. Longitude/latitude remain WGS84 in source files; render in a documented local metric frame near the site origin. Do not use degrees directly as scene units.

Provenance definitions:

- **DOC — Documented source:** linked and dated evidence; not a guarantee of current accuracy.
- **ASSUME — Design assumption:** generated slips, numbering, model dimensions, inferred site placement.
- **SIM — Simulated:** fictional vessels, records, staff actions, evidence, and observations, including “verified” demo decisions.
- **FIELD — Field validation needed:** unconfirmed operational capability or current service location.

A record-level tag can cover homogeneous fictional fields; mixed-origin fields need their own tags. Keep labels legible without repeating SIM beside every word. About / Sources exposes source details. No unlabeled synthetic records enter the display model.

Freshness is a demo policy, not a validated camera SLA: a camera observation is fresh for five virtual minutes. An older observation becomes “Last observed…” with current presence unknown unless newer applicable evidence exists. Staff verification has its own source/time; the 09:18 result remains recent at 09:20 even though the 09:12 camera record is stale. Freeze time within scenario checkpoints; do not let the viewer’s wall clock age out the demo.

Session changes may persist in versioned localStorage. Keep seed fixtures immutable, support unavailable/corrupt storage with an in-memory session, and make reset reliable. Local persistence is a prototype convenience, not a secure or multi-user audit system.

## 9. Environment and asset strategy

### Geography

Use supplied OSM features as the starting geography and the dated official site map for a visual cross-check. The actual waterfront setting is essential; a generic rectangular marina is not acceptable. Preserve the long quay, river/channel, yard relationship, and appropriate surrounding massing. See [SITE-NOTES.md](data/SITE-NOTES.md) for discrepancies and the required alignment check.

Build three detail zones:

| Zone | Treatment |
|---|---|
| Selected slip and neighboring boats | Recognizable hulls, deck/cabin proportions, rails, cleats, canvas, dock edges/planks/piles; believable scale and contact shadows |
| Marina / working yard | Shared boat families, simplified materials, docks, shoreline, service buildings, storage rows, fences, paths, restrained vegetation |
| Waterfront surroundings | Low-cost building/silo/bridge/tree massing in geographically defensible positions; no invented landmark placement just to fill the camera |

An initially unknown or incorrectly mapped feature must remain labeled approximate, be corrected with evidence, or be omitted. Do not import the full OSM bounding box as fully detailed geometry. Do not place the RiverWorks painted silos at the marina merely because DESIGN includes their palette.

### Rendering target

Use v2’s clean miniature composition with realistic foreground materials and restrained texture. Elevated, near-orthographic perspective; legible silhouettes; soft daylight; calm water; simplified trees; realistic but modest reflections; no heavy depth-of-field, cinematic glare, film grain, or night-time sci-fi effects.

Low-poly geometry is appropriate at distance, not a blanket cap on the selected boat. Use shared boat families, instanced repeated components, texture atlases, and LODs. A few carefully modeled assets are preferable to dozens of weak variants. Start with a cabin cruiser for the main story, plus sailboat and small powerboat families for spatial variety. No generative image is a substitute for interactive geometry.

Prefer authored procedural geometry and locally bundled glTF/GLB assets. Keep editable sources and a reproducible export path. The exact modeling tool is an implementation choice. External models require recorded reuse rights and attribution; do not introduce paid assets as a hidden dependency.

Google Maps/Earth is not a v1 runtime dependency. Do not extract its meshes/textures to create the scene. Use source-backed public geography and original/authored assets; reassess provider terms if a future integration is proposed. The app must work without a map API key, paid tile service, or network model endpoint.

Water boundaries need special care: the supplied regional polygons are partial. Use a validated shoreline mask / authored local water surface or obtain complete geometry. Never close an incomplete regional polygon across the marina and flood the yard. Generated slip polygons represent berths; they are not solid dock decking. Construct headwalks/fingers separately and check water-side orientation, collisions, and gangway continuity.

### Brand and interaction fidelity

Use local fonts and supplied logo/icons. JSON tokens are canonical; keep CSS synchronized. Use dark translucent panels with solid fallback, light chart theme, 150 ms micro states, 240 ms panels, and interruptible 700 ms camera transitions. Reduced motion cuts camera travel and freezes ambient effects. Add a pause-motion control for continuous water motion.

Retain the IBM Plex license text. Use supplied General Sans / Switzer files per the user’s recorded decision in DESIGN §15; do not reopen that approval. *(Amended by §15: T27 reopens typography at Raj's request. The faces he picks replace these once approved.)* Plex is the numeric accent fallback; no unlicensed LED font is required.

## 10. Technical implementation defaults

Use **Vite + React + TypeScript + React Three Fiber + Drei**, CSS custom properties, and local static fixtures. Pin a coherent, tested dependency set during setup; do not hardcode guessed “latest” versions in the plan. Avoid a backend, a large UI framework, and stateful scene objects as the domain store.

Suggested boundaries (new files to create during implementation):

```text
src/app/           shell, routing/state restoration, error boundaries
src/domain/        types, validation, transitions, derived selectors
src/data/          fixture loader, scenario seed, source manifests
src/scene/         local coordinates, environment, boats, picking, camera, LOD
src/features/      registry, slip-review, tasks, history, demo-controls
src/ui/            token-based controls, panels, provenance, accessibility
scripts/           geometry validation and asset preparation
tests/             domain tests and critical browser journeys
public/assets/     optimized runtime assets only
```

Keep original GeoJSON, reference images, fonts, and modeling sources outside the public bundle unless actually needed. The 27 MB inspiration video and large concept renders are authoring references, not app downloads. Runtime assets must be local; no remote font loads.

Prefer a small reducer/store with explicit commands and pure selectors. Use unit tests for domain transitions and geometry transforms, browser tests for integrated workflows, and manual visual review for the scene. The build must remain readable for portfolio discussion.

## 11. Quality and acceptance targets

Targets are not measurements. Record actual device/browser, viewport, DPR, build version, warm-up, and results before claiming performance.

| Area | Release criterion |
|---|---|
| Rendering | Target 60 fps on M1 MacBook Air at 1440 × 900 with capped DPR; over a defined 60-second overview/select/orbit run, median ≥55 fps and p95 frame time ≤33.3 ms. If target hardware is unavailable, report the substitute and leave target-device verification open |
| Complexity | DESIGN ceiling <2,000 draw calls; aim <300 in the normal view. Investigate actual frame-time bottlenecks rather than treating the ceiling as a target |
| Download | <6 MB compressed transferred runtime resources for the full demo, including deferred assets and fonts; authoring sources excluded. Record uncompressed disk size separately |
| Fonts | <200 KB transferred fonts for the actual used subset/weights. Supplied files total about 348 KB on disk, so loading every weight is not the implementation plan |
| Startup | On a documented cold-cache 10 Mbps / 100 ms latency profile: useful shell/list within 2 seconds, usable initial 3D within 5 seconds; show meaningful loading and fallback on failure |
| Responsiveness | Selection feedback within 100 ms after input on reference hardware; expensive camera/render work must not block panel interactions |
| Fidelity | At 1440 × 900 and 1600 × 1000, compare the same selected B-12 composition to v2: plausible scale, detailed foreground, coherent Buffalo surroundings, calmer simplified background, legible operational panel |
| Accessibility | Complete flow by keyboard and screen reader DOM; canvas aria-hidden; visible focus; labeled statuses; AA text contrast on the actual composited surface; 200% zoom; reduced motion; no color-only meaning |
| Resilience | Failed geometry, missing model/evidence, unsupported/lost WebGL, no storage, and invalid data produce recoverable UI without false operational facts |
| Determinism | Reload/reset/replay produce documented fixture state; no duplicate tasks/audit; all counters derived |
| Content | No real personal data, invented partnership, “live AI” claim, verified-capacity claim, or legally compliant badge |

Use adaptive rendering quality before compromising the selected boat or core workflow. If fidelity and the budget conflict after profiling, record the measured tradeoff and proposed adjustment; do not quietly weaken the approved appearance or claim the target passed.

## 12. Validation and portfolio proof

Technical release checks: typecheck, production build, fixture/geometry validation, domain tests, critical browser journeys, accessibility checks, manual responsive/visual review, and the measured performance run. Specific cases are in TASKS.md.

Optional formative review after a working build: ask five people unfamiliar with the project to find B-12, explain the uncertainty, resolve it using the simulated evidence, and state what did not change. Target four of five completing without coaching in 90 seconds. Record observed results; do not manufacture usability metrics or delay an honest portfolio demo solely because a study has not happened.

Prepare a 60–90 second recording: Buffalo overview → select B-12 → inspect ambiguity → request check → review evidence → resolve → show retained history. *(Amended by §15: the v1.1 cut list replaces this.)* Keep simulation labeling in frame. Capture at 1600 × 1000 with high-resolution still exports where supported. Include a reduced-motion still/plan alternative and concise portfolio copy explaining what was built, what was simulated, and the design tradeoff.

## 13. Operational grounding and future work

The marina operator’s published RFP scope includes vessel/slip records, document collection, inspections, and seasonal storage responsibilities. That supports the choice of a registry and review history as plausible workflows; it does not establish today’s operator software or policies. [ESD operator scope, §§1 and 4](https://www.esd.ny.gov/sites/default/files/rfp/Appendix-A-Scope-of-Services-First-Buffalo-Marina-Operator.pdf).

V1 therefore represents registration/documentation and insurance as separate record categories, not a single “boat license.” Do not implement a legal rules engine or infer compliance from visual recognition. Any real pilot requires current operator requirements and source-specific validation.

Possible later increments, in order of evidence needed:

1. Operator walkthrough to validate actual layout, terminology, assignment changes, document handling, and useful exception types.
2. Better field capture / staff observation input before any camera automation.
3. Read-only camera observation ingestion with measured coverage, identity limits, false-positive review, retention, and appropriate access controls.
4. Berth-fit exploration using verified dimensions, utilities, restrictions, and water-depth data; never infer fit from assumed width classes alone. *(v1.1 T30 demonstrates the interaction with ASSUME depths and SIM boats, labelled as such. Validation with real inputs remains future work.)*
5. Winter haul-out/storage planning, inspections/service tasks, and owner reporting if research supports them.

These are not hidden v1 dependencies.

## 14. Remaining uncertainties

No further product preference is required to start the task list. The remaining issues are implementation/research work: spatial alignment, actual source completeness, asset creation/optimization, and device measurements. Real slip capacity, services, operating procedures, identities, and camera performance remain unverified. Preserve that distinction through launch copy.

The first build gate is a spatially checked Dock B section with the entire workflow and representative materials. Expand the environment only after that gate succeeds.

## 15. v1.1 amendment — portfolio improvement (15 November 2026)

### Decision

Raj approved this phase after a comparison with Dockwa's marina software.

**Audience:** 3D-prototyping hiring teams broadly, with marina-software teams (Dockwa first) as one target.

**Principles:**
- **3D stays the default view on every capable device.**
- The spatial view must also do the dockmaster's map job, rather than leaving that to a 2D default.

Everything below stays local and deterministic. Every new record or value is SIM or ASSUME. Nothing adds integrations, payments, messaging, real availability, or safety advice. Implementation tasks: [TASKS.md](TASKS.md) T24–T35, closing with Gate D (T34). T22–T23 follow Gate D.

### Added functional requirements

| ID | Requirement | Observable acceptance |
|---|---|---|
| F15 | First impression | A poster still of the hero pose is the first meaningful paint and crossfades into the live scene. No blank canvas is ever visible. A 3-second establishing move (waterfront → Dock B → B-12) is skippable by click, key or scroll, is cut under reduced motion, and never changes selection or scenario state |
| F16 | Scene-first chrome | At 1440×900 panels cover ≤30% of the viewport by default. The scenario card collapses to a step bar, About / Sources moves to the top-bar menu, and the registry list starts closed. OSM credit stays visible. The “Explore slip review” entry point remains visible (amends F01) |
| F17 | Quiet provenance | One persistent “Simulated demo · Buffalo concept” marker replaces repeated first-screen chips. DOC/ASSUME/SIM/FIELD remain on every detail row and are reachable on hover or focus and by screen reader. F12 rules are otherwise unchanged |
| F18 | Operator KPIs | Occupancy tonight · Arrivals today · Needs attention · Revenue at risk, all derived from selectors over SIM fixtures and labelled SIM in their detail. These replace the dataset tiles in §6; the dataset counts stay in About / Sources |
| F19 | 3D dock map | Replaces the Top-down preset: a tilted orthographic 3D view framed on the marina, accounting for panel insets. Status-colored slip plates (occupied, vacant, reserved, needs review, away) with non-color cues, slip numbers when zoomed in, and a legend. Every slip is pickable. On mobile a capable GPU defaults to it; the flat plan remains the fallback for accessibility, no WebGL and low power |
| F20 | Fit-aware assignment | Dragging a SIM transient request over the scene or map shows a verdict on each vacant, unassigned slip (fits / tight / no fit) with its reason: LOA, beam clearance, draft against ASSUME depth, or shore power. Dropping animates the boat along an approach path and appends a local SIM assignment. It can be undone. Assigned or occupied slips are never offered. A keyboard path (list → Assign) is equivalent. Verdicts are labelled as illustrations, not berth-fit or navigation advice |
| F21 | Time scrubber | Scrub 06:00–22:00 on 15 July 2026. Arrivals and departures follow authored paths without teleporting. Vacant slips show unsold nights. KPIs and an arrivals board follow the scrubber, and lighting follows the time of day. Scrubbing is a read-only view of the timeline: it never mutates interactive-session records and never reveals evidence later than its cursor (consistent with F10 and invariant 8). It can be operated by keyboard |
| F22 | Dock-walk trigger | The B-12 issue opens from a SIM morning dock-walk discrepancy (“marked Occupied; Lake Effect departed 08:10”). Camera C-02 is a corroborating second source that still supplies the candidate and frame. Stage times stay 08:45 / 09:12 / 09:13 / 09:18 / 09:20. History keeps both sources unchanged. No staff action is implied to have been sent anywhere |
| F23 | Optional extra (one, chosen later) | (E) Buffalo seiche/gale overlay that feeds F20 verdicts; (G) a boater arrival flythrough; or (F) an OSM-generated map onboarding sequence. The chosen option keeps SIM/ASSUME labels and Gate D budgets. Not required for Gate D. **Chosen: (E)** (16 Nov 2026). A Calm / SW gale what-if over a SIM lake series: the draft check uses the stay's low water, fixed decks its high water, open berths its onshore wind. It is a lens, not a record; it never changes the run, and it is not a forecast or navigation advice |

### Data contract additions

| Entity | Minimum fields / rule |
|---|---|
| Rate | slip class or slipId, nightly / seasonal amount (USD), provenance SIM |
| Movement | id, vesselId, slipId, kind (`arrival/departure`), scheduledAt, actualAt optional, approachPathId, provenance SIM |
| TransientRequest | id, vessel dimensions (LOA, beam, draft, power), arrival/departure window, provenance SIM |
| LocalAssignment | id, requestId, slipId, assignedAt, undoneAt optional; appended, session-local, never on an assigned slip |
| DockWalkObservation | an Observation with `sourceKind: staff_walk`; immutable like every Observation |
| SlipDepth | slipId, depth_ft, provenance ASSUME, basis note |

**Fixture targets:**
- About 88% July occupancy, with a seasonal/transient mix and away flags.
- Exactly one offline camera.
- Lake Effect, Harbor Light, River Run, C-02 and the B-12 timeline stay compatible with the existing scenario tests.

### Added quality targets

| Area | Release criterion |
|---|---|
| First paint | The poster is visible before the first frame of the 3D scene on the Gate C cold-cache profile at DPR 1 and 2. Shell transfer stays within Gate C, or the increase is measured and justified |
| Chrome | Panel coverage ≤30% at 1440×900, measured. First-screen visible word count down at least 40% from the Batch 8 baseline |
| Interaction | Drag-to-assign and scrubbing hold the Gate C frame-pacing targets on the measured GPU device |
| Fidelity | Compare against Raj's approved v3 target ([design/visual-target-v3.png](design/visual-target-v3.png), 16 Nov 2026) instead of v2. Realism set by Raj: surroundings about 8/10, hero boats and docks about 7/10 |
| Fonts | No more than 5 faces at ≤180 KB, self-hosted, licenses recorded |
| Regression | Gate B/C budgets, the identity-leak tests, all prior unit and browser journeys, and the B-12 invariants hold (updated locators allowed, weakened assertions not) |

### Updated recording (supersedes §12's sequence)

A 75–90 s cut: poster → establishing move → drag-to-assign → time scrubber → dock-walk review → resolve → retained history. Keep the simulated-demo marker in frame. Per-company pitch notes stay local and are not published.

*Recorded 16 Nov 2026 (T22): `showcase/video/harbor-desk-walkthrough-1600.mp4`, 77 s. The T35 gale what-if follows drag-to-assign.*

### Decisions still needed from Raj

- Before T25: approve the chrome diet, the operator KPIs and single-marker labelling.
- T27: font trio.
- T33: realism target / v3 still.
- T35: which optional extra. *Decided 16 Nov 2026: (E), the Buffalo seiche and gale what-if; built in T35.*

