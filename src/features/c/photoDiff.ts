// Before/After Condition Intelligence: aligns a return photo to its check-in photo and
// finds regions that look different. Pure TypeScript (no OpenCV), so it runs in any browser.
// A visual difference is only a hint for a human reviewer, never proof of damage.

export type Transform = { dx: number; dy: number; scale: number; angle: number }; // dx, dy as a fraction of width; angle in degrees
export type Region = { x: number; y: number; w: number; h: number; score: number }; // fractions of the image size
export type DiffResult = {
  width: number;
  height: number;
  transform: Transform;
  alignScore: number; // normalised cross-correlation after alignment, -1..1
  ssim: number; // mean structural similarity over the overlapping area, 0..1
  changedPct: number; // share of the overlapping area flagged as changed
  regions: Region[];
  heat: Float32Array; // per pixel dissimilarity 0..1 (NaN outside the overlap)
  aligned: Uint8ClampedArray; // the after photo warped into the before frame (RGBA)
};

type Gray = { w: number; h: number; d: Float32Array };

const CELL = 8;

export function toGray(rgba: Uint8ClampedArray, w: number, h: number): Gray {
  const d = new Float32Array(w * h);
  for (let i = 0, j = 0; i < d.length; i++, j += 4) d[i] = (0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]) / 255;
  return { w, h, d };
}

function boxBlur(g: Gray, r: number): Gray {
  const { w, h, d } = g;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w) { s += d[y * w + xx]; n++; }
      }
      tmp[y * w + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++; }
      }
      out[y * w + x] = s / n;
    }
  }
  return { w, h, d: out };
}

function downsample(g: Gray, f: number): Gray {
  const w = Math.max(1, Math.floor(g.w / f));
  const h = Math.max(1, Math.floor(g.h / f));
  const d = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let yy = 0; yy < f; yy++) for (let xx = 0; xx < f; xx++) s += g.d[(y * f + yy) * g.w + x * f + xx];
      d[y * w + x] = s / (f * f);
    }
  }
  return { w, h, d };
}

/** Where pixel (x, y) of the before frame lands in the after photo. */
function mapper(t: Transform, w: number, h: number) {
  const a = (t.angle * Math.PI) / 180;
  const c = Math.cos(a) * t.scale;
  const s = Math.sin(a) * t.scale;
  const cx = w / 2, cy = h / 2;
  const tx = t.dx * w, ty = t.dy * w;
  return (x: number, y: number): [number, number] => {
    const px = x - cx, py = y - cy;
    return [cx + c * px - s * py + tx, cy + s * px + c * py + ty];
  };
}

function sample(g: Gray, x: number, y: number): number {
  if (x < 0 || y < 0 || x > g.w - 1 || y > g.h - 1) return NaN;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, g.w - 1), y1 = Math.min(y0 + 1, g.h - 1);
  const fx = x - x0, fy = y - y0;
  const d = g.d;
  const top = d[y0 * g.w + x0] * (1 - fx) + d[y0 * g.w + x1] * fx;
  const bot = d[y1 * g.w + x0] * (1 - fx) + d[y1 * g.w + x1] * fx;
  return top * (1 - fy) + bot * fy;
}

function warpGray(g: Gray, t: Transform): Gray {
  const map = mapper(t, g.w, g.h);
  const d = new Float32Array(g.w * g.h);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const [u, v] = map(x, y);
      d[y * g.w + x] = sample(g, u, v);
    }
  }
  return { w: g.w, h: g.h, d };
}

function warpRGBA(rgba: Uint8ClampedArray, w: number, h: number, t: Transform): Uint8ClampedArray {
  const map = mapper(t, w, h);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [u, v] = map(x, y);
      const o = (y * w + x) * 4;
      if (u < 0 || v < 0 || u > w - 1 || v > h - 1) { out[o + 3] = 0; continue; }
      const x0 = Math.floor(u), y0 = Math.floor(v);
      const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
      const fx = u - x0, fy = v - y0;
      for (let ch = 0; ch < 3; ch++) {
        const p = (yy: number, xx: number) => rgba[(yy * w + xx) * 4 + ch];
        out[o + ch] = (p(y0, x0) * (1 - fx) + p(y0, x1) * fx) * (1 - fy) + (p(y1, x0) * (1 - fx) + p(y1, x1) * fx) * fy;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}

/** Normalised cross-correlation of a and the warped b, over pixels where both exist. Robust to brightness changes. */
function ncc(a: Gray, b: Gray, t: Transform, step = 1): number {
  const map = mapper(t, a.w, a.h);
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let y = 0; y < a.h; y += step) {
    for (let x = 0; x < a.w; x += step) {
      const [u, v] = map(x, y);
      const vb = sample(b, u, v);
      if (Number.isNaN(vb)) continue;
      const va = a.d[y * a.w + x];
      n++; sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb;
    }
  }
  const total = Math.ceil(a.w / step) * Math.ceil(a.h / step);
  if (n < total * 0.55) return -1; // too little overlap to trust
  const cov = sab / n - (sa / n) * (sb / n);
  const va = saa / n - (sa / n) ** 2;
  const vb = sbb / n - (sb / n) ** 2;
  if (va <= 1e-9 || vb <= 1e-9) return -1;
  return cov / Math.sqrt(va * vb);
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Number(v.toFixed(4)));
  return out;
}

/** Coarse-to-fine search for the shift, rotation and zoom that best lines up the two photos. */
export function align(before: Gray, after: Gray): { t: Transform; score: number } {
  const coarseF = Math.max(1, Math.round(before.w / 64));
  const a0 = downsample(boxBlur(before, 1), coarseF);
  const b0 = downsample(boxBlur(after, 1), coarseF);
  let best: Transform = { dx: 0, dy: 0, scale: 1, angle: 0 };
  let bestScore = ncc(a0, b0, best, 2);
  const px = 1 / a0.w;
  for (const angle of range(-8, 8, 2)) {
    for (const scale of range(0.9, 1.1, 0.05)) {
      for (const dx of range(-0.15, 0.15, px)) {
        for (const dy of range(-0.12, 0.12, px)) {
          const t = { dx, dy, scale, angle };
          const s = ncc(a0, b0, t, 2);
          if (s > bestScore) { bestScore = s; best = t; }
        }
      }
    }
  }

  // Refine at the working size.
  const fineF = Math.max(1, Math.round(before.w / 160));
  const a1 = downsample(before, fineF);
  const b1 = downsample(after, fineF);
  let fine = best;
  let fineScore = ncc(a1, b1, fine);
  for (const [da, ds, dp] of [[1, 0.025, 2 / a1.w], [0.5, 0.01, 1 / a1.w]] as const) {
    const c = fine;
    for (const angle of range(c.angle - da, c.angle + da, da / 2)) {
      for (const scale of range(c.scale - ds, c.scale + ds, ds / 2)) {
        for (const dx of range(c.dx - 2 * dp, c.dx + 2 * dp, dp)) {
          for (const dy of range(c.dy - 2 * dp, c.dy + 2 * dp, dp)) {
            const t = { dx, dy, scale, angle };
            const s = ncc(a1, b1, t);
            if (s > fineScore) { fineScore = s; fine = t; }
          }
        }
      }
    }
  }
  return { t: fine, score: fineScore };
}

/** Per pixel SSIM (Wang et al. 2004) with a square window, computed with integral images. */
function ssimMap(a: Gray, b: Gray, r: number): Float32Array {
  const { w, h } = a;
  const W = w + 1;
  const I = () => new Float64Array(W * (h + 1));
  const [ia, ib, iaa, ibb, iab, iv] = [I(), I(), I(), I(), I(), I()];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      const vb = b.d[k];
      const ok = !Number.isNaN(vb);
      const va = ok ? a.d[k] : 0, vbb = ok ? vb : 0;
      const o = (y + 1) * W + x + 1;
      const add = (arr: Float64Array, v: number) => { arr[o] = v + arr[o - 1] + arr[o - W] - arr[o - W - 1]; };
      add(ia, va); add(ib, vbb); add(iaa, va * va); add(ibb, vbb * vbb); add(iab, va * vbb); add(iv, ok ? 1 : 0);
    }
  }
  const C1 = 0.01 ** 2, C2 = 0.03 ** 2;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (Number.isNaN(b.d[y * w + x])) { out[y * w + x] = NaN; continue; }
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      const sum = (arr: Float64Array) => arr[y1 * W + x1] - arr[y0 * W + x1] - arr[y1 * W + x0] + arr[y0 * W + x0];
      const n = sum(iv);
      if (n < 4) { out[y * w + x] = NaN; continue; }
      const ma = sum(ia) / n, mb = sum(ib) / n;
      const va = sum(iaa) / n - ma * ma, vb = sum(ibb) / n - mb * mb, cov = sum(iab) / n - ma * mb;
      out[y * w + x] = ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
    }
  }
  return out;
}

/** Match the after photo's overall brightness and contrast to the before photo, so lighting alone is not flagged. */
function matchLighting(a: Gray, b: Gray): Gray {
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.d.length; i++) {
    const vb = b.d[i];
    if (Number.isNaN(vb)) continue;
    n++; sa += a.d[i]; sb += vb; saa += a.d[i] ** 2; sbb += vb * vb;
  }
  if (!n) return b;
  const ma = sa / n, mb = sb / n;
  const sda = Math.sqrt(Math.max(1e-9, saa / n - ma * ma)), sdb = Math.sqrt(Math.max(1e-9, sbb / n - mb * mb));
  const d = new Float32Array(b.d.length);
  for (let i = 0; i < d.length; i++) d[i] = Number.isNaN(b.d[i]) ? NaN : (b.d[i] - mb) * (sda / sdb) + ma;
  return { w: b.w, h: b.h, d };
}

/**
 * Compares two same-size RGBA images. sensitivity 0..1 (higher flags smaller changes).
 * Returns the alignment that was applied, an SSIM heat map and boxes around possible changes.
 */
export function comparePhotos(
  beforeRGBA: Uint8ClampedArray,
  afterRGBA: Uint8ClampedArray,
  w: number,
  h: number,
  sensitivity = 0.5,
  known?: { t: Transform; score: number }, // reuse an earlier alignment of the same pair
): DiffResult {
  const before = toGray(beforeRGBA, w, h);
  const after = toGray(afterRGBA, w, h);
  const { t, score } = known ?? align(before, after);

  const a = boxBlur(before, 1);
  const b = matchLighting(a, warpGray(boxBlur(after, 1), t));
  const s = ssimMap(a, b, 3);

  const heat = new Float32Array(w * h);
  let sumS = 0, nS = 0;
  for (let i = 0; i < heat.length; i++) {
    if (Number.isNaN(s[i])) { heat[i] = NaN; continue; }
    sumS += s[i]; nS++;
    heat[i] = Math.min(1, Math.max(0, (1 - s[i]) / 2));
  }

  // Score cells, flag the ones above the threshold, then group neighbours into regions.
  const cw = Math.ceil(w / CELL), ch = Math.ceil(h / CELL);
  const cell = new Float32Array(cw * ch);
  const valid = new Uint8Array(cw * ch);
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      let sum = 0, n = 0, total = 0;
      for (let y = cy * CELL; y < Math.min(h, (cy + 1) * CELL); y++) {
        for (let x = cx * CELL; x < Math.min(w, (cx + 1) * CELL); x++) {
          total++;
          const v = heat[y * w + x];
          if (!Number.isNaN(v)) { sum += v; n++; }
        }
      }
      // Ignore cells near the edge of the overlap: warping leaves unreliable pixels there.
      valid[cy * cw + cx] = n === total ? 1 : 0;
      cell[cy * cw + cx] = n ? sum / n : 0;
    }
  }
  const threshold = 0.42 - 0.3 * Math.min(1, Math.max(0, sensitivity)); // 0.42 (strict) .. 0.12 (sensitive)
  const flagged = new Uint8Array(cw * ch);
  let flaggedCount = 0, validCount = 0;
  for (let i = 0; i < cell.length; i++) {
    if (!valid[i]) continue;
    validCount++;
    if (cell[i] > threshold) { flagged[i] = 1; flaggedCount++; }
  }

  const seen = new Uint8Array(cw * ch);
  const regions: Region[] = [];
  for (let i = 0; i < flagged.length; i++) {
    if (!flagged[i] || seen[i]) continue;
    const stack = [i];
    seen[i] = 1;
    let minX = cw, minY = ch, maxX = 0, maxY = 0, n = 0, sum = 0;
    while (stack.length) {
      const k = stack.pop()!;
      const x = k % cw, y = Math.floor(k / cw);
      n++; sum += cell[k];
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
          const j = ny * cw + nx;
          if (flagged[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
        }
      }
    }
    if (n < 2) continue; // a single cell is usually noise
    regions.push({
      x: (minX * CELL) / w,
      y: (minY * CELL) / h,
      w: Math.min(1, ((maxX - minX + 1) * CELL) / w),
      h: Math.min(1, ((maxY - minY + 1) * CELL) / h),
      score: sum / n,
    });
  }
  regions.sort((p, q) => q.score * q.w * q.h - p.score * p.w * p.h);

  return {
    width: w,
    height: h,
    transform: t,
    alignScore: score,
    ssim: nS ? sumS / nS : 0,
    changedPct: validCount ? flaggedCount / validCount : 0,
    regions: regions.slice(0, 8),
    heat,
    aligned: warpRGBA(afterRGBA, w, h, t),
  };
}
