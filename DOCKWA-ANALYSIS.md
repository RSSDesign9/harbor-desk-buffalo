# Harbor Desk × Dockwa — product analysis and pitch strategy

15 November 2026 · Working document, not for publication

**Positioning decisions (Raj, 15 Nov 2026):**
- Target: 3D-prototyping roles broadly, with Dockwa as one target.
- 3D stays the default view.
- This analysis stays a local document.

**Method:**
- Reviewed Harbor Desk on the dev server at 1440×900, running the full B-12 flow and every camera preset.
- Researched Dockwa through marinas.dockwa.com, its blog, pricing and press pages, and the June 2026 PSG release.
- dockwa.com (the boater site) blocked automated reads.
- No Dockwa product UI was seen, so statements about Dockwa features come from their marketing copy.

---

## 1. Verdict

Harbor Desk is not a Dockwa competitor. It is a very deep take on one corner of their product. Pitching it as "an improvement on Dockwa" would hurt.

- **Dockwa's spine is revenue:** bookings, contracts, payments, POS, fuel and dynamic pricing.
- **Harbor Desk's spine is record accuracy:** does what's in the water match what's in the system?

Dockwa covers the second problem with two products:
- **Spaces** (renamed from Storage in June 2026): "live interactive marina map", assignments, occupancy, "vessel fit constraints", Smart-assign.
- **Dockwalk:** an iPhone checklist where staff tap Occupied or Vacant slip by slip.

Nothing found shows either in 3D, and the copy mentions no timeline or drag-and-drop. No competitor found has 3D either: DockMaster VisualMarina and Harba's berth map are 2D.

**Pitch:** "I picked up the problem behind Spaces and Dockwalk, keeping the records in step with the water, and took it further spatially than anyone has shown publicly."

## 2. Marina owner / dockmaster lens

### Does well
- **Presence, identity, agreement and bookability are separate facts.** An empty assigned slip shows "Bookable: No", which prevents double-selling a seasonal holder's slip.
- **"Candidate only, not an identity."** It never wrongly accuses a paying seasonal customer.
- **Append-only history and evidence frames are defensible.** That matters for insurance, damage and "my boat was moved" disputes.
- **The dock check sends a human to the slip,** which is how marinas actually work.

### Doesn't, or does weakly
1. **No money anywhere.** An owner wants occupancy tonight, revenue this week and who hasn't paid.
2. **Occupancy reads as failing.** 48 vessels in 126 slips is about 38% on 15 July, and most of the list says "No agreement / Empty."
3. **28 slips are permanently "Camera offline"** (all of Docks C and E). At a glance it looks broken.
4. **Only one moment in time.** No arrivals or departures, no "tonight", no scrubber.
5. **No boat-fit check:** length, beam, draft at low water, shore power. Dockwa markets "vessel fit constraints."
6. **It depends on cameras,** and most marinas don't have slip-level cameras.
7. **Overview and Top-down don't do the dockmaster's job.**
   - Overview has no status layer, and the boats are specks.
   - Top-down isn't centered on the marina, and the docks sit partly behind the left panels.

## 3. Hiring manager lens

### Rejection risks
1. **About 5 seconds of blank navy before the scene paints** on a fresh load.
2. **Panels cover roughly 40% of a 1440×900 viewport.** The hero is buried.
3. **About 20 SIM/ASSUME/DOC chips on the first screen.** It reads as hedging.
4. **KPIs describe the dataset** ("Assumed slips", "Simulated vessels"), not the marina.
5. **Spec-doc copy:** "Possible match (candidate only, not an identity)".
6. **The wow moment arrives slowly.** Five steps for one edge case, and guided replay is a secondary link.
7. **A dev-mode console error appears after a viewport resize** ("synchronously unmount a root…").

### Craft wins to put up front
- The CCTV frame and staff evidence photo are rendered from the scene.
- The hull stays put on resolution; only its name board is added.
- Keyboard and list parity, plus 2D and WebGL fallbacks.
- 162 unit tests and 67 browser journeys (Gate C).
- Real OSM geometry, with zero external requests.

## 4. Additions, ranked

| | Addition | Why it lands |
|---|---|---|
| A | **Fit-aware drag-to-assign.** Drag an incoming transient over the marina. Slips light up green, amber or red, each with a reason (length, beam, draft vs. water level, power). Drop it and the boat glides in. | Makes "vessel fit constraints + Smart-assign" visible. It's the clearest answer to "why 3D?" |
| B | **Time scrubber + arrivals board.** Boats arrive and leave; empty slips glow as unsold nights. | No timeline view found anywhere in marina software |
| C | **Dock-walk trigger.** "Dockhand marked B-12 Occupied, but Lake Effect departed 08:10." The camera becomes a second source. | Speaks Dockwa's language and removes the "we don't have cameras" objection |
| D | **Away-boat resale.** "Lake Effect away until Friday, B-12 resellable for 2 nights, about $180." | Turns bookability into revenue (ties to Telescope) |
| E | **Buffalo weather and water level.** Lake Erie seiches and gale exposure feed the fit check. | Domain insight with hometown specificity |
| F | **Marina map generated from OpenStreetMap.** | Onboarding speed. Dockwa appears to hand-configure maps |
| G | **Boater arrival flythrough** linked from the confirmation text | Shows understanding of a two-sided marketplace |

Priority: **A + C first, then B.** The rest are optional wow moments.

## 5. Pitch

- **Lead with their language:** Spaces, Dockwalk, Smart-assign, occupancy, revenue.
- **Bring out the evidence model as the AI pattern their PSG-funded "Marine Graph" roadmap needs:** the AI proposes, a human confirms with evidence, and history is never rewritten. The provenance rigor belongs in the pitch, not plastered across the UI.
- **3D stays the default. The judgment to show is that the 3D map mode also does the 2D job:** a status layer, slip numbers, framed on the marina. The flat plan remains the accessibility and low-power fallback.
- **Keep the product Harbor Desk.** No Dockwa logo or UI imitation. Name their modules only in the write-up and outreach.
- **Role:** "Product Designer – Marina", $140–180K, Newport RI / remote, reports to the VP of Product.
  - Scope: reservations, contracts, payments, POS, reporting, a B2B design system, data viz, "AI-powered design."
  - Maps aren't mentioned.
  - Whether it's still open is unverified (mirrored reposts return 410).

| Company | Angle |
|---|---|
| Dockwa (PSG investment 3 Jun 2026) | Revenue + Dockwalk + AI evidence model (A, C, D) |
| Harba | Berth sensors: "sensor says present, identity unknown" is a direct fit |
| DockMaster (Valsoft) | VisualMarina is a 2D map on a staff-loaded image; pitch a modern rebuild |
| Molo / Storable Marine | Fit-aware assignment across slips and racks |
| Snag-A-Slip | Boater arrival flythrough (G) |

**Highest-leverage single step:** a 20-minute call with a Buffalo dockmaster (Dale's Marine Service). One real quote turns the concept into research.

## Sources

- https://marinas.dockwa.com/
- https://marinas.dockwa.com/marina-software-pricing
- https://marinas.dockwa.com/boat-storage-software
- https://marinas.dockwa.com/about-us
- https://blog.dockwa.com/marinas/dockwalk-done-right
- https://blog.dockwa.com/marinas/dockwa-dispatch-june-2026
- https://blog.dockwa.com/marinas/dockwa-secures-strategic-growth-investment-from-psg-to-build-the-operating-system-for-the-57-billion-marina-economy
- https://hosted-apply.jobtarget.com/job/kNezOnHrfbZnt8?jtdemo=1
- https://portal.dockmaster.com/docs/dockmaster-desktop/system-administration/configuration/VisualMarina®/
- https://harba.co/solution
- https://www.capterra.com/p/147452/Dockwa/reviews/
