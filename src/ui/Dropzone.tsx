/** Styled, accessible file dropzone — no browser-default file input visible. */
import { useRef, useState } from "react";

export interface DropzoneProps {
  label: string;
  hint: string;
  thumbUrl: string | null;
  onFile: (file: File) => void;
  testId: string;
}

export default function Dropzone({ label, hint, thumbUrl, onFile, testId }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (files: FileList | null) => {
    const f = files?.[0];
    if (f && f.type.startsWith("image/")) onFile(f);
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
      className={`group relative flex h-12 w-full items-center gap-2 overflow-hidden rounded-md border border-dashed px-2 text-left transition-colors ${
        over ? "border-accent bg-ink-850" : "border-ink-700 bg-ink-900 hover:border-ink-500"
      }`}
      data-testid={testId}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={label}
        onChange={(e) => take(e.target.files)}
        data-testid={`${testId}-input`}
      />
      {thumbUrl ? (
        <img src={thumbUrl} alt="" className="h-8 w-12 rounded-sm object-cover" />
      ) : (
        <span
          className="flex h-8 w-12 items-center justify-center rounded-sm bg-ink-850 font-mono text-sm text-ink-500"
          aria-hidden
        >
          +
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-100">{label}</span>
        <span className="block truncate font-mono text-xs text-ink-400">{hint}</span>
      </span>
    </button>
  );
}
