import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
  }
  [part='base'] {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--lr-space-s);
    inline-size: 100%;
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-s);
    border: 0;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    text-align: start;
    text-decoration: none;
    cursor: pointer;
  }
  [part='base']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='base'][aria-disabled='true'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  /* Inline var() fallbacks rather than :host-declared properties, so a consumer can set them on any
     ancestor and a :host declaration can never shadow that. ::part(base)[aria-current='page'] is
     invalid CSS (an attribute selector cannot follow ::part), so hijacking the shared
     --lr-color-brand-quiet/--lr-color-brand tokens used to be the only route -- which repainted every
     other element reading those tokens. Unset, each falls back to the token the rule used before,
     so the rendering is unchanged. */
  [part='base'][aria-current='page'] {
    background: var(--lr-app-rail-item-current-bg, var(--lr-color-brand-quiet));
    color: var(--lr-app-rail-item-current-color, var(--lr-color-brand));
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    /* Deliberately floors only the inline axis. The row's tappable height is already guaranteed by
       [part='base']'s own min-block-size above, so flooring the icon's block axis too would add
       nothing for target size while forcing every row to --lr-icon-button-size + 2x --lr-space-s. */
    inline-size: var(--lr-icon-button-size);
    min-inline-size: var(--lr-icon-button-size);
  }
  [part='label'] {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :host([icon-only]) [part='label'] {
    position: absolute;
    inline-size: var(--lr-size-1px);
    block-size: var(--lr-size-1px);
    padding: 0;
    margin: var(--lr-size-neg-1px);
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  :host([icon-only]) [part='base'] {
    justify-content: center;
    padding-inline: 0;
  }
  [part='tooltip'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    padding: var(--lr-size-0-25rem) var(--lr-space-s);
    border-radius: var(--lr-radius);
    background: var(--lr-color-text);
    color: var(--lr-color-surface);
    font-size: var(--lr-font-size-sm);
    white-space: nowrap;
    pointer-events: none;
  }
`;
