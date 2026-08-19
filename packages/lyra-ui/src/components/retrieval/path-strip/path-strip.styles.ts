import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: block;
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='node'],
  [part='relation'] {
    /* Both pill kinds share this rule and so share the minimum hit-area floor -- a terse relation
       or short node label would otherwise stay well under the 40px floor. The strip scrolls
       horizontally (<lr-scroller> in the render template), so the extra inline space scrolls
       rather than wrapping or squeezing a neighbour. Same direct-floor treatment as
       lr-code-block's/lr-json-viewer's text-bearing [part='copy-button']/[part='toggle'], not the
       split visible-label/hit-target pattern kept for pills genuinely out of horizontal room. */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-size-2px) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-font-size-sm);
    white-space: nowrap;
    cursor: pointer;
  }
  [part='relation'] {
    color: var(--lr-color-text-quiet);
    background: transparent;
    border-color: transparent;
  }
  [part='node']:focus-visible,
  [part='relation']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='node']:hover,
  [part='relation']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='node']:active,
  [part='relation']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='arrow'] {
    display: inline-flex;
    align-items: center;
    margin-inline: var(--lr-size-2px);
    color: var(--lr-color-text-quiet);
  }
  .element-group {
    display: inline-flex;
    align-items: center;
  }
  [part='empty'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
`;
