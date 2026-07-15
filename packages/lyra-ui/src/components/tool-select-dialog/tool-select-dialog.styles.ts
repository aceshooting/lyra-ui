import { css } from 'lit';

export const styles = css`
  :host {
    /* Backdrop scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --lyra-*-overlay token exists in the design system to resolve through,
       same rationale as lyra-dialog's --lyra-dialog-overlay-color and
       lyra-tool-result-dialog's --lyra-tool-result-dialog-overlay-color). */
    --lyra-tool-select-dialog-overlay-color: var(--lyra-color-overlay);
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--lyra-overlay-stack-index, var(--lyra-layer-modal));
    align-items: center;
    justify-content: center;
    padding-block-start: max(var(--lyra-space-l), var(--lyra-safe-area-top));
    padding-block-end: max(var(--lyra-space-l), var(--lyra-safe-area-bottom));
    padding-inline-start: max(var(--lyra-space-l), var(--lyra-safe-area-inline-start));
    padding-inline-end: max(var(--lyra-space-l), var(--lyra-safe-area-inline-end));
  }
  :host([open]) {
    display: flex;
  }
  [part='backdrop'] {
    position: absolute;
    inset: 0;
    background: var(--lyra-tool-select-dialog-overlay-color);
  }
  [part='panel'] {
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: min(var(--lyra-size-30rem), 100%);
    block-size: min(var(--lyra-size-38rem), 100%);
    background: var(--lyra-color-surface);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    overflow: hidden;
  }
  [part='header'] {
    padding: var(--lyra-space-l) var(--lyra-space-l) 0;
  }
  [part='title'] {
    margin: 0;
    font-size: var(--lyra-font-size-md);
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='subtitle'] {
    margin: var(--lyra-space-xs) 0 0;
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }
  [part='subtitle'][hidden] {
    display: none;
  }

  [part='search-row'] {
    padding: var(--lyra-space-m) var(--lyra-space-l) 0;
  }
  [part='search-input'] {
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: inherit;
    font: inherit;
  }
  [part='search-input']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }

  [part='defaults-row'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-m) var(--lyra-space-l);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='defaults-hint'] {
    margin: 0;
    /* Lines the hint up under the switch's label text, not its track --
       lyra-switch's own [part="base"] uses a fixed 2.25rem track
       inline-size plus a --lyra-space-s gap before its label (both defined
       in switch.styles.ts, not exposed as tokens), so this indent is
       coupled to that fixed geometry rather than derived from an unrelated
       component's token. */
    padding-inline-start: calc(var(--lyra-size-2-25rem) + var(--lyra-space-s));
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
  }

  [part='body'] {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow: auto;
    padding: var(--lyra-space-m) var(--lyra-space-l) var(--lyra-space-l);
  }
  [part='empty'] {
    margin: 0;
    padding: var(--lyra-space-l) 0;
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-md-sm);
    text-align: center;
  }

  [part='category'] {
    margin-block-end: var(--lyra-space-l);
  }
  [part='category']:last-child {
    margin-block-end: 0;
  }
  [part='category-heading'] {
    display: flex;
    align-items: baseline;
    gap: var(--lyra-space-xs);
    margin: 0 0 var(--lyra-space-s);
    font-size: var(--lyra-font-size-xs);
    font-weight: var(--lyra-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lyra-size-0-04em);
    color: var(--lyra-color-text-quiet);
  }
  [part='category-count'] {
    font-weight: var(--lyra-font-weight-normal);
    text-transform: none;
    letter-spacing: normal;
  }
  [part='category-list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-s);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  [part='tool-row'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
  }
  [part='tool-row'][data-disabled] [part='tool-checkbox'] {
    opacity: var(--lyra-opacity-disabled);
  }
  [part='tool-checkbox'] {
    align-items: flex-start;
  }
  [part='tool-checkbox']::part(label) {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-size-0-125rem);
  }
  [part='tool-name'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-md-sm);
    font-weight: var(--lyra-font-weight-semibold);
    color: var(--lyra-color-text);
  }
  [part='tool-icon'] {
    line-height: var(--lyra-line-height-none);
  }
  [part='tool-description'] {
    display: block;
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }
  [part='tool-disabled-reason'] {
    /* Slotted into lyra-checkbox's default slot alongside tool-name/
       tool-description (see tool-select-dialog.ts's renderTool()), so it
       inherits its indent for free from ::part(label)'s column layout
       above instead of needing its own guessed padding. */
    display: block;
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-warning);
  }

  [part='footer'] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-m) var(--lyra-space-l);
    border-block-start: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='footer'][hidden] {
    display: none;
  }
`;
