import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --_lr-page-rail-height: var(--lr-size-24rem);
  }
  [part="base"] {
    display: block;
  }
  [part="pages"] {
    --lr-virtual-list-height: var(
      --lr-page-rail-height,
      var(--_lr-page-rail-height)
    );
  }
  /* Page rows come from this component's renderItem but commit into the embedded lr-virtual-list's
     OWN shadow root, one boundary deeper, so a bare [part='page'] can never match and every
     row-level rule goes through ::part(). ::part() also takes no attribute selector, so each state
     variant (current page, heat tone, overflow marker) carries its own part name; ::part() matches
     with part~= semantics, so a row is both page and page-current. */
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
  lr-virtual-list::part(page):active {
    background: color-mix(
      in oklab,
      var(--lr-color-surface-raised),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  lr-virtual-list::part(page):focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  lr-virtual-list::part(page-current) {
    background: var(--lr-page-rail-current-bg, var(--lr-color-brand-quiet));
  }
  /* Split out from the resting rule: it must match the ::part(page):hover rule above in
     specificity and come later, or the current page falls back to the generic hover surface under
     the pointer. */
  lr-virtual-list::part(page-current):hover {
    background: var(--lr-page-rail-current-bg, var(--lr-color-brand-quiet));
  }
  lr-virtual-list::part(page-current):active {
    background: color-mix(
      in oklab,
      var(--lr-page-rail-current-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
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
  lr-virtual-list::part(thumbnail-target) {
    display: block;
    max-inline-size: 100%;
  }
  lr-virtual-list::part(page-number) {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  /* No inset: the cluster is the third stacked child of the column-flex page button and is placed
     entirely by that flow. An inset on a position: static box is inert, and adding
     position: relative to give it effect would push a deliberately centered row off-centre. */
  lr-virtual-list::part(heat) {
    display: flex;
    align-items: center;
    gap: var(--lr-space-2xs);
  }
  lr-virtual-list::part(heat-dot) {
    inline-size: var(--lr-size-6px);
    block-size: var(--lr-size-6px);
    border-radius: 50%;
    background: var(--lr-page-rail-heat-accent-color, var(--lr-color-brand));
    font-size: var(--lr-font-size-2xs);
  }
  lr-virtual-list::part(heat-dot-success) {
    background: var(--lr-page-rail-heat-success-color, var(--lr-color-success));
  }
  lr-virtual-list::part(heat-dot-warning) {
    background: var(--lr-page-rail-heat-warning-color, var(--lr-color-warning));
  }
  lr-virtual-list::part(heat-dot-danger) {
    background: var(--lr-page-rail-heat-danger-color, var(--lr-color-danger));
  }
  lr-virtual-list::part(heat-dot-neutral) {
    background: var(
      --lr-page-rail-heat-neutral-color,
      var(--lr-color-text-quiet)
    );
  }
  lr-virtual-list::part(heat-dot-overflow) {
    inline-size: auto;
    block-size: auto;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: var(--lr-color-text-quiet);
  }
`;
