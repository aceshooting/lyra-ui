import { css } from 'lit';

/**
 * The per-series encodings applied while `(forced-colors: active)` matches, shared by every chart
 * in this family so a consumer sees one vocabulary across `<lr-chart>`, `<lr-box-plot>`, and
 * `<lr-lite-chart>`.
 *
 * Forced-colors mode exposes only a handful of system colors, so the eight-entry
 * `--lr-color-chart-*` ramp is deliberately remapped onto a repeating three-value cycle in
 * `internal/specialist-tokens.styles.ts`. Series 1/4/7 then paint in literally the same color.
 * Texture, line dash, and point shape are the channels that keep those repeated colors apart
 * without substituting an arbitrary author color the user's high-contrast theme never asked for.
 * Nothing here is opt-in: the encodings only exist while the media query matches.
 */
export const FORCED_COLOR_ENCODINGS = [
  { name: 'solid', dash: [] as number[], pointStyle: 'circle' },
  { name: 'horizontal', dash: [2, 2], pointStyle: 'rect' },
  { name: 'vertical', dash: [8, 3], pointStyle: 'triangle' },
  { name: 'diagonal', dash: [8, 3, 2, 3], pointStyle: 'rectRot' },
  { name: 'reverse-diagonal', dash: [1, 3], pointStyle: 'cross' },
  { name: 'crosshatch', dash: [10, 2], pointStyle: 'crossRot' },
  { name: 'dots', dash: [6, 2, 1, 2], pointStyle: 'star' },
  { name: 'checker', dash: [12, 3, 3, 3], pointStyle: 'line' },
] as const;

export type ForcedColorEncodingName = (typeof FORCED_COLOR_ENCODINGS)[number]['name'];

/** The encoding for a series index, cycling once the ramp runs out. */
export function forcedColorEncoding(index: number): (typeof FORCED_COLOR_ENCODINGS)[number] {
  const count = FORCED_COLOR_ENCODINGS.length;
  const normalized = Number.isFinite(index) ? (((index % count) + count) % count) : 0;
  return FORCED_COLOR_ENCODINGS[normalized]!;
}

/**
 * Whether the view is rendering under a forced-color palette. Wrapped in `try`/`catch` because a
 * detached or cross-origin-restricted view can throw on `matchMedia`, and a missing accommodation
 * must never take the chart down with it.
 */
export function forcedColorsActive(view?: Window | null): boolean {
  try {
    return !!view?.matchMedia?.('(forced-colors: active)').matches;
  } catch {
    return false;
  }
}

/** Fixed bitmap geometry: part of the encoding algorithm, not a component design dimension. */
const TILE_SIZE = 8;

/**
 * Builds a small deterministic `CanvasPattern` for a series index, painting `texture` over
 * `background`. Returns `background` unchanged whenever a pattern cannot be produced (no 2d
 * context, `createPattern()` declining), so a caller can always assign the result straight to a
 * Chart.js color slot.
 */
export function createForcedColorPattern(
  doc: Document,
  index: number,
  background: string,
  texture: string,
): CanvasPattern | string {
  const tile = doc.createElement('canvas');
  const size = TILE_SIZE;
  const half = size / 2;
  tile.width = size;
  tile.height = size;
  const context = tile.getContext('2d');
  if (!context) return background;

  context.fillStyle = background;
  context.fillRect(0, 0, size, size);
  context.fillStyle = texture;
  context.strokeStyle = texture;
  context.lineWidth = 1;

  switch (index % FORCED_COLOR_ENCODINGS.length) {
    case 1:
      context.fillRect(0, half, size, 1);
      break;
    case 2:
      context.fillRect(half, 0, 1, size);
      break;
    case 3:
      context.beginPath();
      context.moveTo(-half, size);
      context.lineTo(half, 0);
      context.moveTo(half, size);
      context.lineTo(size + half, 0);
      context.stroke();
      break;
    case 4:
      context.beginPath();
      context.moveTo(-half, 0);
      context.lineTo(half, size);
      context.moveTo(half, 0);
      context.lineTo(size + half, size);
      context.stroke();
      break;
    case 5:
      context.fillRect(0, half, size, 1);
      context.fillRect(half, 0, 1, size);
      break;
    case 6:
      context.beginPath();
      context.arc(half, half, 1.5, 0, Math.PI * 2);
      context.fill();
      break;
    case 7:
      context.fillRect(0, 0, half, half);
      context.fillRect(half, half, half, half);
      break;
    default:
      break;
  }
  return context.createPattern(tile, 'repeat') ?? background;
}

/**
 * The DOM legend's half of the same accommodation, shared verbatim by every chart in this family.
 * `data-encoding` is emitted only while `(forced-colors: active)` matches, so these rules stay
 * inert otherwise and need no media query of their own. The inline system color remains one
 * channel; the texture mirrors whatever the plot painted, so repeated colors stay distinct in the
 * legend too. The swatch is the data key, so it opts out of forced-color adjustment; its enclosing
 * button and focus chrome stay system-controlled.
 */
export const forcedColorLegendSwatchStyles = css`
  [part='legend-swatch'] {
    --lr-chart-pattern-step: var(--lr-space-2xs);
  }
  [part='legend-swatch'][data-encoding] {
    forced-color-adjust: none;
    border: var(--lr-border-width-thin) solid currentColor;
    background-size: var(--lr-chart-pattern-step) var(--lr-chart-pattern-step);
  }
  [part='legend-swatch'][data-encoding='solid'] {
    background-image: none;
  }
  [part='legend-swatch'][data-encoding='horizontal'] {
    background-image: repeating-linear-gradient(
      0deg,
      transparent 0 calc(var(--lr-chart-pattern-step) - var(--lr-border-width-thin)),
      var(--lr-color-surface) calc(var(--lr-chart-pattern-step) - var(--lr-border-width-thin))
        var(--lr-chart-pattern-step)
    );
  }
  [part='legend-swatch'][data-encoding='vertical'] {
    background-image: repeating-linear-gradient(
      90deg,
      transparent 0 calc(var(--lr-chart-pattern-step) - var(--lr-border-width-thin)),
      var(--lr-color-surface) calc(var(--lr-chart-pattern-step) - var(--lr-border-width-thin))
        var(--lr-chart-pattern-step)
    );
  }
  [part='legend-swatch'][data-encoding='diagonal'] {
    background-image: repeating-linear-gradient(
      45deg,
      transparent 0 calc(var(--lr-chart-pattern-step) - var(--lr-border-width-thin)),
      var(--lr-color-surface) calc(var(--lr-chart-pattern-step) - var(--lr-border-width-thin))
        var(--lr-chart-pattern-step)
    );
  }
  [part='legend-swatch'][data-encoding='reverse-diagonal'] {
    background-image: repeating-linear-gradient(
      -45deg,
      transparent 0 calc(var(--lr-chart-pattern-step) - var(--lr-border-width-thin)),
      var(--lr-color-surface) calc(var(--lr-chart-pattern-step) - var(--lr-border-width-thin))
        var(--lr-chart-pattern-step)
    );
  }
  [part='legend-swatch'][data-encoding='crosshatch'] {
    background-image:
      linear-gradient(
        0deg,
        transparent calc(50% - var(--lr-border-width-thin)),
        var(--lr-color-surface) calc(50% - var(--lr-border-width-thin)) 50%,
        transparent 50%
      ),
      linear-gradient(
        90deg,
        transparent calc(50% - var(--lr-border-width-thin)),
        var(--lr-color-surface) calc(50% - var(--lr-border-width-thin)) 50%,
        transparent 50%
      );
  }
  [part='legend-swatch'][data-encoding='dots'] {
    background-image: radial-gradient(
      circle,
      var(--lr-color-surface) 0 var(--lr-border-width-thin),
      transparent var(--lr-border-width-medium)
    );
  }
  [part='legend-swatch'][data-encoding='checker'] {
    background-image: conic-gradient(
      var(--lr-color-surface) 0 25%,
      transparent 25% 50%,
      var(--lr-color-surface) 50% 75%,
      transparent 75%
    );
  }
`;
