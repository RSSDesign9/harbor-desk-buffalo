# Harbor Desk — improvement plan (Batches 9–14)

15 November 2026 · Follows Gate C (Batch 8). Supporting analysis: [DOCKWA-ANALYSIS.md](DOCKWA-ANALYSIS.md).

**The tasks below are merged into [TASKS.md](TASKS.md) as Phase 4.5. TASKS.md is the authoritative checklist; this file keeps the rationale and the model guide.**

## Goal and constraints

**Goal:** within 10 seconds, a 3D-prototyping hiring manager sees craft they can't get elsewhere. Within 90 seconds, a marina-software team (Dockwa first) sees that you understand their operators.

**Fixed:**
- 3D is the default view on every capable device.
- Simulated and assumed data stays honestly labelled, just more quietly.
- The approved geography, the B-12 state invariants, and the passing test suites (162 unit / 67 browser) are kept.
- Budgets from Gate B and C stay in place.

**Sequencing rule:** do the first impression first, since every later capture and video depends on it. T22 and T23 (the demo package) move to the end so they record the improved product.

## Order of work

| Batch | Theme | Tasks | Why this order |
|---|---|---|---|
| 9 | First 10 seconds | T24–T27 | Biggest hiring impact for the least work; sets the type and copy every later task builds on |
| 10 | Operational truth | T28–T29 | Realistic data and a 3D dock map, the foundation for A/B/C |
| 11 | Signature interactions | T30–T32 | The "why 3D" and the Dockwa fluency |
| 12 | Environment realism | T33–T34 | Your hyperrealism pass. It comes after the interactions so lighting can follow the time scrubber |
| 13 | One extra wow (pick one) | T35 | Optional; **E chosen and built 16 Nov 2026** |
| 14 | Package | T22–T23 (reframed) | Capture once, at the end. **Done 16 Nov 2026:** `showcase/`, README, PRODUCT-GUIDE |

A parallel human task runs alongside: **book a 20-minute dockmaster call** before Batch 11, so A/B/C can use real vocabulary.

---

## Task list

### Batch 9 — First 10 seconds

**T24 — Poster frame and opening shot**
- Ship a pre-rendered still of the hero pose and crossfade it into the live scene.
- Add a 3-second skippable establishing move: wide Buffalo waterfront → Dock B → B-12 framed beside the rail.
- Under reduced motion, cut straight to the end pose.

*Done when:* no blank canvas is ever visible on a cold load; the first meaningful paint is the poster; and the move is skippable by click, key or scroll.

**T25 — Chrome diet**
- At 1440×900 the scene is at least 70% of the viewport by default.
- The scenario card collapses to a one-line step bar.
- About and Sources move into the top-bar menu.
- The Registry list closes by default.
- One persistent "Simulated demo · Buffalo concept" marker replaces the chip wall. DOC/ASSUME/SIM/FIELD appear only inside detail rows and on hover or focus.
- The KPI tiles become Occupancy tonight · Arrivals today · Needs attention · Revenue at risk. Values come from T28 and stay SIM-labelled in their detail.

*Done when:* the panel coverage measurement passes; axe passes; and the identity-leak tests still pass.

**T26 — Copy pass (your text to-do)**
- Rewrite the UI copy in dockmaster language. Example: "Looks like Harbor Light — not confirmed."
- Cut each inspector section to its decision-relevant lines; secondary facts move behind disclosure.
- Write the copy deck in a single file before editing components.

*Done when:* first-screen visible word count is down at least 40%, and the precision of every state is unchanged.

**T27 — Typography (your font to-do)**
- **Decision needed:** pick from 3 type directions. Each is a display + text + data trio, shown on the real inspector and top bar.
- Then update design/tokens.json → `npm run tokens`, self-host the fonts, and record licenses.

*Done when:* the font budget of ≤ 180 KB holds; no more than 5 faces ship; and DESIGN.md is updated.

### Batch 10 — Operational truth

**T28 — Realistic July fixtures**
- About 88% occupancy, with a mix of seasonal and transient boats.
- Nightly rates and dollar figures; a day of arrivals and departures; away-boat flags.
- Exactly one offline camera.
- B-12 / Lake Effect / Harbor Light stay byte-compatible with the scenario tests.

*Done when:* `npm run fixtures:check` and the scenario engine tests pass, and the KPIs derive from the fixtures.

**T29 — 3D dock map mode (replaces "Top-down")**
- Use a tilted orthographic 3D camera framed on the marina, accounting for the rail inset.
- Status-colored slip plates (occupied / vacant / reserved / needs review / away); slip numbers appear when zoomed in.
- Add a legend.
- The flat 2D plan remains the accessibility and low-power fallback.
- On mobile, a capable GPU now defaults to this 3D map rather than the flat plan.

*Done when:* every slip is visible and pickable in the map pose at 1440, 1024 and 390 widths, and the mobile 3D/2D fallback journeys pass.

### Batch 11 — Signature interactions

**T30 — Fit-aware drag-to-assign (A)**
- An incoming transient card, for example a 42 ft boat with a 14 ft beam, 5 ft draft and 50 A shore power.
- While dragging it over the scene or map, each slip shows a verdict (fits / tight / no) with a reason: LOA, beam clearance, draft against assumed depth, power.
- Dropping it animates the boat along an approach path into the slip.
- The assignment is appended and can be undone.
- A keyboard path (list + Assign) does the same thing.

*Done when:* verdicts are deterministic and unit-tested; there's a browser journey for drag, drop and undo plus a keyboard journey; and the frame rate holds during drag.

**T31 — Time scrubber + arrivals board (B)**
- Scrub 06:00–22:00 on 15 July. Boats arrive and depart along authored paths.
- Vacant slips show unsold nights; KPIs and the arrivals board follow the scrubber.
- Lighting follows the time of day. Keep it simple here; T33 refines it.
- B-12's states line up with the scrubber times (08:45 / 09:12 / 09:18 / 09:20).

*Done when:* no hull teleports; scrubbing backward never shows future evidence (an existing invariant); and the idle-frame test still passes when paused.

**T32 — Dock-walk trigger (C)**
- The B-12 issue now opens from a morning dock-walk discrepancy.
- Camera C-02 becomes a corroborating second source.
- Steps are renamed to match.

*Done when:* the review journeys pass with the updated labels, and history still preserves both sources.

### Batch 12 — Environment realism (your hyperrealism to-do)

**T33 — Surroundings pass**
- **Decision needed:** the new target on your 1–10 realism scale. Recommendation: move the surroundings to about 8 while boats and docks stay about 7 for readability.
- Then do:
  - water with normals, sky reflection and dock contact shading;
  - a time-of-day sky tied to T31;
  - higher-fidelity Buffalo landmarks: grain elevators, Skyway, skyline silhouette;
  - foliage variation and PBR materials on near shore objects;
  - optional baked lightmaps for static scenery.
- Make one reference still (a v3 target) first and iterate against it.

*Done when:* a side-by-side capture against the v3 target is approved by you, and the draw-call and transfer budgets hold.

**T34 — Performance and regression**
- Profile again, including the pending M1 MacBook Air run if a device is available.
- Run the full browser suite (`--workers=1`) and refresh QA.md.

*Done when:* Gate B budgets pass on the measured device, and 67+ browser journeys pass.

### Batch 13 — One extra wow (pick one)

**T35** — choose one:
- (E) Buffalo seiche/gale overlay feeding fit verdicts;
- (G) boater arrival flythrough;
- (F) "map generated from OpenStreetMap" onboarding sequence.

Recommendation: **E** for Dockwa and for hometown specificity; **G** if the target companies are consumer-heavy.

### Batch 14 — Package (reframed T22–T23)

**T22 — Demo package**
- A 75–90 s video. Cut list: poster → establishing move → drag-to-assign → scrubber → dock-walk review → resolve.
- Stills at 1600×1000.
- Case study copy that leads with craft wins and the evidence-model / AI pattern.
- One-page pitch notes per company (from DOCKWA-ANALYSIS §5).

**T23 — Documentation and handoff**
- Run and build docs, and close the checklists.
- Publishing or deploying still requires a separate request.

---

## Models: which to use for what

### Claude Code (Max)

- Prices below are Anthropic API rates per million tokens (input / output), as listed in the Claude API reference cached 3 Nov 2026.
- On Max you aren't billed per token, but heavier models use your usage allowance faster in roughly the same proportion. So treat price as relative weight.

| Model | Relative weight | Use it for |
|---|---|---|
| **Opus 5.5** (default) | $4 / $20 | **Workhorse for this project:** T24, T25, T29–T31, T33. It's strongest on multistep work in a real repo, and at its default medium effort Anthropic reports it matching Opus 5's high-effort results with about half the tokens. It reads screenshots and renders precisely, so it can critique its own captures. Run high effort for design and 3D batches, medium otherwise. |
| **Fable 5.2** (if your plan offers it) | $8 / $40 (2× Opus) | **Only for the hardest judgment calls.** Examples: the T33 water/lighting approach, the T30 interaction architecture, or when Opus has failed the same visual target twice. Start at high effort, not max. Don't run whole batches on it. |
| **Sonnet 5.5** | $2 / $10 (½ Opus) | **Spec-driven implementation where the decision is already made:** T26 applying an approved copy deck, T27 token/font wiring, T28 fixtures, T32 relabelling, test updates. Give it the exact spec; it follows explicit specs precisely. |
| **Haiku 5.5** | $0.10 / $0.50 | **Subagent grunt work:** searching the repo, reading logs, running and summarizing test output, capture scripts. Not for design decisions. |

### Codex (Pro)

From OpenAI's model page. The page doesn't say which plans include which model, so check your model picker.

| Model | Use it for |
|---|---|
| **GPT-6 Astra** (flagship) | An **independent reviewer** of each batch's diff: a second opinion on the same code without inheriting Claude's assumptions. Not for writing the same files at the same time. |
| **GPT-6.1 Sol** (near-Astra, cheaper) | The token-efficient reviewer default; use Astra only for Batch 11 and 12 reviews. |
| **GPT-6.1 Terra** (fast; described for visual understanding) | A **cheap second eye on screenshots**: "list hierarchy, legibility and composition problems in these 6 captures." Not listed for the IDE extension. |
| **GPT-6 Luna** | Not needed here. |

**Recommended split:** Claude Code builds; Codex reviews (Sol by default, Astra for the big batches) and critiques screenshots (Terra). Never let both write the same files at once.

### Token-efficiency habits (bigger savings than model choice)

1. **One batch per session.** Start from the "starting point" at the end of BUILD-LOG.md and read only its tail, not all 1,500+ lines.
2. **Decide before you build.** Font trio (T27), realism target (T33), and copy deck (T26) are chosen from cheap mockups first. Re-implementing a wrong decision costs the most tokens.
3. **One reference still per visual task.** Iterating against a target converges; "make it better" loops don't. When asking for visual work, name the specific patterns to avoid, which works better than "avoid a generic look."
4. **Use the headless GPU capture scripts** (`npm run capture` with fixed poses, downscaled) for visual checks instead of repeated live-pane screenshots.
5. **Run only the affected specs while iterating;** run the full `--workers=1` suite once per batch.
6. **Delegate test fixing and log reading to Sonnet or Haiku subagents** so the main Opus context stays on design.

## Decisions needed from you

| When | Decision |
|---|---|
| Before Batch 9 | Approve the chrome-diet direction, the operator KPIs and the one-marker labelling |
| T27 | Pick 1 of 3 type directions |
| T33 | Set the new realism target (recommended: surroundings about 8, hero boats and docks about 7) |
| Batch 13 | Pick E, G or F |

## Sources

- Claude model prices and capabilities: Claude API reference bundled with Claude Code (models table cached 3 Nov 2026; "Migrating to Claude Opus 5.5" notes).
- Codex models: https://learn.chatgpt.com/docs/models (fetched 15 Nov 2026; no last-updated date shown).
