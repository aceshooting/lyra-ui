import { css } from 'lit';

export const progressTrackPaint = css`
  border-radius: var(--lr-progress-track-radius, var(--_progress-radius, var(--lr-radius-pill)));
  background: var(--lr-progress-track-color, var(--track-color, var(--_progress-track-color, var(--lr-color-brand-quiet))));
`;

export const progressIndicatorPaint = css`
  background: var(--lr-progress-indicator-color, var(--indicator-color, var(--lr-progress-indicator-variant-color, var(--_lr-progress-indicator-variant-color, var(--lr-color-brand)))));
`;
