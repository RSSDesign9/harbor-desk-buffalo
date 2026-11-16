# Harbor Desk — Runtime asset plan

Written 14 November 2026 for TASKS T03. Placement inputs: [data/GEOMETRY-VALIDATION.md](../data/GEOMETRY-VALIDATION.md). Fidelity target: [visual-target-v2.png](visual-target-v2.png) (about 6.5/10). Brand authority: [DESIGN.md](../DESIGN.md).

Budget targets come from PRD §11. The **T09 asset manifest** below holds measured values for the Dock B section; the plan tables after it are still estimates for work not yet built (T14–T16).

## Strategy in one paragraph

Build almost all geometry as **authored, parametric TypeScript generators** that run in the browser: hulls, docks, piles, shoreline, buildings, trees and water. The editable source is the generator code plus its parameters, which live in the repo, are reviewable, and are reproducible. Generated meshes cost almost no download, so the transfer budget goes to JavaScript, fonts and two small simulated evidence images. Repeated parts are instanced, materials are shared, and distant objects get cheaper representations. The hero cabin cruiser gets much more detail than anything else. No third-party models, textures, HDRIs, map tiles or paid assets are used in v1. If the procedural hero boat fails the v2 comparison at Gate A, the fallback is a hand-modelled GLB with its source file and export script in the repo (see Risks).

## T09 asset manifest (built and measured, 14 Nov 2026)

This section records what Batch 4 actually built. Where it differs from the plan tables further down, **this section is current** and the plan is kept as the record of intent.

### Authorship, source and rights

Every 3D asset below was **authored in this repository as parametric TypeScript** for this project. No third-party model, texture, HDRI, map tile, paid asset or generated image is used, and nothing was extracted from Google Maps/Earth. Reuse rights: project-owned (same terms as the rest of the repo); no attribution is owed to anyone else. The one generated texture (dock planks, 256 × 64) is built in code at start-up.

| Asset | Editable source | Runtime output | Rights |
|---|---|---|---|
| Mesh builder, hull loft, finishes | `src/scene/assets/mesh.ts`, `hull.ts`, `finishes.ts`, `parts.ts` | Code in the scene chunk | Authored here |
| **Cabin cruiser** (the B-12 observation hull, and every cruiser) | `src/scene/assets/cruiser.ts` | Geometry generated in the browser, one mesh per boat | Authored here |
| Small powerboat (center console, single or twin outboard) | `src/scene/assets/console.ts` | Same | Authored here |
| Sailboat (keelboat, mast, sail cover, rigging) | `src/scene/assets/sailboat.ts` | Same | Authored here |
| Dock structure, pile, gangway, revetment rock, tree, lamp post | `src/scene/assets/dock.ts` | One merged mesh per dock + instanced piles, rocks, trees, lamps | Authored here |
| Shared surface material, plank texture, analytic sky, contact shadow | `src/scene/materials.ts` | 2 small DataTextures (65 KB and 16 KB in memory, 0 bytes downloaded) | Authored here |
| Water, sun, hemisphere fill | `src/scene/Environment.tsx` | Shader patch on a standard material | Authored here |
| Shoreline placement (ASSUME) | `src/scene/Shore.tsx` | — | Authored here; placement offsets from the OSM headwalk (ODbL attribution already shown) |

### Regeneration and export

The generators **are** the editable source, and the app runs them directly, so there is no binary to drift out of date.

| Command | Result |
|---|---|
| `npm run assets` | Runs the same generators in Node and rewrites `data/derived/asset-report.json` (triangles, vertices, bounding boxes, pivot checks per asset and LOD) |
| `npm run assets:check` | Fails if that report no longer matches the generators. Part of `npm run check` |
| `npm run assets:glb` | Also writes inspection copies to `design/assets-export/*.glb` (open in Blender or any glTF viewer). Authoring copies only: **not shipped**, 1.49 MB on disk |
| `npm run capture -- --stage uncertain --select B-12 --out qa/…png` | Screenshot of a staged view (add `--gpu` for the real GPU) |
| `npm run measure -- --gpu --out qa/batch4/perf-gpu.json` | Draw calls, triangles and frame timing per view |
| `node scripts/compare-v2.ts <capture> <out>` | Side-by-side sheet against `visual-target-v2.png` |

### Conventions (shared by every boat)

- Units are metres; +y is up; **the bow points +x**; the pivot is on the centreline **at the waterline** (y = 0), at mid-length of the overall length. `placeBoat()` positions that pivot, so asset changes never move a berth.
- Overall length equals the vessel’s LOA; the swim platform (cruiser) and outboard (console) sit **inside** that length, so the berth-fit test still describes the drawn hull.
- One boat = **one draw call**. Colour is per-vertex; roughness and metalness ride in a per-vertex `surf` attribute read by one shared material. Stale (unconfirmed) hulls use a second, translucent instance of the same material.
- A generator receives family, length, beam, hull colour and canvas colour only. It has no access to a vessel name, ID or registration. Geometry names are `cruiser-lod0`, `sail-lod2`, and so on.

### Measured geometry (from `data/derived/asset-report.json`)

| Asset | LOD 0 (near, < 95 m) | LOD 1 (dock distance, < 260 m) | LOD 2 (far) | Bounding box L × W × H (m) |
|---|---|---|---|---|
| Cabin cruiser, 28.5 ft, canvas cover (B-12 observation hull) | 8,155 tris | 2,409 | 362 | 9.04 × 3.25 × 2.60 (LOA 8.69 + bow rail and anchor roller; beam 2.96 + fenders) |
| Cabin cruiser, 28 ft, no canvas (open cockpit, radar arch) | 7,456 | 2,344 | 308 | 8.88 × 3.18 × 2.88 |
| Center console, 24 ft | 5,626 | 1,922 | 370 | 7.38 × 2.87 × 4.25 (antenna) |
| Sailboat, 27 ft | 5,494 | 1,806 | 408 | 8.27 × 2.94 × 11.43 (mast) |
| Dock module (12 m of headwalk + 4 fingers, cleats, pedestal) | 820 | — | — | — |
| Pile / gangway / rock / tree / lamp post | 160 / 244 / 30 / 732 / 120 | — | — | — |

The ceiling for the selected boat was 40,000 triangles; the cruiser uses about a fifth of it. The detail went where the v2 comparison needed it (windshield, canvas, rails, hull form), and there is headroom for T13/T16 if a closer camera wants more.

### Runtime size

| Item | Measured |
|---|---|
| Model, texture, HDRI or decoder files downloaded | **0** (the e2e test fails on any `.glb/.gltf/.hdr/.exr/.ktx2` request and on any non-local host) |
| Scene chunk (three, R3F, Drei, scene, all generators), gzip | **294.0 KB** (279 KB before T09: every boat, dock and shore asset together costs about 15 KB) |
| Scene chunk, uncompressed | 1,080 KB |
| Generator sources on disk (`src/scene/assets/*.ts`) | 65.0 KB, 1,596 lines |
| GPU memory for one LOD 0 cruiser | ≈ 0.36 MB (13 floats per vertex + 32-bit indices); LOD 1 0.11 MB; LOD 2 0.02 MB |

### Differences from the plan below

- **Material:** one shared `MeshStandardMaterial` with per-vertex roughness/metalness, not `MeshPhysicalMaterial` clearcoat. It keeps a boat at one draw call, and the sheen comes from the sky reflection.
- **Sky:** no environment map. A hemisphere light gives the diffuse fill and an analytic sky gradient is evaluated in the shader for gloss (glass, stainless, gelcoat, water). An environment map was tried first; its fill flattened the cast shadows and it needed a pre-filter pass.
- **Dock planks:** a 256 × 64 generated texture with mip-maps (stable at distance) instead of shader seams.
- **“Sand” canvas** uses `#b9ae97` (sand-dark warmed toward duck cloth), because the `sand` token is almost the same value as white gelcoat and the changed cover has to be visible.
- **Water:** static procedural ripples and no planar reflection; a soft contact patch under each hull stands in for the hull’s reflection.
- **Not built in T09:** name boards (only for a confirmed identity, T12), the dashed simulated-object contour, storage boats on cradles, buildings beyond extruded masses (T15), evidence stills (T11).

## Tooling facts checked on this machine (14 Nov 2026)

- No Blender, gltf-transform or gltfpack installed. Figma is installed, but it is not a 3D tool. (T09 needed none of them: three’s own `GLTFExporter` writes the inspection GLBs from Node.)
- Python `fontTools` not installed, so subsetting fonts would need a new tool. Not required: see Fonts.
- Playwright Chromium is installed for tests. It can also render evidence stills from the app itself.

## Forbidden runtime paths

These Drei/three conveniences fetch from third-party hosts by default. They are not used, and the browser test fails on any non-local request:

| API | Default remote fetch | Instead |
|---|---|---|
| `<Environment preset=…>` / `useEnvironment` | HDRI from raw.githack.com | Locally generated environment: `<Environment>` with Lightformers, or three’s `RoomEnvironment` through PMREM |
| `<Text>` (troika) without `font` | Default font from a CDN | DOM labels (`<Html>`) or a local font file |
| `useGLTF` with Draco / `Ktx2` | Decoders from gstatic / CDN | No compressed GLB in v1. If one is added later, self-host the decoders under `public/` |
| `Cloud`, `MatcapTexture`, `NormalTexture` | Textures from CDNs | Not used |

## Fonts (local; weights actually needed)

DESIGN §3 roles mapped to the fewest files. The 348 KB supplied set is **not** loaded in full.

| Face | File | Bytes | Used for | Load |
|---|---|---|---|---|
| General Sans 600 | GeneralSans-Semibold.woff | 27,972 | Headings, inspector object names, vessel names | Yes |
| Switzer 400 | Switzer-Regular.woff | 19,240 | Body text | Yes |
| Switzer 600 | Switzer-Semibold.woff | 23,588 | Buttons (APPROVED: Switzer, never mono), emphasis | Yes |
| IBM Plex Mono 500 | IBMPlexMono-Medium.woff2 | 50,400 | Labels, eyebrows, provenance tags, slip IDs | Yes |
| IBM Plex Mono 400 | IBMPlexMono-Regular.woff2 | 49,248 | Tabular data and times | Yes; first to drop if over budget (use 500) |
| General Sans 500 (h3), Switzer 500/700, General Sans 400/700, Plex 600 | — | — | Not needed; h3 uses 600 | No |

Planned font transfer: **170,448 bytes** (WOFF/WOFF2 are already compressed; HTTP compression gains little). That is under the 200 KB target without subsetting. Subsetting Plex would need modification under its OFL Reserved Font Name terms, so it is avoided. `font-display: swap`. Only the five files are copied to `public/fonts/`, with `IBM-Plex-OFL.txt` alongside. LED Dot Matrix is not shipped. Measure the real transfer in T07.

## Brand files

| Asset | Source | Runtime output | Est. transfer |
|---|---|---|---|
| Lighthouse logo G (full, 56×44) | `design/logo-harbor-desk.svg` (approved) | Inlined SVG component (`currentColor` + fixed `#ff4d00`) | ≈1 KB in JS |
| Small mark (tower) | `design/logo-harbor-desk-small.svg` | Favicon + small lockup | ≈1 KB |
| Vessel-type sprite | `design/icons-vessels.svg` | `public/assets/icons-vessels.svg`, used via `<use>` | ≈2.7 KB |

## 3D assets

Zones follow PRD §9. “Tris” are planning ceilings, not targets. Every item is authored in this repo and needs no credit beyond the project itself.

### Zone 1 — selected slip and neighbours (Dock B, B-08…B-16)

| Asset | Family / reuse | Detail plan | LODs | Material | Est. tris (LOD0) | Transfer |
|---|---|---|---|---|---|---|
| **Cabin cruiser** (primary; Lake Effect 29 ft, Harbor Light 27 ft and other cruisers) | Parametric `cruiser(loa, beam, …)` | Lofted hull from cross-sections: sheer, flare, chine, rub rail, swim platform, transom. Deck, cabin trunk, windshield frame and tinted glazing, bow rail and stanchions (tubes), cleats, fender pairs, radar arch/hardtop. Canvas cover variants: **standard** and **B-12 observation cover**. Name board texture is generated only for a *confirmed* identity | LOD0 hero ≤ 40k; LOD1 ≈ 3k; LOD2 ≈ 300 (hull + cabin block) | `MeshPhysicalMaterial` gelcoat with light clearcoat on LOD0 only; shared standard materials elsewhere; canvas navy | ≤ 40k | ≈ 0 (code) |
| Small powerboat / center console (River Run 24 ft) | Same hull generator, `console` superstructure | Console, T-top, rails, outboard | LOD0 ≈ 12k / LOD1 ≈ 1.5k / LOD2 ≈ 200 | Shared | ≤ 12k | ≈ 0 |
| Sailboat (26–34 ft) | Sail hull variant + rig | Keel-boat hull, cabin trunk, mast, boom, furled-sail cover, simplified standing rigging (line segments) | LOD0 ≈ 10k / LOD1 ≈ 1.2k / LOD2 ≈ 150 + mast line | Shared | ≤ 10k | ≈ 0 |
| Floating headwalk + finger piers | Instanced deck modules per dock | Plank deck (seams in shader), rim boards, float shadow line, bumper strip | Merged per dock; detail fades with distance | Weathered composite/wood tone (`sand-dark` family) | ≈ 6k per dock | ≈ 0 |
| Piles | Instanced cylinders with cap | One instance set across the marina | 2 LODs | Shared | 16–48 each | ≈ 0 |
| Cleats, power pedestals, gangway | Instanced | v2 shows white pedestals; one per two slips (ASSUME) | 2 LODs | Shared | small | ≈ 0 |
| Selection / issue visuals | Screen-space outline (orange 1.5 px) + dashed simulated-object contour + DOM markers | Independent of issue state (PRD §6) | — | — | — | ≈ 0 |

**Identity rule (PRD §6, §7 inv. 10).** The observed hull at B-12 uses a generic mesh name (for example `observed-hull`) and a cover variant. No user-visible name, label, aria text or texture reveals Lake Effect before resolution. After resolution only the *label* changes; the hull does not move.

### Zone 2 — marina and working yard

| Asset | Source of placement | Plan | Est. tris |
|---|---|---|---|
| Docks A–E, all 126 berths | `site-local.json` slips/headwalks | Same modules as zone 1, merged per dock | ≈ 40k total |
| Fleet (present boats only) | SIM fixtures (T05) | LOD1/LOD2 cruiser, console and sail variants; colour variants from `mist-100`, `slate`, `forest`, `rust` hulls and navy/sand canvas; instanced per family and LOD | ≈ 60–100k visible |
| Shoreline revetment (riprap) | Bank line in `land-west` | Instanced low-poly rocks along the bank, as in v2 | ≈ 20k |
| Promenade, yard paving, grass, service road | Masses/lines from the 2022 map (ASSUME) | Flat extruded polygons with shader detail (joints, subtle noise) | small |
| Boat storage on cradles | `storage-4a/4b/6` areas | LOD1 boats on instanced cradles; seasonal-storage plausibility only | ≈ 30k |
| Service building, small building | `service-building`, `small-building` | Gable-roof massing with doors/windows as geometry insets | ≈ 2k each |
| Fences, light poles, bollards | Along the yard edge/road | Instanced | small |
| Trees (restrained) | Yard edges, roadside | Clustered foliage: 3–6 noise-displaced lobes on a trunk, two greens; not spheres or candy shapes. Instanced; impostor cards beyond ~300 m | ≈ 400 per tree, instanced |

### Zone 3 — waterfront surroundings (approximate)

| Asset | Placement | Plan | Status |
|---|---|---|---|
| Grain elevator (2022 map marker 7, “Grain Elevator Light Display”) | `grain-elevator` footprint ≈103 × 38 m | Bins (cylinder cluster) + headhouse massing in `silo-concrete`; height ASSUME | Site’s own elevator, **not** the RiverWorks painted silos |
| Skyway (NY-5) | `skyway` line | Deck + piers, low detail | Approximate |
| Peninsula industrial massing | `land-east` | Low boxes/sheds | Approximate, unlabelled |
| Canalside / north bank | `land-north` | Low-cost massing and tree belts; no landmarks placed by guesswork | Approximate (anchor check C2 unresolved) |
| Fuhrmann Blvd | `fuhrmann-blvd` | Road strip | Approximate |
| Water | Plane at y = 0 | Custom shader: depth tint between `river-water` and `midnight`; procedural ripple normals (no texture download); fresnel; environment reflection. Planar reflection only if T09 profiling allows | — |
| Sky / lighting | — | Soft daylight: one sun with a single shadow map fitted to the working view, hemisphere fill, locally generated environment. No HDRI download | — |

Not built: fuel dock, pump-out, travel lift (FIELD), depth contours (no source), Naval Park ships (no source geometry), cameras (not an established input).

## Simulated evidence images (SIM)

The 09:12 camera observation and the 09:18 staff evidence must be **visibly different kinds of evidence**. Both are rendered **from this app’s own scene**, so no stock or real photography is used and no real place-specific camera is implied.

| Asset | Look | Content rule | Output | Est. transfer |
|---|---|---|---|---|
| Camera observation, simulated source C-02, 09:12 | Wide, slightly elevated fixed view; soft focus; muted colour; burned-in overlay “C-02 · 09:12:04 · SIM” | A cabin cruiser at B-12 with the **changed canvas cover**; stern name **not legible**. Asset file name opaque (e.g. `ev-c02-0912.webp`); alt text says “simulated camera frame, name not legible” | WebP, 480×300 + 2× variant | ≈ 25–45 KB each size |
| Staff dock-check evidence, Demo dockmaster, 09:18 | Close handheld framing: stern quarter, registration panel showing only the suffix “42 AB”, name board legible; white card treatment with “Staff photo · SIM” caption | Only available after the 09:18 scenario step; never preloaded into earlier snapshots | WebP, 480×300 + 2× | ≈ 25–45 KB each |

Generation path: a capture route in the app renders the two staged views. `scripts/render-evidence.ts` drives the production preview with Playwright, screenshots the viewport, and encodes WebP through the browser canvas. The script and route are the editable source. Failure fallback (T11/T18): when an image is missing, the text evidence and actions remain.

**As built (T11/T12, 14 Nov 2026).** `node scripts/render-evidence.ts --gpu` (production preview on 4719) writes `public/assets/evidence/`. No separate capture route was needed: the script uses the `?debug` bridge to stage the scenario, hide overlays and DOM chrome, and place the camera. Re-rendering is byte-identical.

| File | Size | Notes |
|---|---|---|
| `ev-7k2q.webp` / `@2x` | 27,330 / 100,830 B (re-rendered in Batch 6: the shore behind B-12 changed) | C-02 frame at 09:12, uncertain state, so the hull has no name board; muted grade, sensor noise, vignette, burned-in “C-02 2026-07-15 09:12:00 EDT · SIMULATED” |
| `ev-p3m8.webp` / `@2x` | 8,250 / 17,144 B (re-rendered in Batch 6) | Two handheld shots on white (transom name board; bow registration “•••• 42 AB”), rendered after the identity decision, the only state in which the scene draws name boards |

A viewer downloads one density: 36 KB at 1× or 118 KB at 2×, and the staff photo only after 09:18. The 2× camera frame is above the 25–45 KB estimate because the sensor noise compresses poorly; the total is inside the 100–180 KB line. Name boards are painted at runtime into a canvas with the local General Sans / Plex faces (no texture download).

## Data assets

| Asset | Source | Runtime output | Est. transfer (gzip) |
|---|---|---|---|
| Local site geometry | `data/derived/site-local.json` (153 KB raw, generated) | Trimmed runtime subset: slips, headwalks, masks, masses; 2-decimal metres | ≈ 25–40 KB |
| SIM fixtures (48 vessels, agreements, documents, observations, scenario) | Generated deterministically in T05 | `src/data/fixtures/*.json` | ≈ 10–15 KB |
| Source / evidence manifests | T05 | JSON | ≈ 2 KB |

## Transfer estimate (full demo, compressed)

| Item | Estimate |
|---|---|
| Shell JS (React, app, panels) | ≈ 90 KB (measured T04 shell: 70 KB gzip) |
| Scene JS (three, R3F, Drei, generators) | ≈ 290 KB (measured T04 scene chunk: 247 KB gzip) |
| CSS | ≈ 8 KB |
| Fonts (5 files) | 170 KB |
| Data | ≈ 50 KB |
| Evidence images (2 × 1×, 2× deferred) | ≈ 100–180 KB |
| Icons/logo | ≈ 4 KB |
| **Total** | **≈ 0.7–0.8 MB**, against a 6 MB budget |

The headroom is deliberate. If a hand-modelled hero GLB becomes necessary, it can cost 0.5–1.5 MB (meshopt-compressed, decoder self-hosted) and still leave margin. Source maps are emitted for debugging; browsers do not download them unless devtools are open, and they are excluded from transfer totals.

## Performance plan (to verify, not claimed)

- Draw calls: instancing per family×LOD, merged static docks per dock, shared materials. Aim < 300 in the normal view.
- Triangles: hero ≤ 40k; whole scene planned ≈ 300–500k visible at overview.
- DPR capped at 1.75 (T04 default), adaptive down to 1.25 when frame time exceeds budget.
- One shadow-casting light; shadow map fitted to the active view; no shadows from distant geometry.
- Water and ambient motion freeze under reduced motion and the pause-motion control.

## Risks and fallbacks

| Risk | Signal | Fallback |
|---|---|---|
| Procedural cruiser reads as a toy beside v2 | Gate A side-by-side capture at 1440×900 | Hand-model the hero hull in Blender (to be installed; free) with a `.blend` source and a reproducible GLB export script; keep the procedural LOD1/LOD2 |
| Water looks flat without reflections | Side-by-side capture | Low-resolution planar reflector in focus views only, measured |
| Shadows/AO cost too high | Frame-time profile (T16) | Baked contact-shadow decals under boats and docks; drop SSAO |
| Evidence render reveals identity early | Review of the 09:12 frame and its metadata | Re-stage the camera angle/cover; opaque names; test asserts no “Lake Effect” string in pre-resolution DOM/asset names |

## Rights and credits

| Item | Rights |
|---|---|
| All 3D generators, shaders, evidence renders | Authored in this repo |
| General Sans, Switzer | Fontshare free licence (ITF); user decision recorded in DESIGN §15; not reopened |
| IBM Plex Mono | SIL OFL 1.1, licence text shipped with the files |
| OSM-derived geometry | © OpenStreetMap contributors, ODbL. Attribution visible in every view |
| 2022 ESD site map | Used only to digitize approximate placements; not reproduced in the app |
| Concept renders v1/v2, reference video | Authoring references only; never bundled |

## T14–T16 manifest: full layout and surroundings (as built, 14 Nov 2026)

Everything below is authored in this repo (no external model, texture or service) and is generated in the browser by the same parametric code the scripts run in Node. Nothing new is downloaded: the surroundings cost code only.

**Editable sources → runtime**

| What | Editable source | Runtime form | Measured |
|---|---|---|---|
| Dock layout A–E (decks, fingers, piles, pedestals, cleats, gangways) | `src/scene/marina.ts` (pure layout) + `src/scene/assets/dock.ts` (geometry) | One merged structure mesh per dock (5), one instanced mesh for all 154 piles, one gangway mesh per floating dock (3) | 133 fingers; fixed docks A and E use a concrete quay apron (`quay`) with floating fingers |
| Berth pick/tint mesh | `src/scene/Marina.tsx` | ONE mesh for all 126 berths, two triangles each in `SITE.slips` order; a dashed outline mesh for berths whose presence is unknown | 252 triangles |
| Boats in berths | unchanged T09 generators | One mesh per drawn hull (40 at 09:12), LOD by camera distance; contact shadows are one instanced mesh | LOD 0/1/2 as in the T09 manifest |
| Grain elevator, service shed, office | `src/scene/assets/buildings.ts` (`addElevator`, `addShed`) | Merged into one `yard-buildings` mesh | 778 / 36 / 42 triangles |
| Skyway viaduct | `addViaduct` | One mesh; deck, parapets, piers every 58 m (ASSUME) | ≈ 340 triangles at 812 m |
| Stored boats on stands (scenery) | `storedBoats()` in `src/scene/surroundings.ts` + `addBoatStand` | ONE mesh for all 24 boats and stands, rebuilt at LOD 1 or LOD 2 as a group (300 m) | 24 boats: 11 sail, 8 cruiser, 5 console |
| Ground: hard-standing, parking, roads, verge, bank walk | `groundPaint()` in `src/scene/Shore.tsx` | ONE flat mesh painted in layers without depth writes | — |
| Revetment rock | `revetmentChunks()` | 14 bank chunks, each an instanced mesh: every stone within 190 m of the camera (7,259 in all), a quarter as many larger stones beyond | 30 triangles a stone |
| Trees, lamp posts | `trees()`, `lampPosts()` | One instanced mesh each | 81 trees (732 triangles), 37 lamps |

**Regeneration**

```
npm run assets        # data/derived/asset-report.json (now includes a `surroundings` section)
npm run assets:check  # part of `npm run check`: fails if the report differs from the generators
npm run assets:glb    # inspection copies in design/assets-export/ (adds surroundings.glb); not shipped
node scripts/render-evidence.ts --gpu   # evidence stills; needs the production preview on 4719
```

**Scenery is not data.** Stored boats, buildings and the viaduct have no IDs, no labels and no pick targets (`raycast` disabled; browser test “scenery is not selectable”). They are not in the 126 / 48 counters. The footer says “boats ashore and buildings are scenery, not records”.

**Colours added** (`src/scene/palette.ts`, scene materials, not UI tokens): `gravel`, `dryGrass`, `wharf`. The elevator uses `#a59d8f`, the `silo-concrete` token lightened to sunlit weathered concrete; the token itself is unchanged.

**Planned in the tables above but not built:** fences, bollards, tree impostor cards, peninsula sheds, north-bank massing and tree belts (no sourced positions; left as plain approximate ground), `MeshPhysicalMaterial` clearcoat, planar reflections, texture atlases or compressed textures (there are no downloaded textures to compress).

**Runtime download, measured** (`npm run transfer`, production build, 2× display, full scenario): 12 files, **709 KB gzip / 635 KB brotli**, 1,946 KB uncompressed, against the 6 MB budget. Fonts: 5 files, **170,448 B** against 200 KB. Whole `dist/` without source maps: 18 files, 750 KB gzip, 1,996 KB on disk. The reference video, concept renders, GLB inspection copies and the 2022 map are not in `dist/`.

## T33 manifest: environment realism pass (as built, 16 Nov 2026)

Target: [visual-target-v3.png](visual-target-v3.png), a frame of the app approved by Raj (surroundings about 8/10, boats and docks about 7/10). Still nothing downloaded: every texture below is generated in the browser from seeded noise, and every model is a generator in this repo.

| What | Editable source | Runtime form | Measured |
|---|---|---|---|
| Detail noise and ripple textures | `src/scene/detail.ts` | Two 256² tiling textures made at start-up (4-channel value noise; ripple slopes from 46 whole-number sine waves) | 0 B transferred; 2 textures |
| Sky | `src/scene/Sky.tsx`, `SKY_GLSL` / `CLOUD_GLSL` in `materials.ts`, keys in `daylight.ts` | One dome; the same formula the materials and the water reflect. Horizon, overhead, glow, cloud and night values keyed by the hour | 1 draw call |
| Water | `src/scene/Water.tsx` | One plane: ripple normals at four scales, a baked site mask (bank nearness, dock contact, shelter) drawn on a 2D canvas from the land and dock polygons, sky and cloud by fresnel, planar reflection | Mask 2048 px long side (1024 lite) |
| Planar reflection | `WaterReflection` in `Water.tsx` | The mirrored scene at half resolution in one half-float target; re-rendered only when the camera or a shadow caster moved | Dock B 90 draw calls on a moving frame (53 at rest), Overview 284 (149) |
| Ambient occlusion | `src/scene/PostAO.tsx` | Scene → 4× multisampled half-float target with depth; 12-tap occlusion at half resolution; depth-aware blur; composite; outlines drawn on top from their own layer | +3 draw calls |
| Ground detail | `src/scene/ground.ts` | One program for land and ground paint; kind per vertex (lawn, meadow, gravel, asphalt, paving, concrete) | — |
| Surface kinds | third component of `surf` (`mesh.ts`, `finishes.ts`, `materials.ts`) | plain / mineral / foliage / lamp / window in the one shared material | — |
| Grain elevator | `addElevator` | Lift bands, plinth, windowed gallery with monitors, pilasters, parapet, roof plant, outside stair, conveyor bridge, receiving-shed doors | 5,302 triangles (was 778) |
| Sheds | `addShed` | Standing seams, plinth, gutters, downpipes, ridge vents, door slats | 736 / 492 (were 36 / 42) |
| Skyway | `addViaduct` | Slab on six girders, parapets, median, lane lines, light poles, two-column bents | 810 triangles per 232 m (was 136) |
| Trees | `src/scene/assets/foliage.ts`, `Trees` in `Shore.tsx` | Three forms, each with a detailed and a distant model; 81 trees in 130 m groups that swap at 230 m; per-instance tint | 5,238 / 5,662 / 3,754 near; 436 / 472 / 328 far |
| Shrubs, scrub trees | `shrubs()`, `scrubTrees()` in `surroundings.ts` | One instanced mesh each | 24 shrubs (320); 395 scrub trees (292) |
| Parked cars | `parkedCars()`, `buildCar` | One instanced mesh, tinted per car | 152 cars (270) |
| Mooring lines | `src/scene/mooring.ts`, `MooringLines` in `Marina.tsx` | ONE merged mesh for every settled, confirmed hull; rebuilt when the set of moored boats changes | up to 4 lines a boat |
| Ground contacts, lamp pools | `Shore.tsx`, `groundContactMaterial` / `lampPoolMaterial` | One instanced mesh each; lamp pools drawn only at night | 2 draw calls |
| Paving joints | `groundPaint()` | Extra strips in the ground-paint mesh | — |

**Two tiers.** A capable GPU (`gpuCapable()`, `webgl.ts`) gets everything above with a 4096² shadow map. Software and low-power renderers get the lite tier: no reflection or occlusion pass, no noise lookups or leaf cut-outs in the shaders (`HARBOR_LITE`), distant tree models everywhere, every second scrub tree and car, a 2048² shadow map and a 1024 px site mask. Geometry, placement, records, colours and shadows are the same in both. The browser journeys run the lite tier (headless software rendering).

**Scenery is still not data.** Cars, shrubs, scrub trees and mooring lines have no IDs, labels or pick targets, and none is counted. Mooring lines are drawn only for hulls whose presence is confirmed.

**Regeneration**

```
node scripts/capture-v3.ts --out qa/batch12 --prefix v3     # the T33 frame set, real GPU; needs the dev server on 5173
node scripts/compare-v3.ts --out … "Label=path.png" …        # comparison sheets
node scripts/render-poster.ts --gpu                          # poster, after any change to the scene's look
node scripts/render-evidence.ts --gpu                        # evidence stills, likewise (both need the preview on 4719)
```

**Colours added** (`palette.ts`): `skyBounce`, `pavingJoint`. The elevator finish is now `#b3aea3`. New finishes: `leafLight`, `shrub`, `window`, `rust`, `steel`, `roofTar`, `roadLine`, `carGlass`, `tyre`.

**Still not built:** a downtown skyline and other north-bank massing (no sourced positions), a marine tower on the elevator (not sourced), fenders, fences, bollards, tree impostor cards, baked lightmaps (the occlusion pass and ground contacts cover the same need without a bake step).

## T20 source and shipped-asset review (14 November 2026)

The About / Sources panel reads the existing source manifest (`fixtures.sources`) and explains DOC / ASSUME / SIM / FIELD, the independent concept, assumed capacity/numbering, approximate geometry, fictional history/evidence and prerequisites for a real pilot. External references open a new tab. OSM attribution remains outside the panel, including a fixed credit below the mobile sheet scroller.

Runtime asset inventory was reviewed against `public/`, imports and production source maps. No third-party models, photographs, HDRIs, tiles or Google meshes are shipped. The five font binaries and IBM OFL are unchanged. The supplied General Sans / Switzer approval in DESIGN §15 remains the decision; the download-site desktop-zip note is retained there, and no new font-source or licensing approval is asserted. Official reference: https://www.fontshare.com/licenses/itf-ffl (JavaScript-only page; automated text retrieval did not expose the full current terms).

`public/THIRD-PARTY-NOTICES.txt` now carries asset source/right/credit information and full installed license notices for the **14 packages actually represented in the production source maps**, including React's license for Fiber's bundled reconciler. Fiber's npm package omitted its license file; the upstream MIT notice was retrieved from https://raw.githubusercontent.com/pmndrs/react-three-fiber/master/LICENSE and preserved in `design/licenses/react-three-fiber-MIT.txt`. `node scripts/build-notices.ts` regenerates the notices from an existing production build; build again to copy the result to `dist/`. It fails if a bundled package lacks a notice. This is a source review, not a new legal determination.

OSM credit and ODbL links: https://www.openstreetmap.org/copyright and https://opendatacommons.org/licenses/odbl/1-0/. The historical ESD map remains outside the runtime bundle. Its 2022-06-01 date was rechecked against the official PDF; services and current operating policy remain unverified. The source manifest correctly leaves the Scope of Services publication date unknown.

Final measured budgets, the exact build hash, runtime request inventory and authoring-file exclusion results are in `QA.md` and `qa/batch8/startup-transfer.json`. The source maps are intentional diagnostics, reported separately from runtime transfer; they are not silently counted as downloaded assets.
