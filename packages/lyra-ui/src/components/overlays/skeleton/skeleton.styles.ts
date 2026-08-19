import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    inline-size: var(--lr-skeleton-w, 100%);
    block-size: var(--lr-skeleton-h, var(--lr-size-1em));
  }
  [part~='indicator'] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    background: var(--lr-skeleton-color, var(--color, var(--lr-color-border)));
    border-radius: var(--lr-skeleton-border-radius, var(--border-radius, var(--lr-radius)));
  }
  :host([shape='circle']) [part~='indicator'] {
    border-radius: 50%;
  }
  [part~='indicator'][data-effect='pulse'] {
    animation: lr-skeleton-pulse var(--lr-transition-ambient) infinite;
  }
  [part~='indicator'][data-effect='sheen'] {
    background-image: linear-gradient(
      90deg,
      var(--lr-skeleton-color, var(--color, var(--lr-color-border))) 0%,
      var(--lr-skeleton-sheen-color, var(--sheen-color, var(--lr-color-surface))) 50%,
      var(--lr-skeleton-color, var(--color, var(--lr-color-border))) 100%
    );
    background-size: 200% 100%;
    animation: lr-skeleton-sheen var(--lr-transition-ambient) infinite;
  }
  /* background-position percentages are physical, so the sheen always travels left-to-right; play
     the same keyframes backwards under RTL to sweep in the reading direction. animation-direction
     rather than a second animation-name leaves the reduced-motion 'animation: none !important'
     below in charge of disabling it. */
  :host(:dir(rtl)) [part~='indicator'][data-effect='sheen'] {
    animation-direction: reverse;
  }
  @keyframes lr-skeleton-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
  @keyframes lr-skeleton-sheen {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part~='indicator'] {
      animation: none !important;
    }
    [part~='indicator'][data-effect='sheen'] {
      background-image: none;
    }
  }
`;
