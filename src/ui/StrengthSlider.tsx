/** Strength slider with tabular mono readout. */

export interface StrengthSliderProps {
  value: number; // 0..1
  onChange: (v: number) => void;
}

export default function StrengthSlider({ value, onChange }: StrengthSliderProps) {
  return (
    <label className="flex w-full items-center gap-2">
      <span className="font-mono text-xs tracking-widest text-ink-400">STRENGTH</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="strength-range min-w-0 flex-1"
        style={{ "--fill": `${Math.round(value * 100)}%` } as React.CSSProperties}
        aria-label="Look strength"
        data-testid="strength"
      />
      <span className="w-6 text-right font-mono text-xs text-ink-100">{Math.round(value * 100)}%</span>
    </label>
  );
}
