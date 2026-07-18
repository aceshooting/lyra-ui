import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: block;
  }
  [part='node'],
  [part='relation'] {
    /* Both pill kinds share this rule, so both get the same shared minimum
       hit-area floor -- a short label (either a terse relation like "is-a" or
       a short node label) would otherwise stay well under the 40px floor.
       The strip scrolls horizontally (see <lyra-scroller> in the render
       template), so the extra inline space this can add just scrolls rather
       than forcing a wrap or squeezing a neighboring element -- the same
       "direct floor" treatment lyra-code-block's/lyra-json-viewer's own
       text-bearing [part='copy-button']/[part='toggle'] already use, not the
       narrower split visible-label/hit-target pattern reserved for pills
       genuinely out of horizontal room. */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    padding: var(--lyra-size-2px) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    font-size: var(--lyra-font-size-sm);
    white-space: nowrap;
    cursor: pointer;
  }
  [part='relation'] {
    color: var(--lyra-color-text-quiet);
    background: transparent;
    border-color: transparent;
  }
  [part='node']:focus-visible,
  [part='relation']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='arrow'] {
    display: inline-flex;
    align-items: center;
    margin-inline: var(--lyra-size-2px);
    color: var(--lyra-color-text-quiet);
  }
  .element-group {
    display: inline-flex;
    align-items: center;
  }
  [part='empty'] {
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-sm);
  }
`;
