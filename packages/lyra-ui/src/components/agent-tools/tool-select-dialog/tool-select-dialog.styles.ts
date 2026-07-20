import { css } from 'lit';

export const styles = css`
  :host {
    /* Backdrop scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --lr-*-overlay token exists in the design system to resolve through,
       same rationale as lr-dialog's --lr-dialog-overlay-color and
       lr-tool-result-dialog's --lr-tool-result-dialog-overlay-color). */
    --lr-tool-select-dialog-overlay-color: var(--lr-color-overlay);
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
    align-items: center;
    justify-content: center;
    padding-block-start: max(var(--lr-space-l), var(--lr-safe-area-top));
    padding-block-end: max(var(--lr-space-l), var(--lr-safe-area-bottom));
    padding-inline-start: max(var(--lr-space-l), var(--lr-safe-area-inline-start));
    padding-inline-end: max(var(--lr-space-l), var(--lr-safe-area-inline-end));
  }
  :host([open]) {
    display: flex;
  }
  [part='backdrop'] {
    position: absolute;
    inset: 0;
    background: var(--lr-tool-select-dialog-overlay-color);
  }
  [part='panel'] {
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: min(var(--lr-size-30rem), 100%);
    block-size: min(var(--lr-size-38rem), 100%);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow);
    overflow: hidden;
  }
  [part='header'] {
    padding: var(--lr-space-l) var(--lr-space-l) 0;
  }
  [part='title'] {
    margin: 0;
    font-size: var(--lr-font-size-md);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='subtitle'] {
    margin: var(--lr-space-xs) 0 0;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='subtitle'][hidden] {
    display: none;
  }

  [part='search-row'] {
    padding: var(--lr-space-m) var(--lr-space-l) 0;
  }
  [part='search-input'] {
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-space-s) var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: inherit;
    font: inherit;
  }
  [part='search-input']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='search-input']::placeholder {
    color: var(--lr-color-text-quiet);
    opacity: 1;
  }
  [part='search-input']::-webkit-search-cancel-button,
  [part='search-input']::-webkit-search-decoration {
    appearance: none;
  }

  [part='defaults-row'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-m) var(--lr-space-l);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='defaults-hint'] {
    margin: 0;
    /* Lines the hint up under the switch's label text, not its track --
       lr-switch's own [part="base"] uses a fixed 2.25rem track
       inline-size plus a --lr-space-s gap before its label (both defined
       in switch.styles.ts, not exposed as tokens), so this indent is
       coupled to that fixed geometry rather than derived from an unrelated
       component's token. */
    padding-inline-start: calc(var(--lr-size-2-25rem) + var(--lr-space-s));
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }

  [part='body'] {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow: auto;
    padding: var(--lr-space-m) var(--lr-space-l) var(--lr-space-l);
  }
  [part='empty'] {
    margin: 0;
    padding: var(--lr-space-l) 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
  }

  [part='category'] {
    margin-block-end: var(--lr-space-l);
  }
  [part='category']:last-child {
    margin-block-end: 0;
  }
  [part='category-heading'] {
    display: flex;
    align-items: baseline;
    gap: var(--lr-space-xs);
    margin: 0 0 var(--lr-space-s);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-04em);
    color: var(--lr-color-text-quiet);
  }
  [part='category-count'] {
    font-weight: var(--lr-font-weight-normal);
    text-transform: none;
    letter-spacing: normal;
  }
  [part='category-list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  [part='tool-row'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }
  [part='tool-row'][data-disabled] [part='tool-checkbox'] {
    opacity: var(--lr-opacity-disabled);
  }
  [part='tool-checkbox'] {
    align-items: flex-start;
  }
  [part='tool-checkbox']::part(label) {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-0-125rem);
  }
  [part='tool-name'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }
  [part='tool-icon'] {
    line-height: var(--lr-line-height-none);
  }
  [part='tool-description'] {
    display: block;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='tool-disabled-reason'] {
    /* Slotted into lr-checkbox's default slot alongside tool-name/
       tool-description (see tool-select-dialog.ts's renderTool()), so it
       inherits its indent for free from ::part(label)'s column layout
       above instead of needing its own guessed padding. */
    display: block;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-warning);
  }

  [part='footer'] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
    padding: var(--lr-space-m) var(--lr-space-l);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='footer'][hidden] {
    display: none;
  }
`;
