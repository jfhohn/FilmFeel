# FilmFeel — Project Instructions (overrides root CLAUDE.md where stated)

## Mission
Build the product in PRD.md to completion. Verify every acceptance
criterion before declaring done. Write your own test suite for
functional criteria 1–5; run it before each milestone. Keep a running
BUILD_LOG.md of decisions and verification results — this becomes my
portfolio case study material, so write it clearly enough for a
non-engineer to follow.

Read PRD.md fully before any work. The Design & Craft section is a hard
requirement, not polish — "Simplicity First" does NOT apply to the visual
layer of this app. Beauty is a spec'd deliverable.

## Tech Stack (non-negotiable — chosen for visual quality; overrides workspace default)
- Vite + React + TypeScript + Tailwind, deployed to Vercel.
- No backend, fully client-side. NO Supabase, no auth, no database —
  images never leave the browser.
- NO component libraries (no shadcn, MUI, Chakra). Every component is bespoke.
- Tailwind ONLY with custom design tokens defined in the config
  (8px spacing grid, one radius scale, two shadows). No arbitrary values.
- Motion (Framer Motion) for all UI animation. Spring physics, not CSS ease.
- WebGL for the image pipeline: apply the LUT in a fragment shader so the
  before/after preview is GPU-accelerated and 60fps at full resolution.
- Typography: Satoshi or General Sans (Fontshare, free) for UI;
  JetBrains Mono for numeric readouts. Nothing else.

## Motion Design Spec
- Generation = "film developing": the graded image emerges over ~2.5s —
  starts dark and grainy, grain settles, color blooms in. This is the
  signature moment; build it as a shader, not a CSS fade.
- Before/after slider: spring-damped drag, subtle film-perforation edge
  on the divider handle. Must feel physical.
- App load: title appears like a film title card (fade up from black,
  slight tracking-in of letterspacing).
- All other transitions: 150–200ms, subtle. Nothing bounces.
- Respect prefers-reduced-motion throughout.

## Test Assets (bootstrap these yourself — test-assets/ starts empty)
- Ground truth for Apple Log 2: the white paper + Apple's official LUTs
  in test-assets/ if present. If absent, derive the transfer function from
  published Apple Log parameters and STOP to ask me to download Apple's
  official LUT before declaring criterion 2 (identity round-trip) verified.
- Synthesize log test frames: take Rec.709 images and inverse-encode them
  to Apple Log 2 using the white paper's transfer function. Known ground
  truth makes verification exact.
- Generate color checker charts and smooth gradients in code for the
  identity round-trip and banding tests.
- Fetch 6–8 freely licensed cinematic photos (Pexels/Unsplash) for the
  reference-matching test set and the shipped landing gallery.
- NEVER ship copyrighted film stills in the public gallery. Demo looks are
  named evocatively ("Neon Noir"), not after films.
- Leave a placeholder flow for real Apple Log 2 iPhone frames — I'll add
  them before launch.

## Graphics Policy
- NO stock illustrations, NO AI-generated decorative art, NO gradients-as-decoration.
- The imagery IS the graphics: ship 4–6 stunning sample before/after pairs
  (from the freely licensed set above) as the landing gallery. A subtle film-grain overlay
  (animated, ~3% opacity) and gentle vignette are the only ornamentation.

## Standing approvals (this project only — overrides "Ask Before Acting")
You are pre-authorized to: scaffold the project, add the dependencies
listed above, and make multi-file changes that implement PRD.md —
without checking in. Still stop and ask before: deviating from the PRD,
deleting prior work, adding dependencies NOT listed above, or anything
involving accounts/payments/analytics.

## Design Process (do this in order)
1. Before writing app code, produce 3 distinct landing-page art directions
   as static HTML mockups. Screenshot all 3, critique each against the
   Design & Craft section of PRD.md, and proceed with the strongest
   (tell me which and why — one paragraph).
2. After every UI milestone: screenshot all states, critique with vision
   against the PRD, iterate until zero violations.
3. Final "taste pass": review the app at 3 viewport sizes purely for beauty —
   alignment, rhythm, contrast. No functional changes allowed.

## Verification = PRD acceptance criteria
Both tables in PRD.md (functional 1–6 and visual D1–D5) must pass before
"done." Update BUILD_LOG.md with decisions + verification results as you go.