import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    outline: none; /* the host is the focusable treeitem; the visible ring lives on [part=row] */
  }
  :host(:focus-visible) [part='row'] {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='row'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    /* Depth-based indent is capped at --lyra-size-8rem (8rem) so a deeply-nested
       item can't push its content off-screen with no way back; [part=label]
       below truncates the remaining overflow and tree.styles.ts's [part=base]
       adds an overflow-x:auto fallback for whatever's left. */
    padding-inline-start: calc(
      var(--lyra-space-s) + min(var(--lyra-tree-depth, 0) * var(--lyra-space-l), var(--lyra-size-8rem))
    );
    cursor: pointer;
    border-radius: var(--lyra-radius);
  }
  [part='row']:hover {
    background: var(--lyra-color-brand-quiet);
  }
  [part='toggle'] {
    /* Deliberately smaller than the shared --lyra-icon-button-size (2.5rem,
       for standalone icon-only buttons) — this toggle sits inline in a
       compact row, but still needs a real touch target, not a 1rem hitbox. */
    min-inline-size: var(--lyra-size-1-75rem);
    min-block-size: var(--lyra-size-1-75rem);
    padding: var(--lyra-space-xs);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    color: var(--lyra-color-text-quiet);
    cursor: pointer;
    flex: 0 0 auto;
  }
  [part='toggle'][hidden] {
    /* visibility (not display) so the placeholder keeps its layout box --
       a leaf row still lines up with sibling rows that do have a chevron. */
    visibility: hidden;
  }
  :host([expanded]) [part='toggle'] {
    transform: rotate(90deg);
  }
  [part='label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='badge'] {
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text);
    background: var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    padding: 0 var(--lyra-space-xs);
  }
`;
