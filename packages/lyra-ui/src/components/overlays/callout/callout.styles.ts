import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Decoupled from --lr-callout-background below (which every non-neutral \`variant\` retargets
       for the panel itself, including brand's var(--lr-color-brand-quiet)) so a consumer can
       retint the close-button hover fill -- e.g. to keep it visibly distinct from a brand-tinted
       panel -- without a collateral effect on the panel background, and vice versa. Defaults to
       today's exact value, so a consumer overriding neither token sees byte-identical rendering.
       Same shape as lr-chip's --lr-chip-pressed-bg fix (see AGENTS.md's
       theming-state-rule-longhand-and-shared-token-completeness entry). */
    --lr-callout-close-hover-bg: var(--lr-color-brand-quiet);
    /* The panel's density knobs, both pointed at the shared size ladder so the tiers live in one
       place. Padding reads the ladder's INLINE knob on both axes: a panel's block rhythm is
       generous like a control's inline padding, while the ladder's own block padding exists to fit
       text inside a fixed control height and would squash a callout. The 'm' tier resolves to the
       same --lr-space-m this panel always used, so an un-sized callout is unchanged. */
    --lr-callout-font-size: var(--lr-form-control-font-size);
    --lr-callout-padding: var(--lr-form-control-padding-inline);
    /* Separates three adjacent boxes rather than setting the panel's density, so it deliberately
       does not vary by tier -- shrinking it at 2xs only crowds the close control. */
    --lr-callout-gap: var(--lr-space-s);
  }
  [part='base'] { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; max-inline-size: 100%; box-sizing: border-box; gap: var(--lr-callout-gap); padding: var(--lr-callout-padding); border: var(--lr-border-width-thin) solid var(--lr-callout-border, var(--lr-color-border)); border-radius: var(--lr-radius-xs); background: var(--lr-callout-background, var(--lr-color-surface)); color: var(--lr-callout-color, var(--lr-color-text)); font-size: var(--lr-callout-font-size); }
  /* One rule for all four non-neutral variants, in place of the four near-identical blocks that
     stood here: the shared variants sheet has already re-pointed --lr-color-fill-* at the active
     variant's row of the semantic grid, so the callout reads generic slots and never names a
     variant. Neutral is excluded rather than mapped, so it keeps falling through to the ambient
     surface/border/text values in the var() fallbacks above -- a status panel with no status to
     signal must read as plain, not as the grid's grey neutral row. Matching [variant] as well as
     :not([variant='neutral']) keeps a host that has not yet reflected its default attribute on
     those same neutral values. */
  :host([variant]:not([variant='neutral'])) { --lr-callout-background: var(--lr-color-fill-quiet); --lr-callout-color: var(--lr-color-fill-loud); --lr-callout-border: var(--lr-color-fill-loud); }
  [part='icon'] { display: inline-flex; grid-column: 1; font-size: var(--lr-font-size-lg); line-height: var(--lr-line-height-none); }
  [part='icon'][hidden], [part='close-button'][hidden] { display: none; }
  [part='heading'] { margin-block-end: var(--lr-space-xs); font-weight: var(--lr-font-weight-semibold); }
  [part='content'] { grid-column: 2; min-inline-size: 0; overflow-wrap: anywhere; }
  [part='message'] { min-inline-size: 0; overflow-wrap: anywhere; }
  /* The interactive hit target meets the shared minimum tappable size (--lr-icon-button-size)
     in both the default panel and the compact [inline] variant below -- the *visible* "×" glyph
     is what shrinks for [inline] instead, rendered on the separate [part='close-icon'] child and
     centered via this button's own flex layout, not by resizing the button itself. Mirrors
     lr-swatch-picker's [part='swatch']/[part='swatch-fill'] split. */
  [part='close-button'] { display: inline-flex; grid-column: 3; align-items: center; justify-content: center; min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); border: 0; border-radius: var(--lr-radius-pill); background: transparent; color: inherit; cursor: pointer; }
  [part='close-button']:hover { background: var(--lr-callout-close-hover-bg); }
  [part='close-button']:active { background: color-mix(in oklab, var(--lr-callout-close-hover-bg), var(--lr-color-mix-partner) var(--lr-color-mix-active)); }
  [part='close-button']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  :host([inline]) [part='base'] {
    gap: var(--lr-space-xs);
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  :host([inline]) [part='icon'] { font-size: var(--lr-font-size-m); }
  :host([inline]) [part='heading'] { margin-block-end: 0; }
  :host([inline]) [part='close-icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-size-1-5rem);
    block-size: var(--lr-size-1-5rem);
  }
`;
