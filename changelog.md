# Changelog

## [Unreleased]

### Added
- Project scaffold: Vite + React + TypeScript, Tailwind 3 with strict design
  tokens (8px spacing grid, one radius scale, two shadows, monochrome ink ramp
  + single accent variable), self-hosted Satoshi + JetBrains Mono.
- Color science core: Apple Log transfer function (white paper constants),
  Apple Wide Gamut / Rec.709 matrices derived from published chromaticities,
  Oklab + CIE Lab conversions, CIEDE2000 color difference.
- Test-asset toolchain: zero-dependency PNG codec, color-checker and gradient
  generators, Apple Log 2 frame synthesizer, 15 curated Unsplash photos with
  credits.
- Look-matching engine: perceptual analysis in Oklab (tonal quantiles,
  split-tone band casts, saturation distribution), monotone-spline matching
  with slope limiting, camera-space tone mapping with wide highlight shoulder,
  ACES-style input gamut compression, chroma-toward-gray gamut mapping,
  adaptive lattice smoothing.
- `.cube` export (33³, strict serializer/parser/validator) and CPU LUT
  application; export filename per PRD pattern.
- Test suite covering acceptance criteria 1–5 (32 tests), with Apple's
  official LUTs as oracles and banding bars calibrated against Apple's own
  Log2→Rec709 LUT.
- App: landing with live sample demo, reference/footage upload, format
  select, Web Worker generation, WebGL 3D-texture preview with spring-damped
  before/after slider, shader film-developing reveal, strength blending,
  .cube download. Verified in Chromium, Firefox, WebKit (15 e2e tests) with
  a GPU-vs-CPU cross-check.
