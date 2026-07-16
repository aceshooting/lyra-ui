import { css } from 'lit';

export const styles = css`
  :host { display: inline-block; color: var(--lyra-color-brand); }
  [part='base'] { display: inline-flex; align-items: center; justify-content: center; }
  [part='spinner'] {
    inline-size: var(--lyra-spinner-size, var(--lyra-size-1-25rem));
    block-size: var(--lyra-spinner-size, var(--lyra-size-1-25rem));
    border: var(--lyra-spinner-track-width, var(--lyra-border-width-medium)) solid var(--lyra-color-brand-quiet);
    border-block-start-color: var(--lyra-color-brand);
    border-radius: var(--lyra-radius-pill);
    animation: lyra-spin var(--lyra-spinner-duration, 800ms) linear infinite;
  }
  /* 'after' renders the slotted label in flow next to the spinner; 'none' keeps it sr-only
     (still hit by the [hidden] attribute set in spinner.class.ts, but scoping the clip here too
     keeps this rule self-consistent if that attribute is ever dropped). */
  :host([label-placement='after']) [part='label'] { display: inline-flex; align-items: center; margin-inline-start: var(--lyra-space-2xs); color: var(--lyra-color-text); font-size: var(--lyra-font-size-sm); }
  :host([label-placement='none']) [part='label'] { position: absolute; inline-size: var(--lyra-size-1px); block-size: var(--lyra-size-1px); overflow: hidden; clip-path: inset(50%); }
  @keyframes lyra-spin { to { transform: rotate(1turn); } }
  @media (prefers-reduced-motion: reduce) { [part='spinner'] { animation: none; } }
`;
