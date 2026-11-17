# Harbor Desk — showcase package (T22)

Everything needed to present Harbor Desk in the **Experiments** section of rssdesign.org (`/experiments`), plus the longer portfolio copy and local pitch notes. Nothing here ships in the app's build. The pitch notes stay local and are not in the public repository.

| Item | What it is |
|---|---|
| [experiments-card/](experiments-card/README.md) | The `/experiments` card: copy, chips, markup, media mapping, placement |
| [CASE-STUDY.md](CASE-STUDY.md) | Portfolio copy: craft, the evidence model, problem and hypothesis, users, why spatial, data decisions, what works, what's simulated, next research step, alt text |
| `video/harbor-desk-walkthrough-1600.mp4` | 77 s captioned walkthrough at 1600×1000 (cut list below) |
| `video/harbor-desk-card-1600.mp4` · `video/harbor-desk-card-poster.jpg` | 28 s uncaptioned loop and its poster, for the card |
| `video/*-marks.json` | Beat timings of each take |
| `stills/01-overview` … `05-resolved` (`.png`, `@2x.png`) | 1600×1000 and 3200×2000 stills from the production build on the real GPU |
| `stills/contact-sheet.jpg` | The five stills in order: the reduced-motion viewing option |
| `pitch/` | One-page notes per company. **Local only:** kept out of the public repository. |

## Walkthrough cut

PRD §15 order: poster → establishing move → drag-to-assign (+ the lake what-if) → scrubber → dock-walk review → resolve.

| Beat | Starts | What happens |
|---|---|---|
| Opening | 0:00 | Poster still → the 3 s move to Dock B |
| Assign | 0:07 | Northern Tern opened from Tasks. Map preset; drag over A-01 (No fit), then D-01 (Fits); drop; the boat sails in |
| What-if | 0:22 | Conditions & what-if → SW gale. Verdicts re-checked, then the gale from the Overview; back to Calm |
| Scrubber | 0:32 | Demo controls → drag the Day timeline to 20:00 and back (read-only), then Return to my run |
| Review | 0:46 | Explore slip review → B-12: "Vessel present · identity unverified" → Review observation → Load the dock-check result |
| Resolve | 1:05 | Acknowledge → Confirm identity & resolve → agreement unchanged → Activity history |

The **Demo data** label stays in frame throughout. Captions and the pointer are drawn by the recording script, not by the app.

## Reproduce

Requires macOS with a GPU (for `--gpu`), Node 24 and ffmpeg.

```bash
npm run build && npm run preview
```

```bash
node scripts/capture-showcase.ts --gpu
```

```bash
node scripts/record-walkthrough.ts --gpu
```

```bash
node scripts/record-walkthrough.ts --gpu --take card
```

Runs are deterministic in content (seeded data, scripted input) but not frame-identical, because the browser's screencast timing varies. Both scripts start from a fresh run each time.
