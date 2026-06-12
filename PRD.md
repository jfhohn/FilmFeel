# PRD: FilmFeel — Image-to-LUT Generator (Fable 5 Build)

<aside>
🎯

**FilmFeel** — upload a reference image → get a camera-format-aware `.cube` LUT that makes your footage feel like film.

**Meta-goal:** A portfolio showcase of *patron-mode* product management — a PM-grade spec in, a working product out of a single long-horizon Fable 5 run.

</aside>

# Problem Alignment

## Problem & Opportunity

Indie filmmakers and content creators need a way to recreate the color grade of any reference image in their own footage, because matching iconic looks today requires color-science expertise or expensive LUT packs that never quite fit their camera's format.

**Evidence:**

- Colorists asking how to create LUTs from reference images are told "there is no simple way to create a LUT from this" and that AI tools "won't give good results" ([r/ColorGrading](https://www.reddit.com/r/ColorGrading/comments/1fgclzd/how_do_i_create_my_own_luts_from_these_images_to/))
- Existing options force a trade-off: free tools require a manual HALD/Photoshop workflow ([IWLTBAP](https://generator.iwltbap.com/)); pro tools cost $99–250 with steep learning curves ([3D LUT Creator](https://3dlutcreator.com/)); AI entrants fall back to human experts for quality ([LUTBuilder.ai](http://LUTBuilder.ai))
- No mainstream tool is **camera-log-format-aware** (S-Log3, ARRI LogC, V-Log, etc.) — the output LUT rarely fits the user's actual footage pipeline

**Why now:** Fable 5 (June 2026) makes genuinely hard color science buildable by a solo builder — long-horizon autonomous coding with visual self-verification. The bottleneck has moved from engineering capacity to spec quality, which is exactly the skill this project demonstrates.

## High-Level Approach

A browser-based web app: upload a reference image + a frame of your own footage, select your camera's log format, and generate a downloadable `.cube` LUT with a before/after preview and strength slider. All processing runs locally in the browser (privacy + zero hosting cost for image data).

**Alternatives considered:**

- *Manual HALD workflow* — already exists, doesn't match a reference for you; high friction
- *LUT marketplace/pack* — doesn't solve format fit or "this exact look" need; crowded
- *Resolve plugin* — smaller audience, harder distribution; web reaches hobbyists where they are

## Goals

1. **Working MVP shipped** — a stranger can generate a usable LUT from a reference image in under 2 minutes
2. **Visible quality** — before/after results convincing enough to share publicly (the portfolio demo *is* the product demo)
3. **Documented PM process** — spec, acceptance criteria, and build log captured for the portfolio case study
4. *Guardrail:* keep MVP scope shippable in one–two Fable 5 runs; resist feature creep

## Non-Goals (MVP)

- ❌ All camera formats — MVP ships **one** log format (Apple Log 2 → Rec.709, since iPhone is the test camera); architecture must allow adding more
- ❌ `.3dl` export, mobile app, accounts/saved libraries, batch processing
- ❌ Monetization — validate desirability first
- ❌ Video processing — stills/frames only in MVP

---

# Solution Alignment

## Key Features (Plan of Record)

1. **Reference image upload** — drag & drop a film still, photo, or frame grab
2. **User footage frame upload** — a still frame from the user's own footage, tagged with its source format (MVP: Apple Log 2 or Rec.709)
3. **LUT generation engine** — match the reference's tonal curve + color palette and output a standard 33³ `.cube` LUT for the selected input format
4. **Before/after preview** — split-screen slider applying the generated LUT to the user's frame in real time
5. **Strength slider** — blend 0–100% between original and full match
6. **`.cube` export** — file imports cleanly into DaVinci Resolve, Premiere, and Final Cut

## Future Considerations

- Additional log formats (Sony S-Log3, ARRI LogC3/4, RED Log3G10, V-Log, C-Log3, BMD Film)
- Iconic-look preset library (film stocks, anime color scripts, game grades)
- `.3dl` export, DCI-P3 output, batch mode, shareable look links

## Key Flow

1. Land → see example before/after (instant comprehension)
2. Upload reference image → upload own frame → select input format
3. Generate → preview with slider → adjust strength
4. Download `.cube` → import into NLE

## Key Logic

- Input frames in log format must be linearized via the correct transfer function before analysis; output applies Rec.709 tone mapping
- Color matching operates on perceptual attributes (tonal curve, white balance, palette mapping, saturation distribution), not naive histogram matching
- Out-of-gamut values must be gracefully rolled off, never clipped to neon
- LUT must be smooth (no banding/posterization on gradients) — interpolation between nodes matters more than node count
- Everything client-side: no image ever leaves the browser

---

# Design & Craft

<aside>
✨

**Design POV:** FilmFeel is a product about taste — the app must demonstrate the taste it sells. The UI should feel like a piece of cinema equipment: dark, precise, and quiet, so the user's images are the loudest thing on screen.

</aside>

## Art Direction

- **Mood:** darkroom / color suite — near-black UI (never pure black), images glow like a calibrated monitor
- **References:** Halide (camera-tool precision), Letterboxd (film-lover warmth), A24's site (editorial restraint), [Frame.io](http://Frame.io) (pro video UI)
- **Typography:** one neutral grotesque for UI + tabular monospace for numeric readouts (LUT size, match scores); max two typefaces total
- **Color:** the chrome is monochrome — the only color on screen comes from user imagery and one accent color
- **Motion:** every transition under 200ms — except generation, deliberately styled as *film developing* (a 2–3 second reveal beats an instant pop)
- **Hero moment:** the before/after slider — buttery drag physics, subtle film-edge framing, this is the screenshot people will share

## Craft Principles

1. The user's image is always the largest element on screen
2. Empty states teach — the landing page opens with a live demo using sample frames, never a blank dropzone
3. No browser-default UI — file inputs, scrollbars, and focus states are styled (but remain accessible)
4. One spacing grid (8px), one radius scale, one shadow scale — consistency *is* the aesthetic
5. Sweat the export moment — the download should feel like a deliverable: `FilmFeel_LookName_AppleLog2_33.cube`

## Visual Acceptance Criteria (self-verified via screenshots)

| **#** | **Criterion** | **Verification** |
| --- | --- | --- |
| D1 | UI matches the art direction above | Screenshot every UI state, critique against this section with vision, iterate until zero violations |
| D2 | Spacing & typography consistency | Style audit: only values from the defined scales appear in computed styles |
| D3 | Accessibility floor | WCAG AA contrast, full keyboard flow, Lighthouse accessibility score 95+ |
| D4 | Slider performance | 60fps drag in a performance trace on a mid-range laptop — zero jank |
| D5 | Five-second test | A cold vision pass on the landing screenshot can state what the product does without reading docs |

---

# Fable 5 Execution Plan

<aside>
🤖

**Patron-mode protocol:** prescribe the *what* and the *definition of done*, not the *how*. Fable 5 plans its own implementation, writes its own tests, and visually verifies output against this spec.

</aside>

## Machine-Checkable Acceptance Criteria

| **#** | **Criterion** | **Verification** |
| --- | --- | --- |
| 1 | Exported `.cube` is spec-compliant 33³ | Parses without error in DaVinci Resolve (free version) and a `.cube` validator script |
| 2 | Identity round-trip: matching an image to itself yields a near-identity LUT | Max per-channel deviation from identity below defined epsilon |
| 3 | Color match accuracy | Mean ΔE00 between LUT-graded frame and reference palette targets under agreed threshold on a 10-image test set |
| 4 | No banding on gradients | Synthetic gradient test image shows no visible posterization after LUT application (visual self-check + variance metric) |
| 5 | Performance | Generation completes in under 10 seconds on a mid-range laptop, fully client-side |
| 6 | Usability | Upload → download flow completable with zero instructions; works in Chrome, Safari, Firefox |

## Required Build Artifacts

- Working app + source repo
- Self-written test suite covering criteria 1–5
- `PRD.md`, `changelog.md`, and a build log (for the portfolio case study)

---

# Experiment Plan (First Probe)

- **Goal:** prove Fable 5 can one-shot accurate color math from this spec
- **Hypothesis:** a single-format MVP generates a LUT that visually matches a reference film still and imports cleanly into Resolve
- **Build:** one-evening Fable 5 run from this PRD
- **Success signal:** side-by-side match accepted by eye + criteria 1, 2, and 6 pass
- **Pivot/persevere:** if color accuracy fails after one iteration loop, narrow to Rec.709→Rec.709 matching before abandoning

# Milestones

- [ ]  **Probe run** — single-format MVP from this spec (target: this week)
- [ ]  **Iteration pass** — fix gaps against acceptance criteria
- [ ]  **Craft pass** — dedicated design-only iteration against the visual acceptance criteria (no new features allowed)
- [ ]  **Polish + deploy** — public URL, example gallery
- [ ]  **Portfolio case study** — write the patron-mode PM narrative
- [ ]  **User probe** — share in r/colorists / r/videography for real feedback

# Risks & Open Questions

- **Color science depth:** Apple Log 2 linearization math must be exactly right — mitigated by identity round-trip + Apple's published Apple Log profile white paper (include it in the build folder as ground truth)
- **Demand assumption:** do hobbyists want reference-matching vs. buying packs? — validated cheaply by the Reddit share
- **Differentiation durability:** AI competitors will improve — speed matters; ship the MVP fast
- ~~Open: working product name~~ → **Resolved: FilmFeel** (check domain + social handle availability before public launch)