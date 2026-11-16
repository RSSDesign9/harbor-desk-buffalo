# Design System and Brand Guide

Harbor Desk, a fictional 3D vessel registry and marina-operations tool set on the Buffalo River. Written 14 Nov 2026 for people and coding agents.

How to read this document:

- **APPROVED** marks a decision Raj made in conversation. Build to it.
- **RECOMMENDED** marks a proposal from the design lead. Build to it unless Raj overrides, and keep it easy to swap.
- **MEASURED** marks a value scraped from a live source (Saildrone CSS on 14 Nov 2026, Rivian CSS on 14 Nov 2026, the reference video). Cite the source if you change it.
- **MISSING** marks information nobody has yet. Do not invent it. Use the placeholder named, and label the result as simulated.

Related files: [PRODUCT.md](PRODUCT.md) for product scope, [REFERENCES.md](REFERENCES.md) for bookmarked sources, [design/vessel-card.html](design/vessel-card.html) for the complete worked component, [design/tokens.json](design/tokens.json) and [design/tokens.css](design/tokens.css) for machine-readable variables.

---

## 0. Decision log

| Decision | Status | Source |
|---|---|---|
| Token sources are Saildrone and Rivian | APPROVED | Raj, 14 Nov 2026 |
| Typography is Commissioner (primary), Work Sans (secondary) and Atkinson Hyperlegible Mono (machine text). Replaces the Saildrone families (General Sans, Switzer, IBM Plex Mono, LED Dot Matrix). | APPROVED | Raj, 15 Nov 2026 (Section 3) |
| Oxford Pennant type is dropped | APPROVED | Raj, 14 Nov 2026 |
| Buffalo enters through NOAA chart colors (nav states), grain-elevator palette (structure), Buffalo Waterfront vocabulary (reference only) | APPROVED in principle | Raj accepted the "three overrides" approach, 14 Nov 2026 |
| Dark viewport by default, light "chart mode" for plan view and print | RECOMMENDED | Design lead |
| Browser-based build (Three.js or React Three Fiber) | RECOMMENDED | PRODUCT.md lists platform as open |
| Product name is **Harbor Desk** (fictional) | APPROVED | Raj, 14 Nov 2026 |
| Buttons set in the body face (now Work Sans), not mono | APPROVED | Raj, 14 Nov 2026; face updated 15 Nov 2026 |
| Logo is direction G: Buffalo Main Light with orange lantern and a single beam wedge, Saildrone construction. F (tower only) is the small-size reduction. | APPROVED | Raj, 14 Nov 2026; files `design/logo-harbor-desk.svg`, `design/logo-harbor-desk-small.svg` |
| All three families self-hosted from `design/fonts` as variable WOFF2 built from google/fonts (OFL) | APPROVED | 15 Nov 2026; supersedes the 14 Nov Switzer/General Sans files |
| Slip layout: 126 slips, docks A–E, generated on OSM headwalks | ASSUME (documented in `data/SLIPS.md`) | Raj asked for a plausible scheme, 14 Nov 2026; no public slip map exists |
| Real vessel roster, operator workflows | MISSING | PRODUCT.md: no records, no access |
| Buffalo override hex values (silo concrete, Labatt blue, winter sky, snow, ice) | MEASURED 14 Nov 2026 | Commons photos for the silos; Raj's winter aerial for sky, snow, ice and water |
| NOAA chart exact hex values | MISSING, approximations given | Sample from NOAA RNC tiles for chart 14833 |
| Drag-to-assign with fit verdicts (fits / tight / no fit, colour + pattern + reason) and a read-only day timeline that is guided replay made continuous | BUILT (T30, T31) | TASKS T30/T31, PRD F20/F21, 16 Nov 2026; Section 9 “Assigning a transient” |
| 3D dock map replaces the Top-down preset: 2° long lens (orthographic in effect), status plates with a pattern per status, slip numbers when zoomed in, legend in the camera panel; small screens open on it when the GPU is capable | BUILT (T29) | TASKS T29, PRD F19, 16 Nov 2026; Section 9 “Dock map” |

---

## 1. Core principles

### Rule 1. The water is the product. Chrome floats on it.

The 3D viewport is the canvas and never sits inside a card. Every panel, list, and control is a floating layer over the scene with a translucent surface, and the scene stays visible behind it. The reference video (WareTrack, 72 s, 1874×1080) does exactly this: a full-bleed isometric scene with three KPI tiles top-left, an inspector top-right, a tabbed asset list bottom-right, and a tracking strip bottom-left. We keep that skeleton and change the materials.

Guidance across surfaces:

- Desktop: viewport full-bleed, four floating zones, nothing docked to a hard edge.
- Mobile: viewport fills the top of the screen, panels become one bottom sheet.
- Print: the viewport becomes a plan-view chart. Panels become tables.

### Rule 2. Every number says where it came from.

PRODUCT.md requires simulated records and observations to be clearly identified. Treat provenance as a first-class token, not a footnote. Every data cell carries one of four provenance tags: `DOC` (documented fact), `ASSUME` (assumption), `SIM` (simulated), `FIELD` (needs field validation). The tag is set in Atkinson Hyperlegible Mono, uppercase, 11 px. A hiring manager should be able to tell within two seconds that the roster is invented and that the harbor geometry is real. Honesty reads as rigor.

Guidance across surfaces:

- Inspector panel: provenance tag sits right-aligned on each row.
- Lists: a single provenance summary in the list header ("ROSTER: SIM · GEOMETRY: DOC").
- Print: provenance column is mandatory.
- 3D labels: simulated vessels get a hairline dashed outline in the viewport, documented structures get solid.

### Rule 3. Buffalo is a palette, not a logo.

The hometown shows up in color and vocabulary, never in sports colors, pennants, mascots, or wordplay. Three overrides carry Buffalo: NOAA chart cyan and magenta for navigation states, grain-elevator concrete and rust for built structures, and Buffalo Waterfront place names (Canalside, Outer Harbor, Buffalo River, Ohio Street) in copy. If a screen could be any marina in Florida by swapping the title, it has failed this rule.

Guidance across surfaces:

- Scene: the real Buffalo River bend from chart 14833 is the geometry. The grain elevators are in the background of every wide shot.
- UI: place names appear in breadcrumbs and site selectors.
- Marketing/portfolio case study: lead with the Buffalo River, not with the UI.

---

## 2. Color palette

### 2.1 Base colors

Saildrone values are MEASURED from `saildrone---2026.webflow…css`. Rivian values are MEASURED from the `_next/static/css` bundles. Buffalo values are placeholders unless marked.

| Token | Value | Source | Status |
|---|---|---|---|
| `midnight` | `#011b2b` | Saildrone `--base-color-brand--midnight-blue` | MEASURED |
| `ink-700` | `#233747` | Saildrone dark-grey | MEASURED |
| `ink-500` | `#3f5464` | Saildrone grey | MEASURED |
| `ink-300` | `#748491` | Saildrone mid-grey | MEASURED |
| `mist-200` | `#d5dfe3` | Saildrone light-grey | MEASURED |
| `mist-100` | `#eaf1f4` | Saildrone lightest-grey | MEASURED |
| `signal` | `#ff4d00` | Saildrone orange | MEASURED |
| `signal-light` | `#ff5d17` | Saildrone orange-light | MEASURED |
| `signal-dark` | `#c53c00` | Saildrone orange-dark | MEASURED |
| `focus` | `#2d62ff` | Saildrone focus-state | MEASURED |
| `sand` | `#e6e5df` | Rivian (hero gradient stop) | MEASURED |
| `sand-dark` | `#bbb9ad` | Rivian (hero gradient stop) | MEASURED |
| `forest` | `#465243` | Rivian | MEASURED, usage context not recovered |
| `rust` | `#a15842` | Rivian | MEASURED, usage context not recovered |
| `slate` | `#73859f` | Rivian (player chrome) | MEASURED |
| `harbor-night` | `#2b333f` | Rivian | MEASURED |
| `chart-water` | `#9ecefc` | NOAA ENC shallow-water area, Buffalo Harbor render | MEASURED 14 Nov 2026 |
| `chart-shoal` | `#82bdff` | NOAA ENC very-shallow / dredged area | MEASURED |
| `chart-land` | `#b09e56` | NOAA ENC land area | MEASURED |
| `chart-built` | `#cec58a` | NOAA ENC pier, wharf, built land | MEASURED |
| `chart-magenta` | `#c842c6` | NOAA ENC magenta aids and labels | MEASURED |
| `chart-green` | `#77e137` | NOAA ENC green lateral mark | MEASURED |
| `chart-cyan` | `#7fd1e8` | Derived for dark mode from chart water | RECOMMENDED |
| `chart-magenta-dark-mode` | `#ff3d9a` | Derived for dark backgrounds | RECOMMENDED |
| `silo-blue` | `#284878` | Labatt-painted silos at RiverWorks (Commons CC0 photo, dominant) | MEASURED |
| `silo-concrete` | `#7b7265` | RiverWorks elevator tower (same photo, median) | MEASURED |
| `lake-sky` | `#91a8c3` | Sky over RiverWorks, summer, part cloud (same photo, median) | MEASURED |
| `river-water` | `#4e6d98` | Buffalo River at Concrete Central, sunlit (Commons CC BY 4.0, median) | MEASURED |
| `limestone` | `#e7ebed` | Buffalo Main Light tower, painted (Commons CC BY-SA 2.5, median) | MEASURED |
| `winter-sky` | `#c9d0d7` | Overcast sky, Raj's winter aerial of the Erie Basin observation tower (median) | MEASURED 14 Nov 2026 |
| `snow` | `#d2d9e0` | Snow field, same photo (median) | MEASURED |
| `ice-floe` | `#adb5bd` | Lake ice floes, same photo (median) | MEASURED |
| `winter-water` | `#585858` | Open water between floes, same photo (dominant) | MEASURED |
| `winter-concrete` | `#65615b` | Observation tower, same photo (median) | MEASURED |
| `snow-canvas` | `#f2f5f8` | Snow hue lifted to a UI canvas tint | DERIVED: measured snow gives only 3.67 for `signal-dark` text, so it cannot be the canvas |

The winter photo was supplied by Raj; only colors are taken from it and the image itself is not in the repo. The winter scene is the second palette of the product: the dark theme is the open-water season, the measured snow, ice and overcast values drive the frozen-basin state of the 3D scene, and `snow-canvas` is the light UI ground.

Note on the chart source: NOAA sunset its raster charts, so chart 14833 as a paper-style image no longer exists. The chart values above were sampled from NOAA's own ENC Online render of Buffalo Harbor (the vector chart drawn with the S-52 day palette). Photo colors are sampled from openly licensed Wikimedia Commons photographs; only the colors are used, no image is reused. Photo-derived values depend on the light in that photo and are a starting point, not a standard.

### 2.2 Semantic roles, dark theme (default, RECOMMENDED)

| Role | Token | Value | Contrast on `bg-canvas` |
|---|---|---|---|
| `bg-canvas` (3D sky/water backdrop) | `midnight` | `#011b2b` | — |
| `bg-panel` (floating glass) | `midnight` at 72% + 16 px blur | `rgba(1,27,43,0.72)` | — |
| `bg-panel-solid` | `ink-700` | `#233747` | — |
| `bg-row-hover` | white 6% | `rgba(255,255,255,0.06)` | — |
| `text-primary` | white | `#ffffff` | 17.6 |
| `text-secondary` | `mist-200` | `#d5dfe3` | 13.0 |
| `text-muted` | `ink-300` | `#748491` | 4.57 (AA for ≥14 px, not for 11 px labels) |
| `text-accent` | `signal` | `#ff4d00` | 5.29 |
| `border-hairline` | white 12% | `rgba(255,255,255,0.12)` | — |
| `border-strong` | `ink-300` | `#748491` | — |
| `focus-ring` | `focus` | `#2d62ff`, 2 px outside | 3.61 (passes 3:1 non-text) |
| `state-docked` | `#cef5ca` text / `#4a8231` fill | Saildrone success / Rivian success | 14.7 text |
| `state-underway` | `chart-cyan` | `#7fd1e8` | 10.2 |
| `state-arriving` | `signal` | `#ff4d00` | 5.29 |
| `state-overdue` | `#ffb3ab` text / `#dc3127` fill | derived / Rivian error | fill 3.78, text use only |
| `state-maintenance` | `#ffac00` | Rivian warning accent | 9.35 |
| `state-winterized` | `sand-dark` | `#bbb9ad` | 9.0 |
| `nav-aid` | `chart-magenta-dark-mode` | `#ff3d9a` | 5.35 |
| `structure` | `silo-concrete` | `#8f8b84` | 3D material only |

### 2.3 Semantic roles, light "chart mode" (plan view, print, RECOMMENDED)

| Role | Value | Contrast on `bg-canvas` |
|---|---|---|
| `bg-canvas` | `snow-canvas` `#f2f5f8` | — (ink-700 11.2, ink-500 7.2, light muted 4.9, `signal-dark` 4.8) |
| `bg-water` | `chart-water` `#9ecefc` | — |
| `bg-shoal` | `chart-shoal` `#82bdff` | — |
| `bg-land` | `chart-built` `#cec58a` (piers, wharves) | — |
| `bg-land-deep` | `chart-land` `#b09e56` (land beyond the waterfront) | — |
| `bg-panel` | white 80% + blur | — |
| `text-primary` | `ink-700` `#233747` | 11.1 |
| `text-secondary` | `ink-500` `#3f5464` | 7.1 |
| `text-muted` | `#5d6c7b` (Saildrone measured grey) | 4.8. `ink-300` measures 3.47 here and is not used on light. |
| `text-accent` | `signal-dark` `#c53c00` | 4.71 (never `#ff4d00` on light, that is 3.0) |
| `state-docked` | `#114e0b` | 8.9 |
| `state-underway` | `#0a6e8a` | 5.24 |
| `state-overdue` | `#dc3127` | 4.2, pair with icon |
| `nav-aid` | `chart-magenta` `#d7007a` | 4.54 |
| `focus-ring` | `#2d62ff` | — |

### 2.4 Rules

- One accent. `signal` orange is the only warm accent in the UI. It marks the selected object, the primary action, and arriving vessels. Nothing else is orange.
- Status colors are never used decoratively. Green means docked, not "good".
- `rust` and `forest` are 3D material colors for hulls, pilings, and foliage. They do not appear in UI chrome.
- Orange on light backgrounds always uses `signal-dark`. Bright orange measures 3.0 on `snow-canvas` and fails AA text.
- The measured winter values (`winter-sky`, `snow`, `ice-floe`) are scene and illustration colors, not UI grounds: ink passes on them, but every accent fails AA text there.
- On the measured chart tints (`chart-water` and `chart-built`), only `ink-700` and `ink-500` are text colors (7.4 and 4.8 on water). `signal-dark` measures 3.2 and `chart-magenta` 2.5 there, so on the chart they are graphic colors for marks, routes and beams, never for words. Labels over the chart sit on a white 80% panel or carry a 2 px `winter-sky` text halo.

---

## 3. Typography

APPROVED 15 Nov 2026 (Raj): **Commissioner** primary, **Work Sans** secondary, **Atkinson Hyperlegible Mono** for machine text. This replaces the Saildrone system (General Sans, Switzer, IBM Plex Mono, LED Dot Matrix), which Raj retired because it read as generic and too dense. The explorations are in [design/type-options.html](design/type-options.html), [design/type-options-2.html](design/type-options-2.html) and [design/mono-pairings.html](design/mono-pairings.html). Constraint: no family from shadcn's font registry (`apps/v4/lib/font-definitions.ts`, 26 families, checked 15 Nov 2026).

Why these three. Boats carry engraved metal: hull ID plates, builder's plates, the name board on the transom. Commissioner's flare axis (FLAR) gives headings and vessel names those flared, chiselled endings, and turns off for small labels, so personality is one dial tied to size. Work Sans does the quiet operating work. Atkinson Hyperlegible Mono was drawn by the Braille Institute so that `0/O`, `1/l/I` and `B/8` cannot be confused, which matters for the product's core job: checking a hull number against a record, often on a tablet in sunlight. Its x-height matches Commissioner's and Work Sans's to within 1% (measured 15 Nov 2026), so no family needs optical resizing.

| Role | Family | Axes shipped | Fallback stack | License |
|---|---|---|---|---|
| Headings, vessel names, labels, counts | Commissioner (Kostas Bartsokas) | wght 400–800, FLAR 0–100. VOLM and slnt pinned to 0. | `"Commissioner", "Work Sans", Arial, sans-serif` | SIL OFL 1.1, no Reserved Font Name |
| Body, UI, buttons | Work Sans (Wei Huang) | wght 400–600 | `"Work Sans", "Helvetica Neue", Arial, sans-serif` | SIL OFL 1.1, no Reserved Font Name |
| IDs, times, data, provenance tags, status pills | Atkinson Hyperlegible Mono (Braille Institute) | wght 400–600 | `"Atkinson Hyperlegible Mono", "SF Mono", Menlo, monospace` | SIL OFL 1.1, no Reserved Font Name |

Files: one variable WOFF2 per family, from `github.com/google/fonts`, instanced with fontTools and subset to Latin plus the punctuation, arrows and math signs the app uses. Total 96,212 bytes (budget 200 KB; the old five faces were 170,448). Licences ship beside the files in `design/fonts` and `public/fonts`. The retired General Sans, Switzer and Plex files stay in `design/fonts` for older design artefacts only; the app no longer loads them.

### 3.1 Flare

| Token | FLAR | Use |
|---|---|---|
| `--flare-display` | 100 | Headings h1–h6, `object-name`, `panel-title`, vessel names |
| `--flare-count` | 60 | KPI counts (`data-lg`) and summary values, so numerals stay plain |
| `--flare-ui` | 0 | Labels, the wordmark, anything under 16 px |

Apply with `font-variation-settings: "FLAR" var(--flare-…)`. Commissioner's default instance is FLAR 0, so anything that doesn't opt in is unflared. Canvas text (3D name boards) can't set axes and always paints FLAR 0.

### 3.2 Scale

Fluid `clamp()` sizes between a 20 rem and 90 rem viewport, generated from `design/tokens.json` (`npm run tokens`). The fixed values below are the clamp endpoints, for design tools. Compared with the 14 Nov scale, `body-sm` goes from 14 to 15 px, `label` from 12 to 12.5 px, `h6` from 16 to 17 px and `data-lg` from 28–36 to 30–40 px. The rest of the density relief comes from moving section labels out of mono. They take about the same width (measured within ±10% on the inspector labels), but read as words rather than codes, which leaves mono to mean "machine record".

| Token | Mobile | Desktop | Family | Weight | FLAR | Line height | Tracking | Use |
|---|---|---|---|---|---|---|---|---|
| `h1` | 40 px | 72 px | Commissioner | 600 | 100 | 1.05 | -0.025em | Case-study hero, page title (rare in-app) |
| `h2` | 32 px | 48 px | Commissioner | 600 | 100 | 1.15 | -0.015em | Section; inspector slip title |
| `h3` | 28 px | 40 px | Commissioner | 600 | 100 | 1.15 | -0.015em | Large panel title |
| `h4` | 24 px | 32 px | Commissioner | 600 | 100 | 1.25 | -0.015em | Inspector object name (`object-name`) |
| `h5` | 20 px | 24 px | Commissioner | 600 | 100 | 1.15 | -0.015em | Vessel name link, card title |
| `h6` | 17 px | 20 px | Commissioner | 600 | 100 | 1.15 | -0.015em | `panel-title`, summary values (FLAR 60) |
| `body-lg` | 18 px | 20 px | Work Sans | 400 | – | 1.5 | 0 | Case-study prose |
| `body` | 16 px | 16 px | Work Sans | 400 | – | 1.5 | 0 | Default |
| `body-sm` | 15 px | 15 px | Work Sans | 400 | – | 1.4 | 0 | Facts, table cells, secondary text |
| `button` | 15 px | 15 px | Work Sans | 600 | – | 1 | 0 | All buttons, sentence case |
| `control` | 14 px | 14 px | Work Sans | 600 | – | 1 | 0 | Compact controls in floating bars only: camera view segments, motion toggle, scenario-panel head actions. Keeps the camera bar inside its 480 px budget and the scenario head on one line |
| `label` | 12.5 px | 12.5 px | Commissioner | 600 | 0 | 1.2 | +0.07em | Uppercase section labels and eyebrows |
| `label-sm` | 11 px | 11 px | Atkinson Hyperlegible Mono | 500 | – | 1.2 | +0.04em | Provenance tags (SIM, ASSUME, DOC, FIELD), status pills |
| `data` | 14 px | 14 px | Atkinson Hyperlegible Mono | 400 | – | 1.4 | 0 | IDs, times, measurements, the sim clock |
| `data-lg` | 30 px | 40 px | Commissioner | 600 | 60 | 1 | -0.025em | KPI counts |
| wordmark | 15 px | 15 px | Commissioner | 700 | 0 | 1 | +0.1em | "HARBOR DESK", uppercase |

Weights in use: Commissioner 600 and 700, Work Sans 400, 500 and 600, mono 400 and 500. `accent-num` and LED Dot Matrix are removed.

### 3.3 Rules

- Uppercase belongs to two places only: Commissioner `label` (flare 0, +0.07em) and the mono tags and pills. Work Sans is never uppercased; Commissioner headings and names are never uppercased.
- Machine text is mono, human text is not. Slip IDs, hull registrations, camera IDs, timestamps and provenance codes are Atkinson Hyperlegible Mono. Vessel names are Commissioner at full flare, never mono.
- Anything that ticks (the sim clock, timers) is mono, because Commissioner has no tabular figures and would jitter. Counts that change in discrete steps (the KPI tiles) may be Commissioner `data-lg`.
- Flare only at 16 px and up, and only at weight 500 or more; at light weights it drifts toward stationery. Never flare buttons or controls.
- The mono has no arrow glyphs; `→` falls back to the next face in the stack. Prefer "to" in running text.
- Maximum line length in prose: 68 characters.
- Self-host only, `font-display: swap`, one variable file per family. Never load from Google Fonts at runtime.

---

## 4. Borders and shadows

### 4.1 Geometry

| Token | Value | Source | Use |
|---|---|---|---|
| `radius-0` | 0 | Saildrone measured default | Viewport, full-bleed images, print |
| `radius-xs` | 4 px | Rivian `--radius-nano` and Saildrone `.25em` at 16 px | Chips, tags, inputs |
| `radius-sm` | 8 px | Rivian measured | Buttons, list rows |
| `radius-md` | 12 px | Rivian `--radius-micro` | Panels, cards |
| `radius-lg` | 20 px | Rivian `--radius-macro` | Bottom sheet, modal |
| `radius-pill` | 999 px | Rivian measured | Status pills, segmented controls |

Rule: radius grows with panel size. A tag inside a card inside a sheet reads 4 / 12 / 20. Never nest equal radii.

### 4.2 Borders

- Panels on the dark viewport use a 1 px hairline at white 12% (`border-hairline`). That is the only border a panel gets. No double borders, no inner strokes.
- Selected objects in the viewport get a 1.5 px `signal` outline. Hovered objects get a 1 px `chart-cyan` outline at 60%.
- Simulated vessels in 3D get a dashed 1 px outline (dash 4, gap 3) in `text-muted`. Documented geometry gets a solid outline. This is Rule 2 applied to the scene.
- Inputs: 1 px `border-strong`, 2 px `focus` ring on focus with 2 px offset.
- Dividers inside panels: 1 px hairline, full width, no inset.

### 4.3 Shadows

Rivian's measured shadows are soft, large-radius, low-opacity. We use two.

| Token | Value | Purpose |
|---|---|---|
| `shadow-panel` | `0 10px 38px -10px rgba(14,18,22,0.35), 0 10px 20px -15px rgba(14,18,22,0.2)` | Floating glass panels. Adapted from Rivian's measured `0 10px 38px -10px #0e121659, 0 10px 20px -15px #0e121633`. |
| `shadow-sheet` | `0 -8px 40px rgba(1,27,43,0.5)` | Mobile bottom sheet. |

No shadows on buttons, chips, rows, or anything inside a panel. The panel floats; its contents are flat. Glass is produced by `backdrop-filter: blur(16px)` plus `bg-panel`, with a solid `bg-panel-solid` fallback when the filter is unsupported.

---

## 5. Lines, shapes, textures, and objects

### 5.1 Lines

- Hairlines (1 px, 12% white) separate. Rulers and grid lines in the viewport are 1 px at 8% white and follow the slip grid.
- Routes and wakes for underway vessels are 2 px `chart-cyan` dashed lines (dash 8, gap 6) animating at 24 px/s, paused under reduced motion.
- Depth contours in chart mode are 1 px `#0a6e8a` at 40%, mimicking chart soundings. Label depths in Atkinson Hyperlegible Mono 11 px.

### 5.2 Shapes

- Slip footprints: rectangles with `radius-0` on the plan, extruded 0.15 m on the 3D dock surface.
- Vessels: low-poly hulls at roughly 400 to 1,200 triangles each, flat shaded, no PBR glitter. The reference video uses clean low-poly with soft ambient occlusion. We keep that fidelity level; it reads as deliberate, renders on a laptop, and does not pretend to be a photo.
- Markers above objects: a 24 px rounded pill (`radius-pill`) with mono label and a 4 px stem. Same pattern as the reference video's "FL-12 Charging" tag.

### 5.3 Textures

- Water: a single flat `midnight` plane with a subtle normal-map ripple, amplitude low enough that the dock reflection stays legible. Winter mode (frozen basin): the water plane becomes matte `ice-floe` plates with `snow` on top and `winter-water` in the gaps, all measured from the winter aerial; the sky backdrop is `winter-sky`. No ripple animation in winter mode.
- Dock planking: flat `sand-dark` with 1 px darker seams every 0.15 m. No wood photo textures.
- Silos: flat `silo-concrete` cylinders with a single `silo-blue` band on the RiverWorks group. These are background objects and never selectable.
- No noise overlays, no grain, no film effects in the UI layer.

### 5.4 Objects and materials (3D)

| Object | Material | Selectable | Provenance default |
|---|---|---|---|
| Harbor water and shoreline | `midnight` / chart tints | No | DOC (chart 14833) |
| Dock fingers and slips | `sand-dark` | Yes (slip) | ASSUME (count and numbering MISSING) |
| Vessels | hull in `rust`, `forest`, `mist-100`, `slate`; deck `sand` | Yes | SIM |
| Fuel dock, pump-out, travel lift | `silo-concrete` with `signal` detail | Yes | FIELD |
| Grain elevators (background) | `silo-concrete`, one `silo-blue` band | No | DOC (exist), geometry ASSUME |
| Nav aids (buoys, lights) | `nav-aid` magenta | Hover only | DOC from chart |
| Cameras (future) | not rendered | — | Not an established input, per PRODUCT.md |

---

## 6. Illustration, imagery, and logos

### 6.1 Logo

Name APPROVED: **Harbor Desk** (fictional; no real company of that name is implied).

Logo APPROVED 14 Nov 2026: **direction G**. The Buffalo Main Light as a solid silhouette on three water bars narrowing downward, lantern in signal orange, and a single orange beam wedge reaching right toward the wordmark. Construction follows the measured Saildrone mark (solid mass, three bars, extended uppercase wordmark). Files: [design/logo-harbor-desk.svg](design/logo-harbor-desk.svg) (full mark, 56×44 viewBox) and [design/logo-harbor-desk-small.svg](design/logo-harbor-desk-small.svg) (tower only, for favicon and anything at 24 px or below). Both use `currentColor` for the silhouette so they invert on light grounds; the orange is fixed.

Usage rules:

- Wordmark: "HARBOR DESK" in Commissioner 700 (flare 0) uppercase, tracking 0.1em (Switzer 600 at 0.06em until 15 Nov 2026), set to the right of the mark with a gap of 0.3× mark height, optically centered on the tower body. Michroma was a stand-in on the Paper sheet and is not used.
- Minimum size for the full mark: 32 px tall. Below that, use the small file.
- Beam always points right. Never mirror the mark.
- No glow, no gradient, no second beam step, no third color. Four elements is the limit: tower, bars, lantern, wedge.
- On light grounds use `midnight` for the silhouette and keep `#ff4d00` for the lantern and beam; it measures 3.0 against `snow-canvas`, which is fine for a non-text graphic.

Rejected on 14 Nov 2026, kept on the Paper sheets for the record: A–E (first sheet) and F, H (second sheet). Five directions from the first round, for reference:

- A, Chart buoy: NOAA buoy diamond in chart magenta beside the wordmark.
- B, Registry plate: mono "HARBOR·DESK" inside a hull-number plate with the SIM tag built in.
- C, Grain elevator: RiverWorks silos in signal orange on a cyan waterline.
- D, Sounding monogram: "HD" cut by a depth contour, light-weight wordmark.
- E, Buoy ring: type only, the "o" is a life ring in signal orange; shown on the light sand ground.

Raj rejected A–E on 14 Nov 2026. A second sheet, "Harbor Desk — lighthouse directions (Saildrone construction)", follows the measured construction of the Saildrone logo: one solid white silhouette, three stacked water bars narrowing downward (bar geometry copied from Saildrone's mark), and an extended uppercase wordmark (Michroma in Paper as a stand-in for Saildrone's custom extended face). A dashed reference cell shows the Saildrone mark for comparison only; it is never reused.

- F, Buffalo Main Light: the 1833 octagonal tower at the river mouth beside Coast Guard Sector Buffalo. All white, no accent.
- G, Main Light with beam: same tower, lantern in signal orange, two-step beam reaching toward the wordmark.
- H, Coast Guard lookout tower: skeletal trestle tower with cabin and a single orange light.

G was chosen; the beam was reduced from two steps to a single wedge on Raj's approval before the sheet was finalized.
- Do not use the First Buffalo River Marina name, Dale's Marine Service, ECHDC, or Buffalo Waterfront marks anywhere in the UI. PRODUCT.md establishes no relationship with any of them. Place names are fine; organization names and logos are not.

### 6.2 Imagery

- The 3D scene is the imagery. No stock photography in the product.
- Case study and portfolio card: one real photograph of the Buffalo River grain elevators is RECOMMENDED as the opening frame, shot or licensed by Raj. MISSING: no photo asset yet.
- Avatars: none. Operator identities are not established, and a fake headshot (as in the reference video's "Alex Chen") would violate Rule 2. Use a mono initial chip instead.

### 6.3 Icons

- 16 px and 20 px, 1.5 px stroke, round caps, drawn on a 20 px grid. RECOMMENDED general set: Phosphor (regular) for consistency with the stroke weight; verify license.
- Vessel-type glyphs are drawn in-house (14 Nov 2026) in [design/icons-vessels.svg](design/icons-vessels.svg) as an SVG sprite: `v-sail`, `v-power`, `v-pontoon`, `v-pwc`, `v-workboat`, `v-trailer` (hauled out). Same 20 px grid and 1.5 px stroke, `currentColor`, each with a one-line waterline that echoes the logo's bars. Preview sheet: [design/icons-preview.html](design/icons-preview.html). Use with `<use href="icons-vessels.svg#v-sail">`.
- No emoji anywhere in the product.

---

## 7. Motion

Measured baselines: Saildrone uses 0.1 s, 0.2 s, 0.3 s linear-ish transitions. Rivian uses 0.15 s for most state changes and `cubic-bezier(0.4,0,0.2,1)`, with `cubic-bezier(0.83,0,0.17,1)` for large moves.

| Token | Duration | Easing | Trigger |
|---|---|---|---|
| `motion-micro` | 150 ms | `cubic-bezier(0.4,0,0.2,1)` | Hover, press, focus, toggle |
| `motion-panel` | 240 ms | `cubic-bezier(0.4,0,0.2,1)` | Panel open/close, sheet, list row expand |
| `motion-camera` | 700 ms | `cubic-bezier(0.83,0,0.17,1)` | Fly-to on select, view preset change |
| `motion-ambient` | continuous | linear | Water ripple, route dashes, berth-light pulse |

Rules:

- Selection drives the camera, never the reverse. Clicking a vessel in the list flies the camera; dragging the camera never changes selection.
- Interruption: a new fly-to cancels the running one and starts from the current pose. Never queue camera moves.
- Panels slide 8 px and fade; they do not scale.
- One ambient animation layer at a time. Water ripple and route dashes may run together; the berth-light pulse runs only on a selected or overdue slip.
- Status changes (docked → underway) animate the pill background over `motion-micro` and move the vessel over `motion-camera` duration along its route.
- `prefers-reduced-motion: reduce`: camera moves become cuts, ambient layers freeze, panel transitions become opacity-only at 100 ms. The product must be fully usable this way; test it.
- No parallax, no scroll-jacking, no entrance choreography on load. The scene fades in over 400 ms, then stays still until the user acts.

---

## 8. Component examples

States for every interactive component: default, hover, focus-visible, active, selected, disabled, loading, and (where data-bearing) simulated.

### Vessel card (inspector)
Shows one vessel: name, hull ID, slip, status pill, owner (SIM), LOA/beam/draft, last seen, provenance per row. Selected vessel in the viewport is mirrored here. Full markup in Section 12.

### Status pill
`radius-pill`, Atkinson Hyperlegible Mono 11 px uppercase, 2 px dot at left in the state color, text in state text color, 1 px border in state color at 40%. States: docked, underway, arriving, overdue, maintenance, winterized. Never used for anything other than vessel/slip state.

### Provenance tag
Atkinson Hyperlegible Mono 11 px, 1 px hairline border, `radius-xs`, `text-muted`. Values DOC, ASSUME, SIM, FIELD. SIM uses `signal-dark` border so it is the first thing you notice.

### KPI tile
Floating glass, 160×88 px desktop. Label (`label`: Commissioner 12.5 px uppercase), value (`data-lg`: Commissioner at flare 60), delta (`body-sm` in state color). Matches the reference video's top-left tiles. Max three per screen.

### Asset list
Tabbed (Slips / Vessels / Services), rows 44 px, mono ID left, name, status pill, chevron. Row hover `bg-row-hover`, selected row has a 2 px `signal` left bar. Supports keyboard row navigation.

### Scene marker
Pill above a 3D object, mono label, stem. Appears on hover, persists on selection, hides when the camera is further than 120 m (RECOMMENDED threshold).

### Buttons
Primary: `signal` fill, `midnight` text (ratio 5.29), Work Sans 15 px 600 sentence case (APPROVED 14 Nov 2026 as the body face; Saildrone's own buttons are uppercase mono, we depart from that so buttons read as actions, not labels), 40 px high, `radius-sm`, padding 12/20 (adapted from Saildrone's measured `.75rem 1.5rem`). Secondary: transparent, 1 px `border-strong`, white text. Ghost: text only. Disabled: 40% opacity, no hover. Loading: label swaps to a 16 px spinner, width locked.

### Segmented control (view presets)
Overview / Docks / Fuel / Plan. `radius-pill` container, active segment `bg-panel-solid`. Keyboard arrows move selection.

### Bottom sheet (mobile)
`radius-lg` top corners, grabber 36×4 px, three snap points: 96 px, 50%, 92%.

### Empty state
Label "NO VESSELS IN VIEW", one line of Work Sans body, one secondary button. No illustration.

---

## 9. Layout patterns

### Desktop (≥1280 px)

Full-bleed viewport. Four floating zones with 24 px edge inset (Saildrone's measured global padding runs 24 to 64 px; we fix 24 px for app chrome):

- Top bar, 56 px, left: lockup and site breadcrumb; center: search; right: live clock, provenance summary.
- Top-left: up to three KPI tiles, 12 px gap.
- Right: inspector, 360 px wide, max height viewport minus 112 px, scrolls internally.
- Bottom-right: asset list, 400×320 px.
- Bottom-left: route/timeline strip, 520×120 px, only when a vessel is underway.
- Camera controls: vertical stack of 32 px icon buttons at right edge, top 96 px, as in the reference video.

Grid: 12 columns, 24 px gutter, 1440 px max for the case study page only. The app has no column grid; it has zones.

### Tablet (768–1279 px)

Inspector and asset list merge into one right rail, 320 px, tabbed. KPI tiles collapse to a single row of three, 120 px wide each.

### Mobile (<768 px)

Viewport 100 vh behind everything. Top bar 48 px. One bottom sheet carries list and inspector; selecting a row pushes the inspector in, back arrow returns. KPI tiles become a horizontal scroll strip at the sheet's 96 px snap. Camera: pinch and drag only, no on-screen gizmo.

### Dock map (T29)

The **Map** preset (it replaced Top-down) answers the dockmaster's question “what is every berth doing tonight?” without leaving 3D.

- **Camera.** A 2° lens looking from the water (bearing 59°, 52° above the water), so Dock A is on the right and Dock E on the left. Across the marina the scale varies by under 3 %, which reads as a plan. It is framed on all 126 berths inside the canvas area the panels leave free, measured when the preset is chosen. Moving in or out of the map is one 700 ms dolly-zoom, and under reduced motion it is a cut.
- **Selecting on the map keeps the map.** The berth is centred and the view zooms in until slip numbers show, without changing the lens. Overview and Dock B leave the map.
- **Plates.** The berth pick mesh switches from its faint tint to status plates over 450 ms, and the water darkens 45 % so the light plates read. Patterns are in screen pixels and drop away below about 9 px per berth, where colour carries the status.

| Status | Means | Colour | Pattern |
|---|---|---|---|
| Occupied | Held tonight, boat not logged out | `lake-sky` | Solid |
| Away | Held tonight, boat logged out | `chart-cyan` | Diagonal hatch, solid edge |
| Reserved | Transient arriving today, not checked in | `chart-green` | Light fill, dashed edge |
| Needs review | Open review issue (outranks the rest) | `warning` | Cross-hatch, heavy edge |
| Vacant | No agreement tonight (never inferred from an empty berth) | `limestone` | Outline only |

- **Labels.** Slip numbers are white mono with a midnight halo at a fixed 13 px, shown from 4.5 px per metre. Docks are always named: “Dock B”, or just “B” when the whole map is too small for the names.
- **Legend.** “Map · tonight” lists the five statuses with counts. On desktop and tablet it sits at the top of the camera panel, so it never adds a zone. On mobile it is a strip over the bottom of the map. Each swatch is a small plate on map water, so it matches the canvas in both themes.
- **Small screens.** A capable GPU opens on the map (WebGL2 without a major-performance caveat, no Save-Data, and at least 4 GB where reported). Everything else gets the flat plan. Display → “Use 3D map” switches either way and is remembered.

### Assigning a transient (T30) and the day timeline (T31)

- **Incoming request card.** It sits at the top of the desktop rail and the top of the list pane on tablet and mobile. It shows the boat's name, its dimensions and power, a Slip list with verdicts, Assign, and a dashed drag handle (“Or drag Northern Tern onto a slip”).
- **Verdict look while dragging.** These are offered slips only; everything else recedes to 30 %.

  | Verdict | Colour | Pattern |
  |---|---|---|
  | Fits | `chart-green` | Solid with an edge |
  | Tight | `warning` | Diagonal hatch with an edge |
  | No fit | `error-fill` | Outline and a sparse cross |

  The slip under the pointer gets a limestone ring on a midnight halo and a label with the reason. The pointer chip's border repeats the verdict: solid, dashed or dotted.
- **Planned boat.** It is drawn translucent (the stale-hull material), because it is a booking, not an observation. It backs into the slip over 3.6 s and leaves bow first over 2.4 s after Undo; under reduced motion both are cuts.
- **Day timeline.** A native range input in the scenario panel: 06:00–22:00, one-minute steps, amber ticks at the scripted checkpoints, the time in mono at the right. Moving it opens the read-only replay view; the panel says the run is unchanged.
- **Arrivals board.** The third Registry tab: time in mono (or “—” before a check-in is logged), vessel, slip and a status pill (Arrived / Due / Expected). The Arrivals KPI tile opens it.
- **Light by the hour.** It holds the authored mid-morning light from 08:45 to 09:20, then warms toward a 20:50 sunset and dims to dusk at 22:00 (`src/scene/daylight.ts`).

### Print

Chart mode. Letter landscape, 0.5 in margins. Page 1: plan view of the basin with slips numbered in Atkinson Hyperlegible Mono, nav aids in magenta, scale bar, north arrow, and chart 14833 attribution. Page 2+: registry table, 9 pt Work Sans, mono IDs, provenance column mandatory, "SIMULATED DATA" in the running footer. No color backgrounds, no glass.

---

## 10. Do's and don'ts

| Do | Don't |
|---|---|
| Float panels over the live scene with glass and one hairline. | Put the 3D viewport inside a card with a border and shadow. |
| Tag every simulated value `SIM` in mono. | Present an invented roster as if it were the marina's records. |
| Use `signal` orange for the selected object and the primary button only. | Use orange for warnings, chart elements, or decorative gradients. |
| Set vessel names in Commissioner 600 at full flare and IDs in Atkinson Hyperlegible Mono. | Set everything in mono because it "looks ops". |
| Trace the basin from NOAA chart 14833 and cite it. | Model a generic rectangular marina. |
| Keep grain elevators in the background of wide shots. | Add Bills colors, buffalo silhouettes, or wing puns. |
| Fly the camera on list selection in 700 ms with one easing. | Chain three camera moves or add a bounce. |
| Show "Slip B-14 · Documented layout pending" as an honest placeholder. | Invent 120 slips and call it the real layout. |
| Use `signal-dark` for orange text on light backgrounds (4.71). | Use `#ff4d00` on light backgrounds (3.0, fails). |
| Provide a reduced-motion path with camera cuts. | Ship ambient water animation with no way to stop it. |
| Use place names: Buffalo River, Ohio Street, Canalside. | Use organization names or logos: ECHDC, Dale's, First Buffalo River Marina. |
| Let flare grow with size: full on names and headings, off on labels. | Flare a button, a label or anything under 16 px. |

---

## 11. Quick-reference variables

Full files: [design/tokens.css](design/tokens.css) and [design/tokens.json](design/tokens.json). Excerpt:

```css
:root {
  /* base */
  --c-midnight: #011b2b;  --c-ink-700: #233747;  --c-ink-500: #3f5464;
  --c-ink-300: #748491;   --c-mist-200: #d5dfe3; --c-mist-100: #eaf1f4;
  --c-signal: #ff4d00;    --c-signal-light: #ff5d17; --c-signal-dark: #c53c00;
  --c-focus: #2d62ff;     --c-sand: #e6e5df;     --c-sand-dark: #bbb9ad;
  --c-forest: #465243;    --c-rust: #a15842;     --c-slate: #73859f;
  --c-chart-cyan: #7fd1e8; --c-chart-magenta: #ff3d9a; --c-snow-canvas: #f2f5f8;
  --c-winter-sky: #c9d0d7; --c-snow: #d2d9e0; --c-ice-floe: #adb5bd; --c-winter-water: #585858;
  --c-silo-concrete: #7b7265; --c-silo-blue: #284878;

  /* type */
  --f-heading: "Commissioner", "Work Sans", Arial, sans-serif;
  --f-body: "Work Sans", "Helvetica Neue", Arial, sans-serif;
  --f-mono: "Atkinson Hyperlegible Mono", "SF Mono", Menlo, monospace;
  --fs-label: 0.7813rem; --fs-body-sm: 0.9375rem; --fs-body: 1rem; --fs-h4: clamp(1.5rem, 1.357rem + 0.714vw, 2rem);
  --lh-tight: 1.05; --lh-heading: 1.15; --lh-body: 1.5; --ls-label: 0.07em; --ls-heading: -0.015em;
  --flare-display: 100; --flare-count: 60; --flare-ui: 0;

  /* space (4 px base) */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px;
  --s-6: 24px; --s-8: 32px; --s-10: 40px; --s-12: 48px; --s-16: 64px;

  /* shape */
  --r-xs: 4px; --r-sm: 8px; --r-md: 12px; --r-lg: 20px; --r-pill: 999px;
  --hairline: 1px solid rgba(255,255,255,0.12);
  --shadow-panel: 0 10px 38px -10px rgba(14,18,22,.35), 0 10px 20px -15px rgba(14,18,22,.2);

  /* motion */
  --t-micro: 150ms; --t-panel: 240ms; --t-camera: 700ms;
  --e-standard: cubic-bezier(.4,0,.2,1); --e-camera: cubic-bezier(.83,0,.17,1);
}
```

Naming convention: `c-` color, `f-`/`fs-`/`lh-`/`ls-`/`flare-` type, `s-` space, `r-` radius, `t-` time, `e-` easing. Semantic aliases live under `[data-theme]` in `tokens.css`.

---

## 12. Complete component: vessel card

Live file: [design/vessel-card.html](design/vessel-card.html). It is self-contained (a copy of `tokens.css` is inlined in a `<style id="tokens">` block; regenerate it after editing the token file), and renders all six states side by side. Verified in the browser on 14 Nov 2026. It predates the 15 Nov type change and still loads General Sans, Switzer and IBM Plex Mono; the snippet below shows the current type. The shipped equivalent is the inspector in `src/features/registry`.

Markup (one state shown; the HTML file shows default, hover, selected, overdue, loading, and chart-mode):

```html
<article class="vessel-card" data-state="selected" aria-labelledby="v-1-name">
  <header class="vc-head">
    <div>
      <p class="label">SLIP B-14 · HULL NY-4471-RB</p>
      <h4 id="v-1-name" class="vc-name">Lake Effect</h4>
      <p class="body-sm muted">Owner <span class="sim">SIM</span> · 32 ft Sea Ray</p>
    </div>
    <span class="pill" data-status="docked"><i></i>Docked</span>
  </header>
  <dl class="vc-rows">
    <div><dt>Last seen</dt><dd>14 Nov · 08:12 <span class="tag" data-prov="sim">SIM</span></dd></div>
    <div><dt>LOA / beam / draft</dt><dd>32.0 / 10.5 / 2.8 ft <span class="tag" data-prov="assume">ASSUME</span></dd></div>
    <div><dt>Basin position</dt><dd>42.8706, -78.8792 <span class="tag" data-prov="doc">DOC</span></dd></div>
    <div><dt>Services due</dt><dd>Pump-out <span class="tag" data-prov="field">FIELD</span></dd></div>
  </dl>
  <footer class="vc-actions">
    <button class="btn btn-primary">Fly to</button>
    <button class="btn btn-secondary">History</button>
  </footer>
</article>
```

Core styles:

```css
.vessel-card {
  width: 360px; padding: var(--s-5); border-radius: var(--r-md);
  background: rgba(1,27,43,.72); backdrop-filter: blur(16px);
  border: var(--hairline); box-shadow: var(--shadow-panel);
  color: #fff; font-family: var(--f-body);
  transition: border-color var(--t-micro) var(--e-standard), transform var(--t-micro) var(--e-standard);
}
.vessel-card:hover { border-color: rgba(127,209,232,.6); }
.vessel-card:focus-within { outline: 2px solid var(--c-focus); outline-offset: 2px; }
.vessel-card[data-state="selected"] { border-color: var(--c-signal); }
.vessel-card[data-state="loading"] .vc-rows dd { color: transparent; background: rgba(255,255,255,.08); border-radius: var(--r-xs); }
.vc-name { font-family: var(--f-heading); font-weight: 600; font-size: 24px; line-height: 1.25; letter-spacing: var(--ls-heading); font-variation-settings: "FLAR" var(--flare-display); margin: 2px 0; }
.label { font-family: var(--f-heading); font-size: var(--fs-label); font-weight: 600; letter-spacing: var(--ls-label); text-transform: uppercase; font-variation-settings: "FLAR" var(--flare-ui); color: var(--c-mist-200); }
.pill { font-family: var(--f-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding: 4px 10px 4px 8px; border-radius: var(--r-pill); border: 1px solid; display: inline-flex; gap: 6px; align-items: center; }
.pill i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.pill[data-status="docked"]   { color: #cef5ca; border-color: rgba(74,130,49,.6); }
.pill[data-status="underway"] { color: #7fd1e8; border-color: rgba(127,209,232,.5); }
.pill[data-status="arriving"] { color: #ff5d17; border-color: rgba(255,77,0,.6); }
.pill[data-status="overdue"]  { color: #ffb3ab; border-color: rgba(220,49,39,.7); }
.tag { font-family: var(--f-mono); font-size: 11px; letter-spacing: .04em; padding: 1px 5px; border: 1px solid rgba(255,255,255,.2); border-radius: var(--r-xs); color: var(--c-ink-300); margin-left: 6px; }
.tag[data-prov="sim"] { border-color: var(--c-signal-dark); color: var(--c-signal-light); }
.btn-primary { background: var(--c-signal); color: var(--c-midnight); }
.btn-primary:hover { background: var(--c-signal-light); }
.btn-primary:active { background: var(--c-signal-dark); color: #fff; }
.btn:disabled { opacity: .4; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .vessel-card, .btn { transition: none; } }
```

States: default, hover (cyan hairline), focus-within (blue ring), selected (orange hairline), overdue (pill red, row "Last seen" in error text), loading (skeleton rows, buttons disabled), chart-mode (`[data-theme="light"]` swaps to winter-sky surfaces and `signal-dark` accent).

---

## 13. Voice

- Operational, declarative, present tense. "Lake Effect is docked at B-14." Not "Looks like Lake Effect has made it home!"
- Buffalo-specific nouns, no Buffalo jokes. Use "Buffalo River", "Outer Harbor", "Ohio Street bridge", "lake effect" only as a vessel name.
- Marina vocabulary: slip, berth, finger, transient, haul-out, winterize, pump-out, travel lift, LOA, beam, draft. Not "spot", "parking", "boat parking".
- Simulated and assumed facts are named as such in copy, not only in tags: "Simulated roster, 48 vessels. Slip count assumed; survey pending."
- Error copy states what happened and the next action in under 12 words.
- Never claim partnership, pilot, or endorsement. The case study says "independent concept based on a real Buffalo marina".

---

## 14. Accessibility

- Text contrast targets AA at every size, measured values recorded in Section 2. Known gap: `text-muted` (`#748491`) on `midnight` is 4.57, fine for 14 px and up, not for 11 px tags. Tags use `mist-200` for text when they carry meaning; `text-muted` only for decorative hints.
- Status is never color-only. Every pill has a label; every overdue row has an icon.
- All viewport selections are reachable from the asset list by keyboard. The 3D canvas itself is `aria-hidden`; the list is the accessible tree.
- Focus ring: 2 px `#2d62ff` outside with 2 px offset, on every control, visible on dark and light.
- Target size: 40 px buttons, 44 px rows, 32 px icon buttons with 8 px spacing.
- Reduced motion path per Section 7, including camera cuts.
- Zoom to 200% without horizontal scroll in the panels; the viewport may crop.
- Provide a "chart mode" high-contrast light theme as a user preference, not only for print.

---

## 15. Production and handoff

- Stack RECOMMENDED: Vite + React + React Three Fiber + Drei, CSS custom properties (no Tailwind, so tokens stay readable in handoff), deployed on Vercel like the rest of rssdesign.org. Platform remains open per PRODUCT.md.
- Fonts (15 Nov 2026): Commissioner, Work Sans and Atkinson Hyperlegible Mono are self-hosted as one variable WOFF2 each in `design/fonts` and copied byte-for-byte to `public/fonts` (checked by `tests/unit/assets.test.ts`). Source: `github.com/google/fonts` (SIL OFL 1.1, no Reserved Font Names). Instanced with fontTools (Commissioner wght 400–800 and FLAR 0–100, VOLM and slnt pinned to 0; Work Sans and the mono wght 400–600) and subset to Latin plus the punctuation, arrows and math signs in the UI. 96,212 bytes in total. Each licence ships beside its font and must stay in the repo; the credits are in About / Sources and `public/THIRD-PARTY-NOTICES.txt`. No font loads from a third-party host. `font-display: swap`. The retired General Sans, Switzer and IBM Plex Mono files remain in `design/fonts` for older design files only.
- Tokens: `design/tokens.json` is the source of truth; `design/tokens.css` is generated from it by hand for now. Keep them in sync in the same commit.
- Geometry: [data/buffalo-river-features.geojson](data/buffalo-river-features.geojson) holds 146 OpenStreetMap features for the harbor (bbox -78.905, 42.855 to -78.860, 42.885, fetched 14 Nov 2026): 89 piers, 17 breakwaters, 4 marinas (Erie Basin Marina, Buffalo Coast Guard Slip, Cazenovia Community Boating Center, one unnamed), the Buffalo Main Light, Coast Guard Sector Buffalo, river and water polygons. Every feature carries `"provenance": "DOC"` and the ODbL attribution, which must appear in the UI ("© OpenStreetMap contributors"). Caveats: the lake polygon is not closed inside the bbox and the riverbank polygons are partial, so fetch a wider bbox or use the coastline when building the water plane. First Buffalo River Marina is not named in OSM; the boatyard and floating headwalks on the south bank across from the Naval Park are taken as the site (ASSUME, supported by Raj's Google Earth screenshot). [data/slips.geojson](data/slips.geojson) holds 126 generated slips on docks A–E (25 to 45 ft), single-loaded on the water side of the OSM headwalks; the scheme, counts and numbering rules are in [data/SLIPS.md](data/SLIPS.md) and everything there is ASSUME.
- Simulated data: every record in `data/vessels.json` carries `"provenance": "SIM"` and a `generated_at` timestamp. Rendering code must refuse to display a record with no provenance field.
- Performance budget: 60 fps on an M1 MacBook Air at 1440×900, under 2,000 draw calls, under 6 MB total assets, fonts under 200 KB.
- Case study capture: record the scene at 1600×1000, export at 2×, and follow the recruiter-first card-video bar already used on rssdesign.org.
- Figma: not required for the build. If one is made, name styles after the tokens in Section 11.

---

## 16. Missing information, consolidated

1. (Done 14 Nov 2026: all three families self-hosted.)
2. (Done 14 Nov 2026: winter sky, snow, ice and water measured from Raj's winter aerial; chart values from NOAA ENC.)
3. (Done 14 Nov 2026: silo concrete and Labatt blue measured from Commons photos.)
4. (Closed 15 Nov 2026: LED Dot Matrix dropped with the type change.)
5. Real slip count, numbering, finger layout, services, travel lift location.
6. Primary operational role and workflow (PRODUCT.md open decision).
7. Vessel-type icon set.
8. Opening photograph for the case study.
9. Rivian's usage context for `forest` and `rust`; values are measured but their semantic role on rivian.com was not recovered, so they are reassigned here as 3D material colors.


## 17. Map-first workspace refinement — 16 November 2026

Approved by Raj: lead with the slip discrepancy workflow, reduce text density, centralize demo disclosure, and keep the 3D marina prominent. This supersedes the earlier stacked desktop rail and per-section provenance presentation.

- One right workspace at every breakpoint: Tasks, Slips & vessels, and contextual detail. Lists retain filters and scroll position. Tasks count unresolved issues and unassigned incoming requests; viewing a task never completes it.
- The first invitation, “Who’s in B-12?”, opens the discrepancy through the existing scenario command. It does not claim a real customer incident. The domain confirmation still requires staff evidence and explicit acknowledgment.
- A single compact overview strip puts occupancy and arrivals values above their labels. Review work lives in Tasks; financial estimates remain available in the Arrivals view, with term-value methodology explained.
- Selected record titles are 24 px, primary facts 14 px, and secondary metadata 13 px. Use sentence-case labels and 20 px between major inspector sections. Show presence, assignment and booking eligibility once each; never equate an empty berth with availability.
- Persistent “Demo data” opens About / Sources. Routine SIM and ASSUME badges are removed from the main workflow. Provenance remains in the data. Operational uncertainty, stale/offline evidence, approximate fit inputs and replay mode remain explicit where they affect decisions.
- Demo controls default to one collapsed tray. Replay is visibly read-only, has an explicit return action, and preserves the interactive run. Reset retains its text label; familiar map utilities may use labeled icon controls.
- The request detail reveals specifications and lake what-if controls on demand. Assignment/undo and the fit explanation remain visible; condition-driven warnings are not hidden.
- Desktop/tablet use a single scrolling workspace. Mobile keeps the map in a separate row above an expandable sheet. The workspace is visually opaque to protect text readability over the 3D scene.

Validation: production build, lint, unit tests, and focused browser journeys for discrepancy resolution, assignment/undo, replay isolation, registry navigation and keyboard panning. Responsive and accessibility checks cover desktop, tablet, mobile, and a short viewport representing browser zoom. These checks are implementation evidence, not marina-operator user research.

### Screenshot refinement · 16 November 2026

Shared segmented controls have balanced end insets and label padding. Native selects reserve an explicit arrow gutter. Every supporting disclosure has a right/down chevron; inspector navigation uses Back and the workspace tabs, without a second close action. The map retains its accessible keyboard instructions without a persistent native hover tooltip.

Replay metadata sits in a filled inset with separate title and snapshot lines. Read-only guidance uses a blue information surface and icon in both themes. Camera provenance is a labeled fact; the approximate dimensions note has space above and below it. Request timing, stay and vessel length are separate values. Lake conditions have one section boundary and a larger gap below the scenario switch.

Arrivals show check-in progress, then vacant slips and unsold nights as separate metrics. Rows pair time with slip and vessel with arrival type. Vessel rows give the name and status separate lines to avoid truncating identity. Opaque workspace headers and demo controls do not blur content behind them.
