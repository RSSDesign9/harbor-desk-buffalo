# Site evidence and geometry checks

Written 14 November 2026 for the PRD handoff. This note qualifies existing source files; it does not replace or silently edit them.

## Evidence reviewed

- [Official First Buffalo River Marina site map, dated 1 June 2022](https://www.esd.ny.gov/sites/default/files/rfp/Exhibit-A-Site-Map-First-Buffalo-Marina-Operator.pdf), visually inspected. [Local reference copy](reference/first-buffalo-site-map-2022.pdf).
- [Supplied OSM features](buffalo-river-features.geojson): 146 features; source metadata says fetched 14 November 2026.
- [Generated slips](slips.geojson): 126 polygons; every slip has ASSUME provenance.
- [SLIPS.md](SLIPS.md): original author’s layout rationale and unresolved identification assumptions.

## Findings and limitations

The official map depicts a long waterfront site near the lighthouse/Coast Guard area and ferry landing, with a grain-elevator perimeter, storage areas, service road, office/parking, launches, and travel lift. This supports the linear waterfront concept, but is a dated site diagram, not a current slip survey. Its labels do not validate current operating availability. [Official map](https://www.esd.ny.gov/sites/default/files/rfp/Exhibit-A-Site-Map-First-Buffalo-Marina-Operator.pdf).

SLIPS.md’s description “between the Michigan Avenue and Ohio Street bridges” should not be used as an established locator: it does not match the site context depicted in the official map. Validate the actual coordinates against source landmarks instead. A search screenshot’s map center is not a site boundary or surveyed coordinate.

OSM feature 1073548174 is stored locally with `kind: parking`; SLIPS.md describes it as a boatyard. Do not silently treat that classification as ownership or an authoritative parcel boundary. The footprint is a useful alignment clue only. The inspected coordinates span roughly 42.8717–42.8762 latitude, so the screenshot center mentioned in SLIPS.md is not a reliable modeling origin by itself.

“No public slip map exists” is stronger than the available evidence. The supported statement is: **no verified numbered slip map is supplied for this build**. The official site map does not establish the generated A–E numbering or 126 capacity.

Fuel/pump-out availability, exact current service locations, claimed deepest water at Dock D, and the asserted clearance rule are unvalidated. Do not render invented depth contours, use these assumptions as navigation advice, or expose berth-fit approval. The travel lift appears on the historical map, but its current operation/position still needs field validation.

## Required build check

Before detailed environment modeling:

1. Plot the supplied headwalks, slips, shoreline, and site footprint in a local metric frame with north indicated.
2. Compare at least three well-distributed recognizable anchors against the official map and a suitably sourced geographic reference. Record source dates, origin, axes, and any transforms; do not assign survey-level accuracy to the result.
3. Verify the selected B-10/B-12/B-14 positions in the generated plan. IDs stay canonical even when the reference image shows a different illustrative arrangement.
4. Check each slip ring, orientation, dimensions, water-side placement, land intersections, headwalk joins, and overlaps. The original generator is not supplied; record/reproduce any corrections.
5. Inspect incomplete water polygons. Repair using complete source geometry or an explicitly approximate local water surface, not arbitrary polygon closure.
6. Save an annotated plan and a short findings log. If the footprint cannot be confidently aligned, keep the environment labeled approximate, document the remaining gap, and avoid a claim of exact reconstruction.

Keep the original inputs unchanged. Put corrected/derived data in separately versioned files with a source-to-derived mapping. Do not invent extra verified slips to fill visual gaps.

## Dataset baseline

| Dock | Supplied count | Assumed length × width |
|---|---:|---|
| A | 39 | 25 × 10 ft |
| B | 37 | 30 × 11 ft |
| C | 18 | 35 × 12.5 ft |
| D | 22 | 40 × 14 ft |
| E | 10 | 45 × 16 ft |
| Total | 126 | All ASSUME |

Display “Dock geometry © OpenStreetMap contributors. Slip layout assumed.” with a link to [OpenStreetMap attribution and license information](https://www.openstreetmap.org/copyright). Label fictional vessel records separately as simulated. DOC source geometry and ASSUME placement must not collapse into a single “verified” label.
