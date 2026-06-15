# Open Decision 0001 — Input format & overexposed LUTs

**Status:** OPEN — under discussion, no code changed yet. Do NOT start undoing the
Apple Log path until Jacob decides a direction.
**Date raised:** 2026-06-14
**Owner:** Jacob (PM decision)
**Context:** Found while verifying the live deploy (https://film-feel.vercel.app).

---

## The symptom

Generated LUTs look "janky, overexposed, bad" on certain reference/footage
combinations — reported on both Chrome desktop and Safari on iPhone. The page
itself loads and runs fine; the problem is the *output grade quality*, not the
deployment.

## Root cause (confirmed in code)

**A web browser never gives an app RAW or log data.** When any image is loaded
into a web page — JPG, PNG, *or even a `.dng` in Safari* — the browser decodes it
to ordinary display-referred Rec.709/sRGB pixels before the app can read it. The
log/RAW encoding is gone before FilmFeel's code sees a single pixel. (This is why
the `.dng` Jacob opened in Safari "looked like Rec.709, not raw" — Safari rendered
it to a display image. There is no browser API for the raw sensor/log data.)

FilmFeel's engine assumes otherwise. In `src/engine/image.ts`, `decodePixel()`
with format `"applelog2"` runs `appleLogDecode()` to *undo* a log curve:

- Apple Log packs ~12 stops into 0–1 (scene-white ≈ 0.68 encoded, speculars = 1.0).
- Feed it a normal photo, where bright areas are already near 1.0, and it
  interprets those brights as 12 stops of scene light and explodes them.
- Result: blown-out highlights → the "overexposed" look.

You're un-bending a curve that was never applied.

## Why this was not caught earlier

- **The built-in demo looks perfect** because its sample footage
  (`public/samples/cloud-sunset_applelog2.png`) is a *synthetic* file that
  genuinely contains Apple-Log-encoded values. Real user uploads do not.
- **The test suite passes (criterion 2 identity round-trip, etc.)** because the
  tests synthesize true log frames in memory and feed them straight to the engine,
  bypassing the browser image-decode step. The color **math is correct**; the
  real-world **input assumption** is what breaks.

## Secondary cause (smaller)

Even in correct Rec.709 mode, reference-matching is only as good as the pairing.
A very dissimilar reference (e.g. a neon-night look onto a bright alpine frame)
will always yield an extreme grade — inherent to "match any look." The strength
slider is the intended mitigation (dial back from 100%).

## Implication for the how-to guide (Jacob's original worry)

With the current design, an honest guide would have to say "export your footage as
Apple-Log-encoded data" — which users *cannot do through a browser*. So the Apple
Log selector is, for a normal user, a trap that produces the bad results. The
**Rec.709 path works correctly**, because there the app's assumption (display-
referred pixels) matches what the browser actually provides. This is also the
fallback the PRD already anticipated: *"if color accuracy fails after one iteration
loop, narrow to Rec.709→Rec.709 matching before abandoning."*

## Options on the table

**A — Pivot MVP to Rec.709 input (recommended).** Make Rec.709/sRGB (normal
JPG/PNG) the primary, default, and for-now-only input. Reframe the promise as
"match any look onto your photo/footage frame." Hide or de-emphasize the Apple Log
selector. Keep the Apple Log math in the codebase for later. Removes the
overexposure bug class; simplest honest how-to; matches the PRD fallback.

**B — Keep Apple Log + add a mismatch guard.** Detect whether an uploaded "Apple
Log" frame actually looks log-like (low-contrast/milky, values ~0.15–0.68 with no
true blacks) vs Rec.709 (full 0–1 range with real blacks). Warn if it looks like
the user picked the wrong format. Reduces footguns; does not solve that users
can't easily produce log frames in-browser. More work.

**C — Document a pro log-export workflow.** Keep Apple Log as-is and write a guide
for producing a genuine log-encoded PNG (e.g. DaVinci Resolve, tone-mapping off).
Pro-only, high friction, conflicts with the "under 2 minutes, zero instructions"
goal.

## Recommendation

Option A, optionally adding B's gentle mismatch warning later. It makes the demo's
quality reproducible for real users and keeps the good Apple Log math for a future
version that has a real way to feed it log data.

## Verified working on the live deploy (so we know the rest is solid)

Demo auto-generates; all assets load (zero failed requests); gallery look-switch,
before/after slider drag, and `.cube` export all work. Exported
`FilmFeel_NeonRain_AppleLog2_33.cube` validated on disk: correct header,
`LUT_3D_SIZE 33`, exactly 35,937 data lines (33³). Criteria 1 and 6 hold on the
live site. The only thing in question is the input-format/color premise above.

## Next step

Resume the discussion with Jacob, pick a direction, THEN implement on a branch
(main auto-deploys to production — see [[filmfeel-deployed-vercel]]).
