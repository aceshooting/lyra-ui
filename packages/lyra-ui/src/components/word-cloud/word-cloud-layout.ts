/** One word to place, before layout. */
export interface WordCloudWord {
  text: string;
  weight: number;
  color?: string;
  group?: string;
}

/** A word after layout — its original data (weight untouched, even if it was
 *  negative/non-finite in the input — see `effectiveWeight` internally) plus
 *  computed geometry. */
export interface PlacedWord extends WordCloudWord {
  /** Index of this word in the original (pre-sort) `words` array — stable
   *  across layout re-runs, so callers can key a color/group map off it
   *  instead of off placement order (which is sorted by weight). */
  originalIndex: number;
  /** Center x, in an unbounded coordinate space centered on the origin. */
  x: number;
  /** Center y, in the same space as `x`. */
  y: number;
  fontSize: number;
  /** `true` if rotated 90°. */
  rotated: boolean;
  /** Unrotated rendered width, in px. */
  width: number;
  /** Unrotated rendered height, in px (== fontSize; layout doesn't model ascent/descent). */
  height: number;
}

export interface WordCloudLayoutOptions {
  minFontSize: number;
  maxFontSize: number;
  scale: 'linear' | 'sqrt';
  orientations: 'horizontal' | 'mixed';
  /** Measures the rendered width of `text` set at `fontSize`, e.g. via a canvas 2D
   *  context — the font string passed to the context must match the actual
   *  rendered `[part="word"]` font (weight included), or collision boxes end
   *  up narrower than what's actually painted. */
  measureText: (text: string, fontSize: number) => number;
  /** `[0, 1)` — defaults to `Math.random`; inject a stub for deterministic tests. */
  random?: () => number;
}

export interface WordCloudLayoutResult {
  placed: PlacedWord[];
  /** Words left out of `placed`, for any of three reasons: blank/whitespace-only
   *  `text`; capacity overflow (input has more than `MAX_WORDS` entries, so the
   *  lowest-weight excess is dropped, regardless of where it fell in the input
   *  array); or the spiral search exhausted its radius bound (pathological
   *  inputs only, e.g. one huge word repeated many times). */
  skipped: WordCloudWord[];
  /** Gap-padded bounding box of `placed` — 0 if nothing was placed. */
  width: number;
  height: number;
}

/** DOM-node/compute-time safety cap — mirrors lr-sparkline's `MAX_BARS`. */
export const MAX_WORDS = 150;
/** Largest accepted font size in CSS pixels. This keeps measurement and
 *  placement geometry finite enough for an interactive render even when a
 *  caller supplies an otherwise-valid but impractically large number. */
export const MAX_FONT_SIZE_PX = 512;
/** Maximum number of candidate positions tested for any one word. Together
 *  with `MAX_WORDS`, this puts a hard upper bound on spiral-search work. */
export const MAX_SPIRAL_ITERATIONS = 4096;
/** Minimum gap enforced both between placed words and around the returned bounding box. */
export const GAP = 3;
const ROTATE_PROBABILITY = 0.25;
const ANGLE_STEP = 0.15;
const RADIUS_STEP_PER_RADIAN = 3;
/** Multiplier on the summed word-box area used to bound the spiral search —
 *  generous enough that only a pathological input (e.g. one giant word
 *  repeated many times) ever exhausts it. */
const MAX_RADIUS_AREA_FACTOR = 6;
/** Fallback used by `resolveFontSizeBounds()` for any non-finite/non-positive
 *  `minFontSize`/`maxFontSize` input -- also reused by `<lr-word-cloud>` itself as the lower
 *  clamp bound for its own guard on those two properties. */
export const MIN_SANE_FONT_SIZE = 1;

/** Normalizes possibly-invalid minFontSize/maxFontSize into a finite,
 *  positive, bounded, correctly-ordered pair — non-finite/negative inputs
 *  fall back to MIN_SANE_FONT_SIZE, huge finite values are capped, and a
 *  reversed pair (max < min) is swapped rather than left to invert the
 *  weight-to-size mapping. */
function resolveFontSizeBounds(minFontSize: number, maxFontSize: number): [number, number] {
  const min =
    Number.isFinite(minFontSize) && minFontSize > 0
      ? Math.min(minFontSize, MAX_FONT_SIZE_PX)
      : MIN_SANE_FONT_SIZE;
  const max =
    Number.isFinite(maxFontSize) && maxFontSize > 0
      ? Math.min(maxFontSize, MAX_FONT_SIZE_PX)
      : MIN_SANE_FONT_SIZE;
  return min <= max ? [min, max] : [max, min];
}

/** Clamps a (possibly negative/non-finite) input weight for scale math only —
 *  never fed back to callers, who should still see their own original `weight`. */
function effectiveWeight(weight: number): number {
  return Number.isFinite(weight) ? Math.max(0, weight) : 0;
}

function scaledWeight(weight: number, minWeight: number, maxWeight: number, scale: 'linear' | 'sqrt'): number {
  const span = maxWeight - minWeight || 1;
  const t = Math.min(1, Math.max(0, (weight - minWeight) / span));
  return scale === 'sqrt' ? Math.sqrt(t) : t;
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return Math.abs(ax - bx) < (aw + bw) / 2 + GAP && Math.abs(ay - by) < (ah + bh) / 2 + GAP;
}

/**
 * Places `words` via an Archimedean-spiral search (the standard word-cloud
 * layout heuristic — heaviest words placed first, each one walking an
 * outward spiral from the center until it finds a gap that doesn't overlap
 * any word already placed). Deterministic given a deterministic `random`.
 */
export function layoutWordCloud(words: WordCloudWord[], options: WordCloudLayoutOptions): WordCloudLayoutResult {
  const { scale, orientations, measureText } = options;
  const [minFontSize, maxFontSize] = resolveFontSizeBounds(options.minFontSize, options.maxFontSize);
  const random = options.random ?? Math.random;

  const skipped: WordCloudWord[] = [];

  const decorated = words
    .map((w, originalIndex) => ({ ...w, originalIndex }))
    .filter((w) => {
      const blank = w.text.trim().length === 0;
      if (blank) skipped.push(w);
      return !blank;
    });

  // Cap placement eligibility by actual weight (heaviest MAX_WORDS survive),
  // not by array position — a heavy word late in the input must not be
  // dropped just because lighter words happened to come first.
  const byWeightDesc = [...decorated].sort((a, b) => effectiveWeight(b.weight) - effectiveWeight(a.weight));
  const eligible = byWeightDesc.slice(0, MAX_WORDS);
  skipped.push(...byWeightDesc.slice(MAX_WORDS));

  if (eligible.length === 0) return { placed: [], skipped, width: 0, height: 0 };

  let minWeight = effectiveWeight(eligible[0]!.weight);
  let maxWeight = minWeight;
  for (const w of eligible) {
    const ew = effectiveWeight(w.weight);
    if (ew < minWeight) minWeight = ew;
    if (ew > maxWeight) maxWeight = ew;
  }

  // eligible is already weight-descending (a suffix of byWeightDesc), which
  // is also the placement order the algorithm wants (heaviest first).
  const placed: PlacedWord[] = [];
  let totalArea = 0;

  for (const word of eligible) {
    const t = scaledWeight(effectiveWeight(word.weight), minWeight, maxWeight, scale);
    const fontSize = minFontSize + t * (maxFontSize - minFontSize);
    const measuredWidth = Math.max(1, measureText(word.text, fontSize));
    const measuredHeight = fontSize;
    const rotated = orientations === 'mixed' && random() < ROTATE_PROBABILITY;
    const boxW = rotated ? measuredHeight : measuredWidth;
    const boxH = rotated ? measuredWidth : measuredHeight;
    totalArea += boxW * boxH;

    const maxRadius = Math.sqrt(totalArea * MAX_RADIUS_AREA_FACTOR) + Math.max(boxW, boxH);
    let theta = 0;
    let radius = 0;
    let x = 0;
    let y = 0;
    let foundSpot = placed.length === 0;
    let iterations = 0;

    while (!foundSpot && radius < maxRadius && iterations < MAX_SPIRAL_ITERATIONS) {
      iterations++;
      x = radius * Math.cos(theta);
      y = radius * Math.sin(theta);
      let collides = false;
      for (const other of placed) {
        const otherW = other.rotated ? other.height : other.width;
        const otherH = other.rotated ? other.width : other.height;
        if (rectsOverlap(x, y, boxW, boxH, other.x, other.y, otherW, otherH)) {
          collides = true;
          break;
        }
      }
      if (!collides) {
        foundSpot = true;
        break;
      }
      theta += ANGLE_STEP;
      radius += RADIUS_STEP_PER_RADIAN * ANGLE_STEP;
    }

    if (!foundSpot) {
      skipped.push(word);
      continue;
    }

    placed.push({
      ...word,
      x,
      y,
      fontSize,
      rotated,
      width: measuredWidth,
      height: measuredHeight,
    });
  }

  if (placed.length === 0) return { placed, skipped, width: 0, height: 0 };

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of placed) {
    const w = p.rotated ? p.height : p.width;
    const h = p.rotated ? p.width : p.height;
    minX = Math.min(minX, p.x - w / 2);
    maxX = Math.max(maxX, p.x + w / 2);
    minY = Math.min(minY, p.y - h / 2);
    maxY = Math.max(maxY, p.y + h / 2);
  }
  // Pad the bounding box itself by GAP too, matching the same margin already
  // enforced between words (see rectsOverlap) — otherwise the outermost
  // words sit flush against the SVG's own edge with no room for error.
  minX -= GAP;
  minY -= GAP;
  maxX += GAP;
  maxY += GAP;

  // Shift every word into a top-left-origin coordinate space so callers can
  // render straight into `viewBox="0 0 width height"` with no further offset math.
  for (const p of placed) {
    p.x -= minX;
    p.y -= minY;
  }

  return {
    placed,
    skipped,
    width: maxX - minX,
    height: maxY - minY,
  };
}
