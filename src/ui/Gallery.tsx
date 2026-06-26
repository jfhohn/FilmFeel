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

/** Apple Log 2 frames the user can grade — descriptive scene labels. */
export const SAMPLE_FOOTAGE: SampleFootage[] = [
  { name: "castle-fog", title: "CASTLE FOG", url: "/samples/castle-fog_applelog2.png" },
  { name: "cloud-sunset", title: "CLOUD SUNSET", url: "/samples/cloud-sunset_applelog2.png" },
  { name: "milkyway", title: "MILKY WAY", url: "/samples/milkyway_applelog2.png" },
  { name: "portrait-lowkey", title: "LOW-KEY PORTRAIT", url: "/samples/portrait-lowkey_applelog2.png" },
  { name: "portrait-warm", title: "WARM PORTRAIT", url: "/samples/portrait-warm_applelog2.png" },
  { name: "street-dusk", title: "STREET DUSK", url: "/samples/street-dusk_applelog2.png" },
  { name: "forest", title: "FOREST", url: "/samples/forest_applelog2.png" },
  { name: "galaxy", title: "GALAXY", url: "/samples/galaxy_applelog2.png" },
  { name: "lake-cabin", title: "LAKE CABIN", url: "/samples/lake-cabin_applelog2.png" },
  { name: "moraine-lake", title: "MORAINE LAKE", url: "/samples/moraine-lake_applelog2.png" },
  { name: "sailboat-night", title: "NIGHT SAILBOAT", url: "/samples/sailboat-night_applelog2.png" },
  { name: "fog-photographer", title: "FOG WALK", url: "/samples/fog-photographer_applelog2.png" },
  { name: "projector", title: "PROJECTOR", url: "/samples/projector_applelog2.png" },
  { name: "confetti", title: "CONFETTI", url: "/samples/confetti_applelog2.png" },
  { name: "clapperboard", title: "CLAPPERBOARD", url: "/samples/clapperboard_applelog2.png" },
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
