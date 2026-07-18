import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* The host itself is the focusable role="menuitem" target (see the class
       doc) -- the ring paints on [part='base'] instead of the host's own
       box, matching lr-tree-node's identical :host(:focus-visible)
       delegation, so it always hugs the visible row rather than any
       host-level margin/inline layout quirks. */
    outline: none;
    border-radius: var(--lr-radius);
  }
  :host(:focus-visible) [part='base'] {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part='base'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-radius: var(--lr-radius);
    cursor: pointer;
    font: inherit;
    color: inherit;
    line-height: var(--lr-line-height-snug);
  }
  [part='base']:hover {
    background: var(--lr-color-brand-quiet);
  }
  :host([disabled]) [part='base'] {
    /* Shared library-wide disabled-state token -- see lr-checkbox/lr-select. */
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  :host([disabled]) [part='base']:hover {
    background: none;
  }
  :host([destructive]) [part='base'] {
    color: var(--lr-color-danger);
  }
  :host([destructive]) [part='base']:hover {
    background: var(--lr-color-danger-quiet);
  }
  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    line-height: var(--lr-line-height-none);
  }
  /* [part='icon'][hidden] rather than a bare :empty selector -- the part
     always contains a literal <slot> child element regardless of assigned
     content, so :empty never matches (same fix as lr-select's
     [part='hint']/[part='error']). Real emptiness is tracked in JS
     (hasIconSlot) and reflected via the hidden attribute instead. */
  [part='icon'][hidden] {
    display: none;
  }
  [part='label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Only ever present in the DOM at all for a checked type="checkbox" item
     (see menu-item.ts's render()) -- no [hidden]-toggling needed, unlike
     [part='icon'] above, since there's no always-present <slot> child here
     to keep visually empty in between. */
  [part='checkmark'] {
    flex: 0 0 auto;
    color: var(--lr-color-brand);
  }
`;
