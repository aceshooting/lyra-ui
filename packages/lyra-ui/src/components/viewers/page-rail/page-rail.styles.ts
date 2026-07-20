import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-page-rail-height: var(--lr-size-24rem);
  }
  [part='base'] {
    display: block;
  }
  [part='pages'] {
    --lr-virtual-list-height: var(--lr-page-rail-height);
  }
  /* Page rows are produced by this component's renderItem but are committed into the embedded
     lr-virtual-list's OWN shadow root, one boundary deeper than this stylesheet: a bare
     [part='page'] selector can never match one, so every row-level rule reaches through
     ::part(). ::part() cannot be followed by an attribute selector either, so the state variants
     (current page, heat tone, overflow marker) each carry their own name in the element's part
     list -- ::part() matches with part~= semantics, so a row is both page and page-current. */
  lr-virtual-list::part(page) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    padding: var(--lr-space-s);
    border: none;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text);
    cursor: pointer;
    box-sizing: border-box;
  }
  lr-virtual-list::part(page):hover {
    background: var(--lr-color-surface-raised);
  }
  lr-virtual-list::part(page):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* The :hover arm keeps the current row tinted while it is hovered: it matches the specificity of
     the ::part(page):hover rule above and comes later, so the current page stays identifiable
     under the pointer instead of reverting to the generic hover surface. */
  lr-virtual-list::part(page-current),
  lr-virtual-list::part(page-current):hover {
    background: var(--lr-page-rail-current-bg, var(--lr-color-brand-quiet));
  }
  lr-virtual-list::part(thumbnail) {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-block-size: var(--lr-size-4rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  lr-virtual-list::part(page-number) {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  lr-virtual-list::part(heat) {
    display: flex;
    align-items: center;
    gap: var(--lr-space-2xs);
    inset-inline-end: var(--lr-space-xs);
  }
  lr-virtual-list::part(heat-dot) {
    inline-size: var(--lr-size-6px);
    block-size: var(--lr-size-6px);
    border-radius: 50%;
    background: var(--lr-color-brand);
    font-size: var(--lr-font-size-2xs);
  }
  lr-virtual-list::part(heat-dot-success) {
    background: var(--lr-color-success);
  }
  lr-virtual-list::part(heat-dot-warning) {
    background: var(--lr-color-warning);
  }
  lr-virtual-list::part(heat-dot-danger) {
    background: var(--lr-color-danger);
  }
  lr-virtual-list::part(heat-dot-neutral) {
    background: var(--lr-color-text-quiet);
  }
  lr-virtual-list::part(heat-dot-overflow) {
    inline-size: auto;
    block-size: auto;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: var(--lr-color-text-quiet);
  }
`;
