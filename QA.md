# Harbor Desk — QA record

Newest review first. Gate D (T34) covers v1.1, Phase 4.5 (T24–T33). The Gate C release review (Batch 8) follows unchanged as history.

## T22–T23 handoff check (16 November 2026)

On the map-first workspace (`b2dc232d`), plus this batch's two CSS fixes (camera bar right inset, About dialog wrapping). Raw outputs are in `qa/handoff/`.

| Check | Result | Status |
|---|---|---|
| `npm run check` | 240 / 240 unit tests, 0 fixture errors, lint, typecheck, build | Pass |
| Browser journeys, `--workers=1` | **44 passed, 51 failed.** The failures are pre-refresh specs that expect the old layout; two of them were reproduced on the published snapshot, which has no changes from this batch. `workspace.spec` 9 / 9 and `keyboard-pan.spec` 3 / 3 pass | **Open:** the old journeys need rewriting for the new workspace |
| About dialog at 1440×900 | Scroll width = client width (718 px); paragraphs wrap | Pass |
| Camera bar | Right inset 14 px (was 6 px) on desktop and the tablet row | Pass |
| Showcase media | Walkthrough 77.2 s, 1600×1000, about 36 fps captured, 30 fps CFR. Card 28.2 s, 1.09 Mbit/s. Five stills at 1× and 2× | Pass |
| Card in the real `/experiments` page | 1440×900 and 390×844 ([card-preview-1440](qa/handoff/card-preview-1440.png), [card-preview-390](qa/handoff/card-preview-390.png)) | Pass |
| Transfer, frame pacing, panel coverage | Not re-measured after the workspace refresh | Unverified |

## T35 addendum — Buffalo seiche and gale what-if (16 November 2026)

T35 option E against the Gate D budgets. Details: BUILD-LOG “T35”; raw outputs in `qa/batch13/`. Same device and method as Gate D (M3 Max, visible Metal window, production build).

| Check | Gate D | With T35 | Status |
|---|---:|---:|---|
| Unit tests | 223 / 223 | **240 / 240** (`lake.test.ts` +17) | Pass |
| Browser journeys, `--workers=1` | 80 / 80 | **82 / 83** (+3 in `lake.spec.ts`); the failure is `zoom.spec.ts` stopping at its first assertion on this Retina display (DPR 4, not 2), the known environmental case | Pass except the environmental zoom run |
| Transfer, full demo, compressed | 924,214 B | **930,504 B** | < 6 MB. Pass |
| Shell chunk, gzip | 136.02 kB | **142.33 kB** (the lake series) | Reported |
| Cold shell / first 3D, DPR 1 | 451–536 ms / 1.44–1.61 s | **466–471 ms / 1.46–1.48 s** | Pass on substitute |
| 60 s frame run, calm / gale | 59.88 fps, p95 17.6 ms (60 Hz display) | **120.5 / 120.5 fps, p95 10.1 / 10.0 ms** (faster display this run) | Pass on M3 Max only |
| Draw calls per phase | 62–301 | **62–295, identical in calm and gale** | Unchanged |
| Calm scene vs T33 captures | — | **Pixel-identical** (max channel difference 1/255) | Poster and evidence unchanged |
| Panel coverage, 1440×900, default | not re-measured | **39.4 % before T35 → 43.0 %** (31.6 % with the request card collapsed) | Over the ≤ 30 % T25 target since T30/T31; open |
| Console / network | 0 errors, 0 external | **0 / 0**; offline workflow passes | Pass |

SIM / ASSUME labelling: the lake series is SIM, its shape and the berth exposure and deck heights are ASSUME (SRC-LAKE), and the 34 kt gale band is DOC (SRC-NWS-MARINE). The card says the verdicts are an illustration, not berth-fit or navigation advice.

## Gate D — performance, regression and v1.1 acceptance (T34, 16 November 2026)

Scope: T34 only. Re-measured and re-ran everything on T33 as committed in `475d43fe` (another session committed it during this run; `src/`, `tests/`, `public/` and `data/` are identical to that commit). No product code changed in T34. No deployment, publishing or external integration.

### D1. Build and environment

Production build from `npm run build`. Build SHA-256 (sorted relative paths + bytes, maps included): `1a1680cbf552126231b814af9e94a13ce86ee2c5b0f976af5add4fd473f471b7`. Inventory: [startup-transfer.json](qa/gate-d/startup-transfer.json). Device: Apple M3 Max, 14 cores, 36 GiB, Darwin 23.4.0 arm64. Chromium 159.0.8154.6 (Playwright). GPU runs: ANGLE Metal / Apple M3 Max in a visible window. **No M1 MacBook Air was available**, so the M1 frame-rate and latency targets stay **unverified**. Browser journeys render in SwiftShader on the lite tier (T33), so they say nothing about hardware frame rate.

### D2. Verification

| Check | Result | Evidence |
|---|---|---|
| `npm run check` | Passed: tokens; **14 fixture files, 0 fatal / 0 errors / 0 warnings**; asset reproduction; typecheck; lint (0 / 0); **223 / 223 unit tests in 27 files**; production build | [check.log](qa/gate-d/check.log) |
| `npm run geometry` | **23/27 pass**, with the same four documented source flags (absent slipway 934085281, partial water coverage, A→B→D→C→E order, Dock E numbered from SE). Tracked outputs unchanged | [geometry.log](qa/gate-d/geometry.log) |
| `npx playwright test --workers=1` | **80 / 80 passed in 11.2 min**, including the real 200 % zoom journey, axe scans, no-console-error and no-external-request assertions | [browser-tests.log](qa/gate-d/browser-tests.log); screenshots in `qa/batch12/` |

Build chunks: shell `index` 682.57 kB / **136.02 kB gzip** (three.js still out of the shell); `SceneRoot` 1,135.33 kB / 315.66 kB gzip; `layout` 12.97 kB, `PlanView` 1.61 kB, `Gallery` 2.53 kB gzip.

### D3. Budgets: Gate B / Gate C against now

| Measure | Gate C (Batch 8) | Gate D | Criterion / status |
|---|---:|---:|---|
| Cold useful shell, DPR 1 (3 runs) | 408.2 / 409.3 / 388.0 ms | **535.8 / 455.7 / 451.0 ms** | <2,000 ms. Pass on substitute |
| Cold initial 3D, DPR 1 | 1,190.4 / 1,200.7 / 1,179.2 ms | **1,607.8 / 1,461.0 / 1,444.6 ms** | <5,000 ms. Pass on substitute |
| Cold startup, DPR 2 | shell 403.0, 3D 1,176.9 ms | **shell 495.6, 3D 1,531.1 ms** | Pass on substitute |
| Full demo, compressed response bodies | 757,387 B | **924,214 B** | <6,000,000 B. Pass |
| Resource Timing transfer incl. headers | 762,787 B | **929,614 B** | Pass |
| Fonts loaded | 170,448 B, 5 faces | **96,212 B bodies / 97,112 B with headers, 3 faces** | <200,000 B. Pass |
| All deployable files, gzip, no maps | 764,521 B | **935,277 B** | Pass |
| Disk, without / with maps | 2,050,805 / 8,284,703 B | **2,402,392 / 8,974,609 B** | Reported only |
| Visible 60 s frame run | 59.88 fps median; p95 17.8 ms; max 51.6 ms; 1 frame >33.3 ms | **59.88 fps median; p95 17.6 ms; p99 17.7 ms; max 32.7 ms; 0 frames >33.3 ms** (3,596 frames) | ≥55 fps, p95 ≤33.3 ms. Pass **on M3 Max only** |
| Draw calls, sampled mid-move per phase | 22–82 (one pass counted) | **62–301** (every pass counted, see below) | <2,000 ceiling pass; <300 aim: see note |
| Draw calls at rest (back-to-back) | overview 80, B-12 32 | **overview 152, Dock B 54, B-12 48** | Pass |
| Back-to-back frame cost, median / p95 | — | overview 3.4 / 5.6 ms; Dock B 2.8 / 4.8; B-12 2.8 / 4.6 | Headroom on substitute |
| Selection feedback | 23.8 / 25.1 / 14.0 ms | **B-12 17.2, D-10 17.1, A-05 17.3 ms** | <100 ms. Dispatch-to-DOM on substitute |
| Cleanup, 5 cycles | 136 geo / 8 tex / 15 prog; 1,933 nodes / 637 listeners | **276 geo / 16 tex / 18 prog; 1 document / 714 nodes / 522 listeners, identical every cycle** | Flat, no growth |
| Console / network | 0 / 0 / 0 external | **0 errors, 0 failed, 0 missing, 0 external origins** | Pass |
| Network off after load | Direct mobile resolution, both DPRs | **Same, both DPRs** ([DPR 1](qa/gate-d/offline-resolved-dpr1.png), [DPR 2](qa/gate-d/offline-resolved-dpr2.png)) | Pass; no offline-install claim |

**What changed and why it is justified.**

- **Transfer +166,827 B (+22 %).** The T24 poster (62.2 / 116.0 kB at 1600 / 2400) and the heavier T33 scene chunk (+16 kB gzip), partly offset by T27’s smaller font set (−74 kB). 15 % of the budget.
- **Startup +50–130 ms shell and about +300 ms to the first 3D frame.** The T33 scene builds more geometry (foliage, cars, elevator detail) and compiles the reflection and occlusion programs. The shell is still about a quarter of its budget and 3D is under a third.
- **Draw calls are not like-for-like.** Since T33 the counter covers every pass in a frame (shadow, planar reflection, occlusion, overlay). The 301 is the Map phase sampled mid-flight, when the reflection re-renders; Overview mid-move is 295 and 152 at rest. **That is one call over the <300 aim on a moving frame and 15 % of the 2,000 ceiling**, with frame time unaffected (p95 17.6 ms). Accepted. If it matters on M1, skip the reflection pass in Map mode, where the 2° lens looks almost straight down.
- **Cleanup counts are higher but flat.** The T33 scene has more geometries and programs. DOM nodes fell because the desktop list starts closed and builds rows only while open (T25 / T31).

Method is as in §6 below, unchanged except: **shell readiness** now means search + domain store + list options **or** four valued KPI tiles, because since T25 / T31 the closed desktop list renders no options. The transfer walk now also opens the list, visits the Map preset, and switches mobile from the 3D map to the flat plan so the deferred plan module is still counted.

### D4. T24–T33 done-when criteria

| Task | Status at Gate D | Regression coverage in this run |
|---|---|---|
| T24 opening shot | Met | `intro.spec.ts` |
| T25 chrome diet, KPIs | Met with the recorded deviation (scenario card kept as head + strip) | shell, marina, responsive specs |
| T26 copy pass | Met with the recorded shortfall (−40 % reached on first screen and uncertain, not normal or resolved) | all label-based journeys |
| T27 typography | Met (3 faces, 96,212 B, no external font requests) | transfer above; external-request assertions |
| T28 July fixtures | Met | `fixtures:check` 0 / 0; marina, failures specs |
| T29 3D dock map | Met with the recorded deviation (2° long lens) | `map.spec.ts` |
| T30 drag-to-assign | Met with two recorded deviations (36 ft request; native select) | `assign-timeline.spec.ts` |
| T31 scrubber, arrivals | Met | `assign-timeline.spec.ts`; timeline unit tests |
| T32 dock-walk trigger | Met | review, replay and identity-leak journeys under the new labels |
| T33 environment realism | Met with three recorded deviations; Raj approved the v3 side-by-side | `scene.spec.ts`, environment unit tests; GPU numbers above |

B-12 invariants, identity-leak tests and replay immutability all pass in the 80 journeys and 223 unit tests.

### D5. Defects found in T34

QA tooling only; no product code changed.

| Finding | Fix |
|---|---|
| `measure-release.ts` stopped at the Vessels tab: the desktop list starts closed (T25) | Opens the list first |
| `measure-release.ts`: About moved to the top bar (T25); the first step and the 09:12 snapshot were renamed (T32); a capable GPU opens mobile on the 3D map (T29), so the plan never appeared | Current labels; switches mobile to the plan through Display |
| Shell readiness never fired: a closed list builds no option rows | New definition above |
| `check-reuse.ts` used the old “09:12 Uncertain” snapshot label | “09:12 Discrepancy” |
| `measure-release.ts` / `measure-transfer.ts` wrote into old batch folders | `--out-dir` option; transfer defaults to `qa/gate-d/` |

### D6. Reproduce

```sh
npm run check
npm run geometry
npx playwright test --workers=1
# After the suite releases 4719, with no other benchmark running:
node scripts/measure-release.ts --headed --out-dir qa/gate-d
npm run preview -- --host 127.0.0.1
node scripts/profile-scene.ts --gpu --headed --out qa/gate-d/profile-visible-gpu.json
node scripts/check-reuse.ts --gpu --headed --out qa/gate-d/reuse.json
```

Raw: [profile-visible-gpu.json](qa/gate-d/profile-visible-gpu.json), [reuse.json](qa/gate-d/reuse.json), [startup-transfer.json](qa/gate-d/startup-transfer.json), and logs in `qa/gate-d/`.

### D7. Limitations and Gate D

- **M1 MacBook Air: unverified.** No device was available. The capability probe would give it the full tier; whether reflection + occlusion hold 55 fps on an M1’s integrated GPU is the open question. The Map-mode reflection is the first thing to cut if not.
- Browser journeys run the lite tier. The full tier is covered by the GPU measurements and the T33 captures, not by the journeys.
- Spoken screen-reader operation, physical touch, Safari and Firefox: still unverified (unchanged from Gate C).
- Draw calls on moving frames sit at the <300 aim (one over in Map). Measured and accepted above.
- The four inherited geometry source flags are unchanged.

**Gate D: PASSED for the applicable local criteria, with the unverified items above.** T24–T33 done-when criteria are met or carry their recorded, approved deviations. Gate B / C budgets hold on the substitute device, and every increase is measured and explained. No critical workflow, data-integrity or accessibility regression: 80 / 80 journeys, 223 unit tests, zero axe violations, zero console errors or external requests. **Next: T35 (optional; ask Raj which option) or T22.**

---

## Gate C — Batch 8 release review (14 November 2026)

Review date: 14 November 2026 (America/Phoenix). Scope: T19–T21 only. No portfolio package, recording, live-portfolio edit, deployment, publishing or external integration.

### 1. Build and environment

Production build generated by `npm run build`, served locally with Vite preview on `127.0.0.1:4719`. Startup/transfer uses the same `dist/` with the deterministic gzip HTTP server on `127.0.0.1:4720` in `scripts/measure-release.ts`.

Final build SHA-256: `8351b7b5e1fe7d8b05c909aefdbe5975e65fb3b3ee428a2b27bd9f893547b040`. Complete file inventory: [startup-transfer.json](qa/batch8/startup-transfer.json). The hash incorporates each sorted relative path and its bytes, including source maps. Git is the parent multi-project repository; the working tree is intentionally uncommitted. Unrelated files were not changed. No GitHub write was performed.

Device: Apple M3 Max, 14 CPU cores, 36 GiB RAM, macOS/Darwin 23.4.0, arm64. Chromium 159.0.8154.6, Playwright 1.65.1. GPU: ANGLE Metal / Apple M3 Max. **No M1 MacBook Air was available.** Visible-window GPU measurements apply only to this substitute. Headless SwiftShader integration tests do not establish hardware frame rate.

### 2. Verification and critical journeys

Every journey uses deterministic SIM fixtures and a fresh browser context; the regular suite has only the paused-motion display preference preloaded. Tests that exercise persistence reload the same context deliberately. Browser tests launch a fresh production preview and refuse to reuse an arbitrary running server.

| Requirement | Assertions and evidence |
|---|---|
| Overview → B-12, empty/assigned/not bookable | `scene.spec.ts`, `review.spec.ts`: actual berth click/list/search, empty hull, assignment and `Bookable No` |
| Actual canvas selection synchronizes; drag does not select | `scene.spec.ts`, `marina.spec.ts`: actual pointer events on raycast coordinates; all five docks. `release.spec.ts` adds **visible-window Metal GPU** empty-berth and observed-hull picks, list/marker/inspector sync and drag suppression. No DOM canvas substitute |
| Direct evidence → acknowledgment → resolution | `review.spec.ts`: disabled without evidence, acknowledgment required, one decision, unchanged hull position/geometry with name board added |
| Request twice → one pending → one completed task | `review.spec.ts`: UI double-click plus domain repeat, pending across selection/reload, exactly one task and one completion event |
| Missing evidence, unchecked acknowledgment and cancel | `review.spec.ts`, `failures.spec.ts`: rejected command, disabled confirmation, cleared acknowledgment on cancel; open issue and no decision |
| Harbor Light unchanged | `review.spec.ts`: active B-14 assignment and departure at 08:30; no B-14 hull; original fixture observations byte-identical |
| Immutable history, exactly one appended result | `review.spec.ts`: original observation and candidate visible, exactly one identity decision, identity-confirmed audit, issue-resolved audit and (pending path only) task-completed audit; double-click idempotence |
| Replay/back/branch/restart/reload | `review.spec.ts`: snapshots read-only, backward hides later evidence, no staff image request before 09:18, interactive run preserved, isolated branch restored on reload, restart restores seed |
| Stale/offline/missing assets | `failures.spec.ts`, `nowebgl.spec.ts`, `foundation.spec.ts`: unknown is not empty, fallback plan/list, failed-chunk retry, context loss, missing model/evidence, invalid provenance and storage recovery |
| Mobile/keyboard equivalent workflow | `a11y.spec.ts`, `responsive.spec.ts`, `zoom.spec.ts`, `release.spec.ts`: direct and pending paths, focus/announcements, 390×844 plan, reduced-motion keyboard workflow, real 200% Chromium page zoom, mobile 3D opt-in and return to plan without record changes |

Verification totals: `npm run check` passed tokens, all 12 fixture files (0 errors/warnings), asset reproduction, typecheck, lint, **162 tests in 17 files**, and the production build. `npm run geometry` reproduced unchanged outputs: **23/27 pass and the same four documented source flags**. The complete production browser suite passed **67/67** with one worker. After the final mobile-camera correction, all **16/16 affected responsive, keyboard, accessibility, About, real GPU picking and native zoom tests passed** on the final build. The other 51 tests passed in the complete run immediately before that camera-only correction; they were not redundantly rerun. Evidence: [check.log](qa/batch8/check.log), [geometry.log](qa/batch8/geometry.log), [full browser run](qa/batch8/browser-tests-final.log), [final affected regressions](qa/batch8/final-framing-regression.log).

The native in-app browser was also manually operated through list B-12 → 09:12 → evidence review → 09:18 → acknowledgment → resolution. Native accessibility state exposed disabled confirmation, evidence text, focused result headings and the final unchanged agreement/Harbor Light history. This is **not** a spoken screen-reader pass.

### 3. Workflow and responsive screenshots

All images are QA evidence, not the Batch 9 portfolio package.

- [1440×900 selected B-12](qa/batch8/layout-desktop-1440-uncertain.png), [1600×1000 comparison view](qa/batch8/layout-desktop-1600-uncertain.png).
- [1024×768 tablet](qa/batch8/layout-tablet-1024-uncertain.png), [390×844 mobile plan at DPR 2](qa/batch8/layout-mobile-390-uncertain.png).
- [Normal B-12](qa/batch8/e2e-b12-selected-normal.png), [direct resolution](qa/batch8/e2e-resolved-direct.png), [pending-task resolution](qa/batch8/e2e-resolved-pending.png), [keyboard resolution](qa/batch8/e2e-keyboard-resolved.png).
- [Actual 200% browser zoom, resolved](qa/batch8/e2e-zoom200-resolved.png), [zoomed uncertain state](qa/batch8/zoom-cdp.png), [mobile reduced-motion keyboard](qa/batch8/mobile-reduced-keyboard.png), [mobile 3D opt-in](qa/batch8/mobile-3d.png).
- [About, desktop/light](qa/batch8/about-desktop-light.png), [About, mobile/dark](qa/batch8/about-mobile-dark.png).
- [Visible GPU picking](qa/batch8/visible-gpu-b12.png) and [renderer identification](qa/batch8/visible-gpu-picking.json).
- [Offline direct resolution](qa/batch8/offline-resolved-dpr1.png).

[Layout geometry report](qa/batch8/layouts.json): no zone overlaps, covered control centers or horizontal document scroll at the four required dimensions. Tablet uses a scrolling details rail; mobile uses one scrolling sheet. Long evidence/history is intentionally scrollable rather than squeezed into the viewport. The OSM credit remains visible below the mobile scroller. Actual 200% Chromium page zoom uses a 1440×900 browser window: content is 1440×813 physical pixels / 720×406 CSS pixels, DPR 2; [native zoom metrics](qa/batch8/zoom-metrics.json). The full-size CDP capture avoids the default screenshot tool’s zoom crop.

### 4. Visual comparison

[Side-by-side comparison sheet](qa/batch8/compare-v2.png) and [final overview](qa/batch8/overview-gpu.png). Inspected the actual 1440×900 and 1600×1000 B-12 renders directly alongside [approved target v2](design/visual-target-v2.png), plus Batch 5 Gate A and Batch 7 selected/overview captures.

| Aspect | Finding |
|---|---|
| Foreground detail | Hull shape, windshields, rails, canvas, cockpit, fenders, mast/rigging, dock planks, piles and pedestals remain visible. Geometry/LOD detail is unchanged from the approved dock-section work |
| Scale/waterline | Boat pivots remain at the waterline; no levitation, teleportation or new clipping. Tight assumed berths are deliberately unlike the concept's generous illustrative spacing |
| Miniature/materials | Clean restrained surfaces, distinct canvas/glass/gelcoat and quiet water. Less nuanced reflections and softer material variation than the concept; no photorealism claim |
| Light/water | Calm procedural water and coherent daylight. Cast shadows and faceted tree masses are simpler than v2; no new lighting or material regression |
| Buffalo context | Long bank, riprap and yard relationship preserved. Overview shows the elevator and Skyway at validated approximate positions. The selected B-12 view is sparser than v2: mostly trees/lawn, because the real modeled elevator lies about 200 m southeast. It was not moved into an illustrative position |
| Operational UI | Approved Harbor Desk dark marine chrome, type and orange selection retained. Selected boat visible in the desktop open area; inspector and list legible and independently scrollable. The only scene appearance change is a narrow dark backing behind the two state outlines |

The v2 **direction is represented**, not pixel-matched. Known differences (sparse distant banks, no mooring ropes, simple tree silhouettes, no planar hull reflections or ambient-occlusion pass) predate this batch. No unsupported landmarks, branding or boat placement was introduced to imitate the image.

### 5. Accessibility

- Automated axe WCAG 2.0/2.1/2.2 A/AA checks: **11 states, zero violations**; [axe-results.json](qa/batch8/axe-results.json); About separately scanned in both themes at desktop/mobile. Incomplete rules are retained as incomplete, not silently called passes.
- Keyboard-only direct/pending resolution, cancel/back, focus restoration, disabled states, list selection, disclosure behavior, concise polite announcements and visible focus checked by integration assertions and native UI review.
- The canvas stays aria-hidden; records and workflow are represented in the DOM. About uses a labeled native dialog with heading focus, Escape/Close and return focus. Links open separate tabs and announce that fact.
- Chart/light theme, solid-panel preference, reduced-motion cuts and paused-water idle frames were checked. Existing Batch 7 target-size and responsive tests remain in the suite.
- [Composited text contrast](qa/batch8/contrast.json): 15 scene/workflow/theme/layout states, zero measured failures. Screenshot sampling uses the actual backdrop after hiding only text, with 4.5:1 normal/3:1 large text thresholds; the script retains its documented 2nd-percentile method and disabled/scroll-edge exclusions.
- [Outline baseline](qa/batch8/outline-contrast-before.json) exposed low contrast over docks; [fixed outline evidence](qa/batch8/outline-contrast.json) measures colored cores against their actual adjacent dark backing. All 723 sampled selection cores had backing, minimum **4.85:1**; all 261 review cores had backing, minimum **8.19:1**. Antialiased edge pixels are excluded. The colored line alone still has low contrast over some scenery; the paired stroke is the fix.
- The unknown-berth tint is supplementary and not a standalone status signal: unknown is labeled in the plan legend, inspector/list and hover text, and has a dashed rather than empty solid outline. Its subtle fill does not claim a standalone 3:1 guarantee.
- **VoiceOver/NVDA spoken operation: unverified.** No audio/screen-reader control interface was available. Accessibility-tree inspection and axe cannot prove spoken reading order, pronunciation or reader-specific behavior. Physical touch devices, Safari and Firefox were not tested.

### 6. Performance and reproduction

Measured results and precise conditions are in [startup-transfer.json](qa/batch8/startup-transfer.json), [profile-visible-gpu.json](qa/batch8/profile-visible-gpu.json) and [reuse.json](qa/batch8/reuse.json). 
| Measure | Actual result | Criterion / status |
|---|---:|---|
| Cold useful shell/list, DPR 1 | 408.2 / 409.3 / 388.0 ms | <2,000 ms — pass on substitute |
| Cold initial 3D, DPR 1 | 1,190.4 / 1,200.7 / 1,179.2 ms | <5,000 ms — pass on substitute |
| Cold startup, DPR 2 | shell 403.0 ms; 3D 1,176.9 ms | pass on substitute |
| Full demo actual compressed response bodies | **757,387 B** | <6,000,000 B — pass |
| Resource Timing transfer including standardized headers | **762,787 B** | pass; separate from raw body measurement |
| Actual loaded fonts | **170,448 B** bodies / **171,948 B** with reported headers, five faces | <200,000 B — pass |
| All deployable files excluding maps, gzip for text | **764,521 B** | Conservative budget including unrequested gallery/notices also passes |
| Uncompressed output on disk | **2,050,805 B** excluding maps; **8,284,703 B** including maps | Reported separately; not a compressed-transfer comparison |
| Visible-window 60 s frame run | **59.88 fps median; 17.8 ms p95; 51.6 ms max; 1 frame >33.3 ms** | ≥55 fps / p95 ≤33.3 ms — pass on M3 Max only |
| Draw calls sampled during seven phases | **22–82**; overview 80, selected B-12 32 | <2,000 ceiling and <300 aim — pass |
| Selection feedback | B-12 **23.8 ms**, D-10 **25.1 ms**, A-05 **14.0 ms** | <100 ms — dispatch-to-DOM on substitute, not M1 physical-input claim |
| Cleanup after each of five cycles | **136 geometries / 8 textures / 15 programs; 1 document / 1,933 DOM nodes / 637 listeners** each time | Flat counts, no progressive growth in tested procedure |
| Normal console/network | **0 errors, 0 failed/missing requests, 0 external origins** | pass |
| Loaded demo without network | Direct mobile resolution completed at both DPRs | pass; no offline reload/install claim |

Startup/transfer, the visible GPU profile and cleanup were rerun sequentially on the final build identified above. No hardware result is inferred from headless tests.

Startup: 1440×900; three fresh HTTP-cache-disabled contexts at DPR 1 plus one at DPR 2; **10 Mbps down/up, 100 ms latency, no CPU throttling**, actual gzip level 6 HTTP responses. No app warm-up; browser/GPU process is shared, so this is not a cold driver/shader-cache or physical network claim. In-page animation-frame timing starts at navigation: shell means usable list options/search/store; initial 3D means camera ready plus at least two nonempty rendered frames.

Transfer: union of actual requested paths through both list tabs, full requested-check resolution, replay, About and deferred mobile plan at DPR 1 and 2. Count both evidence densities and all five fonts. Resource Timing encoded bytes are compressed bodies; transfer bytes add the browser's standardized header overhead. Whole output disk size is reported separately, including source maps. No authoring MP4, concept PNG, inspection GLB or reference PDF is shipped. Source maps and the unlinked primitive-gallery chunk are intentional diagnostics, not accidentally downloaded demo assets.

GPU profile: visible Chromium window, 1440×900 DPR 1, Metal/M3 Max; 30 back-to-back overview frames for warm-up. Defined 60-second sequence: 10 s overview orbit; 10 s Dock B orbit; 12 s B-12 selection/orbit; 8 s D-10; 6 s A-05; 6 s top-down pan; 8 s overview. Every frame spacing is recorded. Draw calls sampled per phase. Selection feedback is dispatch-to-inspector (separate from the real-pointer picking smoke test); it is not a claim of end-to-end input latency on M1 hardware.

Cleanup: five cycles of five selections, resolution, backward replay, three presets and restart, with renderer geometry/texture/program counts and DOM counters after forced GC. Stable counts establish bounded resources over this procedure, not a proof of all long-duration JS memory behavior.

```sh
npm run check
npm run geometry
npx playwright test --workers=1
# After the suite releases 4719:
npm run preview -- --host 127.0.0.1
# Separate shell, no other benchmark running:
node scripts/measure-release.ts --headed
node scripts/profile-scene.ts --gpu --headed --out qa/batch8/profile-visible-gpu.json
node scripts/check-reuse.ts --gpu --headed --out qa/batch8/reuse.json
node scripts/capture-layouts.ts --url http://127.0.0.1:4719 --gpu --paused --out qa/batch8 --only desktop-1440,desktop-1600,tablet-1024,mobile-390 --stage uncertain --select B-12
node scripts/measure-contrast.ts --url http://127.0.0.1:4719 --gpu --out qa/batch8/contrast.json
node scripts/measure-outline.ts
```

### 7. Defects and changes

| Finding | Fix / regression evidence |
|---|---|
| About / Sources absent | Added dated manifest references, plain-language provenance, concept/fiction/geometry limits, pilot requirements, safe links and credits; four theme/layout axe scans and focus/Escape tests |
| Mobile OSM attribution scrolled out of view | Fixed compact credit below the sheet scroller, outside About; mobile workflow tests assert in-viewport attribution |
| Selection/review outline lost contrast over bright scenery | Dark underlay, with original orange/amber, dashes and geometry retained; measured core/backing contrast above 3:1, GPU picking and visual inspection |
| Desktop top bar clipped at 1280 px in native browser | Hide the redundant place subtitle at 1280–1439 px; full brand/source context remains in footer/About; 1440+ composition unchanged |
| Fresh unknown observation said “Current” beside “Presence unknown” | Clarified only that case to “Recent report · presence unknown”; no domain change |
| Static hosting requested an absent default favicon | Linked the already bundled lighthouse `favicon.svg` in HTML; final compressed-server run reports no errors/missing requests |
| Mobile opt-in 3D marker partly hidden behind header | Removed a stale bottom-sheet camera inset: the canvas already occupies a separate grid row. New bounds assertions and screenshot verify the marker above the sheet and below the header |
| Native-zoom screenshot captured only the top-left quadrant | Explicit physical viewport capture; actual 200% zoom and workflow assertions retained, full rendered layout inspected |
| Bundled dependency credit gap | Generated 14 bundled package notices and preserved missing upstream Fiber MIT notice; original five fonts and IBM license unchanged |
| Existing performance evidence used headless GPU and estimated compression | Added visible-window profile mode and actual gzip HTTP/cold-cache measurement; no target-hardware inference |

First browser pass: 62/67 passed. The two new test failures were locator errors (the checkbox's accessible name includes its description; native select and listbox both have selected options). The new mobile attribution also created duplicate matching links; removed the redundant mobile footer copy while preserving the fixed visible credit. The legacy no-“live”-badge assertion also matched the new negative disclaimer; rephrased it to “There are no camera feeds…” without weakening the assertion. Final regression totals are recorded in §2 above. No domain engine, fixtures, geography, boats or original source assets were changed. Product copy review covered the shell, scenario, registry/inspector, evidence, documents, provenance labels and About; no unsupported live-recognition, operator capacity/service, partnership, customer-impact, compliance or measured-confidence claim was found. Notices and source rights are detailed in [ASSET-PLAN](design/ASSET-PLAN.md#t20-source-and-shipped-asset-review-14-november-2026).

### 8. Remaining limitations and Gate C

- M1 MacBook Air frame rate and selection latency remain unverified; M3 Max results are substitute measurements only.
- Spoken screen-reader operation, physical touch devices and non-Chromium browsers remain unverified.
- Four inherited geometry flags remain: absent referenced slipway, partial water coverage (handled with authored masks), actual A→B→D→C→E ordering, and reversed Dock E numbering. IDs and geography remain canonical; these are source caveats, not newly failing model checks.
- Adaptive DPR has not been observed engaging on the available fast GPU. Context-loss journey uses SwiftShader; mobile 3D was tested with emulation, not thermal/battery-limited hardware.
- Whole-map geometry failure falls back to the list rather than quarantining one geometric slip. Plan pan/pinch is not implemented; list/dock focus is the intended small-screen route.
- Fontshare's current JavaScript-only legal page could not be text-verified through the retrieval tool. The existing recorded user font decision and binaries were preserved, not represented as freshly relicensed.
- Visual differences from v2 are documented above; validated geography and approved dock-section work take precedence over illustrative placement.

**Gate C: PASSED for the applicable local release criteria, with the explicit unverified checks above.** No known critical workflow, data-integrity, accessibility or material visual/budget failure remains. The complete suite passed 67/67 before the final mobile camera correction; the 16 affected journeys passed on the final build. Final cold-cache transfer/startup, visible GPU profile and five-cycle cleanup measurements pass on the documented substitute. This is not an M1 performance certification or a spoken screen-reader pass.

**Batch 9 may proceed, starting at T22.** Read this QA record and preserve the caveats, then create the T22 demonstration package; only afterward do T23 build/run documentation. T22–T23 remain unchecked and were not started here. Do not treat these QA screenshots as a completed portfolio package. No deployment, publishing or live-portfolio change was performed.
