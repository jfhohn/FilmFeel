/** Sample looks — clicking one loads it as the reference (empty states teach). */
import { motion } from "framer-motion";

export interface SampleLook {
  name: string;
  /** evocative display name, never a film title */
  title: string;
  url: string;
}

export const SAMPLE_LOOKS: SampleLook[] = [
  { name: "halation", title: "HALATION", url: "/samples/projector.png" },
  { name: "golden-hour", title: "GOLDEN HOUR", url: "/samples/cloud-sunset.png" },
  { name: "polar-night", title: "POLAR NIGHT", url: "/samples/milkyway.png" },
  { name: "morning-fog", title: "MORNING FOG", url: "/samples/castle-fog.png" },
  { name: "low-key", title: "LOW KEY", url: "/samples/portrait-lowkey.png" },
  { name: "neon-rain", title: "NEON RAIN", url: "/samples/confetti.png" },
];

export default function Gallery({ onPick, activeName }: { onPick: (s: SampleLook) => void; activeName: string | null }) {
  return (
    <section aria-label="Sample looks" className="w-full">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-widest text-ink-400">Try a look</h2>
        <span className="font-mono text-xs text-ink-500">CLICK TO GRADE THE FRAME ABOVE</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {SAMPLE_LOOKS.map((s) => (
          <motion.button
            key={s.name}
            type="button"
            onClick={() => onPick(s)}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.15 }}
            className={`group relative aspect-photo overflow-hidden rounded-sm shadow-low ${
              activeName === s.name ? "ring-1 ring-accent" : "ring-1 ring-ink-700"
            }`}
            data-testid={`look-${s.name}`}
          >
            <img src={s.url} alt={`${s.title} sample look`} className="h-full w-full object-cover" loading="lazy" />
            <span className="caption-shadow absolute bottom-1 left-1 font-mono text-xs tracking-widest text-ink-50">
              {s.title}
            </span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
