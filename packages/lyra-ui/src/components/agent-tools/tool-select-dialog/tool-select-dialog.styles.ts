import { css } from 'lit';

export const styles = css`
  :host {
    /* Backdrop scrim color, component-specific so a host can retheme it
       without a raw literal leaking into the public API -- no shared
       --lr-*-overlay token exists to resolve through. Same rationale as
       lr-dialog's --lr-dialog-overlay-color and lr-tool-result-dialog's
       --lr-tool-result-dialog-overlay-color. */
    --_lr-tool-select-dialog-overlay-color: var(--lr-color-overlay);
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
    align-items: center;
    justify-content: center;
    padding-block-start: max(var(--lr-space-l), var(--lr-safe-area-top));
    padding-block-end: max(var(--lr-space-l), var(--lr-safe-area-bottom));
    padding-inline-start: max(
      var(--lr-space-l),
      var(--lr-safe-area-inline-start)
    );
    padding-inline-end: max(var(--lr-space-l), var(--lr-safe-area-inline-end));
  }
  :host([open]) {
    display: flex;
  }
  [part="backdrop"] {
    position: absolute;
    inset: 0;
    background: var(
      --lr-tool-select-dialog-overlay-color,
      var(--_lr-tool-select-dialog-overlay-color)
    );
  }
  [part="panel"] {
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: min(var(--lr-size-30rem), 100%);
    min-inline-size: 0;
    max-inline-size: 100%;
    block-size: min(var(--lr-size-38rem), 100%);
    /* Modal-panel surface, not the page surface -- in dark mode the two resolve to the same
       near-black and the dialog reads as a scrim with floating text. */
    background: var(--lr-color-surface-overlay);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    /* Modal layer, top step: a centered, scrimmed dialog floating free on all four edges, the
       same role as lr-dialog and so the same elevation. */
    box-shadow: var(--lr-shadow-xl);
    overflow: hidden;
  }
  [part="header"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    padding: var(--lr-space-l) var(--lr-space-l) 0;
  }
  [part="title"] {
    margin: 0;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-m);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part="subtitle"] {
    margin: var(--lr-space-xs) 0 0;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part="subtitle"][hidden] {
    display: none;
  }

  [part="search-row"] {
    padding: var(--lr-space-m) var(--lr-space-l) 0;
  }
  [part="search-input"] {
    appearance: textfield;
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-space-s) var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: inherit;
    font: inherit;
  }
  [part="search-input"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* no-pressed-state: a search field is a caret target, not a push target -- pointer-down places
     an insertion point and hands the affordance to :focus-visible, so a pressed tint would flash
     for one frame and then be contradicted by the focus ring. */
  :where([part="search-input"]):hover {
    border-color: var(--lr-color-brand);
  }
  [part="search-input"]::placeholder {
    color: var(--lr-color-text-quiet);
    opacity: 1;
  }
  [part="search-input"]::-webkit-search-cancel-button,
  [part="search-input"]::-webkit-search-decoration {
    appearance: none;
  }

  [part="defaults-row"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-m) var(--lr-space-l);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part="defaults-hint"] {
    margin: 0;
    /* Lines the hint up under the switch's label text, not its track:
       lr-switch's [part="base"] uses a fixed 2.25rem track inline-size plus a
       --lr-space-s gap before its label (both in switch.styles.ts, not
       exposed as tokens), so this indent is coupled to that fixed geometry
       rather than derived from another component's token. */
    padding-inline-start: calc(var(--lr-size-2-25rem) + var(--lr-space-s));
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }

  [part="body"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    min-block-size: 0;
    overflow: auto;
    padding: var(--lr-space-m) var(--lr-space-l) var(--lr-space-l);
  }
  [part="body"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  /* no-pressed-state: the focusable body is a scroll viewport, not an activation target. */
  :where([part="body"]):hover {
    outline: var(--lr-border-width-thin) solid var(--lr-color-border);
    outline-offset: calc(-1 * var(--lr-border-width-thin));
  }
  [part="empty"] {
    margin: 0;
    padding: var(--lr-space-l) 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
  }
  [part="limit"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    max-inline-size: 100%;
    margin-block-start: var(--lr-space-l);
    padding-block-start: var(--lr-space-m);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  [part="load-more"] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    padding: var(--lr-space-xs) var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  [part="load-more"]:hover {
    border-color: var(--lr-color-brand);
    background: var(--lr-color-brand-quiet);
  }
  [part="load-more"]:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="load-more"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part="category"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    margin-block-end: var(--lr-space-l);
  }
  [part="category"]:last-child {
    margin-block-end: 0;
  }
  [part="category-heading"] {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
    margin: 0 0 var(--lr-space-s);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-04em);
    color: var(--lr-color-text-quiet);
    overflow-wrap: anywhere;
  }
  [part="category-count"] {
    font-weight: var(--lr-font-weight-normal);
    text-transform: none;
    letter-spacing: normal;
  }
  [part="category-list"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    max-inline-size: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  [part="tool-row"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="tool-checkbox"] {
    display: block;
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="tool-checkbox"]::part(base) {
    align-items: flex-start;
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="tool-checkbox"]::part(label) {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-0-125rem);
  }
  [part="tool-checkbox"]::part(hint) {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-0-125rem);
  }
  [part="tool-name"] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part="tool-icon"] {
    line-height: var(--lr-line-height-none);
  }
  [part="tool-description"] {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part="tool-disabled-reason"] {
    /* Slotted into lr-checkbox's own hint surface alongside tool-description, so the checkbox-hint
       bridge describes the control without lengthening its accessible name. */
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-warning);
    overflow-wrap: anywhere;
  }

  [part="footer"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    max-inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-space-m) var(--lr-space-l);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    overflow-wrap: anywhere;
  }
  [part="footer"] ::slotted(*) {
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  [part="footer"][hidden] {
    display: none;
  }
`;
