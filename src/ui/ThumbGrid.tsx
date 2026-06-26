/** Reusable thumbnail picker grid — shared by the look and footage galleries. */
import { motion } from "framer-motion";

export interface Thumb {
  name: string;
  /** evocative display name, never a film title */
  title: string;
  url: string;
}

export default function ThumbGrid<T extends Thumb>({
  ariaLabel,
  heading,
  hint,
  items,
  onPick,
  activeName,
  testIdPrefix,
}: {
  ariaLabel: string;
  heading: string;
  hint: string;
  items: readonly T[];
  onPick: (item: T) => void;
  activeName: string | null;
  testIdPrefix: string;
}) {
  return (
    <section aria-label={ariaLabel} className="w-full">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-widest text-ink-400">{heading}</h2>
        <span className="font-mono text-xs text-ink-500">{hint}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {items.map((s) => (
          <motion.button
            key={s.name}
            type="button"
            onClick={() => onPick(s)}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.15 }}
            className={`group relative aspect-photo overflow-hidden rounded-sm shadow-low ${
              activeName === s.name ? "ring-1 ring-accent" : "ring-1 ring-ink-700"
            }`}
            data-testid={`${testIdPrefix}-${s.name}`}
          >
            <img src={s.url} alt={`${s.title} sample`} className="h-full w-full object-cover" loading="lazy" />
            <span className="caption-shadow absolute bottom-1 left-1 font-mono text-xs tracking-widest text-ink-50">
              {s.title}
            </span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
