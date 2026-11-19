import { css } from 'lit';

// Forced colours replace author fills, so the track gets an edge and the indicator a system fill
// that still separates the filled extent from the remainder.
export const progressTrackPaint = css`
  border-radius: var(--lr-progress-track-radius, var(--_progress-radius, var(--lr-radius-pill)));
  background: var(--lr-progress-track-color, var(--track-color, var(--_progress-track-color, var(--lr-color-brand-quiet))));
  @media (forced-colors: active) {
    outline: var(--lr-border-width-thin) solid CanvasText;
    outline-offset: calc(-1 * var(--lr-border-width-thin));
  }
`;

export const progressIndicatorPaint = css`
  background: var(--lr-progress-indicator-color, var(--indicator-color, var(--lr-progress-indicator-variant-color, var(--_lr-progress-indicator-variant-color, var(--lr-color-brand)))));
  @media (forced-colors: active) {
    forced-color-adjust: none;
    background: Highlight;
  }
`;
