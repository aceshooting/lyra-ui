import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    inline-size: var(--lr-skeleton-w, 100%);
    block-size: var(--lr-skeleton-h, var(--lr-size-1em));
  }
  [part='base'] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    background: var(--lr-color-border);
  }
  :host([variant='text']) [part='base'],
  :host([variant='rect']) [part='base'] {
    border-radius: var(--lr-radius);
  }
  :host([variant='circle']) [part='base'] {
    border-radius: 50%;
  }
  :host([effect='pulse']) [part='base'] {
    animation: lr-skeleton-pulse var(--lr-transition-ambient) infinite;
  }
  :host([effect='sheen']) [part='base'] {
    background-image: linear-gradient(
      90deg,
      var(--lr-color-border) 0%,
      var(--lr-color-surface) 50%,
      var(--lr-color-border) 100%
    );
    background-size: 200% 100%;
    animation: lr-skeleton-sheen var(--lr-transition-ambient) infinite;
  }
  /* background-position percentages are physical, so the sheen highlight always travels
     left-to-right; play the same keyframes backwards under RTL so it sweeps in the reading
     direction. animation-direction (not a second animation-name) leaves the reduced-motion
     'animation: none !important' below fully in charge of disabling it. */
  :host([effect='sheen']:dir(rtl)) [part='base'] {
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
    [part='base'] {
      animation: none !important;
    }
    :host([effect='sheen']) [part='base'] {
      background-image: none;
    }
  }
`;
