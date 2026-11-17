# Harbor Desk — Build Log

Started 14 November 2026. One entry per task: outputs, checks actually run, remaining limitations. Never record a check here that did not run.

## Adopted defaults and source precedence

Precedence follows [PRD.md §3](PRD.md). In short:

| Topic | Authority used in this build |
|---|---|
| Scope, workflow, fixtures | PRD (latest user approval) |
| Environment appearance | [design/visual-target-v2.png](design/visual-target-v2.png); supersedes DESIGN §5.2 low-poly/flat-shading rule |
| Brand, logo, type, tokens, component behavior | [DESIGN.md](DESIGN.md) + [design/tokens.json](design/tokens.json) (JSON canonical over CSS and over DESIGN prose excerpts) |
| Interaction story | Storyboard, as refined by PRD §7 |
| Slip IDs/geometry | [data/slips.geojson](data/slips.geojson), preserved; corrections only as derived files |
| Geography | Supplied OSM features + dated 2022 official site map; [data/SITE-NOTES.md](data/SITE-NOTES.md) |
| Example vessel data | PRD §7 canonical scenario (Lake Effect = V-021, 29 ft, B-12) |

Working defaults adopted in this build (implementation choices, not validated facts):

- Stack: Vite + React + TypeScript + React Three Fiber + Drei, CSS custom properties, Vitest, Playwright, ESLint. No backend.
- Scenario date 15 July 2026, displayed in `America/New_York`.
- Local metric frame: tangent-plane projection about origin 42.8742 N, 78.8806 W (near B-12). Details in `data/GEOMETRY-VALIDATION.md` (T02).
- Git: this folder sits inside the repository rooted at the parent folder `New Builds for Job Search`, which also holds unrelated projects. No remote is configured. The user's uncommitted work (modified `PRODUCT.md`; untracked `PRD.md`, `TASKS.md`, `data/SITE-NOTES.md`, `data/reference/`, `design/slip-mismatch-storyboard.html`) is left untouched. This build does not commit, push, or create remotes unless asked.

---

## T01 — Inventory and reconcile inputs

Status: complete, 14 Nov 2026.

### Existing inputs (before any build work)

| Path | What it is | Check run |
|---|---|---|
| `PRODUCT.md` | Product context; has uncommitted user edits | Read |
| `PRD.md`, `TASKS.md` | Build authority and task list | Read in full |
| `DESIGN.md` | Brand/design system (592 lines) | Read in full |
| `REFERENCES.md` | Token-source bookmarks | Read |
| `design/tokens.json`, `design/tokens.css` | Tokens (JSON canonical) | Read in full; discrepancies below |
| `design/logo-harbor-desk.svg`, `design/logo-harbor-desk-small.svg` | Approved logo G and small reduction | `xmllint --noout` passes |
| `design/icons-vessels.svg` | Vessel-type sprite (6 symbols) | `xmllint --noout` passes |
| `design/fonts/` | 12 font files + `IBM-Plex-OFL.txt` | `file` identifies valid WOFF (CFF) / WOFF2 (TrueType); 348,240 bytes of fonts (licence text excluded), matching TASKS’ ~348 KB |
| `design/vessel-card.html`, `design/icons-preview.html` | Component references | Grep: no remote font/CDN URLs remain (only SVG namespace URIs) |
| `design/slip-mismatch-storyboard.html` | Interaction storyboard (illustrative) | Read markup and script: 3 frames (08:45 / 09:12 / 09:20), B-10/B-12/B-14, review → acknowledge → resolve, dock-check branch |
| `design/visual-target-v1.png`, `design/visual-target-v2.png` | Concept renders, 1672×941 | Decoded with `sips`; v2 inspected visually |
| `design/visual-target-prompt-v2.txt`, `design/visual-target-provenance-v1.txt`, `visual-target-prompt-v1.txt` | Generation prompts/provenance | Read v2 prompt |
| `data/buffalo-river-features.geojson` | OSM harbor features | Parsed: **146 features** (62 pier lines, 27 pier polygons, 17 breakwaters, 8 river lines, 8 obstructions, 7 water, 5 parking, 4 marina, 2 building, 1 each coastguard/lighthouse/harbour basin/anchorage/wreck/slipway) |
| `data/slips.geojson` | Generated slips | Parsed: **126 slips, A 39 / B 37 / C 18 / D 22 / E 10**, all `provenance: ASSUME`; **B-10, B-12, B-14 exist** on headwalk OSM 934085288 |
| `data/slips-plan.svg` | Plan check from slip author | `xmllint` passes |
| `data/SLIPS.md`, `data/SITE-NOTES.md` | Slip rationale and its qualification | Read |
| `data/reference/first-buffalo-site-map-2022.pdf` | Official ESD site map, 1 June 2022 | Rendered with `sips` to PNG and inspected |
| `ssstwitter.com_1794669390043.mp4` | 27 MB reference video | Exists; git-ignored; authoring reference only, never bundled |
| `.claude/launch.json` | `design-preview` static server config | Read |

Confirmed absent: `package.json` / any app scaffold, `src/`, `data/vessels.json`, `BUILD-LOG.md`, `data/GEOMETRY-VALIDATION.md`, `design/ASSET-PLAN.md`.

### Planned outputs (created by later tasks)

App scaffold and `src/{app,domain,data,scene,features,ui}`, `scripts/`, `tests/`, `public/assets/` (T04+); `data/derived/` and `data/GEOMETRY-VALIDATION.md` (T02); `design/ASSET-PLAN.md` (T03); generated SIM fixtures (T05); `QA.md` (T21); `README.md` (T23).

### Deliberate PRD overrides recorded

1. **Lake Effect fixture.** DESIGN §12 and `vessel-card.html` show Lake Effect as 32 ft, slip B-14, hull NY-4471-RB, with a real manufacturer/model name. PRD §7 controls: V-021, 29 ft cabin cruiser, assigned B-12, registration display ending 42 AB. Card values stay out of fixtures; no real make/model names in SIM records.
2. **Rendering fidelity.** DESIGN §5.2 (400–1,200 triangles, flat shaded) is superseded by v2 for the selected/foreground zone; low-poly is acceptable at distance only.
3. **Concept image content is illustrative.** v2’s boat positions, “First Buffalo River Marina” header text, teal buttons, amber “Needs review” chip and “Demo data” label are not specifications. Product chrome uses Harbor Desk / “Buffalo River · Independent concept” (DESIGN §6.1 forbids organization names in UI), orange for primary action/selection only, and the PRD’s required labels.
4. **Top bar clock.** DESIGN §9 “live clock” becomes a labelled simulation time (PRD §6).
5. **Timeline strip.** Shown for the selected issue while stationary (PRD §6 extension of DESIGN’s underway-only rule).
6. **LED Dot Matrix** is not shipped (unlicensed); Plex Mono tabular numerals are used.
7. **Component vocabulary.** Services tab, Fuel preset, winter mode, print layouts, route animation and most status-pill variants are not built in v1 (PRD §3).

### Unresolved findings (carried into tasks)

| # | Finding | Evidence | Owner task |
|---|---|---|---|
| F1 | SLIPS.md locates the site “between the Michigan Avenue and Ohio Street bridges”. The 2022 official map shows the site at the river mouth near the Coast Guard station / lighthouse, with the Skyway at its upstream end. | Rendered official map | T02 |
| F2 | OSM 1073548174 is `kind: parking` in the supplied file; SLIPS.md calls it the boatyard. | GeoJSON properties | T02 |
| F3 | SLIPS.md cites slipway OSM 934085281; that way is **not** in the supplied features file (the only slipway is 1073540134). | Feature ID scan | T02 |
| F4 | SLIPS.md says letters run from the slipway end upstream; a first projection puts headwalk D between B and C along the reach (A, B, D, C, E). Numbering direction also appears to differ by dock (E-01 at the upstream end). | Projected coordinates | T02 (record; IDs stay canonical) |
| F5 | River water: no river polygon covers the site; only a centreline. Supplied water polygons near the site are elsewhere (e.g. 1073603319 lies south-west of the yard). | Projected bboxes | T02 |
| F6 | Token drift: `tokens.json` `_meta.project` still says “working name TBD”; light `text-muted` is `ink-300` in JSON (3.47:1, fails) but `#5d6c7b` in CSS; DESIGN §2.2/§11 list `silo-concrete` as `#8f8b84` PLACEHOLDER while JSON has measured `#7b7265`; DESIGN names `chart-magenta-dark-mode` and light nav-aid `#d7007a`, JSON has `chart-magenta-dm` and `#c842c6`. JSON wins except where it fails contrast; resolution recorded in T07. | File comparison | T07 |
| F7 | Font budget: loading every supplied weight (348 KB) exceeds the <200 KB target. General Sans/Switzer ship as WOFF (not WOFF2); Plex files are full, not Latin-subset. Weight selection/subsetting is planned in T03. | Byte counts | T03/T07 |
| F8 | `vessel-card.html` uses a real manufacturer/model (“Sea Ray Sundancer”). Fine as a design reference; never copied into SIM fixtures. | Grep | T05 |

### Checks actually run

File listing; `git rev-parse`, `git status`, `git log`, `git remote -v`; Python JSON parsing and feature/slip counts; `xmllint --noout` on all SVGs; `file` and byte totals on fonts; `sips` decode of both PNG targets and render of the official PDF; grep for remote URLs in design HTML.

### Limitations

No source file was edited. The identification of the site as First Buffalo River Marina remains ASSUME (SLIPS.md); this entry does not upgrade it.

Resolution of T01 findings so far: F1–F5 investigated in T02 (below); F6 and F8 remain for T07/T05; F7 planned in T03 (170,448 bytes of fonts, measurement pending in T07).

---

## T04 — Scaffold the app and quality commands

Status: complete, 14 Nov 2026. (Done before T02 so the geometry script could share the tested coordinate module; T04 depends only on T01.)

### Outputs

- `package.json` + `package-lock.json` with exact pins: vite 8.3.8, react/react-dom 19.3.1, three 0.187.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, typescript 6.0.3, vitest 5.1.0, @playwright/test 1.65.1, eslint 10.15.0 + typescript-eslint 8.72.2, @vitejs/plugin-react 6.3.0.
  - TypeScript is held at 6.0.3 (not 7.0.2) because typescript-eslint 8.72.2 declares `typescript <6.1.0`. R3F 9.8.2 requires React `<19.4`; 19.3.1 satisfies it.
- Strict TS (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`), split app/node configs; ESLint flat config with React Hooks rules; Vitest (unit, node env); Playwright (Chromium, 1440×900, runs against `vite preview` of the production build).
- Source boundaries from PRD §10: `src/{app,domain,data,scene,features,ui}`, `scripts/`, `tests/{unit,e2e}`, `public/assets/`.
- Shell: `ErrorBoundary` (per-region recovery), `LoadingShell` (names what is loading), WebGL detection with a text fallback, a lazily loaded placeholder R3F scene (replaced in T08), required labels (“Simulated data”, “Assumed slip layout”) and OSM attribution link. No remote fonts (system fonts until T07).
- `.claude/launch.json`: added `harbor-desk-dev` (Vite on 5173); kept `design-preview`.
- `.gitignore`: node_modules, dist, test-results, playwright-report, tsbuildinfo.

### Commands

| Purpose | Command |
|---|---|
| Install (clean, from lockfile) | `npm ci` |
| Dev server | `npm run dev` (http://localhost:5173) |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit/domain tests | `npm test` (`npm run test:watch` to watch) |
| Browser tests | `npm run test:e2e` (builds, serves preview on 127.0.0.1:4173); first run on a machine needs `npx playwright install chromium` |
| Production build / preview | `npm run build`, `npm run preview` |
| Geometry validation | `npm run geometry` |
| Everything except e2e | `npm run check` |

### Checks actually run

- `rm -rf node_modules dist && npm ci` → success.
- `npm run check` → typecheck clean, lint clean, 18/18 unit tests pass, production build succeeds.
- `npx playwright test` → 1/1 pass against the production preview: labels visible, canvas mounts (headless Chromium WebGL), **zero console errors, zero non-local requests**.
- In-app browser on the dev server: shell renders, no console errors.
- Build output (gzip, as reported by Vite): shell JS 70.5 KB, lazily loaded scene chunk 247.3 KB (three + R3F + Drei), CSS 0.7 KB.

### Limitations

- `npm audit`: 7 moderate advisories, all `minimatch` inside typescript-eslint (dev-only lint tooling, not shipped). The suggested fix downgrades typescript-eslint; not applied.
- Playwright 1.65.1 needed its own Chromium build (`chromium-headless-shell` v1255, ~100 MB). It was downloaded with `npx playwright install chromium` from Playwright’s distribution.
- Headless Chromium WebGL is software-rendered. It proves the canvas mounts, not GPU performance.

---

## T02 — Validate the marina plan and local coordinate system

Status: complete, 14 Nov 2026. Full write-up: [data/GEOMETRY-VALIDATION.md](data/GEOMETRY-VALIDATION.md).

### Outputs

- `src/scene/geo.ts`: one local-frame implementation (origin 42.8742 N / 78.8806 W; x east, y up, z = −north; WGS84-radius tangent plane; ft→m 0.3048). Used by the app and the scripts.
- `src/scene/geometry2d.ts`: dependency-free 2D helpers (area, containment, convex overlap, polyline chainage, offsets, least-squares similarity fit).
- `scripts/inspect-geometry.ts` (`npm run geometry`) → `data/derived/site-local.json`, `data/derived/geometry-report.json`, `data/derived/site-plan-annotated.svg`; `scripts/render-plan.ts` → `.png`.
- Original GeoJSON, SLIPS.md, SITE-NOTES.md and the map PDF are unchanged (verified with `git diff` and checksums; see below).

### What was found

1. **Site position (resolves F1).** The headwalks sit on the west bank of the **City Ship Canal at the Buffalo River mouth**, with the Skyway at the south-east end. B-20…E-10 lie inside OSM’s City Ship Canal polygon. Three dock anchors fit the 2022 official map with residuals of 3.2, 5.0 and 1.8 m. SLIPS.md’s “between the Michigan Avenue and Ohio Street bridges” is wrong for this geometry.
2. **North bank is approximate.** A Commercial Slip candidate is 84.9 m off and stays unresolved. Mid-river agrees within 17.9 m.
3. **Dock order (F4).** Letters run A → B → D → C → E along the reach; Dock E numbers from its south-east end. IDs kept canonical (PRD §3).
4. **Slipway (F3).** OSM 934085281 is absent from the supplied file; 1073540134 is the only slipway.
5. **Yard (F2).** 1073548174 is `kind: parking`. It is used as an alignment/land clue, not as an ownership boundary. All 50 of its vertices fall on the land side of the bank (±1 m).
6. **Water (F5).** River-mouth water in front of A-01…B-19, including B-12, is unmapped (centreline only). Repair: a water plane plus three authored land masks. Documented water always cuts holes in authored land; no partial polygon is closed.
7. **Slips are sound.** Count, IDs, closure, sizes (≤0.38% error), right angles, headwalk attachment (≤0.6 m), no overlaps, all open into water. Slip polygons are berth water space, not decking.

### Checks actually run

`npm run geometry` → 27 checks: 23 pass; 4 flags are the genuine source findings above. A first run produced false flags from my own bugs: a water-side test against the schematic centreline, and wrong-order chaining of the river ways. Both were fixed, and the run was repeated. Unit tests cover the frame and the helpers (round trip < 1 mm, axis orientation, unit conversion, invalid input rejection, similarity recovery) and guard the derived file (126 IDs, ASSUME provenance, metre sizes, no slip under a land mask). The rendered plan was inspected visually.

### Limitations

Not survey-grade. All anchors lie along one shoreline. River half-width (45 m), bank offsets north of the canal mouth (A 1 m, B 3 m), building heights, and every digitized mass are ASSUME. Map picks are manual (±10 px ≈ ±6 m).

---

## T03 — Define the runtime asset plan

Status: complete, 14 Nov 2026. Output: [design/ASSET-PLAN.md](design/ASSET-PLAN.md).

### Decisions

- Parametric TypeScript generators are the editable source for all 3D assets, with the hero cabin cruiser first. Smaller powerboat and sailboat families come from the same hull generator. Docks, piles, rocks, trees and distant boats are instanced. No third-party or paid models, textures, HDRIs or map tiles.
- Forbidden remote-fetch paths are listed (Drei `Environment` presets, `Text` default font, CDN Draco/KTX2 decoders). The e2e test already fails on any non-local request.
- Fonts: five files (General Sans 600; Switzer 400/600; Plex Mono 400/500) total 170,448 bytes on disk, under the 200 KB target without subsetting. Plex 400 is the first to drop if needed.
- Two SIM evidence images are rendered from the app’s own scene: a camera-style frame at 09:12 with the name illegible, and a distinct staff-photo treatment at 09:18. File names are opaque so they do not reveal identity early.
- Estimated full transfer ≈ 0.7–0.8 MB against 6 MB. **Estimate, not a measurement.**

### Checks actually run

Confirmed locally: no Blender/glTF tooling and no Python fontTools; Drei sources that fetch remote assets (grep of `node_modules/@react-three/drei`); font byte sizes. Nothing is placed in `public/assets/` yet. Runtime assets are added only when optimized (T07/T09).

### Limitations

Visual adequacy of procedural boats is unproven until the Gate A comparison with v2. The fallback (a Blender-authored hero GLB) would need Blender installed.

---

# Batch 2 — T05, T06, T07 (14 Nov 2026)

Prerequisites confirmed before starting: `npm run check` green (18 tests), `npm run geometry` 23/27 with the four recorded source flags, no tracked input modified.

Resolution of the remaining T01 findings: F6 token drift resolved in T07 (below); F7 fonts measured in T07 (170,448 bytes); F8 confirmed: no real make/model enters SIM fixtures (tested).

## T05 — Typed fixtures and provenance validation

Status: complete.

### Files

- `src/domain/types.ts`: Source, Slip, Vessel, Agreement, DocumentSummary, Observation, Movement, Verification, IdentityDecision, ReviewIssue, DockCheckTask, AuditEvent, Actor, StagedEvidence, EvidenceAsset, SourceStatusEvent, ScenarioDefinition, FixtureBundle. `src/domain/session.ts` holds DemoSession.
- `src/domain/provenance.ts`: DOC/ASSUME/SIM/FIELD plain-language definitions. `src/domain/time.ts`: UTC storage, America/New_York display.
- `src/data/generate.ts`: deterministic seeded generator (`harbor-desk/b12-v1`). Canonical PRD §7 records are fixed literals.
- `src/data/slips.ts`: reads the **original** `data/slips.geojson` properties without renumbering. Geometry stays in the scene layer.
- `src/domain/validate.ts`: validation, quarantine and fatal handling. `src/data/assemble.ts`: schema checks, cascade quarantine, deep-freeze. `src/data/fixtures.ts`: Vite entry.
- `scripts/generate-fixtures.ts`: `npm run fixtures` writes; `npm run fixtures:check` fails on drift or on any validation error.
- `data/fixtures/*.json` (12 generated files, 224 KB on disk): 48 vessels, 46 agreements (44 seasonal, 2 transient; 2 vessels have no agreement), 96 document records, 420 camera observations, 9 movements, 44 staff verifications, 1 source-status event, 2 evidence items, 11 sources, 3 actors, scenario.

### What the data says (all SIM unless stated)

- **Scenario.** 15 Jul 2026 (EDT). Checkpoints 08:45 / 09:12 / 09:13 / 09:18 / 09:20.
  - Lake Effect V-021: 29 ft cabin cruiser, B-12, registration ending 42 AB, departed 08:10.
  - Harbor Light V-022: 27 ft, B-14, departed 08:30.
  - River Run V-023: 24 ft center console, B-10, staff check 08:40.
- **The 09:12 observation.** C-02 observation `OBS-S4K22B` (opaque ID), present at B-12, candidate V-022 only, with evidence asset `ev-7k2q`.
- **Staff evidence.** `EV-STAFF-0918` is staged and revealed only by the scenario control.
- **Wider marina.**
  - Simulated cameras: C-01 covers Dock A, C-02 B-01…B-19, C-03 B-20…B-37 and Dock D, C-04 Docks C and E. **C-04 is offline from 07:05**, so stale data shows up in the seed itself.
  - Samples are at 06:50, 08:45, 09:12 and 09:18. Two glare readings (`unknown`) occur at 08:45.
  - A 07:30 staff dock walk confirms the identities of vessels present at that time.
  - Seven departures are logged and two transients arrive.
- **Plausibility.** Every LOA is within its slip's assumed length class, and beam ≤ slip width − 1.5 ft. This is not a berth-fit engine.
- **Owners** are codes (“Private owner O-021”), never personal names. Registration, documentation and HIN are separate fields; unknown values are `null`, so the UI shows “Not recorded”.

### Checks run

`npm run fixtures:check` (byte-identical regeneration; validation `ok`, 0 fatal / 0 errors / 0 warnings). `tests/unit/fixtures.test.ts` (16 tests):
- the 126 slip IDs keep their original order;
- determinism;
- the canonical records, with DESIGN §12's 32 ft / B-14 / NY-4471-RB / real make absent;
- unique active assignments, and LOA within class;
- mixed presence states, opaque IDs, provenance on every record;
- deep-freeze;
- quarantine of missing provenance;
- cascade quarantine of a broken reference;
- duplicate assignment, timestamp order, a fatal canonical tamper, and a fatal missing file.

### Limitations / assumptions

- Fixtures live in `data/fixtures/`, not DESIGN §15's `data/vessels.json`. Keeping one file per entity makes them reviewable.
- Docking distribution, camera coverage, departures and the 07:30 walk are ASSUME/SIM choices made for a credible demo.
- Evidence images `ev-7k2q` / `ev-p3m8` are manifest entries with `status: planned`. The files do not exist yet (T09/T11); every evidence item carries alt text so text evidence works without them.
- Degraded and fatal loads show an isolated notice in the shell (wired in T07). This is unit-tested at the loader; it has **not** been exercised in a browser with corrupted bundled fixtures.

## T06 — Scenario state engine

Status: complete.

### Files

- `src/domain/engine.ts`: pure `apply(fixtures, session, command)`. Commands: select, advanceToUncertain, requestDockCheck, loadDockCheckResult, openReview, cancelReview, acknowledgeEvidence, confirmIdentity, and setSourceStatus (a scenario/test control for T18).
- `src/domain/selectors.ts`: one source of truth for the UI and the scene:
  - slipPresence (current / stale / unknown, plus last reported presence);
  - slipIdentity (derived from the current presence run; candidates never count);
  - vesselLocation (never from candidates);
  - bookability (assigned → No; unassigned → “not assessed”, never “available”);
  - issue, task and evidence selectors, confirmBlocker (the shared guard), scenarioStage, datasetSummary, activityTrail.
- `src/domain/replay.ts`: snapshots rebuilt from the seed by the canonical script.
- `src/domain/persistence.ts`: versioned `harbor-desk:session`, probe-based localStorage/memory choice, discard on corrupt, incompatible or inconsistent data.
- `src/domain/store.ts`: interactive run and replay view kept separate; startBranch (“Try this state”), restart. Only the interactive run is persisted.

### Decisions

- Freshness: camera reports are fresh for 5 virtual minutes (PRD). Staff verifications are fresh for 60 minutes, a demo policy (ASSUME), so 09:18 is still recent at 09:20.
- A source outage takes effect strictly **after** its timestamp, so an outage logged at 09:12 does not retract the 09:12 frame already delivered.
- Confirmation appends a Verification (09:18, staff), an IdentityDecision (09:20, Demo dockmaster), task completion and three audit events in one new session object. Repeating it is a no-op.
- A request after the staff evidence is loaded is rejected (`staff_evidence_already_available`). A duplicate request returns the existing task with no new audit event.
- Agreements are not part of the session at all, so no command can change one.

### Checks run

`tests/unit/engine.test.ts` (29 tests) and `tests/unit/time.test.ts` (2). Every PRD §7 invariant and every TASKS T06 case has a test:
- the five stages, plus the direct path;
- B-12 never bookable;
- Harbor Light's location and every agreement unchanged after every command;
- observations untouched;
- evidence and acknowledgement both required;
- a camera-only candidate cannot resolve the issue;
- idempotent confirmation; a duplicate request creates one task;
- cancel/back leaves the issue unchanged;
- no auto-resolution on reload or selection;
- no future leakage into snapshots; replay is read-only and isolated; branch and restart behave as specified;
- an offline/stale camera gives unknown, not empty, and keeps the last report;
- a recent staff verification survives a camera that is offline before 09:18;
- glare counts as unknown;
- no early identity leak in the session;
- inputs are never mutated;
- persistence: round trip, corrupt, incompatible, inconsistent references, and a throwing write that falls back to memory;
- the domain and data code never reads the wall clock.

I strengthened one test after a first run: the camera-offline case originally put the outage after the 09:18 frame, which made it weaker than its name.

### Limitations

- The engine covers the single canonical B-12 scenario (PRD scope). Other slips never open issues.
- Persistence is a prototype convenience, not a secure or multi-user audit store.

## T07 — Tokens, local fonts, accessible primitives

Status: complete, with the contrast limitation noted.

### Files

- `design/tokens.json` and `design/tokens.css` (reconciled; see below). `scripts/build-tokens.ts` with `src/ui/tokenCss.ts` produces `src/ui/tokens.css` (`npm run tokens`, `npm run tokens:check`).
- `public/fonts/`: five byte-identical font copies plus `IBM-Plex-OFL.txt`. `src/ui/fonts.css` declares those five faces only. `public/assets/icons-vessels.svg` and `public/favicon.svg` are unchanged copies.
- `src/ui/base.css`, `Button.tsx` (Button, IconButton), `Fields.tsx` (TextField, SearchField, Checkbox), `Tabs.tsx` (Tabs, SegmentedControl), `Status.tsx` (StatusPill, Tooltip, ProvenanceTag, Notice, EmptyState, KpiTile), `Announcer.tsx`, `icons.tsx`, `Lockup.tsx` (approved logo G geometry), `contrast.ts`.
- `src/ui/gallery/` is a QA surface at `/?ui=primitives`: every primitive in dark and light, plus glass over worst-case backdrops and a solid-panel toggle. It is lazily loaded (3.7 KB gzip) and not linked from the product.
- Shell (`src/app/Shell.tsx`, `AppStore.tsx`, `shell.css`):
  - lockup, “Buffalo River · Independent concept”, and a labelled **simulation** time (no “Live”);
  - SIM/ASSUME flags;
  - **derived** dataset tiles: 126 assumed slips, 48 simulated vessels, Needs review 0;
  - data and storage notices, and attribution.

  The 3D scene is still the T04 placeholder.

### Token reconciliation (JSON canonical)

- `_meta.project`: “working name TBD” → Harbor Desk.
- Light `text-muted`: `{ink-300}` (3.47:1, fails) → `#5d6c7b`, the value the CSS already used.
- Values that existed only in the CSS are now also in JSON: `*-fill` states, per-theme shadows, `space.0`, reduced-motion durations.
- New tokens: `state-review` (amber; not the orange selection colour), `focus-halo` (white), and `color.review-dark #8a5a00` (DERIVED).
- **Deliberate deviation:** dark `bg-panel` opacity raised from 0.72 to **0.84**. The worst-case backdrop is panel glass over a white hull.

  | Text role | at 0.72 | at 0.84 |
  |---|---|---|
  | Review amber | 3.77 | 5.79 |
  | Underway cyan | 4.12 | 6.33 |
  | Overdue | 4.15 | 6.38 |

  Revert in `tokens.json` if the real scene proves darker. DESIGN.md §2.2 prose still says 72%; I did not edit DESIGN.md (see the concurrent session note below).
- The `design/tokens.css` ↔ `tokens.json` sync test passes for every token in all four blocks. The stale DESIGN prose values (silo-concrete `#8f8b84`, light nav-aid `#d7007a`) are superseded by the JSON values.

### Concurrent session

Another session committed `4515d680` (“Measure the winter palette…”) at 12:07 while T07 was in progress. It modified DESIGN.md, `design/tokens.json`, `design/tokens.css` and vessel-card.html. That commit **includes my uncommitted T07 token edits**, because both sessions edited the same files. Both sets of changes are intact (sync test green), and the light canvas is now `snow-canvas #f2f5f8`. I regenerated `src/ui/tokens.css` and pointed the light-theme contrast test at the token canvas. This session made no commits.

### Rules adopted from the contrast measurements

- `--text-muted` is decorative only: it never reaches AA on glass, in either theme.
- Orange is never used as text on glass. SIM tags keep an orange **border** with text-safe lettering, a deviation from DESIGN §12's tag CSS.
- The focus ring is a 2 px blue outline with a 2 px white halo (blue ring 4.88:1 against the halo; halo ≥ 3:1 against the darkest glass).
- Only the loaded weights are used. h3 renders at General Sans 600 instead of DESIGN's 500, to stay within the font budget.

### Checks run

- Unit tests:
  - `tokens.test.ts` (4): generated CSS equals the JSON output; design CSS ↔ JSON sync; stale aliases resolved; review colour is non-orange;
  - `contrast.test.ts` (5): AA for essential roles over worst-case composites, dark and light; documented non-text-safe roles; button text; focus ring; solid fallback;
  - `assets.test.ts` (3): font copies byte-identical, exactly five faces totalling 170,448 bytes, no remote URLs, sprite unchanged.
- Browser, production build (`npx playwright test`, 11/11):
  - shell: labels, simulation time, derived counts 126/48/0, no “Live” text, canvas mounts, **zero console errors, zero non-local requests**;
  - fonts: exactly the five `/fonts/` faces, **170,448 bytes** measured, buttons in Switzer;
  - gallery renders with no console errors;
  - keyboard: tabs (←/→/Home), segmented control (arrows), search (Escape clears), checkbox (Space), tooltip on focus (aria-describedby; Escape dismisses), focus-ring colours;
  - loading button: busy, disabled, width locked, accessible name retained;
  - hover: signal → signal-light; disabled unchanged;
  - solid-panel fallback;
  - reduced motion: camera 0, micro 0, panel 100 ms;
  - corrupt storage gives a notice and a fresh start; unavailable storage falls back to memory with no errors;
  - a failed 3D chunk recovers via “Try again”.
- Visual inspection in the in-app browser at 1440×900:
  - gallery: brand and type, buttons, fields, navigation, pills and tags, notices and tiles, glass strip, in both themes;
  - focus ring and tooltip on glass;
  - shell with placeholder scene;
  - exactly five font faces loaded.

### Defects found and fixed in this batch

1. **Lazy-load retry (T04 prerequisite).** “Try again” in the 3D region could never recover, because React caches a rejected `lazy()` import. `ErrorBoundary` now takes `onReset`, and the shell creates a fresh lazy import per retry. Covered by a browser test.
2. **Busy-button name.** Hiding the label with `visibility: hidden` removed the button's accessible name while busy; `opacity: 0` keeps it.
3. **Unit tests typechecked under the wrong config.** They import Vite modules but were checked under the Node tsconfig. They now have `tsconfig.unit.json`, and `tsconfig.node.json` covers only scripts and e2e.
4. **Dev server.** It had run since before the `npm ci` reinstall and served outdated pre-bundled dependency hashes (HTTP 504). Restarting it fixed this; it was an environment issue, not a code defect.

### Limitations

- **Contrast** is computed against defined worst-case backdrops, not measured on the rendered 3D scene, which does not exist yet. Re-measure in T08/T17.
- No automated accessibility scanner (axe) has run, and no manual screen-reader pass has been done. Both belong to T17.
- The gallery ships in the production build behind `?ui=primitives`. Remove it in T23 if it is not wanted.
- The KPI tile labels wrap onto two lines at the 160 px DESIGN width. They are legible; revisit with the full layout in T10/T17.

## Command summary after Batch 2

`npm run check` = tokens:check → fixtures:check → typecheck → lint → unit tests → build. Final run: **all green; 77 unit tests in 9 files**. `npx playwright test`: **11/11**. `npm run geometry`: 23/27 (unchanged source findings). Gzip build sizes: shell JS 100.4 KB (includes fixtures), scene chunk 247.3 KB, CSS 4.6 KB, gallery 3.7 + 0.5 KB.

## Starting point for Batch 3 (T08, then T10)

Do T08 first: T10 depends on T08 for scene↔list agreement. List and inspector pieces that do not touch the scene can start alongside.

**T08 — Dock B scene and camera**

- Replace the placeholder `src/scene/SceneRoot.tsx`. Keep it lazily loaded through `Shell.tsx`'s retryable `lazy`.
- Geometry inputs:
  - `data/derived/site-local.json`: `slips[].derived.corners/innerMid/outerMid/headingDeg`, `headwalks`, `landMasks` (with documented-water `holes`), `cityShipCanal`, `masses`, `lines`;
  - `src/scene/geo.ts` `localToScene`: x east, y up, z = −north.
  - Add a trimmed runtime loader (e.g. `src/data/site.ts`); do not ship the raw 153 KB.
- Water is a plane at y = 0 with land masks over it (`data/GEOMETRY-VALIDATION.md`). B-12's centroid is (−4.9 E, −1.3 N) and it opens toward bearing 59°.
- Selection: `useStore().dispatch({ type: 'select', selection })`. The camera never dispatches. Distinguish click from drag, and stop UI events from picking through panels.
- Draw a vessel only where `slipPresence(...).lastReported?.presence === 'present'`, with stale/unknown styling. Never draw a phantom for an away vessel.
- The observed hull at B-12 must carry generic names only (inv. 10).
- Use `--t-camera` / `--e-camera` timing; reduced motion turns travel into cuts (already zeroed in tokens). No Drei `Environment` presets and no `<Text>` without a local font (design/ASSET-PLAN.md).

**T10 — Selection, registry and inspector**

- Build from the selectors in `src/domain/selectors.ts` (`slipPresence`, `slipIdentity`, `vesselLocation`, `bookability`, `activeAgreementFor*`, `documentsForVessel`, `latestIssueForSlip`, `datasetSummary`) through `useAppState()` / `useStore()` in `src/app/AppStore.tsx`. Use the T07 primitives (Tabs, SearchField, StatusPill, ProvenanceTag, Notice, EmptyState, `.panel`).
- Still to build: search normalization (B12 → B-12), the dock and needs-review filters, and 44 px rows.
- The search index and accessibility text must not include candidate identities (inv. 10).
- Copy rules: `--text-muted` is decorative only; never orange text on glass.

---

# Batch 3 — T08, T10 (14 Nov 2026)

Prerequisites confirmed before starting: `npm run check` green (77 unit tests), `npx playwright test` 11/11, and no new commits from other sessions since `4515d680`. Domain model, state transitions and tokens are unchanged; Batch 3 only adds view models and UI on top of the existing selectors.

## T08 — Dock B scene, camera system, picking

Status: complete for the Dock B slice. The boats and materials are **placeholders** (see Visual placeholders below).

### Files

- `scripts/build-site-runtime.ts` → `data/derived/site-runtime.json`: 35 KB raw, 11 KB gzip, trimmed from site-local.json. It is part of `npm run geometry`. `src/data/site.ts` loads it; `src/data/docks.ts` holds `MODELLED_DOCKS = {B}`.
- `src/scene/layout.ts`: pure Dock B math (deck strip, fingers, boat placement, footprints).
- `src/scene/hulls.ts`: which hull a slip shows (rules below).
- `src/scene/camera.ts`: presets, slip framing, DESIGN camera easing, bounds.
- `src/scene/viewRequests.ts`: DOM → scene preset requests.
- `src/scene/shapes.ts`: ring → shape, prism, ribbon.
- `src/scene/palette.ts`: token-backed colours plus clearly marked PLACEHOLDER colours.
- `src/scene/Environment.tsx`:
  - water plane, and the three land masks with documented-water holes;
  - OSM yards, roads, and the Skyway deck at 30 m (ASSUME);
  - grain elevator 32 m, service building 7 m, small building 4.5 m (heights ASSUME);
  - sun with shadows, hemisphere light, fog.
- `src/scene/DockB.tsx`: headwalk deck (2.4 m wide, 0.45 m freeboard, ASSUME), instanced fingers and piles, selectable berth meshes for all 37 Dock B slips, placeholder boats, hover outline (cyan), selection outline (orange, drawn over hulls), and DOM markers.
- `src/scene/Boat.tsx`: placeholder cruiser, console and sail families sized from LOA and beam.
- `src/scene/CameraRig.tsx`: camera rig, described under Camera behaviour.
- `src/scene/DebugBridge.tsx`: `?debug`-only, read-only test bridge (projection, raycast names, camera pose).
- `src/scene/SceneRoot.tsx`: `frameloop="demand"`; the canvas is `aria-hidden`.
- `src/features/view/ViewControls.tsx`: Overview / Dock B / Top-down presets and Reset.

### Camera behaviour

- **User control:** camera-controls with bounds, a 12–1500 m distance range and an 80° polar limit.
- **Fly-to:** a 700 ms flight with DESIGN's `cubic-bezier(.83,0,.17,1)` easing, always starting from the **current** pose. A new request replaces the running flight, and any user input cancels it.
- **Reduced motion:** an immediate cut.
- **Selection drives the camera; the camera never writes selection.**
- **Framing:** a projection view-offset of half the rail width (200 px) keeps the target clear of the inspector.
- **Presets:** viewed from the water to the north-east, as in v2. Top-down is north-up.

### Scene rules

- Hulls are drawn only where the last report said “present”. Stale reports are drawn faded, never removed.
- A registry record alone never creates a boat. **Harbor Light (away) is never drawn at B-14.**
- The B-12 observed hull is a generic slip-class cruiser with the *sand* cover (“cover differs from the cover on record”). **The same hull and key persist through resolution**, so it is relabelled, not moved or reshaped (unit-tested).
- Object names are generic (`hull`, `berth`), never a vessel identity. Hover and marker labels come from `markerLabel()`, which never names an unverified hull.
- Click vs drag: R3F `e.delta > 5 px` is a drag and never selects. Empty berths are selectable meshes. Panels are DOM siblings above the canvas, so their events never reach it.

## T10 — Selection, registry, inspector

Status: complete for the desktop rail.

### Files

- `src/features/registry/model.ts`: pure view models over the shared selectors.
  - `parseQuery`: B12 / b 12 / B-012 → B-12; V21 → V-021.
  - `slipRows` / `vesselRows`: search keys are the slip ID plus the **assigned** vessel; candidates are never keys. Dock and needs-review filters.
  - Badges, `markerLabel`, `slipInspector`, `vesselInspector`, `frameTarget` (an away vessel frames its assigned berth).
- `RegistryContext.tsx`: UI-only query, filters, tab and list-open state.
- `RegistryList.tsx`: Slips/Vessels tabs with live counts, a dock select, the needs-review filter, and a single-tab-stop **listbox**. ↑/↓/Home/End move, Enter/Space select, rows are 44 px, the selected option follows the shared selection, and there is a no-results state with “Clear search and filters”.
- `Inspector.tsx`: inspector content, described below.
- `registry.css`.
- Shell (`src/app/Shell.tsx`):
  - top-bar search, where Enter jumps to an exact match;
  - right rail (inspector above a collapsible list, never overlapping, with the inspector given priority);
  - `?select=` deep link, with a recoverable “No slip or vessel ‘Z-99’” state;
  - polite announcement of each selection.

### Inspector content

**Slip view**, in PRD §6 order:
1. Slip ID, issue pill, close button.
2. Assigned vessel (link) and agreement.
3. Latest observation, “separate from the registry”: presence, source and time, freshness, camera offline (“does not mean empty”), identity state. Where the identity is unverified, a dashed **“Possible match (candidate only, not an identity)”** link and the reason for doubt.
4. *(Workflow actions: Batch 5. Intentionally absent, with no placeholder buttons.)*
5. Presence / Agreement / Bookable summary, plus an expandable slip-details section.

**Vessel view:**
- Last confirmed activity: an away vessel shows “Assigned berth B-14 · last confirmed away”.
- Assignment, particulars (“Not recorded” for unknowns).
- **Identifiers: Registration, Documentation and HIN as separate rows.**
- Document review, with “not a compliance determination”.

## Checks actually run

| Check | Result |
|---|---|
| `npm run check` (tokens, fixtures, typecheck, lint, unit, build) | Green. **102 unit tests in 12 files** (was 77) |
| New unit tests | `registry-model.test.ts` (16), `scene-layout.test.ts` (5), `camera.test.ts` (2) |
| `npx playwright test` (production build) | **21/21**, of which `scene.spec.ts` is 10 |
| `npm run geometry` | 23/27, unchanged; site-runtime regenerated |

What the unit tests cover:
- search normalisation and prefix matching;
- candidate never matches B-12;
- filters and the empty result;
- the inspector across normal, uncertain and resolved stages;
- unassigned slips “not assessed”, offline camera ≠ empty;
- marker labels never name the hull;
- Registration and HIN are separate;
- Harbor Light stays at B-14, away, at every stage;
- an away vessel frames an empty berth;
- the observed hull is unchanged after resolution;
- every placeholder hull fits inside its berth, and the deck never covers more than 0.6 m of a berth;
- palette matches tokens;
- the easing curve, and B-12 framed from the water side.

The `scene.spec.ts` journeys use **real mouse events on the real canvas**:
1. **Overview:** nothing selected, canvas `aria-hidden`.
2. **Empty berth:** clicking the empty B-12 berth selects it. Inspector shows “No vessel present”, Bookable No, Lake Effect as the assignment; list option selected; marker “B-12 · Empty · assigned”.
3. **Drag:** a drag across B-14 moves the camera, and selection stays null.
4. **Interruption:** a fly-to interrupted mid-flight (verified in-page at 15–85% of the path) ends at A-03 with exactly two flights started.
5. **Reduced motion:** the camera cuts straight to the target.
6. **Panel isolation:** B-12's berth is placed geometrically *under* the registry panel (raycast confirms `berth`); clicking there does not select it, and no canvas click is recorded.
7. **Keyboard:** search “B12” + Enter selects B-12; listbox ↓ + Enter selects B-13; the camera follows; the announcer says “Slip B-13 selected”.
8. **Uncertain hull:**
   - after `advanceToUncertain`, Needs review = 1;
   - hovering the hull shows “B-12 · Vessel present · identity unverified”, and clicking it selects the **slip**;
   - the inspector shows C-02 · 09:12 and the possible-match link;
   - searching “Harbor Light” lists only B-14;
   - the link opens Harbor Light's record, the camera frames B-14, the marker reads “B-14 · Assigned berth · last confirmed away”, and the raycast at B-14 hits `berth` (no phantom boat);
   - the agreement is still B-14.
9. **Recovery:** the invalid deep link Z-99 recovers, and no-results recovers.
10. **Deep link and filters:** the V21 deep link opens Lake Effect's record (registration and HIN rows present). Dock B gives 37 slips; needs-review is empty, then shows only B-12 after the scenario advances.

### GPU vs software rendering (stated precisely)

- **Real GPU (in-app browser, “ANGLE Metal Renderer: Apple M3 Max”).** Rendering and one real canvas click on the **empty B-12 berth** were verified (`delta 0`, inspector + outline + marker + list synchronized). Capture: `qa/batch3/gpu-pane-b12-click-selected.jpg`. The pane was hidden during the session, so the browser throttled `requestAnimationFrame` to about 2 frames per 1.5 s. Further interaction checks there were unreliable (camera matrices lagged), so I did not use them as evidence.
- **Headless Chromium (Playwright) renders through “SwiftShader”, a software renderer.** The full interaction suite above ran there: real WebGL, real three.js raycasting, real DOM events, but **not GPU validation**.
- No frame-rate or performance claims are made (T16).

## Screenshots (1440 × 900, production build, SwiftShader)

- `qa/batch3/overview.png`: overview preset, nothing selected.
- `qa/batch3/b12-selected-normal.png`: 08:45, empty B-12 selected; outline, marker and inspector.
- `qa/batch3/b12-selected-uncertain.png`: 09:12, observed hull at B-12 selected. “Vessel present · identity unverified”, possible match Harbor Light, Needs review 1.
- `qa/batch3/gpu-pane-b12-click-selected.jpg`: real-GPU in-app capture (800×500, downscaled by the pane).

## Visual placeholders remaining (not the approved v2 target)

- Boats are extruded hull outlines with box cabins, canvas, console and T-top, and cylinder masts. There are no rails, cleats, glazing detail, LODs or clearcoat.
- Decks are flat `sand-dark` prisms with no planks. Piles and fingers are plain. There are no pedestals, cleats or gangway geometry.
- Land is one flat grass colour; yards, roads and storage are flat paving/asphalt. There is no revetment, vegetation, fences or trees.
- The grain elevator and other buildings are extruded footprints with unsourced heights. The Skyway is a flat slab. The north bank and peninsula are bare masks.
- Water is a flat, static material: no ripple, reflection or depth tint.
- Lighting is one sun plus hemisphere, with no AO or contact shadows. The sky is a flat colour.
- The simulated-object dashed contour (PRD §6) is not drawn yet.

## Defects found and fixed in this batch

1. **Wrong server under test.** Port 4173 was occupied by **another project's preview** (your portfolio site), and Playwright's `reuseExistingServer` silently tested it during a probe. Harbor Desk's preview now uses dedicated port **4719** with `--strictPort` and `reuseExistingServer: false`. I did not touch the other server. The earlier Batch 2 runs asserted Harbor Desk-specific content, so they did run against this app.
2. **Dev server re-optimised dependencies mid-session** after the new Drei/camera-controls imports, leaving duplicate React copies (“Invalid hook call”). `optimizeDeps.include` now pre-bundles the 3D stack, and the server was restarted.
3. **CSS cascade order:** `main.tsx` imported `App` before the global CSS, so `.panel` overrode component styles. Global CSS is now imported first.
4. **Selection outline hidden under hulls:** it is now drawn with `depthTest: false`.
5. **Inspector header:** the base `.panel > header` flex rule overrode its layout; the specificity is raised.
6. **Rail:** the inspector content was below the fold; the inspector now has priority and the list is capped at 30% while details are open.
7. **Debug store handle:** it pointed at StrictMode's discarded initializer instance; it is now set in an effect.
8. **React Compiler lint:** three setState-in-effect patterns were replaced with derived state and a store subscription.
9. **Investigated and not kept:** a speculative “initial frames” fix for a blank dev canvas. The real cause was the hidden pane throttling `requestAnimationFrame`, not the app.

## Known limitations

- **Coverage:**
  - only Dock B is modelled (T14); other slips draw an outline and marker when selected, and the inspector says so;
  - desktop rail only: the ≤1280 px tabs/back navigation and the mobile plan/list are T17;
  - water is static, so there is no pause-motion control yet (T17).
- **Inspector:**
  - at 900 px tall the full slip inspector needs a short scroll;
  - long vessel names truncate in rows that carry two pills.
- **Interaction:**
  - selecting a vessel without an agreement (V-047/V-048) does not move the camera;
  - camera bounds are set and the presets are unit-tested inside them, but user panning against the bounds was not exercised in a browser.
- **Shipped test hooks:** the `?debug` bridge (read-only scene helpers plus store access for scenario setup) ships in the production bundle and is inert without the flag. Revisit in T23.
- **Bundle size (gzip):** shell 108 KB (includes fixtures; geometry lives in the scene chunk), scene 279 KB. Not yet measured against the budget (T16).

## Starting point for Batch 4 (T09)

T09 replaces the placeholders without changing behaviour:

- **Swap the boats, keep the interface.** Replace `src/scene/Boat.tsx` with the detailed parametric families from design/ASSET-PLAN.md (hero cabin cruiser first, then console and sail). Keep:
  - the `Boat({ spec, placement, onSelect, onHover })` interface;
  - `HullSpec` (`src/scene/hulls.ts`) and `placeBoat` (`src/scene/layout.ts`);
  - the B-12 `observed:B-12` hull with its **sand** cover, and the same key and geometry after resolution;
  - generic object names, never a vessel identity.
- **Docks and materials.** Detail `DockB.tsx` (planks, cleats, pedestals, gangway at the B run break near map marker 5, revetment) and replace the `PLACEHOLDER_COLORS` in `src/scene/palette.ts`. Keep the berth meshes as the pick targets.
- **Lighting, water and contour.** Add contact shadows/AO, water and a sky in `Environment.tsx`, with no remote HDRI (locally generated environment only). Add the dashed simulated-object contour.
- **Tests that must keep passing:**
  - `scene-layout.test.ts` (hulls fit berths, deck clearance);
  - `registry-model.test.ts` (same hull after resolution);
  - `scene.spec.ts`: the hull point must still raycast to a hull mesh first, and B-14 to `berth`. If you name meshes, update the `'Mesh'` expectation, but never to a vessel name.
- **Measure and compare.** Re-capture `qa/batch3/b12-selected-*.png` and compare with `design/visual-target-v2.png`. Record the first size and performance measurements in the asset manifest.

---

# Batch 4 — T09 (14 Nov 2026)

Scope: T09 only. Nothing from T11 onward was started, and nothing was deployed, published or committed.

**Before replacing anything**, Batch 3 was confirmed on the untouched tree: `npm run check` green and `npx playwright test` 21/21 (scene, camera, selection, inspector).

## T09 — Representative boat and dock assets

Status: complete. The acceptance check is a visual judgment, so the evidence and the remaining gaps are listed plainly below.

### What was built

**Boats** (authored parametric geometry, one draw call each):

- **Cabin cruiser** — the B-12 observation hull and every other cruiser.
  - Lofted planing hull: flare, a chine that rises to the bow, raked stem, boot stripe at the waterline, antifoul below it, accent stripe and hull-side portlights laid on the hull surface.
  - Crowned foredeck and cabin trunk with two deck hatches.
  - Wrapped, raked windshield with an alloy frame and mullions.
  - Cockpit well with coamings, sole, cabin bulkhead, companionway door, helm seat, lounge, stern bench and wheel.
  - Camper canvas with scalloped bows and clear-vinyl side and aft panels. Without canvas: a radar arch with dome and light mast.
  - Bow rail with stanchions, cleats, bow roller and anchor, fenders with lanyards, swim platform, rub rail.
- **Small powerboat** — a center console: open liner with a raised casting deck, console and windscreen, leaning post, bow and stern cushions, T-top on a tube frame (canvas or moulded), rod holders, antenna, low bow rail, and one outboard (two from 27 ft).
- **Sailboat** — round-bilged hull with a spring sheer and counter stern, cabin trunk with portlights and sliding hatch, cockpit well with coamings, wheel or tiller, winches, mast with spreaders, boom under a sail cover, furled headsail, forestay, backstay and shrouds, pulpit, pushpit and lifelines.

**Dock B** (one merged mesh plus instanced piles):

- Planked headwalk and fingers, pale bumper strip on the fingers, fascia boards, inset flotation that leaves a shadow line.
- Piles with a darker splash zone and pale caps, galvanized guide hoops, anchor piles behind the headwalk.
- Cleats on the fingers and on the headwalk edge at every berth; one shore-power pedestal per two berths (ASSUME).

**Immediate context** (only what the dock needs to be judged; ASSUME placement):

- Revetment rock on the bank, a promenade strip, a lawn verge, lamp posts, a gangway at the B run break (2022 map marker 5, ±10 m) and two loose rows of simplified trees that avoid mapped buildings and roads.
- The verge and front tree row overlap the edge of the digitized storage hardstanding. That is a visual assumption for this section, not a claim about the site; T15 owns the yard.

**Light, water, materials:**

- One sun with a single shadow map that refits to the camera target (about 3 cm texels at the slip view), a hemisphere fill, and an analytic sky reflection evaluated in the shader.
- Calm water: teal-grey body colour, static procedural ripples, sky fresnel, receives shadows; a soft contact patch under each hull.
- Neutral tone mapping, so token colours are not shifted the way the default filmic curve shifts them.

### Files

| File | Role |
|---|---|
| `src/scene/assets/mesh.ts` | Mesh builder: grids, tubes, pillows, decals, per-vertex colour and finish, deterministic PRNG |
| `src/scene/assets/hull.ts` | Hull as a function of station and height (power and sail forms) |
| `src/scene/assets/cruiser.ts`, `console.ts`, `sailboat.ts` | The three boat families, each at three detail levels |
| `src/scene/assets/dock.ts` | Dock structure, pile, gangway, rock, tree, lamp post |
| `src/scene/assets/finishes.ts`, `parts.ts`, `boat.ts` | Finishes, cleat/fender, entry point with cache and LOD distances |
| `src/scene/materials.ts` | Shared surface material, plank texture, analytic sky, sun direction, contact shadow |
| `src/scene/Boat.tsx` | Replaced. Same `Boat({ spec, placement, onSelect, onHover })` interface; picks detail by camera distance |
| `src/scene/DockB.tsx` | `Decking` rebuilt on the generators. Berth meshes, picking, outlines and markers unchanged |
| `src/scene/Shore.tsx` | New: shoreline context |
| `src/scene/Environment.tsx` | Sun, fill, water; land colours |
| `src/scene/palette.ts` | `SCENE_COLORS` replaces the placeholder set (old export name kept as an alias) |
| `src/scene/SceneRoot.tsx`, `DebugBridge.tsx` | Tone mapping; `stats()` and `timeFrames()` on the `?debug` bridge |
| `scripts/export-assets.ts`, `capture-scene.ts`, `measure-scene.ts`, `compare-v2.ts` | Regeneration, capture, measurement, comparison sheet |
| `tests/unit/boat-assets.test.ts`, `tests/e2e/scene.spec.ts` | 20 new unit tests, 2 new browser journeys |

Not changed: `src/domain/**`, `src/data/**`, fixtures, `hulls.ts`, `layout.ts`, `camera.ts`, `CameraRig.tsx`, the registry and inspector. **Assignments, observations and slip coordinates are untouched**; `fixtures:check` and `scene-layout.test.ts` still pass unmodified.

### Editable sources and regeneration

The generators in `src/scene/assets/*.ts` are the editable source, and the app runs them directly. There is no exported binary in the runtime path.

| Command | What it does |
|---|---|
| `npm run assets` | Runs the generators in Node and rewrites `data/derived/asset-report.json` |
| `npm run assets:check` | Fails if the report and the generators disagree (now part of `npm run check`) |
| `npm run assets:glb` | Writes inspection copies to `design/assets-export/*.glb` (1.49 MB, not shipped) |
| `npm run capture -- --gpu --stage uncertain --select B-12 --out <png>` | Staged screenshot |
| `npm run measure -- --gpu --out qa/batch4/perf-gpu.json` | Draw calls, triangles, frame pacing |
| `node scripts/compare-v2.ts <capture> <out>` | Side-by-side sheet against v2 |

Conventions, authorship, rights and measured sizes are in [design/ASSET-PLAN.md](design/ASSET-PLAN.md), “T09 asset manifest”. In short: authored here, nothing third-party, nothing downloaded at runtime.

### The uncertainty story

- The B-12 hull is still `observed:B-12`, a slip-class cabin cruiser with the **sand** cover; the vessel on record has a different cover. Unit-tested.
- A generator receives family, length, beam and two colours. Geometry names are `cruiser-lod0` and the like. A test reads every asset source file, `Boat.tsx` and the asset report and fails if any fixture vessel name, ID or registration suffix appears.
- The geometry object is **identical** before and after resolution (same cache entry), so confirming relabels the boat without swapping it. Unit-tested.
- B-14 stays empty at every stage. No away vessel is drawn. Unit-tested and raycast in the browser.
- A browser test hovers and clicks the hull at 09:12 and checks the marker text, the canvas attributes and **every network request**: no vessel name, no model or HDRI file, no non-local host.
- No name board or registration geometry exists yet, so nothing on the hull can be read. That is deliberate until T12.

### Screenshots

Production build, 1440 × 900 unless noted. “GPU” is headless Chromium on ANGLE Metal (Apple M3 Max); the others are SwiftShader.

| File | Content |
|---|---|
| `qa/batch4/b12-selected-uncertain-gpu-1440.png` | **Selected B-12 at 09:12 with the inspector** (the acceptance view) |
| `qa/batch4/b12-selected-uncertain-gpu-1600.png` | Same at 1600 × 1000 (PRD §11) |
| `qa/batch4/compare-v2.png` | **Side by side with visual-target-v2** |
| `qa/batch4/b12-selected-normal-gpu-1440.png` | 08:45, B-12 empty and selected |
| `qa/batch4/b12-closeup-gpu-1440.png`, `b12-from-dock-gpu-1440.png` | Close views from the water and from the headwalk |
| `qa/batch4/dock-b-gpu-1440.png`, `overview-gpu-1440.png` | Dock B preset (LOD 1) and overview (LOD 2) |
| `qa/batch4/b12-selected-uncertain-swiftshader-1440.png`, `e2e-*.png` | Software-rendered captures, including the ones the browser tests write |

Batch 3’s captures in `qa/batch3/` are kept as they were; the browser tests now write to `qa/batch4/e2e-*.png`.

### Comparison against v2

Worked in five capture rounds in the running app: proportions and placement first, then light and materials, then the selected view against v2, then fixes, then a final capture.

| Aspect | Finding |
|---|---|
| **Foreground detail** | Boats read as specific types at the working distance: hull form, windshield, canvas, rails and cockpit are all distinct. Less surface nuance than v2 (no gelcoat panel lines, no upholstery seams, no rope) |
| **Scale** | Real dimensions throughout: 28.5 ft cruiser in a 30 × 11 ft berth. The berths are tighter than v2’s illustrative spacing because the validated slip plan is kept |
| **Framing** | The selected boat fills about 75 % of the width it has in v2. The camera pose was left alone, since this batch replaces assets and the framing is tested behaviour |
| **Water** | Calm and restrained, teal-grey like v2. Flatter: no hull reflections beyond a soft contact patch, and no motion |
| **Shadows** | Soft cast shadows on decks, docks and lawn; contact patches on the water. Weaker than v2’s ambient occlusion in crevices and under trees |
| **Miniature character** | Present in the foreground. Dock planking, pile caps, pedestals and riprap carry it |
| **Surrounding context** | The largest gap. v2 has buildings, a gazebo, stored boats, the elevator and dense trees; this build has a promenade, lawn, a row of trees and flat hardstanding. T15 owns that |
| **Dock style** | Planked and narrow-fingered (DESIGN tokens and the assumed 0.6 m fingers); v2 shows wider, paler concrete floats |
| **Panel legibility** | The inspector, marker and counters stay legible over the new scene. Contrast was not re-measured on the composited pixels in this batch (T17) |

**Differences fixed between rounds:** washed-out exposure; glass rendering black; a radar arch poking through the canvas; ragged clear-vinyl panels; oversized dark deck hatches; revetment rock too large and dark; piles too tall; an empty beige background (lawn verge and trees added); royal-blue water (moved to teal-grey); shadows hidden behind hulls (sun turned so they fall across the fingers); shoreline strips overhanging the water at the dock’s end.

**My assessment:** the foreground meets “a detailed miniature above the midpoint toward realism” (about 6 on the 0–10 scale against the 6.5 target). The frame as a whole sits lower, around 5, until the surroundings exist. It is a judgment from captures, so it is worth your own look at `compare-v2.png`.

### Performance and size (preliminary)

These are first measurements toward the PRD §11 budgets for **one dock section with 15 boats**. They are not full-marina figures and not the 60-second release profile (T16).

**Conditions:** production build served by `vite preview`; headless Chromium 159 with `--use-angle=metal`; renderer string “ANGLE Metal Renderer: Apple M3 Max”; macOS 14.4; viewport 1440 × 900; scenario at 09:12; 20 warm-up frames; a 6-second ±25° orbit sampled with `requestAnimationFrame`. Raw data: `qa/batch4/perf-gpu.json`.

| View | DPR | Draw calls | Triangles | Hull detail | Orbit median | p95 frame | Max frame |
|---|---|---|---|---|---|---|---|
| Overview | 1.0 | 116 | 135,226 | 15 × LOD 2 | 59.9 fps | 16.7 ms | 16.8 ms |
| Dock B preset | 1.0 | 92 | 179,556 | 15 × LOD 1 | 59.9 fps | 16.8 ms | 33.3 ms |
| B-12 selected | 1.0 | 82 | 276,736 | 13 × LOD 0, 2 × LOD 1 | 59.9 fps | 16.8 ms | 16.8 ms |
| Overview | 1.75 | 116 | 135,226 | 15 × LOD 2 | 59.9 fps | 16.7 ms | 16.8 ms |
| Dock B preset | 1.75 | 92 | 179,556 | 15 × LOD 1 | 59.9 fps | 16.7 ms | 16.8 ms |
| B-12 selected | 1.75 | 82 | 276,736 | 13 × LOD 0, 2 × LOD 1 | 59.9 fps | 16.7 ms | 16.8 ms |

How to read it:

- Draw calls and triangles are for one frame **including the shadow pass**, so every shadow caster is counted twice.
- 59.9 fps is the display cap. The machine has headroom this test cannot see, so it says “no dropped frames here”, not how much margin there is.
- **The target device is an M1 MacBook Air. An M3 Max is several times faster, so the PRD frame-rate criterion stays open.**
- The back-to-back frame time in the JSON (0.2 ms) is CPU submission only: `gl.finish()` did not block on this backend. It is not a GPU time and is not used here.
- Against the budgets: draw calls 82–116 against “aim < 300”; the selected boat 8,155 triangles against a 40,000 ceiling.
- **Software rendering (SwiftShader), same build:** about 12 fps in the overview and 9 fps at the Dock B preset at DPR 1 (`qa/batch4/perf-swiftshader.json`). Several orbit runs captured too few frames to summarize. This is the floor for a machine with no GPU acceleration, and it is why the browser suite now takes about 58 s instead of 34 s.

| Size | Measured |
|---|---|
| Scene chunk, gzip | 294.0 KB (279 KB in Batch 3) |
| Scene chunk, raw | 1,080,447 bytes |
| Shell chunk, gzip | 108.1 KB (unchanged) |
| Model, texture, HDRI or decoder downloads | 0 |
| Fonts | 170,448 bytes (unchanged) |

### Checks actually run (final tree)

| Check | Result |
|---|---|
| `npm run check` (tokens, fixtures, **assets**, typecheck, lint, unit, production build) | Green. **122 unit tests in 13 files** (was 102) |
| `npx playwright test` (production build, SwiftShader) | **23/23** (was 21) |
| `npm run assets:glb` | Six GLB files written |
| GPU captures and `npm run measure -- --gpu` | Ran on ANGLE Metal / M3 Max, headless |

What the regressions cover after the swap:

- **Picking:** the hull point still raycasts to a hull mesh first; an empty berth still selects; B-14 still raycasts to `berth`.
- **Selection outline and marker:** still drawn for the empty and the occupied B-12, with the same text.
- **Camera framing:** poses, bounds, fly-to interruption and the inspector offset are unchanged and their tests pass unmodified.
- **Inspector synchronization:** scene click, list, search and deep link still agree.
- **Reduced motion:** the camera still cuts. A new test also shows the idle scene renders **no frames at all**, so there is no ambient motion to freeze.
- **Drag vs click, panel isolation, keyboard path, recovery states:** unchanged and passing.

**GPU verification, stated precisely:** rendering, captures and frame pacing were verified on a real GPU through headless Chromium. The interaction suite ran on SwiftShader only. Nobody clicked through the scene in a visible GPU browser window in this batch; the in-app pane was used for two early spot checks and then left, because it throttles rendering when hidden.

### Defects found and fixed in this batch

1. **NaN vertices at the bow:** floating-point rounding pushed a plan-form term fractionally past 1 and a fractional power returned NaN. Clamped; the asset tests now assert every vertex is finite.
2. **Cast shadows seemed to be missing.** They were rendering, but an environment map’s fill light flattened them and the rest fell on dark water or behind hulls. A difference image (shadows on minus shadows off) confirmed it. Fixed by dropping the environment map for a hemisphere fill plus an analytic sky reflection, rebalancing sun and fill, and turning the sun.
3. **QA scripts called a Node-side helper inside `page.evaluate`,** which would have failed in the browser. Caught at typecheck and inlined.
4. **Batch 3’s screenshots were being overwritten** by the browser tests. Restored from git; the tests write to `qa/batch4/` now.
5. Footer copy said “placeholder 3D models”; it now says “representative 3D models”.

### Decisions worth knowing

- **Sun direction is a lighting choice.** Azimuth 125°, elevation 40°. The true 09:12 July sun is nearer due east; it was turned so shadows read from the working view.
- **“Sand” canvas is `#b9ae97`,** not the `sand` token, which is nearly the colour of white gelcoat. The changed cover has to be visible for the story.
- **DESIGN §5.2–5.3** (400–1,200-triangle flat-shaded hulls, shader plank seams, `midnight` water) was not followed where it conflicts with v2, as instructed. DESIGN still governs brand, type, tokens and UI. DESIGN.md itself was not edited.
- **No new dependency** was added.

### Remaining visual gaps and technical limits

- **Surroundings:** buildings are still extruded blocks with unsourced heights, the elevator is a box, there are no stored boats, fences or paths, and the far banks are bare (T15).
- **Water:** static, no planar reflection, no depth tint at the bank. The pause-motion control arrives with water motion (T17).
- **No ambient occlusion pass.** Occlusion is baked into vertex colours in a few places only.
- **No mooring lines.** Boats sit in their berths untied.
- **Fingers are 0.6 m wide** (the assumed layout). At full beam a hull sits within about 0.1 m of them, and fenders touch.
- **The dashed “simulated object” contour** (PRD §6, DESIGN §4.2) is still not drawn.
- **Evidence stills** for the 09:12 camera frame and the 09:18 staff photo are not rendered yet (T11/T12); `capture-scene.ts` is the starting point for `render-evidence.ts`.
- **Detail switching is a hard swap** at 95 m and 260 m, with 8 % hysteresis. It was not visible in the captures, but it was not examined during a slow dolly.
- **Geometry is generated on first use** on the main thread. Start-up cost was not measured (T16).
- **Composited text contrast** over the new, lighter scene was not re-measured (T17).
- **The `?debug` bridge** still ships, inert without the flag, and now also exposes renderer counters (T23).

## Command summary after Batch 4

```
npm run check            # tokens, fixtures, assets, typecheck, lint, 122 unit tests, production build
npx playwright test      # 23 browser journeys on the production build (port 4719)
npm run assets           # regenerate data/derived/asset-report.json
npm run assets:glb       # + inspection GLBs in design/assets-export/
npm run capture -- --gpu --stage uncertain --select B-12 --out qa/batch4/x.png
npm run measure -- --gpu --out qa/batch4/perf-gpu.json
```

`capture` and `measure` need a server: `npm run dev` (5173) or `npm run build && npm run preview -- --host 127.0.0.1` (4719).

## Starting point for Batch 5 (T11–T13)

Start at **T11**, in `src/features/registry/Inspector.tsx`. Its header comment reserves step 4 (“workflow actions arrive in Batch 5”): the actions go after the latest-observation block, which ends with the dashed “Possible match” link (about line 116), and before the Presence / Agreement / Bookable summary. Nothing is stubbed there.

- **T11 — observation review and dock-check request.**
  - The engine already has the commands (`src/domain/engine.ts`, T06): `requestDockCheck`, `loadDockCheckResult`, `openReview`, `cancelReview`, `acknowledgeEvidence`, `confirmIdentity`. T11 is UI over them, in a new `src/features/slip-review/`.
  - Build the uncertain panel: source thumbnail, comparison evidence, source and freshness labels, “possible match” kept subordinate to “identity unverified”, the request action and its pending state. No confidence percentage.
  - **Evidence thumbnail:** write `scripts/render-evidence.ts` from `scripts/capture-scene.ts`. Stage a fixed, wide, slightly elevated “C-02” camera on B-12 and export `ev-c02-0912.webp` (opaque name; alt text “simulated camera frame, name not legible”). The hull has no name board, so nothing is legible by construction. Add the missing-image and insufficient-evidence paths.
  - Repeated requests must create one task. Leaving and returning must keep the pending issue.
- **T12 — evidence, acknowledgment, resolution, history.**
  - The 09:18 staff still needs a **name board and registration suffix on the hull**, which do not exist yet. Add them to `cruiser.ts` as an option that is only ever set for a **confirmed** identity, and keep the test that scans asset sources for vessel names honest (the name must arrive as data at render time, never as a literal in the generator).
  - On confirmation only the label changes. `boat-assets.test.ts` already asserts the geometry is the same object before and after.
- **T13 — guided replay and Gate A.**
  - Gate A asks for normal / uncertain / resolved screenshots, one v2 comparison and initial performance data. The capture, comparison and measurement scripts from this batch produce all three; re-run them after T12 changes the hull.
- **Carried into Batch 5 from this one:** the dashed simulated-object contour belongs with the uncertain panel (T11); decide there whether the selected-slip camera should move closer to match v2’s framing.
- **Keep passing:** `scene-layout.test.ts`, `registry-model.test.ts`, `boat-assets.test.ts`, and all 23 browser journeys, in particular the two T09 ones (detail levels and draw calls; no identity in labels or requests).

---

# Batch 5 — T11, T12, T13 and Gate A (14 Nov 2026)

Scope: T11–T13 only. Full-marina expansion (T14+) was not started. Nothing was deployed, published or committed, no message was sent, and no camera or external service was connected.

**Prerequisites, confirmed on the untouched tree (Batch 4 committed as `216acb59`):** `npm run check` green with 122 unit tests, and `npx playwright test` 23/23. The T06 engine already had every workflow command and invariant test, so Batch 5 extends it with a view model, UI, scene treatment, evidence stills and browser proof. **No engine command, selector, transition or fixture record was changed.** The fixture regeneration changes only the two evidence manifest entries (status `planned` → `available`) and two alt texts.

## T11 — Observation review and dock-check request

Status: complete.

### Files

- `src/features/slip-review/model.ts`: pure view model over the shared selectors.
  - `slipReview()` returns stage, issue, observation (observed vs not established), candidate comparison, task, request eligibility, camera note, staff evidence, the confirm guard (the engine's own `confirmBlocker`), resolution and activity trail.
  - `stageSteps()` builds the five-stage strip; `evidenceImage()` builds image URLs; `resultMessage()` builds the live-region text.
- `src/features/slip-review/SlipReview.tsx` + `slip-review.css`: inspector step 4. `useReviewActions.ts`: dispatch → announce → move focus.
- `src/features/registry/Inspector.tsx`: renders step 4 between the observation and the status summary; replay banner; focusable title.
- `scripts/render-evidence.ts`, `public/assets/evidence/ev-7k2q*.webp`, `ev-p3m8*.webp` (sizes in design/ASSET-PLAN.md “As built”).
- `src/data/generate.ts` → `data/fixtures/evidenceAssets.json`, `stagedEvidence.json`: assets `available`; alt texts describe the rendered stills.

### Behaviour

- **Uncertain (09:12).** Camera frame (thumbnail, alt text, source, time), the frame's text evidence, and an “Observed / Not established” split. The possible match stays in its dashed “candidate only, not an identity” box under “identity unverified”. No confidence percentage anywhere.
- **Comparison** (inside “Review observation”). A table of observed vs Lake Effect (assigned) vs Harbor Light (possible match): type, name, cover, last activity, assigned slip (`B-14 (unchanged)`). A note says opening the match never moves or reassigns it.
- **Request dock check.** One click creates TSK-0001 at 09:13. The panel then says: “Simulated local task: no message, notification or staff dispatch was sent. Identity remains unverified. The issue stays open…”. The button disappears once a task exists. A double click, or a second request through the store, returns the existing task with no new audit event. After staff evidence is loaded the request is not offered.
- **Missing image.** A failed or absent still becomes a labelled “Image unavailable · text evidence below” box carrying the alt text. The evidence text and every action remain.
- **Camera offline/stale.** The review shows “C-02 offline. Last frame 09:12 is kept; offline does not mean empty.” The T10 inspector facts keep their “does not mean empty” line. This is driven by the existing `setSourceStatus` scenario command through `?debug`; a UI control for it belongs to T18.

## T12 — Evidence acknowledgment, resolution and history

Status: complete.

### Files

- `SlipReview.tsx`, `model.ts`: as above.
- `src/scene/NameBoard.tsx`, `src/scene/assets/nameboard.ts`, `src/scene/hulls.ts` (`nameBoardForSlip`), `src/scene/Boat.tsx`.
- `src/scene/assets/cruiser.ts`: the hull form is extracted as `cruiserHullForm()`. Pure refactor: `assets:check` confirms identical generated geometry.

### Behaviour

- **Scenario control.** “Load simulated dock-check result” sits in a dashed **Scenario control · SIM** box: “Demo only: advances simulated time to 09:18 and adds a fictional staff dock check. No one is contacted.” The 09:12 step uses the same treatment (“Show 09:12 camera observation”).
- **Staff evidence.** A light “staff card” (local `data-theme="light"`, so the light tokens keep AA) with the two-shot photo, “Staff dock check · Demo dock staff · 09:18”, the summary, and “Recorded separately from the camera, and newer than the 09:12 frame.”
- **Acknowledgment and confirmation.**
  - The acknowledgment checkbox is disabled until staff evidence exists.
  - “Confirm identity & resolve” stays disabled until the engine guard passes. A hint under it gives the reason: “Needs staff evidence. Camera evidence alone cannot confirm identity.” or “Tick the acknowledgment above…”.
  - “Back to observation” cancels: the issue, task and clock are unchanged and the acknowledgment is cleared (T06 behaviour).
- **Resolution summary.**
  - Identity confirmed 09:20 by Demo dockmaster; evidence staff dock check 09:18; presence “Present · staff verified”.
  - Agreement “Unchanged · Seasonal B-12”; Bookable “No · assigned”.
  - “Harbor Light was only a possible match. Its record is unchanged: assigned B-14, last confirmed away (departed 08:30).”
  - “Dock check TSK-0001 completed 09:20 with the resolution” on the pending path only.
  - “Original observation (retained, unchanged)” with the frame and candidate, plus the append-only activity trail.
- **Scene.**
  - While the issue is open, an amber dashed contour surrounds the observed hull, plus a dashed “B-12 · Needs review” marker when B-12 is not selected or hovered. This is the PRD §6 non-orange review treatment, independent of the orange selection outline.
  - Both clear on resolution. The marker then reads “B-12 · Lake Effect”.
  - The hull keeps its key, geometry object, position and heading. A browser test compares them before and after.
  - It gains a transom name board and two bow registration panels (“•••• 42 AB”) as separate child meshes, at LOD 0 only.

## T13 — Guided replay, branching, restart, Gate A

Status: complete; Gate A evidence below.

### Files

`src/features/demo-controls/ScenarioPanel.tsx` + `scenario.css` (bottom-left), `src/app/Shell.tsx` (panel, “Replay time” label), `src/domain/store.ts` (unchanged: `viewReplay`, `returnToInteractive`, `startBranch`, `restart` from T06).

### Behaviour and documented reset rules

- **Entry.**
  - The overview shows the scenario panel with a primary **Explore slip review** (PRD F01, no modal). It selects B-12, the camera flies there, and focus moves to the inspector title.
  - The panel's five-stage strip is the PRD §6 activity strip: done, current, upcoming, or skipped for the optional 09:13 check on the direct path.
  - One line explains the controls: “Simulated time moves only when you use a scenario control. Nothing here contacts anyone.”
- **Guided replay.**
  - Three read-only snapshots: 08:45 Normal, 09:12 Uncertain, 09:20 Resolved. Each is rebuilt from the seed by the canonical script (T06), so nothing later than its clock exists in it.
  - The panel turns dashed, the inspector shows “Guided replay · HH:MM snapshot · read-only”, the clock is labelled “Replay time”, and every action is replaced by a read-only note. The store also rejects commands (`replay_read_only`).
  - Viewing replay never touches the interactive run.
- **Try this state.** Replaces the interactive run with a fresh branch (`branch-N`) built from that checkpoint. It has no tasks, decisions, acknowledgment or revealed evidence beyond the checkpoint, and B-12 is selected.
- **Restart demo.** Returns to the seed: 08:45, nothing selected, no issue, task, evidence, acknowledgment, decision or audit. It clears the stored run, returns the camera to the overview, and focuses “Explore slip review”.
- **Refresh.** Restores the stored interactive run, including an open review and a ticked acknowledgment. Both are part of the unresolved state the user left. A replay view is never stored, so refreshing during replay returns to the interactive run. Corrupt, incompatible or unavailable storage falls back exactly as in T06/T07 (notice, then seed or memory).
- **Announcements and focus.** Every action result goes to the polite live region, for example:
  - “Simulated dock check TSK-0001 requested at 09:13. No message sent. The issue stays open.”
  - “Lake Effect confirmed at B-12. Issue resolved; the agreement is unchanged.”

  A repeat within 1.5 s (double click) is not re-announced. Focus moves to the result: review heading, task status, evidence-review heading, staff-evidence heading, resolution heading, or the “Review…” button after Back.

## Checks actually run (final tree)

| Check | Result |
|---|---|
| `npm run check` (tokens, fixtures, assets, typecheck, lint, unit, production build) | Green. **140 unit tests in 14 files** (was 122) |
| New unit file `tests/unit/slip-review.test.ts` | 18 tests, listed below |
| `npx playwright test` (production build on 4719, SwiftShader) | **29/29** (was 23); new `tests/e2e/review.spec.ts` has 6. Final tree: 29/29 with `--workers=1` (1.9 min) |
| Re-run under machine overload (recorded, not counted) | One re-run on the final tree had 7 failures, mostly 30 s scene-start timeouts, while the 1-min load average reached 240–610 from outside this session (about 105 Chrome renderer processes). With one worker it was 28/29. The one failure was the Batch 3 fly-to interruption test: SwiftShader fell to 2–4 fps and stepped past its 15–85 % window. Once the load cleared, the full suite passed 29/29 with no code change |
| `node scripts/render-evidence.ts --gpu` | Both stills rendered from the production build; byte-identical to the dev-server render |
| `npm run capture -- --gpu …` (production build) | Normal, uncertain, pending, review and resolved captures |
| `node scripts/compare-v2.ts` | Resolved and uncertain comparison sheets |
| `npm run measure -- --gpu` (`--stage resolved` added) | Two runs, recorded below |

**Unit tests** (real fixtures and engine):
- normal stage copy;
- uncertain: observed vs not established, comparison keeps `B-14 (unchanged)`, no staff text before 09:18;
- one task per request, and the repeat message;
- selection away and back keeps the pending issue and the open review;
- planned and missing image paths;
- the evidence files exist at 1× and 2×, are under 120 KB, and have opaque names;
- camera offline note, and staff evidence distinct;
- confirmation blocked without evidence, and without acknowledgment;
- missing staff evidence leaves the issue open;
- cancel clears the acknowledgment;
- resolution on **both paths**: summary, unchanged agreement and Harbor Light, retained observation and candidate, exactly one decision and resolution, a duplicate confirm returns the same object;
- the name board appears only after the decision, and never at B-14 or B-10;
- decal placement;
- stage strip, direct path skipped vs pending path done;
- no later text in any earlier snapshot;
- refresh during replay, branch isolation and persistence;
- restart clears everything including storage.

**Browser journeys** (`review.spec.ts`, real DOM clicks on the production build):
1. **Direct path:** Explore → normal (empty, assigned, Bookable No, no hull) → 09:12 (Needs review 1, marker, camera still loaded, staff photo not requested) → Review (comparison, confirm disabled, a forced store confirm rejected) → Load (09:18, staff photo loaded, still no success styling) → acknowledge → **double-click confirm**.
   - Exactly 1 decision, 1 verification, 1 `identity_confirmed` and 1 `issue_resolved`, and no task.
   - Same hull key, geometry, position and heading, with name boards added.
   - Marker “B-12 · Lake Effect”, review marker gone, Needs review 0.
   - Agreement text and candidate note correct; trail keeps the candidate and the original record.
   - B-12/B-14 agreements and the fixture observations byte-identical; Harbor Light's record reads “Assigned berth B-14 · last confirmed away”; no hull at B-14.
2. **Pending path:** double-click request → TSK-0001 only; a store re-request is `unchanged`; focus on the task status; announcement text.
   - Select B-14 and return → still pending. **Reload** → still pending, no decision.
   - Resolve → task completed once, `dock_check_completed` once, four stages done.
3. **Missing evidence / no acknowledgment / cancel:** a store confirm is rejected as `evidence_unavailable`, then `acknowledgement_required`; Back clears the acknowledgment (focus and announcement checked); reopening shows it unticked; the issue stays open and Needs review stays 1.
4. **Replay, branch, reset:**
   - Replay 08:45 is read-only.
   - 09:12 shows no interactive task and no actions, and the store rejects a request. **No staff-photo request** up to that point.
   - 09:20 shows the resolution. **Backward to 09:12** shows no “42 AB”, no confirmation and no staff-evidence trail entry. The interactive run is deep-equal to before.
   - Back to my run shows the task again.
   - Try this state at 09:12 gives `branch-1` with no tasks; reload keeps the branch.
   - Restart gives the seed, nothing selected, storage key removed, focus on Explore; reload stays at the seed.
5. **Keyboard only:** Tab/Enter/Space through Explore → 09:12 → Request → Review → Load → acknowledge → Confirm. Focus lands on each result; the four announcement texts are asserted; the focused heading has a visible outline.
6. **Missing thumbnail and offline camera:**
   - The frame request is aborted; the labelled fallback and the text evidence remain, and Request is enabled.
   - C-02 offline at 09:12 keeps “Present” with the offline note.
   - At 09:18 presence is “Camera offline” / “Unknown”, never empty; the staff evidence (09:18) is separate.
   - After resolving, “Present · staff verified” while C-02 is still offline.

All 23 earlier journeys pass unchanged, including:
- the T09 test that **no label, tooltip or network request names the hull before verification**;
- “the idle scene renders no frames”, so the dashed contour and name boards add no continuous rendering.

**GPU vs software, stated precisely.** The interaction journeys ran in headless Chromium on SwiftShader (software WebGL). Captures, evidence stills and frame pacing ran in headless Chromium on **ANGLE Metal, Apple M3 Max**. I spot-checked the dev build in the in-app browser pane (real GPU): the full pending path, scene relabelling and the name board close-up. The pane later stopped painting the canvas while hidden (known since Batch 3), so it is not used as evidence. **Nobody clicked through the workflow in a visible GPU browser window.**

## Gate A evidence

| Gate A criterion | Evidence |
|---|---|
| Overview → B-12 → uncertain → request → staff evidence → acknowledge → resolve → history | Journey 2 (UI clicks); `qa/batch5/e2e-resolved-pending.png` |
| Direct review path | Journey 1; unit “resolution (direct path)”; `qa/batch5/e2e-resolved-direct.png` |
| Keyboard path | Journey 5; `qa/batch5/e2e-keyboard-resolved.png` |
| Scene and panel changes; unchanged agreement and Harbor Light record | Journey 1 (hull identity, markers, contour, counts, agreements, B-14 raycast-free); units |
| Replay backward with no future leakage; reset and refresh as documented | Journey 4; unit snapshot-leak and restart tests |
| Normal / uncertain / resolved screenshots (GPU, production build, 1440×900) | `qa/batch5/gate-a-normal-gpu-1440.png`, `gate-a-uncertain-gpu-1440.png`, `gate-a-resolved-gpu-1440.png`; also `gate-a-pending-…`, `gate-a-review-…`, and 1600×1000 uncertain and resolved |
| v2 composition comparison | `qa/batch5/compare-v2-resolved.png`, `compare-v2-uncertain.png` |
| Initial performance data | `qa/batch5/perf-gpu-uncertain.json`, `perf-gpu-resolved.json` (below) |

**v2 comparison (selected B-12, 1600×1000):**
- Panel placement now matches v2: inspector right, activity strip bottom-left.
- The inspector carries the same hierarchy: slip, assigned vessel, observation with thumbnail and possible match, “Review observation” primary, “Request dock check” secondary.
- Foreground fidelity is unchanged from Batch 4: same assets, about 75 % of v2's hero framing. The camera pose was again left as tested.
- The gap is still the surroundings (yard, buildings, stored boats, elevator), which T15 owns.
- v2's amber selection ring becomes an orange berth outline plus the amber dashed review contour, per DESIGN (orange = selection, amber = review).

**Performance (initial, not the T16 release profile).** Conditions as Batch 4: production build, headless Chromium, ANGLE Metal / Apple M3 Max, 1440×900, 20 warm-up frames, 6 s ±25° orbit.

| View, DPR 1 | Draw calls 09:12 | Draw calls 09:20 | Triangles | Orbit median | p95 frame |
|---|---|---|---|---|---|
| Overview | 117 | 116 | 135 k | 59.9 fps | 16.7 ms |
| Dock B preset | 93 | 92 | 180 k | 59.9 fps | 16.7 ms |
| B-12 selected | 83 | 88 | 277 k | 59.9 fps | 16.7–16.8 ms |

- DPR 1.75 gives the same figures. One orbit sample at 09:12 had a single 33.3 ms maximum frame (p95 16.8 ms).
- Draw calls: Batch 4's 82 at the selected slip is now 83 with the review contour and 88 resolved (three decals and two canvas textures).
- 59.9 fps is the display cap. **The M1 MacBook Air target remains unverified.**
- Sizes (gzip):
  - shell JS 114.0 KB (was 108.1), scene JS 292.1 KB, CSS 6.6 KB;
  - evidence 38 KB at 1× or 126 KB at 2× (staff photo only after 09:18);
  - fonts unchanged at 170,448 B; no new dependency.

## Defects found and fixed in this batch

1. **Registry list squeezed to nothing (latent since T10).** The rail's inspector and list both shrank from their content height, so the long review inspector crushed the list to 122 px, with zero visible rows. The inspector now takes the remaining space (`flex: 1 1 0`), and the list keeps its own 30 % cap without shrinking. Found by journey 1. I first tried a 22 % list during review, which hid every row, and reverted it.
2. **Browser tests overwrote Batch 4's evidence** (`qa/batch4/e2e-*.png`), the same class of defect Batch 4 fixed for Batch 3. Restored from git; `scene.spec.ts` now writes to `qa/batch5/`.
3. **Double-click announced the no-op.** The second click's “already requested/resolved” replaced the success message. Rapid repeats are no longer re-announced; the engine was already idempotent.
4. **Staff-photo crop missed the name.** The app's inspector framing offset puts the camera target 200 px left of centre; the render now crops around the target.
5. **A failed *load* said “Not confirmed”.** It now says “No simulated dock-check result is available. The issue stays open.”

## Decisions worth knowing

- **Name boards only for a decision-confirmed hull.** Seed boats confirmed by the 07:30 walk get none, which avoids a field of labels and keeps the unverified hull from being singled out by an absent board. The text arrives from the decision at render time. The asset-source scan test still finds no vessel name in `src/scene/assets/` or `Boat.tsx`.
- **The staff photo is rendered from the resolved state** (the only state that draws name boards) with nothing selected. It depicts the 09:18 check; the image file is requested only after 09:18.
- **Acknowledgment survives selection changes and refresh,** because it is part of the unresolved review the user left. Back/cancel and Restart clear it.
- **Scenario controls live in the inspector** next to the step they advance, labelled as scenario controls. The bottom-left panel holds only stage, replay and restart.
- **No new dependency.** The browser encodes the WebP files; name-board text is a canvas texture using the local fonts.

## Remaining limitations

- **Coverage:**
  - desktop rail only: at 900 px tall the inspector scrolls during review and the list shows about one row (Hide gives it all to the inspector); ≤1280 px and mobile are T17;
  - one scenario slip; other slips never open issues (PRD scope).
- **Rendering:**
  - the 1× staff photo is small: “42 AB” is legible at 2× but marginal at 1×, so the text evidence carries it;
  - name boards are LOD 0 only, and the transom faces the dock, so in the default view the label is the marker, not the board.
- **Verification gaps:**
  - no automated accessibility scanner and no manual screen-reader pass (T17);
  - composited contrast of the new staff card and dashed contour over the scene was not measured (T17);
  - the offline-camera path has no UI control; it is exercised through the `?debug` scenario command (T18);
  - the M1 Air frame-rate target and cold-start timings are unmeasured (T16/T21).
- **Shipped test hooks:** the `?debug` bridge now also exposes `hull()` and `overlays()`. It is inert without the flag (T23).

## Command summary after Batch 5

```
npm run check                 # tokens, fixtures, assets, typecheck, lint, 140 unit tests, production build
npx playwright test           # 29 browser journeys on the production build (port 4719)
node scripts/render-evidence.ts --gpu        # needs the preview on 4719; rewrites public/assets/evidence/
npm run capture -- --gpu --stage resolved --select B-12 --scroll resolution-heading --out qa/batch5/x.png
npm run measure -- --gpu --stage resolved --out qa/batch5/perf.json
node scripts/compare-v2.ts <capture> <out> "<label>"
```

## Starting point for Batch 6 (T14–T16)

Gate A is met, so the environment can expand. Start at **T14**.

- **T14 — all assumed slips and the wider fleet.**
  - Generalise `src/scene/DockB.tsx` to every dock in `MODELLED_DOCKS` (`src/data/docks.ts`, currently `{B}`). Instance fingers, piles and repeated boats.
  - Keep per-slip pick targets (`name="berth"`) and the hull `userData { slipId, hullKey }` that `hull()` and the browser tests rely on.
  - Keep `hullForSlip` / `nameBoardForSlip` as the only sources of what is drawn.
  - Markers, the review contour and name boards must stay limited to the selected, hovered or reviewed slip, so there is no field of labels.
  - Counters stay derived; check the 126/48 tiles and the list against the scene.
- **T15 — surroundings.** `src/scene/Shore.tsx` and `Environment.tsx`: yard, storage boats, buildings, paths. The v2 sheets in `qa/batch5/` show what is missing. Re-render the evidence stills afterwards (`render-evidence.ts`), because the C-02 frame shows the shore.
- **T16 — optimise and Gate B.** Re-run `measure-scene.ts` on the full layout; add the 60-second camera/selection profile and transfer totals.
- **Keep passing:** all 29 browser journeys, especially:
  - `review.spec.ts` journey 1 (same hull before and after resolution; no hull at B-14);
  - the T09 identity-leak test;
  - the idle-frames test.

  Also keep the unit tests `slip-review.test.ts`, `boat-assets.test.ts` and `scene-layout.test.ts`.

---

# Batch 6 — T14–T16 (14 Nov 2026)

Scope: the full assumed layout, the waterfront surroundings, optimisation and Gate B. Nothing from Batch 7 (responsive, accessibility pass, failure handling) was started. Nothing was deployed or published.

**Before expanding.** Gate A was re-run on the Batch 5 tree first: `npm run check` green (140 unit tests) and `npx playwright test` 29/29. No unresolved Gate A failure was found. (That run overwrote three `qa/batch5/e2e-*.png` files; they were restored from git and the specs now write to `qa/batch6/`.)

## T14 — All assumed slips and the wider fleet

### Files
- `src/scene/marina.ts` (new, pure): one `DockPlan` per dock from the OSM headwalk lines and the supplied berths: deck quads, fingers, piles, pedestals, cleats, gangway.
- `src/scene/Marina.tsx` (was `DockB.tsx`): renders every dock, the berth pick mesh, hulls, outlines and markers.
- `src/scene/assets/dock.ts`: `quay` option (concrete apron and wall for fixed docks) and `fingerTop`.
- `src/data/docks.ts`: `MODELLED_DOCKS` is now A–E, so the inspector no longer says a dock is “outlined only”.
- `src/scene/camera.ts`: new overview pose.
- `tests/unit/marina-layout.test.ts` (9 tests), `tests/e2e/marina.spec.ts` (4 journeys).

### Behaviour
- **All 126 supplied slips** are drawn on docks A–E with their canonical IDs and ASSUME provenance. No slip is added, renumbered or moved; the tile still reads “Assumed slips”.
- **Boats come from observations, not assignments.** `hullForSlip` is unchanged and remains the only source: 39 hulls at the seed, 40 at 09:12, across all five docks (A 9, B 15, C 5, D 7, E 4). The 48-record roster reaches the scene through the existing selectors. A unit test checks, for the seed and every checkpoint, that a hull exists exactly where the last report says “present”, that an assigned berth without such a report stays empty, that no departed vessel is drawn anywhere, and that no vessel is drawn twice.
- **Empty and unknown stay distinct.** A berth with no current report (docks C and E have an offline camera) is tinted sand and outlined with a dashed line; an empty berth keeps the faint blue tint. The words carry it too: the hover marker, list pill and inspector say “Camera offline” / “Presence unknown”, never “Empty”.
- **Picking keeps per-berth identity.** The 126 berths are one mesh; the picked triangle index maps to the slip (`faceIndex >> 1` in `SITE.slips` order). Hulls keep their own pick targets and still select the *slip*.
- **No field of labels.** Markers exist only for the selected slip, the hovered slip and an open review. Overview at the seed shows none; at 09:12 exactly one.
- **Counters are derived.** 126 / 48 / needs-review come from `datasetSummary`; the list shows 126 rows and the per-dock filter counts match the data (39 / 37 / 18 / 22 / 10).
- **Overview** now looks along the whole frontage from the east (Dock E nearest, Dock A far right), so all five docks are in the open scene area at 1440×900. The “Dock B” preset and the tested slip framing are unchanged.

## T15 — Waterfront surroundings

### Files
- `src/scene/surroundings.ts` (new, pure): placement rules for buildings, the bank walk, verge, rock, lamps, trees and stored boats.
- `src/scene/assets/buildings.ts` (new): elevator, gabled shed, boat stand, viaduct.
- `src/scene/Shore.tsx` (rewritten), `src/scene/Environment.tsx` (land, water and light only), `src/scene/shapes.ts` (`paint`), `src/scene/palette.ts`, `src/scene/assets/finishes.ts`.
- `tests/unit/surroundings.test.ts` (8 tests).

### What was built
- **Working yard:** hard-standing, parking and roads from the 2022 map masses and the OSM yard polygons, painted as one layered sheet; the service shed and the small office as gabled buildings on their mapped footprints.
- **Grain elevator:** two rows of concrete bins, a gallery, a taller workhouse and a low shed. It is the site’s own elevator from the 2022 map, unpainted. No RiverWorks silo is placed.
- **Stored boats:** 24 boats on stands inside the three mapped storage areas, as one merged scenery mesh. They have no IDs, no labels and no pick targets, and are not counted. The footer now says “boats ashore and buildings are scenery, not records”.
- **Shoreline and paths:** revetment rock, a paved bank walk, a lawn verge, lamp posts and two loose rows of trees along the whole west bank; quay aprons at A and E; gangways at B, C and D.
- **Skyway:** the mapped line as a viaduct with parapets and piers.
- **Left plain on purpose:** the peninsula and the north bank are muted ground with nothing on them (no sourced positions). No depth contours, no fuel, pump-out or travel-lift objects, no selectable service modules.

### Geography findings (details in data/GEOMETRY-VALIDATION.md, “Batch 6 findings”)
1. **The digitized elevator footprint stood 17 m into documented canal water, across Dock D.** This was already true of the Batch 3 placeholder block and was caught by a new test. The footprint is now moved 27 m inland, unreshaped; its position is approximate.
2. **Dock E’s berths wind the other way.** With one merged berth mesh they were not drawn or pickable until the mesh was made double-sided. Caught by the new all-docks click journey.
3. Dock D’s headwalk ends on land, so its ramp follows that segment.

## T16 — Optimisation and Gate B

Measured first, on the unoptimised full scene, then again after each group of changes. Same script, same conditions.

### Conditions
- Device: Apple M3 Max, 14 cores, 36 GB, macOS (Darwin 23.4). **Not the PRD’s M1 MacBook Air.**
- Browser: Chromium 159 (Playwright, headless) with `--use-angle=metal`, so WebGL runs on the real GPU.
- Viewport 1440×900. Device scale factor 1 (canvas DPR 1) and 2 (canvas DPR capped at 1.75).
- Build: production (`npm run build`, served by `vite preview` on 4719), tree = 6a7bf53d plus this batch.
- Warm-up: 30 back-to-back frames. Machine load average 5–14 from other work during the runs.
- Method: `npm run profile -- --gpu`. One 60-second run: overview orbit → Dock B preset → select B-12 → select D-10 → select A-05 → top-down pan → overview. The camera moves every frame; every `requestAnimationFrame` interval is recorded.

### 60-second profile

| | Before optimisation (DPR 1) | After (DPR 1) | After (DPR 1.75) |
|---|---|---|---|
| Median | 59.9 fps | 59.9 fps | 59.9 fps |
| p95 frame | 16.7 ms | 16.7 ms | 16.7 ms |
| Max frame | 33.3 ms | 33.3 ms | 33.3 ms |
| Frames over 33.3 ms | 0 of 3,604 | 0 of 3,604 | 0 of 3,604 |
| Selection → inspector | 15–16 ms | 17–20 ms | 17–23 ms |

59.9 fps is the display cap, so this device cannot show the difference in frame rate. The work done per frame can:

| View (orbiting) | Draw calls before → after | Triangles before → after |
|---|---|---|
| Overview | 262 → 79 | 513 k → 198 k |
| Dock B preset | 97 → 34 | 621 k → 226 k |
| B-12 selected | 79 → 30 | 696 k → 264 k |
| D-10 selected | 55 → 24 | 613 k → 230 k |
| A-05 selected | 51 → 21 | 591 k → 191 k |
| Top-down | 246 → 80 | 513 k → 191 k |

For comparison, Batch 5 (Dock B only) was 117 / 93 / 83–88 draw calls and 135 k / 180 k / 277 k triangles, shadow pass included. The full marina now costs less per moving frame than the single dock did.

- **Back-to-back frame cost** (frame plus a one-pixel read-back, which waits for the GPU): 2.1–3.9 ms median, 3.9–5.6 ms p95 at DPR 1; 3.6–5.5 ms median, 7.1–7.7 ms p95 at DPR 1.75. Before optimisation it was 2.4–4.9 ms median. These figures are within the noise of a loaded machine and are dominated by the read-back, so **they do not show a measured GPU-time saving**; the draw-call and triangle counts are the reliable before/after. (Batch 4–5 reported 0.2–0.4 ms here: `gl.finish()` returns early under ANGLE, so those numbers were command submission only. The script now reads a pixel back.)
- **Renderer memory** (`node scripts/check-reuse.ts --gpu`): 136 geometries, 8 textures, 15 programs after each of five full cycles (five selections on five docks, the whole B-12 resolution, three presets, restart). Flat, so the boat-geometry cache is bounded and nothing leaks.
- **SwiftShader** was not profiled this batch; the Batch 4 floor was 9–12 fps on Dock B alone.

### Changes, in the order made
1. **Shadow map on demand** (`src/scene/quality.ts`, `Environment.tsx`). The map is redrawn only when the shadow frustum moves or a caster changes (a hull appears, leaves or changes LOD). Orbiting a fixed target reuses it, which removes the whole second pass from those frames. This is most of the triangle saving.
2. **One pick mesh for 126 berths** instead of 126 meshes; **one instanced mesh for contact shadows** instead of one per hull.
3. **Revetment in 14 bank chunks**: every stone within 190 m of the camera, a quarter as many larger stones beyond.
4. **Stored boats as one mesh**, swapped between LOD 1 and LOD 2 as a group at 300 m.
5. **Ground as one painted sheet** without depth writes (also removes the z-fighting the overlapping yard polygons showed at overview distance). Camera near plane 0.5 → 2 m for depth precision.
6. **Adaptive pixel ratio** (`src/scene/Quality.tsx`): while moving, the canvas ratio steps down 0.25 at a time (floor 1) when a 40-frame mean exceeds 24 ms, and back up after six fast windows; at rest it redraws once at the full capped ratio. It never touched the ratio in these runs, so it is **untested on a slow GPU**; only its step rule has a unit test.

Not done, because nothing measured called for it: instancing the hulls (40 meshes with individual authored geometry), tree impostors, texture compression (no downloaded textures exist).

### Budgets

| PRD §11 criterion | Result | Status |
|---|---|---|
| Draw calls < 2,000; aim < 300 | 21–80 orbiting; 119 on a frame that redraws shadows in the overview. A browser test asserts < 300 in five views | Pass |
| Download < 6 MB compressed, whole demo | 709 KB gzip (635 KB brotli), 12 files; 1,946 KB uncompressed (`npm run transfer`, `qa/batch6/transfer.json`) | Pass |
| Fonts < 200 KB | 170,448 B, 5 files | Pass |
| 60 s run: median ≥ 55 fps, p95 ≤ 33.3 ms | 59.9 fps, 16.7 ms on the M3 Max substitute | Pass on the substitute |
| 60 fps on an **M1 MacBook Air** at 1440×900 | Not measured: no such device here | **Pending** |
| Selection feedback within 100 ms | 17–23 ms on the substitute | Pass on the substitute |

No criterion was changed. The one open item is the target-device run: `npm run build`, serve the preview, then `npm run profile -- --gpu --dsf 2` on an M1 Air (or the same run in visible Chrome there).

## Checks actually run (final tree)

| Check | Result |
|---|---|
| `npm run geometry` | 27 checks, 23 pass / 4 flags as before; derived files byte-identical |
| `npm run check` (tokens, fixtures, assets, typecheck, lint, unit, production build) | Green. **157 unit tests in 16 files** (was 140 in 14) |
| `npx playwright test` (production build, port 4719, SwiftShader) | **33/33** (was 29): the 29 earlier journeys unchanged, plus 4 in `marina.spec.ts` |
| `node scripts/render-evidence.ts --gpu` | Both stills re-rendered (the shore behind B-12 changed); size tests still pass |
| `npm run profile -- --gpu` (before; after at DSF 1 and 2) | `qa/batch6/profile-*.json` |
| `npm run measure -- --gpu` | `qa/batch6/perf-gpu-uncertain.json` |
| `npm run transfer` | `qa/batch6/transfer.json` |
| `node scripts/check-reuse.ts --gpu` | `qa/batch6/reuse.json` |

**New browser journeys** (real mouse events on the canvas):
1. One pick mesh; 30–47 hulls; tiles, tab labels and per-dock list counts match the data; the inspector never says “outlined only”.
2. Canvas clicks on neighbouring berths of A, B, C, D and E each select exactly that slip, with inspector and list following (at least 10 clicks, all five docks).
3. Unknown berths are outlined (20–60 of them); zero markers at the seed and one at 09:12; “Presence unknown / Camera offline” versus “No vessel present” in the inspector; clicking a storage area or a building selects nothing.
4. Draw calls under 300 in five views; an orbit draws frames without redrawing the shadow map more than once; selection survives the camera movement; the scene comes to rest.

**Kept passing from earlier batches:** both B-12 resolution paths, retained history, replay, branch and reset; unchanged agreement and Harbor Light record; the identity-leak test; the idle-frames test; reduced-motion cut; camera movement never changing selection.

**What was mocked and what was real.** Unit tests use the real fixtures and engine with no renderer. Browser journeys render the real scene and use real mouse and keyboard input, but in software (SwiftShader). Captures, evidence stills and all performance numbers used the real GPU, headless. **Nobody clicked through the workflow in a visible GPU window:** the in-app browser pane was 268 px wide, and at an emulated 1440×900 it created the canvas but never ran a frame, so it gave no evidence.

## Gate B evidence

| Gate B item | Evidence | Status |
|---|---|---|
| 1. Full assumed marina and surroundings present | `qa/batch6/gate-b-overview-gpu-1440.png`, `-1600.png`, `gate-b-plan-gpu-1440.png`, `gate-b-dock-b-gpu-1440.png`; slips on other docks: `gate-b-a05-…`, `-c05-…`, `-d10-…`, `-e03-…` | Met |
| 2. Gate A behaviour and selected-slip quality preserved | 29 earlier journeys pass unchanged; `gate-b-b12-normal/uncertain/resolved-gpu-1440.png` against `qa/batch5/gate-a-*` | Met (see findings) |
| 3. Overview and selected B-12 inspected against the approved direction | `qa/batch6/compare-v2-b12-uncertain.png`; findings below | Done |
| 4. Asset/font totals and a reproducible profile recorded | `transfer.json`, `profile-*.json`, `reuse.json`; commands above | Met |
| 5. Budgets pass or are explicitly resolved | Table above | Met except the M1 Air run, which is pending and stated as such |
| 6. Optimised assets regenerate from editable sources | Generators in `src/scene/assets/`, `npm run assets`, `assets:check` in `npm run check` | Met |

**Visual findings (my reading of the captures).**
- *Selected B-12:* the boats, dock, rock and bank walk are as in Batch 5; I see no loss. The berth tint, outline and marker are unchanged.
- *Against v2:* v2’s selected view shows the yard, stored boats, a shed and the elevator behind the dock. Ours still shows mostly trees and lawn behind B-12, because the tested slip camera looks down more steeply and the elevator is 200 m south-east of B-12 in the validated geography. I tried two lower camera poses; they bring stored boats into view but shrink the hero boat and push it under the panels, so the tested pose was kept. **This gap to v2 remains.**
- *Overview:* the long frontage, the five docks, the elevator, the yard and the Skyway read as one place. The peninsula in the foreground is a large plain surface, which is honest but bare.
- *Top-down:* north is up and the docks sit where the validation plan puts them; overview, dock focus and plan agree.

## Defects found and fixed in this batch
1. Elevator over documented water (above).
2. Dock E berths invisible to drawing and picking in the merged mesh (above).
3. Yard polygons z-fought at overview distance (latent since Batch 3, exposed by the wider view): fixed by the painted ground sheet.
4. Verge strips overhung the water by 1–3.5 m at three bank corners: the painted outline is now checked vertex by vertex.
5. The first stored-boat scatter produced 64 boats, which read as a full winter yard in July: reduced to 24.
6. The Skyway deck showed shadow banding in the top-down view: it no longer receives shadows.
7. `timeFrames` under-reported frame cost (above).

## Remaining defects, gaps and unverified claims
- **M1 MacBook Air frame rate: unverified.** Everything measured is from an M3 Max.
- **Adaptive pixel ratio has never been seen to engage**; SwiftShader runs at DPR 1 and the M3 Max never slows.
- **Interaction journeys ran in software rendering only**; no visible-window GPU click-through.
- Selected-view surroundings are sparser than v2 (above). The camera pose is the lever, and it is tested, so it was not moved.
- Fixed docks have a 0.8 m step from the quay down to the floating fingers, with no ladder or ramp modelled.
- The peninsula, the north bank and the land north-west of Dock A are plain; no fences, bollards or parking markings.
- Water is still static, and there is no pause-motion control (T17).
- Camera-to-slip framing is identical on every dock; on Dock E the 45 ft berth fills more of the frame.
- The `?debug` bridge gained `at()` and `inventory()`; it is inert without the flag (T23).

## Command summary after Batch 6

```
npm run check                         # tokens, fixtures, assets, typecheck, lint, 157 unit tests, production build
npx playwright test                   # 33 browser journeys on the production build (port 4719; stop any preview first)
npm run geometry                      # geometry validation and derived site files
npm run assets                        # asset report (boats, dock parts, surroundings)
npm run profile -- --gpu [--dsf 2]    # the 60-second profile; needs the preview on 4719
npm run transfer                      # runtime download totals
npm run measure -- --gpu --out qa/batch6/perf.json
node scripts/check-reuse.ts --gpu
node scripts/render-evidence.ts --gpu
npm run capture -- --gpu --url http://127.0.0.1:4719 --stage uncertain --select B-12 --out qa/batch6/x.png
```

`.claude/launch.json` has a `harbor-desk-preview` entry for the production preview on 4719.

## Starting point for Batch 7 (T17–T18)

Start at **T17 — responsive, accessible and reduced-motion experience**, then **T18**.

- **T17, first:** the layout at ≤ 1280 px and on tablet and mobile (PRD §6). Today only the desktop rail exists: at 900 px tall the inspector scrolls during review and the list shows about one row.
- **T17, motion:** animate the water (`waterMaterial` in `src/scene/Environment.tsx`; the ripple function is static), add the pause-motion control, and freeze it under reduced motion. The scene uses `frameloop="demand"`, so continuous water needs an explicit loop that stops when paused, hidden or reduced. Update the idle-frames assertions in `scene.spec.ts` and `marina.spec.ts` to match. A moving water surface also interacts with `AdaptiveQuality` (it will now sample continuously).
- **T17, accessibility:** an automated scan and a manual screen-reader pass; composited contrast of the staff card, the dashed review contour and the new sand “unknown” tint and dashed outline over water; 200 % zoom; visible focus. The canvas stays `aria-hidden`; the list is the accessible tree for all 126 slips.
- **T18:** failure handling: failed geometry, missing evidence, lost or unsupported WebGL, no storage, invalid data; a UI control for the offline-camera path (today only the `?debug` scenario command reaches it).
- **Carry forward:** the M1 Air profile; a visible-window GPU click-through; seeing the adaptive pixel ratio engage on a slow device.
- **Keep passing:** all 33 journeys and 157 unit tests, especially the all-docks click journey, the identity-leak test, `review.spec.ts` journey 1 and `marina-layout.test.ts`.

---

# Batch 7 — T17, T18 (14 Nov 2026)

Scope: responsive, accessible and reduced-motion experience (T17), and failure and stale-data handling (T18). Gate C review, portfolio packaging, deployment and publishing were **not** started, and no external integration was added.

**Before changing anything** (Batch 6 committed as `8cb1d3ef`): `npm run check` green with 157 unit tests, and `npx playwright test --workers=1` 33/33 on the untouched tree. So the full marina and both B-12 resolution paths worked before their presentation or failure handling changed. **No domain logic changed:** the engine, selectors, fixture records and geometry are untouched, and the fixture and asset regeneration checks are byte-identical.

## T17 — Responsive, accessible, reduced-motion

### Files

| File | Role |
|---|---|
| `src/app/layout.ts` | Layout mode from the CSS viewport (`desktop` ≥ 1280, `tablet` 768–1279, `mobile` < 768 or < 560 px tall) and the camera inset per layout |
| `src/app/prefs.ts` | Display preferences (chart theme, solid panels, pause motion, mobile 3D opt-in), stored under their own key and storage-failure tolerant; live `prefers-reduced-motion` |
| `src/app/Shell.tsx`, `src/app/shell.css` | Three layouts and the map region (3D or 2D plan); `shell.css` is now the **only** source of layout zones |
| `src/features/plan/PlanView.tsx`, `plan.css` | Lightweight 2D plan: lazily loaded, same geometry and selectors as 3D, dock zoom buttons, legend in text and shape |
| `src/features/view/DisplayMenu.tsx`, `ViewControls.tsx` | Display popover; pause-motion toggle next to the camera presets |
| `src/features/registry/RegistryContext.tsx`, `RegistryList.tsx`, `Inspector.tsx` | Compact-layout panes, focus on pane change and on close, scrolling only the nearest scroller |
| `src/scene/Environment.tsx` (`WaterMotion`), `Quality.tsx`, `CameraRig.tsx`, `SceneRoot.tsx`, `Marina.tsx` | Drifting water at 30 fps only while motion is allowed; adaptive DPR ignores ambient frames; bottom-sheet camera offset; markers below panels |
| `src/ui/Status.tsx`, `src/ui/base.css` | Provenance tags as 24 px targets with names that start with the visible text; solid pill chips in the light theme |
| `src/features/demo-controls/scenario.css` | The scenario panel shrinks and wraps in narrow columns |
| `scripts/capture-layouts.ts`, `measure-contrast.ts`, `aria-snapshots.ts` | Layout, contrast and accessibility-tree evidence |
| `tests/e2e/responsive.spec.ts`, `zoom.spec.ts`, `a11y.spec.ts`, `motion.spec.ts`, `helpers.ts`, `motion-paused.storage.json`; `playwright.config.ts` | Browser journeys; a `chromium-zoom` project; suite-wide paused motion |

### Layouts

- **Desktop.** Unchanged floating zones, with collisions made impossible rather than avoided:
  - the scenario panel and attribution are one bottom-left column, its width clamped against the rail and the camera controls;
  - every zone below the top bar is positioned from `--topbar-h`;
  - a browser test asserts zero zone overlaps at 1440×900 and 1280×800;
  - it also asserts the selected B-12 hull projects into the open scene: left of the rail, below the top bar, clear of the bottom-left column, with the canvas topmost at that point.
- **Tablet.** One 320 px rail with **Details | Slips & vessels** and **Hide panel**.
  - Choosing a list row opens Details and moves focus to the record title. **Slips & vessels** returns focus to the list and keeps the selection.
  - The camera framing follows the rail (348 px when open, 0 when hidden).
  - The camera controls stack vertically below the tile row.
- **Mobile.** A grid of top bar / map / sheet, so nothing overlaps by construction.
  - **The 2D plan is the default map** (no three.js download); 3D is opt-in under Display.
  - The sheet holds the scenario panel, counters, list, Details and attribution, with **one** scroll container and Expand/Collapse.
  - Both resolution paths complete with taps on the plan and in the sheet.
- **200 % zoom.** A 1440×900 window at 200 % is 720 CSS px at DPR 2, so it gets the compact layout: map beside a full-height sheet when ≥ 600 px wide. No horizontal scroll, no clipped controls.
- **State is UI-independent.** Viewport, view preset, theme and solid panels never change the session. A browser test checks a deep-equal session and a still-ticked acknowledgment across 1440 → 390 → 1024 → 1440, chart theme, solid panels and the Top-down preset.

### Accessibility

- **Canvas and plan stay `aria-hidden`.** The list, inspector and scenario panel carry every slip, vessel, observation and action. The plan's zoom buttons are real buttons.
- **Keyboard-only resolution** of both paths, including acknowledgment, cancel/back, resolution, history and restart:
  - desktop (Batch 5 journey), tablet (pending path) and mobile (direct path);
  - focus lands on each result and stays visible inside the sheet.
- **Focus management.** Opening Details focuses the record title; Back focuses the list; closing a record focuses the list; Display returns focus to its button on Escape; restart focuses Explore.
- **Announcements.** Action results only. A test drives three presets and a canvas drag and records **zero** announcements, then exactly one for a selection.
- **Disabled confirmation** keeps its reason in text under the button (Batch 5). Uncertainty stays in accessible text: no name for the observed hull in the observation section, marker or announcements before 09:20 (`qa/batch7/aria-snapshots.md`, no leaks).
- **Status never relies on colour:**
  - pills carry text plus icon or dot shape;
  - the plan uses fill / outline / dashed / dashed-amber, with a text legend.
- **Themes.** Chart (light) theme and solid panels from the Display menu.

### Contrast, measured on the composited surface

`scripts/measure-contrast.ts` photographs each state with every text colour made transparent: glass, blur, scene and plan stay as rendered (GPU, motion paused). It then compares every visible text run's colour with each pixel under its glyph box, using the 2nd-percentile pixel and the WCAG thresholds.

- **15 states, 1,105 text runs, 0 below threshold** (`qa/batch7/contrast.json`). The states cover: desktop dark and light; the possible-match box, staff card, confirm block, resolved summary and an unknown berth; solid panels; tablet; mobile; small provenance tags included.
- **Lowest margins:** ASSUME tag on tablet 4.93:1; “Explore slip review” on the orange button 5.22–5.29:1.
- **Two script bugs fixed before trusting the numbers:** clipped (scrolled-away) text was being sampled, and underlines stayed opaque. Lines cut at a scroll edge are measured in separate scrolled states.
- **Real defect found and fixed:** light-theme amber pills over bright glass and the selected-row tint measured 3.56–4.13:1. Pills now sit on a solid chip in the light theme.
- **Not measured:** non-text contrast (WCAG 1.4.11) of the dashed review contour and the sand “unknown” tint over water.

### Automated scan

`@axe-core/playwright` 4.14.0 (dev dependency only) with the WCAG 2.0/2.1/2.2 A and AA tags.

- **11 states, 0 violations, 406 rule passes** (`qa/batch7/axe-results.json`). States: desktop overview, evidence review, resolved, Harbor Light's record, guided replay, Display menu, light theme; tablet Details and list; mobile list + plan; evidence review in the sheet.
- About 2 “incomplete” items per state are axe asking for manual contrast review over images and blur; the measured contrast above covers them.
- **Actionable findings, all fixed:**
  - provenance tags' accessible name did not contain the visible text (“SIM”) — now “SIM: Simulated (provenance)”;
  - tags were 18 px targets — the button is now 24×24 with an unchanged 11 px chip;
  - two tags in adjacent fact rows were 23.6 px apart — spacing fixed.
- **Touch targets:** every visible control on mobile is ≥ 24×24 CSS px (inline sentence links exempt per WCAG 2.5.8). Workflow buttons are ≥ 40 px and list rows 44 px.

### Motion

- **Water.** A slow ripple drift driven by a 30 fps ticker that requests frames only while motion is allowed and the tab is visible. Pausing freezes the surface exactly (the water clock stops).
- **Pause motion** sits beside the camera presets and in Display. It is remembered across reloads and announced.
- **Reduced motion.**
  - **At load:** still water, camera cuts, and the toggle disabled with a title explaining why.
  - **Switched on mid-session:** ambient frames stop and the next selection is a cut. Switched off again: frames resume and the next selection is a real flight (measured in-page in the first frame after the move starts).
- **Rendering.** The adaptive pixel ratio now samples only frames in which the camera moved, so throttled water frames cannot read as a slow GPU. The shadow map is not redrawn for ambient frames.
- **Browser suite runs with motion paused** (saved preference in `motion-paused.storage.json`), so the Batch 4–6 idle-frame assertions keep their meaning. `motion.spec.ts` starts with no preference.

## T18 — Failure and stale-data handling

### Behaviour

| Condition | What the user gets | Invariant kept |
|---|---|---|
| Camera / source offline | “C-04 offline · does not mean empty”, presence Unknown, last report kept with its time | Never empty, never bookable |
| Stale observation | “Last reported present at 09:12 · current presence unknown” | Last report separate from current confidence |
| Unknown presence or identity (glare, unverified hull) | “Presence unknown” / “identity unverified”; last confirmed identity named only as “Last confirmed …” | No inferred identity |
| Newer staff evidence while the camera is offline | Staff check 09:18 shown as its own source; after confirmation “Present · staff verified” | Staff verification distinct from the old camera frame |
| Missing or failed evidence image | Labelled “Image unavailable · text evidence below”, alt text, every action | Acknowledgment still required |
| Missing required staff evidence | Confirm disabled, “Needs staff evidence…” | Issue stays open (unit- and browser-tested) |
| Missing boat model | Plain grey stand-in at the same place, size and pick target, no name board; note “Some boat models failed to build” | Stand-in implies no identity |
| Failed or invalid geometry | “Map unavailable”: no 3D, no plan; list, inspector and the full review work | Geometry validated at load (`validateSite`), never guessed |
| Missing provenance / broken reference | Notice listing each set-aside record and the reason; the rest works; counts exclude it | Quarantine (T05); a canonical-record failure is fatal and disables the workflow |
| Storage unavailable / corrupt / incompatible | Plain notice, in-memory session, full workflow | Seed state, not partial trust |
| Storage writes failing mid-session | “Changes are no longer being saved…”; everything keeps working | No duplicate task or audit on retry; refresh honestly starts at the seed |
| WebGL unsupported | The 2D plan as the map, with a notice; no 3D camera controls | Same records |
| WebGL context lost after load | Plan takes over immediately with a notice and **Restart 3D view** | Selection, open review and acknowledgment unchanged; the restart duplicates nothing |
| 3D chunk fails to load | Plan plus “3D view unavailable · Try again” | Retry refetches |

### Files

- `src/app/faults.ts`: dev/test fault switch.
- `src/data/site.ts`: `validateSite`, `SiteGeometryError`.
- `src/data/fixtures.ts`: fixture faults at the loader boundary.
- `src/app/AppStore.tsx`: storage faults.
- `src/scene/assets/boat.ts`: model fault, stand-in.
- `src/scene/modelFailures.ts`.
- `src/scene/Boat.tsx`, `Shore.tsx`: stand-in for moored and stored boats.
- `src/scene/SceneRoot.tsx`: context-loss listener.
- `src/app/ErrorBoundary.tsx`: `onError`.
- `src/app/Shell.tsx`: map fallbacks and notices.
- `tests/e2e/failures.spec.ts` (13), `nowebgl.spec.ts` (1), `tests/unit/batch7.test.ts` (5).

### Fault injection (reproducible; never in the public interface)

Faults apply only when the URL has **both** `debug` and `fault=`. Without `?debug` the parameter is ignored.

| How | Condition |
|---|---|
| `/?debug&fault=webgl-unsupported` | WebGL probe fails |
| `/?debug&fault=geometry` | One slip corner becomes NaN; geometry validation fails |
| `/?debug&fault=model` | The cabin-cruiser generator throws (moored and stored boats) |
| `/?debug&fault=evidence` | Evidence images point at missing files |
| `/?debug&fault=record-provenance` | V-030 arrives without provenance |
| `/?debug&fault=record-reference` | AGR-031 references V-999 |
| `/?debug&fault=scenario-provenance` | The canonical Lake Effect record lacks provenance (fatal) |
| `/?debug&fault=storage-unavailable`, `storage-corrupt`, `storage-incompatible`, `storage-write` | Storage failures |
| `/?debug` + `__harborDesk.store.dispatch({type:'setSourceStatus', sourceId:'C-02', status:'offline'})` | Camera offline at the current clock |
| `/?debug` + `document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()` | Context loss after load |
| Launch Chromium with `--disable-webgl --disable-webgl2 --disable-3d-apis` (`nowebgl.spec.ts`) | A browser that really has no WebGL |
| Block `**/assets/SceneRoot-*.js` | 3D chunk fails to load |

Faults can be combined: `fault=record-provenance,record-reference`. Batch 6's note planned a *UI control* for the offline camera; I did not add one, per this batch's instruction to keep fault injection out of the public interface. The scenario command stays reachable through `?debug`.

## Checks actually run (final tree)

| Check | Environment | Result |
|---|---|---|
| `npm run check` (tokens, fixtures, assets, typecheck, lint, unit, production build) | Node 24.11, macOS 14.4 | Green. **162 unit tests in 17 files** (was 157 in 16) |
| `npx playwright test --workers=1` | Production build on 4719; Chromium 159; SwiftShader (software WebGL) | **63/63** (was 33): the 33 earlier journeys plus responsive 5, zoom 1, a11y 6, motion 4, failures 13, no-WebGL 1 |
| Real 200 % browser zoom (`zoom.spec.ts`) | Full Chromium, new headless mode, persistent profile with Chromium's default page zoom at 200 % | Pass: `innerWidth` 720, `devicePixelRatio` 2, compact layout, review completes, controls inside the window |
| axe-core scan | As above | 0 violations in 11 states |
| `scripts/measure-contrast.ts --gpu` | Headless Chromium, ANGLE Metal, Apple M3 Max | 0 failures in 15 states / 1,105 runs |
| `scripts/capture-layouts.ts --gpu` | Same, 4 stages × 6 sizes | 0 overlaps, 0 covered controls, 0 horizontal scroll (`qa/batch7/layouts-*.json`) |
| `scripts/aria-snapshots.ts` | Chromium accessibility tree | Five stages recorded, 0 identity leaks |
| Visual non-regression | GPU capture vs Batch 6 Gate B | B-12 and overview scene unchanged (`nonregression-compare-*.png`) |
| `npm run profile -- --gpu` (60 s, water moving) | M3 Max, DPR 1 | 59.9 fps median, p95 16.7 ms, max 33.4 ms, 3,604 frames: same as Batch 6 |
| `npm run transfer` | Production build | 715 KB gzip whole demo (Batch 6: 709 KB); shell JS 118 KB gzip, scene 291 KB, geometry chunk 13 KB, plan 1.6 KB |
| `npm audit --omit=dev` | — | 0 vulnerabilities in runtime dependencies |

**One run of the full suite failed and was not counted as a pass.** It had 1 failure, which exposed the boundary-reuse bug below. Every fix was followed by a fresh full run.

## Screenshots

All in `qa/batch7/`. Layout captures are GPU, production build; `e2e-*` are SwiftShader from the journeys.

- **Desktop:**
  - `layout-desktop-1440-{overview,uncertain,resolved,review-light}.png`, same for `-1280-`;
  - `e2e-desktop-1440-uncertain.png`, `e2e-desktop-light-solid-review.png`.
- **Tablet:** `layout-tablet-1024-*.png`, `layout-tablet-768-*.png`, `e2e-tablet-1024-details.png`.
- **Mobile:** `layout-mobile-390-*.png`, `e2e-mobile-390-resolved-{direct,pending}.png`.
- **200 % zoom:** `e2e-zoom200-resolved.png` (real zoom); `layout-zoom200-1440-*.png` (720×450 @2, the same CSS viewport).
- **Recovery:** `e2e-recovery-{context-lost,no-webgl-desktop,geometry,model-fallback,quarantine,stale-offline,mobile}.png`.
- **Visual non-regression:** `nonregression-compare-b12.png`, `nonregression-compare-overview.png`.

## Defects found and fixed in this batch

1. **Batch 6 rail rules overrode the new layout.** `registry.css` held a duplicate copy of the rail and inspector rules and loads after `shell.css`. Removed; `shell.css` is the single source.
2. **`scrollIntoView` slid the rail under the top bar** (latent since T10; visible only in compact rails). It scrolled `overflow:hidden` ancestors. Only the nearest scroller moves now.
3. **Scene markers drew above panels** (Drei `Html` z-index 20 vs panels 4–6; latent since Batch 3). Markers now sit below every panel.
4. **One failed boat model took down the whole 3D view.** Stored scenery boats called the generator unprotected. Found by fault injection. Both moored and stored boats now fall back.
5. **My 3D and plan error boundaries shared an instance** (same position, no key), so a failed 3D load also hid the plan. Keyed. Found by the Batch 2 failed-chunk test.
6. **An intentional canvas unmount read as a context loss** (R3F releases the context on purpose). A loss now counts only while the canvas is still in the document.
7. **The shell chunk pulled in three.js** (114 → 200 KB gzip) through a model-failure counter import. Moved to a dependency-free module; back to 118 KB.
8. **Light-theme amber pills at 3.56:1** (composited measurement). Solid chip.
9. **Provenance tags failed axe** (name mismatch; 18 px target; since T07). Fixed as above.
10. **The Display popover ignored `hidden`** (`display: grid` wins). Fixed.
11. **The browser suite overwrote Batch 6's `qa/batch6/e2e-*.png` again.** Restored from git; specs now write to `qa/batch7/`.
12. Test-side mistakes (not app defects): a locator matching the announcer as well as the notice; an `option` locator matching `<select>` options; a reload that carried the previous viewport's session.

## Remaining defects and unverified checks

- **Manual screen-reader test: not run.** No screen reader could be operated and heard from this environment. Turning on VoiceOver would change your Mac's system settings, and I could not hear its output. The substitutes are the axe scan, the accessibility-tree snapshots and the keyboard journeys; **they do not replace a VoiceOver/NVDA pass.**
- **Physical devices: none.** Tablet and mobile are Chromium viewport emulation with mouse input, not touch hardware or iOS Safari.
- **Context loss was exercised on SwiftShader only** (a real `WEBGL_lose_context` event in software GL). GPU captures and the profile ran on the M3 Max.
- **Carried forward:** the M1 MacBook Air frame-rate target is still unverified; the adaptive pixel ratio has still never been seen to engage.
- **Mobile 3D opt-in** (Display → Use 3D view) and its bottom-sheet camera offset have **no browser journey**; only the plan path is tested on mobile.
- **Geometry failure is all-or-nothing:** one invalid slip disables the whole map. The list and review still work; per-slip quarantine of geometry is not implemented.
- **The plan has no pinch zoom or pan:** dock buttons and selection focus only. At “All docks” on a phone the slips are too small to tap, so the list is the route.
- **Non-text contrast** of the dashed review contour and the unknown tint is not measured.
- **Copy:** a glare reading shows “Freshness: Current (demo policy)” next to “Presence unknown”. Accurate (a fresh *unknown* reading) but easy to misread.
- **Shipped test hooks:** the `?debug` bridge gained `hull().fallback` and `overlays()`. Fault injection ships inert behind `?debug` (T23).
- **Dependencies:**
  - `npm audit` reports one moderate advisory in the existing dev lint chain (typescript-eslint → minimatch); the only fix is a breaking downgrade.
  - Installing axe made npm prune two optional peer entries (`@emnapi/core`, `@emnapi/runtime`, rolldown's WebAssembly fallback) from the lockfile.

## Command summary after Batch 7

```
npm run check                                  # tokens, fixtures, assets, typecheck, lint, 162 unit tests, build
npx playwright test --workers=1                # 63 journeys (stop any preview on 4719 first)
node scripts/capture-layouts.ts --url http://127.0.0.1:4719 --gpu --paused [--stage uncertain --select B-12] [--theme light]
node scripts/measure-contrast.ts --url http://127.0.0.1:4719 --gpu --out qa/batch7/contrast.json
node scripts/aria-snapshots.ts --url http://127.0.0.1:4719 --out qa/batch7/aria-snapshots.md
npm run profile -- --gpu --out qa/batch7/profile-gpu-dsf1.json
npm run transfer -- --out qa/batch7/transfer.json
```

## Starting point for Batch 8 (T19–T21)

- **T19 — critical browser journeys.** Most of the TASKS T19 list already exists across `review`, `responsive`, `a11y`, `failures`, `nowebgl`, `zoom`, `marina` and `scene` specs. Start by mapping each T19 item to a journey, then fill the gaps:
  - mobile 3D opt-in;
  - an actual canvas-selection smoke test in a **visible GPU** browser window (everything interactive so far is SwiftShader);
  - the reduced-motion keyboard path on mobile.

  Keep `--workers=1` (parallel workers on this machine caused load-dependent timeouts).
- **T20 — About / Sources.** No such panel exists yet. The footer and SIM/ASSUME/DOC/FIELD tags are in place. The Display menu shows how to add a small disclosure panel without new layout zones; the mobile sheet already scrolls as one container.
- **T21 — final review and Gate C.**
  - Run everything above.
  - Do the **manual screen-reader pass** (VoiceOver + Safari, and NVDA if a Windows machine is available) and record the reader and browser.
  - Do the M1 Air profile.
  - Measure non-text contrast for the review contour.
  - Write `QA.md`.
- **Keep passing:** all 63 journeys and 162 unit tests. In particular:
  - `review.spec.ts` journey 1 (same hull before and after resolution; no hull at B-14);
  - the identity-leak tests;
  - the idle-frames tests (they rely on the paused-motion storage state);
  - `failures.spec.ts` (any new chunk or module must keep three.js out of the shell chunk).


## Batch 8 — T19–T21 / Gate C (14 November 2026)

**Gate C passed for applicable local release criteria, with explicitly unverified target-device and spoken-reader checks.** T19, T20 and T21 are complete. [QA.md](QA.md) is the release record, including workflow mapping, actual results, visual findings, limitations and reproduction steps. Scope stopped before T22–T23. No publishing, deployment, live-portfolio edits or external integrations.

### Independent review and material changes

Read the project instructions, PRD, TASKS, BUILD-LOG, DESIGN, source/asset manifests and prior gate evidence. Checked previous completion claims against the production app, fixtures, tests and approved screenshots/visual-target-v2. Kept the validated geography, authored dock/boat geometry, source data, historical gate captures and supplied fonts unchanged.

- Added a keyboard-accessible About / Sources dialog: independent concept, fictional records/evidence/actions, assumed 126-slip layout, approximate surroundings, plain-language DOC/ASSUME/SIM/FIELD, dated references and pilot requirements.
- Audited product claims and shipped assets. Added source/right/credit notices for 14 bundled packages; preserved the upstream Fiber MIT notice and existing IBM OFL. General Sans/Switzer files and Raj's recorded font decision are unchanged. Current Fontshare legal text could not be independently extracted; that limitation remains explicit.
- Kept OSM credit visible beneath the mobile sheet scroller and outside About, including fallbacks.
- Fixed low non-text contrast with narrow dark backing beneath orange selection and amber review contours. Actual composited core/backing minima: 4.85:1 and 8.19:1. No boat, dock, material or geography redesign.
- Corrected narrow-desktop header clipping, clarified a fresh-but-unknown presence label, and linked the existing favicon to avoid a static-host 404.
- Corrected mobile 3D camera framing: removed an obsolete overlapping-sheet inset; marker/boat now remain visible above the sheet. Added bounds assertions and screenshot review.
- Added visible-GPU real-pointer picking, mobile 3D opt-in/state retention, reduced-motion keyboard workflow and About focus/theme/axe coverage. Fixed locator mistakes rather than weakening assertions. Corrected native 200% zoom screenshot cropping with a full physical-viewport capture.

### Actual verification

Final production SHA-256: `8351b7b5e1fe7d8b05c909aefdbe5975e65fb3b3ee428a2b27bd9f893547b040` (sorted dist paths and bytes, including maps). Evidence: `qa/batch8/`.

- `npm run check`: token/asset reproduction, 12 fixture files with no errors/warnings, typecheck, lint, **162 tests / 17 files**, production build. `qa/batch8/check.log`.
- `npm run geometry`: unchanged **23/27 pass + four documented source flags**; no overlap or canonical-ID regression. `qa/batch8/geometry.log`.
- Complete production suite: **67/67 passed** (`browser-tests-final.log`). After the final mobile-camera correction, **16/16 affected tests passed** (`final-framing-regression.log`): accessibility, responsive layouts, About, mobile keyboard/3D, real GPU picking and actual browser zoom. The other 51 checks were not rerun after that camera-only correction.
- Axe: **11 states, zero violations**, plus four About theme/layout scans with zero violations. Incomplete rules remain documented. Text contrast: 15 states, zero measured failures. Manual native UI interaction reviewed focus, disabled states, evidence acknowledgment and resolution; no spoken screen-reader claim.
- Rendered review at 1440×900, 1600×1000, 1024×768, 390×844 and actual 200% Chromium zoom. Compared selected B-12 with v2 and previous approved work. Documented simpler distant context/materials; preserved validated landmark placement. New mobile 3D composition visually verified.
- Visible Chromium 159.0.8154.6 / Metal / Apple M3 Max (14 cores, 36 GiB), 1440×900 DPR 1: defined 60.07-second run, **59.88 fps median / 17.8 ms p95 / 51.6 ms max**, one frame above 33.3 ms. Draw calls **22–82**; selection feedback **14.0–25.1 ms**. Targets pass on this substitute only.
- Cold gzip HTTP server, 10 Mbps down/up, 100 ms latency, no CPU throttle: three DPR 1 runs **388.0–409.3 ms shell / 1,179.2–1,200.7 ms 3D**; DPR 2 **403.0 / 1,176.9 ms**. Fresh browser contexts/cache disabled; GPU driver caches not flushed.
- Actual complete-demo compressed bodies **757,387 B**, including deferred plan/evidence and both image densities; Resource Timing with standardized headers **762,787 B**. Fonts **170,448 B** bodies / **171,948 B** transfer. All deployable files excluding maps **764,521 B** compressed; disk **2,050,805 B** excluding maps / **8,284,703 B** including maps. No accidental authoring media shipped; diagnostics documented.
- Five selection/resolution/backward-replay/preset/reset cycles: flat **136 geometries, 8 textures, 15 programs; 1 document, 1,933 DOM nodes, 637 listeners**. No progressive growth in the tested procedure.
- Normal measured run: **zero console errors, failed/missing requests or external origins**. Loaded demo completed direct mobile resolution offline at both DPRs. No offline-reload/install claim.

The first suite pass found test locator errors, duplicate mobile credit links and a legacy no-live-badge assertion matching the negative About disclaimer. These were corrected; final logs record the passing regressions. No thresholds were changed. Full methods and caveats are in QA.md.

### Remaining limitations and exact Batch 9 starting point

M1 MacBook Air frame rate/latency, spoken VoiceOver/NVDA operation, physical touch devices and Safari/Firefox remain **unverified**. The four inherited geometry-source flags remain documented. Fast-GPU adaptive DPR engagement, long-duration memory behavior and current Fontshare legal text are not newly certified. Visual differences from v2 are recorded, not hidden.

**Next task: Batch 9, T22 — Prepare the demonstration package.** Start by reading QA.md and its evidence/limitations, preserve SIM/ASSUME labels and approved geography, then capture the consistent 1600×1000 normal/uncertain/resolved package and 60–90-second walkthrough and write honest portfolio copy. After T22, do **T23 — build/run documentation and final handoff**. Do not call Batch 8 QA evidence the completed showcase package. T22 and T23 remain unchecked. Publishing, deploying or editing the live portfolio requires a separate request.

## Plan change — 15 November 2026 (no code changed)

Raj approved a v1.1 improvement phase after a Dockwa comparison ([DOCKWA-ANALYSIS.md](DOCKWA-ANALYSIS.md), [IMPROVEMENT-PLAN.md](IMPROVEMENT-PLAN.md)). TASKS.md now has **Phase 4.5, T24–T35** and Gate D. T22–T23 move after Gate D. 3D stays the default view.

**New starting point: Batch 9 = T24–T27, starting at T24 (poster frame and opening shot).** Before T25, ask Raj to approve the chrome diet, the operator KPIs and the single-marker labelling. Before T27, ask him to pick fonts. The "Next task: Batch 9, T22" line above is superseded.

## T27 — Typography (15 November 2026)

Raj chose the type trio after three specimen rounds ([design/type-options.html](design/type-options.html), [design/type-options-2.html](design/type-options-2.html), [design/mono-pairings.html](design/mono-pairings.html)): **Commissioner** (headings, names, labels, counts), **Work Sans** (body, UI, buttons) and **Atkinson Hyperlegible Mono** (IDs, times, data, tags). It replaces General Sans, Switzer and IBM Plex Mono. No family is in shadcn's font registry (checked live).

### Changes
- Fonts: one variable WOFF2 per family from google/fonts (SIL OFL 1.1, no Reserved Font Names), instanced with fontTools (Commissioner wght 400–800 + FLAR 0–100, VOLM/slnt pinned to 0; Work Sans and mono wght 400–600) and subset to Latin plus the UI's punctuation, arrows and math signs. **3 faces, 96,212 B** (was 5 faces, 170,448 B). Licences are in `design/fonts`, `public/fonts` and `design/licenses`; credits are in About / Sources and THIRD-PARTY-NOTICES. Old files were removed from `public/fonts` and kept in `design/fonts` for older design artefacts.
- Tokens: new families, a rewritten scale (`body-sm` 15, `label` 12.5, `h6` 17–20, `data-lg` 30–40, new `control` 14, `accent-num` removed), new line-heights and tracking, and a new `font.flare` group → `--flare-display/count/ui` (generator extended in `src/ui/tokenCss.ts`).
- Styles: `.label` moved from mono to Commissioner caps (flare 0); headings, object names and panel titles use flare 100; KPI counts (`data-lg`) moved to Commissioner at flare 60 (proportional figures, discrete updates only; the sim clock stays mono); the wordmark is Commissioner 700 at +0.1em. Canvas name boards use Commissioner 700 / Atkinson Mono 500 (canvas can't set FLAR).
- Layout regressions from the larger text, all found by the suite and fixed:
  - The camera bar grew to 496 px against its 480 px budget, which overlapped the bottom-left zone at 1280×800. Fixed with the `control` token (476 px).
  - The scenario panel grew 88 px (its head wrapped and the foot stacked), which covered berths and broke the A-21 canvas click. Fixed with control-size head actions and a flexible foot note; it's now 213 px (was 209).
  - The mobile rail tab "Slips & vessels" wrapped. Fixed with `nowrap`.
- DESIGN.md §3 rewritten (roles, flare, scale, rules), and every other type reference in DESIGN.md updated.

### Verification
- `npm run check` parts: tokens, fixtures, typecheck, lint, **162/162 unit tests**, production build.
- Browser suite: **66/67 passed**. The one failure is `zoom.spec.ts`, which asserts `devicePixelRatio === 2` at 200% zoom; this machine's main display is a built-in Retina panel, so the headed window reports 4 before any app code runs. It's environmental and independent of fonts, but it was not re-run on a non-Retina display. Fonts load locally only (foundation spec), and accessibility and contrast specs pass.
- Checked in the browser at 1440×900 and 375×812: computed families, weights and FLAR values match DESIGN §3.
- Not done: the evidence stills (`public/assets/evidence`) were not re-rendered, so their burnt-in camera stamp and staff-photo name boards still show the old faces. `design/vessel-card.html` still loads the retired faces (noted in DESIGN §12).

## Copy and type refinement — clean-copy pass (15 November 2026)

Raj asked to keep the new type trio and cut excessive or redundant text using the clean-copy skill. Its ladder: (1) does it need to surface at all, (2) does the label restate something already on screen, (3) is it pre-empting a worry the user never had, (4) rewrite or delete. This covers most of **T26**, done ahead of T25. The fonts are unchanged.

### Cuts and rewrites (old → new, ladder rung)

| Where | Was | Now | Rung |
|---|---|---|---|
| Top bar (`src/app/Shell.tsx`) | "Simulated data SIM" + "Assumed slip layout ASSUME" | "Simulated demo SIM" (PRD F17) | 2 |
| KPI tiles | "Assumed slips ASSUME" · "Simulated vessels SIM" · "Needs review SIM" | "Slips ASSUME" · "Vessels SIM" · "Needs review" | 2 |
| Footer | OSM credit + 25-word disclaimer | About / Sources + OSM credit (the scenery sentence moved into About) | 2 |
| Scenario panel | "Slip review · B-12 scenario SIM"; "Simulated time moves only when you use a scenario control. Nothing here contacts anyone." | "Slip review · B-12"; foot note cut | 2, 3 |
| Replay | "Rebuilt from the seed: nothing later than … exists in it. Your run is untouched." | "Trying this state replaces your current run." (the real consequence) | 3 |
| Inspector headings | "Assigned vessel · registry", "Latest observation · separate from the registry", "Slip details and provenance", "Vessel V-021 · registry record" | "Assigned vessel SIM", "Latest observation SIM", "Slip details", "Vessel V-021" | 2, 3 |
| Per-row SIM tags | One SIM tag on every fact row | One tag per section heading; rows show a tag only when it differs (ASSUME/DOC slip details) | 2 |
| Observation headline | "Vessel present · identity unverified" next to a PRESENT pill | "Identity unverified" | 2 |
| Facts | Agreement "Seasonal · B-12"; Freshness "Current (demo policy)"; Identity "Unverified" row; Camera "C-02 offline · does not mean empty"; Bookability detail row | "Seasonal"; "Current"; row cut (headline says it); "C-02 offline" (presence reads Unknown); row cut (summary grid) | 2, 3 |
| Possible match | "Possible match (candidate only, not an identity): …" + "Reason for doubt: …" | "Possible match: …" (the reason lives in Observed / Not established) | 2 |
| Review panel | Frame summary paragraph + Observed/Not established, which said the same three facts twice | The split only, tightened to 3 bullets | 2 |
| Scenario controls | Notes under both demo buttons restating the button | Cut; the "Scenario control" label stays | 2 |
| Dock check | Duplicate "Dock check pending" pill; "Simulated local task: no message, notification or staff dispatch was sent." + "Identity remains unverified. The issue stays open until…" | "Dock check TSK-0001"; "Requested 09:13 · no message sent" (kept once: a real consequence) | 2, 3 |
| Evidence review | "Evidence review · B-12"; table caption "Observation vs registry records"; "The possible match is a comparison only…"; "(unchanged)" and "on record" in cells | "Evidence review"; caption screen-reader only; sentence cut; plain values | 2, 3 |
| Staff evidence | "Staff dock check · Demo dock staff · 09:18", caption "Staff photo · 09:18 · SIM", summary starting "Staff dock check:", "Recorded separately from the camera…" | "Demo dock staff · 09:18", "Staff photo", fixture summary starts at the finding, last sentence cut | 2, 3 |
| Confirm | Hints "Needs staff evidence. Camera evidence alone…" (repeating the block above) and "Confirms the identity… The agreement does not change." | "Needs staff evidence."; no hint when ready to confirm | 2, 3 |
| Resolution | Second RESOLVED pill; Presence, Evidence and Bookable rows (repeating the observation section and summary grid); task note; "(retained, unchanged)"; "(candidate only, never an identity)" | Headline + Identity + Agreement; task completion stays in History | 2, 3 |
| Trail | "Activity trail · append-only"; CSS " · retained" suffix; details restating the title | "History"; suffix cut; details are source / ID only | 1, 2 |
| Normal stage | "…; B-12 stays assigned and is not bookable. Camera shows it empty at 08:45." | "No open issue. Lake Effect departed at 08:10 (staff log)." (summary grid carries the rest) | 2 |
| Vessel inspector | Location note repeating the pill; document-review disclaimer | "Source: staff log" (or nothing); disclaimer cut (values already say "(demo)") | 2, 3 |
| Announcements | "…No message sent. The issue stays open." / "…Issue resolved; the agreement is unchanged." / "…still needs review; nothing changed." | Trailing clauses cut | 3 |
| Registry | Header SIM/ASSUME/DOC tags; two pills per row (truncated names to "Lake") | Tags cut; one pill per row (an open review outranks presence) | 2 |

**Kept on purpose** (they pass the ladder):
- "no message sent", once, at the moment of requesting;
- "Camera evidence alone cannot confirm identity" — why confirmation is blocked;
- the acknowledgment hint;
- "(optional)" on the dock-check stage;
- "· text evidence below" on a missing image (what to do next);
- the "Scenario control" label;
- "Trying this state replaces your current run."

### Typography fixes with the new trio
- **Agreement terms** now read "1 May – 15 Oct 2026". ISO dates broke mid-number in the rail.
- **"ft" can't wrap alone:** values use a non-breaking space.
- **Stage strip:** items are top-aligned, so all five stage times share one line when "Dock check (optional)" wraps.
- **KPI labels:** reserve the 24 px tag height, so a tile without a tag keeps its number on the shared baseline.
- **Inspector eyebrow** ("Dock B · Floating") no longer wraps beside a long status pill.

### Measured effect (1440×900, dev build)

| State | First screen, words | Inspector, words |
|---|---|---|
| Normal 08:45 | 183 → 122 (−33%) | 97 → 63 (−35%) |
| Uncertain 09:12 | 191 → 115 (−40%) | 199 → 101 (−49%) |
| Evidence review 09:18 | — | 412 → 244 (−41%) |
| Resolved 09:20 | 198 → 120 (−39%) | 231 → 151 (−35%) |

What's left on the first screen is mostly chrome: the stage strip, registry list, top bar and camera bar. T25 (chrome diet) is where the remaining cut happens.

Captures: `qa/batch9/copy-uncertain-full.png`, `copy-evidence-inspector.png`, `copy-resolved-inspector.png`.

## Batch 9 — T24–T27, first 10 seconds (15 November 2026)

T27 (type) was done in its own session; the copy pass above covers most of T26. This entry records T24, T25 and the close of T26.

### T24 — Poster frame and opening shot
- **New start pose:** `ESTABLISHING_POSE` (`src/scene/camera.ts`) looks from the water across the grain elevator, the yard and the docks. Overview was tried first and rejected: at that distance the marina is a thin strip and the world edge shows.
- **Poster:** `scripts/render-poster.ts` renders the poster from the app at that pose (desktop layout, so the rail framing matches), with the browser as the WebP encoder. Output: `public/assets/poster/harbor-1600.webp` (38,614 B) and `harbor-2400.webp` (68,964 B). Preloaded in `index.html` for widths ≥ 768 px only (mobile defaults to the plan).
- **`src/scene/intro.ts`:** a small external store with phases `poster → flying → done`.
- **`src/app/ScenePoster.tsx`:** the poster sits above the canvas and below every panel. It fades over 400 ms (the `scene-in` token) once the second frame is drawn, and is cut under paused or reduced motion. A timer removes it if `transitionend` never fires.
- **`CameraRig`:**
  - The camera holds still during the fade (no ghosting), then makes a 3 s eased move to Dock B.
  - A click, key or wheel (capture phase) skips the move to its end pose; user drags or a selection take over.
  - Paused motion, reduced motion, a restored selection, a list selection before the first frame, or a hidden tab all land at once.
  - Selection and scenario state are never touched.
- **Dock B is now the resting preset and the Reset target** (it was Overview).
- **Measured** (headless Chromium on the Metal GPU, dev build, 1440×900): poster at 0.27 s, canvas drawn at 0.89 s, fade from 1.12 s to 1.44 s, camera landed at 4.3 s. Frames: `qa/batch9/t24-poster-first-paint.png`, `t24-poster-fade.png`, `t24-intro-end-dock-b.png`.

### T25 — Chrome diet
- One "Simulated demo" marker (done in the copy pass).
- About is in the top bar, beside Display; on mobile it stays in the sheet.
- The registry list starts closed on desktop. Search or "Show" opens it, and narrower layouts keep it as their main pane.
- **Bug found:** `.registry-body { display: flex }` overrode `[hidden]`, so the list had never actually hidden. Fixed.
- **KPI tiles** now come from `operatorSummary()` (`src/domain/selectors.ts`):
  - Occupancy: agreements covering the scenario night, out of all slips.
  - Arrivals: arrivals logged on the scenario day in Buffalo time (new `localDate()`).
  - Needs review: open issues.
  - Revenue at risk waits for T28 rates. Occupancy shows 37% until T28 supplies a realistic July.
- Mobile tiles share the row width with no notes; the notes had turned the row into an unfocusable scroller (axe `scrollable-region-focusable`).
- **Coverage at 1440×900:** 24.7% by default (44.4% before; target ≤ 30%), and 42.6% with B-12 selected, where the inspector is the task. Captures: `qa/batch9/t25-default-1440.png`, `t25-uncertain-1440.png`.
- **Deviation:** the scenario card was not collapsed to one line. The coverage target is met without it, and a single-line strip crushed the stage labels.

### T26 — close
First-screen words against the Batch 8 baseline, measured identically:

| State | Before | After | Change |
|---|---|---|---|
| Fresh load | 169 | 65 | −62% |
| Uncertain | 191 | 105 | −45% |
| Normal | 183 | 123 | −33% |
| Resolved | 198 | 133 | −33% |

The −40% target is **met for the first screen and the uncertain state, not for normal and resolved**.

### Tests
- **New:**
  - `tests/e2e/intro.spec.ts`: cold-load poster then landing, skip by key, reduced motion.
  - `tests/unit/operator-summary.test.ts`: occupancy from agreements, arrivals in local time, open reviews.
- **Updated for the new defaults:**
  - A `showList()` helper for tests that read the list.
  - Overview chosen explicitly where a test needs the wide view (fly-to interruption, scenery clicks).
  - KPI and About labels.
  - `zoneOverlaps` now exempts zones nested in the mobile sheet in either order.
- **Screenshot paths** now write to `qa/batch9/` instead of overwriting Batch 8 evidence.

### Verification
- **Checks:** `tokens:check`, `fixtures:check` (12 files, 0 issues), `assets:check`, typecheck, lint and **165/165 unit tests**, all passing (`qa/batch9/check.log`). Production build OK; the shell chunk is 119.5 KB gzip, with three.js still only in the scene chunk.
- **Full browser suite** (`qa/batch9/browser-tests-final.log`): **67/70**. Two failures were tests reading the now-closed list; both were fixed in the tests and their three specs (failures, marina, foundation: 27 tests) rerun green. The third is `zoom.spec.ts`, which fails before any app code on this Retina display (DPR 4, not 2); it's unchanged since T27.
- **Not run:** the full suite was not re-run end to end after those two test-only fixes. No M1 Air, physical device, Safari/Firefox or spoken screen-reader pass.
- **Still stale:** DESIGN.md §9 describes the old dataset KPI tiles and the Overview resting view, and the evidence stills still show the old faces (noted under T27).

**Next: Batch 10 = T28 (realistic July fixtures, with Revenue at risk) and T29 (3D dock map).**

## Batch 10 — T28 Realistic July fixtures (16 Nov 2026)

**What changed**
- **Occupancy: 38% → 88%.** 111 of 126 slips held on 15 July: 89 seasonal, 22 transient. 15 stay vacant, including A-02, B-30 and C-05, which scenario tests rely on. The B-08…B-16 neighbourhood is always held.
- **Vessels 48 → 113.** The original 48 are untouched: same names, slips, documents and the V-047/V-048 waiting-list pair. The 65 new ones (V-049…V-113) come from a second seeded stream, `harbor-desk/b12-v1/july-day`, so the first 46 assignments never moved.
- **Rates.** Every agreement now carries `rateUsd` and `rateBasis`. Seasonal = slip length × a $/ft by dock (A 82, B 96, C 108, D 118, E 128). Transient = slip length × $2.50 a night. Both are **ASSUME** per field, with a new `SRC-RATES` source saying they are demo round numbers and not a Buffalo rate card.
- **A day of movements.** `Movement` gained `trip` (`stay` or `outing`) and `expectedReturnAt`. 15 transient check-ins run from 07:05 to 21:40, plus 21 outings: the five original morning day-boats, 16 new ones, 3 of them overnight. Movements run 06:00–22:00, and the 20:00+ evening times needed `hm()` to roll into the next UTC day.
- **Away-boat flags.** Derived, not stored: `awayBoats(fx, session)` lists boats whose latest logged movement at the clock is a departure, with the plan if one was logged. At 08:45, 11 boats are away; Lake Effect's return is unknown.
- **One offline camera.** C-04 now covers only C-01…C-09 and is the only camera offline (from 07:05). New cameras C-05 (C-10…C-18) and C-06 (Dock E) stay online. Unknown berths at the opening scene fell from 28 to 10.

**KPIs derive from selectors.** `operatorSummary` now returns occupancy, arrivals, needs review, away, offline cameras, nightly revenue and revenue at risk. The fourth tile, **Revenue at risk**, is the term value of the agreements on slips with an open review issue: $0 on a normal day, $2,880 (B-12's season fee) at 09:12, $0 once resolved. Arrivals now count check-ins only (15); a seasonal boat returning from an outing is not an arrival.

**Compatibility.** No scenario-engine test changed in substance. Edited tests, each only for counts or layout:
- vessel totals 48 → 113 and documents 95 → 225 in fixtures, engine and marina-layout tests; quarantine test 47 → 112;
- shell KPI tiles: 3 → 4, with new values;
- the marina unknown-berths floor: >20 → >5, since two dark docks became one dark half-dock;
- the arrivals definition in `operator-summary.test.ts`;
- tablet KPI width 120 → 108 px so four tiles stay clear of the camera controls.

New `tests/unit/july-fixtures.test.ts` (6 tests): occupancy band and mix, rates and their provenance, the 06:00–22:00 movement window and away flags following the clock, exactly one offline camera, the scenario neighbourhood, revenue at risk.

**Verification.** `npm run check` passes: fixtures:check 0 errors and 0 warnings, 171/171 unit tests, lint, typecheck, build. The full browser suite on the production build is **70/70** (including the zoom spec, which passed this time). The `qa/batch9/` screenshots were overwritten by that run and now show the new data.

**Not done / for Raj**
- Rates are my round numbers. Replace them if you want Buffalo-flavoured pricing.
- The Registry and inspector do not yet show an agreement's rate or the away flag; those are selectors only for now. T29 and T30 can surface them.
- DESIGN.md §9 still describes the old three-tile KPI row.

## Batch 10 — T29 3D dock map mode (16 Nov 2026)

**What changed**
- **Map replaces Top-down.** The camera presets are now Overview · Dock B · Map. Map is a tilted, long-lens view of all 126 berths. It is framed inside the canvas area that the panels leave free, which the camera measures from the DOM when the preset is chosen (`freeRect` / `mapPose` in `src/scene/camera.ts`).
- **Deliberate deviation: a 2° lens, not an `OrthographicCamera`.**
  - The spec asks for a tilted orthographic camera. A 2° perspective lens is orthographic in effect: across the marina the scale varies by under 3 % (unit-tested), so slips read at true relative size.
  - It keeps one camera and one set of controls. Moving into and out of the map is therefore one continuous 700 ms dolly-zoom (`interpolatePose`): the frame height and the lens change together. Two cameras would have meant a cut.
  - Everything that read "distance from the camera" now reads the distance the normal lens would need for the same framing: hull level of detail, the sun's shadow frustum, fog, and the near/far planes. So the long lens at ~18 km looks and costs the same as the normal lens at ~1.2 km.
  - User input during a lens-changing flight lands it at its end, so nobody ever holds the camera at an in-between lens.
- **Status plates without a new mesh.** The single berth pick mesh (126 berths, 1 draw call) gets a shader with two looks. By day it keeps its faint tint. In the map it shows status plates, and the switch eases over 450 ms. The water darkens 45 % so the light plates read.
- **Five statuses**, from `mapSlipStatus` in `src/domain/selectors.ts`, first match wins:
  - needs review (open issue);
  - vacant (no agreement tonight; never inferred from an empty berth or an offline camera);
  - away (the holder's latest confirmed location is a logged departure; a staff verification or identity decision brings it back, a possible match never does);
  - reserved (a transient booked from tonight, not checked in yet);
  - occupied (held, not logged out).
- **Non-colour cues.** Each status has its own pattern in screen pixels: solid, hatch, dashed edge, cross-hatch with a heavy edge, outline only (DESIGN §9 “Dock map”). Hover in the map says `B-12 · Needs review · Vessel present · identity unverified`. It never names a candidate.
- **Slip numbers and dock names** are one more draw call: screen-aligned quads from a canvas atlas drawn in Atkinson Hyperlegible Mono.
  - Slip numbers fade in from 4.5 px per metre.
  - Docks are always labelled: “Dock B”, or just “B” below 0.9 px/m, where “Dock C” and “Dock E” would otherwise collide.
- **Legend** (`src/features/view/MapLegend.tsx`): “Map · tonight”, the five statuses with counts and a one-line meaning for screen readers.
  - On desktop and tablet it sits at the top of the camera panel, so no new layout zone can collide.
  - On mobile it is a compact strip over the bottom of the map row.
- **Selecting on the map keeps the map.** `mapSlipPose` keeps the lens and the user's current orientation, centres the berth in the free area, and zooms in until numbers show (it never zooms out). Overview, Dock B and Reset leave the map.
- **Mobile defaults to the map on a capable GPU.** `gpuCapable()` in `src/scene/webgl.ts` needs a WebGL2 context without a major-performance caveat (software renderers fail this), no Save-Data, and at least 4 GB of device memory where the browser reports it.
  - Everything else gets the flat plan.
  - The preference is now `mobileView: auto | 3d | plan`. An old saved `mobile3d: true` maps to `3d`; anything else maps to `auto`.
  - Display → “Use 3D map” switches either way and is remembered.
  - The probe also rejects software renderers by name (SwiftShader, llvmpipe and similar). The first full browser run showed that headless Chromium's SwiftShader does not set the performance-caveat flag, so two mobile plan journeys opened on the map.
  - `?debug&gpu=capable|low` overrides the probe for tests, because headless Chromium renders in software.
  - The opening shot on a small screen lands on the map, and map mode is on from the first frame, so a restored selection keeps it.

**Measured** (headless Chromium on the Metal GPU, dev build, motion paused, B-12 normal stage):

| Viewport | Free area used for framing | Scale | Slips visible and pickable | Draw calls |
|---|---|---|---|---|
| 1440×900 | 1036×441 px | 1.31 px/m | 126/126 | 131 |
| 1024×768 | 508×242 px (beside the camera panel) | 0.64 px/m | 126/126 | 131 |
| 390×844 (map row 390×259) | 370×189 px | 0.47 px/m | 126/126 | 132 |
| 1440×900, B-12 selected on the map | — | 6.75 px/m | — | 52 |

“Pickable” means three things: the projected berth centre is on the canvas, no panel is on top there (`elementFromPoint`), and a raycast from that pixel selects exactly that slip. The new `__harborScene.pick()` mirrors the click handlers. Real pointer clicks on A-01 and E-10, the two ends of the frontage, select them at every width. The draw-call aim is 300; overview is unchanged. Frames: `qa/batch10/t29-gpu-1440x900-map.png`, `t29-gpu-1024x768-map.png`, `t29-gpu-390x844-none.png` (mobile opens on the map), `t29-gpu-1440x900-select.png` (B-12 selected on the map) and `t29-gpu-dollyzoom-mid.png` (the move from Dock B into the map).

**Bundle.** The shell chunk is 128.4 KB gzip, up 0.9 KB, and three.js is still only in the scene chunk. The scene chunk is 296.3 KB gzip, up 4.8 KB.

**Tests**
- **New unit tests:**
  - `tests/unit/map-status.test.ts` (6): one status per slip and counts that add up; vacant never inferred from emptiness or an offline camera; the B-12 story (away → review → occupied, B-14 stays away); reserved → occupied exactly at check-in; away → back at the logged return; labels never name a vessel.
  - `tests/unit/map-camera.test.ts` (7): every berth corner inside the free area at the three widths, with a real three.js camera and view offset; under 3 % perspective; selection keeps lens and orientation and never zooms out; the dolly-zoom endpoints are monotonic and same-lens flights unchanged; `freeRect` on the desktop zones.
- **New browser journeys:** `tests/e2e/map.spec.ts` (6). They cover:
  - the 126-slip visibility and pick audit, plus real clicks, at 1440, 1024 and 390;
  - statuses following the scenario, and presets leaving the map with the session untouched;
  - axe with the legend on desktop and mobile;
  - mobile: a capable GPU opens on the map and a low-power one on the plan; Display switches and is remembered; context loss falls back to the plan with the same session.
- **Updated:**
  - “Top-down” → “Map” in the a11y, responsive and marina specs (the draw-call budget now samples the map) and in the profile, transfer and reuse scripts;
  - “Use 3D view” → “Use 3D map”;
  - the scene palette token test gains `chart-green`;
  - browser screenshots now go to `qa/batch10/`.

**Verification.** `npm run check` passes (`qa/batch10/check.log`): fixtures:check 0 errors and 0 warnings, 184/184 unit tests, lint, typecheck and build. The full browser suite on the production build passes **76/76** (`qa/batch10/browser-tests-final.log`), including the visible-GPU picking journey and the zoom spec. An earlier full run failed 3: the two mobile plan journeys (fixed by the software-renderer check above) and the zoom spec, which failed on this Retina display's DPR, as in earlier batches.

**Not done / for Raj**
- The full map at 390 px is small: 0.47 px/m, about 2 px per berth. Every slip is visible and pickable, but statuses read by colour there. Pinch to zoom brings the patterns and numbers in.
- Small screens have no on-screen preset buttons, as before T29. The map is the resting view, and pinch and drag move the camera.
- The inspector still does not show an agreement's rate or the away flag (left from T28). The map now shows away on the plate and in hover.
- DESIGN.md §9 still describes the old three-tile KPI row (from T28); only the new “Dock map” subsection was added.
- Not checked: physical phones (the GPU probe on real low-end devices), Safari/Firefox, a spoken screen-reader pass, and the M1 Air.

**Next: Batch 11 = T30–T32** (fit-aware drag-to-assign, time scrubber, dock-walk trigger). PRD §15 recommends a 20-minute Buffalo dockmaster call before T30.


## Batch 11 — T30 fit-aware drag-to-assign and T31 time scrubber (16 Nov 2026)

### Data (fixtures regenerated; `fixtures:check` 0 errors, 0 warnings)
- **`slipServices` (ASSUME, new source `SRC-SERVICES`).** One record per slip: an assumed depth and shore power. Depth is round numbers by dock (A 9, B 8, C 6.5, D 7, E 10 ft at the start of each run, about 1.5 ft shallower at its far end). Power is 30 A everywhere, plus 50 A on slips of 35 ft and over. This implements PRD §15's SlipDepth. Validation requires one record per slip and the ASSUME label.
- **`transientRequests` (SIM).** One request: Northern Tern, 36 ft LOA, 11.5 ft beam, 4.5 ft draft, 50 A. It was received at 08:30, arrives 16:00–18:00 and stays 2 nights.
  - **Deviation:** the spec's example is 42 ft. On 15 July all ten 45 ft slips are held, so a 42 ft boat would be “no fit” on every offered slip.
  - At 36 ft the morning shows all three verdicts. D-01 fits. C-01, C-05, C-12 and C-13 are tight on a 1 ft overhang, and D-19 is tight on 1 ft under the keel. The A and B slips are no fit on length, and C-16 and C-17 on draft (0.5 ft under the keel).
- **`scenario.cameraSweep`.** Online cameras re-read their slips every 5 minutes from 06:00 to 08:40 and from 09:25 to 22:05.
  - A re-read reports the slip's latest known state; the staff log keeps that state current. It refreshes freshness only: it never invents a presence, never names a vessel, and an offline camera (C-04) delivers none.
  - The windows leave the scripted B-12 morning exactly as recorded. Unit tests confirm no slip rests on a sweep at any checkpoint.
  - Without sweeps, every boat after 09:23 drew as stale (faded), because the scenario's own frames stop at 09:18.
- **The first camera round moved from 06:50 to 06:00**, so the timeline opens on readings. Nothing referenced 06:50.

### T30 — Fit-aware drag-to-assign
- **Verdicts** are pure and deterministic (`src/domain/fit.ts`). Each threshold is inclusive at its better side; the worst criterion decides, and its reason is shown.

  | Criterion | Fits | Tight | No fit |
  |---|---|---|---|
  | LOA vs slip length | ≤ length | up to +8 % overhang | beyond |
  | Beam clearance (slip width − beam) | ≥ 2 ft | ≥ 1 ft | below |
  | Under-keel (assumed depth − draft) | ≥ 2 ft | ≥ 1 ft | below |
  | Shore power | outlet ≥ request | smaller outlet (adapter) | none |

- **Offered slips:** no agreement tonight, no demo assignment, and nothing reported present. Held or occupied slips are never in the list and never accept a drop. The engine re-checks on every command.
- **Session:**
  - `DemoSession.assignments` is appended by `assignRequest`; `undoAssignment` stamps `undoneAt` and keeps the record.
  - A request holds at most one slip, and a no-fit slip is rejected.
  - Runs saved before T30 load with no assignments: the schema version is unchanged and no notice is shown.
  - An assigned slip is **Reserved** on the map and counts toward Occupancy; its unsold nights drop by the stay.
- **Pointer path.** Drag the handle on the request card over the 3D scene, the dock map or the 2D plan.
  - Every offered slip takes its verdict look: green solid for fits, amber hatch for tight, red outline with a sparse cross for no fit. Slips that are not offered recede.
  - The slip under the pointer gets a ring and a label with the reason, e.g. `A-01 · No fit · LOA 36 ft overhangs the 25 ft slip by 11 ft`.
  - A chip follows the pointer, portalled out of the glass panel; `backdrop-filter` would otherwise trap a fixed element.
  - Drops on a held slip or a no-fit slip assign nothing and say why. Escape cancels.
- **Placement.** The card sits at the top of the desktop rail, and at the top of the list pane on tablet and mobile.
  - On desktop it collapses to one line (“Northern Tern · 36 ft · not assigned”, with Show) whenever a slip or vessel is open in the inspector. Show expands it for that selection.
  - Found by the full suite: the expanded card took about 300 px, which squeezed the B-12 review until it scrolled under a double-click.
- **Keyboard path (list → Assign).** The card's Slip list holds every offered slip with its verdict, best first. Assign is disabled for no fit; the reason sits under the list and is announced on assignment.
- **The boat.** After a drop it approaches along the berth's authored path (`src/scene/approach.ts`): along the channel bow first, a turn at the slip mouth, then stern first into the berth, in 3.6 s.
  - It stays as a translucent planned hull, because it is a booking, not an observation; the inspector still says “No vessel present”.
  - Undo sends it bow-first back out in 2.4 s. Reduced motion cuts both moves.
  - Planned and in-transit boats take no clicks.
- **Bug found and fixed.** The drag's hover ring was raycastable, so a drop picked the ring instead of the berth. The shared picker (`src/scene/pick.ts`, also used by the debug bridge) now skips outline lines, as R3F's click dispatch already did.
- **Frame pacing while dragging.** Measured in a visible Chromium on the Metal GPU, M3 Max, 1440×900 DPR 1, with ambient water on (`qa/batch11/t30-drag-frame-pacing.json`):

  | View | Frames in 5 s | Median | p95 | Frames over 33 ms |
  |---|---|---|---|---|
  | Dock B | 300 | 16.7 ms | 17.4 ms | 0 |
  | Map | 300 | 16.7 ms | 17.3 ms | 0 |

  The first measurement had a p95 of 50 ms, because every pointer move re-rendered the whole Marina and the card. Now only the chip re-renders per move, the ring re-renders when the slip under the pointer changes, and the drag picker raycasts the marina only.

### T31 — Time scrubber and arrivals board
- **Relationship to guided replay** (`src/domain/timeline.ts`). The scrubber is guided replay made continuous. Moving it shows the scripted day, read-only, at that minute: the full canonical run projected back to t. Every record dated after t is dropped, and every state is the one it had at t.
  - At the five checkpoints the projection equals the replay snapshot exactly (unit test).
  - The store's replay view now carries `at`; guided replay sets it to a checkpoint.
  - “Try this state” still branches from a checkpoint. Between checkpoints the button says which one, e.g. “Try the 09:20 state”.
  - The panel says “Your run stays at 09:12”, and Back to my run returns it unchanged (browser test).
- **Scrubber** (`DayScrubber.tsx`, in the scenario panel in both modes).
  - It is a native range input: 06:00–22:00, one-minute steps, with ticks at the scripted checkpoints. Its `aria-valuetext` reads e.g. “09:12 EDT · B-12 needs review”.
  - Jumps over 15 minutes glide over 450 ms so boats travel; reduced motion cuts.
- **Boats on the move.** Every logged departure and arrival spends 6 sim-minutes on its berth's path, starting at its log entry.
  - So nothing moves before its record exists: an arrival enters from the channel after its check-in is logged.
  - While an arrival is in transit its berthed hull is not drawn, and it settles exactly onto the berthed placement.
  - No movement is in transit at any checkpoint, so the approved views and the poster are unchanged.
  - Unit tests sample every berth's arrival and departure (400 steps: under 2.5 m and 0.12 rad per step, exact end poses) and check that no sampled point is on the land masks.
- **KPIs follow the clock.**
  - Arrivals is now “arrived/planned” with “In by hh:mm”, and the tile opens the board.
  - Needs review, Revenue at risk and the map statuses already followed the session.
- **Arrivals board.** A third Registry tab, “Arrivals”, lists:
  - check-ins: logged with their time, or “Due” with no time until logged, so a later log entry never leaks;
  - returns from outings, with the expected time once the departure that carried it was logged;
  - demo assignments.

  Its summary line counts check-ins so far, vacant slips and unsold nights over the next 7.
- **Unsold nights.** These are nights in the 7 from 15 July not covered by an agreement or a demo assignment. They appear in the inspector for any slip without an agreement, in the board summary and in the legend's vacant hint.
- **Lighting** (`src/scene/daylight.ts`, basic; T33 refines it).
  - Keyframes run from 06:00 (low east-north-east, warm) through midday (high south) to sunset (about 20:50, west-north-west) and dusk at 22:00.
  - Sun direction, colour and strength, the sky fill, background and fog, and the analytic sky reflection follow the clock. The reflection's sun is now a shared uniform instead of a baked constant.
  - **08:45–09:20 holds the authored light exactly** (azimuth 125°, elevation 40°), so the approved views do not change.
  - The unlit berth tint now dims with the sky; at dusk it glowed as a pale band.
- **Scrub cost.** Selectors are now memoised per (fixtures, session), which is safe because sessions are immutable values. A closed registry list no longer builds its rows. One scrubber step went from a median of 84 ms to 33 ms (p95 117 → 50 ms), measured as the state change plus two animation frames on the M3 Max.

### Tests
- **New unit tests (22; 206 in total):**
  - `assign.test.ts` (10): every verdict boundary, the worst-criterion rule, offered slips, assign/undo/reassign, no-fit and held rejections, persistence including pre-T30 runs.
  - `timeline.test.ts` (7): bounds; projection = replay at every checkpoint; no record later than the cursor, scrubbing 06:00→22:00 and back in 5-minute steps; B-12 stage times; the run untouched; sweeps; unsold nights.
  - `approach.test.ts` (4): path continuity for every berth; transits start at their log entry and none at checkpoints; the authored light window; sun keyframes.
  - `approach-water.test.ts` (1): paths stay off the land masks.
- **New browser journeys:** `tests/e2e/assign-timeline.spec.ts` (4).
  - Real drag and drop on the map: not offered (B-12), no fit (A-01), then D-01. The approach and the undo are sampled every frame, and speed is checked against elapsed time, so a teleport fails even at SwiftShader's frame rate.
  - Keyboard Slip list → Assign → Undo.
  - Scrubber by keyboard: End, Home and arrows; KPIs, inspector and board follow; backward never shows the future; Back to my run is unchanged.
  - Idle frames after scrubbing, paused and under reduced motion.
- **Updated:**
  - the fixture bundle shape gains two collections;
  - the two Dock-filter locators are now named (the card added a second select);
  - the shell KPI text is now “Arrivals 3/15 · In by 08:45”;
  - the “panels never select the berth behind them” journey now finds its camera placement by iterating instead of one linear step (the registry sits lower in the rail);
  - browser screenshots now go to `qa/batch11/`.

**Verification.** `npm run check` passes (`qa/batch11/check.log`): fixtures:check 0 errors and 0 warnings, 206/206 unit tests, lint, typecheck and build. The full browser suite on the production build passes **80/80** (`qa/batch11/browser-tests-final.log`), including the visible-GPU picking journey and the zoom spec. The first full run failed 5 existing journeys: the squeezed review (fixed in the product by collapsing the card) and four test-side updates listed above.

**Not done / for Raj**
- Depth, power and the request are my numbers (ASSUME / SIM). A dockmaster call (PRD §15) would replace them and the thresholds.
- Arrivals show no ETA before check-in, by design (the data has no booking ETA, and the log time would leak the future). A booking ETA field would let the board show “Due 14:30”.
- The scripted day is the timeline's only source. Your own run's demo assignments are not shown while scrubbing, and the scrubber cannot start a run between checkpoints.
- Approach paths are generic (one shape per berth, out to the channel toward the river mouth), not authored routes. They are tested to stay off the land masks, not against real navigation.
- DESIGN.md §9 still describes the old three-tile KPI row (from T28).
- Not checked: physical touch dragging, Safari/Firefox, a spoken screen-reader pass, the M1 Air.

**Next: T32** (dock-walk trigger), the last task in Batch 11.

## T32 — Dock-walk trigger (16 Nov 2026)

The B-12 issue now opens from a morning dock-walk discrepancy, with camera C-02 as the corroborating second source.

- **Data.** One new text-only staged record, `EV-WALK-0910` (kind `dock-walk-mark`, SIM, 09:10, source STAFF-CHECK, no image, no vessel identity): “Marked Occupied on the morning dock walk; Lake Effect departed 08:10.” The 08:10 is the real departure in the movement log (MOV-005). `scenario.dockWalkEvidenceId` points to it. The camera observation, its candidate and its frame are unchanged.
- **Engine.** None. Checkpoints, commands, the 09:12 clock and the confirm guard are untouched. The dock-walk entry is not staff identity evidence (`revealedStaffEvidence` still reads only `staff-dock-check`), so confirming stays blocked until a dock check is loaded. The validator now says only a staff dock check can carry an identity.
- **Labels.**
  - The stage “Uncertain” is now **Discrepancy** (stepper and snapshot radio, “09:12 Discrepancy”).
  - The normal-state button is “Show dock-walk discrepancy” (was “Show 09:12 camera observation”).
  - The review heading is “Discrepancy review”. A “Dock walk · 09:10” note sits above the camera frame, whose caption now says “second source”.
  - History reads Departure logged 08:10 → Dock walk · marked Occupied 09:10 → Camera C-02 observation 09:12 (detail “Camera C-02 · second source · possible match Harbor Light”), then the unchanged later steps.
  - The announcer reads “dock walk marked B-12 Occupied; camera C-02 shows a vessel, identity unverified”.
  - The marker text “B-12 · Vessel present · identity unverified” is deliberately unchanged.
- **No outbound action.** The note says “Logged here only. No message was sent.” Nothing is added to tasks or audit until “Request dock check”, which already says “no message sent”.
- **Tests changed, deliberately.** The trail-label list in `engine.test.ts`, the observation detail in `slip-review.test.ts`, `review.spec.ts` and `responsive.spec.ts`, the announcer text, and the renamed button and radio across the browser specs. New `tests/unit/dock-walk-trigger.test.ts` (3). Scenario outcomes are unchanged.

**Verification.** fixtures:check 0/0, typecheck, lint, 209/209 unit tests, and the full browser suite on the production build, 80/80 (one run after the label changes with two stale locators, fixed and re-run).

**Not done / for Raj**
- The 09:10 dock-walk entry is my wording and timing (SIM). A dockmaster would say how a walk discrepancy is really logged.
- The “Departure logged” line shows the staff-log departure, so the story reads “departed 08:10, yet marked Occupied”. The resolution (Lake Effect confirmed back in B-12 with a new cover) is unchanged. I did not invent a return.
- Not checked: a spoken screen-reader pass.

**Batch 11 (T30–T32) is complete.**

## Batch 12 — T33 Environment realism pass (16 Nov 2026)

**Decisions (Raj, 16 Nov):** realism target surroundings about 8/10, hero boats and docks about 7/10. The v3 reference still is a frame of the app itself (an in-engine look-dev frame), not a generated image. First pass shown; Raj asked for one more; the second pass was approved as [design/visual-target-v3.png](design/visual-target-v3.png) (provenance beside it). Side-by-side: [qa/batch12/v3-before-after.png](qa/batch12/v3-before-after.png), [v3-time-of-day.png](qa/batch12/v3-time-of-day.png), [v3-close.png](qa/batch12/v3-close.png). Geography and landmark placement are unchanged.

### What changed

- **Water** (`Water.tsx`, new). Ripple normals from a generated tiling texture at four scales, calmer inside the marina. A site mask drawn once on a 2D canvas from the land and dock polygons gives a lighter shallow margin along the bank, a dark band under and beside every headwalk and finger, and a waterline. Sky and cloud by fresnel. A **planar reflection** of the scene at half resolution, re-rendered only when the camera or a shadow caster moved (so the drifting water costs one pass, not two).
- **Sky** (`Sky.tsx`, new; `daylight.ts`). A dome drawn from the same formula the materials reflect: horizon-to-overhead gradient, sun glow and disc, fair-weather cloud from noise, stars after dusk. Each daylight key now carries the overhead colour, fill, glow, cloud colour and a **night** factor. Fog starts nearer (650 m) and ends in the dome’s horizon colour, so far land and water fade without an edge. The scrubber drives all of it.
- **Light.** Authored mid-morning strengths changed for contrast: sun 2.3 → 2.9, fill 1.15 → 1.08 with a warm bounce colour from below. Direction unchanged (azimuth 125°, elevation 40°), still held 08:45–09:20. Exposure rises up to +75 % at night. Lamps and about a third of the windows light as night falls; each lamp throws a warm pool on the ground.
- **Ambient occlusion** (`PostAO.tsx`, new). Screen-space, from depth: scene to an off-screen target, 12-tap occlusion at half resolution with a radius that grows with distance, depth-aware blur, composite, then selection / hover / review outlines drawn on top from their own layer so they are never darkened or mirrored.
- **Ground** (`ground.ts`, new). Lawn, unmown meadow, gravel, asphalt, paving and concrete each get world-space variation from the shared noise texture. Saw-cut joints on the bank walk. Soft contact patches under every trunk, shrub, lamp, stored boat, car and wall foot.
- **One shared material, five surface kinds.** `surf` gained a third component: plain, mineral (mottling, rain streaks), foliage (leaf break-up, ragged cut-out outline), lamp, window.
- **Landmarks.** Grain elevator 778 → 5,302 triangles inside the same footprint and silhouette (lift bands, plinth, windowed gallery, pilasters, parapet, roof plant, outside stair, conveyor bridge). Sheds get seams, gutters, vents, door slats. The Skyway is a slab on girders with parapets, median, lane lines, light poles and two-column bents.
- **Foliage.** Three tree forms with tufted crowns (3,754–5,662 triangles), each with a distant model (328–472); 81 trees in 130 m groups that swap at 230 m; per-tree tint. 24 shrubs. 395 scrub trees on the unmown ground outside the 2022 site boundary and on the peninsula.
- **Life.** 152 parked cars on the mapped parking areas (none within 30 m of the bank). Mooring lines on every settled hull whose presence is confirmed: two stern lines to the headwalk, a bow line to each finger alongside.
- **Poster and evidence stills re-rendered** from the new scene, so the opening fade and the camera frame match what is behind them. Same framing. Poster quality 0.78 → 0.70.

### Defects found and fixed on the way

- **Hatched grain bins (present since T15).** Wrapped patches (`grid` with `closeU`) were wound inward. Shading is double-sided so it never showed in the lighting, but the shadow lookup is offset along the vertex normal, which pushed it into the solid: the lit side shadowed itself in a hatch. `MeshBuilder.grid` now turns wrapped patches outward; unit-tested for both windings.
- **Speckled boat decks (present since T09).** Same cause on open patches, plus rails thinner than a shadow texel. The shared material now offsets the shadow lookup toward the sun whichever way the stored normal points, and a capable GPU gets a 4096² shadow map (about 2 cm a texel in the working view): rails cast lines.
- **Occlusion banding on flat water.** The half-resolution pass sampled depth at texel corners, so position and depth could come from different texels. Lookups snap to texel centres.
- **`scripts/measure-transfer.ts` had been failing** since the registry list closed by default (T25): it now opens the list first.

### Two tiers

A capable GPU gets everything above. Software and low-power renderers (`gpuCapable()` false) get the **lite tier**: no reflection or occlusion pass, no noise lookups or leaf cut-outs in the shaders, distant tree models everywhere, every second scrub tree and car, the 2048² shadow map. Reason: with the full shaders on a CPU rasteriser a 700 ms camera flight fell to under two frames and the fly-to and drag-to-assign journeys failed. Geometry, placement, records, colours and shadows are identical in both tiers. **The browser journeys run the lite tier**, so the reflection and occlusion passes are covered by the real-GPU captures and measurements here, and executed (not visually checked) by the journeys that force `gpu=capable`.

### Measured (Apple M3 Max, headless Chromium on Metal, production build, 1440 × 900)

| | Before (Batch 11) | T33 |
|---|---|---|
| Frame pacing, 6 s orbit, three views, DPR 1 and 1.75 | not re-measured today (QA.md: 60 fps) | 60 fps, p95 16.7–16.8 ms, max 16.8 ms |
| Back-to-back frame cost (median / p95) | — | 2.1–2.7 / 3.9–5.8 ms at DPR 1; 3.9–4.3 / 4.6–5.5 ms at DPR 1.75 |
| Draw calls, B-12 selected / Dock B | 36 / 39 | 48 / 53 at rest; Dock B 90 on a moving frame (reflection re-rendered) |
| Draw calls, Overview | 118 | 149 at rest; 284 on a moving frame (aim < 300, ceiling 2,000) |
| Triangles, B-12 selected / Overview | 270,015 / 210,902 | 488,604 / 361,601 at rest; Dock B 738,541 and Overview 530,791 on a moving frame |
| Scene chunk | 1,092.7 kB, 299.6 kB gzip | 1,135.3 kB, 315.6 kB gzip |
| Shell chunk | 135.70 kB gzip | 136.02 kB gzip |
| Poster 1600 / 2400 | 38.6 / 69.0 kB | 62.2 / 116.0 kB |
| Evidence stills, 1× / 2× | 35.6 / 118.0 kB | 41.5 / 133.2 kB |
| Requested in a full scenario at 2× (gzip) | — | 12 files, 814.8 kB against the 6 MB budget ([transfer.json](qa/batch12/transfer.json)) |

Draw calls now count every pass in the frame (the renderer’s per-call reset is off and counters reset once a frame), so they are not like-for-like with earlier logs, which counted one pass. Raw: [perf-gpu.json](qa/batch12/perf-gpu.json).

### Deliberate changes to tests and tooling

- `approach.test.ts`: the authored light strengths (2.3 / 1.15 → 2.9 / 1.08). Direction assertions unchanged.
- New `environment-v3.test.ts` (14): generated textures are deterministic, full-range and tile; night factor; outward wrapped patches; shrubs, scrub trees and parked cars keep to the validated geography; asset sizes; mooring lines.
- Browser screenshots now go to `qa/batch12/`. No assertion was weakened.
- `vite.config.ts` chunk warning 1,100 → 1,200 kB (informative only).
- New scripts: `capture-v3.ts` (the fixed frame set on the real GPU; `--query ao=show` shows the occlusion term alone, `ao=off` disables the pass), `compare-v3.ts` (comparison sheets).

### Verification

`npm run check` passes: tokens, fixtures 0 / 0, asset report regenerated and matching, typecheck, lint, **223 / 223** unit tests, production build ([check.log](qa/batch12/check.log)). Browser suite on the final production build, `--workers=1`: **80 / 80** in 11.2 min, the 200 % zoom journey included ([browser-tests-final.log](qa/batch12/browser-tests-final.log)). Two earlier runs on intermediate builds failed three journeys between them (drag-to-assign motion sampling, shadow-map reuse while orbiting, fly-to interrupt); all three were the heavier scene under software rendering and are what the lite tier and the “no tree swaps in the lite tier” rule fix. axe: zero violations (part of the suite).

### Not done / for Raj

- **No downtown skyline.** The project has no sourced positions for anything on the north bank, and I did not place landmarks from memory. It needs a lookup of building footprints and heights (OpenStreetMap has them). The same goes for a marine tower on the elevator.
- **No fenders.** Mooring lines are in; fenders are not.
- **“Baked lightmaps” (optional in the task) were not done.** The occlusion pass and the ground contacts cover the need without a bake step.
- **Parked cars and scrub trees are my additions** (ASSUME scenery, placement rules unit-tested). Say if either should go.
- Unverified: M1 MacBook Air frame rate (everything above is M3 Max), non-Chromium browsers, and how the occlusion and reflection passes behave on integrated GPUs that pass the capability probe. T34 profiles next.

**Next: T34 (performance, regression, Gate D).** `scripts/measure-transfer.ts` still writes to `qa/batch6/` by default; T34 should point it at the current batch.

## T34 — Performance, regression and Gate D (16 Nov 2026)

**Gate D passed** for the applicable local criteria. The full record is [QA.md § Gate D](QA.md); the raw outputs are in `qa/gate-d/`. Haiku subagents ran the suites and read the logs.

- **Regression:** `npm run check` passes: 223 / 223 unit tests in 27 files; fixtures 14 files, 0 / 0; lint 0 / 0. `npm run geometry` gives 23/27 with the same four source flags. The browser suite passes **80 / 80** in 11.2 min with `--workers=1`, and the 200 % zoom journey passed this time.
- **Performance** (M3 Max, visible Metal window, production build `1a1680cb…`):
  - 60 s run: 59.88 fps median, p95 17.6 ms, max 32.7 ms, 0 frames over 33.3 ms.
  - Selection feedback: 17.1–17.3 ms.
  - Cold shell: 451–536 ms. First 3D frame: 1.44–1.61 s at DPR 1, 1.53 s at DPR 2.
  - Transfer: 924,214 B compressed (+22 % on Gate C, from the poster and the T33 scene). Fonts: 96,212 B.
  - Cleanup: flat at 276 / 16 / 18 and 714 DOM nodes across five cycles.
  - Zero console errors, failed, missing or external requests. The network-off resolution passes at both DPRs.
- **Draw calls:** 62–301 sampled mid-move, now that every pass is counted. Map mid-flight is 301, one over the <300 aim. Overview is 295 moving and 152 at rest. Frame time is unaffected, so this is accepted. If the M1 needs headroom, skip the planar reflection in Map mode first.
- **Fixed (QA tooling only):**
  - `measure-release.ts`: opens the closed desktop list, uses the T25 About button and the T32 step and snapshot labels, switches mobile from the T29 3D map to the plan, and takes `--out-dir`. Shell readiness is now search + store + (options or four valued KPI tiles), because a closed list builds no rows.
  - `check-reuse.ts`: the “09:12 Discrepancy” label.
  - `measure-transfer.ts`: defaults to `qa/gate-d/`.
- **Unverified:** the M1 MacBook Air (no device), spoken screen-reader operation, touch, and Safari/Firefox. The browser journeys run the lite tier.

**Next:** T35 is optional; ask Raj which option (E recommended). Otherwise go to T22.


## T35 — Buffalo seiche and gale what-if (option E, 16 Nov 2026)

Raj chose option E. Built as a **what-if lens** on the T30 fit verdicts, not as new records. Not committed.

### What it does

- **Lake** row in the incoming-request card: a Calm / SW gale switch (native radios, so the arrow keys work), wind and level at the clock, a level strip from 06:00 to the end of the stay (zero = still water, shaded band = the stay, dot = the clock, amber dot = the stay’s low), and the stay’s low water. Marked SIM.
- **Verdicts** (`src/domain/fit.ts`, `src/domain/lake.ts`):
  - Draft uses the assumed depth **plus the lowest water during the stay** (arrival window start to arrival window end + nights).
  - **Fixed deck** (Docks A and E only): deck height − the stay’s highest water. Fits ≥ 1.5 ft, tight ≥ 0.5 ft, otherwise no fit (“awash”).
  - **Exposure** (open berths only: Dock A and B-01…B-19, which face the river mouth): the strongest wind from 200–300° during the stay. Tight from 20 kt; no fit from 34 kt, the NWS Great Lakes gale band.
  - Calm reproduces the T30 verdicts and reasons exactly (unit-tested on all 126 slips): the calm series never goes below still water and its onshore wind stays under 12 kt.
- **Under the SW gale:** 15 offered slips → D-01 tight (“Draft 4.5 ft in 5.5 ft of water at the 18:45 low (7 ft assumed, −1.5 ft): 1 ft under the keel”), the other 14 no fit. D-19 goes from tight to aground.
- **Assignments** carry `lake` (the what-if they were checked under; absent = calm on older saves). The engine checks the fit under the command’s what-if. If you switch to a what-if where the assigned slip is worse, the card says so (“Under the SW gale what-if D-19 is a no fit: …”) and changes nothing.
- **The lens is store state** (`AppState.lake`, `store.setLake`), not a session record. Switching never edits or saves the run, and it works in the replay timeline. It is not persisted (a reload is calm); `?lake=sw-gale` opens on the gale.
- **Scene** (`src/scene/weather.ts`, `Water.tsx`, `daylight.ts overcast()`): above 12 kt the short ripples run downwind and roughen; whitecaps streak downwind on open water (none in the sheltered basin); the sky and sun go grey. All of it follows the clock and the scrubber. At calm wind speeds every term is multiplied by zero: **calm captures are pixel-identical to the T33 captures** (dock, close, overview, 19:45; max channel difference 1/255), so the poster and evidence stills were not re-rendered.

### Data and sources

- `data/fixtures/lakeScenarios.json` (new collection, 2 × 241 samples, validated: SIM, ascending, finite, gusts ≥ wind, covers every request’s stay). Generated in `src/data/generate.ts`.
- **Gale shape:** SW 30–39 kt through the morning; +2.6 → +4.4 ft by 10:00, held to 13:00. Then a damped cosine with a 14 h period: −1.5 ft at 18:45, +0.6 ft around 03:00, fading. The period and amplitudes are **demo values (ASSUME)**. I did not verify a published Lake Erie seiche period. The NY Sea Grant seiche PDF I fetched is image-only and could not be read.
- `slipServices` gained `exposure` and `deckFreeboard_ft` (A 3.5 ft, E 4 ft; null on floating B/C/D). ASSUME.
- New sources: **SRC-LAKE** (ASSUME, caveats say it is not a NOAA gauge record or NWS forecast) and **SRC-NWS-MARINE** (DOC: NWS “Marine Weather Services: Great Lakes”, NOAA PA 98053, which defines a Gale Warning as forecast winds of 34 to 47 knots; read from the PDF). It gives no numeric small-craft threshold, so the 20 kt line is an assumption and says so. Both appear in About / Sources automatically.

### Tests

- `tests/unit/lake.test.ts` (17): series shape and coverage; calm = T30 on every slip; gale verdicts and wording; deck and exposure boundaries; open sector only; later-day times; engine records and rejects under the what-if; persistence (round trip, unknown what-if rejected, pre-T35 saves load); the lens never touches the run and works in replay; calm scene weather is all zeros and `overcast(d, 0)` returns `d`; validation quarantines a mislabelled or short series and flags a missing one or a wrong deck height.
- `tests/e2e/lake.spec.ts` (3): keyboard switch, announcement, re-checked slip list, Assign disabled on D-19, assign D-01 under the gale, drift note after a switch, axe on the card; scene weather via the debug bridge (`weather()`), timeline at 20:00 (read-only, wind eased, level below still water, switch still works); drag on the 3D dock map under the gale (D-19 no fit with its reason, D-01 tight, drop assigns).
- `fixtures.test.ts`: the bundle-shape key list gains `lakeScenarios`. No assertion weakened.
- QA tooling: `profile-scene.ts --query lake=sw-gale`.
- Browser screenshots now go to `qa/batch13/`. The first full run still wrote to `qa/batch12/` and overwrote T33's evidence; those copies were moved to `qa/batch13/` and `qa/batch12/` was restored from git.

### Verification

- `npm run check` passes: 15 fixture files 0 / 0, lint, typecheck, **240 / 240** unit tests in 28 files, build ([check.log](qa/batch13/check.log)).
- Browser suite, `--workers=1`: **82 / 83** in 11.7 min ([browser-tests.log](qa/batch13/browser-tests.log)). The one failure is `zoom.spec.ts` stopping at its first assertion (device pixel ratio 4, not 2) because this Retina display doubles the zoomed DPR. It is the known environmental failure and touches no app code. After compacting the card, lake, a11y, responsive, assign-timeline, shell and zoom were re-run on the new build: 19 / 20, the same zoom failure ([browser-tests-rerun.log](qa/batch13/browser-tests-rerun.log)).
- **Budgets** (production build, M3 Max, visible Metal window):
  - 60 s run: calm and gale both 120.5 fps median, p95 10.0 / 10.1 ms, one frame over 33 ms each. This display refreshed faster than Gate D’s 60 Hz run.
  - Draw calls per phase: identical in calm and gale (62–295).
  - Back-to-back frame cost: +0.2–0.3 ms median under the gale.
  - Transfer: 930,504 B (Gate D 924,214; +6,290 B, the lake series in the shell chunk: 136.02 → 142.33 kB gzip).
  - Cold shell: 466–471 ms at DPR 1, 513 ms at DPR 2. First 3D frame: 1.46–1.48 s, 1.52 s at DPR 2.
  - Fonts unchanged (96,212 B). Zero errors, failures or external requests; the offline workflow passes.
  - Raw files: [profile-gale-gpu.json](qa/batch13/profile-gale-gpu.json), [profile-calm-gpu.json](qa/batch13/profile-calm-gpu.json), [transfer.json](qa/batch13/transfer.json), [startup-transfer.json](qa/batch13/startup-transfer.json).
- **Captures:** `qa/batch13/calm-*.png` and `gale-*.png` (real GPU, `capture-v3.ts`), plus `e2e-gale-request.png` and `e2e-gale-drag-d01.png`.

### Deviations and open items

- **No water-level change in the scene.** A real ±4 ft shift needs floating docks, hulls and mooring lines to ride the water while fixed docks stay put. That is a larger scene change, so the level lives in the card’s strip and in the verdicts.
- **Panel coverage at 1440×900 was already over target before T35.** It measures 39.4 % (topbar, KPI tiles, rail, bottom-left zone, camera bar) against T25’s ≤ 30 %. T30’s request card and T31’s scrubber pushed it over, and Gate D did not re-measure it. T35 adds 3.6 points (43.0 %) after compacting the Lake row from 176 to 126 px. With the request card collapsed, coverage is 31.6 %.
- Unverified: M1 MacBook Air, non-Chromium browsers, spoken screen-reader use of the new switch.

**Next:** T22 (demonstration package). The gale switch is a candidate beat for the cut list, after drag-to-assign.

## T22–T23 — Demonstration package and handoff (16 Nov 2026)

Raj asked for T22 and T23 on the assumption that Harbor Desk will appear in the **Experiments** section of rssdesign.org (`/experiments`). He also asked for a product guide, separate from the build/run docs. Done on top of his two commits after T35: `9c328bb1` (arrow-key panning) and `b2dc232d` (map-first workspace refresh).

### UI fixes requested during the batch

- **Camera bar right inset.** The square Reset and Pause buttons sat 6 px from the pill's curved end. The right inset is now 14 px on desktop and on the tablet row (`src/app/workspace.css`).
- **About dialog text overflowed** off the right edge. The dialog sits inside the top bar in the DOM, and the bar's `white-space: nowrap` was inherited. The dialog now resets it (`src/features/about/about.css`). Checked at 1440×900: scroll width equals client width.

### T22 — showcase package (`showcase/`)

- **Walkthrough:** `video/harbor-desk-walkthrough-1600.mp4`, 77.2 s, 1600×1000, H.264 CRF 17.
  - **Cut:** poster → establishing move → Northern Tern from Tasks → Map → drag over A-01 (No fit) and D-01 (Fits) → drop and sail-in → SW gale what-if, then Overview → Calm → day timeline to 20:00 and back (read-only) → Return to my run → Explore slip review → Review observation → Load dock-check result → acknowledge → Confirm → agreement unchanged → Activity history.
  - **Labels:** captions and a pointer are drawn by the recording script into the recorded page only. The app's “Demo data” label stays in frame.
- **Card loop:** `video/harbor-desk-card-1600.mp4`, 28.2 s, about 1.09 Mbit/s, no captions, five segments with 0.35 s crossfades. Poster: `video/harbor-desk-card-poster.jpg`.
- **Stills:** `stills/01-overview` … `05-resolved` at 1600×1000 and @2x (3200×2000), production build on the real GPU, motion paused. `contact-sheet.jpg` is the reduced-motion alternative.
- **Experiments card:** `experiments-card/card.html` plus notes, matching the playground markup: title, date, description, three chips, Try it live and Walkthrough.
  - Checked by serving the real `/experiments` page with the card inserted, using a read-only local server. No portfolio file was changed.
  - Screenshots: `qa/handoff/card-preview-1440.png` and `card-preview-390.png`.
  - The live URL is a placeholder until a deployment exists.
  - The page's experiment counter is hard-coded at 5, so the notes say to change it to 6.
- **Copy:** `CASE-STUDY.md` leads with craft and then the evidence model (the AI pattern), followed by problem, hypothesis, users, why spatial, data decisions, what works, what's simulated and the next research step. It also has alt text. Every figure names its source; there are no impact claims.
- **Pitch notes:** `pitch/`, one page each for Dockwa, Harba, DockMaster, Molo/Storable and Snag-A-Slip. Local only.
  - Company facts come from DOCKWA-ANALYSIS, or are marked unverified.
  - The notes flag what was not built: away-boat resale (D), the OSM onboarding flow (F) and the arrival flythrough (G).
- **Recording method:**
  - `scripts/record-walkthrough.ts` drives the production build through its real UI.
  - Pointer moves are time-based, so a move lasts its planned time under load.
  - Frames come from Chromium's DevTools screencast, about 36 fps, and are encoded to 30 fps CFR by ffmpeg using the frame timestamps. No video framework was added.
- **Fixes on the way:**
  - The first take wrote to a literal `New%20Builds…` folder because `URL.pathname` keeps `%20`. Both scripts now use `fileURLToPath`; the stray folder (only this run's output) was removed.
  - Fixed-step glides ran about 3× slower than planned (a 103 s take).
  - Captions covered the map legend; they now sit above the camera bar.
  - The Demo controls tray closes itself on leaving replay, so a second "close" click reopened it; the script now checks before clicking.
- **`.gitignore`:** `*.mp4` was ignored (for the authoring reference video), so `!showcase/video/*.mp4` was added.
- **Browser test screenshots** now go to `qa/handoff/`, so T35's `qa/batch13/` evidence stays intact.

### T23 — documentation and handoff

- **`README.md`:**
  - requirements, install, dev, build and preview;
  - the test commands and their caveats (stop 4719 first, `--workers=1`, lite tier, zoom on DPR 4);
  - using the demo, controls and URL options;
  - local persistence (`harbor-desk:session`, `harbor-desk:prefs`);
  - architecture and the main decisions;
  - a regeneration table (fixtures, tokens, geometry, assets, poster, evidence, showcase);
  - deployment notes, provenance, known limitations, a document index and credits.
- **`PRODUCT-GUIDE.md`** (Raj's request):
  - what it is and the hypothesis;
  - who it is for, as a role table (owner/GM, dockmaster, dock staff, front office), all labelled as hypotheses;
  - a tour of the screen;
  - core functionality: slip review, both branches; assignment by list and by drag; Conditions & what-if; the day timeline; registry; arrivals and revenue estimates;
  - a recommended 3-minute path, best setup, controls and tips, and what it is not.
- **Deployment.** While this batch ran, Raj published the app as the public repository `RSSDesign9/harbor-desk-buffalo`, which starts from a snapshot of `b2dc232d`. It is live at https://harbor-desk-buffalo-rssdesign.vercel.app, with its own `vercel.json`, `.vercelignore`, Node 24 pin and lockfile fixes.
  - Those validated files replaced the drafts written here; the draft cache headers were dropped as untested on Vercel. `showcase/`, test output and videos were added to `.vercelignore`.
  - The README's deployment section describes the real setup.
- The app ships only `public/` and `src/` imports, as before.

### Verification

- **Full check passes on this tree:** 15 fixture files 0 / 0, tokens, assets, typecheck, lint, **240 / 240** unit tests in 28 files, and the build ([check.log](qa/handoff/check.log)).
- **Clean install** of the published repository: `npm ci` (238 packages) and Playwright ran from a fresh clone. The clean-copy build and unit tests with the T22–T23 changes are recorded under “Publishing”.
- **Browser suite (`--workers=1`): 44 passed, 51 failed** ([browser-tests.log](qa/handoff/browser-tests.log)).
  - **The failures are the pre-refresh journeys.** They expect the request card always visible, the scrubber outside a tray, the earlier review buttons, the old rail and the KPI tiles. The workspace refresh (`b2dc232d`) moved or replaced all of these, and its own validation ran only the focused journeys (DESIGN.md §17).
  - **Proof:** two of them, the T30 keyboard path and keyboard-only on mobile, fail identically on a clean clone of the published snapshot, which has none of this batch's changes.
  - **What passes:** all of `workspace.spec` (9) and `keyboard-pan.spec` (3), plus `intro`, most of `foundation` and `scene`, and the map journeys.
  - **Failing by spec:** failures 11, review 6, a11y 4, assign-timeline 4, release 4, scene 4, lake 3, map 3, marina 3, motion 3, responsive 2, foundation 1, nowebgl 1, shell 1, zoom 1. The zoom spec also has its known DPR 4 problem.
  - **Not a regression check:** the two CSS fixes in this batch touch only padding and wrapping.
  - **Still open:** rewriting these specs for the new workspace, recorded as a follow-up.
- **Media checked frame by frame on contact sheets:** all five beats are visible in the walkthrough and the card, captions never cover the legend or panels, and the 1600×1000 stills are legible.
- **Not re-measured after the workspace refresh:** transfer size, frame pacing and panel coverage. Gate D and T35 figures still stand for the scene; the shell layout is new.

### Publishing (Raj's request, 16 Nov 2026)

- **Harbor Desk repository:** the T22–T23 changes were applied on top of `RSSDesign9/harbor-desk-buffalo` `main` (`5d568f8`) and pushed. Its validated deploy files were kept.
  - `showcase/pitch/` stays local, as T22 specifies.
  - Before the push, a fresh clone with these changes passed `npm ci` and the full `npm run check`: 240 / 240 unit tests, and the build.
- **Portfolio:** the Harbor Desk card is first on rssdesign.org/experiments, with Try it live (the Vercel app) and Source (the public repository). The counter goes from 5 to 6. Pushed to `RSSDesign9/rssdesign-org` `main`, which Vercel deploys to www.rssdesign.org.
- **Raj's earlier choice** was to hold the card until the app was deployed. It already was (HTTP 200 at the live URL), so the card went up.
