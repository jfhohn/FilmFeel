/**
 * The hero: a cinema frame with a spring-damped before/after slider and the
 * film-developing reveal. The user's image is the largest thing on screen.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useMotionValue, useSpring } from "framer-motion";
import { LutRenderer } from "../gl/LutRenderer.ts";
import type { Lut3D } from "../engine/lut.ts";

export interface ViewerProps {
  footage: ImageBitmap | null;
  luts: { base: Lut3D; look: Lut3D } | null;
  strength: number;
  /** increments to retrigger the developing reveal */
  revealKey: number;
  beforeLabel: string;
  afterLabel: string;
}

const REVEAL_MS = 2500;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function Viewer({ footage, luts, strength, revealKey, beforeLabel, afterLabel }: ViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<LutRenderer | null>(null);
  const [glError, setGlError] = useState(false);
  const [ready, setReady] = useState(false);

  const splitRaw = useMotionValue(0.5);
  const split = useSpring(splitRaw, { stiffness: 380, damping: 38, mass: 0.6 });
  const strengthRef = useRef(strength);
  const revealStart = useRef<number>(-Infinity);
  const rafRef = useRef(0);

  strengthRef.current = strength;

  const draw = useCallback(() => {
    const r = rendererRef.current;
    if (!r) return;
    const now = performance.now();
    const revealT = Math.min(1, (now - revealStart.current) / REVEAL_MS);
    r.render({
      split: split.get(),
      strength: strengthRef.current,
      reveal: revealT,
      time: now / 1000,
    });
    // keep animating while the spring or the reveal is live
    const springActive = Math.abs(split.get() - splitRaw.get()) > 1e-4;
    if (revealT < 1 || springActive) {
      rafRef.current = requestAnimationFrame(draw);
    }
  }, [split, splitRaw]);

  const kick = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  // renderer lifecycle
  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      rendererRef.current = new LutRenderer(canvasRef.current);
    } catch {
      setGlError(true);
    }
    return () => {
      cancelAnimationFrame(rafRef.current);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  // content updates
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !footage || !luts) return;
    r.setFootage(footage, footage.width, footage.height);
    r.setLuts(luts.base, luts.look);
    setReady(true);
    kick();
  }, [footage, luts, kick]);

  // developing reveal
  useEffect(() => {
    if (revealKey === 0 || !ready) return;
    revealStart.current = prefersReducedMotion() ? -Infinity : performance.now();
    kick();
  }, [revealKey, ready, kick]);

  // strength / spring updates
  useEffect(() => {
    const unsub = split.on("change", kick);
    return unsub;
  }, [split, kick]);
  useEffect(() => {
    kick();
  }, [strength, kick]);

  // pointer drag on the whole frame
  const dragging = useRef(false);
  const posFromEvent = (e: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return Math.min(0.98, Math.max(0.02, (e.clientX - rect.left) / rect.width));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    splitRaw.set(posFromEvent(e));
    kick();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    splitRaw.set(posFromEvent(e));
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  // keyboard access on the divider
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === "ArrowLeft") splitRaw.set(Math.max(0.02, splitRaw.get() - step));
    else if (e.key === "ArrowRight") splitRaw.set(Math.min(0.98, splitRaw.get() + step));
    else return;
    e.preventDefault();
    kick();
  };

  const [divider, setDivider] = useState(0.5);
  useEffect(() => split.on("change", (v) => setDivider(v)), [split]);

  return (
    <div
      ref={wrapRef}
      className="relative aspect-scope w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-md shadow-high"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      data-testid="viewer"
    >
      {glError ? (
        <div className="flex h-full items-center justify-center bg-ink-900 text-sm text-ink-400">
          This preview needs WebGL2 — your browser has it disabled.
        </div>
      ) : (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" data-testid="viewer-canvas" />
      )}

      {!glError && ready && (
        <>
          {/* divider + perforated handle */}
          <div
            className="absolute inset-y-0 z-10 w-px bg-ink-50"
            style={{ left: `${divider * 100}%` }}
            aria-hidden
          />
          <div
            role="slider"
            aria-label="Before and after comparison"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(divider * 100)}
            tabIndex={0}
            onKeyDown={onKeyDown}
            className="absolute z-10 flex h-6 w-5 items-center justify-center gap-px rounded-sm bg-ink-50 shadow-low"
            style={{ left: `${divider * 100}%`, top: "50%", transform: "translate(-50%, -50%)" }}
            data-testid="viewer-handle"
          >
            <span className="perfs" aria-hidden />
            <span className="perfs" aria-hidden />
          </div>

          <span className="absolute bottom-2 left-2 z-10 rounded-sm bg-ink-950/70 px-1 py-px font-mono text-xs tracking-widest text-ink-400">
            {beforeLabel}
          </span>
          <span className="absolute bottom-2 right-2 z-10 rounded-sm bg-ink-950/70 px-1 py-px font-mono text-xs tracking-widest text-ink-100">
            <span className="text-accent">● </span>
            {afterLabel}
          </span>
        </>
      )}

      {!ready && !glError && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink-900">
          <span className="font-mono text-xs tracking-widest text-ink-500">LOADING SAMPLE…</span>
        </div>
      )}
    </div>
  );
}
