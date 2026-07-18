import { css } from 'lit';

export const styles = css`
  :host { display: inline-block; color: var(--lr-color-brand); }
  [part='base'] { display: inline-flex; align-items: center; justify-content: center; }
  [part='spinner'] {
    inline-size: var(--lr-spinner-size, var(--lr-size-1-25rem));
    block-size: var(--lr-spinner-size, var(--lr-size-1-25rem));
    border: var(--lr-spinner-track-width, var(--lr-border-width-medium)) solid var(--lr-color-brand-quiet);
    border-block-start-color: var(--lr-color-brand);
    border-radius: var(--lr-radius-pill);
    animation: lr-spin var(--lr-spinner-duration, 800ms) linear infinite;
  }
  /* 'after' renders the slotted label in flow next to the spinner; 'none' keeps it sr-only
     (still hit by the [hidden] attribute set in spinner.class.ts, but scoping the clip here too
     keeps this rule self-consistent if that attribute is ever dropped). */
  :host([label-placement='after']) [part='label'] { display: inline-flex; align-items: center; margin-inline-start: var(--lr-space-2xs); color: var(--lr-color-text); font-size: var(--lr-font-size-sm); }
  :host([label-placement='none']) [part='label'] { position: absolute; inline-size: var(--lr-size-1px); block-size: var(--lr-size-1px); overflow: hidden; clip-path: inset(50%); }
  @keyframes lr-spin { to { transform: rotate(1turn); } }
  @media (prefers-reduced-motion: reduce) { [part='spinner'] { animation: none; } }
`;
