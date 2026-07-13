import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    inline-size: var(--lyra-skeleton-w, 100%);
    block-size: var(--lyra-skeleton-h, var(--lyra-size-1em));
  }
  [part='base'] {
    inline-size: 100%;
    block-size: 100%;
    background: var(--lyra-color-border);
  }
  :host([variant='text']) [part='base'],
  :host([variant='rect']) [part='base'] {
    border-radius: var(--lyra-radius);
  }
  :host([variant='circle']) [part='base'] {
    border-radius: 50%;
  }
  :host([effect='pulse']) [part='base'] {
    animation: lyra-skeleton-pulse 1.5s ease-in-out infinite;
  }
  :host([effect='sheen']) [part='base'] {
    background-image: linear-gradient(
      90deg,
      var(--lyra-color-border) 0%,
      var(--lyra-color-surface) 50%,
      var(--lyra-color-border) 100%
    );
    background-size: 200% 100%;
    animation: lyra-skeleton-sheen 1.5s ease-in-out infinite;
  }
  @keyframes lyra-skeleton-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
  @keyframes lyra-skeleton-sheen {
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
