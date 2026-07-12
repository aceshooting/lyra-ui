import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* The host itself is the focusable role="menuitem" target (see the class
       doc) -- the ring paints on [part='base'] instead of the host's own
       box, matching lyra-tree-node's identical :host(:focus-visible)
       delegation, so it always hugs the visible row rather than any
       host-level margin/inline layout quirks. */
    outline: none;
    border-radius: var(--lyra-radius);
  }
  :host(:focus-visible) [part='base'] {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: calc(-1 * var(--lyra-focus-ring-width));
  }
  [part='base'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border-radius: var(--lyra-radius);
    cursor: pointer;
    font: inherit;
    color: inherit;
    line-height: 1.3;
  }
  [part='base']:hover {
    background: var(--lyra-color-brand-quiet);
  }
  :host([disabled]) [part='base'] {
    /* Shared library-wide disabled-state token -- see lyra-checkbox/lyra-select. */
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  :host([disabled]) [part='base']:hover {
    background: none;
  }
  :host([destructive]) [part='base'] {
    color: var(--lyra-color-danger);
  }
  :host([destructive]) [part='base']:hover {
    background: var(--lyra-color-danger-quiet);
  }
  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
  /* [part='icon'][hidden] rather than a bare :empty selector -- the part
     always contains a literal <slot> child element regardless of assigned
     content, so :empty never matches (same fix as lyra-select's
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
`;
