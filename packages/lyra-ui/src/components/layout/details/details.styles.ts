import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    /* The disclosure's density knobs, both pointed at the shared size ladder so the tiers live in
       one place. Spacing reads the ladder's INLINE padding knob: a stacked panel's block rhythm is
       generous like a control's inline padding, while the ladder's own block padding exists to fit
       text inside a fixed control height and would collapse the summary row. The 'm' tier resolves
       to the same --lr-space-m this panel always used, so an un-sized disclosure is unchanged. */
    --lr-details-font-size: var(--lr-form-control-font-size);
    --lr-details-spacing: var(--lr-form-control-padding-inline);
  }
  [part='base'] { border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border); min-inline-size: 0; max-inline-size: 100%; font-size: var(--lr-details-font-size); }
  [part='summary'] { display: flex; align-items: center; justify-content: space-between; gap: var(--lr-space-s); padding-block: var(--lr-details-spacing); color: var(--lr-color-text); cursor: pointer; font-weight: var(--lr-font-weight-semibold); list-style: none; min-inline-size: 0; max-inline-size: 100%; overflow: clip; overflow-wrap: anywhere; }
  [part='summary']::-webkit-details-marker { display: none; }
  [part='summary']:hover { background: var(--lr-color-brand-quiet); }
  [part='summary']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: calc(-1 * var(--lr-focus-ring-width)); }
  [part='summary']::after { content: ''; inline-size: var(--lr-size-0-5rem); block-size: var(--lr-size-0-5rem); flex: 0 0 auto; border-inline-end: var(--lr-border-width-thin) solid currentColor; border-block-end: var(--lr-border-width-thin) solid currentColor; transform: rotate(45deg); transition: transform var(--lr-transition-fast); }
  :host([open]) [part='summary']::after { transform: rotate(225deg); }
  /* border-inline-end mirrors to the opposite physical side under RTL (border-left instead of
     border-right), which flips the corner the chevron is built from -- without a matching flip of
     the rotation angle, the marker would point sideways instead of down/up in both states. */
  :host(:dir(rtl)) [part='summary']::after { transform: rotate(-45deg); }
  :host([open]:dir(rtl)) [part='summary']::after { transform: rotate(-225deg); }
  :host([disabled]) [part='summary'] { cursor: not-allowed; opacity: var(--lr-opacity-disabled); }
  [part='content'] { padding-block-end: var(--lr-details-spacing); min-inline-size: 0; max-inline-size: 100%; overflow-wrap: anywhere; }
  @media (prefers-reduced-motion: reduce) { [part='summary']::after { transition: none; } }
`;
