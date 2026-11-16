# Harbor Desk slip plan

Status: **ASSUME**. No public slip map exists for First Buffalo River Marina, so this plan is a design assumption built on documented geometry. Written 14 Nov 2026. Every slip in `slips.geojson` carries `"provenance": "ASSUME"` and the UI must label the roster as simulated.

## What is documented and what is assumed

| Layer | Status | Source |
|---|---|---|
| Site: the boatyard and floating headwalks on the south bank of the Buffalo River across from the Naval Park, between the Michigan Avenue and Ohio Street bridges, beside a slipway | DOC for the geometry, ASSUME for the identification | OpenStreetMap ways 1073548174 (boatyard), 934085283, 934085288, 1073540143, 1073532827, 1073532822 (headwalks), 934085281 (slipway); Raj's Google Earth screenshot of the search "First River Buffalo Marina" centered at 42.8799, -78.8829 |
| Headwalk lines and lengths | DOC | OpenStreetMap, ODbL, fetched 14 Nov 2026 |
| Finger docks, slip count, slip lengths, dock letters, numbering | ASSUME | This document |
| Services (fuel, pump-out, travel lift) and their positions | FIELD | Nobody has confirmed them |

OSM maps the headwalks but not the fingers, so the fingers are generated: one slip per width increment along the water side of each headwalk, single-loaded because every headwalk here runs parallel to the shore.

## Dock lettering and length classes

Letters run from the slipway end of the yard upstream, and slip length rises with the letter so a dock letter tells an operator the boat size at a glance.

| Dock | Headwalk | Type | Slip length | Slip width | Slips | Role |
|---|---|---|---|---|---|---|
| A | OSM 934085283, 410 ft fixed wall nearest the slipway | fixed | 25 ft | 10 ft | 39 | Transient, small craft, fuel and office side. Numbered from the slipway end. |
| B | OSM 934085288, two floating runs of 234 and 226 ft | floating | 30 ft | 11 ft | 37 | Seasonal 30 ft. Numbered downstream to upstream across both runs. |
| C | OSM 1073532827, floating, 140 and 147 ft runs | floating | 35 ft | 12.5 ft | 18 | Seasonal 35 ft, upstream of the second yard. |
| D | OSM 1073540143, 349 ft floating run | floating | 40 ft | 14 ft | 22 | 40 ft cruisers, deepest water on the reach. |
| E | OSM 1073532822, 203 ft fixed wall by the second yard | fixed | 45 ft | 16 ft | 10 | 45 ft and up, service and haul-out staging. Travel lift assumed adjacent (FIELD). |
| | | | | **Total** | **126** | |

Slip width is beam class plus roughly 3 ft of clearance, which is the usual rule of thumb for finger slips. Length classes step by 5 ft, which matches how marinas quote dockage.

## Numbering

- Slip ID is dock letter, hyphen, two-digit number: `B-14`.
- Numbers start at 01 at the gangway or slipway end of each dock and increase along the headwalk, so a lower number is a shorter walk from shore.
- Because every dock is single-loaded, there is no odd/even side split. If a double-loaded dock is ever added, use odd numbers on the upstream side and even on the downstream side.
- End ties, if used, take the dock letter and `T` plus a number: `D-T1`.

## Why these numbers are plausible, and why they might be wrong

- 126 slips sits between a small river marina and Erie Basin Marina across the water, which is several times larger. That feels right for this frontage. It is still invented.
- The single-loaded assumption is driven by the geometry. If the real docks have fingers on both sides, counts roughly double.
- OSM's headwalks may be out of date, and floating docks move seasonally.
- The identification of this yard as First Buffalo River Marina rests on the location and Raj's screenshot, not on a record.

## Files

- `slips.geojson`: 126 slip polygons (WGS84) with `id`, `dock`, `number`, `length_ft`, `width_ft`, `dock_kind`, `headwalk_osm_way`, `provenance`, `basis`.
- `slips-plan.svg`: plan check of the reach, chart-mode colors, docks lettered.
- `buffalo-river-features.geojson`: the documented harbor features the slips sit on.

Attribution required in the UI: "Dock geometry © OpenStreetMap contributors. Slips simulated."
