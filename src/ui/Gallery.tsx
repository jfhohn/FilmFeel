/** Sample looks + sample footage — clicking one loads it (empty states teach). */
import ThumbGrid, { type Thumb } from "./ThumbGrid.tsx";

export interface SampleLook extends Thumb {}

/** Graded reference looks — evocative names, never a film title. */
export const SAMPLE_LOOKS: SampleLook[] = [
  { name: "halation", title: "HALATION", url: "/samples/projector.png" },
  { name: "golden-hour", title: "GOLDEN HOUR", url: "/samples/cloud-sunset.png" },
  { name: "polar-night", title: "POLAR NIGHT", url: "/samples/milkyway.png" },
  { name: "morning-fog", title: "MORNING FOG", url: "/samples/castle-fog.png" },
  { name: "low-key", title: "LOW KEY", url: "/samples/portrait-lowkey.png" },
  { name: "neon-rain", title: "NEON RAIN", url: "/samples/confetti.png" },
  { name: "blue-hour", title: "BLUE HOUR", url: "/samples/street-dusk.png" },
  { name: "warm-key", title: "WARM KEY", url: "/samples/portrait-warm.png" },
  { name: "evergreen", title: "EVERGREEN", url: "/samples/forest.png" },
  { name: "deep-field", title: "DEEP FIELD", url: "/samples/galaxy.png" },
  { name: "stillwater", title: "STILLWATER", url: "/samples/lake-cabin.png" },
  { name: "glacier", title: "GLACIER", url: "/samples/moraine-lake.png" },
  { name: "night-sail", title: "NIGHT SAIL", url: "/samples/sailboat-night.png" },
  { name: "overcast", title: "OVERCAST", url: "/samples/fog-photographer.png" },
  { name: "slate", title: "SLATE", url: "/samples/clapperboard.png" },
];

export interface SampleFootage extends Thumb {}

/**
 * Apple Log 2 frames the user can grade — the raw "before" of each look above.
 * Order and names mirror SAMPLE_LOOKS so each grid cell lines up as a
 * before/after pair of the same scene.
 */
export const SAMPLE_FOOTAGE: SampleFootage[] = [
  { name: "halation", title: "HALATION", url: "/samples/projector_applelog2.png" },
  { name: "golden-hour", title: "GOLDEN HOUR", url: "/samples/cloud-sunset_applelog2.png" },
  { name: "polar-night", title: "POLAR NIGHT", url: "/samples/milkyway_applelog2.png" },
  { name: "morning-fog", title: "MORNING FOG", url: "/samples/castle-fog_applelog2.png" },
  { name: "low-key", title: "LOW KEY", url: "/samples/portrait-lowkey_applelog2.png" },
  { name: "neon-rain", title: "NEON RAIN", url: "/samples/confetti_applelog2.png" },
  { name: "blue-hour", title: "BLUE HOUR", url: "/samples/street-dusk_applelog2.png" },
  { name: "warm-key", title: "WARM KEY", url: "/samples/portrait-warm_applelog2.png" },
  { name: "evergreen", title: "EVERGREEN", url: "/samples/forest_applelog2.png" },
  { name: "deep-field", title: "DEEP FIELD", url: "/samples/galaxy_applelog2.png" },
  { name: "stillwater", title: "STILLWATER", url: "/samples/lake-cabin_applelog2.png" },
  { name: "glacier", title: "GLACIER", url: "/samples/moraine-lake_applelog2.png" },
  { name: "night-sail", title: "NIGHT SAIL", url: "/samples/sailboat-night_applelog2.png" },
  { name: "overcast", title: "OVERCAST", url: "/samples/fog-photographer_applelog2.png" },
  { name: "slate", title: "SLATE", url: "/samples/clapperboard_applelog2.png" },
];

export default function Gallery({ onPick, activeName }: { onPick: (s: SampleLook) => void; activeName: string | null }) {
  return (
    <ThumbGrid
      ariaLabel="Sample looks"
      heading="Try a look"
      hint="CLICK TO GRADE THE FRAME ABOVE"
      items={SAMPLE_LOOKS}
      onPick={onPick}
      activeName={activeName}
      testIdPrefix="look"
    />
  );
}
