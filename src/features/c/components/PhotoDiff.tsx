"use client";

import { useEffect, useRef, useState } from "react";
import { comparePhotos, type DiffResult } from "../photoDiff";
import { reviewConditionChange } from "../actions";
import { NoteButtons } from "./NoteButtons";

const WORK_W = 320; // analysis width in pixels; the display is scaled up with CSS

type Review = { verdict: string; note: string | null; by: string; at: string } | null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load photo"));
    img.src = src;
  });
}

/** Draws img into a w x h canvas, cropping like object-fit: cover, and returns its pixels. */
function pixels(img: HTMLImageElement, w: number, h: number): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return ctx.getImageData(0, 0, w, h).data;
}

function paint(canvas: HTMLCanvasElement | null, w: number, h: number, data: Uint8ClampedArray) {
  if (!canvas) return;
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
}

function heatImage(r: DiffResult): Uint8ClampedArray {
  const out = new Uint8ClampedArray(r.width * r.height * 4);
  for (let i = 0; i < r.heat.length; i++) {
    const v = r.heat[i];
    const o = i * 4;
    if (Number.isNaN(v)) { out[o + 3] = 0; continue; }
    const t = Math.min(1, v * 2.5);
    out[o] = 255;
    out[o + 1] = Math.round(220 * (1 - t));
    out[o + 2] = 0;
    out[o + 3] = Math.round(200 * t);
  }
  return out;
}

export function PhotoDiff({
  bookingId,
  before,
  after,
  canReview,
  review,
}: {
  bookingId: string;
  before: string[];
  after: string[];
  canReview: boolean;
  review: Review;
}) {
  const [bi, setBi] = useState(0);
  const [ai, setAi] = useState(0);
  const [sensitivity, setSensitivity] = useState(0.6);
  const [showHeat, setShowHeat] = useState(true);
  const [result, setResult] = useState<DiffResult | null>(null);
  const [beforePx, setBeforePx] = useState<Uint8ClampedArray | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
  const heatRef = useRef<HTMLCanvasElement>(null);
  const alignCache = useRef<{ key: string; t: DiffResult["transform"]; score: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    (async () => {
      try {
        const [b, a] = await Promise.all([loadImage(before[bi]), loadImage(after[ai])]);
        const w = WORK_W;
        const h = Math.round((w * b.naturalHeight) / b.naturalWidth);
        const pb = pixels(b, w, h);
        const pa = pixels(a, w, h);
        // Let the "Analysing" state paint before the heavy work starts.
        await new Promise((r) => setTimeout(r, 30));
        const key = `${before[bi]}|${after[ai]}`;
        const known = alignCache.current?.key === key ? alignCache.current : undefined;
        const r = comparePhotos(pb, pa, w, h, sensitivity, known);
        alignCache.current = { key, t: r.transform, score: r.alignScore };
        if (!cancelled) { setBeforePx(pb); setResult(r); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Analysis failed");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [before, after, bi, ai, sensitivity]);

  useEffect(() => {
    if (!result || !beforePx) return;
    paint(beforeRef.current, result.width, result.height, beforePx);
    paint(afterRef.current, result.width, result.height, result.aligned);
    paint(heatRef.current, result.width, result.height, heatImage(result));
  }, [result, beforePx]);

  const t = result?.transform;
  const moved = t && (Math.abs(t.dx) > 0.005 || Math.abs(t.dy) > 0.005 || Math.abs(t.angle) > 0.4 || Math.abs(t.scale - 1) > 0.01);
  const summary = result
    ? `${result.regions.length} possible change${result.regions.length === 1 ? "" : "s"}, similarity ${(result.ssim * 100).toFixed(0)}%`
    : "";

  const pick = (label: string, list: string[], value: number, set: (n: number) => void) =>
    list.length > 1 && (
      <label className="text-sm">
        {label}{" "}
        <select value={value} onChange={(e) => set(Number(e.target.value))} className="ml-1 rounded border p-1">
          {list.map((_, i) => <option key={i} value={i}>Photo {i + 1}</option>)}
        </select>
      </label>
    );

  return (
    <section aria-labelledby="photo-diff-title" className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="photo-diff-title" className="text-[16px] font-semibold">Before/After photo check</h3>
          <p className="text-xs text-ink-2">
            Lines up the return photo with the check-in photo, then marks areas that look different (SSIM image comparison).
          </p>
        </div>
        <span className="chip chip-warn">Possible changes, not proof</span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {pick("Check-in", before, bi, setBi)}
        {pick("Return", after, ai, setAi)}
        <label className="flex items-center gap-2 text-sm">
          Sensitivity
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            defaultValue={sensitivity}
            onPointerUp={(e) => setSensitivity(Number(e.currentTarget.value))}
            onKeyUp={(e) => setSensitivity(Number(e.currentTarget.value))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} /> Show heat map
        </label>
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <figure>
          <figcaption className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">At check-in</figcaption>
          <canvas ref={beforeRef} className="w-full rounded-lg border border-line bg-surface-2" aria-label="Check-in photo" />
        </figure>
        <figure>
          <figcaption className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">At return, aligned</figcaption>
          <div className="relative">
            <canvas ref={afterRef} className="w-full rounded-lg border border-line bg-surface-2" aria-label="Return photo aligned to the check-in photo" />
            <canvas ref={heatRef} className={`pointer-events-none absolute inset-0 h-full w-full rounded-lg ${showHeat ? "opacity-70" : "opacity-0"}`} aria-hidden />
            {result?.regions.map((r, i) => (
              <div
                key={i}
                className="pointer-events-none absolute rounded border-2 border-red-600"
                style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
              >
                <span className="absolute -top-5 left-0 rounded bg-red-600 px-1 text-[10px] font-bold text-white">{i + 1}</span>
              </div>
            ))}
            {busy && <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70 text-sm">Analysing…</div>}
          </div>
        </figure>
      </div>

      {result && (
        <div className="space-y-1 text-sm">
          <p><strong>{summary}.</strong> {result.regions.length === 0 ? "No area stands out at this sensitivity." : "Red boxes mark the areas to inspect."}</p>
          <p className="text-ink-2">
            {moved
              ? `Camera moved between photos, so the return photo was shifted ${(t!.dx * 100).toFixed(1)}% sideways and ${(t!.dy * 100).toFixed(1)}% vertically, rotated ${t!.angle.toFixed(1)}° and zoomed ${(t!.scale * 100).toFixed(0)}% to line up.`
              : "Both photos were taken from about the same spot; no alignment was needed."}{" "}
            Alignment match {(result.alignScore * 100).toFixed(0)}%{result.alignScore < 0.6 ? ", which is low: the photos may show different views, so treat the result with care" : ""}.
          </p>
          <p className="text-xs text-ink-3">
            A difference in pixels is not proof of damage. Lighting, reflections, shadows, moved cables or a different view also show up here. A person decides.
          </p>
        </div>
      )}

      {review && (
        <p className="rounded-lg bg-surface-2 p-2 text-sm">
          <strong>Reviewed by {review.by}</strong> ({review.at}): {review.verdict === "DAMAGE" ? "confirmed real damage" : "not damage"}
          {review.note ? `, “${review.note}”` : ""}
        </p>
      )}

      {canReview && result && (
        <div className="border-t border-line pt-3">
          <p className="mb-2 text-sm font-semibold">Your review of the marked areas</p>
          <NoteButtons
            label="What did you see? (at least 5 characters)"
            buttons={[
              {
                label: "Confirm: real damage",
                className: "bg-red-700 hover:bg-red-800",
                run: (note) => reviewConditionChange(bookingId, { verdict: "DAMAGE", note, regions: result.regions.length, ssim: result.ssim }),
              },
              {
                label: "Not damage (light, angle, clutter)",
                className: "bg-gray-700 hover:bg-gray-800",
                run: (note) => reviewConditionChange(bookingId, { verdict: "NO_DAMAGE", note, regions: result.regions.length, ssim: result.ssim }),
              },
            ]}
          />
        </div>
      )}
    </section>
  );
}
