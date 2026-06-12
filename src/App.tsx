import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Viewer from "./ui/Viewer.tsx";
import Dropzone from "./ui/Dropzone.tsx";
import StrengthSlider from "./ui/StrengthSlider.tsx";
import Gallery, { type SampleLook } from "./ui/Gallery.tsx";
import { loadImage, type LoadedImage } from "./lib/images.ts";
import { downloadCube } from "./lib/exportCube.ts";
import { exportFilename, type Lut3D } from "./engine/lut.ts";
import type { InputFormat } from "./engine/image.ts";
import type { GenerateRequest, GenerateResponse } from "./engine/worker.ts";
import { gpuCheck } from "./gl/gpuCheck.ts";
import { serializeCube } from "./engine/lut.ts";
import { lutAtStrength } from "./lib/exportCube.ts";

type Phase = "boot" | "ready" | "generating" | "graded";

const DEMO_FOOTAGE = "/samples/cloud-sunset_applelog2.png";
const DEMO_REFERENCE = "/samples/cloud-sunset.png";

interface Luts {
  base: Lut3D;
  look: Lut3D;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [footage, setFootage] = useState<LoadedImage | null>(null);
  const [reference, setReference] = useState<LoadedImage | null>(null);
  const [isDemoFootage, setIsDemoFootage] = useState(true);
  const [format, setFormat] = useState<InputFormat>("applelog2");
  const [luts, setLuts] = useState<Luts | null>(null);
  const [strength, setStrength] = useState(1);
  const [lookName, setLookName] = useState("Golden Hour");
  const [revealKey, setRevealKey] = useState(0);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    const w = new Worker(new URL("./engine/worker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;
    return () => w.terminate();
  }, []);

  const generate = useCallback(
    (ref: LoadedImage, src: LoadedImage, fmt: InputFormat, reveal = true) => {
      const w = workerRef.current;
      if (!w || pendingRef.current) return;
      pendingRef.current = true;
      setPhase("generating");
      setError(null);
      const started = performance.now();
      const req: GenerateRequest = {
        kind: "generate",
        format: fmt,
        reference: { ...ref.analysis, pixels: ref.analysis.pixels.slice() },
        footage: { ...src.analysis, pixels: src.analysis.pixels.slice() },
      };
      w.onmessage = (e: MessageEvent<GenerateResponse>) => {
        pendingRef.current = false;
        const { base, look } = e.data;
        setLuts({
          base: { size: base.size, data: base.data, title: "base" },
          look: { size: look.size, data: look.data, title: "look" },
        });
        setElapsed(performance.now() - started);
        setPhase("graded");
        if (reveal) setRevealKey((k) => k + 1);
      };
      w.onerror = () => {
        pendingRef.current = false;
        setPhase("ready");
        setError("Generation failed — try a different image.");
      };
      w.postMessage(req, [req.reference.pixels.buffer, req.footage.pixels.buffer]);
    },
    [],
  );

  // boot: load the sample demo (empty states teach — never a blank dropzone)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [src, ref] = await Promise.all([
          loadImage(DEMO_FOOTAGE, "Sample frame (Apple Log 2)"),
          loadImage(DEMO_REFERENCE, "Golden Hour"),
        ]);
        if (!alive) return;
        setFootage(src);
        setReference(ref);
        setPhase("ready");
        generate(ref, src, "applelog2", false);
      } catch {
        if (alive) setError("Couldn't load the sample demo.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [generate]);

  const onReferenceFile = useCallback(
    async (file: File) => {
      try {
        const img = await loadImage(file);
        setReference(img);
        setActiveSample(null);
        setLookName(img.name.replace(/\.[a-z0-9]+$/i, ""));
        if (footage) generate(img, footage, format);
      } catch {
        setError("Couldn't read that image — try a JPEG or PNG.");
      }
    },
    [footage, format, generate],
  );

  const onFootageFile = useCallback(
    async (file: File) => {
      try {
        const img = await loadImage(file);
        setFootage(img);
        setIsDemoFootage(false);
        if (reference) generate(reference, img, format);
      } catch {
        setError("Couldn't read that image — try a JPEG or PNG.");
      }
    },
    [reference, format, generate],
  );

  const onFormatChange = useCallback(
    (fmt: InputFormat) => {
      setFormat(fmt);
      if (reference && footage) generate(reference, footage, fmt);
    },
    [reference, footage, generate],
  );

  const onPickSample = useCallback(
    async (s: SampleLook) => {
      try {
        const img = await loadImage(s.url, s.title);
        setReference(img);
        setActiveSample(s.name);
        setLookName(s.title.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()));
        if (footage) generate(img, footage, format);
      } catch {
        setError("Couldn't load that look.");
      }
    },
    [footage, format, generate],
  );

  const filename = useMemo(() => exportFilename(lookName, format), [lookName, format]);

  const onExport = useCallback(() => {
    if (!luts) return;
    downloadCube(luts.base, luts.look, strength, lookName, format);
  }, [luts, strength, lookName, format]);

  const generating = phase === "generating";

  // expose state + checks for the Playwright verification suite
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__filmfeel = {
      luts,
      strength,
      phase,
      gpuCheck: luts ? () => gpuCheck(luts.base, luts.look, strength) : null,
      cubeText: luts ? () => serializeCube(lutAtStrength(luts.base, luts.look, strength, lookName)) : null,
    };
  }, [luts, strength, phase, lookName]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-screen-lg flex-col px-3 sm:px-5">
      {/* grain + vignette: the only ornamentation */}
      <div className="grain" aria-hidden />
      <div className="vignette" aria-hidden />

      <header className="flex items-baseline justify-between py-3">
        <motion.h1
          initial={{ opacity: 0, letterSpacing: "0.4em" }}
          animate={{ opacity: 1, letterSpacing: "0.16em" }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          className="text-base font-semibold uppercase tracking-widest"
        >
          Film<span className="text-accent">Feel</span>
        </motion.h1>
        <span className="hidden font-mono text-xs tracking-widest text-ink-500 sm:inline">
          <span className="text-accent">●</span> LOCAL — IMAGES NEVER LEAVE YOUR BROWSER
        </span>
        <span className="font-mono text-xs tracking-widest text-ink-500 sm:hidden">
          <span className="text-accent">●</span> LOCAL
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="pb-4 pt-2 text-center"
        >
          <h2 className="text-xl font-medium text-ink-100 sm:text-2xl">
            Any look you can point at,
            <br />
            <span className="font-normal text-ink-400">graded onto your footage.</span>
          </h2>
          <p className="mt-2 text-sm text-ink-400">
            Upload a reference image. Get a <b className="font-medium text-ink-100">.cube LUT</b> built for{" "}
            <b className="font-medium text-ink-100">Apple Log 2</b>.
          </p>
        </motion.div>

        <Viewer
          footage={footage?.bitmap ?? null}
          luts={luts}
          strength={strength}
          revealKey={revealKey}
          beforeLabel={format === "applelog2" ? "LOG · UNGRADED" : "ORIGINAL"}
          afterLabel={generating ? "DEVELOPING…" : lookName.toUpperCase()}
        />

        {/* readout */}
        <div className="flex w-full flex-wrap justify-center gap-3 py-2 font-mono text-xs tracking-wide text-ink-500">
          <span>
            FORMAT <span className="text-ink-200">{format === "applelog2" ? "APPLE LOG 2 → REC.709" : "REC.709 → REC.709"}</span>
          </span>
          <span>
            LUT <span className="text-ink-200">33×33×33</span>
          </span>
          {elapsed !== null && (
            <span data-testid="gen-time">
              GENERATED IN <span className="text-ink-200">{(elapsed / 1000).toFixed(1)}S</span>
            </span>
          )}
        </div>

        {/* controls */}
        <section className="grid w-full grid-cols-1 gap-2 py-2 sm:grid-cols-2" aria-label="Inputs">
          <Dropzone
            label="Reference image"
            hint={reference ? reference.name : "the look you want"}
            thumbUrl={reference?.url ?? null}
            onFile={onReferenceFile}
            testId="drop-reference"
          />
          <Dropzone
            label="Your footage frame"
            hint={footage ? (isDemoFootage ? "sample frame — drop yours" : footage.name) : "a still from your video"}
            thumbUrl={footage?.url ?? null}
            onFile={onFootageFile}
            testId="drop-footage"
          />
        </section>

        <section className="flex w-full flex-wrap items-center gap-3 py-2" aria-label="Settings">
          <div className="flex items-center gap-1 rounded-md bg-ink-900 p-px" role="radiogroup" aria-label="Footage format">
            {(
              [
                ["applelog2", "APPLE LOG 2"],
                ["rec709", "REC.709"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={format === value}
                onClick={() => onFormatChange(value)}
                className={`rounded-md px-2 py-1 font-mono text-xs tracking-widest transition-colors ${
                  format === value ? "bg-ink-700 text-ink-50" : "text-ink-400 hover:text-ink-200"
                }`}
                data-testid={`format-${value}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <StrengthSlider value={strength} onChange={setStrength} />
          </div>
        </section>

        {/* export moment */}
        <section className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md bg-ink-900 p-2 shadow-low" aria-label="Export">
          <label className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-xs tracking-widest text-ink-400">LOOK</span>
            <input
              value={lookName}
              onChange={(e) => setLookName(e.target.value)}
              className="w-24 rounded-sm border border-ink-700 bg-ink-850 px-1 py-px text-sm text-ink-100 sm:w-32"
              aria-label="Look name"
              data-testid="look-name"
            />
            <span className="hidden truncate font-mono text-xs text-ink-500 sm:block" data-testid="filename">
              {filename}
            </span>
          </label>
          <motion.button
            type="button"
            onClick={onExport}
            disabled={!luts || generating}
            whileTap={{ scale: 0.985 }}
            className="rounded-md bg-accent px-3 py-1 text-sm font-semibold text-ink-950 transition-opacity disabled:opacity-40"
            data-testid="export"
          >
            {generating ? "Developing…" : "Download .cube"}
          </motion.button>
        </section>

        {error && (
          <p role="alert" className="py-1 text-sm text-accent">
            {error}
          </p>
        )}

        <div className="w-full py-4">
          <Gallery onPick={onPickSample} activeName={activeSample} />
        </div>
      </main>

      <footer className="flex items-baseline justify-between border-t border-ink-800 py-2 font-mono text-xs text-ink-500">
        <span>FILMFEEL 0.1 — A PATRON-MODE BUILD</span>
        <span>WORKS IN CHROME · SAFARI · FIREFOX</span>
      </footer>
    </div>
  );
}
