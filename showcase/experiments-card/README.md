# Harbor Desk on rssdesign.org/experiments

The card for the playground carousel on `/experiments`. It matches the existing cards: title, date, description, stack chips, **Try it live** and **Source**.

## Card copy

| Field | Value |
|---|---|
| Title | Harbor Desk |
| Date | Nov 2026 |
| Description | A 3D slip desk for a marina on the Buffalo River, my hometown. Drag a boat onto a slip that fits, see what a Lake Erie gale does to that, and work out who’s really in B-12 from evidence, not a guess. |
| Chips | Three.js · React Three Fiber · TypeScript |
| Primary pill | **Try it live** → https://harbor-desk-buffalo-rssdesign.vercel.app/ |
| Secondary pill | **Source** → https://github.com/RSSDesign9/harbor-desk-buffalo (public) |

Shorter description, if you'd rather not mention your hometown (151 characters): *A 3D slip desk for a Buffalo River marina. Drag a boat onto a slip that fits, test it against a Lake Erie gale, and settle who's in B-12 on evidence.*

## Files

| From this package | To the portfolio repo | Notes |
|---|---|---|
| `../video/harbor-desk-card-1600.mp4` | `assets/media/harbor-desk-1600.mp4` | 1600×1000, 28 s loop, H.264, about 1.1 Mbit/s (3.8 MB), no audio. In line with the other cards (1.1–1.3 Mbit/s). |
| `../video/harbor-desk-card-poster.jpg` | `assets/img/pg-poster-harbor-desk.jpg` | First beat of the loop. It is what reduced-motion visitors see: `playground.js` doesn't autoplay under `prefers-reduced-motion`. |
| `card.html` | paste into `experiments/index.html`, inside `<div class="pg-list">` | Suggested first, as the newest. The card's aspect ratio is `--ar:1.6`. |

## Placement

**First in the carousel.** Seen through the eyes of a picky product design hiring manager, Harbor Desk is the strongest product-design evidence on the page:
- a real place;
- named users and roles;
- a complete workflow with correct states (presence vs identity, append-only history, read-only replay);
- keyboard parity.

The other five read as 3D, brand and motion craft. Leading with it frames the page as a product designer's playground, not a demo reel, and the 3D Stadium Viewer right after it shows range in the same medium. The rest keep their order.

The page's counter is hard-coded (`Experiments<span>5</span>`) and becomes 6. The minimap is built from the rows by `playground.js`.

**Checked locally (16 Nov 2026):**
- The card was served inside the real `/experiments` page by a read-only local server, with no file in the portfolio repo changed.
- It renders as the first row at 1440×900, and the video loop plays.
- At 390 px the whole video links out, with the text below.
- Screenshots: `qa/handoff/card-preview-1440.png` and `card-preview-390.png`.

## What the loop shows (28 s)

| Time | Beat |
|---|---|
| 0–4 s | The opening move from the Overview to Dock B |
| 4–13 s | Map: the request dragged over A-01 (No fit), then D-01 (Fits), then dropped |
| 13–17 s | The SW gale what-if, seen from the Overview, with D-01 re-rated as tight |
| 17–22 s | Explore slip review: the camera flies to B-12, "Vessel present · identity unverified" |
| 22–28 s | Staff evidence → Confirm identity & resolve: "Lake Effect confirmed", agreement unchanged |

The cuts are 0.35 s crossfades. The loop seam goes from the resolved review back to the opening still.
