# Harbor Desk — case study copy

Portfolio copy for rssdesign.org (the /experiments card links here or to the live demo). Every figure below is either an engineering measurement from this build, with its source named, or a property of the simulated scenario. **There are no user-research results and no operator outcomes, and none are implied.**

---

## One line

A 3D slip desk for a Buffalo River marina: the marina is the interface, and every call about who is in a slip is made on evidence.

## The short version (about 120 words)

Marinas run on two pictures that drift apart: what the system says is in each slip, and what is actually in the water. Harbor Desk is an independent concept that puts both in one place. It rebuilds a real Buffalo River marina in the browser from OpenStreetMap geometry and lets a dockmaster work on it directly:

- drag an incoming boat onto a slip that fits;
- ask what a Lake Erie gale would do to that fit;
- scrub the day back and forth;
- settle a dock-walk discrepancy at B-12 with evidence, without overwriting the record.

The camera can say *a boat is there*; only staff evidence can say *which boat*. The product never lets the first stand in for the second. All records are simulated.

---

## Craft first

What to look for in the walkthrough. These are the details the build was held to:

- **The evidence is rendered from the scene.** The CCTV frame from camera C-02 and the staff dock-check photo are rendered from the same 3D marina the user is looking at: same boats, covers, light and angle. They are not stock images, so the evidence and the world can't disagree.
- **Nothing teleports.**
  - An assigned boat sails in from the river mouth along a path, and **Undo** sends it back out.
  - Camera moves are flights, and the map is a dolly-zoom into a long-lens view, not a cut.
  - When B-12 is resolved, the hull stays where it was; only its name board is added. The record changed, not the world.
- **One rule set, every input.** Every action is a command to one pure engine:
  - keyboard, list and drag all reach the same assignment;
  - the arrow keys pan the map;
  - a 2D plan takes over when WebGL is unavailable, with the same records and the same workflow.
- **Replay can't lie.** The day timeline is read-only. Scrubbing backward never shows a later log entry, and **Return to my run** restores exactly where you were.
- **It's a place, not a template.**
  - The docks sit where OpenStreetMap puts them: the west bank of the City Ship Canal at the Buffalo River mouth, checked against a dated 2022 site map.
  - The gale what-if uses a Lake Erie seiche, because that is what wind does to water levels in Buffalo.
- **It runs locally and quickly.**
  - The first screen is a poster rendered from the scene, which fades onto the first live frame.
  - The 3D scene loads as a separate chunk, and the app makes no external requests.
  - **Measured on an M3 Max:** 60 fps median on a 60 Hz display at 1440×900 over a scripted 60-second camera run (Gate D, 16 Nov 2026), and about 0.93 MB compressed for the full demo (T35 measurement). An M1 MacBook Air has not been measured.

## The evidence model (the AI pattern)

Harbor Desk keeps five facts apart that marina software tends to merge: **presence, identity, agreement, document review and availability.**

| What happened | What the product records |
|---|---|
| 09:10 dock walk: "B-12 Occupied" | A staff observation: presence, from a person |
| 09:12 camera C-02: a vessel in B-12 | A camera observation: presence only, identity unverified |
| System suggestion: Lake Effect or Harbor Light | A *possible match*, labelled as such; never an identity |
| 09:18 dock check: name board and registration ending 42 AB | Staff evidence: the only thing that can confirm identity |
| Dockmaster ticks "I reviewed the staff evidence" and confirms | An appended decision with its source. The agreement is **unchanged**; the original observation is **kept** |

This is the pattern an AI-assisted marina system needs, whether the model reads cameras, dock-walk photos or sensors. **The model proposes, a person confirms with evidence, and history is never rewritten.** Confirmation is impossible without staff evidence and an explicit acknowledgment; camera evidence alone can never confirm identity.

## Problem and hypothesis

- **Problem:** slip records and the water drift apart. Boats leave early, come back unannounced, or tie up in the wrong slip. The dock walk is the usual check, but its result arrives as a tick-box, and resolving a mismatch means reconciling a list, a radio call and memory.
- **Hypothesis:** a dockmaster resolves slip discrepancies faster, and with fewer wrong calls, when they can **see the slip in context** and **follow the evidence**. The same spatial view also makes assignment and occupancy legible, which is why the map, not a table, is the default.
- **Status:** untested with marina staff. The next step is to test it (see below).

## Intended users

These are hypotheses, not interview findings.

| User | Role in the design |
|---|---|
| **Dockmaster or harbormaster** | Primary. Works the Tasks queue, resolves discrepancies, assigns transients. |
| **Dock staff** | Their dock walks and dock checks are the evidence. In the demo, dock checks are simulated and no message is sent. |
| **Owner or general manager** | Reads occupancy, arrivals and the value tied up in open issues. |

Hiring teams evaluating 3D prototyping and product judgment are the portfolio audience.

## Why spatial context helps (the design argument)

- **Discrepancies are spatial.** "Which boat is in B-12" is answered by looking at B-12, its neighbours and the camera's angle, not by reading a row.
- **Fit is spatial.** Length against slip length, beam against the neighbours, draft against the water at that dock: dragging a boat over the docks shows every verdict at once, with reasons.
- **The map still does the list's job.** The **Map** preset turns the 3D scene into a top-down dock map with status plates on all 126 berths. Lists, search and the keyboard reach everything. The 3D view is the default, not the only way in.

## Modelling and data decisions

- **The real site, assumed slips.** Dock geometry is from OpenStreetMap, checked against the 2022 ESD site map. The 126-slip plan, dock letters, berth sizes, depths and services are design assumptions and are labelled ASSUME.
- **Simulated, deterministic records.** Vessels, agreements, movements, observations and evidence are generated from a seed and labelled SIM. The scenario day is 15 July 2026, at about 88% occupancy.
- **Append-only history.** Issues, decisions, dock checks and assignments are only ever added to; **Undo** stamps a record instead of deleting it.
- **A lens, not a record.** The gale what-if and the replay timeline are views: they can't change the run. Assignments remember which condition they were made under.
- **Honest labels, in the right place.** Provenance stays in the data and in **Demo data → About / Sources**. Uncertainty shows in the workflow where it affects a decision: identity unverified, approximate fit inputs, read-only replay.

## What works

All of this runs in the browser, end to end:

- the B-12 review, in both branches (direct, and with a dock check);
- drag- and list-based assignment with fit verdicts and reasons, plus Undo;
- the gale what-if re-checking every offered slip;
- the read-only day replay;
- registry search and filters, and deep links;
- light and dark themes, reduced motion, keyboard operation, the 2D fallback, and saved progress.

Covered by 240 unit tests and Playwright browser journeys (see QA.md).

## What is simulated

Everything operational:

- the vessels, bookings and rates;
- the camera feeds, and the "possible matches", which are scripted, not a model;
- the staff and their evidence;
- the lake series: the gale wind band is the cited National Weather Service threshold, but the seiche period and amplitudes are demo values.

There is no operator relationship, deployment or measured impact.

## Next research step

A 20-minute walkthrough with a Buffalo dockmaster:

- How do they resolve a "wrong boat in the slip" today, and how often does it happen?
- Would staff evidence (a photo of the name board) be acceptable proof?
- Is the map or the list their starting point?

After that, the five-person comprehension test in the PRD: find B-12, explain the uncertainty, resolve it, and say what did not change. The target is four of five, uncoached, in 90 seconds.

---

## Media

| File | Use |
|---|---|
| `video/harbor-desk-walkthrough-1600.mp4` | 77 s captioned walkthrough: opening → drag-to-assign → gale what-if → scrubber → dock-walk review → resolve |
| `video/harbor-desk-card-1600.mp4` · `video/harbor-desk-card-poster.jpg` | 28 s uncaptioned loop and poster for the /experiments card |
| `stills/01-overview.png` … `05-resolved.png` (+ `@2x`) | 1600×1000 stills: overview, assign, uncertain, gale, resolved |
| `stills/contact-sheet.jpg` | The reduced-motion alternative: the five stills in order, one image |

## Alt text

- **01-overview:** "Harbor Desk showing a 3D model of a Buffalo River marina: docks, moored boats, a grain elevator and the Skyway, with a task panel asking 'Who's in B-12?'"
- **02-assign:** "A top-down dock map with status plates. An incoming request is being dragged over slip D-01, and a chip reads 'D-01 · Fits'."
- **03-uncertain:** "Slip B-12 highlighted on the dock, labelled 'Vessel present · identity unverified', beside a panel comparing the dock-walk report with the camera image."
- **04-gale:** "The request card in 'SW gale' mode, with a water-level chart dipping below zero during the stay and slips re-rated as tight or no fit."
- **05-resolved:** "B-12 resolved: Lake Effect confirmed from staff evidence, with the agreement shown as unchanged and the original observation kept."
